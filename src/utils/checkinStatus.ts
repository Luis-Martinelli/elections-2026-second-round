import { SchoolItem, SchoolOfficer, CheckInRecord, StaffMember } from '../types';
import { normalizeText, normalizeRe, matchesExactRe, getReBase } from './normalize';
import { normalizeCityName } from './municipality';

/**
 * Returns all assigned morning officers for a school.
 */
export function getSchoolAmOfficers(school: SchoolItem): SchoolOfficer[] {
  if (school.amOfficers && school.amOfficers.length > 0) {
    return school.amOfficers;
  }
  return school.am && (school.am.re || school.am.name) ? [school.am] : [];
}

/**
 * Returns all assigned afternoon officers for a school.
 */
export function getSchoolPmOfficers(school: SchoolItem): SchoolOfficer[] {
  if (school.pmOfficers && school.pmOfficers.length > 0) {
    return school.pmOfficers;
  }
  return school.pm && (school.pm.re || school.pm.name) ? [school.pm] : [];
}

/**
 * Finds check-in record for a specific officer at a school.
 */
export function findOfficerCheckIn(
  school: SchoolItem,
  officer: SchoolOfficer | { re?: string; name?: string },
  shift: 'Manhã' | 'Tarde' | 'Integral',
  checkIns: CheckInRecord[]
): CheckInRecord | undefined {
  if (!school || !officer || !checkIns || checkIns.length === 0) return undefined;
  if (shift === 'Integral') {
    const am = checkIns.find((c) => matchOfficerCheckIn(officer, school, 'MANHA', c, true));
    if (am) return am;
    return checkIns.find((c) => matchOfficerCheckIn(officer, school, 'TARDE', c, true));
  }
  const targetShift = shift === 'Manhã' ? 'MANHA' : 'TARDE';
  // Per-officer lookup: the officer must match. A school-only match would credit one
  // officer with a colleague's check-in on multi-officer posts.
  return checkIns.find((c) => matchOfficerCheckIn(officer, school, targetShift, c, true));
}

interface CheckInInfo {
  isGcm: boolean;
  city: string;
  school: string;
  name: string;
  re: string;
  shift: string;
  hour: number;
}

// Normalized fields per check-in, computed once per record object instead of once per
// (school × officer × check-in) comparison.
const checkInInfoCache = new WeakMap<CheckInRecord, CheckInInfo>();

function getCheckInInfo(c: CheckInRecord): CheckInInfo {
  let info = checkInInfoCache.get(c);
  if (info) return info;
  let hour = -1;
  if (c.time) {
    // time is 'dd/mm/yyyy - HH:mm:ss' (or legacy 'HH:mm:ss')
    const timePart = c.time.includes(' - ') ? c.time.split(' - ')[1] : c.time;
    const h = parseInt(timePart.split(':')[0], 10);
    if (!isNaN(h)) hour = h;
  }
  info = {
    isGcm: isGcmOfficer({ name: c.officerName, re: c.officerRe, rank: c.rank }),
    city: normalizeText(c.city || ''),
    school: normalizeText(c.schoolName || ''),
    name: normalizeText(c.officerName || ''),
    re: normalizeRe(c.officerRe || ''),
    shift: normalizeText(c.shift || ''),
    hour
  };
  checkInInfoCache.set(c, info);
  return info;
}

/** True when the check-in has a GPS-measured distance to the post. */
export function hasVerifiedLocation(c: CheckInRecord): boolean {
  return typeof c.distanceMeters === 'number';
}

/** True when the check-in was registered more than 150m from the post. */
export function isOutsideRadius(c: CheckInRecord): boolean {
  return c.isOutOfRange || (typeof c.distanceMeters === 'number' && c.distanceMeters > 150);
}

/**
 * Detects whether a school name or role indicates a mobile ronda / supervisory role
 * rather than a fixed educational school post.
 */
