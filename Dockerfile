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
# Collect full dependency notices before Next standalone tracing omits package metadata.
RUN bun scripts/collect-image-licenses.mjs --root /app/node_modules --out /app/app-licenses \
    && bun -e 'const inv=await Bun.file("/app/app-licenses/inventory.json").json(); const names=new Set(inv.packages.map(p=>p.name)); for (const id of ["next","react","react-dom"]) if (!names.has(id)) { console.error("missing "+id); process.exit(1) }'
RUN bun run build

# Official account-login CLIs keep their own authentication flows. The app still
# runs under Bun; Node is present only for the upstream CLI executables.
FROM node:22-bookworm-slim AS ai-tools
COPY --from=deps /usr/local/bin/bun /usr/local/bin/bun
COPY scripts/collect-image-licenses.mjs /tmp/collect-image-licenses.mjs
ENV BUN_INSTALL=/usr/local
RUN bun add --global @openai/codex@0.158.0 @google/gemini-cli@0.61.0 \
    && codex --version && gemini --version \
    && bun /tmp/collect-image-licenses.mjs --root /usr/local --out /tmp/cli-licenses \
    && bun -e 'const inv=await Bun.file("/tmp/cli-licenses/inventory.json").json(); const names=new Set(inv.packages.map(p=>`${p.name}@${p.version}`)); for (const id of ["@openai/codex@0.158.0","@google/gemini-cli@0.61.0"]) if (!names.has(id)) { console.error("missing "+id); process.exit(1) }'

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
COPY --from=builder --chown=nextjs:nodejs \
    /app/scripts/hash-password.mjs \
    /app/scripts/setup-env.mjs \
    /app/scripts/setup-token.mjs \
    /app/scripts/build-database-url.mjs \
    ./scripts/
# Notices contract uses /app/licenses. The same bytes are also published under
# /usr/share/irang/licenses, with the root LICENSE and third-party notices.
COPY --from=builder /app/app-licenses /app/licenses/app
COPY --from=builder /app/app-licenses /usr/share/irang/licenses/app
COPY --from=ai-tools /tmp/cli-licenses /app/licenses/cli
COPY --from=ai-tools /tmp/cli-licenses /usr/share/irang/licenses/cli
COPY LICENSE THIRD_PARTY_NOTICES.md /app/licenses/
COPY LICENSE THIRD_PARTY_NOTICES.md /usr/share/irang/licenses/
COPY public/fonts/LICENSE-Pretendard.txt /app/licenses/LICENSE-Pretendard.txt
COPY public/fonts/LICENSE-Pretendard.txt /usr/share/irang/licenses/LICENSE-Pretendard.txt
COPY LICENSE /LICENSE
COPY THIRD_PARTY_NOTICES.md /THIRD_PARTY_NOTICES.md
RUN chmod -R a+rX /app/licenses /usr/share/irang /LICENSE /THIRD_PARTY_NOTICES.md \
    && rm -rf /tmp/cli-licenses /tmp/collect-image-licenses.mjs
RUN mkdir -p /app/.data/attachments /app/.data/auth/codex /app/.data/auth/google \
    && chown -R nextjs:nodejs /app/.data && chmod 700 /app/.data/auth
USER nextjs
ARG VERSION=2.2.0
ARG REVISION=local
LABEL org.opencontainers.image.title="Irang" \
      org.opencontainers.image.description="Irang application image. Third-party notices are in /app/licenses and /usr/share/irang/licenses." \
      org.opencontainers.image.source="https://github.com/madrobotnet/irang" \
      org.opencontainers.image.url="https://github.com/madrobotnet/irang" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.licenses="NOASSERTION"
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD bun -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "server.js"]
