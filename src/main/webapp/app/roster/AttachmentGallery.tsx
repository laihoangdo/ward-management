import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Camera, FileText, Star, Trash2 } from 'lucide-react';
// Registers the hamlet interceptor when the gallery is used outside the roster (subjects, facilities).
import './hamletScope';

/** Metadata of an attachment; bytes are fetched separately through the authenticated API and never cached. */
export type AttachmentItem = {
  id: string;
  category?: string;
  caption: string;
  primary: boolean;
  createdAt: string;
  createdBy: string;
  size: number;
  mime: string;
};

const MAX_EDGE = 1600;
const MAX_BYTES = 5 * 1024 * 1024;
const PDF_MAX_BYTES = 20 * 1024 * 1024;

/** Phone photos are often larger than the 5 MB server limit; shrink to 1600 px JPEG before upload when the browser can. */
export async function shrinkImage(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= MAX_BYTES) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

const message = (e: unknown) =>
  axios.isAxiosError(e) && typeof e.response?.data?.message === 'string'
    ? e.response.data.message
    : axios.isAxiosError(e) && typeof e.response?.data?.detail === 'string'
      ? e.response.data.detail
      : 'Không thể xử lý tệp. Kiểm tra quyền và kết nối.';

const isPdf = (a: AttachmentItem) => a.mime === 'application/pdf';

/**
 * Attachment section: images as a gallery (choose the main photo), PDFs as files that open in a new tab. Used for resident
 * portraits and for an establishment's papers and photos.
 */
