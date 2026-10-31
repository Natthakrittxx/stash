import { and, asc, eq } from "drizzle-orm";
import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { SubPageHeader } from "~/app/sub-page-header";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { account, passkey, user } from "~/server/db/schema";

import { PasskeysSection, SecondFactorSection } from "./security-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.user.id;

  // From the database, not the session: its cookie cache can be 5 minutes behind.
  const [[row], [credential], passkeys] = await Promise.all([
    db
      .select({ twoFactorEnabled: user.twoFactorEnabled })
      .from(user)
      .where(eq(user.id, userId)),
    db
      .select({ id: account.id })
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "credential")),
      ),
    db
      .select({
        id: passkey.id,
        name: passkey.name,
        createdAt: passkey.createdAt,
      })
      .from(passkey)
      .where(eq(passkey.userId, userId))
      .orderBy(asc(passkey.createdAt)),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-6 py-12">
      <SubPageHeader />
      <h1 className="text-headline text-ink mt-2 font-serif">Settings</h1>
      <SecondFactorSection
        enabled={!!row?.twoFactorEnabled}
        hasPassword={!!credential}
      />
      <PasskeysSection passkeys={passkeys} />
    </main>
  );
}
