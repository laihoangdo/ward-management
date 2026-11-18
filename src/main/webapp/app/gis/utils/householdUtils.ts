import { HouseholdFacility } from '../types';

// Viewport fallback only, never a confirmed household position.
export const DEFAULT_CENTER_COORDS: [number, number] = [10.854, 106.612];
const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0);

export const normalizeHousehold = (h: any, index = 0): HouseholdFacility => {
  if (!h || h.id == null) throw new Error('Hồ sơ hộ không có ID từ máy chủ.');
  const raw = Array.isArray(h.coordinates) ? h.coordinates : [h.latitude, h.longitude];
  const valid = raw.length >= 2 && raw.every((v: unknown) => typeof v === 'number' && Number.isFinite(v) && v !== 0);
  return {
    ...h,
    id: String(h.id),
    code: h.code || h.householdNumber || '',
    houseNumber: String(h.houseNumber ?? ''),
    street: h.street || '',
    hamlet: h.hamlet || '',
    neighborhoodGroup: h.neighborhoodGroup || '',
    alley: h.alley || '',
    ownerName: h.ownerName || h.headName || '',
    ownerPhone: h.ownerPhone || '',
    type: h.type || 'household',
    residentsCount: count(h.residentsCount ?? h.actualResidentsCount),
    maleCount: count(h.maleCount),
    femaleCount: count(h.femaleCount),
    under18Count: count(h.under18Count),
    above18Count: count(h.above18Count),
    status: h.status || 'unverified',
    coordinates: valid ? [raw[0], raw[1]] : DEFAULT_CENTER_COORDS,
    coordinatesEstimated: h.coordinatesEstimated === true || !valid,
    gridPosition: h.gridPosition ?? { row: Math.floor(index / 10), col: index % 10 },
    notes: h.notes || '',
    lastCheckedDate: h.lastCheckedDate || '',
    officerInCharge: h.officerInCharge || '',
    residentsList: Array.isArray(h.residentsList) ? h.residentsList : [],
    inspectionPhotos: Array.isArray(h.inspectionPhotos) ? h.inspectionPhotos : [],
  };
};

export const normalizeHouseholdList = (list: unknown): HouseholdFacility[] => {
  if (!Array.isArray(list)) throw new Error('Danh sách hộ từ máy chủ không hợp lệ.');
  return list.filter(item => item && item.id != null).map(normalizeHousehold);
};
