"use server";

import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { text, titleOr } from "~/form";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { collectionItems, collections, items } from "~/server/db/schema";
import { fetchPreview } from "~/server/og";
import { resolvePlace } from "~/server/place";
import { normalizeUrl } from "~/server/url";

const ITEMS_PER_HOUR = 60;

// The id arrives from the client and goes straight at a uuid column, where a
// non-uuid string raises 22P02 and surfaces as a 500 rather than an error.
const idSchema = z.string().uuid();

const urlField = z
  .string()
  .trim()
  .min(1, "A URL is required.")
  .max(2048)
  .transform((value, ctx) => {
    try {
      return normalizeUrl(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "That isn't a web address. Try something like ripgrep.dev.",
      });
      return z.NEVER;
    }
  });

const tagsField = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 10),
  )
  .pipe(z.array(z.string().max(32)));

const shared = {
  title: z.string().trim().max(200),
  description: z.string().trim().max(2000),
  tags: tagsField,
};

const itemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tool"), url: urlField, ...shared }),
  z.object({
    kind: z.literal("formula"),
    cmd: z.string().trim().min(1, "A command is required.").max(8000),
    ...shared,
  }),
  z.object({ kind: z.literal("place"), url: urlField, ...shared }),
]);

const pinSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// An undo re-creates a place with the pin it had, which may have been set by
// hand; a fresh save sends none and the link decides.
function pinFrom(formData: FormData) {
  const [lat, lng] = ["lat", "lng"].map((k) => text(formData, k));
  if (!lat || !lng) return null;
  const pin = pinSchema.safeParse({ lat: Number(lat), lng: Number(lng) });
  return pin.success ? pin.data : null;
}

// `field` names the input a validation error belongs to, so the form can mark it
// invalid; `id` is the saved row, so the list can select what was just added.
type Result = { error?: string; field?: string; id?: string };

function invalid(error: z.ZodError): Result {
  const issue = error.issues[0];
  return {
    error: issue?.message ?? "That didn't validate.",
    field: issue?.path[0]?.toString(),
  };
}

function parse(formData: FormData) {
  const kind = text(formData, "kind");
  return itemSchema.safeParse({
    kind,
    title: text(formData, "title"),
    description: text(formData, "description"),
    tags: text(formData, "tags"),
    // Read only the field this kind owns. A stale value left in the other input
    // can then never reach the CHECK constraint and surface as a 500.
    ...(kind === "formula"
      ? { cmd: text(formData, "cmd") }
      : { url: text(formData, "url") }),
  });
}

function toRow(data: z.infer<typeof itemSchema>) {
  const url = data.kind === "formula" ? null : data.url;
  return {
    kind: data.kind,
    title: titleOr(data.title, url, data.kind === "formula" ? data.cmd : null),
    description: data.description,
    tags: data.tags,
    url,
    cmd: data.kind === "formula" ? data.cmd : null,
  };
}

// A place's pin, address and image come from its link; its title too when left
// blank, since the link's host ("maps.app.goo.gl") names nothing.
async function placeRow(data: z.infer<typeof itemSchema>, url: string) {
  const place = await resolvePlace(url);
  return {
    ...(data.title ? {} : place.name ? { title: place.name } : {}),
    lat: place.lat,
    lng: place.lng,
    address: place.address,
    image: place.image,
  };
}

// Resolve the preview after the response flushes — capture stays instant and the
// image/description land on the next load of /stash, which the client forces
// by refreshing until the image arrives (stash.tsx). A formula has no page, and a
// failed fetch leaves the row on its monogram, so nothing here can block a save
// or surface an error.
function resolvePreview(
  id: string,
  userId: string,
  row: ReturnType<typeof toRow>,
) {
  if (row.kind !== "tool" || !row.url) return;
  const url = row.url;
  // Only backfill a description the user left blank — never clobber their words.
  const wantsDescription = row.description.length === 0;
  after(async () => {
    const { image, description } = await fetchPreview(url);
    const patch: { image?: string; description?: string } = {};
    if (image) patch.image = image;
    if (wantsDescription && description) patch.description = description;
    if (Object.keys(patch).length === 0) return;
    await db
      .update(items)
      .set(patch)
      .where(and(eq(items.id, id), eq(items.userId, userId)));
    revalidatePath("/stash");
  });
}

async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return session.user.id;
}

export async function createItem(formData: FormData): Promise<Result> {
  const userId = await requireUserId();

  const parsed = parse(formData);
  if (!parsed.success) return invalid(parsed.error);

  // ponytail: a count query is the whole rate limiter. No Redis, no in-memory
  // counter that a cold start or a second region would forget. Swap for a
  // token bucket only if this query shows up in slow logs.
  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(items)
    .where(
      and(
        eq(items.userId, userId),
        gt(items.createdAt, sql`now() - interval '1 hour'`),
      ),
    );

  if ((recent?.count ?? 0) >= ITEMS_PER_HOUR) {
    return {
      error: `That's ${ITEMS_PER_HOUR} saves in an hour. Try again later.`,
    };
  }

  const row = toRow(parsed.data);
  // A place resolves before the insert, not after the response like a tool's
  // preview: the map needs its pin the moment it lands.
  const place =
    row.kind === "place" && row.url
      ? { ...(await placeRow(parsed.data, row.url)), ...pinFrom(formData) }
      : {};
  const [inserted] = await db
    .insert(items)
    .values({ userId, ...row, ...place })
    .returning({ id: items.id });

  // Saved with a collection open (or undone out of some): file it there too,
  // but only into collections that are the caller's.
  const wanted = formData
    .getAll("collection")
    .filter((v): v is string => idSchema.safeParse(v).success);
  if (inserted && wanted.length > 0) {
    const owned = await db
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(eq(collections.userId, userId), inArray(collections.id, wanted)),
      );
    if (owned.length > 0)
      await db
        .insert(collectionItems)
        .values(owned.map((c) => ({ collectionId: c.id, itemId: inserted.id })))
        .onConflictDoNothing();
  }

  revalidatePath("/stash");
  if (inserted) resolvePreview(inserted.id, userId, row);
  return { id: inserted?.id };
}

