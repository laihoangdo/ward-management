import { beforeEach, expect, it, vi } from 'vitest';
import axios from 'axios';
import {
  mapDtoToHousehold,
  mapHouseholdToDto,
  mapResidentDtoToResident,
  mapResidentToDto,
  createHouseholdInBackend,
  fetchPatrolLogsFromBackend,
  savePatrolLogInBackend,
} from './householdApiService';
import type { HouseholdCreateInput } from '../types';
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

it('does not replace a missing relationship, birth year, gender or residence with fabricated facts', () => {
  const resident = mapResidentDtoToResident({ id: 1 });
  expect(resident).toMatchObject({
    birthYear: undefined,
    gender: 'Chưa cập nhật',
    relationship: '',
    residenceType: 'Chưa xác minh',
    idCardNumber: undefined,
  });
  expect(mapResidentToDto(resident)).toMatchObject({
    birthYear: undefined,
    gender: null,
    relationship: '',
    residenceType: 'UNVERIFIED',
    idCardNumber: null,
  });
  expect(
    mapResidentDtoToResident({ id: 2, birthYear: 1976, gender: 'FEMALE', relationship: 'Con', residenceType: 'PERMANENT' }),
  ).toMatchObject({ birthYear: 1976, gender: 'Nữ', relationship: 'Con', residenceType: 'Thường trú' });
});
it('never writes viewport fallback coordinates, a made-up address or an inspection date', () => {
  const household = mapDtoToHousehold({ id: 123, residentsCount: 0 });
  expect(mapHouseholdToDto(household)).toMatchObject({
    latitude: undefined,
    longitude: undefined,
    street: '',
    houseNumber: '',
    notes: '',
    lastCheckedDate: undefined,
    officerInCharge: '',
  });
});
it('does not automatically create a male owner born in 1980 when creating an empty household', async () => {
  vi.mocked(axios.post).mockResolvedValue({ data: { id: 123, hamletId: 28 } });
  await createHouseholdInBackend({ hamletId: 28, ownerName: 'Synthetic owner', coordinates: [10.8, 106.6] } as HouseholdCreateInput);
  expect(axios.post).toHaveBeenCalledOnce();
  expect(vi.mocked(axios.post).mock.calls[0][0]).toBe('/api/households');
});
it('does not manufacture IP, badge, check timestamp or a verified SHA digest for incomplete logs', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: [{ id: 123, details: '{"integrityHash":"SHA256:123...OK"}' }] });
  const [log] = await fetchPatrolLogsFromBackend();
  expect(log).toMatchObject({ timestamp: '', createdAt: 0, officerName: '', officerBadge: '', integrityHash: undefined });
  vi.mocked(axios.post).mockResolvedValue({ data: { id: 123, timestamp: '2026-11-02T00:00:00Z' } });
  await savePatrolLogInBackend({ actionLabel: 'Synthetic action' });
  const payload = vi.mocked(axios.post).mock.calls[0][1] as Record<string, any>;
  expect(payload.ipAddress).toBeUndefined();
  expect(JSON.parse(payload.details).integrityHash).toBeUndefined();
});
