import { and, asc, eq, inArray, ne, or } from "drizzle-orm";

import { db } from "~/server/db";
import {
  collaborators,
  collectionItems,
  collections,
  items,
  user,
} from "~/server/db/schema";

import type { Account, Collection, Item } from "./stash";

// The collections an account is in: the ones it created and the ones shared
// with it. Every read and write that reaches a collection goes through this.
export function inCollection(userId: string) {
  return or(
    eq(collections.userId, userId),
    inArray(
      collections.id,
      db
        .select({ id: collaborators.collectionId })
        .from(collaborators)
        .where(eq(collaborators.userId, userId)),
    ),
  );
}

// Only the columns the list renders: the owner and timestamps would ride along unread.
const columns = {
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
};

// Everything /stash renders for one account. Other accounts' items come only
// from shared collections this account is in, labelled with who saved them
// (ADR 0003).
export async function loadStash(userId: string): Promise<{
  items: Item[];
  collections: Collection[];
  accounts: Account[];
}> {
  const reach = inCollection(userId);
  const [own, theirs, folders, links, people, accounts] = await Promise.all([
    db
      .select(columns)
      .from(items)
      .where(eq(items.userId, userId))
      .orderBy(asc(items.title)),
    db
      .selectDistinct({ ...columns, savedBy: user.name })
      .from(items)
      .innerJoin(user, eq(user.id, items.userId))
      .innerJoin(collectionItems, eq(collectionItems.itemId, items.id))
      .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
      .where(and(ne(items.userId, userId), reach))
      .orderBy(asc(items.title)),
    db
      .select({
        id: collections.id,
        name: collections.name,
        creatorId: collections.userId,
        creator: user.name,
      })
      .from(collections)
      .innerJoin(user, eq(user.id, collections.userId))
      .where(reach)
      .orderBy(asc(collections.name)),
    db
      .select({
        collectionId: collectionItems.collectionId,
        itemId: collectionItems.itemId,
      })
      .from(collectionItems)
      .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
      .where(reach),
    db
      .select({
        collectionId: collaborators.collectionId,
        id: user.id,
        name: user.name,
      })
      .from(collaborators)
      .innerJoin(user, eq(user.id, collaborators.userId))
      .innerJoin(collections, eq(collections.id, collaborators.collectionId))
      .where(reach)
      .orderBy(asc(user.name)),
    // For the Creator's picker: the instance is a small invited circle, so
    // every account holder may see every other's name and email.
    db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(ne(user.id, userId))
      .orderBy(asc(user.name)),
  ]);

  return {
    items: [...own.map((i) => ({ ...i, savedBy: null })), ...theirs].sort(
      (a, b) => a.title.localeCompare(b.title),
    ),
    collections: folders.map((c) => ({
      id: c.id,
      name: c.name,
      creator: c.creator,
      mine: c.creatorId === userId,
      itemIds: links
        .filter((l) => l.collectionId === c.id)
        .map((l) => l.itemId),
      collaborators: people
        .filter((p) => p.collectionId === c.id)
        .map(({ id, name }) => ({ id, name })),
    })),
    accounts,
  };
}
