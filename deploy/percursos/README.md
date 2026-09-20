# Percursos

Verificações que abrem o site publicado num navegador de verdade e andam por ele
como uma pessoa anda.

## Criar contas e imagens: `criar-conta.mjs` e `imagem-de-teste.mjs`

Quatro percursos criavam contas de teste com a sua própria cópia dos passos do
cadastro. Em 01/09 o cadastro passou a exigir @identificador e fotografia, e os
quatro partiram-se no mesmo minuto. Agora criar conta é `criarConta()`, num sítio
só: quando o cadastro mudar outra vez, muda aqui.

As imagens de teste também são feitas em código, em `imagem-de-teste.mjs`. Antes
disto, `editor-igual-ao-publico.mjs` carregava `arte-deitada.png`, um ficheiro
que existia na minha máquina e em mais lado nenhum. **Um percurso que só corre
onde foi escrito não serve para o que estes existem**, que é serem corridos por
outra pessoa, noutro dia, antes de dar uma correção por feita.

## O endereço também vem do ambiente

Estes ficheiros nasceram quando só existia o site no ar, e tinham
`https://santtify.com` escrito lá dentro. Quem quisesse verificar uma correcção
**antes** de a publicar não tinha como — e verificá-la depois, contra o site
dele, significa criar contas de teste na casa do cliente.

Agora todos aceitam o ambiente, com o mesmo valor de sempre por omissão:

```bash
# como sempre foi, contra o site no ar
node deploy/percursos/percurso-completo.mjs

# ou contra o que está a correr na sua máquina
SITE=http://localhost:3100 API=http://localhost:3333/api \
CHROMIUM=$HOME/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome \
node deploy/percursos/percurso-completo.mjs
```

`CHROMIUM` existe porque o navegador que o Playwright descarrega nem sempre é o
que a máquina tem: sem ele, o percurso morre a dizer "Executable doesn't exist".

**Duas limitações, ditas por inteiro.** Nove destes percursos pedem coisas à API
pelo endereço da própria página (`fetch('/api/...')` dentro do navegador), e
isso só funciona onde o site e a API partilham o endereço — em produção
partilham, em desenvolvimento não. E vários dependem do **conteúdo dele**: a
Letra B com áudio, as categorias, os perfis. Contra uma base de dados de
desenvolvimento falham por falta de conteúdo, e não por defeito da plataforma.

## A conta de administrador vem do ambiente

Os percursos que entram no painel precisam de uma conta de administrador, e essa conta
**nunca está escrita nos ficheiros**:

```bash
PV_ADMIN_EMAIL=... PV_ADMIN_SENHA=... node deploy/percursos/percurso-completo.mjs
```

Sem as duas variáveis o percurso recusa-se a correr, em vez de falhar no meio a fingir
outra coisa. Uma senha de administrador de um site que está no ar, escrita num ficheiro
do repositório, é uma senha publicada: fica no histórico para sempre e vai com o
repositório para todas as mãos que o receberem.

## O código de saída diz o mesmo que o ecrã

Treze destes percursos imprimiam as falhas e saíam com **0**. Quem os corre em
série pelo código de saída lia "ok" em cima de uma falha escrita no ecrã.

Não é teórico: em 08/09 a limpeza de `edicao-do-perfil.mjs` falhou, o percurso
escreveu `A CONTA DE TESTE NAO FOI APAGADA`, a suite disse `ok`, e a conta de
teste ficou viva no site do cliente até ele a encontrar e reportar.

Todos terminam agora em `process.exit(falhas.length ? 1 : 0)`. **Um percurso
novo tem de acabar assim**, senão nasce mudo.

Cinco tinham escapado — `aparece-sem-recarregar`, `compartilhar-uma-publicacao`,
`duplicar-um-cartao`, `fluxo-real-do-produto-vivo` e `produto-vivo-ecra-unico`
diziam as falhas no ecrã e saíam com 0 na mesma. Foi corrigido em 20/09, com a
frase acima já escrita aqui há semanas: **o que está no README não se verifica
sozinho**.

`sequencia-completa.mjs` e `sequencia-por-categoria.mjs` não têm veredicto e não
precisam de código de saída: imprimem a cadeia de faixas para se ler, e é a
leitura que decide se está certa. `criar-conta.mjs` e `imagem-de-teste.mjs` são
peças que os outros usam.

## Porquê aqui e não testes normais

