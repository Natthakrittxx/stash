"use client";

import { useRouter } from "next/navigation";
import { type InputHTMLAttributes, useEffect, useRef, useState } from "react";
import { encode } from "uqr";

import { CopyButton } from "~/app/copy-button";
import { field, focusRing, quietButton, touch } from "~/app/stash/ui";
import { authClient } from "~/server/better-auth/client";

const primary = `bg-accent text-body text-bg inline-flex items-center justify-center rounded px-4 py-2 font-medium transition-opacity duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-60 ${touch} ${focusRing}`;
const secondary = `border-border bg-bg text-body text-ink hover:border-accent hover:bg-surface inline-flex items-center justify-center rounded border px-4 py-2 transition-colors duration-150 disabled:pointer-events-none disabled:opacity-60 ${touch} ${focusRing}`;
const copyAction = `text-label focus-visible:outline-term-accent inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${touch}`;

type Failure = {
  message: string;
  // Which field it names. Without one it goes at the end of its section.
  field?: "password" | "code";
  logInAgain?: true;
};

function explain(code?: string): Failure {
  switch (code) {
    case "SESSION_NOT_FRESH":
      return {
        message: "For safety, this needs a login from the last 10 minutes.",
        logInAgain: true,
      };
    case "INVALID_PASSWORD":
      return { message: "That password isn't right.", field: "password" };
    case "INVALID_CODE":
      return {
        message: "That code didn't work. Check your app and try again.",
        field: "code",
      };
    case "SECOND_FACTOR_ALREADY_ON":
      return { message: "It's already on. Reload this page to see it." };
    case "PREVIOUSLY_REGISTERED":
    case "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED":
      return { message: "This device already has a passkey here." };
    default:
      return { message: "That didn't work. Try again." };
  }
}

// Closing the browser's passkey prompt comes back as an error. Not worth a message.
const CANCELLED = new Set([
  "AUTH_CANCELLED",
  "REGISTRATION_CANCELLED",
  "ERROR_CEREMONY_ABORTED",
]);

type Result<T> = {
  data?: T | null;
  error?: { code?: string; message?: string } | null;
};

function useAction() {
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, setPending] = useState(false);

  async function run<T>(action: () => Promise<Result<T>>) {
    setFailure(null);
    setPending(true);
    const { data, error } = await action();
    setPending(false);
    if (error) {
      if (!CANCELLED.has(error.code ?? "")) setFailure(explain(error.code));
      return null;
    }
    return data ?? null;
  }

  return { failure, setFailure, pending, run };
}

function FailureNote({ failure, id }: { failure: Failure; id?: string }) {
  return (
    <p id={id} role="alert" className="text-label text-danger mt-1">
      <span aria-hidden="true">✕ </span>
      {failure.message}
      {failure.logInAgain && (
        <>
          {" "}
          <button
            type="button"
            onClick={async () => {
              await authClient.signOut();
              window.location.assign("/login");
            }}
            className={`text-accent inline-flex items-center rounded underline underline-offset-2 ${touch} ${focusRing}`}
          >
            Log in again
          </button>
        </>
      )}
    </p>
  );
}

// A failure that names this field shows under it and takes focus. Typing clears it.
function CheckedField({
  label,
  name,
  failure,
  onType,
  className = "",
  ...input
}: {
  label: string;
  name: "password" | "code";
  failure: Failure | null;
  onType: (value: string) => void;
} & InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null);
  const failed = failure?.field === name;

  useEffect(() => {
    if (failed) ref.current?.focus();
  }, [failure, failed]);

  return (
    <div className="mt-4 max-w-xs">
      <label className="text-label text-muted flex flex-col gap-1">
        {label}
        <input
          {...input}
          ref={ref}
          name={name}
          onChange={(event) => onType(event.target.value)}
          aria-invalid={failed || undefined}
          aria-describedby={failed ? `${name}-failure` : undefined}
          className={`${field} ${className}`}
        />
      </label>
      {failed && <FailureNote failure={failure} id={`${name}-failure`} />}
    </div>
  );
}

