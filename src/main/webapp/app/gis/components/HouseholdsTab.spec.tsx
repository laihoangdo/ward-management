import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HouseholdsTab } from './HouseholdsTab';
import { HouseholdFacility } from '../types';

const households = Array.from({ length: 13 }, (_, i) => ({
  id: String(i),
  code: `HH-${i}`,
  ownerName: `Resident ${i}`,
  houseNumber: String(i),
  street: 'Main',
  hamlet: 'Area',
  type: 'household',
  status: 'normal',
  members: [],
})) as unknown as HouseholdFacility[];

describe('Household lookup', () => {
  it('keeps the list visible when the dataset shrinks on the last page', () => {
    const props = { onSelectHousehold: vi.fn(), onOpenAddModal: vi.fn() };
    const { rerender } = render(<HouseholdsTab {...props} households={households} />);
    fireEvent.click(screen.getByTitle('Trang tiếp theo'));
    rerender(<HouseholdsTab {...props} households={households.slice(0, 1)} />);
    expect(screen.getAllByText('Resident 0').length).toBeGreaterThan(0);
  });
  it('applies the shared query and sends edits back to its owner', () => {
    const onSearchChange = vi.fn();
    render(
      <HouseholdsTab
        households={households}
        searchQuery="Resident 12"
        onSearchChange={onSearchChange}
        onSelectHousehold={vi.fn()}
        onOpenAddModal={vi.fn()}
      />,
    );
    expect(screen.queryByText('Resident 0')).toBeNull();
    expect(screen.getAllByText('Resident 12').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'HH-1' } });
    expect(onSearchChange).toHaveBeenCalledWith('HH-1');
  });
});
