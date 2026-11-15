import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import axios from 'axios';
import FacilitiesTab from './FacilitiesTab';
import FacilityDetail from './FacilityDetail';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    isAxiosError: () => false,
    interceptors: { request: { use: vi.fn() } },
  },
}));

const summary = {
  conditional: 2,
  other: 5,
  license_due: 1,
  byType: { BUSINESS: 4, BOARDING_HOUSE: 2, ENTERPRISE: 1, RELIGIOUS: 0 },
  licenseWarningDays: 30,
  canManage: true,
  canEditHousehold: true,
};
const facility = {
  id: 'h1',
  business_name: 'Nhà trọ Bình An',
  type: 'BOARDING_HOUSE',
  business_category: 'Cho thuê phòng',
  raw_address: '12 Đường số 3',
  representative_name: 'Trần Văn Chủ',
  license_type: 'SECURITY_CONDITION',
  license_number: '123/ANTT',
  license_expiry_on: '2026-12-01',
  is_conditional: true,
  license_due: true,
  license_expired: false,
  employee_count: 1,
  violation_count: 1,
  owner: null,
  employees: [{ id: 'e1', full_name: 'Lê Văn Ngoài', position: 'Bảo vệ', identity_masked: '079••••••123', started_on: '2026-01-02' }],
  violations: [{ id: 'v1', content: 'Không trình báo lưu trú', penalty: 'Phạt 2.000.000đ', occurred_on: '2026-10-01' }],
  documents: [{ id: 1, doc_name: 'GCN ANTT', document_number: '45/GCN', expiry_on: '2027-05-01' }],
};

const renderTab = () =>
  render(
    <MemoryRouter>
      <FacilitiesTab />
    </MemoryRouter>,
  );

describe('Facilities tab', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.get).mockImplementation(url => {
      const u = String(url);
      if (u.endsWith('/summary')) return Promise.resolve({ data: summary });
      if (u.endsWith('/attachments')) return Promise.resolve({ data: [] });
      if (u === '/api/facilities/h1') return Promise.resolve({ data: facility });
      return Promise.resolve({ data: { items: [facility], total: 1, page: 0, pageSize: 30 } });
    });
  });
  afterEach(cleanup);

  it('starts on conditional businesses and shows licence warnings', async () => {
    renderTab();
    expect(await screen.findByText('Nhà trọ Bình An')).toBeTruthy();
    expect(axios.get).toHaveBeenCalledWith('/api/facilities', { params: expect.objectContaining({ group: 'CONDITIONAL' }) });
    const row = screen.getByText('Nhà trọ Bình An').closest('tr') as HTMLElement;
    expect(within(row).getByText('Giấy phép sắp hết hạn')).toBeTruthy();
    expect(within(row).getByText('123/ANTT')).toBeTruthy();
    const groups = screen.getByRole('group', { name: 'Nhóm cơ sở' });
    expect(within(groups).getByText('Cơ sở, DN địa bàn')).toBeTruthy();
  });

  it('switches to other establishments and the licence due filter', async () => {
    renderTab();
    await screen.findByText('Nhà trọ Bình An');
    fireEvent.click(within(screen.getByRole('group', { name: 'Nhóm cơ sở' })).getByText('Cơ sở, DN địa bàn'));
    fireEvent.click(screen.getByText('Giấy phép hết / sắp hết hạn'));
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith('/api/facilities', { params: expect.objectContaining({ group: 'OTHER', due: 'LICENSE' }) }),
    );
  });

  it('opens the detail with employees, violations, registered papers and attachments', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Nhà trọ Bình An' }));
    expect(await screen.findByRole('region', { name: 'Hồ sơ cơ sở Nhà trọ Bình An' })).toBeTruthy();
    expect(screen.getByText('Lê Văn Ngoài')).toBeTruthy();
    expect(screen.getByText('Không trình báo lưu trú')).toBeTruthy();
    expect(screen.getByText('GCN ANTT')).toBeTruthy();
    expect(axios.get).toHaveBeenCalledWith('/api/facilities/h1/attachments');
  });
});

describe('Facility detail', () => {
  beforeEach(() => vi.mocked(axios.get).mockResolvedValue({ data: [] }));
  afterEach(cleanup);

  it('hides write actions without the manage permission', () => {
    render(<FacilityDetail facility={facility} canManage={false} canEditHousehold={false} onChanged={vi.fn()} onEditHousehold={vi.fn()} />);
    expect(screen.queryByText('+ Nhân viên')).toBeNull();
    expect(screen.queryByText('Ghi nghỉ việc')).toBeNull();
    expect(screen.queryByText('Sửa tên, ngành nghề, giấy phép')).toBeNull();
  });

  it('adds an employee from outside the hamlet', async () => {
    const onChanged = vi.fn();
    vi.mocked(axios.post).mockResolvedValue({ data: facility });
    render(<FacilityDetail facility={facility} canManage canEditHousehold onChanged={onChanged} onEditHousehold={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Nhân viên'));
    fireEvent.click(screen.getByRole('button', { name: 'Người ngoài địa bàn' }));
    fireEvent.change(screen.getByLabelText('Họ và tên *'), { target: { value: 'Phạm Thị Mới' } });
    fireEvent.change(screen.getByLabelText('Số ĐDCN / CCCD (giữ số 0 đầu)'), { target: { value: '079300000555' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(vi.mocked(axios.post).mock.calls[0][0]).toBe('/api/facilities/h1/employees');
    expect(vi.mocked(axios.post).mock.calls[0][1]).toMatchObject({ fullName: 'Phạm Thị Mới', identity: '079300000555' });
  });

  it('sends the household editor request for name, trade and licence changes', () => {
    const onEditHousehold = vi.fn();
    render(<FacilityDetail facility={facility} canManage canEditHousehold onChanged={vi.fn()} onEditHousehold={onEditHousehold} />);
    fireEvent.click(screen.getByText('Sửa tên, ngành nghề, giấy phép'));
    expect(onEditHousehold).toHaveBeenCalledWith('h1');
  });
});
