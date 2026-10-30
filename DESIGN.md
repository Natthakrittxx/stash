---
name: Stash
description: A quiet, typographic place to save things and find them again.
colors:
  accent: "#005f66"
  ink: "#14181a"
  muted: "#5a6462"
  bg: "#f5f7f7"
  surface: "#e7ebeb"
  border: "#d3dad9"
  field: "#778482"
  danger: "#b02a37"
  accent-dark: "#4bc3cc"
  ink-dark: "#e9eeed"
  muted-dark: "#9ba9a7"
  bg-dark: "#0e1413"
  surface-dark: "#172020"
  border-dark: "#33413f"
  field-dark: "#5f6e6c"
  danger-dark: "#f0a0a8"
  term-bg: "#080c0c"
  term-surface: "#172020"
  term-border: "#33413f"
  term-ink: "#e9eeed"
  term-muted: "#9ba9a7"
  term-accent: "#4bc3cc"
  term-danger: "#f0a0a8"
typography:
  hero:
    fontFamily: "Source Serif 4, Noto Serif Thai, ui-serif, Georgia, serif"
    fontSize: "clamp(2.5rem, 7vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  display:
    fontFamily: "Source Serif 4, Noto Serif Thai, ui-serif, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1
  headline:
    fontFamily: "Source Serif 4, Noto Serif Thai, ui-serif, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 400
  title:
    fontFamily: "Source Serif 4, Noto Serif Thai, ui-serif, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  body:
    fontFamily: "IBM Plex Sans, IBM Plex Sans Thai, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  label:
    fontFamily: "IBM Plex Sans, IBM Plex Sans Thai, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
  command:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  sm: "4px"
  lg: "8px"
  full: "9999px"
spacing:
  tight: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-quiet:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  segment-on:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  segment-off:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  input-field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  input-search:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "10px 40px 10px 12px"
  row-tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    width: "112px"
    height: "64px"
  formula-card:
    backgroundColor: "{colors.term-bg}"
    textColor: "{colors.term-ink}"
    typography: "{typography.command}"
    rounded: "{rounded.lg}"
    padding: "12px"
  composer:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.lg}"
    padding: "20px"
  toast:
    backgroundColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  place-row:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "12px"
  place-row-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "12px"
  place-card:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
    width: "22rem"
  map-control:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    size: "32px"
  map-pin:
    backgroundColor: "{colors.ink}"
  map-pin-selected:
    backgroundColor: "{colors.accent}"
    size: "16px"
---

# Design System: Stash

## Overview

**Creative North Star: "The Card Catalog"**

Stash is a library drawer, not a dashboard. Every saved thing is a catalogued entry: a small tile to recognise it by, a serif title to read it by, and a muted line of host and tags to file it by. The whole product, landing page included, runs this one world. The landing does not perform a separate brand; its demo frame is the app's own list (tool rows and terminal formula cards) behind the app's own search field, so what a visitor sees is what they get.

The palette is cool paper and ink with one enamel teal. Neutrals lean slightly toward the accent's hue and never warm. Depth is tonal: a surface step and a hairline, never a lifted card. Type carries the hierarchy in three voices: a book serif for anything you read as content (titles, headings, the hero), a neutral sans for the controls around it, and a mono for commands. Commands get their own material: an always-dark console card that stays dark in both themes, because a command lives in a terminal.

Light and dark are both first-class. The OS preference drives the theme until the toggle writes an explicit choice, and every token flips from one set of custom properties.

**Key Characteristics:**
- One world across landing, auth, and app; the landing demo reuses the app's row and formula idioms.
- Cool neutrals plus a single teal accent; one semantic hue (danger) beyond it.
- Serif for content, sans for chrome, mono for commands.
- Flat and tonal; the only shadow belongs to the floating toast.
- Selection and state are never carried by color alone.
- Places open onto a map drawn in the same tokens, beside a hairline index that is its full equivalent.

## Colors

Cool paper, near-black ink, and one enamel teal; the dark theme inverts the ramp and lifts the teal so it still clears contrast.

### Primary
- **Enamel Teal** (accent; accent-dark in dark theme): the one active color. Primary button fill, selected segment and filter fill, links, the selected row's chevron, focus outlines, and the hero's closing full stop. Text on its fill is the background color.

