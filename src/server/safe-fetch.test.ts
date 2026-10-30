import { afterEach, expect, spyOn, test } from "bun:test";

import { isPublicAddress, safeFetch } from "./safe-fetch";

const resolves = (...addresses: string[]) => async () =>
  addresses.map((address) => ({ address }));

// Bun types `expect().rejects` as not awaitable, which the lint rules reject.
const refused = (attempt: Promise<Response>) =>
  attempt.then(
    () => false,
    () => true,
  );

const stubFetch = (respond: (url: string) => Response) =>
  spyOn(globalThis, "fetch").mockImplementation((async (input: string | URL) =>
    respond(input.toString())) as typeof fetch);

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

test("refuses every private, loopback and link-local range", () => {
  for (const address of [
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
  ]) {
    expect([address, isPublicAddress(address)]).toEqual([address, false]);
  }
});

test("sees through IPv4-mapped IPv6", () => {
  expect(isPublicAddress("::ffff:127.0.0.1")).toBe(false);
  expect(isPublicAddress("::ffff:10.0.0.1")).toBe(false);
  expect(isPublicAddress("::ffff:7f00:1")).toBe(false);
});

test("sees through IPv6 forms that embed an IPv4 address", () => {
  expect(isPublicAddress("64:ff9b::7f00:1")).toBe(false);
  expect(isPublicAddress("2002:7f00:1::")).toBe(false);
});

test("lets public addresses through", () => {
  for (const address of [
    "1.1.1.1",
    "8.8.8.8",
    "172.32.0.1",
    "192.169.0.1",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
  ]) {
    expect([address, isPublicAddress(address)]).toEqual([address, true]);
  }
});

test("treats something that is not an address as not public", () => {
  expect(isPublicAddress("not-an-ip")).toBe(false);
  expect(isPublicAddress("")).toBe(false);
});

test("fetches a host that resolves to a public address", async () => {
  const fetched = stubFetch(() => new Response("ok"));
  const res = await safeFetch("https://example.com/", {}, resolves("93.184.216.34"));
  expect(await res.text()).toBe("ok");
  expect(fetched).toHaveBeenCalledTimes(1);
});

test("refuses a name that resolves to a private address, like a compose service", async () => {
  const fetched = stubFetch(() => new Response("secret"));
  expect(await refused(safeFetch("http://db:5432/", {}, resolves("172.18.0.2")))).toBe(true);
  expect(fetched).not.toHaveBeenCalled();
});

test("refuses when any one resolved address is private", async () => {
  const fetched = stubFetch(() => new Response("secret"));
  expect(await refused(safeFetch("https://mixed.example/", {}, resolves("93.184.216.34", "10.0.0.1")))).toBe(true);
  expect(fetched).not.toHaveBeenCalled();
});

test("refuses IP literals without resolving them", async () => {
  const fetched = stubFetch(() => new Response("secret"));
  expect(await refused(safeFetch("http://169.254.169.254/latest"))).toBe(true);
  expect(await refused(safeFetch("http://[::1]/"))).toBe(true);
  expect(fetched).not.toHaveBeenCalled();
});

test("follows a redirect between public hosts", async () => {
  stubFetch((url) =>
    url === "https://short.example/a"
      ? new Response(null, { status: 302, headers: { location: "https://long.example/b" } })
      : new Response(url),
  );
  const res = await safeFetch("https://short.example/a", {}, resolves("93.184.216.34"));
  expect(await res.text()).toBe("https://long.example/b");
});

test("resolves a relative redirect against the current URL", async () => {
  stubFetch((url) =>
    url === "https://example.com/a/b"
      ? new Response(null, { status: 301, headers: { location: "../c" } })
      : new Response(url),
  );
  const res = await safeFetch("https://example.com/a/b", {}, resolves("93.184.216.34"));
  expect(await res.text()).toBe("https://example.com/c");
});

test("refuses a redirect that bounces into private space", async () => {
  const fetched = stubFetch(
    () => new Response(null, { status: 302, headers: { location: "http://internal.example/" } }),
  );
  const lookup = async (host: string) => [
    { address: host === "internal.example" ? "10.0.0.5" : "93.184.216.34" },
  ];
  expect(await refused(safeFetch("https://public.example/", {}, lookup))).toBe(true);
  expect(fetched).toHaveBeenCalledTimes(1);
});

test("refuses a redirect to a non-http scheme", async () => {
  stubFetch(
    () => new Response(null, { status: 302, headers: { location: "file:///etc/passwd" } }),
  );
  expect(await refused(safeFetch("https://public.example/", {}, resolves("93.184.216.34")))).toBe(true);
});

test("gives up after too many redirects", async () => {
  let hop = 0;
  const fetched = stubFetch(
    () =>
      new Response(null, {
        status: 302,
        headers: { location: `https://public.example/${++hop}` },
      }),
  );
  expect(await refused(safeFetch("https://public.example/", {}, resolves("93.184.216.34")))).toBe(true);
  expect(fetched.mock.calls.length).toBeLessThanOrEqual(6);
});

test("returns a 3xx with no location as it is", async () => {
  stubFetch(() => new Response(null, { status: 304 }));
  const res = await safeFetch("https://public.example/", {}, resolves("93.184.216.34"));
  expect(res.status).toBe(304);
});