export function isRondaRoleOrSchool(roleOrSchoolName?: string, addressOrBairro?: string): boolean {
  if (!roleOrSchoolName && !addressOrBairro) return false;
  const nameNorm = normalizeText(roleOrSchoolName || '');
  const addrNorm = normalizeText(addressOrBairro || '');
  return (
    nameNorm.includes('CGP') ||
    nameNorm.includes('RONDA') ||
    nameNorm.includes('FISCALIZA') ||
    nameNorm.includes('SUPERVIS') ||
    nameNorm.includes('COORDEN') ||
    nameNorm.includes('COMAND') ||
    nameNorm.includes('OFICIAL DE DIA') ||
    nameNorm.includes('SUBCOMAND') ||
    nameNorm.includes('CFP') ||
    nameNorm.includes('PATRULHA') ||
    nameNorm.includes('FORCA TATICA') ||
    nameNorm.includes('FORÇA TÁTICA') ||
    nameNorm.includes('CPI 7') ||
    nameNorm.includes('CPI-7') ||
    nameNorm.includes('40.BPM') ||
    nameNorm.includes('40 BPM') ||
    nameNorm.includes('40º BPM') ||
    addrNorm.includes('AREA LIVRE') ||
    addrNorm.includes('ÁREA LIVRE') ||
    addrNorm.includes('ITINERANTE') ||
    addrNorm.includes('MOVEL')
  );
}

/**
 * Checks whether an officer is operating as a mobile patrol (Ronda / CGP) rather than a fixed school guard.
 */
export function isOfficerInRonda(officer?: { staff?: StaffMember; schoolItem?: SchoolItem; isMotorized?: boolean } | null): boolean {
  if (!officer) return false;
  const rawRoleText = officer.staff?.function || (officer.schoolItem ? officer.schoolItem.school : '');
  const normalizedFunction = normalizeText(rawRoleText);
  const isExcludedSupportRole =
    normalizedFunction.includes('MOTORISTA') ||
    normalizedFunction.includes('MOT.') ||
    normalizedFunction.includes('AUXILIAR') ||
    normalizedFunction.includes('AUX.') ||
    normalizedFunction.includes('AUXILI') ||
    /\bAUX\b/.test(normalizedFunction) ||
    normalizedFunction.includes('ESCOLTA') ||
    normalizedFunction.includes('APOIO') ||
    normalizedFunction.includes('ADMINISTRATIV');

  if (isExcludedSupportRole) return false;

  return Boolean(
    officer.isMotorized ||
    isRondaRoleOrSchool(officer.staff?.function) ||
    (officer.schoolItem ? isRondaRoleOrSchool(officer.schoolItem.school, officer.schoolItem.address || officer.schoolItem.bairro) : false)
  );
}

/**
 * Detects whether a school or entry originates from the GCM (Guarda Civil Municipal) tab or jurisdiction.
 * These are not PMESP polling posts and should be excluded from PMESP military operations.
 */
export function isGcmSchool(school?: SchoolItem | null): boolean {
  if (!school) return false;
  const opm = normalizeText(school.opm || '');
  const name = normalizeText(school.school || '');

  // Only exclude if the post is specifically assigned to the municipal guard (GCM)
  if (
    opm === 'GCM' ||
    opm.includes('GUARDA CIVIL') ||
    opm.includes('GUARDA MUNICIPAL') ||
    name.startsWith('GCM ') ||
    name.startsWith('GUARDA CIVIL ') ||
    name.startsWith('POSTO GCM')
  ) {
    return true;
  }

  return false;
}

/**
 * Detects whether an assigned officer is from the GCM (Guarda Civil Municipal).
 * For GCM assignments, check-in is ignored for PMESP and the check-in button is removed.
 */
