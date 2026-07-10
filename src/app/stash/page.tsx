import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { items } from "~/server/db/schema";

import { Stash } from "./stash";

export default async function StashPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // ~500 items is roughly 150KB of JSON. Fetch it once, filter in the browser.
  // Past a few thousand this becomes a server-side search.
  const rows = await db
    .select()
    .from(items)
    .where(eq(items.userId, session.user.id))
    .orderBy(asc(items.title));

  return <Stash items={rows} name={session.user.name} />;
}
