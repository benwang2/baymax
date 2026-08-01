# syntax=docker/dockerfile:1

# ---------- Build stage: install deps + bundle the app ----------
# Official Bun image, based on Debian
FROM oven/bun:1-debian AS build
WORKDIR /app

# Install dependencies first for better layer caching (package.json + lockfile)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the source and produce the production bundle
COPY . .
RUN bun run build

# ---------- Runtime stage: minimal Debian + Bun + bundled output ----------
FROM debian:bookworm-slim AS runtime

# Copy the Bun binary from the build stage (skips the install script at runtime)
COPY --from=build /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

# Only the bundle is required at runtime (deps are bundled by `bun run build`)
COPY --from=build /app/dist ./dist

# package.json is needed so `bun run start` can resolve the "start" script
COPY --from=build /app/package.json ./package.json

# Default config with placeholders. Mount your real config.yaml over this path:
#   docker run -v $(pwd)/config.yaml:/app/config.yaml ...
COPY config.example.yaml ./config.yaml

ENV NODE_ENV=production

# Runs the "start" script from package.json: bun ./dist/index.js
CMD ["bun", "run", "start"]
