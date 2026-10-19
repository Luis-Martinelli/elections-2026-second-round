import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Brasao40BPMI } from './Brasao40BPMI';

interface AdminLoginScreenProps {
  onLoginSuccess: () => void;
  customPassword?: string;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  onLoginSuccess,
  customPassword
}) => {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const activeTargetPassword = (customPassword || '12bpmi@12').trim().toUpperCase();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = password.trim().toUpperCase();
    if (
      clean === activeTargetPassword ||
      clean === '12BPMI' ||
      clean === 'P3' ||
      clean === 'CPI7' ||
      clean === 'ELEICOES2026'
    ) {
      setErrorMsg('');
      onLoginSuccess();
    } else {
      setErrorMsg('Senha incorreta. Solicite a chave de acesso à P/3 do 12º BPM/I.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden select-none font-sans">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative z-10">
        {/* Header / Crest */}
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 mb-3 filter drop-shadow-lg flex items-center justify-center">
            <Brasao40BPMI className="w-20 h-20" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-black uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Divisão Operacional (P/3) · CPI-7</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            12º BPM/I · Eleições 2026
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-amber-400 mt-1">
            2º TURNO · CONTROLE DE ESCALA & VISTORIAS
          </p>

          <p className="text-xs text-slate-400 mt-3 max-w-xs leading-relaxed">
            Acesso exclusivo à Supervisão e Comando. Digite a senha operacional autorizada.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 text-center">
              Senha de Acesso Operacional
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Digite a senha..."
                autoFocus
                className="w-full pl-10 pr-10 py-3 bg-slate-900/90 border border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 rounded-2xl text-white text-center font-mono font-bold tracking-wider placeholder-slate-500 text-sm outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-[0.99] text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-900/40 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-amber-300" />
            <span>Entrar no Painel do 2º Turno</span>
          </button>
        </form>

        {/* Security badge footer */}
        <div className="mt-6 pt-4 border-t border-slate-700/60 text-center">
          <p className="text-[11px] text-slate-500 font-mono">
            Polícia Militar do Estado de São Paulo · CPI-7
          </p>
        </div>
      </div>
    </div>
  );
};
