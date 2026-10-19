import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { DriveFileItem, SchoolItem, StaffMember, CheckInRecord, RondaRecord, AuditJustificationRecord, SchoolOfficer } from '../types';
import { normalizeText, normalizeRe, cleanDisplayRe, matchesExactRe } from '../utils/normalize';
import { resolveMunicipality, detectCityFromText } from '../utils/municipality';
import { findSchoolCoordinates, registerDynamicCoordinates, SchoolGeoEntry } from '../data/schoolCoordinates';

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account'
});

const STORAGE_TOKEN_KEY = 'pmesp_google_access_token_v1';

let cachedAccessToken: string | null = (() => {
  try {
    return sessionStorage.getItem(STORAGE_TOKEN_KEY);
  } catch {
    return null;
  }
})();

let isSigningIn = false;

type AuthSubscriber = (user: User | null, token: string | null) => void;
const subscribers: AuthSubscriber[] = [];

const notifySubscribers = (user: User | null, token: string | null) => {
  subscribers.forEach((cb) => {
    try {
      cb(user, token);
    } catch (err) {
      console.error('Erro ao notificar subscriber de auth:', err);
    }
  });
};

export const getAccessToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const stored = sessionStorage.getItem(STORAGE_TOKEN_KEY);
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  } catch {}
  return null;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(STORAGE_TOKEN_KEY);
    }
  } catch {}
  notifySubscribers(auth.currentUser, token);
};

export const initAuth = (
  onAuthChange: (user: User | null, token: string | null) => void
) => {
  subscribers.push(onAuthChange);

  // Immediately notify with current auth state if available
  const existingToken = getAccessToken();
  if (auth.currentUser) {
    onAuthChange(auth.currentUser, existingToken);
  }

  const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const activeToken = getAccessToken();
      notifySubscribers(user, activeToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        try {
          sessionStorage.removeItem(STORAGE_TOKEN_KEY);
        } catch {}
        notifySubscribers(null, null);
      }
    }
  });

  return () => {
    const idx = subscribers.indexOf(onAuthChange);
    if (idx !== -1) subscribers.splice(idx, 1);
    unsubscribe();
  };
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error(
        'Não foi possível obter o token de acesso da conta Google. Verifique as permissões de acesso.'
      );
    }

    cachedAccessToken = token;
    try {
      sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
    } catch {}

    notifySubscribers(result.user, token);
    return { user: result.user, accessToken: token };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.message?.includes('popup-closed-by-user')
    ) {
      console.info('Autenticação Google cancelada pelo usuário (janela fechada).');
    } else {
      console.error('Erro de autenticação Google:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const googleLogout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem(STORAGE_TOKEN_KEY);
  } catch {}
  notifySubscribers(null, null);
};

/**
 * Extract clean spreadsheet ID from either a full URL or a direct ID string.
 */
export function extractSpreadsheetId(idOrUrl: string): string {
  if (!idOrUrl) return '';
  const trimmed = idOrUrl.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Attempt to fetch tab names from a publicly shared Google Sheet
 */
export async function fetchPublicSheetTabs(spreadsheetIdInput: string): Promise<string[]> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  if (!spreadsheetId) return [];
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`);
    if (!res.ok) return [];
    const html = await res.text();
    const matches = Array.from(
      html.matchAll(/<li\s+id="sheet-button-[^"]*"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/gi)
    );
    const tabs = matches
      .map((m) => m[1]?.trim())
      .filter((t): t is string => Boolean(t) && t.length > 0);
    return tabs;
  } catch {
    return [];
  }
}

/**
 * Fetch rows from a publicly shared Google Sheet via Google Visualization API (GViz)
 */
export async function fetchPublicSheetValues(
  spreadsheetIdInput: string,
  sheetName?: string
): Promise<string[][]> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  if (!spreadsheetId) return [];
  try {
    const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : '';
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json${sheetParam}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const text = await res.text();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return [];
    const jsonStr = text.substring(jsonStart, jsonEnd + 1);
    const data = JSON.parse(jsonStr);
    const table = data?.table;
    if (!table || !table.rows) return [];

    const rows: string[][] = [];

    // Check if column labels exist
    if (table.cols && table.cols.length > 0) {
      const headerRow = table.cols.map((c: any) => c?.label || '');
      if (headerRow.some((h: string) => h && h.trim().length > 0)) {
        rows.push(headerRow);
      }
    }

    table.rows.forEach((r: any) => {
      const rowVals = (r.c || []).map((cell: any) => {
        if (!cell) return '';
        if (cell.f !== undefined && cell.f !== null) return String(cell.f);
        if (cell.v !== undefined && cell.v !== null) return String(cell.v);
        return '';
      });
      rows.push(rowVals);
    });

    return rows;
  } catch {
    return [];
  }
}

/**
 * List all spreadsheets (Google Sheets, Excel .xlsx/.xls, CSV) in the user's Google Drive and Shared Drives
 */
export async function listDriveSpreadsheets(token: string): Promise<DriveFileItem[]> {
  if (!token) {
    throw new Error('Token de acesso não fornecido. Conecte sua Conta Google primeiro.');
  }

  const mimeConditions = [
    "mimeType='application/vnd.google-apps.spreadsheet'",
    "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
    "mimeType='application/vnd.ms-excel'",
    "mimeType='text/csv'"
  ].join(' or ');

  // 1. Try with supportsAllDrives & includeItemsFromAllDrives to include shared drives and files shared with user
  try {
    const query = encodeURIComponent(`(${mimeConditions}) and trashed=false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime+desc&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      return (data.files || []) as DriveFileItem[];
    }

    if (res.status === 401) {
      setAccessToken(null);
      throw new Error(
        'Sua sessão da Conta Google expirou (401). Clique no botão "Entrar com o Google" para renovar o acesso.'
      );
    }
  } catch (firstErr: any) {
    if (firstErr?.message?.includes('401') || firstErr?.message?.includes('expirou')) {
      throw firstErr;
    }
    console.warn('Tentativa com supportsAllDrives falhou, tentando busca padrão:', firstErr);
  }

  // 2. Fallback simpler query
  try {
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime+desc&pageSize=100`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      if (res.status === 401) {
        setAccessToken(null);
        throw new Error(
          'Sua sessão da Conta Google expirou (401). Clique no botão "Entrar com o Google" para renovar o acesso.'
        );
      }
      const errText = await res.text();
      throw new Error(`Erro ao listar planilhas do Google Drive (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return (data.files || []) as DriveFileItem[];
  } catch (err: any) {
    throw err;
  }
}

/**
 * Get sheet tab names in a spreadsheet
 */
export async function getSpreadsheetTabs(
  spreadsheetIdInput: string,
  token?: string | null
): Promise<string[]> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  if (!spreadsheetId) return [];

  // 1. Try authenticated API if token exists
  if (token) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        return (data.sheets || []).map((s: { properties: { title: string } }) => s.properties.title);
      }

      if (res.status === 401) {
        setAccessToken(null);
        // Fallback to public tabs
        const pubTabs = await fetchPublicSheetTabs(spreadsheetId);
        if (pubTabs.length > 0) return pubTabs;

        throw new Error(
          'Sua sessão da Conta Google expirou (401). Clique em "Conectar Planilhas" para reconectar sua conta Google.'
        );
      }
    } catch (err: any) {
      if (err.message?.includes('401')) {
        // Fallback to public tabs
        const pubTabs = await fetchPublicSheetTabs(spreadsheetId);
        if (pubTabs.length > 0) return pubTabs;
        throw err;
      }
    }
  }

  // 2. Fallback to public sheet tabs
  const pubTabs = await fetchPublicSheetTabs(spreadsheetId);
  if (pubTabs.length > 0) {
    return pubTabs;
  }

  // 3. Fallback: single default sheet (no artificial tab duplicates!)
  return [''];
}

/**
 * Read matrix values from a specific tab range
 */
export async function readSpreadsheetValues(
  spreadsheetIdInput: string,
  range: string,
  token?: string | null
): Promise<string[][]> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  if (!spreadsheetId) return [];

  // 1. If token provided, try official Google Sheets API
  if (token) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        range
      )}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        return (data.values || []) as string[][];
      }

      if (res.status === 401) {
        setAccessToken(null);
        // Fallback to public read
        const tabMatch = range.match(/^'?([^'!]+)'?!/);
        const tabName = tabMatch ? tabMatch[1] : undefined;
        const pubRows = await fetchPublicSheetValues(spreadsheetId, tabName);
        if (pubRows.length > 0) return pubRows;

        throw new Error(
          'Sua sessão da Conta Google expirou (401). Faça login novamente para renovar o acesso.'
        );
      }
    } catch (err: any) {
      if (err.message?.includes('401')) {
        const tabMatch = range.match(/^'?([^'!]+)'?!/);
        const tabName = tabMatch ? tabMatch[1] : undefined;
        const pubRows = await fetchPublicSheetValues(spreadsheetId, tabName);
        if (pubRows.length > 0) return pubRows;
        throw err;
      }
    }
  }

  // 2. Public read fallback
  const tabMatch = range.match(/^'?([^'!]+)'?!/);
  const tabName = tabMatch ? tabMatch[1] : undefined;
  const pubRows = await fetchPublicSheetValues(spreadsheetId, tabName);
  if (pubRows.length > 0) {
    return pubRows;
  }

  return [];
}

