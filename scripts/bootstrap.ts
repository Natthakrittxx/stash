/**
 * Runs before the server on every container start, and by hand in development
 * (`bun run bootstrap`). Importing env validates configuration; then pending
 * migrations apply, and an instance with no accounts yet says how to claim it. Any
 * failure exits non-zero, which stops the boot.
 */

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
    console.log(
      `No accounts yet. The first person to sign up at ${env.BETTER_AUTH_URL}/signup becomes the Owner, so do it before anyone else can reach this address.`,
    );
  }
} finally {
  await sql.end();
}
