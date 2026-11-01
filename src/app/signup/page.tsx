import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "~/app/auth-form";
import { env } from "~/env";
import { getSession } from "~/server/better-auth/server";
import { instanceIsEmpty } from "~/server/instance";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string | string[] }>;
}) {
  if (await getSession()) redirect("/stash");
  const { error, invite } = await searchParams;
  return (
    <AuthForm
      mode="signup"
      google={!!env.GOOGLE_CLIENT_ID}
      oauthError={error}
      firstAccount={await instanceIsEmpty()}
      // A repeated ?invite= arrives as an array.
      initialInvite={typeof invite === "string" ? invite : undefined}
    />
  );
}
