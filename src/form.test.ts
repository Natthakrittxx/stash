import { expect, test } from "bun:test";

import { looksLikeLink, suggestTags, titleOr } from "./form";

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

// Your tags and how many of your items carry each.
const uses = new Map([
  ["docker", 14],
  ["git", 9],
  ["sudo", 5],
  ["dockerfile", 3],
  ["rust", 6],
  ["fonts", 4],
  ["tokyo", 2],
  ["recipes", 0],
]);

test("with nothing typed, suggests your most-used tags not already picked", () => {
  expect(suggestTags(uses, ["git"], "")).toEqual({
    matches: ["docker", "rust", "sudo", "fonts", "dockerfile", "tokyo"],
    create: null,
  });
});

test("suggests tags starting with what's typed before ones containing it", () => {
  expect(suggestTags(uses, [], "Do")).toEqual({
    matches: ["docker", "dockerfile", "sudo"],
    create: "do",
  });
});

test("offers to create only a tag you don't have and haven't picked", () => {
  expect(suggestTags(uses, [], " Git ").create).toBeNull();
  expect(suggestTags(uses, ["vim"], "vim")).toEqual({
    matches: [],
    create: null,
  });
});
