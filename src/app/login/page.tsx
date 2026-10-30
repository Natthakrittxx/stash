import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "~/app/auth-form";
import { env } from "~/env";
import { getSession } from "~/server/better-auth/server";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/stash");
  const { error } = await searchParams;
  return (
    <AuthForm mode="login" google={!!env.GOOGLE_CLIENT_ID} oauthError={error} />
  );
}
