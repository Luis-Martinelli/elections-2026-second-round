import { normalizeText } from './normalize';

export const BPM40_CITIES = [
  'ALUMÍNIO',
  'ARAÇOIABA DA SERRA',
  'IBIÚNA',
  'IPERÓ',
  'PIEDADE',
  'PILAR DO SUL',
  'SALTO DE PIRAPORA',
  'TAPIRAÍ',
  'VOTORANTIM'
] as const;

export type Bpm40City = (typeof BPM40_CITIES)[number];

// High-confidence keywords and distinctive school/location signatures for each municipality
const CITY_SIGNATURES: { city: Bpm40City; keywords: string[]; zones?: string[] }[] = [
  {
    city: 'IPERÓ',
    keywords: [
      'IPERO',
      'IPERÓ',
      'BACAETAVA',
      'GEORGE OETTERER',
      'OETTERER',
      'CARTORIO DE IPERO',
      'CARTORIO DE IPERÓ'
    ],
    zones: ['131', '356']
  },
  {
    city: 'ALUMÍNIO',
    keywords: [
      'ALUMINIO',
      'ALUMÍNIO',
      'HONORINA RIOS',
      'COMENDADOR RODOVALHO',
      'RODOVALHO',
      'CASTRO FIGUEIROA',
      'FIGUEIROA',
      'ISAURA KRUGER',
      'JARDIM OLIDEL',
      'OLIDEL',
      'VILA PEDAGIO',
      'VILA PAULO DIAS',
      'VILA INDUSTRIAL',
      'CBA'
    ],
    zones: ['131']
  },
  {
    city: 'IBIÚNA',
    keywords: [
      'IBIUNA',
      'IBIÚNA',
      'ROQUE BASTOS',
      'LAURINDA VIEIRA',
      'ARMINDO GOMES',
      'DOM BOSCO',
      'MENDES SILVA',
      'GUILHERME DE ALMEIDA',
      'CARMO MESSIAS',
      'RESSACA',
      'PARCURANA',
      'VARGEM DO SALTO',
      'DISNEYLANDIA',
      'PIAI',
      'PIAÍ',
      'CURRAL',
      'JD DISNEYLANDIA',
      'CARTORIO DE IBIUNA'
    ],
    zones: ['191', '190']
  },
  {
    city: 'PIEDADE',
    keywords: [
      'PIEDADE',
      'CARLOS GOMES',
      'THEODORO DE ASSIS',
      'MARIA DINORAH',
      'ANTONIO ROLIM',
      'PARQUE DA TORRE',
      'PIRATUBA',
      'BAIRRO DOS PINTOS',
      'MOREIRAS',
      'VILA OLINDA',
      'COTIANOS',
      'CARTORIO DE PIEDADE',
      'CEMEI ANTONIO ROLIM',
      'SANTA RITA'
    ],
    zones: ['89', '103', '262']
  },
  {
    city: 'ARAÇOIABA DA SERRA',
    keywords: [
      'ARACOIABA DA SERRA',
      'ARAÇOIABA DA SERRA',
      'ARACOIABA',
      'ARAÇOIABA',
      'OSMAR GIACOMELLI',
      'GIACOMELLI',
      'MARIA ANGELICA BAILLOT',
      'BAILLOT',
      'TOLEDOPOLIS',
      'JUNDIAQUARA',
      'CAMPO DO MEIO',
      'CEL ALMEIDA',
      'LUCAS ROSAS',
      'DINORAH'
    ],
    zones: ['294']
  },
  {
    city: 'SALTO DE PIRAPORA',
    keywords: [
      'SALTO DE PIRAPORA',
      'PIRAPORA',
      'AFONSO VERGUEIRO',
      'BENEDITA DE CASTRO',
      'ILHEUS',
      'CAMPO LARGO',
      'PAULAS E MENDES',
      'JARDIM PAULISTA'
    ],
    zones: ['356']
  },
  {
    city: 'PILAR DO SUL',
    keywords: [
      'PILAR DO SUL',
      'PILAR',
      'PADRE MATHEUS',
      'ALZIRA VALENTE',
      'TURVO DOS ALMEIDAS',
      'BAIRRO DO CAMPO'
    ],
    zones: ['344']
  },
  {
    city: 'TAPIRAÍ',
    keywords: [
      'TAPIRAI',
      'TAPIRAÍ',
      'CORONEL JOAO ROSA',
      'JOAO ROSA',
      'BAIRRO DO CHA',
      'BAIRRO DO CHÁ',
      'TURVO TAPIRAI',
      'ALECRIM'
    ],
    zones: []
  },
  {
    city: 'VOTORANTIM',
    keywords: [
      'VOTORANTIM',
      'VOTORATIM',
      'WILSON PRESTES',
      'DANIEL VERANO',
      'PEREIRA INACIO',
      'PEREIRA INÁCIO',
      'ARMANDO RIZZO',
      'AZARIAS MENDES',
      'CARMELA GUARIGLIA',
      'ROMANA FREDERICO',
      'ROSA PEREIRA',
      'CARMELA DE PAULA',
      'BELA ALVORADA',
      'CLOTILDE BELINE',
      'PEDRO AUGUSTO',
      'MARIA COELHO',
      'SELMA MARIA',
      'ALICE DIAS',
      'ANTONIO PINTO',
      'WALTER ROCHA',
      'PARISI',
      'BARRA FUNDA',
      'ICATU',
      'NOVO MUNDO',
      'CLARICE',
      'SERRANO',
      'RIO ACIMA',
      'CARTORIO ELEITORAL DE VOTORANTIM',
      'CARTORIO ELEITORAL DE VOTORATIM',
      'VILA NOVA VOTORANTIM',
      'JD TOLEDO',
      'PARQUE BELA VISTA'
    ],
    zones: ['220']
  }
];

