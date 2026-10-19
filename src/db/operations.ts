import { db, isSqlHostConfigured } from './index.ts';
import {
  checkins,
  rondas,
  schools,
  staff,
  deviceBindings,
  auditLogs,
  systemConfig,
} from './schema.ts';
import { eq, inArray, and, gte, lt } from 'drizzle-orm';
import type {
  CheckInRecord,
  RondaRecord,
  SchoolItem,
  StaffMember,
  DeviceBinding,
  AuditJustificationRecord,
} from '../types.ts';
import { INITIAL_SCHOOLS, INITIAL_STAFF } from '../data/initialData.ts';
import fs from 'fs';
import path from 'path';

// ==========================================
// RESILIENT PERSISTENT LOCAL STORAGE ENGINE
// ==========================================

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'server_db.json');

interface StoreState {
  checkins: CheckInRecord[];
  rondas: RondaRecord[];
  schools: SchoolItem[];
  staff: StaffMember[];
  deviceBindings: Record<string, DeviceBinding>;
  auditLogs: AuditJustificationRecord[];
  systemConfig: Record<string, any>;
}

function loadStore(): StoreState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        checkins: Array.isArray(parsed.checkins) ? parsed.checkins : [],
        rondas: Array.isArray(parsed.rondas) ? parsed.rondas : [],
        schools: Array.isArray(parsed.schools) ? parsed.schools : [],
        staff: Array.isArray(parsed.staff) ? parsed.staff : [],
        deviceBindings: parsed.deviceBindings && typeof parsed.deviceBindings === 'object' ? parsed.deviceBindings : {},
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        systemConfig: parsed.systemConfig && typeof parsed.systemConfig === 'object' ? parsed.systemConfig : {},
      };
    }
  } catch (err) {
    console.warn('Notice loading local server database:', err);
  }
  return {
    checkins: [],
    rondas: [],
    schools: [],
    staff: [],
    deviceBindings: {},
    auditLogs: [],
    systemConfig: {},
  };
}

let memoryStore: StoreState = loadStore();

let persistTimer: NodeJS.Timeout | null = null;

export function flushPersistStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DATA_FILE}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    fs.writeFileSync(tempFile, JSON.stringify(memoryStore, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.warn('Notice saving local server database:', err);
  }
}

function persistStore() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushPersistStore();
  }, 120);
}

// Ensure flush on process exit
if (typeof process !== 'undefined') {
  process.on('SIGINT', () => {
    flushPersistStore();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    flushPersistStore();
    process.exit(0);
  });
}

// ==========================================
// CHECKINS
// ==========================================

export async function getCheckInsFromDb(): Promise<CheckInRecord[]> {
  try {
    if (isSqlHostConfigured()) {
      const rows = await db.select().from(checkins);
      if (rows && rows.length > 0) {
        const list: CheckInRecord[] = rows.map((r) => ({
          id: r.id,
          key: r.key,
          type: 'checkin' as const,
          schoolName: r.schoolName,
          city: r.city,
          officerRe: r.officerRe,
          officerName: r.officerName,
          rank: r.rank,
          shift: r.shift,
          time: r.time,
          timestamp: r.timestamp,
          lat: r.lat,
          lng: r.lng,
          accuracy: r.accuracy,
          distanceMeters: r.distanceMeters,
          isOutOfRange: r.isOutOfRange,
          protocol: r.protocol,
          syncedToSheets: r.syncedToSheets ?? false,
          isValidated: r.isValidated ?? false,
          validatedBy: r.validatedBy ?? undefined,
          validatedAt: r.validatedAt ?? undefined,
          validatedTimestamp: r.validatedTimestamp ?? undefined,
          auditNotes: r.auditNotes ?? undefined,
          auditStatus: (r.auditStatus as CheckInRecord['auditStatus']) ?? undefined,
        }));
        memoryStore.checkins = list;
        persistStore();
        return list;
      }
    }
  } catch (error) {
    console.warn('Postgres getCheckIns notice, using local store:', (error as any)?.message || error);
  }
  return memoryStore.checkins;
}

