import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ServerOverviewTab } from './ServerOverviewTab';
import { fetchOverviewSummary, OverviewSummary } from '../services/overviewApi';
import { loadHouseholdDetail } from '../services/householdBrowse';
import { mapDtoToHousehold } from '../services/householdApiService';

vi.mock('../services/overviewApi', () => ({ fetchOverviewSummary: vi.fn() }));
vi.mock('../services/householdBrowse', () => ({ loadHouseholdDetail: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const household = mapDtoToHousehold({ id: 1, ownerName: 'Owner', houseNumber: '1', street: 'Street', status: 'WARNING' });
const summary: OverviewSummary = {
  total: 501,
  business: 41,
  warnings: 21,
  residents: 1500,
  female: 700,
  male: 800,
  under18: 300,
  above18: 1200,
  fallbackHouseholds: 0,
  hamlets: ['Area'],
  scope: { total: 600, residents: 1800, warnings: 30 },
  warningPage: 0,
  warningItems: [household],
  attentionItems: [household],
  previewItems: [household],
};
const props = () => ({
  search: '',
  refreshKey: 0,
  onScopeLoaded: vi.fn(),
  onNavigateTab: vi.fn(),
  canNavigate: () => true,
  onOpenExpiringDocuments: vi.fn(),
  onSelectHousehold: vi.fn(),
});

it('renders full-scope metrics instead of counting bounded previews, and requests warning pages on the server', async () => {
  vi.mocked(fetchOverviewSummary).mockImplementation((_search, page) => Promise.resolve({ ...summary, warningPage: page }));
  const callbacks = props();
  const { container } = render(<ServerOverviewTab {...callbacks} />);
  await waitFor(() => expect(container.querySelector('#stat-total-value')?.textContent).toBe('501'));
  expect(container.querySelector('#stat-population-value')?.textContent).toBe((1500).toLocaleString('vi-VN'));
  expect(callbacks.onScopeLoaded).toHaveBeenCalledWith(summary.scope);
  fireEvent.click(screen.getByTitle('Trang tiếp theo'));
  await waitFor(() => expect(fetchOverviewSummary).toHaveBeenLastCalledWith('', 1, 10, expect.any(AbortSignal)));
  expect(screen.getAllByText(/Owner/).length).toBeGreaterThan(0);
});

it('loads the full household before opening details and keeps previous metrics visible on refresh failure', async () => {
  vi.mocked(fetchOverviewSummary).mockResolvedValue(summary);
  const complete = { ...household, residentsList: [{ id: 'R1', fullName: 'Resident' }] } as typeof household;
  vi.mocked(loadHouseholdDetail).mockResolvedValue(complete);
  const callbacks = props();
  const { rerender, container } = render(<ServerOverviewTab {...callbacks} />);
  fireEvent.click(await screen.findByTitle('1 Street - Owner'));
  await waitFor(() => expect(callbacks.onSelectHousehold).toHaveBeenCalledWith(complete));
  vi.mocked(fetchOverviewSummary).mockRejectedValue(Error('offline'));
  rerender(<ServerOverviewTab {...callbacks} refreshKey={1} />);
  expect((await screen.findByRole('alert')).textContent).toContain('Chưa tải được tổng quan');
  expect(container.querySelector('#stat-total-value')?.textContent).toBe('501');
});

it('cancels old searches and ignores late responses', async () => {
  let resolve!: (value: OverviewSummary) => void;
  vi.mocked(fetchOverviewSummary).mockImplementation(search =>
    search
      ? Promise.resolve({ ...summary, total: 3 })
      : new Promise(done => {
          resolve = done;
        }),
  );
  const callbacks = props();
  const { rerender, container } = render(<ServerOverviewTab {...callbacks} />);
  await waitFor(() => expect(fetchOverviewSummary).toHaveBeenCalledOnce());
  const signal = vi.mocked(fetchOverviewSummary).mock.calls[0][3];
  rerender(<ServerOverviewTab {...callbacks} search="query" />);
  expect(signal.aborted).toBe(true);
  await waitFor(() => expect(container.querySelector('#stat-total-value')?.textContent).toBe('3'));
  resolve(summary);
  await waitFor(() => expect(container.querySelector('#stat-total-value')?.textContent).toBe('3'));
});
