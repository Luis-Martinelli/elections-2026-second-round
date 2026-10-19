import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, CheckCircle2, RefreshCw, X, ShieldAlert } from 'lucide-react';

interface ResetSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkInsCount: number;
  rondasCount: number;
  onConfirmReset: () => Promise<void>;
  onConfirmWipeAll?: () => Promise<void>;
  dayLabel: string;
}

export const ResetSystemModal: React.FC<ResetSystemModalProps> = ({
  isOpen,
  onClose,
  checkInsCount,
  rondasCount,
  onConfirmReset,
  onConfirmWipeAll,
  dayLabel
}) => {
  const [resetMode, setResetMode] = useState<'day' | 'all'>('all');
  const [isResetting, setIsResetting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsResetting(true);
    setErrorMsg(null);
    try {
      if (resetMode === 'all' && onConfirmWipeAll) {
        await onConfirmWipeAll();
      } else {
        await onConfirmReset();
      }
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2500);
    } catch (err: any) {
      console.error('Erro ao zerar dados:', err);
      setErrorMsg(err?.message || 'Erro ao zerar dados de teste. Tente novamente.');
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0F2B48]">
                Zerar Dados do Sistema
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Preparação para o dia da Eleição Oficial 2026
              </p>
            </div>
          </div>
          {!isResetting && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3.5 text-xs">
          {isSuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-start gap-3 animate-in zoom-in-95 duration-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-sm font-extrabold text-emerald-950">
                  Dados de Testes Zerados com Sucesso!
                </strong>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Os check-ins e fiscalizações do dia {dayLabel} foram removidos da nuvem e dos dispositivos vinculados. Os registros de outros dias foram preservados.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Opções de Escopo da Limpeza */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setResetMode('all')}
                  className={`py-2 px-3 rounded-lg text-xs font-black transition cursor-pointer ${
                    resetMode === 'all'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Zerar 100% o Banco
                </button>
                <button
                  type="button"
                  onClick={() => setResetMode('day')}
                  className={`py-2 px-3 rounded-lg text-xs font-black transition cursor-pointer ${
                    resetMode === 'day'
                      ? 'bg-[#0F2B48] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Apenas Dados do Dia
                </button>
              </div>

              {resetMode === 'all' ? (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-950">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="block font-black text-xs mb-1 text-red-900">
                      Zerar 100% do Banco de Dados (Preparado para Novo Banco)
                    </strong>
                    Esta operação apaga completamente <strong>todas as coleções na nuvem Firestore</strong> (escolas, postos, efetivo, check-ins, rondas e logs). O banco ficará totalmente <strong>vazio (zerado)</strong> e pronto para receber uma nova importação oficial de planilhas.
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="block font-extrabold text-xs mb-1">
                      Limpeza de Check-ins do Dia Selecionado ({dayLabel})
                    </strong>
                    Apaga apenas os check-ins e fiscalizações do dia exibido no painel. O efetivo e as escolas são mantidos intactos.
                  </div>
                </div>
              )}

              {/* Data Summary to be cleared */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block">Check-ins a Apagar:</span>
                  <span className="text-xl font-black text-red-600">{checkInsCount}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block">Rondas a Apagar:</span>
                  <span className="text-xl font-black text-red-600">{rondasCount}</span>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-bold">
                  {errorMsg}
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {!isSuccess && (
          <div className="mt-5 pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isResetting}
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              id="btn-confirm-reset-system"
              type="button"
              disabled={isResetting}
              onClick={handleConfirm}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-50 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer min-h-[42px]"
            >
              {isResetting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Zerando Sistema...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Confirmar e Zerar Sistema Agora</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
