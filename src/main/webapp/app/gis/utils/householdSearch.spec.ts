import { describe, it, expect } from 'vitest';
import { matchesHouseholdSearch, matchesWords, parseCoordinateQuery } from './householdSearch';
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

  it('matches every word of the full address in any order, and only when every word is there', () => {
    const roster = {
      rawAddress: 'Số 26/3 Hẻm 12 Tiền Lân, Ấp Tiền Lân 4',
      street: 'Số 26/3 Hẻm 12 Tiền Lân, Ấp Tiền Lân 4',
    } as HouseholdFacility;
    expect(matchesHouseholdSearch(roster, '26/3 ấp tiền lân 4')).toBe(true);
    expect(matchesHouseholdSearch(roster, 'tien lan 4, 26/3')).toBe(true);
    expect(matchesHouseholdSearch(roster, '26/3 trung chanh')).toBe(false);
    // A member's name together with an address word.
    const family = { rawAddress: 'Số 8 Hẻm 3, Ấp Trung Chánh 2', residentsList: [{ fullName: 'Trần Thị Bình' }] } as HouseholdFacility;
    expect(matchesHouseholdSearch(family, 'binh trung chanh')).toBe(true);
  });

  it('applies one rule to every search box: each word, any order, accents and case ignored', () => {
    const fields = ['Nguyễn Văn Đạt', 'Công an phụ trách ấp', 'CA-123'];
    expect(matchesWords('nguyen dat', fields)).toBe(true);
    expect(matchesWords('ca-123 NGUYỄN', fields)).toBe(true);
    expect(matchesWords('nguyen binh', fields)).toBe(false);
    expect(matchesWords('   ', fields)).toBe(true);
    expect(matchesWords('dat', [undefined, null, ''])).toBe(false);
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
