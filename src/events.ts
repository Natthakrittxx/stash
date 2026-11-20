// An event keeps the wall-clock time it was saved with ("19:00 in Tokyo") as
// "YYYY-MM-DDTHH:MM" with no zone: the string a datetime-local input reads and
// writes, and what a `timestamp without time zone` column holds. No zone means
// no conversion, so the server and the browser always render the same text.

const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** A real wall time: shaped right and a date the calendar has (no 30 Feb). */
export function isWallTime(s: string) {
  if (!WALL.test(s)) return false;
  const d = new Date(`${s}Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 16) === s;
}

/** The visitor's own clock as a wall time. Browser only: the server's zone is not theirs. */
export function wallNow(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
}

// Every format reads the wall time as UTC and prints it as UTC: no zone shift,
// and a fixed locale so the server's render matches the browser's.
const fmt = (o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o });
const dayFmt = fmt({
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFmt = fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const longDayFmt = fmt({
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const monthFmt = fmt({ month: "long", year: "numeric" });
const utc = (s: string) => new Date(`${s.length === 10 ? `${s}T00:00` : s}Z`);

/** "Fri, 20 Nov 2026, 19:00–21:00", the end's day only when it differs. */
export function formatWhen(start: string, end: string | null) {
  const s = utc(start);
  const head = `${dayFmt.format(s)}, ${timeFmt.format(s)}`;
  if (!end) return head;
  const e = utc(end);
  return end.slice(0, 10) === start.slice(0, 10)
    ? `${head}–${timeFmt.format(e)}`
    : `${head} – ${dayFmt.format(e)}, ${timeFmt.format(e)}`;
}

export const formatTime = (s: string) => timeFmt.format(utc(s));
export const formatDay = (day: string) => longDayFmt.format(utc(day));
export const formatMonth = (y: number, m: number) =>
  monthFmt.format(new Date(Date.UTC(y, m, 1)));

/** The "YYYY-MM-DD" days of the whole weeks (Monday first) covering a month. */
export function monthGrid(y: number, m: number): string[] {
  const first = new Date(Date.UTC(y, m, 1));
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const last = new Date(Date.UTC(y, m + 1, 0));
  const days: string[] = [];
  for (
    const d = start;
    d <= last || days.length % 7 !== 0;
    d.setUTCDate(d.getUTCDate() + 1)
  )
    days.push(d.toISOString().slice(0, 10));
  return days;
}

/** Whether an event is on a day: from its start's day through its end's. */
export function onDay(
  e: { startsAt: string; endsAt: string | null },
  day: string,
) {
  const from = e.startsAt.slice(0, 10);
  const to = (e.endsAt ?? e.startsAt).slice(0, 10);
  return from <= day && day <= to;
}