// Scanners need dark on light whatever the theme, so the colors are fixed.
function QrCode({ text }: { text: string }) {
  const { data, size } = encode(text);
  const cells = data
    .flatMap((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1h-1z` : "")))
    .join("");
  return (
    <svg
      role="img"
      aria-label="QR code for your authenticator app"
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      className="size-48 rounded bg-white"
    >
      <path d={cells} fill="#000" />
    </svg>
  );
}

function BackupCodes({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  // The step replaces the button that was just pressed, so focus would be lost.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <div ref={ref} tabIndex={-1} className="outline-hidden">
      <p className="text-body text-muted mt-1">
        Save these somewhere safe. Each one gets you in once if you lose your
        phone, and you won&apos;t see them again.
      </p>
      <div className="bg-term-bg mt-4 flex items-start gap-2 rounded px-3 py-2">
        <ul className="text-body text-term-ink min-w-0 flex-1 columns-2 font-mono">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <CopyButton
          text={codes.join("\n")}
          label="Copy backup codes"
          className={copyAction}
        />
      </div>
      <button type="button" onClick={onDone} className={`${primary} mt-4`}>
        I&apos;ve saved them
      </button>
    </div>
  );
}

export function SecondFactorSection({
  enabled,
  hasPassword,
}: {
  enabled: boolean;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const { failure, setFailure, pending, run } = useAction();
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{
    uri: string;
    backupCodes: string[];
  } | null>(null);
  const [code, setCode] = useState("");
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  const proof = hasPassword ? { password } : {};

  function passwordMissing() {
    if (!hasPassword || password) return false;
    setFailure({ message: "Enter your password.", field: "password" });
    return true;
  }

  const passwordField = hasPassword && (
    <CheckedField
      label="Your password"
      name="password"
      type="password"
      autoComplete="current-password"
      value={password}
      failure={failure}
      onType={(value) => {
        setPassword(value);
        setFailure(null);
      }}
    />
  );

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (passwordMissing()) return;
    const data = await run(() =>
      authClient.twoFactor.enable(proof as { password: string }),
    );
    if (data) {
      setPassword("");
      setSetup({ uri: data.totpURI, backupCodes: data.backupCodes });
    }
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim()) {
      setFailure({ message: "Enter the code from your app.", field: "code" });
      return;
    }
    const data = await run(() =>
      authClient.twoFactor.verifyTotp({ code: code.trim() }),
    );
    if (data && setup) {
      setCode("");
      setNewCodes(setup.backupCodes);
      setSetup(null);
      router.refresh();
    }
  }

  async function regenerate() {
    if (passwordMissing()) return;
    const data = await run(() =>
      authClient.twoFactor.generateBackupCodes(proof as { password: string }),
    );
    if (data) {
      setPassword("");
      setNewCodes(data.backupCodes);
    }
  }

  async function turnOff() {
    if (passwordMissing()) return;
    const data = await run(() =>
      authClient.twoFactor.disable(proof as { password: string }),
    );
    if (data) {
      setPassword("");
      router.refresh();
    }
  }

  let body;
  if (newCodes) {
    body = <BackupCodes codes={newCodes} onDone={() => setNewCodes(null)} />;
  } else if (setup) {
    const key = new URL(setup.uri).searchParams.get("secret") ?? "";
    body = (
      <>
        <p className="text-body text-muted mt-1">
          Scan this with your authenticator app, then enter the code it shows.
        </p>
        <div className="mt-4">
          <QrCode text={setup.uri} />
        </div>
        <p className="text-label text-muted mt-4">Or enter this key by hand:</p>
        <div className="bg-term-bg mt-1 flex items-center gap-2 rounded px-3 py-2">
          <code className="text-body text-term-ink min-w-0 flex-1 font-mono break-all">
            {key}
          </code>
          <CopyButton text={key} label="Copy key" className={copyAction} />
        </div>
        <form noValidate onSubmit={confirm}>
          <CheckedField
            label="Code"
            name="code"
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            spellCheck={false}
            value={code}
            failure={failure}
            onType={(value) => {
              setCode(value);
              setFailure(null);
            }}
            className="font-mono"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className={primary}
            >
              {pending ? "One moment…" : "Turn on"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSetup(null);
                setCode("");
                setFailure(null);
              }}
              className={secondary}
            >
              Cancel
            </button>
          </div>
        </form>
      </>
    );
  } else if (enabled) {
    body = (
      <>
        <p className="text-body text-muted mt-1">
          On. You&apos;re asked for a code after logging in with a password or
          Google.
        </p>
        {passwordField}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={regenerate}
            className={secondary}
          >
            Get new backup codes
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={turnOff}
            className={secondary}
          >
            Turn off
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <form noValidate onSubmit={start}>
        <p className="text-body text-muted mt-1">
          Ask for a code from an app like 1Password or Google Authenticator
          after logging in with a password or Google.
        </p>
        {passwordField}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`${primary} mt-4`}
        >
          {pending ? "One moment…" : "Set up"}
        </button>
      </form>
    );
  }

  return (
    <section className="mt-8" aria-labelledby="second-factor">
      <h2 id="second-factor" className="text-title text-ink font-serif">
        Authenticator app
      </h2>
      {body}
      {failure && !failure.field && <FailureNote failure={failure} />}
    </section>
  );
}

export function PasskeysSection({
  passkeys,
}: {
  passkeys: { id: string; name: string | null; createdAt: Date | null }[];
}) {
  const router = useRouter();
  const { failure, pending, run } = useAction();
  const [name, setName] = useState("");
  // Set after mount: the server can't know, and browsers don't offer passkeys on
  // plain-HTTP addresses other than localhost.
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => setSupported(!!window.PublicKeyCredential), []);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const data = await run(() =>
      authClient.passkey.addPasskey({ name: name.trim() || undefined }),
    );
    if (data) {
      setName("");
      router.refresh();
    }
  }

  async function remove(id: string) {
    const data = await run(() => authClient.passkey.deletePasskey({ id }));
    if (data) router.refresh();
  }

  return (
    <section className="mt-10" aria-labelledby="passkeys">
      <h2 id="passkeys" className="text-title text-ink font-serif">
        Passkeys
      </h2>
      <p className="text-body text-muted mt-1">
        Log in with your fingerprint, face or device PIN, with no password or
        code. Your password keeps working.
      </p>

      {passkeys.length > 0 && (
        <ul className="divide-border border-border mt-4 divide-y border-y">
          {passkeys.map(({ id, name, createdAt }) => (
            <li key={id} className="flex items-center gap-3 py-4">
              <span className="min-w-0 flex-1">
                <span className="text-body text-ink block truncate">
                  {name ?? "Passkey"}
                </span>
                {createdAt && (
                  <span className="text-label text-muted block">
                    Added{" "}
                    {createdAt.toLocaleDateString("en", {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    })}
                  </span>
                )}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(id)}
                aria-label={`Remove passkey ${name ?? ""}`.trim()}
                className={`${quietButton} hover:text-danger shrink-0`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {supported === false && (
        <p className="text-label text-muted mt-4">
          Passkeys need this stash to be on HTTPS.
        </p>
      )}
      {supported && (
        <form
          noValidate
          onSubmit={add}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <label className="text-label text-muted flex min-w-48 flex-1 flex-col gap-1">
            Name (optional)
            <input
              value={name}
              maxLength={60}
              placeholder="My phone"
              onChange={(event) => setName(event.target.value)}
              className={field}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className={secondary}
          >
            {pending ? "One moment…" : "Add a passkey"}
          </button>
        </form>
      )}
      {failure && <FailureNote failure={failure} />}
    </section>
  );
}
