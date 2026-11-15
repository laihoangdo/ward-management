import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ResidentTags from './ResidentTags';

vi.mock('axios', () => ({ default: { get: vi.fn(), put: vi.fn(), isAxiosError: () => false } }));

describe('Resident social standing', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockResolvedValue({ data: ['DANG_VIEN'] });
    vi.mocked(axios.put).mockReset();
  });
  afterEach(cleanup);

  it('shows the tags and hides editing without the resident edit permission', async () => {
    render(<ResidentTags residentId="r1" api="/api/roster" currentUser={{ role: 'subadmin', subAdminPermissions: {} } as never} />);
    expect(await screen.findByText('Đảng viên')).toBeTruthy();
    expect(axios.get).toHaveBeenCalledWith('/api/roster/residents/r1/tags');
    expect(screen.queryByText('Sửa diện xã hội')).toBeNull();
  });

  it('saves the chosen tags', async () => {
    vi.mocked(axios.put).mockResolvedValue({ data: ['DANG_VIEN', 'CCB'] });
    render(<ResidentTags residentId="r1" api="/api/roster" currentUser={{ role: 'superadmin' } as never} />);
    await screen.findByText('Đảng viên');
    fireEvent.click(screen.getByText('Sửa diện xã hội'));
    fireEvent.click(screen.getByLabelText('Cựu chiến binh'));
    fireEvent.click(screen.getByText('Lưu diện'));
    await waitFor(() => expect(screen.getByText('Đảng viên · Cựu chiến binh')).toBeTruthy());
    expect(axios.put).toHaveBeenCalledWith('/api/roster/residents/r1/tags', { tags: ['DANG_VIEN', 'CCB'] });
  });
});
