import React from 'react';
import { Search, RotateCcw, ArrowRight, X } from 'lucide-react';

interface HeroSearchProps {
  searchQuery: string;
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  onClear: () => void;
  isFocusedSearch: boolean;
  errorMessage?: string | null;
}

export const HeroSearch: React.FC<HeroSearchProps> = ({
  searchQuery,
  onQueryChange,
  onSearch,
  onClear,
  isFocusedSearch,
  errorMessage
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <section className="bg-gradient-to-r from-[#0F2B48] via-[#16385F] to-[#0F2B48] border border-[#1E3A5F] rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm w-full min-w-0">
      {/* Inscrição 2º Turno e Orientação */}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-black text-white tracking-wide uppercase">
            Consulta por RE do Policial Militar
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-[#0F2B48] text-[11px] sm:text-xs font-black tracking-wider uppercase shadow-xs">
            2º TURNO
          </span>
        </div>
        <span className="text-[11px] text-slate-300 hidden sm:inline font-medium">
          Digite o RE para acessar a tela do militar
        </span>
      </div>

      {/* Search Box */}
      <div className="bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row gap-2 w-full">
        <div className="relative flex-1 flex items-center">
          <Search className="absolute left-3.5 sm:left-4 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 pointer-events-none" />
          <input
            id="search-input"
            type="text"
            inputMode="search"
            value={searchQuery}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite RE ou nome do policial..."
            className="w-full py-2.5 sm:py-3 pl-10 sm:pl-12 pr-9 text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-semibold outline-none bg-transparent min-h-[42px]"
            autoComplete="off"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                onQueryChange('');
                if (isFocusedSearch) onClear();
              }}
              className="absolute right-3 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              aria-label="Limpar texto"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-search"
            onClick={onSearch}
            className="flex-1 sm:flex-initial px-5 sm:px-6 py-2.5 sm:py-3 bg-[#0F2B48] hover:bg-[#16385F] active:scale-[0.98] text-white font-extrabold rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-xs cursor-pointer shrink-0 min-h-[42px]"
          >
            <span>Consultar</span>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </button>

          {isFocusedSearch && (
            <button
              id="btn-clear-search"
              onClick={onClear}
              className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-bold rounded-lg text-sm transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-h-[42px]"
              title="Limpar consulta e voltar ao painel geral"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Painel Geral</span>
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mt-2.5 px-3 py-2 bg-rose-500/20 border border-rose-400/40 rounded-xl text-rose-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <span>{errorMessage}</span>
        </div>
      )}
    </section>
  );
};
