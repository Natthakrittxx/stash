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
  danger: "#b02a37"
  accent-dark: "#4bc3cc"
  ink-dark: "#e9eeed"
  muted-dark: "#9ba9a7"
  bg-dark: "#0e1413"
  surface-dark: "#172020"
  border-dark: "#33413f"
  danger-dark: "#f0a0a8"
  term-bg: "#0e1413"
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
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.75
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
  command:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.9375rem"
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
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "16px"
  toast:
    backgroundColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
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

## Colors

Cool paper, near-black ink, and one enamel teal; the dark theme inverts the ramp and lifts the teal so it still clears contrast.

### Primary
- **Enamel Teal** (accent; accent-dark in dark theme): the one active color. Primary button fill, selected segment and filter fill, links, the selected row's chevron, focus outlines, and the hero's closing full stop. Text on its fill is the background color.

### Neutral
- **Catalog Paper** (bg / bg-dark): page ground and input fill.
- **Drawer Grey** (surface / surface-dark): the one tonal step. Hovered and selected rows, row tiles, composer panel, toast, the in-pane command block.
- **Hairline** (border / border-dark): dividers between rows, section rules, tile and input outlines, the landing's demo frame.
- **Ink** (ink / ink-dark): titles, headings, input text.
- **Pencil** (muted / muted-dark): secondary text. Hosts, tags, descriptions, counts, idle controls, placeholders.

### Semantic
- **Wine** (danger / danger-dark): destructive actions on hover, error messages, failed copy. Always paired with a mark or the word, never color alone.

### Terminal (fixed)
- **Console** (term-bg, term-surface, term-border, term-ink, term-muted, term-accent, term-danger): the formula card's palette. Pinned to the dark-theme values so the card never flips with the app theme. term-accent marks the prompt and a successful copy.

### Named Rules
**The One Enamel Rule.** Teal is the only hue that means "active" or "go". Anything selected, primary, focused, or linked is teal; nothing decorative is.

**The Cool Neutral Rule.** Neutrals are tinted toward the accent's hue. Warm greys, creams, and beiges do not belong in this drawer.

**The Pinned Console Rule.** The terminal palette never follows the theme toggle. A command card is dark on a light page and dark on a dark page.

## Typography

**Content Font:** Source Serif 4, with Noto Serif Thai behind it, then ui-serif and Georgia
**UI Font:** Geist, with ui-sans-serif and system-ui
**Command Font:** Geist Mono, with ui-monospace

**Character:** A book serif carries what you saved; a quiet grotesque carries what you do to it. Thai sits behind the Latin serif in the same stack so a Thai title lands in a serif instead of a system sans.

### Hierarchy
- **Hero** (400, clamp(2.5rem, 7vw, 4.5rem), 1.05, tight tracking): landing headline only; the closing full stop is set in teal. The single fluid size in the system.
- **Display** (400, 1.875rem, leading-none): the wordmark beside the logo, the detail pane's title.
- **Headline** (400, 1.5rem): section headings on the landing, auth page heading, monogram letters in row tiles.
- **Title** (400, 1.125rem, 1.75 for Thai): row titles, empty-state lines, the search field's text, the landing sub-line.
- **Body** (Geist 400, 0.9375rem): descriptions, form fields, primary buttons, the kinds list.
- **Label** (Geist 400, 0.8125rem): hosts, tags, counts, segmented controls, filter rows, toasts, footer. Semibold only for section headings and the selected row title.
- **Command** (Geist Mono, body size, 1.625): commands in formula cards and the detail pane.

### Named Rules
**The Fixed Scale Rule.** The app's scale is five fixed rem steps at about 1.2 (label 0.8125, body 0.9375, title 1.125, headline 1.5, display 1.875). No clamp() inside the product; the landing hero is the one fluid exception.

**The Thai Leading Rule.** Anything that can hold Thai, titles above all, gets 1.75 line-height so stacked tone marks never clip.

**The Sentence Case Rule.** Section labels and rail headings are sentence case, muted, and untracked.

## Layout

The landing is a single centered column (max 56rem) with 16px gutters (24px from sm), the hero opening 80px down (112px from sm) and sections spaced 96px apart. Prose caps at 44ch for the sub-line and 52 to 60ch elsewhere. The kinds list is a definition list: term over description on mobile, a 10rem term column beside it from sm.

The app is a full-width master–detail layout. Below lg (64rem) it is one column: filters as inline pills above a list. From lg, a 13rem sticky filter rail, the list, and a 24rem sticky detail pane sit side by side with 40px gaps; both sticky columns pin at 40px from the top. Auth is a centered 24rem column, vertically centred.

Rhythm is a 4px base: 4 and 8px inside controls, 16px row padding and tile gap, 24 to 40px between groups, 96px between landing sections. Lists are dense by divider, not by card: rows separated by a hairline with 16px vertical padding; formula cards stack with a 12px gap.

## Elevation & Depth

