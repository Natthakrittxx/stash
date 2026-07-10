import { expect, test } from "bun:test";

import { metaContent } from "./og";

test("reads og:image regardless of attribute order", () => {
  expect(metaContent(`<meta property="og:image" content="https://x.dev/a.png">`)).toBe(
    "https://x.dev/a.png",
  );
  expect(metaContent(`<meta content="https://x.dev/b.png" property="og:image">`)).toBe(
    "https://x.dev/b.png",
  );
});

test("accepts twitter:image and name= variants", () => {
  expect(metaContent(`<meta name="twitter:image" content="/c.png">`)).toBe("/c.png");
  expect(metaContent(`<meta name="twitter:image:src" content="/d.png">`)).toBe("/d.png");
});

test("prefers the first image tag and ignores unrelated meta", () => {
  const html = `<meta charset="utf-8"><meta name="description" content="nope">
    <meta property="og:image" content="first.png"><meta property="og:image" content="second.png">`;
  expect(metaContent(html)).toBe("first.png");
});

test("returns null when no image meta or content is present", () => {
  expect(metaContent(`<meta property="og:title" content="Hi">`)).toBeNull();
  expect(metaContent(`<meta property="og:image">`)).toBeNull();
  expect(metaContent("")).toBeNull();
});
