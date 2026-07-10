"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";

import { text } from "~/form";
import { authClient } from "~/server/better-auth/client";
import type { items } from "~/server/db/schema";

import { ThemeToggle } from "../theme-toggle";

import { createItem, deleteItem, updateItem } from "./actions";

type Item = typeof items.$inferSelect;
type Tab = "all" | "tool" | "formula";

type Patch =
  | { type: "add"; item: Item }
  | { type: "update"; item: Item }
  | { type: "delete"; id: string };

const byTitle = (a: Item, b: Item) => a.title.localeCompare(b.title);

function reduce(list: Item[], patch: Patch): Item[] {
  switch (patch.type) {
    case "add":
      return [...list, patch.item].sort(byTitle);
    case "update":
      return list.map((i) => (i.id === patch.item.id ? patch.item : i)).sort(byTitle);
    case "delete":
      return list.filter((i) => i.id !== patch.id);
  }
}

/** The saved URL may still be a bare host until the server normalizes it. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function draftFrom(formData: FormData, id: string, userId: string): Item {
  const kind = text(formData, "kind") === "tool" ? "tool" : "formula";
  return {
    id,
    userId,
    kind,
    title: text(formData, "title"),
    url: kind === "tool" ? text(formData, "url") : null,
    cmd: kind === "formula" ? text(formData, "cmd") : null,
    // The server resolves the real preview and revalidates; until then the row
    // shows its monogram fallback.
    image: null,
    description: text(formData, "description"),
    tags: text(formData, "tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function formDataOf(item: Item): FormData {
  const fd = new FormData();
  fd.set("kind", item.kind);
  fd.set("title", item.title);
  fd.set("description", item.description);
  fd.set("tags", item.tags.join(", "));
  if (item.url) fd.set("url", item.url);
  if (item.cmd) fd.set("cmd", item.cmd);
  return fd;
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const field = `w-full rounded border border-border bg-bg px-3 py-2 text-body text-ink placeholder:text-muted ${focusRing}`;

// One selected treatment for every segmented control (kind tabs, composer
// tool/formula toggle): accent fill plus a ✓ so the state never rides on color
// alone. The tag chips share the same accent+✓ vocabulary in pill form.
const segment = `rounded px-2.5 py-1 text-label transition-colors duration-150 ${focusRing}`;
const segmentOn = "bg-accent font-semibold text-bg";
const segmentOff = "text-muted hover:text-ink";

export function Stash({ items: initial, name }: { items: Item[]; name: string }) {
  const router = useRouter();
  const [list, patch] = useOptimistic(initial, reduce);
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<Item | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  // Where focus goes when the composer closes: the element that opened it.
  const returnFocus = useRef<HTMLElement | null>(null);

  const userId = initial[0]?.userId ?? "";

  function openComposer(item: Item | null = null) {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setEditing(item);
    setComposerOpen(true);
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  function closeComposer() {
    setComposerOpen(false);
    setEditing(null);
    setError(null);
    // A Row's Edit button survives the close and is restorable; the disclosure
    // button unmounts while the composer is open, so its old node is detached —
    // fall back to the freshly-remounted trigger.
    requestAnimationFrame(() => {
      const prev = returnFocus.current;
      if (prev?.isConnected) prev.focus();
      else triggerRef.current?.focus();
    });
  }

  // After an optimistic delete the row unmounts and focus would fall to <body>.
  // Send it to the Undo button — the announced, immediate next action.
  useEffect(() => {
    if (undo) undoRef.current?.focus();
  }, [undo]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // A Thai or Japanese IME fires keydown mid-composition. Typing "ก" must
      // not open the composer.
      if (event.isComposing || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const typing = !!target?.closest("input, textarea, [contenteditable]");

      if (event.key === "Escape") {
        if (composerOpen) closeComposer();
        else if (query) setQuery("");
        else target?.blur();
        return;
      }

      if (typing) return;

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "a") {
        event.preventDefault();
        openComposer();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composerOpen, query]);

  const allTags = useMemo(
    () => [...new Set(list.flatMap((i) => i.tags))].sort((a, b) => a.localeCompare(b)),
    [list],
  );

  // Search runs over title, description, cmd and tags — the fields the spec
  // names. Thai has no word boundaries, so substring matching is the only
  // option; toLowerCase is a harmless no-op on Thai text.
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((item) => {
      if (activeTag && !item.tags.includes(activeTag)) return false;
      if (!q) return true;
      return [item.title, item.description, item.cmd ?? "", ...item.tags].some(
        (field) => field.toLowerCase().includes(q),
      );
    });
  }, [list, query, activeTag]);

  const counts = {
    all: found.length,
    tool: found.filter((i) => i.kind === "tool").length,
    formula: found.filter((i) => i.kind === "formula").length,
  };

  const visible = tab === "all" ? found : found.filter((i) => i.kind === tab);

  async function onSubmit(formData: FormData) {
    setError(null);
    const target = editing;

    if (target) {
      patch({ type: "update", item: draftFrom(formData, target.id, target.userId) });
      const result = await updateItem(target.id, formData);
      if (result.error) return setError(result.error);
    } else {
      patch({ type: "add", item: draftFrom(formData, crypto.randomUUID(), userId) });
      const result = await createItem(formData);
      if (result.error) return setError(result.error);
    }

    closeComposer();
  }

  function onDelete(item: Item) {
    startTransition(async () => {
      patch({ type: "delete", id: item.id });
      const result = await deleteItem(item.id);
      if (result.error) setError(result.error);
      else setUndo(item);
    });
  }

  function onUndo(item: Item) {
    setUndo(null);
    startTransition(async () => {
      // ponytail: undo re-inserts, so the row comes back with a fresh id and
      // timestamp. Soft-delete only if that ever matters.
      patch({ type: "add", item });
      const result = await createItem(formDataOf(item));
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-headline text-ink">Stash</h1>
        <div className="flex items-center gap-3">
          <span className="text-label text-muted">{name}</span>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await authClient.signOut();
                router.push("/login");
                router.refresh();
              })
            }
            className={`text-label text-muted hover:text-ink ${focusRing}`}
          >
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mt-8 flex flex-col gap-3">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, descriptions, commands, tags…"
          aria-label="Search your stash"
          className={field}
        />

        <div className="flex gap-1" role="group" aria-label="Filter by kind">
          {(["all", "tool", "formula"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={`${segment} ${tab === value ? segmentOn : segmentOff}`}
            >
              {tab === value && <span aria-hidden="true">✓ </span>}
              {value === "all" ? "All" : value === "tool" ? "Tools" : "Formulae"}{" "}
              <span
                className={`tabular-nums ${tab === value ? "text-bg" : "text-muted"}`}
              >
                {counts[value]}
              </span>
            </button>
          ))}
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
            {allTags.map((tag) => {
              const on = activeTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setActiveTag(on ? null : tag)}
                  className={`rounded-full border px-2.5 py-0.5 text-label transition-colors duration-150 ${focusRing} ${
                    on
                      ? "border-accent bg-accent text-bg"
                      : "border-border text-muted hover:text-ink"
                  }`}
                >
                  {/* Never color alone: the selected chip also carries a mark. */}
                  {on && <span aria-hidden="true">✓ </span>}
                  {tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Composer
        open={composerOpen}
        editing={editing}
        error={error}
        titleRef={titleRef}
        triggerRef={triggerRef}
        onOpen={() => openComposer()}
        onCancel={closeComposer}
        onSubmit={onSubmit}
      />

      {visible.length === 0 ? (
        <Empty
          hasItems={list.length > 0}
          onAdd={() => openComposer()}
          onClear={() => {
            setQuery("");
            setActiveTag(null);
            setTab("all");
          }}
        />
      ) : (
        <ul className="mt-6 divide-y divide-border border-t border-border">
          {visible.map((item) => (
            <Row
              key={item.id}
              item={item}
              onEdit={() => openComposer(item)}
              onDelete={() => onDelete(item)}
            />
          ))}
        </ul>
      )}

      {/* Delete and undo run with the composer closed, where its inline error
          banner never renders. Surface those failures here instead. */}
      {error && !composerOpen && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-4 mx-auto flex max-w-sm items-center justify-between gap-4 rounded border border-border bg-surface px-4 py-3 shadow-lg"
        >
          <span className="text-label text-ink">
            <span aria-hidden="true">✕ </span>
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
            className={`text-label font-semibold text-accent underline underline-offset-2 ${focusRing}`}
          >
            Dismiss
          </button>
        </div>
      )}

      {undo && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 mx-auto flex max-w-sm items-center justify-between gap-4 rounded border border-border bg-surface px-4 py-3 shadow-lg"
        >
          <span className="text-label text-ink">Deleted “{undo.title}”</span>
          <button
            ref={undoRef}
            type="button"
            onClick={() => onUndo(undo)}
            className={`text-label font-semibold text-accent underline underline-offset-2 ${focusRing}`}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function Composer({
  open,
  editing,
  error,
  titleRef,
  triggerRef,
  onOpen,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  editing: Item | null;
  error: string | null;
  titleRef: React.RefObject<HTMLInputElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [kind, setKind] = useState<"tool" | "formula">("tool");

  useEffect(() => {
    if (open) setKind(editing?.kind ?? "tool");
  }, [open, editing]);

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={onOpen}
        className={`mt-6 flex w-full items-center justify-between rounded border border-dashed border-border px-3 py-2.5 text-left text-body text-muted transition-colors duration-150 hover:border-accent hover:text-ink ${focusRing}`}
      >
        <span>
          <span aria-hidden="true">+ </span>Save a tool or a formula…
        </span>
        <kbd className="rounded border border-border px-1.5 py-0.5 text-label">a</kbd>
      </button>
    );
  }

  return (
    <form
      key={editing?.id ?? "new"}
      action={onSubmit}
      className="mt-6 flex flex-col gap-3 rounded border border-border bg-surface p-4"
    >
      <input type="hidden" name="kind" value={kind} />

      <div className="flex gap-1" role="group" aria-label="What are you saving?">
        {(["tool", "formula"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
            className={`${segment} ${kind === value ? segmentOn : segmentOff}`}
          >
            {kind === value && <span aria-hidden="true">✓ </span>}
            {value === "tool" ? "Tool" : "Formula"}
          </button>
        ))}
      </div>

      <input
        ref={titleRef}
        name="title"
        required
        maxLength={200}
        defaultValue={editing?.title}
        placeholder="Title"
        aria-label="Title"
        className={field}
      />

      {kind === "tool" ? (
        <input
          name="url"
          required
          maxLength={2048}
          defaultValue={editing?.url ?? ""}
          placeholder="ripgrep.dev"
          aria-label="URL"
          className={`${field} font-mono`}
        />
      ) : (
        <textarea
          name="cmd"
          required
          rows={2}
          maxLength={8000}
          defaultValue={editing?.cmd ?? ""}
          placeholder="rg -i --hidden 'TODO'"
          aria-label="Command"
          className={`${field} font-mono`}
        />
      )}

      <input
        name="description"
        maxLength={2000}
        defaultValue={editing?.description}
        placeholder="What it's for"
        aria-label="Description"
        className={field}
      />

      <input
        name="tags"
        defaultValue={editing?.tags.join(", ")}
        placeholder="tags, comma, separated"
        aria-label="Tags, comma separated"
        className={field}
      />

      {error && (
        <p role="alert" className="text-label text-ink">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className={`rounded bg-accent px-4 py-2 text-body text-bg transition-opacity duration-150 hover:opacity-90 ${focusRing}`}
        >
          {editing ? "Save changes" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`rounded px-3 py-2 text-body text-muted hover:text-ink ${focusRing}`}
        >
          Cancel
        </button>
        <span className="ml-auto text-label text-muted">Esc to close</span>
      </div>
    </form>
  );
}

function Row({
  item,
  onEdit,
  onDelete,
}: {
  item: Item;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="row group flex items-start gap-4 py-4">
      <RowTile item={item} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`truncate font-serif text-title leading-thai text-ink underline-offset-2 hover:underline ${focusRing}`}
            >
              {item.title}
            </a>
          ) : (
            <h2 className="truncate font-serif text-title leading-thai text-ink">
              {item.title}
            </h2>
          )}
          {item.url && (
            <span className="shrink-0 text-label text-muted">{hostOf(item.url)}</span>
          )}
        </div>

        {item.cmd && <CommandBlock cmd={item.cmd} />}

        {item.description && (
          <p className="mt-1 text-body leading-thai text-muted">{item.description}</p>
        )}

        {item.tags.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-x-2 text-label text-muted">
            {item.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="row-actions flex shrink-0 gap-1 transition-opacity duration-150">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${item.title}`}
          className={`rounded px-2 py-1 text-label text-muted hover:text-ink ${focusRing}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${item.title}`}
          className={`rounded px-2 py-1 text-label text-muted hover:text-ink ${focusRing}`}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

// A 44px leading tile on every row keeps the title column aligned — the mistake
// the first preview attempt made was giving tools a thumbnail and formulas none.
// Tool: og:image, falling back to a host-letter monogram. Formula: a terminal
// glyph, since a command has no page to show. Decorative throughout — the title
// carries the meaning, so the tile is aria-hidden.
const tileBase =
  "grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded border border-border bg-surface";

function RowTile({ item }: { item: Item }) {
  const [broken, setBroken] = useState(false);

  if (item.kind === "formula") {
    return (
      <div className={`${tileBase} font-mono text-label text-muted`} aria-hidden="true">
        $_
      </div>
    );
  }

  if (item.image && !broken) {
    return (
      <div className={tileBase}>
        {/* eslint-disable-next-line @next/next/no-img-element -- previews come
            from arbitrary bookmarked hosts that can't be enumerated for
            next/image's remotePatterns; a plain <img> loads from the origin. */}
        <img
          src={item.image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          width={44}
          height={44}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const letter = (hostOf(item.url ?? item.title)[0] ?? "•").toUpperCase();
  return (
    <div className={`${tileBase} font-serif text-title text-ink`} aria-hidden="true">
      {letter}
    </div>
  );
}

function CommandBlock({ cmd }: { cmd: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(cmd);
      setState("copied");
    } catch {
      // Clipboard rejects on denied permission and does not exist outside a
      // secure context.
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="mt-1.5 flex items-start gap-2 rounded bg-surface px-3 py-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-body text-ink">
        {cmd}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy command: ${cmd}`}
        className={`shrink-0 rounded px-1.5 py-0.5 text-label text-muted hover:text-ink ${focusRing}`}
      >
        {/* Never color alone: the state is a word and a mark, not a green flash. */}
        {state === "copied" ? "✓ Copied" : state === "failed" ? "✕ Failed" : "Copy"}
      </button>
    </div>
  );
}

