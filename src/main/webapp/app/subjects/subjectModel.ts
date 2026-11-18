import axios from 'axios';
import type { AppUser } from '../gis/types';
// Adds the selected hamlet to every /api/subjects request.
import '../roster/hamletScope';

export const SUBJECT_API = '/api/subjects';

/** Text of a primitive API value; objects are never shown. */
const str = (value: unknown) => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

export type SubjectCategory = 'AN' | 'CT' | 'HS' | 'MT' | 'TNXH' | 'NV';
export type RecordKind = 'TIEN_AN' | 'TIEN_SU' | 'VI_PHAM';
export type Row = Record<string, any>;

/** Categories in the officers' order, with the wording used on paper lists. */
export const CATEGORIES: { code: SubjectCategory; label: string; short: string }[] = [
  { code: 'AN', label: 'Đối tượng hệ an ninh', short: 'An ninh' },
  { code: 'CT', label: 'Đối tượng hệ chính trị', short: 'Chính trị' },
  { code: 'HS', label: 'Đối tượng hệ hình sự', short: 'Hình sự' },
  { code: 'MT', label: 'Đối tượng hệ ma túy', short: 'Ma túy' },
  { code: 'TNXH', label: 'Đối tượng tệ nạn xã hội', short: 'TNXH' },
  { code: 'NV', label: 'Đối tượng cần theo dõi, nghi vấn', short: 'Nghi vấn' },
];

export const categoryLabel = (code: unknown) => CATEGORIES.find(c => c.code === code)?.label ?? str(code);
export const categoryShort = (code: unknown) => CATEGORIES.find(c => c.code === code)?.short ?? str(code);

export const RECORD_KINDS: { code: RecordKind; label: string }[] = [
  { code: 'TIEN_AN', label: 'Tiền án' },
  { code: 'TIEN_SU', label: 'Tiền sự' },
  { code: 'VI_PHAM', label: 'Vi phạm' },
];
export const recordLabel = (code: unknown) => RECORD_KINDS.find(k => k.code === code)?.label ?? str(code);

/** Same rule as the server: the security and suspect categories record violations only. */
export const violationsOnly = (category: unknown) => category === 'AN' || category === 'NV';

export function subjectAccess(user?: Pick<AppUser, 'role' | 'subAdminPermissions'> | null) {
  const superadmin = user?.role === 'superadmin';
  const p = user?.subAdminPermissions;
  const manage = superadmin || p?.canManageSubjects === true;
  return {
    view: manage || p?.canViewSubjects === true,
    manage,
    political: superadmin || p?.canViewPoliticalSubjects === true,
  };
}

export const genderLabel = (code: unknown) => (code === 'MALE' ? 'Nam' : code === 'FEMALE' ? 'Nữ' : code === 'OTHER' ? 'Khác' : 'Chưa rõ');

export const displayDay = (value: unknown) => {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(value));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : str(value);
};

export const birthText = (row: Row) =>
  row.birth_date_precision === 'DAY' && row.birth_date ? displayDay(row.birth_date) : row.birth_year ? String(row.birth_year) : 'Chưa rõ';

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * The server's own Vietnamese reason from an error body. JHipster problem responses carry it in `detail`; `message` is then a
 * translation key such as "error.http.409", which must never reach the officer.
 */
export function problemText(data: unknown): string {
  const body = (data ?? {}) as Record<string, unknown>;
  const useful = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '' && !/^error\.[\w.]+$/.test(value);
  const text = [body.detail, body.message, body.title].find(useful) ?? '';
  // A ResponseStatusException reads `409 CONFLICT "reason"`: keep only the reason.
  return /^\d{3} [A-Z_]+ "([\s\S]*)"$/.exec(text)?.[1] ?? text;
}

export function errorText(e: unknown) {
  if (axios.isAxiosError(e)) {
    const message = problemText(e.response?.data);
    if (message) return message;
    if (e.response?.status === 403) return 'Chưa được cấp quyền cho thao tác này.';
    if (e.response?.status === 409) return 'Dữ liệu đã có hoặc đã được người khác sửa; tải lại rồi thử lại.';
  }
  return 'Không thể hoàn tất thao tác. Kiểm tra quyền và kết nối.';
}

export type SubjectSummary = {
  byCategory: Partial<Record<SubjectCategory, number>>;
  active: number;
  managementDue: number;
  summonDue: number;
  managementWarningDays: number;
  summonWarningDays: number;
  canManage: boolean;
  canViewPolitical: boolean;
};

export const fetchSummary = async () => (await axios.get<SubjectSummary>(`${SUBJECT_API}/summary`)).data;
export const fetchSubjects = async (params: Record<string, string | number>) =>
  (await axios.get<{ items: Row[]; total: number; page: number; pageSize: number }>(SUBJECT_API, { params })).data;
export const fetchSubject = async (id: string) => (await axios.get<Row>(`${SUBJECT_API}/${id}`)).data;
