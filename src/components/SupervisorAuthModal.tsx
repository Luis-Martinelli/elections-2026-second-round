import React, { useState } from 'react';
import { ShieldCheck, KeyRound, X, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface SupervisorAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userEmail?: string;
  customPassword?: string;
}

export const SupervisorAuthModal: React.FC<SupervisorAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userEmail,
  customPassword
}) => {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showInputPassword, setShowInputPassword] = useState(false);

  if (!isOpen) return null;

  const isOfficialP3Account = userEmail?.toLowerCase().includes('40bpmip3');
  const activeTargetPassword = (customPassword || '40BPMI').trim().toUpperCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = password.trim().toUpperCase();
    // Authorized operational keys: either the custom configured password or default fallbacks
    if (
      clean === activeTargetPassword ||
      clean === '40BPMI' ||
      clean === 'P3' ||
      clean === 'CPI7' ||
      clean === 'ELEICOES2026'
    ) {
      setErrorMsg('');
      onSuccess();
    } else {
      setErrorMsg('Senha operacional incorreta. Solicite à P/3 do 40º BPM/I.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-3xl max-w-sm w-full p-4 sm:p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200 max-h-[94vh] sm:max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0F2B48] to-[#16385F] text-white flex items-center justify-center mx-auto shadow-md mb-3 ring-4 ring-slate-100">
            <KeyRound className="w-7 h-7 text-amber-400" />
          </div>

          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
            Painel Geral Operacional
          </span>

          <h3 className="text-lg font-black text-slate-900 mt-2">
            Acesso Supervisão / P/3
          </h3>

          {isOfficialP3Account && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block">
                  Conta P/3 Reconhecida
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  Administrador
                </span>
              </div>
              <p className="text-xs text-slate-700 font-mono">{userEmail}</p>

              <button
                type="button"
                onClick={onSuccess}
                className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white text-xs font-black rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Entrar como Administrador P/3</span>
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label
              htmlFor="input-supervisor-key"
              className="block text-xs font-black text-slate-700 mb-1 text-center"
            >
              Senha Operacional:
            </label>
            <div className="relative">
              <input
                id="input-supervisor-key"
                type={showInputPassword ? 'text' : 'password'}
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Digite a senha autorizada"
                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 rounded-xl text-sm font-bold text-slate-900 outline-none transition text-center tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowInputPassword(!showInputPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showInputPassword ? 'Ocultar' : 'Exibir'}
              >
                {showInputPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errorMsg && (
              <p className="mt-1.5 text-xs font-bold text-red-600 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </p>
            )}
          </div>

          <div className="pt-2 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-extrabold text-slate-700 hover:bg-slate-100 transition cursor-pointer min-h-[42px]"
            >
              Cancelar
            </button>
            <button
              id="btn-confirm-supervisor-login"
              type="submit"
              className="w-full py-2.5 px-3 rounded-xl bg-[#0F2B48] hover:bg-[#16385F] active:scale-[0.98] text-white text-xs font-black transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Acessar Painel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
