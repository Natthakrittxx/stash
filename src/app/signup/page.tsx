import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "~/app/auth-form";
import { getSession } from "~/server/better-auth/server";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  if (await getSession()) redirect("/stash");
  return <AuthForm mode="signup" />;
}
