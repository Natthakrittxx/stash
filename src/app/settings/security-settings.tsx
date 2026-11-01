"use client";

import { useRouter } from "next/navigation";
import { type InputHTMLAttributes, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { encode } from "uqr";

import { CopyButton } from "~/app/copy-button";
import { Modal } from "~/app/modal";
import { field, focusRing, quietButton, touch } from "~/app/stash/ui";
import { authClient } from "~/server/better-auth/client";

import { deviceName, suggestName } from "./passkey-name";

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
        message: "For safety, log in again to do this.",
        logInAgain: true,
      };
    case "INVALID_PASSWORD":
      return { message: "That password isn't right.", field: "password" };
    case "PASSWORD_NOT_CONFIRMED":
      return { message: "Enter your password again.", field: "password" };
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

// One step of a guided setup. It replaces the button that was just pressed, so
// focus goes to its field, or failing that to the step itself.
function Step({
  titleId,
  at,
  total,
  title,
  children,
}: {
  titleId: string;
  at: number;
  total: number;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (
      (ref.current?.querySelector(
        "input:not([hidden])",
      ) as HTMLElement | null) ?? ref.current
    )?.focus();
  }, []);

  return (
    <div ref={ref} tabIndex={-1} className="p-6 outline-hidden">
      {total > 1 && (
        <p className="text-label text-muted">
          Step {at} of {total}
        </p>
      )}
      <h2 id={titleId} className="text-title text-ink mt-1 font-serif">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Actions({
  pending,
  label,
  secondary: other,
  onSecondary,
}: {
  pending: boolean;
  label: string;
  secondary: string;
  onSecondary: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={primary}
      >
        {pending ? "One moment…" : label}
      </button>
      <button type="button" onClick={onSecondary} className={secondary}>
        {other}
      </button>
    </div>
  );
}

// Focus goes back to the button that opened it. It has to be rendered closed
// first: nothing outside an open modal dialog can take focus.
function useSetupDialog() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const close = () => {
    flushSync(() => setOpen(false));
    opener.current?.focus();
  };
  return { open, opener, show: () => setOpen(true), close };
}

// Password managers look for an account to match a password field against, and
// a confirm-your-password form has nowhere visible to show one.
function AccountHint({ email }: { email: string }) {
  return (
    <input
      hidden
      readOnly
      type="text"
      name="username"
      autoComplete="username"
      value={email}
    />
  );
}

function ConfirmPassword({
  email,
  password,
  failure,
  onType,
}: {
  email: string;
  password: string;
  failure: Failure | null;
  onType: (value: string) => void;
}) {
  return (
    <>
      <AccountHint email={email} />
      <CheckedField
        label="Your password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        failure={failure}
        onType={onType}
      />
    </>
  );
}

function ModalFailure({ failure }: { failure: Failure | null }) {
  if (!failure || failure.field) return null;
  return (
    <div className="-mt-3 px-6 pb-6">
      <FailureNote failure={failure} />
    </div>
  );
}

function AuthenticatorSetup({
  email,
  hasPassword,
  onClose,
}: {
  email: string;
  hasPassword: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { failure, setFailure, pending, run } = useAction();
  const [step, setStep] = useState<"confirm" | "scan" | "code" | "codes">(
    "confirm",
  );
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{
    uri: string;
    backupCodes: string[];
  } | null>(null);
  const [code, setCode] = useState("");
  const titleId = "authenticator-setup";
  const key = setup
    ? (new URL(setup.uri).searchParams.get("secret") ?? "")
    : "";

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (hasPassword && !password) {
      setFailure({ message: "Enter your password.", field: "password" });
      return;
    }
    const data = await run(() =>
      authClient.twoFactor.enable(
        (hasPassword ? { password } : {}) as { password: string },
      ),
    );
    if (data) {
      setPassword("");
      setSetup({ uri: data.totpURI, backupCodes: data.backupCodes });
      setStep("scan");
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
    if (data) {
      setStep("codes");
      router.refresh();
    }
  }

  return (
    // Backup codes are never shown again, so that step has to be finished on purpose.
    <Modal labelledBy={titleId} onClose={onClose} locked={step === "codes"}>
      {step === "confirm" && (
        <Step
          titleId={titleId}
          at={1}
          total={4}
          title="Set up an authenticator app"
        >
          <form noValidate onSubmit={start}>
            <p className="text-body text-muted mt-1">
              You&apos;ll need an app like 1Password or Google Authenticator.
              Logging in with a password or Google will then ask for a code from
              it.
            </p>
            {hasPassword && (
              <ConfirmPassword
                email={email}
                password={password}
                failure={failure}
                onType={(value) => {
                  setPassword(value);
                  setFailure(null);
                }}
              />
            )}
            <Actions
              pending={pending}
              label="Continue"
              secondary="Cancel"
              onSecondary={onClose}
            />
          </form>
        </Step>
      )}

      {step === "scan" && setup && (
        <Step titleId={titleId} at={2} total={4} title="Add Stash to your app">
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setStep("code");
            }}
          >
            <p className="text-body text-muted mt-1">
              Scan this with your authenticator app.
            </p>
            <div className="mt-4">
              <QrCode text={setup.uri} />
            </div>
            <p className="text-label text-muted mt-4">
              Or enter this key by hand:
            </p>
            <div className="bg-term-bg mt-1 flex items-center gap-2 rounded px-3 py-2">
              <code className="text-body text-term-ink min-w-0 flex-1 font-mono break-all">
                {key}
              </code>
              <CopyButton text={key} label="Copy key" className={copyAction} />
            </div>
            <Actions
              pending={false}
              label="Next"
              secondary="Cancel"
              onSecondary={onClose}
            />
          </form>
        </Step>
      )}

      {step === "code" && (
        <Step titleId={titleId} at={3} total={4} title="Enter the code">
          <form noValidate onSubmit={confirm}>
            <p className="text-body text-muted mt-1">
              Enter the code your app shows for Stash.
            </p>
            <CheckedField
              label="Code"
              name="code"
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
            <Actions
              pending={pending}
              label="Turn on"
              secondary="Back"
              onSecondary={() => {
                setFailure(null);
                setStep("scan");
              }}
            />
          </form>
        </Step>
      )}

      {step === "codes" && setup && (
        <Step titleId={titleId} at={4} total={4} title="Save your backup codes">
          <BackupCodes codes={setup.backupCodes} onDone={onClose} />
        </Step>
      )}

      <ModalFailure failure={failure} />
    </Modal>
  );
}

