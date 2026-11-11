import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { fetchPermissionGroups, savePermissionGroup } from '../services/rbacApiService';
import { PermissionGroupsPanel } from './PermissionGroupsPanel';

vi.mock('../services/rbacApiService', () => ({
  fetchPermissionGroups: vi.fn(),
  savePermissionGroup: vi.fn(),
  deletePermissionGroup: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const officerGroup = {
  id: 'builtin-officer',
  name: 'Công an viên',
  description: '',
  role: 'officer' as const,
  ceiling: ['canUpdateInspection', 'canScanOcr'] as ('canUpdateInspection' | 'canScanOcr')[],
  defaults: ['canScanOcr'] as 'canScanOcr'[],
  builtIn: true,
  members: 3,
};

it('keeps defaults inside the ceiling and blocks deleting a built-in group', async () => {
  vi.mocked(fetchPermissionGroups).mockResolvedValue([officerGroup]);
  render(<PermissionGroupsPanel onShowToast={vi.fn()} />);
  expect((await screen.findByRole('button', { name: 'Xóa nhóm Công an viên' })).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Sửa nhóm Công an viên' }));
  const allowedScan = screen.getByRole('checkbox', { name: 'Được phép: Quét camera / OCR CCCD' }) as HTMLInputElement;
  const defaultScan = screen.getByRole('checkbox', { name: 'Mặc định: Quét camera / OCR CCCD' }) as HTMLInputElement;
  expect(defaultScan.checked).toBe(true);
  fireEvent.click(allowedScan);
  expect(defaultScan.checked).toBe(false);
  expect(defaultScan.disabled).toBe(true);
});

it('asks for confirmation before a narrowed ceiling revokes permissions, then saves with confirmation', async () => {
  const toast = vi.fn();
  vi.mocked(fetchPermissionGroups).mockResolvedValue([officerGroup]);
  vi.mocked(savePermissionGroup)
    .mockResolvedValueOnce({ status: 'confirm', affected: 2, permissions: ['canScanOcr'] })
    .mockResolvedValueOnce({ status: 'saved', group: { ...officerGroup, ceiling: ['canUpdateInspection'], defaults: [], revoked: 2 } });
  render(<PermissionGroupsPanel onShowToast={toast} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa nhóm Công an viên' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Được phép: Quét camera / OCR CCCD' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu nhóm quyền' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('2 cán bộ');
  expect(vi.mocked(savePermissionGroup).mock.calls[0][1]).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thu hồi và lưu' }));
  await waitFor(() => expect(vi.mocked(savePermissionGroup).mock.calls[1][1]).toBe(true));
  await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining('thu hồi quyền của 2 cán bộ')));
});
