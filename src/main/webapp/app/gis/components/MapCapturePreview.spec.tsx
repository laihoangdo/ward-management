import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MapCapturePreview } from './MapCapturePreview';

const revoke = vi.fn();
beforeEach(() => {
  const NativeURL = URL;
  vi.stubGlobal(
    'URL',
    Object.assign(class extends NativeURL {}, { createObjectURL: vi.fn(() => 'blob:map-capture'), revokeObjectURL: revoke }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  revoke.mockClear();
});

it('previews the PNG, offers export actions and releases the image URL on close', () => {
  const onClose = vi.fn();
  const view = render(<MapCapturePreview blob={new Blob(['png'], { type: 'image/png' })} onClose={onClose} />);
  expect(screen.getByRole('img').getAttribute('src')).toBe('blob:map-capture');
  expect(screen.getByRole('button', { name: 'Sao chép ảnh' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'In ảnh' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Tải về (.PNG)' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Đóng ảnh chụp' }));
  expect(onClose).toHaveBeenCalledOnce();
  view.unmount();
  expect(revoke).toHaveBeenCalledWith('blob:map-capture');
});

it('offers copy/download fallback if native file sharing is unavailable', async () => {
  vi.stubGlobal('navigator', Object.create(navigator, { canShare: { value: undefined } }));
  render(<MapCapturePreview blob={new Blob(['png'], { type: 'image/png' })} onClose={vi.fn()} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Chia sẻ' })[0]);
  expect(await screen.findByText('Tải ảnh để gửi qua ứng dụng khác')).toBeTruthy();
});
