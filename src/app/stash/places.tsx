"use client";

import { useState, useTransition } from "react";

import { areaOf, isMapsLink } from "~/maps";

import type { Account, Collection, Item } from "./stash";
import { field, focusRing, langOf, quietButton, touch } from "./ui";

const metres = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function formatDistance(m: number) {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${metres.format(m >= 10_000 ? Math.round(m / 1000) : m / 1000)} km`;
}

// The row names the area and the tags; the street address is on the card.
const metaOf = (item: Item) =>
  [areaOf(item.address), ...item.tags].filter(Boolean).join(" · ");

// One place in the index: a selector for the map, like a desktop tool row.
// Focus follows selection, ↑/↓ walk the list, Enter goes to the map card's
// first action, and hovering rings the pin.
export function PlaceRow({
  item,
  selected,
  distance,
  onSelect,
  onFocus,
  onHover,
  onActivate,
}: {
  item: Item;
  selected: boolean;
  distance: string | null;
  onSelect: () => void;
  /** Selects without reopening a card that Esc just closed. */
  onFocus: () => void;
  onHover: (id: string | null) => void;
  onActivate: () => void;
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const li = event.currentTarget.closest("li");
      const next =
        event.key === "ArrowDown"
          ? li?.nextElementSibling
          : li?.previousElementSibling;
      next?.querySelector("button")?.focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      onActivate();
    }
  }
  const meta = metaOf(item);

  return (
    // The narrow layout's map is sticky over the top half of the screen, so a
    // row scrolled into view lands below it.
    <li
      id={`place-${item.id}`}
      className="scroll-mt-[calc(50dvh+0.5rem)] lg:scroll-mt-2"
    >
      <button
        type="button"
        onClick={onSelect}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onPointerEnter={() => onHover(item.id)}
        onPointerLeave={() => onHover(null)}
        aria-current={selected ? "true" : undefined}
        className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-150 ${focusRing} ${
          selected ? "bg-surface" : "hover:bg-surface"
        }`}
      >
        <span className="min-w-0 flex-1">
          <span
            lang={langOf(item.title)}
            className={`text-title leading-thai text-ink block truncate font-serif ${
              selected ? "font-semibold" : ""
            }`}
          >
            {item.title}
          </span>
          {meta && (
            <span
              lang={langOf(meta)}
              className="text-label text-muted block truncate"
            >
              {meta}
            </span>
          )}
        </span>
        {distance && (
          <span className="text-label text-muted shrink-0 tabular-nums">
            {distance}
          </span>
        )}
        {/* Selection is never colour alone: the chevron appears, in accent. */}
        <span
          aria-hidden="true"
          className={`text-title shrink-0 ${selected ? "text-accent" : "text-transparent"}`}
        >
          ›
        </span>
      </button>
    </li>
  );
}

// A place whose link carried no pin: listed, never lost, with the one action
// that puts it on the map.
export function UnpinnedRow({
  item,
  filing,
  onPin,
  onEdit,
  onDelete,
}: {
  item: Item;
  filing: Filing;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3">
      <a
        href={item.url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        lang={langOf(item.title)}
        className={`text-title leading-thai text-ink min-w-0 flex-[1_1_10rem] truncate rounded font-serif underline-offset-2 hover:underline ${focusRing}`}
      >
        {item.title}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <span className="-mx-2 flex shrink-0 items-center gap-1">
        {item.savedBy !== null ? (
          <SavedBy item={item} filing={filing} />
        ) : (
          <>
            <button
              type="button"
              onClick={onPin}
              aria-label={`Set location of ${item.title}`}
              className={`${quietButton} text-accent underline underline-offset-2`}
            >
              Set location
            </button>
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
          </>
        )}
      </span>
    </li>
  );
}

// Filing any item into collections: a "Collections (n)" button that sits with
// the item's other actions, and the checklist it discloses, placed by the
// parent (beneath the actions, or beneath a formula's console card).
export type Filing = {
  collections: Collection[];
  // The collection on screen, if any: the only place someone else's item shows.
  open: Collection | null;
  onToggle: (collectionId: string, itemId: string, member: boolean) => void;
  onCreate: (name: string) => Promise<string | undefined>;
};

// Someone else's item in a shared collection: who saved it, and the one thing
// anyone in the collection may do to it. Edit, Delete and filing stay theirs
// (ADR 0003).
export function SavedBy({
  item,
  filing,
  labelClass = "text-label text-muted px-2",
  className = `${quietButton} hover:text-ink`,
}: {
  item: Item;
  filing: Filing;
  labelClass?: string;
  className?: string;
}) {
  const here = filing.open;
  return (
    <>
      <span lang={langOf(item.savedBy ?? "")} className={labelClass}>
        Saved by {item.savedBy}
      </span>
      {here && (
        <button
          type="button"
          onClick={() => filing.onToggle(here.id, item.id, false)}
          aria-label={`Take ${item.title} out of ${here.name}`}
          className={className}
        >
          Take out
        </button>
      )}
    </>
  );
}

// Beside a shared collection's name, so you know before filing that others
// will see it.
export function SharedMark() {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="6" cy="5.5" r="2.25" />
        <path d="M1.75 13.5c.5-2.4 2.2-3.75 4.25-3.75s3.75 1.35 4.25 3.75" />
        <path d="M10.5 3.5a2.25 2.25 0 0 1 0 4.25M12 9.9c1.2.5 2 1.7 2.25 3.6" />
      </svg>
      <span className="sr-only"> (shared)</span>
    </>
  );
}

