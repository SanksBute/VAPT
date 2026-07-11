'use client';

import { useRouter } from 'next/navigation';
import { useUxStore } from '@/store/ux.store';
import { GuidedScanWizard } from './guided-scan-wizard';

export function GuidedScanWizardManager(): JSX.Element | null {
  const { scanWizardOpen, closeScanWizard } = useUxStore();
  const router = useRouter();

  if (!scanWizardOpen) return null;

  return (
    <GuidedScanWizard
      onClose={closeScanWizard}
      onComplete={(scanId) => {
        closeScanWizard();
        router.push(`/scans/${scanId}`);
      }}
    />
  );
}
