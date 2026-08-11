# Mensagem ao cliente — barreira na entrada em vez de fila manual

**O que ele propôs:** substituir a fila de aprovação por controle de quem pode publicar.
Membro grátis navega, curte, comenta e compartilha, mas não publica foto. Membro
Premium comprou, tem conta identificada, selo de verificado e publica. Aceite de regras
antes de publicar, bloqueio permanente para quem violar, e Bloquear/Denunciar visíveis.
Argumento dele: aprovar manualmente é impossível com 10 mil ou 100 mil fotos.

## A análise

### Onde ele tem razão

Aprovar 100 mil fotos à mão é impossível, e a barreira na entrada é a decisão certa —
é assim que plataforma séria faz. Também é a primeira vez que ele traz uma restrição
de produto em vez de uma expansão, e a motivação declarada (ambiente cristão para
crianças e famílias) é coerente com tudo o que ele já disse.

### Onde ele está errado, e é a parte que protege as crianças

**Barreira de entrada e revisão de conteúdo resolvem problemas diferentes.** A entrada
resolve *quem entra*. A revisão resolve *o que é publicado*. Pagar não impede publicar
a foto errada.

E o caso mais provável nem é o mal-intencionado: é o pai de boa-fé que publica uma foto
onde aparece outra criança que não é filha dele, ou o rosto da criança com o uniforme e
o nome da escola. Premium não toca nesse caso. É exatamente o caso que a fila pega.

### O argumento de escala não se sustenta contra o desenho dele mesmo

A fila **não cresce com o número de usuários; cresce com o número de fotos publicadas.**
Com a proposta dele, só quem comprou publica. O universo deixa de ser 100 mil e passa a
ser a fração que pagou, e dessa fração só uma parte publica foto.

E existe o desenho que faz a fila **encolher** conforme a plataforma cresce: revisar as
primeiras publicações de cada conta e liberar publicação direta depois de N aprovadas.
Confiança que se ganha. A fila fica proporcional a **contas novas**, não ao tamanho da
base. Isso é barato de construir e é a resposta honesta ao problema real dele.

### Denunciar é moderação depois, não em vez de

"Bloquear e Denunciar" não elimina revisão humana: **move a revisão para depois da
publicação** e a torna reativa. A foto ficou pública, alguém viu, alguém denunciou, e
alguém precisa olhar. Denúncia também vira fila — dá **mais** trabalho, não menos.

Numa plataforma de crianças, o intervalo entre publicar e alguém denunciar **é o risco**.

Além disso: na Europa, ter canal de denúncia de conteúdo ilegal é praticamente
obrigatório para quem hospeda conteúdo de usuário. Ou seja, Denunciar não é alternativa
à moderação; é uma obrigação separada, que pressupõe alguém do outro lado lendo.

### O selo de verificado é um risco, não uma proteção

Ele **decidiu, com razão, não fazer verificação por documento** por causa do custo
(US$ 1,50–2,00 por pessoa, mais que o contrato inteiro em 1.000 clientes). Um selo
escrito "verificado" que significa apenas "comprou" **afirma ao usuário algo que não é
verdade**. Pai vê selo, baixa a guarda. Selo de segurança falso é pior que nenhum.

Nome honesto: **Membro**. "Verificado" quando houver verificação.

### A sugestão que junta tudo — e que já está construída

Membro grátis continua publicando no My Post **o conteúdo da própria plataforma com
legenda**; **só a foto do aparelho exige Premium.**

- A restrição fica exatamente onde está o risco.
- Publicar a música do projeto tem risco zero e é o que gera compartilhamento — o
  motor do Dia Zero e das métricas dele. Bloquear isso do gratuito custaria alcance sem
  ganhar segurança.
- **Custo técnico: nenhum.** O `PostsService` entregue em 12/08 já se ramifica em "tem
  foto / não tem foto". A mesma separação que decide o que nasce pendente passa a
  decidir quem pode. A assimetria que ele questionou é o que torna a proposta dele
  barata.

