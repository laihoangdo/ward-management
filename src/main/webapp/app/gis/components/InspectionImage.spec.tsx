import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { InspectionImage } from './InspectionImage';
import { inspectionPhotoDataUrl } from '../services/inspectionPhotos';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
const content = '/api/gis/households/123/inspection-photos/p1/content';
beforeEach(() => {
  vi.resetAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:photo-1');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

it('loads a saved photo through the permission-checked endpoint and frees it when unmounted', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: new Blob(['x'], { type: 'image/png' }) });
  const view = render(<InspectionImage src={content} alt="Mặt tiền" />);
  expect(screen.getByRole('img', { name: 'Mặt tiền' }).tagName).toBe('SPAN');
  await waitFor(() => expect(screen.getByRole('img', { name: 'Mặt tiền' }).getAttribute('src')).toBe('blob:photo-1'));
  expect(axios.get).toHaveBeenCalledWith(content, { responseType: 'blob' });
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
});

it('shows a camera capture directly and says when a saved photo cannot be loaded', async () => {
  render(<InspectionImage src="data:image/jpeg;base64,AAAA" alt="Ảnh vừa chụp" />);
  expect(screen.getByRole('img', { name: 'Ảnh vừa chụp' }).getAttribute('src')).toBe('data:image/jpeg;base64,AAAA');
  vi.mocked(axios.get).mockRejectedValue(new Error('403'));
  render(<InspectionImage src={content} alt="Biển hiệu" />);
  expect(await screen.findByRole('img', { name: 'Biển hiệu (không tải được ảnh)' })).toBeDefined();
  expect(axios.get).toHaveBeenCalledTimes(1);
});

it('turns a saved photo into a data URL for OCR', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: new Blob(['abc'], { type: 'image/png' }) });
  expect(await inspectionPhotoDataUrl(content)).toBe('data:image/png;base64,YWJj');
  expect(await inspectionPhotoDataUrl('data:image/png;base64,QQ==')).toBe('data:image/png;base64,QQ==');
});