### Neutral
- **Catalog Paper** (bg / bg-dark): page ground and input fill.
- **Drawer Grey** (surface / surface-dark): the one tonal step. Hovered and selected rows, row tiles, toast, the in-pane command block.
- **Hairline** (border / border-dark): dividers between rows, section rules, tile and input outlines, the landing's demo frame.
- **Ink** (ink / ink-dark): titles, headings, input text.
- **Pencil** (muted / muted-dark): secondary text. Hosts, tags, descriptions, counts, idle controls, placeholders.

### Semantic
- **Wine** (danger / danger-dark): destructive actions on hover, error messages, failed copy. Always paired with a mark or the word, never color alone.

### Terminal (fixed)
- **Console** (term-bg, term-surface, term-border, term-ink, term-muted, term-accent, term-danger): the formula card's palette. Pinned to the dark-theme values so the card never flips with the app theme; term-bg sits a step below the dark page ground so the console still reads as a recessed well in the dark theme. term-accent marks the prompt and a successful copy.

### Map (live)
- **Basemap** (surface, border, bg, ink, muted): drawn from the theme tokens, read live from the custom properties, so the map repaints when the theme flips. Land is surface. Water is border in light and bg in dark; roads are bg in light and border in dark, so each sits one step either side of the land in both themes. Parks are ink at 5%. Rail is a muted 1px dashed line at 40%. Labels are muted with a 1.5px land-colored halo. There is no building layer.
- **Pins** (ink, bg, accent): ink with a paper stroke at rest, teal only when selected. See Map in Components.

### Named Rules
**The One Enamel Rule.** Teal is the only hue that means "active" or "go". Anything selected, primary, focused, or linked is teal; nothing decorative is.

**The Cool Neutral Rule.** Neutrals are tinted toward the accent's hue. Warm greys, creams, and beiges do not belong in this drawer.

**The Pinned Console Rule.** The terminal palette never follows the theme toggle. A command card is dark on a light page and dark on a dark page.

**The Drawn Map Rule.** The basemap is drawn in the theme tokens and follows the theme toggle, unlike the console. Every map color is a token role, never a vendor style, and teal on the map means selected and nothing else.

## Typography

**Content Font:** Source Serif 4, with Noto Serif Thai behind it, then ui-serif and Georgia
**UI Font:** IBM Plex Sans, with its own IBM Plex Sans Thai behind it, then ui-sans-serif and system-ui
**Command Font:** Geist Mono, with ui-monospace

**Character:** A book serif carries what you saved; an engineered grotesk with squared curves carries what you do to it. Each Latin face has a Thai face behind it in the same stack: Noto Serif Thai behind the serif so a Thai title lands in a serif, IBM Plex Sans Thai behind the sans, drawn as one family with the Latin, so Thai tags and labels match it exactly.

### Hierarchy
- **Hero** (400, clamp(2.5rem, 7vw, 4.5rem), 1.05, tight tracking): landing headline only; the closing full stop is set in teal. The single fluid size in the system.
- **Display** (400, 1.875rem, leading-none): the wordmark beside the logo, the detail pane's title.
- **Headline** (400, 1.5rem): section headings on the landing, auth page heading, monogram letters in row tiles.
- **Title** (400, 1rem, 1.75 for Thai): row titles, empty-state lines, the landing sub-line.
- **Body** (Plex Sans 400, 0.875rem): descriptions (1.625 leading), form fields including the URL and search; primary buttons at 500.
- **Label** (Plex Sans, 0.8125rem): hosts, tags, counts, status lines, toasts and footer at 400; field labels, segmented controls, filter rows and quiet buttons at 500. Semibold (600) for section and rail headings and the selected row title.
- **Command** (Geist Mono, body size, 1.625): commands in formula cards and the detail pane. Mono is for showing commands; the composer's one field takes links and commands alike, so it stays in the UI sans.
- **Map labels** (Noto Sans Regular; 13, 12 and 11px for city, town and smaller places; 11px street names from zoom 14; cluster counts in Noto Sans Bold 12px): muted, English names first, then Latin, then local. A forced adaptation, not a type choice: OpenFreeMap serves only Noto glyphs, so the basemap cannot set Plex. It holds inside the map canvas only; every HTML element on the map (controls, scale, attribution, the place card) keeps the app's faces and fixed steps.

