import React, { useState } from 'react';
import axios from 'axios';

type Member = { membership_id: string; membership_version: number; full_name: string };
type Household = { id: string; code?: string; raw_address?: string; members: Member[] };

const today = () => new Date().toLocaleDateString('en-CA');

/** Splits chosen members off a household into a new one; history is kept by the server (`POST /households/{id}/split`). */
export default function HouseholdSplitDialog({
  household,
  onClose,
  onSplit,
}: {
  household: Household;
  onClose: () => void;
  onSplit: (newHouseholdId: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [head, setHead] = useState('');
  const [address, setAddress] = useState(household.raw_address ?? '');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // One request ID per dialog so a retry after a network failure cannot create a second household.
  const [requestId] = useState(() => crypto.randomUUID());

  const toggle = (id: string) => {
    setSelected(current => (current.includes(id) ? current.filter(x => x !== id) : [...current, id]));
    if (head === id) setHead('');
  };
  const canSave = selected.length > 0 && address.trim() !== '' && reason.trim() !== '' && date !== '' && !busy;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await axios.post(`/api/roster/households/${household.id}/split`, {
        requestId,
        rawAddress: address.trim(),
        reason: reason.trim(),
        effectiveDate: date,
        headMembershipId: head || undefined,
        members: household.members
          .filter(m => selected.includes(m.membership_id))
          .map(m => ({ membershipId: m.membership_id, version: m.membership_version })),
      });
      onSplit(String(data.id));
    } catch {
      setError('Không tách được hộ. Dữ liệu chưa được lưu; tải lại hồ sơ để đối chiếu rồi thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="roster-overlay">
      <section role="dialog" aria-modal="true" aria-label="Tách hộ" className="roster-dialog">
        <h2>Tách hộ từ {household.code ?? 'hộ đang xem'}</h2>
        <p>
          Chọn thành viên chuyển sang hộ mới. Quan hệ hộ cũ được kết thúc và quan hệ mới bắt đầu cùng ngày, lịch sử cư trú được giữ nguyên.
        </p>
        {error && (
          <div role="alert" className="roster-error">
            {error}
          </div>
        )}
        <fieldset>
          <legend>Thành viên chuyển sang hộ mới</legend>
          {household.members.map(m => (
            <label key={m.membership_id} className="roster-row">
              <input type="checkbox" checked={selected.includes(m.membership_id)} onChange={() => toggle(m.membership_id)} /> {m.full_name}
            </label>
          ))}
          {household.members.length === 0 && <p>Hộ này chưa có thành viên nào để tách.</p>}
        </fieldset>
        <label>
          Chủ hộ mới
          <select value={head} onChange={e => setHead(e.target.value)} disabled={selected.length === 0}>
            <option value="">Chưa chọn</option>
            {household.members
              .filter(m => selected.includes(m.membership_id))
              .map(m => (
                <option key={m.membership_id} value={m.membership_id}>
                  {m.full_name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Địa chỉ hộ mới *
          <input value={address} onChange={e => setAddress(e.target.value)} />
        </label>
        <label>
          Ngày hiệu lực *
          <input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
        </label>
        <label>
          Lý do / nguồn kiểm chứng *
          <input value={reason} onChange={e => setReason(e.target.value)} />
        </label>
        <p className="roster-subline">Vị trí hộ mới chỉ là vị trí tạm cho đến khi được xác minh tại thực địa.</p>
        <div className="roster-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="button" className="roster-primary" onClick={() => void save()} disabled={!canSave}>
            Tách hộ
          </button>
        </div>
      </section>
    </div>
  );
}
