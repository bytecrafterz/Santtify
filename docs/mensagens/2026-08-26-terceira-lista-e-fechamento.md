# 26/08/2026 (noite) - A terceira lista, e uma proposta de fechamento

**CONTEXTO:** terceira lista em dois dias. Onze dos treze pontos novos sao
defeitos meus, um ele confirma resolvido, e um (o aviso do Play Protect) assenta
numa premissa errada: nao existe aplicacao Android neste projecto.

**MEDIDO ANTES DE ESCREVER:**
- Perfil: contador diz 8 comentarios, a API devolve 8, o ecra desenha 2. As seis
  que faltam sao respostas sem pai visivel; o PainelDeComentarios so desenha o
  que tem raiz na lista.
- Existem TRES conjuntos de metricas com nomes parecidos: cabecalho do perfil
  (606/4/8/40, sobre o perfil), painel do perfil (Conteudos vistos 11, sobre a
  actividade da pessoa) e painel de metricas (2 partilhas, linhas de Share).
- Nao ha APK, build.gradle, AndroidManifest nem Capacitor no repositorio.
- O manifesto PWA esta correcto: HTTPS, service worker, standalone, icones 192,
  512 e maskable. Falta-lhe `id` e `scope`, que nao causam o aviso.

**O QUE ESTA MENSAGEM FAZ:** assume os onze, explica o Android sem ceder, propoe
um procedimento de fecho com data, e mantem os tres itens pagos por orcar.

**O QUE NAO SE CONCEDE:** o aplicativo na Play Store, as mensagens da
administracao e a criacao de projectos.

**FORMATO:** na Workana o Enter ENVIA. Cada paragrafo e UMA linha continua.

---

Rossandro, você testou bem e encontrou coisas reais. Onze dos treze pontos são defeitos meus e eu vou corrigir todos. Antes disso preciso te dizer uma coisa que descobri conferindo, porque é ela que explica quase todos eles.

Comecei pelo ponto 4, o dos comentários no perfil. Você tem razão: o contador diz 8 e ao abrir aparecem 2. Eu fui medir e a lista que o servidor manda tem mesmo 8 itens, mas a tela só consegue desenhar 2 deles. Os outros 6 são respostas cujo comentário original não está naquela lista, e uma resposta só sabe se desenhar por baixo do comentário a que responde. Sem o original, ela não tem onde aparecer.

E aqui está o que eu preciso te dizer com franqueza. Ontem eu te disse que esse ponto estava corrigido, e conferi comparando o contador com a lista que o servidor manda. Os dois batiam. Só que quem conta não é o servidor, é a tela, e a tela desenha menos. Eu conferi pelo lugar errado, e por isso você teve que encontrar de novo. Hoje eu conferi olhando para o que aparece na tela, que é o único lugar que interessa.

A regra que você mandou está certa e eu vou seguir, indo um passo além do que você pediu. Não basta os números virem do mesmo serviço: eles vão passar a ser contados a partir da mesma lista que a tela desenha. Assim, o número e o que você encontra ao abrir não têm como divergir, nem hoje nem daqui a um mês.

Sobre os pontos 3 e 5, é o mesmo assunto e você identificou exatamente. Existem hoje três conjuntos de números diferentes na plataforma, com nomes parecidos e significados distintos. No topo do seu perfil estão as visualizações, curtidas, comentários e compartilhamentos do próprio perfil. Dentro do painel do perfil estão outros quatro números, que são da sua atividade: quantos conteúdos você viu, quantos comentários você fez. É de lá que vem o 11, que são conteúdos que você abriu, e não conteúdos que existem. E no painel de métricas está um terceiro conjunto, do projeto inteiro. Os 2 compartilhamentos de lá contam apenas os links gerados pelo botão de compartilhar da plataforma, e não as vezes que você mandou o endereço por conta própria, que é por isso que dá 2 e você lembra de mais de 10.

Vou deixar uma definição só para cada número, e escrever ao lado de cada um o que ele conta, para você poder apresentar sem medo.

Ponto 8, o PDF. Encontrei o culpado. Ao lado de IMPRIMIR GRÁTIS ficou um segundo botão, BAIXAR EM PDF, que eu esqueci de mudar ontem e continua abrindo o arquivo direto, sem os quatro botões. Se você tocou nesse, cai numa tela sem saída. Vou fazer os dois passarem pela mesma página.

Ponto 9, o cartão de impressão. O caminho existe mas está escondido onde ninguém acha: dentro do menu de três pontinhos do quarto quadrado da letra. Vou tirar de lá e deixar um botão visível na tela da letra, para o fluxo ficar o que você descreveu: colocar a arte, gerar o cartão, baixar o PDF, imprimir.

