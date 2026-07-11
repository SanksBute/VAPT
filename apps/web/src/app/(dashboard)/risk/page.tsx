import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { HintBanner } from '@/components/ui/guide-tooltip';
import { RiskView } from '@/components/risk/risk-view';

export const metadata: Metadata = { title: 'Risk Management' };

export default function RiskPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Management"
        description="A single, prioritized view of the security risk facing your organization — so you always know what matters most and what to tackle first."
        helpContext="risk"
      />
      <HintBanner
        id="risk-intro"
        title="Understanding your risk score 📊"
        description="Your risk score combines the severity of your vulnerabilities, how exploitable they are, and how important the affected systems are. Lower is better — aim to bring it down over time."
        variant="info"
      />
      <RiskView />
    </div>
  );
}
