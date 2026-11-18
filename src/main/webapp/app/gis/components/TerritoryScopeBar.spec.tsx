import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { TerritoryScopeBar } from './TerritoryScopeBar';

afterEach(cleanup);

it('names the territory, role and street scope with one household figure', () => {
  render(
    <TerritoryScopeBar user={{ role: 'officer', assignedHamlets: ['Ấp Trung Chánh 2'], assignedStreets: [] }} householdCount={1291} />,
  );
  const bar = screen.getByRole('region', { name: 'Phạm vi địa bàn được giao' });
  expect(bar.textContent).toContain('Ấp Trung Chánh 2');
  expect(bar.textContent).toContain('Công an viên địa bàn');
  expect(bar.textContent).toContain('Toàn bộ địa bàn ấp');
  expect(bar.textContent).toContain('1291 hộ trong phạm vi');
  expect(bar.textContent).not.toMatch(/nhân khẩu|Sub-Admin/);
});

it('uses the hamlet manager label and assigned streets, and omits an unknown household count', () => {
  render(<TerritoryScopeBar user={{ role: 'sub-admin', assignedHamlets: [], assignedStreets: ['Lê Quang Đạo'] }} />);
  const bar = screen.getByRole('region', { name: 'Phạm vi địa bàn được giao' });
  expect(bar.textContent).toContain('Công an phụ trách ấp');
  expect(bar.textContent).toContain('Lê Quang Đạo');
  expect(bar.textContent).not.toMatch(/Đang tải|hộ trong phạm vi/);
});
