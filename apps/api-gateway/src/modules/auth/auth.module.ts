import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './services/token.service';
import { MfaService } from './services/mfa.service';
import { OAuthService } from './services/oauth.service';
import { SessionService } from './services/session.service';
import { PasswordService } from './services/password.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { ApiKeyStrategy } from './strategies/api-key.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { OrganizationGuard } from './guards/organization.guard';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    AuditModule,
    NotificationModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRY', '15m'),
          algorithm: 'HS256',
          issuer: 'sentinelx',
          audience: 'sentinelx-api',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    MfaService,
    OAuthService,
    SessionService,
    PasswordService,
    JwtStrategy,
    JwtRefreshStrategy,
    ApiKeyStrategy,
    LocalStrategy,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    OrganizationGuard,
  ],
  exports: [
    AuthService,
    TokenService,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    OrganizationGuard,
    JwtModule,
  ],
})
export class AuthModule {}
