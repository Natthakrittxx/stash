import Link from "next/link";

import { StashMark } from "~/app/stash-mark";
import { focusRing, touch } from "~/app/stash/ui";

export function SubPageHeader() {
  return (
    <header className="flex items-center justify-between gap-4">
      <Link
        href="/stash"
        className={`text-title text-ink flex w-fit items-center gap-2 rounded font-serif leading-none ${focusRing}`}
      >
        <StashMark className="size-[1.1em] rounded-[2px]" />
        Stash
      </Link>
      <Link
        href="/stash"
        className={`text-label text-muted hover:text-ink inline-flex shrink-0 items-center gap-1 rounded px-1 font-medium ${touch} ${focusRing}`}
      >
        <span aria-hidden="true">←</span>
        Back to stash
      </Link>
    </header>
  );
}
