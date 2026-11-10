import fixtures from '../../../../../test/resources/fixtures/overview-demographics.json';
import { expect, it } from 'vitest';
import { mapDtoToHousehold } from './householdApiService';

it('preserves recorded aggregate counts without guessing from names, house numbers or year', () => {
  for (const { household, expected } of fixtures) {
    const record = mapDtoToHousehold(household);
    expect([record.residentsCount, record.maleCount, record.femaleCount, record.under18Count], JSON.stringify(household)).toEqual(expected);
  }
});
