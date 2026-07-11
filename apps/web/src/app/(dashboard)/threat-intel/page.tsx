import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { HintBanner } from '@/components/ui/guide-tooltip';
import { ThreatIntelView } from '@/components/threat-intel/threat-intel-view';

export const metadata: Metadata = { title: 'Threat Intelligence' };

export default function ThreatIntelPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Threat Intelligence"
        description="Live feeds of the latest attacker infrastructure, malware, and indicators of compromise — so you can spot threats relevant to your organization early."
        helpContext="threat-intel"
      />
      <HintBanner
        id="threat-intel-intro"
        title="What is threat intelligence? 🛰️"
        description="Threat intelligence is up-to-date information about known malicious IP addresses, domains, and file signatures. We match it against your environment so you know if you've been touched by a known threat."
        variant="info"
      />
      <ThreatIntelView />
    </div>
  );
}