function PasskeySetup({
  email,
  hasPassword,
  authenticatorNames,
  onClose,
}: {
  email: string;
  hasPassword: boolean;
  authenticatorNames: Record<string, string>;
  onClose: () => void;
}) {
  const router = useRouter();
  const { failure, setFailure, pending, run } = useAction();
  const [step, setStep] = useState<"confirm" | "create" | "name">(
    hasPassword ? "confirm" : "create",
  );
  const [password, setPassword] = useState("");
  const [added, setAdded] = useState<{ id: string; name?: string } | null>(
    null,
  );
  const [name, setName] = useState("");
  const titleId = "passkey-setup";
  // Google-only accounts have no password step.
  const total = hasPassword ? 3 : 2;
  const at = (position: number) => (hasPassword ? position : position - 1);

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!password) {
      setFailure({ message: "Enter your password.", field: "password" });
      return;
    }
    const data = await run(() =>
      authClient.$fetch<{ status: boolean }>("/confirm-password", {
        method: "POST",
        body: { password },
      }),
    );
    if (data) {
      setPassword("");
      setStep("create");
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const device = deviceName(navigator.userAgent);
    const data = await run(async () => {
      // The browser makes the key here, so it's saved under a name from the start.
      const result = await authClient.passkey.addPasskey({ name: device });
      // Confirmed too long ago, say after leaving this open.
      const error: Result<unknown>["error"] = result.error;
      if (error?.code === "PASSWORD_NOT_CONFIRMED") setStep("confirm");
      return result;
    });
    if (data) {
      setAdded({ id: data.id, name: data.name });
      setName(
        suggestName(data.aaguid, authenticatorNames, navigator.userAgent),
      );
      setStep("name");
      router.refresh();
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const chosen = name.trim() || added?.name;
    if (added && chosen && chosen !== added.name) {
      const data = await run(() =>
        authClient.passkey.updatePasskey({ id: added.id, name: chosen }),
      );
      if (!data) return;
      router.refresh();
    }
    onClose();
  }

  return (
    <Modal labelledBy={titleId} onClose={onClose}>
      {step === "confirm" && (
        <Step titleId={titleId} at={at(1)} total={total} title="Add a passkey">
          <form noValidate onSubmit={confirm}>
            <p className="text-body text-muted mt-1">
              First, confirm it&apos;s you.
            </p>
            <ConfirmPassword
              email={email}
              password={password}
              failure={failure}
              onType={(value) => {
                setPassword(value);
                setFailure(null);
              }}
            />
            <Actions
              pending={pending}
              label="Continue"
              secondary="Cancel"
              onSecondary={onClose}
            />
          </form>
        </Step>
      )}

      {step === "create" && (
        <Step
          titleId={titleId}
          at={at(2)}
          total={total}
          title="Create your passkey"
        >
          <form noValidate onSubmit={create}>
            <p className="text-body text-muted mt-1">
              Your browser will ask you to use your fingerprint, face, device
              PIN or a security key.
            </p>
            <Actions
              pending={pending}
              label="Create passkey"
              secondary="Cancel"
              onSecondary={onClose}
            />
          </form>
        </Step>
      )}

      {step === "name" && (
        <Step titleId={titleId} at={at(3)} total={total} title="Check its name">
          <form noValidate onSubmit={save}>
            <p className="text-body text-muted mt-1">
              Your passkey works. This name helps you tell it apart later.
            </p>
            <label className="text-label text-muted mt-4 flex max-w-xs flex-col gap-1">
              Name
              <input
                value={name}
                maxLength={60}
                onFocus={(event) => event.target.select()}
                onChange={(event) => setName(event.target.value)}
                className={field}
              />
            </label>
            <div className="mt-6">
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className={primary}
              >
                {pending ? "One moment…" : "Save"}
              </button>
            </div>
          </form>
        </Step>
      )}

      <ModalFailure failure={failure} />
    </Modal>
  );
}

