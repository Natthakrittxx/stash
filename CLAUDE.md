## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/` in this repo. No remote, so no PR triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles use their default strings: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Design Context

Register: `product` (design serves the task). Platform: `web`. Full strategic context in `PRODUCT.md`; visual system in `DESIGN.md`.

Design principles:

1. **Capture costs nothing.** Saving is a reflex, not a task.
2. **The content is the interface.** Chrome earns its pixels or disappears.
3. **Re-finding is the product.** Search and browse get the design effort a lesser tool spends on the save button.
4. **Shared, not social.** No feeds, no engagement mechanics, no audience.
5. **Density is earned.** Dense only when it genuinely informs.

Anti-references: the uniform card grid (Pocket/Pinterest), the generic SaaS dashboard. Accessibility bar: WCAG 2.2 AA.