function Empty({
  hasItems,
  onAdd,
  onClear,
}: {
  hasItems: boolean;
  onAdd: () => void;
  onClear: () => void;
}) {
  if (hasItems) {
    return (
      <div className="mt-16 text-center">
        <p className="font-serif text-title text-ink">Nothing matches that.</p>
        <button
          type="button"
          onClick={onClear}
          className={`mt-2 text-label text-accent underline underline-offset-2 ${focusRing}`}
        >
          Clear the filters
        </button>
      </div>
    );
  }

  return (
    <div className="mt-16 max-w-md">
      <p className="font-serif text-title text-ink">Your stash is empty.</p>
      <p className="mt-2 text-body text-muted">
        Two things live here. A <strong className="font-semibold text-ink">tool</strong>{" "}
        is a link you keep losing. A{" "}
        <strong className="font-semibold text-ink">formula</strong> is a command you keep
        re-deriving.
      </p>
      <p className="mt-4 text-body text-muted">
        Press <kbd className="rounded border border-border px-1.5 py-0.5 text-label">a</kbd>{" "}
        to save one, <kbd className="rounded border border-border px-1.5 py-0.5 text-label">/</kbd>{" "}
        to search once you have a few.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className={`mt-6 rounded bg-accent px-4 py-2 text-body text-bg transition-opacity duration-150 hover:opacity-90 ${focusRing}`}
      >
        Save your first
      </button>
    </div>
  );
}
