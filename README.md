# Produto Vivo

Plataforma social-comercial white label. **Jesus Alfabeto Saudável** é o projeto nº 1 e a
primeira vitrine da tecnologia.

Cliente: Rossandro Caxito · Contratado via Workana · Fase 1 em desenvolvimento.

---

## Documentação

| Documento | O que é |
|---|---|
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Decisões técnicas, modelo de dados, fluxo de propagação |
| [docs/contexto/04-escopo-acordado.md](docs/contexto/04-escopo-acordado.md) | **Fonte da verdade do escopo.** O que entra na Fase 1 e o que é Fase 2 |
| [docs/contexto/01-requisitos-originais.md](docs/contexto/01-requisitos-originais.md) | Publicação original do projeto |
| [docs/contexto/02-proposta-aceita.md](docs/contexto/02-proposta-aceita.md) | Proposta aceita e compromissos assumidos |
| [docs/contexto/03-historico-conversa.md](docs/contexto/03-historico-conversa.md) | Histórico completo da negociação |
| [docs/contexto/05-cliente.md](docs/contexto/05-cliente.md) | Perfil do cliente e implicação regulatória (GDPR) |

## Estrutura

```
apps/web/       Next.js — PWA público + painel admin      (a construir)
apps/api/       NestJS — API, futura API white label       (a construir)
packages/db/    Prisma: schema, migrations, seed           ✔ pronto
packages/shared/ Tipos e contratos compartilhados          (a construir)
```

## Como rodar

```bash
cp .env.example .env
npm install
docker compose up -d          # Postgres 16 na porta 5433
npm run db:migrate            # aplica as migrations
npm run db:seed               # projeto 1: 26 letras + QR + Dia Zero
```

Verificar que a camada de coleta responde às perguntas do cliente:

```bash
npx tsx packages/db/prisma/verificar-propagacao.ts
```

O script monta o cenário `Instagram → Ana → Bruno → Carla → Diego, Elza, Fábio`, grava os
eventos e responde por consulta real: funil por campanha, cruzamento TikTok × WhatsApp ×
compra, faturamento gerado por cadeia, árvore de propagação e qualidade da aquisição por
plataforma. Cria dados isolados e limpa tudo ao final.

## As duas regras que sustentam o resto

**1. Nada conhece o conceito de "letra".** Uma letra é um `Content` de um `Project`. Se um
identificador, tabela ou módulo menciona letra, alfabeto ou 26, está no lugar errado —
exceto no seed e na apresentação específica do projeto.

**2. `events` é a fonte da verdade e é append-only.** Isso não é convenção: triggers no
banco bloqueiam `UPDATE` e `DELETE`. A exclusão só acontece pela política de retenção
LGPD/GDPR, com flag explícita de sessão:

```sql
BEGIN;
SET LOCAL pv.allow_event_purge = 'on';
DELETE FROM events WHERE ...;
COMMIT;
```

`DailyMetric` e `ContentStats` são derivados e sempre recalculáveis a partir dos eventos.
O contrário nunca.

## Estado atual

**Pronto e verificado**
- Modelo de dados completo — 21 tabelas, migrations aplicadas
- Eventos, atribuição em três camadas e cadeia de propagação
- Guarda append-only nos eventos, testada nos quatro caminhos
- Geração de link curto + QR por conteúdo
- Marco Dia Zero registrado (Instagram 200 · TikTok 40 · YouTube 0 · PV 0)
- Campos de compra reservados para a Fase 2, sem gerar evento na Fase 1
- Metadados de conteúdo para a IA futura cruzar desempenho × características

**Próximo**
- `apps/api` — NestJS: ingestão de eventos, auth, conteúdo, social
- `apps/web` — Next.js PWA: 26 páginas, perfil, painel admin
- Dashboard com as métricas essenciais da Fase 1

## Pendências com o cliente

1. Mockups (anunciados, ainda não enviados)
2. Conteúdo das 26 letras: músicas, áudios, letras, textos, imagens
3. Arte e textos da página institucional PV + número de WhatsApp
4. Plataforma de checkout externo escolhida (pode vir depois)
