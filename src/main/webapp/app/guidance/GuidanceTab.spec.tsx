import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import GuidanceTab from './GuidanceTab';

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), isAxiosError: () => false },
}));

const doc = {
  id: 'g1',
  doc_number: '125/HD-CAT',
  issuing_authority: 'Công an Thành phố',
  issued_on: '2026-10-01',
  received_on: '2026-10-05',
  title: 'Hướng dẫn rà soát cư trú cuối năm',
  version: 0,
  file_count: 1,
};
const summary = (canManage: boolean) => ({
  total: 1,
  years: [2026],
  authorities: ['Công an Thành phố'],
  receivedThisMonth: 0,
  canManage,
});

const mockApi = (canManage: boolean) =>
  vi.mocked(axios.get).mockImplementation(url => {
    const u = String(url);
    if (u.endsWith('/summary')) return Promise.resolve({ data: summary(canManage) });
    if (u.endsWith('/files')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: { items: [doc], total: 1, page: 0, pageSize: 30 } });
  });

describe('Guidance documents register', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.delete).mockReset();
  });
  afterEach(cleanup);

  it('lists documents with number, issuing body, dates and title and filters by year', async () => {
    mockApi(false);
    render(<GuidanceTab />);
    const row = (await screen.findByText('125/HD-CAT')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Công an Thành phố')).toBeTruthy();
    expect(within(row).getByText('Hướng dẫn rà soát cư trú cuối năm')).toBeTruthy();
    expect(screen.queryByText('+ Vào sổ văn bản')).toBeNull();
    fireEvent.change(await screen.findByLabelText('Năm ban hành'), { target: { value: '2026' } });
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/guidance-documents', { params: { page: 0, year: '2026' } }));
  });

  it('records a new document and opens its scanned files', async () => {
    mockApi(true);
    vi.mocked(axios.post).mockResolvedValue({ data: { ...doc, id: 'g2', doc_number: '7/HD-CAX', file_count: 0 } });
    render(<GuidanceTab />);
    fireEvent.click(await screen.findByText('+ Vào sổ văn bản'));
    fireEvent.change(screen.getByLabelText('Số, ký hiệu văn bản *'), { target: { value: '7/HD-CAX' } });
    fireEvent.change(screen.getByLabelText('Cơ quan ban hành *'), { target: { value: 'Công an xã' } });
    fireEvent.change(screen.getByLabelText('Ngày ban hành *'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Trích yếu / tiêu đề *'), { target: { value: 'Hướng dẫn tuần tra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByRole('region', { name: 'Văn bản 7/HD-CAX' })).toBeTruthy();
    expect(vi.mocked(axios.post).mock.calls[0][1]).toMatchObject({ docNumber: '7/HD-CAX', issuingAuthority: 'Công an xã' });
    expect(axios.get).toHaveBeenCalledWith('/api/guidance-documents/g2/files');
  });

  it('removes a document only after confirming', async () => {
    mockApi(true);
    vi.mocked(axios.delete).mockResolvedValue({});
    render(<GuidanceTab />);
    fireEvent.click(await screen.findByRole('button', { name: '125/HD-CAT' }));
    fireEvent.click(screen.getByText('Xoá'));
    expect(axios.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Xác nhận xoá khỏi sổ'));
    await waitFor(() => expect(axios.delete).toHaveBeenCalledWith('/api/guidance-documents/g1'));
  });
});
