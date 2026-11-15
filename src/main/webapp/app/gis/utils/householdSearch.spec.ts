import { describe, it, expect } from 'vitest';
import { matchesHouseholdSearch, parseCoordinateQuery } from './householdSearch';
import { HouseholdFacility } from '../types';

describe('Shared household lookup', () => {
  const household = {
    ownerName: 'Nguyễn Văn Đạt',
    status: 'warning',
    residentsList: [{ fullName: 'Trần Thị Hương' }],
  } as HouseholdFacility;
  it('matches Vietnamese names with or without accents and surrounding spaces', () => {
    expect(matchesHouseholdSearch(household, '  nguyen van dat  ')).toBe(true);
    expect(matchesHouseholdSearch(household, 'trần thị hương')).toBe(true);
    expect(matchesHouseholdSearch(household, 'tran thi huong')).toBe(true);
    expect(matchesHouseholdSearch(household, 'canh bao')).toBe(true);
    expect(matchesHouseholdSearch(household, 'No matching owner')).toBe(false);
  });

  it('matches a house number typed together with the street', () => {
    const home = { houseNumber: '12', street: 'Đường số 3' } as HouseholdFacility;
    expect(matchesHouseholdSearch(home, '12 duong so 3')).toBe(true);
    expect(matchesHouseholdSearch(home, '14 duong so 3')).toBe(false);
    const raw = { street: '144/2, Ấp 61, Xã Bà Điểm' } as HouseholdFacility;
    expect(matchesHouseholdSearch(raw, '144/2 ấp 61')).toBe(true);
  });

  it('reads lat, lng coordinates and swaps a pasted lng, lat pair', () => {
    expect(parseCoordinateQuery('10.8541, 106.6123')).toEqual([106.6123, 10.8541]);
    expect(parseCoordinateQuery('106.6123 10.8541')).toEqual([106.6123, 10.8541]);
    expect(parseCoordinateQuery('10.85;106.61')).toEqual([106.61, 10.85]);
    expect(parseCoordinateQuery('12 3')).toBeNull();
    expect(parseCoordinateQuery('Nguyễn 10.5')).toBeNull();
    expect(parseCoordinateQuery('95.1, 200.2')).toBeNull();
  });
});
