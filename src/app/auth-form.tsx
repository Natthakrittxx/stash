"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { INVITE_COOKIE } from "~/invite";
import { authClient } from "~/server/better-auth/client";

import { StashMark } from "./stash-mark";
import { ThemeToggle } from "./theme-toggle";
import { fieldFocus, touch } from "./stash/ui";

// A name is required at signup; derive it from the email so the form stays to
// two fields. Editable later if display names ever matter.
const nameFrom = (email: string) => email.split("@")[0] ?? email;

// Ten minutes covers a trip to Google and back. Scoped to the auth endpoints:
// the signup hook is the only thing that reads it.
const rememberInvite = (code: string) =>
  (document.cookie = `${INVITE_COOKIE}=${encodeURIComponent(code.trim())};path=/api/auth;max-age=600;samesite=lax${location.protocol === "https:" ? ";secure" : ""}`);

type AuthError = {
  message: string;
  field?: "email" | "password" | "invite";
  login?: true;
};

// better-auth's messages are library copy ("User already exists. Use another
// email."). Say what happened in the product's voice, and point at the way out.
function explain(error: { code?: string; message?: string }): AuthError {
  switch (error.code) {
    case "INVITE_REQUIRED":
      return {
        message:
          "That needs a working invite code. Ask whoever runs this stash for a new one.",
        field: "invite",
      };
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return {
        message: "There's already a stash for that email.",
        field: "email",
        login: true,
      };
    case "INVALID_EMAIL_OR_PASSWORD":
      return { message: "That email and password don't match." };
    case "INVALID_EMAIL":
      return { message: "That email doesn't look right.", field: "email" };
    case "PASSWORD_TOO_SHORT":
      return { message: "Use at least 8 characters.", field: "password" };
    case "USER_VERIFICATION_REQUIRED":
      return {
        message:
          "That passkey has to ask for a fingerprint, face or PIN. Set one up on the device, or log in another way.",
      };
    default:
      return { message: error.message ?? "That didn't work. Try again." };
  }
}

const codeOf = (error: { code?: string } | object) =>
  "code" in error ? error.code : undefined;

