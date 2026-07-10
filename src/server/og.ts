/**
 * Fetches a page's Open Graph image so a saved tool shows a preview. Returns an
 * absolute http(s) image URL, or null on any failure — a missing preview is
 * never an error, so every path that can throw collapses to null.
 *
 * ponytail: SSRF ceiling. This fetches a user-supplied URL server-side, so a
 * saved `http://169.254.169.254/` or an internal host would be reached. The
 * threat model is a small circle of trusted people (PRODUCT.md), and only a
 * parsed og:image meta value is ever stored — the response body is never
 * returned. Block private/link-local ranges here before this serves strangers.
 */

const IMAGE_KEYS = ["og:image", "og:image:url", "twitter:image", "twitter:image:src"];

export function metaContent(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i
      .exec(tag)?.[1]
      ?.toLowerCase();
    if (key && IMAGE_KEYS.includes(key)) {
      const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
      if (content) return content;
    }
  }
  return null;
}

export async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      // Some hosts serve a bare page or 403 to an empty UA.
      headers: { "user-agent": "Mozilla/5.0 (compatible; StashBot/1.0)", accept: "text/html" },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) {
      return null;
    }

    // og tags live in <head>; cap the parse so a giant page can't stall it.
    const raw = metaContent((await res.text()).slice(0, 500_000));
    if (!raw) return null;

    // Resolve relative paths against the post-redirect URL, and refuse anything
    // that isn't http(s) — a data:/javascript: content value never renders.
    const abs = new URL(raw, res.url);
    return abs.protocol === "http:" || abs.protocol === "https:" ? abs.toString() : null;
  } catch {
    return null;
  }
}