// Network calls to the Sheets API must never hang the UI on a weak connection
const SHEETS_TIMEOUT_MS = 15000;

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHEETS_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Tabs already confirmed to exist in this session ("spreadsheetId/tab"), so each append does
// not list every tab of the spreadsheet first.
const knownTabs = new Set<string>();

/**
 * Ensures a dedicated Check-ins tab exists in the spreadsheet.
 * If not, creates it and adds standard operational headers.
 */
export async function ensureCheckinsTab(
  spreadsheetIdInput: string,
  tabName: string,
  token: string
): Promise<void> {
  if (!token) return;
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  const tabKey = `${spreadsheetId}/${tabName}`;
  if (knownTabs.has(tabKey)) return;
  const tabs = await getSpreadsheetTabs(spreadsheetId, token);

  if (!tabs.includes(tabName)) {
    // Create tab
    const addSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const res = await fetchWithTimeout(addSheetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName,
                gridProperties: {
                  frozenRowCount: 1
                }
              }
            }
          }
        ]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      // Already created by a concurrent append: the other call writes the header
      if (errText.includes('already exists')) {
        knownTabs.add(tabKey);
        return;
      }
      throw new Error(
        `Não foi possível criar a aba "${tabName}" na planilha. Verifique se você tem permissão de Editor nesta planilha no Google Drive.`
      );
    }

    // Write header row (only after this call created the tab, so it is never duplicated)
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      `'${tabName}'!A1:O1`
    )}:append?valueInputOption=USER_ENTERED`;

    await fetchWithTimeout(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [
          [
            'Data/Hora Militar',
            'Protocolo',
            'Tipo Registro',
            'RE',
            'Posto / Graduação',
            'Nome Completo',
            'Turno',
            'Posto Eleitoral / Escola',
            'Município',
            'Latitude',
            'Longitude',
            'Precisão GPS (m)',
            'Distância do Posto (m)',
            'Validação Raio 150m',
            'Situação / Observação'
          ]
        ]
      })
    });
  }
  knownTabs.add(tabKey);
}

// ==========================================
// MODO ESTRITAMENTE LEITURA (Sheets Read-Only)
// O sistema não tenta gravar nem enfileirar nenhuma linha no Google Sheets.
// ==========================================

export function hasQueuedSheetRows(): boolean {
  return false;
}

export async function flushSheetsQueue(_token: string): Promise<void> {
  // Leitura estrita: nenhuma operação de escrita
  try {
    localStorage.removeItem('pmesp_sheets_pending_rows_v1');
  } catch {}
}

/**
 * Append a check-in record - DESATIVADO: Modo Estritamente Leitura
 */
export async function appendCheckInToSheet(
  _spreadsheetIdInput: string,
  _tabName: string,
  _record: CheckInRecord,
  _token: string
): Promise<boolean> {
  // Estritamente leitura: não grava nada no Sheets
  return true;
}

/**
 * Append a ronda record - DESATIVADO: Modo Estritamente Leitura
 */
export async function appendRondaToSheet(
  _spreadsheetIdInput: string,
  _tabName: string,
  _record: RondaRecord,
  _token: string
): Promise<boolean> {
  // Estritamente leitura: não grava nada no Sheets
  return true;
}

/**
 * Append an audit justification record - DESATIVADO: Modo Estritamente Leitura
 */
export async function appendAuditJustificationToSheet(
  _spreadsheetIdInput: string,
  _tabName: string,
  _record: AuditJustificationRecord,
  _token: string
): Promise<boolean> {
  // Estritamente leitura: não grava nada no Sheets
  return true;
}

/**
 * Robust parser to extract SchoolItems from the fixed staff spreadsheet matrix.
 * Handles headers in top 6 rows, multi-level headers, and varying column names.
 * Parameter tabContext provides fallback city or company name (e.g. "VOTORANTIM", "2ª CIA").
 */
function isMilitaryRankValue(val: string): boolean {
  if (!val) return false;
  const norm = val.toUpperCase().trim();
  return (
    /^(?:SD|CB|SGT|[123]º?\s*SGT|SUBTEN|TEN|[12]º?\s*TEN|CAP|MAJ|TC|CEL|ASP)(?:\s+PM)?$/i.test(norm) ||
    /^(?:POLICIAL MILITAR|SOLDADO|CABO|SARGENTO|TENENTE|CAPITAO|MAJOR|CORONEL|SUBTENENTE)$/i.test(norm)
  );
}

/**
 * Advanced, robust parser for Election Fixed Staff (Escolas e Postos Eleitorais)
 * Correctly handles:
 * - Top super-headers and sub-headers (e.g. "1º Turno (06h às 12h)" vs "2º Turno (12h ao término)")
 * - Merged cells across columns (propagating non-empty header titles horizontally)
 * - Multiple officers per row (Manhã & Tarde) strictly keeping RE and Name in their respective pairs
 * - PMESP abbreviations (RE PM, Nome do PM, Posto/Grad PM) where PM means Policial Militar, not afternoon
 * - Addresses and school names containing "RE" or "NOME" (e.g. "ENDEREÇO", "REGISTRO", "NOME DA ESCOLA") are never confused with officer RE or officer Name
 * - Merged rows where School Name or City is left blank in subsequent shifts
 * - Single-officer-per-row format with "TURNO" column
 */
export function parseFixedStaffSheet(rows: string[][], tabContext?: string): SchoolItem[] {
  if (!rows || rows.length < 2) {
    return [];
  }

  // Ignore GCM (Guarda Civil Municipal) tab and its content
  if (tabContext) {
    const normTab = normalizeText(tabContext);
    if (normTab.includes('GCM') || normTab.includes('GUARDA CIVIL') || normTab.includes('GUARDA MUNICIPAL')) {
      return [];
    }
  }

  // 1. Detect best header row by scoring rows 0..5
  let bestHeaderRow = 0;
  let bestScore = -1;

  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const rowNorm = (rows[r] || []).map((c) => normalizeText(c || ''));
    let score = 0;
    rowNorm.forEach((cell) => {
      if (/\b(?:ESCOLA|POSTO|LOCAL|COLEGIO|VOTACAO)\b/i.test(cell)) score += 3;
      if (/\b(?:RE|R\.?E\.?)\b/i.test(cell)) score += 3;
      if (/\b(?:NOME|POLICIAL|MILITAR|EFETIVO)\b/i.test(cell)) score += 2;
      if (/\b(?:CIDADE|MUNICIP)\b/i.test(cell)) score += 2;
      if (/\b(?:MANHA|TARDE|TURNO)\b/i.test(cell)) score += 2;
    });

    if (score > bestScore) {
      bestScore = score;
      bestHeaderRow = r;
    }
  }

  const numCols = Math.max(...rows.slice(0, Math.min(rows.length, 10)).map((r) => r.length));

  // 2. Horizontally forward-fill super headers only for structural multi-column labels (like 1º TURNO / 2º TURNO)
  const superHeader: string[] = new Array(numCols).fill('');
  for (let r = 0; r < bestHeaderRow; r++) {
    const row = rows[r] || [];
    let currentVal = '';
    for (let c = 0; c < numCols; c++) {
      const cell = (row[c] || '').trim();
      // Only forward-fill shift or section indicators, never general sheet banners/titles
      if (cell) {
        if (/^(?:1[º°ª]?\s*TURNO|2[º°ª]?\s*TURNO|MANH[ÃA]|TARDE|LOCAL|EFETIVO)\b/i.test(cell)) {
          currentVal = cell;
        } else {
          currentVal = '';
        }
      }
      if (cell) {
        superHeader[c] = superHeader[c] ? `${superHeader[c]} ${cell}` : cell;
      } else if (currentVal) {
        superHeader[c] = superHeader[c] ? `${superHeader[c]} ${currentVal}` : currentVal;
      }
    }
  }

  const primaryHeaders = rows[bestHeaderRow] || [];
  const subHeaders = bestHeaderRow + 1 < rows.length ? rows[bestHeaderRow + 1] : [];

  const headers: string[] = [];
  for (let c = 0; c < numCols; c++) {
    const s = normalizeText(superHeader[c] || '');
    const p = normalizeText(primaryHeaders[c] || '');
    const sub = normalizeText(subHeaders[c] || '');
    headers[c] = `${s} ${p} ${sub}`.trim();
  }

  // 3. Data-driven column profiling on sample rows to eliminate ambiguity
  const sampleRows = rows.slice(bestHeaderRow + 1, Math.min(rows.length, bestHeaderRow + 40));

  function getColStats(colIdx: number) {
    let totalNonEmpty = 0;
    let reCount = 0;
    let nameCount = 0;
    let rankCount = 0;
    let schoolCount = 0;
    let cityCount = 0;

    for (const r of sampleRows) {
      const val = (r[colIdx] || '').trim();
      if (!val) continue;
      totalNonEmpty++;

      if (isMilitaryRankValue(val)) {
        rankCount++;
        continue;
      }

      const clean = cleanDisplayRe(val);
      const digitsOnly = clean.replace(/[^0-9]/g, '');
      if (
        /^\d{5,8}[-]?[0-9A-Za-z]?$/.test(clean) ||
        (digitsOnly.length >= 5 && digitsOnly.length <= 8 && val.length <= 14)
      ) {
        reCount++;
      }

      const norm = normalizeText(val);
      const hasLetters = /[A-Z]/.test(norm);
      const hasDigits = /\d/.test(val);
      const wordCount = norm.split(' ').filter((w) => w.length > 1).length;
      const isSchoolKeyword =
        /^(?:EE|EM|EMEIF|EMEF|CIEP|COL|ESCOLA|COLEGIO|FACULDADE)\b/.test(norm) ||
        norm.includes('PROFESSOR') ||
        norm.includes('DOUTOR') ||
        (norm.includes('CORONEL') && norm.includes('ESCOLA'));

      if (hasLetters && !hasDigits && wordCount >= 2 && !isSchoolKeyword) {
        nameCount++;
      }
      if (isSchoolKeyword) {
        schoolCount++;
      }
      if (detectCityFromText(val)) {
        cityCount++;
      }
    }

    return {
      reRatio: totalNonEmpty > 0 ? reCount / totalNonEmpty : 0,
      nameRatio: totalNonEmpty > 0 ? nameCount / totalNonEmpty : 0,
      rankRatio: totalNonEmpty > 0 ? rankCount / totalNonEmpty : 0,
      schoolRatio: totalNonEmpty > 0 ? schoolCount / totalNonEmpty : 0,
      cityRatio: totalNonEmpty > 0 ? cityCount / totalNonEmpty : 0
    };
  }

  // 4. Identify Location Columns
  let colSchool = headers.findIndex((h) => {
    if (/\b(?:LOCAL DE VOTACAO|POSTO ELEITORAL|POSTO DE VOTACAO|NOME DA ESCOLA|COLEGIO|ESTABELECIMENTO|PREDIO)\b/i.test(h)) return true;
    if (/\b(?:ESCOLA|LOCAL)\b/i.test(h) && !/\b(?:POLICIAL|MILITAR|EFETIVO|NOME|RE|CIDADE|MUNICIP)\b/i.test(h)) return true;
    return false;
  });

  let colCity = headers.findIndex((h) =>
    /\b(?:MUNICIP|CIDADE|COMARCA|MUN\b|CID\b|LOCALIDADE|MUNICIPIO)\b/i.test(h)
  );
  const colBairro = headers.findIndex((h) => /\b(?:BAIRRO|DISTRITO|SETOR)\b/i.test(h));
  const colZone = headers.findIndex((h) => /\b(?:ZONA)\b/i.test(h));
  const colOpm = headers.findIndex((h) => /\b(?:OPM|CIA|SUBUNIDADE|COMPANHIA)\b/i.test(h));
  const colTurnoSingle = headers.findIndex(
    (h) => /\b(?:TURNO|PERIODO|HORARIO)\b/i.test(h) && !/\b(?:1|2|MANHA|TARDE)\b/i.test(h)
  );

  // If header didn't catch city column, detect via data profiling
  if (colCity === -1) {
    let maxCityRatio = 0;
    let bestCityCol = -1;
    for (let c = 0; c < numCols; c++) {
      if (c === colSchool || c === colZone) continue;
      const stats = getColStats(c);
      if (stats.cityRatio > maxCityRatio && stats.cityRatio >= 0.15) {
        maxCityRatio = stats.cityRatio;
        bestCityCol = c;
      }
    }
    if (bestCityCol !== -1) {
      colCity = bestCityCol;
    }
  }

  // Fallback for school column if not explicitly identified
  if (colSchool === -1) {
    // Find column with highest school ratio or first text column
    for (let c = 0; c < numCols; c++) {
      if (c === colCity || c === colBairro || c === colZone) continue;
      const stats = getColStats(c);
      if (stats.schoolRatio >= 0.2) {
        colSchool = c;
        break;
      }
    }
    if (colSchool === -1) colSchool = 0;
  }

  // 5. Identify Officer Columns (RE, Name, Rank, Phone)
  const reCandidateCols: number[] = [];
  const nameCandidateCols: number[] = [];
  const rankCandidateCols: number[] = [];
  const phoneCandidateCols: number[] = [];

  for (let c = 0; c < numCols; c++) {
    const h = headers[c] || '';
    if (c === colSchool || c === colCity || c === colBairro || c === colZone) continue;

    const stats = getColStats(c);

    // Rank check:
    const isRankHeader =
      /\b(?:POSTO\s*\/\s*GRAD|POSTO\s*GRAD|P\/G|\bGRAD\b|\bPOSTO\b)\b/i.test(h) &&
      !/\b(?:POSTO\s*ELEITORAL|POSTO\s*DE\s*VOTAC|LOCAL)\b/i.test(h);
    if (isRankHeader || stats.rankRatio >= 0.3) {
      rankCandidateCols.push(c);
      continue;
    }

    // RE check: Never match address or district as RE
    const isReHeader =
      /\b(?:RE|R\.?E\.?|REGISTRO(?:\s*ESTATISTICO)?)\b/i.test(h) &&
      !/\b(?:ENDERECO|BAIRRO|REGIAO|RESPONSAVEL|SECRETARIA|REFERENCIA|TRE|DIRETORIA|SETORES|CIDADE|MUNICIPIO)\b/i.test(h);

    if ((isReHeader && stats.reRatio >= 0.2) || stats.reRatio >= 0.4) {
      reCandidateCols.push(c);
      continue;
    }

    // Name check: Never match school name as officer name
    const isNameHeader =
      /\b(?:NOME|POLICIAL|MILITAR|EFETIVO|ESCALADO)\b/i.test(h) &&
      !/\b(?:ESCOLA|COLEGIO|POSTO\s*ELEITORAL|POSTO\s*DE\s*VOTAC|LOCAL\s*DE\s*VOTAC|LOCAL\b|PREDIO|ESTABELECIMENTO|CIDADE|MUNICIPIO|BAIRRO|RUA|ENDERECO|POSTO|GRAD|P\/G)\b/i.test(h);

    if (
      (isNameHeader && stats.nameRatio >= 0.2 && stats.schoolRatio === 0) ||
      (stats.nameRatio >= 0.4 && stats.schoolRatio === 0)
    ) {
      nameCandidateCols.push(c);
      continue;
    }

    // Phone check:
    if (/\b(?:TEL|FONE|CEL|CONTATO|TELEFONE|CELULAR)\b/i.test(h)) {
      phoneCandidateCols.push(c);
    }
  }

  // 6. Assign Turno 1 (Manhã) & Turno 2 (Tarde) columns
  let colAmRe = -1, colPmRe = -1;
  let colAmName = -1, colPmName = -1;
  let colAmRank = -1, colPmRank = -1;
  let colAmPhone = -1, colPmPhone = -1;

  // Header keyword matching for shifts:
  reCandidateCols.forEach((c) => {
    const h = headers[c];
    if (/\b(?:MANHA|1\s*TURNO|06H?)\b/i.test(h) && colAmRe === -1) colAmRe = c;
    if (/\b(?:TARDE|2\s*TURNO|12H?|13H?|14H?)\b/i.test(h) && colPmRe === -1) colPmRe = c;
  });

  nameCandidateCols.forEach((c) => {
    const h = headers[c];
    if (/\b(?:MANHA|1\s*TURNO|06H?)\b/i.test(h) && colAmName === -1) colAmName = c;
    if (/\b(?:TARDE|2\s*TURNO|12H?|13H?|14H?)\b/i.test(h) && colPmName === -1) colPmName = c;
  });

  rankCandidateCols.forEach((c) => {
    const h = headers[c];
    if (/\b(?:MANHA|1\s*TURNO|06H?)\b/i.test(h) && colAmRank === -1) colAmRank = c;
    if (/\b(?:TARDE|2\s*TURNO|12H?|13H?|14H?)\b/i.test(h) && colPmRank === -1) colPmRank = c;
  });

  phoneCandidateCols.forEach((c) => {
    const h = headers[c];
    if (/\b(?:MANHA|1\s*TURNO|06H?)\b/i.test(h) && colAmPhone === -1) colAmPhone = c;
    if (/\b(?:TARDE|2\s*TURNO|12H?|13H?|14H?)\b/i.test(h) && colPmPhone === -1) colPmPhone = c;
  });

  // Positional fallback: pairwise left-to-right order
  if (colAmRe === -1 && reCandidateCols.length > 0) colAmRe = reCandidateCols[0];
  if (colPmRe === -1 && reCandidateCols.length > 1) colPmRe = reCandidateCols[1];

  if (colAmName === -1 && nameCandidateCols.length > 0) colAmName = nameCandidateCols[0];
  if (colPmName === -1 && nameCandidateCols.length > 1) colPmName = nameCandidateCols[1];

  if (colAmRank === -1 && rankCandidateCols.length > 0) colAmRank = rankCandidateCols[0];
  if (colPmRank === -1 && rankCandidateCols.length > 1) colPmRank = rankCandidateCols[1];

  if (colAmPhone === -1 && phoneCandidateCols.length > 0) colAmPhone = phoneCandidateCols[0];
  if (colPmPhone === -1 && phoneCandidateCols.length > 1) colPmPhone = phoneCandidateCols[1];

  // 6.1 Identify Latitude and Longitude columns if present in sheet
  let colLat = -1;
  let colLng = -1;
  let colSchoolVehicle = -1;
  for (let c = 0; c < numCols; c++) {
    const h = headers[c] || '';
    if (/\b(?:LATITUDE|LAT)\b/i.test(h) && colLat === -1) colLat = c;
    if (/\b(?:LONGITUDE|LONG|LNG)\b/i.test(h) && colLng === -1) colLng = c;
    if (/\b(?:VIATURA|PREFIXO|VTR|CARRO|VEICULO)\b/i.test(h) && colSchoolVehicle === -1) colSchoolVehicle = c;
  }

  // Context city derivation
  let fallbackCity = 'VOTORANTIM';
  if (tabContext) {
    const tabUpper = tabContext.toUpperCase();
    if (tabUpper.includes('IBIUNA') || tabUpper.includes('IBIÚNA')) fallbackCity = 'IBIÚNA';
    else if (tabUpper.includes('PIEDADE')) fallbackCity = 'PIEDADE';
    else if (tabUpper.includes('ARACOIABA') || tabUpper.includes('ARAÇOIABA')) fallbackCity = 'ARAÇOIABA DA SERRA';
    else if (tabUpper.includes('SALTO')) fallbackCity = 'SALTO DE PIRAPORA';
    else if (tabUpper.includes('PILAR')) fallbackCity = 'PILAR DO SUL';
    else if (tabUpper.includes('TAPIRAI') || tabUpper.includes('TAPIRAÍ')) fallbackCity = 'TAPIRAÍ';
    else if (tabUpper.includes('VOTORANTIM')) fallbackCity = 'VOTORANTIM';
  }

  const schoolsMap = new Map<string, SchoolItem>();
  let currentSchool = '';
  let currentCity = fallbackCity;
  let currentBairro = '';
  let currentZone = '131';
  let currentOpm = tabContext || '40º BPM/I';

  const startRow = bestHeaderRow + 1;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Check if this row is a section divider indicating a municipality change (e.g., "MUNICÍPIO DE IBIÚNA", "2ª CIA - PIEDADE")
    const rowFullText = row.join(' ');
    const detectedCityInRow = detectCityFromText(rowFullText);
    const hasAnyOfficerRe = row.some((cell) => {
      const clean = cleanDisplayRe(cell);
      const digitsOnly = clean.replace(/[^0-9]/g, '');
      return digitsOnly.length >= 5 && digitsOnly.length <= 8 && cell.length <= 14;
    });

    const rawSchoolInCol = (colSchool >= 0 && row[colSchool] ? row[colSchool] : '').trim();
    const isExplicitSectionDivider =
      /^(?:MUNIC[IÍ]PIO\s+DE|COMARCA\s+DE|CIDADE\s*:|[1234]ª?\s*CIA\b|BATALH[AÃ]O\b)/i.test(rawSchoolInCol) ||
      (!rawSchoolInCol && Boolean(detectedCityInRow));

    if (detectedCityInRow && !hasAnyOfficerRe && isExplicitSectionDivider) {
      currentCity = detectedCityInRow;
      continue;
    }

    let rawSchool = rawSchoolInCol;
    const city = (colCity >= 0 && row[colCity] ? row[colCity] : '').trim().toUpperCase();
    const bairro = (colBairro >= 0 && row[colBairro] ? row[colBairro] : '').trim();
    const zone = (colZone >= 0 && row[colZone] ? row[colZone] : '').trim();
    const opm = (colOpm >= 0 && row[colOpm] ? row[colOpm] : '').trim();

    const isGenericHeader =
      /^(?:TOTAL|SUBTOTAL|TOTAL GERAL|ESCOLA|POSTO|LOCAL|LOCAL DE VOTACAO|LOCAL DE VOTAÇÃO)$/i.test(rawSchool.trim()) ||
      rawSchool.toUpperCase().startsWith('OPERAÇÃO ELEIÇÕES') ||
      rawSchool.toUpperCase().startsWith('OPERACAO ELEICOES');

    // Check if row has a new school name or inherits from the row above (merged cells in spreadsheets)
    if (rawSchool && rawSchool.length >= 2 && !isGenericHeader) {
      currentSchool = rawSchool;
      if (city) currentCity = city;
      if (bairro) currentBairro = bairro;
      if (zone) currentZone = zone;
      if (opm) currentOpm = opm;
    } else {
      rawSchool = currentSchool;
    }

    if (!rawSchool || rawSchool.length < 2 || isGenericHeader) {
      continue;
    }

    // Ignore rows belonging specifically to GCM (Guarda Civil Municipal)
    const normOpm = normalizeText(opm || '');
    const normSchool = normalizeText(rawSchool || '');
    if (
      normOpm === 'GCM' ||
      normOpm.includes('GUARDA CIVIL') ||
      normOpm.includes('GUARDA MUNICIPAL') ||
      normSchool.startsWith('GCM ') ||
      normSchool.startsWith('GUARDA CIVIL ') ||
      normSchool.startsWith('POSTO GCM')
    ) {
      continue;
    }

    // Resolve true canonical municipality for this school
    const resolvedCity = resolveMunicipality(city || currentCity, rawSchool, '', bairro, zone, opm);
    if (resolvedCity && (resolvedCity !== 'VOTORANTIM' || currentCity === 'VOTORANTIM')) {
      currentCity = resolvedCity;
    }
    const finalSchoolCity = resolvedCity || currentCity;

    // Check if the spreadsheet uses single-officer-per-row with a "TURNO" column
    const isSingleTurnoRow = colTurnoSingle >= 0 && reCandidateCols.length <= 1;
    const turnoVal = isSingleTurnoRow && row[colTurnoSingle] ? row[colTurnoSingle].toUpperCase() : '';
    const isTardeRow = turnoVal.includes('TARDE') || turnoVal.includes('13H') || turnoVal.includes('12H') || turnoVal.includes('2');

    // Extract AM Officer data
    const rawAmRe = colAmRe >= 0 && row[colAmRe] ? row[colAmRe] : '';
    const officerAmRe = cleanDisplayRe(rawAmRe);
    const officerAmName = (colAmName >= 0 && row[colAmName] ? row[colAmName] : '').trim();
    const officerAmRank = (colAmRank >= 0 && row[colAmRank] ? row[colAmRank] : 'Policial Militar').trim();
    const officerAmPhone = (colAmPhone >= 0 && row[colAmPhone] ? row[colAmPhone] : '').trim();

    // Extract PM Officer data
    const rawPmRe = colPmRe >= 0 && row[colPmRe] ? row[colPmRe] : '';
    const officerPmRe = cleanDisplayRe(rawPmRe);
    const officerPmName = (colPmName >= 0 && row[colPmName] ? row[colPmName] : '').trim();
    const officerPmRank = (colPmRank >= 0 && row[colPmRank] ? row[colPmRank] : 'Policial Militar').trim();
    const officerPmPhone = (colPmPhone >= 0 && row[colPmPhone] ? row[colPmPhone] : '').trim();

    let rawRowVehicle = colSchoolVehicle >= 0 && row[colSchoolVehicle] ? row[colSchoolVehicle].trim() : '';
    if (/^(?:-|--|N\/A|NA|NÃO|NAO|SEM|N\/D|\.)$/i.test(rawRowVehicle)) {
      rawRowVehicle = '';
    }
    const schoolRowVehicle = rawRowVehicle || undefined;

    // Key to group rows for the same school in the same city
    const schoolKey = `${normalizeText(rawSchool)}_${normalizeText(finalSchoolCity)}`;

    // Parse coordinates from row or fall back to official coordinates map
    let rowLat: number | undefined = undefined;
    let rowLng: number | undefined = undefined;
    if (colLat >= 0 || colLng >= 0) {
      const coords = extractCoordinatesFromCell(
        colLat >= 0 ? row[colLat] : undefined,
        colLng >= 0 ? row[colLng] : undefined
      );
      if (coords) {
        rowLat = coords.lat;
        rowLng = coords.lng;
      }
    }

    const geoMatch = (!rowLat || !rowLng) ? findSchoolCoordinates(rawSchool, finalSchoolCity) : null;
    const resolvedLat = rowLat ?? geoMatch?.lat;
    const resolvedLng = rowLng ?? geoMatch?.lng;
    const resolvedAddress = geoMatch?.address || (currentBairro ? `${rawSchool}, ${currentBairro} - ${finalSchoolCity}` : undefined);

    if (schoolsMap.has(schoolKey)) {
      const existing = schoolsMap.get(schoolKey)!;
      if (!existing.lat && resolvedLat) existing.lat = resolvedLat;
      if (!existing.lng && resolvedLng) existing.lng = resolvedLng;
      if (!existing.address && resolvedAddress) existing.address = resolvedAddress;

      if (!existing.amOfficers) existing.amOfficers = (existing.am && existing.am.re) ? [existing.am] : [];
      if (!existing.pmOfficers) existing.pmOfficers = (existing.pm && existing.pm.re) ? [existing.pm] : [];

      if (isTardeRow) {
        if (officerAmRe || officerAmName) {
          const already = existing.pmOfficers.some(
            (o) => matchesExactRe(o.re, officerAmRe) || (officerAmName && normalizeText(o.name) === normalizeText(officerAmName))
          );
          if (!already) {
            existing.pmOfficers.push({
              re: officerAmRe,
              name: officerAmName,
              rank: officerAmRank || 'Policial Militar',
              phone: officerAmPhone,
              vehicle: schoolRowVehicle
            });
          }
        }
      } else {
        if (officerAmRe || officerAmName) {
          const alreadyAm = existing.amOfficers.some(
            (o) => matchesExactRe(o.re, officerAmRe) || (officerAmName && normalizeText(o.name) === normalizeText(officerAmName))
          );
          if (!alreadyAm) {
            existing.amOfficers.push({
              re: officerAmRe,
              name: officerAmName,
              rank: officerAmRank || 'Policial Militar',
              phone: officerAmPhone,
              vehicle: schoolRowVehicle
            });
          }
        }

        if (officerPmRe || officerPmName) {
          const alreadyPm = existing.pmOfficers.some(
            (o) => matchesExactRe(o.re, officerPmRe) || (officerPmName && normalizeText(o.name) === normalizeText(officerPmName))
          );
          if (!alreadyPm) {
            existing.pmOfficers.push({
              re: officerPmRe,
              name: officerPmName,
              rank: officerPmRank || 'Policial Militar',
              phone: officerPmPhone,
              vehicle: schoolRowVehicle
            });
          }
        }
      }

      if (existing.amOfficers.length > 0) existing.am = existing.amOfficers[0];
      if (existing.pmOfficers.length > 0) existing.pm = existing.pmOfficers[0];
    } else {
      const amList: SchoolOfficer[] = [];
      if (!isTardeRow && (officerAmRe || officerAmName)) {
        amList.push({
          re: officerAmRe,
          name: officerAmName,
          rank: officerAmRank || 'Policial Militar',
          phone: officerAmPhone,
          vehicle: schoolRowVehicle
        });
      }

      const pmList: SchoolOfficer[] = [];
      const pmReToUse = isTardeRow ? officerAmRe : officerPmRe;
      const pmNameToUse = isTardeRow ? officerAmName : officerPmName;
      const pmRankToUse = isTardeRow ? officerAmRank : officerPmRank;
      const pmPhoneToUse = isTardeRow ? officerAmPhone : officerPmPhone;
      if (pmReToUse || pmNameToUse) {
        pmList.push({
          re: pmReToUse,
          name: pmNameToUse,
          rank: pmRankToUse || 'Policial Militar',
          phone: pmPhoneToUse,
          vehicle: schoolRowVehicle
        });
      }

      schoolsMap.set(schoolKey, {
        id: `school-${schoolKey.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
        school: rawSchool,
        city: finalSchoolCity,
        bairro: currentBairro,
        zone: currentZone,
        opm: currentOpm,
        lat: resolvedLat,
        lng: resolvedLng,
        address: resolvedAddress,
        am: amList[0] || {
          re: '',
          name: '',
          rank: 'Policial Militar',
          phone: ''
        },
        pm: pmList[0] || {
          re: '',
          name: '',
          rank: 'Policial Militar',
          phone: ''
        },
        amOfficers: amList,
        pmOfficers: pmList
      });
    }
  }

  return Array.from(schoolsMap.values());
}

