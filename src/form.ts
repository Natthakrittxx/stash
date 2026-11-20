/** `FormData.get` returns `string | File`. A File stringifies to garbage. */
export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Whether a pasted line is a link (a tool) rather than a command (a formula):
 * a URL with a scheme, or a bare host with an optional port and path. A command
 * has spaces or starts with `.`/`/`, so `./run.sh` and `rg -i x` stay commands.
 */
export function looksLikeLink(s: string) {
  return /^(https?:\/\/\S+|[\w-]+(\.[\w-]+)+(:\d+)?([/?#]\S*)?)$/i.test(
    s.trim(),
  );
}

/** A blank title falls back to the site's host or the command's first line. */
export function titleOr(title: string, url: string | null, cmd: string | null) {
  if (title) return title;
  if (url) {
    try {
      const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url)
        ? url
        : `https://${url}`;
      return new URL(withScheme).host.replace(/^www\./, "");
    } catch {
      return url.slice(0, 200);
    }
  }
  return (cmd ?? "").split("\n")[0]!.trim().slice(0, 200);
}

/** A tag's one spelling, so "Git" and "git" are the same tag (CONTEXT.md). */
export function tagOf(s: string) {
  return s.trim().toLowerCase();
}

/** What's wrong with a tag's name, if anything: one rule for server and form. */
export function tagProblem(name: string) {
  if (!name) return "Name the tag first.";
  if (name.length > 32) return "32 characters at most.";
  // An item's tags travel as one comma-separated field.
  if (name.includes(",")) return "Tags can't contain commas.";
  return null;
}

/** Comma-separated tags, each once, in the order typed. */
export function tagsFrom(s: string) {
  return [...new Set(s.split(",").map(tagOf).filter(Boolean))];
}

/**
 * The tag picker's line: your tags not yet picked, most used first. Typing
 * narrows it to tags that start with the text, then ones that contain it, and
 * offers to create the typed tag when you have no tag by that name.
 */
export function suggestTags(
  uses: Map<string, number>,
  picked: string[],
  typed: string,
) {
  const q = tagOf(typed);
  const ranked = [...uses]
    .filter(([name]) => !picked.includes(name) && name.includes(q))
    .sort(
      ([a, m], [b, n]) =>
        Number(b.startsWith(q)) - Number(a.startsWith(q)) ||
        n - m ||
        a.localeCompare(b),
    )
    .map(([name]) => name);
  return {
    matches: ranked.slice(0, 6),
    create: q && !uses.has(q) && !picked.includes(q) ? q : null,
  };
}
