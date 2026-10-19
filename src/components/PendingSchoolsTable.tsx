import React, { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, Phone, CheckCircle2, MapPin, Sun, CloudSun, School, Check, ShieldCheck, Filter, Trash2, Shield, Car, Moon, Clock, ExternalLink } from 'lucide-react';
import { SchoolItem, SchoolOfficer, CheckInRecord, StaffMember } from '../types';
import { normalizeText, matchesExactRe } from '../utils/normalize';
import { normalizeCityName } from '../utils/municipality';
import { useMediaQuery } from '../utils/useMediaQuery';
import { findSchoolCoordinates } from '../data/schoolCoordinates';
import { getGoogleMapsNavigationUrl } from '../utils/geo';
import {
  isSchoolFullDay,
  isMorningCheckedIn,
  isAfternoonCheckedIn,
  isMorningFullyCheckedIn,
  isAfternoonFullyCheckedIn,
  findMorningCheckIn,
  findAfternoonCheckIn,
  findOfficerCheckIn,
  getSchoolAmOfficers,
  getSchoolPmOfficers,
  isRondaRoleOrSchool,
  isGcmOfficer
} from '../utils/checkinStatus';

interface PendingSchoolsTableProps {
  schools: SchoolItem[];
  checkInList: CheckInRecord[];
  staffList?: StaffMember[];
  onSelectSchoolForCheckIn: (school: SchoolItem, shift: 'Manhã' | 'Tarde' | 'Integral', officer?: SchoolOfficer) => void;
  onSearchByRe: (re: string) => void;
  onDeleteCheckIn?: (checkInId: string, officerInfo: string, schoolName: string, record?: CheckInRecord) => Promise<void> | void;
  title?: string;
  subtitle?: string;
  defaultOnlyPending?: boolean;
}

