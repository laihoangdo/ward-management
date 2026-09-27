export interface IAreaZone {
  id?: number;
  code?: string;
  name?: string;
  hamletName?: string;
  officerInCharge?: string | null;
  officerPhone?: string | null;
  populationCount?: number | null;
  householdCount?: number | null;
  boundaryGeoJson?: string | null;
}

export const defaultValue: Readonly<IAreaZone> = {};
