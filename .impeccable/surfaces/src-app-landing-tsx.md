---
version: 2
slug: "src-app-landing-tsx"
primary_target: "src/app/landing.tsx"
related_targets: ["src/app/stash/stash.tsx", "src/app/auth-form.tsx"]
---

# Landing (/)

Scope: public landing for logged-out visitors. Mode: Persuade.
Audience: people the maintainer invited; they arrive knowing nothing about how Stash works.
Job: understand what Stash saves (tools = links, formulas = commands) and that re-finding is one search; then sign up or log in.
Proof: a working demo search over synthetic saved items, labeled as a sample.
Constraints: no sharing claims (feature does not exist); no public/social claims beyond "private"; WCAG 2.2 AA; reduced-motion alternative.

## Direction contract

THESIS: the landing is the app's own world (Card Catalog), not a separate marketing skin. The demo renders the app's real list idiom (tool rows, terminal formula cards, filtered search) so the visitor sees exactly what they get. Replaces the v1 cracktro direction at the user's request ("make it match the page ui").

OWN-WORLD: global @theme tokens, light/dark with the shared ThemeToggle; Source Serif for content and headlines, IBM Plex Sans (IBM Plex Sans Thai behind it) for machinery, Geist Mono for commands; enamel teal accent on the primary action and the headline's full stop only.

STORY: serif headline "Save it now. Find it later." -> Start a stash -> demo auto-types "images" and the list narrows -> two kinds, one search -> yours only -> Start a stash.
