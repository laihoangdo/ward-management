import dayjs from 'dayjs';

import { AlertSeverity } from 'app/shared/model/enumerations/alert-severity.model';

export interface ISecurityAlert {
  id?: number;
  alertType?: string;
  severity?: keyof typeof AlertSeverity;
  title?: string;
  description?: string | null;
  location?: string | null;
  isResolved?: boolean | null;
  reportedAt?: dayjs.Dayjs | null;
  resolvedAt?: dayjs.Dayjs | null;
}

export const defaultValue: Readonly<ISecurityAlert> = {
  isResolved: false,
};
