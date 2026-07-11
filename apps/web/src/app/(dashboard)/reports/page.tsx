import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { HintBanner } from '@/components/ui/guide-tooltip';
import { ReportsView } from '@/components/reports/reports-view';

export const metadata: Metadata = { title: 'Reports' };

export default function ReportsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate polished, shareable security reports — executive summaries for leadership, technical detail for engineers, and compliance evidence for auditors."
        helpContext="reports"
      />
      <HintBanner
        id="reports-intro"
        title="Turn findings into reports 📄"
        description="Pick a report type and format, and we'll compile your latest security data into a professional document you can download and share with your team, customers, or auditors."
        variant="info"
      />
      <ReportsView />
    </div>
  );
}
