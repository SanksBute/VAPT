import type { Metadata } from 'next';
import { ScanCategoryView } from '@/components/scans/scan-category-view';

export const metadata: Metadata = { title: 'API Security' };

export default function ApiSecurityPage(): JSX.Element {
  return (
    <ScanCategoryView
      title="API Security"
      description="Security testing for your REST, GraphQL, and other APIs — checks for broken authorization, data exposure, injection, and the OWASP API Security Top 10."
      helpContext="api-security"
      scanTypes={['API_SECURITY']}
      hintTitle="Why test APIs separately? 🔑"
      hintDescription="APIs power your apps and integrations but are often less protected than websites. This scan checks whether your APIs leak data, allow unauthorized access, or can be abused."
    />
  );
}
