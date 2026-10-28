import { describe, expect, it } from 'vitest';
import { FieldHouse, houseBounds, indexHouseholds, moveHouse, validateDraft } from './fieldHouseGeometry';
import { HouseholdFacility } from '../types';
const square = [
  [106, 10],
  [106.001, 10],
  [106.001, 10.001],
  [106, 10.001],
  [106, 10],
];
const house = (id: string): FieldHouse => ({
  type: 'Feature',
  id,
  properties: { buildingId: id, height: 7 },
  geometry: { type: 'Polygon', coordinates: [square] },
});
const household = (id: string, coordinates: [number, number], estimated = false) =>
  ({ id, coordinates, coordinatesEstimated: estimated, status: 'normal' }) as HouseholdFacility;
describe('field map geometry', () => {
  it('never infers building links from TC2 random coordinates even if the estimated flag is missing', () => {
    const temporary = { ...household('temp', [10.0005, 106.0005]), coordinateMethod: 'RANDOM_WITHIN_TC2' };
    expect(indexHouseholds([house('a')], [temporary]).size).toBe(0);
  });

  it('moves all polygon rings and retains shape, closure and metadata', () => {
    const original = house('a');
    original.properties.householdIds = ['1'];
    original.geometry = {
      type: 'Polygon',
      coordinates: [
        square,
        [
          [106.0002, 10.0002],
          [106.0003, 10.0002],
          [106.0003, 10.0003],
          [106.0002, 10.0002],
        ],
      ],
    };
    const moved = moveHouse(original, 107, 11);
    const bounds = houseBounds(moved);
    expect((bounds[0] + bounds[2]) / 2).toBeCloseTo(107, 7);
    expect((bounds[1] + bounds[3]) / 2).toBeCloseTo(11, 7);
    expect(moved.geometry.coordinates).toHaveLength(2);
    expect(moved.properties.householdIds).toEqual(['1']);
    expect(original.geometry.coordinates[0][0]).toEqual([106, 10]);
    expect(moved.geometry.coordinates[0][0]).toEqual(moved.geometry.coordinates[0].at(-1));
  });
  it('preserves multipolygon components and rejects invalid destination', () => {
    const original = house('a');
    original.geometry = { type: 'MultiPolygon', coordinates: [[square], [square]] };
    expect(moveHouse(original, 107, 11).geometry.coordinates).toHaveLength(2);
    expect(() => moveHouse(original, NaN, 11)).toThrow();
    expect(() => moveHouse(original, 181, 11)).toThrow();
  });
  it('rejects incomplete, zero-area, repeated and intersecting footprints', () => {
    expect(
      validateDraft([
        [0, 0],
        [1, 1],
      ]),
    ).toBeTruthy();
    expect(
      validateDraft([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
    ).toBeTruthy();
    expect(
      validateDraft([
        [0, 0],
        [0, 0],
        [1, 1],
      ]),
    ).toBeTruthy();
    expect(
      validateDraft([
        [0, 0],
        [1, 1],
        [0, 1],
        [1, 0],
      ]),
    ).toBeTruthy();
    expect(validateDraft(square.slice(0, -1))).toBeNull();
  });
  it('matches real locations, excludes estimates, and keeps explicit links after a move', () => {
    const a = house('a');
    const b = moveHouse(house('b'), 107, 11);
    b.properties.householdIds = ['1', '3'];
    const result = indexHouseholds(
      [a, b],
      [
        household('1', [10.0005, 106.0005]),
        household('2', [10.0005, 106.0005], true),
        household('3', [0, 0], true),
        household('4', [10.0005, 106.0005]),
      ],
    );
    expect(result.get('a')?.map(h => h.id)).toEqual(['4']);
    expect(result.get('b')?.map(h => h.id)).toEqual(['1', '3']);
  });
});
