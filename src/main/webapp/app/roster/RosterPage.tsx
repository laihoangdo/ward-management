import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './roster.css';
import { displayDate } from './dateDisplay';
import { House, Users } from 'lucide-react';
import { localRasterRequest } from '../gis/utils/localRasterRequest';

type Row = Record<string, any>;
type Field = { key: string; label: string; type?: string; options?: string[][]; required?: boolean };
const api = '/api/roster';
const text = (v: unknown): string =>
  v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? `${v}` : JSON.stringify(v);
const kinds = [
  ['PERMANENT', 'Thường trú'],
  ['TEMPORARY', 'Tạm trú'],
  ['NOHT', 'Khai báo nơi ở hiện tại'],
  ['ARTICLE19', 'Nguồn Đ19'],
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
const householdFields: Field[] = [
  { key: 'rawAddress', label: 'Địa chỉ nguyên bản', required: true },
  { key: 'representative', label: 'Tên chủ hộ / người đại diện theo nguồn' },
  { key: 'phone', label: 'Số điện thoại' },
];
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
        <p>Địa bàn quản lý: Trung Chánh 2. Bỏ trống thông tin chưa biết; vị trí hộ được tạo tạm trong ranh TC2.</p>
        {error && (
          <div role="alert" className="roster-error">
            {error}
          </div>
        )}
        <form
          onSubmit={e => {
            e.preventDefault();
            setReview(true);
          }}
        >
          {!review ? (
            <div className="roster-fields">
              {fields.map(f => (
                <label key={f.key}>
                  {f.label}
                  {f.required && ' *'}
                  {f.options ? (
                    <select disabled={readOnly} value={text(data[f.key])} onChange={e => setData({ ...data, [f.key]: e.target.value })}>
                      {f.options.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'checkbox' ? (
                    <input type="checkbox" checked={Boolean(data[f.key])} onChange={e => setData({ ...data, [f.key]: e.target.checked })} />
                  ) : (
                    <input
                      required={f.required}
                      readOnly={readOnly}
                      type={f.type ?? 'text'}
                      value={text(data[f.key])}
                      maxLength={2000}
                      onChange={e => setData({ ...data, [f.key]: e.target.value })}
                    />
                  )}
                </label>
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
                  {fields.map(f => (
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

function RosterMap({ onSelect }: { onSelect: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let map: maplibregl.Map | undefined;
    let disposed = false;
    axios
      .get(`${api}/map`)
      .then(({ data }) => {
        if (disposed || !containerRef.current) return;
        map = new maplibregl.Map({
          container: containerRef.current,
          center: [106.59, 10.84],
          zoom: 14,
          transformRequest: localRasterRequest,
          style: {
            version: 8,
            sources: {
              base: {
                type: 'raster',
                tiles: [`${location.origin}/content/assets/badiem_satellite/{z}/{x}/{y}.jpg`],
                tileSize: 256,
                minzoom: 5,
                maxzoom: 18,
                bounds: [106.5, 10.79, 106.63, 10.91],
                attribution: 'Ảnh vệ tinh hiện có của dự án',
              },
            },
            layers: [
              { id: 'ground', type: 'background', paint: { 'background-color': '#e2e8f0' } },
              { id: 'base', type: 'raster', source: 'base' },
            ],
          },
        });
        map.addControl(new maplibregl.NavigationControl());
        map.on('load', () => {
          if (!map) return;
          map.addSource('boundary', {
            type: 'geojson',
            data: data.boundary.type === 'Feature' ? data.boundary : { type: 'Feature', properties: {}, geometry: data.boundary },
          });
          map.addLayer({ id: 'boundary', type: 'line', source: 'boundary', paint: { 'line-color': '#facc15', 'line-width': 2 } });
          map.addSource('households', { type: 'geojson', data: { type: 'FeatureCollection', features: data.features } });
          map.addLayer({
            id: 'households',
            type: 'circle',
            source: 'households',
            paint: { 'circle-radius': 5, 'circle-color': '#fb923c', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 },
          });
          const bounds = new maplibregl.LngLatBounds();
          data.features.forEach((f: Row) => bounds.extend(f.geometry.coordinates));
          if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 35, maxZoom: 16 });
          map.on('click', 'households', e => {
            const id = e.features?.[0]?.properties?.id;
            if (id) onSelect(id);
          });
        });
      })
      .catch(e => setError(errorMessage(e)));
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [onSelect]);
  return (
    <section>
      <p className="roster-notice">
        Điểm màu cam là tọa độ random trong ranh TC2, chưa xác minh và chưa liên kết khối nhà. Địa chỉ chỉ tạo seed ổn định, không suy ra
        GPS thực tế.
      </p>
      {error && <p role="alert">{error}</p>}
      <div ref={containerRef} className="roster-map" />
    </section>
  );
}

export default function RosterPage({
  initialTab = 'households',
  embedded = false,
  searchQuery,
  onSearchChange,
  refreshKey = 0,
}: {
  initialTab?: string;
  embedded?: boolean;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  refreshKey?: number;
}) {
  const [tab, setTab] = useState(initialTab);
  const [urlParams] = useSearchParams();
  const [kind, setKind] = useState('');
  const [category, setCategory] = useState('');
  const [origin, setOrigin] = useState('');
  const [detailEvents, setDetailEvents] = useState<Row[]>([]);
  const [detailHistoryPage, setDetailHistoryPage] = useState(0);
  const [historyTarget, setHistoryTarget] = useState<{ type: string; id: string } | null>(null);
  const [houseChoices, setHouseChoices] = useState<Row[]>([]);
  const [houseSearch, setHouseSearch] = useState('');
  const [linkPerson, setLinkPerson] = useState<Row | null>(null);
  const [transferMembership, setTransferMembership] = useState<Row | null>(null);
  const [overview, setOverview] = useState<Row>({});
  const [list, setList] = useState<{ tab: string; items: Row[]; total: number }>({ tab: '', items: [], total: 0 });
  const items = list.tab === tab ? list.items : [];
  const total = list.tab === tab ? list.total : 0;
  const [page, setPage] = useState(0);
  const [search, setLocalSearch] = useState(searchQuery ?? '');
  const setSearch = (value: string) => {
    setLocalSearch(value);
    onSearchChange?.(value);
  };
  useEffect(() => {
    if (searchQuery !== undefined) {
      setLocalSearch(searchQuery);
      setPage(0);
    }
  }, [searchQuery]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequestRef = useRef(0);
  const detailRef = useRef<HTMLElement>(null);
  const [household, setHousehold] = useState<Row | null>(null);
  const [person, setPerson] = useState<Row | null>(null);
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
  useEffect(() => {
    detailRequestRef.current += 1;
    setDetailOpen(false);
    setDetailLoading(false);
    setHistoryTarget(null);
    setLinkPerson(null);
    setTransferMembership(null);
    setTab(initialTab);
    setPage(0);
    setSearch('');
    setPerson(null);
    setHousehold(null);
  }, [initialTab]);
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
    detailRequestRef.current += 1;
    setDetailOpen(false);
    setDetailLoading(false);
    setHousehold(null);
    setPerson(null);
    clearDetailActions();
  };
  const loadHouse = React.useCallback(async (id: string) => {
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
      setTab('households');
    } finally {
      if (request === detailRequestRef.current) setDetailLoading(false);
    }
  }, []);
  const loadPerson = async (id: string) => {
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
    const { data } = await axios.get(`${api}/collections/${id}`);
    setCollection(data);
    setSourcePage(0);
  };
  useEffect(() => {
    run(async () => {
      await refresh();
      const legacyId = urlParams.get('legacyHousehold');
      if (legacyId && /^\d+$/.test(legacyId)) {
        const { data } = await axios.get(`${api}/legacy-households/${legacyId}`);
        setHousehold(data);
        setDetailOpen(true);
      }
    });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (tab === 'households' || tab === 'residents')
      axios
        .get(`${api}/${tab}`, { params: { page, search, kind, origin, category }, signal: controller.signal })
        .then(({ data }) => {
          if (controller.signal.aborted) return;
          setList({ tab, items: data.items, total: data.total });
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
  }, [tab, page, search, message, kind, origin, category, refreshKey]);
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
  const done = async (msg: string) => {
    setMessage(`${msg} · ${new Date().toLocaleTimeString()}`);
    await refresh();
    if (household) {
      const { data } = await axios.get(`${api}/households/${household.id}`);
      setHousehold(data);
    }
  };
  const editHouse = () => {
    if (!household) return;
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
        version: household.version,
      },
      async save(r) {
        await axios.put(`${api}/households/${selectedHousehold.id}`, r);
        await done('Đã cập nhật hộ');
      },
    });
  };
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
  const transfer = (m: Row) => {
    setTransferMembership(m);
    setHouseChoices([]);
    setHouseSearch('');
  };
  const householdDetail = household && (
    <section className="roster-detail">
      <h2>
        {household.code} · {household.raw_address}
      </h2>
      <p>
        Vị trí: {household.coordinate_method === 'RANDOM_WITHIN_TC2' ? 'Random tạm trong TC2 — chưa xác minh' : household.coordinate_method}
        . Tên đại diện nguồn chưa mặc nhiên là chủ hộ đã xác minh.
      </p>
      <button onClick={editHouse}>Sửa hộ</button>
      <button onClick={() => run(() => showHistory('household', household.id, 0))}>Lịch sử hộ</button>
      <p>
        {household.origin === 'EXCEL' ? 'Khởi tạo từ dữ liệu Excel gốc của ấp' : 'Khởi tạo trực tiếp'} ·{' '}
        {household.source_case_number
          ? 'Có HSCT nguồn (chưa đồng nghĩa đã xác minh hộ thực tế)'
          : 'Chưa có HSCT; cần đối soát hộ/nhóm địa chỉ'}
      </p>
      <h3>Thành viên và hồ sơ</h3>
      {household.members.map((m: Row) => (
        <div className="roster-row" key={m.membership_id}>
          <button onClick={() => run(() => loadPerson(m.id))}>{m.full_name}</button>
          <span>
            {displayDate(m.birth_date) || m.birth_year || 'Chưa rõ năm sinh'} ·{' '}
            {m.is_head ? 'Chủ hộ' : m.relationship_code || 'Quan hệ chưa rõ'} ·{' '}
            {m.valid_to ? `Đã kết thúc ${m.valid_to}` : 'Thành viên hiện hành'}
          </span>
          <button
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
      <h3>Thêm nhân khẩu</h3>
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
        <button onClick={() => addMember()}>Tạo người mới</button>
      </div>
      {candidates.map(c => (
        <div className="roster-row" key={c.id}>
          {c.full_name} · {displayDate(c.birth_date) || c.birth_year}
          <button onClick={() => addMember(c)}>Dùng hồ sơ này</button>
        </div>
      ))}
      <details>
        <summary>Nguồn ban đầu của hộ ({household.sources.length} dòng)</summary>
        {household.sources.map((s: Row) => (
          <div key={s.id}>
            {s.file_name} · {s.sheet} · dòng {s.row_number} <button onClick={() => run(() => openSource(s.id))}>Xem nguồn</button>
          </div>
        ))}
      </details>
    </section>
  );
  const personDetail = person && (
    <section className="roster-detail">
      <h2>{person.full_name}</h2>
      <details>
        <summary>Giấy tờ định danh ({person.identities.length})</summary>
        {person.identities.map((i: Row) => (
          <p key={i.id}>
            {i.document_type} · {i.number} · {i.verified ? 'Đã đối chiếu' : 'Chưa xác minh'} · {i.active ? 'Đang dùng' : 'Đã thay thế'}
          </p>
        ))}
      </details>
      <button onClick={() => run(() => showHistory('resident', person.id, 0))}>Lịch sử cá nhân</button>
      <button
        onClick={() => {
          setLinkPerson(person);
          setHouseChoices([]);
          setHouseSearch('');
        }}
      >
        Gắn vào hộ có sẵn
      </button>
      <h3>Quan hệ hộ theo thời gian</h3>
      {(person.memberships || []).map((m: Row) => (
        <div className="roster-row" key={m.id}>
          <button onClick={() => run(() => loadHouse(m.household_id))}>{m.code}</button>
          <span>
            {m.raw_address} · {m.relationship_code || 'Quan hệ chưa rõ'} · {m.is_head ? 'Chủ hộ' : ''} ·{' '}
            {m.valid_from || 'Chưa rõ ngày bắt đầu'} → {m.valid_to || 'Hiện hành'}
          </span>
          <button
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
          {!m.valid_to && <button onClick={() => transfer(m)}>Chuyển sang hộ khác</button>}
        </div>
      ))}
      <p>
        {displayDate(person.birth_date) || `Năm sinh: ${person.birth_year || 'Chưa rõ'}`} · Nguồn {person.origin} ·{' '}
        {person.birth_date_precision === 'YEAR' ? 'Chỉ biết năm sinh' : ''}
      </p>
      <button
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
      <h3>Các hồ sơ cư trú</h3>
      <div className="roster-actions">
        <button
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
      </div>
      {person.records.map((r: Row) => (
        <div className="roster-detail" key={r.id}>
          <div>
            {kinds.find(k => k[0] === r.record_kind)?.[1]} · Ngày đăng ký {r.registration_date || 'chưa rõ'} · Hạn {r.valid_to || 'chưa rõ'}{' '}
            {r.expiry_status === 'EXPIRED' ? '(đã qua hạn)' : ''}
          </div>
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
          {r.addresses.map((a: Row) => (
            <div key={`${a.id}-${a.address_role}`}>
              {
                {
                  permanentAddress: 'Thường trú',
                  temporaryAddress: 'Tạm trú',
                  currentAddress: 'Hiện tại',
                  declaredAddress: 'Khai báo',
                  previousAddress: 'Trước khi đến',
                }[a.address_role]
              }
              : {a.raw_address}
            </div>
          ))}
          <button
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
      ))}
      <button
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
      <div>
        {person.verifications.map((v: Row) => (
          <p key={v.id}>
            {v.observed_at || 'Chưa rõ ngày nguồn'} · {v.presence_status} · {v.method}
          </p>
        ))}
      </div>
      <details>
        <summary>Nguồn cá nhân ({person.sources.length} dòng)</summary>
        {person.sources.map((s: Row) => (
          <div key={s.id}>
            {s.file_name} · {s.sheet} · dòng {s.row_number} <button onClick={() => run(() => openSource(s.id))}>Xem nguồn</button>
          </div>
        ))}
      </details>
    </section>
  );
  const detailActions = (
    <>
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
  return (
    <main className={`roster-page ${embedded ? 'roster-embedded' : ''}`}>
      <div className="roster-heading">
        <div className="roster-heading-icon" aria-hidden="true">
          {tab === 'households' ? <House size={23} /> : <Users size={23} />}
        </div>
        <div>
          {!embedded && <Link to="/dashboard">← Về dashboard</Link>}
          <div className="roster-eyebrow">QUẢN LÝ DÂN CƯ</div>
          <h1>{tab === 'households' ? 'Danh sách hộ dân' : tab === 'residents' ? 'Quản lý nhân khẩu' : 'Hồ sơ dân cư'} · Trung Chánh 2</h1>
          <p>Dữ liệu gốc từ ấp Trung Chánh 2 · Có nguồn và lịch sử thay đổi</p>
        </div>
      </div>
      <nav className="roster-tabs">
        {[
          ['households', 'Danh sách hộ dân'],
          ['residents', 'Quản lý nhân khẩu'],
          ['import', 'Nhập Excel / đối soát'],
          ['map', 'Vị trí tạm'],
          ['history', 'Lịch sử & báo cáo'],
        ].map(([v, l]) => (
          <button
            key={v}
            aria-pressed={tab === v}
            onClick={() => {
              closeDetail();
              setTab(v);
              setPage(0);
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
      {(tab === 'households' || tab === 'residents') && (
        <div className={`roster-workspace ${detailOpen ? 'has-selection' : ''}`}>
          <section
            className="roster-list-pane"
            aria-label={tab === 'households' ? 'Danh sách hộ dân' : 'Danh sách nhân khẩu'}
            tabIndex={-1}
          >
            {tab === 'residents' && (
              <section>
                <p>Tìm người trước khi tạo mới. Một cá nhân có thể có nhiều hồ sơ cư trú; danh sách này đếm mỗi người một lần.</p>
                <div className="roster-actions">
                  <label>
                    Tìm họ tên hoặc ĐDCN / CCCD / CMND
                    <input
                      value={search}
                      onChange={e => {
                        setSearch(e.target.value);
                        setPage(0);
                      }}
                    />
                  </label>
                  <label>
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
                  <label>
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
                <div className="roster-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Họ tên</th>
                        <th>Ngày / năm sinh</th>
                        <th>Hộ hiện hành</th>
                        <th>Hồ sơ cư trú</th>
                        <th>Nguồn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(r => (
                        <tr key={r.id} data-selected={detailOpen && person?.id === r.id}>
                          <td>
                            <button onClick={() => run(() => loadPerson(r.id))}>{r.full_name}</button>
                          </td>
                          <td>
                            {displayDate(r.birth_date) || r.birth_year || 'Chưa rõ'}
                            {r.birth_date_precision === 'YEAR' && ' (chỉ biết năm)'}
                          </td>
                          <td>{r.household_count}</td>
                          <td>{r.record_count}</td>
                          <td>{r.origin === 'EXCEL' ? 'Excel gốc' : 'Nhập trực tiếp'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {items.length === 0 && <p>Không có kết quả trong phạm vi được giao.</p>}
                <div className="roster-actions">
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
                <div className="roster-actions">
                  <label>
                    Tìm hộ theo địa chỉ, tên đại diện, mã hoặc HSCT
                    <input
                      value={search}
                      onChange={e => {
                        setPage(0);
                        setSearch(e.target.value);
                      }}
                    />
                  </label>
                  <label>
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
                  <label>
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
                  <button
                    className="roster-primary"
                    onClick={() =>
                      setEditor({
                        title: 'Tạo hộ mới',
                        fields: [...householdFields, { key: 'caseNumber', label: 'HSCT (nếu có)' }, reason],
                        initial: {},
                        async save(r) {
                          const { data } = await axios.post(`${api}/households`, r);
                          await loadHouse(data.id);
                          await done('Đã tạo hộ');
                        },
                      })
                    }
                  >
                    + Thêm hộ
                  </button>
                </div>
                <div className="roster-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Mã / HSCT</th>
                        <th>Chủ hộ / đại diện nguồn</th>
                        <th>Địa chỉ</th>
                        <th>Thành viên đã nhập</th>
                        <th>Nguồn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(h => (
                        <tr key={h.id} data-selected={detailOpen && household?.id === h.id}>
                          <td>
                            <button onClick={() => run(() => loadHouse(h.id))}>
                              {h.source_case_number ||
                                (typeof h.code !== 'string' || !h.code
                                  ? 'Chưa có mã hộ'
                                  : h.origin === 'MANUAL'
                                    ? h.code
                                    : `Nhóm ${h.code.slice(-8)}`)}
                            </button>
                            <div>{h.source_case_number ? 'HSCT nguồn' : 'Chưa có HSCT'}</div>
                          </td>
                          <td>{h.representative_name || 'Chưa rõ'}</td>
                          <td>{h.raw_address}</td>
                          <td>{h.member_count}</td>
                          <td>
                            {h.origin === 'EXCEL' ? 'Excel' : 'Nhập trực tiếp'} ·{' '}
                            {h.verification_status === 'HEAD_CONFLICT'
                              ? 'Cần đối soát tên chủ hộ'
                              : h.verification_status === 'UNVERIFIED'
                                ? 'Chưa xác minh'
                                : h.verification_status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="roster-actions">
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
          {detailOpen && (
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
      {tab === 'map' && (
        <RosterMap
          onSelect={id => {
            run(() => loadHouse(id));
          }}
        />
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
            <a href={`${api}/report.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}>Xuất CSV mở bằng Excel</a>
            <a href={`${api}/report-detail.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}>Xuất chi tiết trước / sau</a>
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
          onClose={() => setEditor(null)}
          readOnly={editor.readOnly}
        />
      )}
    </main>
  );
}
