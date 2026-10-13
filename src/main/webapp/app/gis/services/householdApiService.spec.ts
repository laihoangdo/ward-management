import { describe, expect, it } from 'vitest';
import { mapDtoToHousehold, mapHouseholdToDto } from './householdApiService';

it('does not manufacture telephone, territory or demographic values for unknown input', () => {
  const dto = mapHouseholdToDto({ ownerName: 'Owner', houseNumber: '1', street: 'Main', hamlet: 'Area' });
  expect(dto.ownerPhone).toBe('');
  expect(dto.neighborhoodGroup).toBe('');
  expect(dto.alley).toBe('');
  expect(dto.residentsCount).toBeNull();
  expect(dto.maleCount).toBeNull();
});

it('preserves the native hamlet ID when GIS households are read and saved', () => {
  const household = mapDtoToHousehold({ id: 123, hamletId: 37, hamlet: 'Official hamlet' });
  expect(household.hamletId).toBe(37);
  expect(mapHouseholdToDto(household).hamletId).toBe(37);
});

describe('household security status contract for GIS views', () => {
  it.each(['DANGER', 'CRITICAL'] as const)('maps backend %s to the GIS alert state', status => {
    const household = mapDtoToHousehold({ id: 123, status });
    expect(household.status).toBe('alert');
    expect(mapHouseholdToDto(household).status).toBe('CRITICAL');
  });

  it('keeps warning and normal distinct from critical alerts', () => {
    expect(mapDtoToHousehold({ id: 123, status: 'WARNING' }).status).toBe('warning');
    expect(mapDtoToHousehold({ id: 124, status: 'NORMAL' }).status).toBe('normal');
    expect(mapHouseholdToDto({ status: 'warning' }).status).toBe('WARNING');
    expect(mapHouseholdToDto({ status: 'normal' }).status).toBe('NORMAL');
  });
});
