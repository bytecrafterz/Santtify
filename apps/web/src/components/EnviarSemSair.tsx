'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/**
 * ENVIAR UM FICHEIRO DO PAINEL SEM SAIR DA PÁGINA (10/10).
 *
 * "O QR Code está sendo gerado corretamente, mas há um problema: quando envio
 * para o designer, fico preso na visualização do arquivo e não consigo voltar
 * à plataforma." Mandou a fotografia: o ecrã preto do iOS com "qr-… .png",
 * "Open in Preview" e "More…", e mais nada.
 *
 * É o mesmo defeito que o BAIXAR PDF do cartão tinha em 08/2026 (ver
 * `VistaDoCartao`): na aplicação instalada no iPhone o atributo `download` é
 * ignorado e o link NAVEGA para o ficheiro, na mesma janela, onde não há barra
 * do navegador nem seta para trás. Os botões do QR eram links desses.
 *
 * Num telemóvel o botão abre agora uma folha POR CIMA da página: o ficheiro,
 * "Enviar ou guardar" — a folha de partilha do sistema, com WhatsApp, e-mail,
 * Guardar imagem, Guardar em Ficheiros e Imprimir — e "Voltar à plataforma".
 * A página por baixo nunca sai do sítio, e por isso nada do que estava a ser
 * feito se perde. Enviado, a folha fecha sozinha e ele está onde estava.
 *
 * O ficheiro é buscado quando a folha abre, e não quando se toca em Enviar:
 * o iOS só deixa abrir a partilha dentro do toque, e uma busca pelo meio, em
 * dados móveis, gasta-o (a mesma lição de `VistaDoCartao`).
 *
 * No computador continua a ser o link de sempre: lá descarregar não prende
 * ninguém, e um passo a mais só atrasava.
 */
export function BotaoDeEnviar({
  url,
  nome,
  tipo,
  titulo,
  previa,
  dica,
  abrirNoComputador = false,
  className,
  children,
}: {
  /** O endereço do ficheiro. */
  url: string
  /** O nome com que o ficheiro chega a quem o recebe, com a extensão. */
  nome: string
  /** O tipo do ficheiro (`image/png`, `application/pdf`…). */
  tipo: string
  /** O título da folha: o que está a ser enviado. */
  titulo: string
  /** Uma imagem para mostrar na folha. Sem ela, mostra-se o tipo do ficheiro. */
  previa?: string
  /** Uma linha a dizer o que escolher na lista do sistema. */
  dica?: string
  /** No computador, abrir noutro separador em vez de descarregar (o IMPRIMIR). */
  abrirNoComputador?: boolean
  className?: string
  children: ReactNode
}) {
  const [aberta, definirAberta] = useState(false)
  const [feito, definirFeito] = useState<string | null>(null)

  useEffect(() => {
    if (!feito) return
    const t = setTimeout(() => definirFeito(null), 3500)
    return () => clearTimeout(t)
  }, [feito])

  return (
    <>
      <a
        className={className}
        href={url}
        {...(abrirNoComputador ? { target: '_blank', rel: 'noopener noreferrer' } : { download: nome })}
        onClick={(ev) => {
          if (!eTelemovel()) return
          ev.preventDefault()
          definirFeito(null)
          definirAberta(true)
        }}
      >
        {children}
      </a>
      {aberta && (
        <FolhaDeEnvio
          url={url}
          nome={nome}
          tipo={tipo}
          titulo={titulo}
          previa={previa}
          dica={dica}
          aoFechar={() => definirAberta(false)}
          aoEnviar={(mensagem) => {
            definirAberta(false)
            definirFeito(mensagem)
          }}
        />
      )}
      {feito && (
        <p className="dp-feito" role="status">
          {feito}
        </p>
      )}
    </>
  )
}

/**
 * Telemóvel ou aplicação instalada: onde um link para um ficheiro pode
 * deixar a pessoa sem saída. Lido no toque, e não no desenho, para o servidor
 * e o navegador desenharem o mesmo link.
 */
