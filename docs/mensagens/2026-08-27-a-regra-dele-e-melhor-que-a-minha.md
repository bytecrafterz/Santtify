# 27/08/2026 (noite) - A regra dele e melhor que a minha

**CONTEXTO:** ele disse que alguns problemas ja mexidos continuavam a acontecer,
e deu a regra: nao basta o botao abrir a funcao, e preciso andar ENTRAR, FAZER,
CONCLUIR, VOLTAR e tambem ENTRAR, CANCELAR, VOLTAR.

**TINHA RAZAO.** Andei as jornadas como ele pediu e encontrei quatro defeitos
reais numa hora, tres deles em coisas que eu tinha dado por verificadas.

**MEDIDO:**
- Editar perfil: as duas saidas funcionam, e ficavam a 1378px num ecra de 844.
- Imprimir: a jornada passa toda no navegador. `window.print()` e ignorado em
  silencio dentro da aplicacao instalada no iOS, que e onde ele esta.
- Login: no restauro, `me()` a falhar por qualquer motivo apagava o token. A
  renovacao tinha acabado de correr bem. Ve-se nos dados dele: tokens criados e
  nunca mais usados.
- Galaxy A35: as instrucoes eram do Chrome. No Samsung Internet o menu e outro.

**O QUE FICA POR RESPONDER:** qual e o problema do Produto Vivo.

**FORMATO:** na Workana o Enter ENVIA. Cada paragrafo e UMA linha continua.

---

Rossandro, você tem razão, e a sua regra é melhor que a minha. Eu vinha conferindo que o botão existia e respondia. Você pediu para andar o caminho inteiro, entrar, fazer, concluir e voltar, e também entrar, cancelar e voltar. Fiz isso hoje e encontrei quatro defeitos reais em uma hora, três deles em coisas que eu já tinha te dito que estavam corrigidas.

Vou te contar o que cada um era, porque em todos eles a sua descrição estava certa e a minha conferência é que estava errada.

Editar perfil. Você disse que ficou preso. Você não estava preso: o formulário tem mais de 700 pontos de altura, abre por baixo do que você está vendo, e os botões Cancelar e Gravar ficavam 534 pontos abaixo do fim da tela. Você via campos e nenhuma saída. As duas coisas funcionavam, cancelar fechava e voltava, gravar fechava e voltava sozinho, e isso não servia de nada porque não dava para chegar lá. Agora abrir já leva você até o formulário, e os dois botões ficam colados no rodapé, sempre à mão. Desistir ficou tão perto quanto concluir.

Impressão. Aqui está a explicação que faltava, e ela explica por que eu insistia que estava certo enquanto você via que não estava. Eu testei no navegador e o caminho passou inteiro: as quatro opções à vista, baixar entrega o arquivo, imprimir chama a impressão, voltar volta. Só que você não está no navegador, você está no aplicativo instalado no iPhone. E ali dentro o comando de imprimir é simplesmente ignorado: não existe barra do navegador, então não existe onde abrir a caixa de impressão. O botão respondia e não acontecia nada.

No iPhone, o lugar onde mora o Imprimir é a folha de compartilhar do próprio telefone. Então, dentro do aplicativo, imprimir e enviar passaram a ser o mesmo gesto: o PDF é entregue ao telefone e ele te oferece Imprimir, WhatsApp, Arquivos e o resto. E o botão Compartilhar passou a mandar o arquivo em si, não o endereço da página. Antes ia o link, e quem recebia tinha que abrir o site e procurar o cartão. Você queria mandar o cartão.

Login. Achei o defeito de verdade, e desta vez é um logout mesmo, não é a tela se enganando. Quando você abre o Santtify, o aplicativo renova a sessão e logo em seguida pergunta ao servidor quem você é. Essa segunda pergunta estava dentro de uma proteção que apagava a sua sessão diante de qualquer erro, inclusive uma falha de rede momentânea. A renovação tinha acabado de dar certo, ou seja, a sessão era boa, e bastava a chamada seguinte tropeçar para o aplicativo jogar fora uma sessão válida. Dá para ver na sua conta: existem sessões criadas e nunca mais usadas, que nasceram de uma renovação bem sucedida e foram abandonadas ali. Agora só um aviso do servidor dizendo que a sessão não vale mais é que apaga. Falha de rede não apaga.

Preciso te dizer uma coisa sobre esse: eu já tinha corrigido exatamente isso na primeira metade do mesmo trecho, no dia 24, e deixei a segunda metade sem corrigir. O erro era meu e estava lá desde então.

Samsung Galaxy A35. Simulei o aparelho da sua amiga e encontrei. As instruções que a plataforma mostrava eram as do Chrome: toque nos três pontinhos no canto de cima, depois em Instalar aplicativo. Só que um Galaxy abre no Samsung Internet, onde o menu é de três tracinhos e fica embaixo, à direita, e a opção se chama Adicionar página a. Ela estava procurando palavras que não existem na tela dela. Agora a plataforma reconhece o navegador dela e mostra o caminho certo.

Nada estava impedindo a instalação: o site tem tudo o que o Android exige. Era só a instrução errada.

Produto Vivo. Aqui eu preciso te perguntar, porque não quero adivinhar e errar de novo. Quando você diz que o problema do Produto Vivo continua, você está falando da página estar vazia, sem arte, sem áudio e sem texto carregados, ou está falando da organização em três artes no painel, que é o item 8 da sua lista anterior? São dois trabalhos diferentes e eu prefiro perguntar do que refazer.

Uma última coisa, com franqueza. Três dos quatro defeitos de hoje moravam no mesmo ponto cego: eu testo no navegador e você vive no aplicativo instalado. Lá não tem aba, não tem botão de voltar, não tem caixa de impressão e a memória é separada. Tudo o que eu dei por verificado era verdade num navegador de computador fingindo ser um celular.

Isso mudou. Daqui para a frente cada correção é andada nos dois sentidos, entrar, fazer, concluir e voltar, e entrar, cancelar e voltar, em tela de celular, e eu digo quando não consigo reproduzir o seu ambiente em vez de deixar o resultado do navegador valer por ele. Nestes três casos eu não consigo: quem confirma de verdade é você no seu iPhone e a sua amiga no Galaxy dela.

Assim que você testar, me diga qual dos quatro ainda falha, se algum falhar. E me responda a pergunta do Produto Vivo para eu seguir.

Bruno
