import { describe, expect, it } from 'vitest';
import { containsHousePoint } from './houseFootprints';
const outer = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
];
const hole = [
  [3, 3],
  [7, 3],
  [7, 7],
  [3, 7],
  [3, 3],
];
describe('house footprint matching', () => {
  it('excludes outside points and holes', () => {
    const geometry: GeoJSON.Polygon = { type: 'Polygon', coordinates: [outer, hole] };
    expect(containsHousePoint(geometry, [1, 1])).toBe(true);
    expect(containsHousePoint(geometry, [5, 5])).toBe(false);
    expect(containsHousePoint(geometry, [11, 5])).toBe(false);
  });
  it('matches any part of a multipolygon using longitude first', () => {
    const geometry: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [outer],
        [
          [
            [100, 20],
            [101, 20],
            [101, 21],
            [100, 21],
            [100, 20],
          ],
        ],
      ],
    };
    expect(containsHousePoint(geometry, [100.5, 20.5])).toBe(true);
    expect(containsHousePoint(geometry, [20.5, 100.5])).toBe(false);
  });
});
