import { passkey } from "@better-auth/passkey";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { twoFactor } from "better-auth/plugins/two-factor";

// How long after signing in someone counts as having just proven who they are.
export const RECENT_SIGN_IN_SECONDS = 10 * 60;

export const secondFactor = twoFactor({
  issuer: "Stash",
  // Google-only accounts have no password to confirm. They need a recent sign-in
  // instead: see the before hook.
  allowPasswordless: true,
});

// baseURL is only unset while the image builds, with env validation skipped.
export const securityPasskey = (baseURL: string | undefined) =>
  passkey({
    rpName: "Stash",
    origin: baseURL ? new URL(baseURL).origin : null,
    authenticatorSelection: { userVerification: "required" },
  });

// Every endpoint that changes a second factor or reveals its secrets.
const SECOND_FACTOR_CHANGES = [
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
  "/two-factor/get-totp-uri",
];

// These re-sign the cookie cache from the session they're given, so a revoked one
// could otherwise keep itself alive until it expires, days later.
const CACHE_RENEWERS = ["/update-user", "/update-session"];

const PASSKEY_CHANGES = [
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/passkey/delete-passkey",
];

// The plugin's own challenge only covers password sign-in. These are the other
// ways a person arrives through Google: the redirect, and a direct ID token.
const GOOGLE_CALLBACK = "/callback/:id";
const GOOGLE_ID_TOKEN = "/sign-in/social";

type Middleware = Parameters<typeof createAuthMiddleware>[0];
type AuthContext = Parameters<Middleware>[0];

type LiveSession = {
  session: { createdAt: Date | string };
  user: { id: string; twoFactorEnabled?: boolean | null };
};

// From the database, not the signed cookie cache, where a revoked session stays
// valid for 5 minutes. Long enough for an intruder who was just signed out to add
// a passkey and keep their way in.
async function liveSession(ctx: AuthContext) {
  const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
  if (!session) {
    throw new APIError("UNAUTHORIZED", {
      code: "UNAUTHORIZED",
      message: "unauthorized",
    });
  }
  return session as LiveSession;
}

function requireRecentSignIn({ session }: LiveSession) {
  const age = Date.now() - new Date(session.createdAt).getTime();
  if (age >= RECENT_SIGN_IN_SECONDS * 1000) {
    throw new APIError("FORBIDDEN", {
      code: "SESSION_NOT_FRESH",
      message: "session_not_fresh",
    });
  }
}

// The plugin passes requireUserVerification: false to its verifier, and a passkey
// signs in without a second factor, so it has to prove a fingerprint, face or PIN
// was used. The flag sits inside the data the passkey signs: tampering with it
// fails the plugin's signature check, which runs after this.
function requireUserVerification(ctx: AuthContext) {
  const body = ctx.body as
    { response?: { response?: { authenticatorData?: unknown } } } | undefined;
  const data = body?.response?.response?.authenticatorData;
  const flags =
    typeof data === "string" ? Buffer.from(data, "base64url")[32] : undefined;
  if (!flags || !(flags & 0x04)) {
    throw new APIError("FORBIDDEN", {
      code: "USER_VERIFICATION_REQUIRED",
      message: "user_verification_required",
    });
  }
}

const challengeHook = secondFactor.hooks.after[0]!.handler as (
  ctx: AuthContext,
) => Promise<
  | { headers?: Headers; response?: { twoFactorRedirect?: boolean } }
  | null
  | undefined
>;

// Runs the plugin's own challenge on a Google sign-in. It leans on the plugin's
// internal hook and return shape, which is why better-auth is pinned to an exact
// version and security.test.ts covers both paths: check them on any upgrade.
async function challengeGoogleSignIn(ctx: AuthContext) {
  const result = await challengeHook(ctx);
  if (!result?.response?.twoFactorRedirect) return;
  for (const cookie of result.headers?.getSetCookie() ?? []) {
    ctx.responseHeaders?.append("set-cookie", cookie);
  }
  if (ctx.path === GOOGLE_CALLBACK) throw ctx.redirect("/two-factor");
  return ctx.json(result.response);
}

