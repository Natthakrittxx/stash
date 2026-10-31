import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";

import { TwoFactorForm } from "./two-factor-form";

export const metadata: Metadata = { title: "Enter your code" };

export default async function TwoFactorPage() {
  if (await getSession()) redirect("/stash");
  return <TwoFactorForm />;
}
