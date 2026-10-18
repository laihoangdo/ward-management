import fixtures from '../../../../../test/resources/fixtures/overview-demographics.json';
import { expect, it } from 'vitest';
import { mapDtoToHousehold } from './householdApiService';
import { getEffectiveResidentsList } from '../utils/residentRosterUtils';

it('keeps server compatibility fixtures aligned with the existing frontend demographic calculation', () => {
  for (const { household, year, expected } of fixtures) {
    const residents = getEffectiveResidentsList(mapDtoToHousehold(household));
    expect(
      [
        residents.length,
        residents.filter(r => r.gender === 'Nam').length,
        residents.filter(r => r.gender === 'Nữ').length,
        residents.filter(r => year - r.birthYear < 18).length,
      ],
      JSON.stringify(household),
    ).toEqual(expected);
  }
});
