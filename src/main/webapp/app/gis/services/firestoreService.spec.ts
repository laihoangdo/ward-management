import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkBackendHealth, updateHouseholdDataInFirestore } from './firestoreService';
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
  it.each([
    [true, { status: 'UP' }, 'ok'],
    [true, { status: 'DOWN' }, 'offline'],
    [false, { status: 'DOWN' }, 'offline'],
  ])('reports HTTP ok=%s, body=%o as %s', async (ok, body, status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => body }));
    expect((await checkBackendHealth()).status).toBe(status);
  });
  it('reports network errors and non-JSON responses as offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await checkBackendHealth()).status).toBe('offline');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('HTML');
        },
      }),
    );
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
    const saved = await updateHouseholdDataInFirestore('12', { ownerName: 'Mới' }, household);
    expect(updateHouseholdInBackend).toHaveBeenCalledWith({ ...household, ownerName: 'Mới' });
    expect(saved.street).toBe('Đường A');
  });
  it('propagates server failure to the review dialog', async () => {
    vi.mocked(updateHouseholdInBackend).mockRejectedValue(new Error('save failed'));
    await expect(updateHouseholdDataInFirestore('12', { ownerName: 'Mới' }, household)).rejects.toThrow('save failed');
  });
});
