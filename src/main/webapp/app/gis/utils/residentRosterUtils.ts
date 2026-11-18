import type { HouseholdFacility, Resident } from '../types';

/** Only return recorded residents. Aggregate counts never identify a person. */
export function getEffectiveResidentsList(household: HouseholdFacility): Resident[] {
  return Array.isArray(household.residentsList) ? household.residentsList : [];
}

/** NaN deliberately fails age-bracket comparisons for an unknown birth year. */
export function residentAge(resident: Pick<Resident, 'birthYear'>, year = new Date().getFullYear()): number {
  return typeof resident.birthYear === 'number' && Number.isFinite(resident.birthYear) ? year - resident.birthYear : NaN;
}
