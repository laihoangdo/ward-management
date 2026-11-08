import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AppUser } from '../types';
import { fetchDelegationRoads, fetchRbacAreas, saveDelegation } from '../services/authService';
import { SubAdminDelegationTab } from './SubAdminDelegationTab';

vi.mock('./AdministrativeDirectory', () => ({ AdministrativeDirectory: () => null }));

vi.mock('../services/authService', () => ({ fetchDelegationRoads: vi.fn(), fetchRbacAreas: vi.fn(), saveDelegation: vi.fn() }));
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
