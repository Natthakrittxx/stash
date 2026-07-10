---
name: Stash
description: A quiet, typographic place to save things and find them again.
---

<!-- SEED: re-run /impeccable document once there's code, to capture the actual tokens and components. -->

# Design System: Stash

## 1. Overview

**Creative North Star: "The Card Catalog"**

Not the card grid — the card catalog. A drawer of dense, typographic index cards, ordered so a person who knows what they're looking for can find it in seconds, and a person browsing can fall into it for an hour. Every design decision here serves retrieval. The catalog itself is nearly invisible: oak, brass, and typography. What you came for is on the card.

The system is restrained by conviction, not by timidity. Color is scarce because the saved content supplies color — a screenshot, a thumbnail, a book cover — and an interface that also insists on color turns every screen into noise. Type carries the hierarchy instead: a serif for the things you saved, a sans for the machinery around them. That seam is the whole visual idea. When you look at a stash you should see a list of titles, not a list of chrome.

This system explicitly rejects the uniform card grid — the wall of identical thumbnail rectangles that flattens a poem and a tax form into the same object — and the generic SaaS dashboard, with its stat tiles, hero metric, and charts nobody reads. Stash has nothing to report. It has things to show.

**Key Characteristics:**

- Content-first: the saved item is always the highest-contrast thing on screen.
- Typographic hierarchy over chromatic hierarchy.
- Flat at rest; depth appears only in response to state.
- Dense where density informs; airy where it doesn't.
- Motion confirms, never decorates.

## 2. Colors

A near-neutral surface carrying a single cool accent, held to a sliver of any given screen.

### Primary

- **Accent teal** `[value to be resolved during implementation]`: deep, cool, low-lightness. Reserved for the current selection, the primary action, and state indicators. Never decoration, never a background wash, never a gradient.

  **Constraint on the hue.** Deep teal is the reading-app default (Reader, Pocket, Instapaper all sit in the same calm sage-teal band), and landing there by accident is a failure. Push the lightness down and the chroma up until it reads as ink or enamel — a fountain-pen teal, something with a stated position — not the soft desaturated wash that says "wellness app". If it could be mistaken for a meditation timer, it is wrong.

### Neutral

- **Ink** `[to be resolved]`: body text. ≥7:1 against the background. May carry the accent's hue at very low chroma.
- **Muted** `[to be resolved]`: secondary text, timestamps, metadata. ≥4.5:1 against the background — held to the body-text bar, not the muted-gray default.
- **Background** `[to be resolved]`: the reading surface.
- **Surface** `[to be resolved]`: panels and rows, pulled 10–15% from background toward ink.
- **Border** `[to be resolved]`: hairlines and dividers.

### Named Rules

**The Ten Percent Rule.** The accent appears on ≤10% of any screen. Its rarity is what makes it mean "here" and "this one". An accent on every row means nothing.

**The Content Supplies the Color Rule.** Saved items bring their own color — thumbnails, favicons, images. The interface never competes. If a screen looks drab with no items in it, that screen is correct; it is a frame, and frames are drab on purpose.

**The No-Warm-Tint Rule.** The background is a true neutral or tinted toward the accent's own cool hue. Never toward cream, sand, paper, parchment, or linen. Warm-tinted near-white is the saturated AI default and it is forbidden here by name.

## 3. Typography

**Display Font:** `[serif; to be chosen at implementation]`
**Body Font:** `[sans; to be chosen at implementation]`
**Code Font:** `[mono; to be chosen at implementation]`

**Character:** The serif and the sans split the world in two. The serif belongs to the user's content — item titles, excerpts, anything they saved or wrote. The sans belongs to the application — labels, buttons, navigation, counts, timestamps. Pair on a genuine contrast axis; two humanist sans-serifs or two geometric serifs are not a pairing, they are a mistake.

The mono is not a third member of that pair. It is a literal: text the machine emits or consumes, quoted exactly. A saved command is not the user's prose and not the app's chrome, and setting it in either loses the distinctions the reader needs — `l` from `1`, `-` from `--`, a space from two.

### Hierarchy

