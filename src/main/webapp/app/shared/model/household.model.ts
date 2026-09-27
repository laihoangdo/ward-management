import { IAreaZone } from 'app/shared/model/area-zone.model';
import { FacilityType } from 'app/shared/model/enumerations/facility-type.model';
import { SecurityStatus } from 'app/shared/model/enumerations/security-status.model';

export interface IHousehold {
  id?: number;
  code?: string;
  houseNumber?: string;
  street?: string;
  hamlet?: string;
  neighborhoodGroup?: string | null;
  alley?: string | null;
  ownerName?: string;
  ownerPhone?: string;
  type?: keyof typeof FacilityType;
  businessName?: string | null;
  businessCategory?: string | null;
  residentsCount?: number | null;
  maleCount?: number | null;
  femaleCount?: number | null;
  under18Count?: number | null;
  above18Count?: number | null;
  status?: keyof typeof SecurityStatus | null;
  warningMessage?: string | null;
  licenseExpiry?: string | null;
  licenseType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  lastCheckedDate?: string | null;
  officerInCharge?: string | null;
  areaZone?: IAreaZone | null;
}

export const defaultValue: Readonly<IHousehold> = {};
