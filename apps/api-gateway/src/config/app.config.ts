import { registerAs } from '@nestjs/config';
import Joi from 'joi';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  apiVersion: process.env['API_VERSION'] ?? 'v1',
  apiUrl: process.env['API_URL'] ?? 'http://localhost:3001',
  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',

  // Database
  databaseUrl: process.env['DATABASE_URL']!,

  // Redis
  redisUrl: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  redisPassword: process.env['REDIS_PASSWORD'],

  // RabbitMQ
  rabbitmqUrl: process.env['RABBITMQ_URL'] ?? 'amqp://guest:guest@localhost:5672',

  // Auth
  jwtSecret: process.env['JWT_SECRET']!,
  jwtRefreshSecret: process.env['JWT_REFRESH_SECRET']!,
  jwtAccessExpiry: process.env['JWT_ACCESS_EXPIRY'] ?? '15m',
  jwtRefreshExpiry: process.env['JWT_REFRESH_EXPIRY'] ?? '30d',
  encryptionKey: process.env['ENCRYPTION_KEY']!,
  cookieSecret: process.env['COOKIE_SECRET']!,

  // OAuth2
  googleClientId: process.env['GOOGLE_CLIENT_ID'],
  googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'],
  githubClientId: process.env['GITHUB_CLIENT_ID'],
  githubClientSecret: process.env['GITHUB_CLIENT_SECRET'],
  microsoftClientId: process.env['MICROSOFT_CLIENT_ID'],
  microsoftClientSecret: process.env['MICROSOFT_CLIENT_SECRET'],

  // AI
  openaiApiKey: process.env['OPENAI_API_KEY'],
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
  ollamaBaseUrl: process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434',

  // Object Storage
  minioEndpoint: process.env['MINIO_ENDPOINT'] ?? 'localhost',
  minioPort: parseInt(process.env['MINIO_PORT'] ?? '9000', 10),
  minioAccessKey: process.env['MINIO_ACCESS_KEY']!,
  minioSecretKey: process.env['MINIO_SECRET_KEY']!,
  minioBucket: process.env['MINIO_BUCKET'] ?? 'sentinelx',
  minioUseSsl: process.env['MINIO_USE_SSL'] === 'true',

  // OpenSearch
  opensearchUrl: process.env['OPENSEARCH_URL'] ?? 'http://localhost:9200',
  opensearchUsername: process.env['OPENSEARCH_USERNAME'],
  opensearchPassword: process.env['OPENSEARCH_PASSWORD'],

  // Email (SMTP)
  smtpHost: process.env['SMTP_HOST'],
  smtpPort: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
  smtpUser: process.env['SMTP_USER'],
  smtpPass: process.env['SMTP_PASS'],
  smtpFrom: process.env['SMTP_FROM'] ?? 'noreply@sentinelx.io',
  smtpFromName: process.env['SMTP_FROM_NAME'] ?? 'SentinelX AI',

  // Stripe
  stripeSecretKey: process.env['STRIPE_SECRET_KEY'],
  stripeWebhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
  stripePublishableKey: process.env['STRIPE_PUBLISHABLE_KEY'],

  // Notifications
  slackWebhookUrl: process.env['SLACK_WEBHOOK_URL'],
  pagerdutyApiKey: process.env['PAGERDUTY_API_KEY'],

  // Observability
  sentryDsn: process.env['SENTRY_DSN'],
  metricsPort: parseInt(process.env['METRICS_PORT'] ?? '9090', 10),

  // Feature flags
  enableAiCopilot: process.env['ENABLE_AI_COPILOT'] !== 'false',
  enableMarketplace: process.env['ENABLE_MARKETPLACE'] !== 'false',

  // Rate limiting
  rateLimitRpm: parseInt(process.env['RATE_LIMIT_RPM'] ?? '100', 10),
  rateLimitRph: parseInt(process.env['RATE_LIMIT_RPH'] ?? '2000', 10),

  // Allowed CORS origins
  allowedOrigins: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(','),
}));

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().default('redis://localhost:6379'),
  RABBITMQ_URL: Joi.string().default('amqp://guest:guest@localhost:5672'),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  ENCRYPTION_KEY: Joi.string().length(64).required(),
  COOKIE_SECRET: Joi.string().min(32).required(),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
});
