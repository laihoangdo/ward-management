import { describe, it, expect } from 'vitest';
import { matchesHouseholdSearch } from './householdSearch';
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
});
