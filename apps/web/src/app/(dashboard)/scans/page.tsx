import type { Metadata } from 'next';
import { ScansTable } from '@/components/scans/scans-table';
import { ScanStatCards } from '@/components/scans/scan-stat-cards';
import { ScansFilters } from '@/components/scans/scans-filters';
import { PageHeader } from '@/components/ui/page-header';
import { HintBanner } from '@/components/ui/guide-tooltip';
import { NewScanButton } from '@/components/scans/new-scan-button';

export const metadata: Metadata = { title: 'Scans' };

export default function ScansPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Scans"
        description="Run automated security tests to find vulnerabilities in your websites, servers, APIs, and applications. Results are explained in plain language."
        helpContext="scans"
        actions={<NewScanButton />}
      />

      <HintBanner
        id="scans-intro"
        title="What is a security scan? 🔍"
        description="A scan is an automated process that checks your systems for known security weaknesses — like a very fast, thorough security inspection. It doesn't make changes to your system; it just looks for problems and reports them."
        variant="info"
        learnMoreConcept="vulnerability-assessment"
      />

      <ScanStatCards />
      <ScansFilters />
      <ScansTable />
    </div>
  );
}
