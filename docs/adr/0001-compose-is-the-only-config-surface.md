# Compose is the only config surface, and the auth secret is generated

Operators set everything inline in `compose.yml`, and the project has no `.env` files, including for local development. A working `BETTER_AUTH_SECRET` can't live in a public file because every instance would share it and anyone could forge sessions, so the container generates one on first boot and keeps it in a volume. Operators therefore never set or see that secret, and sharing their `compose.yml` can't leak it.

## Considered Options

- **Operator pastes the secret into `compose.yml`, app refuses a placeholder:** the most literal reading of "everything in compose", but it adds a setup step and an operator who commits the file publishes the secret.
- **`.env` next to `compose.yml`:** the convention, rejected because the maintainers want one file to read and edit.

## Consequences

Losing the secret volume logs everyone out but loses no saved data. The Postgres password is a fixed inline value, which is safe only because the bundled `db` service publishes no port; do not publish it without changing the password. An operator on their own database sets `DATABASE_URL` in `compose.yml` and that URL's credentials then live in that file, so that copy must stay private.
