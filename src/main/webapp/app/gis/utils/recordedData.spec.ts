import { describe, expect, it } from 'vitest';
import type { HouseholdFacility } from '../types';
import { getEffectiveResidentsList, residentAge } from './residentRosterUtils';
import { normalizeHousehold, normalizeHouseholdList } from './householdUtils';
import { getHouseholdResidenceType } from './residenceUtils';

describe('Recorded data only', () => {
  it('never creates named residents or identity numbers from aggregate counts or owner name', () => {
    const household = { id: '123', ownerName: 'Synthetic owner', residentsCount: 7, maleCount: 3, femaleCount: 4 } as HouseholdFacility;
    expect(getEffectiveResidentsList(household)).toEqual([]);
    expect(getEffectiveResidentsList({ ...household, residentsList: [] })).toEqual([]);
    expect(getHouseholdResidenceType(household)).toBe('Chưa xác minh');
    expect(getHouseholdResidenceType({ ...household, notes: 'khách sạn thuê trọ' })).toBe('Chưa xác minh');
  });
  it('preserves recorded zero counts and blanks, without inventing address, check date or officer', () => {
    const result = normalizeHousehold({ id: 123, residentsCount: 0, maleCount: 0, femaleCount: 0, under18Count: 0, above18Count: 0 });
    expect(result).toMatchObject({
      residentsCount: 0,
      maleCount: 0,
      femaleCount: 0,
      under18Count: 0,
      above18Count: 0,
      houseNumber: '',
      street: '',
      hamlet: '',
      neighborhoodGroup: '',
      alley: '',
      lastCheckedDate: '',
      notes: '',
      officerInCharge: '',
      coordinatesEstimated: true,
    });
    expect(normalizeHouseholdList([null, { id: 123 }])).toHaveLength(1);
    expect(() => normalizeHousehold(null)).toThrow();
  });
  it('does not count an unknown birth year as a child or adult', () => {
    expect(residentAge({})).toBeNaN();
    expect(residentAge({ birthYear: 2000 }, 2026)).toBe(26);
    expect([{ birthYear: undefined }].filter(r => residentAge(r) < 18)).toHaveLength(0);
    expect([{ birthYear: undefined }].filter(r => residentAge(r) >= 18)).toHaveLength(0);
  });
});
