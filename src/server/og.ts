/**
 * Fetches a page's Open Graph preview — a share image and a short description —
 * so a saved tool shows more than its URL. Both come from one fetch. Every
 * field is optional: a missing image or description is never an error, so every
 * path that can throw collapses to null.
 *
 * ponytail: SSRF ceiling. This fetches a user-supplied URL server-side, so a
 * saved `http://169.254.169.254/` or an internal host would be reached. The
 * threat model is a small circle of trusted people (PRODUCT.md), and only
 * parsed og:* meta values are ever stored — the response body is never
 * returned. Block private/link-local ranges here before this serves strangers.
 */

const IMAGE_KEYS = ["og:image", "og:image:url", "twitter:image", "twitter:image:src"];
const DESC_KEYS = ["og:description", "twitter:description", "description"];

function firstMeta(html: string, keys: string[]): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i
      .exec(tag)?.[1]
      ?.toLowerCase();
    if (key && keys.includes(key)) {
      const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
      if (content) return content;
    }
  }
  return null;
}

export function metaContent(html: string): string | null {
  return firstMeta(html, IMAGE_KEYS);
}

// A few common entities show up in og:description; decode them so the preview
// reads as text, not markup. Anything rarer is left as-is.
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");
}

export function metaDescription(html: string): string | null {
  const raw = firstMeta(html, DESC_KEYS);
  if (!raw) return null;
  const text = decodeEntities(raw).replace(/\s+/g, " ").trim();
  // Cap so a page that stuffs its whole article into og:description can't
  // dominate the card. 280 keeps a sentence or two.
  return text ? text.slice(0, 280) : null;
}

export type Preview = { image: string | null; description: string | null };

export async function fetchPreview(url: string): Promise<Preview> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      // Some hosts serve a bare page or 403 to an empty UA.
      headers: { "user-agent": "Mozilla/5.0 (compatible; StashBot/1.0)", accept: "text/html" },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) {
      return { image: null, description: null };
    }

    // og tags live in <head>; cap the parse so a giant page can't stall it.
    const html = (await res.text()).slice(0, 500_000);

    // Resolve a relative image path against the post-redirect URL, and refuse
    // anything that isn't http(s) — a data:/javascript: value never renders.
    let image: string | null = null;
    const rawImage = metaContent(html);
    if (rawImage) {
      const abs = new URL(rawImage, res.url);
      if (abs.protocol === "http:" || abs.protocol === "https:") image = abs.toString();
    }

    return { image, description: metaDescription(html) };
  } catch {
    return { image: null, description: null };
  }
}
