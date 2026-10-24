---
name: Stash
description: A cracktro title screen for the links and commands you keep losing; your query is the one still line.
colors:
  void: "#000000"
  ivory: "#e6e2d6"
  frost: "#a3a3a3"
  far: "#7a7a7a"
  signal-amber: "#ffb000"
  dust: "#c8c4ba"
  hover-ground: "#1a1a1a"
  frame: "#4a4a4a"
typography:
  hero:
    fontFamily: "VT323, ui-monospace, monospace"
    fontSize: "clamp(3.5rem, min(10vw, 14vh), 8.5rem)"
    fontWeight: 400
    lineHeight: 0.85
    letterSpacing: "-0.01em"
  display:
    fontFamily: "VT323, ui-monospace, monospace"
    fontSize: "clamp(2.25rem, 5.5vw, 3.75rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "VT323, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  row:
    fontFamily: "VT323, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "normal"
  row-front:
    fontFamily: "VT323, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0.06em"
rounded:
  none: "0px"
spacing:
  line: "8px"
  sm: "16px"
  md: "24px"
  lg: "32px"
  xl: "48px"
  section: "112px"
components:
  button-primary:
    backgroundColor: "{colors.void}"
    textColor: "{colors.signal-amber}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "6px 16px"
  button-primary-hover:
    backgroundColor: "{colors.hover-ground}"
    textColor: "{colors.signal-amber}"
  link-inline:
    textColor: "{colors.ivory}"
    typography: "{typography.body}"
  link-inline-hover:
    textColor: "{colors.signal-amber}"
  nav-link-quiet:
    textColor: "{colors.frost}"
    typography: "{typography.body}"
  nav-link-quiet-hover:
    textColor: "{colors.ivory}"
  search-prompt:
    backgroundColor: "{colors.void}"
    textColor: "{colors.ivory}"
    typography: "{typography.display}"
    rounded: "{rounded.none}"
  row-front:
    textColor: "{colors.ivory}"
    typography: "{typography.row-front}"
  row-near:
    textColor: "{colors.frost}"
    typography: "{typography.row}"
  row-far:
    textColor: "{colors.far}"
    typography: "{typography.row}"
---

# Design System: Stash

## Overview

**Creative North Star: "The Cracktro Scroller"**

Stash is a demoscene title screen. An emissive black void, one bitmap face, one signal amber, and dust drifting behind. Your query is the one still line; everything you saved rides baselines in a depth field behind it, and the things that match come forward. Depth is rank: nearness is brightness, letterspacing, and stillness, never a raised surface.

The world is built from text alone. There are no cards, panels, dividers, or containers; content sits directly on the void and hierarchy comes from three type sizes and a four-step light ramp. The one chromatic voice is amber, and it means "here": the caret, the prompt, the primary action, the matched characters. Motion is ambient and slow behind the content, and the front row holds still so it can be read.

**Migration status.** Only the public landing (`src/app/landing.tsx`) ships this world today, scoped under the `.void` subtree in `src/styles/globals.css`. The app UI (`src/app/stash/*`, login, signup, `auth-form.tsx`) and the global `@theme` tokens still run the previous "Card Catalog" system: cool neutrals, enamel teal accent, Source Serif / Geist / Geist Mono, light and dark themes. Those surfaces are expected to migrate later. Until they do, this file describes the target world and the landing as built; it is not a description of the app as it currently renders. A future migration also needs a void value for the danger state, which the landing never had to define.

**Key Characteristics:**

- Emissive black void owns the whole route, overscroll and scrollbar included.
- One bitmap face (VT323, weight 400), three sizes: body, display, hero.
- One signal amber for caret, prompt, primary action, and query matches.
- Depth is rank: front rows are ivory, tracked out, and still; receded rows are dim and sway.
- Two dust ribbons drift on a canvas behind everything at halving speeds.
- No boxes, rules, or cards; the primary action's hairline frame is the single exception.

## Colors

An achromatic light ramp on true black, with one hot amber held to the points of intent.

### Primary

- **Signal Amber**: the caret block, the `>` prompt, the primary action's label, matched query characters inside rows, the text selection ground, and the focus outline. It clears 11:1 on the void. Nothing decorative is amber.

### Neutral

