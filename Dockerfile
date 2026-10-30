# Compiles on the builder's own architecture. Under emulation the compile is slow
# enough that next/font's short timeout on fetching Google Fonts fails the build.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
RUN npm install --global bun@1.3.14
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Nothing instance-specific is baked in: settings arrive when the container runs.
# better-auth logs a "default secret" error during this step because of that. It's harmless.
RUN SKIP_ENV_VALIDATION=1 bun run build
# Traced by next but unused (images are unoptimized), and built for the wrong
# architecture when cross-building. The instance test keeps native modules out.
RUN rm -rf .next/standalone/node_modules/sharp .next/standalone/node_modules/@img
# Standalone output only traces what the server imports, so these are bundled.
# Without the define, bun inlines NODE_ENV as "development" and env.js would allow
# its localhost database default in production.
RUN bun build scripts/bootstrap.ts scripts/reset-password.ts --target=node --outdir=bundled --entry-naming='[name].mjs' --define 'process.env.NODE_ENV="production"'

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN mkdir /data && chown node:node /data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/bundled ./
COPY --chmod=755 docker-entrypoint.sh ./
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
