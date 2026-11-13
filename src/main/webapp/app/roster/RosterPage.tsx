import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router';
import { useRouteQuery, RECORD_QUERY_KEYS } from '../gis/utils/useRouteQuery';
import './roster.css';
import { displayDate } from './dateDisplay';
import { House, Printer, Users } from 'lucide-react';
import RosterMapPane from './RosterMapPane';
import RosterPatrol from './RosterPatrol';
import HouseholdSplitDialog from './HouseholdSplitDialog';
import ResidentExportDialog from './ResidentExportDialog';
import { fetchRbacMe } from '../gis/services/rbacApiService';
import type { AppUser } from '../gis/types';

type Row = Record<string, any>;
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[][];
  required?: boolean;
  /** Shown (and validated) only while this returns true for the current form values. */
  showWhen?: (data: Row) => boolean;
};
const api = '/api/roster';
const HAMLET_STORAGE_KEY = 'roster_hamlet_v1';
// Hamlet chosen in the selector; empty means the server picks the user's default hamlet.
let activeHamlet = '';
try {
  const saved = window.sessionStorage.getItem(HAMLET_STORAGE_KEY);
  if (saved && /^d+$/.test(saved)) activeHamlet = saved;
} catch {
  /* session storage may be unavailable; the server default applies */
}
const hamletParam = () => (activeHamlet ? `&hamletId=${encodeURIComponent(activeHamlet)}` : '');
// Every roster request carries the selected hamlet; the backend re-checks the user's territory scope.
axios.interceptors?.request.use(config => {
  if (activeHamlet && typeof config.url === 'string' && config.url.startsWith(api)) {
    config.params = { ...config.params, hamletId: activeHamlet };
  }
  return config;
});
const text = (v: unknown): string =>
  v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? `${v}` : JSON.stringify(v);
const kinds = [
  ['PERMANENT', 'Thường trú'],
  ['TEMPORARY', 'Tạm trú'],
  ['NOHT', 'Khai báo nơi ở hiện tại'],
  ['ARTICLE19', 'Nguồn Đ19'],
];
const campaigns = [
  ['MILITARY', 'Nghĩa vụ quân sự (nam 18–27, thường trú)'],
  ['ID_UNDER_6', 'Căn cước: dưới 6 tuổi'],
  ['ID_6_TO_14', 'Căn cước: từ 6 đến dưới 14 tuổi'],
  ['ID_AGE_14', 'Căn cước: đủ 14 tuổi trong năm'],
  ['ID_AGE_25', 'Căn cước: đủ 25 tuổi trong năm'],
  ['ID_AGE_40', 'Căn cước: đủ 40 tuổi trong năm'],
  ['ID_AGE_60', 'Căn cước: đủ 60 tuổi trong năm'],
  ['ELDERLY_80', 'Người cao tuổi từ 80 tuổi'],
  ['TEMP_EXPIRING', 'Tạm trú hết hạn trong 15 ngày'],
];
const personFields: Field[] = [
  { key: 'fullName', label: 'Họ và tên', required: true },
  {
    key: 'birthPrecision',
    label: 'Thông tin ngày sinh',
    options: [
      ['UNKNOWN', 'Chưa rõ'],
      ['YEAR', 'Chỉ biết năm'],
      ['DAY', 'Đủ ngày tháng năm'],
    ],
  },
  { key: 'birthDate', label: 'Ngày sinh (khi biết đầy đủ)', type: 'date' },
  { key: 'birthYear', label: 'Năm sinh (khi chỉ biết năm)', type: 'number' },
  {
    key: 'gender',
    label: 'Giới tính',
    options: [
      ['', 'Chưa rõ'],
      ['MALE', 'Nam'],
      ['FEMALE', 'Nữ'],
      ['OTHER', 'Khác'],
    ],
  },
  { key: 'fatherName', label: 'Họ tên cha' },
  { key: 'motherName', label: 'Họ tên mẹ' },
];
// Same codes as the server's FacilityType; establishments carry a name, trade and licence.
const facilityTypes: string[][] = [
  ['RESIDENTIAL', 'Hộ gia đình'],
  ['BUSINESS', 'Cơ sở kinh doanh'],
  ['BOARDING_HOUSE', 'Nhà trọ / cơ sở lưu trú'],
  ['RELIGIOUS', 'Cơ sở tôn giáo, tín ngưỡng'],
  ['SPECIAL', 'Hộ cần giám sát đặc biệt'],
];
const licenseTypes: string[][] = [
  ['', 'Chưa có / chưa rõ'],
  ['BUSINESS_REGISTRATION', 'Giấy chứng nhận đăng ký kinh doanh'],
  ['SECURITY_CONDITION', 'Giấy chứng nhận đủ điều kiện về ANTT'],
  ['FIRE_SAFETY', 'Giấy chứng nhận / thẩm duyệt PCCC'],
  ['OTHER', 'Giấy phép khác'],
];
const isEstablishment = (d: Row) => ['BUSINESS', 'BOARDING_HOUSE', 'RELIGIOUS'].includes(text(d.facilityType));
const householdFields: Field[] = [
  { key: 'rawAddress', label: 'Địa chỉ nguyên bản', required: true },
  { key: 'representative', label: 'Tên chủ hộ / người đại diện theo nguồn' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'facilityType', label: 'Loại hình cơ sở', options: facilityTypes },
  { key: 'businessName', label: 'Tên cơ sở (biển hiệu)', required: true, showWhen: isEstablishment },
  { key: 'businessCategory', label: 'Ngành nghề kinh doanh / hoạt động', showWhen: isEstablishment },
  { key: 'licenseType', label: 'Loại giấy phép', options: licenseTypes, showWhen: isEstablishment },
  { key: 'licenseNumber', label: 'Số giấy phép', showWhen: d => isEstablishment(d) && Boolean(text(d.licenseType)) },
  {
    key: 'licenseExpiry',
    label: 'Ngày hết hạn giấy phép',
    type: 'date',
    showWhen: d => isEstablishment(d) && Boolean(text(d.licenseType)),
  },
];
const facilityLabel = (code: unknown) => facilityTypes.find(([value]) => value === code)?.[1] ?? 'Hộ gia đình';
const licenseLabel = (code: unknown) => licenseTypes.find(([value]) => value === code)?.[1] ?? text(code);
const recordFields: Field[] = [
  { key: 'kind', label: 'Loại hồ sơ', options: [['', 'Chọn loại hồ sơ'], ...kinds], required: true },
  { key: 'registrationDate', label: 'Ngày đăng ký', type: 'date' },
  { key: 'validFrom', label: 'Ngày bắt đầu hiệu lực (nếu biết)', type: 'date' },
  { key: 'validTo', label: 'Ngày kết thúc / hết hạn', type: 'date' },
  { key: 'permanentAddress', label: 'Nơi thường trú' },
  { key: 'temporaryAddress', label: 'Nơi tạm trú' },
  { key: 'currentAddress', label: 'Nơi ở hiện tại' },
  {
    key: 'presence',
    label: 'Thực tế cư trú',
    options: [
      ['UNKNOWN', 'Chưa xác minh'],
      ['PRESENT', 'Đang cư trú'],
      ['ABSENT', 'Không cư trú'],
    ],
  },
];
const dateToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const labels: Record<string, string> = {
  READY: 'Sẵn sàng',
  REVIEW: 'Chờ đối soát',
  APPLIED: 'Đã áp dụng',
  EXCLUDED: 'Không nhập nghiệp vụ',
  STAGED: 'Đã lưu nguồn',
  INSERT: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Gỡ liên kết / kết thúc',
  BASELINE_IMPORT: 'Nhập dữ liệu nguồn',
  CORRECTION: 'Sửa / bổ sung dữ liệu',
  HOUSEHOLD_CREATED: 'Tạo hộ',
  MEMBER_ADDED: 'Thêm thành viên',
  MEMBERSHIP_CHANGE: 'Đổi quan hệ hộ',
  RENEWAL: 'Gia hạn',
  RESIDENCE_ENDED: 'Kết thúc hồ sơ cư trú',
  RESIDENCE_ADDED: 'Thêm hồ sơ cư trú',
  RESIDENT_CREATED: 'Thêm nhân khẩu',
  MEMBER_TRANSFER: 'Chuyển hộ',
  IDENTITY_UPDATE: 'Bổ sung / đối soát giấy tờ',
  VERIFICATION: 'Xác minh thực tế',
  household: 'Hộ',
  resident: 'Cá nhân',
  residence_record: 'Hồ sơ cư trú',
  household_membership: 'Thành viên hộ',
  resident_identity: 'Giấy tờ',
  residence_verification: 'Xác minh',
  residence_record_address: 'Địa chỉ hồ sơ',
};

/** Plain wording for where a household sits on the map (tc2_roster.household.coordinate_method). */
const coordinateLabel = (method: unknown) =>
  method === 'RANDOM_WITHIN_TC2'
    ? 'tạm đặt trong địa bàn Trung Chánh 2, chưa xác minh tại thực địa'
    : method === 'VERIFIED'
      ? 'đã xác minh'
      : 'chưa có vị trí';
const caseSuffix = (caseNumber?: string | null) => (caseNumber ? ` · HSCT ${caseNumber}` : '');
/** Officers recognise a household by its address; the code is the fallback. */
const householdTitle = (h: Row) => (h.raw_address as string) || (h.code as string);

