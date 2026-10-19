import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  Smartphone, 
  Search, 
  Clock, 
  UserCheck, 
  ArrowRight, 
  MessageSquare, 
  Calendar,
  Layers,
  List,
  Trash2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { AuditJustificationRecord } from '../types';

interface ReAuditTabProps {
  auditLogs: AuditJustificationRecord[];
  onDeleteLog?: (logId: string) => Promise<void> | void;
}

export const ReAuditTab: React.FC<ReAuditTabProps> = ({ auditLogs, onDeleteLog }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'timeline'>('grouped');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Filter only valid RE change logs (having originRe and targetRe)
  const validLogs = useMemo(() => {
    return auditLogs.filter(
      (log) => Boolean(log.originRe && log.targetRe && (log.justification || log.originName))
    );
  }, [auditLogs]);

  // Filter based on search term
  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return validLogs;
    const term = searchTerm.toLowerCase().trim();
    return validLogs.filter((log) => {
      const originRe = (log.originRe || '').toLowerCase();
      const originName = (log.originName || '').toLowerCase();
      const targetRe = (log.targetRe || '').toLowerCase();
      const targetName = (log.targetName || '').toLowerCase();
      const justification = (log.justification || '').toLowerCase();
      const dateStr = (log.dateTimeStr || '').toLowerCase();

      return (
        originRe.includes(term) ||
        originName.includes(term) ||
        targetRe.includes(term) ||
        targetName.includes(term) ||
        justification.includes(term) ||
        dateStr.includes(term)
      );
    });
  }, [validLogs, searchTerm]);

  // Group logs by origin police officer (bound officer)
  const groupedByOrigin = useMemo(() => {
    const groups = new Map<
      string,
      {
        originRe: string;
        originName: string;
        deviceId: string;
        logs: AuditJustificationRecord[];
        lastActivity: number;
      }
    >();

    filteredLogs.forEach((log) => {
      const key = log.originRe?.trim() || 'DESCONHECIDO';
      if (!groups.has(key)) {
        groups.set(key, {
          originRe: log.originRe || '',
          originName: log.originName || 'Policial Vinculado',
          deviceId: log.deviceId || '',
          logs: [],
          lastActivity: log.timestamp || 0
        });
      }

      const group = groups.get(key)!;
      group.logs.push(log);
      if (log.timestamp && log.timestamp > group.lastActivity) {
        group.lastActivity = log.timestamp;
      }
    });

    // Sort groups by most recent activity
    const sortedGroups = Array.from(groups.values()).sort(
      (a, b) => b.lastActivity - a.lastActivity
    );

    // Sort logs inside each group by timestamp descending
    sortedGroups.forEach((g) => {
      g.logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    });

    return sortedGroups;
  }, [filteredLogs]);

  // Total distinct bound officers who performed changes
  const distinctOfficersCount = useMemo(() => {
    const set = new Set(validLogs.map((l) => l.originRe).filter(Boolean));
    return set.size;
  }, [validLogs]);

  const handleDelete = async (logId: string) => {
    if (!onDeleteLog) return;
    setIsDeletingId(logId);
    try {
      await onDeleteLog(logId);
      setConfirmDeleteId(null);
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Top Banner / Summary */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-50 to-blue-500/10 border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Auditoria de Troca de RE
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                  Segurança Antifraude
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Registro de policiais que acessaram ou justificaram troca de RE em aparelhos celulares já vinculados.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-center shadow-2xs">
              <span className="block text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                Total de Trocas
              </span>
              <span className="text-lg font-black text-amber-600">
                {validLogs.length}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-center shadow-2xs">
              <span className="block text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                Aparelhos / Policiais
              </span>
              <span className="text-lg font-black text-[#0F2B48]">
                {distinctOfficersCount}
              </span>
            </div>
          </div>
        </div>

        {/* Filter and View Mode Controls */}
        <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por RE, Nome ou motivo..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl w-full sm:w-auto self-end">
            <button
              onClick={() => setViewMode('grouped')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-[#0F2B48] text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Por RE Vinculado</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-[#0F2B48] text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Ordem Cronológica</span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Smartphone className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-black text-slate-700">
            {searchTerm ? 'Nenhum registro encontrado para essa busca' : 'Nenhuma troca de RE auditada até o momento'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchTerm 
              ? 'Tente buscar por outro número de RE, parte do nome ou palavra-chave da justificativa.'
              : 'Quando um policial com aparelho já vinculado tentar consultar outro RE e prestar uma justificativa, o registro aparecerá automaticamente aqui.'}
          </p>
        </div>
      ) : viewMode === 'grouped' ? (
        /* ========================================================== */
        /* MODE 1: AGRUPADO POR POLICIAL / RE VINCULADO NO CELULAR    */
        /* ========================================================== */
        <div className="space-y-4">
          {groupedByOrigin.map((group) => (
            <div
              key={group.originRe}
              className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden transition hover:border-slate-300"
            >
              {/* Group Header (Nome e RE do Policial Vinculado no Celular) */}
              <div className="bg-slate-50/80 border-b border-slate-200/80 px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 text-blue-800 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4 text-blue-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-900">
                        {group.originName}
                      </span>
                      <span className="text-xs font-mono font-black text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                        RE Vinculado: {group.originRe}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>Aparelho Celular Registrado</span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        ID: {group.deviceId || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                    {group.logs.length} {group.logs.length === 1 ? 'troca registrada' : 'trocas registradas'}
                  </span>
                </div>
              </div>

              {/* Group Body: As Trocas e os Motivos */}
              <div className="p-4 sm:p-5 space-y-3">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Histórico de REs Acessados & Justificativas Apresentadas:</span>
                </div>

                <div className="space-y-2.5">
                  {group.logs.map((log, idx) => {
                    const logId = log.id || `temp-${idx}`;
                    const isConfirming = confirmDeleteId === logId;
                    const isDeleting = isDeletingId === logId;

                    return (
                      <div
                        key={logId}
                        className="bg-slate-50/60 border border-slate-200 rounded-xl p-3 sm:p-3.5 hover:bg-slate-50 transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2 mb-2">
                          {/* Target Officer */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                              <span>Trocou para:</span>
                              <ArrowRight className="w-3 h-3 text-amber-600" />
                            </span>
                            <span className="text-xs font-black text-slate-800">
                              {log.targetName}
                            </span>
                            <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              RE {log.targetRe}
                            </span>
                          </div>

                          {/* Date and Delete Button */}
                          <div className="flex items-center justify-between sm:justify-end gap-3">
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{log.dateTimeStr || (log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : 'Data não registrada')}</span>
                            </div>

                            {/* Delete Action Button */}
                            {onDeleteLog && (
                              <div>
                                {isConfirming ? (
                                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                                    <span className="text-[11px] font-black text-rose-700 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                                      Excluir?
                                    </span>
                                    <button
                                      disabled={isDeleting}
                                      onClick={() => handleDelete(logId)}
                                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-black transition cursor-pointer flex items-center gap-1"
                                      title="Confirmar exclusão definitiva do registro"
                                    >
                                      {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sim'}
                                    </button>
                                    <button
                                      disabled={isDeleting}
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-black transition cursor-pointer"
                                    >
                                      Não
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteId(logId)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                                    title="Excluir este registro de auditoria manualmente"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Excluir</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Motivo / Justificativa */}
                        <div className="flex items-start gap-2 bg-amber-50/70 border border-amber-200/80 rounded-lg p-2.5 text-xs">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-extrabold text-amber-900 block text-[11px]">
                              Motivo / Justificativa informada:
                            </span>
                            <p className="text-slate-700 font-medium italic mt-0.5 break-words">
                              "{log.justification || 'Nenhuma justificativa detalhada foi fornecida.'}"
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ========================================================== */
        /* MODE 2: ORDEM CRONOLÓGICA (LINHA DO TEMPO)                 */
        /* ========================================================== */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs divide-y divide-slate-100 overflow-hidden">
          {filteredLogs.map((log, idx) => {
            const logId = log.id || `temp-tl-${idx}`;
            const isConfirming = confirmDeleteId === logId;
            const isDeleting = isDeletingId === logId;

            return (
              <div key={logId} className="p-4 sm:p-5 hover:bg-slate-50/70 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-blue-900">
                      {log.originName}
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                      RE {log.originRe}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs font-black text-slate-900">
                      {log.targetName}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      RE {log.targetRe}
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold shrink-0">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{log.dateTimeStr || (log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : '')}</span>
                    </div>

                    {onDeleteLog && (
                      <div>
                        {isConfirming ? (
                          <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                            <span className="text-[10px] font-black text-rose-700">Excluir?</span>
                            <button
                              disabled={isDeleting}
                              onClick={() => handleDelete(logId)}
                              className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-black cursor-pointer"
                            >
                              {isDeleting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Sim'}
                            </button>
                            <button
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-black cursor-pointer"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(logId)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Excluir este registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 text-xs flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-amber-900 text-[11px] block">
                      Motivo declarado:
                    </span>
                    <p className="text-slate-700 font-medium italic mt-0.5">
                      "{log.justification}"
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
