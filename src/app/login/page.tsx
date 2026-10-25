import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "~/app/auth-form";
import { getSession } from "~/server/better-auth/server";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/stash");
  return <AuthForm mode="login" />;
}
