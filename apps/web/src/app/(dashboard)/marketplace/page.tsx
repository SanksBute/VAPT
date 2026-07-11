import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { HintBanner } from '@/components/ui/guide-tooltip';
import { MarketplaceView } from '@/components/marketplace/marketplace-view';

export const metadata: Metadata = { title: 'Marketplace' };

export default function MarketplacePage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description="Extend SentinelX with integrations and plugins — connect your ticketing, chat, and cloud tools, or add specialized scanners and enrichment sources."
        helpContext="marketplace"
      />
      <HintBanner
        id="marketplace-intro"
        title="Extend your platform 🧩"
        description="Plugins add new capabilities and connect SentinelX to the tools you already use — like Slack, Jira, and cloud providers. Browse and install with one click."
        variant="info"
      />
      <MarketplaceView />
    </div>
  );
}
