import { expect, test } from "bun:test";

import { normalizeUrl } from "./url";

test("prefixes https:// onto a bare host", () => {
  expect(normalizeUrl("ripgrep.dev")).toBe("https://ripgrep.dev/");
  expect(normalizeUrl("  example.com/a?b=1  ")).toBe("https://example.com/a?b=1");
});

test("keeps an explicit scheme", () => {
  expect(normalizeUrl("http://internal.corp")).toBe("http://internal.corp/");
  expect(normalizeUrl("https://example.com")).toBe("https://example.com/");
});

test("rejects non-http(s) schemes", () => {
  expect(() => normalizeUrl("javascript://alert(1)")).toThrow();
  expect(() => normalizeUrl("data://text/html,x")).toThrow();
  expect(() => normalizeUrl("file:///etc/passwd")).toThrow();
});

test("rejects things that are not URLs", () => {
  // Prefixing makes this `https://git@github.com:foo/bar` — port "foo" is invalid.
  expect(() => normalizeUrl("git@github.com:foo/bar")).toThrow();
  expect(() => normalizeUrl("javascript:alert(1)")).toThrow();
  expect(() => normalizeUrl("")).toThrow();
});

test("rejects hosts that can't be a real site", () => {
  expect(() => normalizeUrl("ripgrep")).toThrow();
  expect(() => normalizeUrl("ht!tp://")).toThrow();
  expect(() => normalizeUrl("https://.com")).toThrow();
});

test("accepts localhost and IP literals", () => {
  expect(normalizeUrl("localhost:3000")).toBe("https://localhost:3000/");
  expect(normalizeUrl("http://192.168.1.2/x")).toBe("http://192.168.1.2/x");
  expect(normalizeUrl("http://[::1]:8080")).toBe("http://[::1]:8080/");
});
