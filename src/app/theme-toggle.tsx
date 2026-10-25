"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const dark = "(prefers-color-scheme: dark)";

function systemTheme(): Theme {
  return window.matchMedia(dark).matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  // The server can't know the resolved theme, so the button mounts empty and
  // reads the choice the inline head script already applied. Until no choice is
  // stored, it follows the OS live so the label never names the current theme.
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return setTheme(stored);
    setTheme(systemTheme());
    const mq = window.matchMedia(dark);
    const follow = () => {
      if (!localStorage.getItem("theme")) setTheme(systemTheme());
    };
    mq.addEventListener("change", follow);
    return () => mq.removeEventListener("change", follow);
  }, []);

  const box =
    "grid h-9 w-9 shrink-0 place-items-center rounded text-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  // Same footprint before mount, so the header never shifts when it appears.
  if (!theme) return <span aria-hidden="true" className={box} />;

  const next = theme === "dark" ? "light" : "dark";

  function toggle() {
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      className={box}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

// Show the destination, not the current state: a sun means "go light".
function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
