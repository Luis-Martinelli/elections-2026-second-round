/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Shield, UserCheck, Smartphone, Unlink, CheckCircle2, School, Radio, ShieldAlert, FileCheck, AlertTriangle, RotateCcw, Car, LogOut } from 'lucide-react';
import {
  StaffMember,
  SchoolItem,
  SchoolOfficer,
  CheckInRecord,
  RondaRecord,
  GoogleSheetsConfig
} from './types';
import { INITIAL_STAFF, INITIAL_SCHOOLS } from './data/initialData';
import { organizeStaffWithDriverPairing } from './components/EmpenhoEfetivoTab';
import { matchesQuery, matchesExactRe, normalizeRe, normalizeText } from './utils/normalize';
import {
  initAuth,
  getAccessToken,
  getSpreadsheetTabs,
  readSpreadsheetValues,
  parseFixedStaffSheet,
  parseMotorizedStaffSheet,
  loadAllSchoolsFromSpreadsheet,
  loadAllStaffFromSpreadsheet,
  loadCoordinatesFromSpreadsheet,
  appendCheckInToSheet,
  appendRondaToSheet,
  appendAuditJustificationToSheet,
  hasQueuedSheetRows,
  flushSheetsQueue
} from './services/googleWorkspace';
import {
  getSchoolsFromCloud,
  subscribeSchools,
  saveSchoolsToCloud,
  getStaffFromCloud,
  subscribeStaff,
  saveStaffToCloud,
  subscribeCheckIns,
  saveCheckInToCloud,
  updateCheckInAuditInCloud,
  subscribeRondas,
  saveRondaToCloud,
  getSystemConfigFromCloud,
  subscribeSystemConfig,
  saveSystemConfigToCloud,
  getDeviceBindingFromCloud,
  saveDeviceBindingToCloud,
  removeDeviceBindingFromCloud,
  removeDeviceBindingByReFromCloud,
  saveAuditLogToCloud,
  deleteAuditLogFromCloud,
  subscribeAuditLogs,
  clearTestDataFromCloud,
  wipeEntireDatabaseFromCloud,
  deleteCheckInFromCloud,
  deleteRondaFromCloud,
  isFirestoreQuotaExhausted,
  clearFirestoreQuotaExhausted,
  subscribeQuotaStatus,
  getClearedTestDataTimestamp,
  isValidActiveRecord,
  updateCheckInsAuditBatchInCloud,
  mergeCheckInLists,
  DayRange
} from './services/firestoreService';

import { Header } from './components/Header';
import { HeroSearch } from './components/HeroSearch';
import { KpiGrid, KpiFilterType } from './components/KpiGrid';
import { KpiDetailsModal } from './components/KpiDetailsModal';
import { PendingSchoolsTable } from './components/PendingSchoolsTable';
import { SectorRondasTab } from './components/SectorRondasTab';
import { EmpenhoEfetivoTab } from './components/EmpenhoEfetivoTab';
import { CheckInAuditTab } from './components/CheckInAuditTab';
import { ReAuditTab } from './components/ReAuditTab';
import { DeviceManagementTab } from './components/DeviceManagementTab';
import { OfficerDetailView } from './components/OfficerDetailView';
import { CheckInModal } from './components/CheckInModal';
import { RondaModal } from './components/RondaModal';
import { GoogleSheetsConfigModal } from './components/GoogleSheetsConfigModal';
import { ReportExportModal } from './components/ReportExportModal';
import { ResetSystemModal } from './components/ResetSystemModal';
import { ReGateScreen } from './components/ReGateScreen';
import { ConfirmIdentityModal } from './components/ConfirmIdentityModal';
import { JustificationModal } from './components/JustificationModal';
import { SupervisorAuthModal } from './components/SupervisorAuthModal';
import { UnbindDeviceModal } from './components/UnbindDeviceModal';
import { computeShiftKpis, ShiftKpiSummary, hasVerifiedLocation, isOutsideRadius, isSchoolFullDay, isRondaRoleOrSchool, isGcmSchool, getSchoolAmOfficers, getSchoolPmOfficers, isGcmOfficer } from './utils/checkinStatus';
import { filterSchoolsByJurisdiction } from './utils/jurisdiction';
import { resolveMunicipality, BPM40_CITIES, normalizeCityName } from './utils/municipality';
import { findSchoolCoordinates, SchoolGeoEntry, registerDynamicCoordinates, matchSchoolWithGeoEntries } from './data/schoolCoordinates';
import {
  getOrCreateDeviceId,
  getDeviceBinding,
  saveDeviceBinding,
  clearDeviceBinding
} from './utils/security';
import { DeviceBinding, AuditJustificationRecord, DEFAULT_SHEETS_CONFIG } from './types';

const STORAGE_KEYS = {
  CHECKINS: 'pmesp_eleicoes_checkins_v1',
  RONDAS: 'pmesp_eleicoes_rondas_v1',
  CONFIG: 'pmesp_eleicoes_sheets_config_v1',
  SCHOOLS: 'pmesp_eleicoes_schools_v1',
  STAFF: 'pmesp_eleicoes_staff_v1'
};

// Helper to filter out synthetic phantom records (e.g., MOT-1, MOT-2, Comandante duplicate rows)
export function isRealStaffMember(item: StaffMember): boolean {
  if (!item || !item.re) return false;
  const reUpper = item.re.trim().toUpperCase();
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
}

const EMPTY_KPIS: ShiftKpiSummary = {
  totalSchools: 0,
  morningDone: 0,
  morningPending: 0,
  afternoonDone: 0,
  afternoonPending: 0,
  fullDayCount: 0
};

// 'yyyy-mm-dd' of the device's local date
function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// [local midnight, next local midnight) of a 'yyyy-mm-dd' day
function dayRangeOf(dayKey: string): DayRange {
  const [y, m, d] = dayKey.split('-').map(Number);
  return {
    from: new Date(y, m - 1, d).getTime(),
    to: new Date(y, m - 1, d + 1).getTime()
  };
}

