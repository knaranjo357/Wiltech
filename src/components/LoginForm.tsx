import { RepairLoader } from './RepairLoader';
import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AuthService } from '../services/authService';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      window.location.replace('/agenda');
    } catch (err) {
      AuthService.logout();
      setError(err instanceof Error ? err.message : 'Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen min-h-[100dvh] bg-zinc-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">

      {/* Decorative blobs */}
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.14)_1px,transparent_0)] [background-size:28px_28px] pointer-events-none" />
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full border border-white/10 pointer-events-none" />
      <div className="absolute bottom-[-25%] left-[-10%] w-[500px] h-[500px] rounded-full border border-white/[0.07] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 slide-up">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="bg-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-black ring-1 ring-white/15 w-20 h-20">
            <span aria-hidden="true" className="text-4xl font-black tracking-[-0.12em] text-black pr-1">W</span>
          </div>
          <h1 className="text-3xl font-black tracking-[-0.045em] text-white">
            Wiltech
          </h1>
          <p className="text-zinc-400 mt-2 text-sm font-medium">Accede a tu espacio de trabajo</p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-[28px] shadow-2xl shadow-black/50 border border-white/20 p-6 sm:p-8 ring-1 ring-black/5 space-y-6"
        >
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-in slide-in-from-top-2 duration-200">
              <p className="text-red-600 text-sm text-center font-medium">{error}</p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
              Email
            </label>
            <div className="login-field relative group">
              <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-700 transition-colors" />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-slate-600 focus:ring-2 focus:ring-slate-700/10 outline-none transition-all placeholder:text-slate-400 font-medium"
                placeholder="tu@email.com"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
              Contraseña
            </label>
            <div className="login-field relative group">
              <Lock aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-700 transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="login-password-input w-full py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-slate-600 focus:ring-2 focus:ring-slate-700/10 outline-none transition-all placeholder:text-slate-400 font-medium"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative bg-black text-white py-3.5 px-6 rounded-2xl font-bold hover:bg-zinc-800 focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none shadow-xl shadow-black/20 flex items-center justify-center gap-3 group overflow-hidden"
          >
            {loading ? (
              <div className="flex items-center gap-3">
                <RepairLoader variant="icon" />
                <span>Iniciando sesión...</span>
              </div>
            ) : (
              <>
                <span>Iniciar sesión</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}

            {/* Shimmer effect */}
            {!loading && (
              <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-[10px] uppercase tracking-[0.16em] text-zinc-600 mt-6 font-bold">
          Powered by <span className="text-zinc-400">Alliasoft</span>
        </p>
      </div>
    </main>
  );
};
