---
target: the stash surface (src/app/stash/stash.tsx)
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-07-11T15-24-15Z
slug: src-app-stash-stash-tsx
---
⚠️ DEGRADED: single-context (harness policy — sub-agents not spawned unless the user requests; design review + detector + contrast math all ran in full)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeleton (loading.tsx) is a different layout than the loaded page → reflow on data resolve; undo toast never auto-dismisses |
| 2 | Match System / Real World | 3 | Clean vocabulary ("tool", "formula", host chips). "Formula" for a saved command is idiosyncratic but taught in the empty state |
| 3 | User Control and Freedom | 3 | Esc/Cancel/Undo/clear-filters all present. Delete is reversible, not a modal — good. Reaching an item's actions by keyboard is the weak spot |
| 4 | Consistency and Standards | 4 | One field style, one segmented-control vocabulary, accent+✓ everywhere. Cohesive |
| 5 | Error Prevention | 3 | required + maxLength on every field; reversible delete. URL only validated server-side |
| 6 | Recognition Rather Than Recall | 3 | Labels + visible kbd chips (a, /, Esc) + live counts. Row actions hidden until hover on narrow hover-capable screens |
| 7 | Flexibility and Efficiency | 3 | Shortcuts + optimistic writes. No bulk actions; on desktop the primary "open" is the most keystrokes |
| 8 | Aesthetic and Minimalist Design | 4 | Content-first, accent held to a sliver, no decoration. Textbook restraint |
| 9 | Error Recovery | 3 | role=alert, plain text, Dismiss, form preserved. Messages are whatever the server returns (generic) |
| 10 | Help and Documentation | 3 | Empty state teaches; contextual kbd hints. No help once the stash is populated |
| **Total** | | **32/40** | **Good — strong foundation, gaps are mostly accessibility** |

## Anti-Patterns Verdict

**Does this look AI-generated? No.** This is genuinely above the slop line and clears the product-register bar (would a Linear/Raycast-fluent user trust it? Yes).

