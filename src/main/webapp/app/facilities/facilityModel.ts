import axios from 'axios';
// Adds the selected hamlet to every /api/facilities request.
import '../roster/hamletScope';

export const FACILITY_API = '/api/facilities';
export type Row = Record<string, any>;

export const FACILITY_TYPES: [string, string][] = [
  ['BUSINESS', 'Cơ sở kinh doanh'],
  ['BOARDING_HOUSE', 'Nhà trọ / cơ sở lưu trú'],
  ['ENTERPRISE', 'Doanh nghiệp'],
  ['RELIGIOUS', 'Cơ sở tôn giáo, tín ngưỡng'],
];
export const LICENSE_TYPES: [string, string][] = [
  ['BUSINESS_REGISTRATION', 'Giấy chứng nhận đăng ký kinh doanh'],
  ['SECURITY_CONDITION', 'Giấy chứng nhận đủ điều kiện về ANTT'],
  ['FIRE_SAFETY', 'Giấy chứng nhận / thẩm duyệt PCCC'],
  ['OTHER', 'Giấy phép khác'],
];
export const GROUPS: { code: '' | 'CONDITIONAL' | 'OTHER'; label: string }[] = [
  { code: 'CONDITIONAL', label: 'CSKD có điều kiện' },
  { code: 'OTHER', label: 'Cơ sở, DN địa bàn' },
  { code: '', label: 'Tất cả' },
];

const str = (value: unknown) => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
export const typeLabel = (code: unknown) => FACILITY_TYPES.find(([c]) => c === code)?.[1] ?? str(code);
export const licenseLabel = (code: unknown) => LICENSE_TYPES.find(([c]) => c === code)?.[1] ?? str(code);

export type FacilitySummary = {
  conditional: number;
  other: number;
  license_due: number;
  byType: Record<string, number>;
  licenseWarningDays: number;
  canManage: boolean;
  canEditHousehold: boolean;
};

export const fetchFacilitySummary = async () => (await axios.get<FacilitySummary>(`${FACILITY_API}/summary`)).data;
export const fetchFacilities = async (params: Record<string, string | number>) =>
  (await axios.get<{ items: Row[]; total: number; page: number; pageSize: number }>(FACILITY_API, { params })).data;
export const fetchFacility = async (id: string) => (await axios.get<Row>(`${FACILITY_API}/${id}`)).data;
