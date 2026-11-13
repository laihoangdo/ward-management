import { describe, it, expect } from 'vitest';
import { parseCheckedDate, recencyBucket, residentBucket, themeColor, OCCUPANCY_SCALE, RESIDENT_SCALE } from './buildingTheme';
import { HouseholdFacility } from '../types';

const household = (values: Partial<HouseholdFacility>) => values as HouseholdFacility;
const now = Date.UTC(2026, 10, 13);

describe('Building colour themes', () => {
  it('reads Vietnamese and ISO dates and rejects everything else', () => {
    expect(parseCheckedDate('13/11/2026')).toBe(now);
    expect(parseCheckedDate('2026-11-13T08:00:00Z')).toBe(now);
    expect(parseCheckedDate('31/02/2026')).toBeNaN();
    expect(parseCheckedDate('hôm qua')).toBeNaN();
    expect(parseCheckedDate(undefined)).toBeNaN();
  });

  it('buckets a building by its total residents', () => {
    expect(residentBucket([])).toBe(-1);
    expect(residentBucket([household({ residentsCount: 2 })])).toBe(0);
    expect(residentBucket([household({ residentsCount: 3 }), household({ residentsCount: 4 })])).toBe(2);
    expect(residentBucket([household({ residentsCount: 40 })])).toBe(4);
  });

  it('ranks a building by its least recently checked household', () => {
    expect(recencyBucket([], now)).toBe(-1);
    expect(recencyBucket([household({ lastCheckedDate: '01/10/2026' })], now)).toBe(0);
    expect(recencyBucket([household({ lastCheckedDate: '01/10/2026' }), household({ lastCheckedDate: '2026-02-01' })], now)).toBe(1);
    expect(recencyBucket([household({ lastCheckedDate: '01/01/2024' })], now)).toBe(2);
    expect(recencyBucket([household({ lastCheckedDate: '01/10/2026' }), household({ lastCheckedDate: '' })], now)).toBe(3);
  });

  it('keeps an empty building on its own appearance except in the occupancy theme', () => {
    expect(themeColor('residents', [], now)).toBeUndefined();
    expect(themeColor('recency', [], now)).toBeUndefined();
    expect(themeColor('occupancy', [], now)).toBe(OCCUPANCY_SCALE[1].color);
    expect(themeColor('residents', [household({ residentsCount: 5 })], now)).toBe(RESIDENT_SCALE[2].color);
  });
});
