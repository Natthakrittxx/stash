import { redirect } from "next/navigation";

import { Landing } from "~/app/landing";
import { getSession } from "~/server/better-auth/server";

// Logged-in users fork straight to their stash; everyone else meets the landing.
export default async function Home() {
  if (await getSession()) redirect("/stash");
  return <Landing />;
}