Os testes normais já passavam em todos os defeitos que ele encontrou. O build
passava, o TypeScript passava, e o cartão de impressão não imprimia. **Um
defeito de interface só existe no ecrã**, e por isso estas verificações medem o
DOM do site publicado, e não o código.

## `percurso-completo.mjs`

É o percurso que ele escreveu, palavra por palavra, no ponto 8 da mensagem de
28/08:

> Entrar → Perfil → Voltar → Editar → Salvar → Cancelar → Produto Vivo →
> Conteúdo → Áudio/Vídeo → PDF → Imprimir → Compartilhar → Voltar → Fechar →
> Entrar novamente.

E segue a regra que ele impôs em 27/08, depois de eu declarar corrigidas coisas
que não estavam: **não basta o botão abrir a função.** Cada caminho é andado até
ao fim, e o caminho do cancelar é andado também.

```bash
node deploy/percursos/percurso-completo.mjs
```

## `editor-igual-ao-publico.mjs`

A regra que ele escreveu em 29/08, depois de mandar duas fotografias do ecrã:

> O QUE EU VEJO NO EDITOR = O QUE O PÚBLICO VÊ NO PERFIL.

Carrega uma arte deitada com um bloco branco no meio, enquadra-a no editor,
grava, e compara **onde o bloco branco ficou** nas duas. Se o editor e o perfil
mostrarem o mesmo pedaço da arte, o bloco cai no mesmo sítio.

```bash
node deploy/percursos/editor-igual-ao-publico.mjs
```

A primeira versão desta verificação comparava a cor média e dava 33 em 255, e eu
ia dar isso por defeito. Guardei as duas imagens e olhei para elas: o
enquadramento estava certo e a diferença toda vinha do nome escrito por cima da
capa e do painel branco na borda de baixo. **Estava a medir o desenho da página
em vez do recorte da fotografia.** Vale para qualquer verificação automática:
quando ela acusa, olhar para o que ela viu antes de acreditar nela.

## `suite-de-correccoes.mjs`

As dezassete verificações de tudo o que foi corrigido, num ficheiro só, feito
para **correr várias vezes**:

```bash
for i in 1 2 3; do node deploy/percursos/suite-de-correccoes.mjs $i; done
```

Passar uma vez não prova nada quando o defeito é intermitente. A barra inferior
apareceu a meio do ecrã duas vezes ao cliente e nunca a mim; a única maneira de
a apanhar é repetir e comparar as corridas. Por isso cada corrida imprime
`RESULTADO CORRIDA n: x/17`, para se poderem alinhar lado a lado.

## As duas regras destes ficheiros

**Conta descartável, nunca uma conta real.** Cada corrida cria a sua, com um
carimbo de tempo no endereço, e apaga-a no fim pelo próprio botão de excluir
conta. Contas de teste na base dele já geraram quatro alarmes falsos, e um deles
foram 66 "visitantes alemães" que eram a minha máquina, a partir dos quais ele
ia decidir para que idioma traduzir a plataforma.

**Limpar pelo id do que se criou, nunca por uma condição.** Em 28/08 uma
limpeza apagava os cartões "sem imagem" e levou à frente um cartão dele que a
condição também descrevia. Estava vazio e não se perdeu nada, mas foi sorte.

## `os-cinco-de-31-08.mjs`

Os cinco pontos que ele levantou no fim de 31/08, todos medidos no site
publicado:

```bash
node deploy/percursos/os-cinco-de-31-08.mjs
```

Não cria nem apaga nada no conteúdo dele. O único gesto de escrita é tentar
publicar uma casa **vazia** da Letra Z, que falha por definição e deixa a casa
como estava.

Duas das suas verificações estavam erradas à primeira, e não o código: uma media
o realce da publicação dois segundos depois de ele acabar, e a outra exigia que
a mensagem de publicar nomeasse um título que estava lá. **Quando ela acusa,
olhar para o que ela viu antes de acreditar nela.**

## `compartilhar-uma-publicacao.mjs`

Carrega no botão de compartilhar a sério e lê o endereço que a página entrega ao
sistema de partilha, em vez de o escrever à mão:

```bash
node deploy/percursos/compartilhar-uma-publicacao.mjs
```

A primeira versão desta construía o endereço ela própria e dava-o por bom. Isso
prova que a página SABE abrir aquele endereço, e não que o botão o produz — que
era a metade que ele estava a pedir.

