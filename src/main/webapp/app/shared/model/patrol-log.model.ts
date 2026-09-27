import dayjs from 'dayjs';

export interface IPatrolLog {
  id?: number;
  action?: string;
  target?: string | null;
  details?: string | null;
  officerName?: string;
  badgeNumber?: string | null;
  ipAddress?: string | null;
  timestamp?: dayjs.Dayjs;
}

export const defaultValue: Readonly<IPatrolLog> = {};
