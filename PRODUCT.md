# Product

## Register

product

## Platform

web

## Users

The maintainer and a small circle of trusted people — not strangers, not an org. Everyone here already knows what a stash is for; nobody arrives needing to be sold on it.

They reach for stash mid-stream: reading something, finding a link, wanting it gone from their attention but not lost. Capture happens in seconds, usually as an interruption to something else. Retrieval happens later, deliberately, when they're looking for a thing they know they saved.

The job: get something out of my head and into a place I trust, then find it again when I need it.

## Product Purpose

Stash saves things for later and makes them findable again. Auth exists so a stash follows you across devices and can be shared with a few people, not so it can be published.

Success is measured by re-visits, not saves. Anyone can build a place where things go in; the product is whether they come back out. A stash that only accumulates has failed, no matter how pleasant the saving felt.

## Brand Personality

_(Inferred from the Are.na reference and the anti-references — overwrite freely.)_

**Quiet, archival, typographic.**

The interface recedes; the saved thing is what you look at. Voice is plain and unhurried, closer to a library card than a product notification. No cheerleading, no streaks, no "you're on a roll!". Sharing is a quiet act between people who know each other — never a feed, never an audience, no likes or follower counts.

Emotional goal: trust. The user should feel that anything put here will still be here, and still be findable, in three years.

## Anti-references

- **The uniform card grid.** Pocket, Pinterest, every read-it-later app: a wall of identical thumbnail cards with a title and a favicon. It flattens a poem and a tax form into the same rectangle. Also on impeccable's absolute ban list.
- **The generic SaaS dashboard.** Sidebar, stat tiles, hero metric, charts nobody reads, gradient accent. Stash has nothing to report; it has things to show.
- Nested cards, decorative glassmorphism, gradient text, per-section eyebrows.

## Design Principles

1. **Capture costs nothing.** Saving is a reflex, not a task. Any friction at the moment of capture — a modal, a required field, a category picker — kills the habit the product depends on.
2. **The content is the interface.** Chrome earns its pixels or disappears. What was saved should be legible before anything the app wrapped around it.
3. **Re-finding is the product.** Search, filtering, and browsing get the design effort that a lesser tool spends on the save button. A stash you can't search is a landfill.
4. **Shared, not social.** Sharing serves a handful of people who already trust each other. No feeds, no engagement mechanics, no audience.
5. **Density is earned.** Dense when it genuinely informs — a long list you're scanning. Never dense to look serious.

## Accessibility & Inclusion

WCAG 2.2 AA.

- Body text ≥4.5:1 contrast; large text (≥18px, or bold ≥14px) ≥3:1. Placeholder text is held to the body-text bar, not the muted-gray default.
- Full keyboard navigation with a visible focus indicator on every interactive element.
- Every animation ships a `prefers-reduced-motion: reduce` alternative — a crossfade or an instant transition.
- Never encode meaning in color alone; state carries an icon, a label, or a shape as well.
