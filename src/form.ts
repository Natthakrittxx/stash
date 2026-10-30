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
