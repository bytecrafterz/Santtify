# Progresso do projeto — 26/08/2026

Este ficheiro continua [PROGRESSO.md](PROGRESSO.md), que ficou parado em 11/08,
quando ainda nada estava no ar. Quem retomar o projeto deve ler **este primeiro**;
o outro serve como história de como se chegou aqui.

---

## Situação em uma frase

**A plataforma está no ar em `santtify.com`, o cliente usa-a todos os dias e o
trabalho passou de construir para corrigir o que ele encontra.** O escopo
contratado (USD 256) foi entregue a 10/08. Tudo o que veio depois — quinze dias e
128 commits — foi correcção, acabamento e pedidos novos, ainda dentro do mesmo
contrato.

|                   |                                                        |
| ----------------- | ------------------------------------------------------ |
| Contrato          | USD 256 em custódia na Workana desde 10/08             |
| Entrega do escopo | 10/08, sete dias antes do prazo                        |
| Estado            | No ar, em uso real, com conteúdo dele                  |
| Commits           | 145 (128 desde 11/08)                                  |
| Migrations        | 24                                                     |
| Servidor          | VPS na conta dele, Docker + Caddy, domínio autenticado |

---

## O que está no ar e funciona

**A estrutura da página.** Perfil, introdução em cartões, Produto Vivo e as 26
letras, tudo na mesma tela. Tocar numa letra abre-a por baixo da grade sem sair
do sítio — regra dele desde 20/08.

**O cartão como unidade indivisível.** Um cartão é uma linha na base de dados com
imagem, áudio, título e descrição. Fica em rascunho até estar inteiro, e só então
chega à página. Foi a correcção estrutural mais importante do mês: antes eram
peças encostadas umas às outras, e por isso apareciam fotografias sozinhas no meio
da página.

**O painel do alfabeto.** Composição de 26 vagões, quatro quadrados por letra,
editor por cartão. Publicar, tirar do ar, duplicar, ordenar, apagar.

**Contas e sessão.** Registo com e-mail, reposição de senha por e-mail real
(Brevo, domínio autenticado), sessão que sobrevive a fechar o telemóvel, perfil
com foto e descrição. Quem já entrou nunca volta a ser convidado a entrar.

**Social.** Gosto, comentário, partilha e visualizações, com os mesmos quatro
indicadores em toda a plataforma, vindos de um único componente. Tocar no número
mostra quem são as pessoas.

**Métricas.** Registos, origem dos acessos por país, aberturas por letra e por
cartão, tudo a partir do log de eventos que nunca se apaga.

**PWA.** Instalável em Android e iPhone, com o passo a passo próprio de cada um,
áudio que continua com o ecrã bloqueado e cache versionada que não prende a versão
antiga no telemóvel.

**Impressão.** Cada letra tem QR Code próprio, e o cartão de impressão sai numa
folha A4, em PDF, feito no servidor.

---

## 26/08 — os três pontos do cartão de impressão

Ele apontou três coisas, e as três estão feitas.

### 1. O QR Code não aparecia onde ele precisava dele

O QR era criado com a letra desde o início, mas vivia noutro ecrã. Ele escreveu:
_"ele já deveria estar disponível aqui, pronto para eu baixar e enviar ao
designer"_, e tinha razão — uma coisa criada automaticamente que ninguém encontra
é o mesmo que não existir.

Agora está dentro do cartão de impressão, em tamanho de conferir, com um botão
para descarregar. O ficheiro é vectorial (SVG): a gráfica amplia-o para um cartaz
sem que fique serrilhado, o que uma fotografia do ecrã nunca permitiria.

### 2. TROCAR, TIRAR DO AR e DELETAR estavam atrás do mesmo gesto

Passam a ser três botões da mesma largura, porque nenhum é o principal. DELETAR
pergunta antes, porque não tem volta.

**Ao ligar o segundo apareceu um defeito antigo:** tirar do ar era desfeito pelo
gravar seguinte. O estado do cartão era recalculado a partir do que ele tem lá
dentro, e um cartão tirado do ar continua completo — logo, voltava sozinho à
página. Ninguém carregava em publicar e mesmo assim ele reaparecia. A decisão fica
agora escrita no cartão (`meta.foraDoAr`) e só sai por um gesto contrário e
explícito. A página pública também passou a respeitá-la; antes não olhava para o
estado de todo, e o botão teria mentido.

### 3. Imprimir mandava imprimir a página

Foi por isso que lhe saiu o site inteiro, com o cartão cortado ao meio. O
navegador imprime o que está no ecrã, e o que está no ecrã é uma página com
cabeçalho, botões e comentários.

