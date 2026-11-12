import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AppUser } from '../types';
import { fetchDelegationRoads, fetchPermissionGroups, fetchRbacAreas, saveDelegation } from '../services/authService';
import { SubAdminDelegationTab } from './SubAdminDelegationTab';

vi.mock('./AdministrativeDirectory', () => ({ AdministrativeDirectory: () => null }));

vi.mock('../services/authService', () => ({
  fetchDelegationRoads: vi.fn(),
  fetchRbacAreas: vi.fn(),
  saveDelegation: vi.fn(),
  fetchPermissionGroups: vi.fn().mockResolvedValue([]),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('offers DB roads only in assigned areas and preserves an existing legacy assignment', async () => {
  const officer = {
    id: 'officer',
    role: 'officer',
    fullName: 'Synthetic officer',
    assignedHamlets: ['DB hamlet'],
    hamletIds: [7],
    assignedStreets: ['Legacy road'],
  } as AppUser;
  vi.mocked(fetchRbacAreas).mockResolvedValue([{ id: 7, hamletId: 7, communeId: 1, name: 'DB area', hamletName: 'DB hamlet' }]);
  vi.mocked(fetchDelegationRoads).mockResolvedValue([
    { hamletId: 7, name: 'DB road' },
    { hamletId: 8, name: 'Other area road' },
  ]);
  render(
    <SubAdminDelegationTab currentUser={{ ...officer, id: 'actor', role: 'superadmin' }} usersList={[officer]} onShowToast={vi.fn()} />,
  );
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'DB road' })).toBeTruthy());
  expect(screen.queryByRole('checkbox', { name: 'Other area road' })).toBeNull();
  expect((screen.getByRole('checkbox', { name: 'Legacy road' }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole('checkbox', { name: /DB hamlet/ })).toBeTruthy();
  vi.mocked(saveDelegation).mockResolvedValue(officer);
  fireEvent.click(screen.getByRole('button', { name: /Lưu Cấu Hình Phân Quyền/ }));
  await waitFor(() => expect(saveDelegation).toHaveBeenCalledWith(expect.objectContaining({ hamletIds: [7] })));
});

it('fills the group defaults without saving, and locks permissions outside the group ceiling with a reason', async () => {
  const officer = {
    id: 'officer',
    role: 'officer',
    fullName: 'Cán bộ kiểm thử',
    assignedHamlets: [],
    assignedStreets: [],
    permissionGroupId: 'g1',
    permissionGroupName: 'CAV tuần tra',
    permissionCeiling: ['canScanOcr', 'canUpdateInspection'],
  } as AppUser;
  vi.mocked(fetchRbacAreas).mockResolvedValue([]);
  vi.mocked(fetchDelegationRoads).mockResolvedValue([]);
  vi.mocked(fetchPermissionGroups).mockResolvedValue([
    {
      id: 'g1',
      name: 'CAV tuần tra',
      description: '',
      role: 'officer',
      ceiling: ['canScanOcr', 'canUpdateInspection'],
      defaults: ['canScanOcr'],
    },
  ]);
  render(
    <SubAdminDelegationTab currentUser={{ ...officer, id: 'actor', role: 'superadmin' }} usersList={[officer]} onShowToast={vi.fn()} />,
  );
  const scan = await screen.findByRole('checkbox', { name: /Quét Camera/ });
  const reveal = screen.getByRole('checkbox', { name: /Xem số CCCD đầy đủ/ });
  expect(reveal.getAttribute('aria-disabled')).toBe('true');
  expect(reveal.textContent).toContain('Ngoài phạm vi nhóm do Super Admin đặt');
  fireEvent.click(reveal);
  expect(reveal.getAttribute('aria-checked')).toBe('false');
  expect(screen.getByText('CAV tuần tra')).toBeTruthy();

  expect(scan.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(await screen.findByRole('button', { name: 'Áp dụng mặc định của nhóm' }));
  expect(scan.getAttribute('aria-checked')).toBe('true');
  expect(saveDelegation).not.toHaveBeenCalled();
});

it('tells a hamlet manager they cannot grant a permission they do not hold', async () => {
  const officer = { id: 'officer', role: 'officer', fullName: 'Cán bộ', assignedHamlets: [], assignedStreets: [] } as AppUser;
  vi.mocked(fetchRbacAreas).mockResolvedValue([]);
  vi.mocked(fetchDelegationRoads).mockResolvedValue([]);
  render(
    <SubAdminDelegationTab
      currentUser={{
        ...officer,
        id: 'manager',
        role: 'sub-admin',
        subAdminPermissions: { canScanOcr: true } as AppUser['subAdminPermissions'],
      }}
      usersList={[officer]}
      onShowToast={vi.fn()}
    />,
  );
  const reports = await screen.findByRole('checkbox', { name: /Xuất Báo cáo/ });
  expect(reports.textContent).toContain('Bạn chưa có quyền này nên không thể cấp');
  expect(screen.getByRole('checkbox', { name: /Quét Camera/ }).getAttribute('aria-disabled')).toBeNull();
  expect(screen.getByRole('checkbox', { name: /bản đồ không gian 3D/ }).getAttribute('aria-disabled')).toBeNull();
});

it('exposes permission state and lets the keyboard toggle the same permission without saving', async () => {
  const officer = {
    id: 'officer',
    role: 'officer',
    fullName: 'Cán bộ kiểm thử',
    assignedHamlets: [],
    assignedStreets: [],
  } as AppUser;
  vi.mocked(fetchRbacAreas).mockResolvedValue([]);
  vi.mocked(fetchDelegationRoads).mockResolvedValue([]);
  render(
    <SubAdminDelegationTab currentUser={{ ...officer, id: 'actor', role: 'superadmin' }} usersList={[officer]} onShowToast={vi.fn()} />,
  );
  const permission = await screen.findByRole('checkbox', { name: /Quét Camera/ });
  expect(permission.getAttribute('aria-checked')).toBe('false');
  fireEvent.keyDown(permission, { key: ' ' });
  expect(permission.getAttribute('aria-checked')).toBe('true');
  fireEvent.keyDown(permission, { key: 'Enter' });
  expect(permission.getAttribute('aria-checked')).toBe('false');
  expect(saveDelegation).not.toHaveBeenCalled();
});

it('saves the hamlets and roads chosen through the checklists', async () => {
  const officer = {
    id: 'officer',
    role: 'officer',
    fullName: 'Synthetic officer',
    assignedHamlets: [],
    hamletIds: [],
    assignedStreets: [],
  } as AppUser;
  vi.mocked(fetchRbacAreas).mockResolvedValue([
    { id: 7, hamletId: 7, communeId: 1, name: 'Area A', hamletName: 'Hamlet A' },
    { id: 8, hamletId: 8, communeId: 1, name: 'Area B', hamletName: 'Hamlet B' },
  ]);
  vi.mocked(fetchDelegationRoads).mockResolvedValue([{ hamletId: 8, name: 'Road B' }]);
  render(
    <SubAdminDelegationTab currentUser={{ ...officer, id: 'actor', role: 'superadmin' }} usersList={[officer]} onShowToast={vi.fn()} />,
  );
  fireEvent.click(await screen.findByRole('checkbox', { name: /Hamlet B/ }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Road B' }));
  expect(screen.getByText('Đã chọn 1/2')).toBeTruthy();
  vi.mocked(saveDelegation).mockResolvedValue(officer);
  fireEvent.click(screen.getByRole('button', { name: /Lưu Cấu Hình Phân Quyền/ }));
  await waitFor(() =>
    expect(saveDelegation).toHaveBeenCalledWith(expect.objectContaining({ hamletIds: [8], assignedStreets: ['Road B'] })),
  );
});
