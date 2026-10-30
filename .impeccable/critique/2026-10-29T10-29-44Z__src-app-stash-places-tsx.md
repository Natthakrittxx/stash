---
target: new maps stash
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:/Users/nonpawit/git/stash/src/app/stash/places.tsx"
target_fingerprint: "sha256:6442e8ee06decd1ec8140cf7fef1fd50c0d173fb2157cd886aef408e897ad926"
target_path: /Users/nonpawit/git/stash/src/app/stash/places.tsx
timestamp: 2026-10-29T10-29-44Z
slug: src-app-stash-places-tsx
---
Method: dual-agent (A: design-review agent · B: detector agent). They ran one after the other, not in parallel, because both drive the same Playwright browser; each was isolated from the other's output.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | The "In view" line can say "0 of 12 … No places in this part of the map" while all 12 pins are on screen. |
| 2 | Match system / real world | 3 | Plain copy throughout. But "Click the map" shows on touch screens, and "Nothing matches that." is generic. |
| 3 | User control and freedom | 2 | Undo, Esc and Show all work. But reload and Back forget Places and the open collection, and "Show on map" is one-way. |
| 4 | Consistency and standards | 2 | Rows act 3 ways: a pinned row selects, an unpinned title opens a link, an All-view row navigates. Counts read 13 at rest but "of 12" when narrowed. |
| 5 | Error prevention | 2 | Dead-end tags show counts. Delete in the card has no confirm. "Save “pizza”" opens a Place composer with no link. |
| 6 | Recognition over recall | 2 | Pins are unnamed, and overlapping pins show no count: 15 places appear as 2 dots. |
| 7 | Flexibility and efficiency | 2 | `/`, `a`, arrows and Enter-to-card are good. But every row is its own Tab stop, and there's no deep link, rename, or bulk filing. |
| 8 | Aesthetic and minimalist design | 3 | A quiet, token-drawn basemap. But 15 stacked "Show on map" labels in the All view. |
| 9 | Error recovery | 3 | The location-denied toast says how to fix it. A dead-end tag gives no reason. |
| 10 | Help and documentation | 2 | Nothing explains "the view is the filter" beyond the status line. |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

**Review:** the surface is authored for this product, with one generic seam.
- **Specific:** the basemap is drawn in the app's colour tokens and follows the theme toggle. The selected pin is teal with a ring, so its shape carries the state, not just its colour. The index is serif and hairline-ruled, and "Not on the map" works as a catalog section. It reads as the Card Catalog, not an embedded Google Map.
- **Generic seam:** the arrangement (index left, map right, popover card) is the standard store-locator layout, and the pins are unnamed. Only the tokens set it apart.

**Detector scan:** 0 findings in `places.tsx`, `map.tsx` and `stash.tsx`. Two existing project ignores were active: `broken-image` on `stash.tsx`, and the `geist mono` font, which DESIGN.md names as its command font.

**Browser overlay:** injected on 3 states. It reported 1 finding, `cramped-padding` on MapLibre's attribution strip. That's a false positive: the strip uses MapLibre's default `0 5px` padding, and its line height keeps the text off the edges. The overlay ran in the reviewer's own tab, which is now closed, so no overlay is visible to you.

## Overall impression

The token-drawn map, the ink and teal pin states, and the keyboard-driven index make this a confident addition to the Card Catalog. The biggest weakness is trust: the signature "view is the filter" behaviour can contradict what's on screen, and a card can stay open after its place leaves the index. For a product whose emotional goal is trust, those two bugs matter more than anything visual.

## What's working

1. **The basemap follows the theme.** It's drawn from the live tokens and repaints in dark mode. Teal appears only on the selection.
2. **The index is a real keyboard surface.** Focus follows selection, ↑/↓ walk the rows, Enter jumps to Open in Maps, and Esc closes the card and returns focus to its row. The canvas is labelled "Map of 12 places in Tokyo, March".
3. **Saving never fails.** A link without coordinates still lands, under "Not on the map" with Set location. The composer knows the open collection, and Thai titles get the right face and line height.

## Priority Issues

