import { SchoolItem } from '../types';
import { normalizeText } from './normalize';

/**
 * Extracts Cia numbers (e.g. '1', '2', '3', '4') from a string.
 * Handles formats:
 * - "1ª e 3ª Cia", "1ª / 3ª", "1 e 3 Cia", "1, 3"
 * - "CPI-7 - 40.BPM/I - 1.CIA", "CPI-7 - 40.BPM/I - 2.CIA", "CPI-7 - 40.BPM/I - 3.CIA"
 * - "1ª Cia", "1.CIA", "1 CIA", "1-CIA", "1ª COMPANHIA", "1.ª CIA", "1ªCia"
 * - "CIA 1", "COMPANHIA 1"
 * - Prevents false positives from "40.BPM/I", "40º BPM/I", "CPI-7"
 */
export function extractCiaNumbers(str?: string): Set<string> {
  if (!str) return new Set();
  const cias = new Set<string>();

  // Remove battalion/CPI numbers like 40 (from 40º BPM/I or 40.BPM/I) or 7 (from CPI-7)
  const cleaned = str
    .replace(/\b\d+\s*[\.ªº°a-z\-]*\s*(?:BPM[\/I]*|BATALHAO|CPI[\-\s]*\d*)/gi, ' ')
    .toUpperCase();

  // 1. Number followed by optional dot/ordinal and CIA / COMPANHIA
  // Matches: 1.CIA, 1ª CIA, 1º CIA, 1 CIA, 1-CIA, 1.ª CIA, 1ªCia, 1 COMPANHIA
  const p1 = /(\b[1-9])\s*[\.ªº°a-z\-]*\s*(?:CIA|COMPANHIA)/gi;
  let m: RegExpExecArray | null;
  while ((m = p1.exec(cleaned)) !== null) {
    cias.add(m[1]);
  }

  // 2. Multi-cia like '1ª e 3ª Cia', '1 e 3 Cia', '1 / 3 Cia', '1, 3', '1ª / 3ª'
  const p2 = /(\b[1-9])\s*[\.ªº°a-z\-]*\s*(?:E|\/|,|-)\s*([1-9])\s*[\.ªº°a-z\-]*\s*(?:CIA|COMPANHIA)?/gi;
  while ((m = p2.exec(cleaned)) !== null) {
    cias.add(m[1]);
    cias.add(m[2]);
  }

  // 3. Word CIA followed by number: 'CIA 1', 'CIA. 1', 'CIA 1ª'
  const p3 = /(?:CIA|COMPANHIA)\s*[\.º°a-z\-]*\s*([1-9])\b/gi;
  while ((m = p3.exec(cleaned)) !== null) {
    cias.add(m[1]);
  }

  // 4. If string is just a single digit like '1' or '1ª'
  const p4 = /^\s*([1-9])\s*[\.ªº°a-z\-]*\s*$/;
  const m4 = cleaned.match(p4);
  if (m4) {
    cias.add(m4[1]);
  }

  return cias;
}

/**
 * 40º BPM/I municipality to Companhia mapping.
 * Used as fallback if school OPM does not specify the Companhia.
 */
export const MUNICIPALITY_CIA_MAP: Record<string, string> = {
  VOTORANTIM: '1',
  ALUMINIO: '1',
  IBIUNA: '2',
  PIEDADE: '2',
  TAPIRAI: '2',
  PILARDOSUL: '3',
  ARASCOIABADASERRA: '3',
  ARACOIABADASERRA: '3',
  SALTODEPIRAPORA: '3',
  IPERO: '3'
};

export interface Bpm40MunicipalityDefinition {
  canonicalName: string;
  cia: string;
  aliases: string[];
}

