"use client";

import Link from "next/link";
import { useState } from "react";

import { authClient } from "~/server/better-auth/client";

import { StashMark } from "./stash-mark";
import { ThemeToggle } from "./theme-toggle";

// A name is required at signup; derive it from the email so the form stays to
// two fields. Editable later if display names ever matter.
const nameFrom = (email: string) => email.split("@")[0] ?? email;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignup = mode === "signup";

  async function onEmail(formData: FormData) {
    setError(null);
    setPending(true);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    // Signup signs in straight away; there is no verification step.
    const { error } = isSignup
      ? await authClient.signUp.email({
          email,
          password,
          name: nameFrom(email),
        })
      : await authClient.signIn.email({ email, password });

    if (error) {
      setPending(false);
      setError(error.message ?? "That didn't work.");
      return;
    }
    // Email auth sets the session cookie in place (no provider redirect), so send
    // the browser on ourselves. A full load re-reads the session server-side.
    window.location.assign("/stash");
  }

  async function onGoogle() {
    setError(null);
    setPending(true);

    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/stash",
    });

    if (error) {
      setPending(false);
      setError(error.message ?? "That didn't work.");
    }
    // On success the browser redirects to Google; no navigation needed here.
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      <p className="text-body text-accent flex items-center gap-2 font-medium tracking-tight">
        <StashMark className="size-6 rounded-[1.4px]" />
        Stash
      </p>
      <h1 className="text-headline text-ink mt-2 font-serif">
        {isSignup ? "Start a stash" : "Open your stash"}
      </h1>
      <p className="text-body text-muted mt-1">
        {isSignup
          ? "A quiet place to save things and find them again."
          : "Welcome back."}
      </p>

      {error && (
        <p role="alert" className="text-label text-danger mt-6">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}
      <form action={onEmail} className="mt-8 flex flex-col gap-3">
        <label className="text-label text-muted flex flex-col gap-1">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="border-border bg-bg text-body text-ink focus-visible:border-accent focus-visible:outline-accent rounded border px-3 py-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
        <label className="text-label text-muted flex flex-col gap-1">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="border-border bg-bg text-body text-ink focus-visible:border-accent focus-visible:outline-accent rounded border px-3 py-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="bg-accent text-body text-bg focus-visible:outline-accent rounded px-4 py-2 font-medium transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? "One moment…" : isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="text-label text-muted mt-4">
        {isSignup ? "Already have a stash? " : "Need a stash? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="text-accent hover:underline"
        >
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>

      <div className="text-label text-muted mt-6 flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>

      <button
        type="button"
        onClick={onGoogle}
        disabled={pending}
        aria-busy={pending}
        className="border-border bg-bg text-body text-ink hover:border-accent hover:bg-surface focus-visible:outline-accent mt-6 flex items-center justify-center gap-2 rounded border px-4 py-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
          />
        </svg>
        {pending ? "One moment…" : "Continue with Google"}
      </button>
    </main>
  );
}
