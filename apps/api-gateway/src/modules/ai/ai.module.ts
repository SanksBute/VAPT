import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiProviderService } from './services/ai-provider.service';
import { AiMemoryService } from './services/ai-memory.service';
import { AiEmbeddingService } from './services/ai-embedding.service';
import { AiAnalysisService } from './services/ai-analysis.service';
import { AiToolsService } from './services/ai-tools.service';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [DatabaseModule, RedisModule, ConfigModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiProviderService,
    AiMemoryService,
    AiEmbeddingService,
    AiAnalysisService,
    AiToolsService,
  ],
  exports: [AiService, AiAnalysisService],
})
export class AiModule {}
