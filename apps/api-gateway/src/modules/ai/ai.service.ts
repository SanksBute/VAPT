import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../database/prisma.service';
import { AiProviderService } from './services/ai-provider.service';
import { AiMemoryService } from './services/ai-memory.service';
import { AiToolsService } from './services/ai-tools.service';
import { AiEmbeddingService } from './services/ai-embedding.service';
import { AiAnalysisService } from './services/ai-analysis.service';
import type { AICompletionOptions, AIStreamChunk, AIMessage, AuthContext } from '@sentinelx/shared';
import { AIProvider } from '@prisma/client';

interface ChatOptions {
  message: string;
  conversationId?: string;
  context?: string;
  contextId?: string;
  stream?: boolean;
  provider?: string;
  model?: string;
}

export interface ChatResult {
  conversationId: string;
  messageId: string;
  content: string;
  tokensUsed: number;
  cost: number;
  model: string;
}

const SECURITY_COPILOT_SYSTEM_PROMPT = `You are SentinelX AI Security Copilot — an expert AI assistant specialized in offensive and defensive cybersecurity for enterprise organizations.

You have access to the organization's security data including vulnerabilities, assets, scans, compliance status, and threat intelligence.

Your capabilities include:
- Analyzing vulnerabilities and providing detailed remediation guidance
- Explaining attack vectors and exploitation techniques for educational purposes
- Generating security reports and summaries
- Providing compliance guidance for SOC2, ISO27001, PCI DSS, HIPAA, NIST, and OWASP
- Answering questions about penetration testing methodologies (OWASP, PTES, NIST)
- Providing threat intelligence analysis and IOC correlation
- Risk assessment and prioritization recommendations
- Suggesting security architecture improvements

Always:
- Be precise and technically accurate
- Provide actionable recommendations
- Use CVSS scores and industry-standard severity ratings
- Reference compliance frameworks when relevant
- Consider business context and asset criticality
- Cite CVEs and CWEs when discussing specific vulnerabilities

Security boundaries:
- Never provide instructions that enable attacks against systems without authorization
- Always emphasize authorized testing and responsible disclosure
- Recommend defense-in-depth strategies`;

