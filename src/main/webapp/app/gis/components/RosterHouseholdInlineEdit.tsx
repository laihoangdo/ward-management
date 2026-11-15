import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Save } from 'lucide-react';
import { householdEditFields, householdEditInitial, type HouseholdField, type HouseholdRow } from '../../roster/householdForm';
import { errorText } from '../../subjects/subjectModel';

const text = (v: unknown): string => (v == null ? '' : typeof v === 'string' ? v : `${v as string | number | boolean}`);

/**
 * "Sửa thông tin hộ" for a roster (TC2) household inside the map record panel: the same fields and audited endpoint as
 * the household screen (PUT /api/roster/households/{id}, version-checked, with a reason), without leaving the map.
 */
export function RosterHouseholdInlineEdit({
  household,
  hamletId,
  onSaved,
  onCancel,
  onDirtyChange,
}: {
  /** Household as returned by GET /api/roster/households/{id} or /legacy-households/{id}. */
  household: HouseholdRow;
  hamletId?: number;
  onSaved: (updated: HouseholdRow) => Promise<void> | void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [initial] = useState<HouseholdRow>(() => {
    const values = householdEditInitial(household);
    householdEditFields.forEach(f => {
      if (values[f.key] == null) values[f.key] = f.type === 'checkbox' ? false : (f.options?.[0]?.[0] ?? '');
    });
    return values;
  });
  const [data, setData] = useState<HouseholdRow>(initial);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const visible = (f: HouseholdField) => !f.showWhen || f.showWhen(data);
  const isMissing = (f: HouseholdField) => visible(f) && f.required && f.type !== 'checkbox' && !text(data[f.key]).trim();
  const change = (key: string, value: unknown) => {
    const next = { ...data, [key]: value };
    setData(next);
    onDirtyChange(householdEditFields.some(f => text(next[f.key]) !== text(initial[f.key])));
    if (missing.includes(key)) setMissing(missing.filter(k => k !== key));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const empty = householdEditFields.filter(isMissing).map(f => f.key);
    setMissing(empty);
    if (empty.length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data: saved } = await axios.put<HouseholdRow>(
        `/api/roster/households/${encodeURIComponent(text(household.id))}`,
        { ...data, requestId: crypto.randomUUID() },
        { params: hamletId ? { hamletId } : undefined },
      );
      onDirtyChange(false);
      await onSaved(saved);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const fieldId = (key: string) => `roster-household-edit-${key}`;

  return (
    <form noValidate className="gis-hh-form" onSubmit={e => void submit(e)} aria-busy={busy}>
      {missing.length > 0 && (
        <p ref={summaryRef} tabIndex={-1} role="alert" className="gis-hh-alert is-error">
          Còn thiếu:{' '}
          {householdEditFields
            .filter(f => missing.includes(f.key))
            .map(f => f.label)
            .join(', ')}
          .
        </p>
      )}
      {error && (
        <p role="alert" className="gis-hh-alert is-error">
          {error}
        </p>
      )}
      <div className="gis-hh-fields">
        {householdEditFields.filter(visible).map(f => {
          const invalid = missing.includes(f.key);
          const hintId = `${fieldId(f.key)}-hint`;
          const common = {
            id: fieldId(f.key),
            disabled: busy,
            'aria-invalid': invalid || undefined,
            'aria-describedby': invalid ? hintId : undefined,
          };
          if (f.type === 'checkbox')
            return (
              <label key={f.key} className="gis-check-row gis-hh-field-wide">
                <input type="checkbox" {...common} checked={data[f.key] === true} onChange={e => change(f.key, e.target.checked)} />
                <span>{f.label}</span>
              </label>
            );
          return (
            <div key={f.key} className={`gis-hh-field${f.key === 'rawAddress' || f.key === 'reason' ? ' gis-hh-field-wide' : ''}`}>
              <label htmlFor={fieldId(f.key)}>
                {f.label}
                {f.required && <span aria-hidden="true"> *</span>}
              </label>
              {f.options ? (
                <select {...common} value={text(data[f.key])} onChange={e => change(f.key, e.target.value)}>
                  {f.options.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  {...common}
                  type={f.type === 'date' ? 'date' : 'text'}
                  inputMode={f.key === 'phone' ? 'tel' : undefined}
                  required={f.required}
                  value={text(data[f.key])}
                  onChange={e => change(f.key, e.target.value)}
                />
              )}
              {invalid && (
                <span id={hintId} className="gis-hh-field-error">
                  Nhập {f.label.toLowerCase()}.
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="gis-hh-form-actions">
        <button type="button" className="gis-hh-btn" disabled={busy} onClick={onCancel}>
          Hủy
        </button>
        <button type="submit" className="gis-hh-btn is-primary" disabled={busy}>
          <Save aria-hidden="true" className="w-4 h-4" />
          <span>{busy ? 'Đang lưu…' : 'Lưu thông tin'}</span>
        </button>
      </div>
    </form>
  );
}
