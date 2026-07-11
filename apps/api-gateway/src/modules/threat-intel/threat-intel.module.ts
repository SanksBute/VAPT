import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { ThreatIntelController } from './threat-intel.controller';
import { ThreatIntelService } from './threat-intel.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [DatabaseModule, AuthModule, QueueModule],
  controllers: [ThreatIntelController],
  providers: [ThreatIntelService],
  exports: [ThreatIntelService],
})
export class ThreatIntelModule {}
