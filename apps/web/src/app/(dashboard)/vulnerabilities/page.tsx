import type { Metadata } from 'next';
import { VulnerabilitiesTable } from '@/components/vulnerabilities/vulnerabilities-table';
import { VulnerabilityStatCards } from '@/components/vulnerabilities/vulnerability-stat-cards';
import { VulnerabilityFilters } from '@/components/vulnerabilities/vulnerability-filters';
import { PageHeader } from '@/components/ui/page-header';
import { HintBanner } from '@/components/ui/guide-tooltip';

export const metadata: Metadata = { title: 'Vulnerabilities' };

export default function VulnerabilitiesPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vulnerabilities"
        description="Security weaknesses found in your systems. Each one is explained in plain language with step-by-step fix instructions."
        helpContext="vulnerabilities"
      />

      <HintBanner
        id="vulns-intro"
        title="Understanding vulnerabilities 🛡️"
        description="A vulnerability is a security weakness — like a broken lock or cracked window on your digital systems. Each one listed below was found in your systems by our scanners. Click any vulnerability to see what it means and how to fix it."
        variant="info"
        learnMoreConcept="vulnerability"
      />

      <HintBanner
        id="vulns-priority"
        title="Where to start? Start with Critical and High ⚠️"
        description="Sort by 'Risk Score' (already done by default) to see the most dangerous issues first. 'Critical' and 'High' vulnerabilities need to be fixed first — these are the ones attackers are most likely to exploit."
        variant="warning"
        learnMoreConcept="cvss"
      />

      <VulnerabilityStatCards />
      <VulnerabilityFilters />
      <VulnerabilitiesTable />
    </div>
  );
}
