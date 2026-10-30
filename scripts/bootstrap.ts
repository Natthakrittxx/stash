/**
 * Runs before the server on every container start, and by hand in development
 * (`bun run bootstrap`). Importing env validates configuration; then pending
 * migrations apply, and an instance with no accounts yet gets a setup code. Any
 * failure exits non-zero, which stops the boot.
 */

import { randomBytes } from "node:crypto";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { env } from "../src/env.js";

const sql = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 1,
  onnotice: () => undefined,
});

try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });

  const [users] = await sql<{ count: number }[]>`
    select count(*)::int as count from "user"`;
  if (users?.count === 0) {
    // Reprinted on every boot until redeemed, so rotated logs can't lock anyone out.
    await sql`
      insert into invite_code (code, is_setup)
      values (${randomBytes(16).toString("base64url")}, true)
      on conflict do nothing`;
    const [setup] = await sql<{ code: string }[]>`
      select code from invite_code where is_setup`;
    console.log(`Setup code: ${setup?.code}`);
    console.log(
      `Enter it at ${env.BETTER_AUTH_URL}/signup to create the Owner account.`,
    );
  }
} finally {
  await sql.end();
}