export function isGcmOfficer(officer?: SchoolOfficer | { re?: string; name?: string; rank?: string } | null): boolean {
  if (!officer) return false;
  const nameNorm = normalizeText(officer.name || '');
  const reNorm = normalizeText(officer.re || '');
  const rankNorm = normalizeText(officer.rank || '');
  return (
    nameNorm.includes('GCM') ||
    nameNorm.includes('GUARDA CIVIL') ||
    nameNorm.includes('GUARDA MUNICIPAL') ||
    reNorm.includes('GCM') ||
    rankNorm.includes('GCM')
  );
}

/**
 * Checks whether an officer at a given school is assigned for the entire day (both shifts).
 */
export function isSchoolFullDay(school: SchoolItem): boolean {
  if (!school) return false;

  // If either shift has GCM assigned, it is NEVER a full-day PMESP post
  if (isGcmOfficer(school.am) || isGcmOfficer(school.pm)) {
    return false;
  }

  const amRe = normalizeRe(school.am?.re || '');
  const pmRe = normalizeRe(school.pm?.re || '');

  // 1. Same non-empty RE in morning and afternoon (excluding generic text placeholders)
  if (amRe && pmRe && amRe === pmRe && amRe !== 'AREALIVRE' && amRe !== 'SEMINFO') {
    return true;
  }

  const amName = normalizeText(school.am?.name || '');
  const pmName = normalizeText(school.pm?.name || '');

  // 2. Same non-empty officer name
  if (amName && pmName && amName === pmName && amName.length > 3) {
    return true;
  }

  // 3. Afternoon notes indicate the same officer or full day
  if (
    pmName.includes('MESMO') ||
    pmName.includes('INTEGRAL') ||
    pmName.includes('DIA INTEIRO') ||
    pmName.includes('DIA TODO') ||
    pmName.includes('AMBOS') ||
    pmName.includes('12H') ||
    pmName.includes('13H')
  ) {
    return true;
  }

  // 4. If morning has officer and afternoon is completely empty, it's a single post for the day
  if (amName && !pmName && amName.length > 2) {
    return true;
  }

  // 5. Cross-check rosters (amOfficers vs pmOfficers)
  const amList = getSchoolAmOfficers(school);
  const pmList = getSchoolPmOfficers(school);
  if (amList.length > 0) {
    if (pmList.length === 0) return true;
    const hasMatching = amList.some((amOff) =>
      pmList.some((pmOff) => {
        const rAm = normalizeRe(amOff.re);
        const rPm = normalizeRe(pmOff.re);
        if (rAm && rPm && (rAm === rPm || matchesExactRe(rAm, pmOff.re))) return true;
        const nAm = normalizeText(amOff.name);
        const nPm = normalizeText(pmOff.name);
        if (nAm && nPm && nAm === nPm && nAm.length > 3) return true;
        if (nPm.includes('MESMO') || nPm.includes('INTEGRAL') || nPm.includes('DIA INTEIRO') || nPm.includes('AMBOS')) return true;
        return false;
      })
    );
    if (hasMatching) return true;
  }

  return false;
}

/**
 * Robustly matches an individual check-in record against a specific officer and school assignment.
 */
