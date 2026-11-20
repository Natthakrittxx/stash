/**
 * Clears an account's second factor, for someone who lost their authenticator and
 * backup codes, or an instance that lost BETTER_AUTH_SECRET. An operator runs it
 * inside the container:
 *
 *   docker compose exec app node reset-second-factor.mjs someone@example.com
 *
 * Separate from reset-password.mjs so a forgotten password never silently removes
 * a second factor. Reads DATABASE_URL directly: nothing here needs the auth secret.
 */

import postgres from "postgres";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.DATABASE_URL;
if (!email || !url) {
  console.error(
    email
      ? "DATABASE_URL is not set."
      : "Usage: node reset-second-factor.mjs someone@example.com",
  );
  process.exit(1);
}

const sql = postgres(url, {
  prepare: false,
  max: 1,
  onnotice: () => undefined,
});

try {
  const found = await sql.begin(async (tx) => {
    const [user] = await tx<{ id: string }[]>`
      update stash."user" set two_factor_enabled = false, updated_at = now()
      where email = ${email} returning id`;
    if (!user) return false;

    await tx`delete from stash.two_factor where user_id = ${user.id}`;
    await tx`delete from stash.session where user_id = ${user.id}`;
    return true;
  });

  if (!found) {
    console.error(`No account for ${email}.`);
    process.exitCode = 1;
  } else {
    console.log(
      `Second factor cleared for ${email}. They can sign in without one.`,
    );
  }
} finally {
  await sql.end();
}
