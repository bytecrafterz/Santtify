# PWA — build em múltiplos estágios usando a saída standalone do Next.

# ── Estágio 1: dependências ────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @pv/web --include-workspace-root

# ── Estágio 2: build ───────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json package-lock.json ./
COPY apps/web apps/web

# ATENÇÃO: variáveis NEXT_PUBLIC_* são gravadas DENTRO do JavaScript no
# momento do build, não lidas em tempo de execução. Passar isso só no
# docker-compose não funciona — o navegador receberia o valor de
# desenvolvimento. Por isso entra como argumento de build.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PROJETO_PADRAO=jesus-alfabeto-saudavel
ARG NEXT_PUBLIC_WHATSAPP_PV=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_PROJETO_PADRAO=$NEXT_PUBLIC_PROJETO_PADRAO \
    NEXT_PUBLIC_WHATSAPP_PV=$NEXT_PUBLIC_WHATSAPP_PV \
    NEXT_TELEMETRY_DISABLED=1

RUN cd apps/web && npx next build

# ── Estágio 3: runtime ─────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S pv && adduser -S pv -G pv

# A saída standalone traz o servidor e só as dependências realmente usadas.
COPY --from=build --chown=pv:pv /app/apps/web/.next/standalone ./
COPY --from=build --chown=pv:pv /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=pv:pv /app/apps/web/public ./apps/web/public

USER pv
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
