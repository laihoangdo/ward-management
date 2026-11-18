import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HouseholdSearchSelect } from './HouseholdSearchSelect';
import type { HouseholdFacility } from '../types';

afterEach(cleanup);

const household = {
  id: 'h1',
  code: 'HK-01',
  ownerName: 'Nguyễn Thị Phương Thảo',
  houseNumber: '12',
  street: 'Đường số 3',
  hamlet: 'Ấp 1',
  type: 'household',
} as unknown as HouseholdFacility;

it('opens with the keyboard and picks a household with Enter', () => {
  const onSelect = vi.fn();
  render(<HouseholdSearchSelect households={[household]} selectedId="" onSelect={onSelect} />);

  const trigger = screen.getByRole('button', { name: /Chưa chọn hộ dân/ });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(trigger.getAttribute('aria-expanded')).toBe('true');

  const option = screen.getByRole('option', { name: /Đường số 3/ });
  fireEvent.keyDown(option, { key: ' ' });
  expect(onSelect).toHaveBeenCalledWith('h1');
});