export async function insertCheckInToDb(record: CheckInRecord): Promise<void> {
  const map = new Map<string, CheckInRecord>();
  memoryStore.checkins.forEach((c) => {
    if (c && c.id) map.set(c.id, c);
  });
  map.set(record.id, record);
  memoryStore.checkins = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      await db
        .insert(checkins)
        .values({
          id: record.id,
          key: record.key,
          schoolName: record.schoolName,
          city: record.city,
          officerRe: record.officerRe,
          officerName: record.officerName,
          rank: record.rank,
          shift: record.shift,
          time: record.time,
          timestamp: record.timestamp,
          lat: record.lat,
          lng: record.lng,
          accuracy: record.accuracy,
          distanceMeters: record.distanceMeters,
          isOutOfRange: record.isOutOfRange,
          protocol: record.protocol,
          syncedToSheets: record.syncedToSheets ?? false,
          isValidated: record.isValidated ?? false,
          validatedBy: record.validatedBy,
          validatedAt: record.validatedAt,
          validatedTimestamp: record.validatedTimestamp,
          auditNotes: record.auditNotes,
          auditStatus: record.auditStatus,
        })
        .onConflictDoUpdate({
          target: checkins.id,
          set: {
            isValidated: record.isValidated ?? false,
            validatedBy: record.validatedBy,
            validatedAt: record.validatedAt,
            validatedTimestamp: record.validatedTimestamp,
            auditNotes: record.auditNotes,
            auditStatus: record.auditStatus,
            syncedToSheets: record.syncedToSheets ?? false,
          },
        });
    }
  } catch (error) {
    console.warn('Postgres insertCheckIn notice:', (error as any)?.message || error);
  }
}

export async function updateCheckInValidationInDb(
  id: string,
  updates: {
    isValidated: boolean;
    validatedBy?: string;
    validatedAt?: string;
    validatedTimestamp?: number;
    auditNotes?: string;
    auditStatus?: 'conforme' | 'irregular' | 'validado_ressalva' | 'pendente';
  }
): Promise<void> {
  const item = memoryStore.checkins.find((c) => c.id === id);
  if (item) {
    item.isValidated = updates.isValidated;
    if (updates.validatedBy !== undefined) item.validatedBy = updates.validatedBy;
    if (updates.validatedAt !== undefined) item.validatedAt = updates.validatedAt;
    if (updates.validatedTimestamp !== undefined) item.validatedTimestamp = updates.validatedTimestamp;
    if (updates.auditNotes !== undefined) item.auditNotes = updates.auditNotes;
    if (updates.auditStatus !== undefined) item.auditStatus = updates.auditStatus;
    persistStore();
  }

  try {
    if (isSqlHostConfigured()) {
      await db
        .update(checkins)
        .set({
          isValidated: updates.isValidated,
          validatedBy: updates.validatedBy,
          validatedAt: updates.validatedAt,
          validatedTimestamp: updates.validatedTimestamp,
          auditNotes: updates.auditNotes,
          auditStatus: updates.auditStatus,
        })
        .where(eq(checkins.id, id));
    }
  } catch (error) {
    console.warn('Postgres updateCheckInValidation notice:', (error as any)?.message || error);
  }
}