### Named Rules
**The Fixed Scale Rule.** The app's scale is five fixed rem steps (label 0.8125, body 0.875, title 1, headline 1.5, display 1.875). Dense by choice: the small steps stay readable because weight and tone carry the hierarchy (500 for anything you press or that names a field, 400 for what you type and read), not size. No clamp() inside the product; the landing hero is the one fluid exception.

**The Thai Leading Rule.** Text that holds Thai gets 1.75 line-height so stacked tone marks never clip; `lang="th"` on the element applies it. List-row titles take 1.75 whatever their language, so mixed Thai and Latin rows keep one rhythm. The detail pane's title and descriptions use Latin leading (1.25, 1.625) unless they hold Thai.

**The Sentence Case Rule.** Section labels and rail headings are sentence case, muted, and untracked.

## Layout

The landing is a single centered column (max 56rem) with 16px gutters (24px from sm), the hero opening 80px down (112px from sm) and sections spaced 96px apart. Prose caps at 44ch for the sub-line and 52 to 60ch elsewhere. The kinds list is a definition list: term over description on mobile, a 10rem term column beside it from sm.

The app is a full-width master–detail layout. Below lg (64rem) it is one column: filters as inline pills above a list. From lg, a 13rem sticky filter rail, the list, and a 24rem sticky detail pane sit side by side with 40px gaps; both sticky columns pin at 40px from the top. Auth is a centered 24rem column, vertically centred.

Rhythm is a 4px base: 4 and 8px inside controls, 16px row padding and tile gap, 24 to 40px between groups, 96px between landing sections. Lists are dense by divider, not by card: rows separated by a hairline with 16px vertical padding; formula cards stack with a 12px gap.

Places, or an open collection, turns the app into a map. From lg it becomes an app shell: the page stops scrolling and fills the window height. The 13rem rail and a 22rem index scroll in their own columns, each with a 6px inset so focus rings clear the clipped edges, and the map fills from the index's edge to the window's right and bottom edges behind a hairline top and left border. Below lg the map is sticky at the top, 50dvh tall and full-bleed, under the header, search and paste trigger, with the index scrolling beneath it, so search and capture keep the lead. Places rows carry a scroll margin, so a row scrolled into view lands below the sticky map. With nothing in scope (no places, or an empty collection) there is no map at all: a serif title-size line and a muted body line stand where it would be.

## Elevation & Depth

Flat by default. Depth is conveyed by the surface step (bg to surface) and 1px hairlines, never by lift. Hover and selection change the ground, not the height. The only shadows in the build are Tailwind's large shadow on the bottom-right toast and on the composer popup, the two things that genuinely float over content.

The map adds two more floaters and gives them the same shadow: the place card over its pin, and the "Set location" banner. Everything else on the map (the control stack, scale, attribution) sits flat on a hairline or a translucent bg.

### Shadow Vocabulary
- **Toast float** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): the undo and error toasts only. The composer, the place card and the set-location banner reuse it.

### Named Rules
**The Tonal Depth Rule.** A container is distinguished by a surface step or a hairline. If something needs a shadow, it should be floating over content; otherwise it does not get one.

## Shapes

Small, quiet corners. Controls, inputs, tiles, the composer, and toasts share a 4px radius. The two framed containers that hold whole compositions, the formula console and the landing's demo frame, take 8px. Fully round shapes appear only as the console's three title-bar dots; mobile filter "pills" keep the 4px corner. Borders are 1px hairlines throughout; the console's border uses the terminal hairline. On the map, pins, their rings and clusters are circles: a point is round. The map's control stack and place card keep the 4px corner.

## Components

### Buttons
- **Shape:** gently squared (4px).
- **Primary:** teal fill, background-colored body text, 8px by 16px. Hover drops opacity to 90% over 150ms; disabled holds at 60%.
- **Quiet:** muted label text with no fill, 4px by 8px; destructive quiet buttons (Delete) turn wine on hover.
- **Text link:** teal, underline on hover.
- **Focus:** a 2px teal outline offset 2px on every button, link and control; text fields mark focus on their own edge instead (see Inputs).

