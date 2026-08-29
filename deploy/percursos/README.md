# Percursos

Verificações que abrem o site publicado num navegador de verdade e andam por ele
como uma pessoa anda.

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

## As duas regras destes ficheiros

**Conta descartável, nunca uma conta real.** Cada corrida cria a sua, com um
carimbo de tempo no endereço, e apaga-a no fim pelo próprio botão de excluir
conta. Contas de teste na base dele já geraram quatro alarmes falsos, e um deles
foram 66 "visitantes alemães" que eram a minha máquina, a partir dos quais ele
ia decidir para que idioma traduzir a plataforma.

**Limpar pelo id do que se criou, nunca por uma condição.** Em 28/08 uma
limpeza apagava os cartões "sem imagem" e levou à frente um cartão dele que a
condição também descrevia. Estava vazio e não se perdeu nada, mas foi sorte.