export const BPM40_MUNICIPALITY_DEFINITIONS: Bpm40MunicipalityDefinition[] = [
  {
    canonicalName: 'PILAR DO SUL',
    cia: '3',
    aliases: ['PILAR DO SUL', 'PILARDOSUL', 'PILAR']
  },
  {
    canonicalName: 'IPERÓ',
    cia: '3',
    aliases: ['IPERO', 'IPERÓ']
  },
  {
    canonicalName: 'SALTO DE PIRAPORA',
    cia: '3',
    aliases: ['SALTO DE PIRAPORA', 'SALTODEPIRAPORA', 'SALTO PIRAPORA', 'PIRAPORA']
  },
  {
    canonicalName: 'ARAÇOIABA DA SERRA',
    cia: '3',
    aliases: [
      'ARACOIABA DA SERRA',
      'ARAÇOIABA DA SERRA',
      'ARACOIABA',
      'ARAÇOIABA',
      'ARASCOIABA DA SERRA',
      'ARASCOIABA'
    ]
  },
  {
    canonicalName: 'IBIÚNA',
    cia: '2',
    aliases: ['IBIUNA', 'IBIÚNA']
  },
  {
    canonicalName: 'PIEDADE',
    cia: '2',
    aliases: ['PIEDADE']
  },
  {
    canonicalName: 'TAPIRAÍ',
    cia: '2',
    aliases: ['TAPIRAI', 'TAPIRAÍ']
  },
  {
    canonicalName: 'VOTORANTIM',
    cia: '1',
    aliases: ['VOTORANTIM']
  },
  {
    canonicalName: 'ALUMÍNIO',
    cia: '1',
    aliases: ['ALUMINIO', 'ALUMÍNIO']
  }
];

/**
 * Checks if the assignment is battalion-wide supervision (sees all municipalities).
 * e.g., Oficial de Dia, CFP, Coordenador Operacional, P/3, Batalhão Sede without a specific Cia.
 */
export function isBattalionWideSupervision(text?: string): boolean {
  if (!text) return false;
  const norm = normalizeText(text);
  const cias = extractCiaNumbers(text);

  // If a specific Cia is explicitly stated (e.g. "3ª Cia - Pilar do Sul", "1ª Cia - Votorantim"),
  // it is NOT battalion-wide supervision.
  if (cias.size > 0) {
    return false;
  }

  return (
    norm.includes('OFICIAL DE DIA') ||
    norm.includes('CFP') ||
    norm.includes('COORDENADOR') ||
    norm.includes('P 3') ||
    norm.includes('P/3') ||
    norm.includes('TODOS') ||
    norm.includes('TODAS') ||
    norm.includes('GERAL') ||
    (norm.includes('BATALHAO') && !norm.includes('CIA'))
  );
}

/**
 * Detects if an officer's assignment specifies a particular municipality.
 * Handles cases like:
 * - "3ª Cia - Pilar do Sul" -> "PILAR DO SUL"
 * - "2ª Cia - Ibiúna" -> "IBIÚNA"
 * - "2ª Cia - Piedade" -> "PIEDADE"
 * - "3ª Cia - Iperó" -> "IPERÓ"
 * - "1ª Cia - Votorantim" -> "VOTORANTIM"
 * - "1ª Cia - Alumínio" -> "ALUMÍNIO"
 * - "2ª Cia - Tapiraí" -> "TAPIRAÍ"
 * - "3ª Cia - Araçoiaba da Serra" -> "ARAÇOIABA DA SERRA"
 * - "3ª Cia - Salto de Pirapora" -> "SALTO DE PIRAPORA"
 */
export function detectOfficerSpecificMunicipality(
  officerLocal?: string,
  officerFunction?: string
): string | null {
  const combined = `${officerLocal || ''} ${officerFunction || ''}`;
  if (!combined.trim()) return null;

  if (isBattalionWideSupervision(combined)) {
    return null;
  }

  const norm = normalizeText(combined);

  for (const item of BPM40_MUNICIPALITY_DEFINITIONS) {
    for (const alias of item.aliases) {
      const normAlias = normalizeText(alias);
      // For short single-word aliases (e.g. 'PILAR' or 'PIRAPORA'), use word boundary matching
      if (normAlias.split(' ').length === 1 && normAlias.length <= 8) {
        const regex = new RegExp(`(^|\\s|[-/\\.,·])${normAlias}($|\\s|[-/\\.,·])`, 'i');
        if (regex.test(norm)) {
          return item.canonicalName;
        }
      } else {
        if (norm.includes(normAlias)) {
          return item.canonicalName;
        }
      }
    }
  }

  return null;
}

/**
 * Checks whether a given school belongs to a target municipality (by canonical name or alias).
 */
export function isSchoolInMunicipality(school: SchoolItem, targetMunicipality: string): boolean {
  const targetNorm = normalizeText(targetMunicipality);

  if (school.city) {
    const cityNorm = normalizeText(school.city);
    if (cityNorm === targetNorm) return true;

    const def = BPM40_MUNICIPALITY_DEFINITIONS.find(
      (d) => normalizeText(d.canonicalName) === targetNorm
    );
    if (def && def.aliases.some((a) => normalizeText(a) === cityNorm)) {
      return true;
    }
  }

  // Fallback: check address, bairro, and school name
  const extraText = normalizeText(
    `${school.address || ''} ${school.bairro || ''} ${school.school || ''}`
  );
  if (extraText.includes(targetNorm)) {
    return true;
  }

  const def = BPM40_MUNICIPALITY_DEFINITIONS.find(
    (d) => normalizeText(d.canonicalName) === targetNorm
  );
  if (def && def.aliases.some((a) => extraText.includes(normalizeText(a)))) {
    return true;
  }

  return false;
}