## `cadastro-com-identificacao.mjs`

O cadastro que ele pediu em 31/08: nome, **@identificador único** e fotografia,
antes de a conta existir.

```bash
node deploy/percursos/cadastro-com-identificacao.mjs
```

Confere a regra nos dois lados: que o formulário não deixa avançar, e que o
**servidor recusa** um cadastro sem fotografia feito por fora dele. Uma exigência
que só existe no navegador não é uma exigência.

Cria uma conta e apaga-a pelo botão de apagar conta, e confirma a limpeza da
única maneira que não mente: tentando entrar outra vez com ela. A primeira versão
procurou o botão em `/perfil`, que é a página errada, não o encontrou, e deixou a
conta de teste na base dele — que é exactamente o defeito que este percurso
existe para impedir. **Quando a limpeza falha, o percurso falha.**

## `perfil-de-outra-pessoa.mjs`

Tocar no nome de outra pessoa abre **o perfil dela**, e não a plataforma.

```bash
node deploy/percursos/perfil-de-outra-pessoa.mjs
```

Este é o percurso da correção em que eu estava errado. Ele relatou-o em 31/08 e
eu respondi-lhe que as duas páginas eram iguais. São, **em estrutura**. Medido o
ecrã, não eram: no perfil dele havia 357px dele antes de a plataforma começar, no
de outra pessoa havia 48px. Comparei a árvore de componentes e declarei igual o
que ele estava a ver diferente.

Mede o que está **pintado**, com `checkVisibility()`. `getBoundingClientRect()`
devolve caixa para elementos dentro de um `<details>` fechado, e foi assim que li
822px onde estavam 2433 e quase desfiz uma correção que já estava boa. Duas vezes
no mesmo dia a régua enganou-me antes de o código estar errado.

## `qr-code-e-perfis.mjs` e `regras-do-cadastro.mjs`

A página que o QR Code abre, os dois perfis, e as regras do cadastro.

```bash
PV_ADMIN_EMAIL=... PV_ADMIN_SENHA=... node deploy/percursos/qr-code-e-perfis.mjs
node deploy/percursos/regras-do-cadastro.mjs
```

O do cadastro **não cria conta nenhuma**: manda cada nome ao servidor sem
fotografia, e o que verifica é *por que motivo* a recusa aconteceu. Um nome
inválido é recusado pelo nome; um nome válido chega até à fotografia. Assim
prova-se a régua nos dois sentidos sem deixar nada para trás na base dele.

Verifica também o que a régua **aceita**, e essa metade importa tanto como a
outra: uma regra que recusa "24055" e recusa "Ana" junto não serve a ninguém.

## `cartao-do-link.mjs`

O que aparece **na mensagem** quando alguém partilha uma publicação.

```bash
node deploy/percursos/cartao-do-link.mjs
```

Ele disse três vezes que o compartilhar "chega de forma genérica" e eu andei a
olhar para o endereço, que já estava certo desde 01/09: abre na publicação e
acende-a. O que continuava genérico era a **pré-visualização** — o cartão que
chega ao WhatsApp trazia o nome, a descrição e a capa do PROJETO, fosse qual
fosse a música partilhada.

Cheguei a pedir-lhe que me dissesse de que ecrã tinha partilhado. A pergunta não
era a que interessava: qualquer ecrã dava o mesmo cartão. **Quando um relato se
repete três vezes depois de eu "corrigir", o que está errado é a minha leitura
do relato.**

## `tres-de-02-09.mjs`

O cartão de partilha de cada área, tocar em sequência, e a barra que fica.

```bash
node deploy/percursos/tres-de-02-09.mjs
```

O do **tocar em sequência** não espera cinco minutos por uma música: salta o
áudio para dois décimos do fim e mede se o seguinte começou. Uma verificação que
demora o tempo real do conteúdo é uma verificação que ninguém corre.

O dos **cartões** compara as quatro áreas entre si e exige que as quatro imagens
sejam diferentes. Comparar cada uma com a capa do projeto não chegava: bastava
eu enganar-me e mandar a mesma arte para duas áreas para tudo passar na mesma.

## `identidade-da-plataforma.mjs`

Ninguém se pode fazer passar pela plataforma.

```bash
node deploy/percursos/identidade-da-plataforma.mjs
```