/**
 * Normalizes city names to canonical form, handling accentuation and spelling variants like VOTORATIM / VOTORANTIM.
 */
export function normalizeCityName(city: string | undefined | null): string {
  if (!city) return '';
  const detected = detectCityFromText(city);
  if (detected) return detected;
  const norm = normalizeText(city);
  if (norm === 'VOTORATIM' || norm === 'VOTORANTIM') return 'VOTORANTIM';
  return norm;
}

/**
 * Detects if a text string directly mentions one of the 40º BPM/I municipalities.
 */
export function detectCityFromText(text: string | undefined | null): Bpm40City | null {
  if (!text) return null;
  const norm = normalizeText(text);

  // 1. Direct municipality name check
  if (norm.includes('IBIUNA')) return 'IBIÚNA';
  if (norm.includes('PIEDADE')) return 'PIEDADE';
  if (norm.includes('IPERO')) return 'IPERÓ';
  if (norm.includes('ARACOIABA') || norm.includes('ARASCOIABA')) return 'ARAÇOIABA DA SERRA';
  if (norm.includes('SALTO DE PIRAPORA') || norm.includes('PIRAPORA')) return 'SALTO DE PIRAPORA';
  if (norm.includes('PILAR DO SUL') || /(^|\s|[-/])PILAR($|\s|[-/])/i.test(norm)) return 'PILAR DO SUL';
  if (norm.includes('TAPIRAI')) return 'TAPIRAÍ';
  if (norm.includes('ALUMINIO')) return 'ALUMÍNIO';
  if (norm.includes('VOTORANTIM') || norm.includes('VOTORATIM')) return 'VOTORANTIM';

  // 2. High-confidence distinctive school or neighborhood keywords
  for (const sig of CITY_SIGNATURES) {
    for (const kw of sig.keywords) {
      const kwNorm = normalizeText(kw);
      if (norm.includes(kwNorm)) {
        return sig.city;
      }
    }
  }

  return null;
}

/**
 * Resolves the true canonical municipality of a school item using all available metadata:
 * raw city name, school name, address, bairro, electoral zone, and OPM sub-unit.
 */
export function resolveMunicipality(
  rawCity?: string,
  schoolName?: string,
  address?: string,
  bairro?: string,
  zone?: string,
  opm?: string
): string {
  // If rawCity is already a verified specific city other than generic/fallback
  if (rawCity) {
    const fromCity = detectCityFromText(rawCity);
    if (fromCity && fromCity !== 'VOTORANTIM') {
      return fromCity;
    }
  }

  // Check school name, address, and bairro
  const fromSchool = detectCityFromText(schoolName);
  if (fromSchool) return fromSchool;

  const fromAddress = detectCityFromText(address);
  if (fromAddress) return fromAddress;

  const fromBairro = detectCityFromText(bairro);
  if (fromBairro) return fromBairro;

  // Check electoral zone
  if (zone) {
    const cleanZone = zone.replace(/[^0-9]/g, '');
    for (const sig of CITY_SIGNATURES) {
      if (sig.zones && sig.zones.includes(cleanZone)) {
        return sig.city;
      }
    }
  }

  // Check OPM / Company
  if (opm) {
    const fromOpm = detectCityFromText(opm);
    if (fromOpm) return fromOpm;
  }

  // If rawCity was 'VOTORANTIM' or another recognized city, return canonical
  if (rawCity) {
    const fromCity = detectCityFromText(rawCity);
    if (fromCity) return fromCity;
    const clean = rawCity.trim().toUpperCase();
    if (clean.length > 2) return clean;
  }

  return 'VOTORANTIM';
}
