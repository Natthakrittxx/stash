import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "~/app/auth-form";
import { env } from "~/env";
import { getSession } from "~/server/better-auth/server";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/stash");
  const { error } = await searchParams;
  return (
    <AuthForm mode="signup" google={!!env.GOOGLE_CLIENT_ID} oauthError={error} />
  );
}
