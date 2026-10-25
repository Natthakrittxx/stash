"use client";

import { useState } from "react";

// Clipboard write with a two-second, word-plus-mark confirmation. The color
// reinforces the mark — term-accent teal on success, danger-rose on failure —
// so state never rides on color alone. Terminal-only: it owns its term-* tones
// and the caller passes layout/focus classes. `className` stays free of color.
// Its own module so the landing demo can use it without pulling the whole app
// (and the auth client) into its bundle.
export function CopyButton({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      // Clipboard rejects on denied permission and does not exist outside a
      // secure context.
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  const tone =
    state === "copied"
      ? "text-term-accent"
      : state === "failed"
        ? "text-term-danger"
        : "text-term-muted hover:text-term-ink";

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy command"
        className={`${tone} ${className}`}
      >
        {state === "copied"
          ? "✓ Copied"
          : state === "failed"
            ? "✕ Failed"
            : "Copy"}
      </button>
      {/* The label stays short (no 8000-char command read aloud); this live
            region is what tells a screen reader the copy happened. */}
      <span role="status" className="sr-only">
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Copy failed"
            : ""}
      </span>
    </>
  );
}
