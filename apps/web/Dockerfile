# PWA — build em múltiplos estágios usando a saída standalone do Next.

# ── Estágio 1: dependências ────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/cartoes/package.json packages/cartoes/
RUN npm ci --workspace @pv/web --workspace @pv/cartoes --include-workspace-root

# ── Estágio 2: build ───────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Sem copiar apps/web/node_modules: o npm workspaces iça as dependências para a
# raiz, e essa pasta não existe. A imagem da API copia a dela porque o argon2 é
# módulo nativo e fica no workspace; aqui não há nenhum, e a linha equivalente
# quebrava o build inteiro com "not found".
COPY package.json package-lock.json ./
# A mesma geometria que a API usa. O `transpilePackages` do next.config só a
# leva para o bundle se ela estiver aqui.
COPY packages/cartoes packages/cartoes
COPY apps/web apps/web

# ATENÇÃO: variáveis NEXT_PUBLIC_* são gravadas DENTRO do JavaScript no
# momento do build, não lidas em tempo de execução. Passar isso só no
# docker-compose não funciona — o navegador receberia o valor de
# desenvolvimento. Por isso entra como argumento de build.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PROJETO_PADRAO=jesus-alfabeto-saudavel
# O CONVITE DO GRUPO DO PRODUTO VIVO.
#
# Isto esteve com DOIS NOMES desde o dia em que foi escrito. A página lê
# NEXT_PUBLIC_PV_GRUPO_URL, o .env.production.exemplo documenta esse mesmo nome,
# e o build passava NEXT_PUBLIC_WHATSAPP_PV, que ninguém lia. Resultado: ele
# preencheu o convite correctamente e a página comercial continuou a dizer
# "Botão aguardando o link do grupo" à frente de quem lá chegasse. Nunca deu
# erro nenhum, porque uma variável que falta é uma string vazia.
ARG NEXT_PUBLIC_PV_GRUPO_URL=
# O número do suporte. Passá-lo no compose não chega: se o Dockerfile não o
# declarar aqui, o build recebe-o e ignora-o em silêncio, e o botão de suporte
# nunca aparece — foi o que aconteceu à primeira.
ARG NEXT_PUBLIC_SUPORTE_WHATSAPP=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_PROJETO_PADRAO=$NEXT_PUBLIC_PROJETO_PADRAO \
    NEXT_PUBLIC_PV_GRUPO_URL=$NEXT_PUBLIC_PV_GRUPO_URL \
    NEXT_PUBLIC_SUPORTE_WHATSAPP=$NEXT_PUBLIC_SUPORTE_WHATSAPP \
    NEXT_TELEMETRY_DISABLED=1

# O COMMIT DE ONDE ISTO SAIU, gravado dentro da imagem.
#
# Serve para a publicação poder PROVAR que o que ficou a servir veio do código
# de agora, em vez de confiar que ficou. Em 26/08 uma correcção de estilo não
# chegou ao ar e a publicação correu sem uma única queixa: a imagem foi
# construída, o contentor foi recriado, e o que estava lá dentro era do build
# anterior. Só se apanhou por eu ter ido medir o botão no navegador.
#
# Está aqui em cima do build de propósito. Como o valor muda a cada commit,
# obriga o `next build` a correr outra vez em cada publicação — as camadas do
# npm, que são as demoradas, continuam em cache.
ARG PV_COMMIT=desconhecido
RUN echo "$PV_COMMIT" > /app/COMMIT

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
COPY --from=build /app/COMMIT ./COMMIT

USER pv
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
