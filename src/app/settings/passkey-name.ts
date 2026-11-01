const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];
// In this order: an iPhone also says "like Mac OS X", and Android also says Linux.
const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Mac OS X/, "Mac"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
];

const match = (list: [RegExp, string][], text: string) =>
  list.find(([pattern]) => pattern.test(text))?.[1];

export function deviceName(userAgent: string) {
  const browser = match(BROWSERS, userAgent);
  const system = match(SYSTEMS, userAgent);
  return browser && system ? `${browser} on ${system}` : "Passkey";
}

// Apple devices, and any browser that hides it, report an all-zero authenticator
// ID that matches nothing, so the device stands in.
export function suggestName(
  aaguid: string | null | undefined,
  authenticatorNames: Record<string, string>,
  userAgent: string,
) {
  return (
    authenticatorNames[aaguid?.trim().toLowerCase() ?? ""] ??
    deviceName(userAgent)
  );
}