export function CollectionsButton({
  item,
  filing,
  open,
  onClick,
  className = `${quietButton} hover:text-ink`,
}: {
  item: Item;
  filing: Filing;
  open: boolean;
  onClick: () => void;
  className?: string;
}) {
  const count = filing.collections.filter((c) =>
    c.itemIds.includes(item.id),
  ).length;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={`collections-${item.id}`}
      onClick={onClick}
      className={className}
    >
      Collections{count > 0 && ` (${count})`}
    </button>
  );
}

export function CollectionsPanel({
  item,
  filing,
  className = "border-border mt-2 border-t pt-2",
}: {
  item: Item;
  filing: Filing;
  className?: string;
}) {
  return (
    <fieldset id={`collections-${item.id}`} className={className}>
      <legend className="sr-only">Collections for {item.title}</legend>
      {filing.collections.map((c) => (
        <label
          key={c.id}
          className={`text-label text-ink flex items-center gap-2 py-1 ${touch}`}
        >
          <input
            type="checkbox"
            checked={c.itemIds.includes(item.id)}
            onChange={(e) => filing.onToggle(c.id, item.id, e.target.checked)}
            className={`accent-accent size-4 shrink-0 rounded ${focusRing}`}
          />
          <span lang={langOf(c.name)} className="truncate">
            {c.name}
          </span>
          {c.collaborators.length > 0 && <SharedMark />}
        </label>
      ))}
      <NewCollection
        label="New collection"
        onCreate={async (name) => {
          const id = await filing.onCreate(name);
          if (id) filing.onToggle(id, item.id, true);
          return id;
        }}
      />
    </fieldset>
  );
}

