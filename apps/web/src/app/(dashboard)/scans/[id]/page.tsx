import type { Metadata } from 'next';
import { ScanDetails } from '@/components/scans/scan-details';
import { LiveScanProgress } from '@/components/scans/live-scan-progress';
import { ScanFindings } from '@/components/scans/scan-findings';
import { ScanTimeline } from '@/components/scans/scan-timeline';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Scan Details' };

export default function ScanDetailPage({
  params,
}: {
  params: { id: string };
}): JSX.Element {
  return (
    <div className="space-y-6">
      <ScanDetails scanId={params.id} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ScanFindings scanId={params.id} />
        </div>
        <div className="space-y-6">
          <LiveScanProgress scanId={params.id} />
          <ScanTimeline scanId={params.id} />
        </div>
      </div>
    </div>
  );
}
