import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { join } from 'node:path'
import { AppModule } from './app.module'

/**
 * O Postgres devolve `count(*)` e o id de `events` como BigInt, e o
 * JSON.stringify do Node não sabe serializar BigInt — o resultado é um 500
 * genérico, sem pista nenhuma para quem depura.
 *
 * As consultas convertem para int na própria SQL, que é a correção na origem.
 * Isto aqui é a rede de segurança para o que escapar: `Event.id` é BigInt e
 * circula por várias rotas.
 */
;(BigInt.prototype as unknown as { toJSON(): string }).toJSON = function () {
  return this.toString()
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const config = app.get(ConfigService)

  // Necessário para que ipDaRequisicao leia o X-Forwarded-For atrás de proxy.
  app.set('trust proxy', true)
  app.use(cookieParser())

  /**
   * Prefixo /api em tudo, com três exceções.
   *
   * O motivo é a origem única: em produção o proxy serve o site e a API no
   * MESMO domínio, e isso elimina de uma vez CORS entre subdomínios e cookie
   * com Domain=.dominio.com. O cookie `pv_anon` é o que liga a visita do QR à
   * pessoa, e cookie entre origens diferentes é a categoria de bug que só
   * aparece no celular de outra pessoa, depois do lançamento.
   *
   * Exceções:
   *   - `r/:code` fica na raiz porque é o endereço gravado dentro do QR:
   *     quanto mais curto, mais fácil de escanear.
   *   - `health` para o monitor não depender do prefixo.
   *   - `/uploads` é estático e não passa pelo roteador do Nest.
   *
   * O mesmo prefixo vale em desenvolvimento, de propósito: divergir aqui é
   * como se produz o clássico "na minha máquina funcionava".
   */
  app.setGlobalPrefix('api', { exclude: ['r/:code', 'health'] })

  app.enableCors({
    origin: config.getOrThrow<string>('PUBLIC_WEB_URL'),
    credentials: true,
  })
  // Arquivos enviados pelo painel. Em produção o ideal é o proxy reverso
  // servir esta pasta direto, sem passar pelo Node.
  app.useStaticAssets(process.env.UPLOAD_DIR ?? join(process.cwd(), '..', '..', 'uploads'), {
    prefix: '/uploads/',
    maxAge: '30d',
    immutable: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  )

  const port = config.get<number>('API_PORT') ?? 3333
  await app.listen(port)
  new Logger('bootstrap').log(`API em http://localhost:${port}`)
}

bootstrap()
