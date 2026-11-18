import React from 'react';
import AttachmentGallery from './AttachmentGallery';

export { shrinkImage } from './AttachmentGallery';
export type { AttachmentItem as ResidentPhoto } from './AttachmentGallery';

/** "Hình ảnh" section of the resident detail: portrait gallery with upload, choose main photo and delete. */
export default function ResidentPhotos({ residentId, api }: { residentId: string; api: string }) {
  return <AttachmentGallery base={`${api}/residents/${residentId}/photos`} />;
}
