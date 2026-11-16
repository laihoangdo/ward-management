import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { BookOpen } from 'lucide-react';
import '../roster/roster.css';
import '../subjects/subjects.css';
import AttachmentGallery from '../roster/AttachmentGallery';
import { ListExportActions } from '../roster/ListExport';
import { EntryDialog, type Field } from '../subjects/SubjectDetail';
import { displayDay, errorText } from '../subjects/subjectModel';

const API = '/api/guidance-documents';

export type GuidanceRow = {
  id: string;
  doc_number: string;
  issuing_authority: string;
  issued_on: string;
  title: string;
  received_on?: string | null;
  field?: string;
  summary?: string;
  notes?: string;
  version: number;
  file_count: number;
  created_by?: string;
};
type Summary = { total: number; years: number[]; authorities: string[]; receivedThisMonth: number; canManage: boolean };

const FIELDS: Field[] = [
  { key: 'docNumber', label: 'Số, ký hiệu văn bản', required: true, max: 100 },
  { key: 'issuingAuthority', label: 'Cơ quan ban hành', required: true, max: 300 },
  { key: 'issuedOn', label: 'Ngày ban hành', type: 'date', required: true },
  { key: 'receivedOn', label: 'Ngày nhận', type: 'date' },
  { key: 'field', label: 'Lĩnh vực', max: 200 },
  { key: 'title', label: 'Trích yếu / tiêu đề', type: 'textarea', required: true, max: 1000 },
  { key: 'summary', label: 'Nội dung chính cần thực hiện', type: 'textarea', max: 4000 },
  { key: 'notes', label: 'Ghi chú', type: 'textarea', max: 2000 },
];

const todayIso = () => new Date().toLocaleDateString('sv-SE');
const toForm = (row?: GuidanceRow | null): Record<string, string> => ({
  docNumber: row?.doc_number ?? '',
  issuingAuthority: row?.issuing_authority ?? '',
  issuedOn: row?.issued_on ?? '',
  receivedOn: row ? (row.received_on ?? '') : todayIso(),
  field: row?.field ?? '',
  title: row?.title ?? '',
  summary: row?.summary ?? '',
  notes: row?.notes ?? '',
});

