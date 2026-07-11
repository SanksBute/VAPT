import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { SettingsView } from '@/components/settings/settings-view';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your profile, organization, team members, API keys, and active sessions."
        helpContext="settings"
      />
      <SettingsView />
    </div>
  );
}
