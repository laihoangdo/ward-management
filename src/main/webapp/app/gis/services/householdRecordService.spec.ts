import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkBackendHealth, updateHouseholdRecord } from './householdRecordService';
import { updateHouseholdInBackend } from './householdApiService';
import type { HouseholdFacility } from '../types';

vi.mock('./householdApiService', () => ({
  createHouseholdInBackend: vi.fn(),
  updateHouseholdInBackend: vi.fn(),
  updateHouseholdNotesInBackend: vi.fn(),
  updateHouseholdCoordinatesInBackend: vi.fn(),
  savePatrolLogInBackend: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Backend health', () => {
  // Production closes /management/*, so reachability comes from /api/authenticate (204 signed in, 401 session ended).
  it.each([
    [204, 'ok'],
    [401, 'ok'],
    [404, 'offline'],
    [502, 'offline'],
    [503, 'offline'],
  ])('reports HTTP %s as %s', async (code, status) => {
    const fetchMock = vi.fn().mockResolvedValue({ status: code });
    vi.stubGlobal('fetch', fetchMock);
    expect((await checkBackendHealth()).status).toBe(status);
    expect(fetchMock).toHaveBeenCalledWith('/api/authenticate', expect.objectContaining({ cache: 'no-store' }));
  });
  it('reports network errors as offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await checkBackendHealth()).status).toBe('offline');
  });
});

describe('OCR updates', () => {
  const household = {
    id: '12',
    code: 'H12',
    houseNumber: '27',
    street: 'Đường A',
    hamlet: 'Ấp B',
    ownerName: 'Cũ',
    coordinates: [10.8, 106.6],
  } as HouseholdFacility;
  it('preserves existing fields when updating the owner and uses the saved result', async () => {
    vi.mocked(updateHouseholdInBackend).mockResolvedValue({ ...household, ownerName: 'Mới' });
    const saved = await updateHouseholdRecord('12', { ownerName: 'Mới' }, household);
    expect(updateHouseholdInBackend).toHaveBeenCalledWith({ ...household, ownerName: 'Mới' });
    expect(saved.street).toBe('Đường A');
  });
  it('propagates server failure to the review dialog', async () => {
    vi.mocked(updateHouseholdInBackend).mockRejectedValue(new Error('save failed'));
    await expect(updateHouseholdRecord('12', { ownerName: 'Mới' }, household)).rejects.toThrow('save failed');
  });
});