export async function bulkUpdateCheckInValidationInDb(
  ids: string[],
  updates: {
    isValidated: boolean;
    validatedBy?: string;
    validatedAt?: string;
    validatedTimestamp?: number;
    auditNotes?: string;
    auditStatus?: 'conforme' | 'irregular' | 'validado_ressalva' | 'pendente';
  }
): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  for (const c of memoryStore.checkins) {
    if (idSet.has(c.id)) {
      c.isValidated = updates.isValidated;
      if (updates.validatedBy !== undefined) c.validatedBy = updates.validatedBy;
      if (updates.validatedAt !== undefined) c.validatedAt = updates.validatedAt;
      if (updates.validatedTimestamp !== undefined) c.validatedTimestamp = updates.validatedTimestamp;
      if (updates.auditNotes !== undefined) c.auditNotes = updates.auditNotes;
      if (updates.auditStatus !== undefined) c.auditStatus = updates.auditStatus;
    }
  }
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      await db
        .update(checkins)
        .set({
          isValidated: updates.isValidated,
          validatedBy: updates.validatedBy,
          validatedAt: updates.validatedAt,
          validatedTimestamp: updates.validatedTimestamp,
          auditNotes: updates.auditNotes,
          auditStatus: updates.auditStatus,
        })
        .where(inArray(checkins.id, ids));
    }
  } catch (error) {
    console.warn('Postgres bulkUpdateCheckInValidation notice:', (error as any)?.message || error);
  }
}

// ==========================================
// RONDAS
// ==========================================

export async function getRondasFromDb(): Promise<RondaRecord[]> {
  try {
    if (isSqlHostConfigured()) {
      const rows = await db.select().from(rondas);
      const list: RondaRecord[] = rows.map((r) => ({
        id: r.id,
        key: r.key,
        type: 'ronda' as const,
        schoolName: r.schoolName,
        city: r.city,
        officerRe: r.officerRe,
        officerName: r.officerName,
        rank: r.rank,
        situation: r.situation as 'sem' | 'com',
        obs: r.obs ?? '',
        time: r.time,
        timestamp: r.timestamp,
        lat: r.lat,
        lng: r.lng,
        shift: (r.shift as 'Manhã' | 'Tarde') ?? undefined,
        syncedToSheets: r.syncedToSheets ?? false,
      }));
      memoryStore.rondas = list;
      persistStore();
      return list;
    }
  } catch (error) {
    console.warn('Postgres getRondas notice, using local store:', (error as any)?.message || error);
  }
  return memoryStore.rondas;
}

export async function insertRondaToDb(record: RondaRecord): Promise<void> {
  const existingIdx = memoryStore.rondas.findIndex((r) => r.id === record.id);
  if (existingIdx >= 0) {
    memoryStore.rondas[existingIdx] = { ...memoryStore.rondas[existingIdx], ...record };
  } else {
    memoryStore.rondas.unshift(record);
  }
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      await db
        .insert(rondas)
        .values({
          id: record.id,
          key: record.key,
          schoolName: record.schoolName,
          city: record.city,
          officerRe: record.officerRe,
          officerName: record.officerName,
          rank: record.rank,
          situation: record.situation,
          obs: record.obs,
          time: record.time,
          timestamp: record.timestamp,
          lat: record.lat,
          lng: record.lng,
          shift: record.shift,
          syncedToSheets: record.syncedToSheets ?? false,
        })
        .onConflictDoNothing();
    }
  } catch (error) {
    console.warn('Postgres insertRonda notice:', (error as any)?.message || error);
  }
}

// ==========================================
// SCHOOLS
// ==========================================

export async function getSchoolsFromDb(): Promise<SchoolItem[]> {
  try {
    if (isSqlHostConfigured()) {
      const rows = await db.select().from(schools);
      if (rows.length > 0) {
        const list: SchoolItem[] = rows.map((r) => ({
          id: r.id,
          zone: r.zone,
          school: r.school,
          bairro: r.bairro ?? '',
          city: r.city,
          opm: r.opm ?? '',
          am: (r.amJson as any) || { rank: '', re: '', name: '', phone: '' },
          pm: (r.pmJson as any) || { rank: '', re: '', name: '', phone: '' },
          amOfficers: (r.amOfficersJson as any) || undefined,
          pmOfficers: (r.pmOfficersJson as any) || undefined,
          lat: r.lat ?? undefined,
          lng: r.lng ?? undefined,
          address: r.address ?? undefined,
        }));
        memoryStore.schools = list;
        persistStore();
        return list;
      }
    }
  } catch (error) {
    console.warn('Postgres getSchools notice, using local store:', (error as any)?.message || error);
  }

  if (memoryStore.schools.length > 0) {
    return memoryStore.schools;
  }
  return INITIAL_SCHOOLS;
}

