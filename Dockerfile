# syntax=docker/dockerfile:1

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATA_DIR=/data \
    MIGRATIONS_DIR=/app/drizzle \
    PORT=3000 \
    # Only listen on localhost: the app must be reached through `tailscale serve` (or an SSO proxy),
    # because it trusts the identity headers those add.
    HOSTNAME=127.0.0.1

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
# Native SQLite driver with its prebuilt binaries (loaded dynamically, so copy the whole package).
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
