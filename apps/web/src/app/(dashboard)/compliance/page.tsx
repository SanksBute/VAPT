import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { HintBanner } from '@/components/ui/guide-tooltip';
import { ComplianceView } from '@/components/compliance/compliance-view';

export const metadata: Metadata = { title: 'Compliance' };

export default function CompliancePage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description="Track how well your security measures meet frameworks like SOC 2, ISO 27001, PCI DSS, and NIST — and see exactly what to fix to close the gaps."
        helpContext="compliance"
      />
      <HintBanner
        id="compliance-intro"
        title="What is compliance? 📋"
        description="Compliance frameworks are checklists of security requirements that customers, auditors, and regulators expect you to meet. Run an assessment to see your score and where you fall short."
        variant="info"
      />
      <ComplianceView />
    </div>
  );
}
