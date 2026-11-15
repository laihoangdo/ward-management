import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { ListExportActions } from './ListExport';

vi.mock('axios', () => ({ default: { get: vi.fn(), isAxiosError: (e: { response?: unknown }) => Boolean(e?.response) } }));

const sheet = {
  kind: 'subjects',
  commune: 'Xã Bà Điểm',
  title: 'DANH SÁCH ĐỐI TƯỢNG HỆ MA TÚY',
  scope: 'Ấp Trung Chánh 2',
  summary: 'Hệ Ma túy, đang quản lý',
  totalLine: 'Tổng số: 1 đối tượng',
  columns: [
    { key: 'stt', header: 'STT', width: 6, center: true },
    { key: 'name', header: 'Họ và tên', width: 24, center: false },
  ],
  rows: [['1', 'Nguyễn Văn Thử']],
  truncated: false,
  generatedBy: 'Cán bộ thử',
  generatedAt: '10:00 15/11/2026',
};

describe('List print and Excel export', () => {
  beforeEach(() => vi.mocked(axios.get).mockReset());
  afterEach(cleanup);

  it('opens the A4 print view of the current filter', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: sheet });
    render(<ListExportActions base="/api/subjects" params={{ category: 'MT' }} fallbackName="x.xlsx" />);
    fireEvent.click(screen.getByText('In danh sách'));
    const view = await screen.findByRole('dialog', { name: 'Bản in danh sách đối tượng hệ ma túy' });
    expect(view.textContent).toContain('CÔNG AN XÃ BÀ ĐIỂM');
    expect(view.textContent).toContain('Nguyễn Văn Thử');
    expect(view.textContent).toContain('Tổng số: 1 đối tượng');
    expect(axios.get).toHaveBeenCalledWith('/api/subjects/export/print', { params: { category: 'MT' } });
    expect(document.body.classList.contains('resident-printing')).toBe(true);
    fireEvent.click(screen.getByText('Đóng'));
    expect(document.body.classList.contains('resident-printing')).toBe(false);
  });

  it('downloads the Excel file and explains a missing export permission', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: new Blob(['x']), headers: {} });
    render(<ListExportActions base="/api/facilities" params={{ group: 'CONDITIONAL' }} fallbackName="co-so.xlsx" />);
    fireEvent.click(screen.getByText('Xuất Excel'));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    expect(axios.get).toHaveBeenCalledWith('/api/facilities/export/xlsx', { params: { group: 'CONDITIONAL' }, responseType: 'blob' });

    vi.mocked(axios.get).mockRejectedValueOnce({ response: { status: 403 } });
    fireEvent.click(screen.getByText('Xuất Excel'));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Chưa được cấp quyền xuất danh sách (Xuất báo cáo).');
    vi.unstubAllGlobals();
  });
});
