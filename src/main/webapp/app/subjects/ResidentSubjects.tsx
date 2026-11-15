import React, { useEffect, useState } from 'react';
import type { AppUser } from '../gis/types';
import SubjectForm from './SubjectForm';
import { DueBadges } from './SubjectDetail';
import { categoryLabel, displayDay, errorText, fetchSubjects, subjectAccess, type Row } from './subjectModel';
import './subjects.css';

/** "Diện quản lý đối tượng" section of the resident detail; hidden for accounts without subject permissions. */
export default function ResidentSubjects({
  person,
  currentUser,
}: {
  person: { id: string; full_name: string; birth_date?: string; birth_year?: number; birth_date_precision?: string };
  currentUser?: Pick<AppUser, 'role' | 'subAdminPermissions'> | null;
}) {
  const access = subjectAccess(currentUser);
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () =>
    fetchSubjects({ residentId: person.id, status: 'ALL' })
      .then(data => setItems(data.items))
      .catch(e => setError(errorText(e)));

  useEffect(() => {
    if (!access.view) return;
    setItems([]);
    setError('');
    void load();
  }, [person.id, access.view]);

  if (!access.view) return null;
  return (
    <details open className="roster-subcard">
      <summary>Diện quản lý đối tượng ({items.filter(s => s.status === 'ACTIVE').length} đang quản lý)</summary>
      {error && (
        <div role="alert" className="roster-error">
          {error}
        </div>
      )}
      {items.length === 0 && !error && <p className="roster-subline">Không thuộc diện quản lý đối tượng.</p>}
      <ul className="subject-entries">
        {items.map(s => (
          <li key={s.id} className="roster-member-card">
            <div className="roster-member-info">
              <strong>{categoryLabel(s.category)}</strong>
              <span className="roster-member-meta">
                Từ {displayDay(s.managed_from)}
                {s.managed_until ? ` đến ${displayDay(s.managed_until)}` : ''}
                {s.subgroup ? ` · ${s.subgroup}` : ''}
              </span>
            </div>
            <span className="subject-badges">
              <DueBadges subject={s} />
            </span>
          </li>
        ))}
      </ul>
      {access.manage && (
        <button type="button" className="roster-btn-sm" onClick={() => setCreating(true)}>
          + Đưa vào diện quản lý đối tượng
        </button>
      )}
      <p className="roster-subline">Xem và cập nhật chi tiết ở mục “Quản lý đối tượng”.</p>
      {creating && (
        <SubjectForm
          person={person}
          political={access.political}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </details>
  );
}
