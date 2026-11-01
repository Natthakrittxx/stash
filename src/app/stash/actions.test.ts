import { beforeEach, expect, mock, test } from "bun:test";

// Everything but the action's own decisions is stubbed: no Next, no Postgres, no
// network. spend_fetch itself is tested against real Postgres in instance.e2e.ts.
let budgetLeft = 0;
let fetched: string[] = [];
const pending: (() => Promise<void>)[] = [];

// A drizzle query is a chain ending in an await, so any chain resolves to one row.
const row = [
  {
    id: "8a2c1f64-5d3b-4e8a-9f10-2b7c6d5e4f30",
    count: 0,
    kind: "tool",
    url: null,
    title: "t",
  },
];
function chain(): unknown {
  return new Proxy(() => undefined, {
    get: (_target, key) =>
      key === "then"
        ? (resolve: (rows: typeof row) => void) => resolve(row)
        : () => chain(),
    apply: () => chain(),
  });
}

void mock.module("next/cache", () => ({ revalidatePath: () => undefined }));
void mock.module("next/server", () => ({
  after: (task: () => Promise<void>) => pending.push(task),
}));
void mock.module("~/server/better-auth/server", () => ({
  getSession: async () => ({ user: { id: "u1" } }),
}));
void mock.module("~/server/db", () => ({ db: chain() }));
void mock.module("~/server/fetch-budget", () => ({
  spendFetch: async () => budgetLeft-- > 0,
}));
void mock.module("~/server/og", () => ({
  fetchPreview: async (url: string) => {
    fetched.push(url);
    return { image: null, description: null };
  },
}));
void mock.module("~/server/place", () => ({
  resolvePlace: async (url: string, options?: { offline?: boolean }) => {
    if (!options?.offline) fetched.push(url);
    return { lat: null, lng: null, name: null, address: null, image: null };
  },
}));

const { createItem, updateItem } = await import("./actions");

const ID = row[0]!.id;

function form(kind: "tool" | "place", url: string) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    kind,
    url,
    title: "t",
    description: "",
    tags: "",
  })) {
    data.set(key, value);
  }
  return data;
}

async function settle() {
  for (const task of pending.splice(0)) await task();
}

beforeEach(() => {
  fetched = [];
  pending.length = 0;
});

test("an edit within the budget fetches the page", async () => {
  budgetLeft = 1;
  expect((await updateItem(ID, form("tool", "https://a.dev/"))).id).toBe(ID);
  await settle();
  expect(fetched).toEqual(["https://a.dev/"]);
});

test("an edit past the budget still saves, and fetches nothing", async () => {
  budgetLeft = 0;
  expect((await updateItem(ID, form("tool", "https://a.dev/"))).id).toBe(ID);
  await settle();
  expect(fetched).toEqual([]);
});

test("a save past the budget still saves, and fetches nothing", async () => {
  budgetLeft = 0;
  expect((await createItem(form("tool", "https://a.dev/"))).id).toBe(ID);
  await settle();
  expect(fetched).toEqual([]);
});

test("a place past the budget still saves, reading only its link", async () => {
  budgetLeft = 0;
  const link = "https://www.google.com/maps/place/x/@35.6,139.7,17z";
  expect((await createItem(form("place", link))).id).toBe(ID);
  expect(fetched).toEqual([]);
});

test("a place within the budget follows its link", async () => {
  budgetLeft = 1;
  const link = "https://www.google.com/maps/place/x/@35.6,139.7,17z";
  await createItem(form("place", link));
  expect(fetched).toEqual([link]);
});
