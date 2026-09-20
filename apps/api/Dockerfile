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
COPY packages/cartoes/package.json packages/cartoes/
COPY packages/karaoke/package.json packages/karaoke/

# argon2 é módulo nativo e precisa de toolchain para compilar no Alpine.
RUN apk add --no-cache python3 make g++ \
 && npm ci --workspace @pv/api --workspace @pv/db --workspace @pv/cartoes --workspace @pv/karaoke --include-workspace-root

# A pasta do workspace pode simplesmente não existir: o npm iça para a raiz tudo
# o que não colida, e o que fica aqui depende das versões do momento — o argon2
# esteve cá, e depois de uma actualização deixou de estar. Sem esta linha, o
# `COPY` do estágio seguinte falhava o build inteiro com "file does not exist",
# e só se descobria no servidor, a meio de uma publicação.
RUN mkdir -p apps/api/node_modules

# ── Estágio 2: build ───────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json package-lock.json ./
COPY packages/db packages/db
# A geometria dos cartões. É importada pela API e pelo site, e sem ela o
# build nem compila — foi esquecida uma vez e é o género de falha que só
# aparece na primeira publicação.
COPY packages/cartoes packages/cartoes
# As regras do Modo Karaokê, partilhadas com o site. Mesmo motivo da linha acima.
COPY packages/karaoke packages/karaoke
COPY apps/api apps/api

# O commit de onde isto saiu, para a publicação poder conferir depois que o que
# ficou a servir veio mesmo do código de agora. Ver a nota no Dockerfile do site.
ARG PV_COMMIT=desconhecido
RUN echo "$PV_COMMIT" > /app/COMMIT

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

# poppler-utils: transforma a PRIMEIRA página do PDF da arte numa imagem para o
# ecrã. As artes do designer vêm em PDF vetorial, e o PDF entra no ficheiro de
# impressão como vector — mas o editor precisa de as MOSTRAR, e um <img> não
# desenha um PDF. Esta é a única coisa no sistema que sabe rasterizar um.
RUN apk add --no-cache poppler-utils

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/packages/cartoes ./packages/cartoes
COPY --from=build /app/packages/karaoke ./packages/karaoke
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/COMMIT ./COMMIT

# O entrypoint aplica as migrations antes de subir. Sem ele, um servidor novo
# sobe a API contra um banco sem tabela nenhuma.
COPY apps/api/docker-entrypoint.sh /usr/local/bin/entrada.sh
RUN chmod +x /usr/local/bin/entrada.sh

# Pasta de mídia. Precisa ser volume no compose — sem isso, recriar o
# container apaga todas as músicas e áudios enviados pelo cliente.
RUN mkdir -p /app/uploads && chown -R pv:pv /app/uploads

# As fotos das crianças e os PDFs em trânsito. Volume à parte de /app/uploads
# de propósito: aquela é servida estaticamente e esta NUNCA pode ser.
RUN mkdir -p /app/cartoes-temporarios && chown -R pv:pv /app/cartoes-temporarios

USER pv
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3333/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrada.sh"]
CMD ["node", "apps/api/dist/main.js"]
