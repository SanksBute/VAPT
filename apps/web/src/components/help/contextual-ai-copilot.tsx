'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Send, Sparkles, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUxStore } from '@/store/ux.store';
import { apiStream } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS: Record<string, string[]> = {
  default: [
    'What should I focus on right now?',
    'Explain the most critical issue I have',
    'How do I get started with security testing?',
    'What is a vulnerability?',
  ],
  scans: [
    'What scan should I run first?',
    'How long will a full scan take?',
    'Is it safe to scan my production server?',
    'What is port scanning?',
  ],
  vulnerabilities: [
    'Explain this vulnerability in simple terms',
    'How urgent is it to fix a Critical vulnerability?',
    'What does "exploit available" mean?',
    'How do I verify a vulnerability is fixed?',
  ],
  assets: [
    'What assets should I add first?',
    'What is an attack surface?',
    'How do I find assets I might have missed?',
    'What does "Internet-facing" mean?',
  ],
  compliance: [
    'Do I need SOC 2 for my business?',
    'What is PCI DSS?',
    'How long does compliance certification take?',
    'What happens if I\'m not compliant?',
  ],
  'ai-copilot': [
    'What can you help me with?',
    'How do I use this AI assistant?',
    'Can you analyze my scan results?',
    'Help me write a security report',
  ],
};

export function ContextualAiCopilot(): JSX.Element {
  const { copilotOpen, copilotContext, closeCopilot } = useUxStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pageKey = copilotContext?.page ?? 'default';
  const quickPrompts = QUICK_PROMPTS[pageKey] ?? QUICK_PROMPTS.default;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent]);

  const sendMessage = async (text?: string): Promise<void> => {
    const messageText = (text ?? input).trim();
    if (!messageText || isStreaming) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: messageText }]);
    setIsStreaming(true);
    setStreamContent('');

    const contextPrompt = copilotContext
      ? `Context: The user is currently on the ${copilotContext.page} page of SentinelX AI${copilotContext.entityType ? `, looking at ${copilotContext.entityType} ${copilotContext.entityId ?? ''}` : ''}.`
      : '';

    try {
      const gen = apiStream('/ai/chat/stream', {
        message: contextPrompt ? `${contextPrompt}\n\nUser question: ${messageText}` : messageText,
        context: copilotContext?.page,
        contextId: copilotContext?.entityId,
      });

      let fullContent = '';
      for await (const chunk of gen) {
        fullContent = chunk.content;
        setStreamContent(fullContent);
        if (chunk.isComplete) break;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fullContent }]);
      setStreamContent('');
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'I\'m having trouble connecting right now. Please try again in a moment.',
      }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const copyMessage = async (content: string, index: number): Promise<void> => {
    await navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const clearChat = (): void => {
    setMessages([]);
    setStreamContent('');
  };

  return (
    <AnimatePresence>
      {copilotOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm"
            onClick={closeCopilot}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm">AI Security Assistant</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Available 24/7
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                    title="Clear conversation"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
                <button onClick={closeCopilot} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && !isStreaming && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="text-3xl mb-2">🤖</div>
                    <p className="font-semibold text-sm">How can I help you?</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ask me anything about security — I explain everything in plain language.
                    </p>
                  </div>

                  {/* Quick prompts */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Try asking:
                    </p>
                    <div className="space-y-1.5">
                      {quickPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => void sendMessage(prompt)}
                          className="w-full text-left text-xs p-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}>
                  <div className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary/20',
                  )}>
                    {msg.role === 'user' ? 'U' : '🤖'}
                  </div>
                  <div className={cn(
                    'flex-1 min-w-0 group',
                    msg.role === 'user' && 'flex flex-col items-end',
                  )}>
                    <div className={cn(
                      'rounded-xl px-3 py-2 text-xs leading-relaxed max-w-[90%]',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-muted rounded-tl-none',
                    )}>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => void copyMessage(msg.content, i)}
                        className="opacity-0 group-hover:opacity-100 mt-1 text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-all"
                      >
                        {copiedIndex === i ? (
                          <><Check className="h-3 w-3 text-green-500" /> Copied</>
                        ) : (
                          <><Copy className="h-3 w-3" /> Copy</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {isStreaming && (
                <div className="flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs">🤖</div>
                  <div className="flex-1">
                    <div className="bg-muted rounded-xl rounded-tl-none px-3 py-2 text-xs">
                      {streamContent || (
                        <div className="flex gap-1 items-center">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Ask anything... no question is too basic"
                  className="resize-none text-xs min-h-[40px] max-h-32"
                  rows={2}
                  disabled={isStreaming}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 flex-shrink-0"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || isStreaming}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                AI responses are for guidance — verify critical security decisions with experts
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
