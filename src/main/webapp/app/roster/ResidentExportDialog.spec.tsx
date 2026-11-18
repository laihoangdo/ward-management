import React from 'react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ResidentExportDialog from './ResidentExportDialog';
import ResidentPrintView from './ResidentPrintView';
import { activeFilterCount, emptyFilter, presets, toParams } from './residentExport';

vi.mock('axios', () => ({ default: { get: vi.fn(), isCancel: () => false } }));

const options = (overrides = {}) => ({
  columns: [
    { key: 'stt', header: 'STT', width: 6 },
    { key: 'fullName', header: 'Họ và tên', width: 26 },
    { key: 'identity', header: 'Số định danh', width: 16 },
    { key: 'hamlet', header: 'Ấp', width: 16 },
  ],
  defaultColumns: ['stt', 'fullName', 'identity'],
  classifications: ['Diện A'],
  canExportCommune: false,
  canRevealIdentity: false,
  limit: 20000,
  ...overrides,
});

const result = (overrides = {}) => ({
  commune: 'Xã Bà Điểm',
  scope: 'Ấp Trung Chánh 2',
  summary: 'Nam; thường trú',
  columns: options().columns.slice(0, 3),
  rows: [['1', 'Nguyễn Văn An', '*********101']],
  total: 1,
  male: 1,
  female: 0,
  unevaluable: null,
  byHamlet: [],
  fullIdentity: false,
  communeWide: false,
  generatedBy: 'Cán bộ',
  generatedAt: '08:00 13/11/2026',
  ...overrides,
});

const mockApi = (opts = options(), preview = result()) =>
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url.endsWith('/options')) return Promise.resolve({ data: opts });
    if (url.endsWith('/preview')) return Promise.resolve({ data: preview });
    if (url.endsWith('/print')) return Promise.resolve({ data: result({ total: 1 }) });
    return Promise.reject(new Error(`unexpected ${url}`));
  });

const lastPreviewParams = () => {
  const calls = vi.mocked(axios.get).mock.calls.filter(([url]) => String(url).endsWith('/preview'));
  return (calls.at(-1)?.[1] as { params: Record<string, string> }).params;
};

describe('Resident export model', () => {
  it('builds request parameters without empty values and counts active filters', () => {
    const filter = { ...emptyFilter(), gender: 'MALE' as const, kinds: ['PERMANENT', 'TEMPORARY'], ageMin: '18' };
    expect(toParams(filter, ['stt', 'fullName'])).toEqual({
      status: 'ACTIVE',
      sort: 'HOUSEHOLD',
      gender: 'MALE',
      kinds: 'PERMANENT,TEMPORARY',
      ageMin: '18',
      columns: 'stt,fullName',
    });
    expect(activeFilterCount(emptyFilter())).toBe(0);
    expect(activeFilterCount(filter)).toBe(3);
  });

  it('fills the military-service preset and the identity-card milestones from the year', () => {
    const list = presets(2026);
    const military = list.find(p => p.id === 'military')!.apply({ ...emptyFilter(), scope: 'commune', search: 'x' });
    expect(military).toMatchObject({ gender: 'MALE', kinds: ['PERMANENT'], ageMin: '18', ageMax: '27', scope: 'commune', search: '' });
    expect(list.find(p => p.id === 'id14')!.apply(emptyFilter())).toMatchObject({ birthYearFrom: '2012', birthYearTo: '2012' });
  });
});