### Segmented controls and filter rows
- **Style:** label-size text, 4px by 10px, 4px radius. Off: muted text, ink on hover (filter rows also take the surface ground on hover).
- **On:** teal fill with background-colored text plus a check mark in a slot reserved in both states, so selection never reflows and never rides on color alone. Weight does not change.
- **Filter rail:** inline pills on mobile; full-width rows with a right-aligned tabular count from lg. Shared by kind tabs, collections and tag filters; the composer's kind toggle is the bordered segmented variant (see Composer). Past 12 tags the list shows the 10 most used (plus the active one) behind a "Show all N tags" text toggle. Hidden entirely on an empty stash.

### Inputs / Fields
- **Field:** background-colored fill, 1px field-token edge (3:1 against bg and surface; the hairline is for dividers only), 4px radius, 8px by 12px, body text, muted placeholder.
- **Search:** the one input that leads, by place and width rather than size: body text like every field, 10px vertical, with a 40px right gutter for the idle `/` key hint, shown as a hairline-boxed label-size kbd. Its clear button is redrawn in muted (ink on hover). Beneath it, a muted label-size result line, a polite live region: "14 things saved" at rest, "3 matches for “git” in Tools tagged ssh" while filtering, with a teal Clear link.
- **Focus:** the field's own edge turns teal, doubled to 2px by a flush 1px ring, with no offset gap; wine when the field is invalid. The new-collection row does the same around its whole row. Shared as `fieldFocus` in `src/app/stash/ui.ts`.
- **Error:** wine label text with a mark, announced as an alert, directly under the field it names. That field takes a wine edge, a wine focus outline and aria-invalid, and receives focus; typing clears it. Forms are `noValidate` and check themselves, so no browser bubble ever appears. A failed submit never clears what was typed.
- **Touch:** on coarse pointers, small controls grow to a 44px hit area; keyboard hints (`/`, `a`, "Esc to close") are hidden.

### Tool row
- **Structure:** a 112 by 64px tile (64 by 36 below sm; og:image, object-contain on the surface ground; a serif monogram as fallback), then a serif title with the host in muted label text, tags beneath in muted label text. The host is omitted when it is the title. Desktop rows (selectors for the pane) truncate the title on one line with the host beside it; desktop rows inset their content 12px so the hover and selected ground clears the tile and chevron, with the text block centred on the tile; narrow rows let the title wrap to two lines with the host on its own line, and put Edit/Delete under the text on phones so the title keeps the width.
- **States:** hover and selection take the surface ground; the selected row's title goes semibold and a chevron appears in teal at the trailing edge, with aria-current carrying it to assistive tech.
- **Row actions:** hidden until row hover or focus on hover-capable pointers; always visible on touch.

### Formula card (signature)
- **Material:** the pinned console. 8px radius, terminal hairline border. A term-surface title bar with three round dots and the title in mono muted label text (omitted when it only repeats the command; Edit/Delete wrap beneath it when narrow); a term-bg body with a teal prompt, the command in mono body text (scrolls horizontally, never wraps; the edge with more to scroll fades), a Copy control, and the description and tags as mono comments (`#`).
- **Copy:** muted "Copy" turns into term-accent "Copied" or term-danger "Failed" with a mark for two seconds.

### Detail pane
- **Structure:** sticky 24rem column from lg. A full-width tile at about 1.9:1, the title in display serif at 1.25 leading, then actions. Tools only: formulae already show everything in their card. When no tool is showing the column stays reserved, so the list never jumps wider. Esc returns focus to the selected row.

