import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ResellersModule } from './modules/resellers/resellers.module';
import { VpnNodesModule } from './modules/vpn-nodes/vpn-nodes.module';
import { PkiModule } from './modules/pki/pki.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { BillingModule } from './modules/billing/billing.module';
import { AuditModule } from './modules/audit/audit.module';
import { ConfigDeliveryModule } from './modules/config-delivery/config-delivery.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StatsModule } from './modules/stats/stats.module';
import { ProfileModule } from './modules/profile/profile.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ResellersModule,
    VpnNodesModule,
    PkiModule,
    SessionsModule,
    BillingModule,
    AuditModule,
    ConfigDeliveryModule,
    SettingsModule,
    StatsModule,
    ProfileModule,
  ],
})
export class AppModule {}
