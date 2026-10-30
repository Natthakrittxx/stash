Status: ready-for-agent

# Open source stash and package it for self-hosting with Docker

## Problem Statement

Stash is a public repository that nobody may legally use, because it has no license. Even with a license, running it is hard. There is no image or compose file. An instance can't boot without a Google Cloud project. Configuration depends on `.env` files. Migrations rely on a dev dependency.

The app also assumes every account holder is trusted. Signup is open to anyone who reaches the URL, emails are never verified, and any account can make the server fetch internal addresses. A forgotten password locks that person out for good, because there is no mailer or reset flow.

## Solution

Stash becomes MIT licensed, and anyone can become an operator by downloading one `compose.yml` and running `docker compose up`. All settings live inline in that file, and no `.env` exists anywhere in the project (see ADR-0001). The instance generates its own auth secret, applies its own migrations, and prints a setup code to its logs.

Whoever redeems the setup code becomes the Owner. The Owner issues single-use invite codes from a page in the app, and nobody can create an account without one. Google login is optional. The operator can reset a forgotten password with a command. The server refuses to fetch private addresses. An operator may point the instance at their own PostgreSQL database.

## User Stories

### Becoming an operator

1. As an operator, I want to start an instance by running `docker compose up` on one downloaded file, so that I don't need to clone the repo or install a toolchain.
2. As an operator, I want every setting to be inline in `compose.yml`, so that I only have one file to read and edit.
3. As an operator, I want no `.env` file to create, so that there is no hidden second place configuration can live.
4. As an operator, I want the auth secret generated for me on first boot, so that I can't accidentally reuse a public default or leak my secret by sharing `compose.yml`.
5. As an operator, I want the auth secret to survive restarts and upgrades, so that people stay logged in.
6. As an operator, I want Postgres included by default, so that I need nothing else to get started.
7. As an operator, I want the bundled Postgres to publish no port, so that its fixed inline password is reachable only inside the compose network.
8. As an operator, I want to boot with only email and password login, so that I don't need a Google Cloud project.
9. As an operator, I want to enable Google login by setting two values, so that it stays opt-in.
10. As an operator, I want setting only one Google value to fail at boot with a clear message, so that a half-finished setup can't surprise my users later.
11. As an operator, I want to set the public address of my instance in `compose.yml`, so that login callbacks work behind my proxy.
12. As an operator, I want an image for both amd64 and arm64, so that I can run stash on a VPS, a Raspberry Pi or Apple Silicon.
13. As an operator, I want `latest` to move only on version tags, so that a commit landing on `main` can't change my instance.
14. As an operator, I want to be able to pin a version tag, so that I decide when to upgrade.
15. As an operator, I want a README that takes me from nothing to a working instance, so that I don't have to read the code.
16. As an operator, I want the README to show a short Caddy example and say that anything public needs HTTPS, so that I don't expose logins over plain HTTP.
17. As an operator, I want the README to disclose that map views reach `tiles.openfreemap.org`, so that I can tell my circle what leaves the instance.
18. As an operator, I want the README to explain backup with `pg_dump`, so that I can protect my data before an upgrade.

### Own database

19. As an operator, I want to use my own PostgreSQL by changing `DATABASE_URL` and deleting the `db` service and its `depends_on`, so that I can reuse a managed database.
20. As an operator, I want a comment in `compose.yml` that gives those exact steps, so that I don't have to search for them.
21. As an operator, I want the requirements stated plainly (PostgreSQL 13+, a dedicated database), so that I don't try MySQL or share a database with another app.
22. As an operator on a managed host, I want `sslmode` in the URL and pooled connections to work, so that hosts like Neon are usable.
23. As an operator pointing at a database with conflicting tables, I want the boot to stop with an error, so that the other data is not changed.

### Upgrades and migrations

24. As an operator, I want pending migrations applied on container start, so that upgrading only means pulling a new image.
25. As an operator, I want a failed migration to stop the boot, so that the app never runs against the wrong schema.
26. As an operator of an existing instance, I want my earliest account to become the Owner on upgrade, so that invites work without manual steps.
27. As an operator of an existing instance, I want no setup code created when accounts already exist, so that nobody can claim Owner on an instance already in use.

