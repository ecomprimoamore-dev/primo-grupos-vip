import React, { useState } from 'react';
import { Lock, Mail, Loader2, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api } from '../../services/api';

interface AdminLoginProps {
  onLoginSuccess: (user: any) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api.login(email, password);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 flex flex-col justify-between p-4 sm:p-6 selection:bg-emerald-500 selection:text-white">
      {/* Main Login Card - Clean Light Theme */}
      <div className="max-w-md w-full mx-auto my-auto py-6">
        <div className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-9 shadow-sm relative overflow-hidden">
          {/* Header */}
          <div className="text-center mb-7">
            <div className="w-16 h-16 flex items-center justify-center mx-auto mb-3.5 p-2">
              <img src="/app-logo.png" alt="PRIMO GRUPOS VIP" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">
              Painel Administrativo
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Gestão de lojas, distribuição de grupos VIP e relatórios
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                E-mail do Administrador
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-xl text-sm text-slate-900 placeholder-slate-400 transition-colors"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-xl text-sm text-slate-900 placeholder-slate-400 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-semibold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando credenciais...</span>
                </>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-md mx-auto w-full text-center py-3 text-xs text-slate-400">
        Ambiente administrativo seguro · Distribuição atômica backend
      </footer>
    </div>
  );
};