/**
 * Loads ALL schools across all relevant tabs in the spreadsheet
 */
export async function loadAllSchoolsFromSpreadsheet(
  spreadsheetIdInput: string,
  token: string | undefined | null,
  checkinsTabName: string
): Promise<SchoolItem[]> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  const allTabs = await getSpreadsheetTabs(spreadsheetId, token);

  // Filter out check-ins tab, meta tabs, and pure GCM (Guarda Civil Municipal) tabs
  const validDataTabs = allTabs.filter((t) => {
    if (!t) return false;
    const norm = normalizeText(t);
    return (
      t !== checkinsTabName &&
      !norm.includes('CHECKIN') &&
      !norm.includes('INSTRUCAO') &&
      !norm.includes('CONFIG') &&
      !norm.startsWith('GCM') &&
      norm !== 'GUARDA MUNICIPAL' &&
      norm !== 'GUARDA CIVIL'
    );
  });

  const allSchoolsMap = new Map<string, SchoolItem>();
  const tabsToProcess = validDataTabs.length > 0 ? validDataTabs : [''];

  for (const tab of tabsToProcess) {
    try {
      const range = tab ? `'${tab}'!A:ZZ` : 'A:ZZ';
      const rows = await readSpreadsheetValues(spreadsheetId, range, token);
      if (rows && rows.length > 0) {
        const schoolsInTab = parseFixedStaffSheet(rows, tab || undefined);
        schoolsInTab.forEach((s) => {
          const key = `${normalizeText(s.school)}_${normalizeText(s.city)}`;
          if (!allSchoolsMap.has(key)) {
            allSchoolsMap.set(key, s);
          } else {
            // Merge officers across sheets/tabs if multi-officer
            const existing = allSchoolsMap.get(key)!;
            if (!existing.amOfficers) existing.amOfficers = (existing.am && existing.am.re) ? [existing.am] : [];
            if (!existing.pmOfficers) existing.pmOfficers = (existing.pm && existing.pm.re) ? [existing.pm] : [];

            (s.amOfficers || (s.am?.re ? [s.am] : [])).forEach((off) => {
              if (off.re && !existing.amOfficers!.some((o) => matchesExactRe(o.re, off.re))) {
                existing.amOfficers!.push(off);
              }
            });
            (s.pmOfficers || (s.pm?.re ? [s.pm] : [])).forEach((off) => {
              if (off.re && !existing.pmOfficers!.some((o) => matchesExactRe(o.re, off.re))) {
                existing.pmOfficers!.push(off);
              }
            });

            if (existing.amOfficers.length > 0) existing.am = existing.amOfficers[0];
            if (existing.pmOfficers.length > 0) existing.pm = existing.pmOfficers[0];
          }
        });
      }
    } catch (err) {
      console.warn(`Erro ao ler postos eleitorais da aba "${tab}":`, err);
    }
  }

  const result = Array.from(allSchoolsMap.values());
  if (result.length === 0) {
    throw new Error(
      'Nenhuma linha de posto eleitoral encontrada na planilha. Verifique se a planilha está compartilhada com o link ou conecte sua conta Google.'
    );
  }

  return result;
}

