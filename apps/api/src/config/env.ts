import { z } from 'zod'

/**
 * Validação do ambiente na subida. Se falta variável, o processo não sobe —
 * é preferível falhar no start do que descobrir em produção que o salt de
 * privacidade estava vazio e os hashes saíram todos iguais.
 */
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
})

export type Env = z.infer<typeof schema>

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const detalhes = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Variáveis de ambiente inválidas:\n${detalhes}`)
  }
  return parsed.data
}
