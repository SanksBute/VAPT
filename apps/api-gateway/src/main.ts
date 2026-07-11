import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { AuditInterceptor } from './interceptors/audit.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Use Pino logger
  app.useLogger(app.get(Logger));

  // Trust proxy (for correct IP behind load balancers)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // Compression
  app.use(compression());

  // Cookie parsing
  app.use(cookieParser(process.env['COOKIE_SECRET']));

  // CORS configuration
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(',');
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Organization-ID',
      'X-API-Version',
    ],
    exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining'],
    maxAge: 86400,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: false,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    app.get(ResponseInterceptor),
    app.get(AuditInterceptor),
  );

  // Swagger documentation
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('SentinelX AI API')
      .setDescription(
        'Enterprise AI-Powered Offensive Security Platform API.\n\n' +
          'Authenticate using Bearer token. Obtain tokens via `/api/v1/auth/login`.\n\n' +
          '**Base URL:** `/api/v1`\n\n' +
          '**Rate Limits:** 100 requests/minute for standard endpoints, 10 requests/minute for AI endpoints.',
      )
      .setVersion('1.0.0')
      .setContact('SentinelX Team', 'https://sentinelx.io', 'api@sentinelx.io')
      .setLicense('Proprietary', 'https://sentinelx.io/terms')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Key' }, 'api-key')
      .addTag('Authentication', 'Auth endpoints — login, logout, token refresh, MFA')
      .addTag('Organizations', 'Organization management')
      .addTag('Users', 'User management')
      .addTag('Assets', 'Asset inventory and management')
      .addTag('Scans', 'Security scan lifecycle management')
      .addTag('Vulnerabilities', 'Vulnerability management and tracking')
      .addTag('Reports', 'Report generation and management')
      .addTag('Compliance', 'Compliance framework management')
      .addTag('AI Copilot', 'AI-powered security intelligence')
      .addTag('Tickets', 'Remediation ticket management')
      .addTag('Notifications', 'Notification management')
      .addTag('Integrations', 'Third-party integrations')
      .addTag('Billing', 'Subscription and billing management')
      .addTag('Marketplace', 'Plugin marketplace')
      .addTag('Dashboards', 'Dashboard management')
      .addTag('Audit Logs', 'Audit trail')
      .addTag('Health', 'Service health and metrics')
      .addServer(process.env['API_URL'] ?? 'http://localhost:3001', 'Development')
      .addServer('https://api.sentinelx.io', 'Production')
      .build();

    const document = SwaggerModule.createDocument(app, config, {
      operationIdFactory: (_controllerKey, methodKey) => methodKey,
    });

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        tryItOutEnabled: false,
      },
      customCss: '.swagger-ui .topbar { background-color: #0f172a; }',
      customSiteTitle: 'SentinelX AI — API Documentation',
    });
  }

  const port = parseInt(process.env['PORT'] ?? '3001', 10);
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`🚀 SentinelX API Gateway running on port ${port}`, 'Bootstrap');
  logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
