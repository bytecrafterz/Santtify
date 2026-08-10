# Produto Vivo

Plataforma social-comercial white label. **Jesus Alfabeto Saudável** é o projeto nº 1 e a
primeira vitrine da tecnologia.

Cliente: Rossandro Caxito · Contratado via Workana · Fase 1 em desenvolvimento.

---

## Documentação

| Documento | O que é |
|---|---|
| [docs/PROGRESSO.md](docs/PROGRESSO.md) | **Comece por aqui.** Estado técnico, relação com o cliente, bloqueios e avisos |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Decisões técnicas, modelo de dados, fluxo de propagação |
| [docs/contexto/04-escopo-acordado.md](docs/contexto/04-escopo-acordado.md) | **Fonte da verdade do escopo.** O que entra na Fase 1 e o que é Fase 2 |
| [docs/contexto/01-requisitos-originais.md](docs/contexto/01-requisitos-originais.md) | Publicação original do projeto |
| [docs/contexto/02-proposta-aceita.md](docs/contexto/02-proposta-aceita.md) | Proposta aceita e compromissos assumidos |
| [docs/contexto/03-historico-conversa.md](docs/contexto/03-historico-conversa.md) | Histórico completo: negociação **e** desenvolvimento |
| [docs/mensagens/](docs/mensagens/) | Cada mensagem enviada ao cliente, com o contexto e a intenção |
| [docs/contexto/05-cliente.md](docs/contexto/05-cliente.md) | Perfil do cliente e implicação regulatória (GDPR) |

## Estrutura

```
apps/web/       Next.js — PWA público (26 páginas, PV)     ✔ funcionando
apps/api/       NestJS — API, futura API white label       ✔ coleta + conteúdo
packages/db/    Prisma: schema, migrations, seed           ✔ pronto
```

## Como rodar

```bash
cp .env.example .env
npm install
docker compose up -d          # Postgres 16 na porta 5433
npm run db:migrate            # aplica as migrations
npm run db:seed               # projeto 1: 26 letras + QR + Dia Zero

npm run dev:api               # API em :3333
npm run dev:web               # PWA em :3000
```

Para ver o produto funcionando antes de o cliente enviar o material real,
publique três letras com conteúdo de exemplo:

```bash
npx tsx packages/db/prisma/conteudo-exemplo.ts            # publica A, B e C
npx tsx packages/db/prisma/conteudo-exemplo.ts --limpar   # desfaz
```

Se `PUBLIC_WEB_URL` ou `PUBLIC_SHORTLINK_BASE` mudarem (ex.: sair de localhost
para o domínio real), regere os destinos e os QR:

```bash
npx tsx packages/db/prisma/regerar-links.ts
```

Criar o administrador do painel (não existe tela para isso de propósito — uma
rota que promove a admin seria a porta mais fácil de invadir o sistema):

```bash
npx tsx packages/db/prisma/criar-admin.ts email@dominio.com [senha]
```

O painel fica em `/<projeto>/admin`.

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
- API de coleta: atribuição em três camadas, ingestão de eventos, `/r/:code`
- API de conteúdo: projeto, índice, página e SVG do QR
- PWA instalável com página de conteúdo montada por blocos, página PV e
  rastreamento ligado — jornada QR → página → navegação verificada em navegador
- Autenticação própria, consentimento LGPD/GDPR e perfil com as três seções
- Painel administrativo: criar conteúdo, editar blocos, enviar mídia,
  publicar e baixar o QR para impressão — usável pelo celular

**Próximo**
- Módulo social: curtir, comentar e compartilhar com link de referência
- Dashboard com as métricas essenciais (Entrega 2)

## Decisões operacionais a revisitar

- **Mídia em disco local.** `UPLOAD_DIR` precisa ser volume persistente com
  backup: recriar o container sem volume apaga todas as músicas e áudios. Para
  26 letras funciona; antes de crescer, trocar `StorageService` por S3/R2 —
  a interface existe justamente para isso.
- **Domínio do QR.** `PUBLIC_SHORTLINK_BASE` fica codificado dentro de cada QR
  gerado. Definir o domínio real ANTES de imprimir qualquer material.

## Pendências com o cliente

1. Mockups (anunciados, ainda não enviados)
2. Conteúdo das 26 letras: músicas, áudios, letras, textos, imagens
3. Arte e textos da página institucional PV + número de WhatsApp
4. Plataforma de checkout externo escolhida (pode vir depois)
