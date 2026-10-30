---
version: 1
slug: "src-app-stash-places-tsx"
primary_target: "src/app/stash/places.tsx"
related_targets: ["src/app/stash/stash.tsx","src/app/stash/map.tsx"]
---

# Places map (/stash, Places kind or an open collection)

Scope: the stash's Places view: index column, interactive map, place collections, Near me. Mode: Operate.
Audience: the maintainer and a small trusted circle; places saved by pasting a Google/Apple Maps link.
Jobs: plan a trip from a collection (desktop), find what was saved nearby (phone), look one up and open it in Maps.
Constraints: private (no sharing); capture never fails (a link without coordinates lists as "Not on the map"); WCAG 2.2 AA with the index as the full keyboard and screen-reader equivalent of the map; reduced motion; MapLibre GL + OpenFreeMap loaded only on this view.
Full product brief: .scratch/map-stash/design-brief.md.

## Direction contract

THESIS: when Places or a collection is open, the stash becomes a map: a 22rem index beside a full-height map, and the map's view is the filter. Refuses the full-bleed map with a floating drawer and the grid of place-photo cards.

OWN-WORLD: the Card Catalog unchanged. Cool paper and ink tokens, enamel teal only for selected or active. The basemap is drawn in the tokens: land on surface, water one cool step below, roads on bg, labels in muted sans. Serif titles in the index, Plex Sans for chrome. Pins are ink with a paper stroke; the selected pin is teal plus a ring. The popover is the one floating element and takes the toast shadow. Hairlines, 4px radius.

STORY: open "Tokyo, March" and every spot shows at once. Pan to Koto and the index narrows to what is there ("4 of 12 places in view"). Pick one and open it in Google Maps. Out in the city, press Near me and the index sorts by distance.

FIRST VIEWPORT: desktop (lg and up), left to right:
- The 13rem rail: Kind including Places, Collections with "+ New", Tags.
- The 22rem index: the collection name in headline serif; search with the / hint; the live status line "N of M places in view · Show all"; the dashed "+ Paste a maps link…" trigger (the primary action); hairline rows with a serif title, a muted "area · tags" line, and the selected row on surface, semibold, with a teal chevron.
- The map, from the index's edge to the viewport's right and bottom edges, sticky at full height. Controls + / − / Near me at top right, scale at bottom left, attribution at bottom right, and the popover anchored to the selected pin.

Below lg: the map takes the top 50dvh, sticky, with the index scrolling beneath it.

FORM: Map leads, position 6 of 7 on the ranked list, dealt by the roll. seed:e7ff5b1b14207d24. Signature interaction: the view is the filter. Panning or zooming narrows the index and the live status line, and any search, tag or collection change refits the map to the matches. Motion: a fly-to on selection of 600ms at most, which becomes a jump under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