Flat by default. Depth is conveyed by the surface step (bg to surface) and 1px hairlines, never by lift. Hover and selection change the ground, not the height. The only shadow in the build is Tailwind's large shadow on the fixed-bottom toast, which genuinely floats over content.

### Shadow Vocabulary
- **Toast float** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): the undo and error toasts only.

### Named Rules
**The Tonal Depth Rule.** A container is distinguished by a surface step or a hairline. If something needs a shadow, it should be floating over content; otherwise it does not get one.

## Shapes

Small, quiet corners. Controls, inputs, tiles, the composer, and toasts share a 4px radius. The two framed containers that hold whole compositions, the formula console and the landing's demo frame, take 8px. Fully round shapes appear only as the console's three title-bar dots; mobile filter "pills" keep the 4px corner. Borders are 1px hairlines throughout; the console's border uses the terminal hairline.

## Components

### Buttons
- **Shape:** gently squared (4px).
- **Primary:** teal fill, background-colored body text, 8px by 16px. Hover drops opacity to 90% over 150ms; disabled holds at 60%.
- **Quiet:** muted label text with no fill, 4px by 8px; destructive quiet buttons (Delete) turn wine on hover.
- **Text link:** teal, underline on hover.
- **Focus:** a 2px teal outline offset 2px on every interactive element.

### Segmented controls and filter rows
- **Style:** label-size text, 4px by 10px, 4px radius. Off: muted text, ink on hover (filter rows also take the surface ground on hover).
- **On:** teal fill with background-colored text plus a check mark in a slot reserved in both states, so selection never reflows and never rides on color alone. Weight does not change.
- **Filter rail:** inline pills on mobile; full-width rows with a right-aligned tabular count from lg. Shared by kind tabs, the composer's tool/formula toggle, and tag filters.

### Inputs / Fields
- **Field:** background-colored fill, 1px hairline, 4px radius, 8px by 12px, body text, muted placeholder.
- **Search:** the one input that leads. A step larger (title size, 10px vertical) with a 40px right gutter for the idle `/` key hint, shown as a hairline-boxed label-size kbd.
- **Focus:** teal outline as above.
- **Error:** wine label text with a mark, announced as an alert.

### Tool row
- **Structure:** a 112 by 64px tile (og:image, object-contain on the surface ground; a serif monogram as fallback; a mono `$_` for formulae), then a serif title truncated on one line with the host in muted label text beside it, tags beneath in muted label text.
- **States:** hover and selection take the surface ground; the selected row's title goes semibold and a chevron appears in teal at the trailing edge, with aria-current carrying it to assistive tech.
- **Row actions:** hidden until row hover or focus on hover-capable pointers; always visible on touch.

### Formula card (signature)
- **Material:** the pinned console. 8px radius, terminal hairline border. A term-surface title bar with three round dots and the title in mono muted label text; a term-bg body with a teal prompt, the command in mono body text (scrolls horizontally, never wraps), a Copy control, and the description and tags as mono comments (`#`).
- **Copy:** muted "Copy" turns into term-accent "Copied" or term-danger "Failed" with a mark for two seconds.

### Detail pane
- **Structure:** sticky 24rem column from lg. A full-width tile at about 1.9:1, the title in display serif, then actions. Commands here sit in a surface-ground block in theme colors with the same copy control.

### Composer
- **Style:** a surface panel with hairline border, 4px radius, 16px padding, stacking the tool/formula segment, fields, and a primary button with 12px gaps.

### Toast
- **Style:** fixed to the bottom center, max 24rem, surface ground, hairline, 4px radius, 12px by 16px, the toast float shadow. Errors carry a wine mark and text.

### Landing demo frame
- **Style:** an 8px-radius hairline frame (16px padding, 24px from sm) holding the app's search field, a polite live status line, and the app's Tools and Formulae sections, each headed by a semibold label with a muted count over a hairline.

## Do's and Don'ts

### Do:
- **Do** build every new surface from the app's own idioms: hairline-divided rows, the 112 by 64 tile, serif titles, muted label metadata.
- **Do** mark every selected or result state with a shape or word as well as color (reserved check slot, chevron, "Copied", "Failed").
- **Do** set commands in the pinned console palette, in Geist Mono, with a teal prompt.
- **Do** keep app type on the five fixed rem steps and give Thai-capable text 1.75 leading.
- **Do** keep the teal as the only active color; danger is the only other hue.
- **Do** respect reduced motion: transitions collapse to near zero, and the landing's auto-typed demo query appears at once.

### Don't:
- **Don't** use warm neutrals; the drawer is cool.
- **Don't** let the console card follow the theme toggle.
- **Don't** lift containers with shadows; reserve the shadow for content that floats.
- **Don't** introduce tracked uppercase eyebrows over sections; rail and section labels are sentence case and muted.
- **Don't** add a second accent hue or a decorative use of teal.
- **Don't** give the landing its own visual world; it runs the app's.