/**
 * Robustly checks whether a school falls under an officer's assigned jurisdiction.
 */
export function matchesJurisdiction(
  officerLocal?: string,
  schoolOpm?: string,
  schoolCity?: string,
  officerFunction?: string
): boolean {
  if (!officerLocal && !officerFunction) return true;

  // 1. If officer is assigned to a specific municipality, test against that municipality
  const specificMuni = detectOfficerSpecificMunicipality(officerLocal, officerFunction);
  if (specificMuni) {
    return isSchoolInMunicipality(
      {
        id: '',
        school: '',
        city: schoolCity || '',
        opm: schoolOpm || '',
        zone: '',
        bairro: '',
        am: { re: '', name: '', rank: '', phone: '' },
        pm: { re: '', name: '', rank: '', phone: '' }
      },
      specificMuni
    );
  }

  const normLocal = normalizeText(officerLocal || '');
  if (!normLocal) return true;

  // 2. Battalion Level / General Supervision -> Sees all schools
  if (
    normLocal.includes('40') ||
    normLocal.includes('bpm') ||
    normLocal.includes('batalhao') ||
    normLocal.includes('cpi') ||
    normLocal.includes('geral') ||
    normLocal.includes('todas') ||
    normLocal.includes('todos') ||
    normLocal.includes('sede')
  ) {
    return true;
  }

  const localCias = extractCiaNumbers(officerLocal);
  const schoolCias = extractCiaNumbers(schoolOpm);

  // If schoolOpm didn't yield a Cia number, try matching via city mapping
  if (schoolCias.size === 0 && schoolCity) {
    const normCity = normalizeText(schoolCity);
    const mappedCia = MUNICIPALITY_CIA_MAP[normCity];
    if (mappedCia) {
      schoolCias.add(mappedCia);
    }
  }

  // If both have recognized Companhia numbers, check for intersection
  if (localCias.size > 0 && schoolCias.size > 0) {
    for (const c of localCias) {
      if (schoolCias.has(c)) {
        return true;
      }
    }
    return false;
  }

  // Direct text matching fallback
  if (schoolOpm) {
    const normOpm = normalizeText(schoolOpm);
    if (normOpm && (normLocal.includes(normOpm) || normOpm.includes(normLocal))) {
      return true;
    }
  }

  // Direct municipality name matching fallback
  if (schoolCity) {
    const normCity = normalizeText(schoolCity);
    if (normCity && (normLocal.includes(normCity) || normCity.includes(normLocal))) {
      return true;
    }
  }

  // Regex fallback: If officerLocal has Cia numbers, check if schoolOpm contains "X.CIA" or "X CIA"
  if (localCias.size > 0 && schoolOpm) {
    for (const c of localCias) {
      if (new RegExp('\\b' + c + '[ªº°\\.a-z\\-]*\\s*cia', 'i').test(schoolOpm)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Filter an array of schools according to the officer's jurisdiction.
 * If the officer is assigned to a specific municipality (e.g. "3ª Cia - Pilar do Sul", "2ª Cia - Ibiúna", "1ª Cia - Votorantim"),
 * strictly returns ONLY schools belonging to that municipality.
 */
export function filterSchoolsByJurisdiction(
  schools: SchoolItem[],
  officerLocal?: string,
  officerFunction?: string
): SchoolItem[] {
  if (!schools || !Array.isArray(schools)) return [];
  if (!officerLocal && !officerFunction) return schools;

  // 1. Strict Municipality Filtering
  const specificMuni = detectOfficerSpecificMunicipality(officerLocal, officerFunction);
  if (specificMuni) {
    return schools.filter((school) => isSchoolInMunicipality(school, specificMuni));
  }

  // 2. Companhia or General Jurisdiction Filtering
  const filtered = schools.filter((school) =>
    matchesJurisdiction(officerLocal, school.opm, school.city, officerFunction)
  );

  // Fallback: If filter resulted in 0 schools, do not leave the supervisor with empty view
  return filtered.length > 0 ? filtered : schools;
}

