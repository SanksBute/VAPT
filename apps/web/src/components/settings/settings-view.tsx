'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { User, Building2, Users, KeyRound, MonitorSmartphone, Trash2, Plus, Loader2 } from 'lucide-react';
import { apiGet, apiPatch, apiPost, apiDelete } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatRelativeTime } from '@/lib/utils';

interface Profile {
  id: string; email: string; firstName: string; lastName: string;
  displayName?: string; phone?: string | null; timezone?: string; mfaEnabled?: boolean;
}
interface Organization { id: string; name: string; displayName?: string; slug: string; domain?: string | null; tier?: string; }
interface Member { id: string; userId: string; role: string; isOwner: boolean; joinedAt: string; user?: { email?: string; firstName?: string; lastName?: string } }
interface ApiKey { id: string; name: string; keyPrefix?: string; lastUsedAt?: string | null; createdAt: string; }
interface Session { id: string; ipAddress: string; userAgent: string; lastSeenAt: string; createdAt: string; }

export function SettingsView(): JSX.Element {
  return (
    <Tabs defaultValue="profile" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="profile"><User className="h-4 w-4 mr-1.5" /> Profile</TabsTrigger>
        <TabsTrigger value="organization"><Building2 className="h-4 w-4 mr-1.5" /> Organization</TabsTrigger>
        <TabsTrigger value="team"><Users className="h-4 w-4 mr-1.5" /> Team</TabsTrigger>
        <TabsTrigger value="api-keys"><KeyRound className="h-4 w-4 mr-1.5" /> API Keys</TabsTrigger>
        <TabsTrigger value="sessions"><MonitorSmartphone className="h-4 w-4 mr-1.5" /> Sessions</TabsTrigger>
      </TabsList>

      <TabsContent value="profile"><ProfileTab /></TabsContent>
      <TabsContent value="organization"><OrganizationTab /></TabsContent>
      <TabsContent value="team"><TeamTab /></TabsContent>
      <TabsContent value="api-keys"><ApiKeysTab /></TabsContent>
      <TabsContent value="sessions"><SessionsTab /></TabsContent>
    </Tabs>
  );
}

function ProfileTab(): JSX.Element {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['profile'], queryFn: () => apiGet<Profile>('/users/profile') });
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });

  useEffect(() => {
    if (data) setForm({ firstName: data.firstName ?? '', lastName: data.lastName ?? '', phone: data.phone ?? '' });
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiPatch('/users/profile', form),
    onSuccess: () => { toast.success('Profile updated.'); void queryClient.invalidateQueries({ queryKey: ['profile'] }); },
    onError: () => toast.error('Could not update your profile.'),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Your Profile</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        <div>
          <Label>Email</Label>
          <Input value={data?.email ?? ''} disabled className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>First name</Label>
            <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Last name</Label>
            <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className="mt-1" />
          </div>
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1" />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </Button>
      </CardContent>
    </Card>
  );
}

function OrganizationTab(): JSX.Element {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['organization'], queryFn: () => apiGet<Organization>('/organization') });
  const [form, setForm] = useState({ name: '', displayName: '' });

  useEffect(() => {
    if (data) setForm({ name: data.name ?? '', displayName: data.displayName ?? '' });
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiPatch('/organization', form),
    onSuccess: () => { toast.success('Organization updated.'); void queryClient.invalidateQueries({ queryKey: ['organization'] }); },
    onError: () => toast.error('Could not update the organization. You may not have permission.'),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Organization</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label>Display name</Label>
          <Input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} className="mt-1" />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Plan:</span><Badge variant="secondary">{data?.tier ?? '—'}</Badge>
          <span className="ml-4">Slug:</span><code className="text-xs">{data?.slug}</code>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </Button>
      </CardContent>
    </Card>
  );
}

function TeamTab(): JSX.Element {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['members'], queryFn: () => apiGet<{ items: Member[] }>('/users/members') });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');

  const invite = useMutation({
    mutationFn: () => apiPost('/users/invite', { email: email.trim(), role }),
    onSuccess: () => { toast.success('Invitation sent.'); setEmail(''); void queryClient.invalidateQueries({ queryKey: ['members'] }); },
    onError: () => toast.error('Could not send the invitation.'),
  });

  const members = data?.items ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Invite a team member</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label>Email</Label>
            <Input type="email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={() => invite.mutate()} disabled={invite.isPending || !email.trim()} className="gap-2">
            <Plus className="h-4 w-4" /> Invite
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Members</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32 w-full" /> : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div>
                    <p className="text-sm font-medium">
                      {m.user?.firstName || m.user?.lastName ? `${m.user?.firstName ?? ''} ${m.user?.lastName ?? ''}`.trim() : m.user?.email ?? 'Member'}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.user?.email ?? ''} · joined {formatRelativeTime(m.joinedAt)}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{m.isOwner ? 'OWNER' : m.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ApiKeysTab(): JSX.Element {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['api-keys'], queryFn: () => apiGet<ApiKey[]>('/auth/api-keys') });
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => apiPost<{ key?: string; apiKey?: string }>('/auth/api-keys', { name: name.trim() }),
    onSuccess: (res) => {
      const key = res?.key ?? res?.apiKey ?? null;
      setNewKey(key);
      setName('');
      toast.success('API key created.');
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: () => toast.error('Could not create the API key.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/auth/api-keys/${id}`),
    onSuccess: () => { toast.success('API key revoked.'); void queryClient.invalidateQueries({ queryKey: ['api-keys'] }); },
    onError: () => toast.error('Could not revoke the API key.'),
  });

  const keys = data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Create an API key</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <Label>Key name</Label>
              <Input placeholder="CI pipeline" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !name.trim()} className="gap-2">
              <Plus className="h-4 w-4" /> Create
            </Button>
          </div>
          {newKey && (
            <div className="p-3 rounded-md border border-primary/40 bg-primary/5">
              <p className="text-xs text-muted-foreground mb-1">Copy this key now — you won&apos;t see it again:</p>
              <code className="text-xs break-all">{newKey}</code>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Your API keys</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-24 w-full" /> : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No API keys yet.</p>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {k.keyPrefix ? `${k.keyPrefix}…· ` : ''}created {formatRelativeTime(k.createdAt)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove.mutate(k.id)} title="Revoke">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionsTab(): JSX.Element {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['sessions'], queryFn: () => apiGet<Session[]>('/auth/sessions') });

  const revoke = useMutation({
    mutationFn: (id: string) => apiDelete(`/auth/sessions/${id}`),
    onSuccess: () => { toast.success('Session revoked.'); void queryClient.invalidateQueries({ queryKey: ['sessions'] }); },
    onError: () => toast.error('Could not revoke the session.'),
  });

  const sessions = data ?? [];

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Active sessions</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-32 w-full" /> : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No active sessions.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <MonitorSmartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.userAgent || 'Unknown device'}</p>
                    <p className="text-xs text-muted-foreground">{s.ipAddress} · active {formatRelativeTime(s.lastSeenAt)}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(s.id)}>Revoke</Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
