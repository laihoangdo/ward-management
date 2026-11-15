import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import SubjectsTab from './SubjectsTab';
import SubjectDetail from './SubjectDetail';
import ResidentSubjects from './ResidentSubjects';
import type { AppUser } from '../gis/types';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    isAxiosError: () => false,
    interceptors: { request: { use: vi.fn() } },
  },
}));

const summary = {
  byCategory: { AN: 0, HS: 2, MT: 1, TNXH: 0, NV: 0 },
  active: 3,
  managementDue: 1,
  summonDue: 2,
  managementWarningDays: 30,
  summonWarningDays: 7,
  canManage: true,
  canViewPolitical: false,
};
const subject = {
  id: 's1',
  resident_id: 'r1',
  full_name: 'Nguyễn Văn Mẫu',
  birth_year: 1985,
  gender: 'MALE',
  identity_masked: '079••••••001',
  category: 'HS',
  subgroup: 'Tù tha về',
  managed_from: '2026-01-10',
  managed_until: '2026-12-01',
  summon_interval_months: 1,
  next_summon_due: '2026-11-10',
  status: 'ACTIVE',
  version: 0,
  management_due: true,
  management_expired: false,
  summon_due: false,
  summon_overdue: true,
  records: [],
  summons: [],
};
const user = (permissions: Partial<AppUser['subAdminPermissions']>) =>
  ({ id: 'u1', role: 'sub-admin', subAdminPermissions: permissions }) as unknown as AppUser;

describe('Subjects tab', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.get).mockImplementation(url => {
      const u = String(url);
      if (u.endsWith('/summary')) return Promise.resolve({ data: summary });
      if (u.endsWith('/photos')) return Promise.resolve({ data: [] });
      if (u === '/api/subjects/s1') return Promise.resolve({ data: subject });
      return Promise.resolve({ data: { items: [subject], total: 1, page: 0, pageSize: 30 } });
    });
  });
  afterEach(cleanup);

  it('lists subjects with due warnings and hides the political category without its permission', async () => {
    render(<SubjectsTab currentUser={user({ canViewSubjects: true, canManageSubjects: true })} />);
    expect(await screen.findByText('Nguyễn Văn Mẫu')).toBeTruthy();
    const row = screen.getByText('Nguyễn Văn Mẫu').closest('tr') as HTMLElement;
    expect(within(row).getByText('Sắp hết hạn quản lý')).toBeTruthy();
    expect(within(row).getByText('Quá hạn gọi hỏi')).toBeTruthy();
    expect(within(row).getByText('079••••••001')).toBeTruthy();
    const filters = screen.getByRole('group', { name: 'Lọc theo hệ đối tượng' });
    expect(within(filters).queryByText('Chính trị')).toBeNull();
    expect(within(filters).getByText('Hình sự')).toBeTruthy();
    expect(screen.getByText(/Hệ chính trị được ẩn/)).toBeTruthy();
  });

  it('filters by category and by due interviews through the API', async () => {
    render(<SubjectsTab currentUser={user({ canViewSubjects: true })} />);
    await screen.findByText('Nguyễn Văn Mẫu');
    fireEvent.click(within(screen.getByRole('group', { name: 'Lọc theo hệ đối tượng' })).getByText('Ma túy'));
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/subjects', { params: expect.objectContaining({ category: 'MT' }) }));
    fireEvent.click(screen.getByText('Đến hạn gọi hỏi, răn đe'));
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith('/api/subjects', { params: expect.objectContaining({ category: 'MT', due: 'SUMMON' }) }),
    );
  });

  it('opens the detail with resident facts and photos', async () => {
    render(<SubjectsTab currentUser={user({ canViewSubjects: true, canManageSubjects: true })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nguyễn Văn Mẫu' }));
    expect(await screen.findByRole('region', { name: 'Hồ sơ đối tượng Nguyễn Văn Mẫu' })).toBeTruthy();
    expect(screen.getByText('Gọi hỏi, răn đe (0)')).toBeTruthy();
    expect(axios.get).toHaveBeenCalledWith('/api/roster/residents/r1/photos');
  });
});

describe('Subject detail', () => {
  afterEach(cleanup);
  beforeEach(() => vi.mocked(axios.get).mockResolvedValue({ data: [] }));

  it('offers only violations for the security category', () => {
    render(<SubjectDetail subject={{ ...subject, category: 'AN' }} canManage political={false} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Vi phạm'));
    const kind = screen.getByLabelText('Loại') as HTMLSelectElement;
    expect(Array.from(kind.options).map(o => o.value)).toEqual(['VI_PHAM']);
  });

  it('records an interview and passes the updated subject back', async () => {
    const onChanged = vi.fn();
    vi.mocked(axios.post).mockResolvedValue({ data: { ...subject, summon_overdue: false } });
    render(<SubjectDetail subject={subject} canManage political={false} onChanged={onChanged} />);
    fireEvent.click(screen.getByText('+ Ghi gọi hỏi, răn đe'));
    fireEvent.change(screen.getByLabelText('Nội dung gọi hỏi, răn đe *'), { target: { value: 'Răn đe không tái phạm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(vi.mocked(axios.post).mock.calls[0][0]).toBe('/api/subjects/s1/summons');
    expect(vi.mocked(axios.post).mock.calls[0][1]).toMatchObject({ content: 'Răn đe không tái phạm' });
  });

  it('hides write actions without the manage permission', () => {
    render(<SubjectDetail subject={subject} canManage={false} political={false} onChanged={vi.fn()} />);
    expect(screen.queryByText('Kết thúc quản lý')).toBeNull();
  });
});

describe('Resident subjects section', () => {
  afterEach(cleanup);

  it('is not rendered and does not call the API without subject permissions', () => {
    vi.mocked(axios.get).mockReset();
    const { container } = render(<ResidentSubjects person={{ id: 'r1', full_name: 'A' }} currentUser={user({})} />);
    expect(container.innerHTML).toBe('');
    expect(axios.get).not.toHaveBeenCalled();
  });
});