export default function AttachmentGallery({
  base,
  title = 'Hình ảnh',
  noun = 'ảnh nhân khẩu',
  allowPdf = false,
  canEdit = true,
  hint = 'JPEG/PNG, tự thu nhỏ trước khi gửi; tối đa 10 ảnh.',
}: {
  /** Collection URL, e.g. /api/roster/residents/{id}/photos. */
  base: string;
  title?: string;
  /** What one item is called in empty text, alt text and confirmations. */
  noun?: string;
  allowPdf?: boolean;
  canEdit?: boolean;
  hint?: string;
}) {
  const [items, setItems] = useState<AttachmentItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const capitalNoun = noun.charAt(0).toUpperCase() + noun.slice(1);

  const load = async () => {
    const { data } = await axios.get<AttachmentItem[]>(base);
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    setItems([]);
    setError('');
    load().catch(e => setError(message(e)));
  }, [base]);

  // Fetch each image through the authenticated API and show it from an object URL released on change/unmount.
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    Promise.all(
      items
        .filter(a => !isPdf(a))
        .map(async a => {
          const { data } = await axios.get<Blob>(`${base}/${a.id}/content`, { responseType: 'blob' });
          const url = URL.createObjectURL(data);
          created.push(url);
          return [a.id, url] as const;
        }),
    )
      .then(entries => {
        if (!cancelled) setUrls(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setError('Không tải được ảnh');
      });
    return () => {
      cancelled = true;
      created.forEach(u => URL.revokeObjectURL(u));
    };
  }, [items]);

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const openPdf = (a: AttachmentItem) =>
    act(async () => {
      // Open the window first (inside the click) so pop-up blockers allow it, then point it at the downloaded bytes.
      const view = window.open('', '_blank');
      const { data } = await axios.get<Blob>(`${base}/${a.id}/content`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      if (view) view.location.href = url;
      else window.location.assign(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });

  const upload = (file: File) => {
    const pdf = file.type === 'application/pdf';
    if (!['image/jpeg', 'image/png'].includes(file.type) && !(allowPdf && pdf)) {
      setError(allowPdf ? 'Chỉ nhận ảnh JPEG/PNG hoặc tệp PDF' : 'Chỉ nhận ảnh JPEG hoặc PNG');
      return;
    }
    if (pdf && file.size > PDF_MAX_BYTES) {
      setError('Tệp PDF tối đa 20 MB');
      return;
    }
    act(async () => {
      const blob = pdf ? file : await shrinkImage(file);
      const form = new FormData();
      form.append('file', blob, blob === file ? file.name : 'anh.jpg');
      if (caption.trim()) form.append('caption', caption.trim());
      await axios.post(base, form);
      setCaption('');
      await load();
    });
  };

  const images = items.filter(a => !isPdf(a));
  const files = items.filter(isPdf);

  return (
    <details open className="roster-subcard">
      <summary>
        {title} ({items.length})
      </summary>
      {error && (
        <div role="alert" className="roster-error">
          {error}
        </div>
      )}
      {items.length === 0 && <p className="roster-subline">Chưa có {noun}.</p>}
      {files.length > 0 && (
        <ul className="roster-file-list" aria-label={`Tệp ${noun}`}>
          {files.map(a => (
            <li key={a.id} className="roster-member-card">
              <div className="roster-member-info">
                <div className="roster-member-title-row">
                  <FileText size={16} aria-hidden="true" />
                  <strong>{a.caption || 'Tệp PDF'}</strong>
                </div>
                <span className="roster-member-meta">
                  {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                  {a.createdBy ? ` · ${a.createdBy}` : ''} · {Math.max(1, Math.round(a.size / 1024))} KB
                </span>
              </div>
              <div className="roster-actions">
                <button type="button" className="roster-btn-sm" disabled={busy} onClick={() => void openPdf(a)}>
                  Mở tệp
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className="roster-btn-sm"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Xoá tệp này khỏi hồ sơ?`)) return;
                      void act(async () => {
                        await axios.delete(`${base}/${a.id}`);
                        await load();
                      });
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" /> Xoá
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ul className="roster-photo-grid" aria-label={capitalNoun}>
        {images.map(p => (
          <li key={p.id} className="roster-photo" data-primary={p.primary || undefined}>
            {urls[p.id] ? (
              <img src={urls[p.id]} alt={p.caption || capitalNoun} />
            ) : (
              <span className="roster-photo-placeholder">Đang tải…</span>
            )}
            <div className="roster-photo-meta">
              {p.primary && <span className="roster-badge roster-badge--ok">Ảnh chính</span>}
              {p.caption && <span>{p.caption}</span>}
              <span className="roster-subline">
                {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                {p.createdBy ? ` · ${p.createdBy}` : ''}
              </span>
            </div>
            {canEdit && (
              <div className="roster-actions">
                {!p.primary && (
                  <button
                    type="button"
                    className="roster-btn-sm"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const { data } = await axios.put<AttachmentItem[]>(`${base}/${p.id}/primary`);
                        setItems(data);
                      })
                    }
                  >
                    <Star size={14} aria-hidden="true" /> Đặt làm ảnh chính
                  </button>
                )}
                <button
                  type="button"
                  className="roster-btn-sm"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Xoá ảnh này khỏi hồ sơ?`)) return;
                    void act(async () => {
                      await axios.delete(`${base}/${p.id}`);
                      await load();
                    });
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" /> Xoá
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="roster-photo-upload">
          <label>
            Chú thích {allowPdf ? 'tệp' : 'ảnh'} (không bắt buộc)
            <input value={caption} maxLength={500} onChange={e => setCaption(e.target.value)} />
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept={allowPdf ? 'image/jpeg,image/png,application/pdf' : 'image/jpeg,image/png'}
            hidden
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) upload(file);
            }}
          />
          <button type="button" className="roster-btn-sm" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            <Camera size={14} aria-hidden="true" />{' '}
            {busy ? 'Đang xử lý…' : allowPdf ? 'Thêm ảnh / giấy tờ (chụp hoặc chọn tệp)' : 'Thêm ảnh (chụp hoặc chọn tệp)'}
          </button>
          <span className="roster-subline">{hint}</span>
        </div>
      )}
    </details>
  );
}
