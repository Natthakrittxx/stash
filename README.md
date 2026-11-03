# Stash

A quiet place to save things and find them again: links, commands and places on a map. Each stash is private, with no sharing and nothing published.

You run your own instance for yourself and a small circle of people you invite.

## Quick start

You need Docker with Compose.

```sh
curl -O https://raw.githubusercontent.com/Natthakrittxx/stash/main/compose.yml
docker compose up -d
```

Open <http://localhost:3000/signup> and sign up. The first person to do so becomes the **Owner** of this instance, with no code needed, so do it before anyone else can reach the address. From then on, signup needs an invite code, which the Owner creates under **Invites** in the header and can share as the code or as a signup link with the code filled in.

## Configuration

Everything is set inline in `compose.yml`. There is no `.env` file.

| Setting | Meaning |
| --- | --- |
| `BETTER_AUTH_URL` | The address people use to reach this instance. Login breaks if it doesn't match. |
| `DATABASE_URL` | Your PostgreSQL address. Defaults to the bundled database. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google login. Set both, or leave both empty. The redirect URI to register with Google is `<BETTER_AUTH_URL>/api/auth/callback/google`. |

The auth secret isn't a setting. The instance generates one on first boot and keeps it in the `stash-secret` volume. Losing that volume logs everyone out, but loses no saved data.

## HTTPS

Anything reachable from the internet needs HTTPS, because logins travel over this connection. Put your own reverse proxy in front and set `BETTER_AUTH_URL` to the public `https://` address. Don't also leave port 3000 open to the internet: the sign-in rate limit reads the client address from `x-forwarded-for`, which a client can fake when it reaches the app directly. With [Caddy](https://caddyserver.com), which overwrites that header:

```
stash.example.com {
    reverse_proxy localhost:3000
}
```

## Your own database

Stash needs **PostgreSQL 13 or newer**. Any database works, including one other apps already use: stash keeps every table in its own schema, `stash`, and touches nothing outside it. Other database engines aren't supported.

Change `DATABASE_URL` in `compose.yml`, adding `?sslmode=require` if your host needs it. Then delete the `depends_on` block under `app`, the `db` service and the `stash-db` volume. Pooled connections work, including Neon's. Your copy of `compose.yml` now holds a password, so keep it private.

If PostgreSQL runs on the same machine as stash, write `host.docker.internal` where the address would say `localhost`, for example `postgresql://stash:secret@host.docker.internal:5432/stash`. A PostgreSQL in another container must publish its port on all interfaces, not only `127.0.0.1`. One installed directly on the machine must listen on Docker's network (`listen_addresses`) and allow it in `pg_hba.conf`.

The database role must be allowed to create the `stash` schema. If it isn't, the boot stops and prints the `GRANT` to run.

## Upgrades and backups

Pending migrations apply on every container start, and a failed migration stops the boot. Upgrading from a release before 0.3.0 also moves every table from `public` into the `stash` schema, once, on the first boot.

1. Back up first:
   ```sh
   docker compose exec -T db pg_dump -U stash stash > stash-backup.sql
   ```
   On your own database, add `-n stash` to back up only stash's schema.
2. Upgrade:
   ```sh
   docker compose pull && docker compose up -d
   ```

`latest` moves only when a new version is released. To choose when you upgrade, pin a version tag such as `ghcr.io/natthakrittxx/stash:v0.1.0` in `compose.yml`.

To restore into a new, empty instance, start only the database with `docker compose up -d db`, run `docker compose exec -T db psql -U stash stash < stash-backup.sql`, then run `docker compose up -d`. A backup from before 0.3.0 restores the same way, and the first boot moves it. Restoring one into an instance that has already booted stops the boot instead, so nothing is overwritten.

## Forgotten passwords

Stash doesn't send email. To reset someone's password, run:

```sh
docker compose exec app node reset-password.mjs someone@example.com
```

It prints a new password to pass on, and ends that account's existing sessions. An open browser tab can stay signed in for up to 5 more minutes. This also gives an account that only used Google a password login.

## Lost authenticators

People can turn on an authenticator app and passkeys under **Settings**. If someone loses both their authenticator and their backup codes, clear their second factor:

```sh
docker compose exec app node reset-second-factor.mjs someone@example.com
```

It ends that account's existing sessions, and they can sign in without a code until they set it up again. An open browser tab can stay signed in for up to 5 more minutes. It doesn't change their password or passkeys.

Authenticator secrets are encrypted with the instance's auth secret. If you lose or replace that secret, everyone with an authenticator app turned on is locked out until you run this command for them.

Passkeys are tied to the instance's domain and only work over HTTPS or on `localhost`. If `BETTER_AUTH_URL` moves to another domain, expect people to need new passkeys. Passwords and Google login still work.

## What leaves your instance

- **Map views:** browsers fetch map tiles from [OpenFreeMap](https://openfreemap.org), which sees the area being viewed. Saved places themselves aren't sent.
- **Saved links:** your server fetches each link once for its preview, and browsers then load the preview image from that site. Links to private or internal addresses save fine but get no preview, because the server refuses to fetch them.
- **Google login:** only if you turn it on.

## Development

You need [Bun](https://bun.sh) and Docker.

```sh
bun install
docker compose -f compose.dev.yml up -d --wait
bun run bootstrap   # applies migrations
bun dev
```

- `bun run check` runs lint and typecheck.
- `bun test` runs the unit tests.
- `bun run test:instance` builds the image and tests a running instance, which takes a few minutes.

The dev database listens on port `55432`, and the project needs no `.env` file. Bun and Next.js still load a `.env.local` if you have one, and `bun run bootstrap` applies migrations to whatever database it names, so remove it to be sure you're on the dev database. The `db:*` scripts don't read it.

Issues and pull requests are welcome, on a best-effort basis: this is a small personal project with no promises about response times or the roadmap.

## License

[MIT](LICENSE). The fonts in `src/fonts` keep their own SIL Open Font License, included beside them.
