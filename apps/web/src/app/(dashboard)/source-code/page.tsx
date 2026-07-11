import type { Metadata } from 'next';
import { ScanCategoryView } from '@/components/scans/scan-category-view';

export const metadata: Metadata = { title: 'Source Code Analysis' };

export default function SourceCodePage(): JSX.Element {
  return (
    <ScanCategoryView
      title="Source Code Analysis"
      description="Static analysis (SAST) and secret detection for your source code — finds insecure code patterns and hard-coded credentials before you ship."
      helpContext="source-code"
      scanTypes={['CODE_ANALYSIS', 'SECRET_DETECTION']}
      hintTitle="What is source code analysis? 💻"
      hintDescription="This scan reads your code (without running it) to spot dangerous patterns — like SQL built from user input — and accidental secrets such as API keys committed to your repository."
    />
  );
}
