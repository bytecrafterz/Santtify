import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { validateEnv } from './config/env'
import { PrismaModule } from './prisma/prisma.module'
import { MailModule } from './common/mail/mail.module'
import { GeoModule } from './common/geo/geo.module'
import { PrivacyModule } from './common/privacy/privacy.module'
import { TrackingModule } from './tracking/tracking.module'
import { ShortLinksModule } from './short-links/short-links.module'
import { ContentModule } from './content/content.module'
import { IdentityModule } from './identity/identity.module'
import { AdminModule } from './admin/admin.module'
import { SocialModule } from './social/social.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { HealthModule } from './health/health.module'
import { CartoesModule } from './cartoes/cartoes.module'

@Module({
  imports: [
    /**
     * O agendador. Estava na lista de dependências e nunca tinha sido ligado,
     * porque até agora nada corria sozinho. O expurgo das fotos das crianças
     * corre — e um `@Cron` sem isto não dá erro nenhum: simplesmente nunca
     * acontece, que é a pior forma de uma promessa de privacidade falhar.
     */
    ScheduleModule.forRoot(),
    GeoModule,
    MailModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    PrivacyModule,
    TrackingModule,
    ShortLinksModule,
    ContentModule,
    IdentityModule,
    AdminModule,
    SocialModule,
    AnalyticsModule,
    HealthModule,
    CartoesModule,
  ],
})
export class AppModule {}
