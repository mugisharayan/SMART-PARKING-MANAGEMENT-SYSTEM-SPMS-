import { create } from 'zustand';

const useAuthStore = create((set) => ({
  token: null,
  user: null,

  setAuth: (token, user) => {
    localStorage.setItem('pms_auth', JSON.stringify({ token, user }));
    set({ token, user });
  },

  clearAuth: () => {
    localStorage.removeItem('pms_auth');
    set({ token: null, user: null });
  },

  restoreAuth: () => {
    const stored = localStorage.getItem('pms_auth');
    if (stored) {
      const { token, user } = JSON.parse(stored);
      set({ token, user });
      return user;
    }
    return null;
  },
}));

export default useAuthStore;