export async function saveSchoolsToDb(items: SchoolItem[]): Promise<void> {
  if (items.length === 0) return;
  const map = new Map(memoryStore.schools.map((s) => [s.id, s]));
  for (const item of items) {
    map.set(item.id, item);
  }
  memoryStore.schools = Array.from(map.values());
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      for (const item of items) {
        await db
          .insert(schools)
          .values({
            id: item.id,
            zone: item.zone,
            school: item.school,
            bairro: item.bairro || '',
            city: item.city,
            opm: item.opm || '',
            amJson: item.am,
            pmJson: item.pm,
            amOfficersJson: item.amOfficers || null,
            pmOfficersJson: item.pmOfficers || null,
            lat: item.lat || null,
            lng: item.lng || null,
            address: item.address || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schools.id,
            set: {
              zone: item.zone,
              school: item.school,
              bairro: item.bairro || '',
              city: item.city,
              opm: item.opm || '',
              amJson: item.am,
              pmJson: item.pm,
              amOfficersJson: item.amOfficers || null,
              pmOfficersJson: item.pmOfficers || null,
              lat: item.lat || null,
              lng: item.lng || null,
              address: item.address || null,
              updatedAt: new Date(),
            },
          });
      }
    }
  } catch (error) {
    console.warn('Postgres saveSchools notice:', (error as any)?.message || error);
  }
}

// ==========================================
// STAFF
// ==========================================

export async function getStaffFromDb(): Promise<StaffMember[]> {
  try {
    if (isSqlHostConfigured()) {
      const rows = await db.select().from(staff);
      if (rows.length > 0) {
        const list: StaffMember[] = rows.map((r) => ({
          re: r.re,
          name: r.name,
          rank: r.rank ?? '',
          unit: r.unit ?? '',
          phone: r.phone ?? '',
          local: r.local ?? '',
          function: r.function ?? '',
          shiftRaw: r.shiftRaw ?? '',
          vehicle: r.vehicle ?? undefined,
          driver: r.driver ?? undefined,
        }));
        memoryStore.staff = list;
        persistStore();
        return list;
      }
    }
  } catch (error) {
    console.warn('Postgres getStaff notice, using local store:', (error as any)?.message || error);
  }

  if (memoryStore.staff.length > 0) {
    return memoryStore.staff;
  }
  return INITIAL_STAFF;
}

export async function saveStaffToDb(members: StaffMember[]): Promise<void> {
  if (members.length === 0) return;
  const map = new Map(memoryStore.staff.map((m) => [m.re, m]));
  for (const m of members) {
    map.set(m.re, m);
  }
  memoryStore.staff = Array.from(map.values());
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      for (const m of members) {
        await db
          .insert(staff)
          .values({
            re: m.re,
            name: m.name,
            rank: m.rank || '',
            unit: m.unit || '',
            phone: m.phone || '',
            local: m.local || '',
            function: m.function || '',
            shiftRaw: m.shiftRaw || '',
            vehicle: m.vehicle || null,
            driver: m.driver || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: staff.re,
            set: {
              name: m.name,
              rank: m.rank || '',
              unit: m.unit || '',
              phone: m.phone || '',
              local: m.local || '',
              function: m.function || '',
              shiftRaw: m.shiftRaw || '',
              vehicle: m.vehicle || null,
              driver: m.driver || null,
              updatedAt: new Date(),
            },
          });
      }
    }
  } catch (error) {
    console.warn('Postgres saveStaff notice:', (error as any)?.message || error);
  }
}

