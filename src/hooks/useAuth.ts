// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { User } from '../types/auth';
import { AuthService } from '../services/authService';

export const useAuth = () => {
  // ⬇️ lee localStorage en el primer render (sin flicker)
  const [user, setUser] = useState<User | null>(() => AuthService.getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // por si el storage cambió entre renders
    setUser(AuthService.getCurrentUser());
    setLoading(false);

    // sincroniza entre pestañas
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'wiltech_user' || e.key === 'wiltech_token') {
        setUser(AuthService.getCurrentUser());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = async (email: string, password: string) => {
    const u = await AuthService.login({ email, password });
    setUser(u);
  };

  const logout = () => {
    AuthService.logout();
    setUser(null);
    window.location.href = '/login';
  };

  return { user, loading, isAuthenticated: !!user, login, logout };
};
