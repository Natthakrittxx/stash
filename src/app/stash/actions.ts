"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { text } from "~/form";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { items } from "~/server/db/schema";
import { fetchPreview } from "~/server/og";
import { normalizeUrl } from "~/server/url";

const ITEMS_PER_HOUR = 60;

const urlField = z
  .string()
  .trim()
  .min(1, "A URL is required.")
  .max(2048)
  .transform((value, ctx) => {
    try {
      return normalizeUrl(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "That isn't a URL." });
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
  title: z.string().trim().min(1, "A title is required.").max(200),
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
]);

type Result = { error?: string };

function parse(formData: FormData) {
  const kind = text(formData, "kind");
  return itemSchema.safeParse({
    kind,
    title: text(formData, "title"),
    description: text(formData, "description"),
    tags: text(formData, "tags"),
    // Read only the field this kind owns. A stale value left in the other input
    // can then never reach the CHECK constraint and surface as a 500.
    ...(kind === "tool"
      ? { url: text(formData, "url") }
      : { cmd: text(formData, "cmd") }),
  });
}

function toRow(data: z.infer<typeof itemSchema>) {
  return {
    kind: data.kind,
    title: data.title,
    description: data.description,
    tags: data.tags,
    url: data.kind === "tool" ? data.url : null,
    cmd: data.kind === "formula" ? data.cmd : null,
  };
}

// Resolve the preview after the response flushes — capture stays instant and the
// image/description land on the next load of /stash. A formula has no page, and a
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
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That didn't validate." };
  }

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
  const [inserted] = await db
    .insert(items)
    .values({ userId, ...row })
    .returning({ id: items.id });

  revalidatePath("/stash");
  if (inserted) resolvePreview(inserted.id, userId, row);
  return {};
}

export async function updateItem(
  id: string,
  formData: FormData,
): Promise<Result> {
  const userId = await requireUserId();

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That didn't validate." };
  }

  const row = toRow(parsed.data);
  // Keep a tool's existing preview until the fresh one resolves (no flash on an
  // unrelated edit); clear it when a row becomes a formula, which has no page.
  await db
    .update(items)
    .set(row.kind === "formula" ? { ...row, image: null } : row)
    .where(and(eq(items.id, id), eq(items.userId, userId)));

  revalidatePath("/stash");
  resolvePreview(id, userId, row);
  return {};
}

export async function deleteItem(id: string): Promise<Result> {
  const userId = await requireUserId();

  await db.delete(items).where(and(eq(items.id, id), eq(items.userId, userId)));

  revalidatePath("/stash");
  return {};
}
