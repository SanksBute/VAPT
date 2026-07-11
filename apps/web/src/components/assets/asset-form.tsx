'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiPost, ApiError } from '@/lib/api-client';
import toast from 'react-hot-toast';

const ASSET_TYPES = [
  'SERVER', 'WORKSTATION', 'NETWORK_DEVICE', 'CLOUD_INSTANCE', 'CONTAINER', 'KUBERNETES_POD',
  'WEB_APPLICATION', 'API_ENDPOINT', 'DATABASE', 'DOMAIN', 'IP_ADDRESS', 'URL', 'CODE_REPOSITORY',
  'MOBILE_APPLICATION', 'IOT_DEVICE', 'VIRTUAL_MACHINE', 'LOAD_BALANCER', 'STORAGE_BUCKET',
  'SERVERLESS_FUNCTION', 'MESSAGE_QUEUE',
] as const;

const CRITICALITY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'] as const;

const assetFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(500),
  type: z.enum(ASSET_TYPES, { errorMap: () => ({ message: 'Select an asset type' }) }),
  criticality: z.enum(CRITICALITY_LEVELS),
  identifier: z.string().max(500).optional(),
  hostname: z.string().max(255).optional(),
  ipAddresses: z.string().optional(),
  owner: z.string().max(255).optional(),
  team: z.string().max(255).optional(),
  notes: z.string().optional(),
});

type AssetFormData = z.infer<typeof assetFormSchema>;

export function AssetForm(): JSX.Element {
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<AssetFormData>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: { name: '', criticality: 'MEDIUM' },
  });

  const createAssetMutation = useMutation({
    mutationFn: (data: AssetFormData) =>
      apiPost<{ id: string }>('/assets', {
        name: data.name,
        type: data.type,
        criticality: data.criticality,
        identifier: data.identifier || undefined,
        hostname: data.hostname || undefined,
        ipAddresses: data.ipAddresses
          ? data.ipAddresses.split(',').map((ip) => ip.trim()).filter(Boolean)
          : [],
        owner: data.owner || undefined,
        team: data.team || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset added successfully');
      router.push('/assets');
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Failed to add asset. Please try again.');
    },
  });

  const onSubmit = (data: AssetFormData): void => {
    setError(null);
    createAssetMutation.mutate(data);
  };

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Asset name</Label>
        <Input
          id="name"
          autoFocus
          placeholder="api.example.com"
          {...register('name')}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Asset type</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="type" className={errors.type ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="criticality">Criticality</Label>
          <Controller
            name="criticality"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="criticality">
                  <SelectValue placeholder="Select criticality" />
                </SelectTrigger>
                <SelectContent>
                  {CRITICALITY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level.charAt(0) + level.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hostname">Hostname (optional)</Label>
          <Input id="hostname" placeholder="prod-web-01" {...register('hostname')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ipAddresses">IP addresses (optional)</Label>
          <Input id="ipAddresses" placeholder="10.0.0.1, 10.0.0.2" {...register('ipAddresses')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="owner">Owner (optional)</Label>
          <Input id="owner" placeholder="Jane Doe" {...register('owner')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="team">Team (optional)</Label>
          <Input id="team" placeholder="Platform" {...register('team')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" placeholder="Additional context about this asset..." {...register('notes')} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => router.push('/assets')}>
          Cancel
        </Button>
        <Button type="submit" disabled={createAssetMutation.isPending}>
          {createAssetMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding asset...
            </>
          ) : (
            'Add asset'
          )}
        </Button>
      </div>
    </form>
  );
}
