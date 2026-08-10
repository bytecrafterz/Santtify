# Mensagem ao cliente — orçamento dos três blocos

**Contexto:** ele aceitou separar as novas funções do contrato atual e pediu escopo,
valor e prazo de cada bloco, para aprovar um por vez.

**Decisões de precificação**

Total dos três: **USD 4.900**. É um salto grande frente aos USD 256 da Fase 1, e o
salto é real: a Fase 1 foi orçada como projeto de entrada e acabou incluindo a camada
inteira de rastreamento e atribuição, que nasceu depois da proposta. Estes valores
refletem escopo e tempo de verdade.

| Bloco | Esforço | Valor | Prazo |
|---|---|---|---|
| 1. Venda + desbloqueio + playlist | ~50 h | USD 1.400 | 2–3 semanas |
| 3. Permissões (visitante × membro) | ~35 h | USD 900 | 1–2 semanas |
| 2. Vídeo e foto no My Post | ~100 h | USD 2.600 | 4–5 semanas |

**Ordem recomendada: 1 → 3 → 2.** Não é preferência, é dependência:

- O bloco 1 define **o que é ser membro** (quem comprou), e sem isso o bloco 3 não tem
  o que separar.
- O bloco 3 define **quem pode publicar**, e sem isso o bloco 2 não sabe a quem liberar
  o envio de vídeo.
- O bloco 1 é o único que **gera receita**, então ele é o que paga os outros.

O bloco 3 sai por 900 **porque vem depois do 1**. Feito isolado, antes do modelo de
compra existir, custaria mais e parte teria de ser refeita.

**Mudança de comportamento no bloco 3, atenção:** ele quer que visitante sem conta possa
**curtir e compartilhar**. Hoje curtir exige conta. Isso significa passar a registrar
curtida por visitante anônimo, com deduplicação — não é só liberar um botão.

**Custo recorrente do bloco 2:** US$ 10–30/mês no começo, crescendo com o arquivo de
vídeo. É despesa dele, mensal, e precisa estar dita antes e não depois.

**FORMATO:** na Workana o Enter ENVIA. Cada parágrafo é UMA linha contínua.

---

Olá Rossandro,

Segue o orçamento dos três blocos, separados como você pediu, cada um com escopo, valor e prazo, para você aprovar um de cada vez.

Antes dos números, uma observação sobre a ordem, porque ela não é preferência minha, é dependência técnica real.

O bloco da venda é o que define o que significa ser membro, ou seja, quem comprou. O bloco de permissões precisa dessa definição para saber quem é visitante e quem é membro. E o bloco de vídeo precisa das permissões para saber a quem liberar a publicação. Além disso, o bloco da venda é o único dos três que gera receita, então ele é o que paga os outros. Por isso recomendo a ordem: venda, depois permissões, depois vídeo.

BLOCO 1 — VENDA E DESBLOQUEIO DO CONTEÚDO

O que será desenvolvido: recebimento automático da confirmação de compra vinda da plataforma externa de checkout, com validação de autenticidade e proteção contra duplicidade, para que uma compra confirmada libere o acesso sozinha, sem você precisar fazer nada manualmente. Registro do modelo de acesso, que é quem tem direito a qual conteúdo. Primeira letra liberada gratuitamente e as demais bloqueadas. Regra de desbloqueio por dia através do QR Code, com a criança abrindo uma letra por dia. Formação da playlist pessoal conforme a criança avança. Telas do conteúdo bloqueado, do momento do desbloqueio e da playlist. E no painel, a lista de quem comprou, com a possibilidade de liberar ou bloquear acesso manualmente quando precisar.

O que não está incluído: processamento de pagamento dentro da plataforma, que continua sendo feito pela plataforma externa, e tratamento automático de reembolso e estorno.

Valor: 1.400 dólares. Prazo: 2 a 3 semanas.

BLOCO 3 — SISTEMA DE PERMISSÕES

O que será desenvolvido: separação clara entre visitante e membro em toda a plataforma. O visitante, sem conta, navega, visualiza, ouve, curte e compartilha. O membro, com conta vinculada à compra, além disso comenta e publica. A conta pertence sempre ao adulto responsável, como combinamos. No painel, a gestão de quem é membro, com possibilidade de suspender participação quando necessário.

Um ponto técnico que vale explicar, porque afeta o preço: hoje curtir exige conta. Para o visitante sem conta poder curtir, é preciso passar a registrar a curtida ligada ao visitante anônimo, com controle para a mesma pessoa não curtir várias vezes. Não é só liberar o botão, é mudar o registro por trás dele.

Valor: 900 dólares. Prazo: 1 a 2 semanas.

Esse valor vale se este bloco vier depois do bloco da venda. Feito isolado, antes de existir o modelo de compra, sairia mais caro e parte teria de ser refeita depois.

BLOCO 2 — VÍDEO E FOTO NO MY POST

O que será desenvolvido: envio de vídeo e foto pelo celular, com indicação de progresso e recuperação em caso de queda de conexão. Conversão automática do vídeo para 720p, que é o que reduz o custo de armazenamento sem perder qualidade na tela do celular. Armazenamento na arquitetura econômica que te expliquei, com custo de saída de dados zerado. Reprodução dentro da plataforma. Publicação no My Post e no mural. Fila de moderação, em que o conteúdo passa pela sua aprovação antes de ficar visível para todos, que é a proteção necessária tratando-se de crianças. Limites de publicação, com um vídeo por dia por pessoa, duração máxima de dois minutos e tamanho máximo por arquivo. E a regra de validade dos vídeos, definida e informada à pessoa no momento da compra.

O que não está incluído: transmissão ao vivo, edição de vídeo dentro da plataforma e moderação automática por inteligência artificial.

Valor: 2.600 dólares. Prazo: 4 a 5 semanas.

Sobre esse bloco, preciso repetir uma coisa que já conversamos, porque é a única dos três que gera despesa mensal contínua. O custo de infraestrutura de vídeo começa em torno de 10 a 30 dólares por mês no cenário que você descreveu, e cresce conforme o arquivo de vídeos acumula. É despesa sua, recorrente, e é justamente por isso que a regra de validade dos vídeos precisa estar definida desde o começo e informada no momento da compra.

RESUMO

Bloco 1, venda e desbloqueio: 1.400 dólares, 2 a 3 semanas. Bloco 3, permissões: 900 dólares, 1 a 2 semanas. Bloco 2, vídeo e foto: 2.600 dólares, 4 a 5 semanas. Somando os três, 4.900 dólares.

Sei que é um valor bem acima do projeto inicial, e quero ser direto sobre o porquê. O contrato atual foi orçado como um projeto de entrada e acabou incluindo toda a camada de rastreamento e atribuição, que não estava na proposta original e que é hoje a parte mais valiosa do que está construído. Estes três blocos são orçados pelo escopo e pelo tempo reais de cada um, e cada um deles é, sozinho, maior do que aquele primeiro projeto.

Os prazos contam a partir da aprovação de cada bloco e são independentes entre si, então você pode aprovar um, ver funcionando, e só então decidir o próximo. Não precisa se comprometer com o pacote inteiro.

Fico à disposição para ajustar escopo de qualquer bloco, se você quiser uma versão mais enxuta de algum deles.

E assim que você me mandar os mockups das três áreas do perfil, eu encaixo o desenho na estrutura que já está pronta.

Bruno
