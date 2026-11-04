import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";

import { loadStash } from "./data";
import { Stash } from "./stash";

export default async function StashPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // ~500 items is roughly 150KB of JSON. Fetch it once, filter in the browser.
  // Past a few thousand this becomes a server-side search.
  const stash = await loadStash(session.user.id);

  // Set by the root layout's head script and the rail toggle, so the server
  // renders the layout the browser will keep. Absent on a first visit, which
  // falls back to narrow and an open rail.
  const jar = await cookies();

  return (
    <Stash
      items={stash.items}
      collections={stash.collections}
      accounts={stash.accounts}
      name={session.user.name}
      isOwner={session.user.isOwner}
      initialWide={jar.get("wide")?.value === "1"}
      initialRailOpen={jar.get("rail")?.value !== "closed"}
    />
  );
}
