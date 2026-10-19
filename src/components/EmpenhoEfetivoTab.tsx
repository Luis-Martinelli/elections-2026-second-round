import React, { useState, useMemo } from 'react';
import {
  Car,
  Search,
  Filter,
  Users,
  Shield,
  Phone,
  Clock,
  MapPin,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Download,
  Award
} from 'lucide-react';
import { StaffMember } from '../types';
import { normalizeText, matchesExactRe, normalizeRe } from '../utils/normalize';
import { INITIAL_STAFF } from '../data/initialData';

interface EmpenhoEfetivoTabProps {
  staffList: StaffMember[];
  onSearchByRe?: (re: string) => void;
  onOpenSheetsConfig?: () => void;
}

// Helper to extract operational shift category for matching
export function getShiftCategory(shiftRaw?: string): 'MANHA' | 'TARDE' | 'INTEGRAL' | 'OUTRO' {
  if (!shiftRaw) return 'OUTRO';
  const s = normalizeText(shiftRaw);
  if (s.includes('INTEGRAL') || s.includes('DIA INTEIRO') || s.includes('06H AO TERMINO') || s.includes('06:00 AO TERMINO')) {
    return 'INTEGRAL';
  }
  if (
    s.includes('MANHA') ||
    s.includes('06H') ||
    s.includes('06:00') ||
    s.includes('07:00') ||
    s.includes('7H') ||
    s.includes('13H') && s.includes('06') ||
    s.includes('13:00') && s.includes('06') ||
    s.includes('1º TURNO') ||
    s.includes('1 TURNO')
  ) {
    return 'MANHA';
  }
  if (
    s.includes('TARDE') ||
    s.includes('13H AO TERMINO') ||
    s.includes('13:00 AO TERMINO') ||
    s.includes('13H') ||
    s.includes('13:00') ||
    s.includes('2º TURNO') ||
    s.includes('2 TURNO')
  ) {
    return 'TARDE';
  }
  return 'OUTRO';
}

