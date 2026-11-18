import React from 'react';
import { ImageOff } from 'lucide-react';
import { useInspectionImageUrl } from '../services/inspectionPhotos';

/** A household inspection photo, loaded through the permission-checked photo endpoint. */
export function InspectionImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const image = useInspectionImageUrl(src);
  if (image.src) return <img src={image.src} alt={alt} className={className} />;
  return (
    <span role="img" aria-label={image.failed ? `${alt} (không tải được ảnh)` : alt} className={`gis-photo-placeholder ${className ?? ''}`}>
      {image.failed ? <ImageOff aria-hidden="true" className="w-5 h-5" /> : null}
    </span>
  );
}
