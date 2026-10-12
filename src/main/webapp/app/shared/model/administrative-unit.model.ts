export interface IHamlet {
  id: number;
  code: string;
  name: string;
  unitType: string;
  fullName: string;
  communeId: number;
  sortOrder?: number;
}

export interface IAdminCommune {
  id: number;
  code: string;
  name: string;
  unitType: string;
  fullName: string;
  provinceId: number;
  areaKm2?: number;
  population?: number;
  hamletCount?: number;
  hqAddress?: string;
  policeHqAddress?: string;
  website?: string;
}

export interface IStandardHouseholdAddress {
  householdId: number;
  householdCode: string;
  houseNumber: string;
  street: string;
  alley?: string;
  neighborhoodGroup?: string;
  legacyAddress?: string;
  hamletId: number;
  hamletName: string;
  hamletFullName: string;
  communeId: number;
  communeFullName: string;
  provinceId: number;
  provinceFullName: string;
  fullAddressStandard: string;
}
