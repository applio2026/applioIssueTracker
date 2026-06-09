import axios from 'axios';
import { useAuthStore } from '../store/auth.js';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Attach access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, try a one-time refresh, then retry the original request.
let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      try {
        refreshing = refreshing || api.post('/auth/refresh');
        const { data } = await refreshing;
        refreshing = null;
        useAuthStore.getState().setAuth(data.accessToken, data.user);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        useAuthStore.getState().clear();
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  },
);
