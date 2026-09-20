import { z } from 'zod'

/**
 * Validação do ambiente na subida. Se falta variável, o processo não sobe —
 * é preferível falhar no start do que descobrir em produção que o salt de
 * privacidade estava vazio e os hashes saíram todos iguais.
 */
/** Uma linha `CHAVE=` vazia no .env conta como ausente, e não como texto vazio. */
const vazioComoAusente = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined))

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  /// Salt do hash de IP e user-agent. Trocar invalida a correlação anterior.
  PRIVACY_HASH_SALT: z.string().min(16),
  EVENT_RETENTION_DAYS: z.coerce.number().int().positive().default(1095),
  CONSENT_POLICY_VERSION: z.string().default('1.0.0'),

  PUBLIC_WEB_URL: z.string().url(),
  PUBLIC_SHORTLINK_BASE: z.string().url(),
  PUBLIC_API_URL: z.string().url().default('http://localhost:3333'),
  UPLOAD_DIR: z.string().optional(),

  /**
   * Onde ficam as fotografias das crianças e os PDFs enquanto duram.
   *
   * PASTA PRÓPRIA, FORA DE `UPLOAD_DIR`, e isto não é arrumação. `UPLOAD_DIR` é
   * servida como ficheiro estático em `/uploads`, ou seja, quem souber o
   * endereço abre o ficheiro sem ter sessão nenhuma. Serve para a música e para
   * a arte das letras, que são públicas. Uma fotografia de uma criança não pode
   * viver nessa pasta nem por engano — sai por uma rota que verifica de quem é
   * o pedido, e mais nenhuma.
   */
  CARTOES_DIR: z.string().optional(),

  /**
   * Quantos dias o ficheiro fica disponível depois de pago, antes do expurgo.
   *
   * O cliente pediu que nada ficasse guardado para sempre. Sete dias é o que
   * lhe propus por escrito: dá tempo de a mãe descarregar, reenviar por
   * WhatsApp ou levar à gráfica, e não transforma a plataforma num arquivo de
   * fotografias de crianças. Configurável porque a decisão é dele, não minha.
   */
  CARTOES_DIAS_ATE_EXPURGO: z.coerce.number().int().positive().default(7),

  /**
   * Quantas horas um pedido por pagar sobrevive.
   *
   * Curto de propósito: se ela desistiu no meio, a fotografia que enviou não
   * tem razão nenhuma para continuar em disco.
   */
  CARTOES_HORAS_ATE_ABANDONO: z.coerce.number().int().positive().default(48),

  /**
   * Envio de e-mail. OPCIONAL de propósito.
   *
   * O sistema tem de subir sem isto: em desenvolvimento ninguém quer mandar
   * e-mail a sério, e obrigar a chave a existir faria a máquina de quem
   * programa depender de um serviço externo. Quando falta, a reposição de
   * senha continua a funcionar pelo painel — que é o caminho que já existia.
   */
  BREVO_API_KEY: z.string().optional(),
  MAIL_REMETENTE: z.string().email().optional(),
  MAIL_REMETENTE_NOME: z.string().default('Santtify'),

  /**
   * Quem processa os pagamentos dos cartões.
   *
   * `manual` por omissão: é o que deixa a plataforma inteira funcionar sem
   * conta em provedor nenhum, com a confirmação feita no painel. Passa a
   * `mercadopago` quando as chaves existirem.
   */
  PAGAMENTOS_PROVEDOR: z.enum(['manual', 'mercadopago']).default('manual'),

  /**
   * A chave partilhada com o transcritor — o programa que ouve as músicas.
   *
   * Sem ela, a porta do transcritor não abre de todo (ver `TranscritorController`).
   * É máquina a falar com máquina dentro do servidor, e uma porta dessas aberta
   * ao mundo deixava qualquer pessoa escrever letras na plataforma.
   */
  TRANSCRITOR_TOKEN: vazioComoAusente,

  /** O Access Token da aplicação no Mercado Pago. É uma senha: só no servidor. */
  MERCADOPAGO_ACCESS_TOKEN: vazioComoAusente,
  /**
   * A chave secreta das notificações, que o Mercado Pago gera DEPOIS de se
   * configurar o endereço delas no painel dele.
   *
   * Opcional, e não por descuido. Sem ela a assinatura não se confere, mas o
   * aviso também não é acreditado: o que diz se um pedido foi pago é a
   * consulta que a API faz ao Mercado Pago com o nosso Access Token, nunca o
   * corpo que chega. Um aviso forjado só consegue pedir-nos que perguntemos.
   * A assinatura é a segunda porta, não a primeira — e exigi-la na subida
   * impedia o primeiro deploy, que é o que cria o endereço de onde ela nasce.
   */
  MERCADOPAGO_WEBHOOK_SECRET: vazioComoAusente,
})

/**
 * Em produção a pasta das fotos dos cartões é OBRIGATÓRIA.
 *
 * Sem ela, a API cai no caminho por omissão, que dentro do contentor resolve
 * para /cartoes-temporarios — uma pasta onde o utilizador da API não escreve.
 * O processo subia normalmente e só rebentava no primeiro envio de foto de uma
 * mãe. Falhar aqui, na subida, é o mesmo princípio do resto deste ficheiro.
 */
const schemaComRegras = schema.superRefine((env, ctx) => {
  // Ligar o Mercado Pago sem a chave deixava o site a mostrar "Pagar com Pix" e
  // a rebentar no clique. Mais vale não subir.
  if (env.PAGAMENTOS_PROVEDOR === 'mercadopago' && !env.MERCADOPAGO_ACCESS_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['MERCADOPAGO_ACCESS_TOKEN'],
      message: 'obrigatório com PAGAMENTOS_PROVEDOR=mercadopago',
    })
  }
  if (env.NODE_ENV === 'production' && !env.CARTOES_DIR) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CARTOES_DIR'],
      message: 'obrigatória em produção (ver docker-compose.prod.yml)',
    })
  }
})

export type Env = z.infer<typeof schema>

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schemaComRegras.safeParse(raw)
  if (!parsed.success) {
    const detalhes = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Variáveis de ambiente inválidas:\n${detalhes}`)
  }
  return parsed.data
}
