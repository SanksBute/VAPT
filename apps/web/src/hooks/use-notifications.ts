import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';

export function useUnreadNotifications(): ReturnType<typeof useQuery<number>> {
  return useQuery<number>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const result = await apiGet<{ count: number }>('/notifications/unread-count');
      return result.count;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}
