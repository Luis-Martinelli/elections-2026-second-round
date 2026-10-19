/**
 * Database Service & Abstraction Layer
 * 40º BPM/I - Operação Eleições 2026 (2º Turno)
 *
 * This service defines a plug-and-play DatabaseAdapter interface.
 * Currently uses LocalDatabaseAdapter (fast, resilient browser storage)
 * and is 100% ready to plug into PostgreSQL, Cloud SQL, REST API, or any backend.
 */

import { SchoolItem, StaffMember, CheckInRecord, RondaRecord, AuditJustificationRecord, GoogleSheetsConfig, DEFAULT_SHEETS_CONFIG } from '../types';
import { INITIAL_SCHOOLS, INITIAL_STAFF } from '../data/initialData';

export interface DatabaseAdapter {
  name: string;
  // Schools
  getSchools(): Promise<SchoolItem[]>;
  saveSchools(schools: SchoolItem[]): Promise<void>;
  // Staff
  getStaff(): Promise<StaffMember[]>;
  saveStaff(staff: StaffMember[]): Promise<void>;
  // Check-ins
  getCheckIns(): Promise<CheckInRecord[]>;
  saveCheckIn(record: CheckInRecord): Promise<void>;
  deleteCheckIn(id: string): Promise<void>;
  // Rondas
  getRondas(): Promise<RondaRecord[]>;
  saveRonda(record: RondaRecord): Promise<void>;
  deleteRonda(id: string): Promise<void>;
  // Audit Logs
  getAuditLogs(): Promise<AuditJustificationRecord[]>;
  saveAuditLog(log: AuditJustificationRecord): Promise<void>;
  deleteAuditLog(id: string): Promise<void>;
  // System Config
  getConfig(): Promise<GoogleSheetsConfig>;
  saveConfig(config: GoogleSheetsConfig): Promise<void>;
  // Clear / Reset
  clearOperationalData(): Promise<void>;
}

const STORAGE_KEYS = {
  SCHOOLS: 'pmesp_eleicoes_2turno_schools',
  STAFF: 'pmesp_eleicoes_2turno_staff',
  CHECKINS: 'pmesp_eleicoes_2turno_checkins',
  RONDAS: 'pmesp_eleicoes_2turno_rondas',
  AUDIT_LOGS: 'pmesp_eleicoes_2turno_audit_logs',
  CONFIG: 'pmesp_eleicoes_2turno_config'
};

class LocalDatabaseAdapter implements DatabaseAdapter {
  name = 'Local & In-Memory (Ready for Backend Database)';

  async getSchools(): Promise<SchoolItem[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler escolas do armazenamento:', e);
    }
    return INITIAL_SCHOOLS;
  }

  async saveSchools(schools: SchoolItem[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(schools));
    } catch (e) {
      console.warn('Erro ao salvar escolas:', e);
    }
  }

  async getStaff(): Promise<StaffMember[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STAFF);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler efetivo do armazenamento:', e);
    }
    return INITIAL_STAFF;
  }

  async saveStaff(staff: StaffMember[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
    } catch (e) {
      console.warn('Erro ao salvar efetivo:', e);
    }
  }

  async getCheckIns(): Promise<CheckInRecord[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CHECKINS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler check-ins:', e);
    }
    return [];
  }

  async saveCheckIn(record: CheckInRecord): Promise<void> {
    try {
      const current = await this.getCheckIns();
      const updated = [record, ...current.filter((c) => c.id !== record.id)];
      localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar check-in:', e);
    }
  }

  async deleteCheckIn(id: string): Promise<void> {
    try {
      const current = await this.getCheckIns();
      const filtered = current.filter((c) => c.id !== id);
      localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Erro ao excluir check-in:', e);
    }
  }

  async getRondas(): Promise<RondaRecord[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RONDAS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler rondas:', e);
    }
    return [];
  }

  async saveRonda(record: RondaRecord): Promise<void> {
    try {
      const current = await this.getRondas();
      const updated = [record, ...current.filter((r) => r.id !== record.id)];
      localStorage.setItem(STORAGE_KEYS.RONDAS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar ronda:', e);
    }
  }

  async deleteRonda(id: string): Promise<void> {
    try {
      const current = await this.getRondas();
      const filtered = current.filter((r) => r.id !== id);
      localStorage.setItem(STORAGE_KEYS.RONDAS, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Erro ao excluir ronda:', e);
    }
  }

  async getAuditLogs(): Promise<AuditJustificationRecord[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler logs de auditoria:', e);
    }
    return [];
  }

  async saveAuditLog(log: AuditJustificationRecord): Promise<void> {
    try {
      const current = await this.getAuditLogs();
      const updated = [log, ...current.filter((l) => l.id !== log.id)].slice(0, 300);
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar log de auditoria:', e);
    }
  }

  async deleteAuditLog(id: string): Promise<void> {
    try {
      const current = await this.getAuditLogs();
      const filtered = current.filter((l) => l.id !== id);
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Erro ao excluir log de auditoria:', e);
    }
  }

  async getConfig(): Promise<GoogleSheetsConfig> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (data) {
        const parsed = JSON.parse(data);
        return { ...DEFAULT_SHEETS_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn('Erro ao ler configuração:', e);
    }
    return DEFAULT_SHEETS_CONFIG;
  }

  async saveConfig(config: GoogleSheetsConfig): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch (e) {
      console.warn('Erro ao salvar configuração:', e);
    }
  }

  async clearOperationalData(): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.CHECKINS, '[]');
      localStorage.setItem(STORAGE_KEYS.RONDAS, '[]');
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, '[]');
    } catch (e) {
      console.warn('Erro ao resetar dados operacionais:', e);
    }
  }
}

// Active singleton database adapter instance
export const db: DatabaseAdapter = new LocalDatabaseAdapter();

// Helper export functions mapped directly to db adapter for ease of use across components
export const getSchoolsFromDb = () => db.getSchools();
export const saveSchoolsToDb = (schools: SchoolItem[]) => db.saveSchools(schools);

export const getStaffFromDb = () => db.getStaff();
export const saveStaffToDb = (staff: StaffMember[]) => db.saveStaff(staff);

export const getCheckInsFromDb = () => db.getCheckIns();
export const saveCheckInToDb = (record: CheckInRecord) => db.saveCheckIn(record);
export const deleteCheckInFromDb = (id: string) => db.deleteCheckIn(id);

export const getRondasFromDb = () => db.getRondas();
export const saveRondaToDb = (record: RondaRecord) => db.saveRonda(record);
export const deleteRondaFromDb = (id: string) => db.deleteRonda(id);

export const getAuditLogsFromDb = () => db.getAuditLogs();
export const saveAuditLogToDb = (log: AuditJustificationRecord) => db.saveAuditLog(log);
export const deleteAuditLogFromDb = (id: string) => db.deleteAuditLog(id);

export const getConfigFromDb = () => db.getConfig();
export const saveConfigToDb = (cfg: GoogleSheetsConfig) => db.saveConfig(cfg);

export const clearOperationalDataFromDb = () => db.clearOperationalData();
