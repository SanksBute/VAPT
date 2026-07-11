import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { appConfig } from './config/app.config';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { AssetModule } from './modules/asset/asset.module';
import { ScanModule } from './modules/scan/scan.module';
import { VulnerabilityModule } from './modules/vulnerability/vulnerability.module';
import { ReportModule } from './modules/report/report.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { AiModule } from './modules/ai/ai.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { NotificationModule } from './modules/notification/notification.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { BillingModule } from './modules/billing/billing.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { ThreatIntelModule } from './modules/threat-intel/threat-intel.module';
import { RiskModule } from './modules/risk/risk.module';
import { DatabaseModule } from './modules/database/database.module';
import { RedisModule } from './modules/redis/redis.module';
import { QueueModule } from './modules/queue/queue.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),

    // Logging
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug',
          redact: ['req.headers.authorization', 'req.headers["x-api-key"]', 'req.body.password'],
          customProps: () => ({ service: 'api-gateway' }),
          transport:
            config.get('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
              : undefined,
          serializers: {
            req: (req: { method: string; url: string; id: string }) => ({
              method: req.method,
              url: req.url,
              id: req.id,
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
        },
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000,
            limit: 20,
          },
          {
            name: 'medium',
            ttl: 60000,
            limit: config.get<number>('RATE_LIMIT_RPM', 100),
          },
          {
            name: 'long',
            ttl: 3600000,
            limit: config.get<number>('RATE_LIMIT_RPH', 2000),
          },
        ],
        skipIf: (context) => {
          const request = context.switchToHttp().getRequest<{ path: string }>();
          return request.path === '/health' || request.path === '/api/health';
        },
      }),
    }),

    // Task scheduling
    ScheduleModule.forRoot(),

    // Core infrastructure
    DatabaseModule,
    RedisModule,
    QueueModule,

    // Feature modules
    AuthModule,
    UserModule,
    OrganizationModule,
    AssetModule,
    ScanModule,
    VulnerabilityModule,
    ReportModule,
    ComplianceModule,
    AiModule,
    TicketModule,
    NotificationModule,
    IntegrationModule,
    BillingModule,
    MarketplaceModule,
    DashboardModule,
    AuditModule,
    ThreatIntelModule,
    RiskModule,
    WebSocketModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    ResponseInterceptor,
    AuditInterceptor,
  ],
})
export class AppModule {}
