import React from 'react';
import axios from 'axios';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AdministrativeDirectory } from './AdministrativeDirectory';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('loads children by DB parent IDs and clears selection when the province changes', async () => {
  vi.mocked(axios.get).mockImplementation(async url => ({
    data: String(url).endsWith('/provinces')
      ? [{ id: 9, fullName: 'DB province' }]
      : String(url).includes('/communes')
        ? [{ id: 23, fullName: 'DB commune' }]
        : [{ id: 47, fullName: 'DB hamlet' }],
  }));
  render(<AdministrativeDirectory />);
  await screen.findByRole('option', { name: 'DB province' });
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '9' } });
  await screen.findByRole('option', { name: 'DB commune' });
  expect(axios.get).toHaveBeenCalledWith('/api/administrative-units/communes?provinceId=9');
  fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '23' } });
  await screen.findByRole('option', { name: 'DB hamlet' });
  expect(axios.get).toHaveBeenCalledWith('/api/administrative-units/hamlets?communeId=23');
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '' } });
  await waitFor(() => expect(screen.queryByRole('option', { name: 'DB hamlet' })).toBeNull());
});
