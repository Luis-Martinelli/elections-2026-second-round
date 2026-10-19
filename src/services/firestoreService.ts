import {
  SchoolItem,
  StaffMember,
  CheckInRecord,
  RondaRecord,
  GoogleSheetsConfig,
  DeviceBinding,
} from '../types.ts';

// Cloud SQL PostgreSQL API Client
// Handles high-concurrency writes and reads effortlessly via the backend connection pool.

export interface DayRange {
  from: number;
  to: number;
}

const PURGED_RECORD_IDS_KEY = 'pmesp_purged_record_ids_v1';
const CLEARED_TEST_DATA_KEY = 'pmesp_cleared_test_data_ts_v1';

// Event emitter for instant local reactive updates across listeners
type ListenerCallback<T> = (data: T) => void;
const checkInListeners = new Set<ListenerCallback<CheckInRecord[]>>();
const rondaListeners = new Set<ListenerCallback<RondaRecord[]>>();
const schoolListeners = new Set<ListenerCallback<SchoolItem[]>>();
const staffListeners = new Set<ListenerCallback<StaffMember[]>>();
const configListeners = new Set<ListenerCallback<Partial<GoogleSheetsConfig> | null>>();
const auditListeners = new Set<ListenerCallback<any[]>>();

export function sanitizeForFirestore<T>(val: T): T {
  return val;
}

export function isFirestoreQuotaExhausted(): boolean {
  // Cloud SQL (PostgreSQL) has no Spark daily quotas. Always connected and operational.
  return false;
}

export function setFirestoreQuotaExhausted(_durationMs: number = 0): void {
  // No-op on Cloud SQL
}

export function clearFirestoreQuotaExhausted(): void {
  // No-op on Cloud SQL
}

export function subscribeQuotaStatus(cb: (exhausted: boolean) => void): () => void {
  cb(false);
  return () => {};
}

export function handleFirestoreError(err: any, operationName: string): boolean {
  console.warn(`[Cloud SQL] ${operationName} error:`, err);
  return false;
}

