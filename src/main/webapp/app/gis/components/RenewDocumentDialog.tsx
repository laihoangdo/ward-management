import React, { useEffect, useRef, useState } from 'react';
import { DocumentRecord } from '../types';
import { browseHouseholds } from '../services/householdBrowse';
import { DocumentCommand, hcmToday } from '../services/documentLifecycle';
import { useDialogFocus } from '../utils/useDialogFocus';
import { DiscardChangesDialog } from './DiscardChangesDialog';
import { useUnsavedPageGuard } from '../utils/useUnsavedPageGuard';

export function RenewDocumentDialog({
  document,
  onClose,
  onSave,
}: {
  document: DocumentRecord | null;
  onClose: () => void;
  onSave: (command: DocumentCommand) => Promise<void>;
}) {
  const source: Partial<DocumentRecord> = document || {};
  const [date, setDate] = useState('');
  const [issuedOn, setIssuedOn] = useState(source.issueDate || '');
  const [reason, setReason] = useState('');
  const [number, setNumber] = useState(source.documentNumber || '');
  const [authority, setAuthority] = useState(source.issuingAuthority || '');
  const [name, setName] = useState(source.title || '');
  const [kind, setKind] = useState(source.categoryLabel || '');
  const [householdId, setHouseholdId] = useState(source.householdId ? String(source.householdId) : '');
  const [search, setSearch] = useState('');
  const [houses, setHouses] = useState<{ id: string; code: string; address: string }[]>([]);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const dirty = Boolean(date || reason || (!source.householdId && householdId) || (!document && (name || kind)));
  const action = !document ? 'Đăng ký hồ sơ' : document.expiryOn ? 'Xác nhận gia hạn' : 'Xác nhận đối chiếu';
  useUnsavedPageGuard(dirty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDiscard, setShowDiscard] = useState(false);
  const requestClose = () => {
    if (saving) return;
    if (dirty) setShowDiscard(true);
    else onClose();
  };
  const ref = useDialogFocus(true, requestClose, saving);
  useEffect(() => {
    if (source.householdId) return;
    const controller = new AbortController();
    setSearching(true);
    setSearchError('');
    const timer = window.setTimeout(() => {
      void browseHouseholds({ page: 0, size: 12, search, hamlet: 'all', type: 'all', residence: 'all' }, controller.signal)
        .then(page => {
          if (!controller.signal.aborted)
            setHouses(
              page.items.map(h => ({ id: h.id, code: h.code, address: [h.houseNumber, h.street, h.hamlet].filter(Boolean).join(', ') })),
            );
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearchError('Không tải được danh sách hộ. Hãy thử tìm lại.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [source.householdId, search]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !date || !householdId || !reason.trim()) return;
    setSaving(true);
    setError('');
    try {
      const values = {
        version: source.version,
        householdId: Number(householdId),
        expiryOn: date,
        issuedOn: issuedOn || null,
        documentNumber: number,
        issuingAuthority: authority,
        reason: reason.trim(),
        docName: name,
        docType: kind,
      };
      const fingerprint = JSON.stringify(values);
      if (requestRef.current?.fingerprint !== fingerprint) requestRef.current = { fingerprint, id: crypto.randomUUID() };
      await onSave({ ...values, requestId: requestRef.current.id });
      onClose();
    } catch (failure) {
      const status = (failure as { response?: { status?: number } }).response?.status;
      setError(
        status === 409
          ? 'Hồ sơ đã thay đổi hoặc mã yêu cầu không khớp. Đóng hộp thoại và tải lại dữ liệu.'
          : 'Chưa thể xác nhận. Kiểm tra quyền, hộ đã chọn, ngày hết hạn và kết nối trước khi thử lại.',
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="renew-document-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    >
      <DiscardChangesDialog open={showDiscard} onContinue={() => setShowDiscard(false)} onDiscard={onClose} />
      <form
        onSubmit={submit}
        aria-busy={saving}
        className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4"
      >
        <h2 id="renew-document-title" className="text-lg font-bold">
          {!document ? 'Đăng ký hồ sơ' : document.expiryOn ? 'Gia hạn hồ sơ' : 'Đối chiếu hồ sơ nguồn'}
        </h2>
        <p className="text-xs text-slate-500">
          Chỉ dùng cho hồ sơ có ngày hết hạn xác định. Không nhập ngày giả cho giấy tờ không thời hạn hoặc chưa biết hạn.
        </p>
        {document && (
          <div className="rounded-lg border border-slate-200 p-3 text-sm">
            <strong>{document.title}</strong>
            <p className="mb-1">
              {document.docCode} · {document.targetName}
            </p>
            <p className="mb-0">Hạn đã xác nhận: {document.expiryOn || 'Chưa đối chiếu'}</p>
            {document.legacyExpiryDate && <p>Ngày nguyên văn nguồn: {document.legacyExpiryDate}</p>}
          </div>
        )}
        <fieldset disabled={saving} className="space-y-3">
          {!document && (
            <>
              <label className="block text-sm">
                Tên hồ sơ
                <input
                  required
                  maxLength={255}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="block w-full border rounded p-2"
                />
              </label>
              <label className="block text-sm">
                Loại hồ sơ
                <input
                  required
                  maxLength={255}
                  value={kind}
                  onChange={e => setKind(e.target.value)}
                  className="block w-full border rounded p-2"
                />
              </label>
            </>
          )}
          <p className="text-sm">
            Hộ đã chọn: <strong>{householdId ? `#${householdId}` : 'Chưa chọn'}</strong>. Không tự ghép theo tên nguồn.
          </p>
          {!source.householdId && (
            <div className="space-y-2">
              <label className="block text-sm">
                Tìm hộ theo mã hoặc địa chỉ
                <input value={search} onChange={e => setSearch(e.target.value)} className="block w-full border rounded p-2" />
              </label>
              {searching && <p role="status">Đang tìm hộ…</p>}
              {searchError && <p role="alert">{searchError}</p>}
              <div className="max-h-36 overflow-auto space-y-1">
                {houses.map(h => (
                  <button
                    key={h.id}
                    type="button"
                    aria-pressed={householdId === h.id}
                    onClick={() => setHouseholdId(h.id)}
                    className="block w-full rounded border p-2 text-left text-sm"
                  >
                    {householdId === h.id ? '✓ ' : ''}
                    {h.code} — {h.address}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="block text-sm">
            Số giấy tờ (nếu biết)
            <input maxLength={255} value={number} onChange={e => setNumber(e.target.value)} className="block w-full border rounded p-2" />
          </label>
          <label className="block text-sm">
            Cơ quan cấp (nếu biết)
            <input
              maxLength={255}
              value={authority}
              onChange={e => setAuthority(e.target.value)}
              className="block w-full border rounded p-2"
            />
          </label>
          <label className="block text-sm">
            Ngày cấp (nếu biết)
            <input
              type="date"
              value={issuedOn}
              max={date || undefined}
              onChange={e => setIssuedOn(e.target.value)}
              className="block w-full border rounded p-2"
            />
          </label>
          <label className="block text-sm font-semibold">
            Ngày hết hạn mới
            <input
              type="date"
              min={source.expiryOn ? hcmToday() : issuedOn || undefined}
              required
              disabled={saving}
              value={date}
              onChange={event => setDate(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-300 p-2"
            />
          </label>
          <label className="block text-sm">
            Lý do / căn cứ đối chiếu
            <textarea
              required
              maxLength={2000}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="block w-full border rounded p-2"
            />
          </label>
        </fieldset>
        {date && !source.expiryOn && date < hcmToday() && (
          <p role="status" className="text-sm text-amber-700">
            Đang xác nhận một hồ sơ đã hết hạn, không phải gia hạn. Trạng thái sẽ được tính theo ngày này.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {saving && (
          <p role="status" className="text-sm">
            Đang xác nhận gia hạn…
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={requestClose} className="rounded-lg border px-4 py-2 text-sm">
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving || !householdId || !reason.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {action}
          </button>
        </div>
      </form>
    </div>
  );
}
