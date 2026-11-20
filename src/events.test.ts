import { describe, expect, test } from "bun:test";

import { formatWhen, isWallTime, monthGrid, onDay } from "./events";

describe("isWallTime", () => {
  test("takes what a datetime-local input sends", () => {
    expect(isWallTime("2026-11-20T19:00")).toBe(true);
  });
  test("refuses a day the calendar lacks, or another shape", () => {
    expect(isWallTime("2026-02-30T10:00")).toBe(false);
    expect(isWallTime("2026-11-20 19:00")).toBe(false);
    expect(isWallTime("2026-11-20T19:00:00Z")).toBe(false);
    expect(isWallTime("")).toBe(false);
  });
});

describe("formatWhen", () => {
  test("prints the wall time as saved, whatever the zone", () => {
    expect(formatWhen("2026-11-20T19:00", null)).toBe(
      "Fri, 20 Nov 2026, 19:00",
    );
  });
  test("same-day end shows only its time", () => {
    expect(formatWhen("2026-11-20T19:00", "2026-11-20T21:30")).toBe(
      "Fri, 20 Nov 2026, 19:00–21:30",
    );
  });
});

describe("monthGrid", () => {
  test("whole Monday-first weeks around the month", () => {
    const days = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(days.length % 7).toBe(0);
    expect(days[0]).toBe("2026-10-26");
    expect(days).toContain("2026-11-30");
    expect(days.at(-1)).toBe("2026-12-06");
  });
});

test("a multi-day event is on every day it spans", () => {
  const e = { startsAt: "2026-11-20T19:00", endsAt: "2026-11-22T02:00" };
  expect(onDay(e, "2026-11-21")).toBe(true);
  expect(onDay(e, "2026-11-23")).toBe(false);
});
