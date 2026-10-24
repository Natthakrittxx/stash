import { redirect } from "next/navigation";

import { AuthForm } from "~/app/auth-form";
import { getSession } from "~/server/better-auth/server";

export default async function LoginPage({
  searchParams,
}: {
  // Set by a magic link that failed to verify (expired, reused, bad token).
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/stash");
  return <AuthForm mode="login" linkFailed={!!(await searchParams).error} />;
}
