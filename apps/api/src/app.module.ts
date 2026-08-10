import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnv } from './config/env'
import { PrismaModule } from './prisma/prisma.module'
import { PrivacyModule } from './common/privacy/privacy.module'
import { TrackingModule } from './tracking/tracking.module'
import { ShortLinksModule } from './short-links/short-links.module'
import { ContentModule } from './content/content.module'
import { IdentityModule } from './identity/identity.module'
import { AdminModule } from './admin/admin.module'
import { SocialModule } from './social/social.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
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
  ],
})
export class AppModule {}
