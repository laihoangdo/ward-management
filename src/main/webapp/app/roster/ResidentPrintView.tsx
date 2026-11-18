import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Share2, X } from 'lucide-react';
import { ExportResult } from './residentExport';

const centered = new Set(['stt', 'birth', 'gender', 'registrationDate', 'validTo']);
// Paper needs a little more room than a spreadsheet for dates and short codes, which must not wrap mid-value.
const printWidth: Record<string, number> = { stt: 7, birth: 18, gender: 9, registrationDate: 18, validTo: 18, identity: 18 };
const widthOf = (c: { key: string; width: number }) => printWidth[c.key] ?? c.width;

/**
 * A4 landscape print layout of an exported resident list, rendered outside the app so `@media print` can hide everything
 * else. Printing or "Save as PDF" goes through the browser's own dialog.
 */
export default function ResidentPrintView({
  data,
  onClose,
  loadShareFile,
}: {
  data: ExportResult;
  onClose: () => void;
  /** Fetches this list as an Excel file for the device's share sheet (audited by the server). */
  loadShareFile?: () => Promise<File>;
}) {
  const printRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  const saveLocally = (file: File) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Opens the device's own share sheet (Zalo, Mail, Drive…) with the list as an Excel file. Browsers only allow this right
  // after a tap, so when downloading the file took too long the first tap just prepares it and a second tap shares it.
  const share = async () => {
    if (!loadShareFile) return;
    setConfirming(false);
    setShareMessage('');
    setSharing(true);
    let file = shareFile;
    try {
      if (!file) {
        file = await loadShareFile();
        setShareFile(file);
      }
      const payload = { files: [file], title: `Danh sách nhân khẩu – ${data.scope}`, text: data.summary };
      if (typeof navigator.share !== 'function' || (navigator.canShare && !navigator.canShare(payload))) {
        saveLocally(file);
        setShareMessage('Trình duyệt này không mở được ứng dụng chia sẻ; đã tải file Excel về máy để gửi qua ứng dụng bạn chọn.');
        return;
      }
      await navigator.share(payload);
      setShareMessage('Đã mở ứng dụng chia sẻ. Lần chia sẻ này đã được ghi vào nhật ký.');
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === 'AbortError') setShareMessage('');
      else if (name === 'NotAllowedError' && file) setShareMessage('File đã sẵn sàng. Bấm "Chia sẻ ngay" để chọn ứng dụng.');
      else setShareMessage((e as Error)?.message || 'Không chia sẻ được. Hãy thử lại hoặc dùng "In / Lưu PDF".');
    } finally {
      setSharing(false);
    }
  };
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

  // Column widths follow the same proportions as the Excel export, so short columns never squeeze into one letter per line.
  const totalWidth = data.columns.reduce((sum, c) => sum + widthOf(c), 0) || 1;
  const hamletIndex = data.communeWide ? data.columns.findIndex(c => c.key === 'hamlet') : -1;
  const agency = `CÔNG AN ${data.commune ? data.commune.toLocaleUpperCase('vi-VN') : 'XÃ'}`;
  const body: React.ReactNode[] = [];
  let group = '';
  data.rows.forEach((row, i) => {
    if (hamletIndex >= 0 && row[hamletIndex] !== group) {
      group = row[hamletIndex];
      body.push(
        <tr key={`g${i}`} className="resident-print-group">
          <th colSpan={data.columns.length} scope="colgroup">
            {group || 'Chưa rõ ấp'}
          </th>
        </tr>,
      );
    }
    body.push(
      <tr key={i}>
        {row.map((cell, j) => (
          <td key={j} className={centered.has(data.columns[j]?.key) ? 'is-center' : undefined}>
            {cell}
          </td>
        ))}
      </tr>,
    );
  });

  return createPortal(
    <div className="resident-print-root" role="dialog" aria-modal="true" aria-label="Bản in danh sách nhân khẩu">
      <div className="resident-print-toolbar">
        <span>
          Bản in khổ A4 ngang · {data.total.toLocaleString('vi-VN')} người
          {data.fullIdentity ? ' · có số định danh đầy đủ' : ''}
        </span>
        <button type="button" ref={printRef} className="resident-print-primary" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> In / Lưu PDF
        </button>
        {loadShareFile && (
          <button
            type="button"
            aria-expanded={confirming}
            disabled={sharing}
            onClick={() => (shareFile ? share() : setConfirming(value => !value))}
          >
            <Share2 size={16} aria-hidden="true" /> {sharing ? 'Đang chuẩn bị…' : shareFile ? 'Chia sẻ ngay' : 'Chia sẻ'}
          </button>
        )}
        <button type="button" onClick={onClose}>
          <X size={16} aria-hidden="true" /> Đóng
        </button>
        {confirming && (
          <div className="resident-print-share" role="group" aria-label="Xác nhận chia sẻ">
            <p>
              Danh sách có thông tin cá nhân của {data.total.toLocaleString('vi-VN')} người
              {data.fullIdentity ? ', kể cả số định danh đầy đủ' : ''}. Chỉ gửi cho cán bộ có thẩm quyền; file Excel được gửi qua ứng dụng
              bạn chọn và lần chia sẻ được ghi nhật ký.
            </p>
            <button type="button" className="resident-print-primary" onClick={share}>
              Tiếp tục chia sẻ
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              Hủy
            </button>
          </div>
        )}
        {shareMessage && (
          <p className="resident-print-share-status" role="status">
            {shareMessage}
          </p>
        )}
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
        <h1>DANH SÁCH NHÂN KHẨU</h1>
        <p className="resident-print-scope">{data.scope}</p>
        <p className="resident-print-filter">Điều kiện lọc: {data.summary}</p>
        <p className="resident-print-total">
          Tổng số: <strong>{data.total.toLocaleString('vi-VN')}</strong> người (nam {data.male.toLocaleString('vi-VN')}, nữ{' '}
          {data.female.toLocaleString('vi-VN')})
          {data.fullIdentity ? ' · Tài liệu có số định danh đầy đủ — không sao chép, không để lộ' : ''}
        </p>
        <table className="resident-print-table">
          <colgroup>
            {data.columns.map(c => (
              <col key={c.key} style={{ width: `${((widthOf(c) / totalWidth) * 100).toFixed(1)}%` }} />
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
          <tbody>{body}</tbody>
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
