import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Building,
  User,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  Shield
} from 'lucide-react';
import { SchoolItem, CheckInRecord, SchoolOfficer } from '../types';
import { isSchoolFullDay, findMorningCheckIn, findAfternoonCheckIn, isGcmOfficer } from '../utils/checkinStatus';
import { normalizeCityName } from '../utils/municipality';

export type KpiFilterType = 'morning_done' | 'morning_pending' | 'afternoon_done' | 'afternoon_pending';

interface KpiDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterType: KpiFilterType;
  schools: SchoolItem[];
  checkIns: CheckInRecord[];
  onDeleteCheckIn: (checkInId: string, officerInfo: string, schoolName: string, record?: CheckInRecord) => Promise<void> | void;
  onSelectSchoolForCheckIn: (school: SchoolItem, shift: 'Manhã' | 'Tarde' | 'Integral', officer?: SchoolOfficer) => void;
  onSearchByRe: (re: string) => void;
  onOpenAuditCheckIns?: () => void;
}

export const KpiDetailsModal: React.FC<KpiDetailsModalProps> = ({
  isOpen,
  onClose,
  filterType,
  schools,
  checkIns,
  onDeleteCheckIn,
  onSelectSchoolForCheckIn,
  onSearchByRe,
  onOpenAuditCheckIns
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('TODOS');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<CheckInRecord | null>(null);

  // Extract cities strictly from the schools in this modal
  const cities = useMemo(() => {
    const rawCities = schools
      .map((s) => normalizeCityName(s.city?.trim()))
      .filter((c): c is string => Boolean(c && c.length > 1));
    const unique = Array.from(new Set(rawCities));
    unique.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['TODOS', ...unique];
  }, [schools]);

  // Reset selectedCity if not present in available cities
  useEffect(() => {
    if (selectedCity !== 'TODOS' && !cities.includes(selectedCity)) {
      setSelectedCity('TODOS');
    }
  }, [cities, selectedCity]);

  // Compute title, badge and description based on filterType
  const meta = useMemo(() => {
    switch (filterType) {
      case 'morning_done':
        return {
          title: 'Check-ins Realizados · Turno da Manhã',
          badgeText: 'Manhã (06h - 13h)',
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          emptyText: 'Nenhum check-in matutino registrado até o momento.',
          isDoneList: true,
          shift: 'Manhã' as const
        };
      case 'morning_pending':
        return {
          title: 'Postos Pendentes de Check-in · Turno da Manhã',
          badgeText: 'Pendentes · Manhã',
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
          emptyText: 'Excelente! Todos os postos da manhã já realizaram check-in.',
          isDoneList: false,
          shift: 'Manhã' as const
        };
      case 'afternoon_done':
        return {
          title: 'Check-ins Realizados · Turno da Tarde',
          badgeText: 'Tarde (13h - Término)',
          badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
          emptyText: 'Nenhum check-in vespertino registrado até o momento.',
          isDoneList: true,
          shift: 'Tarde' as const
        };
      case 'afternoon_pending':
        return {
          title: 'Postos Pendentes de Check-in · Turno da Tarde',
          badgeText: 'Pendentes · Tarde',
          badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
          emptyText: 'Excelente! Todos os postos da tarde já realizaram check-in.',
          isDoneList: false,
          shift: 'Tarde' as const
        };
    }
  }, [filterType]);

  // Filter items
  const items = useMemo(() => {
    const list: Array<{
      school: SchoolItem;
      officer: { rank: string; re: string; name: string; phone: string };
      record?: CheckInRecord;
      isFullDay: boolean;
    }> = [];

    schools.forEach((school) => {
      const isFullDay = isSchoolFullDay(school);
      const amRecord = findMorningCheckIn(school, checkIns);
      const pmRecord = findAfternoonCheckIn(school, checkIns);

      if (filterType === 'morning_done') {
        const isGcm = isGcmOfficer(school.am);
        if (amRecord && !isGcm) {
          list.push({
            school,
            officer: school.am,
            record: amRecord,
            isFullDay
          });
        }
      } else if (filterType === 'morning_pending') {
        const isGcm = isGcmOfficer(school.am);
        if (!amRecord && !isGcm) {
          list.push({
            school,
            officer: school.am,
            isFullDay
          });
        }
      } else if (filterType === 'afternoon_done') {
        const isGcm = isGcmOfficer(school.pm);
        if (pmRecord && !isGcm) {
          list.push({
            school,
            officer: school.pm?.name ? school.pm : school.am,
            record: pmRecord,
            isFullDay
          });
        }
      } else if (filterType === 'afternoon_pending') {
        const isGcm = isGcmOfficer(school.pm);
        if (!pmRecord && !isGcm) {
          list.push({
            school,
            officer: school.pm?.name ? school.pm : school.am,
            isFullDay
          });
        }
      }
    });

    // Apply city & search query
    return list.filter((item) => {
      if (selectedCity !== 'TODOS' && normalizeCityName(item.school.city) !== normalizeCityName(selectedCity)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSchool = (item.school.school || '').toLowerCase().includes(q);
        const matchCity = (item.school.city || '').toLowerCase().includes(q);
        const matchName = (item.officer?.name || '').toLowerCase().includes(q);
        const matchRe = (item.officer?.re || '').toLowerCase().includes(q);
        return matchSchool || matchCity || matchName || matchRe;
      }
      return true;
    });
  }, [schools, checkIns, filterType, selectedCity, searchQuery]);

  if (!isOpen) return null;

  const handlePromptDelete = (record: CheckInRecord) => {
    setConfirmDeleteRecord(record);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteRecord) return;
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5 animate-in fade-in duration-200">
      <div className="relative bg-white rounded-t-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full max-h-[94vh] sm:max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-3.5 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.isDoneList ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
              {meta.isDoneList ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Clock className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-xs sm:text-base font-black text-slate-900 truncate">
                  {meta.title}
                </h3>
                <span className={`text-[10px] font-extrabold uppercase px-1.5 sm:px-2 py-0.5 rounded-md border ${meta.badgeColor}`}>
                  {items.length} {items.length === 1 ? 'registro' : 'registros'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
                {meta.isDoneList
                  ? 'Você pode visualizar os detalhes e excluir/desfazer check-ins incorretos ou de teste.'
                  : 'Relação de escolas que ainda não registraram presença.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenAuditCheckIns && meta.isDoneList && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuditCheckIns();
                }}
                className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 transition cursor-pointer"
                title="Abrir aba de Auditoria de Check-Ins completa"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Auditoria de Check-Ins</span>
                <span className="sm:hidden">Auditoria</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-200/70 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition cursor-pointer shrink-0"
              title="Fechar janela"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por escola, policial ou RE..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Cidade:</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="text-xs font-bold border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c === 'TODOS'
                    ? 'Todas as Cidades'
                    : c === 'VOTORANTIM'
                    ? 'VOTORANTIM / Votoratim'
                    : c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5 sm:space-y-3">
          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-medium text-xs bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              {meta.emptyText}
            </div>
          ) : (
            items.map((item, idx) => {
              const { school, officer, record, isFullDay } = item;
              const isDeleting = deletingId === record?.id;
              const uniqueKey = record?.id
                ? `item-${filterType}-${record.id}-${idx}`
                : `item-${filterType}-${school.id || school.school}-${officer.re || idx}`;

              return (
                <div
                  key={uniqueKey}
                  className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    record ? 'bg-white border-slate-200 shadow-2xs hover:border-slate-300' : 'bg-amber-50/40 border-amber-200/80'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-slate-900 font-extrabold text-xs sm:text-sm">
                        {school.school}
                      </strong>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                        {school.city}
                      </span>
                      {isFullDay && (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                          Dia Inteiro
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-extrabold text-slate-800">
                        {isGcmOfficer(officer)
                          ? 'Guarda Civil Municipal (GCM)'
                          : `${officer.rank || ''} ${officer.name || 'Aguardando escala'}`}
                      </span>
                      {isGcmOfficer(officer) ? (
                        <span className="text-blue-900 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5 text-blue-700" />
                          GCM
                        </span>
                      ) : officer.re && (
                        <button
                          onClick={() => {
                            onClose();
                            onSearchByRe(officer.re);
                          }}
                          className="font-mono text-blue-700 hover:underline font-bold text-[11px]"
                          title="Filtrar por este RE"
                        >
                          (RE: {officer.re})
                        </button>
                      )}
                      {record?.time && (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Feito às {record.time}
                        </span>
                      )}
                      {record?.distanceMeters !== undefined && record?.distanceMeters !== null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          record.isOutOfRange ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          GPS: {record.distanceMeters}m
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                    {record ? (
                      <button
                        onClick={() => handlePromptDelete(record)}
                        disabled={isDeleting}
                        className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-red-50 hover:bg-red-100 active:scale-95 text-red-700 border border-red-200 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[38px] w-full sm:w-auto"
                        title="Desfazer/Apagar este check-in"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        <span>{deletingId === record.id ? 'Apagando...' : 'Desfazer Check-in'}</span>
                      </button>
                    ) : isGcmOfficer(officer) ? (
                      <div className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-blue-50 text-blue-900 border border-blue-200 flex items-center justify-center gap-1.5 min-h-[38px] w-full sm:w-auto shadow-2xs">
                        <Shield className="w-3.5 h-3.5 text-blue-700" />
                        <span>Rendição GCM</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          onClose();
                          onSelectSchoolForCheckIn(school, meta.shift, item.officer);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer min-h-[38px] w-full sm:w-auto"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Fazer Check-in</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Total filtrado: <strong>{items.length}</strong> de {schools.length} postos</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer min-h-[36px]"
          >
            Fechar
          </button>
        </div>

        {/* In-Modal Confirmation Overlay for Undoing Check-in */}
        {confirmDeleteRecord && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
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
                Ao confirmar, este check-in será <strong>excluído permanentemente do Firestore</strong> e o posto eleitoral retornará ao status <strong>Pendente</strong>.
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
      </div>
    </div>
  );
};