### Setup code and the Owner

28. As an operator, I want a setup code printed in `docker compose logs app` on a fresh instance, so that a stranger can't claim my instance before I do.
29. As an operator, I want the same setup code printed on each boot until it's redeemed, so that rotated logs don't lock me out.
30. As an operator, I want redeeming the setup code to make that account the Owner, so that the app needs no separate admin setup.
31. As a visitor to a fresh instance without the setup code, I want to be refused, so that signup is closed from the very first request.
32. As an Owner, I want exactly one Owner to exist on an instance, so that control is never ambiguous.

### Invite codes

33. As an Owner, I want a page in the app listing unused invite codes, so that I can see what is outstanding.
34. As an Owner, I want to create a single-use invite code, so that I can admit one person.
35. As an Owner, I want to copy an unused code from the list, so that I can send it after I've left the page.
36. As an Owner, I want to revoke an unused code, so that a code sent to the wrong place stops working.
37. As an Owner, I want codes to last until redeemed or revoked, so that a friend who signs up late isn't blocked.
38. As an account holder who isn't the Owner, I want the invites page to not exist for me, so that the interface only shows what I can use.
39. As a non-Owner, I want invite actions refused on the server, so that hiding the page isn't the only protection.
40. As an invited person, I want to enter my code on the signup page, so that I can create my account.
41. As an invited person, I want a clear message when my code is wrong or already used, so that I know to ask for another.
42. As an invited person, I want a signup that fails for an unrelated reason, such as an existing email, to leave my code unused, so that a typo doesn't waste it.
43. As an Owner, I want a code to admit only one account even if two people submit it at once, so that single-use really holds.

### Google login

44. As an invited person, I want the code to apply when I choose Continue with Google, so that I can use whichever login I prefer.
45. As a visitor with a Google account and no valid code, I want to be refused in the product's voice, so that Google can't bypass invites.
46. As an existing account holder, I want Google login to work with no code, so that invites only affect new accounts.
47. As a visitor to an instance without Google configured, I want no Google button, so that I don't see an option that can't work.

### Password recovery

48. As an operator, I want a command that resets a password for a given email, so that a person in my circle isn't locked out.
49. As an operator, I want that command to generate and print the new password, so that I don't have to invent one or leave it in shell history.
50. As an account holder, I want my existing sessions ended when my password is reset, so that someone using an old session is removed.
51. As an operator, I want a clear error for an unknown email, so that I know the reset didn't happen.
52. As an account holder who only ever used Google, I want the reset to give me a password login, so that I can get back in when Google isn't available.

### Link fetching

53. As an operator, I want the server to refuse private, loopback and link-local addresses, so that an account holder can't probe my network or the compose network.
54. As an operator, I want a redirect to a private address refused at each hop, so that a public URL can't bounce the server inward.
55. As an operator, I want a hostname that resolves to a private address refused, so that names like `db` or an internal DNS entry are covered.
56. As an account holder, I want a link to a private address to still save, with no preview, so that I can keep links to my own services.
57. As an account holder, I want a place link that redirects to a private address to save with no resolved place, so that place resolution follows the same rule.

### Contributors and maintainers

58. As a contributor, I want to run the project with a small dev compose file for Postgres plus `bun dev`, so that I never create a `.env`.
59. As a contributor, I want the `db:*` scripts to work without `--env-file`, so that they match that setup.
60. As a contributor, I want production to refuse the localhost database default, so that a misconfigured instance fails instead of quietly looking elsewhere.
61. As a contributor, I want CI on every PR to run the checks, unit tests and the running-instance test, so that I know my change works.
62. As a contributor, I want the README to say contributions are best effort, so that I know what to expect.
63. As a maintainer, I want to release by pushing a version tag, so that publishing is one action.
64. As a person reading the repo, I want an MIT `LICENSE`, so that I know I may use it.
65. As a maintainer, I want the README to replace the T3 boilerplate, so that the project describes itself.

## Implementation Decisions

