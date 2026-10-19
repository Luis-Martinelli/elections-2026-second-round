import React, { useState, useEffect, useMemo } from 'react';
import {
  Smartphone,
  Unlink,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  UserX,
  FileText,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { DeviceBinding, StaffMember, AuditJustificationRecord } from '../types';
import { getAllDeviceBindingsFromCloud } from '../services/firestoreService';

interface DeviceManagementTabProps {
  deviceBinding: DeviceBinding | null;
  staffList: StaffMember[];
  auditLogs: AuditJustificationRecord[];
  onOpenUnbindModal: () => void;
  onConfirmUnbind: (reason: string, notes?: string, targetBinding?: DeviceBinding) => void;
}

export const DeviceManagementTab: React.FC<DeviceManagementTabProps> = ({
  deviceBinding,
  staffList,
  auditLogs,
  onOpenUnbindModal,
  onConfirmUnbind,
}) => {
  const [cloudBindings, setCloudBindings] = useState<Record<string, DeviceBinding>>({});
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'ativos' | 'historico'>('ativos');

  // Quick unbind confirmation state for inline action
  const [selectedBindingForAction, setSelectedBindingForAction] = useState<DeviceBinding | null>(null);
  const [actionReason, setActionReason] = useState('Imprevisto com o aparelho (bateria/avaria)');
  const [actionNotes, setActionNotes] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const fetchBindings = async () => {
    setIsLoadingCloud(true);
    try {
      const data = await getAllDeviceBindingsFromCloud();
      setCloudBindings(data || {});
    } catch (err) {
      console.warn('Erro ao carregar vínculos de aparelhos:', err);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  useEffect(() => {
    fetchBindings();
  }, []);

  // Filtered active cloud bindings list
  const activeBindingsList = useMemo(() => {
    const list = Object.values(cloudBindings).filter(
      (b): b is DeviceBinding => Boolean(b && b.boundRe)
    );
    // If local binding exists and not already in list, include it
    if (deviceBinding && !list.some((b) => b.deviceId === deviceBinding.deviceId)) {
      list.unshift(deviceBinding);
    }
    return list;
  }, [cloudBindings, deviceBinding]);

  const filteredBindings = useMemo(() => {
    if (!searchFilter.trim()) return activeBindingsList;
    const cleanQuery = searchFilter.trim().toLowerCase().replace(/\D/g, '');
    const textQuery = searchFilter.trim().toLowerCase();

    return activeBindingsList.filter((b) => {
      const cleanRe = (b.boundRe || '').replace(/\D/g, '');
      const name = (b.boundName || '').toLowerCase();
      const rank = (b.boundRank || '').toLowerCase();
      const devId = (b.deviceId || '').toLowerCase();

      return (
        cleanRe.includes(cleanQuery) ||
        name.includes(textQuery) ||
        rank.includes(textQuery) ||
        devId.includes(textQuery)
      );
    });
  }, [activeBindingsList, searchFilter]);

  // Unbind audit records
  const unbindAuditLogs = useMemo(() => {
    return auditLogs.filter(
      (log) =>
        log.action === 'UNBIND_DEVICE' ||
        log.action === 'DEVICE_LOGOUT' ||
        (log.officer && log.reason)
    );
  }, [auditLogs]);

  const reasons = [
    'Imprevisto com o aparelho (bateria/avaria)',
    'Policial substituído / Alteração de escala',
    'Empréstimo de aparelho para outro militar',
    'Troca de posto ou remanejamento',
    'Outro motivo operacional da P/3',
  ];

  const handleExecuteUnbind = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBindingForAction) return;

    setIsSubmittingAction(true);
    onConfirmUnbind(actionReason, actionNotes.trim() || undefined, selectedBindingForAction);

    // Optimistically update cloud bindings list
    setCloudBindings((prev) => {
      const next = { ...prev };
      delete next[selectedBindingForAction.deviceId];
      return next;
    });

    setIsSubmittingAction(false);
    setSelectedBindingForAction(null);
    setActionNotes('');
    setActionReason('Imprevisto com o aparelho (bateria/avaria)');
  };

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-6 animate-in fade-in duration-200">
      {/* Header da Aba Gestão de Aparelhos */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                Somente Área Restrita P/3
              </span>
              <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Eleições 2026
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5">
              Gestão de Aparelhos Celulares
            </h2>
            <p className="text-xs text-slate-500">
              Controle de vínculos por RE, liberação rápida para substituição de militar e histórico de desvinculações.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={fetchBindings}
            disabled={isLoadingCloud}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer min-h-[40px]"
            title="Atualizar lista de aparelhos da nuvem"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCloud ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={onOpenUnbindModal}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer min-h-[40px]"
            title="Abrir formulário de desvinculação por RE"
          >
            <Unlink className="w-3.5 h-3.5" />
            <span>Desvincular por RE</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Aparelhos Vinculados</span>
            <Smartphone className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {activeBindingsList.length}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Na nuvem da tropa</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Este Celular</span>
            <Shield className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xs sm:text-sm font-black text-slate-900 truncate">
            {deviceBinding ? `RE: ${deviceBinding.boundRe}` : 'Dispositivo Livre'}
          </div>
          <span className={`text-[10px] font-bold ${deviceBinding ? 'text-amber-600' : 'text-emerald-600'}`}>
            {deviceBinding ? 'Vinculado a militar' : 'Sem vínculo individual'}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Desvinculações</span>
            <UserX className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {unbindAuditLogs.length}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Registros de auditoria</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Efetivo Cadastrado</span>
            <FileText className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {staffList.length}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Policiais importados</span>
        </div>
      </div>

      {/* Card de Status do Dispositivo Atual */}
      <div className={`border rounded-2xl p-4 sm:p-5 shadow-xs transition ${
        deviceBinding
          ? 'bg-amber-50/80 border-amber-300/80'
          : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              deviceBinding ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'
            }`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  deviceBinding ? 'bg-amber-200/90 text-amber-900' : 'bg-slate-200 text-slate-700'
                }`}>
                  {deviceBinding ? 'Aparelho Atual Vinculado' : 'Aparelho Atual Livre'}
                </span>
                {deviceBinding && (
                  <span className="text-xs font-mono font-bold text-slate-800 bg-white border border-amber-200 px-2 py-0.5 rounded-md">
                    RE: {deviceBinding.boundRe}
                  </span>
                )}
              </div>
              <p className="text-sm font-black text-slate-900 mt-0.5">
                {deviceBinding
                  ? `${deviceBinding.boundRank} ${deviceBinding.boundName}`
                  : 'Este dispositivo não está vinculado a nenhum policial militar.'}
              </p>
              {deviceBinding?.boundAt && (
                <p className="text-[10px] text-slate-500">
                  Vinculado em: {new Date(deviceBinding.boundAt).toLocaleString('pt-BR')} · ID: {deviceBinding.deviceId}
                </p>
              )}
            </div>
          </div>

          {deviceBinding && (
            <button
              type="button"
              onClick={() => setSelectedBindingForAction(deviceBinding)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black rounded-xl transition shadow-xs cursor-pointer shrink-0"
              title="Desvincular RE deste aparelho celular (Liberação P/3)"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Desvincular Este Aparelho</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-abas de Navegação: Aparelhos Ativos vs Histórico de Desvinculações */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('ativos')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'ativos'
              ? 'bg-[#0F2B48] text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Aparelhos com Vínculo Ativo</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
            activeSubTab === 'ativos' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {activeBindingsList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('historico')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'historico'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Histórico de Desvinculações</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
            activeSubTab === 'historico' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'
          }`}>
            {unbindAuditLogs.length}
          </span>
        </button>
      </div>

      {/* Visualização de Aparelhos Ativos */}
      {activeSubTab === 'ativos' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
          {/* Barra de Pesquisa */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar por RE, nome do militar ou ID do aparelho..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none font-medium"
              />
            </div>

            <div className="text-[11px] font-bold text-slate-500 self-end sm:self-center">
              Mostrando {filteredBindings.length} de {activeBindingsList.length} aparelhos
            </div>
          </div>

          {/* Tabela de Aparelhos */}
          {filteredBindings.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-3.5">Militar Vinculado</th>
                    <th className="py-3 px-3.5">RE</th>
                    <th className="py-3 px-3.5">ID do Dispositivo</th>
                    <th className="py-3 px-3.5">Data do Vínculo</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5 text-right">Ação P/3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredBindings.map((binding) => {
                    const isCurrentDevice = deviceBinding?.deviceId === binding.deviceId;
                    return (
                      <tr key={binding.deviceId} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3.5">
                          <div className="font-black text-slate-900">
                            {binding.boundRank} {binding.boundName}
                          </div>
                          {isCurrentDevice && (
                            <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-sm inline-block mt-0.5">
                              Este aparelho (Local)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 font-mono font-bold text-blue-700">
                          {binding.boundRe}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500 max-w-[140px] truncate" title={binding.deviceId}>
                          {binding.deviceId}
                        </td>
                        <td className="py-3 px-3.5 text-slate-500 text-[11px]">
                          {binding.boundAt ? new Date(binding.boundAt).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Ativo</span>
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedBindingForAction(binding)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer shadow-2xs active:scale-95"
                            title={`Desvincular aparelho do PM ${binding.boundName}`}
                          >
                            <Unlink className="w-3 h-3 text-rose-600" />
                            <span>Desvincular</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
              <Smartphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                {searchFilter ? 'Nenhum aparelho corresponde à busca.' : 'Nenhum aparelho vinculado registrado no momento.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Os aparelhos são vinculados automaticamente quando cada policial militar confirma seu RE no primeiro acesso.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Visualização do Histórico de Desvinculações */}
      {activeSubTab === 'historico' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Histórico de Auditoria de Desvinculações
              </h3>
              <p className="text-[11px] text-slate-500">
                Registro oficial de aparelhos liberados pela P/3 durante o período eleitoral.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
              {unbindAuditLogs.length} eventos
            </span>
          </div>

          {unbindAuditLogs.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-3.5">Data / Hora</th>
                    <th className="py-3 px-3.5">Militar Desvinculado</th>
                    <th className="py-3 px-3.5">Motivo Operacional</th>
                    <th className="py-3 px-3.5">Observação</th>
                    <th className="py-3 px-3.5">Responsável P/3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {unbindAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                        {log.dateTimeStr || new Date(log.timestamp).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-3.5 font-bold text-slate-900">
                        {log.officer || `${log.originRank || ''} ${log.originName || ''} (RE: ${log.originRe || ''})`}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                          {log.reason || log.justification || 'Desvinculação P/3'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 text-[11px] max-w-[200px] truncate" title={log.notes || ''}>
                        {log.notes || '—'}
                      </td>
                      <td className="py-3 px-3.5 text-[11px] font-mono text-slate-500">
                        {log.executor || 'Supervisão P/3'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
              <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                Nenhum log de desvinculação registrado ainda.
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Todas as desvinculações realizadas por esta tela ou pela barra superior serão arquivadas aqui para fins de auditoria militar.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal / Diálogo de Confirmação Rápida de Desvinculação */}
      {selectedBindingForAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Unlink className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                  Confirmação P/3
                </span>
                <h3 className="text-base font-black text-slate-900 mt-0.5">
                  Confirmar Desvinculação
                </h3>
              </div>
            </div>

            {/* Informações do Militar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Policial Militar:
              </span>
              <p className="text-sm font-black text-slate-900">
                {selectedBindingForAction.boundRank} {selectedBindingForAction.boundName}
              </p>
              <p className="text-xs font-mono font-bold text-blue-700">
                RE: {selectedBindingForAction.boundRe}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                ID Aparelho: {selectedBindingForAction.deviceId}
              </p>
            </div>

            <form onSubmit={handleExecuteUnbind} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  Motivo da Desvinculação:
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {reasons.map((reason) => (
                    <label
                      key={reason}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition ${
                        actionReason === reason
                          ? 'bg-rose-50 border-rose-300 text-rose-950 font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="inlineUnbindReason"
                        value={reason}
                        checked={actionReason === reason}
                        onChange={(e) => setActionReason(e.target.value)}
                        className="text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações da P/3 (Opcional):
                </label>
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Ex: Celular descarregou na escola, militar usando aparelho de apoio"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-400 outline-none"
                />
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-snug">
                  A liberação é imediata. O militar poderá vincular seu RE em outro aparelho e este aparelho ficará desimpedido.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBindingForAction(null)}
                  className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isSubmittingAction ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Unlink className="w-3.5 h-3.5" />
                  )}
                  <span>Confirmar Liberação</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
