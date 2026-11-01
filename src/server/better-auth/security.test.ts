import { afterAll, beforeAll, expect, test } from "bun:test";

import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

import {
  RECENT_SIGN_IN_SECONDS,
  securityHooks,
  securityPasskey,
  secondFactor,
} from "./security";

const BASE = "http://localhost:3000";
const JSON_HEADERS = { "content-type": "application/json", origin: BASE };

// Google is the one thing faked: everything from its token response on is
// better-auth's real callback.
let googleUser = { sub: "", email: "" };
const realFetch = globalThis.fetch;
const encode = (part: object) =>
  Buffer.from(JSON.stringify(part)).toString("base64url");
const idToken = () =>
  `${encode({})}.${encode({ ...googleUser, email_verified: true, name: "n" })}.sig`;

beforeAll(() => {
  globalThis.fetch = (async (
    input: Request | string | URL,
    init?: RequestInit,
  ) =>
    String(input instanceof Request ? input.url : input).includes(
      "oauth2.googleapis.com/token",
    )
      ? Response.json({
          access_token: "a",
          token_type: "Bearer",
          expires_in: 3600,
          id_token: idToken(),
        })
      : realFetch(input, init)) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

type Row = Record<string, unknown>;

function instance() {
  const db: Record<string, Row[]> = {
    user: [],
    account: [],
    session: [],
    verification: [],
    twoFactor: [],
    passkey: [],
  };
  const auth = betterAuth({
    baseURL: BASE,
    secret: "a-test-secret-that-is-long-enough-to-pass",
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    // As in config.ts: a revoked session stays valid in this cache for 5 minutes.
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    logger: { disabled: true },
    socialProviders: {
      google: {
        clientId: "id",
        clientSecret: "secret",
        verifyIdToken: async () => true,
      },
    },
    plugins: [secondFactor, securityPasskey(BASE)],
    hooks: securityHooks,
  });

  class Browser {
    cookies = new Map<string, string>();

    keep(res: Response) {
      for (const cookie of res.headers.getSetCookie()) {
        const [pair] = cookie.split(";");
        const at = pair!.indexOf("=");
        const [name, value] = [pair!.slice(0, at), pair!.slice(at + 1)];
        if (!value || /max-age=0/i.test(cookie)) this.cookies.delete(name);
        else this.cookies.set(name, value);
      }
      return res;
    }

    get cookie() {
      return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    }

    get signedIn() {
      return this.cookies.has("better-auth.session_token");
    }

    async post(path: string, body: object = {}) {
      return this.keep(
        await auth.handler(
          new Request(`${BASE}/api/auth${path}`, {
            method: "POST",
            headers: { ...JSON_HEADERS, cookie: this.cookie },
            body: JSON.stringify(body),
          }),
        ),
      );
    }

    async google(sub: string, email: string) {
      googleUser = { sub, email };
      const start = await this.post("/sign-in/social", {
        provider: "google",
        callbackURL: "/stash",
      });
      const { url } = (await start.json()) as { url: string };
      const state = new URL(url).searchParams.get("state");
      return this.keep(
        await auth.handler(
          new Request(
            `${BASE}/api/auth/callback/google?code=c&state=${state}`,
            { headers: { cookie: this.cookie } },
          ),
        ),
      );
    }
  }

  const code = (secret: string) =>
    createOTP(secret, { digits: 6, period: 30 }).totp();

  // Turned on the way a person does it: confirm the password, then a first code.
  const turnOn = async (browser: Browser, password?: string) => {
    const res = await browser.post("/two-factor/enable", { password });
    expect(res.status).toBe(200);
    const { totpURI, backupCodes } = (await res.json()) as {
      totpURI: string;
      backupCodes: string[];
    };
    const secret = new TextDecoder().decode(
      base32.decode(new URL(totpURI).searchParams.get("secret")!),
    );
    const verified = await browser.post("/two-factor/verify-totp", {
      code: await code(secret),
    });
    expect(verified.status).toBe(200);
    return { secret, backupCodes };
  };

  const signUp = async (email: string) => {
    const browser = new Browser();
    const res = await browser.post("/sign-up/email", {
      email,
      password: "correct-horse",
      name: "n",
    });
    expect(res.status).toBe(200);
    return browser;
  };

  const googleOnly = async (sub: string, email: string) => {
    const browser = new Browser();
    const res = await browser.google(sub, email);
    expect(res.headers.get("location")).toBe("/stash");
    return browser;
  };

  const ageSessions = () => {
    const long = new Date(Date.now() - (RECENT_SIGN_IN_SECONDS + 1) * 1000);
    for (const row of db.session!) row.createdAt = long;
  };

  return { db, Browser, code, turnOn, signUp, googleOnly, ageSessions };
}

test("Google sign-in without a second factor goes straight to the stash", async () => {
  const { googleOnly } = instance();
  const browser = await googleOnly("g1", "off@example.com");
  expect(browser.signedIn).toBe(true);
});

test("Google sign-in with a second factor waits for the code", async () => {
  const { Browser, googleOnly, turnOn, code, db } = instance();
  const { secret } = await turnOn(await googleOnly("g1", "on@example.com"));
  db.session!.length = 0;

  const browser = new Browser();
  const res = await browser.google("g1", "on@example.com");
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/two-factor");
  expect(browser.signedIn).toBe(false);
  expect(db.session!.length).toBe(0);

  const wrong = await browser.post("/two-factor/verify-totp", {
    code: "000000",
  });
  expect(wrong.status).toBe(401);
  expect(browser.signedIn).toBe(false);

  const right = await browser.post("/two-factor/verify-totp", {
    code: await code(secret),
  });
  expect(right.status).toBe(200);
  expect(browser.signedIn).toBe(true);
});

test("signing in with a Google ID token can't skip the second factor", async () => {
  const { Browser, googleOnly, turnOn, db } = instance();
  await turnOn(await googleOnly("g1", "on@example.com"));
  db.session!.length = 0;

  const browser = new Browser();
  const res = await browser.post("/sign-in/social", {
    provider: "google",
    idToken: {
      token: `${encode({})}.${encode({ sub: "g1", email: "on@example.com", email_verified: true, name: "n" })}.sig`,
    },
  });
  expect(
    ((await res.json()) as { twoFactorRedirect?: boolean }).twoFactorRedirect,
  ).toBe(true);
  expect(browser.signedIn).toBe(false);
  expect(db.session!.length).toBe(0);
});

test("password sign-in with a second factor waits for the code", async () => {
  const { Browser, signUp, turnOn } = instance();
  await turnOn(await signUp("on@example.com"), "correct-horse");

  const browser = new Browser();
  const res = await browser.post("/sign-in/email", {
    email: "on@example.com",
    password: "correct-horse",
  });
  expect(
    ((await res.json()) as { twoFactorRedirect?: boolean }).twoFactorRedirect,
  ).toBe(true);
  expect(browser.signedIn).toBe(false);
});

test("a backup code works once in place of the code", async () => {
  const { Browser, signUp, turnOn } = instance();
  const { backupCodes } = await turnOn(
    await signUp("on@example.com"),
    "correct-horse",
  );
  const signIn = async () => {
    const browser = new Browser();
    await browser.post("/sign-in/email", {
      email: "on@example.com",
      password: "correct-horse",
    });
    return browser.post("/two-factor/verify-backup-code", {
      code: backupCodes[0],
    });
  };

  expect((await signIn()).status).toBe(200);
  expect((await signIn()).status).toBe(401);
});

test("turning on a second factor signs out other browsers, and keeps this one", async () => {
  const { Browser, signUp, turnOn, db } = instance();
  const here = await signUp("on@example.com");
  const elsewhere = new Browser();
  await elsewhere.post("/sign-in/email", {
    email: "on@example.com",
    password: "correct-horse",
  });
  expect(db.session!.length).toBe(2);

  await turnOn(here, "correct-horse");
  expect(here.signedIn).toBe(true);
  expect(db.session!.length).toBe(1);
  expect(here.cookie).toContain(String(db.session![0]!.token));
});

test("a browser that was signed out can't add a passkey from its cached session", async () => {
  const { Browser, signUp, turnOn } = instance();
  const here = await signUp("on@example.com");
  const intruder = new Browser();
  await intruder.post("/sign-in/email", {
    email: "on@example.com",
    password: "correct-horse",
  });
  await turnOn(here, "correct-horse");

  const added = await intruder.post("/passkey/verify-registration", {
    response: {},
  });
  expect(added.status).toBe(401);
  const changed = await intruder.post("/two-factor/generate-backup-codes", {
    password: "correct-horse",
  });
  expect(changed.status).toBe(401);
});

test("a second factor that's on can't be replaced by setting it up again", async () => {
  const { Browser, signUp, turnOn, code } = instance();
  const here = await signUp("on@example.com");
  const { secret } = await turnOn(here, "correct-horse");

  const again = await here.post("/two-factor/enable", {
    password: "correct-horse",
  });
  expect(again.status).toBe(400);
  expect(((await again.json()) as { code: string }).code).toBe(
    "SECOND_FACTOR_ALREADY_ON",
  );

  const browser = new Browser();
  await browser.post("/sign-in/email", {
    email: "on@example.com",
    password: "correct-horse",
  });
  const res = await browser.post("/two-factor/verify-totp", {
    code: await code(secret),
  });
  expect(res.status).toBe(200);
});

test("a password can't be unlinked to skip confirming it", async () => {
  const { db, signUp, turnOn } = instance();
  const browser = await signUp("on@example.com");
  await turnOn(browser, "correct-horse");
  const now = new Date();
  db.account!.push({
    id: "g",
    userId: db.user![0]!.id,
    providerId: "google",
    accountId: "g1",
    createdAt: now,
    updatedAt: now,
  });

  const unlinked = await browser.post("/unlink-account", {
    providerId: "credential",
  });
  expect(unlinked.status).toBe(403);
  expect(db.account!.length).toBe(2);
  const off = await browser.post("/two-factor/disable", {});
  expect(off.status).toBe(400);
});

test("giving a code at sign-in doesn't sign out other browsers", async () => {
  const { Browser, signUp, turnOn, code, db } = instance();
  const here = await signUp("on@example.com");
  const { secret } = await turnOn(here, "correct-horse");

  const elsewhere = new Browser();
  await elsewhere.post("/sign-in/email", {
    email: "on@example.com",
    password: "correct-horse",
  });
  await elsewhere.post("/two-factor/verify-totp", { code: await code(secret) });
  expect(elsewhere.signedIn).toBe(true);
  expect(db.session!.length).toBe(2);
});

test("a Google-only account needs a recent sign-in to change its second factor", async () => {
  const { googleOnly, turnOn, ageSessions } = instance();
  const browser = await googleOnly("g1", "on@example.com");

  ageSessions();
  const stale = await browser.post("/two-factor/enable", {});
  expect(stale.status).toBe(403);
  expect(((await stale.json()) as { code: string }).code).toBe(
    "SESSION_NOT_FRESH",
  );

  const fresh = await googleOnly("g1", "on@example.com");
  await turnOn(fresh);

  ageSessions();
  for (const path of [
    "/two-factor/disable",
    "/two-factor/generate-backup-codes",
    "/two-factor/get-totp-uri",
  ]) {
    expect([path, (await fresh.post(path, {})).status]).toEqual([path, 403]);
  }
});

test("a password account confirms its password, however old the sign-in", async () => {
  const { signUp, turnOn, ageSessions } = instance();
  const browser = await signUp("on@example.com");
  await turnOn(browser, "correct-horse");
  ageSessions();

  const wrong = await browser.post("/two-factor/disable", {
    password: "nope-nope",
  });
  expect(wrong.status).toBe(400);
  const right = await browser.post("/two-factor/disable", {
    password: "correct-horse",
  });
  expect(right.status).toBe(200);
});

test("a passkey can't be added or removed without a recent sign-in", async () => {
  const { db, signUp, ageSessions } = instance();
  const browser = await signUp("on@example.com");
  db.passkey!.push({
    id: "p1",
    userId: db.user![0]!.id,
    publicKey: "k",
    credentialID: "c",
    counter: 0,
    deviceType: "singleDevice",
    backedUp: false,
  });
  ageSessions();

  const removed = await browser.post("/passkey/delete-passkey", { id: "p1" });
  expect(removed.status).toBe(403);
  const added = await browser.post("/passkey/verify-registration", {
    response: {},
  });
  expect(added.status).toBe(403);
  expect(db.passkey!.length).toBe(1);
});

// Flags live at byte 32 of the authenticator data; 0x04 is user verification.
const authenticatorData = (flags: number) => {
  const data = Buffer.alloc(37);
  data[32] = flags;
  return data.toString("base64url");
};

test("a passkey sign-in without fingerprint, face or PIN is refused", async () => {
  const { Browser } = instance();
  const res = await new Browser().post("/passkey/verify-authentication", {
    response: { response: { authenticatorData: authenticatorData(0x01) } },
  });
  expect(res.status).toBe(403);
  expect(((await res.json()) as { code: string }).code).toBe(
    "USER_VERIFICATION_REQUIRED",
  );
});

test("a passkey sign-in with user verification reaches the signature check", async () => {
  const { Browser } = instance();
  const res = await new Browser().post("/passkey/verify-authentication", {
    response: { response: { authenticatorData: authenticatorData(0x05) } },
  });
  expect(((await res.json()) as { code?: string }).code).not.toBe(
    "USER_VERIFICATION_REQUIRED",
  );
  expect(res.status).toBe(400);
});

test("a device can't be marked as trusted", async () => {
  const { Browser, signUp, turnOn, code } = instance();
  const { secret } = await turnOn(
    await signUp("on@example.com"),
    "correct-horse",
  );

  const browser = new Browser();
  await browser.post("/sign-in/email", {
    email: "on@example.com",
    password: "correct-horse",
  });
  const res = await browser.post("/two-factor/verify-totp", {
    code: await code(secret),
    trustDevice: true,
  });
  expect(res.status).toBe(400);
  expect(browser.signedIn).toBe(false);
});

test("a revoked session can't renew its cookie cache through /update-user", async () => {
  const { signUp, db } = instance();
  const live = await signUp("on@example.com");
  const ok = await live.post("/update-user", { name: "still-live" });
  expect(ok.status).toBe(200);

  db.session!.length = 0;
  const renewed = await live.post("/update-user", { name: "revoked" });
  expect(renewed.status).toBe(401);
  expect(db.user![0]!.name).toBe("still-live");
});

test("a revoked session can't finish a pending second factor setup", async () => {
  const { signUp, code, db } = instance();
  const browser = await signUp("on@example.com");
  const enable = await browser.post("/two-factor/enable", {
    password: "correct-horse",
  });
  const { totpURI } = (await enable.json()) as { totpURI: string };
  const secret = new TextDecoder().decode(
    base32.decode(new URL(totpURI).searchParams.get("secret")!),
  );

  db.session!.length = 0;
  const res = await browser.post("/two-factor/verify-totp", {
    code: await code(secret),
  });
  expect(res.status).toBe(401);
  expect(db.user![0]!.twoFactorEnabled).toBe(false);
  expect(db.session!.length).toBe(0);
});

test("a revoked session can't spend a backup code", async () => {
  const { signUp, turnOn, db } = instance();
  const browser = await signUp("on@example.com");
  const { backupCodes } = await turnOn(browser, "correct-horse");

  db.session!.length = 0;
  const res = await browser.post("/two-factor/verify-backup-code", {
    code: backupCodes[0],
  });
  expect(res.status).toBe(401);
});

test("finishing second factor setup doesn't count as a recent sign-in", async () => {
  const { signUp, code, ageSessions } = instance();
  const browser = await signUp("on@example.com");
  const enable = await browser.post("/two-factor/enable", {
    password: "correct-horse",
  });
  const { totpURI } = (await enable.json()) as { totpURI: string };
  const secret = new TextDecoder().decode(
    base32.decode(new URL(totpURI).searchParams.get("secret")!),
  );

  ageSessions();
  const res = await browser.post("/two-factor/verify-totp", {
    code: await code(secret),
  });
  expect(res.status).toBe(200);
  const passkey = await browser.post("/passkey/verify-registration", {
    response: {},
  });
  expect(passkey.status).toBe(403);
});

test("an account can't be linked to another sign-in method", async () => {
  const { signUp } = instance();
  const browser = await signUp("on@example.com");
  const res = await browser.post("/link-social", {
    provider: "google",
    callbackURL: "/stash",
  });
  expect(res.status).toBe(403);
  expect(((await res.json()) as { code: string }).code).toBe(
    "LINKING_NOT_SUPPORTED",
  );
});
