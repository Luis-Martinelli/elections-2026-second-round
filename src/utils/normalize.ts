/**
 * Normalizes RE string to allow matching with or without dash, dots, check digit,
 * or common prefixes like "RE", "RE:", "R.E.".
 * e.g., "RE 154801-8" -> "1548018", base "154801"
 * e.g., "111933-2" -> "1119332", base "111933"
 * e.g., "Cb PM Jose Peixoto (RE 111933-2)" -> "1119332"
 */
// Memoization: these pure functions run tens of thousands of times per render when
// matching schools against check-ins (each call is NFD + several regexes).
const CACHE_LIMIT = 20000;
const reCache = new Map<string, string>();
const textCache = new Map<string, string>();

function cached(cache: Map<string, string>, key: string, compute: (k: string) => string): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = compute(key);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, value);
  return value;
}

export function normalizeRe(raw: string | undefined | null): string {
  if (!raw) return '';
  return cached(reCache, String(raw), computeNormalizeRe);
}

function computeNormalizeRe(raw: string): string {
  let str = raw.toUpperCase().trim();

  // If cell contains embedded "(RE 123456-7)" or "RE: 123456-7"
  const insideMatch = str.match(/\b(?:RE[:\s\-]*)?(\d{5,8}[-]?[0-9A-Za-z]?)\b/);
  if (insideMatch && insideMatch[1]) {
    return insideMatch[1].replace(/[^A-Z0-9]/g, '');
  }

  // Strip leading prefixes like "RE", "RE:", "R.E.:", "REGISTRO"
  str = str.replace(/^(?:R\.?E\.?[:\s\-\.]*|REG(?:ISTRO)?[:\s\-\.]*)/i, '').trim();
  return str.replace(/[^A-Z0-9]/g, '').trim();
}

/**
 * Returns a clean display format for RE (e.g. "111933-2" or "136575-8")
 */
export function cleanDisplayRe(raw: string | undefined | null): string {
  if (!raw) return '';
  let str = String(raw).trim();
  // Strip leading "RE", "RE:", etc.
  str = str.replace(/^(?:R\.?E\.?[:\s\-\.]*|REG(?:ISTRO)?[:\s\-\.]*)/i, '').trim();
  return str;
}

export function getReBase(raw: string | undefined | null): string {
  const norm = normalizeRe(raw);
  // In PMESP RE format is usually 6 digits + 1 check digit/char (e.g. 130043-1 or 129547-A).
  // If norm is 7 chars (6 digits + 1 digit), base is the first 6 digits.
  if (norm.length >= 6) {
    return norm.substring(0, 6);
  }
  return norm;
}

export function normalizeText(raw: string | undefined | null): string {
  if (!raw) return '';
  return cached(textCache, String(raw), computeNormalizeText);
}

function computeNormalizeText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toUpperCase()
    .replace(/[ºª°]/g, ' ') // normalize ordinals (1º -> 1, 2ª -> 2)
    .replace(/[^\w\s\/\-\.]/g, ' ') // keep alphanumeric and standard dividers
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if search query matches an RE (full or base) strictly and accurately.
 * Never matches if either RE is empty or has fewer than 4 digits.
 */
export function matchesExactRe(officerRe: string | undefined | null, query: string): boolean {
  if (!query || !query.trim()) return false;
  const normQ = normalizeRe(query);
  const normTarget = normalizeRe(officerRe);

  if (normQ.length < 3 || normTarget.length < 4) {
    return false;
  }

  const baseQ = getReBase(normQ);
  const baseTarget = getReBase(normTarget);

  // Exact full RE match (e.g. "1300431" === "1300431" or "130043" === "130043")
  if (normTarget === normQ) return true;

  // Exact base match (e.g. "130043" === "130043")
  if (baseTarget === baseQ || baseTarget === normQ || normTarget === baseQ) return true;

  // Starts with (e.g. user typed "130043" and target is "1300431")
  if (normTarget.startsWith(normQ) && normQ.length >= 5) return true;

  return false;
}

/**
 * Checks if search query matches an RE (full or base) or a name
 */
export function matchesQuery(
  officerRe: string | undefined | null,
  officerName: string | undefined | null,
  query: string
): boolean {
  if (!query || !query.trim()) return false;

  const rawQuery = query.trim();
  const normQ = normalizeRe(rawQuery);
  const normNameQ = normalizeText(rawQuery);

  const normTargetRe = normalizeRe(officerRe);
  const targetBase = getReBase(officerRe);
  const targetName = normalizeText(officerName);

  // 1. RE match - ONLY evaluate if target has a valid RE of at least 4 chars!
  if (normTargetRe.length >= 4 && normQ.length >= 3) {
    const qBase = getReBase(normQ);

    if (normTargetRe === normQ || targetBase === normQ || targetBase === qBase || normTargetRe === qBase) {
      return true;
    }

    if (normTargetRe.startsWith(normQ) && normQ.length >= 5) {
      return true;
    }

    if (targetBase.startsWith(normQ) && normQ.length >= 4) {
      return true;
    }
  }

  // 2. Name match - ONLY if name query has at least 3 characters and targetName is not empty
  if (normNameQ.length >= 3 && targetName.length >= 3) {
    // If query is pure numbers, do not match against name unless name contains those digits
    const isPureDigits = /^[0-9]+$/.test(normQ) && normQ.length >= 4;
    if (isPureDigits) {
      return false;
    }

    if (targetName.includes(normNameQ)) {
      return true;
    }

    const queryWords = normNameQ.split(' ').filter((w) => w.length >= 3);
    if (queryWords.length > 0 && queryWords.every((w) => targetName.includes(w))) {
      return true;
    }
  }

  return false;
}
