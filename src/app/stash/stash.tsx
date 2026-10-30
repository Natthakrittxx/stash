"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { looksLikeLink, text, titleOr } from "~/form";
import {
  areaOf,
  type Bounds,
  coordsFromUrl,
  distance,
  isMapsLink,
  nameFromUrl,
  parseLink,
  within,
} from "~/maps";
import { authClient } from "~/server/better-auth/client";
import type { items } from "~/server/db/schema";

import { CopyButton } from "../copy-button";
import { GitHubMark, REPO_URL } from "../github-mark";
import { StashMark } from "../stash-mark";
import { ThemeToggle } from "../theme-toggle";

import {
  createCollection,
  createItem,
  deleteCollection,
  deleteItem,
  setMembership,
  setPlacePin,
  updateItem,
} from "./actions";
import type { Point } from "./map";
import {
  CollectionsButton,
  CollectionsPanel,
  type Filing,
  formatDistance,
  IndexHeading,
  NewCollection,
  PlaceCard,
  PlaceRow,
  UnpinnedRow,
} from "./places";
import { field, fieldFocus, focusRing, langOf, quietButton, touch } from "./ui";

// MapLibre is ~1MB and only the Places view draws a map: load it there.
const PlaceMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => <div className="bg-surface h-full w-full" />,
});

// The columns stash/page.tsx selects: what the list renders, nothing more.
export type Item = Pick<
  typeof items.$inferSelect,
  | "id"
  | "kind"
  | "title"
  | "url"
  | "cmd"
  | "image"
  | "description"
  | "tags"
  | "lat"
  | "lng"
  | "address"
>;
export type Collection = { id: string; name: string; itemIds: string[] };
type Tab = "all" | "tool" | "formula" | "place";
// What a fresh composer opens with, field by field: a remembered draft, a
// no-match prefill, or the item being edited.
type Draft = Partial<
  Record<"kind" | "url" | "cmd" | "title" | "description" | "tags", string>
>;
type Failure = { message: string; field?: string };

type Patch =
  | { type: "add"; item: Item }
  | { type: "update"; item: Item }
  | { type: "delete"; id: string };

const byTitle = (a: Item, b: Item) => a.title.localeCompare(b.title);

type FolderPatch =
  | { type: "delete"; id: string }
  | { type: "member"; collectionId: string; itemId: string; member: boolean };

function reduceFolders(list: Collection[], patch: FolderPatch): Collection[] {
  if (patch.type === "delete") return list.filter((c) => c.id !== patch.id);
  return list.map((c) =>
    c.id !== patch.collectionId
      ? c
      : {
          ...c,
          itemIds: patch.member
            ? [...new Set([...c.itemIds, patch.itemId])]
            : c.itemIds.filter((id) => id !== patch.itemId),
        },
  );
}

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

