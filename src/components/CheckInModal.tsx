import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Compass,
  CheckCircle2,
  RefreshCw,
  FileText
} from 'lucide-react';
import { SchoolItem, CheckInRecord } from '../types';
import { getCurrentPositionAsync, calculateDistanceMeters, generateProtocol } from '../utils/geo';
import { findSchoolCoordinates } from '../data/schoolCoordinates';
import { useClock, formatDateTime } from '../utils/useClock';

interface CheckInModalProps {
  school: SchoolItem;
  officerRe: string;
  officerName: string;
  rank: string;
  shift: 'Manhã' | 'Tarde' | 'Integral';
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (record: CheckInRecord) => Promise<void>;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  school,
  officerRe,
  officerName,
  rank,
  shift,
  isOpen,
  onClose,
  onConfirm
}) => {
  const currentTime = useClock();
  const [loadingGps, setLoadingGps] = useState(true);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const [protocol] = useState(() => generateProtocol());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingGps(true);

    getCurrentPositionAsync().then((pos) => {
      if (!isMounted) return;
      setLoadingGps(false);
      if (pos) {
        setLat(pos.lat);
        setLng(pos.lng);
        setAccuracy(pos.accuracy);

        // Target school lat/lng from school record or official geodatabase
        const hasValidSchoolCoords =
          typeof school.lat === 'number' &&
          typeof school.lng === 'number' &&
          Math.abs(school.lat - school.lng) > 0.001 &&
          school.lng < -40 &&
          school.lat < -15;

        const geo = !hasValidSchoolCoords ? findSchoolCoordinates(school.school, school.city) : null;
        const targetLat = hasValidSchoolCoords ? school.lat : geo?.lat;
        const targetLng = hasValidSchoolCoords ? school.lng : geo?.lng;
        if (typeof targetLat === 'number' && typeof targetLng === 'number') {
          const dist = calculateDistanceMeters(pos.lat, pos.lng, targetLat, targetLng);
          setDistanceMeters(dist);
          setIsOutOfRange(dist > 150);
        } else {
          // Post without coordinates: distance cannot be verified (previously measured against
          // a fixed default point, flagging officers at the right post as out of range)
          setDistanceMeters(null);
          setIsOutOfRange(false);
        }
      } else {
        // Fallback: GPS not granted or unavailable on device
        setLat(null);
        setLng(null);
        setAccuracy(null);
        setDistanceMeters(null);
        setIsOutOfRange(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, school]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const now = Date.now();
    const uniqueSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 9)}`;
    const record: CheckInRecord = {
      id: `chk-${now}-${uniqueSuffix}`,
      key: `school:${officerRe}:${school.school}:${shift}`,
      type: 'checkin',
      schoolName: school.school,
      city: school.city,
      officerRe,
      officerName,
      rank,
      shift,
      time: formatDateTime(new Date(now)),
      timestamp: now,
      lat,
      lng,
      accuracy,
      distanceMeters,
      isOutOfRange,
      protocol
    };

    try {
      await onConfirm(record);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-3.5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[94vh] sm:max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#0F2B48]">
                Confirmação de Presença no Posto
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                Check-in Operacional Eleições 2026
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="mt-4 space-y-3.5 text-xs overflow-y-auto pr-1">
          {/* Officer details card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[10px] sm:text-[11px] font-extrabold uppercase text-slate-400">
              Militar em Serviço
            </div>
            <div className="font-extrabold text-xs sm:text-sm text-slate-900 mt-0.5">
              {rank} {officerName}
            </div>
            <div className="font-mono text-blue-700 font-bold mt-0.5 text-xs">
              RE: {officerRe} · Horário: {shift === 'Manhã' ? '06h às 13h' : shift === 'Tarde' ? '13h ao término' : '06h ao término (Turno Integral)'}
            </div>
          </div>

          {/* School details */}
          <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200">
            <div className="text-[10px] sm:text-[11px] font-extrabold uppercase text-blue-900">
              Posto de Votação
            </div>
            <div className="font-extrabold text-xs sm:text-sm text-[#0F2B48] mt-0.5">
              {school.school}
            </div>
            <div className="text-slate-600 mt-0.5 text-[11px] sm:text-xs">
              {school.city} · Zona {school.zone} ({school.bairro})
            </div>
          </div>

          {/* GPS Telemetry */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-700 flex items-center gap-1.5 text-xs">
                <Compass className="w-4 h-4 text-blue-600" />
                Telemetria GPS
              </span>
              {loadingGps ? (
                <span className="text-[11px] text-blue-600 flex items-center gap-1 font-bold">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Buscando GPS...
                </span>
              ) : lat !== null && lng !== null ? (
                <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Fixado (±{accuracy}m)
                </span>
              ) : (
                <span className="text-[11px] text-amber-700 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  GPS Não Disponível
                </span>
              )}
            </div>

            <div className="mt-2 font-mono text-[10.5px] sm:text-[11px] text-slate-600 grid grid-cols-2 gap-2">
              <div>Lat: {lat !== null ? lat.toFixed(6) : 'Não detectado'}</div>
              <div>Lng: {lng !== null ? lng.toFixed(6) : 'Não detectado'}</div>
            </div>

            {!loadingGps && distanceMeters === null && (
              <div className="mt-2 pt-2 border-t border-slate-200 text-amber-800 font-semibold">
                {lat === null
                  ? 'Sem localização: o check-in será registrado como "SEM GPS" e exigirá homologação individual da supervisão.'
                  : 'Posto sem coordenada cadastrada: a distância não pode ser verificada e o check-in exigirá homologação individual.'}
              </div>
            )}

            {distanceMeters !== null && (
              <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Distância do Posto:</span>
                <strong className={`font-mono text-xs ${isOutOfRange ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {distanceMeters} metros {isOutOfRange ? '(Fora do raio)' : '(Conforme)'}
                </strong>
              </div>
            )}
          </div>

          {/* Warning banner if > 150m */}
          {isOutOfRange && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-xs">
                  Aviso de Distância (&gt; 150m)
                </strong>
                <p className="mt-0.5 text-[10.5px] sm:text-[11px] leading-relaxed">
                  Localização a <strong>{distanceMeters}m</strong> do posto. Será registrado com a nota de auditoria "Acima do Raio de 150m".
                </p>
              </div>
            </div>
          )}

          {/* Time & Protocol */}
          <div className="grid grid-cols-2 gap-2.5 text-slate-600">
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Horário (NTP)
              </span>
              <strong className="font-mono text-xs sm:text-sm text-[#0F2B48] block mt-0.5">
                {currentTime}
              </strong>
            </div>

            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Protocolo
              </span>
              <strong className="font-mono text-[11px] sm:text-xs text-blue-700 block mt-0.5 truncate">
                {protocol}
              </strong>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer min-h-[42px]"
          >
            Cancelar
          </button>

          <button
            id="btn-confirm-checkin-modal"
            type="button"
            disabled={isSubmitting || loadingGps}
            onClick={handleConfirm}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Registrando...
              </>
            ) : loadingGps ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Aguardando GPS...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Check-in
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