// Finishing setup swaps in a new session, which better-auth dates now. It proves no
// sign-in, so it mustn't pass as a recent one.
async function keepSessionAge(ctx: AuthContext) {
  const previous = ctx.context.session?.session;
  const current = ctx.context.newSession?.session;
  if (!previous || !current || previous.token === current.token) return;
  await ctx.context.internalAdapter.updateSession(current.token, {
    createdAt: new Date(previous.createdAt),
  });
}

// Someone turning this on may suspect a break-in, so it has to remove the intruder.
async function signOutOtherBrowsers(ctx: AuthContext) {
  const current = ctx.context.newSession;
  if (!current || !ctx.context.session) return;
  const sessions = await ctx.context.internalAdapter.listSessions(
    current.user.id,
  );
  const others = sessions
    .map((session) => session.token)
    .filter((token) => token !== current.session.token);
  if (others.length) await ctx.context.internalAdapter.deleteSessions(others);
}

export const securityHooks = {
  before: createAuthMiddleware(async (ctx) => {
    if (SECOND_FACTOR_CHANGES.includes(ctx.path)) {
      const session = await liveSession(ctx);
      // The plugin would replace the secret at once, with no code to confirm it,
      // so a stale tab could leave someone locked out.
      if (ctx.path === "/two-factor/enable" && session.user.twoFactorEnabled) {
        throw new APIError("BAD_REQUEST", {
          code: "SECOND_FACTOR_ALREADY_ON",
          message: "second_factor_already_on",
        });
      }
      const accounts = await ctx.context.internalAdapter.findAccounts(
        session.user.id,
      );
      // With a password, the plugin confirms it instead.
      if (!accounts.some((a) => a.providerId === "credential")) {
        requireRecentSignIn(session);
      }
    }
    if (PASSKEY_CHANGES.includes(ctx.path)) {
      requireRecentSignIn(await liveSession(ctx));
    }
    if (CACHE_RENEWERS.includes(ctx.path)) await liveSession(ctx);
    // With a session cookie, these confirm a setup or spend a code for that
    // session, and confirming a setup creates a new one. A pending sign-in has no
    // session cookie and proves itself with its code.
    if (
      ctx.path.startsWith("/two-factor/verify-") &&
      (await ctx.getSignedCookie(
        ctx.context.authCookies.sessionToken.name,
        ctx.context.secret,
      ))
    ) {
      await liveSession(ctx);
    }
    // Nothing in the app links an account, and a linked Google identity is a
    // lasting way in, as a passkey is.
    if (ctx.path === "/link-social") {
      throw new APIError("FORBIDDEN", {
        code: "LINKING_NOT_SUPPORTED",
        message: "linking_not_supported",
      });
    }
    // Nothing in the app unlinks an account, and removing the password would turn
    // "confirm your password" into "signed in recently".
    if (ctx.path === "/unlink-account") {
      throw new APIError("FORBIDDEN", {
        code: "UNLINKING_NOT_SUPPORTED",
        message: "unlinking_not_supported",
      });
    }
    if (ctx.path === "/passkey/verify-authentication") {
      requireUserVerification(ctx);
    }
    // The plugin would otherwise honour this for 30 days. Stash always asks.
    if (
      ctx.path.startsWith("/two-factor/verify-") &&
      (ctx.body as { trustDevice?: unknown } | undefined)?.trustDevice
    ) {
      throw new APIError("BAD_REQUEST", {
        code: "TRUST_DEVICE_NOT_SUPPORTED",
        message: "trust_device_not_supported",
      });
    }
  }),
  after: createAuthMiddleware(async (ctx) => {
    if (ctx.path === GOOGLE_CALLBACK || ctx.path === GOOGLE_ID_TOKEN) {
      return challengeGoogleSignIn(ctx);
    }
    if (ctx.path === "/two-factor/verify-totp") {
      await keepSessionAge(ctx);
      await signOutOtherBrowsers(ctx);
    }
  }),
};