A lista de identificadores reservados era de correspondência exacta, e só vi a
porta aberta quando o responsável escolheu o dele: `@santtify` estava travado,
`@santtifyoficial` e `@santtify_oficial` não. Este percurso confere os dois
lados — recusa os disfarces e aceita nomes reais, incluindo `@satisfy`, que se
parece e não é.

## `cartoes-personalizados.mjs`

A promessa central: o que a mãe aprova no ecrã é o que sai na gráfica. Anda pelo
percurso inteiro — duas crianças, uma foto boa e uma pequena, seleção, Pix — e
confirma o que só se vê andando: a recusa de uma foto não trava as outras, o PDF
está trancado antes do pagamento, fechar o separador não perde o pedido, e o nome
não parte em duas linhas (enquanto partia, a prévia mentia sobre o papel).

As imagens são feitas em código, como manda o resto deste directório.

## `modo-karaoke.mjs`

O karaokê de ponta a ponta: colar a letra no painel, marcar as frases com o
espaço, desfazer com Z, destacar uma palavra à mão, publicar; na página da letra,
o tocador de sempre continua lá com o botão por baixo; no karaokê, a palavra
acesa é a que se canta, sem barrinhas, e nada sai do ecrã a 390 e a 320 px; "só
com conta" convida a entrar e "desligado" tira o botão.

Precisa de uma faixa que já tenha áudio (`BLOCO=<id do cartão>`). **Repõe tudo
no fim** — letra, marcas, estado publicado, acesso e palavras — mesmo que falhe,
por isso pode correr contra produção sem estragar a sincronização dele.

## `blocos-por-projeto.mjs`

A quantidade de blocos é dele, no painel: escreve 3, aparecem 3 casas na grade
pública; cresce para 5 e as casas novas nascem com os quatro cartões. Confirma
a regra que protege o trabalho — reduzir só apaga casas vazias, e uma casa com
conteúdo trava a operação dizendo qual — e que o alfabeto continua em A–Z, com
26 casas e a falar em letras. **Repõe a quantidade original no fim.**

## `card-do-projeto.mjs`

Os quatro indicadores do card, como ele os definiu: a vista é só contador (nem
sequer é um botão), curtir curte e descurte, comentar abre e grava, partilhar
devolve um link identificável, e tocar no card — fora da imagem e fora dos
botões — abre o projeto. Anda como quem não tem conta (que é convidado a criar
uma) e como quem tem.

**Desfaz o que fez**: tira a curtida se a pôs e apaga o comentário. A partilha
fica: é um evento, e apagar um evento seria mentir sobre o registo.

Três armadilhas que este percurso já apanhou e que valem para os próximos: a
folha de instalar a aplicação volta a aparecer e intercepta toques (fecha-se
antes de cada toque), a barra de baixo cobre o fundo do ecrã (o ponto do toque
confirma-se com `elementFromPoint`), e o ecrã muda antes do servidor responder
(espera-se pela resposta antes de lhe perguntar).


## `letras-automaticas.mjs`

O caminho inteiro da transcrição automática, como ele o vive: envia um áudio
num cartão vazio e a música entra na fila **sem carregar em nada**; o painel
mostra a percentagem a subir, com a roda a andar e a barra da faixa a
acompanhar; no fim, a letra fica publicada, palavra a palavra, marcada como
automática. Confirma também as duas metades da regra que protege o trabalho
dele: trocar o áudio manda ouvir a música nova, e uma letra que ele escreveu à
mão não é apagada por áudio nenhum.

Quem faz de transcritor é o próprio percurso, pela porta e com a chave do
programa que ouve as músicas (`TRANSCRITOR_TOKEN`) — assim o caminho é o mesmo
sem os minutos de espera.

```bash
SITE=http://localhost:3100 API=http://localhost:3333/api \
PROJ=31-atributos-de-deus VAGO=<id de um cartão de áudio SEM áudio> \
TRANSCRITOR_TOKEN=... PV_ADMIN_EMAIL=... PV_ADMIN_SENHA=... \
node deploy/percursos/letras-automaticas.mjs
```

**Duas travas para poder correr contra produção.** Só mexe no cartão `VAGO` que
lhe derem, e repõe-no vazio no fim mesmo se falhar. E se houver músicas na fila,
não faz a parte que escreve: a que lhe viesse à mão podia ser uma delas, e o
percurso escrevia-lhe por cima uma letra de mentira. Sem `VAGO` ou sem chave,
faz só as verificações que não escrevem nada — o anel, os números e o botão.
