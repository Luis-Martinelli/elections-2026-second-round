import React, { useState, useMemo, useEffect } from 'react';
import {
  Radio,
  Download,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Filter,
  Search,
  Trash2,
  User,
  Users,
  Clock,
  ShieldCheck,
  X,
  Building2,
  Award,
  Car,
  Sun,
  Moon,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink
} from 'lucide-react';
import { SchoolItem, RondaRecord, StaffMember } from '../types';
import { normalizeText, matchesExactRe } from '../utils/normalize';
import { normalizeCityName } from '../utils/municipality';
import { RondaReportPdfModal } from './RondaReportPdfModal';
import { getGoogleMapsNavigationUrl, getSchoolDisplayAddress } from '../utils/geo';

export function getSaoPauloHour(date: Date = new Date()): number {
  try {
    const str = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false
    }).format(date);
    const parsed = parseInt(str, 10);
    return isNaN(parsed) ? date.getHours() : parsed;
  } catch {
    return date.getHours();
  }
}

export function getRondaShift(ronda: RondaRecord): 'Manhã' | 'Tarde' {
  if (ronda.shift === 'Manhã' || ronda.shift === 'Tarde') {
    return ronda.shift;
  }
  // 1. Priority: check recorded local Brazilian time string e.g. "04/10/2026 - 10:15:22" or "10:15"
  if (ronda.time) {
    const timePortion = ronda.time.includes('-') ? ronda.time.split('-')[1]?.trim() : ronda.time;
    const parts = (timePortion || '').split(':');
    const h = parseInt(parts[0], 10);
    if (!isNaN(h)) {
      return h >= 13 ? 'Tarde' : 'Manhã';
    }
  }
  // 2. Fallback: check timestamp using America/Sao_Paulo timezone
  if (typeof ronda.timestamp === 'number' && ronda.timestamp > 0) {
    const h = getSaoPauloHour(new Date(ronda.timestamp));
    return h >= 13 ? 'Tarde' : 'Manhã';
  }
  return 'Manhã';
}

interface SectorRondasTabProps {
  sectorSchools: SchoolItem[];
  rondasMade: RondaRecord[];
  allRondas?: RondaRecord[];
  staffList?: StaffMember[];
  onOpenRondaWithSchool: (schoolId: string) => void;
  onOpenGeneralRonda: () => void;
  onDeleteRonda?: (rondaId: string, info: string) => Promise<void>;
  officerRank: string;
  officerName: string;
  officerRe: string;
  officerStaff?: StaffMember;
  sectorName: string;
  isSupervisorView?: boolean;
}

