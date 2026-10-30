#!/bin/sh
set -e

# See docs/adr/0001: a public compose.yml can't hold a working secret, so each
# instance makes its own on first boot and keeps it in a volume.
if [ -z "$BETTER_AUTH_SECRET" ]; then
  secret_file=/data/auth-secret
  if [ ! -s "$secret_file" ]; then
    (umask 077 && head -c 32 /dev/urandom | base64 > "$secret_file")
  fi
  BETTER_AUTH_SECRET="$(cat "$secret_file")"
  export BETTER_AUTH_SECRET
fi

node bootstrap.mjs
exec node server.js