describe('Resident export dialog', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    window.localStorage.clear();
  });
  afterEach(cleanup);

  it('previews the count for the chosen preset with the matching parameters', async () => {
    mockApi();
    render(<ResidentExportDialog onClose={vi.fn()} hamletLabel="Ấp Trung Chánh 2" />);
    await screen.findByText('Nam; thường trú');
    fireEvent.click(screen.getByRole('button', { name: 'Nam thường trú 18–27 tuổi (nghĩa vụ quân sự)' }));
    await waitFor(() => expect(lastPreviewParams()).toMatchObject({ gender: 'MALE', kinds: 'PERMANENT', ageMin: '18', ageMax: '27' }));
    expect(screen.getByText('người khớp', { exact: false })).toBeTruthy();
    expect(screen.getByText('Nguyễn Văn An')).toBeTruthy();
  });

  it('hides the commune scope and the full identity option without the permissions', async () => {
    mockApi();
    render(<ResidentExportDialog onClose={vi.fn()} />);
    await screen.findByText('Nam; thường trú');
    expect(screen.queryByLabelText('Toàn xã (các ấp được giao)')).toBeNull();
    expect(screen.queryByText('Hiện số định danh đầy đủ', { exact: false })).toBeNull();
  });

  it('offers both to the commune chief and adds the hamlet column to a commune-wide list', async () => {
    mockApi(options({ canExportCommune: true, canRevealIdentity: true }));
    render(<ResidentExportDialog onClose={vi.fn()} />);
    await screen.findByText('Nam; thường trú');
    expect(screen.getByText('Hiện số định danh đầy đủ', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Toàn xã (các ấp được giao)'));
    await waitFor(() => expect(lastPreviewParams()).toMatchObject({ scope: 'commune', columns: 'stt,fullName,identity,hamlet' }));
  });

  it('opens the print view with the official heading and signature blocks', async () => {
    mockApi();
    render(<ResidentExportDialog onClose={vi.fn()} />);
    await screen.findByText('Nam; thường trú');
    fireEvent.click(screen.getByRole('button', { name: /Xem bản in/ }));
    expect(await screen.findByRole('heading', { name: 'DANH SÁCH NHÂN KHẨU' })).toBeTruthy();
    expect(screen.getByText('CÔNG AN XÃ BÀ ĐIỂM')).toBeTruthy();
    expect(screen.getByText('TRƯỞNG CÔNG AN XÃ')).toBeTruthy();
    expect(screen.getByRole('button', { name: /In \/ Lưu PDF/ })).toBeTruthy();
  });

  it('saves a personal preset without the name search text', async () => {
    mockApi();
    render(<ResidentExportDialog onClose={vi.fn()} initial={{ search: 'Nguyễn' }} />);
    await screen.findByText('Nam; thường trú');
    fireEvent.change(screen.getByLabelText('Lưu bộ lọc thành mẫu của tôi'), { target: { value: 'Rà soát' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }));
    const stored = JSON.parse(window.localStorage.getItem('resident_export_presets_v1') ?? '[]');
    expect(stored[0].name).toBe('Rà soát');
    expect(stored[0].filter.search).toBe('');
    expect(screen.getByRole('button', { name: 'Rà soát' })).toBeTruthy();
  });
});

describe('Resident print view', () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, 'share');
    Reflect.deleteProperty(navigator, 'canShare');
  });

  it('asks before sharing, then hands the Excel file to the device share sheet', async () => {
    const file = new File(['x'], 'danh-sach.xlsx');
    const loadShareFile = vi.fn().mockResolvedValue(file);
    const shareFn = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareFn, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    render(<ResidentPrintView data={result()} onClose={vi.fn()} loadShareFile={loadShareFile} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chia sẻ$/ }));
    expect(screen.getByText(/Chỉ gửi cho cán bộ có thẩm quyền/)).toBeTruthy();
    expect(loadShareFile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chia sẻ' }));
    await waitFor(() => expect(shareFn).toHaveBeenCalledWith(expect.objectContaining({ files: [file], text: 'Nam; thường trú' })));
    expect(await screen.findByText(/Đã mở ứng dụng chia sẻ/)).toBeTruthy();
  });

  it('downloads the file instead when the browser cannot share files', async () => {
    const file = new File(['x'], 'danh-sach.xlsx');
    const createObjectURL = vi.fn(() => 'blob:x');
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    onTestFinished(() => {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    });
    render(<ResidentPrintView data={result()} onClose={vi.fn()} loadShareFile={vi.fn().mockResolvedValue(file)} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chia sẻ$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chia sẻ' }));
    expect(await screen.findByText(/đã tải file Excel về máy/)).toBeTruthy();
    expect(createObjectURL).toHaveBeenCalledWith(file);
  });

  it('keeps the prepared file when the browser needs a fresh tap to share', async () => {
    const loadShareFile = vi.fn().mockResolvedValue(new File(['x'], 'danh-sach.xlsx'));
    const shareFn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('gesture'), { name: 'NotAllowedError' }))
      .mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareFn, configurable: true });
    render(<ResidentPrintView data={result()} onClose={vi.fn()} loadShareFile={loadShareFile} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chia sẻ$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chia sẻ' }));
    fireEvent.click(await screen.findByRole('button', { name: /Chia sẻ ngay/ }));
    await waitFor(() => expect(shareFn).toHaveBeenCalledTimes(2));
    expect(loadShareFile).toHaveBeenCalledTimes(1);
  });

  it('groups a commune-wide list by hamlet', () => {
    render(
      <ResidentPrintView
        data={result({
          communeWide: true,
          columns: [
            { key: 'stt', header: 'STT', width: 6 },
            { key: 'fullName', header: 'Họ và tên', width: 26 },
            { key: 'hamlet', header: 'Ấp', width: 16 },
          ],
          rows: [
            ['1', 'Người một', 'Bắc Lân'],
            ['2', 'Người hai', 'Bắc Lân'],
            ['3', 'Người ba', 'Đông Lân'],
          ],
        })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('columnheader', { name: 'Bắc Lân' })).toHaveLength(1);
    expect(screen.getAllByRole('columnheader', { name: 'Đông Lân' })).toHaveLength(1);
    expect(document.body.classList.contains('resident-printing')).toBe(true);
  });
});
