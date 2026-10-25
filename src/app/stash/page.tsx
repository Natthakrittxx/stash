import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { items } from "~/server/db/schema";

import { Stash } from "./stash";

export default async function StashPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // ~500 items is roughly 150KB of JSON. Fetch it once, filter in the browser.
  // Past a few thousand this becomes a server-side search. Only the columns the
  // list renders: the owner and timestamps would ride along unread.
  const rows = await db
    .select({
      id: items.id,
      kind: items.kind,
      title: items.title,
      url: items.url,
      cmd: items.cmd,
      image: items.image,
      description: items.description,
      tags: items.tags,
    })
    .from(items)
    .where(eq(items.userId, session.user.id))
    .orderBy(asc(items.title));

  // Set by the root layout's head script and the rail toggle, so the server
  // renders the layout the browser will keep. Absent on a first visit, which
  // falls back to narrow and an open rail.
  const jar = await cookies();

  return (
    <Stash
      items={rows}
      name={session.user.name}
      initialWide={jar.get("wide")?.value === "1"}
      initialRailOpen={jar.get("rail")?.value !== "closed"}
    />
  );
}
