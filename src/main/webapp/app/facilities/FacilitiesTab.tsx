import React, { useCallback, useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import '../roster/roster.css';
import '../subjects/subjects.css';
import { useRouteQuery, RECORD_QUERY_KEYS } from '../gis/utils/useRouteQuery';
import { displayDay, errorText } from '../subjects/subjectModel';
import FacilityDetail, { LicenseBadges } from './FacilityDetail';
import { ListExportActions } from '../roster/ListExport';
import {
  FACILITY_TYPES,
  GROUPS,
  fetchFacilities,
  fetchFacility,
  fetchFacilitySummary,
  typeLabel,
  type FacilitySummary,
  type Row,
} from './facilityModel';

/**
 * "Cơ sở kinh doanh & DN": conditional business lines (CSKD có điều kiện về ANTT) and the other businesses and enterprises of
 * the selected hamlet, with licence deadlines, employees, violations, papers and photos.
 */
export default function FacilitiesTab() {
  const { updateQuery } = useRouteQuery();
  const [summary, setSummary] = useState<FacilitySummary | null>(null);
  const [group, setGroup] = useState<'' | 'CONDITIONAL' | 'OTHER'>('CONDITIONAL');
  const [type, setType] = useState('');
  const [due, setDue] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [selected, setSelected] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSummary = useCallback(() => {
    fetchFacilitySummary()
      .then(setSummary)
      .catch(e => setError(errorText(e)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page };
      if (group) params.group = group;
      if (type) params.type = type;
      if (due) params.due = 'LICENSE';
      if (search.trim()) params.search = search.trim();
      const data = await fetchFacilities(params);
      setItems(data.items);
      setTotal(data.total);
      setPageSize(data.pageSize || 30);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [group, type, due, search, page]);

  useEffect(loadSummary, [loadSummary]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const open = async (id: string) => {
    try {
      setSelected(await fetchFacility(id));
    } catch (e) {
      setError(errorText(e));
    }
  };
  const changed = (facility: Row) => {
    setSelected(facility);
    loadSummary();
    void load();
  };
  // Name, trade, licence and owner live on the household record: open its editor in the roster.
  const editHousehold = (id: string) =>
    updateQuery({ tab: 'households', ...RECORD_QUERY_KEYS, household: id, edit: 'true', page: null, section: null, rosterTab: null });

  const count = (code: string) =>
    code === 'CONDITIONAL' ? summary?.conditional : code === 'OTHER' ? summary?.other : (summary?.conditional ?? 0) + (summary?.other ?? 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="roster-page roster-embedded facilities-page">
      <div className="roster-heading">
        <div className="roster-heading-icon" aria-hidden="true">
          <Store size={22} />
        </div>
        <div className="roster-heading-main">
          <h2 className="roster-title">Cơ sở kinh doanh &amp; doanh nghiệp</h2>
          <p>
            Cơ sở kinh doanh có điều kiện về ANTT và các cơ sở, doanh nghiệp trên địa bàn. Cảnh báo giấy phép hết hạn trước{' '}
            {summary?.licenseWarningDays ?? 30} ngày. Thêm cơ sở mới ở Danh sách hộ dân, chọn loại hình cơ sở.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="roster-error">
          {error}
        </div>
      )}

      <div className="subject-summary" role="group" aria-label="Nhóm cơ sở">
        {GROUPS.map(g => (
          <button
            key={g.code || 'all'}
            aria-pressed={group === g.code}
            onClick={() => {
              setGroup(g.code);
              setPage(0);
            }}
          >
            <span className="subject-count">{count(g.code) ?? '…'}</span> {g.label}
          </button>
        ))}
      </div>
      <div className="subject-summary subject-summary--due" role="group" aria-label="Lọc theo hạn giấy phép">
        <button
          aria-pressed={due}
          onClick={() => {
            setDue(!due);
            setPage(0);
          }}
        >
          <span className="subject-count">{summary?.license_due ?? 0}</span> Giấy phép hết / sắp hết hạn
        </button>
      </div>

      <div className={`roster-workspace ${selected ? 'has-selection' : ''}`}>
        <div className="roster-list-pane" aria-label="Danh sách cơ sở">
          <section>
            <div className="roster-actions roster-filter-bar">
              <label className="roster-filter-search">
                Tìm tên cơ sở, địa chỉ, chủ cơ sở, số giấy phép
                <input
                  type="search"
                  value={search}
                  maxLength={100}
                  onChange={e => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label className="roster-filter-select">
                Loại hình
                <select
                  value={type}
                  onChange={e => {
                    setType(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tất cả</option>
                  {FACILITY_TYPES.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="roster-actions roster-list-export">
                <ListExportActions
                  base="/api/facilities"
                  fallbackName="danh-sach-co-so.xlsx"
                  params={{
                    ...(group ? { group } : {}),
                    ...(type ? { type } : {}),
                    ...(due ? { due: 'LICENSE' } : {}),
                    ...(search.trim() ? { search: search.trim() } : {}),
                  }}
                />
              </div>
            </div>
            <div className="roster-table">
              <table>
                <thead>
                  <tr>
                    <th className="roster-num">STT</th>
                    <th>Tên cơ sở</th>
                    <th>Loại hình / ngành nghề</th>
                    <th>Địa chỉ</th>
                    <th>Chủ / người đại diện</th>
                    <th>Số giấy phép</th>
                    <th>Hạn giấy phép</th>
                    <th className="roster-num">Nhân viên</th>
                    <th className="roster-num">Vi phạm</th>
                    <th>Cảnh báo</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((f, index) => (
                    <tr key={f.id} className="roster-table-row" data-selected={selected?.id === f.id} onClick={() => void open(f.id)}>
                      <td data-label="STT" className="roster-num">
                        {page * pageSize + index + 1}
                      </td>
                      <td className="roster-cell-identity">
                        <button
                          className="roster-row-link"
                          onClick={e => {
                            e.stopPropagation();
                            void open(f.id);
                          }}
                        >
                          {f.business_name || 'Chưa có tên'}
                        </button>
                      </td>
                      <td data-label="Loại hình">
                        {typeLabel(f.type)}
                        {f.business_category ? <span className="roster-subline"> · {f.business_category}</span> : null}
                      </td>
                      <td data-label="Địa chỉ" className="roster-cell-address">
                        {f.raw_address}
                      </td>
                      <td data-label="Chủ / đại diện">{f.representative_name || '—'}</td>
                      <td data-label="Số giấy phép">{f.license_number || '—'}</td>
                      <td data-label="Hạn giấy phép">{f.license_expiry_on ? displayDay(f.license_expiry_on) : '—'}</td>
                      <td data-label="Nhân viên" className="roster-num">
                        {f.employee_count}
                      </td>
                      <td data-label="Vi phạm" className="roster-num">
                        {f.violation_count}
                      </td>
                      <td data-label="Cảnh báo">
                        <span className="subject-badges">
                          <LicenseBadges facility={f} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && items.length === 0 && <p>Không có cơ sở phù hợp trong địa bàn được giao.</p>}
            <div className="roster-actions roster-pagination-bar">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                Trang trước
              </button>
              <span>
                Trang {page + 1}/{pages} · {total} cơ sở
              </span>
              <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
                Trang sau
              </button>
            </div>
          </section>
        </div>
        {selected && (
          <div className="roster-detail-pane" tabIndex={-1}>
            <FacilityDetail
              facility={selected}
              canManage={summary?.canManage ?? false}
              canEditHousehold={summary?.canEditHousehold ?? false}
              onChanged={changed}
              onEditHousehold={editHousehold}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