### O enquadramento comercial

O que ele descreveu **é o Bloco 1 mais o Bloco 3**, ambos já orçados em 11/08:

| Bloco | O que é | Valor enviado | Prazo |
|---|---|---|---|
| 1 | Compra pelo checkout externo → cria o Premium (+ playlist e desbloqueio) | USD 1.000 | 2–3 semanas |
| 3 | Permissões: quem pode o quê | USD 700 | 1–2 semanas |

Ordem obrigatória **1 → 3**: não dá para dizer quem pode publicar antes de existir quem
comprou. Chamar de segurança em vez de funcionalidade **não muda o trabalho**.

**Fora dos dois blocos, nunca orçado** (apareceu só nos mockups, e isso já foi dito a
ele em 11/08): aceite de regras versionado, bloqueio permanente com registro, e o
sistema de bloquear/denunciar com motivos e fila própria.

### A consequência prática que ele não viu

Enquanto o Bloco 1 não existir, **ninguém é Premium** — a regra "só Premium publica"
deixaria a foto desligada para todos. Manter a fila como está é o que segura a
funcionalidade de pé no meio-tempo.

## O que a mensagem faz

Concorda com a direção, discorda com precisão em três pontos (entrada ≠ conteúdo,
denúncia é depois, selo falso), oferece o desenho que resolve o problema real dele
(confiança graduada), protege o alcance do gratuito, e devolve o assunto para os blocos
já orçados sem reabrir preço.

**Não constrói nada.** Nada disso está aprovado.

**FORMATO:** na Workana o Enter ENVIA. Cada parágrafo é UMA linha contínua.

---

Olá Rossandro, concordo com a direção e ela melhora o produto. Colocar a barreira na entrada é a decisão certa, é assim que plataforma séria faz, e é a primeira vez nesta conversa que você propõe uma restrição em vez de uma expansão. Isso é bom sinal de produto.

Mas preciso discordar de você em três pontos, e faço isso justamente porque a sua motivação aqui é proteger criança.

O primeiro. Barreira de entrada e revisão de conteúdo resolvem problemas diferentes. A entrada resolve quem entra. A revisão resolve o que é publicado. Pagar não impede alguém de publicar a foto errada, e o caso mais provável no seu produto nem é o mal-intencionado. É o pai de boa-fé que publica uma foto onde aparece outra criança que não é filha dele, ou o rosto da criança com o uniforme e o nome da escola. Ser Premium não toca nesse caso, e é exatamente esse caso que a fila pega.

O segundo. O argumento da escala não se sustenta contra o seu próprio desenho. A fila não cresce com o número de usuários, cresce com o número de fotos publicadas. Se só quem comprou publica, o universo deixa de ser cem mil pessoas e passa a ser a parte que pagou, e dessa parte só uma fração publica foto. Você não vai ter cem mil fotos para olhar, e se um dia tiver, esse é o problema bom de se ter porque significa receita entrando.

E existe um jeito de a fila diminuir sozinha conforme a plataforma cresce, que é o que eu proponho. Revisar apenas as primeiras publicações de cada conta e, depois de algumas aprovadas, aquela conta passa a publicar direto. Confiança que se ganha, como acontece em qualquer comunidade. Assim a fila fica proporcional às contas novas, não ao tamanho da base, e quem já provou que usa bem não te dá trabalho nenhum. Quando o volume justificar, entra também a triagem automática por software antes da fila, que custa centavos por imagem e só compensa em volume. Hoje seria pagar por um problema que você ainda não tem.

