import { api } from '../../api/client.js';
import { useAuthStore } from '../../store/auth.js';

export function useAuth() {
  const { user, accessToken, setAuth, clear } = useAuthStore();

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAuth(data.accessToken, data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clear();
    }
  };

  return { user, accessToken, isAuthenticated: !!user, login, logout };
}