**LLM assessment:** The three-voice type system (serif for saved titles, sans for chrome, mono for commands) is a real, committed idea carried through consistently — not decoration bolted on. Master–detail with a leading og:image tile actively refuses both banned anti-references (uniform card grid, SaaS dashboard). Accent is a deep enamel teal (#005f66, 7:1) held to slivers — it dodged the sage-teal reading-app default the DESIGN.md warns about by name. No gradient text, no glassmorphism, no eyebrow scaffolding, no side-stripes. The one aesthetic smell: a column of identical `$_` tiles when many formulas stack, and repeated monogram letters for same-host tools — mild monotony, but defensible (column alignment is the stated reason).

**Deterministic scan:** `detect.mjs` on `stash.tsx` → 1 warning, `broken-image` at line 886. **False positive.** The `<img src={item.image}>` is a real og:image URL, gated behind `item.image && !broken` with an `onError` fallback to a monogram tile. The detector flags it because there's no literal string `src`. No action.

**Visual overlays:** Not available. The Chrome extension is not connected, so no live browser overlay ran and none is claimed. Static source + token analysis + the CLI scan carried this critique.

## Overall Impression

This is a confident, on-brand piece of product design. The card-catalog concept is legible in the code: the interface recedes, the saved title is the highest-contrast thing, type carries hierarchy before color does. It would earn trust from the intended user.

The single biggest opportunity is honesty about the accessibility bar. DESIGN.md and PRODUCT.md both claim **WCAG 2.2 AA** in bold, and three specific gaps miss it. For an app whose whole pitch is "it'll still be here and still findable in three years," the retrieval path — especially by keyboard — is where the polish should concentrate, and it's currently the least-polished path.

## What's Working

1. **The three-voice type system is executed faithfully.** Serif titles (`font-serif` on ink), sans chrome, mono only for literal machine text (commands, URLs). Thai serif stacked behind the Latin serif so a Thai title doesn't fall back into sans and invert the seam (globals.css:16). This is the identity, and it's real.
2. **Delete → Undo instead of a confirm modal.** `onDelete` optimistically removes, then surfaces an Undo; focus moves to the Undo button as the announced next action (stash.tsx:171). Reversible-by-default beats a "capture costs nothing" app interrupting you with "Are you sure?". Correct call.
3. **State never rides on color alone.** The active filter gets a ✓ *and* accent fill; the selected row gets a chevron (shape) *and* accent *and* `aria-current`; copy feedback is "✓ Copied"/"✕ Failed", a word and a mark, not a green flash. The color-independence rule is met deliberately, everywhere.

## Priority Issues

### [P2] On desktop, an item's actions are a long keyboard journey from the item
- **What:** In the wide master–detail layout, each row is a single "select" button and the real actions (Open, Edit, Delete) live in the `DetailPane`, which sits *after* the entire list in the DOM (stash.tsx:345–400). To open the item you just selected at row 3 of 50, a keyboard or screen-reader user tabs through the other 47 rows to reach the pane.
- **Why it matters:** "Re-finding is the product," and opening the found thing is *the* action. On the primary surface it's the most keystrokes. This hits Sam (screen reader) and Alex (power user) on every single retrieval — the exact moment the app exists for.
- **Fix:** Give the row an activation path to its own actions — Enter on a selected row moves focus into the pane, or expose an "Open" affordance on the row itself for tools (they already have a URL), or render the pane actions adjacent to the selected row in the tab order. A single-key "o to open selected" would also serve the power user.
- **Suggested command:** `/impeccable harden`

### [P2] Single-character global shortcuts have no off switch (WCAG 2.1.4)
- **What:** `a` opens the composer and `/` focuses search on a bare keypress anywhere outside a text field (stash.tsx:194–200). There's a guard for IME composition and for focus inside inputs — good — but there is no way to turn the shortcuts off or remap them.
- **Why it matters:** WCAG 2.2 **2.1.4 Character Key Shortcuts** (Level A) requires single-character shortcuts to be disableable, remappable, or active only on component focus. Speech-input users and some motor-impaired users trigger stray single keys constantly. The doc claims AA; this is an unmet A criterion.
- **Fix:** Cheapest compliant path is to gate them behind a modifier that doesn't collide (or make them active-on-focus). If bare keys are worth keeping for the power user, add a setting to disable them. Given the tiny trusted-circle audience this is low-effort.
- **Suggested command:** `/impeccable harden`

### [P2] Input boundaries fail non-text contrast in light mode (WCAG 1.4.11)
- **What:** `field` uses `bg-bg` (#f5f7f7) — the same color as the page — delineated only by `border-border` (#d3dad9), which is ~1.3:1 against the page. The top search input in particular is a field with no fill contrast and a near-invisible edge until focused.
- **Why it matters:** WCAG 2.2 **1.4.11 Non-text Contrast** requires 3:1 for the visual boundary that identifies a control. Jordan (first-timer) and low-vision users can miss that the search box is an input at all — on a retrieval-first app, search is the front door.
- **Fix:** Either pull the field fill to `surface` so it's distinct from the page, or raise the input border to ≥3:1 (a deliberately darker input hairline, separate from the divider hairline). Dark mode's #33413f border (~2:1) has the same issue and is already flagged in a ponytail comment in globals.css:50.
- **Suggested command:** `/impeccable audit`

### [P2] The loading skeleton is a different layout than the page it covers
- **What:** `loading.tsx` renders a `max-w-2xl` (672px) single column, no filter rail, no leading tiles — plain stacked text bars. The loaded `Stash` is `max-w-7xl` (1280px) with a rail, 112×64 leading tiles per row, and a detail pane. When the RSC fetch resolves, the layout jumps from a narrow one-column list to a wide three-column app.
- **Why it matters:** The skeleton exists to make load feel stable; a skeleton that doesn't match makes it feel *less* stable — a visible reflow at the exact moment the content arrives. (The stale `max-w-2xl` is a leftover from the last committed layout; the working tree moved to master–detail.)
- **Fix:** Rebuild the skeleton to the real shape: `max-w-7xl`, a rail placeholder, rows with a leading-tile placeholder + text bars, and a pane placeholder at `lg`.
- **Suggested command:** `/impeccable polish`

### [P3] The detail pane over-announces, and the undo toast is sticky
- **What:** Two smaller state issues. (1) `aria-live="polite"` is on the whole `DetailPane` aside (stash.tsx:931); every selection change re-announces the entire pane — title, host, description, every tag, the action labels — not just what changed. (2) The undo toast (stash.tsx:424) has no auto-dismiss and no dismiss button, unlike the error toast; a "Deleted X / Undo" bar sits at the bottom indefinitely until the next action.
- **Why it matters:** The live region makes every browse step verbose for screen-reader users, working against the quiet the design otherwise nails. The sticky toast is minor clutter but inconsistent with the error toast's Dismiss.
- **Fix:** Scope the live region to a small element that holds just the title (or announce "Showing X"). Give the undo toast a ~6–8s auto-dismiss (with a `prefers-reduced-motion`-safe timeout) or a Dismiss button to match the error pattern.
- **Suggested command:** `/impeccable harden`

## Persona Red Flags

**Sam (Accessibility-dependent, screen reader + keyboard):**
- Selects a search result, then tabs through the rest of the list to reach Open — the retrieval action is the longest keyboard path on the page.
- Every arrow/tab between rows re-announces the full detail pane via the container-level `aria-live`.
- Stray `a` / `/` keypresses fire global actions with no way to disable them.
- In light mode the search input's boundary is ~1.3:1 — hard to locate for low vision.

**Alex (Impatient power user):**
- Loves that `a` and `/` exist and that writes are optimistic — this is the good part.
- But there's no `o`-to-open, no bulk-select, no way to act on the selected item without leaving the keyboard's natural flow. The one power move (open the thing I found) is missing its accelerator.

**The Maintainer (project persona — the owner + a few trusted people, capturing mid-stream):**
- Capture is genuinely one keypress (`a` → title focused) — the reflex the product depends on is protected. Good.
- On revisit, though, the fastest way to actually open a saved tool on desktop is the mouse, because the keyboard path to the pane's Open button is long. For someone who lives in this daily, that friction compounds.

## Minor Observations

- A column of identical `$_` formula tiles (and repeated same-host monogram letters) reads slightly noisy at rest. Defensible for alignment, but worth a glance in a real dense stash.
- Once the stash is populated, the `/` search hint is no longer shown anywhere (the empty state taught it, then it's gone). The composer keeps its `a` chip; search could keep a `/` affordance.
- Error toast and undo toast share the same fixed bottom-center slot; if both were ever active they'd stack in place.
- `broken-image` detector hit at line 886 is a confirmed false positive (real og:image URL, guarded, with onError fallback).

## Questions to Consider

- On desktop, what if selecting a row and *opening* it weren't two different distances of effort — what would it take for "open the thing I found" to be the cheapest action instead of the most expensive?
- The doc claims WCAG 2.2 AA in bold. Is that a real commitment to hold to (in which case 2.1.4, 1.4.11, and the live-region gaps are bugs), or aspirational framing?
- The skeleton drifted from the layout in one commit. Is there a cheaper way to keep the loading shape honest than hand-maintaining a second copy of the layout?