O terceiro ponto é sobre denunciar, e acho importante você saber o que está comprando com essa ideia. Denúncia é revisão depois da publicação. A foto ficou pública, alguém viu, alguém denunciou, e aí alguém precisa olhar. Ela não substitui a revisão antes e, sendo honesto, dá mais trabalho e não menos, porque a denúncia também vira uma fila para alguém tratar. Numa plataforma de crianças, o intervalo entre a foto ser publicada e alguém denunciar é exatamente o risco que você está tentando evitar. Recomendo ter denúncia, inclusive porque na Europa ter um canal de denúncia é praticamente obrigatório para quem hospeda conteúdo de usuário, mas ela é uma obrigação a mais e não uma troca.

Tem ainda uma coisa que eu preciso te dizer com todas as letras, sobre o selo de verificado. Você decidiu, e eu concordei, não fazer verificação por documento por causa do custo, que ficaria entre um dólar e meio e dois dólares por pessoa. Então um selo escrito verificado que na verdade significa apenas comprou está afirmando para o usuário uma coisa que não é verdade. Um pai vê o selo, entende que aquela pessoa foi checada, e baixa a guarda. Num ambiente para crianças, um selo de segurança falso é pior do que nenhum selo. A minha sugestão é chamar de Membro, e guardar a palavra verificado para o dia em que existir verificação de verdade.

Agora a sugestão que junta tudo, e que é a parte que eu mais queria que você considerasse. O membro grátis continua podendo publicar no My Post o conteúdo da própria plataforma com legenda, e só a foto do aparelho exige ser Premium. Assim a restrição fica exatamente onde está o risco. Publicar a música do próprio projeto não tem risco nenhum, e é justamente isso que faz a criança compartilhar e trazer gente nova para dentro, que é o que alimenta os seus números. Bloquear isso do gratuito te custaria alcance sem ganhar segurança.

E tem uma coincidência boa aqui. O sistema que eu entreguei ontem já trata a publicação com foto de forma diferente da publicação sem foto. É a mesma separação que hoje decide o que fica aguardando aprovação, e ela passa a decidir também quem pode publicar. Ou seja, a sua proposta encaixa no que já está construído, sem refazer nada.

Sobre o trabalho, sendo direto com você. O que você descreveu é o Bloco 1 mais o Bloco 3, que eu já te passei em 11 de agosto. O Bloco 1 é a compra pelo checkout que cria o Premium, por mil dólares. O Bloco 3 é a permissão, quem pode o quê, por setecentos. A ordem tem que ser essa, primeiro o 1 e depois o 3, porque não dá para dizer quem pode publicar antes de existir quem comprou. Descrever isso como segurança em vez de funcionalidade não muda o trabalho que precisa ser feito, e prefiro te dizer isso agora do que deixar parecer que mudou de natureza.

Fora desses dois blocos ficam três coisas que apareceram só nos seus mockups e não estão em nenhum orçamento. O aceite de regras registrado com versão, para você conseguir provar depois qual texto a pessoa aceitou e em que dia. O bloqueio permanente de conta com registro de quem bloqueou e por quê. E o sistema de bloquear e denunciar com os motivos e a fila própria. Se você quiser que entrem, eu te passo o valor delas à parte, e prefiro fazer isso separado para você enxergar o custo de cada uma.

Uma consequência prática que vale registrar. Enquanto o Bloco 1 não existir, ninguém é Premium, e a regra só Premium publica deixaria a foto desligada para todo mundo. Então a minha recomendação é manter como está agora, com a fila, que funciona bem no tamanho atual, e trocar a chave no dia em que a compra existir. A estrutura já está preparada para essa troca.

Resumindo a minha posição para você decidir. Concordo em colocar a barreira na entrada. Discordo de tirar a revisão, e proponho que ela deixe de ser para todos e passe a ser só para as primeiras publicações de cada conta, para ela encolher sozinha conforme você cresce. Sugiro manter o gratuito publicando conteúdo da plataforma e exigir Premium só para foto. E recomendo chamar de Membro em vez de verificado enquanto não houver verificação.

Se você concordar com esse desenho, eu detalho o Bloco 1 já com o que muda por causa desta conversa e a gente fecha o escopo antes do valor, exatamente como você propôs.

Bruno
