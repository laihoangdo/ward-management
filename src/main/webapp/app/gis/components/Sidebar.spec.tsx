import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_MENUS as INITIAL_DYNAMIC_MENUS } from '../data/defaultMenus';
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
  // The advanced grid map is temporarily hidden from navigation.
  expect(screen.queryByRole('button', { name: name => name.startsWith('Bản đồ lưới chuyên sâu') })).toBeNull();
  for (const menu of INITIAL_DYNAMIC_MENUS.filter(item => item.id !== 'advanced-map')) {
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
      canRevealIdentity: false,
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
  // Still hidden: the advanced grid map is temporarily retired even when its permission is granted.
  expect(screen.queryByRole('button', { name: name => name.startsWith(menus[0].label) })).toBeNull();
  expect(screen.queryByRole('button', { name: name => name.startsWith(menus[1].label) })).toBeNull();

  user.subAdminPermissions!.canViewField3DMap = true;
  view.rerender(
    <MemoryRouter>
      <Sidebar {...props} currentUser={{ ...user }} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: name => name.startsWith(menus[1].label) })).toBeTruthy();
});

it('shows only the profile facts the account has and names the logout control', () => {
  const base: AppUser = {
    id: 'synthetic-officer',
    username: 'synthetic-officer',
    fullName: 'Cán bộ thử nghiệm',
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
    createdAt: '2026-10-12',
  };
  const view = (user: AppUser) =>
    render(
      <MemoryRouter>
        <Sidebar
          activeTab="overview"
          onTabChange={vi.fn()}
          officer={DEFAULT_OFFICER}
          currentUser={user}
          dynamicMenus={INITIAL_DYNAMIC_MENUS}
          warningCount={0}
          onLogout={vi.fn()}
          onSwitchAccount={vi.fn()}
        />
      </MemoryRouter>,
    );
  const empty = view(base);
  expect(screen.queryByText(/Số hiệu:/)).toBeNull();
  expect(document.querySelector('.gis-sidebar-territory')).toBeNull();
  expect(screen.getByRole('button', { name: 'Đăng xuất khỏi hệ thống' })).toBeDefined();
  expect(screen.getByText('Công an viên địa bàn')).toBeDefined();
  empty.unmount();

  view({ ...base, badgeNumber: '123-456', assignedWard: 'Xã Bà Điểm', assignedHamlets: ['Trung Chánh 2'] });
  expect(screen.getByText('Số hiệu: 123-456')).toBeDefined();
  expect(document.querySelector('.gis-sidebar-territory')?.textContent).toContain('Trung Chánh 2');
});

it('folds a commune-wide hamlet list behind a count', () => {
  const hamlets = Array.from({ length: 51 }, (_, i) => `Ấp thử ${i + 1}`);
  render(
    <MemoryRouter>
      <Sidebar
        activeTab="overview"
        onTabChange={vi.fn()}
        officer={DEFAULT_OFFICER}
        currentUser={{
          id: 'synthetic-commune',
          username: 'synthetic-commune',
          fullName: 'Trưởng Công an xã thử nghiệm',
          role: 'admin',
          rank: '',
          position: '',
          unit: '',
          badgeNumber: '',
          phone: '',
          assignedWard: '',
          assignedHamlets: hamlets,
          assignedStreets: [],
          status: 'active',
          createdAt: '2026-10-12',
        }}
        dynamicMenus={INITIAL_DYNAMIC_MENUS}
        warningCount={0}
        onLogout={vi.fn()}
        onSwitchAccount={vi.fn()}
      />
    </MemoryRouter>,
  );
  const territory = document.querySelector('.gis-sidebar-territory') as HTMLElement;
  const summary = territory.querySelector('summary') as HTMLElement;
  expect(summary.textContent).toBe('51 ấp được giao');
  expect((territory.querySelector('details') as HTMLDetailsElement).open).toBe(false);
  expect(territory.textContent).not.toMatch(/^\(/);
});
