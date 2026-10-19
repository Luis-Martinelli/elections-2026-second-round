import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  User,
  Shield,
  Phone,
  Clock,
  Car,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Building,
  Radio,
  FileCheck,
  LogOut,
  KeyRound,
  Unlink,
  Trash2,
  Info,
  School,
  ShieldCheck,
  UserCheck,
  ExternalLink
} from 'lucide-react';
import { StaffMember, SchoolItem, CheckInRecord, RondaRecord, DeviceBinding, SchoolOfficer } from '../types';
import { normalizeText, matchesExactRe, normalizeRe } from '../utils/normalize';
import { filterSchoolsByJurisdiction } from '../utils/jurisdiction';
import { isRondaRoleOrSchool, getSchoolAmOfficers, getSchoolPmOfficers, findOfficerCheckIn, isGcmOfficer } from '../utils/checkinStatus';
import { INITIAL_STAFF } from '../data/initialData';
import { PendingSchoolsTable } from './PendingSchoolsTable';
import { SectorRondasTab } from './SectorRondasTab';
import { getGoogleMapsNavigationUrl, getSchoolDisplayAddress } from '../utils/geo';
import { Brasao40BPMI } from './Brasao40BPMI';

interface OfficerDetailViewProps {
  officer: {
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
    phone?: string;
  };
  checkInRecord?: CheckInRecord;
  rondasMade: RondaRecord[];
  allRondas?: RondaRecord[];
  onBack: () => void;
  onOpenCheckIn: () => void;
  onOpenRonda: (schoolId?: string) => void;
  isIndividualRestrictedMode?: boolean;
  onLogout?: () => void;
  onOpenSupervisorMode?: () => void;
  deviceBinding?: DeviceBinding | null;
  onDeleteCheckIn?: (checkInId: string, officerInfo: string, schoolName: string, record?: CheckInRecord) => Promise<void> | void;
  onDeleteRonda?: (rondaId: string, info: string) => Promise<void>;
  allSchools?: SchoolItem[];
  staffList?: StaffMember[];
  allCheckIns?: CheckInRecord[];
  onSelectSchoolForCheckIn?: (school: SchoolItem, shift: 'Manhã' | 'Tarde' | 'Integral', officer?: SchoolOfficer) => void;
  onSearchByRe?: (re: string) => void;
  activeTab?: 'escolas' | 'rondas';
  onTabChange?: (tab: 'escolas' | 'rondas') => void;
}

