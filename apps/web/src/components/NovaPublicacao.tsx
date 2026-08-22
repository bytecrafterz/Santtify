'use client'

import { useState } from 'react'
import { admin } from '@/lib/admin'

/**
 * "Novo conteúdo" numa tela só.
 *
 * O painel era construído por blocos: o título num sítio, a imagem noutro, o
 * áudio noutro ainda, e cada um criado à mão. Era flexível e estava errado
 * para quem o usa — o cliente foi publicar uma introdução e não encontrou onde
 * pôr o áudio, porque o bloco de áudio ainda não existia.
 *
 * Aqui uma publicação é uma coisa só: posição, título, texto, imagem e áudio,
 * gravados juntos. Os blocos continuam a existir por baixo, porque é o que
 * permite uma letra ter quatro áudios; o que muda é que ninguém precisa de
 * saber disso para publicar.
 *
 * Duas entradas de imagem, e não uma, porque no iPhone o mesmo botão não abre
 * as duas origens: quem guarda os cartões nas Fotos nunca chega aos Ficheiros,
 * e vice-versa.
 */
export function NovaPublicacao({
  projectSlug,
  totalExistente,
  aoTerminar,
  aoCancelar,
}: {
  projectSlug: string
  totalExistente: number
  aoTerminar: () => void
  aoCancelar: () => void
}) {
  const [posicao, definirPosicao] = useState(totalExistente + 1)
  const [titulo, definirTitulo] = useState('')
  const [texto, definirTexto] = useState('')
  const [imagem, definirImagem] = useState<File | null>(null)
  const [previaImagem, definirPreviaImagem] = useState<string | null>(null)
  const [audio, definirAudio] = useState<File | null>(null)
  const [estado, definirEstado] = useState<'rascunho' | 'a-publicar' | 'publicado'>('rascunho')
  const [previa, definirPrevia] = useState(false)
  const [previaAudio, definirPreviaAudio] = useState<string | null>(null)
  const [erro, definirErro] = useState<string | null>(null)

  /**
   * A pré-visualização mostra a publicação com os ficheiros que ainda estão no
   * telemóvel, sem os enviar.
   *
   * É por isso que ela existe: ver antes de publicar só serve se for antes
   * mesmo. Se fosse preciso publicar para ver, a pessoa acabava a publicar
   * coisas erradas para as corrigir a seguir — e cada correcção dessas fica
   * visível a quem estiver a ver naquele momento.
   */
  function abrirPrevia() {
    if (audio) {
      if (previaAudio) URL.revokeObjectURL(previaAudio)
      definirPreviaAudio(URL.createObjectURL(audio))
    }
    definirPrevia(true)
  }

  function escolherImagem(f: File | null) {
    definirImagem(f)
    if (previaImagem) URL.revokeObjectURL(previaImagem)
    definirPreviaImagem(f ? URL.createObjectURL(f) : null)
  }

  function enderecoAPartirDoTitulo(t: string) {
    return t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
  }

  async function publicar() {
    if (!titulo.trim()) {
      definirErro('Escreva um título.')
      return
    }
    definirErro(null)
    definirEstado('a-publicar')

    try {
      // A ordem importa: primeiro a publicação existe, depois recebe as peças,
      // e só no fim fica visível. Publicar antes de a imagem subir mostraria
      // uma publicação pela metade a quem estivesse a ver naquele instante.
      const criado = await admin.criarConteudo(projectSlug, {
        slug: enderecoAPartirDoTitulo(titulo) || `conteudo-${Date.now()}`,
        title: titulo.trim(),
        position: posicao,
      })

      if (imagem) await admin.definirCapaComArquivo(criado.id, imagem)
      if (texto.trim()) await admin.criarBlocoDeTexto(criado.id, texto.trim())
      if (audio) await admin.criarBlocoDeAudio(criado.id, audio)

      await admin.publicar(criado.id, true)
      definirEstado('publicado')
      aoTerminar()
    } catch (e) {
      definirEstado('rascunho')
      definirErro(e instanceof Error ? e.message : 'Não foi possível publicar.')
    }
  }

  return (
    <div className="publicacao-nova">
      <div className="cabecalho-publicacao">
        <button type="button" className="voltar-publicacao" onClick={aoCancelar} aria-label="Voltar">
          ←
        </button>
        <h1>Novo conteúdo</h1>
      </div>

      <label className="campo">
        Posição na sequência
        <div className="linha-posicao">
          <input
            type="number"
            min={1}
            max={totalExistente + 1}
            value={posicao}
            onChange={(e) => definirPosicao(Math.max(1, Number(e.target.value) || 1))}
          />
          <small>Os outros conteúdos serão reorganizados automaticamente.</small>
        </div>
      </label>

      <label className="campo">
        Título
        <input
          type="text"
          maxLength={160}
          placeholder="Introdução"
          value={titulo}
          onChange={(e) => definirTitulo(e.target.value)}
        />
      </label>

      <label className="campo">
        Texto
        <textarea
          rows={4}
          placeholder="Bem-vindo ao Jesus Alfabeto Saudável..."
          value={texto}
          onChange={(e) => definirTexto(e.target.value)}
        />
      </label>

      <div className="campo">
        <span className="rotulo">Imagem</span>
        <div className="linha-imagem">
          <div className="previa-publicacao">
            {previaImagem ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previaImagem} alt="Pré-visualização da imagem" />
            ) : (
              <span className="nota">Sem imagem</span>
            )}
          </div>

          <div className="botoes-imagem">
            <label className="botao-escolher">
              🖼 Escolher das Fotos
              <input
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.heic,.webp"
                hidden
                onChange={(e) => escolherImagem(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="botao-escolher">
              📁 Escolher dos Ficheiros
              <input
                type="file"
                hidden
                onChange={(e) => escolherImagem(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="campo">
        <span className="rotulo">Áudio</span>
        <label className="botao-escolher largo">
          🎵 {audio ? audio.name : 'Escolher ficheiro'}
          <input
            type="file"
            /* Sem filtro de propósito: no iPhone, um ficheiro descarregado
               aparece a cinzento mesmo com a extensão listada, porque o sistema
               não lhe reconhece o tipo. Filtrar aqui é apostar contra o
               telemóvel. O servidor valida e explica se não servir. */
            hidden
            onChange={(e) => definirAudio(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <button
        type="button"
        className="botao-previsualizar"
        disabled={!titulo.trim()}
        onClick={abrirPrevia}
      >
        👁 Pré-visualizar
      </button>

      {previa && (
        <div className="fundo-modal" role="dialog" aria-modal="true" aria-label="Pré-visualização">
          <button
            type="button"
            className="fundo-clicavel"
            aria-label="Fechar"
            onClick={() => definirPrevia(false)}
          />
          <div className="folha-denuncia">
            <header>
              <div>
                <h2>Pré-visualização</h2>
                <p className="nota">É assim que a publicação vai aparecer.</p>
              </div>
              <button
                type="button"
                className="fechar-x"
                aria-label="Fechar"
                onClick={() => definirPrevia(false)}
              >
                ✕
              </button>
            </header>

            {previaImagem && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="arte-letra" src={previaImagem} alt={titulo} />
            )}
            <h3>{titulo}</h3>
            {texto.trim() && <p className="bloco-texto">{texto}</p>}
            {previaAudio && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio controls preload="metadata" src={previaAudio} style={{ width: '100%' }} />
            )}
            {!previaImagem && !texto.trim() && !previaAudio && (
              <p className="nota">Ainda não há imagem, texto nem áudio para mostrar.</p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className={estado === 'publicado' ? 'botao-publicar publicado' : 'botao-publicar'}
        onClick={publicar}
        disabled={estado !== 'rascunho'}
      >
        {estado === 'a-publicar' ? 'A publicar...' : estado === 'publicado' ? '✓ Publicado' : 'Publicar'}
      </button>
    </div>
  )
}
