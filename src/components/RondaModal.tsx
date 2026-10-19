import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Car,
  CheckCircle,
  AlertTriangle,
  Radio,
  RefreshCw,
  Compass,
  FileSpreadsheet,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { SchoolItem, RondaRecord } from '../types';
import { getCurrentPositionAsync, getGoogleMapsNavigationUrl, getSchoolDisplayAddress } from '../utils/geo';
import { normalizeText } from '../utils/normalize';
import { normalizeCityName } from '../utils/municipality';
import { formatDateTime } from '../utils/useClock';

interface RondaModalProps {
  schools: SchoolItem[];
  officerRe: string;
  officerName: string;
  rank: string;
  officerVehicle?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (record: RondaRecord) => Promise<void>;
  defaultSchoolId?: string;
}

export const RondaModal: React.FC<RondaModalProps> = ({
  schools,
  officerRe,
  officerName,
  rank,
  officerVehicle,
  isOpen,
  onClose,
  onConfirm,
  defaultSchoolId
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('TODOS');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(
    defaultSchoolId || schools[0]?.id || ''
  );
  const [situation, setSituation] = useState<'sem' | 'com'>('sem');
  const [shift, setShift] = useState<'Manhã' | 'Tarde'>(() => {
    return new Date().getHours() >= 13 ? 'Tarde' : 'Manhã';
  });
  const [obs, setObs] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Extract unique sorted cities strictly from the schools available in this modal
  const availableCities = useMemo(() => {
    const rawCities = schools
      .map((s) => normalizeCityName(s.city?.trim()))
      .filter((c): c is string => Boolean(c && c.length > 1));
    const unique = Array.from(new Set(rawCities));
    return unique.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [schools]);

  // Reset selectedCity if not present in availableCities
  useEffect(() => {
    if (selectedCity && selectedCity !== 'TODOS' && !availableCities.includes(selectedCity)) {
      setSelectedCity('TODOS');
    }
  }, [availableCities, selectedCity]);

  // Filter schools by selected city
  const filteredSchools = useMemo(() => {
    if (!selectedCity || selectedCity === 'TODOS') {
      return schools;
    }
    const targetCityNorm = normalizeCityName(selectedCity);
    return schools.filter((s) => {
      const cityNorm = normalizeCityName(s.city || '');
      return cityNorm === targetCityNorm;
    });
  }, [schools, selectedCity]);

  // Ensure selected school is always within the filtered set
  useEffect(() => {
    if (filteredSchools.length > 0) {
      if (!filteredSchools.some((s) => s.id === selectedSchoolId)) {
        setSelectedSchoolId(filteredSchools[0].id);
      }
    } else {
      setSelectedSchoolId('');
    }
  }, [filteredSchools, selectedSchoolId]);

  useEffect(() => {
    if (isOpen) {
      getCurrentPositionAsync().then((pos) => {
        if (pos) {
          setLat(pos.lat);
          setLng(pos.lng);
        }
      });
      if (defaultSchoolId) {
        const target = schools.find((s) => s.id === defaultSchoolId);
        if (target && target.city) {
          setSelectedCity(target.city);
        }
        setSelectedSchoolId(defaultSchoolId);
      } else if (filteredSchools.length > 0) {
        setSelectedSchoolId(filteredSchools[0].id);
      }
    }
  }, [isOpen, defaultSchoolId, schools]);

  if (!isOpen) return null;

  const handleCityChange = (newCity: string) => {
    setSelectedCity(newCity);
    const targetNorm = normalizeText(newCity);
    const list =
      newCity === 'TODOS'
        ? schools
        : schools.filter((s) => normalizeText(s.city || '') === targetNorm);

    if (list.length > 0) {
      if (!list.some((s) => s.id === selectedSchoolId)) {
        setSelectedSchoolId(list[0].id);
      }
    } else {
      setSelectedSchoolId('');
    }
  };

  const selectedSchool = filteredSchools.find((s) => s.id === selectedSchoolId) || filteredSchools[0];

  const handleSubmit = async () => {
    if (!selectedSchool) return;
    setIsSubmitting(true);
    const now = Date.now();
    const uniqueSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 9)}`;
    const record: RondaRecord = {
      id: `ronda-${now}-${uniqueSuffix}`,
      key: `ronda:${officerRe}:${selectedSchool.school}:${shift}:${now}`,
      type: 'ronda',
      schoolName: selectedSchool.school,
      city: selectedSchool.city,
      officerRe,
      officerName,
      rank,
      situation,
      obs: situation === 'sem' ? 'Sem novidades. Local policiado com tranquilidade.' : obs,
      time: formatDateTime(new Date(now)),
      timestamp: now,
      lat,
      lng,
      shift
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
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#0F2B48]">
                Registro de Fiscalização / Ronda
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                Supervisão Militar e Apoio Operacional
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

        {/* Content */}
        <div className="mt-4 space-y-3.5 text-xs overflow-y-auto pr-1">
          {/* Officer */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase">
              Rondante / Supervisor
            </span>
            <div className="font-extrabold text-slate-900 text-sm mt-0.5">
              {rank} {officerName}
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5 flex-wrap">
              <div className="text-blue-700 font-mono font-bold">
                RE: {officerRe}
              </div>
              {officerVehicle && (
                <span className="font-mono text-xs font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs">
                  <Car className="w-3.5 h-3.5 text-emerald-700" />
                  <span>VTR: {officerVehicle}</span>
                </span>
              )}
            </div>
          </div>

          {/* Municipality Filter */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Município:</span>
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                {selectedCity === 'TODOS' ? 'Todos os Municípios' : selectedCity}
              </span>
            </label>
            <select
              id="select-ronda-city"
              value={selectedCity}
              onChange={(e) => handleCityChange(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition cursor-pointer"
            >
              <option value="TODOS">Todos os Municípios ({schools.length} postos)</option>
              {availableCities.map((city) => {
                const count = schools.filter(
                  (s) => normalizeCityName(s.city) === normalizeCityName(city)
                ).length;
                const label = city === 'VOTORANTIM' ? 'VOTORANTIM / Votoratim' : city;
                return (
                  <option key={city} value={city}>
                    {label} ({count} {count === 1 ? 'posto' : 'postos'})
                  </option>
                );
              })}
            </select>
          </div>

          {/* School Select */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
              <span>Posto Eleitoral Inspecionado:</span>
              <span className="text-[11px] font-normal text-slate-500">
                {filteredSchools.length} {filteredSchools.length === 1 ? 'posto disponível' : 'postos disponíveis'}
              </span>
            </label>
            <select
              id="select-ronda-school"
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition cursor-pointer"
            >
              {filteredSchools.length === 0 ? (
                <option value="">Nenhum posto eleitoral cadastrado neste município</option>
              ) : (
                filteredSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.city} - {s.school} (Zona {s.zone})
                  </option>
                ))
              )}
            </select>
            {selectedSchool && (
              <div className="mt-2 flex items-center min-w-0">
                <a
                  href={getGoogleMapsNavigationUrl(selectedSchool)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Toque para abrir rota e navegar pelo Google Maps"
                  className="group inline-flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-blue-700 min-w-0 max-w-full transition cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="truncate group-hover:underline font-medium">
                    {getSchoolDisplayAddress(selectedSchool)}
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-[9.5px] font-bold text-blue-700 bg-blue-50 group-hover:bg-blue-100 border border-blue-200/90 px-1.5 py-0.2 rounded transition shadow-2xs">
                    <span>Maps</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </span>
                </a>
              </div>
            )}
          </div>

          {/* Turno da Ronda */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
              <span>Turno da Fiscalização:</span>
              <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${
                shift === 'Tarde' 
                  ? 'bg-purple-100 text-purple-900 border-purple-200' 
                  : 'bg-amber-100 text-amber-900 border-amber-200'
              }`}>
                {shift === 'Tarde' ? '🌤️ Turno da Tarde (13h - 18h)' : '☀️ Turno da Manhã (06h - 13h)'}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShift('Manhã')}
                className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  shift === 'Manhã'
                    ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>☀️ Turno da Manhã</span>
              </button>
              <button
                type="button"
                onClick={() => setShift('Tarde')}
                className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  shift === 'Tarde'
                    ? 'bg-purple-50 border-purple-600 text-purple-950 ring-2 ring-purple-600/20 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>🌤️ Turno da Tarde</span>
              </button>
            </div>
          </div>

          {/* Situation Buttons */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Condição Encontrada no Local:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSituation('sem')}
                className={`p-3 rounded-xl border text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
                  situation === 'sem'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Sem Novidades
              </button>

              <button
                type="button"
                onClick={() => setSituation('com')}
                className={`p-3 rounded-xl border text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
                  situation === 'com'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Com Alteração / Ocorrência
              </button>
            </div>
          </div>

          {/* Observation text area if 'com' */}
          {situation === 'com' && (
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">
                Descreva a Ocorrência ou Providência Adotada:
              </label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Ex: Boca de urna reprimida na esquina; apoio solicitado ao CGP..."
                rows={3}
                className="w-full p-3 rounded-xl border border-amber-300 text-xs text-slate-800 bg-white outline-none focus:border-amber-600"
              />
            </div>
          )}

          {/* GPS indicator */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-slate-500">
            <span className="flex items-center gap-1.5 font-semibold">
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              Telemetria GPS
            </span>
            <span className="font-mono text-[11px] font-bold text-slate-700">
              {lat ? `${lat.toFixed(5)}, ${lng?.toFixed(5)}` : 'Sinal GPS ativo'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl transition cursor-pointer min-h-[42px]"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isSubmitting || !selectedSchool}
            onClick={handleSubmit}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold text-white bg-purple-700 hover:bg-purple-800 active:scale-[0.98] disabled:opacity-50 rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Radio className="w-3.5 h-3.5" />
                Gravar Ronda
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
