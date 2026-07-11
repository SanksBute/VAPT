import type { Metadata } from 'next';
import { VulnerabilityDetail } from '@/components/vulnerabilities/vulnerability-detail';
import { VulnerabilityAiExplainer } from '@/components/vulnerabilities/vulnerability-ai-explainer';
import { VulnerabilityFixWizard } from '@/components/vulnerabilities/vulnerability-fix-wizard';
import { VulnerabilityTimeline } from '@/components/vulnerabilities/vulnerability-timeline';
import { VulnerabilityTickets } from '@/components/vulnerabilities/vulnerability-tickets';
import { VulnerabilityComments } from '@/components/vulnerabilities/vulnerability-comments';
import { VulnerabilityAffectedAssets } from '@/components/vulnerabilities/vulnerability-affected-assets';
import { VulnerabilityContextualHelp } from '@/components/vulnerabilities/vulnerability-contextual-help';

export const metadata: Metadata = { title: 'Vulnerability Details' };

export default function VulnerabilityDetailPage({
  params,
}: {
  params: { id: string };
}): JSX.Element {
  return (
    <div className="space-y-6">
      {/* Contextual help banner based on severity */}
      <VulnerabilityContextualHelp vulnerabilityId={params.id} />

      {/* Main details */}
      <VulnerabilityDetail vulnerabilityId={params.id} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* AI explanation in multiple levels */}
          <VulnerabilityAiExplainer
            vulnerabilityId={params.id}
            title=""
            severity=""
            description=""
            cveIds={[]}
            category=""
          />

          {/* Step-by-step fix wizard */}
          <VulnerabilityFixWizard
            vulnerabilityId={params.id}
            title=""
            severity=""
          />

          {/* History & comments */}
          <VulnerabilityTimeline vulnerabilityId={params.id} />
          <VulnerabilityComments vulnerabilityId={params.id} />
        </div>
        <div className="space-y-6">
          <VulnerabilityAffectedAssets vulnerabilityId={params.id} />
          <VulnerabilityTickets vulnerabilityId={params.id} />
        </div>
      </div>
    </div>
  );
}