export const SectorRondasTab: React.FC<SectorRondasTabProps> = ({
  sectorSchools,
  rondasMade,
  allRondas = [],
  staffList = [],
  onOpenRondaWithSchool,
  onOpenGeneralRonda,
  onDeleteRonda,
  officerRank,
  officerName,
  officerRe,
  officerStaff,
  sectorName,
  isSupervisorView = false
}) => {
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedOfficerFilter, setSelectedOfficerFilter] = useState<string>('TODOS');
  const [officerSearchTerm, setOfficerSearchTerm] = useState<string>('');
  const [deletingRondaId, setDeletingRondaId] = useState<string | null>(null);
  const [confirmDeleteRonda, setConfirmDeleteRonda] = useState<RondaRecord | null>(null);

  // Shift Filter: Auto-defaults to 'TARDE' when current local time in São Paulo is 13h or later
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<'TARDE' | 'MANHA' | 'TODOS'>(() => {
    const currentHour = getSaoPauloHour();
    return currentHour >= 13 ? 'TARDE' : 'MANHA';
  });
  const [activeSchoolListTab, setActiveSchoolListTab] = useState<'pending' | 'completed' | 'all'>(
    isSupervisorView ? 'pending' : 'all'
  );
  const [historyShiftFilter, setHistoryShiftFilter] = useState<'ACTIVE_SHIFT' | 'ALL'>('ACTIVE_SHIFT');
  const [viewingOfficerDetail, setViewingOfficerDetail] = useState<{
    officerKey: string;
    rank: string;
    name: string;
    re: string;
    vehicle?: string;
  } | null>(null);
  const [officerModalShiftScope, setOfficerModalShiftScope] = useState<'SHIFT' | 'ALL'>('SHIFT');
  const [isOfficerPdfOpen, setIsOfficerPdfOpen] = useState<boolean>(false);

  const handlePromptDeleteRonda = (record: RondaRecord) => {
    if (!onDeleteRonda) return;
    setConfirmDeleteRonda(record);
  };

  const handleConfirmDeleteRonda = async () => {
    if (!confirmDeleteRonda || !onDeleteRonda) return;
    const record = confirmDeleteRonda;
    const desc = `${record.schoolName} (${record.city}) - ${record.time}`;
    try {
      setDeletingRondaId(record.id);
      await onDeleteRonda(record.id, desc);
      setConfirmDeleteRonda(null);
    } finally {
      setDeletingRondaId(null);
    }
  };

  // Combined pool of rondas for this sector (ensures full sector history is never hidden)
  const relevantRondas = useMemo(() => {
    return allRondas && allRondas.length > 0 ? allRondas : rondasMade;
  }, [allRondas, rondasMade]);

  // Vistorias de ronda realizadas especificamente por este policial individual
  const myIndividualRondas = useMemo(() => {
    return relevantRondas.filter((r) => {
      if (officerRe && matchesExactRe(r.officerRe, officerRe)) return true;
      if (officerName && normalizeText(r.officerName) === normalizeText(officerName)) return true;
      return false;
    });
  }, [relevantRondas, officerRe, officerName]);

  // Postos escolares já vistoriados por este policial
  const myVisitedSchoolNames = useMemo(() => {
    const set = new Set<string>();
    myIndividualRondas.forEach((r) => {
      if (r.schoolName) set.add(normalizeText(r.schoolName));
    });
    return set;
  }, [myIndividualRondas]);

  // Index rondas by normalized school name
  const schoolRondasMap = useMemo(() => {
    const map = new Map<string, RondaRecord[]>();
    relevantRondas.forEach((r) => {
      if (!r.schoolName) return;
      const norm = normalizeText(r.schoolName);
      if (!map.has(norm)) {
        map.set(norm, []);
      }
      map.get(norm)!.push(r);
    });
    // Sort descending by timestamp / time
    map.forEach((list) => {
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    });
    return map;
  }, [relevantRondas]);

  const getSchoolRondas = (schoolName: string): RondaRecord[] => {
    const norm = normalizeText(schoolName);
    if (schoolRondasMap.has(norm)) return schoolRondasMap.get(norm)!;
    for (const [key, list] of schoolRondasMap.entries()) {
      if (key.includes(norm) || norm.includes(key)) {
        return list;
      }
    }
    return [];
  };

  // Helper to find school object by name
  const findSchoolForRonda = (schoolName: string): SchoolItem | undefined => {
    const normTarget = normalizeText(schoolName);
    return (
      sectorSchools.find((s) => normalizeText(s.school) === normTarget) ||
      sectorSchools.find((s) => {
        const sNorm = normalizeText(s.school);
        return sNorm.includes(normTarget) || normTarget.includes(sNorm);
      })
    );
  };

  // Statistics partitioned by operational shift (Manhã vs Tarde)
  const shiftStats = useMemo(() => {
    let morningRondasCount = 0;
    let afternoonRondasCount = 0;

    relevantRondas.forEach((r) => {
      if (getRondaShift(r) === 'Tarde') {
        afternoonRondasCount += 1;
      } else {
        morningRondasCount += 1;
      }
    });

    let morningVisitedSchools = 0;
    let afternoonVisitedSchools = 0;
    let allVisitedSchools = 0;

    sectorSchools.forEach((s) => {
      const rondas = getSchoolRondas(s.school);
      const hasMorning = rondas.some((r) => getRondaShift(r) === 'Manhã');
      const hasAfternoon = rondas.some((r) => getRondaShift(r) === 'Tarde');
      if (hasMorning) morningVisitedSchools += 1;
      if (hasAfternoon) afternoonVisitedSchools += 1;
      if (rondas.length > 0) allVisitedSchools += 1;
    });

    return {
      morningRondasCount,
      afternoonRondasCount,
      totalRondasCount: relevantRondas.length,
      morningVisitedSchools,
      afternoonVisitedSchools,
      allVisitedSchools,
      totalSectorSchools: sectorSchools.length,
      morningPendingSchools: Math.max(0, sectorSchools.length - morningVisitedSchools),
      afternoonPendingSchools: Math.max(0, sectorSchools.length - afternoonVisitedSchools),
      allPendingSchools: Math.max(0, sectorSchools.length - allVisitedSchools)
    };
  }, [relevantRondas, sectorSchools, schoolRondasMap]);

  // Set of normalized school names that have already received at least one ronda in the selected shift
  const rondadasSchoolNames = useMemo(() => {
    const set = new Set<string>();
    relevantRondas.forEach((r) => {
      if (!r.schoolName) return;
      const shift = getRondaShift(r);
      if (selectedShiftFilter === 'TARDE' && shift !== 'Tarde') return;
      if (selectedShiftFilter === 'MANHA' && shift !== 'Manhã') return;
      set.add(normalizeText(r.schoolName));
    });
    return set;
  }, [relevantRondas, selectedShiftFilter]);

  // Split sectorSchools into Rondadas and Não Rondadas relative to the active shift
  const { rondadasSchools, naoRondadasSchools } = useMemo(() => {
    const rondadas: SchoolItem[] = [];
    const naoRondadas: SchoolItem[] = [];

    sectorSchools.forEach((school) => {
      const sRondas = getSchoolRondas(school.school);
      let isDoneInShift = false;
      if (selectedShiftFilter === 'TARDE') {
        isDoneInShift = sRondas.some((r) => getRondaShift(r) === 'Tarde');
      } else if (selectedShiftFilter === 'MANHA') {
        isDoneInShift = sRondas.some((r) => getRondaShift(r) === 'Manhã');
      } else {
        isDoneInShift = sRondas.length > 0;
      }

      if (isDoneInShift) {
        rondadas.push(school);
      } else {
        naoRondadas.push(school);
      }
    });

    return { rondadasSchools: rondadas, naoRondadasSchools: naoRondadas };
  }, [sectorSchools, selectedShiftFilter, schoolRondasMap]);

  // Extract available cities strictly from the officer's sector schools
  const cities = useMemo(() => {
    const raw = sectorSchools
      .map((s) => normalizeCityName(s.city?.trim()))
      .filter((c): c is string => Boolean(c && c.length > 1));
    const unique = Array.from(new Set(raw));
    unique.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['TODOS', ...unique];
  }, [sectorSchools]);

  // Reset selectedCity if it's not present in the sector's available cities
  useEffect(() => {
    if (selectedCity !== 'TODOS' && !cities.includes(selectedCity)) {
      setSelectedCity('TODOS');
    }
  }, [cities, selectedCity]);

  // Accounting / Stats by Officer (Rondante) strictly for the active shift
  const officerStats = useMemo(() => {
    const map = new Map<
      string,
      {
        officerKey: string;
        rank: string;
        name: string;
        re: string;
        vehicle?: string;
        count: number;
        morningCount: number;
        afternoonCount: number;
        totalDayCount: number;
        schools: Set<string>;
        daySchools: Set<string>;
        lastTime: string;
        lastTimestamp: number;
      }
    >();

    relevantRondas.forEach((r) => {
      const re = (r.officerRe || '').trim() || 'SEM-RE';
      const name = (r.officerName || '').trim() || 'Não Identificado';
      const rank = (r.rank || '').trim() || 'PM';
      const key = `${re}_${name}`;

      const matchedStaff = staffList?.find(
        (m) => matchesExactRe(m.re, re) || (name && normalizeText(m.name) === normalizeText(name))
      );
      const vehicle = matchedStaff?.vehicle || '';

      if (!map.has(key)) {
        map.set(key, {
          officerKey: key,
          rank,
          name,
          re,
          vehicle,
          count: 0,
          morningCount: 0,
          afternoonCount: 0,
          totalDayCount: 0,
          schools: new Set(),
          daySchools: new Set(),
          lastTime: r.time,
          lastTimestamp: r.timestamp || 0
        });
      }

      const item = map.get(key)!;
      if (!item.vehicle && vehicle) {
        item.vehicle = vehicle;
      }

      const shift = getRondaShift(r);
      item.totalDayCount += 1;
      if (r.schoolName) item.daySchools.add(r.schoolName);

      if (shift === 'Manhã') {
        item.morningCount += 1;
      } else {
        item.afternoonCount += 1;
      }

      // Check if this ronda matches active shift filter
      const matchesShift =
        selectedShiftFilter === 'TODOS' ||
        (selectedShiftFilter === 'TARDE' && shift === 'Tarde') ||
        (selectedShiftFilter === 'MANHA' && shift === 'Manhã');

      if (matchesShift) {
        item.count += 1;
        if (r.schoolName) item.schools.add(r.schoolName);
        if ((r.timestamp || 0) >= item.lastTimestamp) {
          item.lastTime = r.time;
          item.lastTimestamp = r.timestamp || 0;
        }
      }
    });

    let list = Array.from(map.values());
    if (selectedShiftFilter !== 'TODOS') {
      list = list.filter((o) => o.count > 0);
    }

    // Sort descending by number of rondas (shift count, then day count)
    list.sort((a, b) => b.count - a.count || b.totalDayCount - a.totalDayCount);
    return list;
  }, [relevantRondas, selectedShiftFilter, staffList]);

  // Reset selectedOfficerFilter if the selected officer is not in the active shift stats
  useEffect(() => {
    if (selectedOfficerFilter !== 'TODOS') {
      const exists = officerStats.some((o) => o.officerKey === selectedOfficerFilter);
      if (!exists) {
        setSelectedOfficerFilter('TODOS');
      }
    }
  }, [officerStats, selectedOfficerFilter]);

  // Filtered officer stats based on search term
  const filteredOfficerStats = useMemo(() => {
    if (!officerSearchTerm.trim()) return officerStats;
    const q = normalizeText(officerSearchTerm);
    return officerStats.filter(
      (o) =>
        normalizeText(o.name).includes(q) ||
        normalizeText(o.re).includes(q) ||
        normalizeText(o.rank).includes(q)
    );
  }, [officerStats, officerSearchTerm]);

  // Currently selected officer object
  const activeOfficerStat = useMemo(() => {
    if (selectedOfficerFilter === 'TODOS') return null;
    return officerStats.find((o) => o.officerKey === selectedOfficerFilter) || null;
  }, [officerStats, selectedOfficerFilter]);

  // Rondas performed specifically by the officer being inspected in the modal
  const selectedOfficerRondas = useMemo(() => {
    if (!viewingOfficerDetail) return [];
    const targetRe = (viewingOfficerDetail.re || '').trim();
    const targetName = (viewingOfficerDetail.name || '').trim();

    return relevantRondas
      .filter((r) => {
        const rRe = (r.officerRe || '').trim();
        const rName = (r.officerName || '').trim();
        const matchRe = targetRe && rRe && matchesExactRe(targetRe, rRe);
        const matchName = targetName && rName && normalizeText(targetName) === normalizeText(rName);
        if (!matchRe && !matchName) return false;

        if (officerModalShiftScope === 'SHIFT' && selectedShiftFilter !== 'TODOS') {
          const shift = getRondaShift(r);
          if (selectedShiftFilter === 'TARDE' && shift !== 'Tarde') return false;
          if (selectedShiftFilter === 'MANHA' && shift !== 'Manhã') return false;
        }

        return true;
      })
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [viewingOfficerDetail, relevantRondas, officerModalShiftScope, selectedShiftFilter]);

  // Matched staff record for the officer being inspected
  const matchedOfficerStaff = useMemo(() => {
    if (!viewingOfficerDetail) return undefined;
    return (
      staffList?.find(
        (m) =>
          matchesExactRe(m.re, viewingOfficerDetail.re) ||
          (viewingOfficerDetail.name && normalizeText(m.name) === normalizeText(viewingOfficerDetail.name))
      ) || undefined
    );
  }, [viewingOfficerDetail, staffList]);

  // Filtered rondas list by selected officer filter, city, search, and shift
  const filteredRondas = useMemo(() => {
    return relevantRondas.filter((r) => {
      // 0. Shift Filter in History if active
      if (historyShiftFilter === 'ACTIVE_SHIFT' && selectedShiftFilter !== 'TODOS') {
        const shift = getRondaShift(r);
        if (selectedShiftFilter === 'TARDE' && shift !== 'Tarde') return false;
        if (selectedShiftFilter === 'MANHA' && shift !== 'Manhã') return false;
      }

      // 1. Officer Filter
      if (selectedOfficerFilter !== 'TODOS') {
        const re = (r.officerRe || '').trim() || 'SEM-RE';
        const name = (r.officerName || '').trim() || 'Não Identificado';
        const key = `${re}_${name}`;
        if (key !== selectedOfficerFilter) return false;
      }

      // 2. City Filter
      if (selectedCity !== 'TODOS') {
        const selectedNorm = normalizeCityName(selectedCity);
        const rondaCityNorm = normalizeCityName(r.city);
        if (selectedNorm !== rondaCityNorm) return false;
      }

      // 3. Search Term
      if (searchTerm.trim()) {
        const q = normalizeText(searchTerm);
        const matchSchool = normalizeText(r.schoolName || '').includes(q);
        const matchCity = normalizeCityName(r.city || '').includes(q);
        const matchOfficer = normalizeText(r.officerName || '').includes(q);
        const matchRe = normalizeText(r.officerRe || '').includes(q);
        const matchObs = normalizeText(r.obs || '').includes(q);
        if (!matchSchool && !matchCity && !matchOfficer && !matchRe && !matchObs) return false;
      }

      return true;
    });
  }, [relevantRondas, historyShiftFilter, selectedShiftFilter, selectedOfficerFilter, selectedCity, searchTerm]);

  // Filtered pending schools in the active shift
  const filteredPendingSchools = useMemo(() => {
    return naoRondadasSchools.filter((school) => {
      if (selectedCity !== 'TODOS') {
        const selectedNorm = normalizeCityName(selectedCity);
        const schoolNorm = normalizeCityName(school.city);
        if (selectedNorm !== schoolNorm) {
          return false;
        }
      }
      if (searchTerm.trim()) {
        const query = normalizeText(searchTerm);
        const nameMatch = normalizeText(school.school).includes(query);
        const cityMatch = normalizeCityName(school.city).includes(query);
        const bairroMatch = normalizeText(school.bairro || '').includes(query);
        if (!nameMatch && !cityMatch && !bairroMatch) return false;
      }
      return true;
    });
  }, [naoRondadasSchools, selectedCity, searchTerm]);

  // Filtered completed schools in the active shift
  const filteredCompletedSchools = useMemo(() => {
    return rondadasSchools.filter((school) => {
      if (selectedCity !== 'TODOS') {
        const selectedNorm = normalizeCityName(selectedCity);
        const schoolNorm = normalizeCityName(school.city);
        if (selectedNorm !== schoolNorm) return false;
      }
      if (searchTerm.trim()) {
        const query = normalizeText(searchTerm);
        const nameMatch = normalizeText(school.school).includes(query);
        const cityMatch = normalizeCityName(school.city).includes(query);
        const bairroMatch = normalizeText(school.bairro || '').includes(query);
        if (!nameMatch && !cityMatch && !bairroMatch) return false;
      }
      return true;
    });
  }, [rondadasSchools, selectedCity, searchTerm]);

  // Filtered all schools in the sector
  const filteredAllSchools = useMemo(() => {
    return sectorSchools.filter((school) => {
      if (selectedCity !== 'TODOS') {
        const selectedNorm = normalizeCityName(selectedCity);
        const schoolNorm = normalizeCityName(school.city);
        if (selectedNorm !== schoolNorm) return false;
      }
      if (searchTerm.trim()) {
        const query = normalizeText(searchTerm);
        const nameMatch = normalizeText(school.school).includes(query);
        const cityMatch = normalizeCityName(school.city).includes(query);
        const bairroMatch = normalizeText(school.bairro || '').includes(query);
        if (!nameMatch && !cityMatch && !bairroMatch) return false;
      }
      return true;
    });
  }, [sectorSchools, selectedCity, searchTerm]);

  // Escolas vistoriadas especificamente por este policial individual
  const filteredMyVisitedSchools = useMemo(() => {
    return sectorSchools.filter((school) => {
      const isMyVisit = myVisitedSchoolNames.has(normalizeText(school.school));
      if (!isMyVisit) return false;
      if (selectedCity !== 'TODOS') {
        const selectedNorm = normalizeCityName(selectedCity);
        const schoolNorm = normalizeCityName(school.city);
        if (selectedNorm !== schoolNorm) return false;
      }
      if (searchTerm.trim()) {
        const query = normalizeText(searchTerm);
        const nameMatch = normalizeText(school.school).includes(query);
        const cityMatch = normalizeCityName(school.city).includes(query);
        const bairroMatch = normalizeText(school.bairro || '').includes(query);
        if (!nameMatch && !cityMatch && !bairroMatch) return false;
      }
      return true;
    });
  }, [sectorSchools, myVisitedSchoolNames, selectedCity, searchTerm]);

  // Vistorias realizadas individualmente por este policial para o histórico
  const filteredMyRondas = useMemo(() => {
    return myIndividualRondas.filter((r) => {
      if (selectedCity !== 'TODOS') {
        const selectedNorm = normalizeCityName(selectedCity);
        const rondaCityNorm = normalizeCityName(r.city);
        if (selectedNorm !== rondaCityNorm) return false;
      }
      if (searchTerm.trim()) {
        const q = normalizeText(searchTerm);
        const matchSchool = normalizeText(r.schoolName || '').includes(q);
        const matchCity = normalizeCityName(r.city || '').includes(q);
        const matchObs = normalizeText(r.obs || '').includes(q);
        if (!matchSchool && !matchCity && !matchObs) return false;
      }
      return true;
    });
  }, [myIndividualRondas, selectedCity, searchTerm]);

  // Helper to extract both shift statuses for any school
  const getSchoolShiftStatus = (school: SchoolItem) => {
    const sRondas = getSchoolRondas(school.school);
    const morningRonda = sRondas.find((r) => getRondaShift(r) === 'Manhã');
    const afternoonRonda = sRondas.find((r) => getRondaShift(r) === 'Tarde');
    const isDoneInActiveShift =
      selectedShiftFilter === 'TARDE'
        ? Boolean(afternoonRonda)
        : selectedShiftFilter === 'MANHA'
        ? Boolean(morningRonda)
        : sRondas.length > 0;

    return {
      sRondas,
      morningRonda,
      afternoonRonda,
      isDoneInActiveShift,
      totalCount: sRondas.length
    };
  };

  return (
    <div className="flex flex-col gap-4 w-full min-w-0">
      {/* TOP BANNER: Contabilidade Geral de Rondas (Apenas na Supervisão da P/3 - Na tela do rondante não duplica) */}
      {isSupervisorView && (
        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="px-3.5 py-2 bg-purple-100/80 rounded-xl border border-purple-200 text-purple-950 text-xs font-extrabold flex items-center gap-2 shadow-2xs">
              <Radio className="w-4 h-4 text-purple-700 animate-pulse" />
              <span>
                Total de Vistorias de Ronda:{' '}
                <strong className="text-sm font-black text-purple-900">{relevantRondas.length}</strong>
              </span>
            </div>

            <div className="px-3.5 py-2 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
              <Users className="w-4 h-4 text-blue-700" />
              <span>
                Rondantes Ativos: <strong className="text-sm font-black text-blue-900">{officerStats.length}</strong>
              </span>
            </div>

            <div className="px-3.5 py-2 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                Escolas Atendidas: <strong className="text-sm font-black text-emerald-900">{rondadasSchoolNames.size}</strong>/{sectorSchools.length}
              </span>
            </div>

            {naoRondadasSchools.length > 0 && (
              <div className="px-3 py-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  Ainda Sem Ronda: <strong className="font-black">{naoRondadasSchools.length}</strong>
                </span>
              </div>
            )}

            {officerStaff?.vehicle && (
              <div className="px-3.5 py-2 bg-emerald-50 rounded-xl border border-emerald-300 text-emerald-950 text-xs font-black flex items-center gap-1.5 shadow-2xs font-mono">
                <Car className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>VTR: {officerStaff.vehicle}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              id="btn-gerar-relatorio-pdf"
              onClick={() => setIsPdfModalOpen(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer min-h-[38px] flex-1 sm:flex-initial"
              title="Baixar relatório oficial de rondas"
            >
              <Download className="w-4 h-4 text-blue-300" />
              <span>Baixar Relatório de Rondas</span>
            </button>
          </div>
        </div>
      )}

      {/* SELETOR OPERACIONAL DE TURNO (Exclusivo para a visão de supervisão da P/3 - Removido da tela do rondante) */}
      {isSupervisorView && (
        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-xs flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Clock className="w-4 h-4 text-purple-700 shrink-0" />
              <span className="text-xs font-extrabold text-slate-800">Turno Operacional:</span>
              <select
                value={selectedShiftFilter}
                onChange={(e) => setSelectedShiftFilter(e.target.value as 'TARDE' | 'MANHA' | 'TODOS')}
                className="py-1.5 px-3 text-xs font-bold text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer shadow-2xs"
              >
                <option value="MANHA">
                  Turno Manhã (06h às 13h){getSaoPauloHour() < 13 ? ' · Turno Atual' : ''}
                </option>
                <option value="TARDE">
                  Turno Tarde (13h ao Término){getSaoPauloHour() >= 13 ? ' · Turno Atual' : ''}
                </option>
                <option value="TODOS">
                  Todos os Turnos (Dia Completo)
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 flex-wrap">
              <span className="bg-purple-50 text-purple-900 border border-purple-200 px-2.5 py-1 rounded-lg">
                Postos Atendidos:{' '}
                <strong className="text-purple-950 font-black">
                  {selectedShiftFilter === 'MANHA'
                    ? shiftStats.morningVisitedSchools
                    : selectedShiftFilter === 'TARDE'
                    ? shiftStats.afternoonVisitedSchools
                    : shiftStats.allVisitedSchools}
                </strong>/{sectorSchools.length}
              </span>
              <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg font-mono">
                {selectedShiftFilter === 'MANHA'
                  ? shiftStats.morningRondasCount
                  : selectedShiftFilter === 'TARDE'
                  ? shiftStats.afternoonRondasCount
                  : relevantRondas.length} rondas
              </span>
            </div>
          </div>

          {/* Informative Guidance Banner for Patrol Officers */}
          <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            selectedShiftFilter === 'TARDE'
              ? 'bg-purple-50 border-purple-200 text-purple-950'
              : selectedShiftFilter === 'MANHA'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-blue-50 border-blue-200 text-blue-950'
          }`}>
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-purple-700 shrink-0" />
              <span className="text-[11.5px] leading-relaxed">
                {selectedShiftFilter === 'TARDE' ? (
                  <>
                    <strong>Modo Turno da Tarde Ativo:</strong> As escolas marcadas como pendentes abaixo são aquelas que <strong>ainda não foram fiscalizadas à tarde (após as 13h)</strong>, mesmo que já tenham recebido ronda pela manhã. Isso garante que todos os postos sejam inspecionados pela equipe da tarde.
                  </>
                ) : selectedShiftFilter === 'MANHA' ? (
                  <>
                    <strong>Modo Turno da Manhã Ativo:</strong> Exibindo o panorama e as escolas atendidas durante o 1º turno (06h às 13h).
                  </>
                ) : (
                  <>
                    <strong>Visão Geral Consolidada:</strong> Exibindo todas as vistorias de ronda realizadas em ambos os turnos do dia.
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* NOVO PAINEL: Contabilidade de Rondas por Policial / Rondante (Somente na Área Restrita P/3) */}
      {isSupervisorView && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col gap-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4 text-purple-700" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
                    <span>Contabilidade de Rondas por Rondante</span>
                    <span className="text-[11px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                      {officerStats.length} {officerStats.length === 1 ? 'policial' : 'policiais'}
                    </span>
                    {selectedShiftFilter !== 'TODOS' && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-200">
                        Turno {selectedShiftFilter === 'TARDE' ? 'Tarde' : 'Manhã'}
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Consulte em segundos quantas rondas cada oficial ou graduado realizou {selectedShiftFilter === 'TARDE' ? 'no Turno da Tarde' : selectedShiftFilter === 'MANHA' ? 'no Turno da Manhã' : 'no dia'}
                  </p>
                </div>
              </div>

              {/* Quick Officer Filter Select */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                  <select
                    value={selectedOfficerFilter}
                    onChange={(e) => setSelectedOfficerFilter(e.target.value)}
                    className="p-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer max-w-[260px]"
                  >
                    <option value="TODOS">
                      Todos os Rondantes ({selectedShiftFilter === 'TARDE' ? shiftStats.afternoonRondasCount : selectedShiftFilter === 'MANHA' ? shiftStats.morningRondasCount : relevantRondas.length} rondas)
                    </option>
                    {officerStats.map((off) => (
                      <option key={off.officerKey} value={off.officerKey}>
                        {off.rank} {off.name} (RE {off.re}) · {off.count} {off.count === 1 ? 'ronda' : 'rondas'}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedOfficerFilter !== 'TODOS' && (
                  <button
                    onClick={() => setSelectedOfficerFilter('TODOS')}
                    className="px-2 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 flex items-center gap-1 cursor-pointer transition"
                    title="Limpar filtro de policial"
                  >
                    <X className="w-3 h-3" />
                    <span>Ver Todos</span>
                  </button>
                )}
              </div>
            </div>

            {/* Officer Search Filter if many officers */}
            {officerStats.length > 4 && (
              <div className="relative max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por nome, posto ou RE do policial..."
                  value={officerSearchTerm}
                  onChange={(e) => setOfficerSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                />
              </div>
            )}

            {/* Grid of Officer Summary Cards */}
            {officerStats.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-1.5">
                <Users className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-slate-700">
                  {selectedShiftFilter === 'TARDE'
                    ? 'Nenhum policial registrou vistoria no Turno da Tarde até o momento.'
                    : selectedShiftFilter === 'MANHA'
                    ? 'Nenhum policial registrou vistoria no Turno da Manhã até o momento.'
                    : 'Nenhuma vistoria de ronda registrada até o momento.'}
                </span>
                {selectedShiftFilter === 'TARDE' && shiftStats.morningRondasCount > 0 && (
                  <span className="text-[11px] text-slate-400">
                    (Os policiais que rondaram pela manhã podem ser visualizados selecionando a aba "Turno da Manhã" ou "Ambos os Turnos" acima)
                  </span>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredOfficerStats.map((off) => {
                  return (
                    <div
                      key={off.officerKey}
                      onClick={() => {
                        setViewingOfficerDetail({
                          officerKey: off.officerKey,
                          rank: off.rank,
                          name: off.name,
                          re: off.re,
                          vehicle: off.vehicle
                        });
                        setOfficerModalShiftScope('ALL');
                      }}
                      className="p-3 sm:p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2.5 bg-slate-50/80 hover:bg-white hover:border-purple-400 hover:ring-2 hover:ring-purple-500/20 hover:shadow-md shadow-2xs group"
                      title={`Clique para abrir a lista completa de ${off.totalDayCount} vistorias de ${off.rank} ${off.name}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-extrabold uppercase text-purple-800 tracking-wider">
                            {off.rank}
                          </div>
                          <div
                            className="font-extrabold text-slate-900 text-xs sm:text-[13px] leading-snug truncate group-hover:text-purple-950 transition"
                            title={off.name}
                          >
                            {off.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>RE: {off.re || '—'}</span>
                            {off.vehicle && (
                              <span className="text-[10px] font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded-md inline-flex items-center gap-0.5 shadow-2xs font-mono">
                                <Car className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                                <span>VTR: {off.vehicle}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-purple-700 group-hover:bg-purple-800 text-white font-black text-xs shadow-2xs transition">
                            {selectedShiftFilter !== 'TODOS' && off.totalDayCount > off.count
                              ? `${off.count} ${off.count === 1 ? 'ronda' : 'rondas'} (${selectedShiftFilter === 'TARDE' ? 'Tarde' : 'Manhã'})`
                              : `${off.totalDayCount} ${off.totalDayCount === 1 ? 'ronda' : 'rondas'}`}
                          </span>
                          {off.totalDayCount > off.count && (
                            <span className="text-[9.5px] font-black text-purple-900 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded-md">
                              Total: {off.totalDayCount} no dia ({off.morningCount}M / {off.afternoonCount}T)
                            </span>
                          )}
                          {selectedShiftFilter === 'TODOS' && off.morningCount > 0 && off.afternoonCount > 0 && (
                            <span className="text-[10px] font-extrabold text-slate-500">
                              {off.morningCount} Manhã · {off.afternoonCount} Tarde
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60 font-medium">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>
                            {off.schools.size} {off.schools.size === 1 ? 'posto' : 'postos'}
                            {off.daySchools.size > off.schools.size && ` (${off.daySchools.size} no dia)`}
                          </span>
                        </span>
                        <span className="flex items-center gap-1 text-purple-700 font-extrabold group-hover:underline">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver {off.totalDayCount} Vistorias</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* BANNER DE FILTRO ATIVO SE SELECIONADO */}
          {activeOfficerStat && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Radio className="w-4 h-4 text-purple-700 shrink-0" />
                <span className="text-xs text-purple-900 font-medium truncate">
                  Exibindo apenas as fiscalizações de:{' '}
                  <strong className="font-black text-purple-950">
                    {activeOfficerStat.rank} {activeOfficerStat.name} (RE {activeOfficerStat.re})
                  </strong>{' '}
                  {activeOfficerStat.vehicle && (
                    <span className="font-mono text-[10.5px] font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 shadow-2xs mr-1">
                      <Car className="w-3 h-3 text-emerald-700" />
                      <span>VTR: {activeOfficerStat.vehicle}</span>
                    </span>
                  )}
                  — Total:{' '}
                  <strong className="font-black text-purple-950">
                    {activeOfficerStat.count} {activeOfficerStat.count === 1 ? 'ronda' : 'rondas'}
                  </strong>
                </span>
              </div>

              <button
                onClick={() => setSelectedOfficerFilter('TODOS')}
                className="px-2.5 py-1 text-xs font-extrabold text-purple-800 bg-white hover:bg-purple-100 rounded-lg border border-purple-300 transition cursor-pointer shrink-0"
              >
                Limpar Filtro
              </button>
            </div>
          )}
        </>
      )}

      {/* SECTION 1: Escolas do Setor */}
      <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col gap-4">
        {/* Header & Filtros */}
        <div className="flex flex-col gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-purple-600" />
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {isSupervisorView
                  ? `Fiscalização de Postos por Turno (${sectorSchools.length} postos)`
                  : `Escolas do Setor (${sectorSchools.length} postos)`}
              </h4>
            </div>

            {/* Ações no cabeçalho: Registrar Ronda (discreto) + Baixar Relatório */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="btn-registrar-ronda-cabecalho"
                onClick={() => onOpenGeneralRonda()}
                className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Registrar vistoria de ronda avulsa"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>+ Registrar Ronda</span>
              </button>

              <button
                type="button"
                id="btn-baixar-relatorio-cabecalho"
                onClick={() => setIsPdfModalOpen(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Baixar relatório oficial de rondas"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Baixar Relatório</span>
              </button>
            </div>
          </div>

          {/* Sub-Tabs: APENAS na visão de supervisão da P/3 */}
          {isSupervisorView && (
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveSchoolListTab('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  activeSchoolListTab === 'pending'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Pendentes no Turno ({naoRondadasSchools.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSchoolListTab('completed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  activeSchoolListTab === 'completed'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Já Fiscalizadas no Turno ({rondadasSchools.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSchoolListTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  activeSchoolListTab === 'all'
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Todas ({sectorSchools.length})</span>
              </button>
            </div>
          )}
        </div>

          {/* Filter Bar: City (Apenas Dropdown) & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {cities.length > 2 && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="py-2 px-3 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer shadow-2xs min-w-[190px]"
                >
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c === 'TODOS' ? 'Todos os Municípios' : c === 'VOTORANTIM' ? 'VOTORANTIM' : c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por escola, bairro ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium w-full"
              />
            </div>
          </div>

        {/* List of Schools based on activeSchoolListTab */}
        {(() => {
          const targetList = isSupervisorView
            ? activeSchoolListTab === 'pending'
              ? filteredPendingSchools
              : activeSchoolListTab === 'completed'
              ? filteredCompletedSchools
              : filteredAllSchools
            : filteredAllSchools;

          if (targetList.length === 0) {
            return (
              <div className="p-6 text-center text-xs font-medium text-slate-600 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                <span>
                  {isSupervisorView && activeSchoolListTab === 'completed'
                    ? 'Nenhuma escola deste setor foi fiscalizada até o momento neste turno.'
                    : 'Nenhuma escola encontrada para os filtros selecionados.'}
                </span>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {targetList.map((school) => {
                const sRondas = getSchoolRondas(school.school);
                const mySchoolRondas = sRondas.filter((r) => {
                  if (officerRe && matchesExactRe(r.officerRe, officerRe)) return true;
                  if (officerName && normalizeText(r.officerName) === normalizeText(officerName)) return true;
                  return false;
                });
                const hasMyRonda = mySchoolRondas.length > 0;

                /* VISÃO ENXUTA DO RONDANTE (Sem tags amarelas de pendência ou sem ronda, foco nas vistorias individuais) */
                if (!isSupervisorView) {
                  return (
                    <div
                      key={`school-${school.id}`}
                      className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 bg-white hover:border-purple-300 transition flex flex-col justify-between gap-3 shadow-2xs hover:shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-slate-900 text-xs sm:text-sm leading-snug">
                              {school.school}
                            </span>
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                              {school.city}
                            </span>
                          </div>
                        </div>

                        {/* Status Individual do Policial (Sem tags amarelas de pendência ou sem ronda) */}
                        {hasMyRonda && (
                          <div className="shrink-0">
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                              <span>Sua vistoria: {mySchoolRondas.length}x ({mySchoolRondas[0].time})</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Informações do Local com Navegação Direta no Google Maps */}
                      {(() => {
                        const displayAddress = getSchoolDisplayAddress(school);
                        const mapsUrl = getGoogleMapsNavigationUrl(school);

                        return (
                          <div className="flex items-center min-w-0">
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Toque para abrir rota e navegar pelo Google Maps"
                              className="group inline-flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-blue-700 min-w-0 max-w-full transition cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
                              <span className="truncate group-hover:underline font-medium">
                                {displayAddress}
                              </span>
                              <span className="shrink-0 inline-flex items-center gap-0.5 text-[9.5px] font-bold text-blue-700 bg-blue-50 group-hover:bg-blue-100 border border-blue-200/90 px-1.5 py-0.2 rounded transition shadow-2xs">
                                <span>Maps</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            </a>
                          </div>
                        );
                      })()}

                      {/* Action Footer: SEMPRE '+ Registrar Ronda' (permite registrar novamente sem alterar texto) */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <span className="text-[11px] text-slate-500 font-mono">
                          {hasMyRonda ? (
                            <>
                              Suas vistorias:{' '}
                              <strong className="text-purple-900 font-bold">{mySchoolRondas.length}</strong>
                              {sRondas.length > mySchoolRondas.length && (
                                <span className="text-slate-400"> (Total no local: {sRondas.length})</span>
                              )}
                            </>
                          ) : (
                            <>
                              Vistorias registradas:{' '}
                              <strong className="text-slate-800 font-bold">{sRondas.length}</strong>
                            </>
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={() => onOpenRondaWithSchool(school.id)}
                          className="px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-xs cursor-pointer min-h-[36px] active:scale-95 bg-purple-700 hover:bg-purple-800 text-white"
                          title="Registrar vistoria de ronda nesta escola"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          <span>+ Registrar Ronda</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                /* VISÃO DA SUPERVISÃO P/3: Destaque de quem fiscalizou, quantas vezes e horários */
                const { isDoneInActiveShift, totalCount } = getSchoolShiftStatus(school);

                return (
                  <div
                    key={`school-${school.id}`}
                    className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition flex flex-col justify-between gap-3 ${
                      isDoneInActiveShift
                        ? 'bg-emerald-50/20 border-emerald-200 hover:bg-emerald-50/40 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-slate-900 text-xs sm:text-sm leading-snug">
                            {school.school}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                            {school.city}
                          </span>
                        </div>

                        {/* Endereço com Navegação Direta no Google Maps */}
                        {(() => {
                          const displayAddress = getSchoolDisplayAddress(school);
                          const mapsUrl = getGoogleMapsNavigationUrl(school);

                          return (
                            <div className="mt-1 flex items-center min-w-0">
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Toque para abrir rota e navegar pelo Google Maps"
                                className="group inline-flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-blue-700 min-w-0 max-w-full transition cursor-pointer"
                              >
                                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="truncate group-hover:underline font-medium">
                                  {displayAddress}
                                </span>
                                <span className="shrink-0 inline-flex items-center gap-0.5 text-[9.5px] font-bold text-blue-700 bg-blue-50 group-hover:bg-blue-100 border border-blue-200/90 px-1.5 py-0.2 rounded transition shadow-2xs">
                                  <span>Maps</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </span>
                              </a>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Shift Status Badge */}
                      <div className="shrink-0">
                        {isDoneInActiveShift ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-lg shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>Vistoriada ({totalCount}x)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                            <span>Não rondada no turno</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Destaque de quem fiscalizou nesta escola (Supervisor View) */}
                    <div className="p-2 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs">
                      <div className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Fiscalizações Registradas ({sRondas.length})</span>
                        {sRondas.length > 0 && (
                          <span className="text-purple-700 font-black">
                            Última: {sRondas[0].time}
                          </span>
                        )}
                      </div>
                      {sRondas.length === 0 ? (
                        <span className="text-slate-400 italic text-[11px]">Nenhuma ronda registrada hoje nesta escola.</span>
                      ) : (
                        <div className="space-y-1">
                          {sRondas.slice(0, 3).map((sr) => (
                            <div key={sr.id} className="text-[11px] flex items-center justify-between gap-1 text-slate-700">
                              <span className="truncate font-medium">
                                <strong className="text-slate-900">{sr.rank || 'PM'} {sr.officerName}</strong>
                                {sr.officerRe && <span className="font-mono text-slate-500"> (RE {sr.officerRe})</span>}
                              </span>
                              <span className="font-mono font-bold text-slate-900 shrink-0 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                {sr.time}
                              </span>
                            </div>
                          ))}
                          {sRondas.length > 3 && (
                            <span className="text-[10px] font-bold text-purple-700 block">
                              + {sRondas.length - 3} outra(s) vistoria(s) registradas
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Footer: SEMPRE '+ Registrar Ronda' */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/80">
                      <span className="text-[11px] text-slate-500 font-mono">
                        Total de vistorias: <strong className="text-slate-800 font-bold">{totalCount}</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => onOpenRondaWithSchool(school.id)}
                        className="px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-xs cursor-pointer min-h-[36px] active:scale-95 bg-purple-700 hover:bg-purple-800 text-white"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>+ Registrar Ronda</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* SECTION 2: Histórico de Vistorias de Ronda Realizadas */}
      <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0" />
            <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
              {isSupervisorView
                ? `Histórico de Vistorias Realizadas (${filteredRondas.length})`
                : `Histórico das Minhas Vistorias (${filteredMyRondas.length})`}
            </h4>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick History Shift Toggle - Exclusivo para Visão de Supervisão */}
            {isSupervisorView && selectedShiftFilter !== 'TODOS' && (
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setHistoryShiftFilter('ACTIVE_SHIFT')}
                  className={`px-2 py-1 rounded-md font-bold transition cursor-pointer text-[11px] ${
                    historyShiftFilter === 'ACTIVE_SHIFT'
                      ? 'bg-white text-purple-900 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Turno {selectedShiftFilter === 'TARDE' ? 'Tarde' : 'Manhã'}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryShiftFilter('ALL')}
                  className={`px-2 py-1 rounded-md font-bold transition cursor-pointer text-[11px] ${
                    historyShiftFilter === 'ALL'
                      ? 'bg-white text-purple-900 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ver Todos
                </button>
              </div>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder={isSupervisorView ? "Filtrar histórico..." : "Buscar minhas vistorias..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600 font-medium w-44 sm:w-52"
              />
            </div>
          </div>
        </div>

        {(() => {
          const targetRondas = isSupervisorView ? filteredRondas : filteredMyRondas;

          if (targetRondas.length === 0) {
            return (
              <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                {isSupervisorView
                  ? 'Nenhuma vistoria encontrada para os filtros selecionados.'
                  : 'Você ainda não registrou nenhuma vistoria de ronda hoje.'}
              </div>
            );
          }

          return (
            <div className="space-y-2.5">
              {targetRondas.map((r) => {
                const matchedSchool = findSchoolForRonda(r.schoolName);
                const shift = getRondaShift(r);

                return (
                  <div
                    key={r.id}
                    className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-3 hover:bg-white transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-xs sm:text-sm leading-snug">
                          {r.schoolName}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded">
                          {r.city}
                        </span>

                        {/* Turno Badge */}
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs ${
                            shift === 'Tarde'
                              ? 'bg-purple-100 text-purple-900 border border-purple-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {shift === 'Tarde' ? (
                            <Moon className="w-3 h-3 text-purple-700" />
                          ) : (
                            <Sun className="w-3 h-3 text-amber-600" />
                          )}
                          <span>Turno {shift}</span>
                        </span>
                      </div>

                      <div className="text-xs mt-1">
                        {r.situation === 'sem' ? (
                          <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Sem Novidades (Ordem Mantida)
                          </span>
                        ) : (
                          <span className="text-amber-800 font-bold inline-flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            Ocorrência: {r.obs}
                          </span>
                        )}
                      </div>

                      {/* Na visão de supervisão da P/3, exibir dados do rondante */}
                      {isSupervisorView && r.officerName && (
                        <div className="text-[11px] text-slate-600 font-semibold mt-1 flex items-center gap-1.5 flex-wrap">
                          <User className="w-3 h-3 text-purple-700" />
                          <span className="font-bold text-slate-800">
                            {r.rank ? `${r.rank} ` : ''}{r.officerName}
                          </span>
                          <span>·</span>
                          <span className="font-mono text-slate-500">RE {r.officerRe || '—'}</span>
                          {(() => {
                            const vtr = staffList?.find(
                              (st) =>
                                matchesExactRe(st.re, r.officerRe) ||
                                (r.officerName && normalizeText(st.name) === normalizeText(r.officerName))
                            )?.vehicle;
                            if (!vtr) return null;
                            return (
                              <span className="font-mono text-[10.5px] font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded-md inline-flex items-center gap-0.5 shadow-2xs">
                                <Car className="w-3 h-3 text-emerald-700 shrink-0" />
                                <span>VTR: {vtr}</span>
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/70">
                      <div className="text-left sm:text-right">
                        <span className="font-mono font-black text-slate-800 block text-xs">
                          {r.time}
                        </span>
                        <span className="text-[9.5px] text-purple-700 font-black uppercase tracking-wider">
                          FISCALIZADO
                        </span>
                      </div>

                      {onDeleteRonda && (
                        <button
                          onClick={() => handlePromptDeleteRonda(r)}
                          disabled={deletingRondaId === r.id}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                          title="Excluir/desfazer esta vistoria de ronda"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Printable / Downloadable PDF Modal */}
      <RondaReportPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        rondas={relevantRondas}
        officerStaff={officerStaff}
        sectorSchools={sectorSchools}
        officerRank={officerRank}
        officerName={officerName}
        officerRe={officerRe}
        sectorName={sectorName}
      />

      {/* Individual Officer PDF Modal */}
      {viewingOfficerDetail && isOfficerPdfOpen && (
        <RondaReportPdfModal
          isOpen={isOfficerPdfOpen}
          onClose={() => setIsOfficerPdfOpen(false)}
          rondas={selectedOfficerRondas}
          officerStaff={matchedOfficerStaff}
          sectorSchools={sectorSchools}
          officerRank={viewingOfficerDetail.rank}
          officerName={viewingOfficerDetail.name}
          officerRe={viewingOfficerDetail.re}
          sectorName={matchedOfficerStaff?.local || sectorName}
        />
      )}

      {/* Modal de Detalhes das Vistorias do Policial Selecionado */}
      {viewingOfficerDetail && !isOfficerPdfOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Top Bar */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-700/80 text-white flex items-center justify-center shrink-0 border border-purple-500/30">
                  <Radio className="w-5 h-5 text-purple-200" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                    {viewingOfficerDetail.rank} · RE: {viewingOfficerDetail.re || '—'}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white truncate">
                    {viewingOfficerDetail.name}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOfficerPdfOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-300 text-xs font-extrabold rounded-xl border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                  title="Baixar relatório oficial em PDF deste policial"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Baixar Relatório</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingOfficerDetail(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Officer Metadata & VTR Bar */}
            <div className="p-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2.5 flex-wrap text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                {viewingOfficerDetail.vehicle && (
                  <span className="font-mono text-xs font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 shadow-2xs">
                    <Car className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>VTR: {viewingOfficerDetail.vehicle}</span>
                  </span>
                )}

                {matchedOfficerStaff?.driver && (
                  <span className="text-slate-700 font-semibold bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                    Motorista: <strong>{matchedOfficerStaff.driver}</strong>
                  </span>
                )}

                {matchedOfficerStaff?.local && (
                  <span className="text-slate-700 font-semibold bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                    Setor: <strong>{matchedOfficerStaff.local}</strong>
                  </span>
                )}
              </div>

              {/* Shift Scope Toggle */}
              {selectedShiftFilter !== 'TODOS' && (
                <div className="flex items-center gap-1 p-0.5 bg-white rounded-lg border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setOfficerModalShiftScope('SHIFT')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-black transition cursor-pointer ${
                      officerModalShiftScope === 'SHIFT'
                        ? 'bg-purple-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Turno {selectedShiftFilter === 'TARDE' ? 'Tarde' : 'Manhã'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOfficerModalShiftScope('ALL')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-black transition cursor-pointer ${
                      officerModalShiftScope === 'ALL'
                        ? 'bg-purple-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Dia Completo
                  </button>
                </div>
              )}
            </div>

            {/* Summary Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 shrink-0">
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Vistorias Realizadas</span>
                <span className="text-lg font-black text-purple-900">{selectedOfficerRondas.length}</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Postos Distintos</span>
                <span className="text-lg font-black text-blue-900">
                  {new Set(selectedOfficerRondas.map((r) => r.schoolName)).size}
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Sem Novidades</span>
                <span className="text-lg font-black text-emerald-800">
                  {selectedOfficerRondas.filter((r) => r.situation === 'sem').length}
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Com Ocorrência</span>
                <span className="text-lg font-black text-amber-800">
                  {selectedOfficerRondas.filter((r) => r.situation === 'com').length}
                </span>
              </div>
            </div>

            {/* Scrollable list of rondas */}
            <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 space-y-2.5">
              {selectedOfficerRondas.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-200">
                  Nenhuma vistoria de ronda encontrada para este policial no escopo selecionado.
                </div>
              ) : (
                selectedOfficerRondas.map((r, idx) => {
                  const shift = getRondaShift(r);
                  const matchedSchool = findSchoolForRonda(r.schoolName);

                  return (
                    <div
                      key={r.id || idx}
                      className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-white hover:border-purple-300 transition shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-black text-slate-900 text-xs sm:text-sm">
                            {r.schoolName}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded border border-slate-200">
                            {r.city}
                          </span>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs ${
                              shift === 'Tarde'
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {shift === 'Tarde' ? (
                              <Moon className="w-3 h-3 text-purple-700" />
                            ) : (
                              <Sun className="w-3 h-3 text-amber-600" />
                            )}
                            <span>Turno {shift}</span>
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {r.situation === 'sem' ? (
                            <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Sem Novidades (Ordem Mantida)
                            </span>
                          ) : (
                            <span className="text-amber-800 font-bold inline-flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              Ocorrência: {r.obs}
                            </span>
                          )}

                          {r.lat && r.lng && (
                            <span className="text-[10px] font-mono text-slate-400 inline-flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>GPS Registrado</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <span className="font-mono font-black text-slate-800 text-xs sm:text-sm bg-slate-100 px-2 py-1 rounded-lg">
                          {r.time}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (matchedSchool) {
                              onOpenRondaWithSchool(matchedSchool.id);
                            } else {
                              onOpenGeneralRonda();
                            }
                          }}
                          className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1 transition shadow-2xs cursor-pointer min-h-[34px]"
                          title={`Registrar vistoria no local: ${r.schoolName}`}
                        >
                          <Radio className="w-3.5 h-3.5 text-purple-200" />
                          <span>+ Registrar Ronda</span>
                        </button>

                        {onDeleteRonda && (
                          <button
                            type="button"
                            onClick={() => handlePromptDeleteRonda(r)}
                            disabled={deletingRondaId === r.id}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                            title="Excluir esta vistoria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Total de <strong>{selectedOfficerRondas.length}</strong> {selectedOfficerRondas.length === 1 ? 'vistoria listada' : 'vistorias listadas'}
              </span>

              <button
                type="button"
                onClick={() => setViewingOfficerDetail(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Undoing Ronda */}
      {confirmDeleteRonda && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">
                  Desfazer Vistoria de Ronda
                </h4>
                <p className="text-xs text-slate-500">
                  Confirmação de exclusão do registro
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Escola:</span>
                <span className="font-black text-slate-800 truncate max-w-[200px]">
                  {confirmDeleteRonda.schoolName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Município / Hora:</span>
                <span className="font-bold text-slate-700">
                  {confirmDeleteRonda.city} · {confirmDeleteRonda.time}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Deseja realmente excluir este registro de vistoria? A ronda será removida do banco de dados na nuvem.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={Boolean(deletingRondaId)}
                onClick={() => setConfirmDeleteRonda(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(deletingRondaId)}
                onClick={handleConfirmDeleteRonda}
                className="px-4 py-2 text-xs font-black bg-purple-700 hover:bg-purple-800 text-white rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingRondaId ? 'Apagando...' : 'Confirmar e Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
