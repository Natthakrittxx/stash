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
