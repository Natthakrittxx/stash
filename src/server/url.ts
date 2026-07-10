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
  return parsed.toString();
}
