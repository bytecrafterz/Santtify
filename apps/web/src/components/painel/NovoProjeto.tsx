'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { admin, painelDeCartoes } from '@/lib/admin'
import { ErroDeApi } from '@/lib/auth'
import { IconeDoPainel } from './IconesDoPainel'

/** O endereço sai do nome: sem acentos, minúsculas, hífenes. */
function enderecoDoNome(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * + NOVO PROJETO, numa página só dele.
 *
 * Era um formulário no fundo de "Projetos da página inicial", e ele não o
 * encontrou (03/10). Agora o caminho é o que ele escreveu:
 * PAINEL → PROJETOS → + NOVO PROJETO.
 *
 * O projeto nasce em rascunho — escondido da página inicial — e a seguir abre a
 * administração dele, que é onde se continua.
 */
export function NovoProjeto() {
  const router = useRouter()
  const [nome, definirNome] = useState('')
  const [descricao, definirDescricao] = useState('')
  const [imagem, definirImagem] = useState<File | null>(null)
  const [previa, definirPrevia] = useState<string | null>(null)
  const [blocos, definirBlocos] = useState(7)
  const [unidade, definirUnidade] = useState('Dia')
  const [primeiro, definirPrimeiro] = useState(1)
  const [ocupado, definirOcupado] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  useEffect(() => {
    if (!imagem) return definirPrevia(null)
    const url = URL.createObjectURL(imagem)
    definirPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [imagem])

  const slug = enderecoDoNome(nome)
  const nomeDoBloco = unidade.trim() || 'Bloco'
  const valido = Boolean(slug) && Number.isInteger(blocos) && blocos >= 1 && blocos <= 200

  const criar = async () => {
    if (!valido || ocupado) return
    definirOcupado(true)
    definirErro(null)
    let feito: { slug: string } | null = null
    try {
      feito = await painelDeCartoes.criarProjeto({
        slug,
        nome: nome.trim(),
        blocos,
        unidade: nomeDoBloco,
        primeiroNumero: primeiro,
      })
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível criar o projeto.')
      definirOcupado(false)
      return
    }

    // O projeto já existe. A descrição e a imagem são extras: se uma falhar,
    // abre-se o projeto na mesma e diz-se o que faltou, em vez de prender a
    // pessoa aqui com um projeto criado que ela não vê.
    let incompleto = false
    if (descricao.trim()) {
      await admin.actualizarProjeto(feito.slug, { descricao: descricao.trim() }).catch(() => {
        incompleto = true
      })
    }
    if (imagem) {
      try {
        const asset = await admin.enviarArquivo(imagem)
        await painelDeCartoes.guardarCartaoDoCarrossel(feito.slug, { coverUrl: asset.url })
      } catch {
        incompleto = true
      }
    }
    router.push(`/${feito.slug}/admin?novo=1${incompleto ? '&incompleto=1' : ''}`)
  }

  return (
    <div className="np">
      <Link className="adm-voltar" href="/admin">
        <IconeDoPainel nome="voltar" tamanho={18} /> Meus Projetos
      </Link>
      <header className="mp-cabecalho">
        <h1>Novo Projeto</h1>
        <p>O projeto nasce em rascunho, escondido da página inicial, até você publicar.</p>
      </header>

      <form
        className="np-formulario"
        onSubmit={(e) => {
          e.preventDefault()
          void criar()
        }}
      >
        <label className="np-campo">
          <span>Nome do projeto</span>
          <input
            type="text"
            value={nome}
            required
            maxLength={120}
            placeholder="Ex.: Histórias de Jesus"
            onChange={(e) => definirNome(e.target.value)}
          />
          {slug && (
            <small>
              Endereço: <strong>santtify.com/{slug}</strong> — fica dentro dos QR Codes impressos, por isso não
              muda depois.
            </small>
          )}
        </label>

        <label className="np-campo">
          <span>Descrição curta</span>
          <textarea
            value={descricao}
            maxLength={400}
            rows={2}
            placeholder="Ex.: As grandes histórias da Bíblia contadas para crianças."
            onChange={(e) => definirDescricao(e.target.value)}
          />
          <small>Aparece no cartão do projeto aqui no painel.</small>
        </label>

        <div className="np-campo">
          <span>Imagem do projeto</span>
          <label className="np-imagem">
            {previa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previa} alt="" />
            ) : (
              <span>
                <IconeDoPainel nome="imagem" tamanho={30} />
                Escolher imagem
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const arquivo = e.target.files?.[0] ?? null
                e.target.value = ''
                if (arquivo) definirImagem(arquivo)
              }}
            />
          </label>
          <small>Deitada, com pelo menos 1200 pixels de largura. Pode ser posta depois.</small>
          {imagem && (
            <button type="button" className="np-ligacao" onClick={() => definirImagem(null)}>
              Tirar a imagem
            </button>
          )}
        </div>

        <div className="np-linha">
          <label className="np-campo">
            <span>Quantos blocos</span>
            <input
              type="number"
              min={1}
              max={200}
              value={blocos}
              onChange={(e) => definirBlocos(Number(e.target.value))}
            />
          </label>
          <label className="np-campo">
            <span>Nome de cada bloco</span>
            <input
              type="text"
              value={unidade}
              maxLength={30}
              placeholder="Dia, Atributo, Bloco"
              onChange={(e) => definirUnidade(e.target.value)}
            />
          </label>
          <label className="np-campo">
            <span>Começa no número</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={primeiro}
              onChange={(e) => definirPrimeiro(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>

        {blocos >= 1 && (
          <p className="np-exemplo">
            Os blocos vão ser: <strong>{nomeDoBloco} {primeiro}</strong>
            {blocos > 1 && (
              <>
                {' '}até <strong>{nomeDoBloco} {primeiro + blocos - 1}</strong>
              </>
            )}
            . A quantidade pode ser mudada depois.
          </p>
        )}

        {erro && <p className="erro">{erro}</p>}

        <div className="np-accoes">
          <button type="submit" className="mp-novo" disabled={!valido || ocupado}>
            <IconeDoPainel nome="mais" tamanho={24} />
            {ocupado ? 'Criando...' : 'Criar projeto'}
          </button>
          <Link className="np-cancelar" href="/admin">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