function Editor({
  title,
  fields,
  initial,
  onSave,
  onClose,
  readOnly = false,
}: {
  title: string;
  fields: Field[];
  initial: Row;
  onSave: (row: Row) => Promise<void>;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const [data, setData] = useState<Row>(() => {
    const d = { requestId: crypto.randomUUID(), ...initial };
    fields.forEach(f => {
      if (d[f.key] == null) d[f.key] = f.options?.[0]?.[0] ?? '';
    });
    return d;
  });
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Required fields left empty on "continue"; shown as a summary plus a message under each field.
  const [missing, setMissing] = useState<string[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);
  const visible = (f: Field) => !f.showWhen || f.showWhen(data);
  const shown = fields.filter(visible);
  const isMissing = (f: Field) => visible(f) && f.required && f.type !== 'checkbox' && !text(data[f.key]).trim();
  const change = (key: string, value: unknown) => {
    setData({ ...data, [key]: value });
    if (missing.includes(key)) setMissing(missing.filter(k => k !== key));
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave(data);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="roster-overlay">
      <section role="dialog" aria-modal="true" aria-label={title} className="roster-dialog">
        <h2>{title}</h2>
        <p>Địa bàn quản lý: ấp đang chọn. Bỏ trống thông tin chưa biết; vị trí hộ được tạo tạm trong ranh TC2.</p>
        {error && (
          <div role="alert" className="roster-error">
            {error}
          </div>
        )}
        <form
          noValidate
          onSubmit={e => {
            e.preventDefault();
            const empty = fields.filter(isMissing).map(f => f.key);
            setMissing(empty);
            if (empty.length) {
              requestAnimationFrame(() => summaryRef.current?.focus());
              return;
            }
            setReview(true);
          }}
        >
          {missing.length > 0 && !review && (
            <div ref={summaryRef} tabIndex={-1} role="alert" className="roster-error roster-error-summary">
              <strong>Còn {missing.length} thông tin bắt buộc chưa nhập:</strong>
              <ul>
                {fields
                  .filter(f => missing.includes(f.key))
                  .map(f => (
                    <li key={f.key}>{f.label}</li>
                  ))}
              </ul>
            </div>
          )}
          {!review ? (
            <div className="roster-fields">
              {shown.map(f => (
                <div key={f.key} className="roster-field">
                  <label>
                    {f.label}
                    {f.required && ' *'}
                    {f.options ? (
                      <select
                        disabled={readOnly}
                        required={f.required}
                        aria-invalid={missing.includes(f.key) || undefined}
                        aria-describedby={missing.includes(f.key) ? `editor-error-${f.key}` : undefined}
                        value={text(data[f.key])}
                        onChange={e => change(f.key, e.target.value)}
                      >
                        {f.options.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    ) : f.type === 'checkbox' ? (
                      <input type="checkbox" checked={Boolean(data[f.key])} onChange={e => change(f.key, e.target.checked)} />
                    ) : (
                      <input
                        required={f.required}
                        readOnly={readOnly}
                        aria-invalid={missing.includes(f.key) || undefined}
                        aria-describedby={missing.includes(f.key) ? `editor-error-${f.key}` : undefined}
                        type={f.type ?? 'text'}
                        value={text(data[f.key])}
                        maxLength={2000}
                        onChange={e => change(f.key, e.target.value)}
                      />
                    )}
                  </label>
                  {missing.includes(f.key) && (
                    <span id={`editor-error-${f.key}`} className="roster-field-error">
                      Vui lòng nhập {f.label.toLowerCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div>
              <h3>Kiểm tra trước khi lưu</h3>
              <table>
                <thead>
                  <tr>
                    <th>Thông tin</th>
                    <th>Trước</th>
                    <th>Sau</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(f => (
                    <tr key={f.key}>
                      <td>{f.label}</td>
                      <td>{(f.type === 'date' ? displayDate(initial[f.key]) : text(initial[f.key])) || 'Chưa có'}</td>
                      <td>
                        {f.type === 'checkbox'
                          ? data[f.key]
                            ? 'Có'
                            : 'Không'
                          : f.type === 'date'
                            ? displayDate(data[f.key]) || 'Chưa rõ'
                            : (f.options?.find(o => o[0] === data[f.key])?.[1] ?? (text(data[f.key]) || 'Chưa rõ'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="roster-actions">
            <button type="button" disabled={busy} onClick={onClose}>
              Hủy
            </button>
            {review ? (
              <>
                <button type="button" disabled={busy} onClick={() => setReview(false)}>
                  Quay lại sửa
                </button>
                <button className="roster-primary" type="button" disabled={busy} onClick={save}>
                  {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
                </button>
              </>
            ) : (
              !readOnly && (
                <button className="roster-primary" type="submit">
                  Xem lại →
                </button>
              )
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
function errorMessage(e: unknown) {
  if (axios.isAxiosError(e))
    return text(
      e.response?.data?.message ??
        e.response?.data?.detail ??
        e.response?.data?.title ??
        'Không thể lưu. Kiểm tra quyền, kết nối và dữ liệu.',
    );
  return 'Không thể hoàn tất thao tác.';
}

/** True from 1024px up, where the list and the right pane sit side by side. */
function useWideScreen() {
  const query = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : true));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}

function RosterWorkspace({
  initialTab = 'households',
  embedded = false,
  searchQuery,
  onSearchChange,
  refreshKey = 0,
  householdTarget,
  currentUser,
  hamletName,
}: {
  initialTab?: string;
  embedded?: boolean;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  refreshKey?: number;
  householdTarget?: { legacyId: string; edit: boolean } | null;
  /** Signed-in user, when the host already has it; otherwise it is loaded once for the export button. */
  currentUser?: Pick<AppUser, 'role' | 'subAdminPermissions'> | null;
  hamletName?: string;
}) {
  const { params: urlParams, updateQuery } = useRouteQuery();
  const [exportOpen, setExportOpen] = useState(false);
  const [loadedUser, setLoadedUser] = useState<Pick<AppUser, 'role' | 'subAdminPermissions'> | null>(null);
  useEffect(() => {
    if (currentUser !== undefined) return undefined;
    let cancelled = false;
    Promise.resolve(fetchRbacMe())
      .then(user => !cancelled && setLoadedUser(user ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentUser]);
  const exportUser = currentUser === undefined ? loadedUser : currentUser;
  // The server re-checks; this only hides a button the user could not use.
  const canExport = exportUser?.role === 'superadmin' || exportUser?.subAdminPermissions?.canExportReports === true;
  const canEditMap = exportUser?.role === 'superadmin' || exportUser?.subAdminPermissions?.canEditCoordinates === true;
  // A link change on the map refreshes the list so its link column stays right.
  const [listTick, setListTick] = useState(0);
  const rosterTabs = ['households', 'residents', 'import', 'history', 'patrol'];
  const tabParam = embedded ? (urlParams.get('rosterTab') ?? urlParams.get('tab')) : urlParams.get('tab');
  const routeTab = rosterTabs.includes(tabParam ?? '') ? tabParam! : initialTab;
  const tab = routeTab;
  const setTab = (value: string) =>
    updateQuery({
      ...(embedded && !['households', 'residents'].includes(value) ? { rosterTab: value } : { tab: value, rosterTab: null }),
      ...RECORD_QUERY_KEYS,
      page: null,
    });
  const [kind, setKind] = useState('');
  const [category, setCategory] = useState('');
  const [origin, setOrigin] = useState('');
  const [campaign, setCampaign] = useState('');
  const [unevaluable, setUnevaluable] = useState<number | null>(null);
  const [detailEvents, setDetailEvents] = useState<Row[]>([]);
  const [detailHistoryPage, setDetailHistoryPage] = useState(0);
  const [historyTarget, setHistoryTarget] = useState<{ type: string; id: string } | null>(null);
  const [houseChoices, setHouseChoices] = useState<Row[]>([]);
  const [houseSearch, setHouseSearch] = useState('');
  const [linkPerson, setLinkPerson] = useState<Row | null>(null);
  const [transferMembership, setTransferMembership] = useState<Row | null>(null);
  const [splitting, setSplitting] = useState(false);
  // Split view: the household list beside a map of recorded positions.
  const [mapOn, setMapOn] = useState(false);
  const [paneView, setPaneView] = useState<'map' | 'detail'>('map');
  const [narrowMapView, setNarrowMapView] = useState(false);
  const wide = useWideScreen();
  const [overview, setOverview] = useState<Row>({});
  const [list, setList] = useState<{ tab: string; items: Row[]; total: number }>({ tab: '', items: [], total: 0 });
  const items = list.tab === tab ? list.items : [];
  const total = list.tab === tab ? list.total : 0;
  const pageParam = Number(urlParams.get('page') ?? 1);
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam - 1 : 0;
  const setPage = (value: number) => updateQuery({ page: value > 0 ? String(value + 1) : null });
  const [search, setLocalSearch] = useState(searchQuery ?? '');
  const setSearch = (value: string) => {
    setLocalSearch(value);
    onSearchChange?.(value);
  };
  useEffect(() => {
    if (searchQuery !== undefined) {
      setLocalSearch(searchQuery);
    }
  }, [searchQuery]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequestRef = useRef(0);
  const detailRef = useRef<HTMLElement>(null);
  const [household, setHousehold] = useState<Row | null>(null);
  const [pendingHouseEdit, setPendingHouseEdit] = useState<string | null>(null);
  const [person, setPerson] = useState<Row | null>(null);
  const [revealedIds, setRevealedIds] = useState<Record<string, string>>({});
  useEffect(() => {
    setRevealedIds({});
  }, [person?.id]);
  const [collections, setCollections] = useState<Row[]>([]);
  const [collection, setCollection] = useState<Row | null>(null);
  const [status, setStatus] = useState('REVIEW');
  const [sourcePage, setSourcePage] = useState(0);
  const [sourceRows, setSourceRows] = useState<Row[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [legacy, setLegacy] = useState<string[]>([]);
  const [label, setLabel] = useState('');
  const [sourceDate, setSourceDate] = useState('');
  const [from, setFrom] = useState(dateToday());
  const [to, setTo] = useState(dateToday());
  const [events, setEvents] = useState<Row[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [report, setReport] = useState<Row | null>(null);
  const [editor, setEditor] = useState<{
    title: string;
    fields: Field[];
    initial: Row;
    readOnly?: boolean;
    save: (r: Row) => Promise<void>;
  } | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<Row[]>([]);
  const [personSearch, setPersonSearch] = useState('');
  const reason: Field = { key: 'reason', label: 'Lý do / nguồn kiểm chứng', required: true };
  const previousTabRef = useRef(routeTab);
  useEffect(() => {
    detailRequestRef.current += 1;
    setDetailOpen(false);
    setDetailLoading(false);
    setHistoryTarget(null);
    setLinkPerson(null);
    setTransferMembership(null);
    if (previousTabRef.current !== routeTab) {
      setSearch('');
      previousTabRef.current = routeTab;
    }
    setPerson(null);
    setHousehold(null);
  }, [routeTab]);
  const run = async (f: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await f();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    const { data } = await axios.get(`${api}/overview`);
    setOverview(data);
  };
  const clearDetailActions = () => {
    setHistoryTarget(null);
    setLinkPerson(null);
    setTransferMembership(null);
    setCandidates([]);
  };
  const closeDetail = () => {
    updateQuery({ ...RECORD_QUERY_KEYS });
    detailRequestRef.current += 1;
    setDetailOpen(false);
    setDetailLoading(false);
    setHousehold(null);
    setPerson(null);
    clearDetailActions();
  };
  const loadHouse = async (id: string) => {
    if (urlParams.get('household') !== String(id) || urlParams.has('resident') || urlParams.has('legacyHousehold')) {
      updateQuery({ ...RECORD_QUERY_KEYS, household: String(id), tab: 'households', rosterTab: null });
      return;
    }
    const request = ++detailRequestRef.current;
    setDetailOpen(true);
    setDetailLoading(true);
    setHistoryTarget(null);
    setLinkPerson(null);
    setTransferMembership(null);
    setCandidates([]);
    try {
      const { data } = await axios.get(`${api}/households/${id}`);
      if (request !== detailRequestRef.current) return;
      setHousehold(data);
      setPerson(null);
    } finally {
      if (request === detailRequestRef.current) setDetailLoading(false);
    }
  };
  const loadPerson = async (id: string) => {
    if (urlParams.get('resident') !== String(id)) {
      updateQuery({
        resident: String(id),
        household: household?.id ? String(household.id) : urlParams.get('household'),
        edit: null,
        legacyHousehold: null,
      });
      return;
    }
    const request = ++detailRequestRef.current;
    setDetailOpen(true);
    setDetailLoading(true);
    clearDetailActions();
    try {
      const { data } = await axios.get(`${api}/residents/${id}`);
      if (request !== detailRequestRef.current) return;
      setPerson(data);
    } finally {
      if (request === detailRequestRef.current) setDetailLoading(false);
    }
  };
  useEffect(() => {
    if (detailOpen && !detailLoading) detailRef.current?.focus({ preventScroll: true });
  }, [detailOpen, detailLoading, person?.id, household?.id]);
  const loadCollection = async (id: string) => {
    if (urlParams.get('collection') !== String(id)) {
      updateQuery({ collection: String(id) });
      return;
    }
    const { data } = await axios.get(`${api}/collections/${id}`);
    setCollection(data);
    setSourcePage(0);
  };
  useEffect(() => {
    run(async () => {
      await refresh();
    });
  }, []);
  const legacyHouseholdId = householdTarget?.legacyId ?? urlParams.get('legacyHousehold');
  const canonicalHouseholdId = urlParams.get('household');
  const residentId = urlParams.get('resident');
  const editRequested = householdTarget?.edit ?? urlParams.get('edit') === 'true';
  useEffect(() => {
    const request = ++detailRequestRef.current;
    setHousehold(null);
    setPerson(null);
    setEditor(null);
    setPendingHouseEdit(null);
    const hasTarget = !!(legacyHouseholdId || canonicalHouseholdId || residentId);
    setDetailOpen(hasTarget);
    setDetailLoading(hasTarget);
    setError('');
    if (!hasTarget) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const housePath = canonicalHouseholdId
      ? `households/${encodeURIComponent(canonicalHouseholdId)}`
      : legacyHouseholdId
        ? `legacy-households/${encodeURIComponent(legacyHouseholdId)}`
        : null;
    Promise.all([
      housePath ? axios.get(`${api}/${housePath}`, options) : Promise.resolve(null),
      residentId ? axios.get(`${api}/residents/${encodeURIComponent(residentId)}`, options) : Promise.resolve(null),
    ])
      .then(([houseResponse, personResponse]) => {
        if (request !== detailRequestRef.current) return;
        if (houseResponse) setHousehold(houseResponse.data);
        if (personResponse) setPerson(personResponse.data);
        if (editRequested && houseResponse && !personResponse) setPendingHouseEdit(houseResponse.data.id);
      })
      .catch(e => {
        if (request === detailRequestRef.current) {
          setDetailOpen(false);
          setError(errorMessage(e));
        }
      })
      .finally(() => {
        if (request === detailRequestRef.current) setDetailLoading(false);
      });
    return () => {
      controller.abort();
      detailRequestRef.current += 1;
    };
  }, [legacyHouseholdId, canonicalHouseholdId, residentId, editRequested, householdTarget, routeTab]);
  const collectionId = urlParams.get('collection');
  useEffect(() => {
    setCollection(null);
    if (!collectionId || routeTab !== 'import') return;
    const controller = new AbortController();
    axios
      .get(`${api}/collections/${encodeURIComponent(collectionId)}`, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setCollection(data);
          setSourcePage(0);
        }
      })
      .catch(e => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [collectionId, routeTab]);
  useEffect(() => {
    const controller = new AbortController();
    if (tab === 'households' || tab === 'residents')
      axios
        .get(`${api}/${tab}`, {
          params: { page, search, kind, origin, category, ...(tab === 'residents' && campaign ? { campaign } : {}) },
          signal: controller.signal,
        })
        .then(({ data }) => {
          if (controller.signal.aborted) return;
          setList({ tab, items: data.items, total: data.total });
          setUnevaluable(typeof data.unevaluable === 'number' ? data.unevaluable : null);
        })
        .catch(e => {
          if (!controller.signal.aborted && !axios.isCancel(e)) setError(errorMessage(e));
        });
    if (tab === 'import')
      axios
        .get(`${api}/collections`, { signal: controller.signal })
        .then(({ data }) => setCollections(data))
        .catch(e => {
          if (!axios.isCancel(e)) setError(errorMessage(e));
        });
    return () => controller.abort();
  }, [tab, page, search, message, kind, origin, category, campaign, refreshKey, listTick]);
  useEffect(() => {
    if (!collection) return;
    const controller = new AbortController();
    axios
      .get(`${api}/collections/${collection.id}/rows`, { params: { status, page: sourcePage }, signal: controller.signal })
      .then(({ data }) => setSourceRows(data))
      .catch(e => {
        if (!axios.isCancel(e)) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [collection, status, sourcePage]);
  // The audited create flow; also opened from the map ("Thêm hộ dân tại công trình") through ?newHousehold=true.
  const openNewHousehold = () =>
    setEditor({
      title: 'Tạo hộ mới',
      fields: [...householdFields, { key: 'caseNumber', label: 'HSCT (nếu có)' }, reason],
      initial: {},
      async save(r) {
        const { data } = await axios.post(`${api}/households`, r);
        await loadHouse(data.id);
        await done('Đã tạo hộ');
      },
    });
  const newHouseholdRequested = urlParams.get('newHousehold') === 'true';
  useEffect(() => {
    if (!newHouseholdRequested || tab !== 'households') return;
    openNewHousehold();
    updateQuery({ newHousehold: null }, true);
  }, [newHouseholdRequested, tab]);
  const done = async (msg: string) => {
    setMessage(`${msg} · ${new Date().toLocaleTimeString()}`);
    await refresh();
    if (household) {
      const { data } = await axios.get(`${api}/households/${household.id}`);
      setHousehold(data);
    }
  };
  const editHouse = (syncUrl = true) => {
    if (!household) return;
    if (syncUrl && !editRequested) {
      updateQuery({ edit: 'true' });
      return;
    }
    const selectedHousehold = household;
    setEditor({
      title: 'Sửa thông tin hộ',
      fields: [
        ...householdFields,
        { key: 'caseNumber', label: 'Số hồ sơ cư trú (HSCT)' },
        {
          key: 'verificationStatus',
          label: 'Kết quả đối chiếu hộ',
          options: [
            ['UNVERIFIED', 'Chưa xác minh'],
            ['VERIFIED', 'Đã xác minh hộ'],
            ['HEAD_CONFLICT', 'Cần đối soát chủ hộ'],
          ],
        },
        reason,
      ],
      initial: {
        rawAddress: household.raw_address,
        verificationStatus: household.verification_status,
        caseNumber: household.source_case_number,
        representative: household.representative_name,
        phone: household.phone,
        facilityType: household.type ?? 'RESIDENTIAL',
        businessName: household.business_name,
        businessCategory: household.business_category,
        licenseType: household.license_type ?? '',
        licenseNumber: household.license_number,
        licenseExpiry: household.license_expiry,
        version: household.version,
      },
      async save(r) {
        await axios.put(`${api}/households/${selectedHousehold.id}`, r);
        await done('Đã cập nhật hộ');
      },
    });
  };
  useEffect(() => {
    if (pendingHouseEdit && household?.id === pendingHouseEdit && !detailLoading) {
      editHouse(false);
      setPendingHouseEdit(null);
    }
  }, [pendingHouseEdit, household, detailLoading]);
  const addMember = (existing?: Row) => {
    if (!household) return;
    const selectedHousehold = household;
    const fields: Field[] = [
      ...(existing ? [] : [...personFields, { key: 'identity', label: 'ĐDCN / CCCD / CMND (giữ số 0 đầu)' }]),
      { key: 'relationship', label: 'Quan hệ với chủ hộ (có thể chưa rõ)' },
      { key: 'isHead', label: 'Là chủ hộ đã xác minh', type: 'checkbox' },
      { key: 'effectiveDate', label: 'Ngày bắt đầu tham gia hộ (nếu biết)', type: 'date' },
      ...recordFields.map(f => (f.key === 'kind' ? { ...f, required: false, options: [['', 'Chưa bổ sung hồ sơ cư trú'], ...kinds] } : f)),
      reason,
    ];
    setEditor({
      title: existing ? `Thêm người đã có: ${existing.full_name}` : 'Thêm cá nhân mới vào hộ',
      fields,
      initial: existing ? { residentId: existing.id } : { birthPrecision: 'UNKNOWN' },
      async save(r) {
        await axios.post(`${api}/households/${selectedHousehold.id}/members`, r);
        await done('Đã thêm thành viên');
        setCandidates([]);
      },
    });
  };
  const openSource = async (id: string) => {
    const { data } = await axios.get(`${api}/source/${id}`);
    setEditor({
      title: `Nguồn ${data.file_name} · ${data.sheet} · dòng ${data.row_number}`,
      fields: Object.keys(data.raw as Record<string, Row>).map(k => ({ key: k, label: `Cột ${k}` })),
      initial: Object.fromEntries(Object.entries(data.raw as Record<string, Row>).map(([k, v]) => [k, text(v.value)])),
      readOnly: true,
      save() {
        return Promise.reject(new Error('Nguồn không chỉnh sửa'));
      },
    });
  };
  const showHistory = async (type: string, id: string, n: number) => {
    const { data } = await axios.get(`${api}/entity-history/${type}/${id}`, { params: { page: n } });
    setHistoryTarget({ type, id });
    setDetailEvents(data);
    setDetailHistoryPage(n);
  };
  // Full identity numbers are only disclosed through the audited backend endpoint.
  const revealIdentity = async (identityId: string) => {
    if (revealedIds[identityId]) {
      setRevealedIds(prev => {
        const next = { ...prev };
        delete next[identityId];
        return next;
      });
      return;
    }
    if (!person) return;
    const { data } = await axios.post(`${api}/residents/${person.id}/identities/${identityId}/reveal`, {});
    setRevealedIds(prev => ({ ...prev, [identityId]: data.number }));
  };
  const transfer = (m: Row) => {
    setTransferMembership(m);
    setHouseChoices([]);
    setHouseSearch('');
  };
  const householdDetail = household && (
    <section className="roster-detail">
      {/* Officers recognise a household by its address; the code is the reference beneath it. */}
      <div className="roster-detail-header">
        <div>
          <h2>{householdTitle(household)}</h2>
          <p className="roster-subline">
            Mã hộ {household.code}
            {caseSuffix(household.source_case_number)}
          </p>
        </div>
        <div className="roster-actions">
          <button className="roster-primary" onClick={() => editHouse()}>
            Sửa hộ
          </button>
          <button onClick={() => run(() => showHistory('household', household.id, 0))}>Lịch sử hộ</button>
          <button onClick={() => setSplitting(true)}>Tách hộ</button>
        </div>
      </div>

      <div className="roster-meta-grid">
        <div className="roster-meta-item">
          <span className="roster-meta-label">Chủ hộ / đại diện nguồn</span>
          <strong>{household.representative_name || 'Chưa rõ'}</strong>
          {household.phone && <span className="roster-subline">ĐT: {household.phone}</span>}
        </div>
        <div className="roster-meta-item">
          <span className="roster-meta-label">Loại hình cơ sở</span>
          <strong>{facilityLabel(household.type)}</strong>
          {household.business_name && (
            <span className="roster-subline">
              {household.business_name}
              {household.business_category ? ` · ${household.business_category}` : ''}
            </span>
          )}
          {household.license_type && (
            <span className="roster-subline">
              {licenseLabel(household.license_type)}
              {household.license_number ? ` số ${household.license_number}` : ''}
              {household.license_expiry ? ` · hết hạn ${displayDate(household.license_expiry)}` : ''}
            </span>
          )}
        </div>
        <div className="roster-meta-item">
          <span className="roster-meta-label">Trạng thái & nguồn</span>
          <span>
            {household.origin === 'EXCEL' ? 'Khởi tạo từ dữ liệu Excel gốc của ấp' : 'Khởi tạo trực tiếp'} ·{' '}
            {household.source_case_number
              ? 'Có HSCT nguồn (chưa đồng nghĩa đã xác minh hộ thực tế)'
              : 'Chưa có HSCT; cần đối soát hộ/nhóm địa chỉ'}
          </span>
        </div>
        <div className="roster-meta-item roster-meta-item--full">
          <span className="roster-meta-label">Vị trí & lưu ý xác minh</span>
          <span>
            Vị trí trên bản đồ: {coordinateLabel(household.coordinate_method)}. Tên đại diện nguồn chưa mặc nhiên là chủ hộ đã xác minh.
          </span>
        </div>
      </div>

      <h3>Thành viên và hồ sơ ({household.members.length})</h3>
      <div className="roster-member-list">
        {household.members.map((m: Row) => (
          <div className="roster-member-card" key={m.membership_id}>
            <div className="roster-member-info">
              <button className="roster-row-link roster-member-name" onClick={() => run(() => loadPerson(m.id))}>
                {m.full_name}
              </button>
              <span className="roster-member-meta">
                {displayDate(m.birth_date) || m.birth_year || 'Chưa rõ năm sinh'} ·{' '}
                {m.is_head ? 'Chủ hộ' : m.relationship_code || 'Quan hệ chưa rõ'} ·{' '}
                {m.valid_to ? `Đã kết thúc ${m.valid_to}` : 'Thành viên hiện hành'}
              </span>
            </div>
            <button
              className="roster-btn-sm"
              onClick={() =>
                setEditor({
                  title: 'Sửa quan hệ thành viên hộ',
                  fields: [
                    { key: 'relationship', label: 'Quan hệ' },
                    { key: 'isHead', label: 'Chủ hộ', type: 'checkbox' },
                    { key: 'validFrom', label: 'Bắt đầu', type: 'date' },
                    { key: 'validTo', label: 'Kết thúc', type: 'date' },
                    reason,
                  ],
                  initial: {
                    relationship: m.relationship_code,
                    isHead: m.is_head,
                    validFrom: m.valid_from,
                    validTo: m.valid_to,
                    version: m.membership_version,
                  },
                  async save(r) {
                    await axios.put(`${api}/memberships/${m.membership_id}`, r);
                    await done('Đã cập nhật quan hệ');
                  },
                })
              }
            >
              Sửa quan hệ
            </button>
          </div>
        ))}
        {household.members.length === 0 && <p className="roster-subline">Chưa có thành viên nào được liên kết vào hộ này.</p>}
      </div>

      <div className="roster-subcard">
        <h3>Thêm nhân khẩu vào hộ</h3>
        <div className="roster-actions">
          <input
            aria-label="Tìm người"
            placeholder="Tên hoặc số định danh"
            value={personSearch}
            onChange={e => setPersonSearch(e.target.value)}
          />
          <button
            onClick={() =>
              run(async () => {
                const { data } = await axios.get(`${api}/residents/search`, { params: { search: personSearch } });
                setCandidates(data);
              })
            }
          >
            Tìm người đã có
          </button>
          <button className="roster-primary" onClick={() => addMember()}>
            Tạo người mới
          </button>
        </div>
        {candidates.map(c => (
          <div className="roster-member-card" key={c.id}>
            <span>
              <strong>{c.full_name}</strong> · {displayDate(c.birth_date) || c.birth_year}
            </span>
            <button className="roster-btn-sm" onClick={() => addMember(c)}>
              Dùng hồ sơ này
            </button>
          </div>
        ))}
      </div>

      <details>
        <summary>Nguồn ban đầu của hộ ({household.sources.length} dòng)</summary>
        {household.sources.map((s: Row) => (
          <div className="roster-row" key={s.id}>
            <span>
              {s.file_name} · {s.sheet} · dòng {s.row_number}
            </span>
            <button className="roster-btn-sm" onClick={() => run(() => openSource(s.id))}>
              Xem nguồn
            </button>
          </div>
        ))}
      </details>
    </section>
  );
  const personDetail = person && (
    <section className="roster-detail">
      <div className="roster-detail-header">
        <div>
          <h2>{person.full_name}</h2>
          <p className="roster-subline">
            {displayDate(person.birth_date) || `Năm sinh: ${person.birth_year || 'Chưa rõ'}`} · Nguồn {person.origin}
            {person.birth_date_precision === 'YEAR' ? ' · Chỉ biết năm sinh' : ''}
          </p>
        </div>
        <div className="roster-actions">
          <button
            className="roster-primary"
            onClick={() =>
              setEditor({
                title: 'Sửa thông tin cá nhân dùng chung',
                fields: [...personFields, reason],
                initial: {
                  fullName: person.full_name,
                  birthPrecision: person.birth_date_precision,
                  birthDate: person.birth_date,
                  birthYear: person.birth_year,
                  gender: person.gender,
                  fatherName: person.father_name,
                  motherName: person.mother_name,
                  version: person.version,
                },
                async save(r) {
                  await axios.put(`${api}/residents/${person.id}`, r);
                  await loadPerson(person.id);
                  await refresh();
                  setMessage('Đã sửa cá nhân dùng chung');
                },
              })
            }
          >
            Sửa thông tin cá nhân
          </button>
          <button
            onClick={() => {
              setLinkPerson(person);
              setHouseChoices([]);
              setHouseSearch('');
            }}
          >
            Gắn vào hộ có sẵn
          </button>
          <button onClick={() => run(() => showHistory('resident', person.id, 0))}>Lịch sử cá nhân</button>
        </div>
      </div>

      <details open className="roster-subcard">
        <summary>Giấy tờ định danh ({person.identities.length})</summary>
        {person.identities.map((i: Row) => (
          <div className="roster-member-card" key={i.id}>
            <span>
              <strong>{i.document_type === 'SOURCE_UNCONFIRMED' ? 'ĐDCN / CCCD nguồn' : i.document_type}</strong> ·{' '}
              {revealedIds[i.id] ?? i.number} · {i.verified ? 'Đã đối chiếu' : 'Chưa xác minh'} · {i.active ? 'Đang dùng' : 'Đã thay thế'}
            </span>
            {i.number && (
              <button className="roster-btn-sm" onClick={() => run(() => revealIdentity(i.id))}>
                {revealedIds[i.id] ? 'Ẩn số' : 'Xem số đầy đủ (ghi nhật ký)'}
              </button>
            )}
          </div>
        ))}
        {person.identities.length === 0 && <p className="roster-subline">Chưa có giấy tờ định danh được ghi nhận.</p>}
      </details>

      <h3>Quan hệ hộ theo thời gian</h3>
      <div className="roster-member-list">
        {(person.memberships || []).map((m: Row) => (
          <div className="roster-member-card" key={m.id}>
            <div className="roster-member-info">
              <div className="roster-member-title-row">
                <button className="roster-row-link roster-member-name" onClick={() => run(() => loadHouse(m.household_id))}>
                  {m.code}
                </button>
                <span className="roster-badge roster-badge--muted">{m.is_head ? 'Chủ hộ' : m.relationship_code || 'Quan hệ chưa rõ'}</span>
              </div>
              <span className="roster-member-meta">
                {m.raw_address} · {m.valid_from || 'Chưa rõ ngày bắt đầu'} → {m.valid_to || 'Hiện hành'}
              </span>
            </div>
            <div className="roster-actions">
              <button
                className="roster-btn-sm"
                onClick={() =>
                  setEditor({
                    title: 'Sửa / kết thúc quan hệ hộ',
                    fields: [
                      { key: 'relationship', label: 'Quan hệ với chủ hộ' },
                      { key: 'isHead', label: 'Chủ hộ đã xác minh', type: 'checkbox' },
                      { key: 'validFrom', label: 'Ngày bắt đầu', type: 'date' },
                      { key: 'validTo', label: 'Ngày kết thúc (để trống nếu hiện hành)', type: 'date' },
                      reason,
                    ],
                    initial: {
                      relationship: m.relationship_code,
                      isHead: m.is_head,
                      validFrom: m.valid_from,
                      validTo: m.valid_to,
                      version: m.version,
                    },
                    async save(d) {
                      await axios.put(`${api}/memberships/${m.id}`, d);
                      await loadPerson(person.id);
                      await done('Đã cập nhật quan hệ hộ và giữ lịch sử');
                    },
                  })
                }
              >
                Sửa / kết thúc quan hệ
              </button>
              {!m.valid_to && (
                <button className="roster-btn-sm" onClick={() => transfer(m)}>
                  Chuyển sang hộ khác
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="roster-section-head">
        <h3>Các hồ sơ cư trú ({person.records.length})</h3>
        <div className="roster-actions">
          <button
            className="roster-btn-sm"
            onClick={() =>
              setEditor({
                title: 'Thêm hồ sơ cư trú cho người đã có',
                fields: [
                  {
                    key: 'householdId',
                    label: 'Hộ liên quan (nếu đã đối chiếu)',
                    options: [
                      ['', 'Chưa liên kết hộ'],
                      ...(person.memberships || [])
                        .filter((m: Row) => !m.valid_to)
                        .map((m: Row) => [m.household_id, `${m.code} · ${m.raw_address}`]),
                    ],
                  },
                  ...recordFields,
                  { key: 'effectiveDate', label: 'Ngày hiệu lực thực tế (nếu biết)', type: 'date' },
                  reason,
                ],
                initial: { householdId: household?.id || '' },
                async save(d) {
                  await axios.post(`${api}/residents/${person.id}/records`, d);
                  await loadPerson(person.id);
                  await refresh();
                  setMessage('Đã thêm hồ sơ cư trú, giữ nguyên lịch sử cũ');
                },
              })
            }
          >
            + Hồ sơ cư trú
          </button>
          <button
            className="roster-btn-sm"
            onClick={() =>
              setEditor({
                title: 'Bổ sung / xác minh giấy tờ',
                fields: [
                  { key: 'identity', label: 'Số giấy tờ (giữ số 0 đầu)', required: true },
                  {
                    key: 'documentType',
                    label: 'Loại giấy tờ',
                    options: [
                      ['SOURCE_UNCONFIRMED', 'Chưa xác định loại'],
                      ['CCCD', 'CCCD / ĐDCN'],
                      ['CMND', 'CMND'],
                    ],
                  },
                  { key: 'verified', label: 'Đã đối chiếu giấy tờ gốc', type: 'checkbox' },
                  {
                    key: 'replaceIdentityId',
                    label: 'Thay giấy tờ cũ nếu số cũ bị sai/đã đổi',
                    options: [
                      ['', 'Bổ sung giấy tờ, giữ giấy tờ cũ'],
                      ...person.identities
                        .filter((i: Row) => i.active)
                        .map((i: Row, index: number) => [
                          i.id,
                          `Giấy tờ ${index + 1} · ${i.document_type} · ${i.verified ? 'Đã đối chiếu' : 'Nguồn chưa xác minh'}`,
                        ]),
                    ],
                  },
                  { key: 'effectiveDate', label: 'Ngày thay đổi thực tế (nếu biết)', type: 'date' },
                  reason,
                ],
                initial: { version: person.version },
                async save(d) {
                  await axios.post(`${api}/residents/${person.id}/identities`, d);
                  await loadPerson(person.id);
                  setMessage('Đã lưu giấy tờ và lịch sử');
                },
              })
            }
          >
            + Giấy tờ / đối soát
          </button>
          <button
            className="roster-btn-sm"
            onClick={() =>
              setEditor({
                title: 'Ghi nhận xác minh thực tế',
                fields: [
                  {
                    key: 'presence',
                    label: 'Kết quả',
                    options: [
                      ['PRESENT', 'Đang cư trú'],
                      ['ABSENT', 'Không cư trú'],
                      ['UNKNOWN', 'Chưa xác minh được'],
                    ],
                  },
                  { key: 'observedAt', label: 'Ngày kiểm tra', type: 'date', required: true },
                  reason,
                ],
                initial: { observedAt: dateToday() },
                async save(d) {
                  await axios.post(`${api}/residents/${person.id}/verifications`, d);
                  await loadPerson(person.id);
                  setMessage('Đã thêm lần xác minh');
                },
              })
            }
          >
            + Ghi nhận xác minh
          </button>
        </div>
      </div>

      {person.records.map((r: Row) => (
        <div className="roster-subcard" key={r.id}>
          <div className="roster-member-card">
            <div>
              <strong>{kinds.find(k => k[0] === r.record_kind)?.[1]}</strong> · Ngày đăng ký {r.registration_date || 'chưa rõ'} · Hạn{' '}
              {r.valid_to || 'chưa rõ'} {r.expiry_status === 'EXPIRED' ? '(đã qua hạn)' : ''}
            </div>
            <button
              className="roster-btn-sm"
              onClick={() =>
                setEditor({
                  title: 'Sửa / gia hạn hồ sơ cư trú đã chọn',
                  fields: [
                    {
                      key: 'changeKind',
                      label: 'Nghiệp vụ',
                      options: [
                        ['CORRECTION', 'Sửa thông tin'],
                        ['RENEWAL', 'Gia hạn'],
                        ['RESIDENCE_ENDED', 'Kết thúc hồ sơ cư trú'],
                      ],
                    },
                    { key: 'registrationDate', label: 'Ngày đăng ký', type: 'date' },
                    { key: 'validFrom', label: 'Hiệu lực bắt đầu', type: 'date' },
                    { key: 'validTo', label: 'Kết thúc / hết hạn', type: 'date' },
                    { key: 'sourceStatus', label: 'Trạng thái hồ sơ' },
                    ...recordFields.filter(f => ['permanentAddress', 'temporaryAddress', 'currentAddress'].includes(f.key)),
                    { key: 'declaredAddress', label: 'Địa chỉ khai báo' },
                    { key: 'previousAddress', label: 'Địa chỉ trước khi chuyển đến' },
                    { key: 'effectiveDate', label: 'Ngày thay đổi thực tế', type: 'date' },
                    reason,
                  ],
                  initial: {
                    registrationDate: r.registration_date,
                    validFrom: r.valid_from,
                    validTo: r.valid_to,
                    sourceStatus: r.source_status,
                    ...Object.fromEntries(r.addresses.map((a: Row) => [a.address_role, a.raw_address])),
                    version: r.version,
                  },
                  async save(d) {
                    await axios.put(`${api}/records/${r.id}`, d);
                    await loadPerson(person.id);
                    setMessage('Đã lưu hồ sơ cư trú và lịch sử');
                  },
                })
              }
            >
              Sửa / gia hạn
            </button>
          </div>
          {r.addresses.map((a: Row) => (
            <div className="roster-subline" key={`${a.id}-${a.address_role}`}>
              <strong>
                {
                  {
                    permanentAddress: 'Thường trú',
                    temporaryAddress: 'Tạm trú',
                    currentAddress: 'Hiện tại',
                    declaredAddress: 'Khai báo',
                    previousAddress: 'Trước khi đến',
                  }[a.address_role]
                }
              </strong>
              : {a.raw_address}
            </div>
          ))}
          <details>
            <summary>Thông tin nghiệp vụ theo nguồn</summary>
            <p>
              Trạng thái: {r.source_status || 'Chưa rõ'} · Phân loại nhân khẩu: {r.classification_raw || 'Chưa rõ'}
            </p>
            <p>
              Phân loại nhà ở: {r.housing_classification_raw || 'Chưa rõ'} · Loại hình đăng ký: {r.registration_form || 'Chưa rõ'}
            </p>
            <p>
              Đại diện nguồn: {r.representative_name_raw || 'Chưa rõ'} · Thời gian nguồn: {r.source_residence_time_raw || 'Chưa rõ'}
            </p>
          </details>
        </div>
      ))}

      {person.verifications.length > 0 && (
        <div className="roster-subcard">
          <strong>Lịch sử xác minh thực địa</strong>
          {person.verifications.map((v: Row) => (
            <p className="roster-subline" key={v.id}>
              {v.observed_at || 'Chưa rõ ngày nguồn'} · {v.presence_status} · {v.method}
            </p>
          ))}
        </div>
      )}

      <details>
        <summary>Nguồn cá nhân ({person.sources.length} dòng)</summary>
        {person.sources.map((s: Row) => (
          <div className="roster-row" key={s.id}>
            <span>
              {s.file_name} · {s.sheet} · dòng {s.row_number}
            </span>
            <button className="roster-btn-sm" onClick={() => run(() => openSource(s.id))}>
              Xem nguồn
            </button>
          </div>
        ))}
      </details>
    </section>
  );
  const detailActions = (
    <>
      {splitting && household && (
        <HouseholdSplitDialog
          household={household as any}
          onClose={() => setSplitting(false)}
          onSplit={id => {
            setSplitting(false);
            void done('Đã tách hộ; vị trí hộ mới là vị trí tạm').then(() => loadHouse(id));
          }}
        />
      )}
      {transferMembership && (
        <section className="roster-detail" aria-label="Chọn hộ chuyển đến">
          <h2>Chuyển hộ từ {transferMembership.code}</h2>
          <p>Kết thúc quan hệ hộ cũ và tạo quan hệ hộ mới trong cùng lần lưu. Hồ sơ đăng ký cư trú cần cập nhật riêng sau khi đối chiếu.</p>
          <label>
            Tìm hộ chuyển đến
            <input value={houseSearch} onChange={e => setHouseSearch(e.target.value)} />
          </label>
          <button
            onClick={() =>
              run(async () => {
                const { data } = await axios.get(`${api}/households`, { params: { search: houseSearch, page: 0 } });
                setHouseChoices(data.items);
              })
            }
          >
            Tìm hộ đích
          </button>
          <button onClick={() => setTransferMembership(null)}>Hủy chuyển hộ</button>
          <p>Tối đa 30 kết quả; tìm cụ thể theo mã hoặc địa chỉ.</p>
          {houseChoices
            .filter(h => h.id !== transferMembership.household_id)
            .map(h => (
              <div className="roster-row" key={h.id}>
                {h.code} · {h.raw_address}
                <button
                  onClick={() =>
                    setEditor({
                      title: `Chuyển sang ${h.code}`,
                      fields: [
                        { key: 'effectiveDate', label: 'Ngày chuyển hộ', type: 'date', required: true },
                        { key: 'relationship', label: 'Quan hệ với chủ hộ mới' },
                        { key: 'isHead', label: 'Chủ hộ mới đã xác minh', type: 'checkbox' },
                        reason,
                      ],
                      initial: { householdId: h.id, version: transferMembership.version },
                      async save(d) {
                        const { data } = await axios.post(`${api}/memberships/${transferMembership.id}/transfer`, d);
                        await loadPerson(data.id);
                        setTransferMembership(null);
                        await done('Đã chuyển hộ và giữ lịch sử quan hệ cũ');
                      },
                    })
                  }
                >
                  Chọn chuyển đến
                </button>
              </div>
            ))}
        </section>
      )}
      {linkPerson && (
        <section className="roster-detail" role="region" aria-label="Chọn hộ để gắn nhân khẩu">
          <h2>Gắn {linkPerson.full_name} vào hộ có sẵn</h2>
          <p>Thao tác này bổ sung quan hệ hộ. Để chuyển hộ và kết thúc quan hệ cũ, dùng “Chuyển sang hộ khác”.</p>
          <label>
            Tìm mã hộ, HSCT, địa chỉ hoặc đại diện
            <input value={houseSearch} onChange={e => setHouseSearch(e.target.value)} />
          </label>
          <button
            onClick={() =>
              run(async () => {
                const { data } = await axios.get(`${api}/households`, { params: { search: houseSearch, page: 0 } });
                setHouseChoices(data.items);
              })
            }
          >
            Tìm hộ
          </button>
          <button onClick={() => setLinkPerson(null)}>Đóng chọn hộ</button>
          <p>Hiển thị tối đa 30 kết quả; nhập cụ thể hơn nếu chưa thấy hộ cần tìm.</p>
          {houseChoices.map(h => (
            <div className="roster-row" key={h.id}>
              {h.code} · {h.raw_address}
              <button
                onClick={() =>
                  setEditor({
                    title: `Gắn vào ${h.code}`,
                    fields: [
                      { key: 'relationship', label: 'Quan hệ với chủ hộ' },
                      { key: 'isHead', label: 'Chủ hộ đã xác minh', type: 'checkbox' },
                      { key: 'effectiveDate', label: 'Ngày bắt đầu (nếu biết)', type: 'date' },
                      reason,
                    ],
                    initial: { residentId: linkPerson.id },
                    async save(d) {
                      await axios.post(`${api}/households/${h.id}/members`, d);
                      await loadPerson(linkPerson.id);
                      setLinkPerson(null);
                      await done('Đã gắn nhân khẩu vào hộ');
                    },
                  })
                }
              >
                Chọn hộ này
              </button>
            </div>
          ))}
        </section>
      )}
      {historyTarget && (
        <section className="roster-detail" aria-label="Lịch sử hồ sơ">
          <h2>Lịch sử {historyTarget.type === 'resident' ? 'cá nhân' : 'hộ'}</h2>
          <button onClick={() => setHistoryTarget(null)}>Đóng lịch sử</button>
          {detailEvents.map(e => (
            <details key={e.id}>
              <summary>
                {text(e.recorded_at)} · {labels[e.change_kind] || e.change_kind} · {e.actor} · {e.reason}
              </summary>
              <div className="roster-fields">
                <pre>Trước: {JSON.stringify(e.before_data, null, 2)}</pre>
                <pre>Sau: {JSON.stringify(e.after_data, null, 2)}</pre>
              </div>
            </details>
          ))}
          {!detailEvents.length && <p>Không có thêm lịch sử.</p>}
          <div className="roster-actions">
            <button
              disabled={!detailHistoryPage}
              onClick={() => run(() => showHistory(historyTarget.type, historyTarget.id, detailHistoryPage - 1))}
            >
              Lịch sử trước
            </button>
            <span>Trang {detailHistoryPage + 1}</span>
            <button
              disabled={detailEvents.length < 100}
              onClick={() => run(() => showHistory(historyTarget.type, historyTarget.id, detailHistoryPage + 1))}
            >
              Lịch sử sau
            </button>
          </div>
        </section>
      )}
    </>
  );
  // Embedded in the dashboard: its shell already owns <main> and the page <h1>.
  const [Root, Title] = embedded ? (['div', 'h2'] as const) : (['main', 'h1'] as const);
  return (
    <Root className={`roster-page ${embedded ? 'roster-embedded' : ''}`}>
      <div className="roster-heading">
        <div className="roster-heading-icon" aria-hidden="true">
          {tab === 'households' ? <House size={22} /> : <Users size={22} />}
        </div>
        <div className="roster-heading-main">
          {!embedded && <Link to="/dashboard">← Về dashboard</Link>}
          <Title className="roster-title">
            {tab === 'households'
              ? 'Danh sách hộ dân'
              : tab === 'residents'
                ? 'Quản lý nhân khẩu'
                : tab === 'patrol'
                  ? 'Tuần tra thực địa'
                  : 'Hồ sơ dân cư'}
            {overview.hamlet_name ? ` · ${text(overview.hamlet_name)}` : ''}
          </Title>
          <p>
            {overview.hamlet_name ? `Dữ liệu gốc từ ấp ${text(overview.hamlet_name)}` : 'Dữ liệu gốc theo ấp'} · Có nguồn và lịch sử thay
            đổi
          </p>
        </div>
      </div>
      <nav className="roster-tabs" aria-label="Chức năng hồ sơ dân cư">
        {[
          ['households', 'Danh sách hộ dân'],
          ['residents', 'Quản lý nhân khẩu'],
          ['import', 'Nhập Excel / đối soát'],
          ['patrol', 'Tuần tra'],
          ['history', 'Lịch sử & báo cáo'],
        ].map(([v, l]) => (
          <button
            key={v}
            aria-pressed={tab === v}
            onClick={() => {
              setTab(v);
              setSearch('');
              setList({ tab: '', items: [], total: 0 });
              setPerson(null);
              setHousehold(null);
              setHistoryTarget(null);
            }}
          >
            {l}
          </button>
        ))}
      </nav>
      {error && (
        <div className="roster-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <p className="roster-success" role="status">
          {message}
        </p>
      )}
      <p className="roster-summary">
        {overview.households ?? '…'} hộ/nhóm địa chỉ · {overview.residents ?? '…'} cá nhân · {overview.records ?? '…'} hồ sơ cư trú ·{' '}
        {overview.review_rows ?? '…'} dòng chờ đối soát. Số này chưa phải dân số thực tế đã xác minh.
      </p>
      {tab === 'patrol' && <RosterPatrol />}
      {tab === 'households' && (
        <div className="roster-view-toggle">
          <button type="button" aria-pressed={mapOn} onClick={() => setMapOn(on => !on)}>
            {mapOn ? 'Ẩn bản đồ' : 'Hiện bản đồ vị trí'}
          </button>
          {mapOn && (
            <div className="roster-pane-switch" role="group" aria-label="Chế độ xem">
              <button type="button" aria-pressed={!narrowMapView} onClick={() => setNarrowMapView(false)}>
                Danh sách
              </button>
              <button type="button" aria-pressed={narrowMapView} onClick={() => setNarrowMapView(true)}>
                Bản đồ
              </button>
            </div>
          )}
        </div>
      )}
      {(tab === 'households' || tab === 'residents') && (
        <div
          className={`roster-workspace ${detailOpen && (!mapOn || tab !== 'households' || paneView === 'detail' || !wide) ? 'has-selection' : ''} ${mapOn && tab === 'households' ? 'has-map' : ''} ${mapOn && narrowMapView ? 'map-view' : ''}`}
        >
          <section
            className="roster-list-pane"
            aria-label={tab === 'households' ? 'Danh sách hộ dân' : 'Danh sách nhân khẩu'}
            tabIndex={-1}
          >
            {tab === 'residents' && (
              <section>
                <p className="roster-helper-note">
                  Tìm người trước khi tạo mới. Một cá nhân có thể có nhiều hồ sơ cư trú; danh sách này đếm mỗi người một lần.
                </p>
                <div className="roster-actions roster-filter-bar">
                  <label className="roster-filter-search">
                    Tìm họ tên hoặc ĐDCN / CCCD / CMND
                    <input
                      type="search"
                      placeholder="Họ tên hoặc số giấy tờ"
                      value={search}
                      onChange={e => {
                        setSearch(e.target.value);
                        setPage(0);
                      }}
                    />
                  </label>
                  <label className="roster-filter-select">
                    Loại hồ sơ
                    <select
                      value={kind}
                      onChange={e => {
                        setKind(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">Tất cả</option>
                      {kinds.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="roster-filter-select">
                    Nguồn khởi tạo
                    <select
                      value={origin}
                      onChange={e => {
                        setOrigin(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">Tất cả</option>
                      <option value="EXCEL">Excel gốc</option>
                      <option value="MANUAL">Nhập trực tiếp</option>
                    </select>
                  </label>
                  <label className="roster-filter-select roster-filter-campaign">
                    Chiến dịch
                    <select
                      value={campaign}
                      onChange={e => {
                        setCampaign(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">Không lọc</option>
                      {campaigns.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="roster-filter-cta">
                    {(search || kind || origin || campaign) && (
                      <button
                        type="button"
                        className="roster-btn-sm"
                        onClick={() => {
                          setSearch('');
                          setKind('');
                          setOrigin('');
                          setCampaign('');
                          setPage(0);
                        }}
                      >
                        Xóa lọc
                      </button>
                    )}
                    {canExport && (
                      <button type="button" className="roster-export-open" onClick={() => setExportOpen(true)}>
                        <Printer size={16} aria-hidden="true" /> Xuất / In danh sách
                      </button>
                    )}
                    {exportOpen && (
                      <ResidentExportDialog
                        hamletLabel={hamletName}
                        initial={{ search, kinds: kind ? [kind] : [], origin, campaign }}
                        onClose={() => setExportOpen(false)}
                      />
                    )}
                    <button
                      className="roster-primary"
                      onClick={() =>
                        setEditor({
                          title: 'Thêm nhân khẩu chưa gắn hộ',
                          fields: [...personFields, { key: 'identity', label: 'ĐDCN / CCCD / CMND (nếu có)' }, reason],
                          initial: { birthPrecision: 'UNKNOWN' },
                          async save(d) {
                            const { data } = await axios.post(`${api}/residents`, d);
                            await loadPerson(data.id);
                            await done('Đã tạo cá nhân; có thể gắn hộ và bổ sung hồ sơ cư trú');
                          },
                        })
                      }
                    >
                      + Thêm nhân khẩu
                    </button>
                  </div>
                </div>
                <div className="roster-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Họ tên</th>
                        <th>Ngày / năm sinh</th>
                        <th className="roster-num">Hộ hiện hành</th>
                        <th className="roster-num">Hồ sơ cư trú</th>
                        <th>Nguồn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(r => (
                        <tr
                          key={r.id}
                          className="roster-table-row"
                          data-selected={detailOpen && person?.id === r.id}
                          onClick={() => run(() => loadPerson(r.id))}
                        >
                          <td className="roster-cell-identity">
                            <button
                              className="roster-row-link"
                              onClick={e => {
                                e.stopPropagation();
                                run(() => loadPerson(r.id));
                              }}
                            >
                              {r.full_name}
                            </button>
                          </td>
                          <td data-label="Ngày / năm sinh">
                            {displayDate(r.birth_date) || r.birth_year || 'Chưa rõ'}
                            {r.birth_date_precision === 'YEAR' && ' (chỉ biết năm)'}
                          </td>
                          <td data-label="Hộ hiện hành" className="roster-num">
                            {r.household_count}
                          </td>
                          <td data-label="Hồ sơ cư trú" className="roster-num">
                            {r.record_count}
                          </td>
                          <td data-label="Nguồn">
                            <span className={`roster-badge ${r.origin === 'EXCEL' ? 'roster-badge--muted' : 'roster-badge--ok'}`}>
                              {r.origin === 'EXCEL' ? 'Excel gốc' : 'Nhập trực tiếp'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {items.length === 0 && <p>Không có kết quả trong phạm vi được giao.</p>}
                {campaign && unevaluable != null && unevaluable > 0 && (
                  <p className="roster-summary" role="note">
                    {unevaluable} cá nhân chưa có ngày sinh đầy đủ nên chưa thể xét theo độ tuổi; số này không nằm trong kết quả lọc.
                  </p>
                )}
                <div className="roster-actions roster-pagination-bar">
                  <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                    Trang trước
                  </button>
                  <span>
                    Trang {page + 1} · {total} cá nhân
                  </span>
                  <button disabled={(page + 1) * 30 >= total} onClick={() => setPage(page + 1)}>
                    Trang sau
                  </button>
                </div>
              </section>
            )}
            {tab === 'households' && (
              <>
                <div className="roster-actions roster-filter-bar">
                  <label className="roster-filter-search">
                    Tìm hộ theo địa chỉ, tên đại diện, mã hoặc HSCT
                    <input
                      type="search"
                      placeholder="Ví dụ: 34/6 ấp 62 hoặc tên chủ hộ"
                      value={search}
                      onChange={e => {
                        setPage(0);
                        setSearch(e.target.value);
                      }}
                    />
                  </label>
                  <label className="roster-filter-select">
                    Phân nhóm hộ
                    <select
                      value={category}
                      onChange={e => {
                        setCategory(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">Tất cả hộ/nhóm địa chỉ</option>
                      <option value="HSCT">Có HSCT nguồn</option>
                      <option value="PROVISIONAL">Chưa có HSCT / chờ xác minh</option>
                    </select>
                  </label>
                  <label className="roster-filter-select">
                    Nguồn khởi tạo
                    <select
                      value={origin}
                      onChange={e => {
                        setOrigin(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">Tất cả</option>
                      <option value="EXCEL">Excel gốc</option>
                      <option value="MANUAL">Nhập trực tiếp</option>
                    </select>
                  </label>
                  <div className="roster-filter-cta">
                    {(search || category || origin) && (
                      <button
                        type="button"
                        className="roster-btn-sm"
                        onClick={() => {
                          setSearch('');
                          setCategory('');
                          setOrigin('');
                          setPage(0);
                        }}
                      >
                        Xóa lọc
                      </button>
                    )}
                    <button className="roster-primary" onClick={openNewHousehold}>
                      + Thêm hộ
                    </button>
                  </div>
                </div>
                <div className="roster-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Mã / HSCT</th>
                        <th>Chủ hộ / đại diện nguồn</th>
                        <th>Địa chỉ</th>
                        <th className="roster-num">Thành viên đã nhập</th>
                        <th>Nguồn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(h => (
                        <tr
                          key={h.id}
                          className="roster-table-row"
                          data-selected={detailOpen && household?.id === h.id}
                          onClick={() => run(() => loadHouse(h.id))}
                        >
                          <td className="roster-cell-identity">
                            <button
                              className="roster-row-link"
                              onClick={e => {
                                e.stopPropagation();
                                run(() => loadHouse(h.id));
                              }}
                            >
                              {h.source_case_number ||
                                (typeof h.code !== 'string' || !h.code
                                  ? 'Chưa có mã hộ'
                                  : h.origin === 'MANUAL'
                                    ? h.code
                                    : `Nhóm ${h.code.slice(-8)}`)}
                            </button>
                            <div className="roster-subline">
                              <span className={`roster-badge ${h.source_case_number ? 'roster-badge--ok' : 'roster-badge--muted'}`}>
                                {h.source_case_number ? 'HSCT nguồn' : 'Chưa có HSCT'}
                              </span>
                            </div>
                          </td>
                          <td data-label="Chủ hộ / đại diện" className="roster-cell-strong">
                            {h.representative_name || 'Chưa rõ'}
                          </td>
                          <td data-label="Địa chỉ" className="roster-cell-address">
                            {h.raw_address}
                          </td>
                          <td data-label="Thành viên đã nhập" className="roster-num">
                            {h.member_count}
                          </td>
                          <td data-label="Nguồn">
                            <span className="roster-origin-tag">{h.origin === 'EXCEL' ? 'Excel' : 'Nhập trực tiếp'}</span> ·{' '}
                            <span
                              className={`roster-badge ${
                                h.verification_status === 'HEAD_CONFLICT'
                                  ? 'roster-badge--warn'
                                  : h.verification_status === 'UNVERIFIED'
                                    ? 'roster-badge--muted'
                                    : 'roster-badge--ok'
                              }`}
                            >
                              {h.verification_status === 'HEAD_CONFLICT'
                                ? 'Cần đối soát tên chủ hộ'
                                : h.verification_status === 'UNVERIFIED'
                                  ? 'Chưa xác minh'
                                  : h.verification_status === 'VERIFIED'
                                    ? 'Đã xác minh'
                                    : h.verification_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {items.length === 0 && <p>Không có kết quả trong phạm vi được giao.</p>}
                <div className="roster-actions roster-pagination-bar">
                  <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                    Trang trước
                  </button>
                  <span>
                    Trang {page + 1} · {total} hộ/nhóm địa chỉ
                  </span>
                  <button disabled={(page + 1) * 30 >= total} onClick={() => setPage(page + 1)}>
                    Trang sau
                  </button>
                </div>
              </>
            )}
          </section>
          {mapOn && tab === 'households' && (paneView === 'map' || !detailOpen) && wide && (
            <RosterMapPane
              selectedId={household?.id ?? null}
              onSelect={id => run(() => loadHouse(id))}
              onOpenDetail={detailOpen ? () => setPaneView('detail') : undefined}
              canEdit={canEditMap}
              onChanged={() => setListTick(t => t + 1)}
            />
          )}
          {mapOn && tab === 'households' && !wide && narrowMapView && (
            <RosterMapPane
              selectedId={household?.id ?? null}
              onSelect={id => run(() => loadHouse(id))}
              canEdit={canEditMap}
              onChanged={() => setListTick(t => t + 1)}
            />
          )}
          {detailOpen && !(mapOn && tab === 'households' && paneView === 'map' && wide) && (
            <aside
              ref={detailRef}
              className="roster-detail-pane"
              aria-label="Thông tin và thao tác hồ sơ"
              tabIndex={-1}
              aria-busy={detailLoading}
            >
              <div className="roster-detail-toolbar">
                <div>
                  <strong>{person ? 'Chi tiết nhân khẩu' : 'Chi tiết hộ dân'}</strong>
                  <p>Thông tin · Thao tác · Nguồn · Lịch sử</p>
                </div>
                <div className="roster-actions">
                  {person && household && <button onClick={() => run(() => loadHouse(household.id))}>← Về hộ đang xem</button>}
                  {mapOn && tab === 'households' && wide && <button onClick={() => setPaneView('map')}>Xem trên bản đồ</button>}
                  <button onClick={closeDetail}>Đóng chi tiết</button>
                </div>
              </div>
              {detailLoading ? (
                <p role="status" className="roster-detail-loading">
                  Đang tải hồ sơ…
                </p>
              ) : (
                <>
                  {person ? personDetail : householdDetail}
                  {detailActions}
                </>
              )}
            </aside>
          )}
        </div>
      )}
      {tab === 'import' && (
        <section>
          <h2>Nhập nguồn Excel</h2>
          <div className="roster-fields">
            <label>
              Tên đợt nhập
              <input value={label} onChange={e => setLabel(e.target.value)} />
            </label>
            <label>
              Ngày dữ liệu nguồn (nếu biết)
              <input type="date" value={sourceDate} onChange={e => setSourceDate(e.target.value)} />
            </label>
            <label>
              Chọn file .xlsx
              <input
                type="file"
                multiple
                accept=".xlsx"
                onChange={e => {
                  const selected = Array.from(e.target.files ?? []);
                  setFiles(selected);
                  setLegacy(selected.map(f => /(?:61|62|63|69)/.exec(f.name)?.[0] ?? '62'));
                }}
              />
            </label>
          </div>
          {files.map((f, i) => (
            <label className="roster-row" key={`${f.name}-${i}`}>
              {f.name}
              <select value={legacy[i]} onChange={e => setLegacy(legacy.map((v, j) => (j === i ? e.target.value : v)))}>
                {['61', '62', '63', '69'].map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
          <button
            disabled={busy || !files.length || !label.trim()}
            onClick={() =>
              run(async () => {
                const form = new FormData();
                files.forEach((f, i) => {
                  form.append('files', f);
                  form.append('legacyHamlets', legacy[i]);
                });
                form.append('label', label);
                if (sourceDate) form.append('sourceDate', sourceDate);
                const { data } = await axios.post(`${api}/collections`, form, { timeout: 300000 });
                setCollection(data);
                setCollections((await axios.get(`${api}/collections`)).data);
                setMessage('Đã kiểm tra và lưu nguồn; chưa tự ghi đè hồ sơ');
              })
            }
          >
            {busy ? 'Đang kiểm tra…' : 'Kiểm tra & lưu nguồn'}
          </button>
          <h3>Các đợt nhập</h3>
          {collections.map(c => (
            <button key={c.id} onClick={() => run(() => loadCollection(c.id))}>
              {c.label} · {labels[c.status] || c.status}
            </button>
          ))}
          {collection && (
            <section className="roster-detail">
              <h3>{collection.label}</h3>
              {collection.batches.map((b: Row) => (
                <p key={b.id}>
                  {b.file_name} · Ấp cũ {b.legacy_hamlet} · {b.business_rows} dòng nghiệp vụ
                </p>
              ))}
              <div className="roster-row">
                {collection.counts.map((c: Row) => (
                  <span key={c.status + c.row_kind}>
                    {labels[c.status] || c.status} / {kinds.find(k => k[0] === c.row_kind)?.[1] || 'Dòng phụ'}: {c.amount}
                  </span>
                ))}
              </div>
              <p>Chỉ dòng sẵn sàng được áp dụng; xung đột giữ chờ đối soát. Dữ liệu nguồn giữ nguyên, vị trí hộ là random tạm.</p>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await axios.post(`${api}/collections/${collection.id}/apply`, null, { timeout: 300000 });
                    await loadCollection(collection.id);
                    await refresh();
                    setMessage('Đã áp dụng các dòng sẵn sàng; dòng xung đột vẫn giữ để đối soát');
                  })
                }
              >
                Áp dụng các dòng sẵn sàng
              </button>
              <label>
                Nhóm dòng
                <select
                  value={status}
                  onChange={e => {
                    setStatus(e.target.value);
                    setSourcePage(0);
                  }}
                >
                  {[
                    ['REVIEW', 'Chờ đối soát'],
                    ['READY', 'Sẵn sàng'],
                    ['APPLIED', 'Đã áp dụng'],
                    ['EXCLUDED', 'Sheet phụ / tiêu đề / dòng tổng'],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              {sourceRows.map(r => (
                <div className="roster-row" key={r.id}>
                  <span>
                    Ấp {r.legacy_hamlet} · {r.sheet} · dòng {r.row_number}
                    <br />
                    {r.data.fullName} · {displayDate(r.data.birthDate) || r.data.birthYear} · {r.errors}
                  </span>
                  <button onClick={() => run(() => openSource(r.id))}>Nguồn</button>
                  {r.status === 'REVIEW' && (
                    <button
                      onClick={() =>
                        setEditor({
                          title: 'Quyết định đối soát — không sửa nguồn gốc',
                          fields: [
                            {
                              key: 'action',
                              label: 'Quyết định',
                              options: [
                                ['CORRECT', 'Sửa dữ liệu chuẩn hóa rồi dò lại'],
                                ['SEPARATE', 'Xác nhận là cá nhân riêng'],
                                ['LINK', 'Liên kết cá nhân đã có theo ID'],
                              ],
                            },
                            ...personFields,
                            { key: 'identity', label: 'Số giấy tờ đã đối chiếu (nếu cần sửa)' },
                            { key: 'residentId', label: 'ID cá nhân đích (chỉ khi chọn liên kết)' },
                            reason,
                          ],
                          initial: { ...r.data },
                          async save(d) {
                            await axios.post(`${api}/source/${r.id}/review`, d);
                            await loadCollection(collection.id);
                            await refresh();
                            setMessage('Đã lưu quyết định; áp dụng lại dòng sẵn sàng để hoàn tất');
                          },
                        })
                      }
                    >
                      Đối soát
                    </button>
                  )}
                </div>
              ))}
              <div className="roster-actions">
                <button disabled={!sourcePage} onClick={() => setSourcePage(sourcePage - 1)}>
                  Trước
                </button>
                <span>Trang {sourcePage + 1}</span>
                <button disabled={sourceRows.length < 50} onClick={() => setSourcePage(sourcePage + 1)}>
                  Sau
                </button>
              </div>
            </section>
          )}
        </section>
      )}

      {tab === 'history' && (
        <section>
          <h2>Lịch sử và biến động theo ngày ghi nhận</h2>
          <div className="roster-actions">
            <label>
              Từ ngày
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </label>
            <label>
              Đến ngày
              <input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </label>
            <button
              onClick={() =>
                run(async () => {
                  setHistoryPage(0);
                  setEvents((await axios.get(`${api}/history`, { params: { from, to, page: 0 } })).data);
                  setReport((await axios.get(`${api}/report`, { params: { from, to } })).data);
                })
              }
            >
              Xem báo cáo
            </button>
            <a href={`${api}/report.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${hamletParam()}`}>
              Xuất CSV mở bằng Excel
            </a>
            <a href={`${api}/report-detail.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${hamletParam()}`}>
              Xuất chi tiết trước / sau
            </a>
          </div>
          <p>
            Báo cáo theo thời điểm ghi nhận; sửa dữ liệu/nhập nguồn được tách khỏi chuyển đến/chuyển đi. Ngày hiệu lực chưa biết không được
            suy diễn.
          </p>
          {report && (
            <div>
              <p>
                Hộ đầu kỳ {report.householdOpening} → cuối kỳ {report.householdClosing}; cá nhân đầu kỳ {report.residentOpening} → cuối kỳ{' '}
                {report.residentClosing}.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Loại thay đổi</th>
                    <th>Hồ sơ</th>
                    <th>Thao tác</th>
                    <th>Số lượt</th>
                  </tr>
                </thead>
                <tbody>
                  {report.changes.map((c: Row) => (
                    <tr key={c.change_kind + c.entity_type + c.operation}>
                      <td>{labels[c.change_kind] || c.change_kind}</td>
                      <td>{labels[c.entity_type] || c.entity_type}</td>
                      <td>{labels[c.operation] || c.operation}</td>
                      <td>{c.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {events.map(e => (
            <details key={e.id}>
              <summary>
                {new Date(e.recorded_at).toLocaleString()} · {labels[e.change_kind] || e.change_kind} ·{' '}
                {labels[e.entity_type] || e.entity_type} · {e.actor}
              </summary>
              <p>
                {e.reason} · Ngày hiệu lực {e.effective_date || 'chưa biết'}
              </p>
              <div className="roster-table">
                <table>
                  <thead>
                    <tr>
                      <th>Thông tin</th>
                      <th>Trước</th>
                      <th>Sau</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set([...Object.keys(e.before_data || {}), ...Object.keys(e.after_data || {})]))
                      .filter(k => !/ciphertext|lookup/.test(k) && text(e.before_data?.[k]) !== text(e.after_data?.[k]))
                      .map(k => (
                        <tr key={k}>
                          <td>{k}</td>
                          <td>{text(e.before_data?.[k])}</td>
                          <td>{text(e.after_data?.[k])}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
          <div className="roster-actions">
            <button
              disabled={!historyPage}
              onClick={() =>
                run(async () => {
                  setEvents((await axios.get(`${api}/history`, { params: { from, to, page: historyPage - 1 } })).data);
                  setHistoryPage(historyPage - 1);
                })
              }
            >
              Trước
            </button>
            <span>Trang lịch sử {historyPage + 1}</span>
            <button
              disabled={events.length < 100}
              onClick={() =>
                run(async () => {
                  setEvents((await axios.get(`${api}/history`, { params: { from, to, page: historyPage + 1 } })).data);
                  setHistoryPage(historyPage + 1);
                })
              }
            >
              Sau
            </button>
          </div>
        </section>
      )}
      {editor && (
        <Editor
          key={editor.title + text(editor.initial.id)}
          title={editor.title}
          fields={editor.fields}
          initial={editor.initial}
          onSave={editor.save}
          onClose={() => {
            setEditor(null);
            updateQuery({ edit: null });
          }}
          readOnly={editor.readOnly}
        />
      )}
    </Root>
  );
}

type HamletOption = { id: number; name: string; full_name?: string; is_default?: boolean };

export default function RosterPage(props: React.ComponentProps<typeof RosterWorkspace>) {
  const [hamlets, setHamlets] = useState<HamletOption[]>([]);
  const [hamlet, setHamlet] = useState(activeHamlet);
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(axios.get(`${api}/hamlets`))
      .then(response => {
        const list = response?.data;
        if (cancelled || !Array.isArray(list)) return;
        setHamlets(list as HamletOption[]);
        if (activeHamlet && !list.some(h => String(h.id) === activeHamlet)) {
          // A remembered hamlet the user can no longer open: fall back to the server default and reload.
          activeHamlet = '';
          setHamlet('');
          setEpoch(n => n + 1);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const selected = hamlets.some(h => String(h.id) === hamlet) ? hamlet : '';
  const effective = selected || String(hamlets.find(h => h.is_default)?.id ?? '');
  const choose = (value: string) => {
    activeHamlet = value;
    try {
      window.sessionStorage.setItem(HAMLET_STORAGE_KEY, value);
    } catch {
      /* the selection still applies for this page view */
    }
    setHamlet(value);
  };
  return (
    <>
      {hamlets.length > 1 && (
        <label className="roster-hamlet-picker">
          Ấp{' '}
          <select value={effective} onChange={event => choose(event.target.value)} aria-label="Chọn ấp">
            {hamlets.map(h => (
              <option key={h.id} value={String(h.id)}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <RosterWorkspace
        key={`${selected || 'default'}:${epoch}`}
        hamletName={(() => {
          const current = hamlets.find(h => String(h.id) === effective);
          return current ? current.full_name || current.name : undefined;
        })()}
        {...props}
      />
    </>
  );
}
