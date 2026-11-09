import { PGlite } from "@electric-sql/pglite";
import { beforeEach, expect, mock, test } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "~/server/db/schema";

// Who may see and change a shared collection is decided in SQL, so these run the
// real migrations on an in-process Postgres. Only the session and Next are stubbed.
const db = drizzle(new PGlite(), { schema });
await migrate(db, {
  migrationsFolder: `${import.meta.dir}/../../../drizzle`,
  migrationsSchema: "stash",
});

let caller = "";
void mock.module("next/cache", () => ({ revalidatePath: () => undefined }));
void mock.module("next/server", () => ({ after: () => undefined }));
void mock.module("~/server/better-auth/server", () => ({
  getSession: async () => ({ user: { id: caller } }),
}));
void mock.module("~/server/db", () => ({ db }));
void mock.module("~/server/og", () => ({
  fetchPreview: async () => ({ image: null, description: null }),
}));
void mock.module("~/server/place", () => ({
  resolvePlace: async () => ({
    lat: null,
    lng: null,
    name: null,
    address: null,
    image: null,
  }),
}));

const actions = await import("./actions");
const { loadStash } = await import("./data");

const ann = "ann";
const bo = "bo";
const cy = "cy";

beforeEach(async () => {
  await db.execute(sql`truncate stash."user" cascade`);
  await db.insert(schema.user).values(
    [
      [ann, "Ann"],
      [bo, "Bo"],
      [cy, "Cy"],
    ].map(([id, name]) => ({
      id: id!,
      name: name!,
      email: `${id}@example.com`,
    })),
  );
});

function as(id: string) {
  caller = id;
  return actions;
}

async function save(id: string, title: string, collectionId?: string) {
  const data = new FormData();
  data.set("kind", "tool");
  data.set("url", `https://${title.toLowerCase()}.dev/`);
  data.set("title", title);
  data.set("description", "");
  data.set("tags", "");
  if (collectionId) data.set("collection", collectionId);
  const result = await as(id).createItem(data);
  return result.id!;
}

async function collection(id: string, name: string) {
  return (await as(id).createCollection(name)).id!;
}

const titles = async (id: string) =>
  (await loadStash(id)).items.map((i) => [i.title, i.savedBy]);
const folder = async (id: string, collectionId: string) =>
  (await loadStash(id)).collections.find((c) => c.id === collectionId);

test("a collection stays private until its Creator adds someone", async () => {
  const tokyo = await collection(ann, "Tokyo");
  await save(ann, "Ramen", tokyo);

  expect((await loadStash(bo)).collections).toEqual([]);
  expect(await titles(bo)).toEqual([]);
});

test("a Collaborator sees the collection and what is in it, labelled with its saver", async () => {
  const tokyo = await collection(ann, "Tokyo");
  const ramen = await save(ann, "Ramen", tokyo);
  await save(ann, "Private", undefined);

  expect(await as(ann).addCollaborator(tokyo, bo)).toEqual({});

  expect(await folder(bo, tokyo)).toEqual({
    id: tokyo,
    name: "Tokyo",
    creator: "Ann",
    mine: false,
    itemIds: [ramen],
    collaborators: [{ id: bo, name: "Bo" }],
  });
  expect(await titles(bo)).toEqual([["Ramen", "Ann"]]);
  expect((await folder(ann, tokyo))?.mine).toBe(true);
});

test("a Collaborator files their own items, and saves into it while it is open", async () => {
  const tokyo = await collection(ann, "Tokyo");
  await as(ann).addCollaborator(tokyo, bo);
  const sushi = await save(bo, "Sushi");
  const tea = await save(bo, "Tea", tokyo);

  expect(await as(bo).setMembership(tokyo, sushi, true)).toEqual({});

  expect((await folder(ann, tokyo))?.itemIds.sort()).toEqual(
    [sushi, tea].sort(),
  );
  expect(await titles(ann)).toEqual([
    ["Sushi", "Bo"],
    ["Tea", "Bo"],
  ]);
});

test("nobody files someone else's item, into any collection", async () => {
  const tokyo = await collection(ann, "Tokyo");
  const mine = await collection(bo, "Mine");
  await as(ann).addCollaborator(tokyo, bo);
  const ramen = await save(ann, "Ramen", tokyo);
  const secret = await save(ann, "Secret");

  expect((await as(bo).setMembership(tokyo, secret, true)).error).toBe(
    "No such collection.",
  );
  expect((await as(bo).setMembership(mine, ramen, true)).error).toBe(
    "No such collection.",
  );

  expect((await folder(ann, tokyo))?.itemIds).toEqual([ramen]);
  expect((await folder(bo, mine))?.itemIds).toEqual([]);
});

test("anyone in it takes any item out, and the item stays with its saver", async () => {
  const tokyo = await collection(ann, "Tokyo");
  await as(ann).addCollaborator(tokyo, bo);
  const ramen = await save(ann, "Ramen", tokyo);

  expect(await as(bo).setMembership(tokyo, ramen, false)).toEqual({});

  expect((await folder(ann, tokyo))?.itemIds).toEqual([]);
  expect(await titles(ann)).toEqual([["Ramen", null]]);
  expect(await titles(bo)).toEqual([]);
});

