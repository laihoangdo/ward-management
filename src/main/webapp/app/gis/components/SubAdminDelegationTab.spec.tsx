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
  await waitFor(() => expect(screen.getByRole('option', { name: 'DB road' })).toBeTruthy());
  expect(screen.queryByRole('option', { name: 'Other area road' })).toBeNull();
  expect((screen.getByRole('option', { name: 'Legacy road' }) as HTMLOptionElement).selected).toBe(true);
  expect(screen.getByRole('option', { name: /DB hamlet/ })).toBeTruthy();
  vi.mocked(saveDelegation).mockResolvedValue(officer);
  fireEvent.click(screen.getByRole('button', { name: /Lưu Cấu Hình Phân Quyền/ }));
  await waitFor(() => expect(saveDelegation).toHaveBeenCalledWith(expect.objectContaining({ hamletIds: [7] })));
});
