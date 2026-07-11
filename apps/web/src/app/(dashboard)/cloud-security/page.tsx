import type { Metadata } from 'next';
import { ScanCategoryView } from '@/components/scans/scan-category-view';

export const metadata: Metadata = { title: 'Cloud Security' };

export default function CloudSecurityPage(): JSX.Element {
  return (
    <ScanCategoryView
      title="Cloud Security"
      description="Assess your AWS, Azure, and Google Cloud environments for misconfigurations, over-permissive access, exposed storage, and compliance gaps."
      helpContext="cloud-security"
      scanTypes={['CLOUD_SECURITY', 'KUBERNETES_SECURITY']}
      hintTitle="What is cloud security posture? ☁️"
      hintDescription="Most cloud breaches come from simple misconfigurations — a public storage bucket or an over-privileged account. This scan reviews your cloud settings against security best practices."
    />
  );
}