### Composer
- **Style:** a native modal `<dialog>` 12vh from the top, max 32rem, page ground, hairline, 8px radius, toast float shadow, 40% black backdrop. A serif title-size heading with a close mark, then one field and the kind, then an action bar a surface step down behind a hairline: "+ Add details" on the left, Cancel and Save on the right. Opened by the dashed "Save a tool, a formula, or a place…" trigger ("Paste a maps link…" in Places), `a`, Edit, and the empty and no-match states.
- **One field:** "Paste a link or a command…". It picks the kind as you type (a maps link is a place, any other link with or without a scheme a tool, anything else a formula) and shows it in a "Saving as" segmented control you can flip; flipping pins it. The control is one hairline-bordered pill with three equal thirds (Tool, Formula, Place), each at least 6rem so "✓ Formula" fits, so the ✓ moving across never resizes it. On phones it wraps under its "Saving as" label. Edit opens pinned to the saved kind. Enter saves, Shift+Enter breaks a long command.
- **Details:** title, what it's for, and tags sit hidden until "+ Add details" (then "− Hide details"), which opens them and focuses Title. Open from the start when editing or when a draft or prefill fills one of them. A server error in a hidden field opens them and focuses the field. A restored draft shows "Unsaved draft. Discard" at the right of the kind row.
- **Close:** Esc, the close mark, Cancel, or a backdrop click (a press that starts on the backdrop). Focus returns to whatever opened it, or to the trigger.
- **Into a collection:** with a collection open, the heading reads "Save to" and the collection's name, and the new item is filed there.
- **Draft:** closing an unsaved new item keeps it; the next open restores it with a muted "Your unsaved draft." and a Discard link.

### Toast
- **Style:** fixed 16px from the bottom-right corner (full width less 16px gutters on phones), max 24rem, surface ground, hairline, 4px radius, 12px by 16px, the toast float shadow. Errors carry a wine mark and text.
- **Kinds:** error (alert, Dismiss), undo (8s, held while hovered or keyboard-focused), saved receipt ("✓ Saved “title”", 4s, no action).

### Landing demo frame
- **Style:** an 8px-radius hairline frame (16px padding, 24px from sm) holding the app's search field, a polite live status line, and the app's Tools and Formulae sections, each headed by a semibold label with a muted count over a hairline.

### Places index
- **Heading:** the open collection's name, or "Places", in headline serif. An open collection adds a quiet "Delete collection" that confirms in place ("Its places stay in your stash.") with a wine Delete link.
- **Rows:** hairline-divided, 12px padding, no tile. A serif title on one line, then "area · tags" in muted label text, where the area is the address segment before the city. Hover and selection take the surface ground; the selected row goes semibold with a teal chevron and aria-current. With Near me on, the distance shows as a tabular muted label before the chevron.
- **Keyboard:** focus follows selection, ↑/↓ walk the rows, Enter goes to the place card. Hovering a row rings its pin.
- **Not on the map:** places without a pin sit under their own section heading, each a serif title linking out, with a teal underlined "Set location", then Edit and Delete as quiet buttons.
- **Status line:** "N places in X" at rest. When the visitor's own pan or zoom narrows the index it reads "In view: N of M places …" with a teal "Show all": the view is the filter. A search, tag or collection change refits the map and drops the narrowing. A view with no pins in it says so in muted label text.

### Map
- **Pins:** ink circles with a 2px paper stroke, growing with zoom. Hover adds an ink ring. Selected is a teal fill plus a wider teal ring, so the shape carries the state as well as the color. You (Near me) are a hollow ink ring, never teal.
- **Clusters:** pins that would overlap merge up to zoom 10 into ink circles with a paper stroke and paper count text, so a whole trip seen from a country away reads as "12", not as one dot. Past zoom 10 every pin shows on its own; a click on a cluster zooms to where it splits.
- **Pin names:** from zoom 13, each pin carries its title below it in 12px Noto Sans, ink with a land halo, so a place's name never reads as a muted street name. Names sit under the pin colliders, so a name never covers a pin, and above the basemap labels, which give way to them.
- **Label clearance:** invisible collider symbols at each pin, each cluster and at you reserve space, so labels give way instead of being stamped over.
- **Controls:** a field-edged stack at top right with hairline dividers: zoom in, zoom out, Near me. Drawn SVG strokes at 16px in 32px buttons (44px on coarse pointers), surface ground on hover, an inset teal focus outline. Near me turns teal while on. No rotation or pitch.
- **Scale and attribution:** a metric scale at bottom left and text attribution at bottom right (the words, never the "i" button), both muted label-size text on a translucent bg.
- **Set location:** a bg banner at top left with a hairline and the toast float shadow, announced as a status: "Click (Tap on touch) the map where “X” is, or move it under the cross and press Enter.", with a teal underlined "Pin here" and a quiet Cancel. An ink cross marks the map's centre, the cursor becomes a crosshair, and the map takes focus so the arrow keys pan it; Enter or "Pin here" pins at the cross, Esc cancels. No other pin stays teal meanwhile.
- **Tile failure:** a muted label-size line on the map ("Map tiles didn't load. Your places are still listed."); the index keeps working.
- **Motion:** fits and the ease to an off-screen selection take 600ms at most, zoom 250ms; all jump under reduced motion. The zoom buttons zoom about the selected pin while it is on screen, so it stays put.
- **Honest narrowing:** any refit (a search, tag, collection, Show all, Near me) drops the visitor's own view, and a place's card closes once the place leaves the view, so the index, its status line and the card never disagree with the map.

