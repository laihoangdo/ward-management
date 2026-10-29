import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { Header } from './Header';
import { AppUser, DEFAULT_OFFICER } from '../types';

vi.mock('./VoiceSearchModal', () => ({
  VoiceSearchModal: ({ isOpen, onApplySearch }: { isOpen: boolean; onApplySearch: (value: string) => void }) =>
    isOpen ? <button onClick={() => onApplySearch('kiểm thử')}>Áp dụng giọng nói kiểm thử</button> : null,
}));
afterEach(cleanup);

it('preserves search, refresh, navigation, theme, warning, logout and sidebar actions', () => {
  const props = {
    activeTab: 'overview' as const,
    warningCount: 2,
    searchQuery: 'abc',
    onSearchChange: vi.fn(),
    onOpenWarnings: vi.fn(),
    onRefresh: vi.fn(),
    onTabChange: vi.fn(),
    onToggleTheme: vi.fn(),
    onToggleDesktopSidebar: vi.fn(),
    onToggleMobileSidebar: vi.fn(),
    onLogout: vi.fn(),
    currentUser: {
      ...DEFAULT_OFFICER,
      id: 'test',
      username: 'test',
      role: 'superadmin',
      status: 'active',
      createdAt: '2026-10-29',
    } as AppUser,
  };
  render(
    <MemoryRouter>
      <Header {...props} />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'hồ sơ' } });
  expect(props.onSearchChange).toHaveBeenLastCalledWith('hồ sơ');
  fireEvent.click(screen.getByTitle('Xóa tìm kiếm'));
  expect(props.onSearchChange).toHaveBeenLastCalledWith('');
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật dữ liệu' }));
  expect(props.onRefresh).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByTitle('Mở nhanh module Quản lý nhân khẩu & Định danh'));
  expect(props.onTabChange).toHaveBeenLastCalledWith('residents');
  fireEvent.click(screen.getByTitle('Chuyển sang Chế độ Tối (Ban đêm)'));
  expect(props.onToggleTheme).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByTitle('Thông báo & Cảnh báo an ninh địa bàn (2)'));
  expect(props.onOpenWarnings).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByTitle('Đăng xuất'));
  expect(props.onLogout).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Ẩn menu bên trái' }));
  expect(props.onToggleDesktopSidebar).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Mở menu điều hành' }));
  expect(props.onToggleMobileSidebar).toHaveBeenCalledOnce();
});

it('keeps the mobile search disclosure and voice-search application functional', () => {
  const search = vi.fn(),
    navigate = vi.fn();
  const view = render(
    <MemoryRouter>
      <Header
        activeTab="overview"
        warningCount={0}
        onOpenWarnings={vi.fn()}
        onRefresh={vi.fn()}
        searchQuery=""
        onSearchChange={search}
        onTabChange={navigate}
      />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByTitle('Tìm kiếm nhanh'));
  expect(screen.getByTitle('Tìm kiếm nhanh').getAttribute('aria-expanded')).toBe('true');
  fireEvent.change(view.container.querySelector('#gis-mobile-search input')!, { target: { value: 'địa bàn' } });
  expect(search).toHaveBeenLastCalledWith('địa bàn');
  fireEvent.click(screen.getByTitle('Bấm để nói'));
  fireEvent.click(screen.getByText('Áp dụng giọng nói kiểm thử'));
  expect(search).toHaveBeenLastCalledWith('kiểm thử');
  expect(view.container.querySelector('#gis-mobile-search')).toBeNull();
});
