/**
 * Starts the real image with `docker compose` and uses it the way an operator or
 * visitor does: logs, commands, HTTP. Slow, so `bun test` skips it by name; run
 * it with `bun run test:instance`. Touches only its own compose project.
 *
 * Google's redirect can't run here. The password path below exercises the same
 * signup hook; the round trip through Google is a manual pre-release check.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3999";
const MINUTES = 60_000;

const composeArgs = [
  "compose",
  "-p",
  "stash-instance-test",
  "-f",
  "compose.yml",
  "-f",
  "test/compose.instance.yml",
];

async function run(args: string[], stdin?: string) {
  const proc = Bun.spawn(["docker", ...composeArgs, ...args], {
    stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, stdout, stderr };
}

async function compose(...args: string[]) {
  const result = await run(args);
  if (result.code !== 0) {
    throw new Error(`docker compose ${args.join(" ")}: ${result.stderr}`);
  }
  return result.stdout;
}

const psql = async (sql: string) => {
  const result = await run(
    ["exec", "-T", "db", "psql", "-U", "stash", "-d", "stash", "-v", "ON_ERROR_STOP=1", "-At"],
    sql,
  );
  if (result.code !== 0) throw new Error(`psql: ${result.stderr}`);
  return result.stdout.trim();
};

const logs = () => compose("logs", "--no-log-prefix", "app");

async function waitForApp() {
  const deadline = Date.now() + 2 * MINUTES;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/login`, { redirect: "manual" });
      if (res.status === 200) return;
    } catch {
      // Not listening yet.
    }
    await Bun.sleep(500);
  }
  throw new Error(`App never came up:\n${await logs()}`);
}

async function freshDatabase() {
  await compose("down", "-v", "--remove-orphans");
  await compose("up", "-d", "--wait", "db");
}

const setupCodes = async () =>
  [...(await logs()).matchAll(/Setup code: (\S+)/g)].map((m) => m[1]!);

// Each request looks like a new visitor, or better-auth's sign-in rate limit
// (3 per 10s per address) would decide these tests instead of the code under test.
let visitor = 0;
const headers = (cookie?: string) => ({
  origin: BASE,
  "x-forwarded-for": `203.0.113.${(visitor = (visitor + 1) % 250) + 1}`,
  ...(cookie ? { cookie } : {}),
});

const post = (path: string, body: unknown, cookie?: string) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: { ...headers(cookie), "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const get = (path: string, cookie?: string) =>
  fetch(`${BASE}${path}`, { redirect: "manual", headers: headers(cookie) });

// Only the session token, which goes to the database. A browser also holds a
// signed cache cookie that stays valid for up to 5 minutes after a revocation.
const sessionFrom = (res: Response) => {
  const token = res.headers
    .getSetCookie()
    .find((c) => c.startsWith("better-auth.session_token="));
  if (!token) throw new Error(`No session cookie: ${res.status}`);
  return token.split(";")[0]!;
};

const signUp = (email: string, code?: string, extra: object = {}) =>
  post(
    "/api/auth/sign-up/email",
    { email, password: "correct-horse", name: email.split("@")[0], ...extra },
    code ? `stash_invite=${encodeURIComponent(code)}` : undefined,
  );

const signIn = (email: string, password = "correct-horse") =>
  post("/api/auth/sign-in/email", { email, password });

const currentUser = async (session: string) => {
  const res = await get("/api/auth/get-session", session);
  const body = (await res.json()) as { user?: { email: string } } | null;
  return body?.user?.email ?? null;
};

// A no-JavaScript form post: what a browser submits for a server action.
const submit = (actionId: string, session?: string, fields: Record<string, string> = {}) => {
  const form = new FormData();
  form.set(`$ACTION_ID_${actionId}`, "");
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return fetch(`${BASE}/invites`, {
    method: "POST",
    redirect: "manual",
    headers: headers(session),
    body: form,
  });
};

const invitesPage = async (session: string) => {
  const html = await (await get("/invites", session)).text();
  return {
    actions: [...html.matchAll(/name="\$ACTION_ID_([^"]+)"/g)].map((m) => m[1]!),
    codes: [...html.matchAll(/name="code" value="([^"]+)"/g)].map((m) => m[1]!),
  };
};

const resetPassword = (email: string) =>
  run(["exec", "-T", "app", "node", "reset-password.mjs", email]);

const newPassword = (stdout: string) =>
  /New password for \S+: (\S+)/.exec(stdout)?.[1] ?? "";

// One setting away from the running instance: boots a throwaway container.
const runWith = (...env: string[]) =>
  run(["run", "--rm", "--no-deps", ...env.flatMap((e) => ["-e", e]), "app"]);

beforeAll(async () => {
  await compose("build", "app");
}, 15 * MINUTES);

afterAll(async () => {
  await compose("down", "-v", "--remove-orphans");
}, 2 * MINUTES);

describe("a fresh instance", () => {
  let setupCode = "";
  let owner = "";
  let member = "";
  let createAction = "";
  let revokeAction = "";

  beforeAll(async () => {
    await freshDatabase();
    await compose("up", "-d", "app");
    await waitForApp();
  }, 5 * MINUTES);

  test("generates its own auth secret and keeps it out of the file", async () => {
    const stat = await compose("exec", "-T", "app", "stat", "-c", "%a %s", "/data/auth-secret");
    const [mode, size] = stat.trim().split(" ");
    expect(mode).toBe("600");
    expect(Number(size)).toBeGreaterThan(32);
    expect(readFileSync("compose.yml", "utf8")).not.toContain("BETTER_AUTH_SECRET");
  });

  test("the image holds no native modules, so it can be cross-built", async () => {
    const found = await compose("exec", "-T", "app", "find", "/app/node_modules", "-name", "*.node");
    expect(found.trim()).toBe("");
  });

  test("prints one setup code, at least 128 bits long", async () => {
    const codes = await setupCodes();
    expect(codes.length).toBe(1);
    setupCode = codes[0]!;
    expect(setupCode.length).toBeGreaterThanOrEqual(22);
  });

  test("refuses signup with no code or a wrong code", async () => {
    for (const res of [await signUp("a@example.com"), await signUp("a@example.com", "wrong")]) {
      expect(res.status).toBe(403);
      expect(((await res.json()) as { code: string }).code).toBe("INVITE_REQUIRED");
    }
  });

  test("reprints the same setup code on restart until it is redeemed", async () => {
    await compose("restart", "app");
    await waitForApp();
    const codes = await setupCodes();
    expect(codes.length).toBe(2);
    expect(codes[1]).toBe(setupCode);
  }, 3 * MINUTES);

  test("redeeming the setup code creates the Owner", async () => {
    const res = await signUp("owner@example.com", setupCode);
    expect(res.status).toBe(200);
    owner = sessionFrom(res);
    expect((await get("/invites", owner)).status).toBe(200);
  });

  test("the setup code works only once", async () => {
    expect((await signUp("late@example.com", setupCode)).status).toBe(403);
  });

  test("no setup code appears once an account exists, and sessions survive recreating the container", async () => {
    await compose("up", "-d", "--force-recreate", "--no-deps", "app");
    await waitForApp();
    // Recreating replaces the logs, so any setup code here would be a new one.
    expect(await setupCodes()).toEqual([]);
    expect(await currentUser(owner)).toBe("owner@example.com");
  }, 3 * MINUTES);

  test("the Owner creates a code that admits one person", async () => {
    createAction = (await invitesPage(owner)).actions[0]!;
    expect((await submit(createAction, owner)).status).toBeLessThan(400);

    const { codes, actions } = await invitesPage(owner);
    expect(codes.length).toBe(1);
    revokeAction = actions[1]!;

    const res = await signUp("member@example.com", codes[0]);
    expect(res.status).toBe(200);
    member = sessionFrom(res);
    expect((await signUp("second@example.com", codes[0])).status).toBe(403);
    expect((await invitesPage(owner)).codes).toEqual([]);
  });

  test("a signup that fails on an existing email leaves the code unused", async () => {
    await submit(createAction, owner);
    const [code] = (await invitesPage(owner)).codes;
    expect((await signUp("member@example.com", code)).status).toBe(422);
    expect((await invitesPage(owner)).codes).toEqual([code!]);
    await submit(revokeAction, owner, { code: code! });
  });

  test("a revoked code stops working", async () => {
    await submit(createAction, owner);
    const [code] = (await invitesPage(owner)).codes;
    await submit(revokeAction, owner, { code: code! });
    expect((await invitesPage(owner)).codes).toEqual([]);
    expect((await signUp("revoked@example.com", code)).status).toBe(403);
  });

  test("two people submitting one code at once: only one gets in", async () => {
    await submit(createAction, owner);
    const [code] = (await invitesPage(owner)).codes;
    const results = await Promise.all(
      ["race1", "race2", "race3", "race4"].map((n) => signUp(`${n}@example.com`, code)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 403, 403, 403]);
  });

  test("the invites page doesn't exist for anyone but the Owner", async () => {
    expect((await get("/invites", member)).status).toBe(404);
    expect((await get("/invites")).status).toBe(404);
  });

  test("invite actions are refused on the server for anyone but the Owner", async () => {
    await submit(createAction, owner);
    const { codes: before } = await invitesPage(owner);
    expect(before.length).toBe(1);

    await submit(createAction, member);
    await submit(createAction);
    await submit(revokeAction, member, { code: before[0]! });
    await submit(revokeAction, undefined, { code: before[0]! });

    expect((await invitesPage(owner)).codes).toEqual(before);
    await submit(revokeAction, owner, { code: before[0]! });
  });

  test("no request can make itself the Owner", async () => {
    await submit(createAction, owner);
    const [code] = (await invitesPage(owner)).codes;
    // better-auth ignores the field on signup rather than refusing the request.
    const sneaky = sessionFrom(await signUp("sneaky@example.com", code, { isOwner: true }));
    expect((await get("/invites", sneaky)).status).toBe(404);

    expect((await post("/api/auth/update-user", { isOwner: true }, member)).status).toBe(400);
    expect((await get("/invites", member)).status).toBe(404);
  });

  test("pages render, despite the build having no secret to prerender with", async () => {
    for (const path of ["/", "/login", "/signup"]) {
      expect([path, (await get(path)).status]).toEqual([path, 200]);
    }
  });

  test("the reset command replaces a password and ends old sessions", async () => {
    const reset = await resetPassword("member@example.com");
    expect(reset.code).toBe(0);
    const password = newPassword(reset.stdout);
    expect(password.length).toBeGreaterThanOrEqual(16);

    expect((await signIn("member@example.com")).status).toBe(401);
    expect((await signIn("member@example.com", password)).status).toBe(200);
    expect(await currentUser(member)).toBeNull();
  });

  test("the reset command gives a Google-only account a password login", async () => {
    await psql(`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
        values ('g1', 'g', 'google@example.com', true, now(), now());
      insert into account (id, account_id, provider_id, user_id, created_at, updated_at)
        values ('a1', '123', 'google', 'g1', now(), now());`);
    const reset = await resetPassword("Google@Example.com");
    expect(reset.code).toBe(0);
    expect((await signIn("google@example.com", newPassword(reset.stdout))).status).toBe(200);
  });

  test("the reset command fails clearly on an unknown email", async () => {
    const reset = await resetPassword("nobody@example.com");
    expect(reset.code).not.toBe(0);
    expect(reset.stderr).toContain("No account for nobody@example.com");
  });

  test("with no Google settings there is no Google login", async () => {
    for (const path of ["/login", "/signup"]) {
      expect(await (await get(path)).text()).not.toContain("Continue with Google");
    }
    const res = await post("/api/auth/sign-in/social", { provider: "google" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("setting only one Google value stops the boot with a clear message", async () => {
    const boot = await runWith("GOOGLE_CLIENT_ID=abc");
    expect(boot.code).not.toBe(0);
    expect(boot.stderr + boot.stdout).toContain(
      "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither.",
    );
  }, MINUTES);

  test("production refuses to boot with no database address", async () => {
    const boot = await runWith("DATABASE_URL=");
    expect(boot.code).not.toBe(0);
    expect(boot.stderr + boot.stdout).toContain("DATABASE_URL");
  }, MINUTES);

  test("setting both Google values shows the button", async () => {
    await compose(
      "run",
      "-d",
      "--rm",
      "--no-deps",
      "--name",
      "stash-instance-test-google",
      "-p",
      "127.0.0.1:3998:3000",
      "-e",
      "GOOGLE_CLIENT_ID=abc",
      "-e",
      "GOOGLE_CLIENT_SECRET=def",
      "app",
    );
    try {
      let html = "";
      const deadline = Date.now() + MINUTES;
      while (Date.now() < deadline && !html) {
        html = await fetch("http://localhost:3998/login")
          .then((r) => r.text())
          .catch(() => "");
        if (!html) await Bun.sleep(500);
      }
      expect(html).toContain("Continue with Google");
    } finally {
      await Bun.spawn(["docker", "rm", "-f", "stash-instance-test-google"], {
        stdout: "ignore",
        stderr: "ignore",
      }).exited;
    }
  }, 2 * MINUTES);
});

describe("upgrading an instance that already has accounts", () => {
  beforeAll(async () => {
    await freshDatabase();

    // The schema as it was at the last release before Owners, recorded as applied.
    const { entries } = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: { tag: string; when: number }[];
    };
    const previous = entries.filter((e) => e.tag < "0004");
    for (const { tag } of previous) {
      await psql(readFileSync(`drizzle/${tag}.sql`, "utf8"));
    }
    await psql(`
      create schema if not exists drizzle;
      create table drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);
      insert into drizzle.__drizzle_migrations (hash, created_at) values ('previous', ${previous.at(-1)!.when});
      insert into "user" (id, name, email, email_verified, created_at, updated_at) values
        ('later', 'later', 'later@example.com', false, '2026-02-01', '2026-02-01'),
        ('first', 'first', 'first@example.com', false, '2026-01-01', '2026-01-01');
      insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at) values
        ('a1', 'later', 'credential', 'later', 'x', now(), now()),
        ('a2', 'first', 'credential', 'first', 'x', now(), now());`);

    await compose("up", "-d", "app");
    await waitForApp();
  }, 5 * MINUTES);

  test("creates no setup code", async () => {
    expect(await setupCodes()).toEqual([]);
    expect(await psql("select count(*) from invite_code")).toBe("0");
  });

  test("makes the earliest account the Owner, and only that one", async () => {
    const asUser = async (email: string) => {
      const { stdout } = await resetPassword(email);
      return sessionFrom(await signIn(email, newPassword(stdout)));
    };
    expect((await get("/invites", await asUser("first@example.com"))).status).toBe(200);
    expect((await get("/invites", await asUser("later@example.com"))).status).toBe(404);
  });
});

describe("pointing at a database that already has conflicting tables", () => {
  test("stops the boot and leaves the other data alone", async () => {
    await freshDatabase();
    await psql(`create table "user" (id int primary key); insert into "user" values (7);`);

    await compose("up", "-d", "app");
    let state = "";
    const deadline = Date.now() + 2 * MINUTES;
    while (Date.now() < deadline && !state.includes("exited")) {
      state = await compose("ps", "-a", "--format", "{{.State}}", "app");
      await Bun.sleep(500);
    }
    expect(state).toContain("exited");
    const exit = await compose("ps", "-a", "--format", "{{.ExitCode}}", "app");
    expect(exit.trim()).not.toBe("0");
    expect(await psql(`select id from "user"`)).toBe("7");
    expect(await psql(`select count(*) from information_schema.tables where table_name = 'items'`)).toBe("0");
  }, 3 * MINUTES);
});
