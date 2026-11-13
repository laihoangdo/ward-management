/** Filter model, quick presets and request parameters for the resident list export (`/api/roster/residents/export/*`). */

export type ExportFilter = {
  scope: '' | 'commune';
  search: string;
  kinds: string[];
  origin: string;
  campaign: string;
  status: '' | 'ACTIVE' | 'ENDED';
  expiringDays: '' | '7' | '15' | '30';
  registeredFrom: string;
  registeredTo: string;
  gender: '' | 'MALE' | 'FEMALE';
  ageMin: string;
  ageMax: string;
  refDate: string;
  birthYearFrom: string;
  birthYearTo: string;
  identity: '' | 'HAS' | 'NONE';
  householdRole: '' | 'HEAD' | 'MEMBER' | 'NONE';
  facilityTypes: string[];
  address: string;
  classification: string;
  sort: 'HOUSEHOLD' | 'NAME' | 'ADDRESS' | 'BIRTH';
};

export type ExportColumn = { key: string; header: string; width: number };

export type ExportOptions = {
  columns: ExportColumn[];
  defaultColumns: string[];
  classifications: string[];
  canExportCommune: boolean;
  canRevealIdentity: boolean;
  limit: number;
};

export type ExportResult = {
  commune: string;
  scope: string;
  summary: string;
  columns: ExportColumn[];
  rows: string[][];
  total: number;
  male: number;
  female: number;
  unevaluable: number | null;
  byHamlet: { hamlet: string; total: number; male: number; female: number }[];
  fullIdentity: boolean;
  communeWide: boolean;
  generatedBy: string;
  generatedAt: string;
};

export const emptyFilter = (): ExportFilter => ({
  scope: '',
  search: '',
  kinds: [],
  origin: '',
  campaign: '',
  status: 'ACTIVE',
  expiringDays: '',
  registeredFrom: '',
  registeredTo: '',
  gender: '',
  ageMin: '',
  ageMax: '',
  refDate: '',
  birthYearFrom: '',
  birthYearTo: '',
  identity: '',
  householdRole: '',
  facilityTypes: [],
  address: '',
  classification: '',
  sort: 'HOUSEHOLD',
});

export const residenceKinds: [string, string][] = [
  ['PERMANENT', 'Thường trú'],
  ['TEMPORARY', 'Tạm trú'],
  ['NOHT', 'Khai báo nơi ở hiện tại'],
  ['ARTICLE19', 'Nguồn Điều 19'],
];

export const facilityOptions: [string, string][] = [
  ['RESIDENTIAL', 'Hộ gia đình'],
  ['BUSINESS', 'Cơ sở kinh doanh'],
  ['BOARDING_HOUSE', 'Nhà trọ / cơ sở lưu trú'],
  ['RELIGIOUS', 'Cơ sở tôn giáo, tín ngưỡng'],
  ['SPECIAL', 'Hộ cần giám sát đặc biệt'],
];

export const sortOptions: [ExportFilter['sort'], string][] = [
  ['HOUSEHOLD', 'Theo hộ (chủ hộ trước)'],
  ['NAME', 'Theo tên'],
  ['ADDRESS', 'Theo địa chỉ'],
  ['BIRTH', 'Theo ngày sinh'],
];

export type Preset = { id: string; label: string; apply: (base: ExportFilter) => ExportFilter };

/** Quick presets for common commune/hamlet tasks; each starts from a clean filter but keeps the scope and sort. */
export const presets = (year = new Date().getFullYear()): Preset[] => {
  const fresh = (base: ExportFilter, patch: Partial<ExportFilter>): ExportFilter => ({
    ...emptyFilter(),
    scope: base.scope,
    sort: base.sort,
    ...patch,
  });
  const milestone = (age: number): Preset => ({
    id: `id${age}`,
    label: `Đủ ${age} tuổi năm ${year} (cấp đổi căn cước)`,
    apply: base => fresh(base, { birthYearFrom: String(year - age), birthYearTo: String(year - age) }),
  });
  return [
    {
      id: 'military',
      label: 'Nam thường trú 18–27 tuổi (nghĩa vụ quân sự)',
      apply: base => fresh(base, { gender: 'MALE', kinds: ['PERMANENT'], ageMin: '18', ageMax: '27' }),
    },
    { id: 'under6', label: 'Trẻ dưới 6 tuổi', apply: base => fresh(base, { ageMax: '5' }) },
    { id: 'child6to14', label: 'Trẻ từ 6 đến dưới 14 tuổi', apply: base => fresh(base, { ageMin: '6', ageMax: '13' }) },
    milestone(14),
    milestone(25),
    milestone(40),
    milestone(60),
    { id: 'elderly60', label: 'Người cao tuổi (từ 60 tuổi)', apply: base => fresh(base, { ageMin: '60' }) },
    { id: 'elderly80', label: 'Người từ 80 tuổi', apply: base => fresh(base, { ageMin: '80' }) },
    {
      id: 'tempExpiring',
      label: 'Tạm trú hết hạn trong 15 ngày',
      apply: base => fresh(base, { kinds: ['TEMPORARY'], expiringDays: '15' }),
    },
    { id: 'temporary', label: 'Người đang tạm trú', apply: base => fresh(base, { kinds: ['TEMPORARY'] }) },
    { id: 'boarding', label: 'Người ở nhà trọ / cơ sở lưu trú', apply: base => fresh(base, { facilityTypes: ['BOARDING_HOUSE'] }) },
    { id: 'heads', label: 'Danh sách chủ hộ', apply: base => fresh(base, { householdRole: 'HEAD' }) },
    { id: 'noIdentity', label: 'Chưa có giấy tờ định danh', apply: base => fresh(base, { identity: 'NONE' }) },
  ];
};

/** Request parameters; empty values are left out so the server applies its defaults. */
export const toParams = (filter: ExportFilter, columns: string[] = [], fullIdentity = false): Record<string, string> => {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filter)) {
    const text = Array.isArray(value) ? value.join(',') : String(value).trim();
    if (text !== '') params[key] = text;
  }
  if (columns.length > 0) params.columns = columns.join(',');
  if (fullIdentity) params.fullIdentity = 'true';
  return params;
};

/** Number of filter fields that differ from a clean filter (scope and sort are not filters). */
export const activeFilterCount = (filter: ExportFilter): number => {
  const clean = emptyFilter();
  return (Object.keys(filter) as (keyof ExportFilter)[]).filter(key => {
    if (key === 'scope' || key === 'sort') return false;
    return JSON.stringify(filter[key]) !== JSON.stringify(clean[key]);
  }).length;
};

const SAVED_KEY = 'resident_export_presets_v1';

export type SavedPreset = { name: string; filter: ExportFilter; columns: string[] };

/** The viewer's own presets, kept only in this browser. */
export const loadSavedPresets = (): SavedPreset[] => {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((p): p is SavedPreset => typeof p?.name === 'string' && typeof p?.filter === 'object' && Array.isArray(p?.columns))
      .map(p => ({ ...p, filter: { ...emptyFilter(), ...p.filter } }));
  } catch {
    return [];
  }
};

export const storeSavedPresets = (list: SavedPreset[]): boolean => {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 20)));
    return true;
  } catch {
    return false;
  }
};
