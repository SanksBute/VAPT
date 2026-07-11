import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator, MemoryHealthIndicator, DiskHealthIndicator } from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { QueueService } from '../queue/queue.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly queue: QueueService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint', operationId: 'healthCheck' })
  async check() {
    return this.health.check([
      // Database
      async () => ({
        database: {
          status: (await this.prisma.healthCheck()) ? 'up' : 'down',
        },
      }),

      // Redis
      async () => ({
        redis: {
          status: (await this.redis.healthCheck()) ? 'up' : 'down',
        },
      }),

      // RabbitMQ
      async () => ({
        rabbitmq: {
          status: (await this.queue.healthCheck()) ? 'up' : 'down',
        },
      }),

      // Memory
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024), // 512MB
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024), // 1GB

      // Disk
      () => this.disk.checkStorage('disk', {
        thresholdPercent: 0.9,
        path: '/',
      }),
    ]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe', operationId: 'readinessCheck' })
  async ready() {
    const dbHealthy = await this.prisma.healthCheck();
    const redisHealthy = await this.redis.healthCheck();

    if (!dbHealthy || !redisHealthy) {
      throw new Error('Service not ready');
    }

    return { status: 'ready', timestamp: new Date().toISOString() };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe', operationId: 'livenessCheck' })
  live() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }
}
