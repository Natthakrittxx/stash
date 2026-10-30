"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { CopyButton } from "./copy-button";
import { GitHubMark, REPO_URL } from "./github-mark";
import { StashMark } from "./stash-mark";
import { ThemeToggle } from "./theme-toggle";
import { fieldFocus } from "./stash/ui";

// A sample stash for the demo. Synthetic, and labeled as such on the page.
// Same two kinds as the real thing: a tool is a link, a formula is a command.
type Sample = {
  title: string;
  description: string;
  tags: string[];
} & ({ url: string } | { cmd: string });

const SAMPLES: Sample[] = [
  {
    title: "Excalidraw",
    description: "Whiteboard that looks hand-drawn",
    url: "excalidraw.com",
    tags: ["design", "diagrams"],
  },
  {
    title: "Kill whatever holds a port",
    description: "When the dev server says address in use",
    cmd: "lsof -ti :3000 | xargs kill",
    tags: ["dev", "ports"],
  },
  {
    title: "Squoosh",
    description: "Compress images in the browser",
    url: "squoosh.app",
    tags: ["images"],
  },
  {
    title: "Undo last commit, keep changes",
    description: "The soft one, not the scary one",
    cmd: "git reset --soft HEAD~1",
    tags: ["git"],
  },
  {
    title: "regex101",
    description: "Test and explain regular expressions",
    url: "regex101.com",
    tags: ["dev", "regex"],
  },
  {
    title: "Resize every jpg to 1200px",
    description: "Built into macOS, no install",
    cmd: "sips -Z 1200 *.jpg",
    tags: ["images", "mac"],
  },
  {
    title: "Tunnel to the prod database",
    description: "Postgres over ssh, local port 5432",
    cmd: "ssh -L 5432:localhost:5432 me@db",
    tags: ["ssh", "postgres"],
  },
  {
    title: "Can I use",
    description: "Browser support tables for CSS and JS",
    url: "caniuse.com",
    tags: ["css", "browsers"],
  },
  {
    title: "What is eating the disk",
    description: "Biggest folders last",
    cmd: "du -sh * | sort -h",
    tags: ["disk", "mac"],
  },
];

const DEMO_QUERY = "images";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primary = `bg-accent text-body text-bg rounded px-4 py-2 transition-opacity duration-150 hover:opacity-90 ${focusRing}`;

// Same fields the real search reads: title, description, command, site, tags.
function matches(s: Sample, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [
    s.title,
    s.description,
    "cmd" in s ? s.cmd : "",
    "url" in s ? s.url : "",
    ...s.tags,
  ].some((f) => f.toLowerCase().includes(needle));
}

