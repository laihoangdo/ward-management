import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import axios from 'axios';
import RosterPage from './RosterPage';

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), isCancel: () => false, isAxiosError: () => false } }));
vi.mock('maplibre-gl', () => ({ default: {} }));
describe('Real roster workflows', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockImplementation(async url => {
      await Promise.resolve();
      if (String(url).endsWith('/overview')) return { data: { households: 1, residents: 1, records: 1, review_rows: 62 } };
      if (String(url).includes('/households/h1'))
        return {
          data: { id: 'h1', code: 'TC2-TEST', raw_address: 'Địa chỉ thử nghiệm', members: [], sources: [], version: 0, origin: 'MANUAL' },
        };
      if (String(url).endsWith('/households')) return { data: { items: [], total: 0 } };
      return { data: [] };
    });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
  const open = () =>
    render(
      <MemoryRouter>
        <RosterPage />
      </MemoryRouter>,
    );
  it('requires a review step and sends a stable request ID when creating a household', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { id: 'h1' } });
    open();
    await screen.findByText(/62 dòng chờ đối soát/);
    fireEvent.click(screen.getByRole('button', { name: '+ Thêm hộ' }));
    fireEvent.change(screen.getByLabelText('Địa chỉ nguyên bản *'), { target: { value: 'Địa chỉ thử nghiệm' } });
    fireEvent.change(screen.getByLabelText('Lý do / nguồn kiểm chứng *'), { target: { value: 'Nhập trực tiếp' } });
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại →' }));
    expect(screen.getByText('Kiểm tra trước khi lưu')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledOnce());
    expect(vi.mocked(axios.post).mock.calls[0][1]).toMatchObject({ rawAddress: 'Địa chỉ thử nghiệm', requestId: expect.any(String) });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('keeps form data and the same request ID after a failed save', async () => {
    vi.mocked(axios.post)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: { id: 'h1' } });
    open();
    await screen.findByText(/62 dòng chờ đối soát/);
    fireEvent.click(screen.getByRole('button', { name: '+ Thêm hộ' }));
    fireEvent.change(screen.getByLabelText('Địa chỉ nguyên bản *'), { target: { value: 'Địa chỉ thử nghiệm' } });
    fireEvent.change(screen.getByLabelText('Lý do / nguồn kiểm chứng *'), { target: { value: 'Nhập trực tiếp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(axios.post).mock.calls[0][1].requestId).toEqual(vi.mocked(axios.post).mock.calls[1][1].requestId);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('stages Excel without applying it automatically', async () => {
    open();
    await screen.findByText(/62 dòng chờ đối soát/);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Nhập Excel / đối soát' }));
      await Promise.resolve();
    });
    expect((screen.getByRole('button', { name: 'Kiểm tra & lưu nguồn' }) as HTMLButtonElement).disabled).toBe(true);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('does not render resident rows as households when the dashboard changes menus', async () => {
    let resolveHouseholds!: (value: any) => void;
    let resolveLateResidents!: (value: any) => void;
    const householdResponse = new Promise(resolve => {
      resolveHouseholds = resolve;
    });
    const lateResidentResponse = new Promise(resolve => {
      resolveLateResidents = resolve;
    });
    vi.mocked(axios.get).mockImplementation(async (url, config) => {
      if (String(url).endsWith('/overview')) return { data: {} };
      if (String(url).endsWith('/households')) return householdResponse as any;
      if (String(url).endsWith('/residents')) {
        if (config?.params?.search) return lateResidentResponse as any;
        return { data: { items: [{ id: 'r1', full_name: 'Cá nhân thử nghiệm', origin: 'EXCEL' }], total: 1 } };
      }
      return { data: [] };
    });
    const view = render(
      <MemoryRouter>
        <RosterPage initialTab="residents" />
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: 'Cá nhân thử nghiệm' });
    fireEvent.change(screen.getByLabelText('Tìm họ tên hoặc ĐDCN / CCCD / CMND'), { target: { value: 'late' } });
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith(
        '/api/roster/residents',
        expect.objectContaining({ params: expect.objectContaining({ search: 'late' }) }),
      ),
    );
    view.rerender(
      <MemoryRouter>
        <RosterPage initialTab="households" />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Danh sách hộ dân · Trung Chánh 2' });
    expect(screen.queryByRole('button', { name: 'Cá nhân thử nghiệm' })).toBeNull();
    await act(async () => {
      resolveHouseholds({ data: { items: [{ id: 'h2', code: 'TC2-12345678', origin: 'EXCEL' }], total: 1 } });
    });
    await screen.findByRole('button', { name: 'Nhóm 12345678' });
    await act(async () => {
      resolveLateResidents({ data: { items: [{ id: 'r2', full_name: 'Phản hồi cũ', origin: 'EXCEL' }], total: 1 } });
    });
    expect(screen.getByRole('button', { name: 'Nhóm 12345678' })).toBeDefined();
    expect(screen.queryByText('Phản hồi cũ')).toBeNull();
    view.rerender(
      <MemoryRouter>
        <RosterPage initialTab="residents" />
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: 'Cá nhân thử nghiệm' });
    expect(screen.queryByRole('button', { name: 'Nhóm 12345678' })).toBeNull();
  });

  it('keeps the household list usable when a household code is missing', async () => {
    vi.mocked(axios.get).mockImplementation(async url => ({
      data: String(url).endsWith('/households')
        ? { items: [{ id: 'h2', origin: 'EXCEL', raw_address: 'Địa chỉ thử nghiệm' }], total: 1 }
        : {},
    }));
    open();
    await screen.findByRole('button', { name: 'Chưa có mã hộ' });
    expect(screen.getByText('Địa chỉ thử nghiệm')).toBeDefined();
  });
});
