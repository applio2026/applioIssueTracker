import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await api.get('/dashboard/stats')).data,
  });
}

// Download the CSV export through the authenticated client, then trigger a save.
export async function downloadTicketsCsv() {
  const res = await api.get('/dashboard/export', { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
