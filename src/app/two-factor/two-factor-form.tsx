"use client";

import Link from "next/link";
import { useState } from "react";

import { StashMark } from "~/app/stash-mark";
import { fieldFocus, focusRing, touch } from "~/app/stash/ui";
import { ThemeToggle } from "~/app/theme-toggle";
import { authClient } from "~/server/better-auth/client";

type Failure = { message: string; restart?: true };

function explain(code?: string): Failure {
  switch (code) {
    case "INVALID_CODE":
      return {
        message: "That code didn't work. Check your app and try again.",
      };
    case "INVALID_BACKUP_CODE":
      return { message: "That backup code didn't work, or it's already used." };
    case "ACCOUNT_TEMPORARILY_LOCKED":
      return { message: "Too many tries. Wait a few minutes, then try again." };
    case "INVALID_TWO_FACTOR_COOKIE":
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
      return { message: "This sign-in has run out.", restart: true };
    default:
      return { message: "That didn't work. Try again." };
  }
}

export function TwoFactorForm() {
  const [backup, setBackup] = useState(false);
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    setPending(true);
    const { error } = backup
      ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
      : await authClient.twoFactor.verifyTotp({ code: code.trim() });
    if (error) {
      setPending(false);
      setCode("");
      setFailure(explain(error.code));
      return;
    }
    // A full load re-reads the session server-side, as the login form does.
    window.location.assign("/stash");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      <Link
        href="/"
        className={`text-title text-ink flex w-fit items-center gap-2 rounded font-serif leading-none ${focusRing}`}
      >
        <StashMark className="size-[1.1em] rounded-[2px]" />
        Stash
      </Link>
      <h1 className="text-headline text-ink mt-2 font-serif">
        {backup ? "Enter a backup code" : "Enter your code"}
      </h1>
      <p className="text-body text-muted mt-1">
        {backup
          ? "Each backup code works once."
          : "It's in your authenticator app."}
      </p>

      {failure && (
        <p role="alert" className="text-label text-danger mt-6">
          <span aria-hidden="true">✕ </span>
          {failure.message}
          {failure.restart && (
            <>
              {" "}
              <Link
                href="/login"
                className={`text-accent rounded underline underline-offset-2 ${focusRing}`}
              >
                Log in again
              </Link>
            </>
          )}
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3">
        <label className="text-label text-muted flex flex-col gap-1">
          {backup ? "Backup code" : "Code"}
          <input
            name="code"
            required
            autoFocus
            spellCheck={false}
            autoComplete={backup ? "off" : "one-time-code"}
            inputMode={backup ? "text" : "numeric"}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-invalid={!!failure || undefined}
            className={`border-field bg-bg text-body text-ink rounded border px-3 py-2 font-mono transition-colors duration-150 ${fieldFocus}`}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`bg-accent text-body text-bg rounded px-4 py-2 font-medium transition-opacity duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-60 ${focusRing}`}
        >
          {pending ? "One moment…" : "Continue"}
        </button>
      </form>

      <p className="text-label text-muted mt-4">
        <button
          type="button"
          onClick={() => {
            setBackup(!backup);
            setCode("");
            setFailure(null);
          }}
          className={`text-accent inline-flex items-center rounded underline underline-offset-2 ${touch} ${focusRing}`}
        >
          {backup ? "Use your authenticator app" : "Use a backup code"}
        </button>
      </p>
      <p className="text-label text-muted mt-2">
        Lost both? Ask whoever runs this stash.
      </p>
    </main>
  );
}