/**
 * Robust parser to extract StaffMembers (motorized, supervisors, commanders)
 * from the motorized staff spreadsheet matrix.
 */
/**
 * Robust parser to extract StaffMembers (motorized, supervisors, commanders, drivers)
 * from the motorized staff spreadsheet matrix.
 */
export function parseMotorizedStaffSheet(rows: string[][], tabContext?: string): StaffMember[] {
  if (!rows || rows.length < 2) return [];

  // Find header row in top 10 rows
  let bestHeaderRow = 0;
  let bestScore = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const rowNorm = (rows[r] || []).map((c) => normalizeText(c || ''));
    let score = 0;
    rowNorm.forEach((cell) => {
      if (/\b(?:RE|R\.?E\.?)\b/i.test(cell)) score += 3;
      if (/\b(?:NOME|POLICIAL|MILITAR)\b/i.test(cell)) score += 2;
      if (/\b(?:VIATURA|PREFIXO|VTR|CARRO|VEICULO)\b/i.test(cell)) score += 3;
      if (/\b(?:FUNCAO|CARGO|MISSAO|ATRIBUICAO)\b/i.test(cell)) score += 2;
      if (/\b(?:LOCAL|SETOR|CIA|OPM|SUBUNIDADE)\b/i.test(cell)) score += 2;
    });
    if (score > bestScore) {
      bestScore = score;
      bestHeaderRow = r;
    }
  }

  // Support merged/multi-line headers by checking columns across header rows 0..Math.min(rows.length - 1, 8)
  const headerRegionRows = rows.slice(0, Math.min(rows.length, Math.max(bestHeaderRow + 2, 8)));
  const maxCols = Math.max(...headerRegionRows.map((r) => r.length), 0);
  const combinedHeaders: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    const colTexts: string[] = [];
    headerRegionRows.forEach((r) => {
      if (r[c]) colTexts.push(normalizeText(r[c]));
    });
    combinedHeaders.push(colTexts.join(' '));
  }

  const findInCombined = (...keywords: string[]): number => {
    return combinedHeaders.findIndex((h) => keywords.some((kw) => h.includes(kw)));
  };

  const headerRow = rows[bestHeaderRow] || [];
  const headers = headerRow.map((c) => normalizeText(c || ''));

  const findAny = (...keywords: string[]): number => {
    const inSingle = headers.findIndex((h) => keywords.some((kw) => h.includes(kw)));
    if (inSingle >= 0) return inSingle;
    return findInCombined(...keywords);
  };

  const colRe = findAny('RE', 'R.E');
  // Coluna D (index 3) is commonly NOME in Empenho de Efetivo
  const detectedColName = findAny('NOME', 'POLICIAL', 'MILITAR');
  const colName = detectedColName >= 0 ? detectedColName : (maxCols > 3 ? 3 : -1);

  const colRank = findAny('POSTO', 'GRAD', 'P/G');
  // Coluna H (index 7) is commonly FUNÇÃO in Empenho de Efetivo
  const detectedColFunction = findAny('FUNCAO', 'CARGO', 'MISSAO', 'ATRIBUICAO');
  const colFunction = detectedColFunction >= 0 ? detectedColFunction : (maxCols > 7 ? 7 : -1);

  const colLocal = findAny('LOCAL', 'SETOR', 'CIA', 'OPM', 'SUBUNIDADE');
  
  // Specific detection for Celular / Coluna G vs Telefone Funcional
  // In PLANILHA DE EMPENHO DE EFETIVO, Coluna G is "CELULAR (PARTICULAR)" and Coluna F is "TELEFONE (FUNCIONAL)"
  const colCelular = findAny('CELULAR', 'PARTICULAR', 'CEL');
  const colTelefone = findAny('TELEFONE', 'FUNCIONAL', 'TEL', 'FONE', 'CONTATO');
  // Column G is index 6 if 0-indexed A=0, or colRe + 3 (if RE is Col D)
  const colG = colRe >= 0 ? colRe + 3 : 6;

  // Search for vehicle/prefixo column across headers - Coluna J (index 9) in Empenho de Efetivo
  let colVehicle = findAny('VIATURA', 'PREFIXO', 'VTR', 'CARRO', 'VEICULO', 'PREFIX');

  // Fallback: Check if Coluna J (index 9) or any column has PMESP vehicle patterns
  const startRow = bestHeaderRow + 1;
  if (colVehicle < 0) {
    if (maxCols > 9) {
      colVehicle = 9; // Coluna J
    } else {
      for (let c = 0; c < maxCols; c++) {
        if (c === colRe || c === colName || c === colRank) continue;
        let vtrPatternCount = 0;
        for (let r = startRow; r < Math.min(rows.length, startRow + 20); r++) {
          const val = normalizeText(rows[r]?.[c] || '');
          if (/^(?:VTR\s*)?[I|M]?[-\s]?40\d{3}\b/i.test(val) || /^I-\d{5}/i.test(val) || /^(?:VTR|VIATURA)\b/i.test(val)) {
            vtrPatternCount++;
          }
        }
        if (vtrPatternCount >= 2) {
          colVehicle = c;
          break;
        }
      }
    }
  }

  let colDriver = findAny('MOTORISTA', 'CONDUTOR');
  if (
    colDriver === colFunction ||
    colDriver === colName ||
    colDriver === colRe ||
    colDriver === colRank ||
    colDriver === colVehicle ||
    colDriver === colLocal
  ) {
    colDriver = -1;
  }
  // Coluna I (index 8) is commonly HORÁRIO / TURNO in Empenho de Efetivo
  const detectedColShift = findAny('TURNO', 'HORARIO', 'PERIODO');
  const colShift = detectedColShift >= 0 ? detectedColShift : (maxCols > 8 ? 8 : -1);
  const colUnit = findAny('UNIDADE', 'BATALHAO', 'OPM');

  const staffMap = new Map<string, StaffMember>();

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawRe = colRe >= 0 && row[colRe] ? row[colRe] : '';
    const re = cleanDisplayRe(rawRe);
    let name = (colName >= 0 && row[colName] ? row[colName] : (row[3] || '')).trim();

    let rank = (colRank >= 0 && row[colRank] ? row[colRank] : '').trim();
    // Prevent duplicate rank if name starts with military rank (e.g. "Cb PM THIAGO RIBAS GATO MARIANO")
    const rankMatch = name.match(/^(?:Cel|Ten Cel|Maj|Cap|1º Ten|2º Ten|Asp|Subten|1º Sgt|2º Sgt|3º Sgt|Cb|Sd|Ten|Sgt)\s+PM\b/i);
    if (rankMatch) {
      if (!rank || rank === 'Policial Militar') {
        rank = rankMatch[0].toUpperCase();
      }
      name = name.substring(rankMatch[0].length).trim();
    }
    if (!rank) {
      rank = 'Policial Militar';
    }

    const func = (colFunction >= 0 && row[colFunction] ? row[colFunction] : (row[7] || 'Ronda / Supervisão')).trim();
    const local = (colLocal >= 0 && row[colLocal] ? row[colLocal] : tabContext || '40º BPM/I').trim();

    // Ignore divider rows or rows where name is just a role title without real RE
    const normName = normalizeText(name);
    if (
      (!re || re.startsWith('N/D-')) &&
      (normName === 'COMANDANTE' ||
        normName === 'SUBCOMANDANTE' ||
        normName === 'COORDENADOR OPERACIONAL' ||
        normName === 'MOTORISTA' ||
        normName === 'MOTORISTA COMANDANTE' ||
        normName === 'MOTORISTA SUBCOMANDANTE' ||
        normName === 'MOTORISTA COORDOP' ||
        normName === 'POLICIAL MILITAR' ||
        normName === '')
    ) {
      continue;
    }

    // Extract phone with absolute priority to Coluna G / CELULAR (PARTICULAR)
    const isLikelyPhone = (val: string | undefined | null): boolean => {
      if (!val) return false;
      const digits = val.replace(/\D/g, '');
      return digits.length >= 8 && digits.length <= 13;
    };

    let phone = '';
    // Priority 1: Check Celular (Particular) column
    if (colCelular >= 0 && isLikelyPhone(row[colCelular])) {
      phone = row[colCelular].trim();
    }
    // Priority 2: Check Coluna G explicitly (index 6 or colG)
    else if (colG >= 0 && row.length > colG && isLikelyPhone(row[colG])) {
      phone = row[colG].trim();
    } else if (row.length > 6 && isLikelyPhone(row[6])) {
      phone = row[6].trim();
    }
    // Priority 3: Check Telefone / Funcional column
    else if (colTelefone >= 0 && isLikelyPhone(row[colTelefone])) {
      phone = row[colTelefone].trim();
    }
    // Priority 4: Non-empty string with at least 8 chars in Celular or Col G
    else if (colCelular >= 0 && row[colCelular]?.trim().length >= 8) {
      phone = row[colCelular].trim();
    } else if (colG >= 0 && row.length > colG && row[colG]?.trim().length >= 8) {
      phone = row[colG].trim();
    } else if (row.length > 6 && row[6]?.trim().length >= 8) {
      phone = row[6].trim();
    } else if (colTelefone >= 0 && row[colTelefone]?.trim().length >= 8) {
      phone = row[colTelefone].trim();
    }
    // Priority 5: Fallback - any cell matching phone format in the row
    else {
      for (let c = 0; c < row.length; c++) {
        if (c === colRe || c === colName || c === colRank) continue;
        if (isLikelyPhone(row[c])) {
          phone = row[c].trim();
          break;
        }
      }
    }
    let rawVehicle = colVehicle >= 0 && row[colVehicle] ? row[colVehicle].trim() : '';
    // Filter out common empty cell markers
    if (/^(?:-|--|N\/A|NA|NÃO|NAO|SEM|N\/D|\.)$/i.test(rawVehicle)) {
      rawVehicle = '';
    }
    const vehicle = rawVehicle;
    const rawDriver = colDriver >= 0 && row[colDriver] ? row[colDriver].trim() : '';
    const driver = rawDriver && rawDriver !== func && normalizeText(rawDriver) !== normalizeText(func) ? rawDriver : '';
    const shiftRaw = (colShift >= 0 && row[colShift] ? row[colShift] : '04/10/2026 - 06H ao Término').trim();
    const unit = (colUnit >= 0 && row[colUnit] ? row[colUnit] : '40º BPM/I').trim();

    if (re || name) {
      const key = normalizeRe(re) || normalizeText(name);
      staffMap.set(key, {
        re: re || `N/D-${i}`,
        name: name || 'Policial Militar',
        rank: rank || 'Policial Militar',
        function: func || 'Ronda / Fiscalização',
        local: local || 'Circunscrição 40º BPM/I',
        phone: phone || '',
        vehicle: vehicle || '',
        driver: driver,
        shiftRaw: shiftRaw,
        unit: unit
      });
    }
  }

  return Array.from(staffMap.values());
}

