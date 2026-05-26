import { create } from 'zustand';

interface User {
  id: number;
  email: string;
  name?: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  const user = savedUser ? JSON.parse(savedUser) : null;

  return {
    user,
    token,
    isAuthenticated: !!token,
    
    login: (token, user) => set(() => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      return { token, user, isAuthenticated: true };
    }),
    
    logout: () => set(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return { token: null, user: null, isAuthenticated: false };
    }),
  };
});