// Proton Pass misses a popup's password field when another one sits on the page
// behind it, so these confirm in a popup as well.
function SecondFactorChange({
  email,
  hasPassword,
  kind,
  onClose,
}: {
  email: string;
  hasPassword: boolean;
  kind: "codes" | "off";
  onClose: () => void;
}) {
  const router = useRouter();
  const { failure, setFailure, pending, run } = useAction();
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const titleId = "second-factor-change";
  const proof = (hasPassword ? { password } : {}) as { password: string };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (hasPassword && !password) {
      setFailure({ message: "Enter your password.", field: "password" });
      return;
    }
    if (kind === "codes") {
      const data = await run(() =>
        authClient.twoFactor.generateBackupCodes(proof),
      );
      if (data) setCodes(data.backupCodes);
      return;
    }
    const data = await run(() => authClient.twoFactor.disable(proof));
    if (data) {
      router.refresh();
      onClose();
    }
  }

  return (
    <Modal labelledBy={titleId} onClose={onClose} locked={!!codes}>
      {codes ? (
        <Step titleId={titleId} at={2} total={2} title="Save your backup codes">
          <BackupCodes codes={codes} onDone={onClose} />
        </Step>
      ) : (
        <Step
          titleId={titleId}
          at={1}
          total={kind === "codes" ? 2 : 1}
          title={
            kind === "codes"
              ? "Get new backup codes"
              : "Turn off the authenticator app"
          }
        >
          <form noValidate onSubmit={submit}>
            <p className="text-body text-muted mt-1">
              {kind === "codes"
                ? "Your old backup codes will stop working."
                : "Logging in will stop asking for a code."}
            </p>
            {hasPassword && (
              <ConfirmPassword
                email={email}
                password={password}
                failure={failure}
                onType={(value) => {
                  setPassword(value);
                  setFailure(null);
                }}
              />
            )}
            <Actions
              pending={pending}
              label={kind === "codes" ? "Get new codes" : "Turn off"}
              secondary="Cancel"
              onSecondary={onClose}
            />
          </form>
        </Step>
      )}
      <ModalFailure failure={failure} />
    </Modal>
  );
}

export function SecondFactorSection({
  email,
  enabled,
  hasPassword,
}: {
  email: string;
  enabled: boolean;
  hasPassword: boolean;
}) {
  const setup = useSetupDialog();
  const newCodes = useSetupDialog();
  const off = useSetupDialog();

  return (
    <section className="mt-8" aria-labelledby="second-factor">
      <h2 id="second-factor" className="text-title text-ink font-serif">
        Authenticator app
      </h2>
      {enabled ? (
        <>
          <p className="text-body text-muted mt-1">
            On. You&apos;re asked for a code after logging in with a password or
            Google.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              ref={newCodes.opener}
              type="button"
              aria-haspopup="dialog"
              onClick={newCodes.show}
              className={secondary}
            >
              Get new backup codes
            </button>
            <button
              ref={off.opener}
              type="button"
              aria-haspopup="dialog"
              onClick={off.show}
              className={secondary}
            >
              Turn off
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-body text-muted mt-1">
            Ask for a code from an app like 1Password or Google Authenticator
            after logging in with a password or Google.
          </p>
          <button
            ref={setup.opener}
            type="button"
            aria-haspopup="dialog"
            onClick={setup.show}
            className={`${primary} mt-4`}
          >
            Set up
          </button>
        </>
      )}
      {setup.open && (
        <AuthenticatorSetup
          email={email}
          hasPassword={hasPassword}
          onClose={setup.close}
        />
      )}
      {newCodes.open && (
        <SecondFactorChange
          email={email}
          hasPassword={hasPassword}
          kind="codes"
          onClose={newCodes.close}
        />
      )}
      {off.open && (
        <SecondFactorChange
          email={email}
          hasPassword={hasPassword}
          kind="off"
          onClose={off.close}
        />
      )}
    </section>
  );
}

export function PasskeysSection({
  email,
  passkeys,
  hasPassword,
  authenticatorNames,
}: {
  email: string;
  passkeys: { id: string; name: string | null; createdAt: Date | null }[];
  hasPassword: boolean;
  authenticatorNames: Record<string, string>;
}) {
  const router = useRouter();
  const { failure, pending, run } = useAction();
  const setup = useSetupDialog();
  // Set after mount: the server can't know, and browsers don't offer passkeys on
  // plain-HTTP addresses other than localhost.
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => setSupported(!!window.PublicKeyCredential), []);

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
        <button
          ref={setup.opener}
          type="button"
          aria-haspopup="dialog"
          onClick={setup.show}
          className={`${secondary} mt-4`}
        >
          Add a passkey
        </button>
      )}
      {failure && <FailureNote failure={failure} />}
      {setup.open && (
        <PasskeySetup
          email={email}
          hasPassword={hasPassword}
          authenticatorNames={authenticatorNames}
          onClose={setup.close}
        />
      )}
    </section>
  );
}