/**
 * Loads ALL motorized staff across tabs in the motorized spreadsheet
 */
export async function loadAllStaffFromSpreadsheet(
  spreadsheetIdInput: string,
  token?: string | null
): Promise<StaffMember[]> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  const rawTabs = await getSpreadsheetTabs(spreadsheetId, token);
  const allTabs = rawTabs.filter((t) => {
    const norm = normalizeText(t);
    return !norm.includes('GCM') && !norm.includes('GUARDA');
  });

  const allStaffMap = new Map<string, StaffMember>();

  for (const tab of allTabs) {
    try {
      const rows = await readSpreadsheetValues(spreadsheetId, `'${tab}'!A:ZZ`, token);
      if (rows && rows.length > 0) {
        const members = parseMotorizedStaffSheet(rows, tab);
        members.forEach((m) => {
          const key = normalizeRe(m.re) || normalizeText(m.name);
          if (!allStaffMap.has(key)) {
            allStaffMap.set(key, m);
          }
        });
      }
    } catch (err) {
      console.warn(`Aba "${tab}" de efetivo motorizado não pôde ser lida:`, err);
    }
  }

  return Array.from(allStaffMap.values());
}

/**
 * Robust extraction of latitude and longitude from single or dual cell values
 */
export function extractCoordinatesFromCell(val1: any, val2?: any): { lat: number; lng: number } | null {
  if (!val1 && !val2) return null;
  const s1 = String(val1 || '').trim();
  const s2 = String(val2 || '').trim();

  // 1. Google Maps URL pattern: q=-23.51,-47.25 or @-23.51,-47.25 or ?destination=-23.51,-47.25
  const mapsMatch = s1.match(/(?:q=|@|destination=|\?loc:)(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/);
  if (mapsMatch) {
    return resolveSanitizedLatLng(parseFloat(mapsMatch[1]), parseFloat(mapsMatch[2]));
  }

  // 2. Degrees, Minutes, Seconds (DMS) e.g. 23°31'03.8"S 47°15'29.4"W
  const dmsMatch = s1.match(
    /(\d{1,2})[°º\s]+(\d{1,2})['′\s]+(\d{1,2}(?:\.\d+)?)[″"'\s]*([SNsn])[\s,;\/]+(\d{1,3})[°º\s]+(\d{1,2})['′\s]+(\d{1,2}(?:\.\d+)?)[″"'\s]*([WOLwol])/
  );
  if (dmsMatch) {
    const latDeg = parseFloat(dmsMatch[1]) + parseFloat(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600;
    const lat = dmsMatch[4].toUpperCase() === 'S' ? -latDeg : latDeg;
    const lngDeg = parseFloat(dmsMatch[5]) + parseFloat(dmsMatch[6]) / 60 + parseFloat(dmsMatch[7]) / 3600;
    const lng = (dmsMatch[8].toUpperCase() === 'W' || dmsMatch[8].toUpperCase() === 'O') ? -lngDeg : lngDeg;
    return resolveSanitizedLatLng(lat, lng);
  }

  // 3. Combined in s1 (separated by comma, semicolon, slash, or space)
  if (s1 && (!s2 || val1 === val2)) {
    const pairMatch = s1.match(/([+-]?\d{1,2}(?:[\.,]\d+)?)\s*[\/;\,\s]\s*([+-]?\d{1,3}(?:[\.,]\d+)?)/);
    if (pairMatch) {
      const p1 = parseFloat(pairMatch[1].replace(',', '.'));
      const p2 = parseFloat(pairMatch[2].replace(',', '.'));
      if (!isNaN(p1) && !isNaN(p2)) {
        const res = resolveSanitizedLatLng(p1, p2);
        if (res) return res;
      }
    }
  }

  // 4. Separate columns s1 and s2
  if (s1 && s2 && s1 !== s2) {
    const n1 = parseFloat(s1.replace(',', '.').replace(/[^\d.-]/g, ''));
    const n2 = parseFloat(s2.replace(',', '.').replace(/[^\d.-]/g, ''));
    if (!isNaN(n1) && !isNaN(n2)) {
      return resolveSanitizedLatLng(n1, n2);
    }
  }

  return null;
}

function resolveSanitizedLatLng(a: number, b: number): { lat: number; lng: number } | null {
  if (isNaN(a) || isNaN(b)) return null;
  let lat = a;
  let lng = b;

  // In the State of São Paulo:
  // Longitude is ~ -45 to -53 (magnitude >= 40)
  // Latitude is ~ -21 to -26 (magnitude <= 35)
  if (Math.abs(a) >= 40 && Math.abs(b) <= 35) {
    lat = b;
    lng = a;
  } else if (Math.abs(b) >= 40 && Math.abs(a) <= 35) {
    lat = a;
    lng = b;
  }

  // Ensure Southern hemisphere (lat < 0) and Western hemisphere (lng < 0)
  if (lat > 0 && lat <= 90) lat = -lat;
  if (lng > 0 && lng <= 180) lng = -lng;

  // Reject identical or invalid coordinates
  if (Math.abs(lat - lng) < 0.001) return null;
  if (lat > -15 || lat < -35) return null;
  if (lng > -40 || lng < -60) return null;

  return { lat, lng };
}

/**
 * Parses rows from an election coordinates spreadsheet into SchoolGeoEntry[]
 */
export function parseCoordinatesSheet(rows: string[][], tabContext?: string): SchoolGeoEntry[] {
  if (!rows || rows.length < 2) return [];

  // Determine fallback city from tab context if available
  let fallbackCity = 'VOTORANTIM';
  if (tabContext) {
    const tabUpper = tabContext.toUpperCase();
    if (tabUpper.includes('IBIUNA') || tabUpper.includes('IBIÚNA')) fallbackCity = 'IBIÚNA';
    else if (tabUpper.includes('PIEDADE')) fallbackCity = 'PIEDADE';
    else if (tabUpper.includes('ARACOIABA') || tabUpper.includes('ARAÇOIABA')) fallbackCity = 'ARAÇOIABA DA SERRA';
    else if (tabUpper.includes('SALTO')) fallbackCity = 'SALTO DE PIRAPORA';
    else if (tabUpper.includes('PILAR')) fallbackCity = 'PILAR DO SUL';
    else if (tabUpper.includes('TAPIRAI') || tabUpper.includes('TAPIRAÍ')) fallbackCity = 'TAPIRAÍ';
    else if (tabUpper.includes('VOTORANTIM')) fallbackCity = 'VOTORANTIM';
    else if (tabUpper.includes('IPERO') || tabUpper.includes('IPERÓ')) fallbackCity = 'IPERÓ';
    else if (tabUpper.includes('ALUMINIO') || tabUpper.includes('ALUMÍNIO')) fallbackCity = 'ALUMÍNIO';
  }

  // 1. Find Header Row
  let headerRowIdx = -1;
  let colSchool = -1;
  let colCity = -1;
  let colCombined = -1;
  let colLat = -1;
  let colLng = -1;
  let colAddress = -1;
  let colBairro = -1;
  let colCep = -1;

  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let combinedC = -1;
    let latC = -1;
    let lngC = -1;
    let schoolC = -1;
    let cityC = -1;
    let addressC = -1;
    let bairroC = -1;
    let cepC = -1;

    for (let c = 0; c < row.length; c++) {
      const h = (row[c] || '').toString().trim().toUpperCase();
      if (!h) continue;

      // Check for combined coordinates column first
      if (
        /\b(?:COORDENADAS?|GPS|LAT\s*[\/\,\-]\s*LONG|LATITUDE\s*[\/\,\-]\s*LONGITUDE|LOCALIZA[CÇ][AÃ]O\s*GPS|GEO|MAPS)\b/i.test(h) &&
        combinedC === -1
      ) {
        combinedC = c;
      }

      // Explicit single Latitude column
      if (
        /\b(?:LATITUDE|COORD_LAT|COORDENADA_LAT|COORD\s*Y|^LAT$|LAT\.)\b/i.test(h) &&
        !/\b(?:LONG|LNG|LON)\b/i.test(h) &&
        latC === -1
      ) {
        latC = c;
      }

      // Explicit single Longitude column
      if (
        /\b(?:LONGITUDE|LONG|LNG|COORD_LONG|COORDENADA_LONG|COORD\s*X|^LON$|LON\.|LONG\.)\b/i.test(h) &&
        !/\b(?:LAT)\b/i.test(h) &&
        lngC === -1
      ) {
        lngC = c;
      }

      // School Name
      if (
        /\b(?:INSTITUI[CÇ][AÃ]O|ESCOLA|POSTO|COL[EÉ]GIO|LOCAL|NOME|ESTABELECIMENTO|LOCAL\s*DE\s*VOTA[CÇ][AÃ]O|POSTO\s*DE\s*VOTA[CÇ][AÃ]O|DENOMINA[CÇ][AÃ]O|PR[EÉ]DIO)\b/i.test(h) &&
        !/\b(?:POLICIAL|OFICIAL|RESPONSAVEL|EFETIVO)\b/i.test(h) &&
        schoolC === -1
      ) {
        schoolC = c;
      }

      // City / Municipality
      if (/\b(?:CIDADE|MUNIC[IÍ]PIO|COMARCA|MUNIC[IÍ]PIO\s*\/\s*COMARCA|LOCALIDADE|MUN\b|CID\b)\b/i.test(h) && cityC === -1) {
        cityC = c;
      }

      // Address
      if (/\b(?:LOGRADOURO|ENDERE[CÇ]O|RUA|AV|AVENIDA)\b/i.test(h) && addressC === -1) {
        addressC = c;
      }

      // Bairro
      if (/\b(?:BAIRRO|DISTRITO|SETOR)\b/i.test(h) && bairroC === -1) {
        bairroC = c;
      }

      // CEP
      if (/\b(?:CEP|C\.E\.P)\b/i.test(h) && cepC === -1) {
        cepC = c;
      }
    }

    const hasCoordsHeader = (latC !== -1 && lngC !== -1 && latC !== lngC) || combinedC !== -1;
    if (hasCoordsHeader) {
      headerRowIdx = r;
      colCombined = combinedC;
      colLat = latC;
      colLng = lngC;
      colSchool = schoolC !== -1 ? schoolC : 0;
      colCity = cityC;
      colAddress = addressC;
      colBairro = bairroC;
      colCep = cepC;
      break;
    }
  }

  // Fallback: heuristic scan of columns if no explicit header
  if (headerRowIdx === -1) {
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = rows[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const pair = extractCoordinatesFromCell(row[c]);
        if (pair) {
          headerRowIdx = r > 0 ? r - 1 : 0;
          colCombined = c;
          colSchool = 0;
          break;
        }
      }
      if (colCombined !== -1) break;
    }
  }

  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
  const entries: SchoolGeoEntry[] = [];
  const seenMap = new Map<string, SchoolGeoEntry>();
  let currentCity = fallbackCity;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Detect section divider or municipality change in row
    const rowFull = row.join(' ');
    const detectedCity = detectCityFromText(rowFull);
    if (detectedCity && row.length <= 4) {
      currentCity = detectedCity;
    }

    const rawSchool = (colSchool >= 0 && row[colSchool] ? row[colSchool] : '').trim();
    if (!rawSchool || rawSchool.length < 2) continue;

    // Ignore totals or header repetitions
    if (/^(?:TOTAL|SUBTOTAL|ESCOLA|POSTO|LOCAL|LATITUDE|NOME|DENOMINAÇÃO)$/i.test(rawSchool)) continue;

    const rowCity = (colCity >= 0 && row[colCity] ? row[colCity] : '').trim().toUpperCase();
    const finalCity = rowCity ? resolveMunicipality(rowCity, rawSchool) : currentCity;

    // Extract coordinates
    let coords: { lat: number; lng: number } | null = null;

    if (colCombined >= 0 && row[colCombined]) {
      coords = extractCoordinatesFromCell(row[colCombined]);
    }

    if (!coords && colLat >= 0 && colLng >= 0 && colLat !== colLng) {
      coords = extractCoordinatesFromCell(row[colLat], row[colLng]);
    }

    if (!coords && colLat >= 0 && row[colLat]) {
      coords = extractCoordinatesFromCell(row[colLat]);
    }

    // Heuristic scan across entire row if still not found
    if (!coords) {
      for (let c = 0; c < row.length; c++) {
        if (c === colSchool || c === colCity) continue;
        const testPair = extractCoordinatesFromCell(row[c]);
        if (testPair) {
          coords = testPair;
          break;
        }
      }
    }

    if (!coords || !coords.lat || !coords.lng) continue;

    const address = (colAddress >= 0 && row[colAddress] ? row[colAddress] : '').trim();
    const bairro = (colBairro >= 0 && row[colBairro] ? row[colBairro] : '').trim();
    const cep = (colCep >= 0 && row[colCep] ? row[colCep] : '').trim();

    const entry: SchoolGeoEntry = {
      instituicao: rawSchool,
      logradouro: address || rawSchool,
      bairro: bairro || '',
      cep: cep || '',
      cidade: finalCity,
      latitude: coords.lat,
      longitude: coords.lng
    };

    const key = `${normalizeText(rawSchool)}_${normalizeText(finalCity)}`;
    if (!seenMap.has(key)) {
      seenMap.set(key, entry);
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Loads ALL coordinates across tabs in the coordinate spreadsheet and registers them dynamically
 */
export async function loadCoordinatesFromSpreadsheet(
  spreadsheetIdInput: string,
  token?: string | null
): Promise<SchoolGeoEntry[]> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  if (!spreadsheetId) return [];

  const rawTabs = await getSpreadsheetTabs(spreadsheetId, token);
  const allTabs = rawTabs.filter((t) => {
    const norm = normalizeText(t);
    return (
      !norm.includes('GCM') &&
      !norm.includes('GUARDA') &&
      !norm.includes('INSTRUCAO') &&
      !norm.includes('CONFIG') &&
      !norm.includes('CHECKIN')
    );
  });
  const tabsToRead = allTabs.length > 0 ? allTabs : [''];

  const allEntriesMap = new Map<string, SchoolGeoEntry>();

  for (const tab of tabsToRead) {
    try {
      const range = tab ? `'${tab}'!A:ZZ` : 'A:ZZ';
      const rows = await readSpreadsheetValues(spreadsheetId, range, token);
      if (rows && rows.length > 0) {
        const entries = parseCoordinatesSheet(rows, tab || undefined);
        entries.forEach((e) => {
          const key = `${normalizeText(e.instituicao)}_${normalizeText(e.cidade)}`;
          if (!allEntriesMap.has(key)) {
            allEntriesMap.set(key, e);
          }
        });
      }
    } catch (err) {
      console.warn(`Aba "${tab || 'padrão'}" da planilha de coordenadas não pôde ser lida:`, err);
    }
  }

  // If reading by tabs produced 0 entries, try reading default active range 'A:ZZ'
  if (allEntriesMap.size === 0) {
    try {
      const rows = await readSpreadsheetValues(spreadsheetId, 'A:ZZ', token);
      if (rows && rows.length > 0) {
        const entries = parseCoordinatesSheet(rows);
        entries.forEach((e) => {
          const key = `${normalizeText(e.instituicao)}_${normalizeText(e.cidade)}`;
          if (!allEntriesMap.has(key)) {
            allEntriesMap.set(key, e);
          }
        });
      }
    } catch (fallbackErr) {
      console.warn('Fallback da leitura de coordenadas falhou:', fallbackErr);
    }
  }

  const finalEntries = Array.from(allEntriesMap.values());
  if (finalEntries.length > 0) {
    registerDynamicCoordinates(finalEntries);
  }
  return finalEntries;
}
