import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';

@Global()
@Module({
  imports: [DatabaseModule, QueueModule],
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