test("only the Creator adds or removes people, or deletes the collection", async () => {
  const tokyo = await collection(ann, "Tokyo");
  await as(ann).addCollaborator(tokyo, bo);

  expect((await as(bo).addCollaborator(tokyo, cy)).error).toBe(
    "No such collection.",
  );
  expect((await as(cy).removeCollaborator(tokyo, bo)).error).toBe(
    "No such collection.",
  );
  await as(bo).deleteCollection(tokyo);

  expect((await folder(ann, tokyo))?.collaborators).toEqual([
    { id: bo, name: "Bo" },
  ]);
  expect(await folder(cy, tokyo)).toBeUndefined();
});

test("someone outside a collection can't file into it, take out of it, or save into it", async () => {
  const tokyo = await collection(ann, "Tokyo");
  const ramen = await save(ann, "Ramen", tokyo);
  const cyItem = await save(cy, "Cy's", tokyo);

  expect((await as(cy).setMembership(tokyo, cyItem, true)).error).toBe(
    "No such collection.",
  );
  expect((await as(cy).setMembership(tokyo, ramen, false)).error).toBe(
    "No such collection.",
  );
  expect((await as(cy).leaveCollection(tokyo)).error).toBe(
    "No such collection.",
  );

  expect((await folder(ann, tokyo))?.itemIds).toEqual([ramen]);
});

test("the Creator can't add themselves or an account that doesn't exist", async () => {
  const tokyo = await collection(ann, "Tokyo");

  expect((await as(ann).addCollaborator(tokyo, ann)).error).toBe(
    "No such collection.",
  );
  expect((await as(ann).addCollaborator(tokyo, "nobody")).error).toBe(
    "No such collection.",
  );
  expect(await as(ann).addCollaborator(tokyo, bo)).toEqual({});
  expect(await as(ann).addCollaborator(tokyo, bo)).toEqual({});

  expect((await folder(ann, tokyo))?.collaborators).toEqual([
    { id: bo, name: "Bo" },
  ]);
});

test("someone who leaves takes their items with them", async () => {
  const tokyo = await collection(ann, "Tokyo");
  await as(ann).addCollaborator(tokyo, bo);
  const ramen = await save(ann, "Ramen", tokyo);
  await save(bo, "Sushi", tokyo);

  expect(await as(bo).leaveCollection(tokyo)).toEqual({});

  expect(await folder(bo, tokyo)).toBeUndefined();
  expect(await titles(bo)).toEqual([["Sushi", null]]);
  expect(await folder(ann, tokyo)).toMatchObject({
    itemIds: [ramen],
    collaborators: [],
  });
});

test("a Collaborator the Creator removes takes their items too, and the Creator can't leave", async () => {
  const tokyo = await collection(ann, "Tokyo");
  await as(ann).addCollaborator(tokyo, bo);
  await as(ann).addCollaborator(tokyo, cy);
  await save(bo, "Sushi", tokyo);
  const tea = await save(cy, "Tea", tokyo);

  expect(await as(ann).removeCollaborator(tokyo, bo)).toEqual({});
  expect((await as(ann).leaveCollection(tokyo)).error).toBe(
    "No such collection.",
  );

  expect(await folder(ann, tokyo)).toMatchObject({
    itemIds: [tea],
    collaborators: [{ id: cy, name: "Cy" }],
  });
  expect(await titles(cy)).toEqual([["Tea", null]]);
});

test("sharing one collection reveals nothing else", async () => {
  const tokyo = await collection(ann, "Tokyo");
  const secret = await collection(ann, "Secret");
  await as(ann).addCollaborator(tokyo, bo);
  await save(ann, "Ramen", tokyo);
  await save(ann, "Diary", secret);

  expect((await loadStash(bo)).collections.map((c) => c.name)).toEqual([
    "Tokyo",
  ]);
  expect(await titles(bo)).toEqual([["Ramen", "Ann"]]);
});

test("an item in two shared collections is listed once", async () => {
  const tokyo = await collection(ann, "Tokyo");
  const kyoto = await collection(ann, "Kyoto");
  await as(ann).addCollaborator(tokyo, bo);
  await as(ann).addCollaborator(kyoto, bo);
  const ramen = await save(ann, "Ramen", tokyo);
  await as(ann).setMembership(kyoto, ramen, true);

  expect(await titles(bo)).toEqual([["Ramen", "Ann"]]);
});

test("an account going away takes its items, or its collections, with it", async () => {
  const tokyo = await collection(ann, "Tokyo");
  await as(ann).addCollaborator(tokyo, bo);
  await as(ann).addCollaborator(tokyo, cy);
  await save(bo, "Sushi", tokyo);
  await save(cy, "Tea", tokyo);

  await db.delete(schema.user).where(sql`id = ${bo}`);
  expect(await titles(ann)).toEqual([["Tea", "Cy"]]);

  await db.delete(schema.user).where(sql`id = ${ann}`);
  expect((await loadStash(cy)).collections).toEqual([]);
  expect(await titles(cy)).toEqual([["Tea", null]]);
});

test("undoing a delete files the item back into the shared collections it was in", async () => {
  const tokyo = await collection(ann, "Tokyo");
  await as(ann).addCollaborator(tokyo, bo);
  const sushi = await save(bo, "Sushi", tokyo);
  await as(bo).deleteItem(sushi);

  const restored = await save(bo, "Sushi", tokyo);

  expect((await folder(ann, tokyo))?.itemIds).toEqual([restored]);
});

test("the picker lists every other account by name and email", async () => {
  expect((await loadStash(ann)).accounts).toEqual([
    { id: bo, name: "Bo", email: "bo@example.com" },
    { id: cy, name: "Cy", email: "cy@example.com" },
  ]);
});
