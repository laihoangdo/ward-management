import React, { useCallback, useEffect, useState } from 'react';
import { UserSearch } from 'lucide-react';
import '../roster/roster.css';
import './subjects.css';
import type { AppUser } from '../gis/types';
import SubjectDetail, { DueBadges } from './SubjectDetail';
import SubjectForm from './SubjectForm';
import { ListExportActions } from '../roster/ListExport';
import {
  CATEGORIES,
  birthText,
  categoryShort,
  displayDay,
  errorText,
  fetchSubject,
  fetchSubjects,
  fetchSummary,
  subjectAccess,
  type Row,
  type SubjectSummary,
} from './subjectModel';

type Due = '' | 'MANAGEMENT' | 'SUMMON';

/** "Quản lý đối tượng": subjects of the selected hamlet by category, with management and interview deadlines. */
export default function SubjectsTab({ currentUser }: { currentUser: AppUser }) {
  const access = subjectAccess(currentUser);
  const [summary, setSummary] = useState<SubjectSummary | null>(null);
  const [category, setCategory] = useState('');
  const [due, setDue] = useState<Due>('');
  const [status, setStatus] = useState('ACTIVE');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [selected, setSelected] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const political = summary?.canViewPolitical ?? access.political;
  const canManage = summary?.canManage ?? access.manage;
  const canExport = currentUser?.role === 'superadmin' || currentUser?.subAdminPermissions?.canExportReports === true;

  const loadSummary = useCallback(() => {
    fetchSummary()
      .then(setSummary)
      .catch(e => setError(errorText(e)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { status, page };
      if (category) params.category = category;
      if (due) params.due = due;
      if (search.trim()) params.search = search.trim();
      const data = await fetchSubjects(params);
      setItems(data.items);
      setTotal(data.total);
      setPageSize(data.pageSize || 30);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [category, due, status, search, page]);

  useEffect(loadSummary, [loadSummary]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const open = async (id: string) => {
    try {
      setSelected(await fetchSubject(id));
    } catch (e) {
      setError(errorText(e));
    }
  };
  const changed = (subject: Row) => {
    setSelected(subject);
    loadSummary();
    void load();
  };
  const pick = (next: { category?: string; due?: Due }) => {
    if (next.category !== undefined) setCategory(next.category);
    if (next.due !== undefined) setDue(next.due);
    setPage(0);
  };

  const visibleCategories = CATEGORIES.filter(c => political || c.code !== 'CT');
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="roster-page roster-embedded subjects-page">
      <div className="roster-heading">
        <div className="roster-heading-icon" aria-hidden="true">
          <UserSearch size={22} />
        </div>
        <div className="roster-heading-main">
          <h2 className="roster-title">Quản lý đối tượng</h2>
          <p>
            Đối tượng trong địa bàn theo từng hệ. Cảnh báo hết hạn quản lý trước {summary?.managementWarningDays ?? 30} ngày, đến hạn gọi
            hỏi trước {summary?.summonWarningDays ?? 7} ngày.
            {!political && ' Hệ chính trị được ẩn vì tài khoản chưa có quyền riêng.'}
          </p>
        </div>
        {canManage && (
          <div className="roster-actions">
            <button className="roster-primary" onClick={() => setCreating(true)}>
              + Đưa vào diện quản lý
            </button>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="roster-error">
          {error}
        </div>
      )}

      <div className="subject-summary" role="group" aria-label="Lọc theo hệ đối tượng">
        <button aria-pressed={category === ''} onClick={() => pick({ category: '' })}>
          <span className="subject-count">{summary?.active ?? '…'}</span> Tất cả
        </button>
        {visibleCategories.map(c => (
          <button key={c.code} aria-pressed={category === c.code} onClick={() => pick({ category: c.code })} title={c.label}>
            <span className="subject-count">{summary?.byCategory?.[c.code] ?? 0}</span> {c.short}
          </button>
        ))}
      </div>
      <div className="subject-summary subject-summary--due" role="group" aria-label="Lọc theo hạn">
        <button aria-pressed={due === 'MANAGEMENT'} onClick={() => pick({ due: due === 'MANAGEMENT' ? '' : 'MANAGEMENT' })}>
          <span className="subject-count">{summary?.managementDue ?? 0}</span> Hết / sắp hết hạn quản lý
        </button>
        <button aria-pressed={due === 'SUMMON'} onClick={() => pick({ due: due === 'SUMMON' ? '' : 'SUMMON' })}>
          <span className="subject-count">{summary?.summonDue ?? 0}</span> Đến hạn gọi hỏi, răn đe
        </button>
      </div>

      <div className={`roster-workspace ${selected ? 'has-selection' : ''}`}>
        <div className="roster-list-pane" aria-label="Danh sách đối tượng">
          <section>
            <div className="roster-actions roster-filter-bar">
              <label className="roster-filter-search">
                Tìm họ tên hoặc số ĐDCN
                <input
                  type="search"
                  value={search}
                  maxLength={100}
                  placeholder="Họ tên hoặc số giấy tờ"
                  onChange={e => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label className="roster-filter-select">
                Trạng thái
                <select
                  value={status}
                  onChange={e => {
                    setStatus(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="ACTIVE">Đang quản lý</option>
                  <option value="ENDED">Đã kết thúc</option>
                  <option value="ALL">Tất cả</option>
                </select>
              </label>
              {canExport && (
                <div className="roster-actions">
                  <ListExportActions
                    base="/api/subjects"
                    fallbackName="danh-sach-doi-tuong.xlsx"
                    params={{
                      status,
                      ...(category ? { category } : {}),
                      ...(due ? { due } : {}),
                      ...(search.trim() ? { search: search.trim() } : {}),
                    }}
                  />
                </div>
              )}
            </div>
            <div className="roster-table">
              <table>
                <thead>
                  <tr>
                    <th className="roster-num">STT</th>
                    <th>Họ và tên</th>
                    <th>Ngày sinh</th>
                    <th>Số ĐDCN</th>
                    <th>Hệ</th>
                    <th>Địa chỉ</th>
                    <th>Đưa vào QL</th>
                    <th>Hạn QL</th>
                    <th>Gọi hỏi tiếp</th>
                    <th>Cảnh báo</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s, index) => (
                    <tr key={s.id} className="roster-table-row" data-selected={selected?.id === s.id} onClick={() => void open(s.id)}>
                      <td data-label="STT" className="roster-num">
                        {page * pageSize + index + 1}
                      </td>
                      <td className="roster-cell-identity">
                        <button
                          className="roster-row-link"
                          onClick={e => {
                            e.stopPropagation();
                            void open(s.id);
                          }}
                        >
                          {s.full_name}
                        </button>
                      </td>
                      <td data-label="Ngày sinh">{birthText(s)}</td>
                      <td data-label="Số ĐDCN" className="roster-mono">
                        {s.identity_masked || '—'}
                      </td>
                      <td data-label="Hệ">
                        {categoryShort(s.category)}
                        {s.subgroup ? <span className="roster-subline"> · {s.subgroup}</span> : null}
                      </td>
                      <td data-label="Địa chỉ" className="roster-cell-address">
                        {s.address || 'Chưa gắn hộ'}
                      </td>
                      <td data-label="Đưa vào QL">{displayDay(s.managed_from)}</td>
                      <td data-label="Hạn QL">{s.managed_until ? displayDay(s.managed_until) : '—'}</td>
                      <td data-label="Gọi hỏi tiếp">{s.status === 'ACTIVE' ? displayDay(s.next_summon_due) : '—'}</td>
                      <td data-label="Cảnh báo">
                        <span className="subject-badges">
                          <DueBadges subject={s} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && items.length === 0 && <p>Không có đối tượng phù hợp trong địa bàn được giao.</p>}
            <div className="roster-actions roster-pagination-bar">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                Trang trước
              </button>
              <span>
                Trang {page + 1}/{pages} · {total} đối tượng
              </span>
              <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
                Trang sau
              </button>
            </div>
          </section>
        </div>
        {selected && (
          <div className="roster-detail-pane" tabIndex={-1}>
            <SubjectDetail
              subject={selected}
              canManage={canManage}
              political={political}
              onChanged={changed}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>

      {creating && (
        <SubjectForm
          political={political}
          onSaved={subject => {
            setCreating(false);
            changed(subject);
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
