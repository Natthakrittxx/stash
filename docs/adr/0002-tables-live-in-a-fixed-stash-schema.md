# Tables live in a fixed `stash` schema, named in every query

Every instance keeps all its tables, its one SQL function and Drizzle's migration log in a PostgreSQL schema named `stash`, and every table name in the code and migrations carries that schema. Operators may point stash at a database that already holds other apps' data, and this keeps stash from touching or mixing with it. The bundled database uses the same layout so there is only one to test and support.

## Considered Options

- **Configurable schema through `search_path`:** would allow several instances in one database, but transaction-mode poolers break it. Neon's pooled URL rejects the startup parameter (`unsupported startup parameter`) and resets `SET` between transactions, and Supabase's pooler reportedly ignores it. Operators would have to run `ALTER ROLE ... SET search_path` by hand.
- **Keep `public` and require a database used only by stash:** the v0.2.0 rule. It relies on operators reading the README, and a database shared with another Drizzle app also shares `drizzle.__drizzle_migrations`, so either app can skip the other's migrations.
- **Schema only for shared databases, `public` for the bundled one:** two layouts chosen at runtime, doubling every query path and backup instruction.

## Consequences

Two instances need two databases. Migrations 0000 to 0007 were squashed into one baseline for the tables plus one migration for the function, because they created everything in `public`. Instances upgrading from earlier versions are moved into `stash` once, on first boot, and only when every row of the old migration log is one of stash's own. The role needs the CREATE privilege on its database, even once the schema exists, because Drizzle's migrator runs `CREATE SCHEMA IF NOT EXISTS` on every boot and Postgres checks that privilege first; without it the boot stops and prints the `GRANT CREATE ON DATABASE` to run.
