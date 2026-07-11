import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [TerminusModule, DatabaseModule, RedisModule, QueueModule],
  controllers: [HealthController],
})
export class HealthModule {}
