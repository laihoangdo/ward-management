import React, { useEffect, useState } from 'react';
import axios from 'axios';
import type { AppUser } from '../gis/types';
import { errorText } from '../subjects/subjectModel';

export const RESIDENT_TAGS = [
  { key: 'DANG_VIEN', label: 'Đảng viên' },
  { key: 'CB_HUU_TRI', label: 'Cán bộ hưu trí' },
  { key: 'CCB', label: 'Cựu chiến binh' },
] as const;

/** "Diện xã hội" of the resident detail: drives the blue (party member) and purple (retired cadre, veteran) map colours. */
export default function ResidentTags({
  residentId,
  api,
  currentUser,
}: {
  residentId: string;
  api: string;
  currentUser?: Pick<AppUser, 'role' | 'subAdminPermissions'> | null;
}) {
  const canEdit = currentUser?.role === 'superadmin' || currentUser?.subAdminPermissions?.canUpdateInspection === true;
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const url = `${api}/residents/${residentId}/tags`;

  useEffect(() => {
    let cancelled = false;
    setTags([]);
    setDraft(null);
    setError('');
    axios
      .get<string[]>(url)
      .then(({ data }) => !cancelled && setTags(Array.isArray(data) ? data : []))
      .catch(e => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [url]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await axios.put<string[]>(url, { tags: draft });
      setTags(data);
      setDraft(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const labels = RESIDENT_TAGS.filter(t => tags.includes(t.key)).map(t => t.label);
  return (
    <details open className="roster-subcard">
      <summary>Diện xã hội ({labels.length ? labels.join(', ') : 'không'})</summary>
      {error && (
        <div role="alert" className="roster-error">
          {error}
        </div>
      )}
      {draft ? (
        <fieldset className="roster-fields">
          <legend className="roster-subline">Chọn diện (tô màu trên sơ đồ địa bàn)</legend>
          {RESIDENT_TAGS.map(t => (
            <label key={t.key} className="roster-check">
              <input
                type="checkbox"
                checked={draft.includes(t.key)}
                onChange={e => setDraft(d => (e.target.checked ? [...(d ?? []), t.key] : (d ?? []).filter(k => k !== t.key)))}
              />{' '}
              {t.label}
            </label>
          ))}
          <div className="roster-actions">
            <button type="button" className="roster-btn-sm" disabled={saving} onClick={() => void save()}>
              {saving ? 'Đang lưu…' : 'Lưu diện'}
            </button>
            <button type="button" className="roster-btn-sm" disabled={saving} onClick={() => setDraft(null)}>
              Hủy
            </button>
          </div>
        </fieldset>
      ) : (
        <>
          <p className="roster-subline">
            {labels.length ? labels.join(' · ') : 'Không thuộc diện đảng viên, cán bộ hưu trí hay cựu chiến binh.'}
          </p>
          {canEdit && (
            <button type="button" className="roster-btn-sm" onClick={() => setDraft(tags)}>
              Sửa diện xã hội
            </button>
          )}
        </>
      )}
    </details>
  );
}
