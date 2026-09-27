import { HouseholdFacility } from '../types';

export const DEFAULT_CENTER_COORDS: [number, number] = [10.854, 106.612];

export const normalizeHousehold = (h: any, index: number = 0): HouseholdFacility => {
  if (!h) {
    return {
      id: `hh-${Date.now()}-${index}`,
      code: `HK-BD-${String(index + 1).padStart(3, '0')}`,
      houseNumber: `${index + 1}`,
      street: 'Đường Phan Văn Hớn',
      hamlet: 'Ấp Bắc Lân',
      ownerName: 'Chưa cập nhật',
      ownerPhone: '',
      type: 'household',
      residentsCount: 3,
      maleCount: 2,
      femaleCount: 1,
      under18Count: 1,
      above18Count: 2,
      status: 'normal',
      coordinates: DEFAULT_CENTER_COORDS,
      gridPosition: { row: Math.floor(index / 10), col: index % 10 },
      notes: 'Hộ dân cư trú ổn định tại Xã Bà Điểm.',
      lastCheckedDate: new Date().toLocaleDateString('vi-VN'),
      officerInCharge: 'Cán bộ khu vực',
    };
  }

  // 1. Resolve coordinates
  let lat = 10.854;
  let lng = 106.612;

  if (Array.isArray(h.coordinates) && h.coordinates.length >= 2) {
    const pLat = Number(h.coordinates[0]);
    const pLng = Number(h.coordinates[1]);
    if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
      lat = pLat;
      lng = pLng;
    }
  } else if (h.latitude !== undefined && h.longitude !== undefined) {
    const pLat = Number(h.latitude);
    const pLng = Number(h.longitude);
    if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
      lat = pLat;
      lng = pLng;
    }
  }

  // 2. Resolve gridPosition
  const gridPosition =
    h.gridPosition && typeof h.gridPosition.row === 'number' && typeof h.gridPosition.col === 'number'
      ? h.gridPosition
      : { row: Math.floor(index / 10), col: index % 10 };

  return {
    ...h,
    id: String(h.id ?? `hh-${index}`),
    code: h.code || h.householdNumber || `HK-BD-${String(index + 1).padStart(3, '0')}`,
    houseNumber: String(h.houseNumber ?? `${index + 1}`),
    street: h.street || 'Đường Phan Văn Hớn',
    hamlet: h.hamlet || 'Ấp Bắc Lân',
    neighborhoodGroup: h.neighborhoodGroup || 'Tổ 1',
    alley: h.alley || 'Mặt tiền đường',
    ownerName: h.ownerName || h.headName || 'Chưa cập nhật',
    ownerPhone: h.ownerPhone || '',
    type: h.type || 'household',
    residentsCount: Number(h.residentsCount || h.actualResidentsCount || 3),
    maleCount: Number(h.maleCount || 2),
    femaleCount: Number(h.femaleCount || 1),
    under18Count: Number(h.under18Count || 1),
    above18Count: Number(h.above18Count || 2),
    status: h.status || 'normal',
    coordinates: [lat, lng],
    gridPosition,
    notes: h.notes || 'Hộ dân cư trú ổn định tại Xã Bà Điểm.',
    lastCheckedDate: h.lastCheckedDate || new Date().toLocaleDateString('vi-VN'),
    officerInCharge: h.officerInCharge || 'Cán bộ CSKV Xã Bà Điểm',
    residentsList: Array.isArray(h.residentsList) ? h.residentsList : [],
    inspectionPhotos: Array.isArray(h.inspectionPhotos) ? h.inspectionPhotos : [],
  };
};

export const normalizeHouseholdList = (list: any[]): HouseholdFacility[] => {
  if (!Array.isArray(list)) return [];
  return list.map((item, idx) => normalizeHousehold(item, idx));
};