export const OfficerDetailView: React.FC<OfficerDetailViewProps> = ({
  officer,
  checkInRecord,
  rondasMade,
  allRondas = [],
  onBack,
  onOpenCheckIn,
  onOpenRonda,
  isIndividualRestrictedMode = false,
  onLogout,
  onOpenSupervisorMode,
  deviceBinding,
  onDeleteCheckIn,
  allSchools = [],
  staffList = [],
  allCheckIns = [],
  onSelectSchoolForCheckIn,
  onSearchByRe,
  onDeleteRonda,
  activeTab: propActiveTab,
  onTabChange
}) => {
  const { staff, schoolItem, assignedShift, isMotorized } = officer;
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingCheckInId, setIsDeletingCheckInId] = useState<string | null>(null);

  const rank = officer.rank || staff?.rank || (assignedShift === 'Manhã' ? schoolItem?.am.rank : schoolItem?.pm.rank) || 'Policial Militar';
  const name = officer.name || staff?.name || (assignedShift === 'Manhã' ? schoolItem?.am.name : schoolItem?.pm.name) || '';
  const re = officer.re || staff?.re || (assignedShift === 'Manhã' ? schoolItem?.am.re : schoolItem?.pm.re) || '';
  const rawPhone = officer.phone || staff?.phone || (assignedShift === 'Manhã' ? schoolItem?.am.phone : schoolItem?.pm.phone) || '';

  // Resolve all assigned schools for this officer (supports officers with multiple assigned schools/shifts)
  const effectiveAssignedSchools = useMemo(() => {
    // 1. If candidate passed explicit assignedSchools
    if (officer.assignedSchools && officer.assignedSchools.length > 0) {
      return officer.assignedSchools;
    }

    // 2. Query allSchools for all schools where this officer is scheduled
    if (allSchools && allSchools.length > 0 && (re || name)) {
      const results: Array<{
        school: SchoolItem;
        shift: 'Manhã' | 'Tarde' | 'Integral';
        officer: SchoolOfficer;
      }> = [];

      for (const s of allSchools) {
        if (isRondaRoleOrSchool(s.school, s.address || s.bairro)) continue;

        const amOfficers = getSchoolAmOfficers(s);
        const matchAm = amOfficers.find((off) =>
          matchesExactRe(off.re, re) ||
          (name && normalizeText(off.name) === normalizeText(name))
        );
        const pmOfficers = getSchoolPmOfficers(s);
        const matchPm = pmOfficers.find((off) =>
          matchesExactRe(off.re, re) ||
          (name && normalizeText(off.name) === normalizeText(name))
        );

        if (matchAm && matchPm) {
          results.push({
            school: s,
            shift: 'Integral',
            officer: {
              ...matchAm,
              phone: matchAm.phone || matchPm.phone || ''
            }
          });
        } else if (matchAm) {
          results.push({
            school: s,
            shift: 'Manhã',
            officer: matchAm
          });
        } else if (matchPm) {
          results.push({
            school: s,
            shift: 'Tarde',
            officer: matchPm
          });
        }
      }

      if (results.length > 0) {
        return results;
      }
    }

    // 3. Fallback to single schoolItem if present
    if (schoolItem) {
      const isAm = assignedShift === 'Manhã';
      const off = isAm ? schoolItem.am : schoolItem.pm;
      return [{
        school: schoolItem,
        shift: (assignedShift || 'Manhã') as 'Manhã' | 'Tarde' | 'Integral',
        officer: off || { re, name, rank, phone: rawPhone }
      }];
    }

    return [];
  }, [officer.assignedSchools, allSchools, re, name, schoolItem, assignedShift, rank, rawPhone]);

  // Resolve staff member across staffList / INITIAL_STAFF by RE or Name to guarantee vehicle and phone are never lost
  const resolvedStaff = useMemo(() => {
    if (staff && staff.vehicle && staff.phone) return staff;
    let found = staffList?.find((m) => matchesExactRe(m.re, re));
    if (!found && name) {
      const normName = normalizeText(name);
      found = staffList?.find((m) => normalizeText(m.name) === normName);
    }
    if (!found) {
      found = INITIAL_STAFF.find((m) => matchesExactRe(m.re, re));
    }
    if (!found && name) {
      const normName = normalizeText(name);
      found = INITIAL_STAFF.find((m) => normalizeText(m.name) === normName);
    }
    if (found) {
      return {
        ...found,
        ...(staff || {}),
        vehicle: found.vehicle || staff?.vehicle || '',
        phone: found.phone || staff?.phone || '',
        driver: found.driver || staff?.driver || ''
      };
    }
    return staff;
  }, [staff, re, name, staffList]);

  // Determine if officer is support/driver/escort/administrative who does not perform rondas or fixed school check-in
  const rawRoleText =
    resolvedStaff?.function ||
    staff?.function ||
    resolvedStaff?.shiftRaw ||
    staff?.shiftRaw ||
    (schoolItem ? schoolItem.school : '');
  const normalizedFunction = normalizeText(rawRoleText);
  const isExcludedSupportRole =
    normalizedFunction.includes('MOTORISTA') ||
    normalizedFunction.includes('CONDUTOR') ||
    normalizedFunction.includes('MOT.') ||
    normalizedFunction.includes('AUXILIAR') ||
    normalizedFunction.includes('AUX.') ||
    normalizedFunction.includes('AUXILI') ||
    /\bAUX\b/.test(normalizedFunction) ||
    normalizedFunction.includes('APOIO') ||
    normalizedFunction.includes('ADMINISTRATIV');

  // Ronda is eligible for officers in mobile/ronda/supervision roles
  const isRondaOfficer =
    !isExcludedSupportRole &&
    (isMotorized ||
      isRondaRoleOrSchool(staff?.function) ||
      (schoolItem ? isRondaRoleOrSchool(schoolItem.school, schoolItem.address || schoolItem.bairro) : false));

  const showRondaSection = isRondaOfficer;

  // Check-ins are strictly for officers with assigned fixed polling station posts (never drivers/auxiliary/support)
  const hasFixedPostCheckIn = !isExcludedSupportRole && effectiveAssignedSchools.length > 0;

  // If officer is in ronda and has no fixed post check-in, open 'rondas' screen directly!
  const [internalActiveTab, setInternalActiveTab] = useState<'escolas' | 'rondas'>(
    isRondaOfficer && !hasFixedPostCheckIn ? 'rondas' : 'escolas'
  );

  useEffect(() => {
    setInternalActiveTab(isRondaOfficer && !hasFixedPostCheckIn ? 'rondas' : 'escolas');
  }, [isRondaOfficer, hasFixedPostCheckIn, officer]);

  const effectiveActiveTab = propActiveTab !== undefined ? propActiveTab : internalActiveTab;

  const handleTabSelect = (tab: 'escolas' | 'rondas') => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  // Vistorias de ronda realizadas individualmente por este policial
  const myOfficerRondas = useMemo(() => {
    const pool = allRondas && allRondas.length > 0 ? allRondas : rondasMade;
    return pool.filter((r) => {
      if (re && matchesExactRe(r.officerRe, re)) return true;
      if (name && normalizeText(r.officerName) === normalizeText(name)) return true;
      return false;
    });
  }, [allRondas, rondasMade, re, name]);

  // Helper para formatar nome militar sem duplicar a graduação (evita 'Cb PM Cb PM...')
  const formatCleanOfficerName = useCallback((rankStr?: string, nameStr?: string): string => {
    if (!nameStr) return rankStr || '';
    let clean = nameStr.trim();
    const r = (rankStr || '').trim();
    if (r && clean.toLowerCase().startsWith(r.toLowerCase())) {
      clean = clean.substring(r.length).trim();
    }
    clean = clean.replace(/^(?:Cel|Ten Cel|Maj|Cap|1º Ten|2º Ten|Asp|Subten|1º Sgt|2º Sgt|3º Sgt|Cb|Sd|Ten|Sgt)\s+PM\s+/i, '');
    if (r) {
      return `${r} ${clean}`;
    }
    return clean;
  }, []);

  // Resolve designated drivers (especialmente quando há motorista no turno da manhã e da tarde, como Coordop / Cmt, ou supervisores e rondantes)
  const designatedDrivers = useMemo(() => {
    const pool = (staffList && staffList.length > 0) ? staffList : INITIAL_STAFF;
    const normFunc = normalizeText(resolvedStaff?.function || staff?.function || '');
    const isCoordop = normFunc.includes('COORDENADOR') || normFunc.includes('COORDOP') || (re && matchesExactRe(re, '104620'));
    const isCmd = normFunc.includes('COMANDANTE') && !normFunc.includes('SUB') && !normFunc.includes('COORD');
    const isSubcmd = normFunc.includes('SUBCOMANDANTE');
    const isSupervisao = normFunc.includes('SUPERVISAO');
    const isRondaEleicoes = normFunc.includes('RONDA ELEICOES');

    let morningDriver: StaffMember | undefined;
    let afternoonDriver: StaffMember | undefined;
    let singleDriver: StaffMember | undefined;
    let teamMembers: StaffMember[] = [];
    let driverVehicle = resolvedStaff?.vehicle || staff?.vehicle || '';

    if (isCoordop) {
      morningDriver = pool.find((m) => {
        const f = normalizeText(m.function);
        const s = normalizeText(m.shiftRaw || '');
        const isCoordopDriver = f.includes('MOTORISTA COORDOP') || normalizeText(m.name).includes('THIAGO RIBAS') || matchesExactRe(m.re, '130043');
        const isManha = (s.includes('MANHA') || s.includes('06H')) && !s.includes('TARDE');
        return isCoordopDriver && isManha;
      });
      if (!morningDriver) {
        morningDriver = pool.find((m) => matchesExactRe(m.re, '130043') || normalizeText(m.name).includes('THIAGO RIBAS'));
      }

      afternoonDriver = pool.find((m) => {
        if (morningDriver && (m.re === morningDriver.re || normalizeText(m.name) === normalizeText(morningDriver.name))) {
          return false;
        }
        const f = normalizeText(m.function);
        const s = normalizeText(m.shiftRaw || '');
        const isCoordopDriver = f.includes('MOTORISTA COORDOP') || normalizeText(m.name).includes('LUAN VASAKI') || matchesExactRe(m.re, '180673');
        const isTarde = s.includes('TARDE') || (s.includes('13H') && !s.includes('06H') && !s.includes('MANHA'));
        return isCoordopDriver && isTarde;
      });
      if (!afternoonDriver || (morningDriver && afternoonDriver.re === morningDriver.re)) {
        afternoonDriver = pool.find((m) => {
          if (morningDriver && (m.re === morningDriver.re || normalizeText(m.name) === normalizeText(morningDriver.name))) return false;
          return matchesExactRe(m.re, '180673') || normalizeText(m.name).includes('LUAN VASAKI');
        });
      }
      if (!driverVehicle) {
        driverVehicle = morningDriver?.vehicle || afternoonDriver?.vehicle || 'I-40001';
      }
    } else if (isCmd) {
      singleDriver = pool.find((m) => normalizeText(m.function).includes('MOTORISTA COMANDANTE') || matchesExactRe(m.re, '117327'));
      if (!driverVehicle) driverVehicle = singleDriver?.vehicle || 'I-40000';
    } else if (isSubcmd) {
      singleDriver = pool.find((m) => normalizeText(m.function).includes('MOTORISTA SUBCOMANDANTE') || matchesExactRe(m.re, '130712'));
      if (!driverVehicle) driverVehicle = singleDriver?.vehicle || 'I-40005';
    } else if (isSupervisao) {
      const myLocal = normalizeText(resolvedStaff?.local || staff?.local || '');
      const myShift = normalizeText(resolvedStaff?.shiftRaw || staff?.shiftRaw || '');
      const isManha = myShift.includes('MANHA') || myShift.includes('06H');
      const partner = pool.find((m) => {
        if (m.re && re && matchesExactRe(m.re, re)) return false;
        const ml = normalizeText(m.local || '');
        const mf = normalizeText(m.function || '');
        const ms = normalizeText(m.shiftRaw || '');
        const sameShift = isManha ? (ms.includes('MANHA') || ms.includes('06H')) : (ms.includes('TARDE') || ms.includes('13H'));
        return ml === myLocal && mf.includes('SUPERVISAO') && sameShift;
      });
      if (partner) {
        singleDriver = partner;
        if (!driverVehicle) driverVehicle = partner.vehicle || '';
      }
    } else if (isRondaEleicoes) {
      const myLocal = normalizeText(resolvedStaff?.local || staff?.local || '');
      const myShift = normalizeText(resolvedStaff?.shiftRaw || staff?.shiftRaw || '');
      const isManha = myShift.includes('MANHA') || myShift.includes('06H');
      teamMembers = pool.filter((m) => {
        if (m.re && re && matchesExactRe(m.re, re)) return false;
        const ml = normalizeText(m.local || '');
        const mf = normalizeText(m.function || '');
        const ms = normalizeText(m.shiftRaw || '');
        const sameShift = isManha ? (ms.includes('MANHA') || ms.includes('06H')) : (ms.includes('TARDE') || ms.includes('13H'));
        return ml === myLocal && mf.includes('RONDA ELEICOES') && sameShift;
      });
      if (!driverVehicle && teamMembers.length > 0) {
        driverVehicle = teamMembers.find((m) => m.vehicle)?.vehicle || '';
      }
    }

    const rawDriverText = resolvedStaff?.driver || staff?.driver || '';

    // Se o texto de motorista contiver explicitamente 'Manhã:' e 'Tarde:', extrai ambos se algum estiver faltando
    if ((!morningDriver || !afternoonDriver || morningDriver.re === afternoonDriver.re) && /manh[ãa]:/i.test(rawDriverText) && /tarde:/i.test(rawDriverText)) {
      const matchManha = rawDriverText.match(/manh[ãa]:\s*([^·\/\n;]+)/i);
      const matchTarde = rawDriverText.match(/tarde:\s*([^·\/\n;]+)/i);
      if (matchManha && !morningDriver) {
        const textManha = matchManha[1].trim();
        const found = pool.find((m) => normalizeText(m.name).includes(normalizeText(textManha)) || (m.re && textManha.includes(m.re)));
        if (found) morningDriver = found;
      }
      if (matchTarde && (!afternoonDriver || (morningDriver && afternoonDriver.re === morningDriver.re))) {
        const textTarde = matchTarde[1].trim();
        const found = pool.find((m) => {
          if (morningDriver && (m.re === morningDriver.re || normalizeText(m.name) === normalizeText(morningDriver.name))) return false;
          return normalizeText(m.name).includes(normalizeText(textTarde)) || (m.re && textTarde.includes(m.re));
        });
        if (found) afternoonDriver = found;
      }
    }

    // Salvaguarda absoluta: NUNCA permitir que o motorista da manhã seja idêntico ao motorista da tarde
    if (morningDriver && afternoonDriver && (
      morningDriver.re === afternoonDriver.re ||
      normalizeText(morningDriver.name) === normalizeText(afternoonDriver.name)
    )) {
      if (isCoordop) {
        afternoonDriver = pool.find((m) => matchesExactRe(m.re, '180673') || normalizeText(m.name).includes('LUAN VASAKI'));
      } else {
        afternoonDriver = undefined;
      }
    }

    return {
      morningDriver,
      afternoonDriver,
      singleDriver,
      teamMembers,
      driverVehicle,
      rawDriverText
    };
  }, [staffList, resolvedStaff, staff, re]);

  const vehicle = resolvedStaff?.vehicle || staff?.vehicle || '';
  const driver = resolvedStaff?.driver || staff?.driver || '';

  const phone = useMemo(() => {
    if (rawPhone && rawPhone.trim()) return rawPhone.trim();
    if (resolvedStaff?.phone?.trim()) return resolvedStaff.phone.trim();
    if (re) {
      const fromStaffList = staffList?.find((m) => matchesExactRe(m.re, re));
      if (fromStaffList?.phone?.trim()) return fromStaffList.phone.trim();
      const fromSchoolAm = allSchools?.find((s) => matchesExactRe(s.am.re, re) && s.am.phone?.trim());
      if (fromSchoolAm?.am.phone?.trim()) return fromSchoolAm.am.phone.trim();
      const fromSchoolPm = allSchools?.find((s) => matchesExactRe(s.pm.re, re) && s.pm.phone?.trim());
      if (fromSchoolPm?.pm.phone?.trim()) return fromSchoolPm.pm.phone.trim();
      const fromInitial = INITIAL_STAFF.find((m) => matchesExactRe(m.re, re));
      if (fromInitial?.phone?.trim()) return fromInitial.phone.trim();
    }
    return '';
  }, [rawPhone, re, resolvedStaff, staffList, allSchools]);
  const opm = staff?.unit || schoolItem?.opm || '40º BPM/I - CPI-7';
  const roleName =
    staff?.function ||
    (schoolItem && isRondaRoleOrSchool(schoolItem.school)
      ? schoolItem.school
      : isRondaOfficer
      ? 'CGP / Ronda Eleições'
      : hasFixedPostCheckIn
      ? 'Efetivo Local (Ponto Fixo)'
      : 'Efetivo Operacional');

  // Sector schools for Level 3 inspection
  const officerJurisdictionLocal = staff?.local || (schoolItem ? `${schoolItem.opm || ''} · ${schoolItem.city || ''}` : '');
  const sectorSchools = useMemo(() => {
    if (!showRondaSection || !allSchools || allSchools.length === 0) return [];
    return filterSchoolsByJurisdiction(allSchools, officerJurisdictionLocal, staff?.function);
  }, [showRondaSection, allSchools, officerJurisdictionLocal, staff?.function]);

  // Shift Schedule Formatting (shows exact hours e.g. "06h às 13h", "13h ao término", etc.)
  const isMorningShift =
    assignedShift === 'Manhã' ||
    (!assignedShift && (staff?.shiftRaw?.toLowerCase().includes('manhã') || staff?.shiftRaw?.toLowerCase().includes('06h')));

  const shiftTimeDisplay = useMemo(() => {
    if (staff?.shiftRaw) {
      const match = staff.shiftRaw.match(/\b(\d{1,2}h(?:\d{2})?\s*(?:às|as|-|ao|\/)\s*(?:\d{1,2}h(?:\d{2})?|término|termino))\b/i);
      if (match) {
        return match[0].toLowerCase().replace('termino', 'término');
      }
    }
    if (isMorningShift) {
      return '06h às 13h';
    }
    const s = (assignedShift || staff?.shiftRaw || '').toLowerCase();
    if (s.includes('tarde') || s === 'pm') {
      return '13h ao término';
    }
    if (s.includes('integral') || s.includes('dia')) {
      return '06h ao término';
    }
    return '06h às 13h';
  }, [assignedShift, staff?.shiftRaw, isMorningShift]);

  // Relief Officer ("Policial da Rendição" for morning shift)
  const rendicaoOfficer = useMemo(() => {
    if (!isMorningShift) return null;

    // Case 1: Fixed School Post -> PM officer is the assigned relief!
    if (schoolItem) {
      const amOfficers = getSchoolAmOfficers(schoolItem);
      const pmOfficers = getSchoolPmOfficers(schoolItem);
      let matchedPm = pmOfficers[0] || (schoolItem.pm?.re ? schoolItem.pm : null);
      if (pmOfficers.length > 1 && amOfficers.length > 1) {
        const amIdx = amOfficers.findIndex((o) => matchesExactRe(o.re, re));
        if (amIdx >= 0 && pmOfficers[amIdx]) {
          matchedPm = pmOfficers[amIdx];
        }
      }
      if (matchedPm && (matchedPm.name || matchedPm.re)) {
        const pmRe = matchedPm.re;
        let pmPhone = matchedPm.phone?.trim() || '';
        if (!pmPhone && pmRe) {
          const fromStaffList = staffList?.find((m) => matchesExactRe(m.re, pmRe));
          if (fromStaffList?.phone?.trim()) pmPhone = fromStaffList.phone.trim();
          const fromSchool = allSchools?.find((s) => matchesExactRe(s.pm.re, pmRe) && s.pm.phone?.trim());
          if (fromSchool?.pm.phone?.trim()) pmPhone = fromSchool.pm.phone.trim();
          const fromInitial = INITIAL_STAFF.find((m) => matchesExactRe(m.re, pmRe));
          if (fromInitial?.phone?.trim()) pmPhone = fromInitial.phone.trim();
        }
        return {
          rank: matchedPm.rank || 'Policial Militar',
          name: matchedPm.name,
          re: matchedPm.re,
          phone: pmPhone,
          shiftTime: '13h ao término'
        };
      }
    }

    // Case 2: General Staff member on morning shift -> Match with counterpart on afternoon shift
    if (staff) {
      const normFunction = normalizeText(staff.function);
      const normLocal = normalizeText(staff.local);
      const counterpart = staffList?.find((m) =>
        m.re !== staff.re &&
        normalizeText(m.function) === normFunction &&
        normalizeText(m.local) === normLocal &&
        (m.shiftRaw?.toLowerCase().includes('tarde') || m.shiftRaw?.toLowerCase().includes('12h') || m.shiftRaw?.toLowerCase().includes('13h'))
      );
      if (counterpart) {
        return {
          rank: counterpart.rank || 'Policial Militar',
          name: counterpart.name,
          re: counterpart.re,
          phone: counterpart.phone?.trim() || '',
          shiftTime: '13h ao término'
        };
      }
    }

    return null;
  }, [isMorningShift, schoolItem, staff, staffList, allSchools, re]);

  // Check-in record resolver for each post
  const getPostCheckInRecord = useCallback(
    (postSchool: SchoolItem, postOfficer: SchoolOfficer, postShift: 'Manhã' | 'Tarde' | 'Integral') => {
      // 1. Try findOfficerCheckIn utility (supports Manhã, Tarde and Integral)
      const fromUtil = findOfficerCheckIn(postSchool, postOfficer, postShift, allCheckIns);
      if (fromUtil) return fromUtil;

      // 2. Direct match in allCheckIns by school and officer RE/name
      const postSchoolNorm = normalizeText(postSchool.school);
      const postSchoolClean = (postSchool.school || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const postCityNorm = normalizeText(postSchool.city || '');
      const offReNorm = normalizeRe(postOfficer?.re || re || '');
      const offNameNorm = normalizeText(postOfficer?.name || name || '');

      const found = allCheckIns.find((c) => {
        const cSchoolNorm = normalizeText(c.schoolName);
        const cSchoolClean = (c.schoolName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

        const matchSchool = Boolean(
          (postSchoolClean && cSchoolClean && (postSchoolClean === cSchoolClean || postSchoolClean.includes(cSchoolClean) || cSchoolClean.includes(postSchoolClean))) ||
          (postSchoolNorm && cSchoolNorm && (cSchoolNorm === postSchoolNorm || cSchoolNorm.includes(postSchoolNorm) || postSchoolNorm.includes(cSchoolNorm)))
        );
        if (!matchSchool) return false;

        const cReNorm = normalizeRe(c.officerRe);
        const matchRe = offReNorm && cReNorm && (offReNorm === cReNorm || matchesExactRe(offReNorm, c.officerRe));
        if (offReNorm && cReNorm) return Boolean(matchRe);

        const cNameNorm = normalizeText(c.officerName);
        const matchName =
          offNameNorm &&
          cNameNorm &&
          (offNameNorm === cNameNorm ||
            (offNameNorm.length > 5 && cNameNorm.includes(offNameNorm)) ||
            (cNameNorm.length > 5 && offNameNorm.includes(cNameNorm)));

        return Boolean(matchRe || matchName);
      });

      if (found) return found;

      // 3. Fallback to checkInRecord if matches this school or is this officer's only assigned post
      if (checkInRecord) {
        if (effectiveAssignedSchools.length === 1) {
          return checkInRecord;
        }
        const chkClean = (checkInRecord.schoolName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (chkClean && postSchoolClean && (chkClean === postSchoolClean || chkClean.includes(postSchoolClean) || postSchoolClean.includes(chkClean))) {
          return checkInRecord;
        }
        if (normalizeText(checkInRecord.schoolName) === postSchoolNorm) {
          return checkInRecord;
        }
      }

      return undefined;
    },
    [allCheckIns, checkInRecord, re, name, effectiveAssignedSchools]
  );

  const completedCheckInsCount = useMemo(() => {
    return effectiveAssignedSchools.filter((item) => {
      const rec = getPostCheckInRecord(item.school, item.officer, item.shift);
      return Boolean(rec);
    }).length;
  }, [effectiveAssignedSchools, getPostCheckInRecord]);

  const handleTriggerCheckInForPost = (
    postSchool: SchoolItem,
    postShift: 'Manhã' | 'Tarde' | 'Integral',
    postOfficer: SchoolOfficer
  ) => {
    if (isGcmOfficer(postOfficer)) return;
    const shiftToUse: 'Manhã' | 'Tarde' | 'Integral' =
      postShift === 'Integral'
        ? 'Integral'
        : postShift === 'Tarde'
          ? 'Tarde'
          : 'Manhã';

    const officerToPass: SchoolOfficer = {
      re: postOfficer.re || re,
      name: postOfficer.name || name,
      rank: postOfficer.rank || rank,
      phone: postOfficer.phone || phone
    };

    if (onSelectSchoolForCheckIn) {
      onSelectSchoolForCheckIn(postSchool, shiftToUse, officerToPass);
    } else {
      onOpenCheckIn();
    }
  };

  const getRendicaoForPost = (postSchool: SchoolItem, postShift: 'Manhã' | 'Tarde' | 'Integral') => {
    if (postShift === 'Tarde' || postShift === 'Integral') return null;

    const amList = getSchoolAmOfficers(postSchool);
    const pmList = getSchoolPmOfficers(postSchool);
    let matchedPm = pmList[0] || (postSchool.pm?.re ? postSchool.pm : null);
    if (pmList.length > 1 && amList.length > 1) {
      const amIdx = amList.findIndex((o) => matchesExactRe(o.re, re));
      if (amIdx >= 0 && pmList[amIdx]) {
        matchedPm = pmList[amIdx];
      }
    }

    if (!matchedPm || (!matchedPm.name && !matchedPm.re)) return null;

    let pmPhone = matchedPm.phone?.trim() || '';
    if (!pmPhone && matchedPm.re) {
      const fromStaff = staffList?.find((m) => matchesExactRe(m.re, matchedPm.re));
      if (fromStaff?.phone?.trim()) pmPhone = fromStaff.phone.trim();
      const fromSchool = allSchools?.find((s) => matchesExactRe(s.pm.re, matchedPm.re) && s.pm.phone?.trim());
      if (fromSchool?.pm.phone?.trim()) pmPhone = fromSchool.pm.phone.trim();
      const fromInitial = INITIAL_STAFF.find((m) => matchesExactRe(m.re, matchedPm.re));
      if (fromInitial?.phone?.trim()) pmPhone = fromInitial.phone.trim();
    }

    return {
      rank: matchedPm.rank || 'Policial Militar',
      name: matchedPm.name,
      re: matchedPm.re,
      phone: pmPhone,
      shiftTime: '13h ao término'
    };
  };

  const getReinforcedRosterForPost = (postSchool: SchoolItem) => {
    const amList = getSchoolAmOfficers(postSchool);
    const pmList = getSchoolPmOfficers(postSchool);
    const isReinforced = amList.length > 1 || pmList.length > 1;
    if (!isReinforced) return null;
    return { amList, pmList, total: amList.length + pmList.length };
  };

  return (
    <div className={`flex flex-col gap-3.5 sm:gap-6 mt-2 sm:mt-6 w-full min-w-0 ${showRondaSection ? 'pb-20 md:pb-6' : 'pb-6'}`}>
      {/* Top back navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          {!isIndividualRestrictedMode && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center gap-2 text-xs font-extrabold text-[#0F2B48] bg-white hover:bg-slate-50 border border-slate-300 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition shadow-2xs cursor-pointer min-h-[40px] sm:min-h-[42px] flex-1 sm:flex-initial"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Painel Geral</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {isIndividualRestrictedMode && onOpenSupervisorMode && (
            <button
              onClick={onOpenSupervisorMode}
              className="text-[11px] font-extrabold text-slate-500 hover:text-slate-800 bg-white px-2.5 py-0.5 sm:py-1 rounded-full border border-slate-300 transition cursor-pointer flex items-center gap-1 min-h-[30px]"
              title="Acesso com senha para a Área Restrita da P/3"
            >
              <KeyRound className="w-3 h-3 text-slate-400" />
              <span>Área Restrita (P/3)</span>
            </button>
          )}
        </div>
      </div>

      {/* Se NÃO for policial com posto fixo de escola (Rondantes, Apoio, Coordenação): CARD ÚNICO E ENXUTO */}
      {!hasFixedPostCheckIn ? (
        <div id="card-escala-policial" className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xs w-full min-w-0">
          {/* Identificação Militar Enxuta com Brasão */}
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 pb-3.5 border-b border-slate-100">
            <div className="w-11 h-13 sm:w-13 sm:h-15 flex items-center justify-center shrink-0">
              <Brasao40BPMI className="w-10 h-auto sm:w-12 drop-shadow-sm" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] sm:text-[11px] font-extrabold uppercase text-slate-400 tracking-wider truncate">
                {opm}{resolvedStaff?.local && normalizeText(resolvedStaff.local) !== normalizeText(opm) ? ` · ${resolvedStaff.local}` : ''}
              </div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight truncate">
                {formatCleanOfficerName(rank, name)}
              </h3>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md inline-block">
                  RE: {re}
                </span>
                <span className="font-mono text-[10px] font-black text-blue-800 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md inline-block">
                  2º TURNO
                </span>
                {vehicle && (
                  <span className="font-mono text-xs font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs">
                    <Car className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>VTR: {vehicle}</span>
                  </span>
                )}
                <span className="text-[10px] sm:text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200">
                  {roleName}
                </span>
              </div>
            </div>
          </div>

          {/* Dados Operacionais em Grade Enxuta (Sem repetições de VTR, Setor ou OPM) */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2 sm:p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Horário de Serviço</span>
              <span className="text-xs font-extrabold text-[#0F2B48] mt-0.5 block truncate">
                {shiftTimeDisplay}
              </span>
            </div>

            <div className="p-2 sm:p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Contato Telefônico</span>
              {phone ? (
                <a href={`tel:${phone}`} className="text-xs font-extrabold text-blue-700 hover:underline mt-0.5 block truncate">
                  {phone}
                </a>
              ) : (
                <span className="text-xs text-slate-400 font-medium mt-0.5 block">Não informado</span>
              )}
            </div>

            <div className="p-2 sm:p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                {designatedDrivers.morningDriver && designatedDrivers.afternoonDriver
                  ? 'Motoristas Designados'
                  : designatedDrivers.singleDriver
                  ? 'Motorista Designado'
                  : designatedDrivers.teamMembers.length > 0
                  ? 'Equipe de Ronda'
                  : 'Motorista / Equipe'}
              </span>

              {designatedDrivers.morningDriver && designatedDrivers.afternoonDriver ? (
                <div className="mt-1 space-y-1">
                  <div
                    className="text-xs font-extrabold text-slate-800"
                    title={`Manhã: ${formatCleanOfficerName(designatedDrivers.morningDriver.rank, designatedDrivers.morningDriver.name)} (RE ${designatedDrivers.morningDriver.re}) · Tel: ${designatedDrivers.morningDriver.phone}`}
                  >
                    <span className="text-amber-800 font-black">Manhã:</span>{' '}
                    <span>{formatCleanOfficerName(designatedDrivers.morningDriver.rank, designatedDrivers.morningDriver.name)}</span>
                  </div>
                  <div
                    className="text-xs font-extrabold text-slate-800"
                    title={`Tarde: ${formatCleanOfficerName(designatedDrivers.afternoonDriver.rank, designatedDrivers.afternoonDriver.name)} (RE ${designatedDrivers.afternoonDriver.re}) · Tel: ${designatedDrivers.afternoonDriver.phone}`}
                  >
                    <span className="text-purple-800 font-black">Tarde:</span>{' '}
                    <span>{formatCleanOfficerName(designatedDrivers.afternoonDriver.rank, designatedDrivers.afternoonDriver.name)}</span>
                  </div>
                </div>
              ) : designatedDrivers.singleDriver ? (
                <div className="mt-1 space-y-1">
                  <div
                    className="text-xs font-extrabold text-slate-800"
                    title={`${formatCleanOfficerName(designatedDrivers.singleDriver.rank, designatedDrivers.singleDriver.name)} (RE ${designatedDrivers.singleDriver.re}) · Tel: ${designatedDrivers.singleDriver.phone}`}
                  >
                    <span>{formatCleanOfficerName(designatedDrivers.singleDriver.rank, designatedDrivers.singleDriver.name)}</span>
                  </div>
                </div>
              ) : designatedDrivers.teamMembers.length > 0 ? (
                <div className="mt-1 space-y-1">
                  {designatedDrivers.teamMembers.map((tm, idx) => (
                    <div key={idx} className="text-xs font-extrabold text-slate-800">
                      <span>{formatCleanOfficerName(tm.rank, tm.name)}</span>
                    </div>
                  ))}
                </div>
              ) : designatedDrivers.rawDriverText ? (
                <div className="mt-1 space-y-1">
                  <span className="text-xs font-extrabold text-slate-800 block">
                    {designatedDrivers.rawDriverText.startsWith('Motorista:')
                      ? designatedDrivers.rawDriverText.replace(/^Motorista:\s*/i, '')
                      : designatedDrivers.rawDriverText}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 font-medium mt-0.5 block truncate">
                  Sem motorista designado
                </span>
              )}
            </div>
          </div>

          {/* Aviso contextual para apoio/motorista se aplicável */}
          {isExcludedSupportRole && (
            <div className="mt-3 p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-950 font-bold">
              <Info className="w-4 h-4 text-blue-700 shrink-0" />
              <span>Função de Apoio / Condução de Viatura. Não requer registro de check-in em escola eleitoral.</span>
            </div>
          )}
        </div>
      ) : (
        /* Para Policial com Posto Fixo Designado */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-6 w-full min-w-0">
          {/* Left Card: Military Credential Card */}
          <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 shadow-xs w-full min-w-0">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-12 h-14 sm:w-14 sm:h-16 flex items-center justify-center shrink-0">
                <Brasao40BPMI className="w-11 h-auto sm:w-13 drop-shadow-sm" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-[11px] font-extrabold uppercase text-slate-400 tracking-wider truncate">
                  {opm}
                </div>
                <h3 className="text-sm sm:text-lg font-extrabold text-slate-900 leading-tight break-words">
                  {formatCleanOfficerName(rank, name)}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <div className="font-mono text-xs sm:text-sm font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block">
                    RE: {re}
                  </div>
                  <div className="font-mono text-[10px] font-black text-blue-800 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md inline-block">
                    2º TURNO
                  </div>
                  {vehicle && (
                    <div className="font-mono text-xs sm:text-sm font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs">
                      <Car className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>VTR: {vehicle}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 sm:mt-6 sm:pt-5 border-t border-slate-100 space-y-2.5 sm:space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Função Operacional:</span>
                <span className="font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-right">
                  {roleName}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Contato Telefônico:</span>
                {phone ? (
                  <a
                    href={`tel:${phone}`}
                    className="font-bold text-blue-700 hover:underline inline-flex items-center gap-1 min-h-[36px] py-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {phone}
                  </a>
                ) : (
                  <span className="text-slate-400 font-medium">Não informado</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Horário de Serviço:</span>
                <span className="font-extrabold text-[#0F2B48]">
                  {shiftTimeDisplay}
                </span>
              </div>

              {designatedDrivers.morningDriver && designatedDrivers.afternoonDriver ? (
                <div className="flex flex-col gap-1 pt-1 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-medium">Motoristas Designados:</span>
                  <div className="text-[11.5px] font-semibold text-slate-700 pl-1 space-y-0.5">
                    <div><span className="text-amber-800 font-black">Manhã:</span> {formatCleanOfficerName(designatedDrivers.morningDriver.rank, designatedDrivers.morningDriver.name)}</div>
                    <div><span className="text-purple-800 font-black">Tarde:</span> {formatCleanOfficerName(designatedDrivers.afternoonDriver.rank, designatedDrivers.afternoonDriver.name)}</div>
                  </div>
                </div>
              ) : designatedDrivers.singleDriver ? (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">Motorista Designado:</span>
                  <span className="font-semibold text-slate-700">{formatCleanOfficerName(designatedDrivers.singleDriver.rank, designatedDrivers.singleDriver.name)}</span>
                </div>
              ) : designatedDrivers.teamMembers.length > 0 ? (
                <div className="flex flex-col gap-1 pt-1 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-medium">Equipe de Ronda:</span>
                  <div className="text-[11.5px] font-semibold text-slate-700 pl-1 space-y-0.5">
                    {designatedDrivers.teamMembers.map((tm, idx) => (
                      <div key={idx}>{formatCleanOfficerName(tm.rank, tm.name)}</div>
                    ))}
                  </div>
                </div>
              ) : driver ? (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">Motorista da Ronda:</span>
                  <span className="font-semibold text-slate-700">{driver}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Section: Posto Eleitoral / Ronda Execution */}
          <div className="lg:col-span-2 flex flex-col gap-3.5 sm:gap-6 w-full min-w-0">
            {isExcludedSupportRole ? (
              <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-xs w-full">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-[#0F2B48]">
                      {resolvedStaff?.function || staff?.function || 'Apoio Operacional / Motorista'}
                    </h4>
                    <span className="text-xs font-semibold text-slate-500">
                      Função de Apoio às Eleições 2026
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      Esta função operacional (<strong>{resolvedStaff?.function || staff?.function || 'Apoio / Motorista'}</strong>) está dispensada de check-in georreferenciado e registro de presença em posto escolar.
                    </p>
                  </div>
                  {(resolvedStaff?.vehicle || staff?.vehicle) && (
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Viatura / Prefixo:</span>
                      <span className="font-extrabold text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded font-mono">
                        {resolvedStaff?.vehicle || staff?.vehicle}
                      </span>
                    </div>
                  )}
                  {(resolvedStaff?.driver || staff?.driver) && (
                    <div className="pt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Equipe / Condutor:</span>
                      <span className="font-bold text-slate-800">
                        {resolvedStaff?.driver || staff?.driver}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : effectiveAssignedSchools.length > 0 ? (
              <div id="card-posto-fixo-checkin" className="flex flex-col gap-3.5 sm:gap-5 w-full min-w-0">
                {/* If officer has multiple assigned schools, show a concise header banner */}
                {effectiveAssignedSchools.length > 1 && (
                  <div className="bg-gradient-to-r from-[#0F2B48] to-blue-900 text-white rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-md border border-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 ring-2 ring-white/20">
                        <Building className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-black flex items-center gap-2 flex-wrap">
                          <span>Postos Eleitorais sob sua Responsabilidade</span>
                          <span className="text-[11px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                            {effectiveAssignedSchools.length} Postos
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-blue-100 mt-0.5">
                          Você está escalado em {effectiveAssignedSchools.length} escolas. Realize o check-in em cada posto ao se apresentar.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl border border-white/15 self-start sm:self-auto shrink-0">
                      <span className="text-xs font-semibold text-blue-200">Progresso:</span>
                      <span className="text-xs sm:text-sm font-black text-amber-300 font-mono">
                        {completedCheckInsCount} de {effectiveAssignedSchools.length}
                      </span>
                      <span className="text-[11px] text-blue-200">realizados</span>
                    </div>
                  </div>
                )}

                {/* Individual Cards for each assigned post */}
                {effectiveAssignedSchools.map((postItem, postIdx) => {
                  const postSchool = postItem.school;
                  const postShift = postItem.shift;
                  const postOfficer = postItem.officer;
                  const postCheckIn = getPostCheckInRecord(postSchool, postOfficer, postShift);
                  const rendicao = getRendicaoForPost(postSchool, postShift);
                  const reinforced = getReinforcedRosterForPost(postSchool);

                  const shiftLabel =
                    postShift === 'Manhã'
                      ? 'Turno Manhã · 06h às 13h'
                      : postShift === 'Tarde'
                      ? 'Turno Tarde · 13h ao término'
                      : 'Turno Integral · 06h ao término';

                  const isConfirmingDelete = postCheckIn && confirmDeleteId === postCheckIn.id;
                  const isDeleting = postCheckIn && isDeletingCheckInId === postCheckIn.id;

                  return (
                    <div
                      key={`assigned-post-${postSchool.id || postIdx}-${postShift}`}
                      className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 shadow-xs w-full min-w-0"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building className="w-5 h-5 text-blue-700 shrink-0" />
                          <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                            {effectiveAssignedSchools.length > 1
                              ? `Posto ${postIdx + 1} de ${effectiveAssignedSchools.length} · ${postSchool.city}`
                              : 'Posto Eleitoral Designado'}
                          </h4>
                          <span
                            className={`text-[10.5px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                              postShift === 'Manhã'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : postShift === 'Integral'
                                ? 'bg-purple-50 text-purple-900 border-purple-200'
                                : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                            }`}
                          >
                            {shiftLabel}
                          </span>
                        </div>
                        <span className="text-xs font-extrabold text-[#0F2B48] bg-slate-100 px-3 py-1 rounded-full uppercase">
                          {postSchool.city} · Zona {postSchool.zone}
                        </span>
                      </div>

                      {/* School Name & Location com Navegação Direta no Google Maps */}
                      <div className="mt-3.5 sm:mt-4">
                        <h5 className="text-base sm:text-lg font-extrabold text-[#0F2B48]">
                          {postSchool.school}
                        </h5>
                        <div className="mt-1 flex items-center min-w-0">
                          <a
                            href={getGoogleMapsNavigationUrl(postSchool)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Toque para abrir rota e navegar pelo Google Maps"
                            className="group inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-700 min-w-0 max-w-full transition cursor-pointer"
                          >
                            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
                            <span className="truncate group-hover:underline font-medium">
                              {getSchoolDisplayAddress(postSchool)}
                            </span>
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-[9.5px] font-bold text-blue-700 bg-blue-50 group-hover:bg-blue-100 border border-blue-200/90 px-1.5 py-0.2 rounded transition shadow-2xs">
                              <span>Maps</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          </a>
                        </div>
                      </div>

                      {/* Check-in Status Box */}
                      <div className="mt-4 sm:mt-5 p-3 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-slate-50 border-slate-200">
                        <div className="min-w-0">
                          <div className="text-[10px] sm:text-[11px] font-extrabold uppercase text-slate-400">
                            Status de Presença no Posto
                          </div>
                          {postCheckIn ? (
                            <div className="flex items-center gap-2 mt-1">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                              <span className="text-xs sm:text-sm font-extrabold text-emerald-800">
                                Check-in Confirmado às {postCheckIn.time}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-1">
                              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                              <span className="text-xs sm:text-sm font-extrabold text-amber-900">
                                Pendente de Check-in para este Posto ({postShift === 'Integral' ? 'Integral' : postShift})
                              </span>
                            </div>
                          )}

                          {postCheckIn && (
                            <div className="text-xs text-slate-500 font-mono mt-2 space-y-0.5">
                              <div>Protocolo: <strong className="text-slate-800">{postCheckIn.protocol}</strong></div>
                              {postCheckIn.distanceMeters !== null && (
                                <div>
                                  Distância do Posto: <strong className={postCheckIn.isOutOfRange ? 'text-amber-700' : 'text-emerald-700'}>
                                    {postCheckIn.distanceMeters} metros
                                  </strong>{' '}
                                  {postCheckIn.isOutOfRange && (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-sans font-bold">
                                      Acima de 150m
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="w-full sm:w-auto flex items-center gap-2">
                          {isGcmOfficer(postOfficer) ? (
                            <div className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold flex items-center justify-center gap-2 shadow-2xs">
                              <Shield className="w-4 h-4 text-blue-700" />
                              <span>Rendição por Guarda Civil Municipal (GCM) · Check-in PMESP não aplicável</span>
                            </div>
                          ) : !postCheckIn ? (
                            <button
                              id={`btn-perform-checkin-${postSchool.id || postIdx}`}
                              onClick={() => handleTriggerCheckInForPost(postSchool, postShift, postOfficer)}
                              className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-extrabold rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                            >
                              <MapPin className="w-4 h-4" />
                              <span>
                                {effectiveAssignedSchools.length > 1
                                  ? `Fazer Check-in neste Posto (${postShift === 'Integral' ? 'Integral' : postShift})`
                                  : 'Realizar Check-in Georreferenciado'}
                              </span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                              <div className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex-1 sm:flex-initial">
                                <FileCheck className="w-4 h-4 text-emerald-700" />
                                Presença Auditada
                              </div>
                              {onDeleteCheckIn && (
                                <div>
                                  {!isConfirmingDelete ? (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(postCheckIn.id)}
                                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 flex-1 sm:flex-initial"
                                      title="Desfazer/apagar este check-in"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                      <span>Desfazer Check-in</span>
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-2 p-2 bg-red-50/80 border border-red-200 rounded-xl">
                                      <span className="text-[11px] font-bold text-red-800">
                                        Confirmar exclusão?
                                      </span>
                                      <button
                                        type="button"
                                        disabled={isDeleting}
                                        onClick={async () => {
                                          setIsDeletingCheckInId(postCheckIn.id);
                                          try {
                                            await onDeleteCheckIn(
                                              postCheckIn.id,
                                              `${rank} ${name} (RE: ${re})`,
                                              postSchool.school,
                                              postCheckIn
                                            );
                                            setConfirmDeleteId(null);
                                          } finally {
                                            setIsDeletingCheckInId(null);
                                          }
                                        }}
                                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-black cursor-pointer shadow-xs"
                                      >
                                        {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isDeleting}
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Rendição Card */}
                      {postShift === 'Manhã' && rendicao && (
                        <div className="mt-4 sm:mt-5 p-3.5 sm:p-4 rounded-xl border border-blue-200/80 bg-blue-50/40">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0F2B48] flex items-center gap-1.5">
                              <UserCheck className="w-4 h-4 text-blue-700" />
                              <span>
                                {isGcmOfficer(rendicao) ? 'Rendição no Posto: Guarda Civil Municipal (GCM)' : 'Policial da Rendição neste Posto'}
                              </span>
                            </span>
                            <span className="text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              {isGcmOfficer(rendicao) && <Shield className="w-3 h-3 text-blue-700" />}
                              <span>{isGcmOfficer(rendicao) ? 'Rendição GCM · 13h ao término' : 'Turno da Tarde · 13h ao término'}</span>
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                                {isGcmOfficer(rendicao) ? 'Guarda Civil Municipal (GCM)' : `${rendicao.rank} ${rendicao.name}`}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {isGcmOfficer(rendicao) ? (
                                  <span className="text-xs font-extrabold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                                    <Shield className="w-3 h-3 text-blue-700" />
                                    Rendição GCM
                                  </span>
                                ) : (
                                  <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                    RE: {rendicao.re}
                                  </span>
                                )}
                                <span className="text-[11px] text-slate-500 font-medium">
                                  Assume este posto às 13h
                                </span>
                              </div>
                            </div>

                            {isGcmOfficer(rendicao) ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-900 text-xs font-bold border border-blue-200 shadow-2xs">
                                <Shield className="w-4 h-4 text-blue-700" />
                                <span>Rendição sob responsabilidade da Guarda Municipal</span>
                              </div>
                            ) : rendicao.phone ? (
                              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                <a
                                  href={`tel:${rendicao.phone}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition border border-blue-200 shadow-2xs cursor-pointer active:scale-95"
                                  title="Ligar para o policial da rendição"
                                >
                                  <Phone className="w-3.5 h-3.5 text-blue-700" />
                                  <span>Ligar ({rendicao.phone})</span>
                                </a>
                                <a
                                  href={`https://wa.me/55${rendicao.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition border border-emerald-200 shadow-2xs cursor-pointer active:scale-95"
                                  title="Enviar mensagem no WhatsApp para a rendição"
                                >
                                  <span>WhatsApp</span>
                                </a>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium italic">
                                Telefone não cadastrado
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Reinforced Staffing Card (if applicable) */}
                      {reinforced && (
                        <div className="mt-4 sm:mt-5 p-3.5 sm:p-4 rounded-xl border border-indigo-200 bg-indigo-50/30">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                              <Shield className="w-4 h-4 text-indigo-700" />
                              <span>Efetivo Completo Escalado ({reinforced.total} Policiais Militares)</span>
                            </span>
                            <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                              Posto com Efetivo Reforçado
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Manhã */}
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                              <div className="flex items-center justify-between gap-1 mb-2 pb-1.5 border-b border-slate-100">
                                <span className="text-[10.5px] font-black text-amber-900 uppercase">
                                  Turno Manhã (06h - 13h) · {reinforced.amList.length} PMs
                                </span>
                              </div>
                              <div className="flex flex-col gap-2">
                                {reinforced.amList.map((off, idx) => {
                                  const isCur = matchesExactRe(off.re, re);
                                  const isGcm = isGcmOfficer(off);
                                  const offRecord = !isGcm ? findOfficerCheckIn(postSchool, off, 'Manhã', allCheckIns) : undefined;
                                  return (
                                    <div
                                      key={`am-roster-${off.re || idx}`}
                                      className={`p-2 rounded-lg border text-xs transition ${
                                        isCur
                                          ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-300'
                                          : 'bg-slate-50/80 border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-extrabold text-slate-900 truncate">
                                          {isGcm ? 'Guarda Civil Municipal (GCM)' : `${off.rank} ${off.name}`} {isCur && <span className="text-[10px] text-blue-700 font-black">(Você)</span>}
                                        </span>
                                        {isGcm ? (
                                          <span className="text-[9px] font-extrabold text-blue-900 bg-blue-100 px-1.5 py-0.2 rounded border border-blue-200 shrink-0">
                                            Rendição GCM
                                          </span>
                                        ) : offRecord ? (
                                          <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                                            OK às {offRecord.time}
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 shrink-0">
                                            Pendente
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-500 font-mono mt-1 flex items-center justify-between gap-2">
                                        {isGcm ? (
                                          <span className="text-blue-900 font-bold">GCM</span>
                                        ) : onSearchByRe && off.re ? (
                                          <button
                                            type="button"
                                            onClick={() => onSearchByRe(off.re)}
                                            className="text-blue-700 font-bold hover:underline cursor-pointer"
                                          >
                                            RE: {off.re}
                                          </button>
                                        ) : (
                                          <span>RE: {off.re || '—'}</span>
                                        )}
                                        {off.phone && (
                                          <a href={`tel:${off.phone}`} className="text-blue-700 font-bold hover:underline inline-flex items-center gap-0.5">
                                            <Phone className="w-3 h-3" />
                                            <span>{off.phone}</span>
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Tarde */}
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                              <div className="flex items-center justify-between gap-1 mb-2 pb-1.5 border-b border-slate-100">
                                <span className="text-[10.5px] font-black text-blue-900 uppercase">
                                  Turno Tarde (13h - Término) · {reinforced.pmList.length} PMs
                                </span>
                              </div>
                              <div className="flex flex-col gap-2">
                                {reinforced.pmList.map((off, idx) => {
                                  const isCur = matchesExactRe(off.re, re);
                                  const isGcm = isGcmOfficer(off);
                                  const offRecord = !isGcm ? findOfficerCheckIn(postSchool, off, 'Tarde', allCheckIns) : undefined;
                                  return (
                                    <div
                                      key={`pm-roster-${off.re || idx}`}
                                      className={`p-2 rounded-lg border text-xs transition ${
                                        isCur
                                          ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-300'
                                          : 'bg-slate-50/80 border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-extrabold text-slate-900 truncate">
                                          {isGcm ? 'Guarda Civil Municipal (GCM)' : `${off.rank} ${off.name}`} {isCur && <span className="text-[10px] text-blue-700 font-black">(Você)</span>}
                                        </span>
                                        {isGcm ? (
                                          <span className="text-[9px] font-extrabold text-blue-900 bg-blue-100 px-1.5 py-0.2 rounded border border-blue-200 shrink-0">
                                            Rendição GCM
                                          </span>
                                        ) : offRecord ? (
                                          <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                                            OK às {offRecord.time}
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 shrink-0">
                                            Pendente
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-500 font-mono mt-1 flex items-center justify-between gap-2">
                                        {isGcm ? (
                                          <span className="text-blue-900 font-bold">GCM</span>
                                        ) : onSearchByRe && off.re ? (
                                          <button
                                            type="button"
                                            onClick={() => onSearchByRe(off.re)}
                                            className="text-blue-700 font-bold hover:underline cursor-pointer"
                                          >
                                            RE: {off.re}
                                          </button>
                                        ) : (
                                          <span>RE: {off.re || '—'}</span>
                                        )}
                                        {off.phone && (
                                          <a href={`tel:${off.phone}`} className="text-blue-700 font-bold hover:underline inline-flex items-center gap-0.5">
                                            <Phone className="w-3 h-3" />
                                            <span>{off.phone}</span>
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Tabelas de Rondas e Escolas para Policiais de Ronda / Fiscalização */}
      {showRondaSection && (
        <div id="section-tabelas-operacionais" className="w-full mt-2 sm:mt-4 flex flex-col gap-3">
          {/* Main Tabs Navigation (Desktop only - no celular é controlado diretamente pelo Menu Inferior) */}
          <div className="hidden md:flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              id="tab-btn-escolas"
              onClick={() => handleTabSelect('escolas')}
              className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer flex-1 sm:flex-initial flex items-center justify-center gap-2 ${
                effectiveActiveTab === 'escolas'
                  ? 'bg-[#0F2B48] text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <School className="w-4 h-4" />
              <span>Postos & Check-ins</span>
              {(sectorSchools.length > 0 || allSchools.length > 0) && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    effectiveActiveTab === 'escolas' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {(sectorSchools.length > 0 ? sectorSchools : allSchools).length}
                </span>
              )}
            </button>

            <button
              id="tab-btn-rondas"
              onClick={() => handleTabSelect('rondas')}
              className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer flex-1 sm:flex-initial flex items-center justify-center gap-2 ${
                effectiveActiveTab === 'rondas'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Rondas do Batalhão</span>
              {myOfficerRondas.length > 0 && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    effectiveActiveTab === 'rondas' ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-800'
                  }`}
                >
                  {myOfficerRondas.length}
                </span>
              )}
            </button>
          </div>

          {/* Active Tab View */}
          {effectiveActiveTab === 'escolas' ? (
            <PendingSchoolsTable
              schools={sectorSchools.length > 0 ? sectorSchools : allSchools}
              checkInList={allCheckIns}
              staffList={staffList}
              onSelectSchoolForCheckIn={onSelectSchoolForCheckIn || (() => {})}
              onSearchByRe={onSearchByRe || (() => {})}
              onDeleteCheckIn={onDeleteCheckIn}
              title={
                normalizeText(staff?.local || '').includes('40') || !staff?.local
                  ? 'Relação de Escolas · 40º BPM/I'
                  : `Relação de Escolas · ${staff?.local}`
              }
              subtitle={`Relação de postos eleitorais sob fiscalização do seu setor (${staff?.local || '40º BPM/I'}). As escolas com check-in realizado saem automaticamente da pendência.`}
              defaultOnlyPending={true}
            />
          ) : (
            <SectorRondasTab
              isSupervisorView={false}
              sectorSchools={sectorSchools.length > 0 ? sectorSchools : allSchools}
              rondasMade={rondasMade}
              allRondas={allRondas}
              staffList={staffList}
              onOpenRondaWithSchool={(schoolId) => onOpenRonda(schoolId)}
              onOpenGeneralRonda={() => onOpenRonda()}
              onDeleteRonda={onDeleteRonda}
              officerRank={rank}
              officerName={name}
              officerRe={re}
              officerStaff={resolvedStaff || staff}
              sectorName={resolvedStaff?.local || staff?.local || '40º BPM/I'}
            />
          )}
        </div>
      )}

      {/* Menu Inferior Fixo Mobile: Exibido SOMENTE na tela dos Rondantes com [ Postos ] e [ Rondas ] */}
      {showRondaSection && (
        <nav
          aria-label="Menu de Navegação Mobile Rondantes"
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-safe md:hidden"
        >
          <div className="grid grid-cols-2 items-center px-4 py-1.5 max-w-sm mx-auto gap-3">
            <button
              type="button"
              id="mobile-nav-btn-postos"
              onClick={() => {
                handleTabSelect('escolas');
                const el = document.getElementById('section-tabelas-operacionais');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition cursor-pointer active:scale-95 relative ${
                effectiveActiveTab === 'escolas'
                  ? 'text-[#0F2B48] font-black bg-blue-50/80 border border-blue-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="relative">
                <School className={`w-5 h-5 ${effectiveActiveTab === 'escolas' ? 'text-[#0F2B48]' : 'text-slate-500'}`} />
                {(sectorSchools.length > 0 || allSchools.length > 0) && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-blue-600 text-white text-[8px] font-black rounded-full leading-none">
                    {(sectorSchools.length > 0 ? sectorSchools : allSchools).length}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-extrabold tracking-tight mt-0.5">Postos</span>
            </button>

            <button
              type="button"
              id="mobile-nav-btn-rondas"
              onClick={() => {
                handleTabSelect('rondas');
                const el = document.getElementById('section-tabelas-operacionais');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition cursor-pointer active:scale-95 relative ${
                effectiveActiveTab === 'rondas'
                  ? 'text-purple-700 font-black bg-purple-50/80 border border-purple-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="relative">
                <Radio className={`w-5 h-5 ${effectiveActiveTab === 'rondas' ? 'text-purple-700' : 'text-slate-500'}`} />
                {myOfficerRondas.length > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-purple-600 text-white text-[8px] font-black rounded-full leading-none">
                    {myOfficerRondas.length}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-extrabold tracking-tight mt-0.5">Rondas</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};
