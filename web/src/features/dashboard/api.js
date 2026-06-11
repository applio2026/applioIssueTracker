import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';

const cleanParams = (filters = {}) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v));

export function useDashboardStats(filters = {}) {
  const params = cleanParams(filters);
  return useQuery({
    queryKey: ['dashboard-stats', params],
    queryFn: async () => (await api.get('/dashboard/stats', { params })).data,
    placeholderData: (prev) => prev, // keep charts visible while refetching
  });
}

// Download the CSV export through the authenticated client, then trigger a save.
export async function downloadTicketsCsv(filters = {}) {
  const res = await api.get('/dashboard/export', {
    params: cleanParams(filters),
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
