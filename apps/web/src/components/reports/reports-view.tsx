'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FileText, Download, Trash2, Plus, Loader2 } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn, formatRelativeTime, getStatusBadgeClass } from '@/lib/utils';

interface Report {
  id: string;
  title: string;
  reportType: string;
  format: string;
  status: string;
  createdAt: string;
}

const REPORT_TYPES = [
  ['EXECUTIVE_SUMMARY', 'Executive Summary'],
  ['TECHNICAL_DETAIL', 'Technical Detail'],
  ['COMPLIANCE', 'Compliance'],
  ['RISK_ASSESSMENT', 'Risk Assessment'],
  ['PENETRATION_TEST', 'Penetration Test'],
  ['VULNERABILITY_MANAGEMENT', 'Vulnerability Management'],
  ['ASSET_INVENTORY', 'Asset Inventory'],
  ['AI_SUMMARY', 'AI Summary'],
];
const FORMATS = ['PDF', 'WORD', 'EXCEL', 'CSV', 'JSON', 'HTML'];

export function ReportsView(): JSX.Element {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [reportType, setReportType] = useState('EXECUTIVE_SUMMARY');
  const [format, setFormat] = useState('PDF');

  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => apiGet<{ items: Report[] }>('/reports', { limit: 50 }),
    refetchInterval: 10000,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/reports', {
        title: title.trim() || `${reportType.replace(/_/g, ' ')} Report`,
        reportType,
        format,
      }),
    onSuccess: () => {
      toast.success('Report generation started.');
      setTitle('');
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: () => toast.error('Could not generate the report. Please try again.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/reports/${id}`),
    onSuccess: () => {
      toast.success('Report deleted.');
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: () => toast.error('Could not delete the report.'),
  });

  const handleDownload = async (id: string): Promise<void> => {
    try {
      const { url } = await apiGet<{ url: string }>(`/reports/${id}/download`);
      window.open(url, '_blank');
    } catch {
      toast.error('This report is not ready to download yet.');
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Generate a Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Title (optional)</label>
              <Input
                placeholder="Q3 Security Report"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="w-52">
              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <label className="text-xs text-muted-foreground mb-1 block">Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => create.mutate()} disabled={create.isPending} className="gap-2">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No reports yet. Generate your first report above.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.reportType.replace(/_/g, ' ')} · {r.format} · {formatRelativeTime(r.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={cn('text-xs border', getStatusBadgeClass(r.status))}>
                      {r.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={r.status !== 'COMPLETED'}
                      onClick={() => void handleDownload(r.id)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => remove.mutate(r.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
