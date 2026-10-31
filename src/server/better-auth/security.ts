import { passkey } from "@better-auth/passkey";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { twoFactor } from "better-auth/plugins/two-factor";

// How long after signing in someone counts as having just proven who they are.
// Also the `session.freshAge` that guards adding a passkey.
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

// The plugin's own challenge only covers password sign-in. These are the other
// ways a person arrives through Google: the redirect, and a direct ID token.
const GOOGLE_CALLBACK = "/callback/:id";
const GOOGLE_ID_TOKEN = "/sign-in/social";

type Middleware = Parameters<typeof createAuthMiddleware>[0];
type AuthContext = Parameters<Middleware>[0];

async function requireRecentSignIn(
  ctx: AuthContext,
  when: (userId: string) => Promise<boolean> | boolean = () => true,
) {
  const session = await getSessionFromCtx(ctx);
  // No session: the endpoint's own check answers it.
  if (!session || !(await when(session.user.id))) return;
  const age = Date.now() - new Date(session.session.createdAt).getTime();
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
      await requireRecentSignIn(ctx, async (userId) => {
        const accounts = await ctx.context.internalAdapter.findAccounts(userId);
        return !accounts.some((a) => a.providerId === "credential");
      });
    }
    // Adding a passkey needs a fresh session too, through freshAge.
    if (ctx.path === "/passkey/delete-passkey") await requireRecentSignIn(ctx);
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
      await signOutOtherBrowsers(ctx);
    }
  }),
};
