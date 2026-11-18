import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../utils/useDialogFocus';
import './MapLibreAreaMap.css';
import './MapCapturePreview.css';

export function MapCapturePreview({ blob, onClose }: { blob: Blob; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [feedback, setFeedback] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const ref = useDialogFocus(true, onClose);
  useEffect(() => {
    const value = URL.createObjectURL(blob);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [blob]);
  const download = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `ban-do-3d-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.click();

    setFeedback('Đã tải ảnh PNG.');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);

      setFeedback('Đã sao chép ảnh vào bộ nhớ tạm.');
    } catch {
      setFeedback('Trình duyệt không hỗ trợ sao chép ảnh. Hãy tải PNG để chia sẻ.');
    }
  };
  const share = async () => {
    try {
      const file = new File([blob], 'ban-do-3d.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Ảnh trích xuất bản đồ địa bàn', files: [file] });

        setFeedback('Đã chia sẻ ảnh.');
        return;
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
    }
    setShareOpen(true);
    setFeedback('Sao chép hoặc tải ảnh để gửi qua ứng dụng khác.');
  };
  const print = () => {
    const target = window.open('', '_blank');
    if (!target) {
      setFeedback('Trình duyệt đã chặn cửa sổ in.');
      return;
    }
    target.opener = null;
    target.document.title = 'Ảnh trích xuất bản đồ 3D';
    const image = target.document.createElement('img');
    image.style.maxWidth = '100%';
    image.onload = () => {
      target.focus();
      target.print();
    };
    image.src = url;
    target.document.body.appendChild(image);
  };
  return createPortal(
    <div
      className="tc2-capture-backdrop field-capture-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="tc2-capture-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Ảnh chụp trích xuất bản đồ an ninh địa bàn"
      >
        <header className="tc2-capture-header">
          <div>
            <h3>Ảnh chụp trích xuất bản đồ an ninh địa bàn</h3>
            <p>Khung thông tin cán bộ khu vực, quân hàm, họ tên và thời điểm trích xuất</p>
          </div>
          <button type="button" className="tc2-capture-share" onClick={() => void share()}>
            Chia sẻ
          </button>
          <button type="button" className="tc2-capture-close" aria-label="Đóng ảnh chụp" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="tc2-capture-preview">{url && <img src={url} alt="Ảnh bản đồ 3D kèm thông tin cán bộ khu vực" />}</div>
        {shareOpen && (
          <div className="tc2-capture-share-menu">
            <button type="button" onClick={() => void copy()}>
              Sao chép ảnh để chia sẻ
            </button>
            <button type="button" onClick={download}>
              Tải ảnh để gửi qua ứng dụng khác
            </button>
          </div>
        )}
        <footer className="tc2-capture-footer">
          <span role="status">{feedback || 'Định dạng PNG · Có thông tin cán bộ và trích xuất'}</span>
          <div>
            <button type="button" className="tc2-capture-share" onClick={() => void share()}>
              Chia sẻ
            </button>
            <button type="button" onClick={() => void copy()}>
              Sao chép ảnh
            </button>
            <button type="button" onClick={print}>
              In ảnh
            </button>
            <button type="button" className="tc2-capture-download" onClick={download}>
              Tải về (.PNG)
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.fullscreenElement || document.body,
  );
}