- **Display** `[to be resolved]`: serif. Item titles at the top of a detail view. Fixed rem scale, not `clamp()` — this is product UI, and a heading that shrinks inside a sidebar looks worse, not better.
- **Headline** `[to be resolved]`: serif. Section and stash names.
- **Title** `[to be resolved]`: serif. Item titles in a list.
- **Body** `[to be resolved]`: sans for UI prose, serif for saved excerpts. Prose caps at 65–75ch. Lists and metadata may run denser.
- **Label** `[to be resolved]`: sans. Buttons, form labels, tags, counts. Sentence case.
- **Code** `[to be resolved]`: mono. Saved commands, URLs, code. Never a label, never prose.

### Named Rules

**The Three Voices Rule.** Serif is the user's voice; sans is the app's voice; mono is the machine's voice. A serif button label is the app pretending to be the user. A sans item title is the app talking over them. A mono label is the app cosplaying as a terminal. Mono is admitted only for literal machine text — a command, a URL, a fragment of code — and never for the interface that surrounds it. There is no fourth font.

**The Fixed Scale Rule.** Scale steps sit at a 1.125–1.2 ratio and are fixed in rem. Fluid type is a brand-register tool; it has no place in a list you scan every day.

## 4. Elevation

Flat by default. Depth is a response, not a decoration. Surfaces sit on the background with a hairline border or a tonal step, never a resting shadow — a list of fifty items with fifty drop shadows is a list of fifty distractions.

Shadows appear only under elements that have genuinely left the page: a command palette, a popover, a dragged item. Their job is to say "this is above, and it is temporary".

### Named Rules

**The Flat-At-Rest Rule.** If it is not floating, hovered, focused, or dragged, it has no shadow. Nested elevation is always wrong; a raised card inside a raised panel means one of them shouldn't be raised.

**The Audit Test.** If it looks like a 2014 app, the shadow is too dark and the blur is too small.

## 5. Components

Omitted. No components exist yet. The next `/impeccable document` run, once there's code, extracts the real button, input, list-row, and command-palette definitions and writes the `.impeccable/design.json` sidecar alongside them.

Two constraints apply in advance, and hold for every component built before that run:

- Every interactive component ships all seven states: default, hover, focus, active, disabled, loading, error. Half a set is not a component.
- Loading is a skeleton, not a spinner dropped into the middle of content.

## 6. Do's and Don'ts

### Do:

- **Do** let the serif/sans split carry hierarchy before reaching for color, size, or weight.
- **Do** hold the accent to ≤10% of any screen (**The Ten Percent Rule**).
- **Do** give every animation a `prefers-reduced-motion: reduce` alternative — a crossfade or an instant transition.
- **Do** hold placeholder text to the 4.5:1 body-text contrast bar, not the muted-gray default.
- **Do** keep motion in the 150–250ms band and let it convey state only: hover, focus, save confirmation, loading, reveal.
- **Do** build empty states that teach the interface. "Nothing here" is a failure; an empty stash should show a person how to fill it.
- **Do** use a hairline border or a tonal step where a lesser design would use a shadow.

### Don't:

- **Don't** build the **uniform card grid**. Pocket, Pinterest, every read-it-later app: a wall of identical thumbnail cards with a title and a favicon. Named as an anti-reference in PRODUCT.md and banned outright here.
- **Don't** build the **generic SaaS dashboard**: sidebar, stat tiles, hero metric, charts nobody reads, gradient accent.
- **Don't** let the teal settle into the soft, desaturated, calm-sage band every reading app already occupies. Push it to ink or enamel.
- **Don't** tint the background warm. No cream, sand, paper, parchment, bone, linen, or ivory — and no token named any of those.
- **Don't** use `background-clip: text` with a gradient. Emphasis comes from weight or size.
- **Don't** use a `border-left` or `border-right` greater than 1px as a colored accent stripe.
- **Don't** nest cards. Ever.
- **Don't** use glassmorphism, decoratively or otherwise.
- **Don't** put a tiny uppercase tracked eyebrow above every section, and don't number sections `01 / 02 / 03` unless the section genuinely is a sequence.
- **Don't** reach for a modal first. Exhaust inline and progressive alternatives; a modal to confirm a save is the opposite of "capture costs nothing".
- **Don't** ship a resting shadow on a list row.
- **Don't** encode meaning in color alone. Every state carries an icon, a label, or a shape as well.
