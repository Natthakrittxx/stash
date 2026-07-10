import { redirect } from "next/navigation";

import { AuthForm } from "~/app/auth-form";
import { getSession } from "~/server/better-auth/server";

export default async function LoginPage() {
  if (await getSession()) redirect("/stash");
  return <AuthForm mode="login" />;
}
