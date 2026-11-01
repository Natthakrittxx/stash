import "server-only";

import { db } from "~/server/db";
import { user } from "~/server/db/schema";

// No accounts yet: the next person to sign up needs no code and becomes the Owner.
export async function instanceIsEmpty() {
  const [row] = await db.select({ id: user.id }).from(user).limit(1);
  return !row;
}