@Injectable()
export class AiService {
  constructor(
    @InjectPinoLogger(AiService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly providerService: AiProviderService,
    private readonly memoryService: AiMemoryService,
    private readonly toolsService: AiToolsService,
    private readonly embeddingService: AiEmbeddingService,
    private readonly analysisService: AiAnalysisService,
  ) {}

  async chat(options: ChatOptions, user: AuthContext): Promise<ChatResult> {
    // Check AI feature availability
    await this.checkAiAccess(user.organizationId);

    let conversationId = options.conversationId;

    // Create new conversation if not provided
    if (!conversationId) {
      const provider = (options.provider ?? 'ANTHROPIC') as string;
      const model = options.model ?? this.getDefaultModel(provider);

      conversationId = await this.memoryService.createConversation({
        organizationId: user.organizationId,
        userId: user.userId,
        context: options.context,
        contextId: options.contextId,
        provider,
        model,
        systemPrompt: SECURITY_COPILOT_SYSTEM_PROMPT,
      });
    }

    // Get conversation history
    const memory = await this.memoryService.getConversationMemory(conversationId);

    // Verify conversation belongs to user's organization
    await this.verifyConversationAccess(conversationId, user.organizationId);

    // Build context from RAG if relevant
    const ragContext = await this.buildRagContext(options.message, user.organizationId);

    // Get org context (current stats)
    const orgContext = await this.buildOrganizationContext(user.organizationId);

    // Prepare messages
    const userMessage: AIMessage = {
      role: 'user',
      content: options.message,
    };

    const allMessages: AIMessage[] = [
      ...memory.messages,
      userMessage,
    ];

    // Trim to context window
    const trimmedMessages = this.memoryService.trimToContextWindow(allMessages, 100000);

    const provider = (options.provider ?? 'ANTHROPIC') as string;
    const model = options.model ?? this.getDefaultModel(provider);

    const completionOptions: AICompletionOptions = {
      provider: provider as AICompletionOptions['provider'],
      model,
      messages: trimmedMessages,
      systemPrompt: [
        SECURITY_COPILOT_SYSTEM_PROMPT,
        orgContext ? `\n\nCurrent Organization Context:\n${orgContext}` : '',
        ragContext ? `\n\nRelevant Security Knowledge:\n${ragContext}` : '',
      ].filter(Boolean).join(''),
      temperature: 0.2,
      maxTokens: 4096,
      tools: this.toolsService.getToolDefinitions(),
      toolChoice: 'auto',
    };

    // Execute completion with tool calls support
    const result = await this.executeWithTools(completionOptions, user.organizationId);

    // Store messages
    await this.memoryService.appendMessage(conversationId, userMessage, result.inputTokens);
    await this.memoryService.appendMessage(
      conversationId,
      { role: 'assistant', content: result.content },
      result.outputTokens,
    );

    // Update conversation stats
    await this.memoryService.updateConversationStats(
      conversationId,
      result.inputTokens,
      result.outputTokens,
      result.cost,
    );

    // Auto-generate title for new conversations
    if (memory.messages.length === 0) {
      void this.generateConversationTitle(conversationId, options.message, result.content);
    }

    // Store the assistant message to get its ID
    const messageRecord = await this.prisma.aIMessage.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    this.logger.debug(
      { conversationId, tokens: result.totalTokens, cost: result.cost },
      'AI chat completed',
    );

    return {
      conversationId,
      messageId: messageRecord?.id ?? 'unknown',
      content: result.content,
      tokensUsed: result.totalTokens,
      cost: result.cost,
      model: result.model,
    };
  }

  async *chatStream(
    options: ChatOptions,
    user: AuthContext,
  ): AsyncGenerator<AIStreamChunk> {
    await this.checkAiAccess(user.organizationId);

    const provider = (options.provider ?? 'ANTHROPIC') as AICompletionOptions['provider'];
    const model = options.model ?? this.getDefaultModel(provider);

    let conversationId = options.conversationId;
    if (!conversationId) {
      conversationId = await this.memoryService.createConversation({
        organizationId: user.organizationId,
        userId: user.userId,
        context: options.context,
        contextId: options.contextId,
        provider,
        model,
        systemPrompt: SECURITY_COPILOT_SYSTEM_PROMPT,
      });
    }

    const memory = await this.memoryService.getConversationMemory(conversationId);
    const userMessage: AIMessage = { role: 'user', content: options.message };
    const allMessages = [...memory.messages, userMessage];
    const trimmedMessages = this.memoryService.trimToContextWindow(allMessages);

    let fullContent = '';

    for await (const chunk of this.providerService.stream({
      provider,
      model,
      messages: trimmedMessages,
      systemPrompt: SECURITY_COPILOT_SYSTEM_PROMPT,
      temperature: 0.2,
      maxTokens: 4096,
    })) {
      fullContent = chunk.content;
      yield { ...chunk, id: conversationId };

      if (chunk.isComplete) {
        // Persist messages
        await this.memoryService.appendMessage(conversationId, userMessage);
        await this.memoryService.appendMessage(
          conversationId,
          { role: 'assistant', content: fullContent },
        );
      }
    }
  }

  async analyzeVulnerability(
    vulnerabilityId: string,
    user: AuthContext,
  ): Promise<unknown> {
    await this.checkAiAccess(user.organizationId);
    return this.analysisService.analyzeVulnerability(vulnerabilityId, user.organizationId);
  }

  async generateScanSummary(scanId: string, user: AuthContext): Promise<{ summary: string }> {
    await this.checkAiAccess(user.organizationId);
    const summary = await this.analysisService.generateScanSummary(scanId, user.organizationId);
    return { summary };
  }

  async listConversations(user: AuthContext): Promise<unknown[]> {
    return this.prisma.aIConversation.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.userId,
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        context: true,
        provider: true,
        model: true,
        tokenCount: true,
        cost: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    });
  }

  async getConversation(conversationId: string, user: AuthContext): Promise<unknown> {
    const conversation = await this.prisma.aIConversation.findFirst({
      where: {
        id: conversationId,
        organizationId: user.organizationId,
        userId: user.userId,
        deletedAt: null,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            inputTokens: true,
            outputTokens: true,
            cost: true,
            latencyMs: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async deleteConversation(conversationId: string, user: AuthContext): Promise<void> {
    await this.verifyConversationAccess(conversationId, user.organizationId);
    await this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: { deletedAt: new Date() },
    });
  }

  async getAvailableModels(user: AuthContext): Promise<unknown> {
    const models = await this.prisma.aIModelConfig.findMany({
      where: { isActive: true },
      orderBy: [{ provider: 'asc' }, { displayName: 'asc' }],
    });

    const availableProviders = this.providerService.getAvailableProviders();

    return models.filter((m) => availableProviders.includes(m.provider as AICompletionOptions['provider']));
  }

  private async executeWithTools(
    options: AICompletionOptions,
    orgId: string,
  ): Promise<ReturnType<AiProviderService['complete']> extends Promise<infer T> ? T : never> {
    let result = await this.providerService.complete(options);

    // Handle tool calls (agentic loop — max 5 iterations)
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (result.toolCalls && result.toolCalls.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      const toolResults: AIMessage[] = [];

      for (const toolCall of result.toolCalls) {
        try {
          let toolParams: Record<string, unknown> = {};
          try {
            toolParams = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          } catch {
            toolParams = {};
          }

          const toolResult = await this.toolsService.executeTool(
            toolCall.function.name,
            toolParams,
            orgId,
          );

          toolResults.push({
            role: 'tool',
            content: JSON.stringify(toolResult),
            toolCallId: toolCall.id,
          });
        } catch (err) {
          toolResults.push({
            role: 'tool',
            content: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
            toolCallId: toolCall.id,
          });
        }
      }

      // Continue conversation with tool results
      const updatedMessages: AIMessage[] = [
        ...options.messages,
        { role: 'assistant', content: result.content, toolCalls: result.toolCalls },
        ...toolResults,
      ];

      result = await this.providerService.complete({
        ...options,
        messages: updatedMessages,
      });
    }

    return result;
  }

  private async buildRagContext(query: string, orgId: string): Promise<string | null> {
    try {
      const similar = await this.embeddingService.searchSimilar(
        query,
        'vulnerability',
        3,
        0.75,
      );

      if (similar.length === 0) return null;

      return `Relevant vulnerabilities from your organization:\n${
        similar.map((s) => `- ${s.content.substring(0, 200)}`).join('\n')
      }`;
    } catch {
      return null;
    }
  }

  private async buildOrganizationContext(orgId: string): Promise<string | null> {
    try {
      const [vulnStats, assetCount, scanCount] = await Promise.all([
        this.prisma.vulnerability.groupBy({
          by: ['severity'],
          where: { organizationId: orgId, status: 'OPEN', deletedAt: null },
          _count: true,
        }),
        this.prisma.asset.count({ where: { organizationId: orgId, deletedAt: null } }),
        this.prisma.scan.count({
          where: {
            organizationId: orgId,
            deletedAt: null,
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      const vulnSummary = Object.fromEntries(vulnStats.map((s) => [s.severity, s._count]));

      return [
        `Total Assets: ${assetCount}`,
        `Scans (last 30 days): ${scanCount}`,
        `Open Vulnerabilities: Critical=${vulnSummary['CRITICAL'] ?? 0}, High=${vulnSummary['HIGH'] ?? 0}, Medium=${vulnSummary['MEDIUM'] ?? 0}, Low=${vulnSummary['LOW'] ?? 0}`,
      ].join('\n');
    } catch {
      return null;
    }
  }

  private async checkAiAccess(orgId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { enabledFeatures: true, status: true },
    });

    if (!org || org.status === 'SUSPENDED') {
      throw new ForbiddenException('AI features are not available');
    }
  }

  private async verifyConversationAccess(conversationId: string, orgId: string): Promise<void> {
    const conversation = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
  }

  private getDefaultModel(provider: string): string {
    const defaults: Record<string, string> = {
      OPENAI: 'gpt-4o',
      ANTHROPIC: 'claude-sonnet-4-5',
      OLLAMA: 'llama3.2',
    };
    return defaults[provider] ?? 'claude-sonnet-4-5';
  }

  private async generateConversationTitle(
    conversationId: string,
    userMessage: string,
    assistantResponse: string,
  ): Promise<void> {
    try {
      const providers = this.providerService.getAvailableProviders();
      const provider = providers[0];
      if (!provider) return;

      const result = await this.providerService.complete({
        provider,
        model: provider === 'ANTHROPIC' ? 'claude-haiku-3-5' : 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Generate a concise 3-6 word title for this security conversation:\nUser: ${userMessage.substring(0, 200)}\nAssistant: ${assistantResponse.substring(0, 200)}\n\nRespond with only the title, no quotes.`,
          },
        ],
        maxTokens: 50,
        temperature: 0.3,
      });

      const title = result.content.trim().replace(/^["']|["']$/g, '').substring(0, 100);
      await this.memoryService.updateConversationTitle(conversationId, title);
    } catch {
      // Non-critical, ignore errors
    }
  }
}
