import type { Metadata } from 'next';
import { AiCopilotChat } from '@/components/ai/ai-copilot-chat';
import { AiConversationList } from '@/components/ai/ai-conversation-list';
import { AiCopilotIntro } from '@/components/ai/ai-copilot-intro';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'AI Security Copilot' };

export default function AiCopilotPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Security Copilot"
        description="Your personal AI security expert. Ask anything — from 'What does this vulnerability mean?' to 'How do I fix SQL injection?' No technical knowledge required."
        helpContext="ai-copilot"
      />

      <div className="flex h-[calc(100vh-12rem)] gap-4">
        {/* Conversation list */}
        <aside className="w-72 flex-shrink-0">
          <AiConversationList />
        </aside>

        {/* Chat area */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <AiCopilotIntro />
          <div className="flex-1">
            <AiCopilotChat />
          </div>
        </div>
      </div>
    </div>
  );
}