1. **[P1] The "in view" filter comes back stale.**
   - **What:** pan Tokyo, March into the bay, switch collection or search, then come back. The map refits to all 12 pins, but the index says "In view: 0 of 12 … No places in this part of the map".
   - **Why it matters:** this is the signature interaction, and the status line is a live region, so a screen reader announces "0".
   - **Fix:** the saved view is keyed by `${q}|${activeTag}|${collectionId}|${showAll}` in `stash.tsx`, so returning to the same key revives the old bounds. Drop the saved view on every refit, using a refit counter instead of the filter key.
   - **Command:** `/impeccable harden`
2. **[P1] A card can outlive its place in the index.**
   - **What:** zooming with + moves around the map's centre, so the selected row drops out of the index while its card stays clipped at the map's edge. A card also survived a collection switch.
   - **Fix:** close the card when the selected place leaves the listed set. Zoom around the selected pin when there is one.
   - **Command:** `/impeccable harden`
3. **[P1] Pins are unnamed, and overlaps hide.**
   - **What:** clustering starts only past 60 pins (`CLUSTER_FROM`). At the Places root, 15 places show as 2 dots, and "Coffee worth the trip" shows 4 as 2. Planning a trip means hovering each row to learn which pin is which.
   - **Fix:** cluster overlapping pins with an ink count below about zoom 10. From about zoom 13, show a muted title label under each pin; the existing `pin-space` collider already keeps basemap labels clear.
   - **Command:** `/impeccable layout`
4. **[P1] Set location only works with a pointer, and the card is under-labelled.**
   - **What:**
     - Set location needs a map click, so there's no keyboard path (fails WCAG 2.1.1).
     - Its banner isn't announced (no `role="status"`) and says "Click" on touch screens.
     - The card has no accessible name, and its Edit and Delete aren't labelled with the place, unlike the unpinned rows.
     - "Open in Maps" doesn't say it opens a new tab.
   - **Fix:** add a "Pin at map centre" button with a centre crosshair, so keyboard users pan with the arrows and press Enter. Give the banner `role="status"` and "Tap" on coarse pointers. Label the card with the place name, and label its actions with it too.
   - **Command:** `/impeccable audit`
5. **[P2] Nothing lives in the URL.**
   - **What:** the tab, collection and selection are React state only. Reload returns to "17 things saved", Back leaves the app, and on a phone reopening a trip takes Filters, then Tokyo, March, then Done every time.
   - **Fix:** mirror them into search params (`?kind=place&c=<id>&p=<id>`). Use replace for filter changes and push for "Show on map".
   - **Command:** `/impeccable harden`

## Persona Red Flags

**Alex (power user):**
- Each of 12+ rows is its own Tab stop, and focusing one opens its card and can pan the map.
- No bookmarkable collection, no rename, and filing 12 places means 12 rounds of card, Collections, checkbox.
- The + button zooms away from the selection.

**Sam (screen reader, keyboard):**
- Hears the false "0 of 12".
- Can't use Set location at all.
- The card's actions come after the canvas and the 3 attribution links in Tab order, and their names are bare "Edit" and "Delete".

**Casey (phone, one-handed):**
- Only one row peeks below the map in the first screen.
- Once scrolled, search and the status line are gone.
- The Filters drawer stays open after picking a collection, with Done out of thumb reach at the top.
- Delete is the card's rightmost action, nearest the right thumb.
- Every row tap zooms the map to at least city level, which loses the overview.

## Minor Observations

- **Dead-end tags:** inside a collection, tags count over the search only, so "cli 1", "disk 1" and "search 1" lead to "Nothing matches that." Count over the scoped list and hide zeros.
- **Long collection names wrap:** the global, unlayered `h1, h2, h3 { text-wrap: balance }` rule beats Tailwind's `truncate`, so long names wrap in the index heading.
- **New collection field:** the placeholder "Tokyo, March" looks like a real value, and there's no visible submit button.
- **All view clutter:** 15 teal "Show on map" labels repeat what the row already does, and the ripgrep preview pane stays parked beside rows that never drive it.
- **Tone:** location-denied uses the wine error style, though it's your own privacy choice. The selected pin also stays teal while Set location places a different place.

## Questions to Consider

- If the map is the planning surface, why can't a pin name itself without the index?
- "The view is the filter" breaks wherever map and index disagree. Would an explicit "Only what's in view" toggle be more honest?
- A collection is a trip you reopen in the street. Why isn't it a URL you can save to a phone's home screen?
