import { useEffect, useState } from 'react';
import axios from 'axios';
import type { InspectionPhoto } from '../types';
const endpoint = (id: string) => {
  if (!/^\d+$/.test(id)) throw Error('Ảnh phải liên kết với ID hộ từ máy chủ.');
  return `/api/gis/households/${id}/inspection-photos`;
};
export async function fetchInspectionPhotos(id: string, signal?: AbortSignal): Promise<InspectionPhoto[]> {
  const { data } = await axios.get<InspectionPhoto[]>(endpoint(id), { signal });
  if (!Array.isArray(data)) throw Error('Danh sách ảnh từ máy chủ không hợp lệ.');
  return data;
}
export async function saveInspectionPhoto(id: string, photo: InspectionPhoto): Promise<InspectionPhoto> {
  const { data } = await axios.post<InspectionPhoto>(endpoint(id), {
    url: photo.url,
    caption: photo.caption ?? '',
    category: photo.category ?? 'general',
  });
  return data;
}
export async function deleteInspectionPhoto(id: string, photoId: string): Promise<void> {
  await axios.delete(`${endpoint(id)}/${encodeURIComponent(photoId)}`);
}

/** Saved photos are served by a permission-checked endpoint; camera captures are still data URLs. */
const isInline = (url: string) => url.startsWith('data:') || url.startsWith('blob:');

/** Image bytes of a saved photo as a data URL (for OCR, which reads pixels from it). */
export async function inspectionPhotoDataUrl(url: string): Promise<string> {
  if (isInline(url)) return url;
  const { data } = await axios.get<Blob>(url, { responseType: 'blob' });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? Error('Không đọc được ảnh.'));
    reader.readAsDataURL(data);
  });
}

/** Object URL for showing a saved photo in an <img>; revoked when the photo or the component goes away. */
export function useInspectionImageUrl(url: string | undefined) {
  const [state, setState] = useState<{ src: string | null; failed: boolean }>({ src: null, failed: false });
  useEffect(() => {
    if (!url) {
      setState({ src: null, failed: false });
      return undefined;
    }
    if (isInline(url)) {
      setState({ src: url, failed: false });
      return undefined;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    setState({ src: null, failed: false });
    axios
      .get<Blob>(url, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setState({ src: objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ src: null, failed: true });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return state;
}
