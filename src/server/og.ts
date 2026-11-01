/**
 * Fetches a page's Open Graph preview — a share image and a short description —
 * so a saved tool shows more than its URL. Both come from one fetch. Every
 * field is optional: a missing image or description is never an error, so every
 * path that can throw collapses to null.
 *
 * This fetches a user-supplied URL server-side, so it goes through safeFetch: a
 * saved `http://169.254.169.254/` or an internal host is refused, and comes back
 * as no preview. Only parsed og:* meta values are ever stored — the response
 * body is never returned.
 */

import { safeFetch } from "./safe-fetch";

const IMAGE_KEYS = [
  "og:image",
  "og:image:url",
  "twitter:image",
  "twitter:image:src",
];
const DESC_KEYS = ["og:description", "twitter:description", "description"];

// A regex over the whole page backtracks from every unclosed `<meta`, and that work
// blocks the event loop for all accounts: 500 KB of them took 39 s.
function metaTags(html: string): string[] {
  const tags: string[] = [];
  const opening = /<meta\b/gi;
  for (let match; (match = opening.exec(html));) {
    const end = html.indexOf(">", match.index);
    if (end < 0) break; // No later tag can close either.
    tags.push(html.slice(match.index, end + 1));
    opening.lastIndex = end + 1;
  }
  return tags;
}

function firstMeta(html: string, keys: string[]): string | null {
  for (const tag of metaTags(html)) {
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
// reads as text, not markup. Numeric references (`&#38;`, `&#x2014;`) decode
// too; other named entities are left as-is. `&amp;` goes last so `&amp;lt;`
// stays the literal text `&lt;`.
function decodeEntities(s: string): string {
  return s
    .replace(
      /&#(\d+);|&#x([0-9a-f]+);/gi,
      (match, dec?: string, hex?: string) => {
        const code = dec ? Number(dec) : parseInt(hex!, 16);
        return code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      },
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function metaDescription(html: string): string | null {
  const raw = firstMeta(html, DESC_KEYS);
  if (!raw) return null;
  const text = decodeEntities(raw).replace(/\s+/g, " ").trim();
  // Cap so a page that stuffs its whole article into og:description can't
  // dominate the card. 280 keeps a sentence or two.
  return text ? text.slice(0, 280) : null;
}

// A Google Maps place page titles itself "Name · Address"; place.ts splits it.
export function metaTitle(html: string): string | null {
  const raw = firstMeta(html, ["og:title", "twitter:title"]);
  return raw ? decodeEntities(raw).replace(/\s+/g, " ").trim() || null : null;
}

// og tags live in <head>, so stop reading at the cap instead of buffering whatever
// the page sends, which a small gzip response can make very large. Counts decoded
// bytes, so a page of multi-byte text keeps slightly fewer characters.
export async function readCapped(
  res: Response,
  max = 500_000,
): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let read = 0;
  while (read < max) {
    const { done, value } = await reader.read();
    if (done) return html + decoder.decode();
    const room = max - read;
    read += value.length;
    html += decoder.decode(value.subarray(0, room), { stream: true });
  }
  await reader.cancel();
  return html;
}

export type Preview = { image: string | null; description: string | null };

export async function fetchPreview(url: string): Promise<Preview> {
  try {
    const res = await safeFetch(url, {
      signal: AbortSignal.timeout(5000),
      // Some hosts serve a bare page or 403 to an empty UA.
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; StashBot/1.0)",
        accept: "text/html",
      },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) {
      return { image: null, description: null };
    }

    const html = await readCapped(res);

    // Resolve a relative image path against the post-redirect URL, and refuse
    // anything that isn't http(s) — a data:/javascript: value never renders.
    let image: string | null = null;
    const rawImage = metaContent(html);
    if (rawImage) {
      const abs = new URL(rawImage, res.url);
      if (abs.protocol === "http:" || abs.protocol === "https:")
        image = abs.toString();
    }

    return { image, description: metaDescription(html) };
  } catch {
    return { image: null, description: null };
  }
}
