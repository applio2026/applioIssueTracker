import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';

export function useTickets(filters = {}) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: async () => (await api.get('/tickets', { params })).data.tickets,
  });
}

export function useTicket(id) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => (await api.get(`/tickets/${id}`)).data.ticket,
    enabled: !!id,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data.categories,
  });
}

export function useAssignees(enabled = true) {
  return useQuery({
    queryKey: ['assignees'],
    queryFn: async () => (await api.get('/assignees')).data.assignees,
    enabled,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/tickets', payload).then((r) => r.data.ticket),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  });
}

// Generic per-ticket mutation that refreshes the detail + list views.
function useTicketMutation(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ticket', vars.id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export const useChangeStatus = () =>
  useTicketMutation(({ id, status }) => api.patch(`/tickets/${id}/status`, { status }));

export const useAssignTicket = () =>
  useTicketMutation(({ id, assigneeId }) => api.patch(`/tickets/${id}/assign`, { assigneeId }));

export const useChangePriority = () =>
  useTicketMutation(({ id, priority }) => api.patch(`/tickets/${id}`, { priority }));

export const useAddComment = () =>
  useTicketMutation(({ id, body }) => api.post(`/tickets/${id}/comments`, { body }));

export const useUploadAttachment = () =>
  useTicketMutation(({ id, file }) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/tickets/${id}/attachments`, form);
  });

export const useDeleteAttachment = () =>
  useTicketMutation(({ id, attId }) => api.delete(`/tickets/${id}/attachments/${attId}`));

// Download an attachment through the authenticated client, then save it.
export async function downloadAttachment(ticketId, att) {
  const res = await api.get(`/tickets/${ticketId}/attachments/${att.id}/download`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = att.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
