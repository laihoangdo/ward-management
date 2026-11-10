import React, { useEffect, useState } from 'react';
import { DocumentRecord } from '../types';
import { documentHistory, DocumentHistoryEntry } from '../services/documentLifecycle';
import { useDialogFocus } from '../utils/useDialogFocus';

export function DocumentHistoryDialog({ document, onClose }: { document: DocumentRecord; onClose: () => void }) {
  const ref = useDialogFocus(true, onClose, false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<DocumentHistoryEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setRows([]);
    void documentHistory(document.id, page, controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setRows(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Không đọc được lịch sử; kiểm tra kết nối hoặc quyền truy cập.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [document.id, page]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-history-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    >
      <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 p-5 space-y-3">
        <h2 id="document-history-title" className="text-lg font-bold">
          Lịch sử hồ sơ — {document.docCode}
        </h2>
        {loading && <p role="status">Đang tải lịch sử…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && rows.length === 0 && <p>Chưa có thao tác xác nhận/gia hạn. Dữ liệu nguồn cũ chưa được đối chiếu.</p>}
        {rows.map(row => (
          <article key={row.id} className="rounded border p-3 text-sm space-y-1">
            <strong>{{ REGISTER: 'Đăng ký', CONFIRM: 'Xác nhận nguồn', RENEW: 'Gia hạn' }[row.operation]}</strong>
            <p>
              {row.previous_expiry || 'Chưa xác nhận'} → {row.expiry_on}
            </p>
            <p>
              Số giấy tờ: {row.document_number || 'Chưa ghi nhận'} · Cơ quan cấp: {row.issuing_authority || 'Chưa ghi nhận'}
            </p>
            <p>
              Cán bộ: {row.actor} · {row.recorded_at}
            </p>
            <p>Lý do: {row.reason}</p>
          </article>
        ))}
        <div className="flex justify-between gap-2">
          <button type="button" disabled={loading || page === 0} onClick={() => setPage(p => p - 1)}>
            Trang trước
          </button>
          <span>Trang {page + 1}</span>
          <button type="button" disabled={loading || rows.length < 50} onClick={() => setPage(p => p + 1)}>
            Trang sau
          </button>
          <button type="button" onClick={onClose} className="rounded border px-3 py-2">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
