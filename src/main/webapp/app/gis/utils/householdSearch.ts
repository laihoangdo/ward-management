import { HouseholdFacility } from '../types';
import { getHouseholdResidenceType } from './residenceUtils';

export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function matchesHouseholdSearch(household: HouseholdFacility, query: string) {
  const q = normalizeSearch(query);
  if (!q) return true;
  const fields = [
    household.ownerName,
    household.houseNumber,
    household.street,
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
