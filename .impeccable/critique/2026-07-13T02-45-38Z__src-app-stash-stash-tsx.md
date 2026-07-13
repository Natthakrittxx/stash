---
target: the stash surface, Kind-tabs moved to hero (src/app/stash/stash.tsx)
total_score: 31
p0_count: 0
p1_count: 1
timestamp: 2026-07-13T02-45-38Z
slug: src-app-stash-stash-tsx
---
Method: dual-agent (A: design-review · B: detector+browser-evidence)

Target: the stash surface (`src/app/stash/stash.tsx`), focused on the just-shipped move of the Kind filter (All / Tools / Formulae) from the sidebar into the page hero.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Live counts, `aria-current`, copy confirm, undo toast, `aria-live` pane. Minor: `isPending` discarded → no busy state on save/sign-out. |
| 2 | Match System / Real World | 3 | tool/formula, terminal card, monogram all land. "Formulae" plural can read as a typo. |
| 3 | User Control and Freedom | 4 | Undo on delete, Esc clears/closes, "Clear the filters". Strong. |
| 4 | Consistency and Standards | 2 | Two filter axes, two visual languages (segmented pills vs sidebar rows), two landmarks (banner vs nav), Kind has no visible label while Tags has an h2. Regressed by the move. |
| 5 | Error Prevention | 3 | `required`/`maxLength`, URL normalized server-side. Native validation only. |
| 6 | Recognition Rather Than Recall | 3 | Counts + kbd hints, but ↑/↓ list nav and Enter-to-pane are undiscoverable (comments only). |
| 7 | Flexibility and Efficiency | 4 | Real keyboard model: focus-follows-selection, Enter→pane, IME-safe global keys, focus restoration. |
| 8 | Aesthetic and Minimalist | 3 | Quiet and earned, but hero now stacks title-row + 3 tabs and the filter concept is split across two zones. |
| 9 | Error Recovery | 3 | `role="alert"` banners + ✕, but surfaces raw server error strings. |
| 10 | Help and Documentation | 2 | No in-UI shortcut reference; empty state teaches tool/formula but not the nav model. |
| **Total** | | **31/40** | **Good** (28–35) — down 1 from last run (32), the cost of the move landing almost entirely in Consistency. |

## Anti-Patterns Verdict

**Does this look AI-generated? No.** A user fluent in Linear/Notion/Raycast would mostly trust it — typographic restraint, earned search-aware counts, and the terminal-card formulae read as authored. The move introduces three small "pauses," none disqualifying:
- **Spatial detachment** — on desktop the segmented control sits in the full-width hero, left-aligned to the h1, so it floats *above the Tags sidebar, not above the list it filters*. A filter that doesn't sit over its target is a genuine smell.
- **Semantic mismatch** — `role="group"` + `aria-pressed` is the multi-select toggle idiom applied to a mutually-exclusive choice.
- **Promotion weight** — a rarely-changed 3-way facet took the most prominent chrome slot, above search, in a product whose stated core is re-finding.

**Deterministic scan** (`detect.mjs`, both file and dir runs, exit 2): **1 finding — `broken-image` at line 974 — confirmed FALSE POSITIVE.** The regex matched the literal `<img>` inside an eslint-disable *comment*; the real elements (L975, L1105) are hardened — dynamic `src` guarded by `if (item.image && !broken)`, `alt=""`+`aria-hidden`, `loading="lazy"`, and an `onError` fallback to a letter tile. Zero true positives. Detector and design review agree: no slop antipattern in the markup.

**Visual overlays: not available.** Browser inspection was skipped — the surface renders only behind `getSession()`→`redirect("/login")` + a Postgres `items` query, and there is no story/fixture/mock route to render `Stash` in isolation. Seeing it would require booting `next dev`, migrating the schema, registering a user + session cookie, and seeding rows. Out of scope for this critique; no user-visible overlay was produced.

## Overall Impression

The move is defensible in principle and slightly under-executed. Promoting Kind is sound reasoning — Kind is a fixed, low-cardinality, always-relevant facet, so a persistent hero control fits its nature, and the count triplet now orients you the instant the page loads ("what's in here?"). Tags are open-ended and high-cardinality, so a scrollable rail fits theirs. The nature-of-facet split is the right instinct. What hurts is the execution: one conceptual job ("narrow my stash") now speaks in two visual vocabularies, in two landmarks, with only one of them labeled — and the promoted control outranks search. Biggest single opportunity: decide whether Kind is a **radio** (pick a lens) or **tabs** (switch a view), fix the ARIA to match, and stop letting it outrank the search box.

## What's Working

1. **Rigorous "never color alone."** ✓/✕ marks, `aria-current` + chevron shape on selected rows, word+mark copy states. State encoding is genuinely accessible — and the new KindTabs keeps it: `focus-visible:outline-accent` on every tab, ✓ is `aria-hidden` with state on `aria-pressed`, not color-only.
2. **Two-treatment content model.** Tool rows drive a preview pane; formulae render as self-contained terminal cards. A real IA insight that honors "content is the interface" — a command shows in full inline because it *is* its own content.
3. **Search-aware counts that stay put** regardless of active facet — every count answers "how many match this search," which most filter UIs get subtly wrong. The hero move actually amplifies this strength: the triplet is now the first thing you read.

## Priority Issues