### Configuration

- All operator settings are environment values written inline in the shipped `compose.yml`. The project has no `.env` files: `.env.example` is removed and `--env-file` is dropped from the `db:*` scripts.
- The environment schema gains a localhost `DATABASE_URL` default outside production only. In production, a missing `DATABASE_URL` fails at startup.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` become optional, with a both-or-neither rule enforced at startup.
- A small dev compose file publishes Postgres on `127.0.0.1` only. It's separate from the shipped `compose.yml`, which publishes no database port.

### Image and boot

- The Next.js build uses standalone output, and the image runs as a non-root user. It's built with env validation skipped, because nothing instance-specific is baked in. There are no `NEXT_PUBLIC_` values, so one image serves any origin.
- Each container start runs a single bootstrap, in this order: ensure the auth secret, apply migrations, ensure the setup code, start the server. Any failure stops the boot.
- The auth secret is generated once and stored in a volume, with permissions readable only by the app user. A `BETTER_AUTH_SECRET` passed in the environment takes precedence.
- Migrations use `drizzle-orm`'s runtime migrator, which is already a production dependency. `drizzle-kit` stays dev-only.
- Bootstrap and the reset command are bundled at image build, because standalone output won't include them. They can't import modules guarded by `server-only`, so they open their own database connection.
- `compose.yml` runs `db` with a healthcheck, and the app waits for it to be healthy. Both restart unless stopped. Data and the secret are in named volumes.

### Schema

- New `invite_code` table holding unused codes only: the code, whether it's the setup code, and created-at. Redeeming or revoking deletes the row, so no redeemed-at or redeeming account is recorded.
- Codes are random with at least 128 bits of entropy, stored in plaintext. They must be shown again in the Owner's list and reprinted at boot. Anyone with database access already controls the instance.
- The account table gains an Owner marker, with a partial unique index so at most one Owner can exist.
- The migration backfills the earliest-created account as Owner when accounts already exist.

### Admission

- One `better-auth` database hook on account creation is the only admission check, so password and Google signup share it.
- The hook atomically redeems a code by deleting its row. If the delete removes no row, creation is refused.
- `better-auth` checks for an existing email before calling the hook, so an email conflict doesn't consume a code. The running-instance test must prove this.
- Redeeming the setup code sets the Owner marker on the new account.
- Both password and Google signup carry the code in one short-lived, SameSite=Lax cookie scoped to the auth endpoints, set by the signup form, so there is a single path and the running-instance test covers most of the Google path. It isn't httpOnly: the person just typed the code into that page, and it's dead once redeemed.
- A refused Google signup returns to the auth page and shows an explanation in the product's voice, using the existing error-mapping approach in the auth form.
- The Google button appears only when Google is configured. The server page passes this to the form.

### Invites page

- A new authenticated route lists unused codes, with create, copy and revoke. It follows `DESIGN.md`.
- The route returns not-found for anyone but the Owner, and a link appears in the stash header only for the Owner.
- Every invite server action verifies the Owner on the server, following the existing session-check pattern in stash actions.

### Password reset command

- Run as `docker compose exec app node reset-password.mjs someone@example.com`.
- It generates a password, stores it with `better-auth`'s own hashing, creates the credential record if the account only has Google, deletes that account's sessions, and prints the password once.
- An unknown email exits non-zero with a clear message.

### Safe fetching

- A new safe-fetch module replaces direct `fetch` in both the preview fetcher and the place resolver. Their current redirect-following is replaced.
- It resolves the hostname and rejects the request if any resulting address is not public, then follows redirects manually with a hop limit, checking each hop.
- Refused ranges include IPv4 `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`; IPv6 `::1`, `fc00::/7`, `fe80::/10`; and IPv4-mapped forms of those.
- A refusal is not an error to the caller. Previews and places already collapse failures to empty values, so the item still saves.
- There is no override setting.
- Known limit: DNS rebinding between the check and the connection can still get through. This must be recorded with a `shortcut:` comment.
- The existing comments in the preview fetcher and auth config that describe the old trusted-circle threat model are updated to match.

### Publishing

- One CI workflow runs on PRs and `main`: checks, `bun test`, and the running-instance test.
- A release workflow on version tags builds `ghcr.io/natthakrittxx/stash` for amd64 and arm64, and pushes the version tag and `latest`.

### Repository

- Add MIT `LICENSE` with `Copyright (c) 2026 Natthakrit Benjapatanamongkol and Nonpawit Ekburanawat`.
- Replace the T3 boilerplate `README.md`, covering: quick start, configuration, own database requirements, HTTPS, backups and upgrades, OpenFreeMap disclosure, password reset, and best-effort contributions.
- Add a `test` script to `package.json`.
- `.impeccable/` stays tracked.

## Testing Decisions

A good test exercises behaviour that an operator, visitor or account holder can observe, and doesn't depend on internals such as table layout or hook wiring.

**Seam A: a running instance.** A test starts the real image with `docker compose up`, reads logs, runs the commands an operator would run, and drives the app over HTTP. It covers:

- Boot on an empty database, including migrations and a generated secret.
- Secret persistence across a restart: a session remains valid.
- Setup code printed, reprinted on restart while unredeemed, and absent once accounts exist.
- Signup refused with no code, a wrong code, a used code and a revoked code.
- Setup code redemption creating the Owner, and only the Owner reaching invite functions.
- A single-use code admitting one account under concurrent submission.
- An email-conflict signup leaving the code unused.
- The reset command: old password refused, printed password accepted, old sessions ended, unknown email non-zero.
- Boot with no Google settings, no Google button, and failure with only one Google value set.
- Upgrade backfill: starting from a database with accounts at the previous schema makes the earliest one Owner and creates no setup code.

**Seam B: safe fetch.** Plain `bun:test` units with no database. Prior art is `src/server/og.test.ts` and `src/server/url.test.ts`. They cover each refused range, IPv4-mapped IPv6, a hostname resolving to a private address, redirect hops into private space, the hop limit, and public addresses passing.

Google's real redirect can't be automated. The hook is shared with password signup and so is covered by seam A. The cookie round trip is a manual pre-release check.

## Out of Scope

- A mailer, email verification and self-service password reset.
- Member removal, Owner transfer and any other roles.
- Invite links, expiring codes and any way to invite other than the Owner's page.
- A hosted public instance, multi-tenant hardening and abuse handling.
- Bundled HTTPS proxy and bundled map tiles, or a configurable tile URL.
- Databases other than PostgreSQL.
- Docker-based app development: the dev compose file runs only Postgres.
- `CONTRIBUTING`, code of conduct and issue templates.
- Rewriting git history.

## Further Notes

These need a human and block the first public release. They aren't agent work:

- **License agreement:** done. Both Natthakrit and Nonpawit agreed to MIT (2026-10-30).
- **Secret scan:** done. `gitleaks` v8.30.1 found nothing in full history or the working files (2026-10-30). Re-run it just before the first release if more commits land.
- **Maintainers' own instance:** check whether its database was built with `db:push`. If so, it needs a one-time migration baseline before moving to the image. `src/server/db/index.ts` mentions Neon, so if the instance is on Neon it can stay there using the own-database path, with no dump and restore.
- **Image visibility:** after the first release, confirm the GHCR package allows anonymous pulls.
- **Manual Google check:** on a real instance, try a new Google account with a valid code, with no code, and an existing Google account with no code.

Terms follow `CONTEXT.md`. The configuration decision is recorded in `docs/adr/0001-compose-is-the-only-config-surface.md`.

## Comments

Built in one run on `feat/open-source-docker`, skipping tickets. The dev database moved to port `55432` with its own compose project name, because the original port 5432 let `bun run bootstrap` migrate another Postgres already on that port. The image's compile stage runs on the builder's architecture, because emulated builds failed on `next/font`'s Google Fonts fetch; `sharp` is removed from the image and the unused optimizer turned off. Known limit, tested: faking `x-forwarded-for` bypasses the sign-in rate limit on direct connections to port 3000, but not through Caddy. The README tells operators not to leave that port open.
