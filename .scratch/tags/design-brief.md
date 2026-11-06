# Design brief: tags you pick, make ahead, rename and delete

Mode: Operate. World: the Card Catalog (`DESIGN.md`), unchanged. Domain: **Tag** in `CONTEXT.md`. Storage: ADR 0004.

## 1. Job and audience

The account holder tags things at two moments. While saving, it is mid-stream and optional: tags stay behind "+ Add details", so capture still costs nothing. While re-finding, they curate the vocabulary they filter by. Today they retype every tag and get near-duplicates ("Git" and "git"). They need to pick from their own tags, make a tag before anything uses it, and fix a tag once for every item.

## 2. Outcome and proof

- Picking an existing tag takes about three typed letters and Enter, or one tap on a suggestion.
- A typed name that does not exist yet becomes a tag when the item saves, with no detour.
- A tag made in the rail shows there at once, with a count of 0.
- Renaming or deleting a tag changes every one of your items in one action. A rename onto a name you already have says it will merge first.
- Tags are lowercase everywhere, so "Git" and "git" can no longer both exist.

## 3. Direction

Thesis: a tag is a catalogue heading you file under, not a decoration. Everything stays flat and in the existing idioms. The picker adds no floating layer to the composer dialog: its suggestions are a muted label-size line under the field, like a row's "host · tags" line. Tag actions live with the tag's own words in the result line, not in the heading, which names where you are.

Signature moment: you type `do`, and the line under the field reads `docker 14 · dockerfile 3 · + Create "do"`. Then Enter.

## 4. Scope and boundaries

Production-ready, three surfaces:

1. The Tags field in the composer details: `src/app/stash/stash.tsx`, the `name="tags"` field.
2. "+ New tag" in the rail's Tags group: `FilterRail`.
3. Rename tag / Delete tag beside the result line under search, in both the list view and the Places index.

Unchanged: how tags show on rows (muted label line), formula cards (`# tags` comments) and the detail pane. Also unchanged: rail filter rows, search, the composer's one field and the capture path.

Anti-goals: no tag colors, icons or emoji, no tag manager page, no floating dropdown, no per-tag styling, no tag badges on rows.

## 5. States and ranges

- Per account: 0 to about 200 tags, typically 10 to 40. Names are 1 to 32 characters, Latin or Thai, spaces allowed, no commas.
- Per item: 0 to 10 tags. At 10, the input disables with a muted "10 tags is the most one item takes." and the suggestion line hides.
- Suggestions: up to 6, on one line (wrapping to at most two on phones). Field empty: your most-used tags not yet on the item. Typing: matches that start with the text, then matches that contain it, then a teal "+ Create “…”" when no exact match exists. 0-use tags show without a count.
- Inside a shared collection: suggestions are only your own tags. Rename and Delete show only when the active tag is one of yours. Item counts are your own items across the whole stash, not the view.
- Rail: hidden on an empty stash, as today (the composer is how to make a first tag). Unused tags list with 0 when no search is active, ranked last. A tag made this visit stays in the short list (as the active tag does) even past the "Show all" limit, until reload.
- Errors: a rename or delete that fails on the server rolls back and shows the error toast. Field errors follow the field error pattern: "A tag needs a name.", "Tags can't contain commas.", "32 characters at most."

## 6. Interaction and layout

**Picker (composer details)**
- One field-styled box that holds chips and an input. A chip is label text on the surface ground with a 4px corner and an × remove button (accessible name "Remove git"). A chip for a tag that does not exist yet has a dashed edge, and its accessible name says "new tag". Shape carries the state, not color.
- ARIA 1.2 combobox: the input owns a listbox (the suggestion line) through `aria-controls` and `aria-activedescendant`. ↓/↑ move the active suggestion, which takes the surface ground with ink text, never teal. Enter adds the active suggestion, or the typed text when none is active. Enter on an empty input saves the item, as the other fields do. A comma adds the typed text. Backspace on an empty input removes the last chip and announces it. Paste "git, ssh" adds two chips.
- Esc keeps its current job: it closes the composer and keeps the draft. The suggestions are not a popup, so there is nothing for Esc to dismiss first.
- Lowercasing and trimming happen when a tag is added, never while typing, so IME composition is never broken. Enter during composition never commits.
- The form still submits tags as one comma-joined value, so drafts, undo and the server's parsing stay as they are.
- Touch: the × buttons and suggestions grow to 44px hit areas, and chips wrap inside the box.

**Rail**
- "+ New tag" is a teal underlined quiet button under the tag rows, the same control as "+ New collection". It opens a rail-row-sized name field: Enter makes the tag, Esc or clicking away from an empty field puts the button back.
- A name you already have makes nothing new: the field closes, and a polite status says "You already have “git”." A new tag is announced as "Made tag “recipes”."; focus returns to "+ New tag". Making a tag does not turn its filter on.

**Result line (tag filter on)**
- "3 matches tagged git · Clear", then the quiet buttons "Rename tag" and "Delete tag" (Delete turns wine on hover). The buttons sit outside the line's live region. In the 22rem Places index they wrap onto a second line.
- Rename: the line becomes a field prefilled with the name, plus "Rename" and "Cancel". Enter saves, Esc cancels. If the lowercased name matches another of your tags, a muted note under the field reads "Merges into “javascript”, already on 12 of your items.", and the button reads "Merge". After the rename, the filter follows the new name.
- Delete: the line becomes "Delete “git”? It comes off 4 of your items; the items stay." with a wine "Delete" and a quiet "Cancel", like Delete collection. The confirm text describes its Delete button through `aria-describedby`. After the delete, the tag filter clears, a polite status says "Deleted tag “git”.", and focus goes to search.

## 7. Constraints

- WCAG 2.2 AA: a visible focus indicator on chips' ×, suggestions and every new button; state never carried by color alone.
- No new motion. There is nothing to animate, so reduced motion is satisfied.
- Thai: chips and suggestions holding Thai take `lang="th"` and 1.75 leading.
- Reuse `fieldFocus`, `focusRing`, `touch`, the quiet-button and new-collection idioms, and the field error pattern. No new tokens.
- Open decisions left to the builder: none. Server behavior (the tags table, transactions, migration) is fixed by ADR 0004.
