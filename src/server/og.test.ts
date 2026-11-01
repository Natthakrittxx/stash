import { expect, test } from "bun:test";

import { metaContent, metaDescription, readCapped } from "./og";

test("reads og:image regardless of attribute order", () => {
  expect(
    metaContent(`<meta property="og:image" content="https://x.dev/a.png">`),
  ).toBe("https://x.dev/a.png");
  expect(
    metaContent(`<meta content="https://x.dev/b.png" property="og:image">`),
  ).toBe("https://x.dev/b.png");
});

test("accepts twitter:image and name= variants", () => {
  expect(metaContent(`<meta name="twitter:image" content="/c.png">`)).toBe(
    "/c.png",
  );
  expect(metaContent(`<meta name="twitter:image:src" content="/d.png">`)).toBe(
    "/d.png",
  );
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

test("reads og:description and falls back to name=description", () => {
  expect(
    metaDescription(`<meta property="og:description" content="A tool.">`),
  ).toBe("A tool.");
  expect(
    metaDescription(`<meta name="description" content="Plain meta.">`),
  ).toBe("Plain meta.");
  expect(metaDescription("")).toBeNull();
});

test("decodes common entities and collapses whitespace", () => {
  expect(
    metaDescription(
      `<meta name="description" content="Fast &amp; simple\n  saving">`,
    ),
  ).toBe("Fast & simple saving");
});

test("decodes numeric entities without double-decoding", () => {
  expect(
    metaDescription(
      `<meta name="description" content="macOS &#38; Linux &#x2014; &#39;fast&#39;">`,
    ),
  ).toBe("macOS & Linux — 'fast'");
  expect(
    metaDescription(`<meta name="description" content="&amp;lt;b&amp;gt;">`),
  ).toBe("&lt;b&gt;");
});

test("caps a long description at 280 chars", () => {
  const long = "x".repeat(500);
  expect(
    metaDescription(`<meta name="description" content="${long}">`)?.length,
  ).toBe(280);
});

test("a page of unclosed meta tags parses in near linear time", () => {
  const started = performance.now();
  expect(metaContent("<meta ".repeat(83_000))).toBeNull();
  expect(performance.now() - started).toBeLessThan(200);
});

test("a tag after an unclosed one is still read as the browser would", () => {
  expect(
    metaContent(`<meta property="og:image" content="https://x.dev/a.png">`),
  ).toBe("https://x.dev/a.png");
  expect(
    metaContent(
      `<META name="x"><meta property="og:image" content="/b.png"><meta `,
    ),
  ).toBe("/b.png");
});

test("reading stops at the cap, on an endless body too", async () => {
  let pulled = 0;
  const endless = new ReadableStream({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new Uint8Array(64 * 1024).fill(97));
    },
  });
  const html = await readCapped(new Response(endless), 500_000);
  expect(html.length).toBe(500_000);
  expect(pulled).toBeLessThan(12);
});

test("a short page reads whole, including multi-byte text split across chunks", async () => {
  const bytes = new TextEncoder().encode("café");
  const split = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice(0, 4));
      controller.enqueue(bytes.slice(4));
      controller.close();
    },
  });
  expect(await readCapped(new Response(split))).toBe("café");
});
