import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AreaMapTab } from './AreaMapTab';
import type { HouseholdFacility } from '../types';

afterEach(cleanup);

const households = Array.from({ length: 97 }, (_, index) => ({
  id: String(index + 1),
  houseNumber: String(index + 1),
  ownerName: `Owner ${index + 1}`,
  street: 'Street',
  hamlet: 'Hamlet',
  status: 'normal',
  residentsCount: 1,
})) as HouseholdFacility[];

it('bounds rendered cards, reaches every household, and clamps the page after data shrinks', () => {
  const props = { households, onSelectHousehold: vi.fn(), onRefresh: vi.fn() };
  const { container, rerender } = render(<AreaMapTab {...props} />);
  const cards = () => container.querySelectorAll('[id^="house-card-"]');
  expect(cards()).toHaveLength(48);
  expect((screen.getByRole('button', { name: 'Trang trước' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(cards()).toHaveLength(48);
  expect(cards()[0].id).toBe('house-card-49');
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(cards()).toHaveLength(1);
  expect(cards()[0].id).toBe('house-card-97');
  expect((screen.getByRole('button', { name: 'Trang sau' }) as HTMLButtonElement).disabled).toBe(true);
  rerender(<AreaMapTab {...props} households={households.slice(0, 2)} />);
  expect(cards()).toHaveLength(2);
  expect((screen.getByRole('button', { name: 'Trang trước' }) as HTMLButtonElement).disabled).toBe(true);
});

it('resets pagination when the warning filter changes and handles an empty result', () => {
  const { container } = render(<AreaMapTab households={households} onSelectHousehold={vi.fn()} onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  fireEvent.click(screen.getByRole('checkbox'));
  expect(container.querySelectorAll('[id^="house-card-"]')).toHaveLength(0);
  expect(screen.queryByRole('navigation', { name: 'Phân trang sơ đồ hộ dân' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(container.querySelector('[id^="house-card-"]')?.id).toBe('house-card-1');
});
