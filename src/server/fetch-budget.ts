import { sql } from "drizzle-orm";

import { db } from "~/server/db";

const FETCHES_PER_HOUR = 60;

/**
 * Spends one of the account's server fetches for this hour, and says whether it
 * got one. Past the budget a save still works, it just gets no preview. The
 * statement lives in Postgres (migration 0001) so concurrent saves can't all pass
 * one count, and so the instance test can run it for real.
 */
export async function spendFetch(userId: string): Promise<boolean> {
  const [row] = await db.execute<{ spent: boolean }>(
    sql`select stash.spend_fetch(${userId}, ${FETCHES_PER_HOUR}) as spent`,
  );
  return row?.spent === true;
}
