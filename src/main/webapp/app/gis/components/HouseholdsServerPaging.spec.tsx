import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { HouseholdsTab } from './HouseholdsTab';
import { browseHouseholds, loadHouseholdDetail } from '../services/householdBrowse';
import { HouseholdFacility } from '../types';

vi.mock('../services/householdBrowse', () => ({ browseHouseholds: vi.fn(), loadHouseholdDetail: vi.fn() }));
const household = (id: number) =>
  ({
    id: String(id),
    ownerName: `Paged owner ${id}`,
    code: `HH-${id}`,
    hamlet: 'Area',
    street: 'Street',
    type: 'household',
    status: 'normal',
    residenceType: 'Thường trú',
    residentsList: [],
  }) as HouseholdFacility;
const props = { households: [], serverPaging: true, onSelectHousehold: vi.fn(), onOpenAddModal: vi.fn() };
const page = (index = 0) => ({
  items: [household(index * 12 + 1)],
  page: index,
  total: 501,
  scopeTotal: 501,
  hamlets: { Area: 501 },
  residenceCounts: { permanent: 501 },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(browseHouseholds).mockImplementation(query => Promise.resolve(page(query.page)));
});
afterEach(cleanup);

it('requests only the displayed page and keeps the server total across pages', async () => {
  render(<HouseholdsTab {...props} />);
  await screen.findAllByText('Paged owner 1');
  fireEvent.click(screen.getByTitle('Trang tiếp theo'));
  await screen.findAllByText('Paged owner 13');
  expect(browseHouseholds).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 12 }), expect.any(AbortSignal));
  expect(screen.queryAllByText('Paged owner 1')).toEqual([]);
});

it('sends shared search to the server rather than filtering only the current page', async () => {
  const view = render(<HouseholdsTab {...props} searchQuery="" />);
  await screen.findAllByText('Paged owner 1');
  vi.mocked(browseHouseholds).mockResolvedValue({ ...page(), items: [household(900)], total: 1 });
  view.rerender(<HouseholdsTab {...props} searchQuery="resident on another page" />);
  await screen.findAllByText('Paged owner 900');
  expect(browseHouseholds).toHaveBeenLastCalledWith(
    expect.objectContaining({ search: 'resident on another page', page: 0 }),
    expect.any(AbortSignal),
  );
});

it('opens only a complete detail and preserves the list when a page request fails', async () => {
  render(<HouseholdsTab {...props} />);
  await screen.findAllByText('Paged owner 1');
  const full = { ...household(1), residentsList: [{ id: 'resident-1', fullName: 'Roster record' }] } as HouseholdFacility;
  vi.mocked(loadHouseholdDetail).mockResolvedValue(full);
  fireEvent.click(screen.getAllByText('Xem chi tiết')[0]);
  await waitFor(() => expect(props.onSelectHousehold).toHaveBeenCalledWith(full));
  vi.mocked(browseHouseholds).mockRejectedValueOnce(Error('offline'));
  fireEvent.click(screen.getByTitle('Trang tiếp theo'));
  await screen.findByRole('alert');
  expect(screen.getAllByText('Paged owner 1')[0]).toBeTruthy();
});
