import { HouseholdFacility } from '../types';
import { getHouseholdResidenceType } from './residenceUtils';

export function normalizeSearch(value: string) {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      // "144/2, Ấp 61" and "144/2 ấp 61" are the same address: commas and semicolons separate words like spaces.
      .replace(/[,;]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function matchesHouseholdSearch(household: HouseholdFacility, query: string) {
  const q = normalizeSearch(query);
  if (!q) return true;
  const fields = [
    household.ownerName,
    household.houseNumber,
    household.street,
    // "12 Đường số 3": house number and street typed together.
    household.houseNumber && household.street ? `${household.houseNumber} ${household.street}` : undefined,
    household.hamlet,
    household.code,
    household.ownerPhone,
    household.businessName,
    household.businessCategory,
    household.alley,
    household.notes,
    getHouseholdResidenceType(household),
    ...(household.residentsList || []).flatMap(resident => [resident.fullName, resident.idCardNumber, resident.phone]),
  ];
  return (
    fields.some(value => value && normalizeSearch(value).includes(q)) ||
    (q === 'canh bao' && household.status === 'warning') ||
    (q === 'kinh doanh' && household.type === 'business') ||
    (q === 'ho gia dinh' && household.type === 'household')
  );
}

/**
 * "lat, lng" typed or pasted into a map search (decimal degrees with a fractional part, so "12 3" stays a text search; comma, semicolon or space separated). A pair pasted the
 * other way round (lng, lat, as GIS tools copy it) is swapped when only that order is valid. Returns [lng, lat] or null.
 */
export function parseCoordinateQuery(query: string): [number, number] | null {
  const match = /^\s*(-?\d{1,3}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)\s*$/.exec(query);
  if (!match) return null;
  let [lat, lng] = [Number(match[1]), Number(match[2])];
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) [lat, lng] = [lng, lat];
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lng, lat];
}
