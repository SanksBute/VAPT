import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderService } from './ai-provider.service';
import type { AIProviderType } from '@sentinelx/shared';

@Injectable()
export class AiEmbeddingService {
  constructor(
    @InjectPinoLogger(AiEmbeddingService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly providerService: AiProviderService,
  ) {}

  async generateEmbedding(text: string): Promise<number[]> {
    const providers = this.providerService.getAvailableProviders();
    const hasOpenAI = providers.includes('OPENAI');

    if (hasOpenAI) {
      return this.generateOpenAIEmbedding(text);
    }

    // Fallback: return zero vector (embedding not available)
    this.logger.warn('No embedding provider available — using zero vector');
    return new Array(1536).fill(0) as number[];
  }

  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000), // Limit input
    });

    return response.data[0]?.embedding ?? new Array(1536).fill(0) as number[];
  }

  async storeEmbedding(
    entityType: string,
    entityId: string,
    content: string,
    model: string = 'text-embedding-3-small',
  ): Promise<void> {
    const embedding = await this.generateEmbedding(content);

    // Delete existing embeddings for this entity
    await this.prisma.$executeRaw`
      DELETE FROM "ai_embeddings"
      WHERE "entityType" = ${entityType}
      AND "entityId" = ${entityId}::uuid
    `;

    // Store new embedding
    // Note: pgvector insertion requires raw SQL for vector type
    await this.prisma.$executeRaw`
      INSERT INTO "ai_embeddings" ("entityType", "entityId", "content", "embedding", "model")
      VALUES (
        ${entityType},
        ${entityId}::uuid,
        ${content},
        ${JSON.stringify(embedding)}::vector,
        ${model}
      )
    `;
  }

  async searchSimilar(
    query: string,
    entityType: string,
    limit: number = 5,
    threshold: number = 0.7,
  ): Promise<Array<{ entityId: string; content: string; similarity: number }>> {
    const embedding = await this.generateEmbedding(query);

    const results = await this.prisma.$queryRaw<Array<{ entityId: string; content: string; similarity: number }>>`
      SELECT
        "entityId"::text,
        "content",
        1 - ("embedding" <=> ${JSON.stringify(embedding)}::vector) AS similarity
      FROM "ai_embeddings"
      WHERE "entityType" = ${entityType}
      AND 1 - ("embedding" <=> ${JSON.stringify(embedding)}::vector) > ${threshold}
      ORDER BY "embedding" <=> ${JSON.stringify(embedding)}::vector
      LIMIT ${limit}
    `;

    return results;
  }

  async indexVulnerability(vulnerabilityId: string, organizationId: string): Promise<void> {
    const vuln = await this.prisma.vulnerability.findFirst({
      where: { id: vulnerabilityId, organizationId },
      select: { title: true, description: true, solution: true, category: true, cveIds: true },
    });

    if (!vuln) return;

    const content = [
      vuln.title,
      vuln.description,
      vuln.solution ?? '',
      vuln.category,
      vuln.cveIds.join(' '),
    ].join(' ');

    await this.storeEmbedding('vulnerability', vulnerabilityId, content);
  }
}
