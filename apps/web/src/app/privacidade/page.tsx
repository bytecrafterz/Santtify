import Link from 'next/link'
import { ATUALIZADO_EM, RESPONSAVEL, RETENCAO_EVENTOS_DIAS, VERSAO_DA_POLITICA } from '@/lib/legal'
import { Voltar } from '@/components/Voltar'

export const metadata = {
  title: 'Política de privacidade',
  description:
    'O que o Jesus Alfabeto Saudável guarda, por quanto tempo, e como pedir para apagar.',
}

/**
 * Política de privacidade.
 *
 * Escrita a partir do que o sistema REALMENTE faz, campo por campo, e não de um
 * modelo genérico. Cada afirmação aqui corresponde a código: o IP é truncado e
 * transformado em hash irreversível, o consentimento é gravado com versão, o
 * prazo de retenção é o mesmo do servidor.
 *
 * Está em linguagem de mãe e pai, não de advogado, porque quem lê é a família
 * decidindo se deixa a criança usar. Texto que ninguém entende não é
 * transparência, é formalidade.
 *
 * O cliente é o responsável legal pelos dados e precisa revisar e ajustar antes
 * do lançamento — principalmente os dados de contato em `lib/legal.ts`.
 */
export default function PaginaPrivacidade() {
  return (
    <main className="envoltorio texto-legal">
      <Voltar href="/">Início</Voltar>

      <h1>Política de privacidade</h1>
      <p className="subtitulo">
        Versão {VERSAO_DA_POLITICA} · Atualizada em {ATUALIZADO_EM}
      </p>

      <p>
        Esta página explica, sem rodeios, o que o {RESPONSAVEL.projeto} guarda sobre quem visita o
        site, para que serve, por quanto tempo fica guardado e como pedir para apagar. Como esta é
        uma plataforma usada por famílias e crianças, procuramos guardar o mínimo necessário.
      </p>

      <h2>Quem é o responsável</h2>
      <p>
        {RESPONSAVEL.nome}, responsável pelo {RESPONSAVEL.projeto}, em {RESPONSAVEL.pais}. Para
        qualquer pedido relacionado aos seus dados, escreva para{' '}
        <a href={`mailto:${RESPONSAVEL.email}`}>{RESPONSAVEL.email}</a>.
      </p>

      <h2>O que guardamos de quem só visita, sem criar conta</h2>
      <p>
        Quando alguém abre uma página, guardamos um registro da visita para entender como as pessoas
        chegam até aqui e quais conteúdos funcionam melhor. Esse registro contém:
      </p>
      <ul>
        <li>
          <strong>Um código aleatório do navegador.</strong> Fica guardado num cookie chamado
          <code> pv_anon</code>, por um ano. Ele não tem o seu nome nem o seu e-mail: serve só para
          saber que foi a mesma pessoa que voltou.
        </li>
        <li>
          <strong>De onde você veio.</strong> Se chegou por um QR Code, por um link compartilhado,
          por uma rede social ou digitando o endereço.
        </li>
        <li>
          <strong>Qual página abriu e quando</strong>, e o que fez ali: ouvir uma música, curtir,
          comentar, compartilhar.
        </li>
        <li>
          <strong>O tipo de aparelho</strong> (celular, computador) e o <strong>país</strong>, mais
          a <strong>região e a cidade aproximadas</strong>. Essa localização é deduzida do endereço
          de internet numa base de dados que fica no nosso próprio servidor: o endereço não é
          enviado a ninguém para isso. É aproximada de verdade — num celular usando dados móveis, o
          que sai é onde fica o equipamento da operadora, que pode estar a dezenas de quilómetros de
          você. <strong>Não guardamos coordenadas</strong> e nunca pedimos a localização do seu
          aparelho.
        </li>
        <li>
          <strong>Uma marca do endereço de internet, que não permite voltar ao original.</strong>{' '}
          Antes de guardar, o endereço é cortado — apagamos a parte final, que é a que identificaria
          o aparelho — e o que sobra é transformado por um cálculo de mão única. Nunca guardamos o
          endereço de internet completo.
        </li>
      </ul>

      <p className="nota">
        A base de localização usada é a DB-IP Lite, de{' '}
        <a href="https://db-ip.com" rel="noreferrer noopener" target="_blank">
          db-ip.com
        </a>
        , distribuída sob a licença Creative Commons Attribution 4.0.
      </p>

      <h2>O que guardamos de quem cria uma conta</h2>
      <ul>
        <li>Nome de exibição e e-mail.</li>
        <li>
          A senha, guardada de forma embaralhada e irreversível. Nem nós conseguimos ler a sua
          senha.
        </li>
        <li>O que você publicou, comentou, curtiu e compartilhou na plataforma.</li>
      </ul>

      <h2>O que NÃO fazemos</h2>
      <ul>
        <li>Não vendemos nem cedemos os seus dados a terceiros.</li>
        <li>Não usamos os dados para publicidade e não montamos perfis para anunciantes.</li>
        <li>Não guardamos endereço de internet completo.</li>
        <li>Não pedimos, nem guardamos, documentos de identidade.</li>
        <li>Não temos acesso a nenhuma conversa privada sua em nenhum aplicativo.</li>
      </ul>

      <h2>Sobre compartilhar um conteúdo</h2>
      <p>
        Quando você usa o botão de compartilhar, criamos um link próprio para aquele
        compartilhamento. Ele nos permite saber quantas pessoas chegaram por ali. Isso não nos dá
        acesso nenhum à sua conversa: nós só vemos que alguém abriu aquele link.
      </p>

      <h2>Consentimento</h2>
      <p>
        Na primeira visita você escolhe entre <strong>Aceitar</strong> e{' '}
        <strong>Só o essencial</strong>. Escolher só o essencial mantém o site funcionando e limita
        o registro ao mínimo necessário para ele funcionar. Guardamos a sua escolha, com a data e a
        versão desta política, para conseguir demonstrar o que foi aceito e quando. Você pode mudar
        de ideia a qualquer momento escrevendo para o e-mail acima.
      </p>

      <h2>Por quanto tempo guardamos</h2>
      <p>
        Os registros de visita e de atividade ficam por até {RETENCAO_EVENTOS_DIAS} dias (cerca de
        três anos). Os dados da sua conta ficam enquanto a conta existir.
      </p>

      <h2>Crianças</h2>
      <p>
        A conta é do adulto responsável. Este site foi feito para a família usar junto, e pedimos
        que o cadastro e as publicações sejam sempre feitos por um adulto. Se você é responsável por
        uma criança e acredita que existe algum conteúdo ou dado dela aqui que não deveria estar,
        escreva para o e-mail acima e retiramos.
      </p>

      <h2>Os seus direitos</h2>
      <p>
        Você pode pedir para ver os dados que temos sobre você, corrigi-los, ou pedir que sejam
        apagados. Um aviso honesto sobre apagar: os registros de visita não guardam o seu nome,
        então o que fazemos é desligar o vínculo entre esses registros e você, de modo que deixem de
        ser identificáveis. Os totais gerais continuam existindo, mas sem nenhuma ligação com a sua
        pessoa.
      </p>
      <p>
        <strong>Apagar a conta você mesmo, sem pedir a ninguém.</strong> No seu perfil há a opção
        EXCLUIR MINHA CONTA. Ao confirmar com a sua senha, o seu nome, a sua foto, o seu e-mail e o
        nome do responsável são apagados na hora, o perfil deixa de existir para as outras pessoas e
        os seus comentários e curtidas deixam de aparecer. Não tem volta.
      </p>
      <p>
        Para qualquer um desses pedidos, escreva para{' '}
        <a href={`mailto:${RESPONSAVEL.email}`}>{RESPONSAVEL.email}</a>. Se você estiver na Europa e
        não ficar satisfeito com a resposta, tem o direito de reclamar à autoridade de proteção de
        dados do seu país.
      </p>

      <h2>Mudanças nesta política</h2>
      <p>
        Se mudarmos algo relevante, publicamos aqui com uma nova versão e uma nova data, e pedimos o
        consentimento outra vez quando a mudança exigir.
      </p>

      <p className="nota">
        <Link href="/termos">Ver também os termos de uso</Link>
      </p>
    </main>
  )
}