export async function updateItem(
  id: string,
  formData: FormData,
): Promise<Result> {
  const userId = await requireUserId();

  const target = idSchema.safeParse(id);
  if (!target.success) return { error: "No such item." };

  const parsed = parse(formData);
  if (!parsed.success) return invalid(parsed.error);

  const row = toRow(parsed.data);
  const owned = and(eq(items.id, target.data), eq(items.userId, userId));
  // Keep a tool's existing preview until the fresh one resolves (no flash on an
  // unrelated edit); clear it when a row becomes a formula, which has no page.
  // Only a place keeps a pin.
  let set: Partial<typeof items.$inferInsert> =
    row.kind === "formula"
      ? { ...row, image: null, lat: null, lng: null, address: null }
      : { ...row, lat: null, lng: null, address: null };
  if (row.kind === "place" && row.url) {
    const [current] = await db
      .select({ kind: items.kind, url: items.url, title: items.title })
      .from(items)
      .where(owned);
    if (!current) return { error: "No such item." };
    // An edit that keeps the link keeps the pin, which may have been set by
    // hand, and a cleared title falls back to the old one rather than the host;
    // a new link (or a row becoming a place) re-resolves both.
    set =
      current.kind === "place" && current.url === row.url
        ? { ...row, title: parsed.data.title || current.title }
        : { ...row, ...(await placeRow(parsed.data, row.url)) };
  }
  const updated = await db
    .update(items)
    .set(set)
    .where(owned)
    .returning({ id: items.id });

  // A miss means the id was someone else's or nothing at all. Without this gate
  // the fetch below still ran, so any signed-in account owning no items could
  // loop this action to make the server fetch arbitrary URLs, at no rate limit —
  // only createItem counts against ITEMS_PER_HOUR.
  if (updated.length === 0) return { error: "No such item." };

  revalidatePath("/stash");
  resolvePreview(target.data, userId, row);
  return { id: target.data };
}

export async function deleteItem(id: string): Promise<Result> {
  const userId = await requireUserId();

  const target = idSchema.safeParse(id);
  if (!target.success) return { error: "No such item." };

  await db
    .delete(items)
    .where(and(eq(items.id, target.data), eq(items.userId, userId)));

  revalidatePath("/stash");
  return {};
}

// "Set location": a place whose link carried no pin gets one by a click on the
// map.
export async function setPlacePin(
  id: string,
  lat: number,
  lng: number,
): Promise<Result> {
  const userId = await requireUserId();
  const target = idSchema.safeParse(id);
  const pin = pinSchema.safeParse({ lat, lng });
  if (!target.success || !pin.success)
    return { error: "That spot couldn't be saved. Try another." };

  const updated = await db
    .update(items)
    .set(pin.data)
    .where(
      and(
        eq(items.id, target.data),
        eq(items.userId, userId),
        eq(items.kind, "place"),
      ),
    )
    .returning({ id: items.id });
  if (updated.length === 0) return { error: "No such place." };

  revalidatePath("/stash");
  return { id: target.data };
}

const collectionName = z
  .string()
  .trim()
  .min(1, "Name the collection first.")
  .max(80, "Keep the name under 80 characters.");

export async function createCollection(name: string): Promise<Result> {
  const userId = await requireUserId();
  const parsed = collectionName.safeParse(name);
  if (!parsed.success) return invalid(parsed.error);

  const [row] = await db
    .insert(collections)
    .values({ userId, name: parsed.data })
    .returning({ id: collections.id });

  revalidatePath("/stash");
  return { id: row?.id };
}

// Deletes the collection only; its places stay in the stash.
export async function deleteCollection(id: string): Promise<Result> {
  const userId = await requireUserId();
  const target = idSchema.safeParse(id);
  if (!target.success) return { error: "No such collection." };

  await db
    .delete(collections)
    .where(
      and(eq(collections.id, target.data), eq(collections.userId, userId)),
    );

  revalidatePath("/stash");
  return {};
}

export async function setMembership(
  collectionId: string,
  itemId: string,
  member: boolean,
): Promise<Result> {
  const userId = await requireUserId();
  if (
    !idSchema.safeParse(collectionId).success ||
    !idSchema.safeParse(itemId).success
  )
    return { error: "No such collection." };

  // The join table can't check ownership itself: both sides must be the caller's.
  const [both] = await db
    .select({ id: collections.id })
    .from(collections)
    .innerJoin(items, and(eq(items.id, itemId), eq(items.userId, userId)))
    .where(
      and(eq(collections.id, collectionId), eq(collections.userId, userId)),
    );
  if (!both) return { error: "No such collection." };

  if (member)
    await db
      .insert(collectionItems)
      .values({ collectionId, itemId })
      .onConflictDoNothing();
  else
    await db
      .delete(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.itemId, itemId),
        ),
      );

  revalidatePath("/stash");
  return {};
}
