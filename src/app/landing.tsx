"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { GitHubMark, REPO_URL } from "./github-mark";
import { StashMark } from "./stash-mark";

// A sample stash for the demo. Synthetic, and labeled as such on the page.
// Same two kinds as the real thing: a tool is a link, a formula is a command.
type Sample = {
  title: string;
  description: string;
  tags: string[];
} & ({ url: string } | { cmd: string });

const SAMPLES: Sample[] = [
  {
    title: "excalidraw",
    description: "whiteboard that looks hand-drawn",
    url: "excalidraw.com",
    tags: ["design", "diagrams"],
  },
  {
    title: "kill whatever holds a port",
    description: "when the dev server says address in use",
    cmd: "lsof -ti :3000 | xargs kill",
    tags: ["dev", "ports"],
  },
  {
    title: "squoosh",
    description: "compress images in the browser",
    url: "squoosh.app",
    tags: ["images"],
  },
  {
    title: "undo last commit, keep changes",
    description: "the soft one, not the scary one",
    cmd: "git reset --soft HEAD~1",
    tags: ["git"],
  },
  {
    title: "regex101",
    description: "test and explain regular expressions",
    url: "regex101.com",
    tags: ["dev", "regex"],
  },
  {
    title: "resize every jpg to 1200px",
    description: "built into macOS, no install",
    cmd: "sips -Z 1200 *.jpg",
    tags: ["images", "mac"],
  },
  {
    title: "tunnel to the prod database",
    description: "postgres over ssh, local port 5432",
    cmd: "ssh -L 5432:localhost:5432 me@db",
    tags: ["ssh", "postgres"],
  },
  {
    title: "can i use",
    description: "browser support tables for css and js",
    url: "caniuse.com",
    tags: ["css", "browsers"],
  },
  {
    title: "what is eating the disk",
    description: "biggest folders last",
    cmd: "du -sh * | sort -h",
    tags: ["disk", "mac"],
  },
];

const DEMO_QUERY = "images";

function matches(s: Sample, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  // Same fields the real search reads: title, description, command, tags.
  return [s.title, s.description, "cmd" in s ? s.cmd : "", ...s.tags].some(
    (f) => f.toLowerCase().includes(needle),
  );
}

// Wraps every occurrence of the query in signal amber.
function Mark({ text, q }: { text: string; q: string }) {
  const needle = q.trim();
  if (!needle) return text;
  const parts = text.split(
    new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
  );
  return parts.map((p, i) =>
    i % 2 ? (
      <mark key={i} className="text-accent bg-transparent">
        {p}
      </mark>
    ) : (
      p
    ),
  );
}

