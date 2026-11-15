import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Camera, Star, Trash2 } from 'lucide-react';

/** Metadata of a resident portrait (bytes are fetched separately, never cached by the browser). */
export type ResidentPhoto = {
  id: string;
  caption: string;
  primary: boolean;
  createdAt: string;
  createdBy: string;
  size: number;
  mime: string;
};

const MAX_EDGE = 1600;
const MAX_BYTES = 5 * 1024 * 1024;

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
      : 'Không thể xử lý ảnh. Kiểm tra quyền và kết nối.';

/** "Hình ảnh" section of the resident detail: portrait gallery with upload, choose main photo and delete. */
export default function ResidentPhotos({ residentId, api }: { residentId: string; api: string }) {
  const [photos, setPhotos] = useState<ResidentPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const base = `${api}/residents/${residentId}/photos`;

  const load = async () => {
    const { data } = await axios.get<ResidentPhoto[]>(base);
    setPhotos(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    setPhotos([]);
    setError('');
    load().catch(e => setError(message(e)));
  }, [residentId]);

  // Fetch each image through the authenticated API and show it from an object URL released on change/unmount.
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    Promise.all(
      photos.map(async p => {
        const { data } = await axios.get<Blob>(`${base}/${p.id}/content`, { responseType: 'blob' });
        const url = URL.createObjectURL(data);
        created.push(url);
        return [p.id, url] as const;
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
  }, [photos]);

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

  const upload = (file: File) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Chỉ nhận ảnh JPEG hoặc PNG');
      return;
    }
    act(async () => {
      const blob = await shrinkImage(file);
      const form = new FormData();
      form.append('file', blob, blob === file ? file.name : 'anh.jpg');
      if (caption.trim()) form.append('caption', caption.trim());
      await axios.post(base, form);
      setCaption('');
      await load();
    });
  };

  return (
    <details open className="roster-subcard">
      <summary>Hình ảnh ({photos.length})</summary>
      {error && (
        <div role="alert" className="roster-error">
          {error}
        </div>
      )}
      {photos.length === 0 && <p className="roster-subline">Chưa có ảnh nhân khẩu.</p>}
      <ul className="roster-photo-grid" aria-label="Ảnh nhân khẩu">
        {photos.map(p => (
          <li key={p.id} className="roster-photo" data-primary={p.primary || undefined}>
            {urls[p.id] ? (
              <img src={urls[p.id]} alt={p.caption || 'Ảnh nhân khẩu'} />
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
            <div className="roster-actions">
              {!p.primary && (
                <button
                  type="button"
                  className="roster-btn-sm"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const { data } = await axios.put<ResidentPhoto[]>(`${base}/${p.id}/primary`);
                      setPhotos(data);
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
                  if (!window.confirm('Xoá ảnh này khỏi hồ sơ nhân khẩu?')) return;
                  act(async () => {
                    await axios.delete(`${base}/${p.id}`);
                    await load();
                  });
                }}
              >
                <Trash2 size={14} aria-hidden="true" /> Xoá
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="roster-photo-upload">
        <label>
          Chú thích ảnh (không bắt buộc)
          <input value={caption} maxLength={500} onChange={e => setCaption(e.target.value)} />
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          hidden
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) upload(file);
          }}
        />
        <button type="button" className="roster-btn-sm" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          <Camera size={14} aria-hidden="true" /> {busy ? 'Đang xử lý…' : 'Thêm ảnh (chụp hoặc chọn tệp)'}
        </button>
        <span className="roster-subline">JPEG/PNG, tự thu nhỏ trước khi gửi; tối đa 10 ảnh.</span>
      </div>
    </details>
  );
}
