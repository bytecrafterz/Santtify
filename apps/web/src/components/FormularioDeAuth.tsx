'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { auth, ErroDeApi } from '@/lib/auth'
import { useAuth } from '@/components/ProvedorDeAuth'
import { AjustarFoto } from './AjustarFoto'

/**
 * Cadastro e login no mesmo componente — os dois formulários são quase iguais
 * e mantê-los juntos evita que um receba correção e o outro não.
 */
export function FormularioDeAuth({
  modo,
  projectId,
  projectSlug,
}: {
  modo: 'entrar' | 'cadastrar'
  projectId: string
  projectSlug: string
}) {
  const router = useRouter()
  const parametros = useSearchParams()
  const { definirUsuario } = useAuth()
  const [erro, definirErro] = useState<string | null>(null)
  const [enviando, definirEnviando] = useState(false)
  const [senhaAberta, definirSenhaAberta] = useState(false)
  /**
   * "Lembrar meu login" guarda apenas o E-MAIL, nunca a senha.
   *
   * É a diferença entre poupar uma digitação e deixar a conta aberta no
   * telemóvel de quem o encontrar. Guardar senha no aparelho é o género de
   * comodidade que só se percebe como má ideia depois de acontecer.
   */
  const [lembrar, definirLembrar] = useState(true)
  const [emailGuardado, definirEmailGuardado] = useState('')

  const cadastro = modo === 'cadastrar'
  /** Chegou aqui redirecionado de uma página protegida. */
  const veioDeAreaProtegida = Boolean(parametros.get('voltar'))

  /*
    IDENTIFICAÇÃO NO CADASTRO — pedido dele em 31/08.

    Ele viu aparecer um perfil chamado "Pf 005981", sem foto e sem nome de
    ninguém, e escreveu: "imagine quando entrarem centenas ou milhares de
    pessoas; se o cadastro continuar assim, isso vai virar uma bagunça".

    Três coisas antes de a conta existir: nome, @identificador único, e
    fotografia. O identificador é conferido enquanto se escreve, porque a
    alternativa é preencher tudo, escolher a fotografia, enviar, e descobrir só
    aí que o nome estava tomado — com a fotografia a ter de ser escolhida
    outra vez.
  */
  const [identificador, definirIdentificador] = useState('')
  const [estadoDoId, definirEstadoDoId] = useState<{
    a: 'vazio' | 'aConferir' | 'livre' | 'ocupado'
    recado: string | null
    sugestao: string | null
  }>({ a: 'vazio', recado: null, sugestao: null })
  const [foto, definirFoto] = useState<File | null>(null)
  const [previa, definirPrevia] = useState<string | null>(null)
  const [porEnquadrar, definirPorEnquadrar] = useState<File | null>(null)
  const pedido = useRef(0)

  /*
    Espera meio segundo depois da última tecla. Sem essa espera, escrever
    "joaosilva" manda nove pedidos e a resposta do terceiro pode chegar depois
    da do nono — e o campo passa a dizer o resultado de um nome que já não
    está escrito. O contador `pedido` descarta as respostas atrasadas.
  */
  useEffect(() => {
    if (!cadastro) return
    const bruto = identificador.trim()
    if (!bruto) {
      definirEstadoDoId({ a: 'vazio', recado: null, sugestao: null })
      return
    }
    definirEstadoDoId((e) => ({ ...e, a: 'aConferir' }))
    const meu = ++pedido.current
    const t = setTimeout(async () => {
      try {
        const r = await auth.identificadorLivre(bruto)
        if (meu !== pedido.current) return
        definirEstadoDoId({
          a: r.livre ? 'livre' : 'ocupado',
          recado: r.livre ? `@${r.nome} está livre` : r.problema,
          sugestao: r.sugestao,
        })
      } catch {
        if (meu !== pedido.current) return
        // Falhar a conferir não pode travar o cadastro: quem decide é o
        // servidor no momento de gravar, e ele volta a medir tudo.
        definirEstadoDoId({ a: 'vazio', recado: null, sugestao: null })
      }
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identificador, cadastro])

  function usarRecorte(recortada: File) {
    definirPorEnquadrar(null)
    definirFoto(recortada)
    if (previa) URL.revokeObjectURL(previa)
    definirPrevia(URL.createObjectURL(recortada))
  }

  useEffect(() => {
    const guardado = window.localStorage.getItem('pv_email')
    if (guardado) definirEmailGuardado(guardado)
    else definirLembrar(false)
  }, [])


  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    definirErro(null)
    definirEnviando(true)

    const dados = new FormData(evento.currentTarget)
    const email = String(dados.get('email') ?? '')
    const password = String(dados.get('password') ?? '')

    if (lembrar) window.localStorage.setItem('pv_email', email)
    else window.localStorage.removeItem('pv_email')

    if (cadastro && !foto) {
      definirErro('Escolha uma fotografia de perfil para continuar.')
      definirEnviando(false)
      return
    }

    try {
      const usuario =
        cadastro && foto
          ? await auth.cadastrar({
              projectId,
              email,
              password,
              displayName: String(dados.get('displayName') ?? ''),
              username: identificador,
              foto,
            })
          : await auth.entrar({ projectId, email, password })

      definirUsuario(usuario)

      // Volta para a página que a pessoa tentou abrir antes de ser mandada
      // para o login. Sem isso, quem clica no painel de métricas entra e cai
      // no perfil, e conclui que o painel não existe — foi exatamente o que
      // aconteceu com o cliente.
      const voltar = parametros.get('voltar')
      const destino =
        voltar && voltar.startsWith(`/${projectSlug}/`)
          ? voltar
          : `/${projectSlug}/perfil`
      router.push(destino)
      router.refresh()
    } catch (e) {
      definirErro(
        e instanceof ErroDeApi ? e.message : 'Não foi possível concluir. Tente de novo.',
      )
      definirEnviando(false)
    }
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      {veioDeAreaProtegida && (
        <p className="aviso-social">
          Essa área pede login. Entre e você volta direto para ela.
        </p>
      )}
      {cadastro && (
        <>
          {/*
            A REGRA APARECE ANTES DE A CONTA EXISTIR, E É A ARTE DELE.

            Pedido dele em 01/09: "quero aproveitar a mesma mensagem de
            segurança que já usamos na arte do perfil sem foto; ela deve
            aparecer também durante o cadastro". E disse porquê, que é o melhor
            argumento: "quem estiver entrando apenas para criar perfil falso já
            vê as regras antes mesmo de concluir o cadastro e pode nem
            prosseguir".

            É A PRÓPRIA ARTE e não um texto meu a dizer o mesmo. Duas versões da
            mesma regra divergem no dia em que ele mudar uma delas, e a que fica
            desactualizada é sempre a que menos gente vê. Ele muda o ficheiro e
            muda nos dois sítios.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="arte-das-regras"
            src="/perfil-sem-foto.png"
            alt={
              'Não é permitido perfil sem foto e sem nomes verdadeiros, para a segurança da ' +
              'plataforma. É um ambiente cristão, familiar e infantil. Os perfis que não ' +
              'tiverem foto nem nome verdadeiro serão deletados automaticamente.'
            }
            width={1000}
            height={1000}
          />

          <label>
            Nome
            <input name="displayName" type="text" required minLength={3} maxLength={80}
                   autoComplete="name" placeholder="Como você quer ser chamado"
                   onBlur={(e) => {
                     // Sugere um identificador a partir do nome, e só enquanto
                     // a pessoa ainda não escreveu nenhum. Escrever por cima do
                     // que ela já pôs seria tirar-lhe a escolha.
                     if (!identificador.trim()) {
                       definirIdentificador(
                         e.target.value
                           .toLowerCase()
                           .normalize('NFD')
                           .replace(/[\u0300-\u036f]/g, '')
                           .replace(/[^a-z0-9._]/g, '')
                           .slice(0, 20),
                       )
                     }
                   }} />
          </label>

          <label>
            Identificador
            <span className="campo-identificador">
              <span aria-hidden>@</span>
              <input name="username" type="text" required inputMode="text"
                     autoCapitalize="none" autoCorrect="off" spellCheck={false}
                     autoComplete="username" maxLength={20}
                     placeholder="joaosilva123"
                     value={identificador}
                     onChange={(e) => definirIdentificador(e.target.value)} />
            </span>
            <small className={`recado-identificador ${estadoDoId.a}`}>
              {estadoDoId.a === 'aConferir' && 'A conferir...'}
              {estadoDoId.a === 'livre' && `✓ ${estadoDoId.recado}`}
              {estadoDoId.a === 'ocupado' && (
                <>
                  {estadoDoId.recado}
                  {estadoDoId.sugestao && (
                    <>
                      {' '}
                      <button type="button" className="usar-sugestao"
                              onClick={() => definirIdentificador(estadoDoId.sugestao!)}>
                        usar @{estadoDoId.sugestao}
                      </button>
                    </>
                  )}
                </>
              )}
              {estadoDoId.a === 'vazio' &&
                'Duas pessoas podem ter o mesmo nome. O identificador é só seu.'}
            </small>
          </label>

          <label className="campo-foto-cadastro">
            Fotografia do perfil
            <input type="file" accept="image/*" required={!foto}
                   onChange={(e) => {
                     const f = e.target.files?.[0]
                     if (f) definirPorEnquadrar(f)
                     // Esvaziar, para a MESMA fotografia poder ser escolhida
                     // outra vez depois de cancelar o enquadramento.
                     e.target.value = ''
                   }} />
            {previa && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="previa-avatar" src={previa} alt="A sua fotografia" />
            )}
          </label>

          {porEnquadrar && (
            <AjustarFoto
              ficheiro={porEnquadrar}
              aoConfirmar={usarRecorte}
              aoCancelar={() => definirPorEnquadrar(null)}
            />
          )}
        </>
      )}

      <label>
        E-mail
        <input name="email" type="email" required autoComplete="email"
               inputMode="email" placeholder="voce@exemplo.com"
                 defaultValue={emailGuardado} key={emailGuardado} />
      </label>

      <label>
        Senha
        <span className="campo-com-olho">
          <input name="password" type={senhaAberta ? 'text' : 'password'} required
                 minLength={cadastro ? 10 : undefined}
                 autoComplete={cadastro ? 'new-password' : 'current-password'}
                 placeholder={cadastro ? 'No mínimo 10 caracteres' : ''} />
          {/* Ver a senha resolve o erro mais comum de todos: escrevê-la certa e
              não notar que o teclado do telemóvel trocou uma letra. */}
          <button
            type="button"
            className="olho"
            onClick={() => definirSenhaAberta((v) => !v)}
            aria-label={senhaAberta ? 'Ocultar a senha' : 'Mostrar a senha'}
            aria-pressed={senhaAberta}
          >
            {senhaAberta ? '🙈' : '👁'}
          </button>
        </span>
        {cadastro && (
          <small>Use pelo menos 10 caracteres. Uma frase curta funciona bem e é fácil de lembrar.</small>
        )}
      </label>

        <div className="linha-lembrar">
          <label className="lembrar">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => definirLembrar(e.target.checked)}
            />
            Lembrar meu login
          </label>
          {!cadastro && <Link href={`/${projectSlug}/recuperar`}>Esqueci minha senha</Link>}
        </div>

      {erro && <p className="erro" role="alert">{erro}</p>}

      {/* O aceite fica ligado ao próprio botão, e não numa caixinha separada
          que a pessoa marca sem ler. É comunidade infantil: quem cria conta
          precisa ver as regras existirem, no momento em que está entrando. */}
      {cadastro && (
        <p className="aceite">
          Ao criar a conta você concorda com os{' '}
          <Link href="/termos" target="_blank">
            termos de uso
          </Link>{' '}
          e com a{' '}
          <Link href="/privacidade" target="_blank">
            política de privacidade
          </Link>
          . Esta é uma comunidade cristã, infantil e familiar.
        </p>
      )}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Aguarde...' : cadastro ? 'Criar minha conta' : 'Entrar'}
      </button>

      <p className="alternativa">
        {cadastro ? (
          <>Já tem conta? <Link href={`/${projectSlug}/entrar`}>Entrar</Link></>
        ) : (
          <>Ainda não tem conta? <Link href={`/${projectSlug}/cadastrar`}>Criar conta</Link></>
        )}
      </p>
    </form>
  )
}