function Demo() {
  const [query, setQuery] = useState("");
  const touched = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const rects = useRef(new Map<string, number>());

  // Types one query into the field the first time it is fully on screen, so a
  // visitor who never touches it still sees the re-ranking. Any input of
  // their own cancels it. Reduced motion gets the finished query at once.
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
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  const q = query.trim();
  // Matches pull to the front; the rest keep their order behind them.
  const order = [
    ...SAMPLES.filter((s) => matches(s, q)),
    ...SAMPLES.filter((s) => !matches(s, q)),
  ];
  const hits = q ? SAMPLES.filter((s) => matches(s, q)).length : 0;

  // FLIP: each row starts where it was and glides to its new slot. Uses the
  // `translate` property so it never fights the sway on `transform`.
  useLayoutEffect(() => {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    rows.current.forEach((el, key) => {
      const top = el.getBoundingClientRect().top + scrollY;
      const was = rects.current.get(key);
      rects.current.set(key, top);
      if (still || was === undefined || was === top) return;
      el.style.transition = "none";
      el.style.translate = `0 ${was - top}px`;
      void el.offsetHeight;
      el.style.transition = "";
      el.style.translate = "";
    });
  }, [q]);

  return (
    <section aria-labelledby="demo-label" className="mt-12 sm:mt-14">
      <label id="demo-label" htmlFor="demo-search" className="text-muted block">
        search a sample stash. type any word you&apos;d remember.
      </label>

      <div className="v-display mt-2 flex items-baseline gap-4">
        <span aria-hidden="true" className="text-accent">
          &gt;
        </span>
        <input
          ref={input}
          id="demo-search"
          type="search"
          value={query}
          onChange={(e) => {
            touched.current = true;
            setQuery(e.target.value);
          }}
          onFocus={() => (touched.current = true)}
          placeholder="ssh, images, git"
          autoComplete="off"
          spellCheck={false}
          className="text-ink caret-accent w-full min-w-0 bg-transparent outline-none placeholder:text-[var(--color-far)] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      <p aria-live="polite" className="text-muted">
        {q
          ? hits
            ? `${hits} of ${SAMPLES.length} pulled forward for "${q}"`
            : `nothing for "${q}". in your own stash, that's the cue to save it.`
          : `${SAMPLES.length} things saved. nothing asked for yet.`}
      </p>

      <ul className="mt-8 space-y-4">
        {order.map((s, i) => {
          const hit = matches(s, q);
          const far = q ? !hit : i % 2 === 1;
          const formula = "cmd" in s;
          return (
            <li
              key={s.title}
              ref={(el) => {
                if (el) rows.current.set(s.title, el);
                else rows.current.delete(s.title);
              }}
              style={
                {
                  "--sway": `${i % 3 === 0 ? 16 : 9}px`,
                } as React.CSSProperties
              }
              className={`grid gap-x-4 leading-tight transition-[color,letter-spacing,translate] duration-300 ease-out sm:grid-cols-[7rem_minmax(0,1fr)] ${
                hit
                  ? "text-ink tracking-[0.06em]"
                  : far
                    ? "depth-far text-[var(--color-far)]"
                    : "text-muted"
              }`}
            >
              <span className="hidden sm:block">
                {formula ? "formula" : "tool"}
              </span>
              <span className="min-w-0">
                <span className="block truncate">
                  <Mark text={s.title} q={q} />
                </span>
                <span className={`block truncate ${hit ? "text-muted" : ""}`}>
                  <span className="sm:hidden">
                    {formula ? "formula" : "tool"}
                    {"  ·  "}
                  </span>
                  {formula ? <Mark text={s.cmd} q={q} /> : s.url}
                  {"  ·  "}
                  <Mark text={s.tags.join(" ")} q={q} />
                </span>
                <span className="sr-only"> — {s.description}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Three fields of dust in two slow wave ribbons, drawn on one canvas. Each
// field drifts at half the speed of the one behind it; nearer fields are
// sparser, larger, brighter. Reduced motion draws one still frame.
const FIELDS = [
  { n: 1600, r: 0.6, alpha: 0.35, speed: 6 },
  { n: 800, r: 0.9, alpha: 0.5, speed: 12 },
  { n: 180, r: 1.3, alpha: 0.7, speed: 24 },
];

function Dust() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Each dot: a position along the ribbon (u, 0..1), which ribbon, and its
    // offset from the centre line. Most hug the curve; a few stray into the
    // void so the edge frays instead of ending on a ruler.
    const dots = FIELDS.map((f) =>
      Array.from({ length: f.n }, () => ({
        u: Math.random(),
        band: Math.random() < 0.55 ? 0 : 1,
        off:
          (Math.random() + Math.random() + Math.random() - 1.5) *
          (Math.random() < 0.85 ? 0.03 : 0.12),
      })),
    );

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 2);
      w = innerWidth;
      h = innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      FIELDS.forEach((f, i) => {
        ctx.fillStyle = `rgba(200,196,186,${f.alpha})`;
        const shift = (t / 1000) * f.speed;
        // Same density at any size: a phone draws a fraction of the field.
        const n = Math.ceil(f.n * Math.min(1, (w * h) / 1_300_000));
        for (const d of dots[i]!.slice(0, n)) {
          const x = (((d.u * w + shift) % w) + w) % w;
          const p = x / w;
          // Ribbon 0 rises across the top right; ribbon 1 sweeps the lower half.
          const y =
            d.band === 0
              ? h * (0.1 + 0.3 * p * p + 0.05 * Math.sin(p * 5 + t / 9000))
              : h * (0.8 - 0.2 * p + 0.06 * Math.sin(p * 4 - t / 11000));
          ctx.fillRect(x, y + d.off * h, f.r * 2, f.r * 2);
        }
      });
    };

    resize();
    addEventListener("resize", resize);
    let raf = 0;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(0);
    } else {
      const loop = (t: number) => {
        draw(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-dvh w-full"
    />
  );
}

function Start() {
  return (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-4">
      <Link
        href="/signup"
        className="border-border text-accent hover:border-accent hover:bg-surface border px-4 py-1.5 transition-colors duration-150 active:bg-black"
      >
        &gt; start a stash
      </Link>
      <p className="text-muted">
        already have one?{" "}
        <Link
          href="/login"
          className="text-ink hover:text-accent underline underline-offset-4 transition-colors duration-150"
        >
          log in
        </Link>
      </p>
    </div>
  );
}

// One specimen row per kind, at the size of the thing itself.
function Specimen({
  kind,
  title,
  line,
  note,
}: {
  kind: string;
  title: string;
  line: string;
  note: string;
}) {
  return (
    <div className="grid gap-x-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
      <span className="text-muted">{kind}</span>
      <div className="min-w-0">
        <p className="v-display text-ink leading-none break-words">{title}</p>
        <p className="text-ink mt-2 break-all">{line}</p>
        <p className="text-muted mt-2 max-w-[52ch]">{note}</p>
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <main className="void bg-bg text-ink relative min-h-dvh overflow-x-clip">
      <Dust />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <span className="flex items-center gap-3">
            <StashMark className="size-6 rounded-[1.4px]" />
            stash
          </span>
          <nav className="flex items-center gap-6">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-ink inline-flex items-center gap-2 transition-colors duration-150"
            >
              <GitHubMark className="size-4" />
              source
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <Link
              href="/login"
              className="text-ink hover:text-accent transition-colors duration-150"
            >
              &gt; log in
            </Link>
          </nav>
        </header>

        <section className="pt-8 sm:pt-12">
          <h1 className="v-hero leading-[0.85] tracking-[-0.01em]">
            save it now.
            <br />
            find it later.
            <span
              aria-hidden="true"
              className="caret bg-accent ml-2 inline-block h-[0.55em] w-[0.32em]"
            />
          </h1>
          <p className="text-muted mt-6 max-w-[40ch]">
            A private place for the links and commands you keep losing. One
            search brings any of them back.
          </p>
          <div className="mt-8">
            <Start />
          </div>
        </section>

        <Demo />

        <section aria-labelledby="how" className="mt-28">
          <h2 id="how" className="v-display leading-none">
            two kinds of thing. one search.
          </h2>
          <div className="mt-12 space-y-14">
            <Specimen
              kind="tool"
              title="squoosh"
              line="squoosh.app"
              note="a tool is a link. paste it and stash fetches the page's preview image to go with it."
            />
            <Specimen
              kind="formula"
              title="undo last commit, keep changes"
              line="git reset --soft HEAD~1"
              note="a formula is a command you keep forgetting, kept exactly as you typed it."
            />
            <Specimen
              kind="search"
              title="any word you remember"
              line="title · description · command · tags"
              note="one box reads all of them at once. tag if you like; you never have to."
            />
          </div>
        </section>

        <section aria-labelledby="yours" className="mt-28 pb-20">
          <h2 id="yours" className="v-display leading-none">
            yours only.
          </h2>
          <p className="text-muted mt-6 max-w-[48ch]">
            No feed, no likes, no followers. A stash follows you between devices
            and nobody else sees it.
          </p>
          <div className="mt-8">
            <Start />
          </div>
        </section>

        <footer className="flex flex-wrap justify-between gap-4 py-6 text-[var(--color-far)]">
          <span>the sample above is made up. your stash starts empty.</span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
            open source on github
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </footer>
      </div>
    </main>
  );
}
