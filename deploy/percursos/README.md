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

## As duas regras destes ficheiros

**Conta descartável, nunca uma conta real.** Cada corrida cria a sua, com um
carimbo de tempo no endereço, e apaga-a no fim pelo próprio botão de excluir
conta. Contas de teste na base dele já geraram quatro alarmes falsos, e um deles
foram 66 "visitantes alemães" que eram a minha máquina, a partir dos quais ele
ia decidir para que idioma traduzir a plataforma.

**Limpar pelo id do que se criou, nunca por uma condição.** Em 28/08 uma
limpeza apagava os cartões "sem imagem" e levou à frente um cartão dele que a
condição também descrevia. Estava vazio e não se perdeu nada, mas foi sorte.
