import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { BillingView } from '@/components/settings/billing-view';

export const metadata: Metadata = { title: 'Billing' };

export default function BillingPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Plan"
        description="View your subscription, upgrade your plan, and download past invoices."
        helpContext="settings"
        breadcrumb="Settings"
      />
      <BillingView />
    </div>
  );
}