A correcção não foi ajustar o estilo de impressão. Foi deixar de mandar imprimir
uma página e passar a dar um ficheiro que já é o cartão: `GET
/projects/:slug/contents/:contentSlug/cartao.pdf` compõe a folha A4 dele numa
página de 595,28 × 841,89 pt, centrada e inteira, sem redução nenhuma pelo
caminho. Um cartão, uma página A4, um PDF, com a qualidade do ficheiro original —
exactamente como ele escreveu.

`?baixar=1` muda só o cabeçalho: sem ele o navegador abre e imprime, com ele
guarda. É o mesmo ficheiro nos dois casos, e é isso que faz a impressão em casa
bater certo com o que foi enviado ao designer.

### 4. A qualidade original perdia-se antes de chegar ao papel

Isto ele não pediu, e teria descoberto na gráfica. Todas as imagens enviadas
eram reduzidas a 1200px de largura, que é a medida certa para o telemóvel e
errada para a impressora: a arte dele chega com 4419px, e em A4 sairia a cerca
de 100 dpi. Passa a ficar uma segunda cópia de 2480px, que é A4 a 300 dpi, lida
só quando alguém pede o PDF. Escreve-se apenas quando há resolução a preservar,
e quem pedir o PDF de uma imagem antiga continua a receber a de 1200px em vez de
um erro.

### 5. A publicação passou a provar o que publicou

A meio disto, uma correcção de estilo não chegou ao ar: a construção correu, o
contentor foi recriado, tudo respondeu, e o que ficou a servir era do build
anterior. Nada na saída deu sinal, e só se apanhou por eu ter ido medir o botão
no navegador. É a terceira vez este mês que a publicação engana a verificação.

Cada imagem passa a trazer dentro dela o commit de onde saiu, e o `publicar.sh`
compara no fim; se não bater, grita e diz o comando que resolve. O commit é lido
do `.git` à mão, porque o script corre como root numa árvore de outro dono e o
git, nesse caso, recusa-se a responder.

---

## 26/08 (tarde) - os treze pontos dele, e os onze que eram meus

Ele listou treze pontos e condicionou a revisão final e o pagamento a todos.
Dois eram escopo novo (o 13 é literalmente o A, o 5 é o canal de mensagens
adiado desde 25/08) e ficaram de fora, dito com todas as letras. Os outros onze
foram feitos e verificados no mesmo dia.

**Os números estavam errados e a culpa era minha, de duas maneiras.**

O contador de comentários lia uma tabela guardada, somada a cada comentário e
subtraída a cada remoção. Estava em MENOS TRÊS na introdução e MENOS DOIS na
Letra A. Um número negativo ao lado de um conteúdo não é um número errado, é um
número que denuncia como foi obtido. Pior: eu já tinha corrigido a contagem em
26/08, mas corrigi a que a lista usa enquanto o ecrã lia a outra. A regra passou
a viver num só sítio, o `ContagensService`, e a tabela deixou de ser lida e
escrita. As visualizações, presas em zero desde 18/08, voltaram com ela: 587 no
projecto.

Os cadastros diziam oito para sete pessoas. A oitava era uma conta de teste
minha, desactivada no dia anterior: a consulta contava contas removidas. É a
terceira vez que os meus dados de teste lhe dão um alarme falso.

**O QR estava no sítio errado.** Pu-lo dentro do editor do cartão de impressão
em 26/08, e as letras sem cartão criado não tinham por onde lá chegar. O QR
pertence à letra. Passou para a tela dos quadrados, e sai também em PNG porque o
WhatsApp não desenha SVG e era por lá que ele o queria enviar.

**O resto:** o cartão ganhou página própria com Voltar, Baixar PDF, Imprimir e
Compartilhar (abrir o PDF em bruto no telemóvel é um beco); o sinal azul de
confirmado saiu dos perfis, porque nada era verificado; o convite a instalar e o
aviso sobre nome e fotografia passaram a aparecer à entrada em vez de viverem em
páginas que era preciso ir procurar; e o painel de métricas ganhou o quadro de
interação com os quatro números que ele apresenta às empresas.

Ao montar os dois avisos lado a lado ficaram um por cima do outro, com o de
instalar a comer os toques do outro. Passaram a ter ordem: primeiro as regras,
que são condição para participar, depois o convite, que é conveniência.

---

## 26/08 (noite) - a terceira lista, e a lição que faltava

Ele reviu pelo telemóvel e trouxe treze pontos novos. Onze eram meus.

**O que dói e é o mais útil deste projecto até hoje:** eu tinha dado o contador
de comentários por corrigido de manhã, e tinha comparado o contador com a LISTA
QUE A API DEVOLVE. Bateu. Mas quem conta é o ecrã, e o ecrã desenhava menos: das
oito respostas devolvidas, seis não tinham comentário-pai na lista e uma resposta
desenha-se dentro do pai. Conferi pelo lugar errado duas vezes seguidas.

