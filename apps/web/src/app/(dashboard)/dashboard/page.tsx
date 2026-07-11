import type { Metadata } from 'next';
import { DashboardOverview } from '@/components/dashboard/dashboard-overview';
import { RecentScans } from '@/components/dashboard/recent-scans';
import { VulnerabilityTrend } from '@/components/dashboard/vulnerability-trend';
import { TopRiskyAssets } from '@/components/dashboard/top-risky-assets';
import { RiskScoreGauge } from '@/components/dashboard/risk-score-gauge';
import { ComplianceSummary } from '@/components/dashboard/compliance-summary';
import { AIInsightBanner } from '@/components/dashboard/ai-insight-banner';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { WhatToDoToday } from '@/components/dashboard/what-to-do-today';
import { PageHeader } from '@/components/ui/page-header';
import { HintBanner } from '@/components/ui/guide-tooltip';

export const metadata: Metadata = {
  title: 'Security Dashboard',
};

export default function DashboardPage(): JSX.Element {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Security Dashboard"
        description="Your real-time security posture overview — see what needs attention and track your progress."
        helpContext="dashboard"
        actions={<QuickActions />}
      />

      {/* First-time hint */}
      <HintBanner
        id="dashboard-intro"
        title="Welcome to your Security Dashboard 👋"
        description="This is your command center. The numbers at the top show your security status. Red = urgent, green = good. Scroll down to see what you should do today and why."
        variant="info"
        learnMoreConcept="vulnerability"
      />

      {/* AI insight banner */}
      <AIInsightBanner />

      {/* Overview metrics */}
      <DashboardOverview />

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* What to do today — main priority */}
        <div className="lg:col-span-2">
          <WhatToDoToday />
        </div>

        {/* Risk score gauge */}
        <RiskScoreGauge />
      </div>

      {/* Vulnerability trend + compliance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <VulnerabilityTrend />
        <ComplianceSummary />
      </div>

      {/* Bottom grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopRiskyAssets />
        <RecentScans />
      </div>
    </div>
  );
}
