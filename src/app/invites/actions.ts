"use server";

import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { inviteCodes } from "~/server/db/schema";

// The page already hides itself, but an action is a public endpoint of its own.
async function requireOwner() {
  const session = await getSession();
  if (!session?.user.isOwner) {
    throw new Error("Only the Owner can manage invite codes.");
  }
}

export async function createInvite() {
  await requireOwner();
  await db
    .insert(inviteCodes)
    .values({ code: randomBytes(16).toString("base64url") });
  revalidatePath("/invites");
}

export async function revokeInvite(formData: FormData) {
  await requireOwner();
  const code = z.string().min(1).parse(formData.get("code"));
  await db.delete(inviteCodes).where(eq(inviteCodes.code, code));
  revalidatePath("/invites");
}
