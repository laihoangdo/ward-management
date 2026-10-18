import axios from 'axios';
import { beforeEach, expect, it, vi } from 'vitest';
import { fetchAuthorizedPages } from './authorizedPages';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
const rows = (page: number, count = 500) => Array.from({ length: count }, (_, index) => page * 500 + index);

it.each([0, 500, 501])('keeps all %i rows without a total header', async total => {
  vi.mocked(axios.get).mockImplementation((_url, config) => {
    const page = config!.params.page;
    return Promise.resolve({ data: rows(page, Math.max(0, Math.min(500, total - page * 500))) });
  });
  const result = await fetchAuthorizedPages<number>('/api/households');
  expect(result.data).toEqual(Array.from({ length: total }, (_, index) => index));
});

it('loads two pages concurrently, preserves order when responses finish out of order, and bounds concurrency', async () => {
  let releaseFirst!: (value: unknown) => void;
  let active = 0;
  let peak = 0;
  const requested: number[] = [];
  vi.mocked(axios.get).mockImplementation((_url, config) => {
    const page = config!.params.page;
    requested.push(page);
    active++;
    peak = Math.max(peak, active);
    const response = { data: rows(page, page === 4 ? 1 : 500), headers: { 'x-total-count': '2001' } };
    const pending = page === 1 ? new Promise(resolve => (releaseFirst = resolve)) : Promise.resolve(response);
    return pending.then(value => {
      active--;
      return value;
    }) as ReturnType<typeof axios.get>;
  });
  const pending = fetchAuthorizedPages<number>('/api/households');
  await vi.waitFor(() => expect(requested).toEqual([0, 1, 2]));
  expect(peak).toBe(2);
  releaseFirst({ data: rows(1) });
  expect((await pending).data).toEqual(Array.from({ length: 2001 }, (_, index) => index));
  expect(requested).toEqual([0, 1, 2, 3, 4]);
  expect(peak).toBe(2);
});

it('rejects the complete load if a parallel page fails', async () => {
  vi.mocked(axios.get).mockImplementation((_url, config) => {
    const page = config!.params.page;
    return page === 2 ? Promise.reject(Error('offline')) : Promise.resolve({ data: rows(page), headers: { 'x-total-count': '1500' } });
  });
  await expect(fetchAuthorizedPages('/api/households')).rejects.toThrow('offline');
});

it('continues beyond an outdated total instead of cutting off new rows', async () => {
  vi.mocked(axios.get).mockImplementation((_url, config) => {
    const page = config!.params.page;
    return Promise.resolve({ data: rows(page, page < 2 ? 500 : 1), headers: { 'x-total-count': '500' } });
  });
  expect((await fetchAuthorizedPages('/api/households')).data).toHaveLength(1001);
});

it('rejects malformed parallel pages', async () => {
  vi.mocked(axios.get).mockImplementation((_url, config) =>
    Promise.resolve({ data: config!.params.page === 2 ? {} : rows(config!.params.page), headers: { 'x-total-count': '1500' } }),
  );
  await expect(fetchAuthorizedPages('/api/households')).rejects.toThrow();
});
