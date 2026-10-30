/**
 * Maps-link parsing shared by the composer (to pick "Place" as you paste) and
 * the server (to resolve the link). Pure: no fetch, no DOM.
 */

// google.com, google.co.th, google.com.au, google.de; not google.com.evil.io.
const GOOGLE = /^(?:www\.|maps\.)?google(?:\.com|\.co)?\.[a-z]{2,3}$/;
const PAIR = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
// Google's ?q= / ?query= / ?center=, Apple's ?ll= / ?coordinate= / ?daddr=.
const COORD_PARAMS = [
  "q",
  "query",
  "ll",
  "center",
  "coordinate",
  "destination",
  "daddr",
  "sll",
];

/** Parses a pasted link, with or without its scheme. */
export function parseLink(s: string): URL | null {
  const t = s.trim();
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
}

/** A Google or Apple Maps link: what the composer saves as a place. */
export function isMapsLink(s: string): boolean {
  const url = parseLink(s);
  if (!url || /\s/.test(s.trim())) return false;
  const host = url.hostname.toLowerCase();
  if (["maps.app.goo.gl", "maps.apple.com", "maps.apple"].includes(host))
    return true;
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  if (GOOGLE.test(host))
    return host.startsWith("maps.") || url.pathname.startsWith("/maps");
  return false;
}

function pin(lat: string, lng: string) {
  const [a, b] = [Number(lat), Number(lng)];
  return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null;
}

export function coordsFromUrl(url: URL): { lat: number; lng: number } | null {
  // !3d…!4d… is the place's own pin; @lat,lng is only where the map was centred
  // when the link was shared, so it loses when both are present.
  const matches = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url.href),
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url.pathname),
    ...COORD_PARAMS.map((key) => PAIR.exec(url.searchParams.get(key) ?? "")),
  ];
  for (const m of matches) {
    const found = m && pin(m[1]!, m[2]!);
    if (found) return found;
  }
  return null;
}

export function nameFromUrl(url: URL): string | null {
  const segment = /\/maps\/place\/([^/@]+)/.exec(url.pathname)?.[1];
  let decoded: string | null = null;
  if (segment) {
    try {
      decoded = decodeURIComponent(segment.replace(/\+/g, " "));
    } catch {
      decoded = null;
    }
  }
  const candidates = [
    decoded,
    ...["name", "q", "query"].map((k) => url.searchParams.get(k)),
  ];
  for (const raw of candidates) {
    const name = raw?.trim();
    if (name && !PAIR.test(name)) return name.slice(0, 200);
  }
  return null;
}

/** Great-circle distance in metres. */
export function distance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export type Bounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** Whether a pin is inside a map view, including one that spans the date line. */
export function within(p: { lat: number; lng: number }, b: Bounds) {
  if (p.lat < b.south || p.lat > b.north) return false;
  if (b.east - b.west >= 360) return true;
  // A zoomed-out view reports longitudes past ±180; fold them back.
  const w = ((((b.west + 180) % 360) + 360) % 360) - 180;
  const e = ((((b.east + 180) % 360) + 360) % 360) - 180;
  return w <= e ? p.lng >= w && p.lng <= e : p.lng >= w || p.lng <= e;
}

/**
 * The area a place is in, for a one-line row: the part of the address before
 * the city or postcode ("6-5-1 Minamiaoyama, Minato City, Tokyo" is "Minato
 * City"). The full address stays on the place's card.
 */
export function areaOf(address: string | null): string | null {
  const parts = (address ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // "…, Koto City, Tokyo 135-0023, Japan": the country goes first.
  if (parts.length >= 4) parts.pop();
  return parts.length >= 2 ? parts[parts.length - 2]! : (parts[0] ?? null);
}
