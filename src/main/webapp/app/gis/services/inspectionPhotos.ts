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
