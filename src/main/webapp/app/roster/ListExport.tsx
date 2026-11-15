import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { FileSpreadsheet, Printer, X } from 'lucide-react';
import './residentExport.css';

/** A printable list from `/api/{screen}/export/print` (subjects, establishments, guidance documents). */
export type ListSheet = {
  kind: string;
  commune: string;
  title: string;
  scope: string;
  summary: string;
  totalLine: string;
  columns: { key: string; header: string; width: number; center: boolean }[];
  rows: string[][];
  truncated: boolean;
  generatedBy: string;
  generatedAt: string;
};

const fileNameFrom = (header: string | undefined, fallback: string) => {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return header?.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
};

async function exportError(e: unknown): Promise<string> {
  if (axios.isAxiosError(e)) {
    if (e.response?.status === 403) return 'Chưa được cấp quyền xuất danh sách (Xuất báo cáo).';
    const data = e.response?.data;
    try {
      const body = data instanceof Blob ? JSON.parse(await data.text()) : data;
      const message = body?.message ?? body?.detail ?? body?.title;
      if (typeof message === 'string' && message) return message;
    } catch {
      // Not a JSON error body.
    }
  }
  return 'Không tạo được danh sách. Hãy thử lại.';
}

/**
 * "In danh sách" and "Xuất Excel" for a screen's current filter. The server re-checks scope and permission and writes every
 * list to the audit log; identity numbers stay masked.
 */
export function ListExportActions({
  base,
  params,
  fallbackName,
}: {
  /** Screen API, e.g. /api/subjects; the lists live at {base}/export/print and {base}/export/xlsx. */
  base: string;
  params: Record<string, string | number>;
  fallbackName: string;
}) {
  const [busy, setBusy] = useState<'' | 'print' | 'xlsx'>('');
  const [sheet, setSheet] = useState<ListSheet | null>(null);
  const [error, setError] = useState('');

  const print = async () => {
    setBusy('print');
    setError('');
    try {
      const { data } = await axios.get<ListSheet>(`${base}/export/print`, { params });
      setSheet(data);
    } catch (e) {
      setError(await exportError(e));
    } finally {
      setBusy('');
    }
  };
  const download = async () => {
    setBusy('xlsx');
    setError('');
    try {
      const response = await axios.get(`${base}/export/xlsx`, { params, responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileNameFrom(response.headers?.['content-disposition'] as string | undefined, fallbackName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(await exportError(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <button type="button" disabled={busy !== ''} onClick={() => void print()}>
        <Printer size={16} aria-hidden="true" /> {busy === 'print' ? 'Đang chuẩn bị…' : 'In danh sách'}
      </button>
      <button type="button" disabled={busy !== ''} onClick={() => void download()}>
        <FileSpreadsheet size={16} aria-hidden="true" /> {busy === 'xlsx' ? 'Đang tạo file…' : 'Xuất Excel'}
      </button>
      {error && (
        <span role="alert" className="roster-error">
          {error}
        </span>
      )}
      {sheet && <ListPrintView data={sheet} onClose={() => setSheet(null)} />}
    </>
  );
}

/** A4 landscape print layout of a list, rendered outside the app so `@media print` hides everything else. */
export function ListPrintView({ data, onClose }: { data: ListSheet; onClose: () => void }) {
  const printRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    printRef.current?.focus();
    document.body.classList.add('resident-printing');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.classList.remove('resident-printing');
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const totalWidth = data.columns.reduce((sum, c) => sum + c.width, 0) || 1;
  const agency = `CÔNG AN ${data.commune ? data.commune.toLocaleUpperCase('vi-VN') : 'XÃ'}`;
  return createPortal(
    <div className="resident-print-root" role="dialog" aria-modal="true" aria-label={`Bản in ${data.title.toLocaleLowerCase('vi-VN')}`}>
      <div className="resident-print-toolbar">
        <span>
          Bản in khổ A4 ngang · {data.rows.length.toLocaleString('vi-VN')} dòng{data.truncated ? ' (đã cắt bớt)' : ''}
        </span>
        <button type="button" ref={printRef} className="resident-print-primary" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> In / Lưu PDF
        </button>
        <button type="button" onClick={onClose}>
          <X size={16} aria-hidden="true" /> Đóng
        </button>
      </div>
      <article className="resident-print-page">
        <div className="resident-print-heading">
          <div>
            <strong>{agency}</strong>
          </div>
          <div>
            <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong>
            <span className="resident-print-motto">Độc lập - Tự do - Hạnh phúc</span>
          </div>
        </div>
        <h1>{data.title}</h1>
        <p className="resident-print-scope">{data.scope}</p>
        <p className="resident-print-filter">Điều kiện lọc: {data.summary}</p>
        <p className="resident-print-total">{data.totalLine}</p>
        <table className="resident-print-table">
          <colgroup>
            {data.columns.map(c => (
              <col key={c.key} style={{ width: `${((c.width / totalWidth) * 100).toFixed(1)}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {data.columns.map(c => (
                <th key={c.key} scope="col">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={data.columns[j]?.center ? 'is-center' : undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="resident-print-sign">
          <p className="resident-print-date">......., ngày ..... tháng ..... năm .......</p>
          <div>
            <strong>NGƯỜI LẬP DANH SÁCH</strong>
            <em>(Ký, ghi rõ họ tên)</em>
          </div>
          <div>
            <strong>TRƯỞNG CÔNG AN XÃ</strong>
            <em>(Ký, ghi rõ họ tên, đóng dấu)</em>
          </div>
        </footer>
        <p className="resident-print-meta">
          In lúc {data.generatedAt} bởi {data.generatedBy}
        </p>
      </article>
    </div>,
    document.body,
  );
}
