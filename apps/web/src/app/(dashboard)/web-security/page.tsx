import type { Metadata } from 'next';
import { ScanCategoryView } from '@/components/scans/scan-category-view';

export const metadata: Metadata = { title: 'Web Application Security' };

export default function WebSecurityPage(): JSX.Element {
  return (
    <ScanCategoryView
      title="Web Application Security"
      description="Deep security testing for your websites and web apps — checks for issues like SQL injection, cross-site scripting (XSS), broken authentication, and more."
      helpContext="web-security"
      scanTypes={['WEB_APPLICATION']}
      hintTitle="Why scan web applications? 🌐"
      hintDescription="Websites are the most common entry point for attackers. This scan inspects your web pages, forms, and login flows for the weaknesses hackers exploit most often — and explains each finding in plain language."
    />
  );
}
