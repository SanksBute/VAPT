import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { AICompletionOptions, AICompletionResult, AIStreamChunk, AIProviderType, AIMessage } from '@sentinelx/shared';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface ProviderConfig {
  provider: AIProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  timeout?: number;
}

@Injectable()
export class AiProviderService {
  private openaiClient: OpenAI | null = null;
  private anthropicClient: Anthropic | null = null;

  constructor(
    @InjectPinoLogger(AiProviderService.name)
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
  ) {
    this.initializeClients();
  }

  private initializeClients(): void {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.openaiClient = new OpenAI({
        apiKey: openaiKey,
        maxRetries: 3,
        timeout: 60000,
      });
    }

    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.anthropicClient = new Anthropic({
        apiKey: anthropicKey,
        maxRetries: 3,
        timeout: 60000,
      });
    }
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const startTime = Date.now();

    try {
      switch (options.provider) {
        case 'OPENAI':
          return await this.completeWithOpenAI(options, startTime);
        case 'ANTHROPIC':
          return await this.completeWithAnthropic(options, startTime);
        case 'OLLAMA':
          return await this.completeWithOllama(options, startTime);
        default:
          throw new BadRequestException(`Unsupported AI provider: ${options.provider}`);
      }
    } catch (error) {
      this.logger.error(
        { err: error, provider: options.provider, model: options.model },
        'AI completion failed',
      );
      throw error;
    }
  }

  async *stream(options: AICompletionOptions): AsyncGenerator<AIStreamChunk> {
    switch (options.provider) {
      case 'OPENAI':
        yield* this.streamWithOpenAI(options);
        break;
      case 'ANTHROPIC':
        yield* this.streamWithAnthropic(options);
        break;
      default:
        throw new BadRequestException(`Streaming not supported for provider: ${options.provider}`);
    }
  }

  private async completeWithOpenAI(
    options: AICompletionOptions,
    startTime: number,
  ): Promise<AICompletionResult> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const messages = this.buildOpenAIMessages(options);

    const completion = await this.openaiClient.chat.completions.create({
      model: options.model,
      messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 4096,
      top_p: options.topP ?? 1,
      tools: options.tools as OpenAI.Chat.ChatCompletionTool[] | undefined,
      tool_choice: options.toolChoice as OpenAI.Chat.ChatCompletionToolChoiceOption | undefined,
      response_format: options.responseFormat as OpenAI.ResponseFormatJSONObject | undefined,
    });

    const choice = completion.choices[0];
    const content = choice?.message?.content ?? '';
    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    const cost = this.calculateOpenAICost(options.model, inputTokens, outputTokens);

    return {
      id: completion.id,
      content,
      toolCalls: choice?.message?.tool_calls?.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost,
      model: options.model,
      provider: 'OPENAI',
      latencyMs: Date.now() - startTime,
      finishReason: (choice?.finish_reason as AICompletionResult['finishReason']) ?? 'stop',
    };
  }

  private async completeWithAnthropic(
    options: AICompletionOptions,
    startTime: number,
  ): Promise<AICompletionResult> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    const { systemMessage, userMessages } = this.buildAnthropicMessages(options);

    const response = await this.anthropicClient.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.1,
      system: systemMessage,
      messages: userMessages,
      tools: options.tools?.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters as Anthropic.Messages.Tool.InputSchema,
      })),
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const content = textContent?.type === 'text' ? textContent.text : '';
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = this.calculateAnthropicCost(options.model, inputTokens, outputTokens);

    const toolUseBlocks = response.content.filter((c) => c.type === 'tool_use');

    return {
      id: response.id,
      content,
      toolCalls: toolUseBlocks.length > 0 ? toolUseBlocks.filter((c) => c.type === 'tool_use').map((tc, i) => ({
        id: tc.type === 'tool_use' ? tc.id : `tool-${i}`,
        type: 'function' as const,
        function: {
          name: tc.type === 'tool_use' ? tc.name : '',
          arguments: JSON.stringify(tc.type === 'tool_use' ? tc.input : {}),
        },
      })) : undefined,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost,
      model: options.model,
      provider: 'ANTHROPIC',
      latencyMs: Date.now() - startTime,
      finishReason: response.stop_reason === 'max_tokens' ? 'length' : response.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
    };
  }

  private async completeWithOllama(
    options: AICompletionOptions,
    startTime: number,
  ): Promise<AICompletionResult> {
    const baseUrl = this.configService.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434');
    const messages = this.buildOpenAIMessages(options);

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.1,
          num_predict: options.maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const result = await response.json() as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
    const content = result.message?.content ?? '';
    const inputTokens = result.prompt_eval_count ?? 0;
    const outputTokens = result.eval_count ?? 0;

    return {
      id: `ollama-${Date.now()}`,
      content,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost: 0, // Local model, no cost
      model: options.model,
      provider: 'OLLAMA',
      latencyMs: Date.now() - startTime,
      finishReason: 'stop',
    };
  }

  private async *streamWithOpenAI(options: AICompletionOptions): AsyncGenerator<AIStreamChunk> {
    if (!this.openaiClient) throw new Error('OpenAI client not initialized');

    const messages = this.buildOpenAIMessages(options);

    const stream = await this.openaiClient.chat.completions.create({
      model: options.model,
      messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      fullContent += delta;
      const isComplete = chunk.choices[0]?.finish_reason !== null;

      yield {
        id: chunk.id,
        content: fullContent,
        delta,
        isComplete,
      };

      if (isComplete) break;
    }
  }

  private async *streamWithAnthropic(options: AICompletionOptions): AsyncGenerator<AIStreamChunk> {
    if (!this.anthropicClient) throw new Error('Anthropic client not initialized');

    const { systemMessage, userMessages } = this.buildAnthropicMessages(options);
    const id = `anthropic-${Date.now()}`;
    let fullContent = '';

    const stream = await this.anthropicClient.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.1,
      system: systemMessage,
      messages: userMessages,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const delta = event.delta.text;
        fullContent += delta;
        yield {
          id,
          content: fullContent,
          delta,
          isComplete: false,
        };
      } else if (event.type === 'message_stop') {
        yield {
          id,
          content: fullContent,
          delta: '',
          isComplete: true,
        };
      }
    }
  }

  private buildOpenAIMessages(options: AICompletionOptions): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const msg of options.messages) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      } else if (msg.role === 'system') {
        messages.push({ role: 'system', content: msg.content });
      }
    }

    return messages;
  }

  private buildAnthropicMessages(options: AICompletionOptions): {
    systemMessage: string;
    userMessages: Anthropic.Messages.MessageParam[];
  } {
    const systemParts: string[] = [];
    if (options.systemPrompt) systemParts.push(options.systemPrompt);

    const userMessages: Anthropic.Messages.MessageParam[] = [];

    for (const msg of options.messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else if (msg.role === 'user') {
        userMessages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        userMessages.push({ role: 'assistant', content: msg.content });
      }
    }

    return {
      systemMessage: systemParts.join('\n\n'),
      userMessages,
    };
  }

  private calculateOpenAICost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.000005, output: 0.000015 },
      'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
      'gpt-4-turbo': { input: 0.00001, output: 0.00003 },
      'gpt-3.5-turbo': { input: 0.0000005, output: 0.0000015 },
    };

    const rates = pricing[model] ?? { input: 0.000005, output: 0.000015 };
    return rates.input * inputTokens + rates.output * outputTokens;
  }

  private calculateAnthropicCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-opus-4-5': { input: 0.000015, output: 0.000075 },
      'claude-sonnet-4-5': { input: 0.000003, output: 0.000015 },
      'claude-haiku-3-5': { input: 0.00000025, output: 0.00000125 },
    };

    const rates = pricing[model] ?? { input: 0.000003, output: 0.000015 };
    return rates.input * inputTokens + rates.output * outputTokens;
  }

  getAvailableProviders(): AIProviderType[] {
    const providers: AIProviderType[] = [];
    if (this.openaiClient) providers.push('OPENAI');
    if (this.anthropicClient) providers.push('ANTHROPIC');
    providers.push('OLLAMA'); // Always show Ollama as option
    return providers;
  }
}
