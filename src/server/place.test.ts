import { afterEach, expect, test } from "bun:test";

import { resolvePlace } from "./place";

const PLACE =
  "https://www.google.com/maps/place/Blue+Bottle+Coffee+Kiyosumi-Shirakawa/@35.6806,139.7935,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d35.680815!4d139.796074!16s";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(url: string, html = "", type = "text/html") {
  globalThis.fetch = (async () => ({
    ok: true,
    url,
    headers: new Headers({ "content-type": type }),
    text: async () => html,
  })) as unknown as typeof fetch;
}

test("follows a short link and reads the name and address off the page", async () => {
  stubFetch(
    "https://www.google.com/maps/place/Blue+Bottle/data=!3d35.680815!4d139.796074",
    `<meta property="og:title" content="Blue Bottle Coffee &#183; 1-4-8 Hirano, Koto City, Tokyo">`,
  );
  expect(await resolvePlace("https://maps.app.goo.gl/AbC123")).toEqual({
    lat: 35.680815,
    lng: 139.796074,
    name: "Blue Bottle",
    address: "1-4-8 Hirano, Koto City, Tokyo",
    image: null,
  });
});

test("reads the share image off a maps page, absolute or relative", async () => {
  stubFetch(
    PLACE,
    `<meta property="og:image" content="/maps/api/staticmap?center=35.68,139.79">`,
  );
  expect((await resolvePlace(PLACE)).image).toBe(
    "https://www.google.com/maps/api/staticmap?center=35.68,139.79",
  );
});

test("sees through Google's consent wall", async () => {
  const dest = encodeURIComponent(
    "https://www.google.com/maps/place/Nezu+Museum/@35.6623,139.7166,17z",
  );
  stubFetch(
    `https://consent.google.com/ml?continue=${dest}`,
    "<title>Before you continue</title>",
  );
  expect(await resolvePlace("https://maps.app.goo.gl/AbC123")).toEqual({
    lat: 35.6623,
    lng: 139.7166,
    name: "Nezu Museum",
    address: null,
    image: null,
  });
});

test("ignores an app-titled page and falls back to the link itself", async () => {
  stubFetch(PLACE, `<meta property="og:title" content="Google Maps">`);
  const place = await resolvePlace(PLACE);
  expect(place.name).toBe("Blue Bottle Coffee Kiyosumi-Shirakawa");
  expect(place.address).toBeNull();
});

test("never throws: a failed fetch still parses the pasted link", async () => {
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as unknown as typeof fetch;
  expect(await resolvePlace(PLACE)).toMatchObject({
    lat: 35.680815,
    lng: 139.796074,
  });
  expect(await resolvePlace("https://maps.app.goo.gl/AbC123")).toEqual({
    lat: null,
    lng: null,
    name: null,
    address: null,
    image: null,
  });
});

test("never fetches a link that is not a maps link", async () => {
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
  }) as unknown as typeof fetch;
  await resolvePlace("http://169.254.169.254/latest/meta-data");
  expect(called).toBe(false);
});