- **Void**: the ground of the whole route, including the `html` element behind overscroll. True black, so the screen reads as emissive rather than as a dark-mode surface.
- **Ivory**: the brightest step. Headlines, the query text, front-ranked rows, specimen titles, inline links. 15.6:1 on the void.
- **Frost**: secondary text. Sub-lines, row status, kind labels, the demo label, unmatched near rows, the quiet nav link. 8.4:1.
- **Far**: the receded step. Rows pushed back by a query, the input placeholder, the footer. 4.6:1 to 4.9:1, the floor for any text in this world.
- **Dust**: the canvas particle color, only ever drawn at 0.35 / 0.5 / 0.7 alpha. It carries no meaning and is exempt from text contrast for that reason.
- **Hover Ground**: the one tonal fill, appearing only under the primary action on hover.
- **Frame**: the hairline around the primary action at rest.

### Named Rules

**The Four Lights Rule.** Text uses exactly ivory, frost, far, or amber. Rank is expressed by which light a line is lit with; no fifth grey, no tint.

**The Signal Rule.** Amber marks intent and match, nothing else: caret, prompt, primary action, matched characters, focus, selection. If amber appears on something a visitor cannot act on or did not ask for, it is wrong.

**The Floor Is Far Rule.** No text dims below the far step. Dimming a line further (opacity, a darker grey) to push it deeper breaks AA; recede with motion and letterspacing instead.

## Typography

**Display Font:** VT323 (with ui-monospace, monospace)
**Body Font:** VT323 (with ui-monospace, monospace)

**Character:** One bitmap terminal face, rendered with font smoothing off so its pixels stay hard. Its small x-height is why body sits at 1.5rem: it reads like ordinary 16px text.

### Hierarchy

- **Hero** (400, `clamp(3.5rem, min(10vw, 14vh), 8.5rem)`, 0.85, -0.01em): the landing headline only, followed by the blinking amber caret block. Capped by viewport height so the demo stays in the first view.
- **Display** (400, `clamp(2.25rem, 5.5vw, 3.75rem)`, 1): section headings, specimen titles, and the search prompt line.
- **Body** (400, 1.5rem, 1.3): everything else: sub-lines, labels, nav, buttons, notes, footer. Prose caps at 40 to 52ch.
- **Row** (400, 1.5rem, 1.25): ranked list rows. The front-ranked variant tracks out to 0.06em.

All copy is lowercase sentence fragments with periods, except the sub-line under the hero, which uses ordinary sentence case.

### Named Rules

**The One Face Rule.** VT323 is the only face in this world, at weight 400. No second family, no bold, no italic. Emphasis is size, light step, or amber.

**The Three Sizes Rule.** Body, display, hero. A fourth size is a sign the hierarchy should be carried by light instead.

**The Tracking Is Rank Rule.** Letterspacing widens only to bring a row forward (0.06em). It is a depth cue, never a label style.

## Layout

A single centred column, max 72rem (`max-w-6xl`), with 16px side padding on mobile and 32px from the `sm` breakpoint (640px). Header: wordmark left, nav right, 24px vertical padding. Text rides baselines: groups align with `items-baseline`, never centred in boxes.

Ranked rows and specimens share a two-column grid from `sm` up: a 7rem kind column (tool / formula / search) and a fluid content column with a 16px gutter. On mobile the kind column collapses and the kind is folded into the sub-line ahead of a `·` separator. Long lines truncate with an ellipsis in rows and break anywhere in specimens.

Rhythm: 8px between a title and its sub-lines, 16px between rows, 24px from a heading to its sub-line, 32px to an action or list, 48px into a section's body, 56px between specimens, and 112px between major sections. The dust canvas is fixed to the viewport behind the column.

## Elevation & Depth

There are no shadows and no raised surfaces. Depth is rank, carried by three cues at once: brightness (ivory, frost, far), letterspacing (0.06em at the front), and stillness (front rows hold; receded rows sway sideways 9 to 16px on a 9s ease-in-out loop). Behind the content, three dust fields drift at 6, 12, and 24 px/s, with nearer fields sparser, larger (0.6 / 0.9 / 1.3px radius), and brighter, arranged in two slow wave ribbons whose edges fray into the void.

