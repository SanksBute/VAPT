'use client';

import React from 'react';
import { useUxStore } from '@/store/ux.store';
import { HintBanner } from '@/components/ui/guide-tooltip';

export function AiCopilotIntro(): JSX.Element | null {
  return (
    <>
      <HintBanner
        id="ai-copilot-intro"
        title="🤖 Your personal AI security expert"
        description="This AI understands cybersecurity deeply and can explain everything in plain language. Ask about specific vulnerabilities you found, request step-by-step fix instructions, or just ask 'What should I do first?' — no question is too basic."
        variant="info"
      />

      <HintBanner
        id="ai-copilot-tips"
        title="💡 Get better answers with context"
        description="For the best help, include details like: 'I found a SQL injection vulnerability on my login page at mysite.com using WordPress 6.4. How do I fix it?' The more context you give, the more specific and useful the answer will be."
        variant="tip"
      />
    </>
  );
}
