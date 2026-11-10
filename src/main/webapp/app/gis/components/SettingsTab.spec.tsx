import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_OFFICER } from '../types';
import { SettingsTab } from './SettingsTab';

afterEach(cleanup);

it('labels every account field and shows only real connection facts', () => {
  render(
    <SettingsTab officer={{ ...DEFAULT_OFFICER, username: 'can-bo', badgeNumber: '' }} onUpdateOfficer={vi.fn()} backendStatus="online" />,
  );
  for (const label of [
    'Tài khoản đăng nhập (Hệ thống điều hành):',
    'Cấp bậc / Chức vụ:',
    'Số hiệu CAND:',
    'Họ và tên cán bộ CSKV:',
    'Đơn vị công tác:',
  ]) {
    expect(screen.getByLabelText(label)).toBeDefined();
  }
  expect(screen.getByText('Đang kết nối')).toBeDefined();
  expect(screen.queryByText(/Đã xác thực CAND|Express REST|Spring Boot 3|Bản v2/)).toBeNull();
});

it('hides the permission summary box when the profile has none', () => {
  const { rerender } = render(<SettingsTab officer={{ ...DEFAULT_OFFICER, permissions: '' }} onUpdateOfficer={vi.fn()} />);
  expect(screen.queryByText('Phân quyền địa bàn được cấp:')).toBeNull();
  rerender(<SettingsTab officer={{ ...DEFAULT_OFFICER, permissions: 'Ấp Trung Chánh 2 · cập nhật kiểm tra' }} onUpdateOfficer={vi.fn()} />);
  expect(screen.getByText('Ấp Trung Chánh 2 · cập nhật kiểm tra')).toBeDefined();
});
