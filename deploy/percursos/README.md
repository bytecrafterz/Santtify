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
