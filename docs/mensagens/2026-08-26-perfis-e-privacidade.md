# 26/08/2026 (noite) - O contador de perfis e a lista fechada

**CONTEXTO:** ele confirmou os pontos 1 e 2 (lista de curtidas e comentarios) e
levantou o 3: 13 perfis mostrados para 9 reais, e a lista completa de utilizadores
acessivel a qualquer pessoa.

**MEDIDO:**
- `comunidade.perfis` contava `Visitor` distintos com dono sem filtrar contas
  removidas: 13 para 9 reais. Terceira vez que o mesmo defeito aparece num sitio
  diferente; as quatro a mais eram contas de teste minhas.
- Corrigido com `membrosDoProjeto()`, que serve o numero e a lista.
- `/projects/:slug/people` passa a exigir sessao e administracao (401 sem).
- Verificado: sem conta e com conta comum, SPAN com o numero e rota 401. Com
  administracao, BUTTON e a lista abre. Com a minha conta de teste viva, contador
  10 e lista 10 linhas. Depois de a retirar: 9 e 9.

**O QUE FICA POR RESPONDER:** o telemovel e o navegador da amiga (Play Protect) e
o que fazer aos dois blocos de texto antigos da Introducao.

**FORMATO:** na Workana o Enter ENVIA. Cada paragrafo e UMA linha continua.

---

Rossandro, obrigado por confirmar os pontos 1 e 2. O ponto 3 já está corrigido, nas duas partes.

Primeiro o número. Você tem razão: mostrava 13 onde existem 9. E eu preciso te dizer de onde vinha, porque é o mesmo defeito que eu já tinha corrigido em outros dois lugares nos últimos dois dias. A contagem somava todas as pessoas que já passaram pela plataforma com conta, incluindo contas que foram removidas depois. As quatro a mais eram contas de teste minhas.

Agora o número deixou de ser uma conta separada: ele é a própria lista que você abre, contada. Não existe mais a possibilidade de um dizer 13 e o outro mostrar 9, porque passaram a ser a mesma coisa. Neste momento a página mostra 9 perfis criados e existem 9 pessoas cadastradas.

Segundo, a privacidade, e aqui você está certíssimo. A lista completa de todo mundo deixou de ser pública. Ela agora exige sessão e permissão de administrador no próprio servidor, e o botão que abre essa lista só aparece para você. Quem não é administrador continua vendo o número, porque é ele que mostra a uma família que existe gente do outro lado, mas não tem como abrir a lista.

O que continua livre para todos é exatamente o que você descreveu como correto: tocar no nome ou na foto de alguém que curtiu ou comentou e entrar no perfil daquela pessoa. Ali existe um ato público dela que leva até ela. Uma lista de todos os cadastrados não tem ato nenhum por trás, e numa plataforma com crianças é isso que faz a diferença.

Se quiser conferir você mesmo: entre com a sua conta, toque nos três pontinhos no canto da sua foto de capa e você vai ver 9 perfis criados como botão, que abre a lista. Depois peça a alguém da família que entre com a conta dela e faça o mesmo: ela vai ver o mesmo número, mas como texto, sem abrir nada.

Com isso, tudo o que estava na sua lista de hoje de manhã está no ar. Eu tinha te dito sexta-feira e ficou pronto hoje.

Faltam duas coisas, e as duas dependem de você.

A primeira é o aviso do Google Play. Preciso saber qual celular a sua amiga usou e por qual navegador ela abriu o Santtify. Sem isso eu não consigo fechar esse ponto, e ele é o único da sua lista que continua em aberto.

A segunda é sobre a Introdução. Ao tirar o caminho antigo do painel, sobraram dois blocos de texto do modelo velho: um está vazio e o outro tem um texto seu, chamado Conteúdo educativo. Nenhum dos dois aparecia na página, nem antes nem agora. Eu não apaguei porque o texto é seu. Me diga se apago os dois, ou se prefere que eu transforme esse texto num cartão com foto e áudio.

Assim que você me responder essas duas, fazemos a revisão final como eu propus: o que for defeito daquilo que foi contratado eu corrijo sem cobrar, sempre, e o que for função nova a gente orça junto.

Bruno
