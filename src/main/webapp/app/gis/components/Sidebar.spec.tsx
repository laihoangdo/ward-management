import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { INITIAL_DYNAMIC_MENUS } from '../data/initialAuthData';
import { DEFAULT_OFFICER, type AppUser } from '../types';
import { Sidebar } from './Sidebar';

afterEach(cleanup);

it('keeps every other menu navigable while hiding a retired server menu', () => {
  const user: AppUser = {
    id: 'synthetic',
    username: 'synthetic',
    fullName: 'Synthetic User',
    role: 'superadmin',
    rank: '',
    position: '',
    unit: '',
    badgeNumber: '',
    phone: '',
    assignedWard: '',
    assignedHamlets: [],
    assignedStreets: [],
    status: 'active',
    createdAt: '2026-10-12',
  };
  const onTabChange = vi.fn();
  const stale = JSON.parse(JSON.stringify({ ...INITIAL_DYNAMIC_MENUS[0], id: 'spatial-3d-map', label: 'Retired spatial menu' }));
  const staleVietMap = JSON.parse(JSON.stringify({ ...INITIAL_DYNAMIC_MENUS[0], id: 'vietmap-compare', label: 'Retired VietMap menu' }));
  render(
    <MemoryRouter>
      <Sidebar
        activeTab="overview"
        onTabChange={onTabChange}
        officer={DEFAULT_OFFICER}
        currentUser={user}
        dynamicMenus={[...INITIAL_DYNAMIC_MENUS, stale, staleVietMap]}
        warningCount={0}
        onLogout={vi.fn()}
        onSwitchAccount={vi.fn()}
      />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('button', { name: /Retired spatial menu/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Retired VietMap menu/ })).toBeNull();
  for (const menu of INITIAL_DYNAMIC_MENUS) {
    const button = screen.getByRole('button', { name: name => name.startsWith(menu.label) });
    fireEvent.click(button);
    expect(onTabChange).toHaveBeenLastCalledWith(menu.id);
  }
  expect(INITIAL_DYNAMIC_MENUS.some(menu => menu.id === 'field-3d-map')).toBe(true);
});

it('shows each map only when its separate view permission is granted', () => {
  const user: AppUser = {
    id: 'officer',
    username: 'officer',
    fullName: 'Officer',
    role: 'officer',
    rank: '',
    position: '',
    unit: '',
    badgeNumber: '',
    phone: '',
    assignedWard: '',
    assignedHamlets: [],
    assignedStreets: [],
    status: 'active',
    createdAt: '2026-10-13',
    subAdminPermissions: {
      canViewAdvancedMap: false,
      canViewField3DMap: false,
      canEditCoordinates: false,
      canAddHouseholds: false,
      canScanOcr: false,
      canRenewDocs: false,
      canExportReports: false,
      canSendReminders: false,
      canUpdateInspection: false,
      canManageStreets: false,
    },
  };
  const menus = INITIAL_DYNAMIC_MENUS.filter(menu => ['advanced-map', 'field-3d-map'].includes(menu.id));
  const props = {
    activeTab: 'overview' as const,
    onTabChange: vi.fn(),
    officer: DEFAULT_OFFICER,
    dynamicMenus: menus,
    warningCount: 0,
    onLogout: vi.fn(),
    onSwitchAccount: vi.fn(),
  };
  const view = render(
    <MemoryRouter>
      <Sidebar {...props} currentUser={user} />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('button', { name: name => name.startsWith(menus[0].label) })).toBeNull();
  expect(screen.queryByRole('button', { name: name => name.startsWith(menus[1].label) })).toBeNull();

  user.subAdminPermissions!.canViewAdvancedMap = true;
  view.rerender(
    <MemoryRouter>
      <Sidebar {...props} currentUser={{ ...user }} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: name => name.startsWith(menus[0].label) })).toBeTruthy();
  expect(screen.queryByRole('button', { name: name => name.startsWith(menus[1].label) })).toBeNull();

  user.subAdminPermissions!.canViewField3DMap = true;
  view.rerender(
    <MemoryRouter>
      <Sidebar {...props} currentUser={{ ...user }} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: name => name.startsWith(menus[1].label) })).toBeTruthy();
});
