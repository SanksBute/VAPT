import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const { default: Redis } = await import('ioredis');
        const client = new Redis(config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
          password: config.get<string>('REDIS_PASSWORD'),
          retryStrategy: (times) => Math.min(times * 50, 2000),
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
          tls: config.get<string>('NODE_ENV') === 'production' ? {} : undefined,
          keyPrefix: 'sentinelx:',
        });

        client.on('error', (err: Error) => {
          console.error('Redis connection error:', err);
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService, 'REDIS_CLIENT'],
})
export class RedisModule {}
