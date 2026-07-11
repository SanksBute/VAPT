import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { QueueModule } from '../queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [DatabaseModule, RedisModule, AuthModule, AuditModule, QueueModule, ConfigModule, AiModule],
  providers: [ReportService],
  controllers: [ReportController],
  exports: [ReportService],
})
export class ReportModule {}
