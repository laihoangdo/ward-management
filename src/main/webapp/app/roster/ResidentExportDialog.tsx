import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { FileSpreadsheet, Printer, X } from 'lucide-react';
import {
  activeFilterCount,
  emptyFilter,
  ExportFilter,
  ExportOptions,
  ExportResult,
  facilityOptions,
  loadSavedPresets,
  presets,
  residenceKinds,
  SavedPreset,
  sortOptions,
  storeSavedPresets,
  toParams,
} from './residentExport';
import ResidentPrintView from './ResidentPrintView';
import './residentExport.css';

const api = '/api/roster/residents/export';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const errorText = async (error: unknown): Promise<string> => {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response;
  let data = response?.data;
  if (data instanceof Blob) {
    try {
      data = JSON.parse(await data.text());
    } catch {
      data = null;
    }
  }
  const message = (data as { message?: string; detail?: string } | null)?.detail ?? (data as { message?: string } | null)?.message;
  if (response?.status === 403) return message ?? 'Bạn chưa được cấp quyền xuất danh sách này.';
  return message ?? 'Không tải được danh sách. Kiểm tra kết nối rồi thử lại.';
};

const fileNameFrom = (header: string | undefined, fallback: string) => {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return header?.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
};

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter(x => x !== value) : [...list, value]);

