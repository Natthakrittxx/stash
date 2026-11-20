import { type Config } from "drizzle-kit";

import { env } from "~/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  // Stash owns only the `stash` schema, its migration log included (ADR 0002).
  schemaFilter: ["stash"],
  migrations: { schema: "stash" },
} satisfies Config;
