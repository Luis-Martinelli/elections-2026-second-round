import React, { useState } from 'react';
import { Search, Lock } from 'lucide-react';
import { Brasao40BPMI } from './Brasao40BPMI';

interface InitialHomeScreenProps {
  onSearch: (re: string) => void;
  onOpenSupervisorMode: () => void;
  errorMessage?: string | null;
  onClearError?: () => void;
}

export const InitialHomeScreen: React.FC<InitialHomeScreenProps> = ({
  onSearch,
  onOpenSupervisorMode,
  errorMessage,
  onClearError
}) => {
  const [reQuery, setReQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = reQuery.trim();
    if (!clean) {
      setErrorMsg('Informe o RE do policial militar.');
      return;
    }
    setErrorMsg('');
    if (onClearError) onClearError();
    onSearch(clean);
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex flex-col justify-center items-center px-4 py-8 select-none font-sans">
      <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-md overflow-hidden relative">
        {/* Faixa decorativa superior no azul PMESP */}
        <div className="h-1.5 bg-[#0F2B48] w-full" />

        <div className="p-6 sm:p-8">
          {/* Brasão Oficial do 12º BPM/I */}
          <div className="flex justify-center mb-3">
            <div className="w-20 h-24 flex items-center justify-center">
              <Brasao40BPMI className="w-20 h-auto drop-shadow-sm" />
            </div>
          </div>

          {/* Título Principal */}
          <h1 className="text-xl sm:text-2xl font-black text-[#0F2B48] text-center tracking-tight">
            12º BPM/I - Eleições 2026
          </h1>

          {/* Badge 2º Turno */}
          <div className="flex justify-center mt-2 mb-3">
            <span className="inline-flex items-center px-3.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 tracking-wider">
              2º TURNO
            </span>
          </div>

          {/* Subtítulo Institucional */}
          <p className="text-xs sm:text-sm text-slate-500 text-center max-w-xs mx-auto leading-relaxed">
            Consulte seu posto eleitoral designado, escala de serviço e confirme sua presença.
          </p>

          {/* Formulário de Consulta por RE */}
          <form onSubmit={handleSubmit} className="mt-6">
            <label
              htmlFor="initial-re-input"
              className="block text-xs font-bold text-slate-700 mb-2"
            >
              Informe seu RE (com ou sem dígito):
            </label>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="initial-re-input"
                type="text"
                value={reQuery}
                onChange={(e) => {
                  setReQuery(e.target.value);
                  if (errorMsg) setErrorMsg('');
                  if (onClearError) onClearError();
                }}
                placeholder="Ex: 130043 ou 130043-1"
                className="w-full pl-10 pr-4 py-3 border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl text-slate-900 font-semibold text-sm outline-none transition placeholder-slate-400 bg-white"
                autoComplete="off"
                autoFocus
              />
            </div>

            {(errorMsg || errorMessage) && (
              <p className="text-xs text-rose-600 font-bold mt-1.5">{errorMsg || errorMessage}</p>
            )}

            <button
              type="submit"
              id="btn-verificar-escala"
              className="w-full mt-4 py-3 bg-[#0F2B48] hover:bg-[#16385F] active:scale-[0.99] text-white font-extrabold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Search className="w-4 h-4 text-amber-400" />
              <span>Verificar Escala Operacional</span>
            </button>
          </form>

          {/* Rodapé interno de segurança */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Acesso auditado para proteção de dados pessoais e segurança orgânica.</span>
          </div>
        </div>
      </div>

      {/* Botão de Acesso à Área Restrita (P/3) */}
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          id="btn-acesso-area-restrita-home"
          onClick={onOpenSupervisorMode}
          className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-full shadow-xs text-xs font-bold text-slate-700 hover:text-slate-900 transition flex items-center gap-2 cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 text-amber-600" />
          <span>Acesso Área Restrita (P/3)</span>
        </button>
      </div>
    </div>
  );
};
