import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { CATEGORIES, SUBJECT_API, birthText, errorText, todayIso, type Row, type SubjectCategory } from './subjectModel';

type Person = { id: string; full_name: string; birth_date?: string; birth_year?: number; birth_date_precision?: string };

/**
 * Put a resident under management, or edit an active subject's period, interval and notes.
 * The category and the resident cannot change after creation; end the subject and create a new one instead.
 */
export default function SubjectForm({
  subject,
  person,
  political,
  onSaved,
  onClose,
}: {
  /** Existing subject to edit; absent to create. */
  subject?: Row;
  /** Resident chosen beforehand (from the resident detail); otherwise the form searches for one. */
  person?: Person;
  political: boolean;
  onSaved: (subject: Row) => void;
  onClose: () => void;
}) {
  const editing = Boolean(subject);
  const categories = CATEGORIES.filter(c => political || c.code !== 'CT');
  const [chosen, setChosen] = useState<Person | undefined>(
    person ?? (subject ? { id: subject.resident_id, full_name: subject.full_name, ...subject } : undefined),
  );
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Person[]>([]);
  const [data, setData] = useState({
    category: (subject?.category as SubjectCategory) ?? categories[0]?.code ?? 'HS',
    subgroup: subject?.subgroup ?? '',
    managedFrom: subject?.managed_from ?? todayIso(),
    managedUntil: subject?.managed_until ?? '',
    summonIntervalMonths: String(subject?.summon_interval_months ?? 1),
    suspiciousSigns: subject?.suspicious_signs ?? '',
    tb136Scope: subject?.tb136_scope ?? '',
    notes: subject?.notes ?? '',
  });
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const [busy, setBusy] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    if (chosen || query.trim().length < 2) {
      setMatches([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      axios
        .get<Person[]>('/api/roster/residents/search', { params: { search: query.trim() } })
        .then(r => {
          if (!cancelled) setMatches(Array.isArray(r.data) ? r.data : []);
        })
        .catch(e => {
          if (!cancelled) setError(errorText(e));
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, chosen]);

  const set = (key: keyof typeof data, value: string) => setData(d => ({ ...d, [key]: value }));
  const suspect = data.category === 'NV';

  const save = async () => {
    setError('');
    if (!chosen) {
      setError('Chọn nhân khẩu cần đưa vào diện quản lý');
      return;
    }
    if (!data.managedFrom) {
      setError('Nhập ngày đưa vào quản lý');
      return;
    }
    setBusy(true);
    try {
      const body = { ...data, residentId: chosen.id, version: subject?.version };
      const response = editing ? await axios.put<Row>(`${SUBJECT_API}/${subject?.id}`, body) : await axios.post<Row>(SUBJECT_API, body);
      onSaved(response.data);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const title = editing ? 'Sửa hồ sơ đối tượng' : 'Đưa nhân khẩu vào diện quản lý đối tượng';
  return (
    <div className="roster-overlay" onKeyDown={e => e.key === 'Escape' && !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-label={title} className="roster-dialog">
        <h2>{title}</h2>
        <p className="roster-subline">
          Thông tin cá nhân, ảnh và địa chỉ lấy từ hồ sơ nhân khẩu; ở đây chỉ ghi diện quản lý. Mọi thay đổi đều được ghi nhật ký.
        </p>
        {error && (
          <div ref={errorRef} tabIndex={-1} role="alert" className="roster-error">
            {error}
          </div>
        )}
        <form
          noValidate
          onSubmit={e => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="roster-fields">
            {chosen ? (
              <div className="roster-field subject-field-wide">
                <span className="roster-meta-label">Nhân khẩu</span>
                <div className="roster-member-card">
                  <span>
                    <strong>{chosen.full_name}</strong> · {birthText(chosen)}
                  </span>
                  {!editing && !person && (
                    <button type="button" className="roster-btn-sm" onClick={() => setChosen(undefined)}>
                      Chọn người khác
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="roster-field subject-field-wide">
                <label>
                  Tìm nhân khẩu theo họ tên hoặc số ĐDCN *
                  <input
                    ref={firstFieldRef as React.RefObject<HTMLInputElement>}
                    type="search"
                    value={query}
                    maxLength={100}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Nhập ít nhất 2 ký tự"
                  />
                </label>
                {matches.length > 0 && (
                  <ul className="subject-match-list" aria-label="Kết quả tìm nhân khẩu">
                    {matches.map(m => (
                      <li key={m.id}>
                        <button type="button" className="roster-row-link" onClick={() => setChosen(m)}>
                          {m.full_name}
                        </button>{' '}
                        <span className="roster-subline">{birthText(m)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {query.trim().length >= 2 && matches.length === 0 && (
                  <span className="roster-subline">Không thấy? Thêm nhân khẩu ở mục Quản lý nhân khẩu trước.</span>
                )}
              </div>
            )}
            <div className="roster-field">
              <label>
                Hệ đối tượng *
                <select
                  ref={chosen ? (firstFieldRef as React.RefObject<HTMLSelectElement>) : undefined}
                  value={data.category}
                  disabled={editing}
                  onChange={e => set('category', e.target.value)}
                >
                  {categories.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="roster-field">
              <label>
                Hệ / loại đối tượng (ghi rõ)
                <input value={data.subgroup} maxLength={200} onChange={e => set('subgroup', e.target.value)} />
              </label>
            </div>
            <div className="roster-field">
              <label>
                Ngày đưa vào quản lý *
                <input type="date" value={data.managedFrom} max={todayIso()} onChange={e => set('managedFrom', e.target.value)} />
              </label>
            </div>
            <div className="roster-field">
              <label>
                Thời hạn quản lý đến (nếu có)
                <input type="date" value={data.managedUntil} min={data.managedFrom} onChange={e => set('managedUntil', e.target.value)} />
              </label>
            </div>
            <div className="roster-field">
              <label>
                Gọi hỏi, răn đe mỗi (tháng)
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={data.summonIntervalMonths}
                  onChange={e => set('summonIntervalMonths', e.target.value)}
                />
              </label>
            </div>
            {suspect && (
              <>
                <div className="roster-field">
                  <label>
                    Diện quản lý theo TB136
                    <input value={data.tb136Scope} maxLength={200} onChange={e => set('tb136Scope', e.target.value)} />
                  </label>
                </div>
                <div className="roster-field subject-field-wide">
                  <label>
                    Biểu hiện nghi vấn
                    <textarea
                      rows={3}
                      value={data.suspiciousSigns}
                      maxLength={2000}
                      onChange={e => set('suspiciousSigns', e.target.value)}
                    />
                  </label>
                </div>
              </>
            )}
            <div className="roster-field subject-field-wide">
              <label>
                Lưu ý khác
                <textarea rows={3} value={data.notes} maxLength={2000} onChange={e => set('notes', e.target.value)} />
              </label>
            </div>
          </div>
          <div className="roster-actions">
            <button type="button" disabled={busy} onClick={onClose}>
              Hủy
            </button>
            <button className="roster-primary" type="submit" disabled={busy}>
              {busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Đưa vào diện quản lý'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
