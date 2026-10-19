import { DeviceBinding } from '../types';

const STORAGE_KEYS = {
  DEVICE_BINDING: 'pmesp_eleicoes_device_binding_v1',
  DEVICE_ID: 'pmesp_eleicoes_device_uuid_v1',
  SUPERVISOR_SESSION: 'pmesp_eleicoes_supervisor_session_v1',
  AUDIT_LOGS: 'pmesp_eleicoes_audit_logs_v1'
};

/**
 * Returns or creates a persistent unique Device ID (UUID fallback)
 */
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
    }
    return id;
  } catch {
    return 'dev-anon-' + Date.now();
  }
}

/**
 * Returns current device binding if present
 */
export function getDeviceBinding(): DeviceBinding | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEVICE_BINDING);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Erro ao ler device binding:', err);
  }
  return null;
}

/**
 * Saves or updates device binding
 */
export function saveDeviceBinding(binding: DeviceBinding): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DEVICE_BINDING, JSON.stringify(binding));
  } catch (err) {
    console.warn('Erro ao salvar device binding:', err);
  }
}

/**
 * Removes device binding (for official reset / logout)
 */
export function clearDeviceBinding(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.DEVICE_BINDING);
  } catch {}
}
