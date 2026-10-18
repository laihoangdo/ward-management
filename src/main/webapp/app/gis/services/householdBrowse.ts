import axios from 'axios';
import { HouseholdFacility, ResidenceType } from '../types';
import { IHousehold } from 'app/shared/model/household.model';
import { IResident } from 'app/shared/model/resident.model';
import { mapDtoToHousehold, mapResidentDtoToResident } from './householdApiService';

const residences: Record<string, ResidenceType> = { permanent: 'Thường trú', temporary: 'Tạm trú', stay: 'Lưu trú' };
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
  result.residentsList = residents.map(mapResidentDtoToResident);
  if (residents.length) {
    result.residentsCount = residents.length;
    result.maleCount = result.residentsList.filter(r => r.gender === 'Nam').length;
    result.femaleCount = residents.length - result.maleCount;
    result.under18Count = result.residentsList.filter(r => 2026 - r.birthYear < 18).length;
    result.above18Count = residents.length - result.under18Count;
  }
  return result;
}
