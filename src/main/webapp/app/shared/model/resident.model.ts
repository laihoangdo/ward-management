import dayjs from 'dayjs';

import { Gender } from 'app/shared/model/enumerations/gender.model';
import { ResidenceType } from 'app/shared/model/enumerations/residence-type.model';
import { IHousehold } from 'app/shared/model/household.model';

export interface IResident {
  id?: number;
  fullName?: string;
  idCardNumber?: string | null;
  birthYear?: number | null;
  gender?: keyof typeof Gender | null;
  relationship?: string | null;
  residenceType?: keyof typeof ResidenceType;
  temporaryRegisteredAt?: dayjs.Dayjs | null;
  notes?: string | null;
  household?: IHousehold | null;
}

export const defaultValue: Readonly<IResident> = {};
