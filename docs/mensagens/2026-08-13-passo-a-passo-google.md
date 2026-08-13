# Passo a passo para o cliente criar o acesso do Google

**Por que é ele quem faz:** o consentimento do Google mostra o nome do aplicativo **dele**
para cada família ("Continuar para Jesus Alfabeto Saudável"). Quem é dono do projeto no
Google é dono dessa identidade — mesmo princípio da hospedagem estar na conta dele.

**Bloqueio:** o endereço de redirecionamento contém o domínio. Sem domínio decidido, não
dá para concluir. **A mesma decisão destrava três coisas: QR Codes, publicação e login.**

## As duas armadilhas que arruínam o lançamento

1. **Deixar a tela de consentimento em "Testing".** Nesse modo só entram até 100 contas
   listadas à mão; qualquer outra família é recusada. Como só pedimos escopos básicos
   (e-mail e perfil), **publicar não exige revisão do Google** — é um clique.
2. **Errar o endereço de redirecionamento.** Tem de bater caractere por caractere, com
   `https`, sem barra no fim.

## O que o Bruno precisa receber

| | |
|---|---|
| **Client ID** | público, pode vir pelo chat |
| **Client Secret** | é uma senha — se vazar, pode ser trocada no mesmo painel |

## Texto para enviar a ele

**FORMATO:** na Workana o Enter ENVIA. Cada parágrafo é UMA linha contínua.

---

Olá Rossandro, segue o passo a passo do login com Google. São uns quinze minutos e é tudo gratuito. Faça com calma, e se travar em algum ponto me manda um print que eu te destravo.

Antes de começar, uma coisa precisa estar decidida: o domínio. O endereço do site entra dentro dessa configuração, então faça isto depois de me dizer qual domínio vamos usar. Se fizer antes, vai ter que refazer.

Primeiro passo. Entre em console.cloud.google.com com a conta Google que você quer que seja a dona do aplicativo. Use uma conta sua que não vá se perder, porque é ela que vai controlar o login de todo mundo.

Segundo passo. No topo da tela tem um seletor de projeto. Clique nele e escolha Novo projeto. No nome escreva Jesus Alfabeto Saudável e crie. Espere uns segundos até ele aparecer selecionado no topo.

Terceiro passo. No menu da esquerda procure APIs e serviços, e dentro dele Tela de permissão OAuth. Escolha o tipo Externo e continue. Aqui você vai preencher o que a família vai ver quando clicar em entrar com Google.

No nome do aplicativo escreva Jesus Alfabeto Saudável. No e-mail de suporte e no e-mail do desenvolvedor coloque o seu. No campo de domínio autorizado coloque o nosso domínio, sem o https e sem barra. E tem dois campos de link, um para a política de privacidade e outro para os termos de uso: eu já criei as duas páginas, então elas vão ser o nosso domínio barra privacidade e o nosso domínio barra termos. Assim que o site estiver no ar eu te passo os dois endereços exatos para você colar.

Quarto passo, e este é o mais importante de todos. Depois de salvar, o Google deixa o seu aplicativo num modo chamado Teste. Nesse modo, só as pessoas que você cadastrar uma a uma conseguem entrar, no máximo cem. Se ficar assim, nenhuma família vai conseguir usar o login. Então procure o botão Publicar aplicativo e publique. Como nós só pedimos o nome e o e-mail da pessoa, e nada mais, o Google não exige nenhuma análise nem documento para publicar. É só confirmar.

Quinto passo. Ainda em APIs e serviços, vá em Credenciais, clique em Criar credenciais e escolha ID do cliente OAuth. No tipo de aplicativo escolha Aplicativo da Web. Dê o nome que quiser, por exemplo Site.

Nesse mesmo formulário tem dois campos que precisam ser preenchidos com atenção, e eu te mando os valores exatos para copiar e colar assim que o domínio estiver definido. Um é origens JavaScript autorizadas, que recebe o endereço do site. O outro é URIs de redirecionamento autorizados, que recebe o endereço do site seguido de barra api barra auth barra google barra callback. Esse segundo precisa estar idêntico, sem espaço e sem barra no final, senão o Google recusa o login com uma mensagem de erro.

Sexto passo. Ao salvar, o Google mostra dois códigos numa janela: o Client ID e o Client Secret. Copie os dois e me envie. O Client ID é público e não tem problema nenhum. O Client Secret é como uma senha, então guarde uma cópia num lugar seguro seu também. Se algum dia você achar que ele vazou, dá para gerar outro nesse mesmo painel em dois cliques, e eu só troco no servidor.

Recebendo esses dois códigos, eu ligo o login com Google e te aviso para testar.

Uma última coisa, para você ficar tranquilo: esse cadastro no Google não te cobra nada e não tem mensalidade. O que tem custo anual é só o da Apple, aqueles noventa e nove dólares, e esse a gente deixou para depois.

Bruno
