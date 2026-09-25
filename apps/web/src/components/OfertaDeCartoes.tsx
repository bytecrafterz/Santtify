import Link from 'next/link'
import { VozDaOferta } from './VozDaOferta'
import { VistaDaOferta } from './VistaDaOferta'
import { IndicadoresDaPublicacao } from './IndicadoresDaPublicacao'

/**
 * A OFERTA DOS CARTÕES, POR BAIXO DOS DIAS.
 *
 * Ele descreveu-a em 24/09, e a ordem das frases é o desenho todo: "abaixo
 * viria esta arte", "quanto clica ja aparece o cartao para editar", "editou
 * finalizou ai vem o pagamento", "aprovou a foto com boa qualidade".
 *
 * Meia hora depois travou a porta: "Nao pode ser funcional agora", "Este e
 * provisório em breve" — o designer entrega a arte definitiva no dia seguinte.
 * Daí `emBreve`: a arte fica de pé, o editor não abre, e o dia de abrir é uma
 * chave no painel dele e não uma publicação minha.
 *
 * O CARTAZ É DADO, E NÃO CÓDIGO. É a `capaUrl` da categoria, tal como o áudio é
 * a `ofertaAudioUrl` e o preço é o da categoria. Trocar a arte provisória pela
 * definitiva amanhã não me envolve.
 *
 * SEM CARTAZ, NÃO HÁ BLOCO. Uma categoria sem arte não vira um retângulo vazio:
 * desaparece, e a página de um projeto que não vende cartões fica como estava.
 */
export function OfertaDeCartoes({
  projectSlug,
  projectId,
  categorias,
}: {
  projectSlug: string
  projectId: string
  categorias: Array<{
    slug: string
    nome: string
    descricao: string | null
    capaUrl: string | null
    emBreve: boolean
    audioUrl: string | null
  }>
}) {
  const comCartaz = categorias.filter((c) => c.capaUrl)
  if (comCartaz.length === 0) return null

  return (
    <section className="oferta-cartoes" aria-label="Cartões personalizados">
      {comCartaz.map((c) => {
        /*
          A ARTE É O BOTÃO — sem título por cima, sem botão por baixo, sem caixa
          à volta. O cartaz dele já tem tudo isso desenhado dentro, incluindo o
          preço riscado e o "PERSONALIZAR MEUS 7 CARTÕES" no fundo. Repetir
          qualquer uma dessas coisas em HTML seria dizê-la duas vezes e deixar as
          duas a discordar no dia em que ele trocar a arte.

          "Faça que o cartao fique grande", disse ele, e o cartaz sai das margens
          da página: é a peça mais larga do ecrã, para os sete cartões lá dentro
          se distinguirem. Ver `.oferta-cartaz` no globals.css.
        */
        const arte = <img src={c.capaUrl as string} alt="" className="oferta-arte" />

        return (
          <div key={c.slug} className="oferta-item">
            {c.emBreve ? (
              /*
                EM BREVE NÃO É UM LINK DESACTIVADO — é uma imagem.

                Um `<a>` com `aria-disabled` continua a ser anunciado como
                ligação e continua a apanhar o foco do teclado: prometia uma
                porta a quem não a pode abrir. O cartaz dele já diz "EM BREVE"
                em letras de um palmo; o HTML só tem de não o desmentir.
              */
              <div className="oferta-cartaz em-breve">{arte}</div>
            ) : (
              <Link
                href={`/${projectSlug}/cartoes?categoria=${encodeURIComponent(c.slug)}`}
                className="oferta-cartaz"
                aria-label={`Personalizar os cartões — ${c.nome}`}
              >
                {arte}
              </Link>
            )}

            {c.audioUrl && (
              <VozDaOferta src={c.audioUrl} titulo={`Sobre os cartões — ${c.nome}`} />
            )}

            {/*
              O CARTAZ É UMA PUBLICAÇÃO: ver, curtir, comentar, partilhar.

              "Têm que ter esta funções view like comentário compartilhamento" —
              25/09.

              É o MESMO componente que desenha os quatro números de uma faixa, de
              um conteúdo e de um perfil. O próprio ficheiro dele conta o que
              acontece quando se desenham noutro sítio: nascem `<span>` que
              parecem botões e não fazem nada, e já aconteceu três vezes.

              A vista conta-se quando o cartaz entra no ecrã, e não quando a
              página abre — ver `VistaDaOferta`.
            */}
            <VistaDaOferta projectSlug={projectSlug} categoria={c.slug} />
            <IndicadoresDaPublicacao
              alvo={{ tipo: 'oferta', projectSlug, categoria: c.slug }}
              projectId={projectId}
              projectSlug={projectSlug}
              titulo={`${c.nome} — 7 cartões personalizados`}
              ligacao={`/${projectSlug}`}
            />

            {/*
              O MERCADO PAGO DITO POR EXTENSO.

              "Deixa bem claro que estamos usado mercado pago para mostrar
              credibilidade" — 24/09, e ele tem razão sobre o que isto resolve:
              quem vê um cartaz de cartões de criança numa plataforma que não
              conhece pergunta-se para onde vai o dinheiro. O nome de quem
              processa o pagamento é a resposta, e vale mais antes do clique do
              que na página de pagar.

              Fica também quando está "em breve": é informação sobre a compra
              que aí vem, e não uma promessa de que já se pode comprar.
            */}
            {/*
              O TEXTO VAI DENTRO DE UM `<span>`, e não solto.

              `.oferta-selo` é um flex de duas colunas — cadeado e frase. Solto,
              cada pedaço de texto e o `<strong>` viravam itens de flex próprios,
              e a frase saía repartida por três colunas estreitas.
            */}
            <p className="oferta-selo">
              <span className="oferta-selo-cadeado" aria-hidden="true">
                🔒
              </span>
              <span>
                Pagamento processado pelo <strong>Mercado&nbsp;Pago</strong> — Pix ou
                cartão. Os seus dados não passam por nós.
              </span>
            </p>
          </div>
        )
      })}
    </section>
  )
}
