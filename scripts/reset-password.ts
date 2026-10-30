/**
 * Gives an account a new password, for an instance with no mailer. An operator
 * runs it inside the container:
 *
 *   docker compose exec app node reset-password.mjs someone@example.com
 *
 * Reads DATABASE_URL directly: env validation also demands the auth secret, which
 * only the server's own process holds, and hashing doesn't use it.
 */

import { randomBytes, randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.DATABASE_URL;
if (!email || !url) {
  console.error(
    email
      ? "DATABASE_URL is not set."
      : "Usage: node reset-password.mjs someone@example.com",
  );
  process.exit(1);
}

const password = randomBytes(18).toString("base64url");
const hash = await hashPassword(password);
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => undefined });

try {
  const found = await sql.begin(async (tx) => {
    const [user] = await tx<{ id: string }[]>`
      select id from "user" where email = ${email}`;
    if (!user) return false;

    const updated = await tx`
      update account set password = ${hash}, updated_at = now()
      where user_id = ${user.id} and provider_id = 'credential'`;
    // A Google-only account has no password record yet.
    if (updated.count === 0) {
      await tx`
        insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at)
        values (${randomUUID()}, ${user.id}, 'credential', ${user.id}, ${hash}, now(), now())`;
    }
    await tx`delete from session where user_id = ${user.id}`;
    return true;
  });

  if (!found) {
    console.error(`No account for ${email}.`);
    process.exitCode = 1;
  } else {
    console.log(`New password for ${email}: ${password}`);
  }
} finally {
  await sql.end();
}