export default function App() {
  // 2. Data State - Initialized from persistent storage if available
  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STAFF);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter(isRealStaffMember);
          // Fill missing phone numbers and sync canonical function / driver / vehicle from INITIAL_STAFF
          const synced = clean.map((item: StaffMember) => {
            const fallback = INITIAL_STAFF.find((init) => matchesExactRe(init.re, item.re));
            if (fallback) {
              return {
                ...item,
                phone: item.phone && item.phone.trim() !== '' ? item.phone : fallback.phone,
                function: fallback.function || item.function,
                driver: fallback.driver || item.driver,
                vehicle: fallback.vehicle || item.vehicle
              };
            }
            return item;
          });
          // Organize according to hierarchy and designated driver pairing (same sector, shift, vehicle)
          return organizeStaffWithDriverPairing(synced);
        }
      }
    } catch {}
    return INITIAL_STAFF;
  });

  const [schoolList, setSchoolList] = useState<SchoolItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 150) {
          // Self-heal any legacy corrupted cache or unassigned municipalities
          const healed = parsed.map((s: SchoolItem) => {
            let item = { ...s };
            if (item && item.am && item.pm) {
              if (matchesExactRe(item.am.re, '136575') && item.am.name?.toUpperCase().includes('PEIXOTO')) {
                item = {
                  ...item,
                  am: { ...item.am, re: '111933-2', name: 'José Peixoto' },
                  pm: { ...item.pm, re: '136575-8', name: 'Luan Felipe' }
                };
              }
              if (matchesExactRe(item.pm.re, '111933') && item.pm.name?.toUpperCase().includes('LUAN')) {
                item = {
                  ...item,
                  am: { ...item.am, re: '111933-2', name: 'José Peixoto' },
                  pm: { ...item.pm, re: '136575-8', name: 'Luan Felipe' }
                };
              }
            }
            const resolvedCity = resolveMunicipality(
              item.city,
              item.school,
              item.address,
              item.bairro,
              item.zone,
              item.opm
            );
            if (resolvedCity) {
              item.city = resolvedCity;
            }
            const geo = (!item.lat || !item.lng) ? findSchoolCoordinates(item.school, item.city) : null;
            if (geo) {
              if (!item.lat) item.lat = geo.lat;
              if (!item.lng) item.lng = geo.lng;
              if (!item.address) item.address = geo.address;
            }
            return item;
          });

          const sanitized = healed.filter((s: SchoolItem) => !isGcmSchool(s));

          try {
            localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(sanitized));
          } catch {}

          return sanitized;
        }
      }
    } catch {}
    return INITIAL_SCHOOLS.map((item) => {
      const geo = (!item.lat || !item.lng) ? findSchoolCoordinates(item.school, item.city) : null;
      if (geo) {
        return {
          ...item,
          lat: item.lat ?? geo.lat,
          lng: item.lng ?? geo.lng,
          address: item.address ?? geo.address
        };
      }
      return item;
    });
  });

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHECKINS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Deduplicate by id and filter cleared test data; only today's records until the
          // first snapshot arrives (older cached days must not show up as today's)
          const today = dayRangeOf(todayKey());
          const map = new Map<string, CheckInRecord>();
          parsed.forEach((c) => {
            if (c && c.id && isValidActiveRecord(c) && c.timestamp >= today.from && c.timestamp < today.to) {
              map.set(c.id, c);
            }
          });
          return Array.from(map.values());
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [rondas, setRondas] = useState<RondaRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RONDAS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const today = dayRangeOf(todayKey());
          const map = new Map<string, RondaRecord>();
          parsed.forEach((r) => {
            if (r && r.id && isValidActiveRecord(r) && r.timestamp >= today.from && r.timestamp < today.to) {
              map.set(r.id, r);
            }
          });
          return Array.from(map.values());
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  // 3. Google Workspace & Auth State
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SHEETS_CONFIG,
          ...parsed,
          fixedStaffSheetId: parsed.fixedStaffSheetId || DEFAULT_SHEETS_CONFIG.fixedStaffSheetId,
          motorizedStaffSheetId: parsed.motorizedStaffSheetId || DEFAULT_SHEETS_CONFIG.motorizedStaffSheetId,
          coordinatesSheetId: parsed.coordinatesSheetId || DEFAULT_SHEETS_CONFIG.coordinatesSheetId
        };
      }
    } catch {}
    return DEFAULT_SHEETS_CONFIG;
  });

  // 4. Modals State
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeKpiModal, setActiveKpiModal] = useState<KpiFilterType | null>(null);
  const [activeCheckInModal, setActiveCheckInModal] = useState<{
    school: SchoolItem;
    officerRe: string;
    officerName: string;
    rank: string;
    shift: 'Manhã' | 'Tarde' | 'Integral';
  } | null>(null);

  const [activeRondaModal, setActiveRondaModal] = useState<{
    officerRe: string;
    officerName: string;
    rank: string;
    defaultSchoolId?: string;
    sectorSchools?: SchoolItem[];
  } | null>(null);

  // 5. Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOfficerMatch, setSelectedOfficerMatch] = useState<{
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
  } | null>(null);

  // 6. Security, Identity Binding & Access Control States
  const [deviceBinding, setDeviceBinding] = useState<DeviceBinding | null>(() => getDeviceBinding());
  const [isSupervisorMode, setIsSupervisorMode] = useState<boolean>(false);
  // Day shown in the supervisor panel ('yyyy-mm-dd'); officer devices always show today.
  // Separates the 1st and 2nd election rounds without deleting any history.
  const [supervisorDay, setSupervisorDay] = useState<string>(() => todayKey());
  const activeDayKey = isSupervisorMode ? supervisorDay : todayKey();
  const activeRange = useMemo(() => dayRangeOf(activeDayKey), [activeDayKey]);
  const [supervisorTab, setSupervisorTab] = useState<
    'escolas' | 'rondas' | 'empenho' | 'auditoria-checkins' | 'auditoria' | 'aparelhos'
  >('escolas');

  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isConfirmLogoutOpen, setIsConfirmLogoutOpen] = useState(false);
  const [isIdentityConfirmOpen, setIsIdentityConfirmOpen] = useState(false);
  const [isJustificationOpen, setIsJustificationOpen] = useState(false);
  const [isUnbindModalOpen, setIsUnbindModalOpen] = useState(false);
  const [unbindNotification, setUnbindNotification] = useState<string | null>(null);
  const [candidateForAction, setCandidateForAction] = useState<{
    staff?: StaffMember;
    schoolItem?: SchoolItem;
    assignedShift?: 'Manhã' | 'Tarde' | 'Integral';
    isMotorized?: boolean;
    name: string;
    rank: string;
    re: string;
  } | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditJustificationRecord[]>(() => {
    try {
      const saved = localStorage.getItem('pmesp_eleicoes_audit_logs_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleSetSupervisorMode = (active: boolean) => {
    setIsSupervisorMode(active);
    try {
      if (active) {
        sessionStorage.setItem('pmesp_supervisor_mode', 'true');
      } else {
        sessionStorage.removeItem('pmesp_supervisor_mode');
      }
    } catch {}
  };

  // Cloud Firestore Real-time Connection & Quota State
  const [cloudConnected, setCloudConnected] = useState<boolean>(true);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState<boolean>(() => isFirestoreQuotaExhausted());

  useEffect(() => {
    return subscribeQuotaStatus((exhausted) => {
      setIsQuotaExhausted(exhausted);
      if (exhausted) {
        setCloudConnected(false);
      }
    });
  }, []);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth((authenticatedUser, accessToken) => {
      setUser(authenticatedUser);
      setToken(accessToken);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // 1. Subscribe to Firestore Collections in Real-time
  const handleSubError = useCallback((err: any) => {
    // If code=unavailable or resource-exhausted (quota limit), fallback to local cache
    if (
      err?.code === 'unavailable' ||
      err?.code === 'resource-exhausted' ||
      err?.message?.includes('Quota limit exceeded') ||
      err?.message?.includes('resource-exhausted')
    ) {
      setCloudConnected(false);
    }
  }, []);

  // 1a. Reference data shared by every device (small collections)
  useEffect(() => {
    // A. Subscribe to Schools (Postos Eleitorais)
    // Read-only on every device: only the manual P/3 import writes schools to Firestore/Cloud SQL.
    const unsubSchools = subscribeSchools((cloudSchools) => {
      if (cloudSchools && cloudSchools.length > 0) {
        const sanitizedCloud = cloudSchools.filter((s) => !isGcmSchool(s));
        setSchoolList(sanitizedCloud);
        try {
          localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(sanitizedCloud));
        } catch {}
      }
      setCloudConnected(true);
    }, handleSubError);

    // B. Subscribe to Motorized/Support Staff
    const unsubStaff = subscribeStaff((cloudStaff) => {
      if (cloudStaff && cloudStaff.length > 0) {
        const clean = cloudStaff.filter(isRealStaffMember);
        const healed = clean.map((item) => {
          if (!item.phone || !item.phone.trim()) {
            const fallback = INITIAL_STAFF.find((init) => matchesExactRe(init.re, item.re));
            if (fallback?.phone) {
              return { ...item, phone: fallback.phone };
            }
          }
          return item;
        });
        const pairedStaff = organizeStaffWithDriverPairing(healed);
        setStaffList(pairedStaff);
        try {
          localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(pairedStaff));
        } catch {}
      }
      setCloudConnected(true);
    }, handleSubError);

    // C. Subscribe to System / Sheets Config
    const unsubConfig = subscribeSystemConfig((cloudCfg) => {
      if (cloudCfg) {
        setSheetsConfig((prev) => ({
          ...prev,
          ...cloudCfg
        }));
        setCloudConnected(true);
      }
    }, handleSubError);

    // D. Sync current device binding from cloud if local binding is active
    const localBinding = getDeviceBinding();
    if (localBinding?.deviceId) {
      getDeviceBindingFromCloud(localBinding.deviceId).then((cloudBinding) => {
        if (cloudBinding) {
          setDeviceBinding(cloudBinding);
        }
      }).catch(() => {});
    }

    return () => {
      unsubSchools();
      unsubStaff();
      unsubConfig();
    };
  }, [handleSubError]);

  // 1b. Check-ins and rondas of a single day (tempo real direto da nuvem Firestore)
  useEffect(() => {
    const unsubCheckIns = subscribeCheckIns((cloudCheckIns) => {
      setCheckIns((prev) => {
        // Mescla garantindo que check-ins recém-feitos localmente nunca sejam apagados
        return mergeCheckInLists(cloudCheckIns || [], prev);
      });
      setCloudConnected(true);
    }, handleSubError, activeRange);

    const unsubRondas = subscribeRondas((cloudRondas) => {
      setRondas(cloudRondas || []);
      setCloudConnected(true);
    }, handleSubError, activeRange);

    return () => {
      unsubCheckIns();
      unsubRondas();
    };
  }, [activeRange, handleSubError]);

  // 1c. Audit logs are only shown in the supervisor panel
  useEffect(() => {
    if (!isSupervisorMode) return;
    return subscribeAuditLogs((cloudLogs) => {
      if (cloudLogs && cloudLogs.length > 0) {
        setAuditLogs(cloudLogs as AuditJustificationRecord[]);
        setCloudConnected(true);
      }
    }, handleSubError);
  }, [isSupervisorMode, handleSubError]);

  useEffect(() => {
    localStorage.setItem('pmesp_eleicoes_audit_logs_v1', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Save check-ins, rondas, schools, and staff to localStorage
  // Check-ins/rondas change on every snapshot, so their (large) writes are debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(checkIns));
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [checkIns]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.RONDAS, JSON.stringify(rondas));
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [rondas]);

  useEffect(() => {
    if (schoolList && schoolList.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(schoolList));
      } catch (e) {
        console.warn('Erro ao salvar escolas localmente:', e);
      }
    }
  }, [schoolList]);

  useEffect(() => {
    if (staffList && staffList.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staffList));
      } catch (e) {
        console.warn('Erro ao salvar efetivo localmente:', e);
      }
    }
  }, [staffList]);

  const handleSaveConfig = (newCfg: GoogleSheetsConfig) => {
    setSheetsConfig(newCfg);
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(newCfg));
    // Persist to Cloud Firestore so all operators receive the configuration
    saveSystemConfigToCloud(newCfg).catch((err) =>
      console.warn('Falha ao salvar configurações na nuvem:', err)
    );
  };

  // Load from Sheets with robust multi-tab discovery, coordinates, and motorized staff support
  const handleLoadFromSheets = async (
    fixedSheetId: string,
    motorizedSheetId?: string,
    coordinatesSheetId?: string,
    explicitToken?: string | null,
    syncToCloud: boolean = true
  ): Promise<{ schoolsCount: number; staffCount: number; coordinatesCount?: number }> => {
    const activeToken = explicitToken || token || getAccessToken();
    if (!fixedSheetId) {
      throw new Error('ID da planilha de Efetivo Fixo não informado.');
    }

    setIsSyncing(true);
    try {
      // 0. If coordinates sheet is configured, load coordinates first and register dynamically
      let loadedCoordinates: SchoolGeoEntry[] = [];
      const effectiveCoordinatesId = coordinatesSheetId || sheetsConfig.coordinatesSheetId;
      if (effectiveCoordinatesId) {
        try {
          loadedCoordinates = await loadCoordinatesFromSpreadsheet(effectiveCoordinatesId, activeToken);
        } catch (coordErr) {
          console.warn('Planilha de coordenadas não pôde ser lida:', coordErr);
        }
      }

      // 1. Discover and load ALL schools across all relevant tabs (Votorantim, Ibiúna, Piedade, etc.)
      const parsedSchools = await loadAllSchoolsFromSpreadsheet(
        fixedSheetId,
        activeToken,
        sheetsConfig.checkinsTabName || 'Check-ins_Eleicoes2026'
      );

      if (parsedSchools.length > 0) {
        const normalizedSchools = parsedSchools.map((s) => {
          const resolvedCity = resolveMunicipality(s.city, s.school, s.address, s.bairro, s.zone, s.opm);

          let schoolLat = s.lat;
          let schoolLng = s.lng;
          let schoolAddress = s.address;
          let schoolBairro = s.bairro;

          // Check if coordinates directly on row are corrupted, identical, or out of range
          if (
            typeof schoolLat === 'number' &&
            typeof schoolLng === 'number' &&
            (Math.abs(schoolLat - schoolLng) < 0.001 || schoolLng > -40 || schoolLat > -15)
          ) {
            schoolLat = undefined;
            schoolLng = undefined;
          }

          // 1. Check against newly loaded coordinates spreadsheet (dynamic from Google Sheets)
          if (loadedCoordinates.length > 0) {
            const matched = matchSchoolWithGeoEntries(s.school, resolvedCity, loadedCoordinates);
            if (matched && typeof matched.latitude === 'number' && typeof matched.longitude === 'number') {
              schoolLat = matched.latitude;
              schoolLng = matched.longitude;
              if (matched.logradouro) schoolAddress = matched.logradouro;
              if (matched.bairro) schoolBairro = matched.bairro;
            }
          }

          // 2. If still no valid lat/lng, check official coordinates registry
          if (typeof schoolLat !== 'number' || typeof schoolLng !== 'number') {
            const geoMatch = findSchoolCoordinates(s.school, resolvedCity);
            if (geoMatch && geoMatch.lat && geoMatch.lng) {
              schoolLat = geoMatch.lat;
              schoolLng = geoMatch.lng;
              if (!schoolAddress) schoolAddress = geoMatch.address;
              if (!schoolBairro && geoMatch.bairro) schoolBairro = geoMatch.bairro;
            }
          }

          return {
            ...s,
            city: resolvedCity,
            lat: schoolLat,
            lng: schoolLng,
            address: schoolAddress,
            bairro: schoolBairro || s.bairro
          };
        }).filter((s) => !isGcmSchool(s));

        setSchoolList(normalizedSchools);
        try {
          localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(normalizedSchools));
        } catch (e) {}

        // Sincroniza em lote no Firestore somente na importação manual da P/3.
        // A limpeza de postos obsoletos tem trava contra leitura parcial da planilha.
        if (syncToCloud && !isFirestoreQuotaExhausted()) {
          saveSchoolsToCloud(normalizedSchools, false, true).catch((err) =>
            console.warn('Aviso ao sincronizar postos no Firestore:', err)
          );
        }
      }

      let parsedMotorized: StaffMember[] = [];
      // 2. If motorized staff sheet is configured, read across all its tabs
      if (motorizedSheetId) {
        try {
          parsedMotorized = await loadAllStaffFromSpreadsheet(motorizedSheetId, activeToken);
          parsedMotorized = parsedMotorized.filter(isRealStaffMember);
          if (parsedMotorized.length > 0) {
            // Enrich motorized staff phone numbers if missing by looking into parsedSchools and INITIAL_STAFF
            parsedMotorized = parsedMotorized.map((item) => {
              if (!item.phone || !item.phone.trim()) {
                const re = item.re;
                const scAm = parsedSchools.find((s) => matchesExactRe(s.am.re, re) && s.am.phone?.trim());
                if (scAm?.am.phone?.trim()) return { ...item, phone: scAm.am.phone.trim() };
                const scPm = parsedSchools.find((s) => matchesExactRe(s.pm.re, re) && s.pm.phone?.trim());
                if (scPm?.pm.phone?.trim()) return { ...item, phone: scPm.pm.phone.trim() };
                const initStaff = INITIAL_STAFF.find((init) => matchesExactRe(init.re, re));
                if (initStaff?.phone?.trim()) return { ...item, phone: initStaff.phone.trim() };
              }
              return item;
            });
            const pairedMotorized = organizeStaffWithDriverPairing(parsedMotorized);
            setStaffList(pairedMotorized);
            try {
              localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(pairedMotorized));
            } catch (e) {}

            // Sincroniza efetivo motorizado no Firestore apenas se solicitado e se a cota não estiver esgotada
            if (syncToCloud && !isFirestoreQuotaExhausted()) {
              saveStaffToCloud(parsedMotorized, false, true).catch((err) =>
                console.warn('Aviso ao sincronizar efetivo de apoio no Firestore:', err)
              );
            }
          }
        } catch (motErr) {
          console.warn('Efetivo motorizado não pôde ser carregado:', motErr);
        }
      }

      return {
        schoolsCount: parsedSchools.length,
        staffCount: parsedMotorized.length,
        coordinatesCount: loadedCoordinates.length
      };
    } catch (err: any) {
      console.warn('Aviso ao sincronizar planilha:', err?.message || err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Quick sync action for header and UI
  const handleQuickSync = async () => {
    if (!sheetsConfig.fixedStaffSheetId) {
      setIsSheetsModalOpen(true);
      return;
    }
    const activeToken = token || getAccessToken();
    try {
      const res = await handleLoadFromSheets(
        sheetsConfig.fixedStaffSheetId,
        sheetsConfig.motorizedStaffSheetId,
        sheetsConfig.coordinatesSheetId,
        activeToken || undefined,
        true // Manual quick sync pushes updates to cloud
      );
      const coordNotice = res.coordinatesCount ? `\n• ${res.coordinatesCount} Coordenadas GPS sincronizadas.` : '';
      alert(
        `Planilhas sincronizadas com sucesso!\n\n• ${res.schoolsCount} Postos Eleitorais (Escolas) carregados.\n• ${res.staffCount} Militares de Apoio/Motorizados carregados.${coordNotice}`
      );
    } catch (err: any) {
      if (err?.message?.includes('401') || err?.message?.includes('expirou') || !activeToken) {
        setIsSheetsModalOpen(true);
      } else {
        alert(`Erro na sincronização: ${err?.message || 'Verifique as permissões de acesso da planilha.'}`);
      }
    }
  };

  // No automatic Sheets polling: devices read schools/staff from Firestore only.
  // The P/3 imports from the spreadsheets manually (header sync button / config modal),
  // which is the single writer of the schools and staff collections.

  // Search & Officer Resolution logic
  const resolveOfficerCandidate = useCallback((queryToSearch: string) => {
    const q = queryToSearch.trim();
    if (!q) return null;

    // Helper to check if role is non-ronda support
    const isSupportRole = (fn: string | undefined) => {
      const norm = normalizeText(fn || '');
      return (
        norm.includes('MOTORISTA') ||
        norm.includes('MOT.') ||
        norm.includes('AUXILIAR') ||
        norm.includes('AUX.') ||
        norm.includes('AUXILI') ||
        /\bAUX\b/.test(norm) ||
        norm.includes('ESCOLTA') ||
        norm.includes('APOIO') ||
        norm.includes('ADMINISTRATIV')
      );
    };

    // Universal helper to find an officer's phone from any source (officer phone, staffList, schoolList, INITIAL_STAFF)
    const resolvePhoneForRe = (officerRe: string, initialPhone?: string): string => {
      if (initialPhone && initialPhone.trim()) return initialPhone.trim();
      if (!officerRe) return '';
      // 1. From staffList
      const matchStaff = staffList.find((m) => matchesExactRe(m.re, officerRe));
      if (matchStaff?.phone?.trim()) return matchStaff.phone.trim();
      // 2. From schoolList (AM & PM across all assigned officers)
      for (const s of schoolList) {
        const ams = getSchoolAmOfficers(s);
        const matchAm = ams.find((o) => matchesExactRe(o.re, officerRe) && o.phone?.trim());
        if (matchAm?.phone?.trim()) return matchAm.phone.trim();
        const pms = getSchoolPmOfficers(s);
        const matchPm = pms.find((o) => matchesExactRe(o.re, officerRe) && o.phone?.trim());
        if (matchPm?.phone?.trim()) return matchPm.phone.trim();
      }
      // 3. From INITIAL_STAFF
      const matchInitial = INITIAL_STAFF.find((m) => matchesExactRe(m.re, officerRe));
      if (matchInitial?.phone?.trim()) return matchInitial.phone.trim();
      // 4. From INITIAL_SCHOOLS
      for (const s of INITIAL_SCHOOLS) {
        const ams = getSchoolAmOfficers(s);
        const matchAm = ams.find((o) => matchesExactRe(o.re, officerRe) && o.phone?.trim());
        if (matchAm?.phone?.trim()) return matchAm.phone.trim();
        const pms = getSchoolPmOfficers(s);
        const matchPm = pms.find((o) => matchesExactRe(o.re, officerRe) && o.phone?.trim());
        if (matchPm?.phone?.trim()) return matchPm.phone.trim();
      }
      return '';
    };

    // Helper to create a dedicated Ronda candidate from a row in schoolList that is actually a Ronda/CGP post
    const createRondaCandidateFromSchool = (
      school: SchoolItem,
      officer: { re: string; name: string; rank: string; phone?: string; shift?: string },
      shift: 'Manhã' | 'Tarde'
    ) => {
      const city = school.city || '';
      const opm = school.opm || '40º BPM/I';
      const local = opm && city ? `${opm} · ${city}` : (opm || city || '40º BPM/I');

      // Resolve phone from officer or lookup in staffList / INITIAL_STAFF / schoolList (Coluna G)
      const resolvedPhone = resolvePhoneForRe(officer.re, officer.phone);

      const matchStaff = staffList.find(
        (m) =>
          matchesExactRe(m.re, officer.re) ||
          (officer.name && normalizeText(m.name) === normalizeText(officer.name))
      );

      return {
        staff: {
          unit: matchStaff?.unit || opm,
          rank: matchStaff?.rank || officer.rank || 'Policial Militar',
          re: officer.re,
          name: matchStaff?.name || officer.name,
          phone: matchStaff?.phone || resolvedPhone,
          local: matchStaff?.local || local,
          function: matchStaff?.function || school.school || 'CGP Eleições',
          shiftRaw: matchStaff?.shiftRaw || shift,
          vehicle: matchStaff?.vehicle || '',
          driver: matchStaff?.driver || ''
        },
        schoolItem: undefined, // CRITICAL: Policiais de ronda NÃO possuem posto fixo e NÃO realizam check-in!
        assignedShift: shift,
        isMotorized: true,
        re: officer.re,
        name: officer.name,
        rank: officer.rank,
        phone: matchStaff?.phone || resolvedPhone
      };
    };

    // Helper to find ALL assigned schools for an officer (e.g. morning in school A, afternoon in school B, or multiple posts)
    const findAssignedSchoolsForOfficer = (targetRe: string, targetName?: string) => {
      const results: Array<{
        school: SchoolItem;
        shift: 'Manhã' | 'Tarde' | 'Integral';
        officer: SchoolOfficer;
      }> = [];

      for (const s of schoolList) {
        if (isRondaRoleOrSchool(s.school, s.address || s.bairro)) continue;

        const amOfficers = getSchoolAmOfficers(s);
        const matchAm = amOfficers.find((off) =>
          matchesExactRe(off.re, targetRe) ||
          (targetName && normalizeText(off.name) === normalizeText(targetName))
        );

        const pmOfficers = getSchoolPmOfficers(s);
        const matchPm = pmOfficers.find((off) =>
          matchesExactRe(off.re, targetRe) ||
          (targetName && normalizeText(off.name) === normalizeText(targetName))
        );

        if (matchAm && matchPm) {
          results.push({
            school: s,
            shift: 'Integral',
            officer: {
              ...matchAm,
              phone: resolvePhoneForRe(matchAm.re, matchAm.phone) || resolvePhoneForRe(matchPm.re, matchPm.phone) || matchAm.phone || matchPm.phone
            }
          });
        } else if (matchAm) {
          results.push({
            school: s,
            shift: 'Manhã',
            officer: {
              ...matchAm,
              phone: resolvePhoneForRe(matchAm.re, matchAm.phone) || matchAm.phone
            }
          });
        } else if (matchPm) {
          results.push({
            school: s,
            shift: 'Tarde',
            officer: {
              ...matchPm,
              phone: resolvePhoneForRe(matchPm.re, matchPm.phone) || matchPm.phone
            }
          });
        }
      }
      return results;
    };

    // Priority 1: Exact RE match across motorized staff, coordination and schools
    const exactStaff = staffList.find((m) => matchesExactRe(m.re, q));
    if (exactStaff) {
      const isTarde = exactStaff.shiftRaw?.toLowerCase().includes('tarde');
      const isTrueRonda = isRondaRoleOrSchool(exactStaff.function);
      const staffPhone = resolvePhoneForRe(exactStaff.re, exactStaff.phone);
      const assignedSchools = findAssignedSchoolsForOfficer(exactStaff.re, exactStaff.name);

      if (assignedSchools.length > 0 && !isTrueRonda) {
        return {
          staff: staffPhone ? { ...exactStaff, phone: staffPhone } : exactStaff,
          schoolItem: assignedSchools[0].school,
          assignedSchools,
          assignedShift: assignedSchools[0].shift,
          isMotorized: false,
          re: exactStaff.re,
          name: exactStaff.name,
          rank: exactStaff.rank,
          phone: staffPhone || exactStaff.phone
        };
      }

      return {
        staff: staffPhone ? { ...exactStaff, phone: staffPhone } : exactStaff,
        assignedShift: (isTarde ? 'Tarde' : 'Manhã') as 'Manhã' | 'Tarde',
        isMotorized: isTrueRonda || (!isSupportRole(exactStaff.function) && assignedSchools.length === 0),
        schoolItem: assignedSchools[0]?.school,
        assignedSchools: assignedSchools.length > 0 ? assignedSchools : undefined,
        re: exactStaff.re,
        name: exactStaff.name,
        rank: exactStaff.rank,
        phone: staffPhone || exactStaff.phone
      };
    }

    // 1.2 Schools: Morning officers (AM Turno Manhã) - checking all assigned officers per school
    for (const s of schoolList) {
      const amOfficers = getSchoolAmOfficers(s);
      const matchedOff = amOfficers.find((off) => matchesExactRe(off.re, q));
      if (matchedOff) {
        if (isRondaRoleOrSchool(s.school, s.address || s.bairro)) {
          return createRondaCandidateFromSchool(s, matchedOff, 'Manhã');
        }
        const schoolPhone = resolvePhoneForRe(matchedOff.re, matchedOff.phone);
        const officerWithPhone = { ...matchedOff, phone: schoolPhone || matchedOff.phone };
        const matchStaff = staffList.find(
          (m) =>
            matchesExactRe(m.re, matchedOff.re) ||
            (matchedOff.name && normalizeText(m.name) === normalizeText(matchedOff.name))
        );
        const assignedSchools = findAssignedSchoolsForOfficer(officerWithPhone.re, officerWithPhone.name);
        return {
          staff: matchStaff,
          schoolItem: assignedSchools[0]?.school || s,
          assignedSchools: assignedSchools.length > 0 ? assignedSchools : [{ school: s, shift: 'Manhã' as const, officer: officerWithPhone }],
          assignedShift: assignedSchools[0]?.shift || 'Manhã',
          isMotorized: false,
          re: officerWithPhone.re,
          name: officerWithPhone.name,
          rank: officerWithPhone.rank,
          phone: matchStaff?.phone || officerWithPhone.phone
        };
      }
    }

    // 1.3 Schools: Afternoon officers (PM Turno Tarde) - checking all assigned officers per school
    for (const s of schoolList) {
      const pmOfficers = getSchoolPmOfficers(s);
      const matchedOff = pmOfficers.find((off) => matchesExactRe(off.re, q));
      if (matchedOff) {
        if (isRondaRoleOrSchool(s.school, s.address || s.bairro)) {
          return createRondaCandidateFromSchool(s, matchedOff, 'Tarde');
        }
        const schoolPhone = resolvePhoneForRe(matchedOff.re, matchedOff.phone);
        const officerWithPhone = { ...matchedOff, phone: schoolPhone || matchedOff.phone };
        const matchStaff = staffList.find(
          (m) =>
            matchesExactRe(m.re, matchedOff.re) ||
            (matchedOff.name && normalizeText(m.name) === normalizeText(matchedOff.name))
        );
        const assignedSchools = findAssignedSchoolsForOfficer(officerWithPhone.re, officerWithPhone.name);
        return {
          staff: matchStaff,
          schoolItem: assignedSchools[0]?.school || s,
          assignedSchools: assignedSchools.length > 0 ? assignedSchools : [{ school: s, shift: 'Tarde' as const, officer: officerWithPhone }],
          assignedShift: assignedSchools[0]?.shift || 'Tarde',
          isMotorized: false,
          re: officerWithPhone.re,
          name: officerWithPhone.name,
          rank: officerWithPhone.rank,
          phone: matchStaff?.phone || officerWithPhone.phone
        };
      }
    }

    // Priority 2: General query match (Name or partial RE)
    const foundStaff = staffList.find((m) => matchesQuery(m.re, m.name, q));
    if (foundStaff) {
      const isTarde = foundStaff.shiftRaw?.toLowerCase().includes('tarde');
      const isTrueRonda = isRondaRoleOrSchool(foundStaff.function);
      const staffPhone = resolvePhoneForRe(foundStaff.re, foundStaff.phone);
      const assignedSchools = findAssignedSchoolsForOfficer(foundStaff.re, foundStaff.name);

      if (assignedSchools.length > 0 && !isTrueRonda) {
        return {
          staff: staffPhone ? { ...foundStaff, phone: staffPhone } : foundStaff,
          schoolItem: assignedSchools[0].school,
          assignedSchools,
          assignedShift: assignedSchools[0].shift,
          isMotorized: false,
          re: foundStaff.re,
          name: foundStaff.name,
          rank: foundStaff.rank,
          phone: staffPhone || foundStaff.phone
        };
      }

      return {
        staff: staffPhone ? { ...foundStaff, phone: staffPhone } : foundStaff,
        assignedShift: (isTarde ? 'Tarde' : 'Manhã') as 'Manhã' | 'Tarde',
        isMotorized: isTrueRonda || (!isSupportRole(foundStaff.function) && assignedSchools.length === 0),
        schoolItem: assignedSchools[0]?.school,
        assignedSchools: assignedSchools.length > 0 ? assignedSchools : undefined,
        re: foundStaff.re,
        name: foundStaff.name,
        rank: foundStaff.rank,
        phone: staffPhone || foundStaff.phone
      };
    }

    for (const s of schoolList) {
      const amOfficers = getSchoolAmOfficers(s);
      const matchedOff = amOfficers.find((off) => matchesQuery(off.re, off.name, q));
      if (matchedOff) {
        if (isRondaRoleOrSchool(s.school, s.address || s.bairro)) {
          return createRondaCandidateFromSchool(s, matchedOff, 'Manhã');
        }
        const schoolPhone = resolvePhoneForRe(matchedOff.re, matchedOff.phone);
        const officerWithPhone = { ...matchedOff, phone: schoolPhone || matchedOff.phone };
        const matchStaff = staffList.find(
          (m) =>
            matchesExactRe(m.re, matchedOff.re) ||
            (matchedOff.name && normalizeText(m.name) === normalizeText(matchedOff.name))
        );
        const assignedSchools = findAssignedSchoolsForOfficer(officerWithPhone.re, officerWithPhone.name);
        return {
          staff: matchStaff,
          schoolItem: assignedSchools[0]?.school || s,
          assignedSchools: assignedSchools.length > 0 ? assignedSchools : [{ school: s, shift: 'Manhã' as const, officer: officerWithPhone }],
          assignedShift: assignedSchools[0]?.shift || 'Manhã',
          isMotorized: false,
          re: officerWithPhone.re,
          name: officerWithPhone.name,
          rank: officerWithPhone.rank,
          phone: matchStaff?.phone || officerWithPhone.phone
        };
      }
    }

    for (const s of schoolList) {
      const pmOfficers = getSchoolPmOfficers(s);
      const matchedOff = pmOfficers.find((off) => matchesQuery(off.re, off.name, q));
      if (matchedOff) {
        if (isRondaRoleOrSchool(s.school, s.address || s.bairro)) {
          return createRondaCandidateFromSchool(s, matchedOff, 'Tarde');
        }
        const schoolPhone = resolvePhoneForRe(matchedOff.re, matchedOff.phone);
        const officerWithPhone = { ...matchedOff, phone: schoolPhone || matchedOff.phone };
        const matchStaff = staffList.find(
          (m) =>
            matchesExactRe(m.re, matchedOff.re) ||
            (matchedOff.name && normalizeText(m.name) === normalizeText(matchedOff.name))
        );
        const assignedSchools = findAssignedSchoolsForOfficer(officerWithPhone.re, officerWithPhone.name);
        return {
          staff: matchStaff,
          schoolItem: assignedSchools[0]?.school || s,
          assignedSchools: assignedSchools.length > 0 ? assignedSchools : [{ school: s, shift: 'Tarde' as const, officer: officerWithPhone }],
          assignedShift: assignedSchools[0]?.shift || 'Tarde',
          isMotorized: false,
          re: officerWithPhone.re,
          name: officerWithPhone.name,
          rank: officerWithPhone.rank,
          phone: matchStaff?.phone || officerWithPhone.phone
        };
      }
    }

    return null;
  }, [staffList, schoolList]);

  // Main Consultation Gate with Security & LGPD Audit Logic
  const handleConsultOfficer = useCallback(
    (queryToSearch: string) => {
      const q = queryToSearch.trim();
      if (!q) {
        setSelectedOfficerMatch(null);
        return;
      }

      const candidate = resolveOfficerCandidate(q);
      if (!candidate) {
        alert(`Nenhum policial militar localizado para o termo "${q}". Verifique o número do RE.`);
        return;
      }

      // If user is already authenticated in supervisor mode, allow immediate access
      if (isSupervisorMode) {
        setSelectedOfficerMatch(candidate);
        return;
      }

      // Check 1: No device binding yet -> Open confirmation modal
      if (!deviceBinding) {
        setCandidateForAction(candidate);
        setIsIdentityConfirmOpen(true);
        return;
      }

      // Check 2: Same officer already bound to this device -> Direct access
      const isSameOfficer = normalizeRe(deviceBinding.boundRe) === normalizeRe(candidate.re);
      if (isSameOfficer) {
        setSelectedOfficerMatch(candidate);
        return;
      }

      // Check 3: Attempting to query another officer on the same device -> Require service justification
      setCandidateForAction(candidate);
      setIsJustificationOpen(true);
    },
    [resolveOfficerCandidate, isSupervisorMode, deviceBinding]
  );

  const handlePerformSearch = useCallback(
    (queryToSearch?: string) => {
      const q = queryToSearch !== undefined ? queryToSearch : searchQuery;
      handleConsultOfficer(q);
    },
    [searchQuery, handleConsultOfficer]
  );

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedOfficerMatch(null);
  };

  const handleSearchByRe = (re: string) => {
    setSearchQuery(re);
    handleConsultOfficer(re);
  };

  // Actions for Modals
  const handleConfirmIdentity = () => {
    if (!candidateForAction) return;
    const deviceId = getOrCreateDeviceId();
    const newBinding: DeviceBinding = {
      deviceId,
      boundRe: candidateForAction.re,
      boundName: candidateForAction.name,
      boundRank: candidateForAction.rank,
      boundEmail: user?.email || '',
      boundAt: new Date().toISOString()
    };
    saveDeviceBinding(newBinding);
    setDeviceBinding(newBinding);
    saveDeviceBindingToCloud(newBinding).catch((err) =>
      console.warn('Erro ao salvar vinculo do aparelho na nuvem:', err)
    );
    setIsIdentityConfirmOpen(false);
    setSelectedOfficerMatch(candidateForAction);
    setCandidateForAction(null);
  };

  const handleConfirmJustification = async (justificationText: string) => {
    if (!candidateForAction || !deviceBinding) return;
    const deviceId = getOrCreateDeviceId();
    const newAuditRecord: AuditJustificationRecord = {
      id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      timestamp: Date.now(),
      dateTimeStr: new Date().toLocaleString('pt-BR'),
      deviceId,
      userEmail: user?.email || '',
      originRe: deviceBinding.boundRe,
      originName: `${deviceBinding.boundRank} ${deviceBinding.boundName}`,
      targetRe: candidateForAction.re,
      targetName: `${candidateForAction.rank} ${candidateForAction.name}`,
      justification: justificationText,
      syncedToSheets: false
    };

    // Save locally
    setAuditLogs((prev) => [newAuditRecord, ...prev]);

    // Save to Firestore in Cloud
    saveAuditLogToCloud(newAuditRecord).catch((err) =>
      console.warn('Erro ao salvar auditoria no Firestore:', err)
    );

    // Send to Google Sheets if configured
    const activeToken = token || getAccessToken();
    if (activeToken && sheetsConfig.fixedStaffSheetId) {
      try {
        const ok = await appendAuditJustificationToSheet(
          sheetsConfig.fixedStaffSheetId,
          sheetsConfig.checkinsTabName,
          newAuditRecord,
          activeToken
        );
        if (ok) {
          newAuditRecord.syncedToSheets = true;
        }
      } catch (err) {
        console.warn('Falha ao enviar auditoria ao Google Sheets:', err);
      }
    }

    setIsJustificationOpen(false);
    setSelectedOfficerMatch(candidateForAction);
    setCandidateForAction(null);
  };

  const handleLogoutDevice = () => {
    setIsConfirmLogoutOpen(true);
  };

  const handlePerformLogoutDevice = () => {
    if (deviceBinding?.deviceId) {
      removeDeviceBindingFromCloud(deviceBinding.deviceId).catch((err) =>
        console.warn('Erro ao remover vinculo do aparelho na nuvem:', err)
      );
    }
    clearDeviceBinding();
    setDeviceBinding(null);
    setSelectedOfficerMatch(null);
    handleSetSupervisorMode(false);
    setIsConfirmLogoutOpen(false);
  };

  const handleExitSupervisorMode = () => {
    handleSetSupervisorMode(false);
    setSelectedOfficerMatch(null);
  };

  const handleConfirmUnbindDevice = (reason: string, notes?: string, targetBinding?: DeviceBinding) => {
    const bindingToUnbind = targetBinding || deviceBinding;
    const currentDeviceId = bindingToUnbind?.deviceId;

    // Clear in Cloud
    if (currentDeviceId && !currentDeviceId.startsWith('manual-re-')) {
      removeDeviceBindingFromCloud(currentDeviceId).catch((err) =>
        console.warn('Erro ao desvincular aparelho na nuvem:', err)
      );
    } else if (bindingToUnbind?.boundRe) {
      removeDeviceBindingByReFromCloud(bindingToUnbind.boundRe).catch((err) =>
        console.warn('Erro ao desvincular aparelho por RE na nuvem:', err)
      );
    }

    // Clear device binding in storage and state if targeting this device or no target specified
    if (!targetBinding || targetBinding.deviceId === deviceBinding?.deviceId) {
      clearDeviceBinding();
      setDeviceBinding(null);
    }

    const boundOfficerInfo = bindingToUnbind
      ? `${bindingToUnbind.boundRank || 'PM'} ${bindingToUnbind.boundName || ''} (RE: ${bindingToUnbind.boundRe || ''})`
      : 'Memória Deste Aparelho';

    // Save audit log
    const auditEntry = {
      id: 'unbind-' + Date.now(),
      timestamp: Date.now(),
      dateTimeStr: new Date().toLocaleString('pt-BR'),
      action: 'UNBIND_DEVICE',
      officer: boundOfficerInfo,
      reason,
      notes: notes || '',
      executor: user?.email || 'Supervisão P/3'
    };

    saveAuditLogToCloud(auditEntry).catch((err) =>
      console.warn('Erro ao registrar log de desvinculação na nuvem:', err)
    );

    try {
      const rawLogs = localStorage.getItem('pmesp_eleicoes_audit_logs_v1');
      const logs = rawLogs ? JSON.parse(rawLogs) : [];
      logs.unshift(auditEntry);
      localStorage.setItem('pmesp_eleicoes_audit_logs_v1', JSON.stringify(logs.slice(0, 100)));
    } catch {}

    setUnbindNotification(`Aparelho desvinculado com sucesso pela P/3 (${boundOfficerInfo}). Liberado para novo acesso.`);
    setTimeout(() => setUnbindNotification(null), 8000);
  };

  // Add Check-In
  const handleConfirmCheckIn = async (record: CheckInRecord) => {
    // If check-in belongs to GCM, ignore completely
    if (isGcmOfficer({ name: record.officerName, re: record.officerRe, rank: record.rank })) {
      return;
    }

    setCheckIns((prev) => {
      const filtered = prev.filter((c) => c.id !== record.id);
      const updated = [record, ...filtered];
      try {
        localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Save check-in directly to Cloud Backend / Firestore
    saveCheckInToCloud(record).catch((err) =>
      console.warn('Erro ao salvar check-in na nuvem Firestore/Cloud SQL:', err)
    );
  };

  // Undo/Delete Check-In (Removes from state and deletes from Firestore)
  const handleDeleteCheckIn = async (
    checkInId: string,
    officerInfo: string,
    schoolName: string,
    recordData?: Partial<CheckInRecord>
  ) => {
    try {
      // 1. Optimistically update local state immediately (this record only)
      setCheckIns((prev) => prev.filter((c) => c.id !== checkInId));

      // 2. Remove from Cloud Firestore (this document only)
      await deleteCheckInFromCloud(checkInId, recordData);

      // 3. Register security audit log
      const auditLog = {
        id: `audit_del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        // Numeric like every other audit log: a string timestamp broke orderBy('timestamp')
        timestamp: Date.now(),
        timeStr: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        actorRe: deviceBinding?.boundRe || 'SUPERVISOR',
        actorName: deviceBinding?.boundName || 'Supervisor P/3',
        actorRank: deviceBinding?.boundRank || 'P/3',
        targetRe: officerInfo,
        targetName: schoolName,
        action: 'CHECKIN_DELETED',
        details: `Check-in apagado/desfeito para ${officerInfo} na escola ${schoolName}`
      };
      saveAuditLogToCloud(auditLog).catch((err) =>
        console.warn('Erro ao registrar log de exclusão:', err)
      );
    } catch (err) {
      // The live listener restores the record in the view if the deletion did not happen
      console.error('Erro ao excluir check-in:', err);
      throw err;
    }
  };

  // Validate/Homologate Check-in (Auditoria de Check-ins P/3)
  const handleValidateCheckIn = async (checkInId: string, isValidated: boolean, notes?: string) => {
    const validatedAt = new Date().toLocaleString('pt-BR');
    const validatedTimestamp = Date.now();
    const validatedBy = deviceBinding
      ? `${deviceBinding.boundRank} ${deviceBinding.boundName}`
      : user?.email || 'Supervisão P/3';

    // Status computed once and used both locally and in Firestore (the cloud previously
    // always received 'conforme', overwriting 'validado_ressalva' for out-of-range records)
    const target = checkIns.find((c) => c.id === checkInId);
    const auditStatus: CheckInRecord['auditStatus'] = !isValidated
      ? 'pendente'
      : !target || !hasVerifiedLocation(target) || isOutsideRadius(target)
        ? 'validado_ressalva'
        : 'conforme';

    // 1. Update local checkIns state
    setCheckIns((prev) =>
      prev.map((c) => {
        if (c.id === checkInId) {
          return {
            ...c,
            isValidated,
            validatedBy: isValidated ? validatedBy : undefined,
            validatedAt: isValidated ? validatedAt : undefined,
            validatedTimestamp: isValidated ? validatedTimestamp : undefined,
            auditNotes: notes ?? (isValidated ? c.auditNotes : undefined),
            auditStatus
          };
        }
        return c;
      })
    );

    // 2. Persist to Firestore
    try {
      await updateCheckInAuditInCloud(checkInId, {
        isValidated,
        validatedBy: isValidated ? validatedBy : '',
        validatedAt: isValidated ? validatedAt : '',
        validatedTimestamp: isValidated ? validatedTimestamp : 0,
        auditNotes: notes || '',
        auditStatus
      });
    } catch (err) {
      console.warn('Erro ao atualizar auditoria de check-in na nuvem:', err);
      alert('Não foi possível gravar a homologação no banco. Verifique a conexão e tente novamente.');
      return;
    }

    // 3. Register security audit log
    const auditLog = {
      id: `val_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: validatedTimestamp,
      dateTimeStr: validatedAt,
      action: isValidated ? 'CHECKIN_VALIDATED' : 'CHECKIN_VALIDATION_REVOKED',
      officer: validatedBy,
      reason: isValidated ? (notes || 'Presença homologada pela Supervisão P/3') : 'Validação de presença revogada',
      notes: `Check-in ID: ${checkInId}`
    };
    saveAuditLogToCloud(auditLog).catch((err) =>
      console.warn('Erro ao registrar log de validação na nuvem:', err)
    );
  };

  // Undo Check-in with custom reason and full audit trail
  const handleUndoCheckIn = async (record: CheckInRecord, reason: string) => {
    await handleDeleteCheckIn(
      record.id,
      `${record.rank} ${record.officerName} (RE: ${record.officerRe})`,
      record.schoolName,
      record
    );

    const auditEntry = {
      id: `undo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      dateTimeStr: new Date().toLocaleString('pt-BR'),
      action: 'CHECKIN_UNDONE',
      officer: deviceBinding
        ? `${deviceBinding.boundRank} ${deviceBinding.boundName}`
        : user?.email || 'Supervisão P/3',
      reason: reason || 'Check-in desfeito pela supervisão',
      notes: `Policial: ${record.rank} ${record.officerName} (RE: ${record.officerRe}) | Posto: ${record.schoolName} (${record.city}) | Distância: ${
        typeof record.distanceMeters === 'number' ? Math.round(record.distanceMeters) + 'm' : 'N/A'
      }`
    };
    saveAuditLogToCloud(auditEntry).catch(() => {});
  };

  // Bulk validate conformant check-ins (within 150m radius)
  const handleBulkValidateInRadius = async (recordIds: string[]) => {
    const validatedAt = new Date().toLocaleString('pt-BR');
    const validatedTimestamp = Date.now();
    const validatedBy = deviceBinding
      ? `${deviceBinding.boundRank} ${deviceBinding.boundName}`
      : user?.email || 'Supervisão P/3';

    // Only records with a verified GPS position inside the radius
    const eligible = new Set(
      checkIns
        .filter((c) => recordIds.includes(c.id) && hasVerifiedLocation(c) && !isOutsideRadius(c))
        .map((c) => c.id)
    );
    if (eligible.size === 0) return;

    try {
      await updateCheckInsAuditBatchInCloud(Array.from(eligible), {
        isValidated: true,
        validatedBy,
        validatedAt,
        validatedTimestamp,
        auditNotes: 'Homologado em lote pela Supervisão P/3 (Raio Conforme ≤ 150m)',
        auditStatus: 'conforme'
      });
    } catch (err) {
      console.warn('Erro na homologação em lote:', err);
      alert('Não foi possível gravar a homologação em lote no banco. Verifique a conexão e tente novamente.');
      return;
    }

    setCheckIns((prev) =>
      prev.map((c) => {
        if (eligible.has(c.id)) {
          return {
            ...c,
            isValidated: true,
            validatedBy,
            validatedAt,
            validatedTimestamp,
            auditNotes: 'Homologado em lote pela Supervisão P/3 (Raio Conforme ≤ 150m)',
            auditStatus: 'conforme'
          };
        }
        return c;
      })
    );

    const auditEntry = {
      id: `bulk_val_${Date.now()}`,
      timestamp: validatedTimestamp,
      dateTimeStr: validatedAt,
      action: 'BULK_CHECKIN_VALIDATED',
      officer: validatedBy,
      reason: `Homologação em lote de ${eligible.size} check-ins conformes (≤ 150m)`,
      notes: `${eligible.size} postos auditados`
    };
    saveAuditLogToCloud(auditEntry).catch(() => {});
  };

  // Delete audit log record manually (from state, localStorage and Firestore)
  const handleDeleteAuditLog = async (logId: string) => {
    try {
      setAuditLogs((prev) => prev.filter((l) => l.id !== logId));

      try {
        const raw = localStorage.getItem('pmesp_eleicoes_audit_logs_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((l: any) => l.id !== logId);
            localStorage.setItem('pmesp_eleicoes_audit_logs_v1', JSON.stringify(filtered));
          }
        }
      } catch (e) {
        console.warn('Erro ao atualizar cache local de auditoria:', e);
      }

      await deleteAuditLogFromCloud(logId);
    } catch (err) {
      console.error('Erro ao excluir log de auditoria:', err);
    }
  };

  // Add Ronda
  const handleConfirmRonda = async (record: RondaRecord) => {
    setRondas((prev) => {
      const filtered = prev.filter((r) => r.id !== record.id);
      return [record, ...filtered];
    });

    // Save ronda directly to Cloud Firestore
    saveRondaToCloud(record).catch((err) =>
      console.warn('Erro ao salvar ronda na nuvem Firestore:', err)
    );
  };

  // Delete Ronda
  const handleDeleteRonda = async (rondaId: string, info: string, rondaData?: Partial<RondaRecord>) => {
    try {
      setRondas((prev) => prev.filter((r) => r.id !== rondaId));
      await deleteRondaFromCloud(rondaId, rondaData);
    } catch (err) {
      // The live listener restores the record in the view if the deletion did not happen
      console.error('Erro ao excluir ronda da nuvem:', err);
      throw err;
    }
  };

  // Clear the check-ins and rondas of the day shown in the panel (other days are kept)
  const handleClearTestData = async () => {
    setCheckIns([]);
    setRondas([]);
    try {
      await clearTestDataFromCloud(activeRange);
    } catch (err) {
      console.warn('Erro ao limpar dados do dia no Firestore:', err);
      throw new Error('Não foi possível apagar todos os registros do dia no banco. Verifique a conexão e tente novamente.');
    }
  };

  // Zera 100% o Banco de Dados em todas as coleções (deixa vazio, pronto para receber novo banco)
  const handleWipeEntireDatabase = async () => {
    setCheckIns([]);
    setRondas([]);
    setSchoolList([]);
    setStaffList([]);
    setAuditLogs([]);
    try {
      await wipeEntireDatabaseFromCloud();
    } catch (err) {
      console.warn('Erro ao zerar todo o banco de dados no Firestore:', err);
      throw new Error('Falha ao zerar todas as coleções na nuvem. Verifique a conexão e tente novamente.');
    }
  };

  // Check checkin status helper
  const hasCheckedIn = (re: string, schoolName: string, shift: string) => {
    return checkIns.some(
      (c) => c.schoolName.toUpperCase() === schoolName.toUpperCase() && c.shift.toLowerCase() === shift.toLowerCase()
    );
  };

  // Fixed schools only (excludes non-school mobile ronda rows like "CGP Eleições", "Área Livre", and GCM municipal guard schools)
  const fixedSchoolList = useMemo(() => {
    return schoolList.filter((s) => !isRondaRoleOrSchool(s.school, s.address || s.bairro) && !isGcmSchool(s));
  }, [schoolList]);

  // KPIs Calculations — only the supervisor panel shows them; computing on every officer
  // device re-ran the full schools × check-ins match on every check-in in the battalion.
  const kpiSummary = useMemo(() => {
    if (!isSupervisorMode) return EMPTY_KPIS;
    return computeShiftKpis(fixedSchoolList, checkIns);
  }, [isSupervisorMode, fixedSchoolList, checkIns]);

  const totalSchools = kpiSummary.totalSchools;
  const totalRondas = rondas.length;

  // Selected officer active check-in record
  const currentOfficerCheckIn = useMemo(() => {
    if (!selectedOfficerMatch) return undefined;
    const re =
      selectedOfficerMatch.re ||
      selectedOfficerMatch.staff?.re ||
      (selectedOfficerMatch.assignedShift === 'Manhã'
        ? selectedOfficerMatch.schoolItem?.am.re
        : selectedOfficerMatch.schoolItem?.pm.re) ||
      '';
    const name =
      selectedOfficerMatch.name ||
      selectedOfficerMatch.staff?.name ||
      (selectedOfficerMatch.assignedShift === 'Manhã'
        ? selectedOfficerMatch.schoolItem?.am.name
        : selectedOfficerMatch.schoolItem?.pm.name) ||
      '';
    const reNorm = normalizeRe(re);
    const nameNorm = normalizeText(name);

    // The record must belong to this officer. Matching by school alone returned a colleague's
    // check-in on multi-officer posts, hiding this officer's own check-in button.
    return checkIns.find((c) => {
      const cReNorm = normalizeRe(c.officerRe);
      if (reNorm && cReNorm) {
        // Both have RE: the RE decides (names like "SILVA" are not unique)
        return reNorm === cReNorm || matchesExactRe(re, c.officerRe);
      }
      const cNameNorm = normalizeText(c.officerName);
      return Boolean(nameNorm && cNameNorm && nameNorm === cNameNorm);
    });
  }, [selectedOfficerMatch, checkIns]);

  const currentOfficerRondas = useMemo(() => {
    if (!selectedOfficerMatch) return [];
    const re =
      selectedOfficerMatch.re ||
      selectedOfficerMatch.staff?.re ||
      (selectedOfficerMatch.assignedShift === 'Manhã'
        ? selectedOfficerMatch.schoolItem?.am.re
        : selectedOfficerMatch.schoolItem?.pm.re) ||
      '';
    const name = selectedOfficerMatch.name || selectedOfficerMatch.staff?.name || '';
    return rondas.filter((r) => {
      const matchRe = re && r.officerRe && matchesExactRe(re, r.officerRe);
      const matchName = name && r.officerName && normalizeText(name) === normalizeText(r.officerName);
      return matchRe || matchName;
    });
  }, [selectedOfficerMatch, rondas]);

  const handleReconnectCloud = () => {
    clearFirestoreQuotaExhausted();
    setIsQuotaExhausted(false);
    setCloudConnected(true);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-800 flex flex-col font-sans">
      {/* 1. Header Bar - Exibido apenas para a Supervisão / P/3 */}
      {isSupervisorMode && (
        <Header
          user={user}
          onOpenSheetsConfig={() => setIsSheetsModalOpen(true)}
          onOpenReportExport={() => setIsReportModalOpen(true)}
          onQuickSync={handleQuickSync}
          hasSheetsConfigured={Boolean(sheetsConfig.fixedStaffSheetId)}
          isSyncing={isSyncing}
          onLogout={handleExitSupervisorMode}
          isSupervisorMode={isSupervisorMode}
          onOpenSupervisorLogin={() => setIsSupervisorModalOpen(true)}
          deviceBinding={deviceBinding}
          onUnbindDevice={() => setIsUnbindModalOpen(true)}
          cloudConnected={cloudConnected}
          isQuotaExhausted={isQuotaExhausted}
          onReconnectCloud={handleReconnectCloud}
          onClearTestData={() => setIsResetModalOpen(true)}
        />
      )}

      {/* Main App Container with responsive Flexbox/Grid flow, removing excess margins on small viewports */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2.5 sm:py-6 flex flex-col min-w-0 pb-24 md:pb-6">
        {/* Scenario 1: Individual School Officer / Support Gate (Default safe view) */}
        {!isSupervisorMode && !selectedOfficerMatch && (
          <div className="w-full flex-1 flex flex-col justify-center min-w-0">
            <ReGateScreen
              onSearchRe={handleConsultOfficer}
              deviceBinding={deviceBinding}
              staffList={staffList}
              currentUserEmail={user?.email || undefined}
              onOpenSupervisorLogin={() => setIsSupervisorModalOpen(true)}
              cloudConnected={cloudConnected}
              isQuotaExhausted={isQuotaExhausted}
            />
          </div>
        )}

        {/* Scenario 2: Officer Detail View (Either Individual Mode or Supervisor inspection) */}
        {selectedOfficerMatch ? (
          <div className="w-full min-w-0">
            <OfficerDetailView
              officer={selectedOfficerMatch}
              checkInRecord={currentOfficerCheckIn}
              rondasMade={currentOfficerRondas}
              allRondas={rondas}
              onBack={handleClearSearch}
              isIndividualRestrictedMode={!isSupervisorMode}
              onLogout={handleLogoutDevice}
              onOpenSupervisorMode={() => setIsSupervisorModalOpen(true)}
              deviceBinding={deviceBinding}
              onDeleteCheckIn={handleDeleteCheckIn}
              onDeleteRonda={handleDeleteRonda}
              allSchools={fixedSchoolList}
              staffList={staffList}
              allCheckIns={checkIns}
              onSelectSchoolForCheckIn={(school, shift, officerParam) => {
                const fallbackOfficer = shift === 'Manhã' ? school.am : school.pm;
                const officer = officerParam || fallbackOfficer;
                if (isGcmOfficer(officer)) return;
                setActiveCheckInModal({
                  school,
                  officerRe: officer.re || selectedOfficerMatch?.re || '',
                  officerName: officer.name || selectedOfficerMatch?.name || '',
                  rank: officer.rank || selectedOfficerMatch?.rank || 'Policial Militar',
                  shift
                });
              }}
              onSearchByRe={handleConsultOfficer}
              onOpenCheckIn={() => {
                if (selectedOfficerMatch.schoolItem) {
                  if (isGcmOfficer({
                    re: selectedOfficerMatch.re,
                    name: selectedOfficerMatch.name,
                    rank: selectedOfficerMatch.rank
                  })) {
                    return;
                  }
                  const isAm = selectedOfficerMatch.assignedShift === 'Manhã';
                  const fallbackOfficer = isAm ? selectedOfficerMatch.schoolItem.am : selectedOfficerMatch.schoolItem.pm;
                  const officerRe = selectedOfficerMatch.re || fallbackOfficer.re;
                  const officerName = selectedOfficerMatch.name || fallbackOfficer.name;
                  const officerRank = selectedOfficerMatch.rank || fallbackOfficer.rank;
                  setActiveCheckInModal({
                    school: selectedOfficerMatch.schoolItem,
                    officerRe,
                    officerName,
                    rank: officerRank,
                    shift: selectedOfficerMatch.assignedShift || (isAm ? 'Manhã' : 'Tarde')
                  });
                }
              }}
              onOpenRonda={(schoolId) => {
                const staff = selectedOfficerMatch.staff;
                const officerLocal =
                  staff?.local ||
                  (selectedOfficerMatch.schoolItem
                    ? `${selectedOfficerMatch.schoolItem.opm || ''} · ${selectedOfficerMatch.schoolItem.city || ''}`
                    : '');
                const schoolsForOfficer = filterSchoolsByJurisdiction(
                  fixedSchoolList,
                  officerLocal,
                  staff?.function
                );
                const isAm = selectedOfficerMatch.assignedShift !== 'Tarde';
                const officerFromSchool = isAm
                  ? selectedOfficerMatch.schoolItem?.am
                  : selectedOfficerMatch.schoolItem?.pm;
                setActiveRondaModal({
                  officerRe: staff?.re || officerFromSchool?.re || '962407-4',
                  officerName: staff?.name || officerFromSchool?.name || 'Policial Militar',
                  rank: staff?.rank || officerFromSchool?.rank || 'Policial Militar',
                  defaultSchoolId: schoolId,
                  sectorSchools:
                    schoolsForOfficer.length > 0 ? schoolsForOfficer : fixedSchoolList
                });
              }}
            />
          </div>
        ) : (
          /* Scenario 3: Supervisor / P/3 Full Command View (127 schools, KPIs, Map, Pending Table) */
          isSupervisorMode && (
            <div className="w-full flex flex-col gap-3.5 sm:gap-6 min-w-0">
              {/* Notificação de sucesso de desvinculação P/3 */}
              {unbindNotification && (
                <div className="p-3 sm:p-4 bg-emerald-50 border border-emerald-300 rounded-xl sm:rounded-2xl flex items-center justify-between gap-3 text-emerald-900 text-xs font-bold shadow-xs animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="truncate">{unbindNotification}</span>
                  </div>
                  <button
                    onClick={() => setUnbindNotification(null)}
                    className="text-emerald-700 hover:text-emerald-900 px-2 py-1 text-xs cursor-pointer font-extrabold shrink-0"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Navy Hero Search Section */}
              <div className="w-full min-w-0">
                <HeroSearch
                  searchQuery={searchQuery}
                  onQueryChange={setSearchQuery}
                  onSearch={() => handlePerformSearch()}
                  onClear={handleClearSearch}
                  isFocusedSearch={false}
                />
              </div>

              {/* KPI Grid */}
              <div className="w-full min-w-0">
                <KpiGrid
                  totalSchools={kpiSummary.totalSchools}
                  morningDone={kpiSummary.morningDone}
                  morningPending={kpiSummary.morningPending}
                  afternoonDone={kpiSummary.afternoonDone}
                  afternoonPending={kpiSummary.afternoonPending}
                  totalRondas={totalRondas}
                  fullDayCount={kpiSummary.fullDayCount}
                  onKpiClick={(type) => setActiveKpiModal(type)}
                  onRondasClick={() => setSupervisorTab('rondas')}
                />
              </div>

              {/* P/3 Navigation Tabs (Desktop only - no celular é controlado diretamente pelo Menu Inferior) */}
              <div className="w-full min-w-0 flex flex-col gap-3">
                <div className="hidden md:flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
                  <button
                    id="p3-tab-btn-escolas"
                    onClick={() => setSupervisorTab('escolas')}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 cursor-pointer ${
                      supervisorTab === 'escolas'
                        ? 'bg-[#0F2B48] text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <School className="w-4 h-4" />
                    <span>Postos & Check-ins</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        supervisorTab === 'escolas'
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {fixedSchoolList.length}
                    </span>
                  </button>

                  <button
                    id="p3-tab-btn-rondas"
                    onClick={() => setSupervisorTab('rondas')}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 cursor-pointer ${
                      supervisorTab === 'rondas'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                    <span>Rondas do Batalhão</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        supervisorTab === 'rondas'
                          ? 'bg-purple-50 text-purple-800'
                          : 'bg-purple-50 text-purple-800'
                      }`}
                    >
                      {rondas.length}
                    </span>
                  </button>

                  <button
                    id="p3-tab-btn-empenho"
                    onClick={() => setSupervisorTab('empenho')}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 cursor-pointer ${
                      supervisorTab === 'empenho'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <Car className="w-4 h-4" />
                    <span>Empenho de Efetivo (VTRs)</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        supervisorTab === 'empenho'
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      {staffList.length}
                    </span>
                  </button>

                  <button
                    id="p3-tab-btn-auditoria-checkins"
                    onClick={() => setSupervisorTab('auditoria-checkins')}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 cursor-pointer ${
                      supervisorTab === 'auditoria-checkins'
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Auditoria de Check-Ins</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        supervisorTab === 'auditoria-checkins'
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-50 text-blue-900'
                      }`}
                    >
                      {checkIns.length}
                    </span>
                    {checkIns.some((c) => (typeof c.distanceMeters === 'number' && c.distanceMeters > 150) || c.isOutOfRange) && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-rose-500 text-white animate-pulse">
                        {checkIns.filter((c) => (typeof c.distanceMeters === 'number' && c.distanceMeters > 150) || c.isOutOfRange).length} alerta
                      </span>
                    )}
                  </button>

                  <button
                    id="p3-tab-btn-auditoria"
                    onClick={() => setSupervisorTab('auditoria')}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 cursor-pointer ${
                      supervisorTab === 'auditoria'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Auditoria Troca de RE</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        supervisorTab === 'auditoria'
                          ? 'bg-white/20 text-white'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {auditLogs.filter((l) => Boolean(l.originRe && l.targetRe)).length}
                    </span>
                  </button>

                  <button
                    id="p3-tab-btn-aparelhos"
                    onClick={() => setSupervisorTab('aparelhos')}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 cursor-pointer ${
                      supervisorTab === 'aparelhos'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Gestão de Aparelhos</span>
                    {deviceBinding && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                          supervisorTab === 'aparelhos'
                            ? 'bg-white/20 text-white'
                            : 'bg-rose-100 text-rose-900'
                        }`}
                      >
                        RE: {deviceBinding.boundRe}
                      </span>
                    )}
                  </button>
                </div>

                {supervisorTab === 'escolas' ? (
                  /* Postos Eleitorais Aguardando Check-in Table */
                  <div className="w-full min-w-0">
                    <PendingSchoolsTable
                      schools={fixedSchoolList}
                      checkInList={checkIns}
                      staffList={staffList}
                      onSearchByRe={handleSearchByRe}
                      onDeleteCheckIn={handleDeleteCheckIn}
                      onSelectSchoolForCheckIn={(school, shift, officerParam) => {
                        const fallbackOfficer = shift === 'Manhã' ? school.am : school.pm;
                        const officer = officerParam || fallbackOfficer;
                        if (isGcmOfficer(officer)) return;
                        setActiveCheckInModal({
                          school,
                          officerRe: officer.re,
                          officerName: officer.name,
                          rank: officer.rank,
                          shift
                        });
                      }}
                    />
                  </div>
                ) : supervisorTab === 'rondas' ? (
                  /* Rondas e Fiscalizações do Batalhão (Visão Geral P/3) */
                  <div className="w-full min-w-0">
                    <SectorRondasTab
                      isSupervisorView={true}
                      sectorSchools={fixedSchoolList}
                      rondasMade={rondas}
                      allRondas={rondas}
                      staffList={staffList}
                      officerRank="Oficial P/3"
                      officerName="Supervisão Operacional"
                      officerRe="40º BPM/I"
                      sectorName="Todos os Municípios (40º BPM/I)"
                      onDeleteRonda={handleDeleteRonda}
                      onOpenGeneralRonda={() => {
                        setActiveRondaModal({
                          officerRe: '40º BPM/I',
                          officerName: 'Supervisão Geral P/3',
                          rank: 'Oficial de Dia',
                          sectorSchools: fixedSchoolList
                        });
                      }}
                      onOpenRondaWithSchool={(schoolId) => {
                        setActiveRondaModal({
                          officerRe: '40º BPM/I',
                          officerName: 'Supervisão Geral P/3',
                          rank: 'Oficial de Dia',
                          defaultSchoolId: schoolId,
                          sectorSchools: fixedSchoolList
                        });
                      }}
                    />
                  </div>
                ) : supervisorTab === 'empenho' ? (
                  /* Empenho de Efetivo & VTRs */
                  <div className="w-full min-w-0">
                    <EmpenhoEfetivoTab
                      staffList={staffList}
                      onSearchByRe={handleSearchByRe}
                      onOpenSheetsConfig={() => setIsSheetsModalOpen(true)}
                    />
                  </div>
                ) : supervisorTab === 'auditoria-checkins' ? (
                  /* Auditoria de Check-Ins (Conformidade Raio de 150m, Validação e Desfazer) */
                  <div className="w-full min-w-0">
                    <CheckInAuditTab
                      checkIns={checkIns}
                      allSchools={fixedSchoolList}
                      onValidateCheckIn={handleValidateCheckIn}
                      onUndoCheckIn={handleUndoCheckIn}
                      onBulkValidateInRadius={handleBulkValidateInRadius}
                      onClearTestData={() => setIsResetModalOpen(true)}
                      currentUserLabel={
                        deviceBinding
                          ? `${deviceBinding.boundRank} ${deviceBinding.boundName}`
                          : user?.email || 'Supervisão P/3'
                      }
                    />
                  </div>
                ) : supervisorTab === 'auditoria' ? (
                  /* Auditoria de Troca de RE (Visualização Nome RE Vinculado e Trocas/Motivos) */
                  <div className="w-full min-w-0">
                    <ReAuditTab auditLogs={auditLogs} onDeleteLog={handleDeleteAuditLog} />
                  </div>
                ) : (
                  /* Gestão de Aparelhos Celulares (P/3) */
                  <div className="w-full min-w-0">
                    <DeviceManagementTab
                      deviceBinding={deviceBinding}
                      staffList={staffList}
                      auditLogs={auditLogs}
                      onOpenUnbindModal={() => setIsUnbindModalOpen(true)}
                      onConfirmUnbind={handleConfirmUnbindDevice}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </main>

      {/* Menu Inferior Mobile para Supervisão P/3 */}
      {isSupervisorMode && !selectedOfficerMatch && (
        <nav
          aria-label="Navegação Rápida Supervisão P/3"
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-safe md:hidden"
        >
          <div className="grid grid-flow-col auto-cols-fr items-center px-1.5 py-1.5 max-w-lg mx-auto">
            <button
              type="button"
              id="mobile-sup-btn-escolas"
              onClick={() => {
                setSupervisorTab('escolas');
                window.scrollTo({ top: 350, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer active:scale-95 ${
                supervisorTab === 'escolas' ? 'text-[#0F2B48] font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <School className={`w-5 h-5 ${supervisorTab === 'escolas' ? 'text-[#0F2B48]' : 'text-slate-500'}`} />
              <span className="text-[10px] font-extrabold tracking-tight mt-0.5">Postos</span>
            </button>

            <button
              type="button"
              id="mobile-sup-btn-rondas"
              onClick={() => {
                setSupervisorTab('rondas');
                window.scrollTo({ top: 350, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer active:scale-95 ${
                supervisorTab === 'rondas' ? 'text-purple-700 font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Radio className={`w-5 h-5 ${supervisorTab === 'rondas' ? 'text-purple-700' : 'text-slate-500'}`} />
              <span className="text-[10px] font-extrabold tracking-tight mt-0.5">Rondas</span>
            </button>

            <button
              type="button"
              id="mobile-sup-btn-empenho"
              onClick={() => {
                setSupervisorTab('empenho');
                window.scrollTo({ top: 350, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer active:scale-95 ${
                supervisorTab === 'empenho' ? 'text-emerald-700 font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Car className={`w-5 h-5 ${supervisorTab === 'empenho' ? 'text-emerald-700' : 'text-slate-500'}`} />
              <span className="text-[10px] font-extrabold tracking-tight mt-0.5">Efetivo</span>
            </button>

            <button
              type="button"
              id="mobile-sup-btn-auditoria"
              onClick={() => {
                setSupervisorTab('auditoria-checkins');
                window.scrollTo({ top: 350, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer active:scale-95 ${
                supervisorTab === 'auditoria-checkins' ? 'text-blue-700 font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCheck className={`w-5 h-5 ${supervisorTab === 'auditoria-checkins' ? 'text-blue-700' : 'text-slate-500'}`} />
              <span className="text-[10px] font-extrabold tracking-tight mt-0.5">Auditoria</span>
            </button>

            <button
              type="button"
              id="mobile-sup-btn-aparelhos"
              onClick={() => {
                setSupervisorTab('aparelhos');
                window.scrollTo({ top: 350, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer active:scale-95 ${
                supervisorTab === 'aparelhos' ? 'text-rose-700 font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Smartphone className={`w-5 h-5 ${supervisorTab === 'aparelhos' ? 'text-rose-700' : 'text-slate-500'}`} />
              <span className="text-[10px] font-extrabold tracking-tight mt-0.5">Aparelhos</span>
            </button>

            <button
              type="button"
              id="mobile-sup-btn-sair"
              onClick={handleExitSupervisorMode}
              className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-rose-600 hover:text-rose-800 active:scale-95 transition cursor-pointer"
            >
              <LogOut className="w-5 h-5 text-rose-600" />
              <span className="text-[10px] font-extrabold tracking-tight mt-0.5">Sair P/3</span>
            </button>
          </div>
        </nav>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-3.5 sm:py-4 mt-6 sm:mt-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 text-center text-[11px] sm:text-xs text-slate-500 font-semibold flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2">
          <span>12º BPM/I · Polícia Militar do Estado de São Paulo · CPI-7</span>
          <span className="text-slate-400 text-[10px] sm:text-xs">
            Sessão Eleitoral 2026 · Integrado ao Google Workspace (Drive & Sheets)
          </span>
        </div>
      </footer>

      {/* Confirm Identity Modal (1st Access / Device Binding) */}
      <ConfirmIdentityModal
        isOpen={isIdentityConfirmOpen}
        onClose={() => {
          setIsIdentityConfirmOpen(false);
          setCandidateForAction(null);
        }}
        onConfirm={handleConfirmIdentity}
        candidate={candidateForAction || {}}
        hasExistingBinding={Boolean(deviceBinding)}
        existingBindingName={deviceBinding ? `${deviceBinding.boundRank} ${deviceBinding.boundName}` : undefined}
      />

      {/* Security & LGPD Audit Justification Modal (When bound device queries another RE) */}
      {deviceBinding && candidateForAction && (
        <JustificationModal
          isOpen={isJustificationOpen}
          onClose={() => {
            setIsJustificationOpen(false);
            setCandidateForAction(null);
          }}
          onConfirm={handleConfirmJustification}
          binding={deviceBinding}
          targetCandidate={{
            name: candidateForAction.name,
            rank: candidateForAction.rank,
            re: candidateForAction.re
          }}
          userEmail={user?.email || undefined}
        />
      )}

      {/* Supervisor / P/3 Authentication Modal */}
      <SupervisorAuthModal
        isOpen={isSupervisorModalOpen}
        onClose={() => setIsSupervisorModalOpen(false)}
        onSuccess={() => {
          setIsSupervisorModalOpen(false);
          handleSetSupervisorMode(true);
        }}
        userEmail={user?.email || undefined}
        customPassword={sheetsConfig.operationalPassword}
      />

      {/* Check-In Modal */}
      {activeCheckInModal && (
        <CheckInModal
          school={activeCheckInModal.school}
          officerRe={activeCheckInModal.officerRe}
          officerName={activeCheckInModal.officerName}
          rank={activeCheckInModal.rank}
          shift={activeCheckInModal.shift}
          isOpen={Boolean(activeCheckInModal)}
          onClose={() => setActiveCheckInModal(null)}
          onConfirm={handleConfirmCheckIn}
        />
      )}

      {/* Ronda Modal */}
      {activeRondaModal && (
        <RondaModal
          schools={activeRondaModal.sectorSchools || fixedSchoolList}
          officerRe={activeRondaModal.officerRe}
          officerName={activeRondaModal.officerName}
          rank={activeRondaModal.rank}
          isOpen={Boolean(activeRondaModal)}
          onClose={() => setActiveRondaModal(null)}
          onConfirm={handleConfirmRonda}
          defaultSchoolId={activeRondaModal.defaultSchoolId}
        />
      )}

      {/* Google Sheets Config Modal */}
      <GoogleSheetsConfigModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        user={user}
        token={token}
        config={sheetsConfig}
        onSaveConfig={handleSaveConfig}
        onLoadFromSheets={handleLoadFromSheets}
        onAuthSuccess={(u, t) => {
          setUser(u);
          setToken(t);
        }}
      />

      {/* Report Export Modal (Option 6A) */}
      <ReportExportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        schools={fixedSchoolList}
        checkIns={checkIns}
        rondas={rondas}
        effectiveShift="TODOS"
        onClearTestData={handleClearTestData}
      />

      {/* Reset System / Zerar Dados de Testes Modal */}
      <ResetSystemModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        checkInsCount={checkIns.length}
        rondasCount={rondas.length}
        onConfirmReset={handleClearTestData}
        onConfirmWipeAll={handleWipeEntireDatabase}
        dayLabel={activeDayKey.split('-').reverse().join('/')}
      />

      {/* KPI Drill-Down / Details & Check-In Undo Modal */}
      {activeKpiModal && (
        <KpiDetailsModal
          isOpen={Boolean(activeKpiModal)}
          onClose={() => setActiveKpiModal(null)}
          filterType={activeKpiModal}
          schools={fixedSchoolList}
          checkIns={checkIns}
          onDeleteCheckIn={handleDeleteCheckIn}
          onSelectSchoolForCheckIn={(school, shift, officerParam) => {
            setActiveKpiModal(null);
            const fallbackOfficer = shift === 'Manhã' ? school.am : school.pm;
            const officer = officerParam || fallbackOfficer;
            if (isGcmOfficer(officer)) return;
            setActiveCheckInModal({
              school,
              officerRe: officer.re,
              officerName: officer.name,
              rank: officer.rank,
              shift
            });
          }}
          onSearchByRe={(re) => {
            setActiveKpiModal(null);
            handleSearchByRe(re);
          }}
          onOpenAuditCheckIns={() => {
            setActiveKpiModal(null);
            setSupervisorTab('auditoria-checkins');
          }}
        />
      )}

      {/* P/3 Device Unbind Modal */}
      <UnbindDeviceModal
        isOpen={isUnbindModalOpen}
        onClose={() => setIsUnbindModalOpen(false)}
        binding={deviceBinding}
        allStaff={staffList}
        onConfirmUnbind={handleConfirmUnbindDevice}
      />

      {/* Device Logout Confirmation Modal */}
      {isConfirmLogoutOpen && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">
                  Sair do Dispositivo
                </h4>
                <p className="text-xs text-slate-500">
                  Desvincular RE deste aparelho
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Deseja realmente desvincular seu policial militar e sair deste aparelho? O dispositivo ficará liberado para nova identificação.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmLogoutOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePerformLogoutDevice}
                className="px-4 py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition cursor-pointer shadow-xs"
              >
                Confirmar Saída
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
