import Link from 'next/link'
import { ATUALIZADO_EM, RESPONSAVEL } from '@/lib/legal'

export const metadata = {
  title: 'Termos de uso',
  description: 'As regras da comunidade do Jesus Alfabeto Saudável.',
}

/**
 * Termos de uso — as regras da comunidade.
 *
 * As regras aqui são as mesmas que o cliente escreveu em 12/08 e que já
 * aparecem na tela no momento de publicar. Repetir o mesmo texto nos dois
 * lugares é proposital: no aviso, porque é ali que a pessoa está prestes a
 * publicar; aqui, porque é o documento que ela aceitou.
 *
 * Também descrevem o que o administrador pode fazer — apagar conteúdo e
 * bloquear conta —, porque uma regra que prevê punição sem dizer quem aplica e
 * como não serve para nada na hora em que precisa ser usada.
 *
 * O cliente é quem responde por este texto e precisa revisar antes do
 * lançamento.
 */
export default function PaginaTermos() {
  return (
    <main className="envoltorio texto-legal">
      <Link className="voltar" href="/">
        ← Início
      </Link>

      <h1>Termos de uso</h1>
      <p className="subtitulo">Atualizados em {ATUALIZADO_EM}</p>

      <p>
        O {RESPONSAVEL.projeto} é uma comunidade cristã, infantil e familiar. Qualquer pessoa
        é bem-vinda, e ao usar a plataforma você concorda com as regras abaixo. Elas existem
        para proteger as crianças que estão aqui.
      </p>

      <h2>Quem pode usar</h2>
      <ul>
        <li>Ver e ouvir o conteúdo público não exige conta nenhuma.</li>
        <li>
          Para curtir, comentar, compartilhar ou publicar, é preciso criar uma conta, e ela
          deve pertencer ao <strong>adulto responsável</strong>.
        </li>
        <li>Use o seu nome verdadeiro. Contas falsas podem ser bloqueadas.</li>
      </ul>

      <h2>As regras da comunidade</h2>
      <ul>
        <li>
          A publicação deve permanecer dentro do propósito do {RESPONSAVEL.projeto}.
        </li>
        <li>
          Evite mostrar endereço, escola ou localização da criança. Isso vale tanto para
          fotos quanto para textos.
        </li>
        <li>
          Não publique fotos de crianças que não estejam sob a sua responsabilidade sem a
          autorização de quem responde por elas.
        </li>
        <li>
          Conteúdo imoral, ofensivo, violento, de ódio, ou incompatível com uma comunidade
          infantil e familiar não é permitido.
        </li>
        <li>Não use a plataforma para vender, divulgar ou fazer propaganda.</li>
        <li>Trate as outras famílias como você gostaria que tratassem a sua.</li>
      </ul>

      <h2>O que acontece quando alguém quebra as regras</h2>
      <p>
        O responsável pela plataforma pode apagar qualquer conteúdo que não respeite estas
        regras e bloquear a conta de quem as violar. Em casos graves, o bloqueio é permanente.
        Conteúdo apagado deixa de aparecer para todos.
      </p>
      <p>
        Se você vir algo que não deveria estar aqui, escreva para{' '}
        <a href={`mailto:${RESPONSAVEL.email}`}>{RESPONSAVEL.email}</a>. Levamos a sério,
        principalmente quando envolve uma criança.
      </p>

      <h2>O que você publica</h2>
      <p>
        O que você publica continua sendo seu. Ao publicar, você nos autoriza a exibir aquele
        conteúdo dentro da plataforma. Você pode apagar as suas publicações quando quiser.
      </p>

      <h2>O conteúdo da plataforma</h2>
      <p>
        As músicas, os textos, as imagens e os materiais do {RESPONSAVEL.projeto} são de
        propriedade de {RESPONSAVEL.nome}. Você pode usá-los com a sua família e compartilhar
        os links, mas não pode revendê-los nem redistribuí-los como se fossem seus.
      </p>

      <h2>Disponibilidade</h2>
      <p>
        Fazemos o possível para manter tudo funcionando, mas a plataforma é oferecida como
        está, e pode ficar fora do ar em manutenções ou por problemas fora do nosso controle.
      </p>

      <h2>Mudanças</h2>
      <p>
        Estes termos podem mudar. Quando mudarem de forma relevante, avisamos na própria
        plataforma.
      </p>

      <p className="nota">
        <Link href="/privacidade">Ver também a política de privacidade</Link>
      </p>
    </main>
  )
}
