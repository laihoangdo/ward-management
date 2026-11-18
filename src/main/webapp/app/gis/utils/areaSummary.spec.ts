import { describe, it, expect } from 'vitest';
import { areaSummary } from './areaSummary';
import { FieldHouse } from './fieldHouseGeometry';
import { HouseholdFacility } from '../types';

const square = (id: string, lng: number, lat: number): FieldHouse => ({
  type: 'Feature',
  id,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [lng, lat],
        [lng + 0.0001, lat],
        [lng + 0.0001, lat + 0.0001],
        [lng, lat + 0.0001],
        [lng, lat],
      ],
    ],
  },
  properties: { buildingId: id, height: 7 },
});
const household = (id: string, values: Partial<HouseholdFacility> = {}) =>
  ({ id, status: 'normal', residentsCount: 3, coordinates: [10.5, 106.5], ...values }) as HouseholdFacility;

describe('Area summary', () => {
  const area = [
    [106.6, 10.8],
    [106.61, 10.8],
    [106.61, 10.81],
    [106.6, 10.81],
  ];
  const houses = [square('inside', 106.605, 10.805), square('empty', 106.606, 10.806), square('outside', 106.62, 10.805)];
  const indexed = new Map([
    ['inside', [household('a', { status: 'alert', residentsCount: 4 }), household('b')]],
    ['outside', [household('c')]],
  ]);

  it('counts buildings by their centre and the households linked to them', () => {
    const summary = areaSummary(area, houses, indexed);
    expect(summary.buildingIds).toEqual(['inside', 'empty']);
    expect(summary.occupiedBuildings).toBe(1);
    expect(summary.households.map(item => item.id)).toEqual(['a', 'b']);
    expect(summary.residents).toBe(7);
    expect(summary.byStatus).toEqual({ normal: 1, warning: 0, alert: 1, business: 0, unverified: 0 });
  });

  it('adds household points without a building once, and only when they lie inside', () => {
    const loose = [
      household('p', { coordinates: [10.802, 106.602], status: 'warning' }),
      household('q', { coordinates: [10.9, 106.602] }),
      household('a', { coordinates: [10.802, 106.602] }),
    ];
    const summary = areaSummary(area, houses, indexed, loose);
    expect(summary.households.map(item => item.id)).toEqual(['a', 'b', 'p']);
    expect(summary.looseHouseholds).toBe(1);
    expect(summary.byStatus.warning).toBe(1);
  });

  it('needs at least three vertices', () => {
    expect(areaSummary(area.slice(0, 2), houses, indexed).buildingIds).toEqual([]);
  });
});