export function AuthForm({
  mode,
  google,
  oauthError,
  initialInvite = "",
  firstAccount = false,
}: {
  mode: "login" | "signup";
  google: boolean;
  // `?error=` from a Google sign-in that came back refused.
  oauthError?: string;
  // `?invite=` from an invite link. Only fills the field; signup still checks it.
  initialInvite?: string;
  // No accounts yet, so this one needs no invite code and becomes the Owner.
  firstAccount?: boolean;
}) {
  const [error, setError] = useState<AuthError | null>(
    oauthError ? explain({ code: oauthError.toUpperCase() }) : null,
  );
  const [pending, setPending] = useState(false);
  const [invite, setInvite] = useState(initialInvite);

  // Set after mount: the server can't know, and browsers don't offer passkeys on
  // plain-HTTP addresses other than localhost.
  const [passkeysSupported, setPasskeysSupported] = useState(false);

  const isSignup = mode === "signup";

  useEffect(() => {
    if (isSignup || !window.PublicKeyCredential) return;
    setPasskeysSupported(true);
    // Autofill offers saved passkeys on the fields below and waits for a pick.
    void PublicKeyCredential.isConditionalMediationAvailable?.().then(
      async (available) => {
        if (!available) return;
        const { error } = await authClient.signIn.passkey({ autoFill: true });
        if (!error) window.location.assign("/stash");
        // Anything else means no pick was made: the form is still there to use.
        else if (codeOf(error) === "USER_VERIFICATION_REQUIRED") {
          setError(explain(error));
        }
      },
    );
  }, [isSignup]);

  // onSubmit, not <form action>: React resets an action form once it settles,
  // which would wipe the email and password on every failed attempt.
  async function onEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setPending(true);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    if (isSignup) rememberInvite(invite);
    // Signup signs in straight away; there is no verification step.
    const { data, error } = isSignup
      ? await authClient.signUp.email({
          email,
          password,
          name: nameFrom(email),
        })
      : await authClient.signIn.email({ email, password });

    if (error) {
      setPending(false);
      setError(explain(error));
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      window.location.assign("/two-factor");
      return;
    }
    // Email auth sets the session cookie in place (no provider redirect), so send
    // the browser on ourselves. A full load re-reads the session server-side.
    window.location.assign("/stash");
  }

  async function onGoogle() {
    if (isSignup && !invite.trim()) {
      setError(explain({ code: "INVITE_REQUIRED" }));
      return;
    }
    setError(null);
    setPending(true);

    if (isSignup) rememberInvite(invite);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/stash",
      errorCallbackURL: `/${mode}`,
    });

    if (error) {
      setPending(false);
      setError(explain(error));
    }
    // On success the browser redirects to Google; no navigation needed here.
  }

  async function onPasskey() {
    setError(null);
    setPending(true);
    const { error } = await authClient.signIn.passkey();
    if (!error) {
      window.location.assign("/stash");
      return;
    }
    setPending(false);
    const code = codeOf(error);
    if (code === "USER_VERIFICATION_REQUIRED") setError(explain(error));
    // Closing the browser's prompt comes back as an error too. Not worth a message.
    else if (code !== "AUTH_CANCELLED" && code !== "ERROR_CEREMONY_ABORTED") {
      setError({
        message: "That passkey didn't work. Try again, or log in another way.",
      });
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      {/* The app's own wordmark (serif, ink). */}
      <div className="text-title text-ink flex w-fit items-center gap-2 font-serif leading-none">
        <StashMark className="size-[1.1em] rounded-[2px]" />
        Stash
      </div>
      <h1 className="text-headline text-ink mt-2 font-serif">
        {isSignup ? "Start a stash" : "Open your stash"}
      </h1>
      <p className="text-body text-muted mt-1">
        {firstAccount
          ? "This first account becomes the Owner of this stash."
          : isSignup
            ? "A quiet place to save things and find them again."
            : "Welcome back."}
      </p>

      {error && (
        <p id="auth-error" role="alert" className="text-label text-danger mt-6">
          <span aria-hidden="true">✕ </span>
          {error.message}
          {error.login && (
            <>
              {" "}
              <Link
                href="/login"
                className="text-accent focus-visible:outline-accent rounded underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Log in instead
              </Link>
            </>
          )}
        </p>
      )}
      <form onSubmit={onEmail} className="mt-8 flex flex-col gap-3">
        {/* Someone else may have got there first while this page sat open. */}
        {isSignup && (!firstAccount || error?.field === "invite") && (
          <label className="text-label text-muted flex flex-col gap-1">
            Invite code
            <input
              name="invite"
              required
              autoComplete="off"
              spellCheck={false}
              value={invite}
              onChange={(event) => setInvite(event.target.value)}
              aria-invalid={error?.field === "invite" || undefined}
              aria-describedby={["invite-hint", error && "auth-error"]
                .filter(Boolean)
                .join(" ")}
              className={`border-field bg-bg text-body text-ink rounded border px-3 py-2 font-mono transition-colors duration-150 ${fieldFocus}`}
            />
            <span id="invite-hint">Ask whoever runs this stash.</span>
          </label>
        )}
        <label className="text-label text-muted flex flex-col gap-1">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete={isSignup ? "email" : "email webauthn"}
            aria-invalid={error?.field === "email" || undefined}
            aria-describedby={error ? "auth-error" : undefined}
            className={`border-field bg-bg text-body text-ink rounded border px-3 py-2 transition-colors duration-150 ${fieldFocus}`}
          />
        </label>
        <label className="text-label text-muted flex flex-col gap-1">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={
              isSignup ? "new-password" : "current-password webauthn"
            }
            aria-invalid={error?.field === "password" || undefined}
            aria-describedby={
              [isSignup && "password-hint", error && "auth-error"]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className={`border-field bg-bg text-body text-ink rounded border px-3 py-2 transition-colors duration-150 ${fieldFocus}`}
          />
          {/* The rule up front, not as a browser bubble after the first try. */}
          {isSignup && <span id="password-hint">At least 8 characters.</span>}
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
          className="text-accent focus-visible:outline-accent rounded underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>

      {(google || passkeysSupported) && (
        <div className="text-label text-muted mt-6 flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          or
          <span className="bg-border h-px flex-1" />
        </div>
      )}

      {passkeysSupported && (
        <button
          type="button"
          onClick={onPasskey}
          disabled={pending}
          aria-busy={pending}
          className={`border-border bg-bg text-body text-ink hover:border-accent hover:bg-surface focus-visible:outline-accent mt-6 flex items-center justify-center gap-2 rounded border px-4 py-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60 ${touch}`}
        >
          {pending ? "One moment…" : "Log in with a passkey"}
        </button>
      )}

      {google && (
        <>
          <button
            type="button"
            onClick={onGoogle}
            disabled={pending}
            aria-busy={pending}
            className={`border-border bg-bg text-body text-ink hover:border-accent hover:bg-surface focus-visible:outline-accent ${passkeysSupported ? "mt-3" : "mt-6"} flex items-center justify-center gap-2 rounded border px-4 py-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60`}
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
        </>
      )}
    </main>
  );
}
