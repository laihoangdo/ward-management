import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import AttachmentGallery from '../roster/AttachmentGallery';
import { EntryDialog } from '../subjects/SubjectDetail';
import { birthText, displayDay, errorText, genderLabel, todayIso } from '../subjects/subjectModel';
import { FACILITY_API, licenseLabel, typeLabel, type Row } from './facilityModel';

type Person = { id: string; full_name: string; birth_date?: string; birth_year?: number; birth_date_precision?: string };

/** Add an employee: a resident of the hamlet (data stays on the resident) or a person from outside the roster. */
function EmployeeDialog({ facilityId, onSaved, onClose }: { facilityId: string; onSaved: (f: Row) => void; onClose: () => void }) {
  const [mode, setMode] = useState<'resident' | 'outside'>('resident');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Person[]>([]);
  const [chosen, setChosen] = useState<Person | null>(null);
  const [data, setData] = useState<Record<string, string>>({ startedOn: '' });
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: string) => setData(d => ({ ...d, [key]: value }));

  useEffect(() => {
    if (mode !== 'resident' || chosen || query.trim().length < 2) {
      setMatches([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      axios
        .get<Person[]>('/api/roster/residents/search', { params: { search: query.trim() } })
        .then(r => !cancelled && setMatches(Array.isArray(r.data) ? r.data : []))
        .catch(e => !cancelled && setError(errorText(e)));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, chosen, mode]);

  const save = async () => {
    if (mode === 'resident' && !chosen) return setError('Chọn nhân khẩu');
    if (mode === 'outside' && !data.fullName?.trim()) return setError('Nhập họ tên nhân viên');
    setBusy(true);
    setError('');
    try {
      const body = mode === 'resident' ? { ...data, residentId: chosen?.id } : data;
      const response = await axios.post<Row>(`${FACILITY_API}/${facilityId}/employees`, body);
      onSaved(response.data);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const input = (key: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="roster-field">
      <label>
        {label}
        <input value={data[key] ?? ''} onChange={e => set(key, e.target.value)} {...props} />
      </label>
    </div>
  );

  return (
    <div className="roster-overlay" onKeyDown={e => e.key === 'Escape' && !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="Thêm nhân viên cơ sở" className="roster-dialog">
        <h2>Thêm nhân viên cơ sở</h2>
        {error && (
          <div ref={errorRef} tabIndex={-1} role="alert" className="roster-error">
            {error}
          </div>
        )}
        <div className="roster-tabs" role="group" aria-label="Nguồn thông tin nhân viên">
          <button type="button" aria-pressed={mode === 'resident'} onClick={() => setMode('resident')}>
            Nhân khẩu trong địa bàn
          </button>
          <button type="button" aria-pressed={mode === 'outside'} onClick={() => setMode('outside')}>
            Người ngoài địa bàn
          </button>
        </div>
        <form
          noValidate
          onSubmit={e => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="roster-fields">
            {mode === 'resident' ? (
              <div className="roster-field subject-field-wide">
                {chosen ? (
                  <div className="roster-member-card">
                    <span>
                      <strong>{chosen.full_name}</strong> · {birthText(chosen)}
                    </span>
                    <button type="button" className="roster-btn-sm" onClick={() => setChosen(null)}>
                      Chọn người khác
                    </button>
                  </div>
                ) : (
                  <label>
                    Tìm nhân khẩu theo họ tên hoặc số ĐDCN
                    <input autoFocus type="search" value={query} maxLength={100} onChange={e => setQuery(e.target.value)} />
                  </label>
                )}
                {!chosen && matches.length > 0 && (
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
              </div>
            ) : (
              <>
                {input('fullName', 'Họ và tên *', { maxLength: 255, autoFocus: true })}
                {input('birthYear', 'Năm sinh', { type: 'number', min: 1900, max: Number(todayIso().slice(0, 4)) })}
                <div className="roster-field">
                  <label>
                    Giới tính
                    <select value={data.gender ?? ''} onChange={e => set('gender', e.target.value)}>
                      <option value="">Chưa rõ</option>
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </label>
                </div>
                {input('identity', 'Số ĐDCN / CCCD (giữ số 0 đầu)', { inputMode: 'numeric', maxLength: 12 })}
                {input('homeAddress', 'Quê quán / nơi thường trú', { maxLength: 500 })}
              </>
            )}
            {input('position', 'Công việc / chức vụ', { maxLength: 200 })}
            {input('phone', 'Số điện thoại', { maxLength: 30 })}
            {input('startedOn', 'Ngày bắt đầu làm việc', { type: 'date', max: todayIso() })}
            <div className="roster-field subject-field-wide">
              <label>
                Ghi chú
                <textarea rows={2} maxLength={2000} value={data.notes ?? ''} onChange={e => set('notes', e.target.value)} />
              </label>
            </div>
          </div>
          <div className="roster-actions">
            <button type="button" disabled={busy} onClick={onClose}>
              Hủy
            </button>
            <button className="roster-primary" type="submit" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/** Licence warning badges shared with the list. */
export function LicenseBadges({ facility }: { facility: Row }) {
  return (
    <>
      {facility.license_expired && <span className="roster-badge subject-badge--danger">Giấy phép hết hạn</span>}
      {facility.license_due && <span className="roster-badge roster-badge--warn">Giấy phép sắp hết hạn</span>}
    </>
  );
}

export default function FacilityDetail({
  facility,
  canManage,
  canEditHousehold,
  onChanged,
  onEditHousehold,
  onClose,
}: {
  facility: Row;
  canManage: boolean;
  canEditHousehold: boolean;
  onChanged: (facility: Row) => void;
  onEditHousehold: (id: string) => void;
  onClose?: () => void;
}) {
  const [dialog, setDialog] = useState<'' | 'employee' | 'violation' | { end: Row }>('');
  const employees: Row[] = facility.employees ?? [];
  const violations: Row[] = facility.violations ?? [];
  const documents: Row[] = facility.documents ?? [];
  const owner: Row | null = facility.owner ?? null;
  const active = employees.filter(e => !e.ended_on);
  const former = employees.filter(e => e.ended_on);

  const post = async (path: string, body: Record<string, unknown>) => {
    const { data } = await axios.post<Row>(`${FACILITY_API}/${facility.id}/${path}`, body);
    onChanged(data);
  };

  const employeeCard = (e: Row) => (
    <li key={e.id} className="roster-member-card">
      <div className="roster-member-info">
        <div className="roster-member-title-row">
          <strong>{e.full_name}</strong>
          {e.position && <span className="roster-badge roster-badge--muted">{e.position}</span>}
          {e.resident_id && <span className="roster-badge roster-badge--ok">Nhân khẩu địa bàn</span>}
        </div>
        <span className="roster-member-meta">
          {[
            e.birth_year && `Sinh ${e.birth_year}`,
            e.gender && genderLabel(e.gender),
            e.identity_masked && `ĐDCN ${e.identity_masked}`,
            e.phone,
            e.home_address,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <span className="roster-member-meta">
          {e.started_on ? `Từ ${displayDay(e.started_on)}` : 'Chưa rõ ngày bắt đầu'}
          {e.ended_on ? ` · nghỉ ${displayDay(e.ended_on)}` : ''}
        </span>
      </div>
      {canManage && !e.ended_on && (
        <button type="button" className="roster-btn-sm" onClick={() => setDialog({ end: e })}>
          Ghi nghỉ việc
        </button>
      )}
    </li>
  );

  return (
    <section className="roster-detail" aria-label={`Hồ sơ cơ sở ${facility.business_name || facility.raw_address}`}>
      <div className="roster-detail-header">
        <div>
          <h2>{facility.business_name || 'Chưa có tên cơ sở'}</h2>
          <p className="roster-subline">
            {typeLabel(facility.type)}
            {facility.business_category ? ` · ${facility.business_category}` : ''}
          </p>
          <div className="roster-actions subject-badges">
            {facility.is_conditional && <span className="roster-badge roster-badge--ok">Ngành nghề có điều kiện về ANTT</span>}
            <LicenseBadges facility={facility} />
          </div>
        </div>
        <div className="roster-actions">
          {canManage && (
            <>
              <button className="roster-primary" onClick={() => setDialog('employee')}>
                + Nhân viên
              </button>
              <button onClick={() => setDialog('violation')}>+ Vi phạm</button>
            </>
          )}
          {canEditHousehold && <button onClick={() => onEditHousehold(facility.id)}>Sửa tên, ngành nghề, giấy phép</button>}
          {onClose && <button onClick={onClose}>Đóng</button>}
        </div>
      </div>

      <dl className="roster-profile">
        <div className="roster-profile-wide">
          <dt>Địa chỉ</dt>
          <dd>{facility.raw_address}</dd>
        </div>
        <div>
          <dt>Loại giấy phép</dt>
          <dd>{facility.license_type ? licenseLabel(facility.license_type) : 'Chưa có'}</dd>
        </div>
        <div>
          <dt>Số giấy phép</dt>
          <dd>{facility.license_number || 'Chưa có'}</dd>
        </div>
        <div>
          <dt>Thời hạn giấy phép</dt>
          <dd>{facility.license_expiry_on ? displayDay(facility.license_expiry_on) : 'Chưa ghi'}</dd>
        </div>
        <div>
          <dt>Số HSCT</dt>
          <dd>{facility.source_case_number || 'Chưa có'}</dd>
        </div>
      </dl>

      <details open className="roster-subcard">
        <summary>Chủ cơ sở</summary>
        {owner ? (
          <dl className="roster-profile">
            <div>
              <dt>Họ và tên</dt>
              <dd>{owner.full_name}</dd>
            </div>
            <div>
              <dt>Ngày sinh</dt>
              <dd>{birthText(owner)}</dd>
            </div>
            <div>
              <dt>Giới tính</dt>
              <dd>{genderLabel(owner.gender)}</dd>
            </div>
            <div>
              <dt>Số ĐDCN</dt>
              <dd className="roster-mono">{owner.identity_masked || 'Chưa có'}</dd>
            </div>
            <div>
              <dt>Số điện thoại</dt>
              <dd>{facility.phone || 'Chưa có'}</dd>
            </div>
            <div>
              <dt>Nghề nghiệp</dt>
              <dd>{owner.occupation || 'Chưa có'}</dd>
            </div>
          </dl>
        ) : (
          <p className="roster-subline">
            {facility.representative_name ? `Người đại diện: ${facility.representative_name}` : 'Chưa xác minh chủ cơ sở'}
            {facility.phone ? ` · ${facility.phone}` : ''}. Gắn chủ hộ đã xác minh ở Danh sách hộ dân để có đủ thông tin cá nhân.
          </p>
        )}
      </details>

      <details open className="roster-subcard">
        <summary>Nhân viên cơ sở ({active.length} đang làm)</summary>
        {employees.length === 0 && <p className="roster-subline">Chưa ghi nhận nhân viên.</p>}
        <ul className="subject-entries">{active.map(employeeCard)}</ul>
        {former.length > 0 && (
          <details>
            <summary>Đã nghỉ việc ({former.length})</summary>
            <ul className="subject-entries">{former.map(employeeCard)}</ul>
          </details>
        )}
      </details>

      <details open className="roster-subcard">
        <summary>Lịch sử vi phạm ({violations.length})</summary>
        {violations.length === 0 && <p className="roster-subline">Chưa ghi nhận vi phạm.</p>}
        <ul className="subject-entries">
          {violations.map(v => (
            <li key={v.id} className="roster-member-card">
              <div className="roster-member-info">
                <strong>{v.content}</strong>
                <span className="roster-member-meta">
                  {[displayDay(v.occurred_on), v.decision_no && `QĐ số ${v.decision_no}`, v.authority, v.penalty]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {v.notes && <span className="roster-member-meta">{v.notes}</span>}
              </div>
            </li>
          ))}
        </ul>
      </details>

      <details open className="roster-subcard">
        <summary>Giấy tờ đã đăng ký ({documents.length})</summary>
        {documents.length === 0 && <p className="roster-subline">Chưa có giấy tờ trong mục Quản lý giấy tờ &amp; ANTT.</p>}
        <ul className="subject-entries">
          {documents.map(d => (
            <li key={d.id} className="roster-member-card">
              <div className="roster-member-info">
                <strong>{d.doc_name}</strong>
                <span className="roster-member-meta">
                  {[
                    d.document_number && `Số ${d.document_number}`,
                    d.issuing_authority,
                    d.issued_on && `cấp ${displayDay(d.issued_on)}`,
                    d.expiry_on && `hết hạn ${displayDay(d.expiry_on)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </details>

      <AttachmentGallery
        base={`${FACILITY_API}/${facility.id}/attachments`}
        title="Giấy tờ, hình ảnh kèm theo"
        noun="giấy tờ, hình ảnh kèm theo"
        allowPdf
        canEdit={canManage}
        hint="Ảnh JPEG/PNG (tự thu nhỏ) hoặc bản quét PDF tối đa 20 MB; tối đa 30 tệp."
      />

      {dialog === 'employee' && <EmployeeDialog facilityId={facility.id} onSaved={onChanged} onClose={() => setDialog('')} />}
      {dialog === 'violation' && (
        <EntryDialog
          title="Ghi vi phạm của cơ sở"
          initial={{}}
          fields={[
            { key: 'content', label: 'Nội dung vi phạm', required: true },
            { key: 'occurredOn', label: 'Ngày vi phạm', type: 'date' },
            { key: 'decisionNo', label: 'Số quyết định xử lý', max: 100 },
            { key: 'authority', label: 'Cơ quan xử lý', max: 200 },
            { key: 'penalty', label: 'Hình thức xử lý' },
            { key: 'notes', label: 'Ghi chú', type: 'textarea' },
          ]}
          submit={data => post('violations', data)}
          onClose={() => setDialog('')}
        />
      )}
      {typeof dialog === 'object' && (
        <EntryDialog
          title={`Ghi nghỉ việc: ${dialog.end.full_name}`}
          initial={{ endedOn: todayIso() }}
          fields={[{ key: 'endedOn', label: 'Ngày nghỉ việc', type: 'date', required: true }]}
          submit={data => post(`employees/${dialog.end.id}/end`, data)}
          onClose={() => setDialog('')}
        />
      )}
    </section>
  );
}
