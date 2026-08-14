# API — build em múltiplos estágios para a imagem final não carregar
# toolchain de compilação nem dependências de desenvolvimento.

# ── Estágio 1: dependências ────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Só os manifests primeiro: enquanto eles não mudam, o Docker reaproveita a
# camada de instalação e o build fica em segundos em vez de minutos.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/

# argon2 é módulo nativo e precisa de toolchain para compilar no Alpine.
RUN apk add --no-cache python3 make g++ \
 && npm ci --workspace @pv/api --workspace @pv/db --include-workspace-root

# ── Estágio 2: build ───────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json package-lock.json ./
COPY packages/db packages/db
COPY apps/api apps/api

# O client do Prisma é gerado a partir do schema; sem isso o build não compila.
RUN npx prisma generate --schema packages/db/prisma/schema.prisma \
 && cd apps/api && npx nest build

# ── Estágio 3: runtime ─────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Não roda como root: se a aplicação for comprometida, o atacante não herda
# o container inteiro.
RUN addgroup -S pv && adduser -S pv -G pv

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/package.json ./package.json

# O entrypoint aplica as migrations antes de subir. Sem ele, um servidor novo
# sobe a API contra um banco sem tabela nenhuma.
COPY apps/api/docker-entrypoint.sh /usr/local/bin/entrada.sh
RUN chmod +x /usr/local/bin/entrada.sh

# Pasta de mídia. Precisa ser volume no compose — sem isso, recriar o
# container apaga todas as músicas e áudios enviados pelo cliente.
RUN mkdir -p /app/uploads && chown -R pv:pv /app/uploads

USER pv
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3333/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrada.sh"]
CMD ["node", "apps/api/dist/main.js"]
