import { useEffect } from 'react';
import { AuthService } from '../services/authService';

export function SessionReset() {
  useEffect(() => {
    AuthService.logout();
    window.location.replace('/login');
  }, []);

  return null;
}
