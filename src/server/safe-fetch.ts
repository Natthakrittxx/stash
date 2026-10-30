/**
 * fetch for URLs that account holders supply. An instance may serve people the
 * operator doesn't fully trust, and it sits on the operator's network next to
 * its database, so nothing here may reach a private address: not directly, not
 * through a name that resolves to one, not through a redirect. A refusal throws;
 * callers already treat a failed fetch as "no preview".
 *
 * shortcut: the name is resolved here and again by fetch, so DNS rebinding
 * between the two can still get through. Pin the connection to the checked
 * address if instances ever serve strangers at scale.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const MAX_REDIRECTS = 5;

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  // These forms carry an IPv4 address inside, so they could wrap a private one.
  ["64:ff9b::", 96],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 0) return false;
  return !blocked.check(address, version === 4 ? "ipv4" : "ipv6");
}

type Lookup = (host: string) => Promise<{ address: string }[]>;

const resolve: Lookup = (host) => dnsLookup(host, { all: true });

export async function safeFetch(
  input: string,
  init: Omit<RequestInit, "redirect"> = {},
  lookup: Lookup = resolve,
): Promise<Response> {
  let url = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`Refusing to fetch ${url.protocol} URL`);
    }
    // URL keeps the brackets on an IPv6 literal; the resolver doesn't want them.
    const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""));
    if (!addresses.length || !addresses.every((a) => isPublicAddress(a.address))) {
      throw new Error(`Refusing to fetch private address: ${url.hostname}`);
    }

    const res = await fetch(url, { ...init, redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return res;

    await res.body?.cancel();
    url = new URL(location, url);
  }
  throw new Error("Too many redirects");
}
