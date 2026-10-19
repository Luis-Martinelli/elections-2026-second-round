import React from 'react';
import { ShieldCheck, Car, ChevronRight } from 'lucide-react';

export type KpiFilterType = 'morning_done' | 'morning_pending' | 'afternoon_done' | 'afternoon_pending';

interface KpiGridProps {
  totalSchools: number;
  morningDone: number;
  morningPending: number;
  afternoonDone: number;
  afternoonPending: number;
  totalRondas?: number;
  fullDayCount?: number;
  onKpiClick?: (type: KpiFilterType) => void;
  onRondasClick?: () => void;
}

export const KpiGrid: React.FC<KpiGridProps> = ({
  totalSchools,
  morningDone,
  morningPending,
  afternoonDone,
  afternoonPending,
  totalRondas = 0,
  onKpiClick,
  onRondasClick
}) => {
  const morningPercent = totalSchools > 0 ? Math.round((morningDone / totalSchools) * 100) : 0;
  const afternoonPercent = totalSchools > 0 ? Math.round((afternoonDone / totalSchools) * 100) : 0;

  return (
    <div className="mt-2 sm:mt-4 space-y-2 sm:space-y-3 w-full min-w-0">
      {/* 4 Cards de KPI - Visual Limpo, Otimizado 100% para Celular (Sem Ícones Sobrepondo) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
        {/* 1. Manhã - Check-ins Realizados */}
        <div
          onClick={() => onKpiClick?.('morning_done')}
          role="button"
          tabIndex={0}
          className="bg-white border border-emerald-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xs hover:shadow-xs hover:border-emerald-400 active:scale-[0.98] transition flex flex-col justify-between cursor-pointer group text-left"
          title="Clique para ver os postos com check-in realizado na manhã"
        >
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-emerald-800 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-200 truncate">
                Manhã · 06h-13h
              </span>
              <span className="text-[10px] sm:text-xs font-bold font-mono text-emerald-700 shrink-0">
                {morningPercent}%
              </span>
            </div>
            <h4 className="text-[11px] sm:text-xs font-extrabold text-slate-700 mt-1.5 truncate group-hover:text-emerald-800 transition">
              Check-ins Manhã
            </h4>
          </div>

          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <b className="text-xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                {morningDone}
              </b>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-400 truncate">
                / {totalSchools}
              </span>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full bg-slate-100 h-1 sm:h-1.5 rounded-full overflow-hidden mt-1.5 sm:mt-2">
              <div
                className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, morningPercent)}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[9.5px] sm:text-[11px] font-semibold text-emerald-700 mt-1 sm:mt-1.5">
              <span>{morningDone === totalSchools ? '100% OK' : `${morningDone} feitos`}</span>
              <span className="flex items-center gap-0.5 font-bold group-hover:underline">
                <span>Ver lista</span>
                <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* 2. Manhã - Pendentes */}
        <div
          onClick={() => onKpiClick?.('morning_pending')}
          role="button"
          tabIndex={0}
          className="bg-white border border-amber-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xs hover:shadow-xs hover:border-amber-400 active:scale-[0.98] transition flex flex-col justify-between cursor-pointer group text-left"
          title="Clique para ver os postos pendentes de check-in na manhã"
        >
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-amber-800 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded border border-amber-200 truncate">
                Manhã · 06h-13h
              </span>
              <span className="text-[9.5px] sm:text-[10px] font-extrabold uppercase text-amber-700 bg-amber-100 px-1 rounded shrink-0">
                Pendente
              </span>
            </div>
            <h4 className="text-[11px] sm:text-xs font-extrabold text-slate-700 mt-1.5 truncate group-hover:text-amber-900 transition">
              Aguardando Chegada
            </h4>
          </div>

          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <b className={`text-xl sm:text-3xl font-extrabold font-mono tracking-tight ${morningPending > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                {morningPending}
              </b>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-400 truncate">
                postos
              </span>
            </div>

            <div className="w-full bg-slate-100 h-1 sm:h-1.5 rounded-full overflow-hidden mt-1.5 sm:mt-2">
              <div
                className="bg-amber-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, totalSchools > 0 ? (morningPending / totalSchools) * 100 : 0)}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[9.5px] sm:text-[11px] font-semibold text-amber-700 mt-1 sm:mt-1.5">
              <span className="truncate">{morningPending === 0 ? '100% cobertos' : 'Aguardando'}</span>
              <span className="flex items-center gap-0.5 font-bold group-hover:underline">
                <span>Ver lista</span>
                <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* 3. Tarde - Check-ins Realizados */}
        <div
          onClick={() => onKpiClick?.('afternoon_done')}
          role="button"
          tabIndex={0}
          className="bg-white border border-sky-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xs hover:shadow-xs hover:border-sky-400 active:scale-[0.98] transition flex flex-col justify-between cursor-pointer group text-left"
          title="Clique para ver os postos com check-in realizado na tarde"
        >
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-sky-800 bg-sky-50 px-1.5 sm:px-2 py-0.5 rounded border border-sky-200 truncate">
                Tarde · 13h-Término
              </span>
              <span className="text-[10px] sm:text-xs font-bold font-mono text-sky-700 shrink-0">
                {afternoonPercent}%
              </span>
            </div>
            <h4 className="text-[11px] sm:text-xs font-extrabold text-slate-700 mt-1.5 truncate group-hover:text-sky-900 transition">
              Check-ins Tarde
            </h4>
          </div>

          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <b className="text-xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                {afternoonDone}
              </b>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-400 truncate">
                / {totalSchools}
              </span>
            </div>

            <div className="w-full bg-slate-100 h-1 sm:h-1.5 rounded-full overflow-hidden mt-1.5 sm:mt-2">
              <div
                className="bg-sky-600 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, afternoonPercent)}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[9.5px] sm:text-[11px] font-semibold text-sky-700 mt-1 sm:mt-1.5">
              <span>{afternoonDone === totalSchools ? '100% OK' : `${afternoonDone} feitos`}</span>
              <span className="flex items-center gap-0.5 font-bold group-hover:underline">
                <span>Ver lista</span>
                <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* 4. Tarde - Pendentes */}
        <div
          onClick={() => onKpiClick?.('afternoon_pending')}
          role="button"
          tabIndex={0}
          className="bg-white border border-rose-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xs hover:shadow-xs hover:border-rose-400 active:scale-[0.98] transition flex flex-col justify-between cursor-pointer group text-left"
          title="Clique para ver os postos pendentes de check-in na tarde"
        >
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-rose-800 bg-rose-50 px-1.5 sm:px-2 py-0.5 rounded border border-rose-200 truncate">
                Tarde · 13h-Término
              </span>
              <span className="text-[9.5px] sm:text-[10px] font-extrabold uppercase text-rose-700 bg-rose-100 px-1 rounded shrink-0">
                Pendente
              </span>
            </div>
            <h4 className="text-[11px] sm:text-xs font-extrabold text-slate-700 mt-1.5 truncate group-hover:text-rose-900 transition">
              Aguardando Chegada
            </h4>
          </div>

          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <b className={`text-xl sm:text-3xl font-extrabold font-mono tracking-tight ${afternoonPending > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                {afternoonPending}
              </b>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-400 truncate">
                postos
              </span>
            </div>

            <div className="w-full bg-slate-100 h-1 sm:h-1.5 rounded-full overflow-hidden mt-1.5 sm:mt-2">
              <div
                className="bg-rose-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, totalSchools > 0 ? (afternoonPending / totalSchools) * 100 : 0)}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[9.5px] sm:text-[11px] font-semibold text-rose-700 mt-1 sm:mt-1.5">
              <span className="truncate">{afternoonPending === 0 ? '100% cobertos' : 'Aguardando'}</span>
              <span className="flex items-center gap-0.5 font-bold group-hover:underline">
                <span>Ver lista</span>
                <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Faixa inferior com Regra Operacional e Contadores */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 text-xs text-slate-600 shadow-2xs">
        <div className="flex items-center gap-1.5 text-[11px] leading-snug">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span className="text-slate-700">
            Policial escalado para o <strong>dia inteiro</strong> valida automaticamente ambos os turnos.
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 text-[10.5px] font-semibold text-slate-500 self-end sm:self-auto">
          <span>Total: <strong className="text-slate-900">{totalSchools}</strong> postos</span>
          {totalRondas > 0 && (
            <button
              type="button"
              onClick={onRondasClick}
              className="flex items-center gap-1 text-purple-700 font-bold bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded border border-purple-200 transition cursor-pointer"
              title="Ir para a aba de Rondas e Fiscalizações"
            >
              <Car className="w-3 h-3" />
              <span>{totalRondas} {totalRondas === 1 ? 'ronda' : 'rondas'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
