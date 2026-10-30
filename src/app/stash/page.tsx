import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { collectionItems, collections, items } from "~/server/db/schema";

import { Stash } from "./stash";

export default async function StashPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // ~500 items is roughly 150KB of JSON. Fetch it once, filter in the browser.
  // Past a few thousand this becomes a server-side search. Only the columns the
  // list renders: the owner and timestamps would ride along unread.
  const [rows, folders, links] = await Promise.all([
    db
      .select({
        id: items.id,
        kind: items.kind,
        title: items.title,
        url: items.url,
        cmd: items.cmd,
        image: items.image,
        description: items.description,
        tags: items.tags,
        lat: items.lat,
        lng: items.lng,
        address: items.address,
      })
      .from(items)
      .where(eq(items.userId, session.user.id))
      .orderBy(asc(items.title)),
    db
      .select({ id: collections.id, name: collections.name })
      .from(collections)
      .where(eq(collections.userId, session.user.id))
      .orderBy(asc(collections.name)),
    db
      .select({
        collectionId: collectionItems.collectionId,
        itemId: collectionItems.itemId,
      })
      .from(collectionItems)
      .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
      .where(eq(collections.userId, session.user.id)),
  ]);

  // Set by the root layout's head script and the rail toggle, so the server
  // renders the layout the browser will keep. Absent on a first visit, which
  // falls back to narrow and an open rail.
  const jar = await cookies();

  return (
    <Stash
      items={rows}
      collections={folders.map((c) => ({
        ...c,
        itemIds: links
          .filter((l) => l.collectionId === c.id)
          .map((l) => l.itemId),
      }))}
      name={session.user.name}
      initialWide={jar.get("wide")?.value === "1"}
      initialRailOpen={jar.get("rail")?.value !== "closed"}
    />
  );
}
