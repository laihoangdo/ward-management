export interface IAreaZone {
  id?: number;
  communeId?: number;
  unitType?: string;
  nameNormalized?: string;
  fullName?: string;
  sortOrder?: number;
  validFrom?: string;
  validTo?: string;
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