function draftFrom(formData: FormData, id: string): Item {
  const raw = text(formData, "kind");
  const kind = raw === "tool" || raw === "place" ? raw : "formula";
  const url = kind === "formula" ? null : text(formData, "url");
  // A full maps link carries its pin and name, so a new place lands on the map
  // at once; a short link waits for the server to follow it.
  const link = kind === "place" && url ? parseLink(url) : null;
  const pin = link ? coordsFromUrl(link) : null;
  return {
    id,
    kind,
    title: titleOr(
      text(formData, "title").trim() ||
        ((link ? nameFromUrl(link) : null) ?? ""),
      url,
      kind === "formula" ? text(formData, "cmd") : null,
    ),
    url,
    cmd: kind === "formula" ? text(formData, "cmd") : null,
    lat: pin?.lat ?? null,
    lng: pin?.lng ?? null,
    address: null,
    // The server resolves the real preview and revalidates; until then the row
    // shows its monogram fallback.
    image: null,
    description: text(formData, "description"),
    tags: text(formData, "tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

// An undo re-creates the item as it was: its pin, which may have been set by
// hand, and the collections it was filed in.
function formDataOf(item: Item, collectionIds: string[] = []): FormData {
  const fd = new FormData();
  if (item.lat !== null && item.lng !== null) {
    fd.set("lat", String(item.lat));
    fd.set("lng", String(item.lng));
  }
  for (const id of collectionIds) fd.append("collection", id);
  fd.set("kind", item.kind);
  fd.set("title", item.title);
  fd.set("description", item.description);
  fd.set("tags", item.tags.join(", "));
  if (item.url) fd.set("url", item.url);
  if (item.cmd) fd.set("cmd", item.cmd);
  return fd;
}

function draftOf(item: Item): Draft {
  return {
    kind: item.kind,
    url: item.url ?? "",
    cmd: item.cmd ?? "",
    title: item.title,
    description: item.description,
    tags: item.tags.join(", "),
  };
}

const fieldLabel = "flex flex-col gap-1 text-label font-medium text-ink";
// Search is the product's core act ("re-finding is the product"). It leads by
// place and width, not size: body text like every field. pr-10 keeps a gutter
// for the idle `/` hint (and the native search-clear once you type).
const search = `w-full rounded border border-field bg-bg py-2.5 pr-10 pl-3 text-body pointer-coarse:text-base text-ink placeholder:text-muted ${fieldFocus}`;
const toast =
  "border-border bg-surface flex items-center justify-between gap-4 rounded border px-4 py-3 shadow-lg";

// One selected treatment for every segmented control (kind tabs, composer
// tool/formula toggle): accent fill (`bg-accent text-bg`) plus a reserved ✓ slot
// so the state never rides on color alone and selection never reflows the pair.
// The tag chips share the same accent+✓ vocabulary in pill form.
const segment = `rounded px-2.5 py-1 text-label font-medium transition-colors duration-150 ${touch} ${focusRing}`;
const segmentOff = "text-muted hover:text-ink";

// Sidebar section label. Left padding matches the filter rows' so the heading
// sits flush with the labels beneath it.
const railHeading = "px-2 text-label font-semibold text-muted";

const cookie = (name: string, value: string) =>
  (document.cookie = `${name}=${value};path=/;max-age=31536000;samesite=lax`);

// Tailwind's lg breakpoint (64rem). It gates the master–detail split: at or
// above it there's room for a preview pane beside the list, so rows become lean
// selectors; below it there's no room, so rows carry everything inline.
const wideQuery = "(min-width: 64rem)";

function useWide(initial: boolean) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(wideQuery);
      const onChange = () => {
        // Keep the server's hint current for the next load (see layout.tsx).
        cookie("wide", mq.matches ? "1" : "0");
        cb();
      };
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(wideQuery).matches,
    // The layout's head script records the viewport in a cookie, so the server
    // renders the layout this browser keeps. A first visit assumes narrow.
    () => initial,
  );
}

export function Stash({
  items: initial,
  collections: initialCollections,
  name,
  initialWide,
  initialRailOpen,
}: {
  items: Item[];
  collections: Collection[];
  name: string;
  initialWide: boolean;
  initialRailOpen: boolean;
}) {
  const router = useRouter();
  const [list, patch] = useOptimistic(initial, reduce);
  const [, startTransition] = useTransition();
  // Its own transition, so a delete in flight never disables Sign out.
  const [signingOut, startSignOut] = useTransition();

  const [query, setQuery] = useState("");
  // Typing stays instant; the filter over every item renders when it can.
  const deferredQuery = useDeferredValue(query);
  const [tab, setTab] = useState<Tab>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // One open composer at a time. `key` remounts the form per opening, so its
  // kind and fields always start from `defaults`, never from the last session.
  const [composer, setComposer] = useState<{
    key: number;
    editing: Item | null;
    defaults: Draft;
    restored: boolean;
  } | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const [undo, setUndo] = useState<Item | null>(null);
  const [saved, setSaved] = useState<{ title: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Places. A collection is where you are inside Places, like a tab.
  const [folders, patchFolders] = useOptimistic(
    initialCollections,
    reduceFolders,
  );
  const [collectionId, setCollectionId] = useState<string | null>(null);
  // The place whose card is open on the map. Separate from the selection, so
  // Esc can close the card while its pin stays selected.
  const [cardFor, setCardFor] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // The visitor's own pan or zoom, tagged with the filters it was made under:
  // a new search, tag or collection refits the map and drops it.
  const [view, setView] = useState<Bounds | null>(null);
  const [showAll, setShowAll] = useState(0);
  const [user, setUser] = useState<Point | null>(null);
  const [fitTo, setFitTo] = useState<{
    base: string;
    key: string;
    points: Point[];
  } | null>(null);
  const [locating, setLocating] = useState(false);
  // The place waiting for "Set location" to get its pin from a map click.
  const [dropping, setDropping] = useState<Item | null>(null);
  const undoCollections = useRef<string[]>([]);

  const wide = useWide(initialWide);

  // Desktop rail open/collapsed, remembered per browser in a cookie the server
  // reads, so a collapsed rail never renders open for a frame. Mobile uses the
  // drawer instead, opened on demand.
  const [railOpen, setRailOpen] = useState(initialRailOpen);
  const drawerRef = useRef<HTMLDialogElement>(null);

  function toggleFilters() {
    if (!wide) return drawerRef.current?.showModal();
    const next = !railOpen;
    setRailOpen(next);
    cookie("rail", next ? "open" : "closed");
  }

  const searchRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  // The desktop preview pane. Enter on a selected row jumps focus here, to the
  // found item's real actions, instead of tabbing past every remaining row.
  const paneRef = useRef<HTMLElement>(null);
  // Where focus goes when the composer closes: the element that opened it.
  const returnFocus = useRef<HTMLElement | null>(null);
  // An unsaved new item survives Esc/Cancel and comes back on the next open.
  const draftRef = useRef<Draft>({});
  const composerKey = useRef(0);

  function keepDraft() {
    const form = formRef.current;
    if (!form || composer?.editing) return;
    const fields = [...new FormData(form)].filter(
      (e): e is [string, string] => typeof e[1] === "string" && !!e[1].trim(),
    );
    // The kind alone isn't a draft; it only rides along with real input.
    draftRef.current = fields.some(([k]) => k !== "kind")
      ? Object.fromEntries(fields)
      : {};
  }

  function openComposer(item: Item | null = null, prefill?: Draft) {
    // Already composing something new: just put the cursor back.
    if (composer && !composer.editing && !item && !prefill) {
      firstRef.current?.focus();
      return;
    }
    if (composer) keepDraft();
    else returnFocus.current = document.activeElement as HTMLElement | null;
    const restored =
      !item && !prefill && Object.keys(draftRef.current).length > 0;
    setError(null);
    setComposer({
      key: ++composerKey.current,
      editing: item,
      defaults: item ? draftOf(item) : (prefill ?? draftRef.current),
      restored,
    });
  }

  function closeComposer(done = false) {
    if (!done) keepDraft();
    else if (!composer?.editing) draftRef.current = {};
    setComposer(null);
    setError(null);
    // A Row's Edit button survives the close and is restorable; the disclosure
    // button unmounts while the composer is open, so its old node is detached —
    // fall back to the freshly-remounted trigger (or search, on an empty stash).
    requestAnimationFrame(() => {
      const prev = returnFocus.current;
      // Opened with `a` from nowhere, the "opener" is <body>: use the trigger.
      if (prev?.isConnected && prev !== document.body) prev.focus();
      else (triggerRef.current ?? searchRef.current)?.focus();
    });
  }

  function discardDraft() {
    draftRef.current = {};
    setComposer(
      (c) =>
        c && {
          ...c,
          key: ++composerKey.current,
          defaults: {},
          restored: false,
        },
    );
  }

  // After an optimistic delete the row unmounts and focus would fall to <body>.
  // Send it to the Undo button — the announced, immediate next action.
  const [undoHover, setUndoHover] = useState(false);
  const [undoFocus, setUndoFocus] = useState(false);
  useEffect(() => {
    // A fresh offer starts its own clock. Reset before focusing: the focus
    // handler below may hold it again.
    setUndoHover(false);
    setUndoFocus(false);
    if (undo) undoRef.current?.focus();
  }, [undo]);

  // The undo offer lapses after 8s, held open while the pointer rests on it or
  // keyboard focus is in it (WCAG 2.2.1). Focus sits on Undo by then, so hand
  // it to search rather than <body>.
  useEffect(() => {
    if (!undo || undoHover || undoFocus) return;
    const t = setTimeout(() => {
      if (document.activeElement === undoRef.current)
        searchRef.current?.focus();
      setUndo(null);
    }, 8000);
    return () => clearTimeout(t);
  }, [undo, undoHover, undoFocus]);

  // "Saved" is a receipt, not an offer: it lapses on its own.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 4000);
    return () => clearTimeout(t);
  }, [saved]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // A Thai or Japanese IME fires keydown mid-composition. Typing "ก" must
      // not open the composer.
      if (event.isComposing || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      // The filter drawer is modal: its own Esc closes it (and only it), and
      // nothing behind it answers a shortcut.
      if (target?.closest("dialog")) return;
      const typing = !!target?.closest("input, textarea, [contenteditable]");

      if (event.key === "Escape") {
        if (composer) closeComposer();
        else if (dropping) setDropping(null);
        else if (cardFor) setCardFor(null);
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
  }, [composer, query, dropping, cardFor]);

  const allTags = useMemo(
    () =>
      [...new Set(list.flatMap((i) => i.tags))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [list],
  );

  // Uses across the whole stash, not the search: the rail ranks by these, and
  // a ranking that reshuffled on every keystroke would be unusable.
  const tagTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of list)
      for (const t of item.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [list]);

  // Search runs over title, description, cmd, URL and tags — every field a row
  // shows, so the host printed beside a title is findable too. Thai has no word
  // boundaries, so substring matching is the only option; toLowerCase is a
  // harmless no-op on Thai text. Kind and tag are facets layered on top; the
  // rail counts read off `searched`, so every count answers "how many match
  // this search" and stays put no matter which facet is active.
  const q = deferredQuery.trim();
  const searched = useMemo(() => {
    const needle = q.toLowerCase();
    if (!needle) return list;
    return list.filter((item) =>
      [
        item.title,
        item.description,
        item.cmd ?? "",
        item.url ?? "",
        item.address ?? "",
        ...item.tags,
      ].some((field) => field.toLowerCase().includes(needle)),
    );
  }, [list, q]);

  const kindCounts: Record<Tab, number> = {
    all: searched.length,
    tool: searched.filter((i) => i.kind === "tool").length,
    formula: searched.filter((i) => i.kind === "formula").length,
    place: searched.filter((i) => i.kind === "place").length,
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

  const collection = folders.find((c) => c.id === collectionId) ?? null;
  const activeFilters =
    (tab === "all" ? 0 : 1) + (activeTag ? 1 : 0) + (collection ? 1 : 0);
  const hasItems = list.length > 0;

  const rail = (
    <FilterRail
      tab={tab}
      onTab={onTab}
      kindCounts={kindCounts}
      collections={folders.map((c) => ({
        ...c,
        count: searched.filter((i) => c.itemIds.includes(i.id)).length,
      }))}
      activeCollection={collection?.id ?? null}
      onCollection={onCollection}
      onCreateCollection={async (name) => {
        const id = await onCreateCollection(name);
        if (id) onCollection(id);
        return id;
      }}
      tags={railTags}
      tagCounts={tagCounts}
      tagTotals={tagTotals}
      activeTag={activeTag}
      onTag={setActiveTag}
    />
  );
  // Whether the kind tabs exist in the DOM right now: aria references to them
  // must not dangle while the desktop rail is collapsed.
  const tabsRendered = hasItems && (!wide || railOpen);

  const visible = useMemo(
    () =>
      searched.filter(
        (i) =>
          (tab === "all" || i.kind === tab) &&
          (!activeTag || i.tags.includes(activeTag)) &&
          (!collection || collection.itemIds.includes(i.id)),
      ),
    [searched, tab, activeTag, collection],
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

  // Places: pinned ones on the map, the rest listed as "Not on the map". The
  // index lists the pinned ones inside the visitor's own view, nearest first
  // once Near me knows where you are.
  const placesView = tab === "place";
  const places = useMemo(
    () => visible.filter((i) => i.kind === "place"),
    [visible],
  );
  const pinned = places.filter(
    (p): p is Item & { lat: number; lng: number } =>
      p.lat !== null && p.lng !== null,
  );
  const unpinned = places.filter((p) => p.lat === null || p.lng === null);
  // Is there a map to draw at all: anything in this view before search and
  // tags narrow it.
  const mapShown = list.some(
    (i) =>
      i.kind === "place" && (!collection || collection.itemIds.includes(i.id)),
  );
  const shell = placesView && wide && mapShown;
  const fitKey = `${q}|${activeTag}|${collectionId}|${showAll}`;
  const fit = fitTo?.base === fitKey ? fitTo : { key: fitKey, points: pinned };
  // Any refit (a search, tag, collection, Show all, Near me) drops the
  // visitor's own view, so the index never narrows to a view the map has left.
  const [viewFor, setViewFor] = useState(fit.key);
  if (viewFor !== fit.key) {
    setViewFor(fit.key);
    setView(null);
  }
  const inView = view ? pinned.filter((p) => within(p, view)) : pinned;
  const listed = user
    ? [...inView].sort((a, b) => distance(user, a) - distance(user, b))
    : inView;
  const selectedPlace = placesView
    ? (places.find((p) => p.id === selectedId) ?? null)
    : null;

  // The result line under search: what is showing and why, in words — so a
  // collapsed rail or the closed drawer never hides which filters are on. A
  // polite live region, so a screen reader hears the count settle too.
  const placeWords = [
    q && `for “${q}”`,
    collection && `in ${collection.name}`,
    activeTag && `tagged ${activeTag}`,
  ]
    .filter(Boolean)
    .join(" ");
  const placeNoun = (n: number) =>
    q || activeTag
      ? n === 1
        ? "match"
        : "matches"
      : n === 1
        ? "place"
        : "places";
  const narrowed = inView.length < pinned.length;
  // Where you are (Places, a collection) isn't a filter to clear; a search, a
  // kind or a tag is.
  const filtering = placesView
    ? q !== "" || !!activeTag
    : q !== "" || tab !== "all" || !!activeTag;
  const summary = placesView
    ? (narrowed
        ? `In view: ${inView.length} of ${pinned.length} ${placeNoun(pinned.length)} ${placeWords}`
        : `${places.length} ${placeNoun(places.length)} ${placeWords}`
      ).trim()
    : filtering
      ? [
          `${visible.length} ${visible.length === 1 ? "match" : "matches"}`,
          q && `for “${q}”`,
          tab !== "all" &&
            `in ${tab === "tool" ? "Tools" : tab === "formula" ? "Formulae" : "Places"}`,
          activeTag && `tagged ${activeTag}`,
          collection && `in ${collection.name}`,
        ]
          .filter(Boolean)
          .join(" ")
      : collection
        ? `${visible.length} ${visible.length === 1 ? "thing" : "things"} in ${collection.name}`
        : `${list.length} ${list.length === 1 ? "thing" : "things"} saved`;

  function clearAll() {
    setQuery("");
    setActiveTag(null);
    if (!placesView) onTab("all");
  }

  function onTab(next: Tab) {
    setTab(next);
  }

  function onCollection(id: string | null) {
    setCollectionId(id);
  }

  function selectPlace(id: string, scroll = false) {
    setSelectedId(id);
    setCardFor(id);
    // A pin clicked on the map brings its row into view.
    if (scroll)
      requestAnimationFrame(() =>
        document
          .getElementById(`place-${id}`)
          ?.scrollIntoView({ block: "nearest" }),
      );
  }

  // Esc on the card: close it, keep the pin selected, focus its row.
  function closeCard() {
    const id = cardFor;
    setCardFor(null);
    if (id)
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`#place-${id} button`)?.focus(),
      );
  }

  // Enter on a row: open its card and put focus on Open in Maps.
  function enterCard(id: string) {
    setCardFor(id);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(".place-popup a")?.focus(),
      ),
    );
  }

  // "Show on map" from the All view: open Places on that place, zoomed in.
  function openPlace(id: string) {
    onTab("place");
    selectPlace(id);
    window.scrollTo({ top: 0 });
    // The row clicked in the All view is gone; focus lands on the place's row.
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`#place-${id} button`)
        ?.focus({ preventScroll: true }),
    );
    const p = list.find((i) => i.id === id);
    // On a phone the selection's own ease centres it; a second fit would race it.
    if (wide && p?.lat != null && p.lng != null)
      setFitTo({
        base: fitKey,
        key: `place:${id}`,
        points: [{ lat: p.lat, lng: p.lng }],
      });
  }

  async function onCreateCollection(name: string) {
    const result = await createCollection(name);
    if (result.error) {
      setError({ message: result.error });
      return undefined;
    }
    return result.id;
  }

  function onToggleMember(cid: string, itemId: string, member: boolean) {
    startTransition(async () => {
      patchFolders({ type: "member", collectionId: cid, itemId, member });
      const result = await setMembership(cid, itemId, member);
      if (result.error) setError({ message: result.error });
    });
  }

  function onDeleteCollection(c: Collection) {
    setCollectionId(null);
    startTransition(async () => {
      patchFolders({ type: "delete", id: c.id });
      const result = await deleteCollection(c.id);
      if (result.error) setError({ message: result.error });
    });
  }

  // Near me: sort the index by distance and show you with the places around
  // you. Pressed again, it forgets where you are.
  function onLocate() {
    if (user) {
      setUser(null);
      setFitTo(null);
      return;
    }
    if (!("geolocation" in navigator))
      return setError({ message: "This browser can't share its location." });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocating(false);
        setUser(here);
        const around = pinned
          .filter((p) => distance(here, p) < 25_000)
          .sort((a, b) => distance(here, a) - distance(here, b))
          .slice(0, 5);
        setFitTo({
          base: fitKey,
          key: `near:${here.lat},${here.lng}`,
          points: [here, ...around],
        });
      },
      (err) => {
        setLocating(false);
        setError({
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location is off for this site. Allow it in your browser's site settings to sort places by distance."
              : "Couldn't find where you are. Try again in a moment.",
        });
      },
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function onDrop(pin: Point) {
    const item = dropping;
    if (!item) return;
    setDropping(null);
    selectPlace(item.id, true);
    startTransition(async () => {
      patch({ type: "update", item: { ...item, ...pin } });
      const result = await setPlacePin(item.id, pin.lat, pin.lng);
      if (result.error) setError({ message: result.error });
    });
  }

  async function onSubmit(formData: FormData) {
    setError(null);
    const target = composer?.editing ?? null;
    const draft = draftFrom(formData, target?.id ?? crypto.randomUUID());
    // An edit that keeps the link keeps its pin and preview until the server
    // answers.
    if (target?.url === draft.url)
      Object.assign(draft, {
        lat: target.lat,
        lng: target.lng,
        address: target.address,
        image: target.image,
      });
    patch({ type: target ? "update" : "add", item: draft });
    const result = target
      ? await updateItem(target.id, formData)
      : await createItem(formData);
    if (result.error)
      return setError({ message: result.error, field: result.field });

    // Show where it went: the desktop pane selects it (a tool), and a receipt
    // names it, since the alphabetical list may have filed it off-screen.
    if (result.id && draft.kind === "place") selectPlace(result.id);
    else if (result.id && draft.kind === "tool") setSelectedId(result.id);
    setSaved({ title: draft.title });
    closeComposer(true);

    const id = result.id ?? target?.id;
    if (id && draft.kind === "tool") {
      refreshes.current = 0;
      setAwaiting({ id, image: target?.image ?? null });
    }
  }

  // A tool's preview image is fetched after its save responds (actions.ts), so
  // it shows a monogram first. Re-fetch the page every 1.5s until a new image
  // lands; the fetch gives up at 5s, so six tries cover it.
  const [awaiting, setAwaiting] = useState<{
    id: string;
    image: string | null;
  } | null>(null);
  const refreshes = useRef(0);
  useEffect(() => {
    if (!awaiting) return;
    const image = initial.find((i) => i.id === awaiting.id)?.image ?? null;
    if ((image && image !== awaiting.image) || refreshes.current >= 6)
      return setAwaiting(null);
    const t = setTimeout(() => {
      refreshes.current++;
      router.refresh();
    }, 1500);
    return () => clearTimeout(t);
  }, [awaiting, initial, router]);

  function onDelete(item: Item) {
    undoCollections.current = folders
      .filter((c) => c.itemIds.includes(item.id))
      .map((c) => c.id);
    startTransition(async () => {
      patch({ type: "delete", id: item.id });
      const result = await deleteItem(item.id);
      if (result.error) setError({ message: result.error });
      else setUndo(item);
    });
  }

  function onUndo(item: Item) {
    setUndo(null);
    startTransition(async () => {
      // ponytail: undo re-inserts, so the row comes back with a fresh id and
      // timestamp. Soft-delete only if that ever matters.
      patch({ type: "add", item });
      const result = await createItem(
        formDataOf(item, undoCollections.current),
      );
      if (result.error) setError({ message: result.error });
    });
  }

  function onEdit(item: Item) {
    // Editing a tool shows it in the pane, so the form and the preview agree.
    if (item.kind !== "formula") setSelectedId(item.id);
    openComposer(item);
  }

  // The no-match state offers to save what you just looked for: a host-like
  // query becomes the URL, anything else the title.
  function saveQuery() {
    openComposer(
      null,
      looksLikeLink(q)
        ? { kind: isMapsLink(q) ? "place" : "tool", url: q }
        : { title: q },
    );
  }

  // Any item can be filed into collections, from wherever its actions live.
  const filing: Filing = {
    collections: folders,
    onToggle: onToggleMember,
    onCreate: onCreateCollection,
  };

  // A card only while its place is listed: pan it out of view and it closes.
  const cardPlace = placesView
    ? (inView.find((p) => p.id === cardFor) ?? null)
    : null;
  const card = cardPlace ? (
    <PlaceCard
      // Fresh per place, so an open Collections list does not carry over.
      key={cardPlace.id}
      item={cardPlace}
      filing={filing}
      onEdit={() => onEdit(cardPlace)}
      onDelete={() => {
        setCardFor(null);
        onDelete(cardPlace);
      }}
      onClose={closeCard}
    />
  ) : null;

  const map = placesView && mapShown && (
    <PlaceMap
      pins={pinned}
      fit={fit}
      // While Set location places one place, no other pin stays teal.
      selectedId={dropping ? null : (selectedPlace?.id ?? null)}
      hoveredId={hoveredId}
      user={user}
      locating={locating}
      dropping={dropping?.title ?? null}
      label={`Map of ${pinned.length} ${pinned.length === 1 ? "place" : "places"}${collection ? ` in ${collection.name}` : ""}`}
      popover={card}
      onSelect={(id) => {
        if (id) return selectPlace(id, true);
        setSelectedId(null);
        setCardFor(null);
      }}
      onUserMove={setView}
      onLocate={onLocate}
      onDrop={onDrop}
      onCancelDrop={() => setDropping(null)}
    />
  );

  return (
    // Places on desktop is an app shell: the page stops scrolling, the index
    // scrolls in its column, and the map fills the rest to the window's edge.
    <div
      className={`px-4 py-10 sm:px-6 ${shell ? "lg:flex lg:h-dvh lg:flex-col lg:pr-0 lg:pb-0" : ""}`}
    >
      {/* The header and the rail's tag list sit ahead of search in tab order.
          Parked above the viewport until keyboard focus lands on it. */}
      <button
        type="button"
        onClick={() => searchRef.current?.focus()}
        className={`bg-surface text-label text-ink border-border fixed top-2 left-2 z-10 -translate-y-16 rounded border px-3 py-2 font-medium focus-visible:translate-y-0 ${focusRing}`}
      >
        Skip to search
      </button>

      <header className="flex items-center justify-between gap-4">
        <h1 className="text-display text-ink flex shrink-0 items-center gap-2.5 font-serif leading-none">
          <StashMark className="size-[1em] rounded-[3px]" />
          Stash
        </h1>
        <div className="flex min-w-0 items-center gap-3">
          {/* Identity caption yields first on narrow screens: it truncates so a
              long name never crushes the wordmark or pushes the toggle off. */}
          <span className="text-label text-muted min-w-0 truncate">{name}</span>
          <button
            type="button"
            disabled={signingOut}
            onClick={() =>
              startSignOut(async () => {
                await authClient.signOut();
                router.push("/login");
                router.refresh();
              })
            }
            className={`text-label text-muted hover:text-ink inline-flex h-9 shrink-0 items-center rounded px-1 font-medium disabled:pointer-events-none disabled:opacity-50 ${touch} ${focusRing}`}
          >
            Sign out
          </button>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository (opens in a new tab)"
            className={`text-muted hover:text-ink grid h-9 w-9 shrink-0 place-items-center rounded transition-colors duration-150 ${focusRing}`}
          >
            <GitHubMark className="size-[18px]" />
          </a>
          <ThemeToggle />
        </div>
      </header>

      <div
        className={`mt-8 flex flex-col gap-8 lg:flex-row lg:gap-10 ${shell ? "lg:min-h-0 lg:flex-1" : ""}`}
      >
        {/* One rail, two homes: a collapsible column on desktop, a slide-in
            drawer below lg. Rendered in exactly one so its ids stay unique. An
            empty stash has nothing to filter, so neither renders. */}
        {hasItems && wide && railOpen && (
          <aside
            id="filters"
            // In the Places shell the rail scrolls on its own; the inset keeps
            // focus rings clear of its clipped edges.
            className={`w-52 shrink-0 ${shell ? "relative -mx-1.5 -mt-1.5 box-content overflow-y-auto px-1.5 pt-1.5 pb-10" : ""}`}
          >
            {/* ponytail: sticky pins the rail; a list taller than the viewport
                just scrolls with the page. The tag list collapses to the most
                used, so that takes a very large stash. */}
            <div className={shell ? "" : "sticky top-10"}>{rail}</div>
          </aside>
        )}
        {hasItems && !wide && (
          <dialog
            ref={drawerRef}
            id="filters"
            aria-labelledby="filters-title"
            // A click that lands on the dialog itself hit the backdrop.
            onClick={(e) =>
              e.target === e.currentTarget && e.currentTarget.close()
            }
            className="bg-bg text-ink border-border m-0 h-dvh max-h-none w-72 max-w-[85vw] border-r p-0 backdrop:bg-black/40"
          >
            <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
              <div className="flex items-center justify-between">
                <h2
                  id="filters-title"
                  className="text-title text-ink font-serif"
                >
                  Filters
                </h2>
                <button
                  type="button"
                  onClick={() => drawerRef.current?.close()}
                  className={`text-label text-muted hover:text-ink inline-flex items-center rounded px-2 py-2 font-medium ${touch} ${focusRing}`}
                >
                  Done
                </button>
              </div>
              {rail}
            </div>
          </dialog>
        )}

        <main
          // relative in the shell: screen-reader-only text inside must scroll with
          // the column, not stretch the page past the window.
          className={`min-w-0 ${shell ? "relative -mx-1.5 -mt-1.5 box-content w-88 flex-none overflow-y-auto px-1.5 pt-1.5 pb-10" : "flex-1"}`}
        >
          {/* An empty stash leads with its own first-run message instead. */}
          {(hasItems || collection) && (
            <IndexHeading
              key={collection?.id ?? tab}
              collection={collection}
              fallback={
                {
                  all: "Everything",
                  tool: "Tools",
                  formula: "Formulae",
                  place: "Places",
                }[tab]
              }
              onDelete={() => collection && onDeleteCollection(collection)}
            />
          )}
          <div className="flex gap-2">
            {hasItems && (
              <button
                type="button"
                onClick={toggleFilters}
                aria-controls={tabsRendered ? "filters" : undefined}
                aria-expanded={wide ? railOpen : undefined}
                className={`border-field text-label text-muted hover:text-ink flex shrink-0 items-center gap-2 rounded border px-3 font-medium transition-colors duration-150 ${focusRing}`}
              >
                <PanelIcon />
                <span>{wide && railOpen ? "Hide filters" : "Filters"}</span>
                {/* Collapsed or in the drawer, the rail can't show what's on, so the
                    button does: a count, never color alone. */}
                {activeFilters > 0 && (
                  <span className="bg-accent text-bg rounded px-1.5 tabular-nums">
                    {activeFilters}
                    <span className="sr-only"> active</span>
                  </span>
                )}
              </button>
            )}
            <div className="relative min-w-0 flex-1">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                // The long form names what's searched; a phone has room for
                // a few words beside the Filters button.
                placeholder={
                  placesView
                    ? "Search places…"
                    : wide
                      ? "Search titles, sites, commands, places…"
                      : "Search your stash…"
                }
                aria-label="Search your stash"
                aria-describedby={hasItems ? "search-summary" : undefined}
                autoComplete="off"
                spellCheck={false}
                className={search}
              />
              {/* Idle-only shortcut hint. Hidden once you type (native clear takes
                the gutter) and on touch, where there's no `/` to press. */}
              {!query && (
                <kbd
                  aria-hidden="true"
                  className="border-border text-label text-muted pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 sm:block pointer-coarse:hidden"
                >
                  /
                </kbd>
              )}
            </div>
          </div>

          {hasItems && (
            <div className="text-label text-muted mt-2 flex items-baseline gap-3">
              <p
                id="search-summary"
                role="status"
                className="min-w-0 truncate tabular-nums"
              >
                {summary}
              </p>
              {placesView && narrowed && (
                <button
                  type="button"
                  onClick={() => setShowAll((n) => n + 1)}
                  className={`text-accent shrink-0 rounded font-medium underline underline-offset-2 ${focusRing}`}
                >
                  Show all
                </button>
              )}
              {filtering && (
                <button
                  type="button"
                  onClick={clearAll}
                  className={`text-accent shrink-0 rounded font-medium underline underline-offset-2 ${focusRing}`}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* An empty stash leads with its own "Save your first" instead. */}
          {hasItems && (
            <button
              ref={triggerRef}
              type="button"
              aria-haspopup="dialog"
              onClick={() => openComposer()}
              className={`border-border text-body text-muted hover:border-accent hover:text-ink mt-6 flex w-full items-center justify-between rounded border border-dashed px-3 py-2.5 text-left font-medium transition-colors duration-150 ${focusRing}`}
            >
              <span>
                <span aria-hidden="true">+ </span>
                {placesView
                  ? "Paste a maps link…"
                  : "Save a tool, a formula, or a place…"}
              </span>
              <kbd className="border-border text-label rounded border px-1.5 py-0.5 pointer-coarse:hidden">
                a
              </kbd>
            </button>
          )}

          {map && !wide && (
            <div className="border-border sticky top-0 z-10 -mx-4 mt-6 h-[50dvh] border-y sm:-mx-6">
              {map}
            </div>
          )}

          <div
            role="tabpanel"
            id="kind-panel"
            {...(tabsRendered
              ? { "aria-labelledby": `kind-tab-${tab}` }
              : { "aria-label": "Results" })}
          >
            {placesView ? (
              !mapShown ? (
                // Same place and treatment as every other empty view: centred
                // under the trigger.
                <div className="mt-16 text-center">
                  <p
                    lang={langOf(collection?.name ?? "")}
                    className="text-title text-ink font-serif"
                  >
                    {collection
                      ? collection.itemIds.length === 0
                        ? `Nothing in ${collection.name} yet.`
                        : `No places in ${collection.name} yet.`
                      : "No places yet."}
                  </p>
                  <p className="text-body text-muted mx-auto mt-2 max-w-md">
                    {collection
                      ? "Paste a maps link and it lands here, or file a saved place from its card on the map."
                      : "Paste a Google Maps or Apple Maps link to save one."}
                  </p>
                </div>
              ) : places.length === 0 ? (
                <Empty
                  hasItems
                  query={q}
                  filtered={!!activeTag}
                  onAdd={() => openComposer()}
                  onClear={clearAll}
                  onSaveQuery={saveQuery}
                />
              ) : (
                <div className="mt-4">
                  {listed.length > 0 ? (
                    <ul className="divide-border border-border divide-y border-y">
                      {listed.map((item) => (
                        <PlaceRow
                          key={item.id}
                          item={item}
                          selected={selectedPlace?.id === item.id}
                          distance={
                            user ? formatDistance(distance(user, item)) : null
                          }
                          onSelect={() => selectPlace(item.id)}
                          onFocus={() =>
                            selectedId !== item.id && selectPlace(item.id)
                          }
                          onHover={setHoveredId}
                          onActivate={() => enterCard(item.id)}
                        />
                      ))}
                    </ul>
                  ) : (
                    pinned.length > 0 && (
                      <p className="text-label text-muted mt-6">
                        No places in this part of the map.
                      </p>
                    )
                  )}
                  {unpinned.length > 0 && (
                    <section className="mt-10">
                      <SectionHeading count={unpinned.length} quiet={false}>
                        Not on the map
                      </SectionHeading>
                      <ul className="divide-border divide-y">
                        {unpinned.map((item) => (
                          <UnpinnedRow
                            key={item.id}
                            item={item}
                            onPin={() => {
                              setDropping(item);
                              setCardFor(null);
                              // The narrow map sits at the top of the page.
                              if (!wide) window.scrollTo({ top: 0 });
                            }}
                            onEdit={() => onEdit(item)}
                            onDelete={() => onDelete(item)}
                          />
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              )
            ) : visible.length === 0 &&
              collection?.itemIds.length === 0 &&
              !q &&
              !activeTag ? (
              <div className="mt-16 text-center">
                <p
                  lang={langOf(collection.name)}
                  className="text-title text-ink font-serif"
                >
                  Nothing in {collection.name} yet.
                </p>
                <p className="text-body text-muted mx-auto mt-2 max-w-md">
                  Save something while it&apos;s open and it lands here, or file
                  a saved item from its Collections button.
                </p>
              </div>
            ) : visible.length === 0 ? (
              <Empty
                hasItems={hasItems}
                query={q}
                filtered={activeFilters > 0}
                onAdd={() => openComposer()}
                onClear={clearAll}
                onSaveQuery={saveQuery}
              />
            ) : (
              <div className="mt-6 flex flex-col gap-10">
                {tools.length > 0 && (
                  <section>
                    <SectionHeading count={tools.length} quiet={tab !== "all"}>
                      Tools
                    </SectionHeading>
                    <ul
                      className={`divide-border border-border divide-y ${tab === "all" ? "" : "border-t"}`}
                    >
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
                          onEdit={() => onEdit(item)}
                          onDelete={() => onDelete(item)}
                          filing={filing}
                        />
                      ))}
                    </ul>
                  </section>
                )}

                {formulae.length > 0 && (
                  <section>
                    <SectionHeading
                      count={formulae.length}
                      quiet={tab !== "all"}
                    >
                      Formulae
                    </SectionHeading>
                    <ul className="flex flex-col gap-3">
                      {formulae.map((item) => (
                        <FormulaCard
                          key={item.id}
                          item={item}
                          onEdit={() => onEdit(item)}
                          onDelete={() => onDelete(item)}
                          filing={filing}
                        />
                      ))}
                    </ul>
                  </section>
                )}

                {places.length > 0 && (
                  <section>
                    <SectionHeading count={places.length} quiet={false}>
                      Places
                    </SectionHeading>
                    <ul className="divide-border divide-y">
                      {places.map((item) => (
                        <PlaceLink
                          key={item.id}
                          item={item}
                          onOpen={() => openPlace(item.id)}
                        />
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>

        {shell ? (
          <div className="border-border min-w-0 flex-1 border-t border-l">
            {map}
          </div>
        ) : active ? (
          <DetailPane
            // Fresh per tool, so an open Collections list does not carry over.
            key={active.id}
            item={active}
            containerRef={paneRef}
            onEdit={() => onEdit(active)}
            onDelete={() => onDelete(active)}
            filing={filing}
          />
        ) : (
          // Hold the pane's column while no tool is showing (the Formulae tab,
          // a formulae-only search), so the list never jumps wider mid-typing.
          wide &&
          hasItems && <div aria-hidden="true" className="w-96 shrink-0" />
        )}
      </div>

      {/* The dialog outlives the keyed form, so Discard swaps the fields without
          closing and reopening the popup. */}
      {composer && (
        <Modal labelledBy="composer-title" onClose={() => closeComposer()}>
          <ComposerForm
            key={composer.key}
            collection={collection}
            placesView={placesView}
            editing={composer.editing}
            defaults={composer.defaults}
            restored={composer.restored}
            error={error}
            formRef={formRef}
            firstRef={firstRef}
            onCancel={() => closeComposer()}
            onDiscard={discardDraft}
            onSubmit={onSubmit}
          />
        </Modal>
      )}

      {/* Delete and undo run with the composer closed, where its inline error
          banner never renders. Surface those failures here instead. */}
      {/* One stack, so an error and the undo offer never cover each other. */}
      <div className="fixed inset-x-4 bottom-4 ml-auto flex max-w-sm flex-col gap-2">
        {error && !composer && (
          <div role="alert" className={toast}>
            <span className="text-label text-danger">
              <span aria-hidden="true">✕ </span>
              {error.message}
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

        {/* Always mounted, so what lands in it is announced. */}
        <div aria-live="polite" className="flex flex-col gap-2">
          {undo && (
            <div
              onPointerEnter={() => setUndoHover(true)}
              onPointerLeave={() => setUndoHover(false)}
              // Keyboard focus holds the offer; the programmatic focus a mouse
              // delete hands it does not (it isn't :focus-visible), so a pointer
              // user's offer still lapses on its own.
              onFocus={(e) =>
                e.target.matches(":focus-visible") && setUndoFocus(true)
              }
              onBlur={() => setUndoFocus(false)}
              className={toast}
            >
              <span className="text-label text-ink min-w-0 truncate">
                Deleted “{undo.title}”
              </span>
              <button
                ref={undoRef}
                type="button"
                onClick={() => onUndo(undo)}
                className={`text-label text-accent shrink-0 font-semibold underline underline-offset-2 ${focusRing}`}
              >
                Undo
              </button>
            </div>
          )}

          {saved && (
            <div className={toast}>
              <span className="text-label text-ink min-w-0 truncate">
                <span aria-hidden="true">✓ </span>Saved “{saved.title}”
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// The kind switch, top of the filter rail: All / Tools / Formulae as the fixed
// facet above the open-ended Tags. A real ARIA tablist — roving tabindex, ↑/↓
// (and ←/→) move and activate, selection follows focus — driving the
// `kind-panel` results region. Named by the rail's "Kind" heading (`labelledBy`)
// for parity with Tags. Shares the rail's shape: an inline pill on mobile, a
// full-width row with a right-aligned count on desktop. Selected treatment is
// accent fill + a reserved ✓ slot (state never rides on color alone, and the
// active tab never changes width, so selection can't reflow its neighbors).
function KindTabs({
  tab,
  onTab,
  counts,
  labelledBy,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  counts: Record<Tab, number>;
  labelledBy: string;
}) {
  const kinds: { value: Tab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "tool", label: "Tools" },
    { value: "formula", label: "Formulae" },
    { value: "place", label: "Places" },
  ];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: React.KeyboardEvent, i: number) {
    const last = kinds.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = i === last ? 0 : i + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = i === 0 ? last : i - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    onTab(kinds[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-labelledby={labelledBy}
      className="mt-1.5 flex flex-col gap-0.5"
    >
      {kinds.map(({ value, label }, i) => {
        const on = tab === value;
        return (
          <button
            key={value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`kind-tab-${value}`}
            aria-selected={on}
            aria-controls="kind-panel"
            tabIndex={on ? 0 : -1}
            onClick={() => onTab(value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`text-label rounded font-medium transition-colors duration-150 ${touch} ${focusRing} flex w-full items-center justify-between gap-1.5 px-2 py-2.5 lg:py-1.5 ${
              on ? "bg-accent text-bg" : segmentOff
            }`}
          >
            <span className="flex items-center gap-1.5">
              {/* Reserved slot: invisible keeps the tab's width constant between
                  states, so activating one never shifts the others. */}
              <span aria-hidden="true" className={on ? "" : "invisible"}>
                ✓
              </span>
              <span>{label}</span>
            </span>
            <span
              className={`shrink-0 tabular-nums ${on ? "text-bg" : "text-muted"}`}
            >
              {counts[value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Past this many tags the rail shows only the most used, behind "Show all".
// A flat list of dozens of one-off tags is a wall, not a filter.
const TAG_LIMIT = 10;

// The card-catalog drawer: the two filter axes as one quiet rail. A vertical
// column on desktop (where it earns the width a stretched search box couldn't);
// above the list, wrapping into chips, on narrow screens. Kind is the fixed
// facet on top; Tags, the open-ended one, follows and only appears once a tag
// exists. Accent + ✓ marks the active filter — never color alone, never more
// than a sliver of the screen. The quiet sans headings are the app's voice
// naming each axis: sentence-case and muted, not the tracked-uppercase eyebrow
// the bans forbid, and each labels its group via aria-labelledby.
function FilterRail({
  tab,
  onTab,
  kindCounts,
  collections,
  activeCollection,
  onCollection,
  onCreateCollection,
  tags,
  tagCounts,
  tagTotals,
  activeTag,
  onTag,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  kindCounts: Record<Tab, number>;
  collections: (Collection & { count: number })[];
  activeCollection: string | null;
  onCollection: (id: string | null) => void;
  onCreateCollection: (name: string) => Promise<string | undefined>;
  tags: string[];
  tagCounts: Map<string, number>;
  tagTotals: Map<string, number>;
  activeTag: string | null;
  onTag: (tag: string | null) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  // Most used first (across the whole stash, so it holds still while you type),
  // alphabetical within a count. Collapsing hides nothing you'd miss: hiding
  // one or two would cost more than showing them, and the active tag stays.
  const ranked = [...tags].sort(
    (a, b) =>
      (tagTotals.get(b) ?? 0) - (tagTotals.get(a) ?? 0) || a.localeCompare(b),
  );
  const collapsible = ranked.length > TAG_LIMIT + 2;
  const shown =
    showAll || !collapsible
      ? ranked
      : ranked.filter((t, i) => i < TAG_LIMIT || t === activeTag);

  return (
    <nav aria-label="Filters" className="flex flex-col gap-6">
      <div>
        <h2 id="rail-kind" className={railHeading}>
          Kind
        </h2>
        <KindTabs
          tab={tab}
          onTab={onTab}
          counts={kindCounts}
          labelledBy="rail-kind"
        />
      </div>

      {/* Groups of places: a trip, a list worth keeping. Opening one shows its
          places on the map. */}
      <div>
        <h2 id="rail-collections" className={railHeading}>
          Collections
        </h2>
        {collections.length > 0 && (
          <div
            role="group"
            aria-labelledby="rail-collections"
            className="mt-1.5 flex flex-col gap-0.5"
          >
            {collections.map((c) => {
              const on = activeCollection === c.id;
              return (
                <FilterRow
                  key={c.id}
                  label={c.name}
                  count={c.count}
                  active={on}
                  onClick={() => onCollection(on ? null : c.id)}
                />
              );
            })}
          </div>
        )}
        <NewCollection
          label="New collection"
          onCreate={onCreateCollection}
          className="mt-1"
        />
      </div>

      {tags.length > 0 && (
        <div>
          <h2 id="rail-tags" className={railHeading}>
            Tags
          </h2>
          <div
            id="rail-tag-list"
            role="group"
            aria-labelledby="rail-tags"
            className="mt-1.5 flex flex-col gap-0.5"
          >
            {shown.map((tag) => {
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
          {collapsible && (
            <button
              type="button"
              aria-expanded={showAll}
              aria-controls="rail-tag-list"
              onClick={() => setShowAll(!showAll)}
              className={`${quietButton} hover:text-ink mt-1 underline underline-offset-2`}
            >
              {showAll ? "Show fewer tags" : `Show all ${ranked.length} tags`}
            </button>
          )}
        </div>
      )}
    </nav>
  );
}

// One filter atom for both rail sections: an inline pill on mobile, a full-width
// row with a right-aligned count on desktop. Shares KindTabs' treatment — accent
// fill plus a reserved ✓ slot, no weight change — so every row in the rail lines
// up on one left edge and activating never reflows a neighbor.
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
      className={`text-label flex w-full items-center justify-between gap-1.5 rounded px-2 py-2.5 font-medium transition-colors duration-150 lg:py-1.5 ${touch} ${focusRing} ${
        active
          ? "bg-accent text-bg"
          : "text-muted hover:bg-surface hover:text-ink"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden="true" className={active ? "" : "invisible"}>
          ✓
        </span>
        <span lang={langOf(label)} className="truncate">
          {label}
        </span>
      </span>
      <span
        className={`shrink-0 tabular-nums ${active ? "text-bg" : "text-muted"}`}
      >
        {count}
      </span>
    </button>
  );
}

// The add/edit popup: a native modal <dialog>, so the browser traps focus,
// makes the page behind it inert, and turns Esc into a close. Mounted once per
// opening; a layout effect so it is open before the form's own effect puts the
// cursor in the field.
function Modal({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Set on pointerdown, so a text selection dragged out of a field and
  // released on the backdrop doesn't read as a backdrop click.
  const downOnBackdrop = useRef(false);

  useLayoutEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      // Esc closes the dialog natively; this hands that close to React, which
      // keeps the draft and returns focus. Unmounting fires no close event.
      onClose={onClose}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) =>
        downOnBackdrop.current && e.target === e.currentTarget && onClose()
      }
      className="bg-bg text-ink border-border mx-auto mt-[12vh] max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border p-0 shadow-lg backdrop:bg-black/40"
    >
      {children}
    </dialog>
  );
}

function ComposerForm({
  collection,
  placesView,
  editing,
  defaults,
  restored,
  error,
  formRef,
  firstRef,
  onCancel,
  onDiscard,
  onSubmit,
}: {
  collection: Collection | null;
  placesView: boolean;
  editing: Item | null;
  defaults: Draft;
  restored: boolean;
  error: Failure | null;
  formRef: React.RefObject<HTMLFormElement | null>;
  firstRef: React.RefObject<HTMLElement | null>;
  onCancel: () => void;
  onDiscard: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  // Mounted fresh per opening (keyed by the parent), so the kind and every
  // field start from `defaults`.
  const [kind, setKind] = useState<"tool" | "formula" | "place">(
    defaults.kind === "formula" || defaults.kind === "place"
      ? defaults.kind
      : placesView
        ? "place"
        : "tool",
  );
  // What you paste picks the kind (a maps link is a place, any other link a
  // tool, anything else a command) until you pick one yourself. An edit keeps
  // the kind it was saved with.
  const [picked, setPicked] = useState(!!editing);
  // Everything behind "Add details" is optional: the server titles a tool from
  // its site and a formula from its command. Open when there is something in
  // them to see.
  const [details, setDetails] = useState(
    [editing, defaults.title, defaults.description, defaults.tags].some(
      Boolean,
    ),
  );
  const [saving, startSaving] = useTransition();
  const main = kind === "formula" ? "cmd" : "url";
  // Our own empty-field check (the form is noValidate): the browser's bubble
  // ignores the theme and floats over the layout instead of sitting in it.
  const [missing, setMissing] = useState(false);
  const shown: Failure | null = missing
    ? { message: "Paste a link or a command first.", field: main }
    : error;

  // One field takes focus — on open and again on a kind switch: capture costs
  // nothing.
  useEffect(() => {
    firstRef.current?.focus();
  }, [kind, firstRef]);

  // A rejected save puts the cursor in the field that caused it, opening the
  // details first when that field is behind them.
  useEffect(() => {
    const name = error?.field;
    if (!name) return;
    if (["title", "description", "tags"].includes(name)) setDetails(true);
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus(),
    );
  }, [error, formRef]);

  // Ties a field to the error it caused, so it reads as invalid and the
  // message is announced with it.
  const invalid = (name: string) =>
    shown?.field === name
      ? { "aria-invalid": true, "aria-describedby": "composer-error" }
      : {};

  return (
    <form
      ref={formRef}
      // onSubmit, not <form action>: React resets an action form when it
      // settles, which wiped every field on a failed save. A transition still
      // carries the optimistic patch and the pending state.
      onSubmit={(event) => {
        event.preventDefault();
        if (saving) return; // no second create/update from an Enter-mash
        const formData = new FormData(event.currentTarget);
        if (!text(formData, main).trim()) {
          setMissing(true);
          firstRef.current?.focus();
          return;
        }
        startSaving(() => onSubmit(formData));
      }}
      noValidate
    >
      <input type="hidden" name="kind" value={kind} />
      {/* Saved with a collection open, a new item is filed there too. */}
      {!editing && collection && (
        <input type="hidden" name="collection" value={collection.id} />
      )}

      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="composer-title"
            className="text-title text-ink min-w-0 truncate font-serif"
          >
            {editing
              ? `Edit ${editing.title}`
              : collection
                ? `Save to ${collection.name}`
                : "Save to your stash"}
          </h2>
          {/* -mr-2 sets the mark on the field's right edge, not the button's. */}
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className={`${quietButton} hover:text-ink -mr-2 shrink-0`}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* A textarea so a long command can wrap, sized to its content; Enter
              still saves, as in a one-line field. Its name follows the kind. */}
          <textarea
            ref={(el) => {
              firstRef.current = el;
            }}
            name={main}
            aria-label="Link or command"
            required
            rows={1}
            maxLength={kind === "formula" ? 8000 : 2048}
            defaultValue={defaults.url ?? defaults.cmd}
            placeholder={
              // Until a kind is in play the field takes either; after, it asks
              // for that kind's thing.
              picked || placesView
                ? {
                    tool: "Paste a link…",
                    formula: "Paste a command…",
                    place: "Paste a Google Maps or Apple Maps link…",
                  }[kind]
                : "Paste a link or a command…"
            }
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              const value = e.target.value;
              setMissing(false);
              if (!picked && value.trim())
                setKind(
                  isMapsLink(value)
                    ? "place"
                    : looksLikeLink(value)
                      ? "tool"
                      : "formula",
                );
            }}
            onKeyDown={(e) => {
              // Shift+Enter breaks a long command; an IME's Enter commits Thai.
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing)
                return;
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }}
            {...invalid(main)}
            className={`${field} field-sizing-content max-h-40 resize-none`}
          />
          {/* The main field's error sits under it; the rest at the end. */}
          {shown?.field === main && <ErrorLine message={shown.message} />}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span id="composer-kind" className="text-label text-muted">
              Saving as
            </span>
            {/* One segmented control: three equal thirds, each wide enough for
                "✓ Formula", so the ✓ moving across never resizes it. */}
            <div
              role="group"
              aria-labelledby="composer-kind"
              className="border-field inline-grid grid-cols-3 rounded-md border p-0.5"
            >
              {(["tool", "formula", "place"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={kind === value}
                  onClick={() => {
                    setKind(value);
                    setPicked(true);
                  }}
                  className={`${segment} inline-flex min-w-24 items-center justify-center gap-1.5 ${
                    kind === value ? "bg-accent text-bg" : segmentOff
                  }`}
                >
                  {kind === value && <span aria-hidden="true">✓</span>}
                  {value === "tool"
                    ? "Tool"
                    : value === "formula"
                      ? "Formula"
                      : "Place"}
                </button>
              ))}
            </div>
            {restored && (
              <p className="text-label text-muted ml-auto flex items-center">
                Unsaved draft.
                <button
                  type="button"
                  onClick={onDiscard}
                  className={`${quietButton} hover:text-ink -mr-2 underline underline-offset-2`}
                >
                  Discard
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Hidden fields still submit, so a draft survives collapsing them. */}
        <div
          id="composer-details"
          hidden={!details}
          className="flex flex-col gap-3"
        >
          <label className={fieldLabel}>
            Title
            <input
              name="title"
              maxLength={200}
              defaultValue={defaults.title}
              placeholder={
                kind === "tool"
                  ? "Defaults to the site"
                  : kind === "place"
                    ? "Defaults to the place's name"
                    : "Defaults to the command"
              }
              {...invalid("title")}
              className={field}
            />
          </label>

          <label className={fieldLabel}>
            What it&apos;s for
            <input
              name="description"
              maxLength={2000}
              defaultValue={defaults.description}
              {...invalid("description")}
              className={field}
            />
          </label>

          <label className={fieldLabel}>
            <span>
              Tags{" "}
              <span className="text-muted font-normal">(comma separated)</span>
            </span>
            <input
              name="tags"
              defaultValue={defaults.tags}
              placeholder="git, ssh"
              autoCapitalize="off"
              {...invalid("tags")}
              className={field}
            />
          </label>
        </div>

        {shown && shown.field !== main && <ErrorLine message={shown.message} />}
      </div>

      {/* The action bar: one surface step down, so the buttons read as the
          popup's end rather than one more row of fields. */}
      <div className="border-border bg-surface flex items-center gap-2 border-t px-5 py-3">
        <button
          type="button"
          aria-expanded={details}
          aria-controls="composer-details"
          onClick={() => {
            setDetails(!details);
            // The fields open above this button; put the cursor in the first.
            if (!details)
              requestAnimationFrame(() =>
                formRef.current
                  ?.querySelector<HTMLElement>('[name="title"]')
                  ?.focus(),
              );
          }}
          className={`${quietButton} hover:text-ink -ml-2`}
        >
          {details ? "− Hide details" : "+ Add details"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`text-body text-muted hover:text-ink ml-auto rounded px-3 py-2 font-medium ${focusRing}`}
        >
          Cancel
        </button>
        {/* Doubles as the save's busy state — "Saving…" while the action runs. */}
        <button
          type="submit"
          disabled={saving}
          className={`bg-accent text-body text-bg rounded px-4 py-2 font-medium transition-opacity duration-150 hover:opacity-90 disabled:opacity-60 disabled:hover:opacity-60 ${focusRing}`}
        >
          {saving ? "Saving…" : editing ? "Save changes" : "Save"}
        </button>
      </div>
    </form>
  );
}

// The composer's error, announced as it appears; aria-describedby on the field
// it names points here.
function ErrorLine({ message }: { message: string }) {
  return (
    <p id="composer-error" role="alert" className="text-label text-danger">
      <span aria-hidden="true">✕ </span>
      {message}
    </p>
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
  filing,
}: {
  item: Item;
  selectable: boolean;
  selected: boolean;
  onSelect: () => void;
  onActivate?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  filing: Filing;
}) {
  const [filingOpen, setFilingOpen] = useState(false);
  const host = item.url ? hostOf(item.url) : null;
  // A defaulted title already is the host; printing both reads as a stutter.
  const showHost = host && host !== item.title;

  // Desktop master: a lean summary that drives the preview pane. One button per
  // row and no nested links — Open/Copy/Edit/Delete live in the pane — so a
  // screen reader hears exactly one "select" control per row, and the title
  // that truncates here is shown in full over there.
  if (selectable) {
    // The keyboard retrieval path. Focus follows selection (onFocus selects, so
    // ↑/↓ scrub the preview as they walk the list); Enter hands focus to the
    // pane's first action — Open for a tool, Copy for a formula — so opening the
    // found thing is one keystroke, not a tab through every remaining row. Esc
    // in the pane comes back here.
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
          className={`flex w-full items-center gap-4 px-3 py-4 text-left transition-colors duration-150 ${focusRing} ${
            selected ? "bg-surface" : "hover:bg-surface"
          }`}
        >
          <RowTile item={item} />

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span
                lang={langOf(item.title)}
                className={`text-title leading-thai text-ink truncate font-serif ${
                  selected ? "font-semibold" : ""
                }`}
              >
                {item.title}
              </span>
              {showHost && (
                <span className="text-label text-muted max-w-[40%] shrink-0 truncate">
                  {host}
                </span>
              )}
            </div>

            {item.tags.length > 0 && (
              <ul className="text-label text-muted mt-1.5 flex flex-wrap gap-x-2">
                {item.tags.map((tag) => (
                  <li key={tag} lang={langOf(tag)}>
                    {tag}
                  </li>
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

  // Narrow: the row carries everything, and the title gets the width. The tile
  // shrinks below sm, the host takes its own line, the title may wrap to two,
  // and Edit/Delete drop under the text on phones instead of claiming a column
  // beside it — on a 360px screen that column left the title 0px wide.
  return (
    <li className="row group grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4">
      <RowTile item={item} className="row-span-2 sm:row-span-1" />

      <div className="min-w-0">
        <h3
          lang={langOf(item.title)}
          className="text-title leading-thai text-ink line-clamp-2 font-serif break-words"
        >
          <a
            href={item.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded underline-offset-2 hover:underline ${focusRing}`}
          >
            {item.title}
          </a>
        </h3>
        {showHost && <p className="text-label text-muted truncate">{host}</p>}

        {item.description && (
          <p
            lang={langOf(item.description)}
            className="text-body text-muted mt-1 leading-relaxed"
          >
            {item.description}
          </p>
        )}

        {item.tags.length > 0 && (
          <ul className="text-label text-muted mt-1.5 flex flex-wrap gap-x-2">
            {item.tags.map((tag) => (
              <li key={tag} lang={langOf(tag)}>
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="row-actions col-start-2 mt-1 -ml-2 flex flex-wrap gap-1 transition-opacity duration-150 sm:col-start-auto sm:mt-0 sm:ml-0">
        <CollectionsButton
          item={item}
          filing={filing}
          open={filingOpen}
          onClick={() => setFilingOpen(!filingOpen)}
        />
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${item.title}`}
          className={`${quietButton} hover:text-ink`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${item.title}`}
          className={`${quietButton} hover:text-danger`}
        >
          Delete
        </button>
      </div>
      {filingOpen && (
        <CollectionsPanel
          item={item}
          filing={filing}
          className="border-border col-span-full mt-3 border-t pt-2"
        />
      )}
    </li>
  );
}

// A landscape leading tile on every tool row keeps the title column aligned:
// 112×64 from sm, 64×36 on phones where the title needs the width. Framed at
// the og:image's ~1.9:1 aspect (the 1200×630 spec default), so a real share
// image fills it. But og:images vary — square logos, portraits — so the image
// is object-contain, not cover: an odd ratio letterboxes on the tile bg and
// stays whole, instead of cropping to an unrecognizable sliver. Falls back to a
// host-letter monogram. Decorative throughout — the title carries the meaning,
// so the tile is aria-hidden.
const tileBase =
  "grid h-9 w-16 shrink-0 place-items-center overflow-hidden rounded border border-border bg-surface sm:h-16 sm:w-28";

function RowTile({ item, className = "" }: { item: Item; className?: string }) {
  const [broken, setBroken] = useState(false);

  if (item.image && !broken) {
    return (
      <div className={`${tileBase} ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- previews come
            from arbitrary bookmarked hosts that can't be enumerated for
            next/image's remotePatterns; a plain <img> loads from the origin. */}
        <img
          src={item.image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          // The bookmarked host learns nothing about where it's being shown.
          referrerPolicy="no-referrer"
          width={112}
          height={64}
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  const letter = (
    (item.kind === "place" ? item.title : hostOf(item.url ?? item.title))[0] ??
    "•"
  ).toUpperCase();
  return (
    <div
      className={`${tileBase} text-title sm:text-headline text-ink font-serif ${className}`}
      aria-hidden="true"
    >
      {letter}
    </div>
  );
}

// The preview pane — the right column of the desktop master–detail. It shows
// the selected tool at full size: the og:image the row can only thumbnail, the
// untruncated title, and the primary action (open it). This is what earns the
// second column its width. A rail with no real job here would be the SaaS
// filler the product bans, so the pane holds the actions the lean desktop rows
// dropped. Hidden below lg, where there's no room for it.
function DetailPane({
  item,
  containerRef,
  onEdit,
  onDelete,
  filing,
}: {
  item: Item;
  containerRef: React.RefObject<HTMLElement | null>;
  onEdit: () => void;
  onDelete: () => void;
  filing: Filing;
}) {
  const [filingOpen, setFilingOpen] = useState(false);
  return (
    <aside
      ref={containerRef}
      aria-label="Preview"
      // Esc hands focus back to the row this pane is showing, the way Enter
      // came in. preventDefault keeps the page's Esc (clear search) out of it.
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        document
          .querySelector<HTMLElement>('#kind-panel [aria-current="true"]')
          ?.focus();
      }}
      // self-start keeps the aside content-height; without it the flex row
      // stretches it to the full list height, leaving sticky no room to travel.
      className="hidden lg:sticky lg:top-10 lg:flex lg:w-96 lg:shrink-0 lg:flex-col lg:gap-4 lg:self-start"
    >
      <PreviewTile item={item} />

      <h2
        lang={langOf(item.title)}
        className="text-display text-ink font-serif leading-tight text-balance break-words"
      >
        {item.title}
      </h2>

      {item.url && (
        <div className="flex items-center gap-3">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`bg-accent text-body text-bg rounded px-4 py-2 font-medium transition-opacity duration-150 hover:opacity-90 ${focusRing}`}
          >
            Open <span aria-hidden="true">↗</span>
          </a>
          <span className="text-label text-muted truncate">
            {hostOf(item.url)}
          </span>
        </div>
      )}

      {item.description && (
        <p
          lang={langOf(item.description)}
          className="text-body text-ink leading-relaxed"
        >
          {item.description}
        </p>
      )}

      {item.tags.length > 0 && (
        <ul className="text-label text-muted flex flex-wrap gap-x-2 gap-y-1">
          {item.tags.map((tag) => (
            <li key={tag} lang={langOf(tag)}>
              {tag}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1 -ml-2 flex flex-wrap gap-1">
        <CollectionsButton
          item={item}
          filing={filing}
          open={filingOpen}
          onClick={() => setFilingOpen(!filingOpen)}
        />
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${item.title}`}
          className={`${quietButton} hover:text-ink`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${item.title}`}
          className={`${quietButton} hover:text-danger`}
        >
          Delete
        </button>
      </div>
      {filingOpen && <CollectionsPanel item={item} filing={filing} />}
    </aside>
  );
}

// A place in the All view: a serif title over its area and tags, and one
// action, which opens it on the map. No tile: a place has nothing to show in
// one that its name doesn't already say.
function PlaceLink({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const meta = [areaOf(item.address), ...item.tags].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`hover:bg-surface flex w-full items-center gap-4 px-3 py-4 text-left transition-colors duration-150 ${focusRing}`}
      >
        <span className="min-w-0 flex-1">
          <span
            lang={langOf(item.title)}
            className="text-title leading-thai text-ink line-clamp-2 block font-serif break-words sm:line-clamp-1"
          >
            {item.title}
          </span>
          {meta && (
            <span
              lang={langOf(meta)}
              className="text-label text-muted mt-0.5 block truncate"
            >
              {meta}
            </span>
          )}
        </span>
        <span
          className={`text-label hidden shrink-0 font-medium sm:inline ${item.lat === null ? "text-muted" : "text-accent"}`}
        >
          {item.lat === null ? "Not on the map" : "Show on map"}
        </span>
        <span
          aria-hidden="true"
          className="text-title text-muted shrink-0 sm:hidden"
        >
          ›
        </span>
      </button>
    </li>
  );
}

// Full-size counterpart to RowTile: the og:image at a readable size, or the same
// monogram fallback scaled up to the pane's ~1.9:1 frame.
function PreviewTile({ item }: { item: Item }) {
  const [broken, setBroken] = useState(false);
  const base =
    "grid aspect-[1.9] w-full place-items-center overflow-hidden rounded border border-border bg-surface";

  if (item.image && !broken) {
    return (
      <div className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary
            bookmarked hosts can't be enumerated for next/image; see RowTile. */}
        <img
          src={item.image}
          alt=""
          aria-hidden="true"
          // Above the fold whenever the pane shows, so it loads eagerly.
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  const letter = (
    (item.kind === "place" ? item.title : hostOf(item.url ?? item.title))[0] ??
    "•"
  ).toUpperCase();
  return (
    <div
      className={`${base} text-display text-ink font-serif`}
      aria-hidden="true"
    >
      {letter}
    </div>
  );
}

function Empty({
  hasItems,
  query,
  filtered,
  onAdd,
  onClear,
  onSaveQuery,
}: {
  hasItems: boolean;
  query: string;
  filtered: boolean;
  onAdd: () => void;
  onClear: () => void;
  onSaveQuery: () => void;
}) {
  if (hasItems) {
    return (
      <div className="mt-16 text-center">
        <p className="text-title text-ink font-serif">Nothing matches that.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={onClear}
            className={`text-label text-accent rounded font-medium underline underline-offset-2 ${focusRing}`}
          >
            {query && filtered
              ? "Clear search and filters"
              : query
                ? "Clear the search"
                : "Clear the filters"}
          </button>
          {/* Not finding it is the cue to save it. */}
          {query && (
            <button
              type="button"
              onClick={onSaveQuery}
              className={`text-label text-accent max-w-full truncate rounded font-medium underline underline-offset-2 ${focusRing}`}
            >
              Save “{query}”
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-16 max-w-md">
      <p className="text-title text-ink font-serif">Your stash is empty.</p>
      <p className="text-body text-muted mt-2">
        Three things live here. A{" "}
        <strong className="text-ink font-semibold">tool</strong> is a link you
        keep losing. A{" "}
        <strong className="text-ink font-semibold">formula</strong> is a command
        you keep re-deriving. A{" "}
        <strong className="text-ink font-semibold">place</strong> is a maps link
        to somewhere you mean to go.
      </p>
      {/* Keyboard shortcuts mean nothing on a phone. */}
      <p className="text-body text-muted mt-4 pointer-coarse:hidden">
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
        className={`bg-accent text-body text-bg mt-6 rounded px-4 py-2 font-medium transition-opacity duration-150 hover:opacity-90 ${focusRing}`}
      >
        Save your first
      </button>
    </div>
  );
}

// The label that separates the two kinds in the "All" view. Ink and semibold —
// a content-structure beat that deliberately carries more weight than the muted
// filter-furniture (the rail's "Kind"/"Tags" headings), so the list reads as
// grouped at a glance. Still sentence-case sans, not the banned eyebrow. The
// count stays muted so the name leads. `quiet` keeps it for screen readers only
// when a single-kind tab already says what the list holds, so the heading
// outline (h2 section, h3 items) holds in every view.
function SectionHeading({
  count,
  quiet,
  children,
}: {
  count: number;
  quiet: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        quiet
          ? "sr-only"
          : "border-border mb-4 flex items-baseline gap-2 border-b pb-2"
      }
    >
      <h2 className="text-label text-ink font-semibold">{children}</h2>
      <span className="text-label text-muted tabular-nums">{count}</span>
    </div>
  );
}

// A formula rendered as what it is: a line you run in a console. Always-dark
// terminal chrome (the term-* tokens don't flip with the app theme), a teal ❯
// prompt, the command in mono, and a copy button — the retrieval act for a
// formula. Three monochrome dots read as a window without dragging the garish
// traffic-light primaries into a cool-neutral palette. Edit/Delete ride the
// same hover-reveal .row-actions as a tool row; on touch they stay visible.
function FormulaCard({
  item,
  onEdit,
  onDelete,
  filing,
}: {
  item: Item;
  onEdit: () => void;
  onDelete: () => void;
  filing: Filing;
}) {
  const [filingOpen, setFilingOpen] = useState(false);
  const cmd = item.cmd ?? "";
  // A title left blank defaults to the command's first line; printing it in
  // the title bar too would show the command twice.
  const defaulted = item.title === titleOr("", null, cmd);

  return (
    <li className="row group">
      {/* The console card; its Collections list opens below it, in page
          colours, so the pinned console never holds a page field. */}
      <div className="term border-term-border overflow-hidden rounded-lg border">
        {/* The title takes the bar; on a phone Edit/Delete wrap beneath it
          rather than squeezing it into a column of three-word lines. */}
        <div className="bg-term-surface flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <span aria-hidden="true" className="flex shrink-0 gap-1.5">
            <span className="bg-term-border size-2.5 rounded-full" />
            <span className="bg-term-border size-2.5 rounded-full" />
            <span className="bg-term-border size-2.5 rounded-full" />
          </span>
          <h3
            lang={langOf(item.title)}
            className={
              defaulted
                ? "sr-only"
                : "text-label text-term-muted min-w-0 flex-[1_1_10rem] font-mono break-words"
            }
          >
            {item.title}
          </h3>
          <div className="row-actions ml-auto flex shrink-0 gap-1 transition-opacity duration-150">
            <CollectionsButton
              item={item}
              filing={filing}
              open={filingOpen}
              onClick={() => setFilingOpen(!filingOpen)}
              className={`text-label text-term-muted hover:text-term-ink focus-visible:outline-term-accent inline-flex items-center rounded px-2 py-0.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${touch}`}
            />
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${item.title}`}
              className={`text-label text-term-muted hover:text-term-ink focus-visible:outline-term-accent inline-flex items-center rounded px-2 py-0.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${touch}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${item.title}`}
              className={`text-label text-term-muted hover:text-term-danger focus-visible:outline-term-accent inline-flex items-center rounded px-2 py-0.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${touch}`}
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
            {/* Never wraps; scroll-fade dims the edge that has more to scroll. */}
            <code className="text-body text-term-ink scroll-fade min-w-0 flex-1 overflow-x-auto font-mono leading-relaxed whitespace-pre">
              {cmd}
            </code>
            <CopyButton
              text={cmd}
              className={`text-label focus-visible:outline-term-accent inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${touch}`}
            />
          </div>

          {item.description && (
            <p
              lang={langOf(item.description)}
              className="text-label text-term-muted mt-2 pl-6 font-mono"
            >
              # {item.description}
            </p>
          )}

          {item.tags.length > 0 && (
            <ul className="text-label text-term-muted mt-2 flex flex-wrap gap-x-3 pl-6 font-mono">
              {item.tags.map((tag) => (
                <li key={tag} lang={langOf(tag)}>
                  #{tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {filingOpen && (
        <CollectionsPanel item={item} filing={filing} className="mt-2 px-1" />
      )}
    </li>
  );
}

// A panel with its left column: the filter rail, open or tucked away.
function PanelIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}