// ==========================================
// DEVICE BINDINGS
// ==========================================

export async function getDeviceBindingsFromDb(): Promise<Record<string, DeviceBinding>> {
  try {
    if (isSqlHostConfigured()) {
      const rows = await db.select().from(deviceBindings);
      const map: Record<string, DeviceBinding> = {};
      for (const r of rows) {
        map[r.deviceId] = {
          deviceId: r.deviceId,
          boundRe: r.boundRe,
          boundName: r.boundName,
          boundRank: r.boundRank,
          boundEmail: r.boundEmail ?? undefined,
          boundAt: r.boundAt,
        };
      }
      memoryStore.deviceBindings = map;
      persistStore();
      return map;
    }
  } catch (error) {
    console.warn('Postgres getDeviceBindings notice, using local store:', (error as any)?.message || error);
  }
  return memoryStore.deviceBindings;
}

export async function saveDeviceBindingToDb(binding: DeviceBinding): Promise<void> {
  memoryStore.deviceBindings[binding.deviceId] = binding;
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      await db
        .insert(deviceBindings)
        .values({
          deviceId: binding.deviceId,
          boundRe: binding.boundRe,
          boundName: binding.boundName,
          boundRank: binding.boundRank,
          boundEmail: binding.boundEmail,
          boundAt: binding.boundAt,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: deviceBindings.deviceId,
          set: {
            boundRe: binding.boundRe,
            boundName: binding.boundName,
            boundRank: binding.boundRank,
            boundEmail: binding.boundEmail,
            boundAt: binding.boundAt,
            updatedAt: new Date(),
          },
        });
    }
  } catch (error) {
    console.warn('Postgres saveDeviceBinding notice:', (error as any)?.message || error);
  }
}

// ==========================================
// AUDIT LOGS
// ==========================================

export async function getAuditLogsFromDb(): Promise<AuditJustificationRecord[]> {
  try {
    if (isSqlHostConfigured()) {
      const rows = await db.select().from(auditLogs);
      const list: AuditJustificationRecord[] = rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        dateTimeStr: r.dateTimeStr,
        deviceId: r.deviceId,
        userEmail: r.userEmail ?? undefined,
        originRe: r.originRe,
        originName: r.originName,
        targetRe: r.targetRe,
        targetName: r.targetName,
        justification: r.justification,
      }));
      memoryStore.auditLogs = list;
      persistStore();
      return list;
    }
  } catch (error) {
    console.warn('Postgres getAuditLogs notice, using local store:', (error as any)?.message || error);
  }
  return memoryStore.auditLogs;
}

export async function saveAuditLogToDb(log: AuditJustificationRecord): Promise<void> {
  const existingIdx = memoryStore.auditLogs.findIndex((l) => l.id === log.id);
  if (existingIdx >= 0) {
    memoryStore.auditLogs[existingIdx] = log;
  } else {
    memoryStore.auditLogs.unshift(log);
  }
  if (memoryStore.auditLogs.length > 500) {
    memoryStore.auditLogs = memoryStore.auditLogs.slice(0, 500);
  }
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      await db
        .insert(auditLogs)
        .values({
          id: log.id || `audit-${Date.now()}`,
          timestamp: log.timestamp || Date.now(),
          dateTimeStr: log.dateTimeStr || new Date().toLocaleString('pt-BR'),
          deviceId: log.deviceId || 'unknown',
          userEmail: log.userEmail || null,
          originRe: log.originRe || '',
          originName: log.originName || '',
          targetRe: log.targetRe || '',
          targetName: log.targetName || '',
          justification: log.justification || log.reason || 'Log',
        } as any)
        .onConflictDoNothing();
    }
  } catch (error) {
    console.warn('Postgres saveAuditLog notice:', (error as any)?.message || error);
  }
}

// ==========================================
// SYSTEM CONFIG
// ==========================================

