import type { Metadata } from 'next';
import { ScanCategoryView } from '@/components/scans/scan-category-view';

export const metadata: Metadata = { title: 'Container Security' };

export default function ContainerSecurityPage(): JSX.Element {
  return (
    <ScanCategoryView
      title="Container Security"
      description="Scan your Docker images and Kubernetes workloads for vulnerable packages, insecure configurations, and exposed secrets before they reach production."
      helpContext="container-security"
      scanTypes={['CONTAINER_SECURITY']}
      hintTitle="Why scan containers? 📦"
      hintDescription="Container images often ship with outdated libraries that contain known vulnerabilities. This scan inspects your images layer by layer and tells you exactly what to update."
    />
  );
}
