import { PGlite } from "@electric-sql/pglite";
import { beforeEach, expect, mock, test } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";

import * as schema from "~/server/db/schema";

// A tag stands alone in one account's stash (CONTEXT.md, ADR 0004). These run
// the real migrations on an in-process Postgres; only the session and Next are
// stubbed.
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
void mock.module("~/server/fetch-budget", () => ({
  spendFetch: async () => false,
}));
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

beforeEach(async () => {
  await db.execute(sql`truncate stash."user" cascade`);
  await db.insert(schema.user).values([
    { id: ann, name: "Ann", email: "ann@example.com" },
    { id: bo, name: "Bo", email: "bo@example.com" },
  ]);
});

function as(id: string) {
  caller = id;
  return actions;
}

const tagsOf = async (id: string) => (await loadStash(id)).tags;

test("a tag made before any item uses it is in your stash", async () => {
  expect(await as(ann).createTag("recipes")).toEqual({});

  expect(await tagsOf(ann)).toEqual(["recipes"]);
  expect((await loadStash(ann)).items).toEqual([]);
});

async function save(id: string, title: string, tagList: string) {
  const data = new FormData();
  data.set("kind", "tool");
  data.set("url", `https://${title.toLowerCase()}.dev/`);
  data.set("title", title);
  data.set("description", "");
  data.set("tags", tagList);
  return (await as(id).createItem(data)).id!;
}

const tagsOn = async (id: string) =>
  Object.fromEntries((await loadStash(id)).items.map((i) => [i.title, i.tags]));

test("tags typed while saving are lowercased, deduplicated and become your tags", async () => {
  await save(ann, "Lazygit", "Git, SSH, git");

  expect(await tagsOn(ann)).toEqual({ Lazygit: ["git", "ssh"] });
  expect(await tagsOf(ann)).toEqual(["git", "ssh"]);
});

test("an edit that adds a tag makes it one of yours", async () => {
  const id = await save(ann, "Lazygit", "git");
  const data = new FormData();
  data.set("kind", "tool");
  data.set("url", "https://lazygit.dev/");
  data.set("title", "Lazygit");
  data.set("description", "");
  data.set("tags", "git, TUI");
  expect(await as(ann).updateItem(id, data)).toEqual({ id });

  expect(await tagsOf(ann)).toEqual(["git", "tui"]);
});

test("a new tag needs a name, takes no commas, and 32 characters at most", async () => {
  expect((await as(ann).createTag("  ")).error).toBe("Name the tag first.");
  expect((await as(ann).createTag("git, ssh")).error).toBe(
    "Tags can't contain commas.",
  );
  expect((await as(ann).createTag("x".repeat(33))).error).toBe(
    "32 characters at most.",
  );
  expect(await tagsOf(ann)).toEqual([]);
});

test("a rename changes the tag on every one of your items, and only yours", async () => {
  const tokyo = (await as(ann).createCollection("Tokyo")).id!;
  await as(ann).addCollaborator(tokyo, bo);
  await save(ann, "Lazygit", "js, git");
  await save(ann, "Deno", "js");
  const theirs = await save(bo, "Bun", "js");
  await as(bo).setMembership(tokyo, theirs, true);

  expect(await as(ann).renameTag("js", "JavaScript")).toEqual({});

  expect(await tagsOn(ann)).toEqual({
    Bun: ["js"],
    Deno: ["javascript"],
    Lazygit: ["javascript", "git"],
  });
  expect(await tagsOf(ann)).toEqual(["git", "javascript"]);
  expect(await tagsOf(bo)).toEqual(["js"]);
});

test("renaming onto a tag you already have merges the two", async () => {
  await save(ann, "Lazygit", "js, javascript");
  await save(ann, "Deno", "js");

  expect(await as(ann).renameTag("js", "javascript")).toEqual({});

  expect(await tagsOn(ann)).toEqual({
    Deno: ["javascript"],
    Lazygit: ["javascript"],
  });
  expect(await tagsOf(ann)).toEqual(["javascript"]);
});

test("a deleted tag comes off every one of your items, and the items stay", async () => {
  await save(ann, "Lazygit", "git, tui");
  await save(ann, "Deno", "git");
  await save(bo, "Bun", "git");

  expect(await as(ann).deleteTag("git")).toEqual({});

  expect(await tagsOn(ann)).toEqual({ Deno: [], Lazygit: ["tui"] });
  expect(await tagsOf(ann)).toEqual(["tui"]);
  expect(await tagsOn(bo)).toEqual({ Bun: ["git"] });
});

test("the upgrade lowercases existing tags, merges duplicates and registers each", async () => {
  // An instance on 0.3.0: every migration before the tags table, then data.
  const drizzleDir = `${import.meta.dir}/../../../drizzle`;
  const before = await mkdtemp(`${tmpdir()}/stash-0.3.0-`);
  const journal = JSON.parse(
    await readFile(`${drizzleDir}/meta/_journal.json`, "utf8"),
  ) as { entries: { tag: string }[] };
  const old = journal.entries.filter((e) => e.tag < "0003");
  await mkdir(`${before}/meta`);
  await writeFile(
    `${before}/meta/_journal.json`,
    JSON.stringify({ ...journal, entries: old }),
  );
  for (const e of old)
    await copyFile(`${drizzleDir}/${e.tag}.sql`, `${before}/${e.tag}.sql`);

  const instance = drizzle(new PGlite(), { schema });
  await migrate(instance, {
    migrationsFolder: before,
    migrationsSchema: "stash",
  });
  await instance.execute(sql`
    insert into stash."user" (id, name, email, email_verified, created_at, updated_at)
      values ('ann', 'Ann', 'ann@example.com', false, now(), now()),
             ('bo', 'Bo', 'bo@example.com', false, now(), now())`);
  await instance.execute(sql`
    insert into stash.items (user_id, kind, title, url, tags) values
      ('ann', 'tool', 'Lazygit', 'https://lazygit.dev/', '{Git,TUI,git}'),
      ('ann', 'tool', 'Deno', 'https://deno.dev/', '{git}'),
      ('bo', 'tool', 'Bun', 'https://bun.dev/', '{SSH}')`);

  await migrate(instance, {
    migrationsFolder: drizzleDir,
    migrationsSchema: "stash",
  });

  const rows = await instance
    .select({ title: schema.items.title, tags: schema.items.tags })
    .from(schema.items)
    .orderBy(schema.items.title);
  expect(rows).toEqual([
    { title: "Bun", tags: ["ssh"] },
    { title: "Deno", tags: ["git"] },
    { title: "Lazygit", tags: ["git", "tui"] },
  ]);
  expect(
    await instance
      .select({ userId: schema.tags.userId, name: schema.tags.name })
      .from(schema.tags)
      .orderBy(schema.tags.userId, schema.tags.name),
  ).toEqual([
    { userId: "ann", name: "git" },
    { userId: "ann", name: "tui" },
    { userId: "bo", name: "ssh" },
  ]);
});

test("a rename or delete sent something other than a tag name is refused", async () => {
  await save(ann, "Lazygit", "git");
  const junk = 42 as unknown as string;

  expect(await as(ann).deleteTag(junk)).toEqual({ error: "No such tag." });
  expect(await as(ann).renameTag(junk, "vcs")).toEqual({
    error: "No such tag.",
  });
  expect((await as(ann).renameTag("git", "a, b")).error).toBe(
    "Tags can't contain commas.",
  );
  expect(await tagsOf(ann)).toEqual(["git"]);
});
