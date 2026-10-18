import axios from 'axios';
import { IHousehold } from 'app/shared/model/household.model';
import { mapDtoToHousehold } from './householdApiService';
import { HouseholdFacility } from '../types';

export interface OverviewScope {
  total: number;
  residents: number;
  warnings: number;
}
export interface OverviewSummary extends OverviewScope {
  business: number;
  male: number;
  female: number;
  under18: number;
  above18: number;
  fallbackHouseholds: number;
  hamlets: string[];
  scope: OverviewScope;
  warningPage: number;
  warningItems: HouseholdFacility[];
  attentionItems: HouseholdFacility[];
  previewItems: HouseholdFacility[];
}
export async function fetchOverviewSummary(search: string, warningPage: number, warningSize: number, signal: AbortSignal) {
  const { data } = await axios.get<
    Omit<OverviewSummary, 'warningItems' | 'attentionItems' | 'previewItems'> & {
      warningItems: IHousehold[];
      attentionItems: IHousehold[];
      previewItems: IHousehold[];
    }
  >('/api/gis/households/overview', { params: { search, warningPage, warningSize }, signal });
  if (
    !data ||
    !Array.isArray(data.warningItems) ||
    !Array.isArray(data.attentionItems) ||
    !Array.isArray(data.previewItems) ||
    !Array.isArray(data.hamlets) ||
    ![
      data.total,
      data.business,
      data.warnings,
      data.residents,
      data.male,
      data.female,
      data.under18,
      data.above18,
      data.scope?.total,
      data.scope?.residents,
      data.scope?.warnings,
      data.warningPage,
    ].every(Number.isFinite)
  )
    throw Error('Dữ liệu tổng quan không hợp lệ.');
  return {
    ...data,
    warningItems: data.warningItems.map(mapDtoToHousehold),
    attentionItems: data.attentionItems.map(mapDtoToHousehold),
    previewItems: data.previewItems.map(mapDtoToHousehold),
  } satisfies OverviewSummary;
}
