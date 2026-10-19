import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  MapPin,
  Clock,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  Compass,
  Filter,
  Layers,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Loader2,
  FileCheck,
  UserCheck,
  X,
  School
} from 'lucide-react';
import { CheckInRecord, SchoolItem } from '../types';
import { normalizeCityName } from '../utils/municipality';
import { normalizeRe, normalizeText } from '../utils/normalize';
import { hasVerifiedLocation } from '../utils/checkinStatus';

interface CheckInAuditTabProps {
  checkIns: CheckInRecord[];
  allSchools: SchoolItem[];
  onValidateCheckIn: (
    checkInId: string,
    isValidated: boolean,
    notes?: string
  ) => Promise<void> | void;
  onUndoCheckIn: (
    record: CheckInRecord,
    reason: string
  ) => Promise<void> | void;
  onBulkValidateInRadius?: (recordIds: string[]) => Promise<void> | void;
  onClearTestData?: () => void;
  currentUserLabel?: string;
}

export type RadiusFilterMode = 'all' | 'out_of_range' | 'in_range';
export type ValidationFilterMode = 'all' | 'pending' | 'validated';

export const CheckInAuditTab: React.FC<CheckInAuditTabProps> = ({
  checkIns,
  allSchools,
  onValidateCheckIn,
  onUndoCheckIn,
  onBulkValidateInRadius,
  onClearTestData,
  currentUserLabel = 'Supervisão P/3'
}) => {
  // Filter states
  const [radiusFilter, setRadiusFilter] = useState<RadiusFilterMode>('all');
  const [validationFilter, setValidationFilter] = useState<ValidationFilterMode>('all');
  const [selectedCity, setSelectedCity] = useState<string>('TODOS');
  const [selectedShift, setSelectedShift] = useState<'TODOS' | 'Manhã' | 'Tarde'>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals / Action states
  const [undoModalRecord, setUndoModalRecord] = useState<CheckInRecord | null>(null);
  const [undoReason, setUndoReason] = useState<string>('Check-in fora do raio de tolerância (150m)');
  const [isUndoing, setIsUndoing] = useState<boolean>(false);

  const [validationModalRecord, setValidationModalRecord] = useState<CheckInRecord | null>(null);
  const [validationNotes, setValidationNotes] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const [isBulkValidating, setIsBulkValidating] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'info' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 5000);
  };

  // Helper to determine if a checkin is out of range (> 150m)
  const isOutOfRange = (c: CheckInRecord): boolean => {
    if (typeof c.distanceMeters === 'number') {
      return c.distanceMeters > 150;
    }
    return Boolean(c.isOutOfRange);
  };

  // Overall counts
  const totalCount = checkIns.length;
  const outOfRangeList = useMemo(() => checkIns.filter((c) => isOutOfRange(c)), [checkIns]);
  // In range = GPS-verified within 150m. Records without GPS/post coordinates are not counted
  // as compliant and are never bulk-validated.
  const inRangeList = useMemo(
    () => checkIns.filter((c) => !isOutOfRange(c) && hasVerifiedLocation(c)),
    [checkIns]
  );

  const validatedCount = useMemo(() => checkIns.filter((c) => c.isValidated).length, [checkIns]);
  const pendingValidationCount = totalCount - validatedCount;
  const inRangeCompliancePercent = totalCount > 0 ? Math.round((inRangeList.length / totalCount) * 100) : 100;

  // Unique sorted cities list strictly from available check-ins
  const cities = useMemo(() => {
    const rawCities = checkIns
      .map((c) => normalizeCityName(c.city?.trim()))
      .filter((c): c is string => Boolean(c && c.length > 1));
    const unique = Array.from(new Set(rawCities));
    unique.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['TODOS', ...unique];
  }, [checkIns]);

  useEffect(() => {
    if (selectedCity !== 'TODOS' && !cities.includes(selectedCity)) {
      setSelectedCity('TODOS');
    }
  }, [cities, selectedCity]);

  // Filtered check-ins
  const filteredCheckIns = useMemo(() => {
    return checkIns.filter((c) => {
      // 1. Radius Filter
      const isOut = isOutOfRange(c);
      if (radiusFilter === 'out_of_range' && !isOut) return false;
      if (radiusFilter === 'in_range' && (isOut || !hasVerifiedLocation(c))) return false;

      // 2. Validation status
      if (validationFilter === 'validated' && !c.isValidated) return false;
      if (validationFilter === 'pending' && c.isValidated) return false;

      // 3. City filter
      if (selectedCity !== 'TODOS') {
        const selNorm = normalizeCityName(selectedCity);
        const cityNorm = normalizeCityName(c.city || '');
        if (selNorm !== cityNorm) return false;
      }

      // 4. Shift filter
      if (selectedShift !== 'TODOS') {
        if (c.shift?.toLowerCase() !== selectedShift.toLowerCase()) return false;
      }

      // 5. Search query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const reNorm = normalizeRe(c.officerRe || '');
        const nameNorm = normalizeText(c.officerName || '').toLowerCase();
        const schoolNorm = normalizeText(c.schoolName || '').toLowerCase();
        const cityNorm = normalizeText(c.city || '').toLowerCase();
        const protocolNorm = (c.protocol || '').toLowerCase();

        const match =
          reNorm.includes(query) ||
          nameNorm.includes(query) ||
          schoolNorm.includes(query) ||
          cityNorm.includes(query) ||
          protocolNorm.includes(query);

        if (!match) return false;
      }

      return true;
    });
  }, [checkIns, radiusFilter, validationFilter, selectedCity, selectedShift, searchTerm]);

  // Handle Quick Validation Toggle
  const handleQuickValidate = async (record: CheckInRecord) => {
    const newStatus = !record.isValidated;
    try {
      await onValidateCheckIn(
        record.id,
        newStatus,
        newStatus ? 'Validado diretamente pela Supervisão P/3' : undefined
      );
      showFeedback(
        newStatus
          ? `Check-in de ${record.rank} ${record.officerName} validado com sucesso!`
          : `Validação de ${record.rank} ${record.officerName} desfeita.`
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Open Validation with Notes Modal
  const handleOpenValidationModal = (record: CheckInRecord) => {
    setValidationModalRecord(record);
    setValidationNotes(record.auditNotes || (isOutOfRange(record) ? 'Verificado por rádio/visual no portão da escola' : 'Conforme no local'));
  };

  const handleConfirmValidationWithNotes = async () => {
    if (!validationModalRecord) return;
    setIsValidating(true);
    try {
      await onValidateCheckIn(validationModalRecord.id, true, validationNotes.trim() || undefined);
      showFeedback(`Check-in de ${validationModalRecord.rank} ${validationModalRecord.officerName} homologado.`);
      setValidationModalRecord(null);
    } finally {
      setIsValidating(false);
    }
  };

  // Handle Undo Check-in Modal
  const handleOpenUndoModal = (record: CheckInRecord) => {
    setUndoModalRecord(record);
    const isOut = isOutOfRange(record);
    setUndoReason(
      isOut
        ? `Check-in irregular a ${record.distanceMeters || 'mais de 150'}m da escola (fora do raio de segurança).`
        : 'Desfeito por solicitação da supervisão / erro de posto.'
    );
  };

  const handleConfirmUndo = async () => {
    if (!undoModalRecord) return;
    setIsUndoing(true);
    try {
      await onUndoCheckIn(undoModalRecord, undoReason.trim() || 'Check-in desfeito pela P/3');
      showFeedback(
        `Check-in de ${undoModalRecord.rank} ${undoModalRecord.officerName} foi desfeito com sucesso! O posto retornou ao status Pendente.`,
        'success'
      );
      setUndoModalRecord(null);
    } catch (err: any) {
      console.error('Erro ao desfazer check-in:', err);
      showFeedback(`Falha ao desfazer check-in: ${err?.message || 'Erro operacional'}`, 'info');
    } finally {
      setIsUndoing(false);
    }
  };

  // Handle Bulk Validate all pending in-range check-ins
  const handleBulkValidate = async () => {
    const pendingInRange = inRangeList.filter((c) => !c.isValidated);
    if (pendingInRange.length === 0) {
      showFeedback('Todos os check-ins no raio correto já estão validados!', 'info');
      return;
    }

    if (onBulkValidateInRadius) {
      setIsBulkValidating(true);
      try {
        await onBulkValidateInRadius(pendingInRange.map((c) => c.id));
        showFeedback(`${pendingInRange.length} check-ins no raio de 150m foram validados em lote.`);
      } finally {
        setIsBulkValidating(false);
      }
    } else {
      // Fallback: validate one by one
      setIsBulkValidating(true);
      try {
        for (const item of pendingInRange) {
          await onValidateCheckIn(item.id, true, 'Homologado em lote pela Supervisão P/3 (Raio Conforme)');
        }
        showFeedback(`${pendingInRange.length} check-ins no raio de 150m foram validados.`);
      } finally {
        setIsBulkValidating(false);
      }
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-md animate-in fade-in duration-200 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-blue-50 border-blue-300 text-blue-950'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-500 hover:text-slate-800 p-1 text-xs cursor-pointer font-black"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-blue-900/10 via-slate-50 to-amber-500/10 border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#0F2B48] text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Auditoria de Check-Ins
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 bg-blue-100 border border-blue-300 px-2.5 py-0.5 rounded-full">
                  Supervisão P/3
                </span>
                {outOfRangeList.length > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    {outOfRangeList.length} Fora do Raio
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Controle de conformidade geográfica dos policiais nos postos de votação. Raio de segurança estabelecido: <strong>150 metros</strong>.
              </p>
            </div>
          </div>

          {/* Bulk Action and Reset Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {inRangeList.some((c) => !c.isValidated) && (
              <button
                disabled={isBulkValidating}
                onClick={handleBulkValidate}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Homologar em lote todos os check-ins que estão dentro do raio de 150m"
              >
                {isBulkValidating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                )}
                <span>Validar Conformes (≤150m)</span>
              </button>
            )}

            {onClearTestData && checkIns.length > 0 && (
              <button
                type="button"
                onClick={onClearTestData}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 active:scale-95 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Zerar todos os check-ins e fiscalizações de testes"
              >
                <RotateCcw className="w-3.5 h-3.5 text-red-600" />
                <span>Zerar Dados de Testes</span>
              </button>
            )}
          </div>
        </div>

        {/* 5 KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mt-4">
          {/* 1. Total Realizados */}
          <button
            type="button"
            onClick={() => {
              setRadiusFilter('all');
              setValidationFilter('all');
            }}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              radiusFilter === 'all' && validationFilter === 'all'
                ? 'bg-white border-[#0F2B48] ring-2 ring-[#0F2B48]/10 shadow-xs'
                : 'bg-white/80 border-slate-200 hover:border-slate-300'
            }`}
          >
            <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Total Realizados
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {totalCount}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">check-ins</span>
            </div>
          </button>

          {/* 2. No Raio Correto (<= 150m) */}
          <button
            type="button"
            onClick={() => {
              setRadiusFilter('in_range');
            }}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              radiusFilter === 'in_range'
                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white/80 border-emerald-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="block text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                No Raio (≤ 150m)
              </span>
              <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                {inRangeCompliancePercent}%
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                {inRangeList.length}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">conformes</span>
            </div>
          </button>

          {/* 3. Fora do Raio (> 150m) - Alerta */}
          <button
            type="button"
            onClick={() => {
              setRadiusFilter('out_of_range');
            }}
            className={`p-3 rounded-xl border text-left transition cursor-pointer relative overflow-hidden ${
              radiusFilter === 'out_of_range'
                ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                : 'bg-white/80 border-rose-200 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="block text-[10px] font-black uppercase text-rose-800 tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                Fora do Raio (&gt;150m)
              </span>
              {outOfRangeList.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-rose-700 font-mono">
                {outOfRangeList.length}
              </span>
              <span className="text-[10px] text-rose-600 font-medium">sob alerta</span>
            </div>
          </button>

          {/* 4. Validados pela P/3 */}
          <button
            type="button"
            onClick={() => {
              setValidationFilter('validated');
            }}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              validationFilter === 'validated'
                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                : 'bg-white/80 border-blue-200 hover:border-blue-300'
            }`}
          >
            <span className="block text-[10px] font-black uppercase text-blue-800 tracking-wider">
              Validados P/3
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-blue-800 font-mono">
                {validatedCount}
              </span>
              <span className="text-[10px] text-blue-600 font-medium">homologados</span>
            </div>
          </button>

          {/* 5. Pendentes de Validação */}
          <button
            type="button"
            onClick={() => {
              setValidationFilter('pending');
            }}
            className={`p-3 rounded-xl border text-left transition cursor-pointer col-span-2 sm:col-span-1 ${
              validationFilter === 'pending'
                ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white/80 border-amber-200 hover:border-amber-300'
            }`}
          >
            <span className="block text-[10px] font-black uppercase text-amber-800 tracking-wider">
              Pendentes Validação
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-amber-700 font-mono">
                {pendingValidationCount}
              </span>
              <span className="text-[10px] text-amber-600 font-medium">a conferir</span>
            </div>
          </button>
        </div>

        {/* Filter Controls Row */}
        <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Segmented Mode: Todos vs Fora do Raio vs No Raio */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shrink-0 overflow-x-auto">
            <button
              onClick={() => setRadiusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                radiusFilter === 'all'
                  ? 'bg-[#0F2B48] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Todos</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {totalCount}
              </span>
            </button>

            <button
              onClick={() => setRadiusFilter('out_of_range')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                radiusFilter === 'out_of_range'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Fora do Raio (&gt;150m)</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  radiusFilter === 'out_of_range'
                    ? 'bg-white/20 text-white'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {outOfRangeList.length}
              </span>
            </button>

            <button
              onClick={() => setRadiusFilter('in_range')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                radiusFilter === 'in_range'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>No Raio (≤150m)</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  radiusFilter === 'in_range'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {inRangeList.length}
              </span>
            </button>
          </div>

          {/* Quick Selectors: Municipality, Validation, Shift, Search */}
          <div className="flex items-center gap-2 flex-wrap flex-1 justify-end">
            {/* Municipality Selector */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                Cidade:
              </span>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todas as Cidades</option>
                {cities
                  .filter((c) => c !== 'TODOS')
                  .map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
              </select>
            </div>

            {/* Validation Status Selector */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                Status:
              </span>
              <select
                value={validationFilter}
                onChange={(e) => setValidationFilter(e.target.value as ValidationFilterMode)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">Todos os Status</option>
                <option value="pending">Apenas Pendentes</option>
                <option value="validated">Apenas Validados</option>
              </select>
            </div>

            {/* Shift Selector */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                Turno:
              </span>
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todos</option>
                <option value="Manhã">Manhã</option>
                <option value="Tarde">Tarde</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="RE, Nome ou Escola..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
          </div>
        </div>
      </div>

      {/* Main Check-Ins List */}
      {filteredCheckIns.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Compass className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-black text-slate-700">
            {radiusFilter === 'out_of_range'
              ? 'Nenhum check-in fora do raio de 150m encontrado'
              : searchTerm || selectedCity !== 'TODOS'
              ? 'Nenhum check-in atende aos filtros selecionados'
              : 'Nenhum check-in registrado até o momento'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {radiusFilter === 'out_of_range'
              ? 'Excelente! Todos os policiais registraram presença dentro da tolerância de proximidade com as escolas.'
              : 'Ajuste os filtros de cidade, turno ou busca textual acima para visualizar outros registros.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
            <span>
              Exibindo <strong>{filteredCheckIns.length}</strong> {filteredCheckIns.length === 1 ? 'registro' : 'registros'}
              {radiusFilter === 'out_of_range' ? ' fora do raio' : radiusFilter === 'in_range' ? ' conformes' : ''}
            </span>
            <span className="text-[11px] text-slate-400">
              Ordenados por horário mais recente
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredCheckIns.map((record) => {
              const out = isOutOfRange(record);
              const dist = record.distanceMeters;
              const hasLat = typeof record.lat === 'number' && typeof record.lng === 'number';
              const mapsUrl = hasLat ? `https://www.google.com/maps?q=${record.lat},${record.lng}` : null;

              return (
                <div
                  key={record.id}
                  className={`bg-white border rounded-2xl p-4 sm:p-5 transition shadow-xs hover:shadow-sm ${
                    out
                      ? 'border-rose-300 bg-rose-50/20'
                      : record.isValidated
                      ? 'border-emerald-300 bg-emerald-50/10'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
                    {/* Officer & Status Badges */}
                    <div className="flex items-start sm:items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                          out
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {out ? <AlertTriangle className="w-5 h-5 text-rose-600" /> : <MapPin className="w-5 h-5 text-emerald-600" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-slate-900">
                            {record.rank} {record.officerName}
                          </span>
                          {!hasVerifiedLocation(record) && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                              Sem GPS
                            </span>
                          )}
                          <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            RE {record.officerRe}
                          </span>
                          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            Turno: {record.shift}
                          </span>
                        </div>

                        {/* Distance / GPS Tag */}
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {out ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-800 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-md">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              FORA DO RAIO ({dist !== null ? `${Math.round(dist)}m` : '>150m'} da escola)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              NO POSTO ({dist !== null ? `${Math.round(dist)}m` : '≤150m'})
                            </span>
                          )}

                          {record.accuracy !== null && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              Precisão GPS: ±{Math.round(record.accuracy || 0)}m
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Validar & Desfazer */}
                    <div className="flex items-center gap-2 self-end lg:self-auto flex-wrap">
                      {/* Validation Button */}
                      {record.isValidated ? (
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Validado
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuickValidate(record)}
                            className="text-[11px] text-slate-400 hover:text-slate-600 px-1.5 py-1 underline cursor-pointer"
                            title="Desfazer validação deste check-in"
                          >
                            Revogar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleQuickValidate(record)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1 cursor-pointer"
                            title="Homologar imediatamente este check-in"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Validar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenValidationModal(record)}
                            className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                            title="Validar com anotações ou observações"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                        </div>
                      )}

                      {/* Undo Check-in Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenUndoModal(record)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Desfazer e cancelar este check-in. O posto voltará a constar como pendente."
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                        <span>Desfazer Check-In</span>
                      </button>
                    </div>
                  </div>

                  {/* Body Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {/* Escola / Posto */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                        Posto Eleitoral
                      </span>
                      <span className="font-extrabold text-slate-800 block truncate mt-0.5" title={record.schoolName}>
                        {record.schoolName}
                      </span>
                      <span className="text-[11px] text-slate-500 font-bold block">
                        {record.city}
                      </span>
                    </div>

                    {/* Horário & Protocolo */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                        Horário & Protocolo
                      </span>
                      <div className="flex items-center gap-1 font-bold text-slate-800 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{record.time}</span>
                        <span className="text-slate-400 text-[10px]">
                          ({new Date(record.timestamp).toLocaleDateString('pt-BR')})
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 truncate block mt-0.5">
                        {record.protocol}
                      </span>
                    </div>

                    {/* Localização GPS & Mapa */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                        Geolocalização
                      </span>
                      {hasLat ? (
                        <div className="mt-0.5 flex flex-col gap-0.5">
                          <span className="font-mono text-[10px] text-slate-700">
                            {record.lat?.toFixed(5)}, {record.lng?.toFixed(5)}
                          </span>
                          {mapsUrl && (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 hover:text-blue-900 font-bold text-[11px] flex items-center gap-1 mt-0.5"
                            >
                              <span>Ver no Mapa</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
                          Coordenadas não disponíveis
                        </span>
                      )}
                    </div>

                    {/* Auditoria / Validação status */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                        Auditoria P/3
                      </span>
                      {record.isValidated ? (
                        <div className="mt-0.5">
                          <span className="text-emerald-700 font-bold block text-[11px]">
                            Homologado por {record.validatedBy || 'Supervisão'}
                          </span>
                          {record.auditNotes && (
                            <p className="text-[10px] text-slate-600 italic mt-0.5 truncate" title={record.auditNotes}>
                              "{record.auditNotes}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-amber-700 font-bold text-[11px] mt-0.5 block">
                          Pendente de homologação
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Special Alert banner if out of range */}
                  {out && (
                    <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-900">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black">Atenção da Supervisão: </span>
                        <span>
                          O policial confirmou presença a <strong>{dist !== null ? `${Math.round(dist)} metros` : 'distância desconhecida'}</strong> do posto eleitoral cadastrado.
                          {record.isValidated
                            ? ' O registro foi homologado pela P/3.'
                            : ' Verifique se o policial de fato está presente na escola antes de homologar ou utilize a opção "Desfazer Check-In".'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL 1: DESFAZER CHECK-IN (COM MOTIVO E CONFIRMAÇÃO)   */}
      {/* ======================================================= */}
      {undoModalRecord && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Desfazer Check-In
                  </h3>
                  <p className="text-xs text-slate-500">
                    Esta ação cancelará o registro e restaurará o posto para pendente.
                  </p>
                </div>
              </div>
              <button
                disabled={isUndoing}
                onClick={() => setUndoModalRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Target Officer & School Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Policial:</span>
                <span className="font-black text-slate-800">
                  {undoModalRecord.rank} {undoModalRecord.officerName} (RE {undoModalRecord.officerRe})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Posto Eleitoral:</span>
                <span className="font-black text-slate-800 truncate max-w-[240px]">
                  {undoModalRecord.schoolName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Município / Turno:</span>
                <span className="font-bold text-slate-700">
                  {undoModalRecord.city} · Turno {undoModalRecord.shift}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Distância Registrada:</span>
                <span
                  className={`font-black ${
                    isOutOfRange(undoModalRecord) ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {undoModalRecord.distanceMeters !== null
                    ? `${Math.round(undoModalRecord.distanceMeters)}m (${isOutOfRange(undoModalRecord) ? 'Fora do raio > 150m' : 'No raio ≤ 150m'})`
                    : 'Não calculada'}
                </span>
              </div>
            </div>

            {/* Motivo do Cancelamento */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-700">
                Motivo / Justificativa da Exclusão:
              </label>
              <textarea
                rows={2}
                value={undoReason}
                onChange={(e) => setUndoReason(e.target.value)}
                placeholder="Informe o motivo pelo qual o check-in está sendo cancelado..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
              />

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {[
                  'Check-in fora do raio (150m)',
                  'Policial em posto diferente',
                  'Erro de digitação / teste',
                  'Duplicidade de registro'
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setUndoReason(preset)}
                    className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isUndoing}
                onClick={() => setUndoModalRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isUndoing}
                onClick={handleConfirmUndo}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {isUndoing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Confirmar e Desfazer Check-In</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL 2: VALIDAR CHECK-IN COM OBSERVAÇÃO/JUSTIFICATIVA */}
      {/* ======================================================= */}
      {validationModalRecord && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Homologar Check-In
                  </h3>
                  <p className="text-xs text-slate-500">
                    Validação formal de presença pela Supervisão do 40º BPM/I.
                  </p>
                </div>
              </div>
              <button
                disabled={isValidating}
                onClick={() => setValidationModalRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Target Officer & School Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Policial:</span>
                <span className="font-black text-slate-800">
                  {validationModalRecord.rank} {validationModalRecord.officerName} (RE {validationModalRecord.officerRe})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Escola:</span>
                <span className="font-black text-slate-800 truncate max-w-[240px]">
                  {validationModalRecord.schoolName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Distância:</span>
                <span
                  className={`font-black ${
                    isOutOfRange(validationModalRecord) ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {validationModalRecord.distanceMeters !== null
                    ? `${Math.round(validationModalRecord.distanceMeters)}m (${
                        isOutOfRange(validationModalRecord) ? 'FORA DO RAIO' : 'CONFORME'
                      })`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Anotação / Observação da Auditoria */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-700">
                Anotação da Supervisão / Despacho (Opcional):
              </label>
              <textarea
                rows={2}
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
                placeholder="Ex: Policial conferido por rádio, portão secundário, autorizado pelo oficial..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />

              {/* Quick Presets for Notes */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {[
                  'Presença confirmada no portão',
                  'Sinal GPS fraco no interior',
                  'Conferido visualmente pelo fiscal',
                  'Conforme no local'
                ].map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => setValidationNotes(note)}
                    className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition"
                  >
                    {note}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isValidating}
                onClick={() => setValidationModalRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isValidating}
                onClick={handleConfirmValidationWithNotes}
                className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Confirmar e Homologar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
