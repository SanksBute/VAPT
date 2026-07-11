'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, StopCircle, Copy, ThumbsUp, Brain, User, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { apiPost, apiStream } from '@/lib/api-client';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  tokensUsed?: number;
  model?: string;
  isStreaming?: boolean;
}

interface ChatResult {
  conversationId: string;
  messageId: string;
  content: string;
  tokensUsed: number;
  cost: number;
  model: string;
}

const SUGGESTED_PROMPTS = [
  'What are my most critical vulnerabilities that need immediate attention?',
  'Summarize the security posture of my organization',
  'Which assets are most at risk right now?',
  'Help me understand CVE-2024-12345 and how to fix it',
  'Generate a remediation plan for my high-severity findings',
  'What compliance gaps do I have for PCI DSS?',
  'Explain the attack chain for the vulnerabilities in my web app',
  'What threat actors are targeting my industry right now?',
];

export function AiCopilotChat(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [model, setModel] = useState('claude-sonnet-4-5');
  const [provider, setProvider] = useState('ANTHROPIC');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuthStore();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const sendMessage = async (messageText?: string): Promise<void> => {
    const text = (messageText ?? input).trim();
    if (!text || isStreaming) return;

    setInput('');

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const gen = apiStream('/ai/chat/stream', {
        message: text,
        conversationId,
        provider,
        model,
      });

      let fullContent = '';
      let newConversationId = conversationId;

      for await (const chunk of gen) {
        if (abortRef.current?.signal.aborted) break;
        fullContent = chunk.content;
        setStreamingContent(fullContent);
        if (chunk.isComplete) break;
      }

      // Add complete message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: fullContent,
        createdAt: new Date().toISOString(),
        model,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
    } catch (err) {
      console.error('AI stream error:', err);
      const status = (err as { statusCode?: number })?.statusCode;
      const raw = err instanceof Error ? err.message : '';
      const looksLikeAuth =
        status === 401 || /api key|x-api-key|unauthorized|incorrect api key|invalid.*key/i.test(raw);
      const content = looksLikeAuth
        ? `⚠️ The AI provider isn't configured correctly. The **${provider}** API key is missing or invalid. Add a valid key to the server's environment (\`${provider === 'ANTHROPIC' ? 'ANTHROPIC_API_KEY' : provider === 'OPENAI' ? 'OPENAI_API_KEY' : 'OLLAMA_BASE_URL'}\`) and restart the API, or switch providers using the selector above.`
        : 'I encountered an error processing your request. Please try again in a moment.';
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStreamingContent('');
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleStop = (): void => {
    abortRef.current?.abort();
    setIsStreaming(false);
    if (streamingContent) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: streamingContent + ' [stopped]',
          createdAt: new Date().toISOString(),
        },
      ]);
      setStreamingContent('');
    }
  };

  const handleCopy = async (content: string): Promise<void> => {
    await navigator.clipboard.writeText(content);
  };

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <Card className="flex flex-col h-full">
      {/* Header */}
      <CardHeader className="pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">AI Security Copilot</CardTitle>
              <p className="text-xs text-muted-foreground">Powered by {model}</p>
            </div>
          </div>

          {/* Model selector */}
          <div className="flex items-center gap-2">
            <Select
              value={provider}
              onValueChange={(next) => {
                setProvider(next);
                setModel(
                  next === 'OPENAI'
                    ? 'gpt-4o'
                    : next === 'OLLAMA'
                      ? 'llama3.2'
                      : 'claude-sonnet-4-5',
                );
              }}
            >
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPENAI">OpenAI</SelectItem>
                <SelectItem value="ANTHROPIC">Anthropic</SelectItem>
                <SelectItem value="OLLAMA">Ollama (Local)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {provider === 'OPENAI' && (
                  <>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  </>
                )}
                {provider === 'ANTHROPIC' && (
                  <>
                    <SelectItem value="claude-opus-4-5">Claude Opus</SelectItem>
                    <SelectItem value="claude-sonnet-4-5">Claude Sonnet</SelectItem>
                    <SelectItem value="claude-haiku-4-5">Claude Haiku</SelectItem>
                  </>
                )}
                {provider === 'OLLAMA' && (
                  <>
                    <SelectItem value="llama3.2">Llama 3.2</SelectItem>
                    <SelectItem value="mistral">Mistral 7B</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6 py-8">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">How can I help you today?</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Ask me about vulnerabilities, compliance, threat intelligence, or security best practices.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGGESTED_PROMPTS.slice(0, 4).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void sendMessage(prompt)}
                  className="text-left text-xs p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onCopy={handleCopy} />
        ))}

        {/* Streaming indicator */}
        {isStreaming && streamingContent && (
          <MessageBubble
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingContent,
              createdAt: new Date().toISOString(),
              isStreaming: true,
            }}
            onCopy={handleCopy}
          />
        )}

        {isStreaming && !streamingContent && (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2 w-2 rounded-full bg-primary/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 flex-shrink-0">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about vulnerabilities, compliance, threat intelligence..."
            className="resize-none pr-24 min-h-[72px] max-h-48"
            rows={3}
            disabled={isStreaming}
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <span className="text-xs text-muted-foreground">
              {isStreaming ? '' : 'Enter ↵ to send'}
            </span>
            {isStreaming ? (
              <Button variant="destructive" size="sm" className="h-7 px-2" onClick={handleStop}>
                <StopCircle className="h-3 w-3 mr-1" /> Stop
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 px-3"
                onClick={() => void sendMessage()}
                disabled={!input.trim()}
              >
                <Send className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          AI may make mistakes. Verify critical security information independently.
        </p>
      </div>
    </Card>
  );
}

function MessageBubble({
  message,
  onCopy,
}: {
  message: Message;
  onCopy: (content: string) => Promise<void>;
}): JSX.Element {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-primary/20',
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Brain className="h-4 w-4 text-primary" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0 space-y-1', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-xl px-4 py-3 text-sm max-w-[85%]',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-none'
              : 'bg-muted rounded-tl-none',
          )}
        >
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
            {message.isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse" />
            )}
          </div>
        </div>

        {/* Actions */}
        {!isUser && !message.isStreaming && (
          <div className="flex items-center gap-1 px-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => void onCopy(message.content)}
              title="Copy"
            >
              <Copy className="h-3 w-3" />
            </Button>
            {message.model && (
              <span className="text-xs text-muted-foreground ml-1">{message.model}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
