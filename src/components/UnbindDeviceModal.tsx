import React, { useState, useEffect } from 'react';
import { Unlink, X, AlertTriangle, Smartphone, Search, UserX, ShieldAlert, Check } from 'lucide-react';
import { DeviceBinding, StaffMember } from '../types';
import { getAllDeviceBindingsFromCloud } from '../services/firestoreService';

interface UnbindDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  binding?: DeviceBinding | null;
  allStaff?: StaffMember[];
  onConfirmUnbind: (reason: string, notes?: string, targetBinding?: DeviceBinding) => void;
}

export const UnbindDeviceModal: React.FC<UnbindDeviceModalProps> = ({
  isOpen,
  onClose,
  binding,
  allStaff = [],
  onConfirmUnbind,
}) => {
  const [selectedReason, setSelectedReason] = useState('Imprevisto com o aparelho (bateria/avaria)');
  const [customNotes, setCustomNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tabs: 'current' (this phone) or 'other' (another officer's device in the troop)
  const [mode, setMode] = useState<'current' | 'other'>(binding ? 'current' : 'other');

  // For unbinding another officer:
  const [searchRe, setSearchRe] = useState('');
  const [cloudBindings, setCloudBindings] = useState<Record<string, DeviceBinding>>({});
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [selectedTargetBinding, setSelectedTargetBinding] = useState<DeviceBinding | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(binding ? 'current' : 'other');
      setSelectedTargetBinding(null);
      setSearchRe('');
      setCustomNotes('');
      setSelectedReason('Imprevisto com o aparelho (bateria/avaria)');

      // Fetch cloud device bindings to show any active troop bindings
      setIsLoadingCloud(true);
      getAllDeviceBindingsFromCloud()
        .then((data) => setCloudBindings(data || {}))
        .catch(() => setCloudBindings({}))
        .finally(() => setIsLoadingCloud(false));
    }
  }, [isOpen, binding]);

  if (!isOpen) return null;

  const reasons = [
    'Imprevisto com o aparelho (bateria/avaria)',
    'Policial substituído / Alteração de escala',
    'Empréstimo de aparelho para outro militar',
    'Troca de posto ou remanejamento',
    'Outro motivo operacional da P/3',
  ];

  // List of active cloud bindings
  const activeCloudList = Object.values(cloudBindings).filter(
    (b): b is DeviceBinding => Boolean(b && b.boundRe)
  );

  // Filter staff or active bindings by search query
  const cleanSearch = searchRe.trim().toLowerCase().replace(/\D/g, '');
  const searchCandidates = searchRe.trim()
    ? activeCloudList.filter((b) => {
        const cleanBRe = (b.boundRe || '').replace(/\D/g, '');
        const normName = (b.boundName || '').toLowerCase();
        return cleanBRe.includes(cleanSearch) || normName.includes(searchRe.trim().toLowerCase());
      })
    : activeCloudList;

  // Also check allStaff in case device binding was not found in cloudBindings map yet
  const matchedStaff = searchRe.trim()
    ? allStaff.filter((s) => {
        const cleanSRe = (s.re || '').replace(/\D/g, '');
        const normName = (s.name || '').toLowerCase();
        return cleanSRe.includes(cleanSearch) || normName.includes(searchRe.trim().toLowerCase());
      }).slice(0, 5)
    : [];

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (mode === 'current' && binding) {
      onConfirmUnbind(selectedReason, customNotes.trim() || undefined, binding);
    } else if (selectedTargetBinding) {
      onConfirmUnbind(selectedReason, customNotes.trim() || undefined, selectedTargetBinding);
    } else if (searchRe.trim()) {
      // Create ad-hoc binding representation by RE
      const fallbackStaff = allStaff.find(
        (s) => s.re.replace(/\D/g, '') === cleanSearch || s.re === searchRe.trim()
      );
      const adhocBinding: DeviceBinding = {
        deviceId: 'manual-re-' + cleanSearch,
        boundRe: fallbackStaff?.re || searchRe.trim(),
        boundName: fallbackStaff?.name || 'Policial Militar',
        boundRank: fallbackStaff?.rank || 'PM',
        boundAt: new Date().toISOString(),
      };
      onConfirmUnbind(selectedReason, customNotes.trim() || undefined, adhocBinding);
    } else {
      // Just unbind current device / clear local
      onConfirmUnbind(selectedReason, customNotes.trim() || undefined, binding || undefined);
    }

    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200 max-h-[94vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <Unlink className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                Gestão P/3 · Área Restrita
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Desvincular Aparelho Celular
            </h2>
          </div>
        </div>

        {/* Mode Selector Tabs (Se houver aparelho atual vinculado) */}
        {binding && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl mb-4">
            <button
              type="button"
              onClick={() => {
                setMode('current');
                setSelectedTargetBinding(null);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'current'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-600" />
              <span>Aparelho Deste Celular</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('other')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'other'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserX className="w-3.5 h-3.5 text-rose-600" />
              <span>Outro Policial da Tropa</span>
            </button>
          </div>
        )}

        {/* Content depending on Mode */}
        {mode === 'current' && binding ? (
          /* Bound Officer Card (This Phone) */
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl mb-4">
            <div className="flex items-start gap-2.5">
              <Smartphone className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                  Policial Atualmente Vinculado a este Celular:
                </span>
                <p className="text-sm font-black text-slate-900 truncate">
                  {binding.boundRank} {binding.boundName}
                </p>
                <p className="text-xs font-mono font-bold text-blue-700">
                  RE: {binding.boundRe}
                </p>
                {binding.boundAt && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Vinculado em: {new Date(binding.boundAt).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Search / Select another officer from the battalion */
          <div className="space-y-3 mb-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <label className="block text-xs font-black text-slate-700 mb-1.5">
                Localizar Policial para Desvincular Aparelho:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchRe}
                  onChange={(e) => {
                    setSearchRe(e.target.value);
                    setSelectedTargetBinding(null);
                  }}
                  placeholder="Digite o RE ou nome do policial..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:border-rose-500 outline-none font-medium"
                />
              </div>

              {/* Selected Officer Box */}
              {selectedTargetBinding && (
                <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-rose-800 uppercase block">
                      Policial Selecionado:
                    </span>
                    <p className="text-xs font-black text-slate-900 truncate">
                      {selectedTargetBinding.boundRank} {selectedTargetBinding.boundName}
                    </p>
                    <p className="text-[11px] font-mono font-bold text-blue-700">
                      RE: {selectedTargetBinding.boundRe}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTargetBinding(null)}
                    className="p-1 text-rose-600 hover:text-rose-800 rounded-lg hover:bg-rose-100 text-xs font-bold"
                  >
                    ✕ Trocar
                  </button>
                </div>
              )}
            </div>

            {/* Quick list of currently bound devices in the cloud */}
            {!selectedTargetBinding && activeCloudList.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-extrabold text-slate-600 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Aparelhos com Vínculo Ativo na Tropa ({activeCloudList.length}):</span>
                </span>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {searchCandidates.map((b) => (
                    <div
                      key={b.deviceId || b.boundRe}
                      onClick={() => setSelectedTargetBinding(b)}
                      className="p-2.5 bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 rounded-xl transition cursor-pointer flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-slate-900 mr-2">
                          RE: {b.boundRe}
                        </span>
                        <span className="font-bold text-slate-700 truncate">
                          {b.boundRank} {b.boundName}
                        </span>
                      </div>
                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 shrink-0">
                        Selecionar
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* If no device binding found in list, show matching staff by RE */}
            {!selectedTargetBinding && searchRe.trim() && searchCandidates.length === 0 && matchedStaff.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-extrabold text-slate-600">
                  Efetivo do Batalhão Encontrado:
                </span>
                <div className="space-y-1.5">
                  {matchedStaff.map((s) => (
                    <div
                      key={s.re}
                      onClick={() =>
                        setSelectedTargetBinding({
                          deviceId: 'cloud-re-' + s.re.replace(/\D/g, ''),
                          boundRe: s.re,
                          boundName: s.name,
                          boundRank: s.rank,
                          boundAt: new Date().toISOString(),
                        })
                      }
                      className="p-2.5 bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 rounded-xl transition cursor-pointer flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-slate-900 mr-2">
                          RE: {s.re}
                        </span>
                        <span className="font-bold text-slate-700 truncate">
                          {s.rank} {s.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 shrink-0">
                        Desvincular
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form: Motivo e Observações */}
        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">
              Motivo da Desvinculação:
            </label>
            <div className="space-y-1.5">
              {reasons.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                    selectedReason === reason
                      ? 'bg-rose-50 border-rose-300 text-rose-950 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="unbindReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observação da P/3 (Opcional):
            </label>
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Ex: Policial emprestou aparelho para outro militar"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-400 outline-none"
            />
          </div>

          {/* Warning Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              Ao desvincular, a liberação é imediata. O militar poderá vincular seu RE em qualquer outro aparelho celular e o aparelho anterior ficará desimpedido.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer min-h-[42px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-black transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
            >
              <Unlink className="w-4 h-4" />
              <span>Confirmar Desvinculação</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
