import type { Metadata } from 'next';
import { AssetForm } from '@/components/assets/asset-form';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Add Asset' };

export default function NewAssetPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Asset"
        description="Register a new asset in your inventory so SentinelX can start tracking its security posture."
        helpContext="assets"
        breadcrumb="Assets"
      />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <AssetForm />
        </CardContent>
      </Card>
    </div>
  );
}