function matchOfficerCheckIn(
  officer: { name?: string; re?: string } | undefined,
  school: SchoolItem,
  targetShift: 'MANHA' | 'TARDE',
  c: CheckInRecord,
  requireOfficer: boolean = false
): boolean {
  if (!c || !school) return false;
  const info = getCheckInInfo(c);

  // GCM checks: completely ignore GCM check-in records and GCM assigned posts
  if (info.isGcm) {
    return false;
  }
  if (isGcmOfficer(officer)) {
    return false;
  }
  if (targetShift === 'TARDE' && (isGcmOfficer(school.pm) || (school.pmOfficers && school.pmOfficers.length > 0 && school.pmOfficers.every(isGcmOfficer)))) {
    return false;
  }
  if (targetShift === 'MANHA' && (isGcmOfficer(school.am) || (school.amOfficers && school.amOfficers.length > 0 && school.amOfficers.every(isGcmOfficer)))) {
    return false;
  }

  // 1. Guard by City: If both have a city, ensure they belong to the same municipality
  if (school.city && c.city) {
    const sCity = normalizeCityName(school.city);
    const cCity = normalizeCityName(c.city);
    if (sCity && cCity && sCity !== 'TODOS' && cCity !== 'TODOS' && sCity !== cCity) {
      return false;
    }
  }

  // 2. School Name Matching (exact, alphanumeric, or prefix equality)
  const schoolNorm = normalizeText(school.school || '');
  const cSchoolNorm = info.school;
  const sClean = (school.school || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cClean = (c.schoolName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  const matchSchool = Boolean(
    (sClean && cClean && (sClean === cClean || (sClean.length > 5 && cClean.includes(sClean)) || (cClean.length > 5 && sClean.includes(cClean)))) ||
    (schoolNorm &&
      cSchoolNorm &&
      (cSchoolNorm === schoolNorm ||
        (schoolNorm.length > 8 && cSchoolNorm.startsWith(schoolNorm)) ||
        (cSchoolNorm.length > 8 && schoolNorm.startsWith(cSchoolNorm))))
  );

  const officerName = normalizeText(officer?.name || '');
  const cOfficerName = info.name;

  // Match by officer name (exact or substring if long enough)
  const matchName = Boolean(
    officerName &&
    cOfficerName &&
    officerName !== 'AGUARDANDO ESCALA' &&
    cOfficerName !== 'AGUARDANDO ESCALA' &&
    (officerName === cOfficerName ||
      (officerName.length > 5 && cOfficerName.includes(officerName)) ||
      (cOfficerName.length > 5 && officerName.includes(cOfficerName)))
  );

  const officerRe = normalizeRe(officer?.re || '');
  const cOfficerRe = info.re;

  // Match by RE (handling base, digits, formatting)
  const matchRe = Boolean(
    officerRe &&
    cOfficerRe &&
    (officerRe === cOfficerRe ||
      matchesExactRe(officer?.re, c.officerRe) ||
      (officerRe.length >= 6 && cOfficerRe.length >= 6 && getReBase(officerRe) === getReBase(cOfficerRe)))
  );

  const matchOfficer = matchName || matchRe;

  // If neither school nor officer matches, it's not a match
  if (!matchSchool && !matchOfficer) {
    return false;
  }
  if (requireOfficer && !matchOfficer) {
    return false;
  }

  // If school is different but officer matches, ensure city is also identical
  if (!matchSchool && matchOfficer) {
    if (school.city && c.city && normalizeText(school.city) !== info.city) {
      return false;
    }
  }

  // Determine the shift of the check-in
  const cShiftNorm = info.shift;
  const isMorningExplicit =
    cShiftNorm.includes('MANHA') ||
    cShiftNorm.includes('INTEGRAL') ||
    cShiftNorm.includes('DIA') ||
    cShiftNorm.includes('AMBOS');

  const isAfternoonExplicit =
    cShiftNorm.includes('TARDE') ||
    cShiftNorm.includes('TERMINO') ||
    cShiftNorm.includes('INTEGRAL') ||
    cShiftNorm.includes('DIA');

  const checkInHour = info.hour;

  if (targetShift === 'MANHA') {
    if (cShiftNorm.includes('TARDE') && !cShiftNorm.includes('INTEGRAL') && !cShiftNorm.includes('DIA')) {
      if (isSchoolFullDay(school) && matchOfficer) return true;
      return false;
    }
    if (isMorningExplicit) return true;
    if (checkInHour >= 5 && checkInHour < 13) return true;
    if (matchOfficer && !cShiftNorm.includes('TARDE')) return true;
    if (matchSchool && !cShiftNorm.includes('TARDE')) return true;
    if (matchOfficer && matchSchool) return true;
    return false;
  } else {
    // TARDE
    if (cShiftNorm.includes('MANHA') && !cShiftNorm.includes('INTEGRAL') && !cShiftNorm.includes('DIA')) {
      if (isSchoolFullDay(school) && matchOfficer) return true;
      return false;
    }
    if (isAfternoonExplicit) return true;
    if (checkInHour >= 13) return true;
    if (matchOfficer && !cShiftNorm.includes('MANHA')) return true;
    if (matchSchool && !cShiftNorm.includes('MANHA')) return true;
    if (matchOfficer && matchSchool) return true;
    return false;
  }
}

/**
 * Finds the check-in record for the morning shift of a school.
 */
export function findMorningCheckIn(school: SchoolItem, checkIns: CheckInRecord[]): CheckInRecord | undefined {
  if (!school || !checkIns || checkIns.length === 0) return undefined;
  if (isGcmOfficer(school.am)) return undefined;

  const amList = getSchoolAmOfficers(school);
  if (amList.length > 0 && amList.every(isGcmOfficer)) return undefined;

  if (amList.length > 0) {
    for (const off of amList) {
      if (isGcmOfficer(off)) continue;
      const rec = checkIns.find(
        (c) => !getCheckInInfo(c).isGcm && matchOfficerCheckIn(off, school, 'MANHA', c)
      );
      if (rec) return rec;
    }
  }
  return checkIns.find(
    (c) => !getCheckInInfo(c).isGcm && matchOfficerCheckIn(school.am, school, 'MANHA', c)
  );
}

/**
 * Finds the check-in record for the afternoon shift of a school.
 * If the officer is assigned for the entire day and checked in in the morning,
 * returns that morning check-in record as valid for the afternoon.
 */
export function findAfternoonCheckIn(school: SchoolItem, checkIns: CheckInRecord[]): CheckInRecord | undefined {
  if (!school || !checkIns || checkIns.length === 0) return undefined;
  if (isGcmOfficer(school.pm)) return undefined;

  const pmList = getSchoolPmOfficers(school);
  if (pmList.length > 0 && pmList.every(isGcmOfficer)) return undefined;

  if (pmList.length > 0) {
    for (const off of pmList) {
      if (isGcmOfficer(off)) continue;
      const rec = checkIns.find(
        (c) => !getCheckInInfo(c).isGcm && matchOfficerCheckIn(off, school, 'TARDE', c)
      );
      if (rec) return rec;
    }
  }

  // Direct afternoon check-in
  if (!isGcmOfficer(school.pm)) {
    const direct = checkIns.find(
      (c) => !getCheckInInfo(c).isGcm && matchOfficerCheckIn(school.pm, school, 'TARDE', c)
    );
    if (direct) return direct;
  }

  // If full day and morning is checked in, validate afternoon with morning check-in
  if (isSchoolFullDay(school) && !isGcmOfficer(school.pm)) {
    const morningCheckIn = findMorningCheckIn(school, checkIns);
    if (morningCheckIn) return morningCheckIn;
  }

  return undefined;
}

/**
 * Checks whether a school has at least one morning check-in completed.
 * GCM does not perform PMESP check-in and is never counted as checked in.
 */
export function isMorningCheckedIn(school: SchoolItem, checkIns: CheckInRecord[]): boolean {
  if (isGcmOfficer(school.am)) return false;
  return Boolean(findMorningCheckIn(school, checkIns));
}

/**
 * Checks whether ALL assigned morning officers have completed check-in.
 * Returns false if all morning officers are GCM (since no PMESP check-in exists).
 */
export function isMorningFullyCheckedIn(school: SchoolItem, checkIns: CheckInRecord[]): boolean {
  if (isGcmOfficer(school.am)) return false;
  const amList = getSchoolAmOfficers(school);
  if (amList.length === 0) return false;
  const pmespAmList = amList.filter((off) => !isGcmOfficer(off));
  if (pmespAmList.length === 0) return false; // Exclusively GCM: no PMESP check-in
  return pmespAmList.every((off) => Boolean(findOfficerCheckIn(school, off, 'Manhã', checkIns)));
}

/**
 * Checks whether a school has at least one afternoon check-in completed.
 * GCM does not perform PMESP check-in and is never counted as checked in.
 */
export function isAfternoonCheckedIn(school: SchoolItem, checkIns: CheckInRecord[]): boolean {
  if (isGcmOfficer(school.pm)) return false;
  return Boolean(findAfternoonCheckIn(school, checkIns));
}

/**
 * Checks whether ALL assigned afternoon officers have completed check-in.
 * Returns false if all afternoon officers are GCM (since no PMESP check-in exists).
 */
export function isAfternoonFullyCheckedIn(school: SchoolItem, checkIns: CheckInRecord[]): boolean {
  if (isGcmOfficer(school.pm)) return false;
  const pmList = getSchoolPmOfficers(school);
  if (pmList.length === 0) return false;
  const pmespPmList = pmList.filter((off) => !isGcmOfficer(off));
  if (pmespPmList.length === 0) return false; // Exclusively GCM: no PMESP check-in

  // Full day check: if school is full day and morning is checked in, afternoon is fully confirmed
  if (isSchoolFullDay(school)) {
    const amCheck = findMorningCheckIn(school, checkIns);
    if (amCheck) return true;
  }

  return pmespPmList.every((off) => {
    const direct = findOfficerCheckIn(school, off, 'Tarde', checkIns);
    if (direct) return true;
    if (isSchoolFullDay(school)) {
      return Boolean(findOfficerCheckIn(school, off, 'Manhã', checkIns)) || Boolean(findMorningCheckIn(school, checkIns));
    }
    return false;
  });
}

export interface ShiftKpiSummary {
  totalSchools: number;
  morningDone: number;
  morningPending: number;
  afternoonDone: number;
  afternoonPending: number;
  fullDayCount: number;
}

/**
 * Computes the 4 key KPIs:
 * 1. Morning completed check-ins
 * 2. Morning pending
 * 3. Afternoon completed check-ins (including full-day officers checked in in the morning)
 * 4. Afternoon pending
 */
export function computeShiftKpis(schools: SchoolItem[], checkIns: CheckInRecord[]): ShiftKpiSummary {
  // Only actual fixed polling stations count towards school check-ins
  const validSchools = schools.filter(
    (s) => !isRondaRoleOrSchool(s.school, s.address || s.bairro)
  );

  // Filter out any GCM check-in records completely
  const validCheckIns = (checkIns || []).filter((c) => !getCheckInInfo(c).isGcm);

  const totalSchools = validSchools.length;
  let morningDone = 0;
  let afternoonDone = 0;
  let fullDayCount = 0;

  let morningExpectedSchools = 0;
  let afternoonExpectedSchools = 0;

  validSchools.forEach((school) => {
    const isFull = isSchoolFullDay(school);
    if (isFull) fullDayCount++;

    const amList = getSchoolAmOfficers(school);
    const pmespAm = amList.filter((o) => !isGcmOfficer(o));
    if (pmespAm.length > 0 && !isGcmOfficer(school.am)) {
      morningExpectedSchools++;
      const amOk = Boolean(findMorningCheckIn(school, validCheckIns));
      if (amOk) morningDone++;
    }

    const pmList = getSchoolPmOfficers(school);
    const pmespPm = pmList.filter((o) => !isGcmOfficer(o));
    if (pmespPm.length > 0 && !isGcmOfficer(school.pm)) {
      afternoonExpectedSchools++;
      const pmOk = Boolean(findAfternoonCheckIn(school, validCheckIns));
      if (pmOk) afternoonDone++;
    }
  });

  const morningPending = Math.max(0, morningExpectedSchools - morningDone);
  const afternoonPending = Math.max(0, afternoonExpectedSchools - afternoonDone);

  return {
    totalSchools,
    morningDone,
    morningPending,
    afternoonDone,
    afternoonPending,
    fullDayCount
  };
}