function eTelemovel(): boolean {
  if (typeof window === 'undefined') return false
  const instalada =
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone) ||
    window.matchMedia?.('(display-mode: standalone)').matches
  return Boolean(instalada || window.matchMedia?.('(pointer: coarse)').matches)
}

function FolhaDeEnvio({
  url,
  nome,
  tipo,
  titulo,
  previa,
  dica,
  aoFechar,
  aoEnviar,
}: {
  url: string
  nome: string
  tipo: string
  titulo: string
  previa?: string
  dica?: string
  aoFechar: () => void
  aoEnviar: (mensagem: string) => void
}) {
  const idDoTitulo = useId()
  const ficheiro = useRef<File | null>(null)
  const [estado, definirEstado] = useState<'a-preparar' | 'pronto' | 'falhou'>('a-preparar')
  const [aEnviar, definirAEnviar] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const resposta = await fetch(url)
        if (!resposta.ok) throw new Error('sem ficheiro')
        const blob = await resposta.blob()
        if (!vivo) return
        ficheiro.current = new File([blob], nome, { type: tipo })
        definirEstado('pronto')
      } catch {
        if (vivo) definirEstado('falhou')
      }
    })()
    return () => {
      vivo = false
    }
  }, [url, nome, tipo])

  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => ev.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoFechar])

  async function enviar() {
    const f = ficheiro.current
    if (!f) return
    definirErro(null)
    if (navigator.canShare?.({ files: [f] })) {
      definirAEnviar(true)
      try {
        await navigator.share({ files: [f], title: titulo })
        aoEnviar('Pronto. Você continua onde estava.')
        return
      } catch (e) {
        // Fechar a lista do sistema sem escolher nada não é um erro: fica-se aqui.
        if (e instanceof Error && e.name === 'AbortError') return
      } finally {
        definirAEnviar(false)
      }
    }
    /*
      Sem partilha de ficheiros. Fora da aplicação instalada, descarrega-se um
      endereço feito aqui, que não leva a página a lado nenhum. Dentro dela
      isso voltava a prender, e o que resta é a imagem, que se guarda com o
      dedo.
    */
    const instalada = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    if (!instalada) {
      const local = URL.createObjectURL(f)
      const a = document.createElement('a')
      a.href = local
      a.download = nome
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(local), 10_000)
      aoEnviar(`Guardado: ${nome}`)
      return
    }
    definirErro(
      previa
        ? 'Este aparelho não deixou enviar daqui. Toque e segure no QR acima e escolha Guardar ou Compartilhar.'
        : 'Este aparelho não deixou enviar daqui. Abra o painel no computador para baixar o arquivo.',
    )
  }

  const extensao = nome.split('.').pop()?.toUpperCase() ?? ''

  return (
    <div className="dp-fundo" role="presentation" onClick={() => !aEnviar && aoFechar()}>
      <div
        className="dp-caixa fe-caixa"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDoTitulo}
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 id={idDoTitulo}>{titulo}</h2>
        {previa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="fe-previa" src={previa} alt={titulo} />
        ) : (
          <span className="fe-icone" aria-hidden>
            {extensao}
          </span>
        )}
        <p className="fe-nome">{nome}</p>
        {dica && <p className="dp-nota">{dica}</p>}
        {estado === 'falhou' && (
          <p className="erro">Não foi possível preparar o arquivo. Verifique a internet e abra de novo.</p>
        )}
        {erro && <p className="erro">{erro}</p>}
        <div className="fe-accoes">
          <button
            type="button"
            className="botao-acao"
            disabled={estado !== 'pronto' || aEnviar}
            onClick={() => void enviar()}
          >
            {estado === 'a-preparar' ? 'Preparando…' : '📤 Enviar ou guardar'}
          </button>
          <button type="button" className="secundario" onClick={aoFechar}>
            ← Voltar à plataforma
          </button>
        </div>
      </div>
    </div>
  )
}
