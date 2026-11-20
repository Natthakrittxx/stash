/**
 * Runs before the server on every container start, and by hand in development
 * (`bun run bootstrap`). Importing env validates configuration; then pending
 * migrations apply, and an instance with no accounts yet says how to claim it. Any
 * failure exits non-zero, which stops the boot.
 */

import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { env } from "../src/env.js";

// Releases before 0.3.0 kept these tables in `public` and Drizzle's log in `drizzle`.
const OLD_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "items",
  "collections",
  "collection_items",
  "invite_code",
  "two_factor",
  "passkey",
  "fetch_budget",
];

const sql = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 1,
  onnotice: () => undefined,
});

/** Moves an instance from before 0.3.0 into the `stash` schema, once (ADR 0002). */
async function moveOldLayout() {
  // Found through the catalog: another app's schema may be closed to this role.
  const [old] = await sql<{ readable: boolean }[]>`
    select has_schema_privilege(n.oid, 'USAGE') and has_table_privilege(c.oid, 'SELECT') as readable
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'drizzle' and c.relname = '__drizzle_migrations'`;
  if (!old?.readable) return;

  // Stash's own log holds nothing but its old migrations.
  const oldMigrations = readMigrationFiles({
    migrationsFolder: "./drizzle-legacy",
  }).map((m) => String(m.folderMillis));
  const [log] = await sql<{ ours: number; total: number }[]>`
    select count(*) filter (where created_at = any(${oldMigrations}::bigint[]))::int as ours,
      count(*)::int as total
    from drizzle.__drizzle_migrations`;
  if (!log?.ours) return; // Another Drizzle app's log.
  if (log.ours < log.total) {
    throw new Error(
      `Drizzle's migration log in this database (drizzle.__drizzle_migrations) holds another app's migrations as well as stash's, so stash won't move its old tables or drop that log. Restore a backup of this instance into an empty database instead.`,
    );
  }
  const [current] = await sql<{ schema: string | null }[]>`
    select to_regnamespace('stash') as schema`;
  if (current?.schema) {
    throw new Error(
      `This database holds both an old copy of stash's tables, in the public schema, and a stash schema. Stash won't choose between them. Restore an old backup only into an empty database, before the first boot: see "Upgrades and backups" in the README.`,
    );
  }

  // Brings an older release up to the last old layout first, so every table exists.
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle-legacy" });

  const [baseline] = readMigrationFiles({ migrationsFolder: "./drizzle" });
  await sql.begin(async (tx) => {
    await tx`create schema if not exists stash`;
    for (const table of OLD_TABLES) {
      await tx`alter table public.${tx(table)} set schema stash`;
    }
    // Its body names fetch_budget without a schema. Migration 0001 recreates it.
    await tx`drop function public.spend_fetch(text, integer)`;
    // The moved tables are exactly what the baseline creates, so it counts as applied.
    await tx`
      create table stash.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
    await tx`
      insert into stash.__drizzle_migrations (hash, created_at)
      values (${baseline!.hash}, ${baseline!.folderMillis})`;
    // Left behind, the old log would make the next Drizzle app here skip its migrations.
    await tx`drop table drizzle.__drizzle_migrations`;
    await tx
      .savepoint((sp) => sp`drop schema drizzle`)
      .catch((error: { code?: string }) => {
        if (error.code !== "2BP01") throw error; // Something else lives in it.
      });
  });
  console.log("Moved this instance's tables into the stash schema.");
}

try {
  // Drizzle runs CREATE SCHEMA IF NOT EXISTS on every boot, which Postgres refuses
  // without this grant even when the schema already exists.
  const [who] = await sql<{ allowed: boolean; db: string; role: string }[]>`
    select has_database_privilege(current_database(), 'CREATE') as allowed,
      current_database() as db, current_user as role`;
  if (!who?.allowed) {
    throw new Error(
      `Stash keeps its tables in their own schema, and this database role may not create one. As a PostgreSQL superuser or the role that owns this database, run:\n  GRANT CREATE ON DATABASE "${who!.db}" TO "${who!.role}";\nthen start stash again.`,
    );
  }

  await moveOldLayout();
  await migrate(drizzle(sql), {
    migrationsFolder: "./drizzle",
    migrationsSchema: "stash",
  });

  const [users] = await sql<{ count: number }[]>`
    select count(*)::int as count from stash."user"`;
  if (users?.count === 0) {
    console.log(
      `No accounts yet. The first person to sign up at ${env.BETTER_AUTH_URL}/signup becomes the Owner, so do it before anyone else can reach this address.`,
    );
  }
} finally {
  await sql.end();
}
