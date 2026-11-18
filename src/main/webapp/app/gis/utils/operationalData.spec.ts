import { describe, it, expect, vi } from 'vitest';
import { loadOperationalData } from './operationalData';
import {
  fetchCompleteHouseholdsFromBackend,
  fetchAllDocumentRecords,
  fetchPatrolLogsFromBackend,
  fetchSecurityAlertsFromBackend,
} from '../services/householdApiService';

vi.mock('../services/householdApiService', () => ({
  fetchCompleteHouseholdsFromBackend: vi.fn(),
  fetchAllDocumentRecords: vi.fn(),
  fetchPatrolLogsFromBackend: vi.fn(),
  fetchSecurityAlertsFromBackend: vi.fn(),
}));

describe('Operational data loading', () => {
  it('retains independent successes and identifies a failed dataset', async () => {
    vi.mocked(fetchCompleteHouseholdsFromBackend).mockResolvedValue([]);
    vi.mocked(fetchAllDocumentRecords).mockRejectedValue(new Error('Unavailable'));
    vi.mocked(fetchPatrolLogsFromBackend).mockResolvedValue([]);
    vi.mocked(fetchSecurityAlertsFromBackend).mockResolvedValue([]);
    const results = await loadOperationalData();
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
    expect(results[0]).toEqual({ status: 'fulfilled', value: [] });
  });
});
