// The skeleton that DESIGN.md:94 asks for. It covers the RSC fetch above,
// which is the only loading state this route has. It traces the real layout —
// header, rail and preview pane from lg, the search row, the composer bar, and
// rows that lead with the tile — so the page settles in place instead of
// jumping when the list streams in.
const block = "animate-pulse rounded bg-surface";

export default function Loading() {
  return (
    <div className="px-4 py-10 sm:px-6" aria-busy="true">
      <div className="flex items-center justify-between gap-4">
        <div className={`${block} h-[1.875rem] w-32`} />
        <div className={`${block} h-9 w-40`} />
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-10">
        <div className="hidden w-52 shrink-0 flex-col gap-1.5 lg:flex">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${block} h-7 w-full`} />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex gap-2">
            <div className={`${block} h-12 w-28 shrink-0`} />
            <div className={`${block} h-12 flex-1`} />
          </div>
          <div className={`${block} mt-6 h-11 w-full`} />
          <ul className="divide-border mt-6 divide-y">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-start gap-3 py-4 sm:gap-4">
                <div className={`${block} h-9 w-16 shrink-0 sm:h-16 sm:w-28`} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className={`${block} h-5 w-1/2`} />
                  <div className={`${block} h-4 w-1/3`} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden w-96 shrink-0 flex-col gap-4 lg:flex">
          <div className={`${block} aspect-[1.9] w-full`} />
          <div className={`${block} h-8 w-2/3`} />
          <div className={`${block} h-10 w-24`} />
        </div>
      </div>
      <span className="sr-only">Loading your stash…</span>
    </div>
  );
}