/** "Văn bản hướng dẫn CSKV": the commune-wide register of guidance documents received, with their scanned files. */
export default function GuidanceTab() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [authority, setAuthority] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<GuidanceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [selected, setSelected] = useState<GuidanceRow | null>(null);
  const [editing, setEditing] = useState<GuidanceRow | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSummary = useCallback(() => {
    axios
      .get<Summary>(`${API}/summary`)
      .then(({ data }) => setSummary(data))
      .catch(e => setError(errorText(e)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page };
      if (search.trim()) params.search = search.trim();
      if (year) params.year = year;
      if (authority) params.authority = authority;
      const { data } = await axios.get<{ items: GuidanceRow[]; total: number; pageSize: number }>(API, { params });
      setItems(data.items);
      setTotal(data.total);
      setPageSize(data.pageSize || 30);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [search, year, authority, page]);

  useEffect(loadSummary, [loadSummary]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => setConfirmDelete(false), [selected?.id]);

  const refresh = () => {
    loadSummary();
    void load();
  };
  const save = async (data: Record<string, string>) => {
    const target = editing;
    const response =
      target === 'new' || target === null
        ? await axios.post<GuidanceRow>(API, data)
        : await axios.put<GuidanceRow>(`${API}/${target.id}`, { ...data, version: target.version });
    setSelected(response.data);
    refresh();
  };
  const remove = async () => {
    if (!selected) return;
    try {
      await axios.delete(`${API}/${selected.id}`);
      setSelected(null);
      refresh();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const canManage = summary?.canManage ?? false;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const resetPage =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(0);
    };

  return (
    <div className="roster-page roster-embedded guidance-page">
      <div className="roster-heading">
        <div className="roster-heading-icon" aria-hidden="true">
          <BookOpen size={22} />
        </div>
        <div className="roster-heading-main">
          <h2 className="roster-title">Văn bản hướng dẫn CSKV</h2>
          <p>
            Sổ văn bản hướng dẫn nghiệp vụ cảnh sát khu vực đã nhận: {summary?.total ?? '…'} văn bản
            {summary ? `, ${summary.receivedThisMonth} văn bản nhận trong tháng này` : ''}.
          </p>
        </div>
        {canManage && (
          <div className="roster-actions">
            <button className="roster-primary" onClick={() => setEditing('new')}>
              + Vào sổ văn bản
            </button>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="roster-error roster-error--retry">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              loadSummary();
              void load();
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      <div className={`roster-workspace ${selected ? 'has-selection' : ''}`}>
        <div className="roster-list-pane" aria-label="Danh sách văn bản">
          <section>
            <div className="roster-actions roster-filter-bar">
              <label className="roster-filter-search">
                Tìm số, trích yếu, cơ quan ban hành, lĩnh vực
                <input type="search" value={search} maxLength={100} onChange={e => resetPage(setSearch)(e.target.value)} />
              </label>
              <label className="roster-filter-select">
                Năm ban hành
                <select value={year} onChange={e => resetPage(setYear)(e.target.value)}>
                  <option value="">Tất cả</option>
                  {summary?.years.map(y => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="roster-filter-select">
                Cơ quan ban hành
                <select value={authority} onChange={e => resetPage(setAuthority)(e.target.value)}>
                  <option value="">Tất cả</option>
                  {summary?.authorities.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <div className="roster-actions roster-list-export">
                <ListExportActions
                  base={API}
                  fallbackName="so-van-ban-huong-dan.xlsx"
                  params={{
                    ...(search.trim() ? { search: search.trim() } : {}),
                    ...(year ? { year } : {}),
                    ...(authority ? { authority } : {}),
                  }}
                />
              </div>
            </div>
            <div className="roster-table">
              <table>
                <thead>
                  <tr>
                    <th className="roster-num">STT</th>
                    <th>Số, ký hiệu</th>
                    <th>Cơ quan ban hành</th>
                    <th>Ngày ban hành</th>
                    <th>Trích yếu</th>
                    <th>Ngày nhận</th>
                    <th className="roster-num">Tệp</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((g, index) => (
                    <tr key={g.id} className="roster-table-row" data-selected={selected?.id === g.id} onClick={() => setSelected(g)}>
                      <td data-label="STT" className="roster-num">
                        {page * pageSize + index + 1}
                      </td>
                      <td className="roster-cell-identity">
                        <button
                          className="roster-row-link"
                          onClick={e => {
                            e.stopPropagation();
                            setSelected(g);
                          }}
                        >
                          {g.doc_number}
                        </button>
                      </td>
                      <td data-label="Cơ quan ban hành">{g.issuing_authority}</td>
                      <td data-label="Ngày ban hành">{displayDay(g.issued_on)}</td>
                      <td data-label="Trích yếu">{g.title}</td>
                      <td data-label="Ngày nhận">{g.received_on ? displayDay(g.received_on) : '—'}</td>
                      <td data-label="Tệp" className="roster-num">
                        {g.file_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {loading && items.length === 0 && (
              <p role="status" className="roster-empty-hint">
                Đang tải…
              </p>
            )}
            {!loading && items.length === 0 && <p>Chưa có văn bản phù hợp trong sổ.</p>}
            <div className="roster-actions roster-pagination-bar">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                Trang trước
              </button>
              <span>
                Trang {page + 1}/{pages} · {total} văn bản
              </span>
              <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
                Trang sau
              </button>
            </div>
          </section>
        </div>
        {selected && (
          <div className="roster-detail-pane" tabIndex={-1}>
            <section className="roster-detail" aria-label={`Văn bản ${selected.doc_number}`}>
              <div className="roster-detail-header">
                <div>
                  <h2>Văn bản số {selected.doc_number}</h2>
                  <p className="roster-subline">{selected.issuing_authority}</p>
                </div>
                <div className="roster-actions">
                  {canManage && (
                    <>
                      <button onClick={() => setEditing(selected)}>Sửa</button>
                      {confirmDelete ? (
                        <button className="roster-primary" onClick={() => void remove()}>
                          Xác nhận xoá khỏi sổ
                        </button>
                      ) : (
                        <button onClick={() => setConfirmDelete(true)}>Xoá</button>
                      )}
                    </>
                  )}
                  <button aria-label="Đóng văn bản" onClick={() => setSelected(null)}>
                    Đóng
                  </button>
                </div>
              </div>
              <dl className="roster-profile">
                <div>
                  <dt>Cơ quan ban hành</dt>
                  <dd>{selected.issuing_authority}</dd>
                </div>
                <div>
                  <dt>Ngày ban hành</dt>
                  <dd>{displayDay(selected.issued_on)}</dd>
                </div>
                <div>
                  <dt>Ngày nhận</dt>
                  <dd>{selected.received_on ? displayDay(selected.received_on) : 'Chưa ghi'}</dd>
                </div>
                <div>
                  <dt>Lĩnh vực</dt>
                  <dd>{selected.field || 'Chưa ghi'}</dd>
                </div>
                <div className="roster-profile-wide">
                  <dt>Trích yếu</dt>
                  <dd>{selected.title}</dd>
                </div>
                <div className="roster-profile-wide">
                  <dt>Nội dung chính cần thực hiện</dt>
                  <dd>{selected.summary || 'Chưa ghi'}</dd>
                </div>
                <div className="roster-profile-wide">
                  <dt>Ghi chú</dt>
                  <dd>{selected.notes || 'Chưa có'}</dd>
                </div>
              </dl>
              <AttachmentGallery
                key={selected.id}
                base={`${API}/${selected.id}/files`}
                title="Bản quét văn bản"
                noun="tệp văn bản"
                allowPdf
                canEdit={canManage}
                hint="PDF tối đa 20 MB hoặc ảnh JPEG/PNG; tối đa 10 tệp."
              />
            </section>
          </div>
        )}
      </div>

      {editing && (
        <EntryDialog
          title={editing === 'new' ? 'Vào sổ văn bản hướng dẫn' : `Sửa văn bản ${editing.doc_number}`}
          fields={FIELDS}
          initial={toForm(editing === 'new' ? null : editing)}
          submit={save}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