export async function getConfigFromDb<T>(key: string): Promise<T | null> {
  try {
    if (isSqlHostConfigured()) {
      const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, key));
      if (rows.length > 0) {
        const val = rows[0].configJson as T;
        memoryStore.systemConfig[key] = val;
        persistStore();
        return val;
      }
    }
  } catch (error) {
    console.warn(`Postgres getConfig (${key}) notice, using local store:`, (error as any)?.message || error);
  }

  if (memoryStore.systemConfig[key] !== undefined) {
    return memoryStore.systemConfig[key] as T;
  }
  return null;
}

export async function saveConfigToDb(key: string, value: any): Promise<void> {
  memoryStore.systemConfig[key] = value;
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      await db
        .insert(systemConfig)
        .values({
          key,
          configJson: value,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemConfig.key,
          set: {
            configJson: value,
            updatedAt: new Date(),
          },
        });
    }
  } catch (error) {
    console.warn(`Postgres saveConfig (${key}) notice:`, (error as any)?.message || error);
  }
}

export async function deleteCheckInFromDb(id: string): Promise<void> {
  memoryStore.checkins = memoryStore.checkins.filter((c) => c.id !== id);
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      await db.delete(checkins).where(eq(checkins.id, id));
    }
  } catch (error) {
    console.warn('Postgres deleteCheckIn notice:', (error as any)?.message || error);
  }
}

export async function deleteRondaFromDb(id: string): Promise<void> {
  memoryStore.rondas = memoryStore.rondas.filter((r) => r.id !== id);
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      await db.delete(rondas).where(eq(rondas.id, id));
    }
  } catch (error) {
    console.warn('Postgres deleteRonda notice:', (error as any)?.message || error);
  }
}

export async function deleteDeviceBindingFromDb(deviceId: string): Promise<void> {
  delete memoryStore.deviceBindings[deviceId];
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      await db.delete(deviceBindings).where(eq(deviceBindings.deviceId, deviceId));
    }
  } catch (error) {
    console.warn('Postgres deleteDeviceBinding notice:', (error as any)?.message || error);
  }
}

export async function deleteAuditLogFromDb(id: string): Promise<void> {
  memoryStore.auditLogs = memoryStore.auditLogs.filter((l) => l.id !== id);
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      await db.delete(auditLogs).where(eq(auditLogs.id, id));
    }
  } catch (error) {
    console.warn('Postgres deleteAuditLog notice:', (error as any)?.message || error);
  }
}

export async function clearRangeFromDb(from: number, to: number): Promise<void> {
  memoryStore.checkins = memoryStore.checkins.filter((c) => c.timestamp < from || c.timestamp >= to);
  memoryStore.rondas = memoryStore.rondas.filter((r) => r.timestamp < from || r.timestamp >= to);
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      await db.delete(checkins).where(and(gte(checkins.timestamp, from), lt(checkins.timestamp, to)));
      await db.delete(rondas).where(and(gte(rondas.timestamp, from), lt(rondas.timestamp, to)));
    }
  } catch (error) {
    console.warn('Postgres clearRange notice:', (error as any)?.message || error);
  }
}

// ==========================================
// SYSTEM WIPE / RESET
// ==========================================

export async function wipeAllDbTables(): Promise<void> {
  memoryStore = {
    checkins: [],
    rondas: [],
    schools: [],
    staff: [],
    deviceBindings: {},
    auditLogs: [],
    systemConfig: {},
  };
  persistStore();

  try {
    if (isSqlHostConfigured()) {
      await db.delete(checkins);
      await db.delete(rondas);
      await db.delete(schools);
      await db.delete(staff);
      await db.delete(deviceBindings);
      await db.delete(auditLogs);
      await db.delete(systemConfig);
    }
  } catch (error) {
    console.warn('Postgres wipeAllDbTables notice:', (error as any)?.message || error);
  }
}
