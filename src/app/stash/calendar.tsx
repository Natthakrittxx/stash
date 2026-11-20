"use client";

import { useState } from "react";

import {
  formatDay,
  formatMonth,
  formatWhen,
  monthGrid,
  onDay,
  wallNow,
} from "~/events";

import { CollectionsButton, CollectionsPanel, type Filing } from "./places";
import type { Item } from "./stash";
import { focusRing, langOf, quietButton, touch } from "./ui";

export type EventItem = Item & { startsAt: string };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const cellFocus =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
const pad = (n: number) => String(n).padStart(2, "0");

// The Events view: a month grid to see what's on when, and beneath it the
// agenda of the month (or the picked day), where each event's actions live.
// Rendered only in the browser after a tab switch, so "today" is the
// visitor's own day, never the server's.
export function EventCalendar({
  events,
  focus,
  filing,
  onEdit,
  onDelete,
}: {
  events: EventItem[];
  // A "YYYY-MM-DD" to open on, picked; otherwise this month, nothing picked.
  focus: string | null;
  filing: Filing;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}) {
  const [today] = useState(() => wallNow().slice(0, 10));
  const start = focus ?? today;
  const [month, setMonth] = useState({
    y: Number(start.slice(0, 4)),
    m: Number(start.slice(5, 7)) - 1,
  });
  const [day, setDay] = useState<string | null>(focus);

  const prefix = `${month.y}-${pad(month.m + 1)}`;
  const sorted = [...events].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );
  const inMonth = (e: EventItem) =>
    e.startsAt.slice(0, 7) <= prefix &&
    (e.endsAt ?? e.startsAt).slice(0, 7) >= prefix;
  const shown = day
    ? sorted.filter((e) => onDay(e, day))
    : sorted.filter(inMonth);
  // An empty month points at the nearest one with something in it.
  const jump = shown.length
    ? null
    : (sorted.find((e) => e.startsAt.slice(0, 7) > prefix) ??
      [...sorted]
        .reverse()
        .find((e) => (e.endsAt ?? e.startsAt).slice(0, 7) < prefix));

  function go(y: number, m: number, pick: string | null = null) {
    const d = new Date(Date.UTC(y, m, 1));
    setMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
    setDay(pick);
  }

  const monthName = formatMonth(month.y, month.m);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-title text-ink font-serif" aria-live="polite">
          {monthName}
        </h3>
        <div className="-mr-2 flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => go(month.y, month.m - 1)}
            aria-label="Previous month"
            className={`${quietButton} hover:text-ink`}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() =>
              go(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1)
            }
            className={`${quietButton} hover:text-ink`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => go(month.y, month.m + 1)}
            aria-label="Next month"
            className={`${quietButton} hover:text-ink`}
          >
            ›
          </button>
        </div>
      </div>

      <div className="border-border mt-3 grid grid-cols-7 border-t border-l">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            aria-hidden="true"
            className="border-border text-label text-muted border-r border-b px-1.5 py-1"
          >
            {w}
          </div>
        ))}
        {monthGrid(month.y, month.m).map((d) => {
          const on = sorted.filter((e) => onDay(e, d));
          const picked = d === day;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={picked}
              aria-label={`${formatDay(d)}${isToday ? ", today" : ""}${on.length ? `, ${on.length} ${on.length === 1 ? "event" : "events"}` : ""}`}
              onClick={() => setDay(picked ? null : d)}
              className={`border-border flex min-h-12 min-w-0 flex-col gap-0.5 border-r border-b p-1 text-left transition-colors duration-150 sm:min-h-20 ${
                picked
                  ? "bg-surface ring-accent ring-2 ring-inset"
                  : "hover:bg-surface"
              } ${cellFocus}`}
            >
              <span
                className={`text-label self-start rounded px-1 tabular-nums ${
                  isToday
                    ? "bg-accent text-bg font-semibold"
                    : d.startsWith(prefix)
                      ? "text-ink"
                      : "text-muted"
                }`}
              >
                {Number(d.slice(8))}
              </span>
              {/* Titles where a cell has room for them; a dot on a phone. */}
              {on.slice(0, 2).map((e) => (
                <span
                  key={e.id}
                  lang={langOf(e.title)}
                  className="text-label text-ink hidden truncate sm:block"
                >
                  {e.title}
                </span>
              ))}
              {on.length > 2 && (
                <span className="text-label text-muted hidden sm:block">
                  +{on.length - 2} more
                </span>
              )}
              {on.length > 0 && (
                <span
                  aria-hidden="true"
                  className="bg-accent ml-1 size-1.5 rounded-full sm:hidden"
                />
              )}
            </button>
          );
        })}
      </div>

      <section className="mt-8">
        <div className="border-border mb-2 flex items-baseline justify-between gap-3 border-b pb-2">
          <h3 className="text-label text-ink font-semibold">
            {day ? formatDay(day) : `All of ${monthName}`}
          </h3>
          {day && (
            <button
              type="button"
              onClick={() => setDay(null)}
              className={`${quietButton} hover:text-ink -mr-2`}
            >
              Whole month
            </button>
          )}
        </div>
        {shown.length > 0 ? (
          <ul className="divide-border divide-y">
            {shown.map((e) => (
              <EventRow
                key={e.id}
                item={e}
                filing={filing}
                onEdit={() => onEdit(e)}
                onDelete={() => onDelete(e)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-label text-muted mt-4">
            {day ? "Nothing on this day." : `Nothing on in ${monthName}.`}{" "}
            {jump && (
              <button
                type="button"
                onClick={() =>
                  go(
                    Number(jump.startsAt.slice(0, 4)),
                    Number(jump.startsAt.slice(5, 7)) - 1,
                    jump.startsAt.slice(0, 10),
                  )
                }
                className={`text-accent rounded font-medium underline underline-offset-2 ${touch} ${focusRing}`}
              >
                Go to {jump.title}
              </button>
            )}
          </p>
        )}
      </section>
    </div>
  );
}

function EventRow({
  item,
  filing,
  onEdit,
  onDelete,
}: {
  item: EventItem;
  filing: Filing;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [filingOpen, setFilingOpen] = useState(false);
  const meta = [item.address, ...item.tags].filter(Boolean).join(" · ");
  const title = (
    <>
      {item.title}
      {item.url && <span className="sr-only"> (opens in a new tab)</span>}
    </>
  );
  return (
    <li className="px-3 py-3">
      <p className="text-label text-accent font-medium tabular-nums">
        {formatWhen(item.startsAt, item.endsAt)}
      </p>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            lang={langOf(item.title)}
            className={`text-title leading-thai text-ink min-w-0 flex-[1_1_10rem] truncate rounded font-serif underline-offset-2 hover:underline ${focusRing}`}
          >
            {title}
          </a>
        ) : (
          <span
            lang={langOf(item.title)}
            className="text-title leading-thai text-ink min-w-0 flex-[1_1_10rem] truncate font-serif"
          >
            {title}
          </span>
        )}
        <span className="-mx-2 flex shrink-0 gap-1">
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
          <CollectionsButton
            item={item}
            filing={filing}
            open={filingOpen}
            onClick={() => setFilingOpen(!filingOpen)}
          />
        </span>
      </div>
      {meta && (
        <p
          lang={langOf(meta)}
          className="text-label text-muted mt-0.5 truncate"
        >
          {meta}
        </p>
      )}
      {item.description && (
        <p
          lang={langOf(item.description)}
          className="text-body text-muted mt-1"
        >
          {item.description}
        </p>
      )}
      {filingOpen && <CollectionsPanel item={item} filing={filing} />}
    </li>
  );
}
