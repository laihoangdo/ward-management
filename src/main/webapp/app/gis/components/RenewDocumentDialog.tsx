import React, { useState } from 'react';
import { DocumentRecord } from '../types';
import { useDialogFocus } from '../utils/useDialogFocus';
import { DiscardChangesDialog } from './DiscardChangesDialog';
import { useUnsavedPageGuard } from '../utils/useUnsavedPageGuard';

export function RenewDocumentDialog({
  document,
  onClose,
  onSave,
}: {
  document: DocumentRecord;
  onClose: () => void;
  onSave: (date: string) => Promise<void>;
}) {
  const [date, setDate] = useState('');
  const [openedAt] = useState(() => Date.now());
  useUnsavedPageGuard(Boolean(date));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDiscard, setShowDiscard] = useState(false);
  const requestClose = () => {
    if (saving) return;
    if (date) setShowDiscard(true);
    else onClose();
  };
  const ref = useDialogFocus(true, requestClose, saving);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !date) return;
    setSaving(true);
    setError('');
    try {
      await onSave(date);
      onClose();
    } catch {
      setError('Chưa thể xác nhận gia hạn. Kiểm tra trạng thái hồ sơ và ngày nhập trước khi thử lại.');
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
      <form onSubmit={submit} aria-busy={saving} className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4">
        <h2 id="renew-document-title" className="text-lg font-bold">
          Gia hạn hồ sơ
        </h2>
        <div className="rounded-lg border border-slate-200 p-3 text-sm">
          <strong>{document.title}</strong>
          <p className="mb-1">
            {document.docCode} · {document.targetName}
          </p>
          <p className="mb-0">Hạn hiện tại: {document.expiryDate}</p>
        </div>
        <label className="block text-sm font-semibold">
          Ngày hết hạn mới
          <input
            type="date"
            required
            disabled={saving}
            value={date}
            onChange={event => setDate(event.target.value)}
            className="mt-2 block w-full rounded-lg border border-slate-300 p-2"
          />
        </label>
        {date && new Date(`${date}T23:59:59`).getTime() < openedAt && (
          <p role="status" className="text-sm text-amber-700">
            Ngày đã chọn nằm trong quá khứ. Kiểm tra lại ngày hết hạn trước khi xác nhận.
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
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            Xác nhận gia hạn
          </button>
        </div>
      </form>
    </div>
  );
}
