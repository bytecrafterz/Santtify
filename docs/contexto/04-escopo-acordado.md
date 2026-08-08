# Escopo Acordado — Consolidado

Documento de referência do que foi **fechado entre as duas partes**, destilado de
[03-historico-conversa.md](03-historico-conversa.md). Em caso de dúvida durante o
desenvolvimento, este documento é a fonte da verdade.

**Status:** Escopo aprovado pelas duas partes. Escrow pago em 2026-08-08. Desenvolvimento liberado.

---

## Os dois projetos (não confundir)

| | Jesus Alfabeto Saudável | Produto Vivo |
|---|---|---|
| **O que é** | Produto educacional infantil, 26 letras | Tecnologia/plataforma social-comercial white label |
| **Papel** | Vitrine e primeiro caso real de uso | Projeto principal, a ser vendido a empresas |
| **Nesta fase** | Aplicação completa, entregável | Camada genérica + coleta de dados que provam a tecnologia |
| **Futuro** | Continua evoluindo | API white label para McDonald's, Zara, Nike, etc. |

Princípio de arquitetura que decorre disso: **nada do módulo social ou de métricas pode
ser acoplado ao conceito de "letra"**. Uma letra é apenas *um conteúdo* de um *projeto*.

---

## FASE 1 — Escopo contratado (USD 256, ≈4 semanas)

### Entrega 1 (≈2 semanas)

- [ ] 26 páginas de conteúdo (uma por letra) com música, áudio, letra da música e conteúdo educativo
- [ ] PWA instalável (Next.js), funcionando bem em celular
- [ ] Geração **automática** de link + QR Code ao cadastrar um conteúdo pelo painel
- [ ] Gerenciador de QR Codes no painel (o cliente **não** fornece QR Codes prontos)
- [ ] Autenticação própria
- [ ] Perfil de usuário: "Minhas Publicações", "Meu Registro", "Meus Lançamentos"
- [ ] Painel admin simples, usável **pelo celular ou computador**, para o cliente cadastrar música, vídeo, texto, título e imagem sem conhecimento técnico
- [ ] Página institucional do ícone PV + botão de WhatsApp (arte e textos fornecidos pelo cliente)
- [ ] **Camada de coleta de métricas ativa desde a primeira linha** (ver seção Dia Zero)

### Entrega 2 (≈2 semanas seguintes)

- [ ] Módulo social genérico completo: curtir, comentar, compartilhar, contagem de interações
- [ ] Dashboard administrativo com métricas essenciais
- [ ] Testado antes do pagamento correspondente

### Dashboard da Fase 1 — métricas essenciais (o que é obrigatório mostrar)

- visitantes
- cadastros
- novos usuários por período
- origem dos visitantes
- origem dos cadastros
- compartilhamentos
- usuários vindos de compartilhamento
- conteúdos mais acessados

---

## DIA ZERO — Camada de coleta (o inegociável desta fase)

> Regra que justifica tudo isto: **dado que não foi gravado no lançamento não pode ser
> recuperado depois.** A apresentação pode esperar meses; a coleta não pode esperar um dia.

Confirmado ponto a ponto pelas duas partes:

1. **Eventos brutos individuais sempre armazenados** — cada um com identificador de
   usuário, timestamp, tipo de evento, origem, campanha, conteúdo e referência.
   Nunca apenas agregados.
2. **Fotografia diária existe, mas é camada derivada** — nunca fonte da verdade.
   Sempre recalculável a partir dos eventos brutos. O inverso jamais.
3. **Origem inicial e origem imediata gravadas separadamente** por pessoa.
4. **Identificador próprio por campanha / publicação / vídeo** (UTM, referral ID ou equivalente).
5. **Botão compartilhar gera link identificável por usuário e por conteúdo** — mede a
   propagação sem acessar conversas privadas.
6. **Cadeia de propagação gravada desde o primeiro usuário** — cada compartilhamento
   guarda quem compartilhou e quem originou a jornada. A relação A → B → C → D,E,F fica
   reconstruível retroativamente.
7. **Eventos de compra previstos no banco desde já** (espaço reservado, integração na Fase 2):
   `checkout_clicked`, `purchase_completed`, `purchase_value`, `product_id`, `campaign_id`, `referral_id`.
8. **`content_id` associável a metadados de conteúdo** — plataforma, formato, tema,
   produto, campanha, CTA, data/hora e variante de teste. Sem análise agora; só a
   estrutura, para a IA futura cruzar desempenho × características.
9. **LGPD/GDPR desde o início** — identificadores pseudônimos, sem dado pessoal
   desnecessário no fluxo de eventos, registro de consentimento no primeiro acesso,
   política de retenção definida.

Chave mínima de cada evento, conforme o cliente formulou:

```
usuário/evento + timestamp + source + campaign_id + content_id
              + referral_id + parent_referral + tipo de evento
```

### Marco Dia Zero a registrar no lançamento

| Canal | Base inicial |
|---|---|
| Instagram | ~200 seguidores |
| TikTok | ~40 seguidores |
| YouTube | 0 inscritos |
| Produto Vivo | 0 usuários |

Sem mídia paga nesta primeira operação — o crescimento medido é orgânico, e essa é a
prova comercial pretendida.

---

## FASE 2 — Fora do escopo atual (etapa seguinte da parceria)

Explicitamente adiado, **com acordo das duas partes**, e construído sobre dados que já
estarão coletados:

- Painel de criação/gestão de **múltiplos projetos** lado a lado com identidade própria
  (é o núcleo do Produto Vivo como plataforma)
- **API white label** do Produto Vivo
- Comparações cruzadas entre plataformas (Instagram × TikTok × YouTube × Facebook × WhatsApp × PV)
- Funil detalhado por campanha/post/vídeo
- **Visualização** da árvore de propagação
- Camada de IA analítica e ciclo medir → analisar → recomendar → executar → aprender
- Integração de confirmação de compra vinda do checkout externo (webhook/API/pixel)
- Cálculo de faturamento gerado por cadeia de propagação
- Tempo médio de permanência e estatísticas detalhadas de interação

> Nota: a Fase 2 exige apenas **ligar a entrada** e **construir a leitura**. Nenhuma
> reescrita de banco. Isso foi prometido explicitamente ao cliente e é um critério de
> aceitação da arquitetura da Fase 1.

---

## Decisões travadas

| Tema | Decisão |
|---|---|
| Pagamento dentro da plataforma | **Não** nesta fase. Checkout externo. |
| QR Codes | Gerados pelo sistema, nunca fornecidos prontos |
| Cadastro de conteúdo | Feito pelo próprio cliente, pelo painel |
| Multi-projeto no painel | Fase 2 (mas o modelo de dados já suporta) |
| Árvore de propagação visual | Fase 2 (mas os dados são gravados desde o Dia Zero) |
| IA | Fase 2 (mas o banco nasce preparado) |
| Idioma da aplicação | Português (cliente PT/BR) |

---

## O que o cliente ainda deve fornecer

1. Mockups (anunciados, ainda não enviados)
2. Conteúdo das 26 letras: músicas, áudios, letras, textos educativos, imagens, títulos
3. Arte e textos da página institucional PV
4. Número de WhatsApp para o botão de contato
5. Identificação da plataforma de checkout externo escolhida (pode vir depois)