**[P1] KindTabs uses toggle-button semantics for a single-select choice.** `role="group"` + `aria-pressed` on All/Tools/Formulae.
- **Why it matters:** A screen-reader user hears three independent on/off toggles — no "1 of 3," no arrow-key movement within the group. The mutually-exclusive nature is lost, and the control is orphaned inside the `banner` landmark while Tags stays in `nav`.
- **Fix:** Decide filter-vs-view, then make the ARIA match: `role="radiogroup"`/`radio`+`aria-checked` with roving `tabindex` (arrows move selection), or `tablist` if it's a view switch. Wrap it in a `nav` (or give it a heading) so landmark navigation finds it.
- **Suggested command:** `/impeccable harden`

**[P2] Search is demoted below the Kind facet.** Hero KindTabs precede the search input in DOM and visual order; on mobile, search lands third, under Kind and Tags.
- **Why it matters:** Directly contradicts design principle #3 ("re-finding is the product"). A 3-way switch a user sets once now outranks the primary retrieval affordance.
- **Fix:** Restore search primacy — lead the hero with search, or keep search adjacent-above Kind so the retrieval path opens with `/`, not a facet.
- **Suggested command:** `/impeccable layout`

**[P2] Two filter axes, inconsistent language + detached alignment.** Kind = segmented pills in the banner, no visible label; Tags = sidebar rows in `nav` with an h2. Kind sits above the sidebar, not the list.
- **Why it matters:** Consistency heuristic + co-location cognitive load; a landmark-navigating SR user finds Tags but not Kind. Two vocabularies for one job.
- **Fix:** At minimum give Kind a visible muted axis label matching `railHeading` and a `nav` landmark; ideally reconcile the two treatments into one vocabulary.
- **Suggested command:** `/impeccable distill`

**[P2] Selected-segment width jitter.** `segmentOn` adds `font-semibold` *and* the active tab prepends a ✓ glyph; both widen whichever tab is selected, and in a `flex flex-wrap` group that shifts neighbors as selection moves.
- **Why it matters:** Horizontal jitter on selection is exactly the subtle jank a fluent eye flags — an avoidable slop tell. Same pattern in `FilterRow`.
- **Fix:** Reserve a fixed-width leading slot for the ✓ and avoid weight-driven reflow (fill + constant metrics, or a text-shadow bold trick).
- **Suggested command:** `/impeccable polish`

**[P3] KindTabs has no visible label.** Only `aria-label="Kind"`; the axis name is invisible to sighted users, breaking parity with the visible "Tags" h2.
- **Why it matters:** Both sighted and heading-navigating users lose the "Kind" axis name — a direct inconsistency from the move.
- **Fix:** Add a quiet "Kind" heading, or drop the "Tags" heading for symmetry — pick one and apply it to both axes.
- **Suggested command:** `/impeccable polish`

*(No P0: nothing is broken — every control is keyboard-reachable and the focus ring is present.)*

## Persona Red Flags

**Alex (power user):** Kind tabs aren't group-navigable — no arrow-key roving (it's a `group`, not a radiogroup), each is a separate Tab stop, and there's no shortcut (number keys, t/f) to switch lens despite the keyboard-forward ethos. ↑/↓ list nav doesn't wrap and is undiscoverable; Enter-jumps-to-pane appears nowhere in the UI. Kind parked top-left, list center-right — a small repeated eye-travel tax all day.

**Sam (accessibility / keyboard / SR):** Headline finding — `role="group"` + `aria-pressed` announces three independent toggle buttons, not "radio, checked, 1 of 3," and provides no arrow-key navigation. Landmark orphaning is real: moving Kind into `<header>` puts a filter inside the `banner` landmark while Tags stays correctly in `nav`, so landmark/heading navigation now finds Tags but not Kind. `aria-live="polite"` on the whole DetailPane means the pane may re-announce on every ↑/↓ arrow press (focus-follows-selection) — verbose. **Credit where due:** focus ring is present and visible on every tab; ✓ is `aria-hidden` with state on `aria-pressed`, so SR state isn't color-only.

## Minor Observations

- `isPending` from `useTransition` is discarded — no busy state anywhere (save, sign-out).
- Dead branches: with formulae routed to `FormulaCard`, the formula paths in `Row`/`RowTile`/`DetailPane`/`PreviewTile`/`CommandBlock` are unreachable (self-noted); `CommandBlock` may be fully dead.
- Flat heading tree: every item title, every section, and "Tags" are all `h2`; Kind has no heading at all.
- `max-w-none` outer container lets descriptions run to full width on ultrawide — line-measure concern.
- KindTabs `gap-1`/pill padding differs from `FilterRow` metrics — the two filter styles don't share spacing.
- Mobile order: Kind → Tags → search → list; two filter zones sandwich search into third place.
- `flex flex-wrap` on KindTabs can wrap three tabs to two lines under a long title on narrow screens.

## Questions to Consider

- If Kind earns the hero, why does **search — the stated product core — sit below it**?
- Does a 3-way facet a user sets once deserve a persistent hero control, or would a single "N tools · N formulae" count line do the orienting job without three buttons?
- Is the Kind switch a **radio** (pick the lens) or **tabs** (switch the view)? The answer sets both the ARIA and the mental model — right now it's neither.
- Now that Kind and Tags differ in shape, landmark, and label, are they still "the same kind of thing" to the user — and is that difference intentional?
- When the stash is untagged the whole left column vanishes and Kind floats alone. Is the filtering model coherent across tagged/untagged states?
- Does the ✓ on the active segment add clarity, or is it noise on an already-obvious filled pill — the one place "never color alone" over-fires?
