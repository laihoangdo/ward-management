import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import axios from 'axios';
import ResidentPhotos from './ResidentPhotos';

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), isAxiosError: () => false },
}));

const photo = {
  id: 'p1',
  caption: 'Ảnh chân dung',
  primary: true,
  createdAt: '2026-11-15T03:00:00Z',
  createdBy: 'Cán bộ thử',
  size: 10,
  mime: 'image/jpeg',
};

describe('Resident photos', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(cleanup);

  it('lists photos and shows each one from the authenticated content endpoint', async () => {
    vi.mocked(axios.get).mockImplementation(url => Promise.resolve({ data: String(url).endsWith('/content') ? new Blob(['x']) : [photo] }));
    render(<ResidentPhotos residentId="r1" api="/api/roster" />);
    const img = await screen.findByAltText('Ảnh chân dung');
    expect(img.getAttribute('src')).toBe('blob:photo');
    expect(screen.getByText('Ảnh chính')).toBeTruthy();
    expect(axios.get).toHaveBeenCalledWith('/api/roster/residents/r1/photos/p1/content', { responseType: 'blob' });
  });

  it('rejects files that are not JPEG or PNG without calling the server', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    const { container } = render(<ResidentPhotos residentId="r1" api="/api/roster" />);
    await waitFor(() => expect(screen.getByText('Chưa có ảnh nhân khẩu.')).toBeTruthy());
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' })] } });
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Chỉ nhận ảnh JPEG hoặc PNG');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('uploads a chosen image with its caption as multipart form data', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    vi.mocked(axios.post).mockResolvedValue({ data: photo });
    const { container } = render(<ResidentPhotos residentId="r1" api="/api/roster" />);
    await waitFor(() => expect(screen.getByText('Chưa có ảnh nhân khẩu.')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Chú thích ảnh (không bắt buộc)'), { target: { value: 'Mặt trước' } });
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['jpg'], 'a.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    const [url, form] = vi.mocked(axios.post).mock.calls[0];
    expect(url).toBe('/api/roster/residents/r1/photos');
    expect((form as FormData).get('caption')).toBe('Mặt trước');
    expect((form as FormData).get('file')).toBeTruthy();
  });
});
