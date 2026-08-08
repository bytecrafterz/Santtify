import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const config = app.get(ConfigService)

  // Necessário para que ipDaRequisicao leia o X-Forwarded-For atrás de proxy.
  app.set('trust proxy', true)
  app.use(cookieParser())
  app.enableCors({
    origin: config.getOrThrow<string>('PUBLIC_WEB_URL'),
    credentials: true,
  })
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  )

  const port = config.get<number>('API_PORT') ?? 3333
  await app.listen(port)
  new Logger('bootstrap').log(`API em http://localhost:${port}`)
}

bootstrap()
