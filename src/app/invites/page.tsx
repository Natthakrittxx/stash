import { desc } from "drizzle-orm";
import { type Metadata } from "next";
import { notFound } from "next/navigation";

import { CopyButton } from "~/app/copy-button";
import { focusRing, touch } from "~/app/stash/ui";
import { SubPageHeader } from "~/app/sub-page-header";
import { env } from "~/env";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { inviteCodes } from "~/server/db/schema";

import { createInvite, revokeInvite } from "./actions";

export const metadata: Metadata = { title: "Invite codes" };

const copyAction = `text-label focus-visible:outline-term-accent inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${touch}`;

export default async function InvitesPage() {
  const session = await getSession();
  if (!session?.user.isOwner) notFound();

  const codes = await db
    .select({ code: inviteCodes.code })
    .from(inviteCodes)
    .orderBy(desc(inviteCodes.createdAt));

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-6 py-12">
      <SubPageHeader />
      <h1 className="text-headline text-ink mt-2 font-serif">Invite codes</h1>
      <p className="text-body text-muted mt-1">
        Each code lets one person start a stash here. It stops working once
        used or revoked.
      </p>

      <form action={createInvite} className="mt-8">
        <button
          type="submit"
          className={`bg-accent text-body text-bg rounded px-4 py-2 font-medium transition-opacity duration-150 hover:opacity-90 ${touch} ${focusRing}`}
        >
          Create a code
        </button>
      </form>

      {codes.length === 0 ? (
        <p className="text-body text-muted mt-6">No unused codes.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {codes.map(({ code }) => (
            <li
              key={code}
              className="bg-term-bg flex flex-wrap items-center gap-2 rounded px-3 py-2"
            >
              <code className="text-body text-term-ink min-w-0 flex-1 font-mono break-all max-sm:basis-full">
                {code}
              </code>
              <CopyButton
                text={
                  new URL(`/signup?invite=${code}`, env.BETTER_AUTH_URL).href
                }
                label="Copy link"
                word="Copy link"
                className={copyAction}
              />
              <CopyButton
                text={code}
                label="Copy invite code"
                className={copyAction}
              />
              <form action={revokeInvite} className="flex shrink-0">
                <input type="hidden" name="code" value={code} />
                <button
                  type="submit"
                  aria-label={`Revoke invite code ${code}`}
                  className={`text-label text-term-muted hover:text-term-ink focus-visible:outline-term-accent inline-flex items-center rounded px-1.5 py-0.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${touch}`}
                >
                  Revoke
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
