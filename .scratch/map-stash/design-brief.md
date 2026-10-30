# Places and the map: design brief

Status: approved 2026-10-27; slices 1-4 built 2026-10-28. Open decisions 1-3 resolved to the recommended options (MapLibre + OpenFreeMap; "Not on the map" + Set location; fixed 50/50 mobile split).

Built differently from this brief, on purpose:
- Index rows sort by title, matching the rest of the stash, rather than newest first. Near me still sorts by distance.
- A place in the All view opens straight onto the map, zoomed to it, with no detail-pane stop.
- Collections can be created, filed into and deleted. Renaming one is not built.
Chosen structure: **Map leads** (sketch: `.impeccable/mocks/decision/map-leads.html`).
Seed reference: `seed:e7ff5b1b14207d24` (degraded roll, no challengers).

## 1. Job and audience

- Same people as the rest of Stash: the maintainer and a small trusted circle. Mode: Operate.
- Three jobs, all confirmed:
  - **Plan a trip.** Open "Tokyo, March", see every saved spot on one map, decide the day. Mostly desktop.
  - **Find something nearby.** On the phone, out in the city: "what did I save near here?"
  - **Look one up.** "That ramen place": search by name, then Open in Google Maps for directions.

## 2. Outcome and proof

- A place goes in the way a link already does: paste a Google Maps or Apple Maps link into the existing composer. Nothing new to learn at capture.
- Success: a saved place is found again from the map, the search, or a collection, then opened in the phone's maps app.
- Product truth this design must keep: a stash is private; capture never blocks; re-finding is the product.

## 3. Selected direction

- **World:** unchanged Card Catalog. Cool paper and ink, one enamel teal, serif for what you saved, Plex Sans for controls. No new hue, no new type.
- **Structure:** when the kind is Places, or a collection is open, the main area becomes three columns. They are the 13rem rail, a 22rem index column, and the map, which fills the rest of the width down to the viewport's right and bottom edges and stays sticky at full height.
- **Signature move: the view is the filter.** Panning or zooming narrows the index to what is on screen. The existing live status line reports it ("8 of 12 places in view · Show all").
  - Changing the search, a tag, or the collection refits the map to the matches, so a search never comes back empty because the map was looking elsewhere.
  - Only a manual pan narrows the index.
- **Basemap in the world's palette:**
  - Land is Drawer Grey (surface).
  - Water and rivers are one cool step darker.
  - Roads are Catalog Paper (bg).
  - Labels are muted Plex Sans.
  - The dark theme swaps in the dark tokens. The map follows the theme toggle, unlike the console card.

## 4. Scope and boundaries

**In scope**
- `place` as a third item kind.
- Maps-link capture and server-side link resolution.
- The map view.
- Place collections.
- Near me (geolocation).
- Mobile layout.
- All states below.

**Untouched**
- The Tools and Formulae lists.
- The formula console.
- How the composer treats links and commands.
- The landing page. Its "two kinds, one search" copy goes stale once places ship; that is a separate follow-up.

**Anti-goals**
- No sharing or public collections (PRODUCT.md: private).
- No route planning, ratings, or opening hours.
- No pin per keyboard tab stop.
- No full-screen map takeover that hides the index.

**Parked by the user**
- Whether tools and formulae also get folders or collections. This brief builds the collections table so it can hold any kind, but only places use it in the UI for now.

## 5. Data model

- `items.kind` gains `'place'`. New nullable columns: `lat`, `lng` (double precision) and `address` (text).
- The CHECK constraint extends as follows:
  - a place has `url NOT NULL` and `cmd NULL`;
  - `lat` and `lng` are both null or both set.
- `url` keeps the original maps link. It is what "Open in Google Maps" opens, so the phone hands off to the maps app.
- New table `collections`: `id`, `user_id`, `name`, `created_at`.
- New table `collection_items`: `collection_id`, `item_id`, `added_at`. Both keys are cascade-deleted.
- Membership is many-to-many: a café can sit in both "Tokyo, March" and "Coffee worth the trip".
- Reads stay as today: everything for `user_id`, filtered in the browser.

## 6. Capture

- The composer's one field ("Paste a link or a command…") recognizes maps hosts: `google.com/maps`, `maps.google.com`, `maps.app.goo.gl`, `goo.gl/maps`, `maps.apple.com`.
- "Saving as" becomes Tool | Formula | Place. It is the same pill with three equal halves and is flipped and pinned the same way.
- On save, the server resolves the link:
  1. Follow redirects, fetching allowlisted hosts only.
  2. Read coordinates from the final URL (`@lat,lng`, `!3d…!4d…`, `ll=`, `q=lat,lng`).
  3. Take the name from `/place/<name>/`, `q=`, or og:title, and the address from page meta when present.
  4. Reuse the existing preview/og fetch for the tile image.
- With a collection open, a pasted link saves straight into that collection. Planning a trip means opening it and pasting twelve links in a row.
- A link that yields no coordinates still saves. It lands in a "Not on the map" group (see States). Capture never fails on resolution.

## 7. Interaction and layout

