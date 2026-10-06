import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, createPublicKey, randomBytes, verify, type JsonWebKey } from 'node:crypto'

const AUTORIZACAO = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const CHAVES = 'https://www.googleapis.com/oauth2/v3/certs'
const EMISSORES = new Set(['https://accounts.google.com', 'accounts.google.com'])

/** Quanto tempo a pessoa tem para escolher a conta na página do Google. */
const PRAZO_DO_INICIO = 10 * 60_000
/** Quanto tempo o código de entrega vive entre o regresso e a página de login. */
const PRAZO_DA_ENTREGA = 2 * 60_000

/** O que fica à espera enquanto a pessoa está na página do Google. */
export interface InicioPendente {
  nonce: string
  verificador: string
  projectId: string
  projeto: string
  voltar: string | null
  criadoEm: number
}

/** A conta Google, já conferida: assinatura, emissor, destinatário, validade, nonce. */
export interface PerfilGoogle {
  sub: string
  email: string
  emailVerificado: boolean
  nome: string
  foto: string | null
}

/** A conta Google sem e-mail confirmado: não se pode ligar a ninguém por ele. */
export class EmailGoogleNaoConfirmado extends BadRequestException {
  constructor() {
    super('Esta conta Google não tem o e-mail confirmado.')
  }
}

const base64url = (b: Buffer) => b.toString('base64url')

/**
 * "CONTINUAR COM GOOGLE" (06/10).
 *
 * Pedido do cliente: "permitir que o usuário crie a conta ou entre com poucos
 * toques, sem precisar preencher cadastro e criar senha", mantendo o login
 * por e-mail.
 *
 * É o fluxo de código do OAuth, com o segredo no servidor e PKCE — e não o
 * botão em JavaScript do Google, por causa da aplicação instalada: num iPhone,
 * um popup aberto de dentro da app instalada é exactamente o que se perde.
 * Aqui é uma navegação de página inteira: vai ao Google e volta.
 *
 * NADA DE SEGREDOS NO ENDEREÇO. O regresso do Google traz um código que só o
 * servidor troca (com o segredo e o verificador PKCE). E a sessão não volta
 * ao navegador no endereço: volta um código de entrega de uso único, que a
 * página de login troca pela sessão em `POST /auth/google/trocar`.
 *
 * O ID token do Google confere-se aqui mesmo — assinatura RS256 com as chaves
 * públicas do Google, emissor, destinatário, validade e o nonce que mandámos —
 * com o `crypto` do Node, sem biblioteca a mais.
 *
 * Os pendentes vivem em memória: um reinício da API a meio de um login só
 * obriga a tocar no botão outra vez.
 */
@Injectable()
export class EntradaComGoogle {
  private readonly logger = new Logger(EntradaComGoogle.name)
  private readonly pendentes = new Map<string, InicioPendente>()
  private readonly entregas = new Map<string, { userId: string; novo: boolean; expira: number }>()
  private chaves: { ate: number; lista: Array<JsonWebKey & { kid?: string }> } | null = null

  constructor(private readonly config: ConfigService) {}

  /** Sem as duas chaves do Google, o botão não aparece. */
  ativa(): boolean {
    return Boolean(this.clienteId && this.segredo)
  }

  private get clienteId() {
    return this.config.get<string>('GOOGLE_CLIENT_ID') ?? ''
  }

  private get segredo() {
    return this.config.get<string>('GOOGLE_CLIENT_SECRET') ?? ''
  }

  /** Para onde o Google devolve a pessoa. Tem de estar registado na consola dele. */
  private get urlDeRetorno() {
    const base = (this.config.get<string>('PUBLIC_API_URL') ?? '').replace(/\/+$/, '').replace(/\/api$/, '')
    return `${base}/api/auth/google/retorno`
  }

  /** O endereço da página do Google, com o estado deste início guardado. */
  inicio(dados: { projectId: string; projeto: string; voltar: string | null }): string {
    this.limpar()
    const estado = base64url(randomBytes(24))
    const nonce = base64url(randomBytes(24))
    const verificador = base64url(randomBytes(32))
    this.pendentes.set(estado, { ...dados, nonce, verificador, criadoEm: Date.now() })

    const q = new URLSearchParams({
      client_id: this.clienteId,
      redirect_uri: this.urlDeRetorno,
      response_type: 'code',
      scope: 'openid email profile',
      state: estado,
      nonce,
      code_challenge: base64url(createHash('sha256').update(verificador).digest()),
      code_challenge_method: 'S256',
      // Quem tem duas contas Google escolhe qual — e não entra na errada calado.
      prompt: 'select_account',
    })
    return `${AUTORIZACAO}?${q}`
  }

