import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, X, CheckCircle2, Lock } from 'lucide-react';
import { DeviceBinding } from '../types';

interface JustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (justificationText: string) => void;
  binding: DeviceBinding;
  targetCandidate: {
    name: string;
    rank: string;
    re: string;
  };
  userEmail?: string;
}

export const JustificationModal: React.FC<JustificationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  binding,
  targetCandidate,
  userEmail
}) => {
  const [justification, setJustification] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = justification.trim();
    if (clean.length < 5) {
      setErrorMsg('Informe uma justificativa válida de serviço (mínimo 5 caracteres).');
      return;
    }
    setErrorMsg('');
    onConfirm(clean);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200 max-h-[94vh] sm:max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 ring-4 ring-amber-50">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full inline-block">
              Controle de Segurança Orgânica
            </span>
            <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1 leading-tight">
              Justificativa de Troca de RE
            </h3>
          </div>
        </div>

        {/* Warning context box */}
        <div className="mt-4 p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs space-y-1.5 text-amber-950">
          <div className="flex items-center gap-1.5 font-extrabold text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
            <span>Dispositivo ou e-mail previamente vinculado:</span>
          </div>
          <div className="pl-5 text-[11px] text-amber-800">
            <strong>{binding.boundRank} {binding.boundName}</strong> (RE: {binding.boundRe})
            {userEmail && <span className="block text-slate-500 font-mono mt-0.5">Conta: {userEmail}</span>}
          </div>

          <div className="border-t border-amber-200/80 pt-1.5 mt-2">
            <span className="text-slate-600">Policial militar a ser consultado:</span>
            <div className="font-extrabold text-slate-900 mt-0.5">
              {targetCandidate.rank} {targetCandidate.name} (RE: {targetCandidate.re})
            </div>
          </div>
        </div>

        {/* Justification form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="input-justification"
              className="block text-xs font-black text-slate-700 mb-1"
            >
              Motivo operacional da consulta:
            </label>
            <textarea
              id="input-justification"
              rows={3}
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="Ex: Apoio ao colega sem bateria no celular / Fiscalização de Ronda / Mudança de escala"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-amber-600 focus:bg-white focus:ring-4 focus:ring-amber-100 rounded-xl text-xs font-medium text-slate-900 outline-none transition resize-none"
            />
            {errorMsg && (
              <p className="mt-1 text-xs font-bold text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </p>
            )}
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Este registro ficará arquivado na auditoria oficial da P/3.</span>
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
              id="btn-confirm-justification"
              type="submit"
              className="w-full py-2.5 px-3 rounded-xl bg-amber-700 hover:bg-amber-800 active:scale-[0.98] text-white text-xs font-black transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar Acesso</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