### Place card
- **Style:** the one floating element on the map: bg ground, hairline, 4px radius, 12px by 14px, the toast float shadow, and a tip in the bg color on whichever side it anchors.
- **Contents:** the name in serif semibold at title size, the full address in muted label text, then one row: a teal underlined "Open in Maps ↗", a quiet "Collections (n)", Edit, and Delete (wine on hover). "Collections" discloses a hairline-topped checkbox list plus "+ New collection".
- **Placement:** beside the pin at 22rem max on wide maps; above the pin, at the map's width less 32px, on maps narrower than 480px.
- **Close:** Esc closes it and returns focus to its row.

### Collections
- **Any kind:** a collection holds tools, formulae and places alike, and an item can sit in several.
- **Rail:** a Collections group between Kind and Tags, built from filter rows (teal fill and ✓ when open, tabular count of everything in it that the search reaches). The Kind tabs gain Places.
- **Where you are:** opening a collection keeps the current kind; All, Tools and Formulae list what's in it, and Places maps its places. Like Places, an open collection is a location, not a filter: its name heads the column with "Delete collection" beside it (with none open, the heading names the kind showing: Everything, Tools, Formulae or Places, so the search and list sit at the same height in every view), the status line reads "N things in X", and Clear leaves it open. Click it in the rail again to leave.
- **Filing:** every item has a quiet "Collections (n)" action beside Edit and Delete: in the place card, the tool preview pane, a tool row on phones, and a formula's console title bar. It discloses a checkbox list of collections plus "+ New collection", which files the item into the new one. Under a formula the list opens below the console card, in page colours, so the pinned console never holds a page field.
- **Empty:** a collection with nothing in it says "Nothing in X yet." centred under the trigger; one whose things are all of another kind falls back to "Nothing matches that." with Clear the filters.
- **New:** "+ New collection" is a teal underlined quiet button that opens a rail-row-sized name field in place: Enter creates, Esc or clicking away from it empty puts the button back. Errors follow the field error pattern.

### Places in the All view
- **Rows:** no tile, since a tile would carry no information for a place. A serif title, then "area · tags" in muted label text, then a teal "Show on map" (muted "Not on the map" for a place with no pin); on phones a muted chevron instead. Hover takes the surface ground.

## Do's and Don'ts

### Do:
- **Do** build every new surface from the app's own idioms: hairline-divided rows, the 112 by 64 tile, serif titles, muted label metadata.
- **Do** mark every selected or result state with a shape or word as well as color (reserved check slot, chevron, "Copied", "Failed").
- **Do** set commands in the pinned console palette, in Geist Mono, with a teal prompt.
- **Do** keep app type on the five fixed rem steps and give Thai-capable text 1.75 leading.
- **Do** keep the teal as the only active color; danger is the only other hue.
- **Do** respect reduced motion: transitions collapse to near zero, and the landing's auto-typed demo query appears at once.
- **Do** draw any map in the live theme tokens: land on surface, ink pins with a paper stroke, teal only for the selected pin, you as a hollow ink ring.
- **Do** keep the map's chrome in the app's idioms: a field-edged control stack with drawn SVG icons, muted label-size scale and attribution, and the toast float only for what floats over the map.

### Don't:
- **Don't** use warm neutrals; the drawer is cool.
- **Don't** let the console card follow the theme toggle.
- **Don't** lift containers with shadows; reserve the shadow for content that floats.
- **Don't** introduce tracked uppercase eyebrows over sections; rail and section labels are sentence case and muted.
- **Don't** add a second accent hue or a decorative use of teal.
- **Don't** give the landing its own visual world; it runs the app's.
- **Don't** give place rows a tile; a place has nothing to show in one that its name doesn't already say.
- **Don't** ship a vendor basemap style, a building layer, or the map library's default chrome.