/** Filter, preview, download (.xlsx) and print a resident list. The server re-checks permission, territory and limits. */
export default function ResidentExportDialog({
  initial,
  hamletLabel,
  onClose,
}: {
  initial?: Partial<ExportFilter>;
  hamletLabel?: string;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<ExportFilter>(() => ({ ...emptyFilter(), ...initial }));
  const [options, setOptions] = useState<ExportOptions | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [fullIdentity, setFullIdentity] = useState(false);
  const [preview, setPreview] = useState<ExportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'' | 'xlsx' | 'print'>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [printData, setPrintData] = useState<ExportResult | null>(null);
  const [printParams, setPrintParams] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<SavedPreset[]>(() => loadSavedPresets());
  const [presetName, setPresetName] = useState('');
  const quick = useMemo(() => presets(), []);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    let cancelled = false;
    axios
      .get<ExportOptions>(`${api}/options`)
      .then(({ data }) => {
        if (cancelled) return;
        const safe: ExportOptions = {
          columns: Array.isArray(data?.columns) ? data.columns : [],
          defaultColumns: Array.isArray(data?.defaultColumns) ? data.defaultColumns : [],
          classifications: Array.isArray(data?.classifications) ? data.classifications : [],
          canExportCommune: data?.canExportCommune === true,
          canRevealIdentity: data?.canRevealIdentity === true,
          limit: typeof data?.limit === 'number' ? data.limit : 20000,
        };
        setOptions(safe);
        setColumns(safe.defaultColumns);
      })
      .catch(async e => !cancelled && setError(await errorText(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !printData) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, printData]);

  // A commune-wide list always says which hamlet each person belongs to.
  const effectiveColumns = useMemo(
    () => (filter.scope === 'commune' && !columns.includes('hamlet') ? [...columns, 'hamlet'] : columns),
    [columns, filter.scope],
  );
  const params = useMemo(() => toParams(filter, effectiveColumns), [filter, effectiveColumns]);

  // Live preview, 400 ms after the last change; older answers are dropped.
  useEffect(() => {
    if (!options) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      axios
        .get<ExportResult>(`${api}/preview`, { params, signal: controller.signal })
        .then(({ data }) => {
          setPreview(data);
          setError('');
        })
        .catch(async e => {
          if (!axios.isCancel?.(e) && e?.name !== 'CanceledError') setError(await errorText(e));
        })
        .finally(() => !controller.signal.aborted && setLoading(false));
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [params, options]);

  const set = <K extends keyof ExportFilter>(key: K, value: ExportFilter[K]) => setFilter(current => ({ ...current, [key]: value }));
  const overLimit = !!(preview && options && preview.total > options.limit);
  const empty = preview?.total === 0;
  const reveal = fullIdentity && options?.canRevealIdentity === true && effectiveColumns.includes('identity');

  const download = async () => {
    setBusy('xlsx');
    setError('');
    setNotice('');
    try {
      const response = await axios.get(`${api}/xlsx`, {
        params: { ...params, ...(reveal ? { fullIdentity: 'true' } : {}) },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileNameFrom(response.headers?.['content-disposition'] as string | undefined, 'danh-sach-nhan-khau.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Đã tải file Excel. Lần xuất này đã được ghi vào nhật ký.');
    } catch (e) {
      setError(await errorText(e));
    } finally {
      setBusy('');
    }
  };

  const openPrint = async () => {
    setBusy('print');
    setError('');
    try {
      const request = { ...params, ...(reveal ? { fullIdentity: 'true' } : {}) };
      const { data } = await axios.get<ExportResult>(`${api}/print`, { params: request });
      setPrintParams(request);
      setPrintData(data);
    } catch (e) {
      setError(await errorText(e));
    } finally {
      setBusy('');
    }
  };

  // The same list as the open print view, as an Excel file for the device's share sheet; audited as a shared export.
  const loadShareFile = async (): Promise<File> => {
    try {
      const response = await axios.get(`${api}/xlsx`, { params: { ...printParams, purpose: 'share' }, responseType: 'blob' });
      const name = fileNameFrom(response.headers?.['content-disposition'] as string | undefined, 'danh-sach-nhan-khau.xlsx');
      return new File([response.data as Blob], name, { type: XLSX_TYPE });
    } catch (e) {
      throw new Error(await errorText(e), { cause: e });
    }
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    // The name/ID search box is never remembered: it would keep personal data in the browser.
    const next = [{ name, filter: { ...filter, search: '' }, columns }, ...saved.filter(p => p.name !== name)];
    if (storeSavedPresets(next)) {
      setSaved(next);
      setPresetName('');
      setNotice(`Đã lưu mẫu "${name}" trên trình duyệt này.`);
    } else setError('Trình duyệt không cho lưu mẫu; bộ lọc hiện tại vẫn dùng được.');
  };

  const removePreset = (name: string) => {
    const next = saved.filter(p => p.name !== name);
    if (storeSavedPresets(next)) setSaved(next);
  };

  const count = activeFilterCount(filter);

  return (
    <div className="roster-overlay">
      <section role="dialog" aria-modal="true" aria-labelledby="resident-export-title" className="roster-dialog roster-export">
        <div className="roster-export-head">
          <h2 id="resident-export-title" tabIndex={-1} ref={titleRef}>
            Xuất / in danh sách nhân khẩu
          </h2>
          <button type="button" className="roster-export-close" aria-label="Đóng" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="roster-export-presets" role="group" aria-label="Mẫu lọc nhanh">
          {quick.map(p => (
            <button key={p.id} type="button" className="roster-chip" onClick={() => setFilter(current => p.apply(current))}>
              {p.label}
            </button>
          ))}
        </div>
        {saved.length > 0 && (
          <div className="roster-export-presets" role="group" aria-label="Mẫu của tôi">
            <span className="roster-export-muted">Mẫu của tôi:</span>
            {saved.map(p => (
              <span key={p.name} className="roster-chip roster-chip--saved">
                <button
                  type="button"
                  onClick={() => {
                    setFilter({ ...p.filter, scope: options?.canExportCommune ? p.filter.scope : '' });
                    setColumns(p.columns);
                  }}
                >
                  {p.name}
                </button>
                <button type="button" aria-label={`Xóa mẫu ${p.name}`} onClick={() => removePreset(p.name)}>
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="roster-error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="roster-export-notice">
            {notice}
          </div>
        )}

        <div className="roster-export-body">
          <form className="roster-export-filters" onSubmit={e => e.preventDefault()} aria-label="Điều kiện lọc">
            <fieldset>
              <legend>Phạm vi</legend>
              <label className="roster-check">
                <input type="radio" name="export-scope" checked={filter.scope === ''} onChange={() => set('scope', '')} />{' '}
                {hamletLabel || 'Ấp đang chọn'}
              </label>
              {options?.canExportCommune && (
                <label className="roster-check">
                  <input type="radio" name="export-scope" checked={filter.scope === 'commune'} onChange={() => set('scope', 'commune')} />{' '}
                  Toàn xã (các ấp được giao)
                </label>
              )}
            </fieldset>

            <fieldset>
              <legend>Cư trú</legend>
              <div className="roster-export-checks">
                {residenceKinds.map(([value, label]) => (
                  <label key={value} className="roster-check">
                    <input
                      type="checkbox"
                      checked={filter.kinds.includes(value)}
                      onChange={() => set('kinds', toggle(filter.kinds, value))}
                    />{' '}
                    {label}
                  </label>
                ))}
              </div>
              <div className="roster-export-grid">
                <label>
                  Tình trạng hồ sơ
                  <select value={filter.status} onChange={e => set('status', e.target.value as ExportFilter['status'])}>
                    <option value="ACTIVE">Đang còn hiệu lực</option>
                    <option value="ENDED">Đã hết hiệu lực</option>
                    <option value="">Tất cả</option>
                  </select>
                </label>
                <label>
                  Tạm trú sắp hết hạn
                  <select value={filter.expiringDays} onChange={e => set('expiringDays', e.target.value as ExportFilter['expiringDays'])}>
                    <option value="">Không lọc</option>
                    <option value="7">Trong 7 ngày</option>
                    <option value="15">Trong 15 ngày</option>
                    <option value="30">Trong 30 ngày</option>
                  </select>
                </label>
                <label>
                  Đăng ký từ ngày
                  <input type="date" value={filter.registeredFrom} onChange={e => set('registeredFrom', e.target.value)} />
                </label>
                <label>
                  Đến ngày
                  <input type="date" value={filter.registeredTo} onChange={e => set('registeredTo', e.target.value)} />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Nhân thân</legend>
              <div className="roster-export-grid">
                <label>
                  Giới tính
                  <select value={filter.gender} onChange={e => set('gender', e.target.value as ExportFilter['gender'])}>
                    <option value="">Tất cả</option>
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                  </select>
                </label>
                <label>
                  Giấy tờ định danh
                  <select value={filter.identity} onChange={e => set('identity', e.target.value as ExportFilter['identity'])}>
                    <option value="">Tất cả</option>
                    <option value="HAS">Đã có</option>
                    <option value="NONE">Chưa có</option>
                  </select>
                </label>
                <label>
                  Tuổi từ
                  <input
                    type="number"
                    min={0}
                    max={130}
                    inputMode="numeric"
                    value={filter.ageMin}
                    onChange={e => set('ageMin', e.target.value)}
                  />
                </label>
                <label>
                  Đến tuổi
                  <input
                    type="number"
                    min={0}
                    max={130}
                    inputMode="numeric"
                    value={filter.ageMax}
                    onChange={e => set('ageMax', e.target.value)}
                  />
                </label>
                <label>
                  Tính tuổi đến ngày
                  <input
                    type="date"
                    value={filter.refDate}
                    onChange={e => set('refDate', e.target.value)}
                    aria-describedby="export-age-hint"
                  />
                </label>
                <span id="export-age-hint" className="roster-export-muted roster-export-hint">
                  Để trống là hôm nay. Lọc theo tuổi chỉ áp dụng cho người có đủ ngày sinh.
                </span>
                <label>
                  Năm sinh từ
                  <input
                    type="number"
                    min={1880}
                    max={2200}
                    inputMode="numeric"
                    value={filter.birthYearFrom}
                    onChange={e => set('birthYearFrom', e.target.value)}
                  />
                </label>
                <label>
                  Đến năm
                  <input
                    type="number"
                    min={1880}
                    max={2200}
                    inputMode="numeric"
                    value={filter.birthYearTo}
                    onChange={e => set('birthYearTo', e.target.value)}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Hộ và địa chỉ</legend>
              <div className="roster-export-grid">
                <label>
                  Vai trò trong hộ
                  <select
                    value={filter.householdRole}
                    onChange={e => set('householdRole', e.target.value as ExportFilter['householdRole'])}
                  >
                    <option value="">Tất cả</option>
                    <option value="HEAD">Chủ hộ</option>
                    <option value="MEMBER">Thành viên (không phải chủ hộ)</option>
                    <option value="NONE">Chưa gắn hộ</option>
                  </select>
                </label>
                <label>
                  Địa chỉ, tên đường hoặc số nhà/hẻm
                  <input
                    type="search"
                    placeholder="VD: Trưng Vương hoặc 36/4"
                    value={filter.address}
                    onChange={e => set('address', e.target.value)}
                  />
                </label>
              </div>
              <div className="roster-export-checks" role="group" aria-label="Loại hình cơ sở của hộ">
                {facilityOptions.map(([value, label]) => (
                  <label key={value} className="roster-check">
                    <input
                      type="checkbox"
                      checked={filter.facilityTypes.includes(value)}
                      onChange={() => set('facilityTypes', toggle(filter.facilityTypes, value))}
                    />{' '}
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Hồ sơ</legend>
              <div className="roster-export-grid">
                <label>
                  Phân loại đặc thù
                  <select value={filter.classification} onChange={e => set('classification', e.target.value)}>
                    <option value="">Tất cả</option>
                    {options?.classifications.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nguồn khởi tạo
                  <select value={filter.origin} onChange={e => set('origin', e.target.value)}>
                    <option value="">Tất cả</option>
                    <option value="EXCEL">Excel gốc</option>
                    <option value="MANUAL">Nhập trực tiếp</option>
                  </select>
                </label>
                <label className="roster-export-wide">
                  Họ tên hoặc số giấy tờ
                  <input type="search" value={filter.search} onChange={e => set('search', e.target.value)} />
                </label>
              </div>
            </fieldset>

            <button
              type="button"
              className="roster-btn-sm"
              disabled={count === 0}
              onClick={() => setFilter({ ...emptyFilter(), scope: filter.scope, sort: filter.sort })}
            >
              Xóa điều kiện lọc{count > 0 ? ` (${count})` : ''}
            </button>
          </form>

          <div className="roster-export-result">
            <div className="roster-export-count" aria-live="polite" aria-busy={loading}>
              {preview ? (
                <>
                  <strong>{preview.total.toLocaleString('vi-VN')}</strong> người khớp
                  <span className="roster-export-muted">
                    {' '}
                    · Nam {preview.male.toLocaleString('vi-VN')} · Nữ {preview.female.toLocaleString('vi-VN')}
                  </span>
                  {loading && <span className="roster-export-muted"> · đang cập nhật…</span>}
                </>
              ) : (
                <span className="roster-export-muted">{loading || !options ? 'Đang đếm…' : 'Chưa có kết quả'}</span>
              )}
            </div>
            {preview && <p className="roster-export-summary">{preview.summary}</p>}
            {preview?.unevaluable != null && preview.unevaluable > 0 && (
              <p className="roster-notice">
                {preview.unevaluable.toLocaleString('vi-VN')} người khớp các điều kiện khác nhưng chưa có đủ ngày sinh nên không xét được
                tuổi. Có thể lọc theo năm sinh để gồm cả họ.
              </p>
            )}
            {preview && filter.scope === 'commune' && preview.byHamlet.length > 0 && (
              <p className="roster-export-muted">
                {preview.byHamlet
                  .filter(h => h.total > 0)
                  .map(h => `${h.hamlet}: ${h.total}`)
                  .join(' · ')}
              </p>
            )}
            {overLimit && (
              <p className="roster-error" role="alert">
                Vượt giới hạn {options?.limit.toLocaleString('vi-VN')} người mỗi lần xuất. Hãy thu hẹp bộ lọc hoặc xuất từng ấp.
              </p>
            )}

            <div className="roster-export-grid">
              <label>
                Sắp xếp
                <select value={filter.sort} onChange={e => set('sort', e.target.value as ExportFilter['sort'])}>
                  {sortOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <details className="roster-export-columns">
              <summary>Cột trong danh sách ({effectiveColumns.filter(c => c !== 'stt').length})</summary>
              <div className="roster-export-checks">
                {options?.columns
                  .filter(c => c.key !== 'stt')
                  .map(c => (
                    <label key={c.key} className="roster-check">
                      <input
                        type="checkbox"
                        checked={effectiveColumns.includes(c.key)}
                        onChange={() => setColumns(toggle(columns, c.key))}
                      />{' '}
                      {c.header}
                    </label>
                  ))}
              </div>
              <button type="button" className="roster-btn-sm" onClick={() => options && setColumns(options.defaultColumns)}>
                Dùng cột mặc định
              </button>
            </details>

            {options?.canRevealIdentity && effectiveColumns.includes('identity') && (
              <label className="roster-check roster-export-reveal">
                <input type="checkbox" checked={fullIdentity} onChange={e => setFullIdentity(e.target.checked)} /> Hiện số định danh đầy đủ
                trong file và bản in (được ghi nhật ký, gửi cảnh báo)
              </label>
            )}

            {preview && preview.rows.length > 0 && (
              <div className="roster-table roster-export-preview">
                <table>
                  <caption className="roster-export-muted">
                    Xem trước {preview.rows.length} / {preview.total.toLocaleString('vi-VN')} dòng
                    {effectiveColumns.includes('identity') ? ' · số định danh được che' : ''}
                  </caption>
                  <thead>
                    <tr>
                      {preview.columns.map(c => (
                        <th key={c.key} scope="col">
                          {c.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {empty && <p className="roster-export-muted">Không có nhân khẩu nào khớp điều kiện đã chọn.</p>}

            <div className="roster-export-save">
              <label>
                Lưu bộ lọc thành mẫu của tôi
                <input
                  value={presetName}
                  maxLength={60}
                  placeholder="Tên mẫu, VD: Rà soát tạm trú tháng"
                  onChange={e => setPresetName(e.target.value)}
                />
              </label>
              <button type="button" className="roster-btn-sm" disabled={!presetName.trim()} onClick={savePreset}>
                Lưu mẫu
              </button>
            </div>

            <div className="roster-actions roster-export-actions">
              <button type="button" onClick={onClose}>
                Đóng
              </button>
              <button type="button" disabled={!preview || empty || overLimit || busy !== ''} onClick={openPrint}>
                <Printer size={16} aria-hidden="true" /> {busy === 'print' ? 'Đang chuẩn bị…' : 'Xem bản in'}
              </button>
              <button type="button" className="roster-primary" disabled={!preview || empty || overLimit || busy !== ''} onClick={download}>
                <FileSpreadsheet size={16} aria-hidden="true" /> {busy === 'xlsx' ? 'Đang tạo file…' : 'Tải Excel'}
              </button>
            </div>
          </div>
        </div>
      </section>
      {printData && <ResidentPrintView data={printData} onClose={() => setPrintData(null)} loadShareFile={loadShareFile} />}
    </div>
  );
}
