"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
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
      return list
        .map((i) => (i.id === patch.item.id ? patch.item : i))
        .sort(byTitle);
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

// Sidebar section label. Left padding matches the filter rows' so the heading
// sits flush with the labels beneath it.
const railHeading = "px-2.5 text-label font-medium text-muted lg:px-2";

// Tailwind's lg breakpoint (64rem). It gates the master–detail split: at or
// above it there's room for a preview pane beside the list, so rows become lean
// selectors; below it there's no room, so rows carry everything inline.
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 64rem)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 64rem)").matches,
    () => false, // server assumes narrow; desktop swaps in after hydration
  );
}

export function Stash({
  items: initial,
  name,
}: {
  items: Item[];
  name: string;
}) {
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const wide = useWide();

  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  // The desktop preview pane. Enter on a selected row jumps focus here, to the
  // found item's real actions, instead of tabbing past every remaining row.
  const paneRef = useRef<HTMLElement>(null);
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
    () =>
      [...new Set(list.flatMap((i) => i.tags))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [list],
  );

  // Search runs over title, description, cmd and tags — the fields the spec
  // names. Thai has no word boundaries, so substring matching is the only
  // option; toLowerCase is a harmless no-op on Thai text. Kind and tag are
  // facets layered on top; the rail counts read off `searched`, so every count
  // answers "how many match this search" and stays put no matter which facet is
  // active.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) =>
      [item.title, item.description, item.cmd ?? "", ...item.tags].some(
        (field) => field.toLowerCase().includes(q),
      ),
    );
  }, [list, query]);

  const kindCounts: Record<Tab, number> = {
    all: searched.length,
    tool: searched.filter((i) => i.kind === "tool").length,
    formula: searched.filter((i) => i.kind === "formula").length,
  };

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of searched)
      for (const t of item.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [searched]);

  // The rail shows the tags the current search can still reach, plus the active
  // one so a selection is always clearable even after a search excludes it.
  const railTags = allTags.filter(
    (t) => (tagCounts.get(t) ?? 0) > 0 || t === activeTag,
  );

  const visible = useMemo(
    () =>
      searched.filter(
        (i) =>
          (tab === "all" || i.kind === tab) &&
          (!activeTag || i.tags.includes(activeTag)),
      ),
    [searched, tab, activeTag],
  );

  // Two kinds, two treatments: tools stay master rows that drive the preview
  // pane; formulae render as self-contained terminal cards (a command is its
  // own content, so it shows in full inline). Splitting the visible list this
  // way is the whole "separate formulae from tools" ask.
  const tools = useMemo(
    () => visible.filter((i) => i.kind === "tool"),
    [visible],
  );
  const formulae = useMemo(
    () => visible.filter((i) => i.kind === "formula"),
    [visible],
  );

  // The item shown in the preview pane. Only tools are selectable — a formula's
  // terminal card already shows everything the pane would — so the pane resolves
  // from `tools`, falling back to the top tool when the selection is filtered
  // out, deleted, or unset. Only exists on desktop; the pane has no room below lg.
  const active = wide
    ? (tools.find((i) => i.id === selectedId) ?? tools[0] ?? null)
    : null;

  async function onSubmit(formData: FormData) {
    setError(null);
    const target = editing;

    if (target) {
      patch({
        type: "update",
        item: draftFrom(formData, target.id, target.userId),
      });
      const result = await updateItem(target.id, formData);
      if (result.error) return setError(result.error);
    } else {
      patch({
        type: "add",
        item: draftFrom(formData, crypto.randomUUID(), userId),
      });
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
    <div className="mx-auto max-w-none px-4 py-10 sm:px-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-headline text-ink font-serif">Stash</h1>
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

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-10">
        <FilterRail
          tab={tab}
          onTab={setTab}
          kindCounts={kindCounts}
          tags={railTags}
          tagCounts={tagCounts}
          activeTag={activeTag}
          onTag={setActiveTag}
        />

        <main className="min-w-0 flex-1">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, descriptions, commands, tags…"
            aria-label="Search your stash"
            className={field}
          />

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
            <div className="mt-6 flex flex-col gap-10">
              {tools.length > 0 && (
                <section>
                  {tab === "all" && (
                    <SectionHeading count={tools.length}>Tools</SectionHeading>
                  )}
                  <ul className="divide-border border-border divide-y border-t">
                    {tools.map((item) => (
                      <Row
                        key={item.id}
                        item={item}
                        selectable={wide}
                        selected={active?.id === item.id}
                        onSelect={() => setSelectedId(item.id)}
                        onActivate={() =>
                          paneRef.current
                            ?.querySelector<HTMLElement>("a, button")
                            ?.focus()
                        }
                        onEdit={() => openComposer(item)}
                        onDelete={() => onDelete(item)}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {formulae.length > 0 && (
                <section>
                  {tab === "all" && (
                    <SectionHeading count={formulae.length}>
                      Formulae
                    </SectionHeading>
                  )}
                  <ul className="flex flex-col gap-3">
                    {formulae.map((item) => (
                      <FormulaCard
                        key={item.id}
                        item={item}
                        onEdit={() => openComposer(item)}
                        onDelete={() => onDelete(item)}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </main>

        {active && (
          <DetailPane
            item={active}
            containerRef={paneRef}
            onEdit={() => openComposer(active)}
            onDelete={() => onDelete(active)}
          />
        )}
      </div>

      {/* Delete and undo run with the composer closed, where its inline error
          banner never renders. Surface those failures here instead. */}
      {error && !composerOpen && (
        <div
          role="alert"
          className="border-border bg-surface fixed inset-x-4 bottom-4 mx-auto flex max-w-sm items-center justify-between gap-4 rounded border px-4 py-3 shadow-lg"
        >
          <span className="text-label text-ink">
            <span aria-hidden="true">✕ </span>
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
            className={`text-label text-accent font-semibold underline underline-offset-2 ${focusRing}`}
          >
            Dismiss
          </button>
        </div>
      )}

      {undo && (
        <div
          role="status"
          className="border-border bg-surface fixed inset-x-4 bottom-4 mx-auto flex max-w-sm items-center justify-between gap-4 rounded border px-4 py-3 shadow-lg"
        >
          <span className="text-label text-ink">Deleted “{undo.title}”</span>
          <button
            ref={undoRef}
            type="button"
            onClick={() => onUndo(undo)}
            className={`text-label text-accent font-semibold underline underline-offset-2 ${focusRing}`}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

// The card-catalog drawer: kinds and tags as one quiet filter list. A vertical
// rail on desktop (where it earns the width a stretched search box couldn't);
// above the list, wrapping into chips, on narrow screens. Accent + ✓ marks the
// one active filter — never color alone, never more than a sliver of the screen.
function FilterRail({
  tab,
  onTab,
  kindCounts,
  tags,
  tagCounts,
  activeTag,
  onTag,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  kindCounts: Record<Tab, number>;
  tags: string[];
  tagCounts: Map<string, number>;
  activeTag: string | null;
  onTag: (tag: string | null) => void;
}) {
  const kinds: { value: Tab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "tool", label: "Tools" },
    { value: "formula", label: "Formulae" },
  ];

  return (
    <aside className="lg:w-52 lg:shrink-0">
      {/* ponytail: sticky pins the rail; a tag list taller than the viewport
          just scrolls with the page. Add internal overflow only if a stash ever
          grows hundreds of tags. */}
      {/* Quiet sans section labels — the app's voice naming the two axes. Not
          the tracked-uppercase eyebrow the bans forbid: a filter rail with a
          Kind and a Tags group is standard product furniture, so they stay
          sentence-case and muted, and label their group via aria-labelledby. */}
      <nav className="flex flex-col gap-5 lg:sticky lg:top-10 lg:gap-6">
        <div>
          <h2 id="rail-kind" className={railHeading}>
            Kind
          </h2>
          <div
            role="group"
            aria-labelledby="rail-kind"
            className="mt-1.5 flex flex-wrap gap-1 lg:flex-col lg:gap-0.5"
          >
            {kinds.map(({ value, label }) => (
              <FilterRow
                key={value}
                label={label}
                count={kindCounts[value]}
                active={tab === value}
                onClick={() => onTab(value)}
              />
            ))}
          </div>
        </div>

        {tags.length > 0 && (
          <div>
            <h2 id="rail-tags" className={railHeading}>
              Tags
            </h2>
            <div
              role="group"
              aria-labelledby="rail-tags"
              className="mt-1.5 flex flex-wrap gap-1 lg:flex-col lg:gap-0.5"
            >
              {tags.map((tag) => {
                const on = activeTag === tag;
                return (
                  <FilterRow
                    key={tag}
                    label={tag}
                    count={tagCounts.get(tag) ?? 0}
                    active={on}
                    onClick={() => onTag(on ? null : tag)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}

// One filter atom for both sections: an inline pill on mobile, a full-width row
// with a right-aligned count on desktop. The count is metadata, so it stays
// muted even when the label lights up.
function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`text-label flex items-center gap-2 rounded px-2.5 py-1 transition-colors duration-150 lg:w-full lg:justify-between lg:px-2 lg:py-1.5 ${focusRing} ${
        active
          ? "bg-accent text-bg font-semibold"
          : "text-muted hover:bg-surface hover:text-ink"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1">
        {active && <span aria-hidden="true">✓</span>}
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`shrink-0 tabular-nums ${active ? "text-bg" : "text-muted"}`}
      >
        {count}
      </span>
    </button>
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
        className={`border-border text-body text-muted hover:border-accent hover:text-ink mt-6 flex w-full items-center justify-between rounded border border-dashed px-3 py-2.5 text-left transition-colors duration-150 ${focusRing}`}
      >
        <span>
          <span aria-hidden="true">+ </span>Save a tool or a formula…
        </span>
        <kbd className="border-border text-label rounded border px-1.5 py-0.5">
          a
        </kbd>
      </button>
    );
  }

  return (
    <form
      key={editing?.id ?? "new"}
      action={onSubmit}
      className="border-border bg-surface mt-6 flex flex-col gap-3 rounded border p-4"
    >
      <input type="hidden" name="kind" value={kind} />

      <div
        className="flex gap-1"
        role="group"
        aria-label="What are you saving?"
      >
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
          className={`bg-accent text-body text-bg rounded px-4 py-2 transition-opacity duration-150 hover:opacity-90 ${focusRing}`}
        >
          {editing ? "Save changes" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`text-body text-muted hover:text-ink rounded px-3 py-2 ${focusRing}`}
        >
          Cancel
        </button>
        <span className="text-label text-muted ml-auto">Esc to close</span>
      </div>
    </form>
  );
}

function Row({
  item,
  selectable,
  selected,
  onSelect,
  onActivate,
  onEdit,
  onDelete,
}: {
  item: Item;
  selectable: boolean;
  selected: boolean;
  onSelect: () => void;
  onActivate?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Desktop master: a lean summary that drives the preview pane. One button per
  // row and no nested links — Open/Copy/Edit/Delete live in the pane — so a
  // screen reader hears exactly one "select" control per row, and the title
  // that truncates here is shown in full over there.
  if (selectable) {
    // The keyboard retrieval path. Focus follows selection (onFocus selects, so
    // ↑/↓ scrub the preview as they walk the list); Enter hands focus to the
    // pane's first action — Open for a tool, Copy for a formula — so opening the
    // found thing is one keystroke, not a tab through every remaining row.
    // ponytail: ↑/↓ don't wrap and Edit/Delete still trail the pane in tab
    // order; add wrap / an "o to open" accelerator if daily use asks for it.
    function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const li = event.currentTarget.closest("li");
        const next =
          event.key === "ArrowDown"
            ? li?.nextElementSibling
            : li?.previousElementSibling;
        next?.querySelector("button")?.focus();
      } else if (event.key === "Enter" && onActivate) {
        event.preventDefault();
        onActivate();
      }
    }

    return (
      <li>
        <button
          type="button"
          onClick={onSelect}
          onFocus={onSelect}
          onKeyDown={onKeyDown}
          aria-current={selected ? "true" : undefined}
          className={`flex w-full items-start gap-4 py-4 text-left transition-colors duration-150 ${focusRing} ${
            selected ? "bg-surface" : "hover:bg-surface"
          }`}
        >
          <RowTile item={item} />

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-title leading-thai text-ink truncate font-serif ${
                  selected ? "font-semibold" : ""
                }`}
              >
                {item.title}
              </span>
              {item.url && (
                <span className="text-label text-muted shrink-0">
                  {hostOf(item.url)}
                </span>
              )}
            </div>

            {item.tags.length > 0 && (
              <ul className="text-label text-muted mt-1.5 flex flex-wrap gap-x-2">
                {item.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Selection is never color alone: a chevron appears (shape) and turns
              accent (color), and aria-current carries it to the screen reader. */}
          <span
            aria-hidden="true"
            className={`text-title self-center ${
              selected ? "text-accent" : "text-transparent"
            }`}
          >
            ›
          </span>
        </button>
      </li>
    );
  }

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
              className={`text-title leading-thai text-ink truncate font-serif underline-offset-2 hover:underline ${focusRing}`}
            >
              {item.title}
            </a>
          ) : (
            <h2 className="text-title leading-thai text-ink truncate font-serif">
              {item.title}
            </h2>
          )}
          {item.url && (
            <span className="text-label text-muted shrink-0">
              {hostOf(item.url)}
            </span>
          )}
        </div>

        {item.cmd && <CommandBlock cmd={item.cmd} />}

        {item.description && (
          <p className="text-body leading-thai text-muted mt-1">
            {item.description}
          </p>
        )}

        {item.tags.length > 0 && (
          <ul className="text-label text-muted mt-1.5 flex flex-wrap gap-x-2">
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
          className={`text-label text-muted hover:text-ink rounded px-2 py-1 ${focusRing}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${item.title}`}
          className={`text-label text-muted hover:text-ink rounded px-2 py-1 ${focusRing}`}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

// A landscape 112×64 leading tile on every row keeps the title column aligned —
// the mistake the first preview attempt made was giving tools a thumbnail and
// formulas none. Sized to the og:image's ~1.9:1 aspect: a square crop reduced
// the preview to an unreadable center sliver, so a page was no longer
// recognizable at a glance. Tool: og:image, falling back to a host-letter
// monogram. Formula: a terminal glyph, since a command has no page to show.
// Decorative throughout — the title carries the meaning, so the tile is
// aria-hidden.
const tileBase =
  "grid h-16 w-28 shrink-0 place-items-center overflow-hidden rounded border border-border bg-surface";

function RowTile({ item }: { item: Item }) {
  const [broken, setBroken] = useState(false);

  if (item.kind === "formula") {
    return (
      <div
        className={`${tileBase} text-title text-muted font-mono`}
        aria-hidden="true"
      >
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
          width={112}
          height={64}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const letter = (hostOf(item.url ?? item.title)[0] ?? "•").toUpperCase();
  return (
    <div
      className={`${tileBase} text-headline text-ink font-serif`}
      aria-hidden="true"
    >
      {letter}
    </div>
  );
}

// The preview pane — the right column of the desktop master–detail. It shows
// the selected item at full size: the og:image the row can only thumbnail, the
// untruncated title, and the primary action (open a tool, copy a formula). This
// is what earns the second column its width. A rail with no real job here would
// be the SaaS filler the product bans, so the pane holds the actions the lean
// desktop rows dropped. Hidden below lg, where there's no room for it.
function DetailPane({
  item,
  containerRef,
  onEdit,
  onDelete,
}: {
  item: Item;
  containerRef: React.RefObject<HTMLElement | null>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <aside
      ref={containerRef}
      aria-label="Preview"
      aria-live="polite"
      className="hidden lg:sticky lg:top-10 lg:flex lg:w-96 lg:shrink-0 lg:flex-col lg:gap-4"
    >
      <PreviewTile item={item} />

      <h2 className="text-headline leading-thai text-ink font-serif text-balance">
        {item.title}
      </h2>

      {item.url && (
        <div className="flex items-center gap-3">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`bg-accent text-body text-bg rounded px-4 py-2 transition-opacity duration-150 hover:opacity-90 ${focusRing}`}
          >
            Open <span aria-hidden="true">↗</span>
          </a>
          <span className="text-label text-muted truncate">
            {hostOf(item.url)}
          </span>
        </div>
      )}

      {item.cmd && <CommandBlock cmd={item.cmd} />}

      {item.description && (
        <p className="text-body leading-thai text-ink">{item.description}</p>
      )}

      {item.tags.length > 0 && (
        <ul className="text-label text-muted flex flex-wrap gap-x-2 gap-y-1">
          {item.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}

      <div className="mt-1 flex gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${item.title}`}
          className={`text-label text-muted hover:text-ink rounded px-2 py-1 ${focusRing}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${item.title}`}
          className={`text-label text-muted hover:text-ink rounded px-2 py-1 ${focusRing}`}
        >
          Delete
        </button>
      </div>
    </aside>
  );
}

// Full-size counterpart to RowTile: the og:image at a readable size, or the same
// monogram / terminal-glyph fallbacks scaled up to the pane's ~1.9:1 frame.
function PreviewTile({ item }: { item: Item }) {
  const [broken, setBroken] = useState(false);
  const base =
    "grid aspect-[1.9] w-full place-items-center overflow-hidden rounded border border-border bg-surface";

  if (item.kind === "formula") {
    return (
      <div
        className={`${base} text-display text-muted font-mono`}
        aria-hidden="true"
      >
        $_
      </div>
    );
  }

  if (item.image && !broken) {
    return (
      <div className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary
            bookmarked hosts can't be enumerated for next/image; see RowTile. */}
        <img
          src={item.image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const letter = (hostOf(item.url ?? item.title)[0] ?? "•").toUpperCase();
  return (
    <div
      className={`${base} text-display text-ink font-serif`}
      aria-hidden="true"
    >
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
    <div className="bg-surface mt-1.5 flex items-start gap-2 rounded px-3 py-2">
      <code className="text-body text-ink min-w-0 flex-1 overflow-x-auto font-mono whitespace-pre">
        {cmd}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy command: ${cmd}`}
        className={`text-label text-muted hover:text-ink shrink-0 rounded px-1.5 py-0.5 ${focusRing}`}
      >
        {/* Never color alone: the state is a word and a mark, not a green flash. */}
        {state === "copied"
          ? "✓ Copied"
          : state === "failed"
            ? "✕ Failed"
            : "Copy"}
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
        <p className="text-title text-ink font-serif">Nothing matches that.</p>
        <button
          type="button"
          onClick={onClear}
          className={`text-label text-accent mt-2 underline underline-offset-2 ${focusRing}`}
        >
          Clear the filters
        </button>
      </div>
    );
  }

  return (
    <div className="mt-16 max-w-md">
      <p className="text-title text-ink font-serif">Your stash is empty.</p>
      <p className="text-body text-muted mt-2">
        Two things live here. A{" "}
        <strong className="text-ink font-semibold">tool</strong> is a link you
        keep losing. A{" "}
        <strong className="text-ink font-semibold">formula</strong> is a command
        you keep re-deriving.
      </p>
      <p className="text-body text-muted mt-4">
        Press{" "}
        <kbd className="border-border text-label rounded border px-1.5 py-0.5">
          a
        </kbd>{" "}
        to save one,{" "}
        <kbd className="border-border text-label rounded border px-1.5 py-0.5">
          /
        </kbd>{" "}
        to search once you have a few.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className={`bg-accent text-body text-bg mt-6 rounded px-4 py-2 transition-opacity duration-150 hover:opacity-90 ${focusRing}`}
      >
        Save your first
      </button>
    </div>
  );
}

// The one label that separates the two kinds in the "All" view. Sentence-case
// muted sans with a count — the same quiet voice as the rail's "Kind"/"Tags"
// headings, deliberately not the tracked-uppercase eyebrow the bans forbid.
function SectionHeading({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border mb-4 flex items-baseline gap-2 border-b pb-2">
      <h2 className="text-label text-muted font-medium">{children}</h2>
      <span className="text-label text-muted tabular-nums">{count}</span>
    </div>
  );
}

// Clipboard write with a two-second, word-plus-mark confirmation (never a bare
// green flash — state never rides on color alone). Themeable via className so it
// reads on both the light command box and the dark terminal card.
function CopyButton({ text, className }: { text: string; className: string }) {
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

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy command: ${text}`}
      className={className}
    >
      {state === "copied"
        ? "✓ Copied"
        : state === "failed"
          ? "✕ Failed"
          : "Copy"}
    </button>
  );
}

// A formula rendered as what it is: a line you run in a console. Always-dark
// terminal chrome (the term-* tokens don't flip with the app theme), a teal ❯
// prompt, the command in mono, and a copy button — the retrieval act for a
// formula. Three monochrome dots read as a window without dragging the garish
// traffic-light primaries into a cool-neutral palette. Edit/Delete ride the
// same hover-reveal .row-actions as a tool row; on touch they stay visible.
// ponytail: with formulae routed here, the formula branches in Row/RowTile/
// DetailPane/CommandBlock now only ever see tools. Left in place, not deleted —
// they still correctly render a formula if anything ever selects one.
function FormulaCard({
  item,
  onEdit,
  onDelete,
}: {
  item: Item;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="row group border-term-border overflow-hidden rounded-lg border">
      <div className="bg-term-surface flex items-center gap-3 px-3 py-2">
        <span aria-hidden="true" className="flex shrink-0 gap-1.5">
          <span className="bg-term-border size-2.5 rounded-full" />
          <span className="bg-term-border size-2.5 rounded-full" />
          <span className="bg-term-border size-2.5 rounded-full" />
        </span>
        <h2 className="text-label text-term-muted min-w-0 flex-1 truncate font-mono">
          {item.title}
        </h2>
        <div className="row-actions flex shrink-0 gap-1 transition-opacity duration-150">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${item.title}`}
            className="text-label text-term-muted hover:text-term-ink focus-visible:outline-term-accent rounded px-2 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${item.title}`}
            className="text-label text-term-muted hover:text-term-ink focus-visible:outline-term-accent rounded px-2 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="bg-term-bg px-3 py-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="text-term-accent shrink-0 font-mono leading-relaxed select-none"
          >
            ❯
          </span>
          <code className="text-body text-term-ink min-w-0 flex-1 overflow-x-auto font-mono leading-relaxed whitespace-pre">
            {item.cmd}
          </code>
          <CopyButton
            text={item.cmd ?? ""}
            className="text-label text-term-muted hover:text-term-ink focus-visible:outline-term-accent shrink-0 rounded px-1.5 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>

        {item.description && (
          <p className="text-label text-term-muted mt-2 pl-6 font-mono">
            # {item.description}
          </p>
        )}

        {item.tags.length > 0 && (
          <ul className="text-label text-term-muted mt-2 flex flex-wrap gap-x-3 pl-6 font-mono">
            {item.tags.map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