export function getPurgedRecordIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PURGED_RECORD_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function addPurgedRecordIds(ids: string[]): void {
  if (!ids.length) return;
  try {
    const current = getPurgedRecordIds();
    ids.forEach((id) => current.add(id));
    localStorage.setItem(PURGED_RECORD_IDS_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

export function isValidActiveRecord(r: {
  id?: string;
  key?: string;
  protocol?: string;
  timestamp?: any;
  officerName?: string;
  officerRe?: string;
  officerRank?: string;
}): boolean {
  if (!r) return false;
  if (r.id && getPurgedRecordIds().has(r.id)) return false;
  return true;
}

export function getClearedTestDataTimestamp(): number {
  try {
    const raw = localStorage.getItem(CLEARED_TEST_DATA_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setClearedTestDataTimestamp(ts: number = Date.now()): void {
  try {
    localStorage.setItem(CLEARED_TEST_DATA_KEY, String(ts));
  } catch {}
}

export function getPendingCheckIns(_range?: DayRange): CheckInRecord[] {
  return [];
}

export function getPendingRondas(_range?: DayRange): RondaRecord[] {
  return [];
}

export function hasPendingWrites(): boolean {
  return false;
}

export async function flushPendingWrites(): Promise<void> {
  // No pending writes in online Cloud SQL mode
}

/**
 * Creates an interval that automatically pauses when the browser tab/screen is hidden
 * (saving mobile battery and reducing server load during duty), and triggers an immediate
 * fresh pull as soon as the user unlocks their device or refocuses the app.
 */
function createVisibilityAwareInterval(action: () => void | Promise<void>, intervalMs: number): () => void {
  let timer: any = null;

  const runTick = async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      await action();
    } catch {}
  };

  timer = setInterval(runTick, intervalMs);

  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && !document.hidden) {
      // Instant refresh upon wake-up/unlocking device screen
      action();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  return () => {
    if (timer) clearInterval(timer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}

// ==========================================
// 1. SCHOOLS (POSTOS ELEITORAIS)
// ==========================================

export async function getSchoolsFromCloud(): Promise<SchoolItem[]> {
  try {
    const res = await fetch('/api/schools');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Erro ao carregar escolas do Cloud SQL:', err);
    return [];
  }
}

export function subscribeSchools(
  callback: (schools: SchoolItem[]) => void,
  _onError?: (error: any) => void
): () => void {
  schoolListeners.add(callback);
  getSchoolsFromCloud().then(callback);

  // Escolas são cadastros estáveis durante o dia de eleição: intervalo otimizado de 60s
  const cleanup = createVisibilityAwareInterval(async () => {
    const data = await getSchoolsFromCloud();
    callback(data);
  }, 60000);

  return () => {
    schoolListeners.delete(callback);
    cleanup();
  };
}

export async function saveSchoolsToCloud(
  schools: SchoolItem[],
  _isDifferential?: boolean,
  _force?: boolean
): Promise<void> {
  try {
    const res = await fetch('/api/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schools),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    schoolListeners.forEach((cb) => cb(schools));
  } catch (err) {
    console.warn('Erro ao salvar escolas no Cloud SQL:', err);
    throw err;
  }
}

// ==========================================
// 2. STAFF (EFETIVO POLICIAL)
// ==========================================

export async function getStaffFromCloud(): Promise<StaffMember[]> {
  try {
    const res = await fetch('/api/staff');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Erro ao carregar efetivo do Cloud SQL:', err);
    return [];
  }
}

export function subscribeStaff(
  callback: (staff: StaffMember[]) => void,
  _onError?: (error: any) => void
): () => void {
  staffListeners.add(callback);
  getStaffFromCloud().then(callback);

  // Efetivo é cadastrado antes da operação: intervalo otimizado de 60s com recarga imediata ao desbloquear
  const cleanup = createVisibilityAwareInterval(async () => {
    const data = await getStaffFromCloud();
    callback(data);
  }, 60000);

  return () => {
    staffListeners.delete(callback);
    cleanup();
  };
}

export async function saveStaffToCloud(
  staffList: StaffMember[],
  _isDifferential?: boolean,
  _force?: boolean
): Promise<void> {
  try {
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(staffList),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    staffListeners.forEach((cb) => cb(staffList));
  } catch (err) {
    console.warn('Erro ao salvar efetivo no Cloud SQL:', err);
    throw err;
  }
}

// ==========================================
// 3. CHECK-INS (CONCORRÊNCIA EM TEMPO REAL)
// ==========================================

const LOCAL_CHECKINS_CACHE_KEY = 'pmesp_eleicoes_checkins_v1';

export function mergeCheckInLists(primary: CheckInRecord[], secondary: CheckInRecord[]): CheckInRecord[] {
  const map = new Map<string, CheckInRecord>();
  (primary || []).forEach((c) => {
    if (c && c.id && isValidActiveRecord(c)) {
      map.set(c.id, c);
    }
  });
  (secondary || []).forEach((c) => {
    if (c && c.id && isValidActiveRecord(c)) {
      if (!map.has(c.id)) {
        map.set(c.id, c);
      } else {
        const existing = map.get(c.id)!;
        map.set(c.id, { ...existing, ...c });
      }
    }
  });
  return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function readLocalCheckInsCache(): CheckInRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHECKINS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((r) => r && r.id && isValidActiveRecord(r));
      }
    }
  } catch {}
  return [];
}

function writeLocalCheckInsCache(list: CheckInRecord[]): void {
  try {
    localStorage.setItem(LOCAL_CHECKINS_CACHE_KEY, JSON.stringify(list));
  } catch {}
}

export async function getCheckInsFromCloud(): Promise<CheckInRecord[]> {
  try {
    const res = await fetch('/api/checkins');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const serverList: CheckInRecord[] = await res.json();
    if (Array.isArray(serverList)) {
      const local = readLocalCheckInsCache();
      const merged = mergeCheckInLists(serverList, local);
      writeLocalCheckInsCache(merged);
      return merged;
    }
  } catch (err) {
    console.warn('Aviso ao carregar check-ins do servidor, utilizando cache local resiliente:', err);
  }
  return readLocalCheckInsCache();
}

export function subscribeCheckIns(
  callback: (checkIns: CheckInRecord[]) => void,
  _onError?: (error: any) => void,
  _range?: DayRange
): () => void {
  checkInListeners.add(callback);

  // Fornece imediatamente os registros em cache para que a interface não espere e nunca mostre estado vazio
  const initialCache = readLocalCheckInsCache();
  if (initialCache.length > 0) {
    callback(initialCache);
  }

  getCheckInsFromCloud().then(callback);

  // Polling em tempo real a cada 4 segundos com suspensão quando tela bloqueada e refresh instantâneo
  const cleanup = createVisibilityAwareInterval(async () => {
    const data = await getCheckInsFromCloud();
    callback(data);
  }, 4000);

  return () => {
    checkInListeners.delete(callback);
    cleanup();
  };
}

export async function saveCheckInToCloud(record: CheckInRecord): Promise<void> {
  // 1. Salva imediatamente no cache local e notifica todos os componentes instantaneamente
  const currentLocal = readLocalCheckInsCache();
  const mergedImmediate = mergeCheckInLists([record], currentLocal);
  writeLocalCheckInsCache(mergedImmediate);
  checkInListeners.forEach((cb) => cb(mergedImmediate));

  // 2. Persiste no servidor backend
  try {
    const res = await fetch('/api/checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const serverData = await getCheckInsFromCloud();
    checkInListeners.forEach((cb) => cb(serverData));
  } catch (err) {
    console.error('Aviso ao sincronizar check-in no backend (mantido com segurança no cache local):', err);
  }
}

export async function updateCheckInAuditInCloud(
  checkInId: string,
  validationData: {
    isValidated: boolean;
    validatedBy: string;
    validatedAt: string;
    validatedTimestamp: number;
    auditNotes?: string;
    auditStatus?: 'conforme' | 'irregular' | 'validado_ressalva' | 'pendente';
  }
): Promise<void> {
  try {
    const res = await fetch(`/api/checkins/${checkInId}/validate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validationData),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    getCheckInsFromCloud().then((all) => checkInListeners.forEach((cb) => cb(all)));
  } catch (err) {
    console.error('Erro ao validar check-in no Cloud SQL:', err);
    throw err;
  }
}

export async function updateCheckInsAuditBatchInCloud(
  checkInIds: string[],
  validationData: {
    isValidated: boolean;
    validatedBy: string;
    validatedAt: string;
    validatedTimestamp: number;
    auditNotes?: string;
    auditStatus?: 'conforme' | 'irregular' | 'validado_ressalva' | 'pendente';
  }
): Promise<void> {
  if (checkInIds.length === 0) return;
  try {
    const res = await fetch('/api/checkins/bulk-validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: checkInIds, updates: validationData }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    getCheckInsFromCloud().then((all) => checkInListeners.forEach((cb) => cb(all)));
  } catch (err) {
    console.error('Erro ao validar lote de check-ins no Cloud SQL:', err);
    throw err;
  }
}

export async function deleteCheckInFromCloud(
  id: string,
  _recordData?: Partial<CheckInRecord>
): Promise<boolean> {
  // Remove imediatamente do cache local e lista de purged ids
  addPurgedRecordIds([id]);
  const currentLocal = readLocalCheckInsCache().filter((c) => c.id !== id);
  writeLocalCheckInsCache(currentLocal);
  checkInListeners.forEach((cb) => cb(currentLocal));

  try {
    const res = await fetch(`/api/checkins/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const updated = await getCheckInsFromCloud();
    checkInListeners.forEach((cb) => cb(updated));
    return true;
  } catch (err) {
    console.warn('Aviso ao deletar check-in no backend (já removido localmente):', err);
    return true;
  }
}

// ==========================================
// 4. RONDAS
// ==========================================

export async function getRondasFromCloud(): Promise<RondaRecord[]> {
  try {
    const res = await fetch('/api/rondas');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Erro ao carregar rondas do Cloud SQL:', err);
    return [];
  }
}

export function subscribeRondas(
  callback: (rondas: RondaRecord[]) => void,
  _onError?: (error: any) => void,
  _range?: DayRange
): () => void {
  rondaListeners.add(callback);
  getRondasFromCloud().then(callback);

  // Polling em tempo real a cada 5 segundos com suspensão quando tela bloqueada e refresh instantâneo
  const cleanup = createVisibilityAwareInterval(async () => {
    const data = await getRondasFromCloud();
    callback(data);
  }, 5000);

  return () => {
    rondaListeners.delete(callback);
    cleanup();
  };
}

export async function saveRondaToCloud(record: RondaRecord): Promise<void> {
  try {
    const res = await fetch('/api/rondas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    getRondasFromCloud().then((all) => rondaListeners.forEach((cb) => cb(all)));
  } catch (err) {
    console.error('Erro ao salvar ronda no Cloud SQL:', err);
    throw err;
  }
}

export async function deleteRondaFromCloud(
  id: string,
  _recordData?: Partial<RondaRecord>
): Promise<boolean> {
  try {
    const res = await fetch(`/api/rondas/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    getRondasFromCloud().then((all) => rondaListeners.forEach((cb) => cb(all)));
    return true;
  } catch (err) {
    console.warn('Erro ao deletar ronda no Cloud SQL:', err);
    return false;
  }
}

// ==========================================
// 5. CONFIGURAÇÃO DO SISTEMA
// ==========================================

export async function getSystemConfigFromCloud(): Promise<Partial<GoogleSheetsConfig> | null> {
  try {
    const res = await fetch('/api/config/sheets_config');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Erro ao carregar configurações do Cloud SQL:', err);
    return null;
  }
}

export function subscribeSystemConfig(
  callback: (config: Partial<GoogleSheetsConfig> | null) => void,
  _onError?: (error: any) => void
): () => void {
  configListeners.add(callback);
  getSystemConfigFromCloud().then(callback);

  // Configuração é estática durante a operação: intervalo de 60s
  const cleanup = createVisibilityAwareInterval(async () => {
    const data = await getSystemConfigFromCloud();
    callback(data);
  }, 60000);

  return () => {
    configListeners.delete(callback);
    cleanup();
  };
}

export async function saveSystemConfigToCloud(config: Partial<GoogleSheetsConfig>): Promise<void> {
  try {
    const res = await fetch('/api/config/sheets_config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    configListeners.forEach((cb) => cb(config));
  } catch (err) {
    console.warn('Erro ao salvar configurações no Cloud SQL:', err);
    throw err;
  }
}

// ==========================================
// 6. VINCULAÇÃO DE DISPOSITIVOS (DEVICE BINDINGS)
// ==========================================

export async function getAllDeviceBindingsFromCloud(): Promise<Record<string, DeviceBinding>> {
  try {
    const res = await fetch('/api/device-bindings');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Record<string, DeviceBinding>;
  } catch (err) {
    console.warn('Erro ao buscar vinculações de dispositivos no Cloud SQL:', err);
    return {};
  }
}

export async function getDeviceBindingFromCloud(deviceId: string): Promise<DeviceBinding | null> {
  try {
    const bindings = await getAllDeviceBindingsFromCloud();
    return bindings[deviceId] || null;
  } catch (err) {
    console.warn('Erro ao buscar vinculação de dispositivo no Cloud SQL:', err);
    return null;
  }
}

export async function saveDeviceBindingToCloud(binding: DeviceBinding): Promise<void> {
  try {
    const res = await fetch('/api/device-bindings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(binding),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.warn('Erro ao salvar vinculação no Cloud SQL:', err);
    throw err;
  }
}

export async function removeDeviceBindingFromCloud(deviceId: string): Promise<void> {
  try {
    const res = await fetch(`/api/device-bindings/${deviceId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.warn('Erro ao remover vinculação no Cloud SQL:', err);
  }
}

export async function removeDeviceBindingByReFromCloud(re: string): Promise<boolean> {
  try {
    const all = await getAllDeviceBindingsFromCloud();
    const cleanRe = re.replace(/\D/g, '');
    const found = Object.values(all).find((b) => {
      if (!b || !b.boundRe) return false;
      return b.boundRe === re || b.boundRe.replace(/\D/g, '') === cleanRe;
    });
    if (found && found.deviceId) {
      await removeDeviceBindingFromCloud(found.deviceId);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Erro ao desvincular aparelho por RE:', err);
    return false;
  }
}

// ==========================================
// 7. AUDIT LOGS
// ==========================================

export async function saveAuditLogToCloud(log: Record<string, any>): Promise<void> {
  try {
    const res = await fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fetch('/api/audit-logs')
      .then((r) => r.json())
      .then((all) => auditListeners.forEach((cb) => cb(all)));
  } catch (err) {
    console.warn('Erro ao salvar log de auditoria no Cloud SQL:', err);
  }
}

export async function deleteAuditLogFromCloud(logId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/audit-logs/${logId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch (err) {
    console.warn('Erro ao excluir log de auditoria no Cloud SQL:', err);
    return false;
  }
}

export function subscribeAuditLogs(
  callback: (logs: any[]) => void,
  _onError?: (error: any) => void
): () => void {
  auditListeners.add(callback);
  fetch('/api/audit-logs')
    .then((r) => (r.ok ? r.json() : []))
    .then(callback)
    .catch(() => callback([]));

  const cleanup = createVisibilityAwareInterval(async () => {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        callback(data);
      }
    } catch {}
  }, 10000);

  return () => {
    auditListeners.delete(callback);
    cleanup();
  };
}

// ==========================================
// 8. RESET / WIPE SYSTEM
// ==========================================

export async function clearTestDataFromCloud(range: DayRange): Promise<void> {
  try {
    const res = await fetch('/api/system/clear-range', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: range.from, to: range.to }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Notifica ouvintes
    getCheckInsFromCloud().then((all) => checkInListeners.forEach((cb) => cb(all)));
    getRondasFromCloud().then((all) => rondaListeners.forEach((cb) => cb(all)));
  } catch (err) {
    console.error('Erro ao limpar intervalo no Cloud SQL:', err);
    throw err;
  }
}

export async function wipeEntireDatabaseFromCloud(): Promise<void> {
  try {
    const res = await fetch('/api/system/wipe', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    checkInListeners.forEach((cb) => cb([]));
    rondaListeners.forEach((cb) => cb([]));
    schoolListeners.forEach((cb) => cb([]));
    staffListeners.forEach((cb) => cb([]));
    auditListeners.forEach((cb) => cb([]));

    try {
      localStorage.removeItem(PURGED_RECORD_IDS_KEY);
      localStorage.removeItem(CLEARED_TEST_DATA_KEY);
    } catch {}
  } catch (err) {
    console.error('Erro ao zerar banco de dados Cloud SQL:', err);
    throw err;
  }
}
