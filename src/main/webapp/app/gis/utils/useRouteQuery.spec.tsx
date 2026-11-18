import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { RECORD_QUERY_KEYS, useRouteQuery } from './useRouteQuery';

afterEach(cleanup);
function Probe() {
  const { params, updateQuery } = useRouteQuery();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="url">{location.pathname + location.search + location.hash}</output>
      <output data-testid="tab">{params.get('tab') || 'overview'}</output>
      <button onClick={() => updateQuery({ tab: 'households', ...RECORD_QUERY_KEYS })}>Menu</button>
      <button
        onClick={() => {
          updateQuery({ household: 'synthetic-id' });
          updateQuery({ edit: 'true' });
        }}
      >
        Edit
      </button>
      <button onClick={() => updateQuery({ ...RECORD_QUERY_KEYS })}>Close</button>
      <button onClick={() => updateQuery({ tab: 'overview' }, true)}>Replace</button>
      <button onClick={() => navigate(-1)}>Back</button>
      <button onClick={() => navigate(1)}>Forward</button>
    </>
  );
}
describe('Router query navigation', () => {
  it('restores direct URLs and merges an action into one history entry', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard?tab=area-map&gisHousehold=123#map']}>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('tab').textContent).toBe('area-map');
    fireEvent.click(screen.getByText('Menu'));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('/dashboard?tab=households#map'));
    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toContain('household=synthetic-id&edit=true'));
    fireEvent.click(screen.getByText('Back'));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('/dashboard?tab=households#map'));
    fireEvent.click(screen.getByText('Back'));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toContain('tab=area-map&gisHousehold=123'));
    fireEvent.click(screen.getByText('Forward'));
    await waitFor(() => expect(screen.getByTestId('tab').textContent).toBe('households'));
  });
  it('removes stale record keys and preserves unrelated parameters when closing', async () => {
    render(
      <MemoryRouter initialEntries={['/gis-dashboard?tab=households&legacyHousehold=123&edit=true&page=3']}>
        <Probe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Close'));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('/gis-dashboard?tab=households&page=3'));
  });
  it('uses replace for normalization, without trapping Back on an invalid route', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard?tab=documents', '/dashboard?tab=invalid']} initialIndex={1}>
        <Probe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Replace'));
    await waitFor(() => expect(screen.getByTestId('tab').textContent).toBe('overview'));
    fireEvent.click(screen.getByText('Back'));
    await waitFor(() => expect(screen.getByTestId('tab').textContent).toBe('documents'));
  });
});
