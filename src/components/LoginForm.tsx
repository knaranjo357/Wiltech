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
    <div className="min-h-screen bg-gradient-animated flex items-center justify-center p-6 relative overflow-hidden">

      {/* Decorative blobs */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-200/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-200/20 blur-3xl pointer-events-none" />
      <div className="absolute top-[30%] left-[20%] w-[300px] h-[300px] rounded-full bg-sky-200/15 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 slide-up">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="bg-black p-4 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-2xl ring-4 ring-white/50 w-24 h-24 overflow-hidden">
            <img 
              src="/images/logowiltech.png" 
              alt="Wiltech Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-slate-900 bg-clip-text text-transparent">
            Wiltech
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Inicia sesión en tu cuenta</p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/50 border border-white/80 p-8 ring-1 ring-slate-900/[0.04] space-y-6"
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
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-700 transition-colors" />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-slate-600 focus:ring-2 focus:ring-slate-700/10 outline-none transition-all placeholder:text-slate-400 font-medium"
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
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-700 transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-slate-600 focus:ring-2 focus:ring-slate-700/10 outline-none transition-all placeholder:text-slate-400 font-medium"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative bg-gradient-to-r from-slate-800 to-slate-900 text-white py-3.5 px-6 rounded-2xl font-semibold hover:from-indigo-700 hover:to-purple-700 focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-indigo-300/50 flex items-center justify-center gap-3 group overflow-hidden"
          >
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
        <p className="text-center text-xs text-slate-400 mt-6 font-medium">
          Powered by <span className="text-slate-500 font-semibold">Alliasoft</span>
        </p>
      </div>
    </div>
  );
};
