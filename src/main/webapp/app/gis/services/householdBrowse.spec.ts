import { beforeEach, expect, it, vi } from 'vitest';
import axios from 'axios';
import { browseHouseholds, loadHouseholdDetail } from './householdBrowse';
vi.mock('axios', () => ({ default: { get: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
it('passes bounded page, server filters and cancellation without downloading all residents', async () => {
  vi.mocked(axios.get).mockResolvedValue({
    data: {
      items: [{ household: { id: 501 }, residence: 'temporary' }],
      page: 1,
      total: 501,
      scopeTotal: 501,
      hamlets: {},
      residenceCounts: {},
    },
  });
  const signal = new AbortController().signal;
  const result = await browseHouseholds({ page: 1, size: 12, search: 'name', hamlet: 'all', type: 'all', residence: 'Tạm trú' }, signal);
  expect(result.items[0].residenceType).toBe('Tạm trú');
  expect(axios.get).toHaveBeenCalledOnce();
  expect(axios.get).toHaveBeenCalledWith('/api/gis/households/browse', {
    params: { page: 1, size: 12, search: 'name', hamlet: 'all', type: 'all', residence: 'temporary' },
    signal,
  });
});
it('loads the full roster for one household before editing', async () => {
  vi.mocked(axios.get)
    .mockResolvedValueOnce({ data: { id: 1, hamletId: 28 } })
    .mockResolvedValueOnce({ data: [{ id: 2, fullName: 'Resident', gender: 'FEMALE' }] });
  const result = await loadHouseholdDetail('1', new AbortController().signal);
  expect(result.hamletId).toBe(28);
  expect(result.residentsList.map(r => r.id)).toEqual(['2']);
  expect(result.residentsCount).toBe(1);
});
