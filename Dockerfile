# Bun-based build and runtime for the Next.js standalone server.
FROM oven/bun:1.4.2-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.4.2-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Official account-login CLIs keep their own authentication flows. The app still
# runs under Bun; Node is present only for the upstream CLI executables.
FROM node:22-bookworm-slim AS ai-tools
COPY --from=deps /usr/local/bin/bun /usr/local/bin/bun
ENV BUN_INSTALL=/usr/local
RUN bun add --global @openai/codex@0.158.0 @google/gemini-cli@0.61.0 \
    && codex --version && gemini --version

FROM ai-tools AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    HOME=/home/nextjs \
    CODEX_HOME=/app/.data/auth/codex \
    GEMINI_CLI_HOME=/app/.data/auth/google
# Match the existing deployment's UID/GID for mounted auth and attachment files.
RUN groupadd --system --gid 1001 nodejs && useradd --system --create-home --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts/hash-password.mjs ./scripts/hash-password.mjs
RUN mkdir -p /app/.data/attachments /app/.data/auth/codex /app/.data/auth/google \
    && chown -R nextjs:nodejs /app/.data && chmod 700 /app/.data/auth
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD bun -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "server.js"]
