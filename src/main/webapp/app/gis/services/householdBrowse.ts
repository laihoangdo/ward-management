import axios from 'axios';
import { HouseholdFacility, ResidenceType } from '../types';
import { IHousehold } from 'app/shared/model/household.model';
import { IResident } from 'app/shared/model/resident.model';
import { mapDtoToHousehold, mapResidentDtoToResident } from './householdApiService';
import { fetchInspectionPhotos } from './inspectionPhotos';

const residences: Record<string, ResidenceType> = {
  permanent: 'Thường trú',
  temporary: 'Tạm trú',
  stay: 'Lưu trú',
  unknown: 'Chưa xác minh',
};
export interface HouseholdBrowsePage {
  items: HouseholdFacility[];
  total: number;
  page: number;
  scopeTotal: number;
  hamlets: Record<string, number>;
  residenceCounts: Record<string, number>;
}
export async function browseHouseholds(
  query: { page: number; size: number; search: string; hamlet: string; type: string; residence: string },
  signal: AbortSignal,
): Promise<HouseholdBrowsePage> {
  const { data } = await axios.get<Omit<HouseholdBrowsePage, 'items'> & { items: { household: IHousehold; residence: string }[] }>(
    '/api/gis/households/browse',
    {
      params: { ...query, residence: Object.entries(residences).find(([, label]) => label === query.residence)?.[0] ?? query.residence },
      signal,
    },
  );
  if (!Array.isArray(data.items) || !Number.isFinite(data.total)) throw Error('Dữ liệu phân trang không hợp lệ.');
  return { ...data, items: data.items.map(item => ({ ...mapDtoToHousehold(item.household), residenceType: residences[item.residence] })) };
}

/** Never open the editable modal with a list summary's empty roster. */
export async function loadHouseholdDetail(id: string, signal: AbortSignal): Promise<HouseholdFacility> {
  const { data } = await axios.get<IHousehold>(`/api/households/${id}`, { signal });
  const residents: IResident[] = [];
  for (let page = 0; ; page++) {
    const response = await axios.get<IResident[]>('/api/residents', {
      params: { 'householdId.equals': Number(id), page, size: 500, sort: 'id,asc' },
      signal,
    });
    if (!Array.isArray(response.data)) throw Error('Dữ liệu nhân khẩu không hợp lệ.');
    residents.push(...response.data);
    if (response.data.length < 500) break;
  }
  const result = mapDtoToHousehold(data);
  try {
    result.inspectionPhotos = await fetchInspectionPhotos(id, signal);
  } catch (error) {
    if (signal.aborted) throw error;
    result.inspectionPhotosError = 'Chưa tải được danh sách ảnh từ máy chủ. Đây không phải xác nhận hộ chưa có ảnh.';
  }
  result.residentsList = residents.map(mapResidentDtoToResident);
  if (residents.length) {
    result.residentsCount = residents.length;
    result.maleCount = result.residentsList.filter(r => r.gender === 'Nam').length;
    result.femaleCount = result.residentsList.filter(r => r.gender === 'Nữ').length;
    result.under18Count = result.residentsList.filter(
      r => typeof r.birthYear === 'number' && new Date().getFullYear() - r.birthYear < 18,
    ).length;
    result.above18Count = result.residentsList.filter(
      r => typeof r.birthYear === 'number' && new Date().getFullYear() - r.birthYear >= 18,
    ).length;
  }
  return result;
}
