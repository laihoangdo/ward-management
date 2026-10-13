import React from 'react';
import { useDialogFocus } from '../utils/useDialogFocus';

export function DiscardChangesDialog({ open, onContinue, onDiscard }: { open: boolean; onContinue: () => void; onDiscard: () => void }) {
  const ref = useDialogFocus(open, onContinue);
  if (!open) return null;
  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="discard-title"
      aria-describedby="discard-description"
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
    >
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-xl">
        <h2 id="discard-title" className="text-lg font-bold">
          Bạn có thay đổi chưa lưu
        </h2>
        <p id="discard-description" className="text-sm text-slate-600 dark:text-slate-300">
          Tiếp tục chỉnh sửa để giữ nội dung, hoặc bỏ thay đổi để đóng biểu mẫu.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onDiscard} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">
            Bỏ thay đổi
          </button>
          <button
            type="button"
            autoFocus
            onClick={onContinue}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Tiếp tục chỉnh sửa
          </button>
        </div>
      </div>
    </div>
  );
}
