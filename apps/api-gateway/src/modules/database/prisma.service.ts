import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectPinoLogger(PrismaService.name)
    private readonly logger: PinoLogger,
  ) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit(): Promise<void> {
    // Enable slow query logging in development
    if (process.env['NODE_ENV'] !== 'production') {
      this.$on('query' as never, (e: { query: string; duration: number }) => {
        if (e.duration > 100) {
          this.logger.warn({ query: e.query, duration: e.duration }, 'Slow database query');
        }
      });
    }

    this.$on('error' as never, (e: { message: string }) => {
      this.logger.error({ message: e.message }, 'Prisma error');
    });

    await this.$connect();
    this.logger.info('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.info('Database connection closed');
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
