// Class strings and helpers shared by the stash list (stash.tsx) and the places
// view (places.tsx).

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
// Touch-sized hit area on coarse pointers (WCAG 2.5.5); a mouse keeps the
// density. Pair with inline-flex/flex + items-center so the label stays centred.
export const touch = "pointer-coarse:min-h-11";
// Text fields mark focus on their own edge rather than with the offset ring
// buttons and links use: the border turns teal and a flush 1px ring doubles it
// to 2px, so it still reads at a glance (WCAG 2.4.7). Red for an invalid one.
export const fieldFocus =
  "focus-visible:outline-hidden focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:border-danger aria-[invalid=true]:focus-visible:ring-danger";
export const field = `w-full rounded border border-field bg-bg px-3 py-2 text-body pointer-coarse:text-base font-normal text-ink placeholder:text-muted ${fieldFocus}`;
export const quietButton = `inline-flex items-center rounded px-2 py-1 text-label font-medium text-muted ${touch} ${focusRing}`;

// Thai script. Marking Thai text lang="th" gives a screen reader the right voice
// and lets the :lang(th) leading rule in globals.css apply.
export const langOf = (s: string) => (/[฀-๿]/.test(s) ? "th" : undefined);