// The app's own list, minus edit and delete: a filtered search over tool rows
// and formula terminal cards, so the landing shows exactly what you get.
function Demo() {
  const [query, setQuery] = useState("");
  const touched = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  // Types one query the first time the field is on screen, so a visitor who
  // never touches it still sees a search narrow the list. Any input of their
  // own cancels it. Reduced motion gets the finished query at once.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || touched.current) return;
        io.disconnect();
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setQuery(DEMO_QUERY);
          return;
        }
        [...DEMO_QUERY].forEach((_, i) =>
          timers.push(
            window.setTimeout(
              () => {
                if (!touched.current) setQuery(DEMO_QUERY.slice(0, i + 1));
              },
              900 + i * 120,
            ),
          ),
        );
      },
      { threshold: 1 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  // `/` focuses search, as it does in the app.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      event.preventDefault();
      input.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim();
  const visible = SAMPLES.filter((s) => matches(s, q));
  const tools = visible.filter((s) => "url" in s);
  const formulae = visible.filter((s) => "cmd" in s);

  return (
    <div className="border-border mt-8 rounded-lg border p-4 sm:p-6">
      <div className="relative">
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => {
            touched.current = true;
            setQuery(e.target.value);
          }}
          onFocus={() => (touched.current = true)}
          placeholder="Search titles, sites, commands…"
          aria-label="Search the sample stash"
          aria-describedby="demo-status"
          autoComplete="off"
          spellCheck={false}
          className={`border-field bg-bg text-title text-ink placeholder:text-muted w-full rounded border py-2.5 pr-10 pl-3 ${fieldFocus}`}
        />
        {!query && (
          <kbd
            aria-hidden="true"
            className="border-border text-label text-muted pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 sm:block pointer-coarse:hidden"
          >
            /
          </kbd>
        )}
      </div>
      <p
        id="demo-status"
        aria-live="polite"
        className="text-label text-muted mt-2"
      >
        {q
          ? `${visible.length} of ${SAMPLES.length} match “${q}”.`
          : `${SAMPLES.length} things saved.`}
      </p>

      {visible.length === 0 ? (
        <div className="mt-12 mb-6 text-center">
          <p className="text-title text-ink font-serif">
            Nothing matches that.
          </p>
          <p className="text-label text-muted mt-1">
            In your own stash, that&apos;s the cue to save it.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className={`text-label text-accent mt-2 underline underline-offset-2 ${focusRing}`}
          >
            Clear the search
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-10">
          {tools.length > 0 && (
            <section aria-label="Tools">
              <SectionHeading count={tools.length}>Tools</SectionHeading>
              <ul className="divide-border divide-y">
                {tools.map(
                  (s) => "url" in s && <ToolRow key={s.title} s={s} />,
                )}
              </ul>
            </section>
          )}
          {formulae.length > 0 && (
            <section aria-label="Formulae">
              <SectionHeading count={formulae.length}>Formulae</SectionHeading>
              <ul className="flex flex-col gap-3">
                {formulae.map(
                  (s) => "cmd" in s && <FormulaCard key={s.title} s={s} />,
                )}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border mb-4 flex items-baseline gap-2 border-b pb-2">
      <h3 className="text-label text-ink font-semibold">{children}</h3>
      <span className="text-label text-muted tabular-nums">{count}</span>
    </div>
  );
}

// The app's narrow tool row: monogram tile (smaller on phones), serif title,
// host on its own line, description, tags.
function ToolRow({ s }: { s: Sample & { url: string } }) {
  return (
    <li className="flex items-start gap-3 py-4 sm:gap-4">
      <div
        aria-hidden="true"
        className="border-border bg-surface text-title sm:text-headline text-ink grid h-9 w-16 shrink-0 place-items-center rounded border font-serif sm:h-16 sm:w-28"
      >
        {s.url[0]!.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-title text-ink line-clamp-2 font-serif break-words">
          {s.title}
        </h4>
        <p className="text-label text-muted truncate">{s.url}</p>
        <p className="text-body text-muted mt-1">{s.description}</p>
        <ul className="text-label text-muted mt-1.5 flex flex-wrap gap-x-2">
          {s.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </li>
  );
}

// The app's formula card: always-dark terminal, prompt, command, copy.
function FormulaCard({ s }: { s: Sample & { cmd: string } }) {
  return (
    <li className="term border-term-border overflow-hidden rounded-lg border">
      <div className="bg-term-surface flex items-center gap-3 px-3 py-2">
        <span aria-hidden="true" className="flex shrink-0 gap-1.5">
          <span className="bg-term-border size-2.5 rounded-full" />
          <span className="bg-term-border size-2.5 rounded-full" />
          <span className="bg-term-border size-2.5 rounded-full" />
        </span>
        <h4 className="text-label text-term-muted min-w-0 flex-1 truncate font-mono">
          {s.title}
        </h4>
      </div>
      <div className="bg-term-bg px-3 py-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="text-term-accent shrink-0 font-mono leading-relaxed select-none"
          >
            ❯
          </span>
          <code className="text-body text-term-ink scroll-fade min-w-0 flex-1 overflow-x-auto font-mono leading-relaxed whitespace-pre">
            {s.cmd}
          </code>
          <CopyButton
            text={s.cmd}
            className="text-label focus-visible:outline-term-accent inline-flex shrink-0 items-center rounded px-1.5 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
          />
        </div>
        <p className="text-label text-term-muted mt-2 pl-6 font-mono">
          # {s.description}
        </p>
        <ul className="text-label text-term-muted mt-2 flex flex-wrap gap-x-3 pl-6 font-mono">
          {s.tags.map((t) => (
            <li key={t}>#{t}</li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function Start() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <Link href="/signup" className={primary}>
        Start a stash
      </Link>
      <p className="text-label text-muted">
        Already have a stash?{" "}
        <Link
          href="/login"
          className={`text-accent rounded underline underline-offset-2 ${focusRing}`}
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

const KINDS = [
  {
    kind: "Tool",
    text: "A link you keep losing. Paste it and Stash fetches the page’s preview image to go with it.",
  },
  {
    kind: "Formula",
    text: "A command you keep re-deriving, kept exactly as you typed it, one click from your clipboard.",
  },
  {
    kind: "Search",
    text: "One box reads titles, sites, descriptions, commands and tags at once. Tag if you like; you never have to.",
  },
];

export function Landing() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <p className="text-display text-ink flex items-center gap-2.5 font-serif leading-none">
          <StashMark className="size-[1em] rounded-[3px]" />
          Stash
        </p>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className={`text-label text-muted hover:text-ink inline-flex h-9 items-center rounded px-2 ${focusRing}`}
          >
            Log in
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository (opens in a new tab)"
            className={`text-muted hover:text-ink grid h-9 w-9 place-items-center rounded transition-colors duration-150 ${focusRing}`}
          >
            <GitHubMark className="size-[18px]" />
          </a>
          <ThemeToggle />
        </nav>
      </header>

      <main>
        <section className="mt-20 sm:mt-28">
          <h1 className="text-ink font-serif text-[clamp(2.5rem,7vw,4.5rem)] leading-[1.05] tracking-tight text-balance">
            Save it now.
            <br />
            Find it later<span className="text-accent">.</span>
          </h1>
          <p className="text-title text-muted mt-5 max-w-[44ch]">
            A private place for the links and commands you keep losing. One
            search brings any of them back.
          </p>
          <div className="mt-8">
            <Start />
          </div>
        </section>

        <section aria-labelledby="try" className="mt-24">
          <h2 id="try" className="text-headline text-ink font-serif">
            Try finding something
          </h2>
          <p className="text-body text-muted mt-1">
            A made-up stash with nine things in it. Type any word you&apos;d
            remember.
          </p>
          <Demo />
        </section>

        <section aria-labelledby="kinds" className="mt-24">
          <h2 id="kinds" className="text-headline text-ink font-serif">
            Two kinds of thing. One search.
          </h2>
          <dl className="divide-border border-border mt-6 divide-y border-y">
            {KINDS.map(({ kind, text }) => (
              <div
                key={kind}
                className="grid gap-1 py-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6"
              >
                <dt className="text-body text-ink font-semibold">{kind}</dt>
                <dd className="text-body text-muted max-w-[60ch]">{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="yours" className="mt-24">
          <h2 id="yours" className="text-headline text-ink font-serif">
            Yours only.
          </h2>
          <p className="text-body text-muted mt-1 max-w-[52ch]">
            No feed, no likes, no followers. A stash follows you between devices
            and nobody else sees it.
          </p>
          <div className="mt-6">
            <Start />
          </div>
        </section>
      </main>

      <footer className="border-border text-label text-muted mt-24 flex flex-wrap justify-between gap-4 border-t pt-6">
        <span>The sample above is made up. Your stash starts empty.</span>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`hover:text-ink ${focusRing}`}
        >
          Open source on GitHub
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </footer>
    </div>
  );
}
