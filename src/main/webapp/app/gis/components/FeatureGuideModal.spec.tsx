import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActiveMenuGuideBanner, FeatureGuideModal, MENU_GUIDES } from './FeatureGuideModal';
import { DEFAULT_MENUS } from '../data/defaultMenus';

afterEach(cleanup);

describe('feature guide', () => {
  it('has a guide for every visible default menu and none for the hidden grid map', () => {
    const guideIds = new Set(MENU_GUIDES.map(guide => guide.id));
    for (const menu of DEFAULT_MENUS.filter(item => item.id !== 'advanced-map')) expect(guideIds.has(menu.id)).toBe(true);
    expect(guideIds.has('advanced-map')).toBe(false);
  });

  it('opens on the current menu, lists only permitted menus and navigates to another menu', () => {
    const onClose = vi.fn();
    const onNavigateTab = vi.fn();
    const visible = DEFAULT_MENUS.filter(menu => ['overview', 'households', 'field-3d-map'].includes(menu.id));
    render(<FeatureGuideModal isOpen onClose={onClose} activeTab="households" visibleMenus={visible} onNavigateTab={onNavigateTab} />);

    const list = screen.getByRole('complementary', { name: 'Danh sách các menu hướng dẫn' });
    expect(list.querySelectorAll('button')).toHaveLength(3);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toContain('Danh sách hộ dân');
    expect(screen.queryByText('Trung tâm Quản trị Tối cao')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Bản Đồ Không Gian 3D Thực Địa/ }));
    expect(screen.getByText(/Bật Hiệu ứng Three.js theo phạm vi quản lý/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Mở phân hệ này/ }));
    expect(onNavigateTab).toHaveBeenCalledWith('field-3d-map');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<FeatureGuideModal isOpen onClose={onClose} activeTab="overview" visibleMenus={DEFAULT_MENUS} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows a collapsible banner for the active menu', () => {
    const onOpen = vi.fn();
    render(<ActiveMenuGuideBanner activeTab="documents" onOpenFullGuide={onOpen} />);
    expect(screen.getByText('Quản lý giấy tờ & ANTT:')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Xem 3 bước thao tác/ }));
    expect(screen.getByText(/Lọc hồ sơ theo trạng thái hiệu lực/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Tất cả menu/ }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
