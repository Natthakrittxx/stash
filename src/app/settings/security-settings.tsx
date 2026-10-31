"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { encode } from "uqr";

import { CopyButton } from "~/app/copy-button";
import { fieldFocus, focusRing, touch } from "~/app/stash/ui";
import { authClient } from "~/server/better-auth/client";

const primary = `bg-accent text-body text-bg inline-flex items-center justify-center rounded px-4 py-2 font-medium transition-opacity duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-60 ${touch} ${focusRing}`;
const secondary = `border-border bg-bg text-body text-ink hover:border-accent hover:bg-surface inline-flex items-center justify-center rounded border px-4 py-2 transition-colors duration-150 disabled:pointer-events-none disabled:opacity-60 ${touch} ${focusRing}`;
const field = `border-field bg-bg text-body text-ink rounded border px-3 py-2 transition-colors duration-150 ${fieldFocus}`;
const copyAction = `text-label focus-visible:outline-term-accent inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${touch}`;

type Failure = { message: string; signInAgain?: true };

function explain(code?: string): Failure {
  switch (code) {
    case "SESSION_NOT_FRESH":
      return {
        message: "For safety, this needs a sign-in from the last 10 minutes.",
        signInAgain: true,
      };
    case "INVALID_PASSWORD":
      return { message: "That password isn't right." };
    case "INVALID_CODE":
      return {
        message: "That code didn't work. Check your app and try again.",
      };
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

  return { failure, pending, run };
}

function FailureNote({ failure }: { failure: Failure | null }) {
  if (!failure) return null;
  return (
    <p role="alert" className="text-label text-danger mt-4">
      <span aria-hidden="true">✕ </span>
      {failure.message}
      {failure.signInAgain && (
        <>
          {" "}
          <button
            type="button"
            onClick={async () => {
              await authClient.signOut();
              window.location.assign("/login");
            }}
            className={`text-accent rounded underline underline-offset-2 ${focusRing}`}
          >
            Sign in again
          </button>
        </>
      )}
    </p>
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

function PasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-label text-muted mt-4 flex max-w-xs flex-col gap-1">
      Your password
      <input
        type="password"
        required
        autoComplete="current-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={field}
      />
    </label>
  );
}

function BackupCodes({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  return (
    <>
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
    </>
  );
}

function SecondFactorSection({
  enabled,
  hasPassword,
}: {
  enabled: boolean;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const { failure, pending, run } = useAction();
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{
    uri: string;
    backupCodes: string[];
  } | null>(null);
  const [code, setCode] = useState("");
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  const proof = hasPassword ? { password } : {};

  async function start(event: React.FormEvent) {
    event.preventDefault();
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
    const data = await run(() => authClient.twoFactor.verifyTotp({ code }));
    if (data && setup) {
      setCode("");
      setNewCodes(setup.backupCodes);
      setSetup(null);
      router.refresh();
    }
  }

  async function regenerate() {
    const data = await run(() =>
      authClient.twoFactor.generateBackupCodes(proof as { password: string }),
    );
    if (data) {
      setPassword("");
      setNewCodes(data.backupCodes);
    }
  }

  async function turnOff() {
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
        <form onSubmit={confirm}>
          <label className="text-label text-muted mt-4 flex max-w-xs flex-col gap-1">
            Code
            <input
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              spellCheck={false}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={`${field} font-mono`}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={primary}>
              {pending ? "One moment…" : "Turn on"}
            </button>
            <button
              type="button"
              onClick={() => setSetup(null)}
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
          On. You&apos;re asked for a code after signing in with a password or
          Google.
        </p>
        {hasPassword && (
          <PasswordField value={password} onChange={setPassword} />
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || (hasPassword && !password)}
            onClick={regenerate}
            className={secondary}
          >
            Get new backup codes
          </button>
          <button
            type="button"
            disabled={pending || (hasPassword && !password)}
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
      <form onSubmit={start}>
        <p className="text-body text-muted mt-1">
          Ask for a code from an app like 1Password or Google Authenticator
          after signing in with a password or Google.
        </p>
        {hasPassword && (
          <PasswordField value={password} onChange={setPassword} />
        )}
        <button type="submit" disabled={pending} className={`${primary} mt-4`}>
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
      <FailureNote failure={failure} />
    </section>
  );
}

function PasskeysSection({
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
        <ul className="mt-4 flex flex-col gap-2">
          {passkeys.map(({ id, name, createdAt }) => (
            <li
              key={id}
              className="border-border flex items-center gap-3 rounded border px-3 py-2"
            >
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
                className={`text-label text-muted hover:text-ink inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-medium ${touch} ${focusRing}`}
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
        <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-label text-muted flex flex-col gap-1">
            Name (optional)
            <input
              value={name}
              maxLength={60}
              placeholder="My phone"
              onChange={(event) => setName(event.target.value)}
              className={field}
            />
          </label>
          <button type="submit" disabled={pending} className={secondary}>
            {pending ? "One moment…" : "Add a passkey"}
          </button>
        </form>
      )}
      <FailureNote failure={failure} />
    </section>
  );
}

export function SecuritySettings({
  twoFactorEnabled,
  hasPassword,
  passkeys,
}: {
  twoFactorEnabled: boolean;
  hasPassword: boolean;
  passkeys: { id: string; name: string | null; createdAt: Date | null }[];
}) {
  return (
    <>
      <SecondFactorSection
        enabled={twoFactorEnabled}
        hasPassword={hasPassword}
      />
      <PasskeysSection passkeys={passkeys} />
    </>
  );
}
