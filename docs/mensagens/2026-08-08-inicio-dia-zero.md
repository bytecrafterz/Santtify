# Mensagem ao cliente — 08/08/2026

**Contexto:** responder à aprovação final dele (pergunta sobre metadados do `content_id`),
confirmar o início do desenvolvimento e destravar o que falta para a Entrega 1.

**Status:** rascunho, aguardando revisão do Bruno.

---

Olá Rossandro,

Sim, a estrutura já permite exatamente isso, e o Dia Zero começou hoje, como combinado.

Sobre os metadados do conteúdo: cada conteúdo já nasce com um registro próprio de
características, cobrindo plataforma, formato, tema, produto, campanha, CTA, data/hora e
variante de teste. Deixei também um campo livre ao lado desses, para o caso de você querer
marcar alguma característica que ainda não pensamos — isso entra depois sem mexer no banco.
Na prática, quando a IA da segunda etapa for cruzar desempenho com características do
conteúdo, ela vai encontrar o dado já organizado desde o primeiro conteúdo cadastrado.

Sobre o que já está feito: a modelagem dos eventos e da cadeia de propagação está pronta e
aplicada, que era justamente a parte que eu disse que não poderia ser refeita depois. Os
eventos brutos ficam protegidos contra alteração no próprio banco, não apenas por
convenção do sistema, então nenhum erro futuro consegue reescrever histórico. O marco do
Dia Zero já está registrado com os números que você passou: Instagram 200, TikTok 40,
YouTube 0 e Produto Vivo 0. E a estrutura das 26 letras já existe, cada uma com seu link e
QR Code próprio, esperando o conteúdo.

Testei a cadeia de propagação de ponta a ponta com o seu próprio exemplo, Instagram trazendo
uma pessoa, que compartilha, que traz outra, e assim por diante. As perguntas que você quer
poder fazer no futuro já são respondidas pela estrutura atual, inclusive aquela do valor
gerado por uma cadeia inteira quando a própria pessoa nunca comprou.

Agora preciso de algumas coisas suas para seguir sem parar.

Os mockups que você mencionou. Como eles definem a aparência do PWA e do painel, prefiro
recebê-los antes de montar as telas, para não fazer duas vezes.

O material das 26 letras: música, áudio, letra da música, texto educativo, imagem e título.
Você vai cadastrar tudo pelo painel, como combinamos, mas para essa primeira carga ajuda
muito receber organizado, uma pasta por letra ou uma planilha com os links. Se preferir,
posso deixar as primeiras letras já cadastradas como exemplo e você segue o mesmo formato.

A arte e os textos da página do Produto Vivo, junto com o número de WhatsApp que vai no
botão de contato.

E tenho uma dúvida sobre o perfil do usuário. Você listou três seções, My Posts, Meu
Registro e Meus Lançamentos. My Posts eu entendo como as publicações e interações da pessoa.
As outras duas eu prefiro confirmar em vez de supor: Meu Registro seria o histórico de
atividade dela na plataforma, e Meus Lançamentos seria o quê exatamente? Pergunto porque as
três aparecem como seções separadas, e se eu construir supondo errado, o retrabalho vem
depois.

Sigo no desenvolvimento da parte que não depende desses materiais.

Bruno
