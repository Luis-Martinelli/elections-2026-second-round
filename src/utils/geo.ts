import { findSchoolCoordinates } from '../data/schoolCoordinates';

/**
 * Calculate distance in meters between two lat/lng coordinates using Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export interface CoordinatesResult {
  lat: number;
  lng: number;
  accuracy: number;
}

/**
 * Get current browser GPS location with high accuracy
 */
export function getCurrentPositionAsync(): Promise<CoordinatesResult | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 5)
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 15000
      }
    );
  });
}

/**
 * Generate cryptographic-like unique operational protocol
 */
export function generateProtocol(): string {
  // 10 hex chars from a CSPRNG (~10^12 values): 5 chars (~10^6) collided with ~11% chance
  // over a single election day
  const bytes = new Uint8Array(5);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `#E26-${rand}-PMESP`;
}

/**
 * Returns Google Maps directions URL for turn-by-turn navigation.
 * Prioritizes exact GPS lat/lng coordinates, falling back to official coordinates database,
 * or address + city textual search.
 */
export function getGoogleMapsNavigationUrl(school: {
  school: string;
  city?: string;
  address?: string;
  bairro?: string;
  lat?: number;
  lng?: number;
}): string {
  // 1. Direct coordinates on school object
  if (
    typeof school.lat === 'number' &&
    typeof school.lng === 'number' &&
    !isNaN(school.lat) &&
    !isNaN(school.lng) &&
    school.lat !== 0 &&
    school.lng !== 0 &&
    Math.abs(school.lat - school.lng) > 0.001 &&
    school.lng < -40 &&
    school.lat < -15
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${school.lat},${school.lng}`;
  }

  // 2. Official database match for coordinates
  const geoMatch = findSchoolCoordinates(school.school, school.city);
  if (geoMatch && geoMatch.lat && geoMatch.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${geoMatch.lat},${geoMatch.lng}`;
  }

  // 3. Fallback: formatted textual query with School Name, Address/Bairro and City
  const addressPart = school.address || geoMatch?.address || school.bairro || '';
  const queryParts = [school.school, addressPart, school.city || 'SP'].filter(Boolean);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(queryParts.join(', '))}`;
}

/**
 * Returns the best human-readable address for a school
 */
export function getSchoolDisplayAddress(school: {
  school: string;
  city?: string;
  address?: string;
  bairro?: string;
}): string {
  if (school.address && school.address.trim()) {
    return school.address.trim();
  }
  const geoMatch = findSchoolCoordinates(school.school, school.city);
  if (geoMatch?.address && geoMatch.address.trim()) {
    return geoMatch.address.trim();
  }
  if (school.bairro && school.bairro.trim()) {
    return `${school.bairro.trim()} - ${school.city || ''}`.trim();
  }
  return school.city ? `Zona Eleitoral - ${school.city}` : 'Local de Votação';
}
