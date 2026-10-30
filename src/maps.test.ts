import { expect, test } from "bun:test";

import {
  areaOf,
  coordsFromUrl,
  distance,
  isMapsLink,
  nameFromUrl,
  within,
} from "./maps";

const PLACE =
  "https://www.google.com/maps/place/Blue+Bottle+Coffee+Kiyosumi-Shirakawa/@35.6806,139.7935,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d35.680815!4d139.796074!16s";

test("recognises Google and Apple maps links", () => {
  expect(isMapsLink(PLACE)).toBe(true);
  expect(isMapsLink("https://maps.app.goo.gl/AbC123")).toBe(true);
  expect(isMapsLink("https://goo.gl/maps/AbC123")).toBe(true);
  expect(isMapsLink("https://maps.google.co.th/?q=13.7563,100.5018")).toBe(
    true,
  );
  expect(isMapsLink("https://www.google.com.au/maps/@-33.86,151.21,15z")).toBe(
    true,
  );
  expect(
    isMapsLink("https://maps.apple.com/?ll=35.68,139.79&q=Blue%20Bottle"),
  ).toBe(true);
  expect(isMapsLink("https://maps.apple/p/AbC123")).toBe(true);
});

test("rejects links that are not maps", () => {
  expect(isMapsLink("https://www.google.com/search?q=coffee")).toBe(false);
  expect(isMapsLink("https://goo.gl/AbC123")).toBe(false);
  expect(isMapsLink("https://google.com.evil.io/maps/place/x")).toBe(false);
  expect(isMapsLink("https://notgoogle.com/maps/place/x")).toBe(false);
  expect(isMapsLink("https://github.com")).toBe(false);
  expect(isMapsLink("not a url")).toBe(false);
});

test("prefers the place's own pin over the map centre", () => {
  expect(coordsFromUrl(new URL(PLACE))).toEqual({
    lat: 35.680815,
    lng: 139.796074,
  });
  expect(
    coordsFromUrl(new URL("https://www.google.com/maps/@-33.86,151.21,15z")),
  ).toEqual({
    lat: -33.86,
    lng: 151.21,
  });
});

test("reads coordinates from query parameters", () => {
  expect(
    coordsFromUrl(new URL("https://maps.google.com/?q=13.7563,100.5018")),
  ).toEqual({
    lat: 13.7563,
    lng: 100.5018,
  });
  expect(
    coordsFromUrl(new URL("https://maps.apple.com/?ll=35.68,139.79&q=Cafe")),
  ).toEqual({
    lat: 35.68,
    lng: 139.79,
  });
  expect(
    coordsFromUrl(new URL("https://maps.google.com/?q=Blue+Bottle")),
  ).toBeNull();
  expect(
    coordsFromUrl(new URL("https://maps.google.com/?q=95,200")),
  ).toBeNull();
});

test("names a place from its path or its query", () => {
  expect(nameFromUrl(new URL(PLACE))).toBe(
    "Blue Bottle Coffee Kiyosumi-Shirakawa",
  );
  expect(
    nameFromUrl(
      new URL(
        "https://www.google.com/maps/place/%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%99/",
      ),
    ),
  ).toBe("ร้าน");
  expect(
    nameFromUrl(
      new URL("https://maps.apple.com/?ll=35.68,139.79&q=Onibus%20Coffee"),
    ),
  ).toBe("Onibus Coffee");
  // Coordinates in q are not a name.
  expect(
    nameFromUrl(new URL("https://maps.google.com/?q=13.7563,100.5018")),
  ).toBeNull();
});

test("accepts a pasted link without its scheme, and nothing with spaces", () => {
  expect(isMapsLink("maps.app.goo.gl/AbC123")).toBe(true);
  expect(isMapsLink("maps.app.goo.gl/AbC123 extra")).toBe(false);
});

test("measures distance in metres", () => {
  // Kiyosumi-Shirakawa to Fukagawa Edo Museum, roughly 350 m.
  const d = distance(
    { lat: 35.680815, lng: 139.796074 },
    { lat: 35.6797, lng: 139.7995 },
  );
  expect(Math.round(d / 50) * 50).toBe(350);
});

test("checks a pin against a view, across the date line too", () => {
  const tokyo = { lat: 35.68, lng: 139.79 };
  expect(within(tokyo, { west: 139, south: 35, east: 140, north: 36 })).toBe(
    true,
  );
  expect(within(tokyo, { west: 140, south: 35, east: 141, north: 36 })).toBe(
    false,
  );
  expect(
    within(
      { lat: 0, lng: 179.5 },
      { west: 170, south: -5, east: 190, north: 5 },
    ),
  ).toBe(true);
  expect(
    within(
      { lat: 0, lng: -179.5 },
      { west: 170, south: -5, east: 190, north: 5 },
    ),
  ).toBe(true);
  expect(
    within(
      { lat: 0, lng: 0 },
      { west: -400, south: -80, east: 400, north: 80 },
    ),
  ).toBe(true);
});

test("names the area a place is in", () => {
  expect(areaOf("6-5-1 Minamiaoyama, Minato City, Tokyo")).toBe("Minato City");
  expect(areaOf("1 Chome-4-8 Hirano, Koto City, Tokyo 135-0023, Japan")).toBe(
    "Koto City",
  );
  expect(areaOf("Sathorn, Bangkok")).toBe("Sathorn");
  expect(areaOf("Bangkok")).toBe("Bangkok");
  expect(areaOf(null)).toBeNull();
});
