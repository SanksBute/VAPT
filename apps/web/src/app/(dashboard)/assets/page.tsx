import type { Metadata } from 'next';
import { AssetsTable } from '@/components/assets/assets-table';
import { AssetStatCards } from '@/components/assets/asset-stat-cards';
import { AssetsFilters } from '@/components/assets/assets-filters';
import { PageHeader } from '@/components/ui/page-header';
import { HintBanner } from '@/components/ui/guide-tooltip';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Radar } from 'lucide-react';

export const metadata: Metadata = { title: 'Assets' };

export default function AssetsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Inventory"
        description="Everything you need to protect — websites, servers, databases, APIs, cloud resources, and more. Add your assets here to track their security status."
        helpContext="assets"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/assets/discover">
                <Radar className="h-4 w-4" />
                Auto-Discover
              </Link>
            </Button>
            <Button size="sm" asChild className="gap-1.5">
              <Link href="/assets/new">
                <Plus className="h-4 w-4" />
                Add Asset
              </Link>
            </Button>
          </div>
        }
      />

      <HintBanner
        id="assets-intro"
        title="What is an asset? 🏢"
        description="An asset is anything digital that belongs to your organization — your website, your servers, your mobile app, your cloud storage. Think of it like a property inventory, but for your digital properties. You can only protect what you know about!"
        variant="info"
        learnMoreConcept="attack-surface"
      />

      <HintBanner
        id="assets-criticality"
        title="💡 Tip: Set the right criticality level"
        description="Criticality tells SentinelX how important each asset is. Your customer-facing website should be 'Critical'. A developer test server can be 'Low'. This affects how vulnerabilities are prioritized."
        variant="tip"
      />

      <AssetStatCards />
      <AssetsFilters />
      <AssetsTable />
    </div>
  );
}
