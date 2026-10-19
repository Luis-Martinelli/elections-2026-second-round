import React from 'react';
import { Shield, UserCheck, CheckCircle2, X, Car } from 'lucide-react';
import { StaffMember, SchoolItem, SchoolOfficer } from '../types';
import { isGcmOfficer } from '../utils/checkinStatus';

interface ConfirmIdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  candidate: {
    staff?: StaffMember;
    schoolItem?: SchoolItem;
    assignedSchools?: Array<{
      school: SchoolItem;
      shift: 'Manhã' | 'Tarde' | 'Integral';
      officer: SchoolOfficer;
    }>;
    assignedShift?: 'Manhã' | 'Tarde' | 'Integral';
    isMotorized?: boolean;
    re?: string;
    name?: string;
    rank?: string;
  };
  hasExistingBinding: boolean;
  existingBindingName?: string;
}

export const ConfirmIdentityModal: React.FC<ConfirmIdentityModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  candidate,
  hasExistingBinding,
  existingBindingName
}) => {
  if (!isOpen) return null;

  const { staff, schoolItem, assignedShift, assignedSchools } = candidate;
  const rank = candidate.rank || staff?.rank || (assignedShift === 'Manhã' ? schoolItem?.am.rank : schoolItem?.pm.rank) || 'Policial Militar';
  const name = candidate.name || staff?.name || (assignedShift === 'Manhã' ? schoolItem?.am.name : schoolItem?.pm.name) || '';
  const re = candidate.re || staff?.re || (assignedShift === 'Manhã' ? schoolItem?.am.re : schoolItem?.pm.re) || '';
  const opm = staff?.unit || schoolItem?.opm || '40º BPM/I - CPI-7';

  const multiSchoolBadge = assignedSchools && assignedSchools.length > 1
    ? `${assignedSchools.length} Postos Eleitorais Designados`
    : (candidate.isMotorized ? 'Ronda / CGP' : schoolItem?.school);

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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0F2B48] to-blue-700 text-white flex items-center justify-center mx-auto shadow-md shadow-blue-900/20 mb-4 ring-4 ring-blue-50">
            <UserCheck className="w-8 h-8 text-amber-400" />
          </div>

          <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
            {isGcmOfficer({ re, name, rank }) ? 'Rendição Guarda Civil Municipal' : 'Confirmação de Identidade'}
          </span>

          <h3 className="text-lg font-black text-slate-900 mt-2">
            {isGcmOfficer({ re, name, rank }) ? 'Posto com Rendição GCM' : 'Você é este policial militar?'}
          </h3>

          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 block tracking-wider">
              {opm}
            </span>
            <div className="text-base font-black text-[#0F2B48] mt-0.5 leading-tight">
              {isGcmOfficer({ re, name, rank }) ? 'Guarda Civil Municipal (GCM)' : `${rank} ${name}`}
            </div>
            <div className="mt-1 flex items-center justify-center gap-1.5 flex-wrap">
              {isGcmOfficer({ re, name, rank }) ? (
                <span className="text-xs font-black text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-md border border-blue-200 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-blue-700" />
                  Rendição GCM
                </span>
              ) : (
                <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                  RE: {re}
                </span>
              )}
              {(staff?.function || multiSchoolBadge) && (
                <span className="text-[11px] font-extrabold text-purple-900 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
                  {staff?.function || multiSchoolBadge}
                </span>
              )}
              {staff?.vehicle && (
                <span className="text-xs font-black text-emerald-950 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1 font-mono shadow-2xs">
                  <Car className="w-3.5 h-3.5 text-emerald-700" />
                  VTR: {staff.vehicle}
                </span>
              )}
            </div>

            {/* List of multiple assigned schools preview */}
            {assignedSchools && assignedSchools.length > 1 && (
              <div className="mt-3 text-left bg-blue-50/80 p-2.5 rounded-xl border border-blue-200 text-[11px] space-y-1.5">
                <span className="font-black text-blue-950 block text-[10.5px] uppercase tracking-wide">
                  Postos Eleitorais sob sua Responsabilidade:
                </span>
                {assignedSchools.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-1.5 text-slate-800 bg-white p-1.5 rounded-lg border border-blue-100">
                    <span className="font-bold truncate text-[11px]">{item.school.school}</span>
                    <span className={`text-[9.5px] font-black px-1.5 py-0.2 rounded shrink-0 uppercase ${
                      item.shift === 'Manhã' ? 'bg-amber-100 text-amber-900' : item.shift === 'Integral' ? 'bg-purple-100 text-purple-900' : 'bg-indigo-100 text-indigo-900'
                    }`}>
                      {item.shift === 'Integral' ? 'Integral' : item.shift}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            {isGcmOfficer({ re, name, rank })
              ? 'Este posto eleitoral possui rendição atribuída à Guarda Civil Municipal (GCM). Os check-ins da PMESP são ignorados para este turno.'
              : 'Ao confirmar, este dispositivo/navegador será vinculado à sua conta operacional para acesso rápido.'}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl border border-slate-300 text-xs font-extrabold text-slate-700 hover:bg-slate-100 transition cursor-pointer min-h-[44px]"
          >
            Não sou eu
          </button>
          <button
            id="btn-confirm-identity-yes"
            type="button"
            onClick={onConfirm}
            className="w-full py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white text-xs font-black transition shadow-md shadow-blue-800/20 flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Sim, sou eu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
