// The skeleton that DESIGN.md:94 asks for. It covers the RSC fetch above,
// which is the only loading state this route has.
export default function Loading() {
  return (
    <div className="px-4 py-10 sm:px-6" aria-busy="true">
      <div className="h-6 w-24 animate-pulse rounded bg-surface" />
      <div className="mt-8 h-10 w-full animate-pulse rounded bg-surface" />
      <ul className="mt-6 divide-y divide-border border-t border-border">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="flex flex-col gap-2 py-4">
            <div className="h-5 w-1/3 animate-pulse rounded bg-surface" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface" />
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading your stash…</span>
    </div>
  );
}
