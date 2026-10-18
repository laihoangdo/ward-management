import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import {
  fetchAllResidents,
  fetchAllDocumentRecords,
  fetchPatrolLogsFromBackend,
  fetchSecurityAlertsFromBackend,
} from './householdApiService';
import { loadOperationalData } from '../utils/operationalData';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

it('preserves a successful resident response', async () => {
  const resident = { id: 11, fullName: 'Test resident' };
  vi.mocked(axios.get).mockResolvedValue({ data: [resident] });
  await expect(fetchAllResidents()).resolves.toEqual([resident]);
});

it('preserves document mapping on a successful response', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: [{ id: 12, docName: 'Test document', status: 'EXPIRED' }] });
  await expect(fetchAllDocumentRecords()).resolves.toEqual([
    expect.objectContaining({ id: '12', title: 'Test document', status: 'expired' }),
  ]);
});

it('preserves server log identity and before/after metadata', async () => {
  vi.mocked(axios.get).mockResolvedValue({
    data: [
      {
        id: 13,
        officerName: 'Test officer',
        timestamp: '2026-10-18T00:00:00Z',
        details: JSON.stringify({ actionType: 'map_3d', previousValue: 'before', newValue: 'after' }),
      },
    ],
  });
  await expect(fetchPatrolLogsFromBackend()).resolves.toEqual([
    expect.objectContaining({
      id: 'LOG-DB-13',
      officerName: 'Test officer',
      actionType: 'map_3d',
      previousValue: 'before',
      newValue: 'after',
    }),
  ]);
});

it('preserves alert mapping on a successful response', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: [{ id: 14, title: 'Test alert', severity: 'HIGH', isResolved: true }] });
  await expect(fetchSecurityAlertsFromBackend()).resolves.toEqual([
    expect.objectContaining({ id: 'ALERT-DB-14', title: 'Test alert', severity: 'high', resolved: true }),
  ]);
});

const readers = [
  ['residents', fetchAllResidents],
  ['documents', fetchAllDocumentRecords],
  ['logs', fetchPatrolLogsFromBackend],
  ['alerts', fetchSecurityAlertsFromBackend],
] as const;

describe.each(readers)('%s loading contract', (_name, read) => {
  it('accepts an empty successful list', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    await expect(read()).resolves.toEqual([]);
  });
  it.each(['network', '403', '500'])('propagates %s failure without turning it into an empty list', async reason => {
    const error = new Error(reason);
    vi.mocked(axios.get).mockRejectedValue(error);
    await expect(read()).rejects.toBe(error);
  });
  it('rejects a malformed successful payload', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { message: 'not a list' } });
    await expect(read()).rejects.toThrow();
  });
});

it('reports failed logs/alerts independently through the real operational loader', async () => {
  vi.mocked(axios.get).mockImplementation(url => {
    if (String(url).includes('/patrol-logs') || String(url).includes('/security-alerts')) return Promise.reject(Error('offline'));
    return Promise.resolve({ data: [] });
  });
  const results = await loadOperationalData();
  expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled', 'rejected', 'rejected']);
});

it('keeps a document page failure from returning a partial successful dataset', async () => {
  const error = new Error('page 2 offline');
  vi.mocked(axios.get)
    .mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, id) => ({ id: id + 1 })) })
    .mockRejectedValueOnce(error);
  await expect(fetchAllDocumentRecords()).rejects.toBe(error);
  expect(axios.get).toHaveBeenNthCalledWith(2, '/api/document-records', { params: { page: 1, size: 500, sort: 'id,asc' } });
});
