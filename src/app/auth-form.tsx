"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { text } from "~/form";
import { authClient } from "~/server/better-auth/client";

import { ThemeToggle } from "./theme-toggle";

const field =
  "w-full rounded border border-border bg-bg px-3 py-2 text-body text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(formData: FormData) {
    setError(null);
    setPending(true);

    const email = text(formData, "email");
    const password = text(formData, "password");
    const name = text(formData, "name");

    const { error } = isSignup
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password });

    setPending(false);

    if (error) {
      setError(error.message ?? "That didn't work.");
      return;
    }

    router.push("/stash");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>
      <h1 className="font-serif text-headline text-ink">
        {isSignup ? "Start a stash" : "Open your stash"}
      </h1>
      <p className="mt-1 text-body text-muted">
        {isSignup
          ? "A quiet place to save things and find them again."
          : "Welcome back."}
      </p>

      <form action={onSubmit} className="mt-8 flex flex-col gap-4">
        {isSignup && (
          <label className="flex flex-col gap-1.5">
            <span className="text-label text-muted">Name</span>
            <input name="name" required autoComplete="name" className={field} />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-label text-muted">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={field}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-label text-muted">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className={field}
          />
        </label>

        {error && (
          <p role="alert" className="text-label text-ink">
            <span aria-hidden="true">✕ </span>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded bg-accent px-4 py-2 text-body text-bg transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {pending ? "One moment…" : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-label text-muted">
        {isSignup ? "Already have a stash? " : "No stash yet? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {isSignup ? "Sign in" : "Create one"}
        </Link>
      </p>
    </main>
  );
}
