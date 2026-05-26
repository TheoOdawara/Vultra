# =============================================================================
# VULTRA — api-core Dockerfile
# Runtime: Bun 1.x (native TypeScript — no compile step required)
# =============================================================================

FROM oven/bun:1 AS base
WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────────────

FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Production image ──────────────────────────────────────────────────────────

FROM base AS release
WORKDIR /app

# curl is needed for HEALTHCHECK; Bun base image is Debian-based
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1001 appgroup \
    && useradd -u 1001 -g appgroup -s /bin/sh -m appuser

COPY --from=install --chown=1001:1001 /app/node_modules node_modules
COPY --chown=1001:1001 src/ src/
COPY --chown=1001:1001 package.json tsconfig.json drizzle.config.ts ./

USER appuser

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/v1/health/ai-service || exit 1

CMD ["bun", "run", "src/main.ts"]
