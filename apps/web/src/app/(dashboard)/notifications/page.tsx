import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { NotificationsView } from '@/components/notifications/notifications-view';

export const metadata: Metadata = { title: 'Notifications' };

export default function NotificationsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Everything that needs your attention — new critical findings, completed scans, SLA breaches, and system alerts — in one place."
        helpContext="notifications"
      />
      <NotificationsView />
    </div>
  );
}