// Helper to clean local / sector string for robust matching
export function cleanSector(local?: string): string {
  if (!local) return '';
  return normalizeText(local)
    .replace(/[–—\-_/.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper to clean VTR prefix for robust matching
export function cleanVtrPrefix(vtr?: string): string {
  if (!vtr) return '';
  return normalizeText(vtr).replace(/[^a-z0-9]/gi, '');
}

// Calculate affinity score between an in-charge/command officer and a potential driver
export function calculateDriverAffinity(officer: StaffMember, candidate: StaffMember): number {
  if (!isSupportOrDriverRole(candidate.function)) {
    return -1000;
  }

  let score = 0;

  // 1. Explicit mention in officer.driver
  if (officer.driver) {
    const rawDriver = normalizeText(officer.driver);
    const candName = normalizeText(candidate.name);
    const candRe = normalizeText(candidate.re);
    if (candRe && rawDriver.includes(candRe)) return 10000;
    if (candName && (rawDriver.includes(candName) || candName.split(' ').some(part => part.length >= 4 && rawDriver.includes(part)))) {
      score += 6000;
    }
  }

  // 2. VTR Match
  const offVtr = cleanVtrPrefix(officer.vehicle);
  const candVtr = cleanVtrPrefix(candidate.vehicle);
  if (offVtr && candVtr) {
    if (offVtr === candVtr) {
      score += 4000;
    } else if (offVtr.substring(0, 5) === candVtr.substring(0, 5)) {
      score += 800;
    }
  }

  // 3. Setor / Local Match
  const offLocalNorm = normalizeText(officer.local || '');
  const candLocalNorm = normalizeText(candidate.local || '');
  if (offLocalNorm && candLocalNorm) {
    if (offLocalNorm === candLocalNorm) {
      score += 3000;
    } else if (offLocalNorm.includes(candLocalNorm) || candLocalNorm.includes(offLocalNorm)) {
      score += 2000;
    }
  }

  // Check Cia match (1ª Cia, 2ª Cia, 3ª Cia, 4ª Cia)
  const ciaRegex = /\b([1234])\s*(?:CIA|ª\s*CIA)\b/i;
  const matchOffCia = offLocalNorm.match(ciaRegex);
  const matchCandCia = candLocalNorm.match(ciaRegex);
  if (matchOffCia && matchCandCia && matchOffCia[1] === matchCandCia[1]) {
    score += 1500;
  }

  // Check common cities in sector
  const CITIES = ['VOTORANTIM', 'PIEDADE', 'IBIUNA', 'PILAR DO SUL', 'ARACOIABA', 'SALTO DE PIRAPORA', 'ALUMINIO', 'TAPIRAI', 'IPERO'];
  for (const city of CITIES) {
    if (offLocalNorm.includes(city) && candLocalNorm.includes(city)) {
      score += 1800;
      break;
    }
  }

  // 4. Shift / Horário Match
  const offShift = getShiftCategory(officer.shiftRaw);
  const candShift = getShiftCategory(candidate.shiftRaw);
  const offShiftRaw = normalizeText(officer.shiftRaw || '');
  const candShiftRaw = normalizeText(candidate.shiftRaw || '');

  if (offShiftRaw && candShiftRaw && offShiftRaw === candShiftRaw) {
    score += 1500;
  }

  if (offShift === candShift && offShift !== 'OUTRO') {
    score += 1200;
  } else if (offShift === 'INTEGRAL' || candShift === 'INTEGRAL') {
    score += 500;
  } else if (
    (offShift === 'MANHA' && candShift === 'TARDE') ||
    (offShift === 'TARDE' && candShift === 'MANHA')
  ) {
    // Prohibit cross-shift pairing
    score -= 4000;
  }

  // 5. Function hint: if officer is CGP and candidate is driver/auxiliary
  const candFunc = normalizeText(candidate.function || '');
  const offFunc = normalizeText(officer.function || '');
  if (offFunc.includes('CGP')) {
    if (candFunc.includes('CGP')) {
      score += 2500;
    } else if (candFunc.includes('MOTORISTA') || candFunc.includes('CONDUTOR')) {
      score += 1500;
    }
  }

  return score;
}

// Organizes the staff list so that every officer/commander/CGP is followed immediately
// by their matching driver(s), based on explicit designation, VTR, Setor/Local, and Shift/Horário.
export function organizeStaffWithDriverPairing(staff: StaffMember[]): StaffMember[] {
  if (!staff || staff.length === 0) return [];

  // Separate officers/command/CGP vs drivers/support
  const officers = staff.filter((s) => !isSupportOrDriverRole(s.function));
  const drivers = staff.filter((s) => isSupportOrDriverRole(s.function));

  // Sort officers by hierarchical sequence:
  // First commanders & coordinator, then supervisors, rondas, and CGPs (ordered by Cia, city, and shift)
  officers.sort((a, b) => {
    const idxA = getStaffSpreadsheetIndex(a);
    const idxB = getStaffSpreadsheetIndex(b);
    if (idxA !== 9999 && idxB !== 9999) return idxA - idxB;
    if (idxA !== 9999) return -1;
    if (idxB !== 9999) return 1;

    const rankA = RANK_PRIORITY[normalizeText(a.rank || '')] || 99;
    const rankB = RANK_PRIORITY[normalizeText(b.rank || '')] || 99;
    if (rankA !== rankB) return rankA - rankB;

    // Group CGPs by Sector/Local, then shift
    const localComp = (a.local || '').localeCompare(b.local || '', 'pt-BR');
    if (localComp !== 0) return localComp;

    return (a.shiftRaw || '').localeCompare(b.shiftRaw || '', 'pt-BR');
  });

  const usedDriverRes = new Set<string>();
  const result: StaffMember[] = [];

  // For each officer, find their assigned/matching driver(s)
  officers.forEach((officer) => {
    result.push(officer);

    const offShift = getShiftCategory(officer.shiftRaw);
    const isIntegral = offShift === 'INTEGRAL';

    // Find best matching unassigned drivers
    const matchingDrivers: { driver: StaffMember; score: number }[] = [];

    drivers.forEach((d) => {
      const dKey = normalizeRe(d.re) || normalizeText(d.name);
      if (usedDriverRes.has(dKey)) return;

      const score = calculateDriverAffinity(officer, d);
      if (score > 300) {
        matchingDrivers.push({ driver: d, score });
      }
    });

    // Sort matching drivers by score descending
    matchingDrivers.sort((a, b) => b.score - a.score);

    // Commanders/Coordop with full day (integral) can have 2 drivers (Manhã and Tarde).
    // CGP and shift-specific officers have exactly 1 driver matching their shift!
    const maxDrivers = isIntegral ? 2 : 1;
    const assignedForThisOfficer = matchingDrivers.slice(0, maxDrivers);
    assignedForThisOfficer.forEach(({ driver }) => {
      const dKey = normalizeRe(driver.re) || normalizeText(driver.name);
      usedDriverRes.add(dKey);
      result.push(driver);
    });
  });

  // Any remaining drivers or administrative support not paired with a specific officer
  // are added at the end
  drivers.forEach((d) => {
    const dKey = normalizeRe(d.re) || normalizeText(d.name);
    if (!usedDriverRes.has(dKey)) {
      result.push(d);
    }
  });

  return result;
}

// Canonical index in the operational spreadsheet
export function getStaffSpreadsheetIndex(member: StaffMember): number {
  if (!member) return 9999;
  const idx = INITIAL_STAFF.findIndex(
    (init) =>
      matchesExactRe(init.re, member.re) ||
      (member.name && normalizeText(init.name) === normalizeText(member.name))
  );
  return idx !== -1 ? idx : 9999;
}

// Fallback military rank order if someone is added outside INITIAL_STAFF
const RANK_PRIORITY: Record<string, number> = {
  'TEN CEL PM': 1,
  'MAJ PM': 2,
  'CAP PM': 3,
  '1º TEN PM': 4,
  '1 TEN PM': 4,
  '2º TEN PM': 5,
  '2 TEN PM': 5,
  'ASP PM': 6,
  'SUBTEN PM': 7,
  '1º SGT PM': 8,
  '1 SGT PM': 8,
  '2º SGT PM': 9,
  '2 SGT PM': 9,
  '3º SGT PM': 10,
  '3 SGT PM': 10,
  'CB PM': 11,
  'SD PM': 12
};

// Helper to classify if a function belongs to Drivers, Auxiliaries or Administrative Support
export function isSupportOrDriverRole(func?: string): boolean {
  if (!func) return false;
  const f = normalizeText(func);
  return (
    f.includes('MOTORISTA') ||
    f.includes('CONDUTOR') ||
    f.includes('MOT.') ||
    f.includes('AUXILIAR') ||
    f.includes('AUX.') ||
    f.includes('ADMINISTRAT') ||
    f.includes('APOIO')
  );
}

export const EmpenhoEfetivoTab: React.FC<EmpenhoEfetivoTabProps> = ({
  staffList,
  onSearchByRe,
  onOpenSheetsConfig
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'TODOS' | 'RONDA' | 'APOIO'>('TODOS');
  const [selectedLocal, setSelectedLocal] = useState<string>('TODOS');

  // Filter out synthetic MOT-* records and organize officers followed immediately by their matching driver(s)
  const cleanStaffList = useMemo(() => {
    const raw = (staffList || []).filter((item) => {
      if (!item || !item.re) return false;
      const reUpper = item.re.toUpperCase();
      if (reUpper.startsWith('MOT-') || reUpper.startsWith('N/D-')) return false;

      const normName = normalizeText(item.name || '');
      if (
        normName === 'COMANDANTE' ||
        normName === 'MOTORISTA COMANDANTE' ||
        normName === 'SUBCOMANDANTE' ||
        normName === 'MOTORISTA SUBCOMANDANTE' ||
        normName === 'COORDENADOR OPERACIONAL' ||
        normName === 'MOTORISTA COORDOP' ||
        normName === 'MOTORISTA DA VIATURA' ||
        normName === 'MOTORISTA' ||
        normName === 'POLICIAL MILITAR'
      ) {
        return false;
      }
      return true;
    });

    return organizeStaffWithDriverPairing(raw);
  }, [staffList]);

  // Available unique locals/sectors
  const availableLocals = useMemo(() => {
    const set = new Set<string>();
    cleanStaffList.forEach((s) => {
      if (s.local && s.local.trim()) {
        set.add(s.local.trim());
      }
    });
    const list = Array.from(set);
    list.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['TODOS', ...list];
  }, [cleanStaffList]);

  // Overall KPIs: Strict mutually exclusive sum (Rondas + Motoristas/Apoio = Total)
  const stats = useMemo(() => {
    const totalStaff = cleanStaffList.length;
    const withVtr = cleanStaffList.filter((s) => Boolean(s.vehicle && s.vehicle.trim())).length;

    // 1. Motoristas, Auxiliares e Apoio Administrativo
    const motoristas = cleanStaffList.filter((s) => isSupportOrDriverRole(s.function)).length;

    // 2. Rondas, Supervisão e Comando (Oficiais e CGPs) - Exclui estritamente qualquer motorista/apoio
    const rondaStaff = totalStaff - motoristas;

    // Unique vehicles set
    const uniqueVtrs = new Set<string>();
    cleanStaffList.forEach((s) => {
      if (s.vehicle && s.vehicle.trim()) {
        uniqueVtrs.add(normalizeText(s.vehicle));
      }
    });

    return {
      totalStaff,
      withVtr,
      rondaStaff,
      motoristas,
      totalVtrs: uniqueVtrs.size
    };
  }, [cleanStaffList]);

  // Filtered staff members
  const filteredStaff = useMemo(() => {
    return cleanStaffList.filter((item) => {
      // 1. Sector/Local Filter
      if (selectedLocal !== 'TODOS' && item.local?.trim() !== selectedLocal) {
        return false;
      }

      // 2. Mutually exclusive role filter:
      if (selectedFilter === 'RONDA') {
        // Only command, inspection, supervision and patrol (exclude drivers, auxiliaries and support)
        if (isSupportOrDriverRole(item.function)) {
          return false;
        }
      } else if (selectedFilter === 'APOIO') {
        // Only drivers, auxiliaries and administrative support
        if (!isSupportOrDriverRole(item.function)) {
          return false;
        }
      }

      // 3. Search Term
      if (searchTerm.trim()) {
        const q = normalizeText(searchTerm);
        const matchName = normalizeText(item.name).includes(q);
        const matchRe = normalizeText(item.re).includes(q);
        const matchRank = normalizeText(item.rank).includes(q);
        const matchFunc = normalizeText(item.function).includes(q);
        const matchLocal = normalizeText(item.local).includes(q);
        const matchVtr = normalizeText(item.vehicle || '').includes(q);
        if (!matchName && !matchRe && !matchRank && !matchFunc && !matchLocal && !matchVtr) {
          return false;
        }
      }

      return true;
    });
  }, [cleanStaffList, selectedFilter, selectedLocal, searchTerm]);

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
      {/* Top Banner / KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Efetivo Empenhado */}
        <div
          onClick={() => setSelectedFilter('TODOS')}
          className={`bg-white border rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs cursor-pointer transition select-none hover:border-slate-300 ${
            selectedFilter === 'TODOS'
              ? 'border-[#0F2B48] ring-2 ring-[#0F2B48]/20 bg-slate-50/50'
              : 'border-slate-200'
          }`}
          title="Clique para listar todo o efetivo empenhado"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Efetivo Empenhado
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#0F2B48] mt-1.5">
            {stats.totalStaff}
          </div>
          <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 block">
            Militares na planilha
          </span>
        </div>

        {/* Card 2: Viaturas Ativas */}
        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-700">
              Viaturas (VTRs)
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-1.5">
            {stats.totalVtrs}
          </div>
          <span className="text-[10px] sm:text-[11px] font-medium text-emerald-700 mt-0.5 block">
            {stats.withVtr} policiais com prefixo
          </span>
        </div>

        {/* Card 3: Rondas / Supervisão */}
        <div
          onClick={() => setSelectedFilter('RONDA')}
          className={`bg-white border rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs cursor-pointer transition select-none hover:border-purple-300 ${
            selectedFilter === 'RONDA'
              ? 'border-purple-600 ring-2 ring-purple-300 bg-purple-50/40'
              : 'border-slate-200'
          }`}
          title="Clique para filtrar apenas Rondas, Supervisão e Comandos"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-700">
              Rondas / Supervisão
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-900 mt-1.5">
            {stats.rondaStaff}
          </div>
          <span className="text-[10px] sm:text-[11px] font-medium text-purple-700 mt-0.5 block">
            Oficiais, Comandos e CGPs
          </span>
        </div>

        {/* Card 4: Motoristas, Auxiliares e Apoio Administrativo */}
        <div
          onClick={() => setSelectedFilter('APOIO')}
          className={`bg-white border rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs cursor-pointer transition select-none hover:border-amber-300 ${
            selectedFilter === 'APOIO'
              ? 'border-amber-600 ring-2 ring-amber-300 bg-amber-50/40'
              : 'border-slate-200'
          }`}
          title="Clique para filtrar apenas Motoristas, Auxiliares e Apoio Administrativo"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-700">
              Motoristas e Apoio
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-900 mt-1.5">
            {stats.motoristas}
          </div>
          <span className="text-[10px] sm:text-[11px] font-medium text-amber-700 mt-0.5 block">
            Motoristas, Auxiliares e Adm
          </span>
        </div>
      </div>

      {/* Main Filter and Search Controls */}
      <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por nome, RE, prefixo da VTR, função ou setor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sector / Local Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 shrink-0 hidden sm:inline">Setor:</span>
            <select
              value={selectedLocal}
              onChange={(e) => setSelectedLocal(e.target.value)}
              className="p-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer max-w-[200px]"
            >
              <option value="TODOS">Todos os Setores / Cias</option>
              {availableLocals.filter((l) => l !== 'TODOS').map((local) => (
                <option key={local} value={local}>
                  {local}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Buttons: Todos, Rondas & Supervisão, Motoristas/Auxiliares/Apoio */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pt-2 border-t border-slate-100">
          <button
            onClick={() => setSelectedFilter('TODOS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              selectedFilter === 'TODOS'
                ? 'bg-[#0F2B48] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todos ({stats.totalStaff})
          </button>

          <button
            onClick={() => setSelectedFilter('RONDA')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              selectedFilter === 'RONDA'
                ? 'bg-purple-700 text-white shadow-2xs ring-2 ring-purple-300'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Ronda / Supervisão ({stats.rondaStaff})</span>
          </button>

          <button
            onClick={() => setSelectedFilter('APOIO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              selectedFilter === 'APOIO'
                ? 'bg-amber-700 text-white shadow-2xs ring-2 ring-amber-300'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Motoristas e Apoio ({stats.motoristas})</span>
          </button>
        </div>
      </div>

      {/* Staff List Table (Desktop) / Cards (Mobile) */}
      <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Relação de Policiais do Empenho de Efetivo
                </h3>
                <span className="text-[11px] font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded-full">
                  {filteredStaff.length} {filteredStaff.length === 1 ? 'militar' : 'militares'}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">
                Organizado pela hierarquia oficial da planilha · Oficiais seguidos pelos seus motoristas designados
              </p>
            </div>
          </div>

          {onOpenSheetsConfig && (
            <button
              onClick={onOpenSheetsConfig}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Configurações da Planilha</span>
            </button>
          )}
        </div>

        {filteredStaff.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhum militar encontrado com os filtros selecionados.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Policial Militar</th>
                    <th className="py-2.5 px-3">Prefixo da VTR</th>
                    <th className="py-2.5 px-3">Função / Missão</th>
                    <th className="py-2.5 px-3">Setor / OPM</th>
                    <th className="py-2.5 px-3">Turno / Horário</th>
                    <th className="py-2.5 px-3">Contato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map((item, idx) => {
                    const isDriver = isSupportOrDriverRole(item.function);
                    return (
                      <tr
                        key={`staff-row-${item.re}-${idx}`}
                        className={`transition ${isDriver ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'hover:bg-slate-50/80'}`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-purple-900">
                                  {item.rank}
                                </span>
                                <span className="font-bold text-slate-900">
                                  {item.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {onSearchByRe ? (
                                  <button
                                    onClick={() => onSearchByRe(item.re)}
                                    className="font-mono text-[11px] text-blue-700 hover:underline font-bold cursor-pointer"
                                    title="Consultar perfil deste militar"
                                  >
                                    RE: {item.re}
                                  </button>
                                ) : (
                                  <span className="font-mono text-[11px] text-slate-500 font-bold">
                                    RE: {item.re}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* VTR Column */}
                        <td className="py-2.5 px-3">
                          {item.vehicle ? (
                            <span className="inline-flex items-center gap-1 font-mono font-black text-xs text-emerald-950 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md shadow-2xs">
                              <Car className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              <span>{item.vehicle}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-medium">—</span>
                          )}
                        </td>

                        {/* Function Column */}
                        <td className="py-2.5 px-3">
                          {isDriver ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-amber-900 bg-amber-100/70 border border-amber-300 px-2 py-0.5 rounded-md text-[11px]">
                              <Car className="w-3 h-3 text-amber-700 shrink-0" />
                              <span>{item.function || 'Motorista'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-bold text-purple-900 bg-purple-100/60 border border-purple-200 px-2 py-0.5 rounded-md text-[11px]">
                              <Shield className="w-3 h-3 text-purple-700 shrink-0" />
                              <span>{item.function || 'Ronda / Supervisão'}</span>
                            </span>
                          )}
                        </td>

                        {/* Local Column */}
                        <td className="py-2.5 px-3">
                          <span className="text-slate-700 font-medium">
                            {item.local || item.unit || '40º BPM/I'}
                          </span>
                        </td>

                        {/* Shift Column */}
                        <td className="py-2.5 px-3">
                          <span className="text-slate-600 font-medium text-[11px]">
                            {item.shiftRaw || 'Turno da Operação'}
                          </span>
                        </td>

                        {/* Phone Column */}
                        <td className="py-2.5 px-3">
                          {item.phone ? (
                            <a
                              href={`tel:${item.phone}`}
                              className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                            >
                              <Phone className="w-3 h-3 text-blue-600" />
                              <span>{item.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Não informado</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredStaff.map((item, idx) => {
                const isDriver = isSupportOrDriverRole(item.function);
                return (
                  <div
                    key={`staff-mobile-${item.re}-${idx}`}
                    className={`p-3.5 space-y-2 transition ${isDriver ? 'bg-amber-50/20' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold uppercase text-purple-800 tracking-wider">
                          {item.rank}
                        </span>
                        <div className="font-extrabold text-slate-900 text-xs leading-snug">
                          {item.name}
                        </div>
                        <div className="text-[11px] font-mono text-blue-700 font-bold mt-0.5">
                          RE: {item.re}
                        </div>
                      </div>

                      {item.vehicle && (
                        <div className="shrink-0">
                          <span className="inline-flex items-center gap-1 font-mono font-black text-xs text-emerald-950 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md shadow-2xs">
                            <Car className="w-3 h-3 text-emerald-700" />
                            <span>{item.vehicle}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-[9.5px] font-bold uppercase text-slate-400 block mb-0.5">
                          Função
                        </span>
                        {isDriver ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100/70 border border-amber-300 px-1.5 py-0.5 rounded text-[10px]">
                            <Car className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                            <span className="truncate">{item.function || 'Motorista'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-purple-900 bg-purple-100/60 border border-purple-200 px-1.5 py-0.5 rounded text-[10px]">
                            <Shield className="w-2.5 h-2.5 text-purple-700 shrink-0" />
                            <span className="truncate">{item.function || 'Ronda'}</span>
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[9.5px] font-bold uppercase text-slate-400 block mb-0.5">
                          Setor / Local
                        </span>
                        <span className="font-medium text-slate-700 block truncate text-xs">
                          {item.local || item.unit || '40º BPM/I'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-[10.5px] text-slate-500 font-medium">
                        {item.shiftRaw}
                      </span>
                      {item.phone && (
                        <a
                          href={`tel:${item.phone}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{item.phone}</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
