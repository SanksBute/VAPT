import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { AIMessage } from '@sentinelx/shared';

export interface ConversationMemory {
  conversationId: string;
  messages: AIMessage[];
  tokenCount: number;
  context?: Record<string, unknown>;
}

@Injectable()
export class AiMemoryService {
  private readonly MAX_CONTEXT_TOKENS = 100000;
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    @InjectPinoLogger(AiMemoryService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getConversationMemory(conversationId: string): Promise<ConversationMemory> {
    const cacheKey = `ai:conversation:${conversationId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as ConversationMemory;
    }

    const messages = await this.prisma.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        content: true,
        toolCalls: true,
        inputTokens: true,
        outputTokens: true,
      },
    });

    const memory: ConversationMemory = {
      conversationId,
      messages: messages.map((m) => ({
        role: m.role as AIMessage['role'],
        content: m.content,
        toolCalls: m.toolCalls as unknown as AIMessage['toolCalls'],
      })),
      tokenCount: messages.reduce((acc, m) => acc + m.inputTokens + m.outputTokens, 0),
    };

    await this.redis.set(cacheKey, JSON.stringify(memory), this.CACHE_TTL);
    return memory;
  }

  async appendMessage(conversationId: string, message: AIMessage, tokens: number = 0): Promise<void> {
    await this.prisma.aIMessage.create({
      data: {
        conversationId,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls as unknown as Prisma.InputJsonValue,
        inputTokens: message.role === 'user' ? tokens : 0,
        outputTokens: message.role === 'assistant' ? tokens : 0,
        cost: 0,
      },
    });

    // Invalidate cache
    await this.redis.del(`ai:conversation:${conversationId}`);
  }

  trimToContextWindow(messages: AIMessage[], maxTokens: number = this.MAX_CONTEXT_TOKENS): AIMessage[] {
    // Always keep system message and recent messages
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    // Estimate tokens (rough approximation: 1 token ≈ 4 chars)
    const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

    const systemTokens = systemMessages.reduce((acc, m) => acc + estimateTokens(m.content), 0);
    const availableTokens = maxTokens - systemTokens - 2000; // Reserve 2000 tokens for response

    const trimmedMessages: AIMessage[] = [];
    let tokenCount = 0;

    // Add messages from most recent to oldest until we hit the limit
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const msg = conversationMessages[i];
      if (!msg) continue;
      const msgTokens = estimateTokens(msg.content);
      if (tokenCount + msgTokens > availableTokens && trimmedMessages.length > 0) {
        break;
      }
      trimmedMessages.unshift(msg);
      tokenCount += msgTokens;
    }

    return [...systemMessages, ...trimmedMessages];
  }

  async createConversation(params: {
    organizationId: string;
    userId: string;
    title?: string;
    context?: string;
    contextId?: string;
    provider: string;
    model: string;
    systemPrompt?: string;
  }): Promise<string> {
    const conversation = await this.prisma.aIConversation.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        title: params.title,
        context: params.context,
        contextId: params.contextId,
        provider: params.provider as Parameters<typeof this.prisma.aIConversation.create>[0]['data']['provider'],
        model: params.model,
        systemPrompt: params.systemPrompt,
      },
    });

    return conversation.id;
  }

  async updateConversationStats(
    conversationId: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
  ): Promise<void> {
    await this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: {
        tokenCount: { increment: inputTokens + outputTokens },
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        cost: { increment: cost },
      },
    });
  }

  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    await this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }
}
