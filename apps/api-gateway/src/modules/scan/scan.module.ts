import { Module } from '@nestjs/common';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';
import { ScanWorkerService } from './scan-worker.service';
import { ScanExecutorService } from './scan-executor.service';
import { ScanProgressGateway } from './scan-progress.gateway';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { QueueModule } from '../queue/queue.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    QueueModule,
    AuthModule,
    AuditModule,
    NotificationModule,
  ],
  controllers: [ScanController],
  providers: [ScanService, ScanWorkerService, ScanExecutorService, ScanProgressGateway],
  exports: [ScanService],
})
export class ScanModule {}
