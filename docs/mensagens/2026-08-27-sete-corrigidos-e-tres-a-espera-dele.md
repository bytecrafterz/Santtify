# 27/08/2026 - Os sete corrigidos, e os tres numeros que esperam por ele

**CONTEXTO:** quarta lista. Oito pontos, dos quais sete eram defeitos meus e um
(o #8, estrutura do Produto Vivo) e escopo novo.

**MEDIDO:**
- Sessao: 331 refresh tokens para uma pessoa, com pares de trocas no mesmo
  minuto. Cinco modulos chamavam a renovacao por sua conta. Passou a haver uma
  de cada vez.
- Imprimir: era `target="_blank"` para o PDF; na aplicacao instalada nao ha
  separador nem voltar. Passa a imprimir a propria pagina.
- Paises: a tabela tinha 15 entradas escritas a mao. Passa a usar o Intl.
- Painel: dois funis, PV numa seccao so, "Propagacao do Produto Vivo" era
  trafego do Santtify e passou a "Propagacao".

**O QUE DESCOBRI E MUDA A CONVERSA:**
- `NEXT_PUBLIC_WHATSAPP_PV` nunca foi configurado: nao ha botao do grupo, e por
  isso "cliques para entrar no grupo" e zero por construcao.
- O link da Hotmart continua por dar desde 22/08.
- A pagina do Produto Vivo tem ZERO blocos de conteudo e 579px num ecra de 844.

**FORMATO:** na Workana o Enter ENVIA. Cada paragrafo e UMA linha continua.

---

Rossandro, os sete pontos que eram defeitos estão corrigidos e no ar. Vou pela sua numeração e no fim tenho uma coisa importante para te contar, que descobri conferindo e que muda o que dá para medir hoje.

1. Login. Encontrei a causa e ela não é a que eu imaginava. A sua sessão nunca caiu.

Fui ver no servidor o momento exato do seu print. Ele está marcado 10:18, e às 10:18 a renovação da sua sessão funcionou perfeitamente: o código anterior foi trocado por um novo, sem erro nenhum. Você estava conectado o tempo todo. Também testei sair e entrar de novo: volta exatamente a mesma conta, com o mesmo cadastro. Nada se perde no banco.

O que acontecia é que a tela respondia antes de saber a resposta. Ao abrir o Santtify, o aplicativo precisa de um instante para reconhecer a sua conta, e nesse instante cinco partes da página tratavam você como alguém sem conta. Por isso aparecia o Ainda não tem uma conta. Assim que o reconhecimento terminava, sumia. No celular em rede móvel esse instante é de um a dois segundos, e por isso acontecia toda vez que você abria. Era o Está sempre acontecendo que você descreveu.

Corrigi na raiz: a página só trata alguém como visitante quando tem certeza de que não tem conta, e não enquanto ainda está descobrindo. Testei com a rede propositalmente lenta, medindo setenta vezes durante o carregamento, e o convite não apareceu nenhuma vez para quem está conectado.

E corrigi uma segunda coisa, que era a parte mais ofensiva. Quando você está mesmo deslogado por um motivo legítimo, aquela tela dizia Ainda não tem uma conta e oferecia um caminho só: criar um perfil novo. Quem já tem conta era recebido com a afirmação de que não tem, e sem nenhum botão para entrar na sua. Agora tem dois caminhos, e o de entrar vem primeiro. Criar conta continua ali, para quem chega pela primeira vez.

Uma observação, porque isso vai acontecer de novo e não é defeito: o aplicativo instalado no telefone tem memória própria, separada do navegador. Da primeira vez que você abrir o ícone ele vai pedir para entrar, mesmo você estando conectado no Safari. É assim em qualquer aplicativo desse tipo, e depois dessa primeira vez ele não pede mais.

2. PDF. Agora entendi o que estava acontecendo e a culpa era minha. O botão de imprimir abria o PDF numa aba nova. No navegador você fecha a aba; dentro do aplicativo instalado não existe aba nem botão de voltar, e você caía no visualizador de PDF do próprio telefone. Aquilo que parecia uma página de envio não era uma tela nossa, era do sistema, e por isso não tinha cancelar.

Agora imprimir não sai mais da nossa página. A folha de impressão do telefone abre por cima, cancelar te devolve ao cartão, e o VOLTAR continua ali do lado. E o que vai para o papel é só a folha, sem nada do site.

3. Cabeçalho. Tirei o Produto Vivo do topo do painel e tirei a bolinha antes do nome. Você tem razão: quem está trabalhando no painel não quer uma porta que leva para fora dele.

4. Países. Corrigido. Aquilo era uma lista de quinze países escrita à mão, e quem não estivesse nela aparecia em código. Agora o sistema conhece todos: Tailândia, Taiwan e qualquer outro. A parte de clicar no país para ver região e cidade eu não fiz, porque precisa de outra base de dados de localização, e isso é trabalho novo, como já tinha te dito.

5 e 6. Você está certíssimo e o erro era meu. Existia uma seção chamada Propagação do Produto Vivo que mostrava de onde vieram as pessoas para o Santtify. Não tinha nada a ver com o Produto Vivo. Agora o painel tem dois funis separados, com título próprio: primeiro SANTTIFY, que é quem chega, por onde chega e o que faz aqui dentro, e depois PRODUTO VIVO, que é quem já está aqui e se interessou pela proposta. O Produto Vivo aparece uma vez só.

7. Cliques no grupo. Mudei o nome para Cliques para entrar no grupo, exatamente como você pediu, porque o WhatsApp não conta a ninguém quem realmente entrou. E acrescentei um degrau que faltava no meio do funil: quantas pessoas chegam ao fim da apresentação do Produto Vivo. Sem esse número não dá para saber se quem não entrou no grupo se desinteressou pela proposta ou nunca chegou a ler.

8. A estrutura do Produto Vivo com as três artes é trabalho novo e eu te passo o orçamento junto com os outros.

Agora a parte importante, e prefiro te dizer com todas as letras.

Três dos números que você quer medir estão em zero, e não é defeito: é porque falta coisa que só você pode dar.

O primeiro é o botão do grupo do WhatsApp. Ele nunca foi configurado neste servidor. A página do Produto Vivo mostra hoje a frase Botão aguardando o link do grupo. Não existe botão nenhum para alguém clicar, então esse número vai continuar em zero por mais que a gente mexa no painel. Me mande o link do grupo e ele passa a funcionar no mesmo dia.

O segundo é o link da Hotmart, que está pendente desde 22 de agosto. Enquanto ele não existir, Cliques em comprar fica em zero pelo mesmo motivo.

O terceiro é o mais importante dos três. A página do Produto Vivo está vazia: não tem nenhuma arte, nenhum áudio e nenhum texto carregado. Ela mede 579 pontos de altura num celular de 844, ou seja, cabe inteira na tela sem precisar rolar. Por isso quem abre chega ao fim no mesmo instante, sem ter lido nada, e o degrau do meio não consegue distinguir ninguém. Eu deixei ele em zero de propósito enquanto for assim, em vez de te mostrar um número que contradiz o de cima.

Isso muda o seu ponto 8. Você me pediu a estrutura das três artes como organização de tela, e ela é mais do que isso: é a condição para o funil do Produto Vivo medir alguma coisa. Enquanto não houver a proposta carregada ali, a pergunta comercial que você quer levar às empresas não tem como ser respondida, por melhor que o painel esteja.

Continuam esperando resposta sua, das mensagens anteriores: qual celular e qual navegador a sua amiga usou quando apareceu o aviso do Google Play, e o que fazer com os dois blocos de texto antigos que sobraram na Introdução.

Sobre fechar: mantenho o que te propus. Tudo o que for defeito daquilo que foi contratado eu corrijo sem cobrar, hoje e daqui a três meses. O que for função nova a gente orça junto. Hoje são cinco coisas nessa fila: a estrutura do Produto Vivo, o detalhe de região e cidade nos países, mandar mensagem para os usuários, criar projetos novos pelo painel, e o aplicativo na Play Store. Vou te passar o orçamento das cinco juntas, para você decidir o conjunto em vez de item por item.

Me mande o link do grupo e o link da Hotmart e eu ligo os dois hoje.

Bruno