export const PendingSchoolsTable: React.FC<PendingSchoolsTableProps> = ({
  schools,
  checkInList,
  staffList = [],
  onSelectSchoolForCheckIn,
  onSearchByRe,
  onDeleteCheckIn,
  title,
  subtitle,
  defaultOnlyPending = false
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('TODOS');
  const [onlyPending, setOnlyPending] = useState<boolean>(defaultOnlyPending);
  const [selectedShift, setSelectedShift] = useState<'MANHA' | 'TARDE' | 'INTEGRAL'>(() => {
    const currentHour = new Date().getHours();
    return currentHour < 13 ? 'MANHA' : 'TARDE';
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<CheckInRecord | null>(null);
  // Only one layout is rendered: both used to be rendered and one hidden with CSS, doubling
  // the (expensive) per-school check-in matching on every render
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Helper para formatar endereço padrão: Endereço/Rua · Bairro · Município
  const formatSchoolAddress = (school: SchoolItem): string => {
    let street = school.address?.trim() || '';
    if (street.includes(',')) {
      street = street.split(',')[0].trim();
    }
    if (!street) {
      const geo = findSchoolCoordinates(school.school, school.city);
      if (geo?.logradouro) {
        street = geo.logradouro.trim();
      } else if (geo?.address) {
        street = geo.address.split(',')[0].trim();
      }
    }

    const parts: string[] = [];
    if (street) parts.push(street);
    if (school.bairro && school.bairro !== 'ZONA URBANA' && !parts.some((p) => p.toLowerCase().includes(school.bairro.toLowerCase()))) {
      parts.push(school.bairro.trim());
    }
    if (school.city) {
      parts.push(school.city.trim());
    }
    return parts.join(' · ') || `${school.bairro || 'Centro'} · ${school.city}`;
  };

  // Helper to look up vehicle from school officer or staffList (planilha de empenho)
  const getOfficerVehicle = (off?: SchoolOfficer | null): string => {
    if (!off) return '';
    if (off.vehicle && off.vehicle.trim()) return off.vehicle.trim();
    if (!staffList || staffList.length === 0) return '';
    const match = staffList.find((s) => matchesExactRe(s.re, off.re) || (off.name && normalizeText(s.name) === normalizeText(off.name)));
    return match?.vehicle?.trim() || '';
  };

  const handlePromptDelete = (record: CheckInRecord) => {
    if (!onDeleteCheckIn) return;
    setConfirmDeleteRecord(record);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteRecord || !onDeleteCheckIn) return;
    const target = confirmDeleteRecord;
    try {
      setDeletingId(target.id);
      await onDeleteCheckIn(
        target.id,
        `${target.rank} ${target.officerName} (RE: ${target.officerRe})`,
        target.schoolName,
        target
      );
      setConfirmDeleteRecord(null);
    } finally {
      setDeletingId(null);
    }
  };

  // Only actual fixed polling stations count for this table
  const fixedSchoolsOnly = useMemo(() => {
    return schools.filter((s) => !isRondaRoleOrSchool(s.school, s.address || s.bairro));
  }, [schools]);

  // Extract unique sorted cities strictly from the available schools
  const cities = useMemo(() => {
    const rawCities = fixedSchoolsOnly
      .map((s) => normalizeCityName(s.city?.trim()))
      .filter((c): c is string => Boolean(c && c.length > 1));
    const unique = Array.from(new Set(rawCities));
    unique.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['TODOS', ...unique];
  }, [fixedSchoolsOnly]);

  // Reset selectedCity if it's not present in the current school set
  useEffect(() => {
    if (selectedCity !== 'TODOS' && !cities.includes(selectedCity)) {
      setSelectedCity('TODOS');
    }
  }, [cities, selectedCity]);

  const schoolsWithGpsCount = useMemo(() => {
    return fixedSchoolsOnly.filter((s) => {
      const hasValid =
        typeof s.lat === 'number' &&
        typeof s.lng === 'number' &&
        Math.abs(s.lat - s.lng) > 0.001 &&
        s.lng < -40;
      if (hasValid) return true;
      const geo = findSchoolCoordinates(s.school, s.city);
      return Boolean(geo?.lat && geo?.lng);
    }).length;
  }, [fixedSchoolsOnly]);

  // Filter rows
  const filteredSchools = useMemo(() => fixedSchoolsOnly.filter((s) => {
    if (selectedCity !== 'TODOS') {
      const selectedNorm = normalizeCityName(selectedCity);
      const schoolNorm = normalizeCityName(s.city);
      if (selectedNorm !== schoolNorm) {
        return false;
      }
    }

    const isFullDay = isSchoolFullDay(s);
    const amList = getSchoolAmOfficers(s);
    const pmespAm = amList.filter((o) => !isGcmOfficer(o));
    const hasPmespAm = pmespAm.length > 0;
    const amOk = hasPmespAm ? isMorningFullyCheckedIn(s, checkInList) : true;

    const pmList = getSchoolPmOfficers(s);
    const pmespPm = pmList.filter((o) => !isGcmOfficer(o));
    const hasPmespPm = pmespPm.length > 0;
    // Per rule 5: if full day and morning checked in, afternoon is 100% confirmed!
    const pmOk = hasPmespPm
      ? (isFullDay && amOk) || isAfternoonFullyCheckedIn(s, checkInList)
      : true;

    // Shift-aware pending determination:
    let isPending = false;
    if (selectedShift === 'MANHA') {
      isPending = hasPmespAm && !amOk;
    } else if (selectedShift === 'TARDE') {
      isPending = hasPmespPm && !pmOk;
    } else {
      // INTEGRAL / Dia Inteiro
      isPending = (hasPmespAm && !amOk) || (hasPmespPm && !pmOk);
    }

    if (onlyPending && !isPending) {
      return false;
    }

    return true;
  }), [fixedSchoolsOnly, selectedCity, onlyPending, selectedShift, checkInList]);

  return (
    <section className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-6 lg:p-7 shadow-xs w-full min-w-0">
      {/* Header Row */}
      <div className="flex flex-col gap-2.5 sm:gap-3 mb-3.5 sm:mb-5 pb-3 sm:pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0" />
            <div>
              <h3 className="text-xs sm:text-lg font-extrabold text-[#0F2B48] truncate">
                {title || 'Quadro Operacional de Postos Eleitorais'}
              </h3>
              {subtitle && (
                <p className="text-[11px] text-slate-500 font-medium">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span
              className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                schoolsWithGpsCount === fixedSchoolsOnly.length
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-blue-50 text-blue-900 border-blue-200'
              }`}
              title={`${schoolsWithGpsCount} de ${fixedSchoolsOnly.length} postos possuem coordenadas GPS vinculadas.`}
            >
              <MapPin className="w-3 h-3 text-emerald-600" />
              <span>GPS Mapeado: {schoolsWithGpsCount}/{fixedSchoolsOnly.length}</span>
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 shrink-0">
              {filteredSchools.length} {filteredSchools.length === 1 ? 'posto listado' : 'postos listados'}
            </span>
          </div>
        </div>

        {/* Filters: Shift Selector, Only Pending Toggle & Prominent City Dropdown */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Left side: Shift Selector & Only Pending toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Shift Segmented Control: Manhã (06h às 13h) | Tarde (13h ao término) | Dia Inteiro */}
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  id="btn-filter-shift-manha"
                  onClick={() => setSelectedShift('MANHA')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    selectedShift === 'MANHA'
                      ? 'bg-[#0F2B48] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Focar nas escalas do turno da Manhã (06h às 13h)"
                >
                  <Sun className={`w-3.5 h-3.5 ${selectedShift === 'MANHA' ? 'text-amber-400' : 'text-amber-600'}`} />
                  <span>Manhã</span>
                </button>

                <button
                  type="button"
                  id="btn-filter-shift-tarde"
                  onClick={() => setSelectedShift('TARDE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    selectedShift === 'TARDE'
                      ? 'bg-purple-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Focar nas escalas do turno da Tarde (13h ao término)"
                >
                  <Moon className={`w-3.5 h-3.5 ${selectedShift === 'TARDE' ? 'text-purple-300' : 'text-purple-600'}`} />
                  <span>Tarde</span>
                </button>

                <button
                  type="button"
                  id="btn-filter-shift-integral"
                  onClick={() => setSelectedShift('INTEGRAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    selectedShift === 'INTEGRAL'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Exibir todos os turnos e escalas do dia inteiro"
                >
                  <Clock className={`w-3.5 h-3.5 ${selectedShift === 'INTEGRAL' ? 'text-blue-200' : 'text-blue-600'}`} />
                  <span>Dia Inteiro</span>
                </button>
              </div>

              {/* Only Pending Toggle */}
              <button
                type="button"
                id="btn-filter-only-pending"
                onClick={() => setOnlyPending((prev) => !prev)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border min-h-[38px] ${
                  onlyPending
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>
                  {onlyPending
                    ? selectedShift === 'MANHA'
                      ? 'Apenas Pendentes (Manhã)'
                      : selectedShift === 'TARDE'
                      ? 'Apenas Pendentes (Tarde)'
                      : 'Apenas Pendentes'
                    : 'Filtrar: Apenas Pendentes'}
                </span>
              </button>
            </div>

            {/* Right side: Dropdown Município */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label htmlFor="select-city-dropdown" className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Município:</span>
              </label>
              <select
                id="select-city-dropdown"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="flex-1 sm:w-72 p-2 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer shadow-2xs"
              >
                {cities.map((city) => {
                  const count = city === 'TODOS'
                    ? fixedSchoolsOnly.length
                    : fixedSchoolsOnly.filter((s) => normalizeCityName(s.city) === normalizeCityName(city)).length;
                  const isVotorantim = city === 'VOTORANTIM';
                  return (
                    <option key={city} value={city}>
                      {city === 'TODOS'
                        ? `Todos os Municípios (${count} postos)`
                        : isVotorantim
                        ? `VOTORANTIM / Votoratim (${count} postos)`
                        : `${city} (${count} ${count === 1 ? 'posto' : 'postos'})`}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE CARD VIEW (< md) with pure flex layout and responsive padding */}
      {!isDesktop && (
      <div className="flex flex-col gap-2.5 md:hidden w-full min-w-0">
        {filteredSchools.length === 0 ? (
          <div className="py-8 text-center text-slate-500 font-medium text-xs bg-slate-50 rounded-xl p-4">
            Nenhum posto eleitoral encontrado para o filtro selecionado.
          </div>
        ) : (
          filteredSchools.map((s, idx) => {
            const isFullDay = isSchoolFullDay(s);
            const amOfficers = getSchoolAmOfficers(s);
            const pmOfficers = getSchoolPmOfficers(s);
            const isAmGcm = (amOfficers.length > 0 && amOfficers.every(isGcmOfficer)) || isGcmOfficer(s.am);
            const isPmGcm = (pmOfficers.length > 0 && pmOfficers.every(isGcmOfficer)) || isGcmOfficer(s.pm);
            const amOk = isMorningCheckedIn(s, checkInList);
            const pmOk = isAfternoonCheckedIn(s, checkInList);
            const isAmAllDone = isMorningFullyCheckedIn(s, checkInList);
            const isPmAllDone = isAfternoonFullyCheckedIn(s, checkInList);

            return (
              <div
                key={`mob-school-${s.id || s.school}-${idx}`}
                className="border border-slate-200 rounded-xl bg-white shadow-xs p-3 flex flex-col gap-2.5 w-full min-w-0"
              >
                {/* School Title & Badges */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-slate-900 font-extrabold text-sm leading-snug">
                      {s.school}
                    </strong>
                    <span className="text-[10px] font-extrabold text-[#0F2B48] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase shrink-0">
                      {s.city}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-slate-500 font-medium">
                    <a
                      href={getGoogleMapsNavigationUrl(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Toque para abrir rota e navegar pelo Google Maps"
                      className="group inline-flex items-center gap-1 hover:text-blue-700 cursor-pointer transition max-w-full"
                    >
                      <span className="truncate group-hover:underline">{formatSchoolAddress(s)}</span>
                      <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
                    </a>
                    {(s.lat && s.lng && Math.abs(s.lat - s.lng) > 0.001 && s.lng < -40) || Boolean(findSchoolCoordinates(s.school, s.city)?.lat) ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1" title="GPS Oficial mapeado (raio de 150m ativo)">
                        <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                        GPS 150m
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1" title="Coordenadas GPS não sincronizadas. Conecte a Planilha de Coordenadas no botão de engrenagem.">
                        <MapPin className="w-2.5 h-2.5 text-amber-500" />
                        Sem GPS
                      </span>
                    )}
                    {isFullDay && (
                      <span className="text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-blue-600" />
                        Dia Inteiro
                      </span>
                    )}
                    {(amOfficers.length > 1 || pmOfficers.length > 1) && (
                      <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                        Efetivo Reforçado ({amOfficers.length + pmOfficers.length} PMs)
                      </span>
                    )}
                  </div>
                </div>

                {/* Shift 1: Manhã Card */}
                {(selectedShift === 'MANHA' || selectedShift === 'INTEGRAL') && (
                <div
                  className={`p-3 rounded-xl border transition ${
                    isAmGcm
                      ? 'bg-slate-50/80 border-slate-200'
                      : isAmAllDone
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : amOk
                      ? 'bg-amber-50/30 border-amber-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-extrabold uppercase text-[#0F2B48] flex items-center gap-1.5 flex-wrap">
                      <Sun className="w-3.5 h-3.5 text-amber-600" />
                      <span>Manhã (06h às 13h)</span>
                      {amOfficers.length > 1 && (
                        <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full border border-blue-200">
                          {amOfficers.length} policiais
                        </span>
                      )}
                    </span>
                    {isAmGcm ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                        <Shield className="w-3 h-3 text-blue-700" />
                        Rendição GCM
                      </span>
                    ) : isAmAllDone ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        CHECK-IN OK
                      </span>
                    ) : amOk ? (
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        Parcial ({amOfficers.filter(o => !isGcmOfficer(o) && Boolean(findOfficerCheckIn(s, o, 'Manhã', checkInList))).length}/{amOfficers.filter(o => !isGcmOfficer(o)).length})
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        Pendente
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {amOfficers.map((off, oIdx) => {
                      const isGcm = isGcmOfficer(off);
                      const offRecord = !isGcm ? findOfficerCheckIn(s, off, 'Manhã', checkInList) : undefined;
                      const isOffOk = Boolean(offRecord);

                      return (
                        <div
                          key={`am-off-${off.re || oIdx}`}
                          className={`rounded-lg p-2 transition ${
                            amOfficers.length > 1
                              ? isOffOk
                                ? 'bg-emerald-50/80 border border-emerald-200 shadow-2xs'
                                : 'bg-white border border-slate-200 shadow-2xs'
                              : ''
                          }`}
                        >
                          {amOfficers.length > 1 && (
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[9px] font-extrabold text-blue-900 uppercase">
                                Policial {oIdx + 1} ({off.rank || 'PM'})
                              </span>
                              {isOffOk ? (
                                <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                  OK
                                </span>
                              ) : isGcm ? (
                                <span className="text-[9px] font-extrabold text-blue-900 bg-blue-100 px-1.5 py-0.2 rounded border border-blue-200">
                                  GCM
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded">
                                  Pendente
                                </span>
                              )}
                            </div>
                          )}

                          <div className="font-bold text-slate-800 text-xs flex items-center justify-between gap-1 flex-wrap">
                            <span>{isGcm ? 'Guarda Civil Municipal (GCM)' : (off.name || 'Aguardando escala')}</span>
                            {!isGcm && getOfficerVehicle(off) && (
                              <span className="font-mono text-[9.5px] font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                <Car className="w-2.5 h-2.5 text-emerald-700" />
                                <span>VTR: {getOfficerVehicle(off)}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-1.5">
                            {isGcm ? (
                              <span className="text-[11px] text-blue-900 font-extrabold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Shield className="w-3 h-3 text-blue-700" />
                                GCM
                              </span>
                            ) : (
                              <button
                                onClick={() => off.re && onSearchByRe(off.re)}
                                className="text-xs text-blue-700 font-semibold font-mono hover:underline cursor-pointer py-0.5"
                              >
                                RE {off.re || '—'}
                              </button>
                            )}

                            {off.phone ? (
                              <a
                                href={`tel:${off.phone}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs hover:bg-blue-50 active:scale-95"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{off.phone}</span>
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Sem tel.</span>
                            )}
                          </div>

                          {isGcm ? (
                            <div className="w-full mt-2 py-2 px-2.5 text-xs font-extrabold text-slate-700 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 shadow-2xs">
                              <Shield className="w-3.5 h-3.5 text-blue-700" />
                              <span>Rendição por Guarda Civil Municipal</span>
                            </div>
                          ) : !isOffOk ? (
                            <button
                              onClick={() => onSelectSchoolForCheckIn(s, 'Manhã', off)}
                              className="w-full mt-2 py-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm min-h-[38px] cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>
                                Fazer Check-in Manhã
                                {amOfficers.length > 1 ? ` · ${off.name.split(' ')[0]}` : ''}
                              </span>
                            </button>
                          ) : (
                            <div className="mt-2 py-1.5 px-2.5 text-[11px] font-bold text-emerald-800 bg-emerald-100/60 rounded-lg border border-emerald-200 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 min-w-0">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">Check-in Realizado</span>
                                {offRecord?.time && (
                                  <span className="text-emerald-700 text-[10.5px] font-extrabold font-mono">
                                    às {offRecord.time}
                                  </span>
                                )}
                              </div>
                              {offRecord && onDeleteCheckIn && (
                                <button
                                  onClick={() => handlePromptDelete(offRecord)}
                                  disabled={deletingId === offRecord.id}
                                  className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 active:scale-95"
                                  title="Desfazer/Apagar este check-in"
                                >
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                  <span>{deletingId === offRecord.id ? '...' : 'Desfazer'}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}

                {/* Shift 2: Tarde Card */}
                {(selectedShift === 'TARDE' || selectedShift === 'INTEGRAL') && (
                <div
                  className={`p-3 rounded-xl border transition ${
                    isPmGcm
                      ? 'bg-slate-50/80 border-slate-200'
                      : isPmAllDone
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : pmOk
                      ? 'bg-amber-50/30 border-amber-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-extrabold uppercase text-[#0F2B48] flex items-center gap-1.5 flex-wrap">
                      <CloudSun className="w-3.5 h-3.5 text-blue-600" />
                      <span>Tarde (13h ao Término)</span>
                      {pmOfficers.length > 1 && (
                        <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full border border-blue-200">
                          {pmOfficers.length} policiais
                        </span>
                      )}
                    </span>
                    {isPmGcm ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                        <Shield className="w-3 h-3 text-blue-700" />
                        Rendição GCM
                      </span>
                    ) : isPmAllDone ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                        <Check className="w-3 h-3 text-emerald-600" />
                        CHECK-IN OK
                      </span>
                    ) : pmOk ? (
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        Parcial ({pmOfficers.filter(o => !isGcmOfficer(o) && Boolean(findOfficerCheckIn(s, o, 'Tarde', checkInList) || (isFullDay && findOfficerCheckIn(s, o, 'Manhã', checkInList)))).length}/{pmOfficers.filter(o => !isGcmOfficer(o)).length})
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        Pendente
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {pmOfficers.map((off, oIdx) => {
                      const isGcm = isGcmOfficer(off);
                      const directRecord = !isGcm ? findOfficerCheckIn(s, off, 'Tarde', checkInList) : undefined;
                      const fullDayRecord = (!directRecord && isFullDay && !isGcm)
                        ? (findOfficerCheckIn(s, off, 'Manhã', checkInList) || findMorningCheckIn(s, checkInList))
                        : undefined;
                      const offRecord = directRecord || fullDayRecord;
                      const isOffOk = Boolean(offRecord);

                      return (
                        <div
                          key={`pm-off-${off.re || oIdx}`}
                          className={`rounded-lg p-2 transition ${
                            pmOfficers.length > 1
                              ? isOffOk
                                ? 'bg-emerald-50/80 border border-emerald-200 shadow-2xs'
                                : 'bg-white border border-slate-200 shadow-2xs'
                              : ''
                          }`}
                        >
                          {pmOfficers.length > 1 && (
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[9px] font-extrabold text-blue-900 uppercase">
                                Policial {oIdx + 1} ({off.rank || 'PM'})
                              </span>
                              {isOffOk ? (
                                <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                  OK
                                </span>
                              ) : isGcm ? (
                                <span className="text-[9px] font-extrabold text-blue-900 bg-blue-100 px-1.5 py-0.2 rounded border border-blue-200">
                                  GCM
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded">
                                  Pendente
                                </span>
                              )}
                            </div>
                          )}

                          <div className="font-bold text-slate-800 text-xs flex items-center justify-between gap-1 flex-wrap">
                            <span>{isGcm ? 'Guarda Civil Municipal (GCM)' : (off.name || 'Aguardando escala')}</span>
                            {!isGcm && getOfficerVehicle(off) && (
                              <span className="font-mono text-[9.5px] font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                <Car className="w-2.5 h-2.5 text-emerald-700" />
                                <span>VTR: {getOfficerVehicle(off)}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-1.5">
                            {isGcm ? (
                              <span className="text-[11px] text-blue-900 font-extrabold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Shield className="w-3 h-3 text-blue-700" />
                                GCM
                              </span>
                            ) : (
                              <button
                                onClick={() => off.re && onSearchByRe(off.re)}
                                className="text-xs text-blue-700 font-semibold font-mono hover:underline cursor-pointer py-0.5"
                              >
                                RE {off.re || '—'}
                              </button>
                            )}

                            {off.phone ? (
                              <a
                                href={`tel:${off.phone}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs hover:bg-blue-50 active:scale-95"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{off.phone}</span>
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Sem tel.</span>
                            )}
                          </div>

                          {isGcm ? (
                            <div className="w-full mt-2 py-2 px-2.5 text-xs font-extrabold text-slate-700 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 shadow-2xs">
                              <Shield className="w-3.5 h-3.5 text-blue-700" />
                              <span>Rendição por Guarda Civil Municipal</span>
                            </div>
                          ) : !isOffOk ? (
                            <button
                              onClick={() => onSelectSchoolForCheckIn(s, 'Tarde', off)}
                              className="w-full mt-2 py-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm min-h-[38px] cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>
                                Fazer Check-in Tarde
                                {pmOfficers.length > 1 ? ` · ${off.name.split(' ')[0]}` : ''}
                              </span>
                            </button>
                          ) : (
                            <div className="mt-2 py-1.5 px-2.5 text-[11px] font-bold text-emerald-800 bg-emerald-100/60 rounded-lg border border-emerald-200 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 min-w-0">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">
                                  {fullDayRecord ? 'OK · Dia Inteiro' : 'Check-in Realizado'}
                                </span>
                                {offRecord?.time && (
                                  <span className="text-emerald-700 text-[10.5px] font-extrabold font-mono">
                                    às {offRecord.time}
                                  </span>
                                )}
                              </div>
                              {offRecord && onDeleteCheckIn && (
                                <button
                                  onClick={() => handlePromptDelete(offRecord)}
                                  disabled={deletingId === offRecord.id}
                                  className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 active:scale-95"
                                  title="Desfazer/Apagar este check-in"
                                >
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                  <span>{deletingId === offRecord.id ? '...' : 'Desfazer'}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}
              </div>
            );
          })
        )}
      </div>
      )}

      {/* DESKTOP TABLE VIEW (hidden on mobile, visible on md+) */}
      {isDesktop && (
      <div className="hidden md:block overflow-x-auto w-full min-w-0">
        <table className="w-full border-separate border-spacing-0 border border-slate-200 rounded-xl overflow-hidden min-w-[700px]">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-[11px] font-extrabold uppercase tracking-wider">
              <th className="py-3 px-4 text-left border-b border-slate-200 w-[28%]">Posto / Escola</th>
              <th className="py-3 px-4 text-left border-b border-slate-200 w-[14%]">Município</th>
              <th className="py-3 px-4 text-left border-b border-slate-200 w-[58%]">Efetivo Escalado & Check-in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {filteredSchools.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-slate-500 font-medium">
                  Nenhum posto eleitoral encontrado para o filtro selecionado.
                </td>
              </tr>
            ) : (
              filteredSchools.map((s, idx) => {
                const isFullDay = isSchoolFullDay(s);
                const amOfficers = getSchoolAmOfficers(s);
                const pmOfficers = getSchoolPmOfficers(s);
                const isAmGcm = (amOfficers.length > 0 && amOfficers.every(isGcmOfficer)) || isGcmOfficer(s.am);
                const isPmGcm = (pmOfficers.length > 0 && pmOfficers.every(isGcmOfficer)) || isGcmOfficer(s.pm);
                const amOk = isMorningCheckedIn(s, checkInList);
                const pmOk = isAfternoonCheckedIn(s, checkInList);
                const isAmAllDone = isMorningFullyCheckedIn(s, checkInList);
                const isPmAllDone = isAfternoonFullyCheckedIn(s, checkInList);

                return (
                  <tr
                    key={`desk-school-${s.id || s.school}-${idx}`}
                    className={`hover:bg-slate-50/80 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                  >
                    {/* Posto / Escola */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex items-start gap-1.5">
                        <div>
                          <strong className="block text-slate-900 font-extrabold text-[13px] leading-snug">
                            {s.school}
                          </strong>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <a
                              href={getGoogleMapsNavigationUrl(s)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Toque para abrir rota e navegar pelo Google Maps"
                              className="group inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-blue-700 font-semibold bg-slate-100 hover:bg-blue-50 px-2 py-0.5 rounded border border-slate-200 hover:border-blue-200 transition cursor-pointer"
                            >
                              <span className="group-hover:underline">{formatSchoolAddress(s)}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
                            </a>
                            {(s.lat && s.lng && Math.abs(s.lat - s.lng) > 0.001 && s.lng < -40) || Boolean(findSchoolCoordinates(s.school, s.city)?.lat) ? (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1" title="GPS Oficial mapeado (raio de 150m ativo)">
                                <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                                GPS 150m
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1" title="Coordenadas GPS não sincronizadas. Conecte a Planilha de Coordenadas no botão de engrenagem.">
                                <MapPin className="w-2.5 h-2.5 text-amber-500" />
                                Sem GPS
                              </span>
                            )}
                            {isFullDay && (
                              <span className="text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1" title="Policial único escalado para ambos os turnos">
                                <ShieldCheck className="w-3 h-3 text-blue-600" />
                                Dia Inteiro
                              </span>
                            )}
                            {(amOfficers.length > 1 || pmOfficers.length > 1) && (
                              <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                Efetivo Reforçado ({amOfficers.length + pmOfficers.length} PMs)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Município */}
                    <td className="py-3.5 px-4 align-top">
                      <span className="font-extrabold text-[#0F2B48] text-xs uppercase block">
                        {s.city}
                      </span>
                    </td>

                    {/* Efetivo Escalado nos turnos */}
                    <td className="py-3.5 px-4 align-top">
                      <div className={`grid gap-2 ${selectedShift === 'INTEGRAL' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                        {/* Turno Manhã */}
                        {(selectedShift === 'MANHA' || selectedShift === 'INTEGRAL') && (
                        <div
                          className={`p-2.5 rounded-lg border transition ${
                            isAmGcm
                              ? 'bg-slate-50 border-slate-200'
                              : isAmAllDone
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : amOk
                              ? 'bg-amber-50/30 border-amber-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[10px] font-extrabold uppercase text-[#0F2B48] flex items-center gap-1 flex-wrap">
                              <Sun className="w-3 h-3 text-amber-600" />
                              <span>Manhã (06h-13h)</span>
                              {amOfficers.length > 1 && (
                                <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full border border-blue-200">
                                  {amOfficers.length} policiais
                                </span>
                              )}
                            </span>
                            {isAmGcm ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 shadow-2xs">
                                <Shield className="w-3 h-3 text-blue-700" />
                                Rendição GCM
                              </span>
                            ) : isAmAllDone ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                CHECK-IN OK
                              </span>
                            ) : amOk ? (
                              <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                                Parcial ({amOfficers.filter(o => Boolean(findOfficerCheckIn(s, o, 'Manhã', checkInList))).length}/{amOfficers.length})
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                                Pendente
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            {amOfficers.map((off, oIdx) => {
                              const isGcm = isGcmOfficer(off);
                              const offRecord = !isGcm ? findOfficerCheckIn(s, off, 'Manhã', checkInList) : undefined;
                              const isOffOk = Boolean(offRecord);

                              return (
                                <div
                                  key={`am-desk-off-${off.re || oIdx}`}
                                  className={`rounded-lg p-2 transition ${
                                    amOfficers.length > 1
                                      ? isOffOk
                                        ? 'bg-emerald-50/70 border border-emerald-200'
                                        : 'bg-white border border-slate-200 shadow-2xs'
                                      : ''
                                  }`}
                                >
                                  {amOfficers.length > 1 && (
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                      <span className="text-[9px] font-bold text-blue-900 uppercase">
                                        Policial {oIdx + 1} ({off.rank || 'PM'})
                                      </span>
                                      {isOffOk ? (
                                        <span className="text-[8.5px] font-extrabold text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded">
                                          OK
                                        </span>
                                      ) : isGcm ? (
                                        <span className="text-[8.5px] font-extrabold text-blue-900 bg-blue-100 px-1 py-0.2 rounded border border-blue-200">
                                          GCM
                                        </span>
                                      ) : (
                                        <span className="text-[8.5px] font-bold text-amber-800 bg-amber-50 px-1 py-0.2 rounded">
                                          Pendente
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  <div className="font-bold text-slate-800 text-xs flex items-center justify-between gap-1 flex-wrap">
                                    <span>{isGcm ? 'Guarda Civil Municipal (GCM)' : (off.name || 'Aguardando escala')}</span>
                                    {!isGcm && getOfficerVehicle(off) && (
                                      <span className="font-mono text-[9.5px] font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                        <Car className="w-2.5 h-2.5 text-emerald-700" />
                                        <span>VTR: {getOfficerVehicle(off)}</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between mt-1">
                                    {isGcm ? (
                                      <span className="text-[10px] text-blue-900 font-extrabold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <Shield className="w-2.5 h-2.5 text-blue-700" />
                                        GCM
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => off.re && onSearchByRe(off.re)}
                                        className="hover:underline text-blue-700 font-semibold cursor-pointer"
                                      >
                                        RE {off.re || '—'}
                                      </button>
                                    )}

                                    {off.phone ? (
                                      <a
                                        href={`tel:${off.phone}`}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200 hover:bg-blue-50"
                                      >
                                        <Phone className="w-3 h-3" />
                                        {off.phone}
                                      </a>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">Sem tel.</span>
                                    )}
                                  </div>

                                  {isGcm ? (
                                    <div className="w-full mt-1.5 py-1.5 px-2 text-[11px] font-extrabold text-slate-700 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center gap-1 shadow-2xs">
                                      <Shield className="w-3 h-3 text-blue-700" />
                                      <span>Rendição por Guarda Civil Municipal</span>
                                    </div>
                                  ) : !isOffOk ? (
                                    <button
                                      onClick={() => onSelectSchoolForCheckIn(s, 'Manhã', off)}
                                      className="w-full mt-1.5 py-1.5 text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <MapPin className="w-3.5 h-3.5" />
                                      Fazer Check-in Manhã {amOfficers.length > 1 ? `· ${off.name.split(' ')[0]}` : ''}
                                    </button>
                                  ) : (
                                    <div className="mt-1.5 py-1 px-2.5 text-[10.5px] font-bold text-emerald-800 bg-emerald-100/60 rounded-lg border border-emerald-200 flex items-center justify-between gap-1.5">
                                      <div className="flex items-center gap-1 min-w-0">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="truncate">Check-in Realizado</span>
                                        {offRecord?.time && (
                                          <span className="text-emerald-700 text-[10px] font-extrabold font-mono">
                                            às {offRecord.time}
                                          </span>
                                        )}
                                      </div>
                                      {offRecord && onDeleteCheckIn && (
                                        <button
                                          onClick={() => handlePromptDelete(offRecord)}
                                          disabled={deletingId === offRecord.id}
                                          className="px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[9.5px] font-bold transition flex items-center gap-0.5 cursor-pointer shrink-0 active:scale-95"
                                          title="Desfazer/Apagar este check-in"
                                        >
                                          <Trash2 className="w-2.5 h-2.5 text-red-600" />
                                          <span>{deletingId === offRecord.id ? '...' : 'Desfazer'}</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        )}

                        {/* Turno Tarde */}
                        {(selectedShift === 'TARDE' || selectedShift === 'INTEGRAL') && (
                        <div
                          className={`p-2.5 rounded-lg border transition ${
                            isPmGcm
                              ? 'bg-slate-50 border-slate-200'
                              : isPmAllDone
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : pmOk
                              ? 'bg-amber-50/30 border-amber-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[10px] font-extrabold uppercase text-[#0F2B48] flex items-center gap-1 flex-wrap">
                              <CloudSun className="w-3 h-3 text-blue-600" />
                              <span>Tarde (13h-Término)</span>
                              {pmOfficers.length > 1 && (
                                <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full border border-blue-200">
                                  {pmOfficers.length} policiais
                                </span>
                              )}
                            </span>
                            {isPmGcm ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 shadow-2xs">
                                <Shield className="w-3 h-3 text-blue-700" />
                                Rendição GCM
                              </span>
                            ) : isPmAllDone ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 shadow-2xs"
                              >
                                <Check className="w-3 h-3 text-emerald-600" />
                                CHECK-IN OK
                              </span>
                            ) : pmOk ? (
                              <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                                Parcial ({pmOfficers.filter(o => !isGcmOfficer(o) && Boolean(findOfficerCheckIn(s, o, 'Tarde', checkInList) || (isFullDay && findOfficerCheckIn(s, o, 'Manhã', checkInList)))).length}/{pmOfficers.filter(o => !isGcmOfficer(o)).length})
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                                Pendente
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            {pmOfficers.map((off, oIdx) => {
                              const isGcm = isGcmOfficer(off);
                              const directRecord = !isGcm ? findOfficerCheckIn(s, off, 'Tarde', checkInList) : undefined;
                              const fullDayRecord = (!directRecord && isFullDay && !isGcm)
                                ? (findOfficerCheckIn(s, off, 'Manhã', checkInList) || findMorningCheckIn(s, checkInList))
                                : undefined;
                              const offRecord = directRecord || fullDayRecord;
                              const isOffOk = Boolean(offRecord);

                              return (
                                <div
                                  key={`pm-desk-off-${off.re || oIdx}`}
                                  className={`rounded-lg p-2 transition ${
                                    pmOfficers.length > 1
                                      ? isOffOk
                                        ? 'bg-emerald-50/70 border border-emerald-200'
                                        : 'bg-white border border-slate-200 shadow-2xs'
                                      : ''
                                  }`}
                                >
                                  {pmOfficers.length > 1 && (
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                      <span className="text-[9px] font-bold text-blue-900 uppercase">
                                        Policial {oIdx + 1} ({off.rank || 'PM'})
                                      </span>
                                      {isOffOk ? (
                                        <span className="text-[8.5px] font-extrabold text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded">
                                          OK
                                        </span>
                                      ) : isGcm ? (
                                        <span className="text-[8.5px] font-extrabold text-blue-900 bg-blue-100 px-1 py-0.2 rounded border border-blue-200">
                                          GCM
                                        </span>
                                      ) : (
                                        <span className="text-[8.5px] font-bold text-amber-800 bg-amber-50 px-1 py-0.2 rounded">
                                          Pendente
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  <div className="font-bold text-slate-800 text-xs flex items-center justify-between gap-1 flex-wrap">
                                    <span>{isGcm ? 'Guarda Civil Municipal (GCM)' : (off.name || 'Aguardando escala')}</span>
                                    {!isGcm && getOfficerVehicle(off) && (
                                      <span className="font-mono text-[9.5px] font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                        <Car className="w-2.5 h-2.5 text-emerald-700" />
                                        <span>VTR: {getOfficerVehicle(off)}</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between mt-1">
                                    {isGcm ? (
                                      <span className="text-[10px] text-blue-900 font-extrabold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <Shield className="w-2.5 h-2.5 text-blue-700" />
                                        GCM
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          if (off.re) onSearchByRe(off.re);
                                        }}
                                        className="hover:underline text-blue-700 font-semibold cursor-pointer"
                                      >
                                        RE {off.re || '—'}
                                      </button>
                                    )}

                                    {off.phone ? (
                                      <a
                                        href={`tel:${off.phone}`}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200 hover:bg-blue-50"
                                      >
                                        <Phone className="w-3 h-3" />
                                        {off.phone}
                                      </a>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">Sem tel.</span>
                                    )}
                                  </div>

                                  {isGcm ? (
                                    <div className="w-full mt-1.5 py-1.5 px-2 text-[11px] font-extrabold text-slate-700 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center gap-1 shadow-2xs">
                                      <Shield className="w-3 h-3 text-blue-700" />
                                      <span>Rendição por Guarda Civil Municipal</span>
                                    </div>
                                  ) : !isOffOk ? (
                                    <button
                                      onClick={() => onSelectSchoolForCheckIn(s, 'Tarde', off)}
                                      className="w-full mt-1.5 py-1.5 text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <MapPin className="w-3.5 h-3.5" />
                                      Fazer Check-in Tarde {pmOfficers.length > 1 ? `· ${off.name.split(' ')[0]}` : ''}
                                    </button>
                                  ) : (
                                    <div className="mt-1.5 py-1 px-2.5 text-[10.5px] font-bold text-emerald-800 bg-emerald-100/60 rounded-lg border border-emerald-200 flex items-center justify-between gap-1.5">
                                      <div className="flex items-center gap-1 min-w-0">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="truncate">
                                          {fullDayRecord ? 'OK · Dia Inteiro' : 'Check-in Realizado'}
                                        </span>
                                        {offRecord?.time && (
                                          <span className="text-emerald-700 text-[10px] font-extrabold font-mono">
                                            às {offRecord.time}
                                          </span>
                                        )}
                                      </div>
                                      {offRecord && onDeleteCheckIn && (
                                        <button
                                          onClick={() => handlePromptDelete(offRecord)}
                                          disabled={deletingId === offRecord.id}
                                          className="px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[9.5px] font-bold transition flex items-center gap-0.5 cursor-pointer shrink-0 active:scale-95"
                                          title="Desfazer/Apagar este check-in"
                                        >
                                          <Trash2 className="w-2.5 h-2.5 text-red-600" />
                                          <span>{deletingId === offRecord.id ? '...' : 'Desfazer'}</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Instructions card */}
      <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
        <School className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#0F2B48] font-bold block mb-0.5">
            Critério Operacional de Presença nas Escolas
          </strong>
          O policial escalado para o dia inteiro (ambos os turnos) realiza o check-in na sua chegada pela manhã. Esse registro valida sua presença tanto no Turno Manhã (06h às 13h) quanto no Turno Tarde (13h ao Término), não sendo exigido novo check-in à tarde.
        </div>
      </div>

      {/* Confirmation Modal for Undoing Check-in */}
      {confirmDeleteRecord && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">
                  Desfazer Check-In
                </h4>
                <p className="text-xs text-slate-500">
                  Confirmação de cancelamento operacional
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Policial:</span>
                <span className="font-black text-slate-800">
                  {confirmDeleteRecord.rank} {confirmDeleteRecord.officerName} (RE {confirmDeleteRecord.officerRe})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Escola:</span>
                <span className="font-black text-slate-800 truncate max-w-[200px]">
                  {confirmDeleteRecord.schoolName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Município / Turno:</span>
                <span className="font-bold text-slate-700">
                  {confirmDeleteRecord.city} · {confirmDeleteRecord.shift}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Deseja realmente cancelar este check-in? O registro será <strong>excluído do Firestore</strong> e o posto retornará para o status <strong>Pendente</strong>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteRecord(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-black bg-red-600 hover:bg-red-700 text-white rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingId ? 'Apagando...' : 'Confirmar e Desfazer'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
