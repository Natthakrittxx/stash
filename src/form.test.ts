import { expect, test } from "bun:test";

import { looksLikeLink, titleOr } from "./form";

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

test("tells a pasted link from a command", () => {
  for (const link of [
    "ripgrep.dev",
    "https://github.com/BurntSushi/ripgrep",
    "docs.python.org/3/",
    "  squoosh.app  ",
    "192.168.1.1:8080/admin",
  ])
    expect(looksLikeLink(link)).toBe(true);
  for (const cmd of ["rg -i 'TODO'", "./run.sh", "ls", "git status", ""])
    expect(looksLikeLink(cmd)).toBe(false);
});
