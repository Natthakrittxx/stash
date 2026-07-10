import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";

// No marketing surface. `/` is a fork, not a page.
export default async function Home() {
  redirect((await getSession()) ? "/stash" : "/login");
}