A regra que ele mandou é melhor do que a minha correcção da manhã. Não basta os
números virem do mesmo serviço: **passam a ser contados a partir da mesma lista
que segue para o ecrã**, com o mesmo percurso que o `PainelDeComentarios` faz.
Divergirem deixou de ser possível, porque passaram a ser a mesma coisa.

**Havia três conjuntos de métricas** com nomes iguais e sentidos diferentes: o
cabeçalho do perfil (do perfil), o painel do perfil (da actividade da pessoa) e o
painel de métricas (do projecto). Daí o "11 num sítio, 8 noutro". Os rótulos
passam a dizer de quem é cada número.

**As partilhas tinham três definições** e o painel dizia 2 num projecto com 55.
Contava só linhas de `Share`; partilhar uma faixa ou um perfil grava um evento e
ficava de fora.

**E o botão de partilhar entregava o endereço da página**, não um link
identificável. Por isso 244 dos 358 visitantes apareciam como directos num
projecto que cresce por partilha. O link curto existia e ninguém o usava ali.
Não recupera o passado; a partir daqui passa a haver de onde vieram.

**O painel tinha dois caminhos para a mesma coisa:** por baixo dos atalhos novos
estava a lista de todos os conteúdos, que abre o editor antigo de blocos soltos.
Era por aí que ele via a Introdução no modelo velho. Os pontos 1 e 2 da lista
dele eram o mesmo problema, e a resposta foi apagar o caminho antigo.

**Sobre o aviso do Play Protect:** não existe aplicação Android neste projecto.
Nenhum APK, nenhum gradle, nenhum AndroidManifest. O pacote que o Android instala
é montado pelo Google a partir do nosso manifesto, e o `targetSdkVersion` é
escolhido por eles. Não há SDK nosso para actualizar. O que resolve de vez é
publicar como TWA na Play Store, e isso é trabalho novo.

---

## 27/08 - a quarta e a quinta listas, e a auditoria das métricas

Ele reviu pelo telemóvel e trouxe treze pontos, depois mais dois, depois a
desconfiança nas métricas. Sete dos treze eram defeitos meus e foram feitos no
mesmo dia; o resto está listado no fim deste ficheiro.

**O login: três defeitos diferentes, um só sintoma.** Ele escreveu "estou sendo
deslogado várias vezes" e "o sistema não reconhece que a conta já está
registrada". Nada disso estava a acontecer. Fui ao servidor ver o minuto exacto
do ecrã que ele fotografou: às 09:18 UTC a renovação da sessão dele correu bem, e
09:18 UTC é 10:18 em Portugal, a hora do print. A conta nunca se perdeu, e
registar, sair e entrar devolve o mesmo utilizador com o mesmo id.

O que havia era outra coisa: `usuario` é nulo em dois momentos sem relação, quem
nunca se registou e quem tem sessão a ser restaurada, e **cinco componentes
tratavam os dois da mesma maneira**. Durante o segundo que a restauração demora
em rede móvel, a página convidava a criar conta quem já tinha uma. Todas as
vezes. A pergunta passou a ter uma resposta só, `visitante`, no provedor.

E quando ele estava mesmo deslogado por um motivo legítimo, o painel dizia
"Ainda não tem uma conta?" com uma saída só: criar outra. Passou a ter duas
portas, com entrar primeiro.

**A auditoria das métricas, e o que ela encontrou sobre mim.** Ele desconfiou:
está em Portugal, testa o dia todo, Portugal não aparece e a Alemanha mostra 66.
Tinha razão. As 69 linhas partilham um único `ipHash`, e `49.12.170.6`, a máquina
de desenvolvimento num centro de dados alemão, produz exactamente esse hash. Ao
todo 201 visitas minhas. **Ele ia decidir em que idioma traduzir a plataforma a
partir de um número que era meu.**

Não se apagou, marcou-se: `ignoradoNasMetricas`. Os eventos são append-only e o
gatilho recusaria o apagamento em cascata; e esse log é a única coisa deste
sistema que não se recria. Saíram 204 visitas (201 minhas, 19 de contas de
administrador, com sobreposição) e ficaram 199. As visitas de administrador
passam a sair sozinhas no momento em que a visita se liga à conta, porque uma
limpeza periódica esquece-se e o número volta a mentir.

O filtro vive numa constante, `SO_VISITAS_REAIS`, aplicada às nove consultas.
Escrevê-lo à mão nove vezes é exactamente como este painel já se contradisse três
vezes.

