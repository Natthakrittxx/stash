import { expect, test } from "bun:test";

import { deviceName, suggestName } from "./passkey-name";

const FIREFOX_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0";
const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/130.0.0.0`;
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

const NAMES = { "bada5566-a7aa-401f-bd96-45619a55120d": "1Password" };

test("a device is named by its browser and system", () => {
  expect(deviceName(FIREFOX_MAC)).toBe("Firefox on Mac");
  expect(deviceName(CHROME_WINDOWS)).toBe("Chrome on Windows");
  expect(deviceName(EDGE_WINDOWS)).toBe("Edge on Windows");
  expect(deviceName(SAFARI_IPHONE)).toBe("Safari on iPhone");
  expect(deviceName(CHROME_ANDROID)).toBe("Chrome on Android");
});

test("an unrecognised device gets a plain name", () => {
  expect(deviceName("curl/8.0")).toBe("Passkey");
});

test("a known authenticator's name comes first, whatever its casing", () => {
  expect(
    suggestName("BADA5566-A7AA-401F-BD96-45619A55120D ", NAMES, FIREFOX_MAC),
  ).toBe("1Password");
});

test("a hidden or unknown authenticator falls back to the device", () => {
  const zero = "00000000-0000-0000-0000-000000000000";
  expect(suggestName(zero, NAMES, FIREFOX_MAC)).toBe("Firefox on Mac");
  expect(suggestName(null, NAMES, FIREFOX_MAC)).toBe("Firefox on Mac");
});