  /** O início deste regresso. Só serve uma vez, e só dentro do prazo. */
  consumir(estado: string): InicioPendente | null {
    const pendente = this.pendentes.get(estado)
    this.pendentes.delete(estado)
    if (!pendente || Date.now() - pendente.criadoEm > PRAZO_DO_INICIO) return null
    return pendente
  }

  /** Troca o código do Google pelo ID token, e confere-o todo. */
  async perfil(codigo: string, pendente: InicioPendente): Promise<PerfilGoogle> {
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        code: codigo,
        client_id: this.clienteId,
        client_secret: this.segredo,
        redirect_uri: this.urlDeRetorno,
        grant_type: 'authorization_code',
        code_verifier: pendente.verificador,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const dados = (await res.json().catch(() => null)) as { id_token?: string; error?: string } | null
    if (!res.ok || !dados?.id_token) {
      // O corpo de erro do Google diz porquê ("invalid_grant"…); o segredo não vai para o registo.
      this.logger.warn(`Google recusou a troca do código: HTTP ${res.status} ${dados?.error ?? ''}`)
      throw new BadRequestException('O Google não confirmou a entrada. Tente de novo.')
    }

    const c = await this.conferir(dados.id_token)
    if (c.nonce !== pendente.nonce) throw new BadRequestException('A resposta do Google não é deste pedido.')
    if (typeof c.sub !== 'string' || typeof c.email !== 'string') {
      throw new BadRequestException('O Google não devolveu a conta.')
    }
    return {
      sub: c.sub,
      email: c.email,
      emailVerificado: c.email_verified === true || c.email_verified === 'true',
      nome: typeof c.name === 'string' ? c.name : typeof c.given_name === 'string' ? c.given_name : '',
      foto: typeof c.picture === 'string' ? c.picture : null,
    }
  }

  /** O código de uso único que a página de login troca pela sessão. */
  entregar(userId: string, novo: boolean): string {
    this.limpar()
    const codigo = base64url(randomBytes(24))
    this.entregas.set(codigo, { userId, novo, expira: Date.now() + PRAZO_DA_ENTREGA })
    return codigo
  }

  levantar(codigo: string): { userId: string; novo: boolean } | null {
    const entrega = this.entregas.get(codigo)
    this.entregas.delete(codigo)
    if (!entrega || entrega.expira < Date.now()) return null
    return { userId: entrega.userId, novo: entrega.novo }
  }

  private limpar() {
    const agora = Date.now()
    for (const [k, v] of this.pendentes) if (agora - v.criadoEm > PRAZO_DO_INICIO) this.pendentes.delete(k)
    for (const [k, v] of this.entregas) if (v.expira < agora) this.entregas.delete(k)
  }

  /** Assinatura RS256 com a chave pública do Google, emissor, destinatário e validade. */
  private async conferir(token: string): Promise<Record<string, unknown>> {
    const partes = token.split('.')
    if (partes.length !== 3) throw new BadRequestException('Resposta do Google inválida.')
    const [h, p, s] = partes
    const cabecalho = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as { alg?: string; kid?: string }
    if (cabecalho.alg !== 'RS256') throw new BadRequestException('Resposta do Google inválida.')

    const chave = createPublicKey({ key: await this.chave(cabecalho.kid), format: 'jwk' })
    if (!verify('RSA-SHA256', Buffer.from(`${h}.${p}`), chave, Buffer.from(s, 'base64url'))) {
      throw new BadRequestException('A assinatura da resposta do Google não confere.')
    }

    const c = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as Record<string, unknown>
    const destinatarios = Array.isArray(c.aud) ? c.aud : [c.aud]
    const agora = Math.floor(Date.now() / 1000)
    if (!EMISSORES.has(String(c.iss))) throw new BadRequestException('A resposta não veio do Google.')
    if (!destinatarios.includes(this.clienteId)) throw new BadRequestException('A resposta do Google não é para a Santtify.')
    if (typeof c.exp !== 'number' || c.exp < agora - 60) throw new BadRequestException('A resposta do Google expirou.')
    return c
  }

  /** As chaves públicas do Google, guardadas uma hora; procuradas de novo se faltar a do `kid`. */
  private async chave(kid: string | undefined): Promise<JsonWebKey> {
    const procurar = () => this.chaves?.lista.find((k) => k.kid === kid)
    if (!this.chaves || this.chaves.ate < Date.now() || !procurar()) {
      const res = await fetch(CHAVES, { signal: AbortSignal.timeout(10_000) })
      const dados = (await res.json().catch(() => null)) as { keys?: Array<JsonWebKey & { kid?: string }> } | null
      if (!res.ok || !dados?.keys) throw new BadRequestException('Não foi possível conferir a resposta do Google.')
      this.chaves = { ate: Date.now() + 60 * 60_000, lista: dados.keys }
    }
    const k = procurar()
    if (!k) throw new BadRequestException('A resposta do Google usa uma chave desconhecida.')
    return k
  }
}
