import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { HouseholdFacility } from '../types';
import { AreasTab } from './AreasTab';

afterEach(cleanup);

const household = (id: string, residentsCount: number, status = 'normal') =>
  ({
    id,
    code: `H${id}`,
    houseNumber: '',
    street: `${id}/1 ấp 62`,
    hamlet: 'Ấp Trung Chánh 2',
    ownerName: '',
    status,
    residentsCount,
  }) as HouseholdFacility;

it('labels the per-household resident sum and does not call an alert-free hamlet "safe"', () => {
  render(<AreasTab households={[household('1', 2), household('2', 3)]} onSelectHousehold={vi.fn()} />);
  const label = screen.getByText('Nhân khẩu theo hộ');
  expect(label.getAttribute('title')).toMatch(/một người thuộc nhiều hộ/);
  expect(screen.getByText('Không có vị trí cần kiểm tra')).toBeDefined();
  expect(screen.queryByText('An toàn ANTT')).toBeNull();
  expect(screen.queryByText(/Phân quyền địa bàn xã/)).toBeNull();
});
