import { HouseholdFacility } from '../types';

/** What a building's colour stands for. 'status' is the default and keeps the household status colours. */
export type BuildingTheme = 'status' | 'residents' | 'occupancy' | 'recency';

export const BUILDING_THEMES: Record<BuildingTheme, string> = {
  status: 'Trạng thái hộ',
  residents: 'Số nhân khẩu',
  occupancy: 'Có hộ / chưa có hộ',
  recency: 'Lần kiểm tra gần nhất',
};

export interface ThemeLegendItem {
  color: string;
  label: string;
}

const DAY = 86_400_000;
/** One hue, light to dark: more residents reads as "more" without a second colour meaning. */
export const RESIDENT_SCALE: ThemeLegendItem[] = [
  { color: '#bbf7d0', label: '1–2 nhân khẩu' },
  { color: '#6ee7b7', label: '3–4' },
  { color: '#10b981', label: '5–7' },
  { color: '#047857', label: '8–12' },
  { color: '#064e3b', label: 'Từ 13' },
];
const RESIDENT_LIMITS = [2, 4, 7, 12];
export const RECENCY_SCALE: ThemeLegendItem[] = [
  { color: '#10b981', label: 'Trong 3 tháng' },
  { color: '#f59e0b', label: '3–12 tháng' },
  { color: '#ef4444', label: 'Trên 12 tháng' },
  { color: '#94a3b8', label: 'Chưa rõ ngày' },
];
export const OCCUPANCY_SCALE: ThemeLegendItem[] = [
  { color: '#10b981', label: 'Có hộ dân' },
  { color: '#94a3b8', label: 'Chưa có hộ' },
];

/** Accepts the two formats in use: dd/MM/yyyy (vi-VN) and ISO yyyy-MM-dd[...]. Anything else is unknown. */
export function parseCheckedDate(value: string | undefined | null): number {
  const text = (value ?? '').trim();
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  const parts = local ? [local[3], local[2], local[1]] : iso ? [iso[1], iso[2], iso[3]] : null;
  if (!parts) return Number.NaN;
  const [year, month, day] = parts.map(Number);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? time : Number.NaN;
}

/** Bucket index into RESIDENT_SCALE, or -1 for a building without households. */
export function residentBucket(households: HouseholdFacility[]): number {
  if (!households.length) return -1;
  const total = households.reduce((sum, household) => sum + (household.residentsCount || 0), 0);
  const index = RESIDENT_LIMITS.findIndex(limit => total <= limit);
  return index === -1 ? RESIDENT_LIMITS.length : index;
}

/** Bucket index into RECENCY_SCALE by the household checked longest ago, or -1 without households. */
export function recencyBucket(households: HouseholdFacility[], now: number): number {
  if (!households.length) return -1;
  let oldest = Number.POSITIVE_INFINITY;
  for (const household of households) {
    const time = parseCheckedDate(household.lastCheckedDate);
    if (Number.isNaN(time)) return 3;
    oldest = Math.min(oldest, time);
  }
  const days = (now - oldest) / DAY;
  return days <= 90 ? 0 : days <= 365 ? 1 : 2;
}

/** Colour for the non-status themes; undefined keeps the building's own appearance. */
export function themeColor(theme: Exclude<BuildingTheme, 'status'>, households: HouseholdFacility[], now: number): string | undefined {
  if (theme === 'occupancy') return OCCUPANCY_SCALE[households.length ? 0 : 1].color;
  if (theme === 'residents') return RESIDENT_SCALE[residentBucket(households)]?.color;
  return RECENCY_SCALE[recencyBucket(households, now)]?.color;
}
