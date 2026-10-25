/**
 * Accepts a bare host ("ripgrep.dev") and prefixes https://. Rejects anything
 * that isn't http(s) once parsed, which is what keeps `javascript:` out of the
 * href we render.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs can be saved.");
  }
  // The parser accepts almost any string as a host once https:// is prefixed,
  // so a typo ("ripgrep", "ht!tp://x") would save as a dead link. Require a
  // dotted host (IPv4 included), an IPv6 literal, or localhost.
  const host = parsed.hostname;
  const dotted = /^([a-z0-9-]+\.)+[a-z0-9-]+$/i.test(host);
  if (!dotted && host !== "localhost" && !host.startsWith("[")) {
    throw new Error("That isn't a web address.");
  }
  return parsed.toString();
}
