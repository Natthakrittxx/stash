import { expect, test } from "bun:test";

import { titleOr } from "./form";

test("keeps a given title", () => {
  expect(titleOr("Mine", "https://x.dev", null)).toBe("Mine");
});

test("falls back to the host, without www, with or without a scheme", () => {
  expect(titleOr("", "https://www.ripgrep.dev/docs", null)).toBe("ripgrep.dev");
  expect(titleOr("", "squoosh.app", null)).toBe("squoosh.app");
});

test("falls back to the command's first line", () => {
  expect(titleOr("", null, "  du -sh * | sort -h\nsecond")).toBe(
    "du -sh * | sort -h",
  );
});
