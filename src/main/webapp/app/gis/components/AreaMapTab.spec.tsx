import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AreaMapTab, getHouseholdAlley, getHouseholdNeighborhoodGroup, UNGROUPED, UNKNOWN_LOCATION } from './AreaMapTab';
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

const sourced = (id: string, legacyHamlet?: string, extra: Partial<HouseholdFacility> = {}) =>
  ({
    id,
    code: `TC2-${id}`,
    houseNumber: '',
    street: `${id}/1 ấp ${legacyHamlet ?? '?'}, xã Bà Điểm`,
    hamlet: 'Trung Chánh 2',
    legacyHamlet,
    ownerName: `Owner ${id}`,
    status: 'normal',
    residentsCount: 1,
    ...extra,
  }) as HouseholdFacility;
const shownCards = (container: HTMLElement) => Array.from(container.querySelectorAll('[id^="house-card-"]')).map(card => card.id);

it('never invents a neighborhood group and says when no group data exists', () => {
  const household = sourced('1', '62', { houseNumber: '7', notes: 'Tổ 3 cũ' });
  expect(getHouseholdNeighborhoodGroup(household)).toBe(UNGROUPED);
  expect(getHouseholdNeighborhoodGroup({ ...household, neighborhoodGroup: ' Tổ 13 ' })).toBe('Tổ 13');

  render(<AreaMapTab households={[household]} onSelectHousehold={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.getByText(/Chưa có dữ liệu tổ dân phố/)).toBeDefined();
  expect(screen.queryByText(/^Tổ \d+$/)).toBeNull();
  expect(screen.queryByRole('button', { name: /^Chỉ xem Tổ/ })).toBeNull();
});

it('filters by the legacy hamlet recorded by the import, keeping unknown sources last', () => {
  const data = [sourced('1', '61'), sourced('2', '62'), sourced('3', '62'), sourced('4')];
  const { container } = render(<AreaMapTab households={data} onSelectHousehold={vi.fn()} onRefresh={vi.fn()} />);
  const group = screen.getByRole('group', { name: 'Lọc theo ấp cũ' });
  const labels = Array.from(group.querySelectorAll('button')).map(button => button.getAttribute('aria-label') ?? button.textContent);
  expect(labels).toEqual(['Tất cả ấp cũ', 'Ấp 61 (cũ), 1 hộ', 'Ấp 62 (cũ), 2 hộ', 'Không rõ ấp cũ, 1 hộ']);

  fireEvent.click(screen.getByRole('button', { name: 'Ấp 62 (cũ), 2 hộ' }));
  expect(shownCards(container)).toEqual(['house-card-2', 'house-card-3']);
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ lọc ấp cũ' }));
  expect(shownCards(container)).toHaveLength(4);
});

it('hides the legacy filter when no household carries import provenance', () => {
  render(<AreaMapTab households={[sourced('1'), sourced('2')]} onSelectHousehold={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.queryByRole('group', { name: 'Lọc theo ấp cũ' })).toBeNull();
});

it('builds the street list from household data instead of a hardcoded list', () => {
  const data = [
    sourced('1', '62', { streetName: 'Lê Quang Đạo' }),
    sourced('2', '62', { streetName: 'Lê Quang Đạo' }),
    sourced('3', '61', { streetName: 'Nguyễn Ảnh Thủ' }),
    sourced('4', '61'),
  ];
  const { container } = render(<AreaMapTab households={data} onSelectHousehold={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /Phan Văn Hớn|Bà Điểm 4|Nguyễn Thị Sóc/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Lê Quang Đạo (2)' }));
  expect(shownCards(container)).toEqual(['house-card-1', 'house-card-2']);
  expect(screen.getByRole('button', { name: 'Nguyễn Ảnh Thủ (1)' })).toBeDefined();
});

it('says so when no household has a parsed street name', () => {
  render(<AreaMapTab households={[sourced('1', '62')]} onSelectHousehold={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.getByText(/Chưa có dữ liệu tên đường/)).toBeDefined();
});

it('does not paste the raw source address into alley labels', () => {
  expect(getHouseholdAlley(sourced('1', '62'))).toBe(UNKNOWN_LOCATION);
  expect(getHouseholdAlley(sourced('1', '62', { houseNumber: '12/3A', streetName: 'Lê Quang Đạo' }))).toBe('Hẻm 12 Lê Quang Đạo');
  expect(getHouseholdAlley(sourced('1', '62', { houseNumber: '5', streetName: 'Lê Quang Đạo' }))).toBe('Mặt tiền Lê Quang Đạo');
  expect(getHouseholdAlley(sourced('1', '62', { alley: ' Hẻm số 3 QL22 ' }))).toBe('Hẻm số 3 QL22');
});
