"use client";

import { useState } from "react";

import { authClient } from "~/server/better-auth/client";

import { GitHubMark, REPO_URL } from "./github-mark";
import { StashMark } from "./stash-mark";

export function Landing() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onStart() {
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
    <main className="landing-dark relative min-h-dvh overflow-hidden bg-bg text-ink">
      {/* The one lamp in the dim archive. Atmospheric, not glassmorphism. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-accent opacity-[0.07] blur-[120px]"
      />

      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub repository (opens in a new tab)"
        className="rise absolute top-6 right-6 z-10 inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-label text-muted transition-colors duration-150 hover:border-accent hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{ animationDelay: "320ms" }}
      >
        <GitHubMark className="size-4" />
        GitHub
      </a>

      <div className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-x-16 gap-y-14 px-6 py-16 lg:grid-cols-[1.1fr_1fr]">
        {/* Copy */}
        <div className="min-w-0">
          <p className="rise flex items-center gap-2 text-body font-medium tracking-tight text-accent">
            <StashMark className="size-7 rounded-[1.6px]" />
            Stash
          </p>

          <h1
            className="rise-blur mt-6 font-serif font-medium leading-[1.05] tracking-[-0.02em] text-ink [font-size:clamp(2.25rem,7vw,4.5rem)] lg:text-balance"
            style={{ animationDelay: "80ms" }}
          >
            Save it now. Find it when you need it.
          </h1>

          <p
            className="rise mt-6 max-w-md text-title leading-relaxed text-muted"
            style={{ animationDelay: "160ms" }}
          >
            Not a feed, not a pile — a stash you can actually search.
          </p>

          <div
            className="rise mt-10 flex flex-col items-start gap-4"
            style={{ animationDelay: "240ms" }}
          >
            <button
              type="button"
              onClick={onStart}
              disabled={pending}
              aria-busy={pending}
              className="rounded bg-accent px-5 py-2.5 text-body font-medium text-bg transition duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_rgba(75,195,204,0.6)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {pending ? "One moment…" : "Start a stash"}
            </button>

            <p className="text-label text-muted">
              Sign in with Google. Nothing to install.
            </p>

            {error && (
              <p role="alert" className="text-label text-danger">
                <span aria-hidden="true">✕ </span>
                {error}
              </p>
            )}
          </div>
        </div>

        {/* The catalog card: the namesake object as one figure, not a grid. It
            shows a real saved item and demonstrates the three voices — serif
            title (yours), mono url (the machine's), sans tags (the app's). */}
        <figure
          className="file-in mx-auto w-full max-w-sm min-w-0 lg:mx-0"
          style={{ animationDelay: "200ms" }}
          role="img"
          aria-label="A saved item in Stash — Stash itself, a place to save things and find them again, filed three years ago and still one search away."
        >
          <div className="glow-bloom rounded-lg bg-accent p-7 text-bg lg:-rotate-1">
            <div className="flex items-baseline justify-between font-mono text-label text-bg/75">
              <span>025.4 · STASH</span>
              <span>saved 3 yrs ago</span>
            </div>

            <p className="mt-8 font-serif text-display leading-tight text-bg">
              Stash
            </p>
            <p className="mt-1 font-serif text-title text-bg/75">
              Save things, find them again
            </p>

            <p className="mt-8 font-mono text-label text-bg/75">
              github.com/Natthakrittxx/stash
            </p>

            <div className="mt-4 flex gap-2 text-label text-bg/75">
              <span>tools</span>
              <span aria-hidden="true">·</span>
              <span>bookmarks</span>
            </div>
          </div>
        </figure>
      </div>
    </main>
  );
}
