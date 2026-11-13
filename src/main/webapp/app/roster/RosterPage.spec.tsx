import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import axios from 'axios';
import RosterPage from './RosterPage';

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), isCancel: () => false, isAxiosError: () => false } }));
vi.mock('maplibre-gl', () => ({ default: {}, setWorkerUrl: vi.fn() }));
function RouteProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="route">{location.search}</output>
      <button onClick={() => navigate(-1)}>Browser Back</button>
      <button onClick={() => navigate(1)}>Browser Forward</button>
    </>
  );
}
describe('Real roster workflows', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockImplementation(async url => {
      await Promise.resolve();
      if (String(url).endsWith('/overview'))
        return { data: { hamlet_name: 'Trung Chánh 2', households: 1, residents: 1, records: 1, review_rows: 62 } };
      if (String(url).includes('/households/h1'))
        return {
          data: { id: 'h1', code: 'TC2-TEST', raw_address: 'Địa chỉ thử nghiệm', members: [], sources: [], version: 0, origin: 'MANUAL' },
        };
      if (String(url).endsWith('/households') || String(url).endsWith('/residents')) return { data: { items: [], total: 0 } };
      return { data: [] };
    });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
  it('shows the list export button only to users who may export reports, carrying the current filters', async () => {
    const view = render(
      <MemoryRouter>
        <RosterPage initialTab="residents" currentUser={{ role: 'officer', subAdminPermissions: {} as never }} />
      </MemoryRouter>,
    );
    await screen.findByLabelText('Tìm họ tên hoặc ĐDCN / CCCD / CMND');
    expect(screen.queryByRole('button', { name: /Xuất \/ In danh sách/ })).toBeNull();
    view.rerender(
      <MemoryRouter>
        <RosterPage initialTab="residents" currentUser={{ role: 'sub-admin', subAdminPermissions: { canExportReports: true } as never }} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Loại hồ sơ'), { target: { value: 'TEMPORARY' } });
    fireEvent.click(await screen.findByRole('button', { name: /Xuất \/ In danh sách/ }));
    expect(await screen.findByRole('dialog', { name: 'Xuất / in danh sách nhân khẩu' })).toBeTruthy();
    expect((screen.getByLabelText('Tạm trú') as HTMLInputElement).checked).toBe(true);
  });
  const open = () =>
    render(
      <MemoryRouter>
        <RosterPage />
      </MemoryRouter>,
    );
  it('opens the audited create-household form from a ?newHousehold=true link and clears the flag', async () => {
    render(
      <MemoryRouter initialEntries={['/roster?tab=households&newHousehold=true']}>
        <RouteProbe />
        <RosterPage />
      </MemoryRouter>,
    );
    await screen.findByRole('dialog', { name: 'Tạo hộ mới' });
    await waitFor(() => expect(screen.getByTestId('route').textContent).not.toContain('newHousehold'));
  });
  it('keeps household detail and edit mode on the URL across Back and Forward', async () => {
    render(
      <MemoryRouter initialEntries={['/roster?tab=households', '/roster?tab=households&household=h1']}>
        <RouteProbe />
        <RosterPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Địa chỉ thử nghiệm' });
    fireEvent.click(screen.getByRole('button', { name: 'Sửa hộ' }));
    await screen.findByRole('dialog', { name: 'Sửa thông tin hộ' });
    expect(screen.getByTestId('route').textContent).toContain('edit=true');
    fireEvent.click(screen.getByText('Browser Back'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await screen.findByRole('heading', { name: 'Địa chỉ thử nghiệm' });
    fireEvent.click(screen.getByText('Browser Back'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Địa chỉ thử nghiệm' })).toBeNull());
    fireEvent.click(screen.getByText('Browser Forward'));
    await screen.findByRole('heading', { name: 'Địa chỉ thử nghiệm' });
    fireEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết' }));
    await waitFor(() => expect(screen.getByTestId('route').textContent).not.toContain('household='));
  });
  it('loads a resident directly from the URL without relying on the current list page', async () => {
    const original = vi.mocked(axios.get).getMockImplementation()!;
    vi.mocked(axios.get).mockImplementation(async (url, config) => {
      if (String(url).endsWith('/residents/r1'))
        return { data: { id: 'r1', full_name: 'Người kiểm thử tổng hợp', identities: [], records: [], sources: [], verifications: [] } };
      return original(url, config);
    });
    render(
      <MemoryRouter initialEntries={['/roster?tab=residents&resident=r1&page=3']}>
        <RosterPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Người kiểm thử tổng hợp' });
    expect(axios.get).toHaveBeenCalledWith('/api/roster/residents/r1', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(axios.get).toHaveBeenCalledWith(
      '/api/roster/residents',
      expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }),
    );
  });
  it('shows masked identity numbers and reveals only through the audited endpoint', async () => {
    const original = vi.mocked(axios.get).getMockImplementation()!;
    vi.mocked(axios.get).mockImplementation(async (url, config) => {
      if (String(url).endsWith('/residents/r1'))
        return {
          data: {
            id: 'r1',
            full_name: 'Người kiểm thử tổng hợp',
            identities: [{ id: 'i1', document_type: 'CCCD', number: '001••••••002', verified: true, active: true }],
            records: [],
            sources: [],
            verifications: [],
          },
        };
      return original(url, config);
    });
    vi.mocked(axios.post).mockResolvedValue({ data: { number: '001079000002' } });
    render(
      <MemoryRouter initialEntries={['/roster?tab=residents&resident=r1']}>
        <RosterPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Người kiểm thử tổng hợp' });
    expect(screen.getByText(/001••••••002/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xem số đầy đủ (ghi nhật ký)' }));
    await screen.findByText(/001079000002/);
    expect(axios.post).toHaveBeenCalledWith('/api/roster/residents/r1/identities/i1/reveal', {});
  });
  it('restores an embedded roster subpage and makes its tab changes navigable', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard?tab=households&rosterTab=history']}>
        <RouteProbe />
        <RosterPage embedded />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Lịch sử & báo cáo' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Nhập Excel / đối soát' }));
    await waitFor(() => expect(screen.getByTestId('route').textContent).toContain('rosterTab=import'));
    expect(screen.getByTestId('route').textContent).toContain('tab=households');
    fireEvent.click(screen.getByText('Browser Back'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lịch sử & báo cáo' }).getAttribute('aria-pressed')).toBe('true'));
  });
  it.each([false, true])('resolves a GIS ID to its canonical household in the embedded menu (edit=%s)', async edit => {
    const original = vi.mocked(axios.get).getMockImplementation()!;
    vi.mocked(axios.get).mockImplementation(async (url, config) =>
      String(url).endsWith('/legacy-households/123')
        ? {
            data: {
              id: 'canonical-synthetic',
              code: 'TC2-SYNTHETIC',
              raw_address: 'Địa chỉ tổng hợp',
              members: [],
              sources: [],
              version: 2,
            },
          }
        : original(url, config),
    );
    render(
      <MemoryRouter>
        <RosterPage embedded householdTarget={{ legacyId: '123', edit }} />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Địa chỉ tổng hợp' });
    expect(screen.getByText('Mã hộ TC2-SYNTHETIC')).toBeDefined();
    expect(axios.get).toHaveBeenCalledWith(
      '/api/roster/legacy-households/123',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(axios.get).not.toHaveBeenCalledWith('/api/roster/households/123');
    if (edit) await screen.findByRole('heading', { name: 'Sửa thông tin hộ' });
    else expect(screen.queryByRole('heading', { name: 'Sửa thông tin hộ' })).toBeNull();
  });
  it('reports an unlinked household without opening another household', async () => {
    const original = vi.mocked(axios.get).getMockImplementation()!;
    vi.mocked(axios.get).mockImplementation(async (url, config) => {
      if (String(url).includes('/legacy-households/')) throw new Error('Không tìm thấy hồ sơ liên kết');
      return original(url, config);
    });
    render(
      <MemoryRouter>
        <RosterPage embedded householdTarget={{ legacyId: '123', edit: true }} />
      </MemoryRouter>,
    );
    await screen.findByRole('alert');
    expect(screen.queryByRole('heading', { name: 'Sửa thông tin hộ' })).toBeNull();
  });
  it('ignores an older household response after the target changes', async () => {
    let resolveOld!: (value: any) => void;
    const original = vi.mocked(axios.get).getMockImplementation()!;
    vi.mocked(axios.get).mockImplementation(async (url, config) => {
      if (String(url).endsWith('/legacy-households/123'))
        return new Promise(resolve => {
          resolveOld = resolve;
        });
      if (String(url).endsWith('/legacy-households/124')) return { data: { id: 'new', code: 'TC2-NEW', members: [], sources: [] } };
      return original(url, config);
    });
    const view = render(
      <MemoryRouter>
        <RosterPage embedded householdTarget={{ legacyId: '123', edit: true }} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(resolveOld).toBeDefined());
    view.rerender(
      <MemoryRouter>
        <RosterPage embedded householdTarget={{ legacyId: '124', edit: false }} />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: /TC2-NEW/ });
    await act(async () => {
      resolveOld({ data: { id: 'old', code: 'TC2-OLD', members: [], sources: [] } });
    });
    expect(screen.queryByRole('heading', { name: /TC2-OLD|Sửa thông tin hộ/ })).toBeNull();
    expect(screen.getByRole('heading', { name: /TC2-NEW/ })).toBeDefined();
  });
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
  it('asks establishment details only for an establishment, requires its name and sends the facility fields', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { id: 'h1' } });
    open();
    await screen.findByText(/62 dòng chờ đối soát/);
    fireEvent.click(screen.getByRole('button', { name: '+ Thêm hộ' }));
    expect(screen.queryByLabelText('Tên cơ sở (biển hiệu) *')).toBeNull();
    fireEvent.change(screen.getByLabelText('Loại hình cơ sở'), { target: { value: 'BUSINESS' } });
    fireEvent.change(screen.getByLabelText('Địa chỉ nguyên bản *'), { target: { value: '12 Trưng Vương 3' } });
    fireEvent.change(screen.getByLabelText('Lý do / nguồn kiểm chứng *'), { target: { value: 'Khảo sát thực địa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại →' }));
    expect((await screen.findByText(/thông tin bắt buộc chưa nhập/)).closest('[role="alert"]')?.textContent).toContain('Tên cơ sở');
    fireEvent.change(screen.getByLabelText('Tên cơ sở (biển hiệu) *'), { target: { value: 'Quán cà phê A' } });
    fireEvent.change(screen.getByLabelText('Ngành nghề kinh doanh / hoạt động'), { target: { value: 'Ăn uống' } });
    expect(screen.queryByLabelText('Số giấy phép')).toBeNull();
    fireEvent.change(screen.getByLabelText('Loại giấy phép'), { target: { value: 'SECURITY_CONDITION' } });
    fireEvent.change(screen.getByLabelText('Số giấy phép'), { target: { value: '15/GCN' } });
    fireEvent.change(screen.getByLabelText('Ngày hết hạn giấy phép'), { target: { value: '2027-06-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại →' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledOnce());
    expect(vi.mocked(axios.post).mock.calls[0][1]).toMatchObject({
      facilityType: 'BUSINESS',
      businessName: 'Quán cà phê A',
      businessCategory: 'Ăn uống',
      licenseType: 'SECURITY_CONDITION',
      licenseNumber: '15/GCN',
      licenseExpiry: '2027-06-30',
    });
  });
  it('summarises empty required fields in Vietnamese and marks each one until it is filled', async () => {
    open();
    await screen.findByText(/62 dòng chờ đối soát/);
    fireEvent.click(screen.getByRole('button', { name: '+ Thêm hộ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại →' }));
    const summary = await screen.findByText(/thông tin bắt buộc chưa nhập/);
    const box = summary.closest('[role="alert"]') as HTMLElement;
    expect(box.textContent).toContain('Địa chỉ nguyên bản');
    expect(box.textContent).toContain('Lý do / nguồn kiểm chứng');
    const address = screen.getByLabelText('Địa chỉ nguyên bản *');
    expect(address.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(address.getAttribute('aria-describedby') as string)?.textContent).toMatch(/Vui lòng nhập/);
    expect(screen.queryByText('Kiểm tra trước khi lưu')).toBeNull();
    fireEvent.change(address, { target: { value: 'Địa chỉ thử nghiệm' } });
    expect(address.getAttribute('aria-invalid')).toBeNull();
    expect(box.textContent).not.toContain('Địa chỉ nguyên bản');
    expect(axios.post).not.toHaveBeenCalled();
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
      if (String(url).endsWith('/overview')) return { data: { hamlet_name: 'Trung Chánh 2' } };
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
  it('sends the chosen campaign to the server and reports people that cannot be age-checked', async () => {
    vi.mocked(axios.get).mockImplementation(async (url, config) => {
      if (String(url).endsWith('/overview')) return { data: { hamlet_name: 'Trung Chánh 2' } };
      if (String(url).endsWith('/residents')) {
        return config?.params?.campaign === 'MILITARY'
          ? { data: { items: [], total: 0, page: 0, unevaluable: 7 } }
          : { data: { items: [{ id: 'r1', full_name: 'Cá nhân thử nghiệm', origin: 'EXCEL' }], total: 1 } };
      }
      return { data: [] };
    });
    render(
      <MemoryRouter>
        <RosterPage initialTab="residents" />
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: 'Cá nhân thử nghiệm' });
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.change(screen.getByLabelText('Chiến dịch'), { target: { value: 'MILITARY' } });
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith(
        '/api/roster/residents',
        expect.objectContaining({ params: expect.objectContaining({ campaign: 'MILITARY' }) }),
      ),
    );
    expect((await screen.findByRole('note')).textContent).toContain('7 cá nhân chưa có ngày sinh đầy đủ');
  });
  it('replaces the old random-point tab with a split map beside the household list', async () => {
    open();
    await screen.findByText(/62 dòng chờ đối soát/);
    expect(screen.queryByRole('button', { name: 'Vị trí tạm' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Bản đồ vị trí hộ' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hiện bản đồ vị trí' }));
    expect(await screen.findByRole('region', { name: 'Bản đồ vị trí hộ' })).toBeDefined();
    expect(vi.mocked(axios.get)).toHaveBeenCalledWith('/api/roster/map');
    expect(screen.getByRole('region', { name: 'Danh sách hộ dân' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Chế độ xem' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn bản đồ' }));
    expect(screen.queryByRole('region', { name: 'Bản đồ vị trí hộ' })).toBeNull();
  });
});