**A geolocalização não estava avariada.** Das 43 visitas registadas depois de a
base de países entrar em 25/08, **43 têm país**. As 156 sem país são todas
anteriores e são irrecuperáveis: guarda-se um resumo do endereço, nunca o
endereço. A base resolve Portugal correctamente quando testada com endereços da
MEO, NOS e Vodafone. Portugal não aparece porque nenhuma visita de endereço
português foi registada; 35 das 43 são do Brasil, o que aponta para a ligação
dele ser lida como brasileira. Fica por confirmar com o teste ao vivo que ele
próprio propôs.

**O que ele pede e a plataforma não guarda:** IP em cru, ASN, operadora, deteção
de VPN, user-agent, sinal de robô. Nada disso existe, por decisão de privacidade,
e a política publicada em nome dele promete-o às famílias. O pedido de auditoria
dele colide com um compromisso que ele já assumiu, e isso tem de lhe ser dito
assim.

---

## Defeitos do mês que valem ser lembrados

Estão todos corrigidos. Ficam aqui porque a forma como falharam repete-se.

**Um cartão escrevia por cima do outro.** Faltava `key` no React, e o estado do
formulário anterior sobrevivia à troca de cartão. O mais grave do mês: perdia
trabalho dele sem dizer nada.

**A API não compilou, o site compilou, e eu confirmei o site.** Durante uma hora
dei por publicado o que estava a servir código velho. O build local passou por
causa da cache incremental do TypeScript. Hoje o `publicar.sh` apaga `dist` antes
de construir, falha alto, e confere a saúde da API de dentro do contentor.

**A conferência que eu acabei de pôr dizia que a API estava em baixo estando boa.**
Perguntava ao porto errado. Uma conferência errada é pior do que nenhuma.

**A chave do e-mail existia no servidor e não existia dentro da API.**
`--env-file` só interpola o ficheiro do compose; não entra no contentor sem estar
em `environment:`. O mesmo tipo de silêncio apanhou o número de suporte, que o
Dockerfile deitava fora por falta de `ARG`.

**Os meus dados de teste deram dois alarmes falsos ao cliente.** Ele julgou que a
irmã se tinha registado quatro vezes, e viu contas `@santtify.dev` na lista de
quem gostou. As listas públicas passaram a filtrar contas removidas, e eu deixei
de testar na base dele.

**A elipse preta da barra, duas vezes.** À segunda medi o elemento no navegador em
vez de adivinhar: 40×128, porque uma regra genérica de semanas antes também batia
certo com o nome que eu tinha escolhido.

---

## As duas lições que mandam neste projeto

**Defeitos aqui passam no build e nos testes.** Quase tudo o que ele encontrou é
visível apenas no ecrã ou na base de dados. Publicar, abrir num navegador a sério
e medir o DOM não é excesso de zelo: é a única verificação que vale. E publicar
também não chega: é preciso confirmar que no ar está o que se acabou de publicar,
porque três vezes este mês não estava.

**O que é desenhado duas vezes diverge, e diverge onde ninguém olha.** Aconteceu
três vezes — os quatro indicadores em três ficheiros, três desenhos de perfil,
três caminhos de criar conteúdo dos quais só um fazia QR Code. A correcção nunca
foi acertar a cópia. Foi apagá-la.

---

## Pendências

| Item                                               | Bloqueado por     | Nota                                  |
| -------------------------------------------------- | ----------------- | ------------------------------------- |
| Link da Hotmart para o botão de PDF da barra       | Ele               | Espera desde 22/08                    |
| Nome e foto obrigatórios no perfil                 | Nada; falta ligar | O aviso existe, ainda não impede      |
| Canal de mensagem do responsável para o utilizador | Orçamento         | Pedido em 25/08                       |
| Vídeo dentro dos blocos                            | Orçamento         | `BlockType.VIDEO` existe, tocador não |
| Projectos em destaque, carrossel                   | Orçamento         | Faz parte de A                        |

---

## O que ele pediu a 26/08 e ainda não foi orçado

**A — projectos genéricos.** Criar um projecto novo escolhendo a quantidade de
blocos, em vez de 26 letras fixas. O `Project` já é entidade a sério, com marca,
conteúdos e métricas próprias; o número 26 está preso em dois sítios apenas. O que
não existe é o botão de criar projecto, e é aí que está o trabalho: formulário,
escolha de quantidade, e o alfabeto deixar de mandar na grade.

**B — cartões personalizados.** Cada pessoa gera o seu cartão com foto, áudio e
texto próprios, e recebe um A4 de alta qualidade. O motor A4 acabado de construir
serve de base, mas B tem partes que ainda não existem: composição da arte com os
dados de cada pessoa, biblioteca de modelos, e — pelo carrinho de compras que
aparece no desenho dele — um fluxo de compra que nunca foi descrito.

Estas duas coisas são trabalho novo e estão fora do contrato de USD 256.
