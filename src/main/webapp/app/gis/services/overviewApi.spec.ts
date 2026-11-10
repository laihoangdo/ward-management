import axios from 'axios';
import { beforeEach, expect, it, vi } from 'vitest';
import { fetchOverviewSummary } from './overviewApi';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
const payload = {
  total: 1,
  business: 0,
  warnings: 0,
  residents: 3,
  male: 1,
  female: 2,
  under18: 0,
  above18: 3,
  hamlets: ['Area'],
  warningPage: 0,
  scope: { total: 4, residents: 12, warnings: 1 },
  warningItems: [],
  attentionItems: [],
  previewItems: [{ id: 1, ownerName: 'Owner' }],
};
it('fetches one bounded summary with cancellation and maps previews without loading resident lists', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: payload });
  const signal = new AbortController().signal;
  const result = await fetchOverviewSummary('Owner', 0, 10, signal);
  expect(axios.get).toHaveBeenCalledExactlyOnceWith('/api/gis/households/overview', {
    params: { search: 'Owner', warningPage: 0, warningSize: 10 },
    signal,
  });
  expect(result.previewItems[0]).toMatchObject({ id: '1', ownerName: 'Owner', residentsList: [] });
});
it.each([null, {}, { ...payload, total: '1' }, { ...payload, warningItems: {} }])('rejects malformed summaries', async data => {
  vi.mocked(axios.get).mockResolvedValue({ data });
  await expect(fetchOverviewSummary('', 0, 10, new AbortController().signal)).rejects.toThrow();
});
