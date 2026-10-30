/**
 * Turns a pasted maps link into a place: a pin, a name, an address and a share
 * image, each where the link or its page carries it. Pasting a Google or Apple
 * share link is the whole capture, so every field is best effort and nothing
 * here throws: a link that yields no pin still saves, as a place that is "Not
 * on the map".
 *
 * Only links that pass `isMapsLink` are fetched, to follow a short link to
 * where it lands and read the page's meta. A short link can redirect anywhere,
 * so this goes through safeFetch like og.ts does.
 */

import { coordsFromUrl, isMapsLink, nameFromUrl } from "~/maps";

import { metaContent, metaTitle } from "./og";
import { safeFetch } from "./safe-fetch";

export type Place = {
  lat: number | null;
  lng: number | null;
  name: string | null;
  address: string | null;
  image: string | null;
};

// Google's EU consent wall sits between a short link and the map; the real
// destination rides in its `continue` parameter.
function landing(url: URL): URL {
  const next =
    url.hostname === "consent.google.com" && url.searchParams.get("continue");
  try {
    return next ? new URL(next) : url;
  } catch {
    return url;
  }
}

export async function resolvePlace(link: string): Promise<Place> {
  const none = { lat: null, lng: null, name: null, address: null, image: null };
  if (!isMapsLink(link)) return none;
  const original = new URL(link);
  let final = original;
  let title: string | null = null;
  let image: string | null = null;
  try {
    const res = await safeFetch(link, {
      signal: AbortSignal.timeout(5000),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; StashBot/1.0)",
        accept: "text/html",
      },
    });
    final = landing(new URL(res.url));
    // Meta off any page but a maps page would describe the wrong thing.
    if (
      res.ok &&
      isMapsLink(res.url) &&
      (res.headers.get("content-type") ?? "").includes("html")
    ) {
      const html = (await res.text()).slice(0, 500_000);
      title = metaTitle(html);
      // A page that isn't one place titles itself after the app.
      if (title && /^(Google|Apple) Maps$/.test(title)) title = null;
      const raw = metaContent(html);
      const abs = raw ? new URL(raw, res.url) : null;
      if (abs && (abs.protocol === "https:" || abs.protocol === "http:"))
        image = abs.toString();
    }
  } catch {
    // The pasted link may still carry everything; parse it as it is.
  }

  const [titleName, ...rest] = title?.split(" · ") ?? [];
  const coords = coordsFromUrl(final) ?? coordsFromUrl(original);
  return {
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    name:
      nameFromUrl(final) ??
      nameFromUrl(original) ??
      titleName?.trim().slice(0, 200) ??
      null,
    address:
      final.searchParams.get("address") ??
      original.searchParams.get("address") ??
      (rest.join(" · ").trim().slice(0, 300) || null),
    image,
  };
}