When a query re-ranks the list, rows glide to their new slot (FLIP on `translate`, 300ms ease-out) while color and tracking transition together, so a match visibly pulls forward. With reduced motion, the sway, caret blink, and glide stop, the dust draws one still frame, and the demo query appears already typed.

### Named Rules

**The Depth Is Rank Rule.** Nearness means relevance. Never use depth (brightness, tracking, motion) for decoration, and never express relevance with a box, badge, or fill.

**The Still Front Rule.** Whatever the visitor must read holds still. Motion belongs to what has receded.

## Shapes

Square and unframed. Content has no containers, so there are no corners to round. The only drawn line in the world is the 1px frame around the primary action, square-cornered. Inline links use an underline offset 4px. The StashMark logo tile keeps its own 1.4px corner as part of the mark, not as a system radius. The caret is a solid amber block (0.32em by 0.55em).

## Components

### Buttons

The primary action reads as a typed command.

- **Shape:** square (0px), hairline frame in the frame grey.
- **Primary:** amber label prefixed with the `>` prompt ("> start a stash"), transparent on the void, 6px by 16px padding.
- **Hover / Focus:** frame turns amber and the hover ground fills in, over 150ms. Active drops the fill back to black. Focus is the shared 2px amber outline at 4px offset.
- It appears twice on the landing (under the hero and at the close), always paired with a frost "already have one? log in" line on the same baseline.

### Links

- **Inline:** ivory with a 4px-offset underline; amber on hover, 150ms.
- **Nav, primary:** ivory with the `>` prompt ("> log in"), amber on hover, no underline.
- **Nav, quiet:** frost, ivory on hover; may carry a 16px brand mark (the GitHub mark) ahead of the label.

### Inputs / Fields

The search prompt is a bare line, not a field.

- **Style:** display size, ivory text, no background, no border, no outline. An amber `>` prompt sits ahead of it on the same baseline; the text caret is amber. The placeholder is the far step.
- **Focus:** the line itself is the focus indicator (caret visible); the browser outline is removed on this one element.
- **Status:** a frost live-region line directly beneath reports the result count or the empty case in plain words.

### Navigation

Wordmark (StashMark at 24px plus "stash" in body) at top left; links at top right with 24px gaps, all at body size. Same treatment on mobile.

### Ranked Row (signature)

A saved item as two baselines: title, then a sub-line of url-or-command and tags separated by `·`. Rank sets its light: a match is ivory and tracked out with matched characters in amber; an unranked near row is frost; a receded row is far and sways. Rows never carry a fill, border, or icon. Order changes animate; content never jumps.

### Specimen

A three-line explainer of one kind: the kind in frost in the left column, a display-size ivory title, an ivory literal line (url or command, breaking anywhere), and a frost note capped at 52ch.

## Do's and Don'ts

### Do:

- **Do** keep the void true black and let it own the whole route, overscroll included.
- **Do** light every line with one of the four lights (ivory, frost, far, amber) and let the step express rank.
- **Do** keep amber on the caret, the prompt, the primary action, matched characters, focus, and selection only (**The Signal Rule**).
- **Do** set everything in VT323 at weight 400 with font smoothing off, at body 1.5rem, display, or hero size.
- **Do** align groups on shared baselines (`items-baseline`) rather than boxing them.
- **Do** show relevance as depth: brighter, tracked to 0.06em, and still at the front.
- **Do** give every ambient motion a reduced-motion state: one still dust frame, no sway, no blink, query pre-typed.
- **Do** use the 2px amber outline at 4px offset for keyboard focus.

### Don't:

- **Don't** put content in cards, panels, or tiles, and don't draw dividers between rows or sections. The primary action's hairline frame is the only drawn line.
- **Don't** dim text below the far step with opacity or a darker grey; recede with motion and tracking instead (**The Floor Is Far Rule**).
- **Don't** introduce a second typeface, a bold weight, or a fourth type size.
- **Don't** use amber for decoration, backgrounds, or illustration.
- **Don't** use shadows, glows, or raised surfaces to signal depth or importance.
- **Don't** animate the row a visitor is reading.
- **Don't** build the uniform card grid or the generic SaaS dashboard (PRODUCT.md anti-references).
- **Don't** encode meaning in color alone: matches are also brighter, tracked, still, reordered, and counted in the live-region line.
