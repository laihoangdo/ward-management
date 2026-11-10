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

it('keeps the real street apart from the display address and carries the legacy hamlet read-only', () => {
  const fromRoster = mapDtoToHousehold({ id: 1, rawAddress: '12/3A ấp 62, xã Bà Điểm', legacyHamlet: ' 62 ' });
  expect(fromRoster.street).toBe('12/3A ấp 62, xã Bà Điểm');
  expect(fromRoster.streetName).toBeUndefined();
  expect(fromRoster.legacyHamlet).toBe('62');
  expect(mapHouseholdToDto(fromRoster)).not.toHaveProperty('legacyHamlet');

  const manual = mapDtoToHousehold({ id: 2, street: ' Lê Quang Đạo ' });
  expect(manual.streetName).toBe('Lê Quang Đạo');
  expect(manual.legacyHamlet).toBeUndefined();
});

describe('street write-back for households whose street is not split from the source address', () => {
  const roster = () => mapDtoToHousehold({ id: 7, rawAddress: '12/3A ấp 62, xã Bà Điểm' });

  it('omits street so the merge-patch keeps the column instead of storing the raw address', () => {
    const dto = mapHouseholdToDto({ ...roster(), notes: 'Đã kiểm tra' });
    expect(dto.street).toBeUndefined();
    expect(JSON.parse(JSON.stringify(dto))).not.toHaveProperty('street');
  });

  it('sends a street the user actually chose, and keeps normal households unchanged', () => {
    expect(mapHouseholdToDto({ ...roster(), street: 'Lê Quang Đạo' }).street).toBe('Lê Quang Đạo');
    expect(mapHouseholdToDto(mapDtoToHousehold({ id: 8, street: 'Main', rawAddress: 'raw' })).street).toBe('Main');
    expect(mapHouseholdToDto({ street: 'New road', houseNumber: '1' }).street).toBe('New road');
    expect(mapHouseholdToDto({ houseNumber: '1' }).street).toBe('');
  });
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