**Rail**
- Kind gains "Places" with its count.
- A new "Collections" group sits under it, with a quiet "+ New" that opens an inline name field rather than a modal.
- Each collection row works like a filter row: teal fill, ✓ in the reserved slot, tabular count.
- Opening a collection implies Places.

**Index column (22rem)**
- The collection name in headline serif (or "Places").
- The search field, with the same `/` shortcut.
- The live status line with "Show all".
- The dashed trigger, reading "+ Paste a maps link…" with the `a` key hint.
- Rows:
  - serif title on one line, with "Koto City · tags" muted below;
  - selected row: surface ground, semibold title, teal chevron, `aria-current`;
  - hover or focus on a row rings its pin.
- Sort: newest first. With Near me on, nearest first, with the distance shown ("320 m").

**Map**
- Pins are ink dots with a paper stroke. The selected pin is teal plus a ring, so the shape carries the state as well as the colour.
- Clusters show an ink count when zoomed out.
- Controls are + / − / ◎ (Near me) at the top right, a scale bar at the bottom left, and "© OpenStreetMap" at the bottom right.

**Popover**
- Anchored to the selected pin. It is the one floating element, so it takes the toast shadow.
- Contents:
  - title in serif semibold;
  - address in muted text;
  - Open in Google Maps ↗ (teal link);
  - Edit;
  - Collections… (a checkbox list plus "New collection…"; this replaces the sketch's "Move to…", because membership is many-to-many).
- Esc closes it and returns focus to the row.

**Keyboard and assistive tech**
- The index is the keyboard surface. Arrow keys move through the rows, and the selection pans the map.
- The map stays one focusable region, using MapLibre's own arrow and ± handling, labelled "Map of 12 places".
- Pins are not tab stops.

**Near me**
- Asks for location only when ◎ is pressed, never on load.
- "You" is a hollow ink ring, not teal (teal means selected).
- If permission is denied, a toast says location is off for this site and how to turn it back on. Nothing else changes.

**Places in the All view**
- They are ordinary catalog rows. The tile is the link's og:image, or the serif monogram, the same rule as tools.
- The detail pane shows the place with "Show on map", which opens the map view focused on that place.

**Below lg (mobile)**
- The map takes the top 50dvh, sticky.
- The index scrolls beneath it.
- Filters stay in the existing drawer.
- Tapping a pin scrolls its row into view and shows a compact popover.

**Motion**
- Fly-to on selection.
- Under `prefers-reduced-motion`, the map jumps instead of flying.

## 8. States and ranges

**Ranges**
- 0 to about 500 places per person.
- 3 to 40 places per collection.
- Up to about 30 collections.
- Titles up to about 60 characters, Thai or Latin. Thai gets 1.75 leading.

**States**

| State | What shows |
|---|---|
| No places yet | No map. Serif line "No places yet. Paste a Google Maps or Apple Maps link to save one." plus the trigger. |
| Empty collection | No map. "Nothing in Tokyo, March yet." plus the trigger; anything pasted lands in the collection. |
| Search has no match | "No places match “ramen”" with Clear. The map keeps its view. |
| Panned to empty area | "0 of 12 places in view · Show all". |
| Link had no coordinates | Saved anyway. Listed under "Not on the map (1)" at the index bottom, with "Set location" (click the map to drop the pin). |
| Map loading | The surface ground, with no spinner. The index renders at once from data. |
| Tiles fail (offline) | Muted note on the map: "Map tiles didn't load. Your places are still listed." |
| Location denied | Toast; the sort stays newest first. |
| Many pins | Clusters below a zoom threshold. |

## 9. Constraints and open decisions

**Constraints**
- WCAG 2.2 AA.
- The index is the full keyboard and screen-reader equivalent of the map.
- State is never carried by colour alone.
- Reduced motion is respected.
- Load the map library only on the map view, through a dynamic import.

**Open decisions** (the builder must not invent these):
1. **Map library and tiles.**
   - Recommended: MapLibre GL with OpenFreeMap vector tiles. No key, and the style can be set to the exact tokens in both themes.
   - Leaner option: Leaflet with Carto Positron and Dark Matter raster tiles. A much smaller bundle, but a fixed grey look that can't match the tokens.
   - Check: whether Thai map labels render with the chosen glyph set.
2. **Links that yield no coordinates.**
   - Recommended: the "Not on the map" group, plus Set location.
   - Alternative: a geocoding API, which needs a key and has rate limits.
3. **Mobile layout.**
   - Recommended: a fixed 50/50 split.
   - Upgrade: a draggable bottom sheet with peek and full positions.
4. **Folders for tools and formulae.** Resolved 2026-10-29: collections hold every kind (tools, formulae, places), many-to-many, filed from each item's Collections action.
5. **DESIGN.md.** After the build, add the map's palette roles, pin states, and the popover.

## Build slices (estimate)

1. Data model, migration, and link resolver with tests: about half a day.
2. Map view (index, map, view-as-filter, popover): about a day.
3. Collections (rail group, create, add/remove, paste-into-open-collection): about half a day.
4. Near me, mobile layout, and every state above: about half a day.
