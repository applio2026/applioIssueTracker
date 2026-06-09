import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';

function useCategoryMutation(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export const useCreateCategory = () =>
  useCategoryMutation((payload) => api.post('/categories', payload));

export const useUpdateCategory = () =>
  useCategoryMutation(({ id, ...payload }) => api.patch(`/categories/${id}`, payload));

export const useDeleteCategory = () =>
  useCategoryMutation((id) => api.delete(`/categories/${id}`));
