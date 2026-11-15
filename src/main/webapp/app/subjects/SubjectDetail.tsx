import React, { useState } from 'react';
import axios from 'axios';
import ResidentPhotos from '../roster/ResidentPhotos';
import SubjectForm from './SubjectForm';
import {
  RECORD_KINDS,
  SUBJECT_API,
  birthText,
  categoryLabel,
  displayDay,
  errorText,
  genderLabel,
  recordLabel,
  todayIso,
  violationsOnly,
  type Row,
} from './subjectModel';

type Field = { key: string; label: string; type?: 'date' | 'textarea' | 'select'; required?: boolean; options?: string[][]; max?: number };

/** Small form dialog for a record, an interview or ending the management period. */
function EntryDialog({
  title,
  fields,
  initial,
  submit,
  onClose,
}: {
  title: string;
  fields: Field[];
  initial: Record<string, string>;
  submit: (data: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const missing = fields.filter(f => f.required && !String(data[f.key] ?? '').trim());
    if (missing.length) {
      setError(`Nhập: ${missing.map(f => f.label.toLowerCase()).join(', ')}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await submit(data);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="roster-overlay" onKeyDown={e => e.key === 'Escape' && !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-label={title} className="roster-dialog">
        <h2>{title}</h2>
        {error && (
          <div role="alert" className="roster-error">
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
            {fields.map((f, index) => (
              <div key={f.key} className={`roster-field ${f.type === 'textarea' ? 'subject-field-wide' : ''}`}>
                <label>
                  {f.label}
                  {f.required && ' *'}
                  {f.type === 'select' ? (
                    <select autoFocus={index === 0} value={data[f.key]} onChange={e => setData({ ...data, [f.key]: e.target.value })}>
                      {f.options?.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      autoFocus={index === 0}
                      rows={3}
                      maxLength={f.max ?? 2000}
                      value={data[f.key] ?? ''}
                      onChange={e => setData({ ...data, [f.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      autoFocus={index === 0}
                      type={f.type ?? 'text'}
                      max={f.type === 'date' ? todayIso() : undefined}
                      maxLength={f.max ?? 1000}
                      value={data[f.key] ?? ''}
                      onChange={e => setData({ ...data, [f.key]: e.target.value })}
                    />
                  )}
                </label>
              </div>
            ))}
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

/** Due badges shared with the list. */
export function DueBadges({ subject }: { subject: Row }) {
  return (
    <>
      {subject.status === 'ENDED' && <span className="roster-badge roster-badge--muted">Đã kết thúc</span>}
      {subject.management_expired && <span className="roster-badge subject-badge--danger">Quá hạn quản lý</span>}
      {subject.management_due && <span className="roster-badge roster-badge--warn">Sắp hết hạn quản lý</span>}
      {subject.summon_overdue && <span className="roster-badge subject-badge--danger">Quá hạn gọi hỏi</span>}
      {subject.summon_due && <span className="roster-badge roster-badge--warn">Sắp đến hạn gọi hỏi</span>}
    </>
  );
}

export default function SubjectDetail({
  subject,
  canManage,
  political,
  onChanged,
  onClose,
}: {
  subject: Row;
  canManage: boolean;
  political: boolean;
  onChanged: (subject: Row) => void;
  onClose?: () => void;
}) {
  const [dialog, setDialog] = useState<'' | 'edit' | 'record' | 'summon' | 'end'>('');
  const active = subject.status === 'ACTIVE';
  const kinds = RECORD_KINDS.filter(k => !violationsOnly(subject.category) || k.code === 'VI_PHAM');
  const records: Row[] = subject.records ?? [];
  const summons: Row[] = subject.summons ?? [];

  const post = async (path: string, body: Record<string, unknown>) => {
    const { data } = await axios.post<Row>(`${SUBJECT_API}/${subject.id}/${path}`, body);
    onChanged(data);
  };

  return (
    <section className="roster-detail" aria-label={`Hồ sơ đối tượng ${subject.full_name}`}>
      <div className="roster-detail-header">
        <div>
          <h2>{subject.full_name}</h2>
          <p className="roster-subline">
            {categoryLabel(subject.category)}
            {subject.subgroup ? ` · ${subject.subgroup}` : ''}
          </p>
          <div className="roster-actions subject-badges">
            <DueBadges subject={subject} />
          </div>
        </div>
        <div className="roster-actions">
          {canManage && active && (
            <>
              <button className="roster-primary" onClick={() => setDialog('summon')}>
                + Ghi gọi hỏi, răn đe
              </button>
              <button onClick={() => setDialog('record')}>
                + {violationsOnly(subject.category) ? 'Vi phạm' : 'Tiền án / tiền sự / vi phạm'}
              </button>
              <button onClick={() => setDialog('edit')}>Sửa diện quản lý</button>
              <button onClick={() => setDialog('end')}>Kết thúc quản lý</button>
            </>
          )}
          {onClose && <button onClick={onClose}>Đóng</button>}
        </div>
      </div>

      <dl className="roster-profile">
        <div>
          <dt>Ngày sinh</dt>
          <dd>{birthText(subject)}</dd>
        </div>
        <div>
          <dt>Giới tính</dt>
          <dd>{genderLabel(subject.gender)}</dd>
        </div>
        <div>
          <dt>Số ĐDCN</dt>
          <dd className="roster-mono">{subject.identity_masked || 'Chưa có'}</dd>
        </div>
        <div>
          <dt>Số HSCT</dt>
          <dd>{subject.case_number || 'Chưa có'}</dd>
        </div>
        <div className="roster-profile-wide">
          <dt>Địa chỉ</dt>
          <dd>{subject.address || 'Chưa gắn hộ'}</dd>
        </div>
        <div>
          <dt>Nghề nghiệp</dt>
          <dd>{subject.occupation || 'Chưa có'}</dd>
        </div>
        <div>
          <dt>Ngày đưa vào quản lý</dt>
          <dd>{displayDay(subject.managed_from)}</dd>
        </div>
        <div>
          <dt>Thời hạn quản lý</dt>
          <dd>{subject.managed_until ? displayDay(subject.managed_until) : 'Không thời hạn'}</dd>
        </div>
        <div>
          <dt>Chu kỳ gọi hỏi</dt>
          <dd>{subject.summon_interval_months} tháng / lần</dd>
        </div>
        <div>
          <dt>Gọi hỏi gần nhất</dt>
          <dd>{subject.last_summon ? displayDay(subject.last_summon) : 'Chưa gọi hỏi'}</dd>
        </div>
        <div>
          <dt>Gọi hỏi tiếp theo</dt>
          <dd>{active ? displayDay(subject.next_summon_due) : '—'}</dd>
        </div>
        {subject.category === 'NV' && (
          <>
            <div>
              <dt>Diện quản lý TB136</dt>
              <dd>{subject.tb136_scope || 'Chưa ghi'}</dd>
            </div>
            <div className="roster-profile-wide">
              <dt>Biểu hiện nghi vấn</dt>
              <dd>{subject.suspicious_signs || 'Chưa ghi'}</dd>
            </div>
          </>
        )}
        <div className="roster-profile-wide">
          <dt>Lưu ý khác</dt>
          <dd>{subject.notes || 'Chưa có'}</dd>
        </div>
        {subject.status === 'ENDED' && (
          <div className="roster-profile-wide">
            <dt>Kết thúc quản lý</dt>
            <dd>
              {displayDay(subject.ended_on)} · {subject.end_reason}
            </dd>
          </div>
        )}
      </dl>

      <ResidentPhotos residentId={subject.resident_id} api="/api/roster" />

      <details open className="roster-subcard">
        <summary>
          {violationsOnly(subject.category) ? 'Thông tin vi phạm' : 'Tiền án, tiền sự, vi phạm'} ({records.length})
        </summary>
        {records.length === 0 && <p className="roster-subline">Chưa ghi nhận.</p>}
        <ul className="subject-entries">
          {records.map(r => (
            <li key={r.id} className="roster-member-card">
              <div className="roster-member-info">
                <div className="roster-member-title-row">
                  <span className={`roster-badge ${r.kind === 'VI_PHAM' ? 'roster-badge--warn' : 'subject-badge--danger'}`}>
                    {recordLabel(r.kind)}
                  </span>
                  <strong>{r.offense}</strong>
                </div>
                <span className="roster-member-meta">
                  {[displayDay(r.occurred_on), r.decision_no && `QĐ/BA số ${r.decision_no}`, r.authority, r.penalty]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {r.notes && <span className="roster-member-meta">{r.notes}</span>}
              </div>
            </li>
          ))}
        </ul>
      </details>

      <details open className="roster-subcard">
        <summary>Gọi hỏi, răn đe ({summons.length})</summary>
        {summons.length === 0 && <p className="roster-subline">Chưa gọi hỏi lần nào.</p>}
        <ul className="subject-entries">
          {summons.map(s => (
            <li key={s.id} className="roster-member-card">
              <div className="roster-member-info">
                <div className="roster-member-title-row">
                  <strong>{displayDay(s.summoned_on)}</strong>
                  <span className="roster-member-meta">{s.officer}</span>
                </div>
                <span>{s.content}</span>
                {s.result && <span className="roster-member-meta">Kết quả: {s.result}</span>}
              </div>
            </li>
          ))}
        </ul>
      </details>

      {dialog === 'edit' && (
        <SubjectForm
          subject={subject}
          political={political}
          onSaved={saved => {
            onChanged(saved);
            setDialog('');
          }}
          onClose={() => setDialog('')}
        />
      )}
      {dialog === 'record' && (
        <EntryDialog
          title={violationsOnly(subject.category) ? 'Ghi thông tin vi phạm' : 'Ghi tiền án, tiền sự, vi phạm'}
          initial={{ kind: kinds[0].code }}
          fields={[
            { key: 'kind', label: 'Loại', type: 'select', options: kinds.map(k => [k.code, k.label]) },
            { key: 'offense', label: 'Tội danh / hành vi vi phạm', required: true },
            { key: 'occurredOn', label: 'Ngày (bản án / quyết định / vi phạm)', type: 'date' },
            { key: 'decisionNo', label: 'Số bản án / quyết định', max: 100 },
            { key: 'authority', label: 'Cơ quan xử lý', max: 200 },
            { key: 'penalty', label: 'Hình phạt / hình thức xử lý' },
            { key: 'notes', label: 'Ghi chú', type: 'textarea' },
          ]}
          submit={data => post('records', data)}
          onClose={() => setDialog('')}
        />
      )}
      {dialog === 'summon' && (
        <EntryDialog
          title="Ghi lần gọi hỏi, răn đe"
          initial={{ summonedOn: todayIso() }}
          fields={[
            { key: 'summonedOn', label: 'Ngày gọi hỏi', type: 'date', required: true },
            { key: 'officer', label: 'Cán bộ thực hiện (để trống: tài khoản đang dùng)', max: 255 },
            { key: 'content', label: 'Nội dung gọi hỏi, răn đe', type: 'textarea', required: true },
            { key: 'result', label: 'Kết quả, cam kết', type: 'textarea' },
          ]}
          submit={data => post('summons', data)}
          onClose={() => setDialog('')}
        />
      )}
      {dialog === 'end' && (
        <EntryDialog
          title="Kết thúc quản lý đối tượng"
          initial={{ endedOn: todayIso() }}
          fields={[
            { key: 'endedOn', label: 'Ngày kết thúc', type: 'date', required: true },
            { key: 'reason', label: 'Lý do kết thúc (hết hạn, chuyển đi, đưa ra khỏi diện…)', type: 'textarea', required: true, max: 500 },
          ]}
          submit={data => post('end', { ...data, version: subject.version })}
          onClose={() => setDialog('')}
        />
      )}
    </section>
  );
}
