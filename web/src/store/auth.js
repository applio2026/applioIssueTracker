import { create } from 'zustand';

// Access token is kept in memory; the refresh token lives in an httpOnly cookie.
// We persist a lightweight copy of the user so the UI can render immediately on reload.
const stored = (() => {
  try {
    return JSON.parse(localStorage.getItem('ts_user') || 'null');
  } catch {
    return null;
  }
})();

export const useAuthStore = create((set) => ({
  accessToken: null,
  user: stored,

  setAuth: (accessToken, user) => {
    localStorage.setItem('ts_user', JSON.stringify(user));
    set({ accessToken, user });
  },

  clear: () => {
    localStorage.removeItem('ts_user');
    set({ accessToken: null, user: null });
  },
}));