// What the selected pin opens: the place, how to get there, and where it's
// filed. Esc closes it and hands focus back to its row.
export function PlaceCard({
  item,
  filing,
  onEdit,
  onDelete,
  onClose,
}: {
  item: Item;
  filing: Filing;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        // Marks it handled, so the page's own Esc (clear search) stays out.
        event.preventDefault();
        onClose();
      }}
      // The popup has no name of its own; the place gives it one.
      role="group"
      aria-label={item.title}
      className="flex flex-col"
    >
      <p
        lang={langOf(item.title)}
        className="text-title text-ink font-serif leading-snug font-semibold"
      >
        {item.title}
      </p>
      {item.address && (
        <p lang={langOf(item.address)} className="text-label text-muted mt-0.5">
          {item.address}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1">
        <a
          href={item.url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-label text-accent mr-1 inline-flex items-center rounded font-medium underline underline-offset-2 ${touch} ${focusRing}`}
        >
          {item.url && isMapsLink(item.url) ? "Open in Maps" : "Open"}
          <span aria-hidden="true">&nbsp;↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        {item.savedBy !== null ? (
          <SavedBy item={item} filing={filing} />
        ) : (
          <>
            <CollectionsButton
              item={item}
              filing={filing}
              open={open}
              onClick={() => setOpen(!open)}
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
          </>
        )}
      </div>

      {open && <CollectionsPanel item={item} filing={filing} />}
    </div>
  );
}

// "+ New" for a collection: a name field in place, no modal. Enter creates,
// Esc puts the button back.
export function NewCollection({
  label,
  onCreate,
  className = "",
}: {
  label: string;
  onCreate: (name: string) => Promise<string | undefined>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${quietButton} text-accent underline underline-offset-2 ${className}`}
      >
        + {label}
      </button>
    );

  return (
    <form
      noValidate
      // Proton Pass classifies forms and skips one carrying this (its content
      // script checks the form, not the field): a lone text field otherwise
      // reads to it as a login and gets its autofill badge.
      data-protonpass-ignore=""
      className={`mt-0.5 flex flex-col gap-1 ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem(
          "collection",
        ) as HTMLInputElement;
        const name = input.value.trim();
        if (!name) return setError("Name the collection first.");
        startSaving(async () => {
          const id = await onCreate(name);
          if (!id)
            return setError("That collection couldn't be saved. Try again.");
          setOpen(false);
          setError(null);
        });
      }}
    >
      {/* A rail row you type into: the same height and text size, and an
          invisible ✓ slot so the name lines up with the collections above. */}
      <div
        className={`text-label bg-bg flex items-center gap-1.5 rounded border px-2 py-[9px] lg:py-[5px] ${touch} focus-within:ring-1 ${
          error
            ? "border-danger focus-within:ring-danger"
            : "border-field focus-within:border-accent focus-within:ring-accent"
        }`}
      >
        <span aria-hidden="true" className="invisible">
          ✓
        </span>
        <input
          // Not "name": password managers read a lone "name" field as a login
          // and badge it for autofill. This is a label for a trip, not a person.
          name="collection"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          // The one field that appears on demand: put the cursor in it.
          autoFocus
          maxLength={80}
          aria-label="Collection name"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-collection-error" : undefined}
          placeholder="Collection name"
          disabled={saving}
          onChange={() => setError(null)}
          // Clicking away from an empty field puts the "+ New" button back.
          onBlur={(e) => {
            if (e.currentTarget.value.trim() || saving) return;
            setOpen(false);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            setError(null);
          }}
          className="text-ink placeholder:text-muted min-w-0 flex-1 bg-transparent font-normal outline-none"
        />
      </div>
      {error && (
        <p
          id="new-collection-error"
          role="alert"
          className="text-label text-danger"
        >
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}
    </form>
  );
}

// The list's name: the open collection, or the kind showing. Every view has
// one, so the search and list sit at the same height wherever you are. A
// collection's Creator deletes it and picks who shares it from here; a
// Collaborator leaves from here. Its things stay in their savers' stashes.
const andList = new Intl.ListFormat("en", { type: "conjunction" });

export function IndexHeading({
  collection,
  accounts,
  fallback,
  onDelete,
  onLeave,
  onAdd,
  onRemove,
}: {
  collection: Collection | null;
  accounts: Account[];
  fallback: string;
  onDelete: () => void;
  onLeave: () => void;
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [people, setPeople] = useState(false);
  const name = collection?.name ?? fallback;
  const collaborators = collection?.collaborators ?? [];
  const names = andList.format(collaborators.map((c) => c.name));
  const addable = accounts.filter(
    (a) => !collaborators.some((c) => c.id === a.id),
  );

  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          lang={langOf(name)}
          className="text-headline text-ink min-w-0 truncate font-serif"
        >
          {name}
        </h2>
        {collection && !confirming && (
          <div className="-mr-2 flex shrink-0 gap-1">
            {collection.mine && (
              <button
                type="button"
                aria-expanded={people}
                aria-controls="collection-people"
                onClick={() => setPeople(!people)}
                className={`${quietButton} hover:text-ink`}
              >
                People
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={`${quietButton} hover:text-danger`}
            >
              {collection.mine ? "Delete collection" : "Leave"}
            </button>
          </div>
        )}
      </div>
      {collection && collaborators.length > 0 && (
        <p className="text-label text-muted mt-1">
          {collection.mine
            ? `Shared with ${names}`
            : `Shared by ${collection.creator} with ${names}`}
        </p>
      )}
      {collection && confirming && (
        <div className="text-label mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-ink">
            {!collection.mine
              ? `Leave “${collection.name}”? Your things in it leave with you and stay in your stash.`
              : collaborators.length > 0
                ? `Delete “${collection.name}” for everyone in it? Everything stays in the stash of whoever saved it.`
                : `Delete “${collection.name}”? Its places stay in your stash.`}
          </span>
          <button
            type="button"
            onClick={collection.mine ? onDelete : onLeave}
            className={`text-danger rounded font-medium underline underline-offset-2 ${touch} ${focusRing}`}
          >
            {collection.mine ? "Delete" : "Leave"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className={`${quietButton} hover:text-ink -ml-2`}
          >
            Cancel
          </button>
        </div>
      )}
      {collection?.mine && people && (
        <div
          id="collection-people"
          className="border-border text-label mt-2 border-t pt-2"
        >
          {/* The picker sits above the list, so a new person's row (and its
              Remove) never lands under the pointer that just pressed Add. */}
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const id = new FormData(event.currentTarget).get("account");
              if (typeof id !== "string" || !id) return;
              onAdd(id);
              event.currentTarget.reset();
            }}
          >
            <label htmlFor="add-person" className="sr-only">
              Add someone to {collection.name}
            </label>
            {/* Stays in place when no one is left to add, so the list below
                  never jumps. */}
            <select
              id="add-person"
              name="account"
              required
              defaultValue=""
              disabled={addable.length === 0}
              className={`${field} min-w-0 flex-1 py-1.5 disabled:opacity-60`}
            >
              <option value="" disabled>
                {addable.length > 0
                  ? "Add someone…"
                  : accounts.length === 0
                    ? "No one else has an account here yet"
                    : "Everyone here is already in it"}
              </option>
              {addable.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.email}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={addable.length === 0}
              className={`${quietButton} text-accent -mr-2 shrink-0 underline underline-offset-2 disabled:opacity-60`}
            >
              Add
            </button>
          </form>
          {collaborators.length > 0 && (
            <ul aria-label={`People in ${collection.name}`} className="mt-1">
              {collaborators.map((p) => (
                <li
                  key={p.id}
                  className="text-ink flex items-center justify-between gap-2"
                >
                  <span lang={langOf(p.name)} className="truncate">
                    {p.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    aria-label={`Remove ${p.name} from ${collection.name}`}
                    className={`${quietButton} hover:text-danger -mr-2`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