Ponto 11, a navegação. Este eu acho o mais importante da sua lista para o seu dia a dia, e você tem toda a razão. Voltar sempre para a letra A com 26 letras para preencher é castigo. Vai voltar para onde você estava.

Ponto 12, a lista de curtidas. Vai abrir o perfil ao tocar, igual aos comentários.

Pontos 2 e 7, a duplicidade no painel e o Produto Vivo. Vou conferir os dois juntos, porque desconfio que são a mesma coisa: se existem dois caminhos para a mesma estrutura, é natural você não achar o Produto Vivo no que abriu. Deixo um só, e o Produto Vivo visível sem precisar procurar.

Ponto 6, a origem do tráfego. Aqui vou te dar uma resposta honesta depois de investigar, e já adianto uma parte. Quando alguém abre um link vindo do WhatsApp, o WhatsApp não conta ao site de onde a pessoa veio: essa informação é apagada por eles, não é falha nossa. Por isso muita coisa cai como sem identidade. O que eu preciso conferir é se os links que a plataforma gera, aqueles que começam com barra r, estão gravando a origem como deveriam, porque esses nós controlamos. Depois de olhar eu te digo com clareza o que dá para apresentar e o que não dá, em vez de te entregar um gráfico que não se sustenta numa reunião.

Ponto 1, a Introdução. Você tem razão, ela ficou no modelo antigo enquanto as letras foram para o novo. É o maior item da sua lista e vou converter para o mesmo padrão de cartão único.

Ponto 10, obrigado por confirmar. Os QR estão fechados.

Agora o aviso do Google Play, que é o mais sério e onde eu preciso te explicar uma coisa técnica com cuidado, porque a solução que você pediu não existe da forma como foi pedida.

O Santtify não é um aplicativo Android. Não existe nenhum arquivo de aplicativo, nenhum instalador, nenhum projeto Android neste trabalho, e nunca existiu no que foi contratado. O que existe é um site que o celular sabe instalar como se fosse aplicativo. Quando alguém instala no Android, quem monta o pacote é o próprio Google, a partir das informações que o nosso site publica, e é o Google que escolhe para que versão do Android esse pacote é feito. Não existe um número de versão nosso para atualizar, porque o pacote não é nosso.

Eu conferi as informações que publicamos e elas estão corretas e atuais: endereço seguro, ícones nos tamanhos certos, funcionamento em tela cheia. Vou acrescentar dois campos que faltavam, mas não são eles que causam o aviso.

Antes de eu seguir adiante, preciso de duas informações da sua amiga, e elas mudam a resposta: qual celular ela usou e por qual navegador ela abriu o Santtify. Se ela não usou o Chrome, o pacote foi montado por outro navegador, e aí o aviso se explica sozinho.

O que resolve isso de forma definitiva, e que eu recomendo se você quer crescer, é publicar o Santtify na Play Store como aplicativo de verdade, assinado por nós e feito para a versão atual do Android. Aí não aparece aviso nenhum, e ainda aparece a busca da loja a seu favor. Isso precisa de uma conta de desenvolvedor no seu nome, que custa 25 dólares uma única vez, e da análise do Google. É um trabalho novo e eu te passo o orçamento junto com os outros.

Sobre prazo, não vou repetir o erro de ontem de dizer que faço tudo hoje. Os onze pontos são um dia e meio de trabalho, principalmente por causa da Introdução e da origem do tráfego. Entrego até sexta-feira, dia 28. Vou te avisando à medida que cada um ficar pronto, e desta vez cada um vem com o jeito de você mesmo conferir na tela.

E queria te propor uma forma de fecharmos, porque acho que ajuda nós dois.

Eu entrego os onze até sexta. Você faz uma revisão final comparando com o que foi combinado no contrato. Tudo o que for defeito daquilo que foi contratado eu corrijo sem cobrar, sempre, hoje e daqui a três meses. E o que for função nova a gente orça junto, como já estamos fazendo. Hoje são três coisas nessa fila: mandar mensagem para os usuários, criar projetos novos pelo painel, e o aplicativo na Play Store.

Não é para apressar sua revisão, é para termos os dois a mesma régua do que é conserto e do que é trabalho novo. Assim eu consigo te dar prazo e preço de verdade nos próximos, em vez de ficar tudo misturado.

Me diga o celular e o navegador da sua amiga e eu começo agora pelos números, que é onde você tem mais razão de estar incomodado.

Bruno
