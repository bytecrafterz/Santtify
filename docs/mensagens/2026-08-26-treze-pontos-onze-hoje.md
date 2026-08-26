# 26/08/2026 - Os treze pontos: onze hoje, dois continuam a ser trabalho novo

**CONTEXTO:** ele listou treze pontos e condicionou a revisao final e a
libertacao do pagamento a todos eles. Dois desses pontos sao escopo novo: o 13
e literalmente o A que ele pediu para orcar no dia anterior, e o 5 e o canal de
mensagens ja adiado desde 25/08.

**MEDIDO ANTES DE RESPONDER:**
- Cadastros 8 vs 7: o oitavo e a conta de teste `qa.impressao.2608`, ja DELETED.
  O painel conta `Visitor` distintos sem filtrar contas removidas.
- Comentarios: o contador vem de `ContentStats` e esta negativo (Introducao -3
  para 3 reais, Letra A -2 para 1 real, Letra B 0 para 2 reais). A correccao de
  26/08 arranjou `contarComentarios()`, mas o ecra le `estado()`.
- QR das letras B e C: a API responde 200 nas tres. O QR so esta dentro do
  editor do cartao de impressao, e B e C nao tem cartao criado.
- Produto Vivo: ja e editavel em Estrutura raiz, ele nao o encontrou.

**O QUE NAO SE CONCEDE:** o 5 e o 13. Nao se desconta trabalho actual contra
promessa de fase futura.

**FORMATO:** na Workana o Enter ENVIA. Cada paragrafo e UMA linha continua.

---

Rossandro, recebi os treze pontos e fui verificar um por um antes de te responder. Vou ser direto: onze deles eu faço hoje, sem custo nenhum, porque são defeitos meus, verificações ou coisas pequenas. Dois não são, e no fim eu digo quais e por quê.

Começo pelos dois números errados, porque são os que mais incomodam.

O contador de pessoas cadastradas mostra 8 e você tem 7. O oitavo é uma conta de teste minha, que usei ontem para conferir o cartão de impressão e desativei logo em seguida. O painel continuou contando ela porque ele conta também as contas removidas, e isso é um defeito que eu corrijo hoje. Peço desculpa, não é a primeira vez que um teste meu aparece nos seus números, e vou passar a testar fora da sua base.

O contador de comentários está pior do que você viu, e você tem toda a razão em insistir. Fui medir e ele está mostrando números negativos: na Introdução mostra menos 3 quando existem 3 comentários, e na Letra A mostra menos 2 quando existe 1. Eu já tinha mexido nesse contador em 26 de agosto, mas mexi no lugar errado: existiam dois pedaços do sistema contando a mesma coisa, eu arrumei um e a tela usa o outro. Hoje passa a existir um só, que conta na hora, e isso conserta junto as visualizações, que por causa do mesmo problema apareciam sempre em zero.

O QR das letras B e C. A culpa é minha e é de ontem. O QR existe e funciona nas duas, mas eu coloquei ele dentro do editor do cartão de impressão, e as letras B e C ainda não têm cartão de impressão criado. O QR pertence à letra, não ao cartão. Hoje ele passa a ficar disponível em toda letra, tenha cartão ou não.

O QR em PNG: você tem razão, o WhatsApp não envia arquivo vetorial. Fica o vetorial para o designer e a gráfica, e um PNG em alta resolução ao lado dele, para você mandar por mensagem.

O PDF do cartão com Voltar, Baixar PDF, Imprimir e Compartilhar: entra hoje.

O símbolo azul de verificado sai hoje dos perfis.

A área para você colocar e trocar arte, áudio e conteúdo do Produto Vivo já existe, e a falha aqui é de eu não ter te mostrado onde. Ela está no Painel, em Estrutura raiz, no bloco PRODUTO VIVO. Hoje eu confiro que está tudo funcionando e, se continuar difícil de achar, eu deixo ela óbvia.

As métricas do Produto Vivo: visualizações, curtidas, comentários, compartilhamentos e origem por país já existem no painel de métricas. Só que esses números não são confiáveis enquanto o contador estiver quebrado, então eles só passam a valer depois da correção de hoje. Estado e cidade é a única parte que não existe: precisa de outra base de dados de localização, maior que a que está lá. É trabalho pequeno, mas é trabalho novo, e prefiro te dizer isso do que te entregar um dado inventado para apresentar a empresa.

O convite para instalar o ícone no telefone quando a pessoa entra, e a mensagem automática no cadastro orientando a colocar nome verdadeiro e foto pessoal: os dois entram hoje.

A visibilidade dos perfis eu confirmo hoje entrando com uma conta comum, e não com a minha de administrador, que é justamente a diferença que interessa testar.

Sobram dois pontos, e esses eu preciso separar com franqueza, porque não seria honesto misturar.

O ponto 13, criar e publicar projetos novos pelo painel, é exatamente o trabalho A que você me pediu para orçar ontem e que eu te respondi como sendo de 4 a 6 dias. Ele não fica menor por estar nesta lista. O ponto 5, mandar mensagem para uma pessoa específica ou para todos de uma vez, é o canal de mensagens que ficou de fora desde 25 de agosto, também como trabalho à parte. A mensagem automática de boas-vindas no cadastro, essa sim, entra hoje, porque é pequena e faz parte do que já está construído.

Então a minha proposta é esta: hoje eu entrego os onze pontos, você revisa com calma, e o projeto atual fecha com eles. Os pontos 5 e 13 continuam onde já estavam antes desta lista, junto com o A e o B, e a gente trata deles no orçamento seguinte, exatamente como você propôs no fim da sua mensagem.

Vou te avisando à medida que cada um ficar pronto, para você ir conferindo aos poucos em vez de esperar tudo no fim do dia.

Bruno
