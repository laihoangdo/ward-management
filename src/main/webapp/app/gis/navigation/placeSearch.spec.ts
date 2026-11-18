import { describe, expect, it } from 'vitest';
import { HouseholdFacility } from '../types';
import { buildRoadGraph, RoadCollection } from './roadGraph';
import { roadIndex, searchPlaces } from './placeSearch';
import type { LngLat } from './geo';

const road = (name: string, coordinates: LngLat[]): RoadCollection['features'][number] => ({
  type: 'Feature',
  properties: { name, type: 'residential', oneway: 'no', motorcycle: true, foot: true },
  geometry: { type: 'LineString', coordinates },
});
const graph = buildRoadGraph({
  type: 'FeatureCollection',
  features: [
    road('Tiền Lân 17', [
      [106.6, 10.85],
      [106.601, 10.85],
    ]),
    road('Đường Tiền Lân 17', [
      [106.601, 10.85],
      [106.602, 10.85],
    ]),
    road('Đường Tiền Lân 14', [
      [106.6, 10.86],
      [106.601, 10.86],
    ]),
    road('Đường Tiền Lân 1', [
      [106.6, 10.87],
      [106.601, 10.87],
    ]),
  ],
});
const household = (id: string, houseNumber: string, street: string, extra: Partial<HouseholdFacility> = {}) =>
  ({ id, code: `HK-${id}`, ownerName: `Chủ hộ ${id}`, houseNumber, street, status: 'normal', ...extra }) as HouseholdFacility;
const sources = (households: HouseholdFacility[]) => ({
  households,
  householdPoint: (h: HouseholdFacility) => (h.id === 'temporary' ? null : ([106.6015, 10.8501] as LngLat)),
  buildings: [{ id: 'b1', name: 'Chợ Bà Điểm', point: [106.605, 10.855] as LngLat }],
  graph,
});

describe('start point search', () => {
  it('finds a household by house number and street, then the street itself', () => {
    const places = searchPlaces('86 tien lan 17', sources([household('1', '86', 'Tiền Lân 17')]));
    expect(places[0]).toMatchObject({ kind: 'household', label: '86 Tiền Lân 17', point: [106.6015, 10.8501] });
    expect(places.find(p => p.kind === 'road')?.label).toBe('Đường Tiền Lân 17');
  });

  it('falls back to the street, one result per street name, best match first, and says the number is missing', () => {
    const places = searchPlaces('86 tiền lân 17', sources([]));
    expect(places.map(p => p.label)).toEqual(['Đường Tiền Lân 17']);
    expect(places[0].detail).toContain('Chưa có số nhà 86');
    expect(searchPlaces('tiền lân 1', sources([])).map(p => p.label)).toEqual([
      'Đường Tiền Lân 1',
      'Đường Tiền Lân 14',
      'Đường Tiền Lân 17',
    ]);
    // The street point lies on the street.
    const point = roadIndex(graph).get('tien lan 17')!.point;
    expect(point[1]).toBeCloseTo(10.85, 6);
  });

  it('skips households with only a provisional point, and finds buildings and coordinates', () => {
    expect(searchPlaces('86 tiền lân 17', sources([household('temporary', '86', 'Tiền Lân 17')]))[0].kind).toBe('road');
    expect(searchPlaces('chợ bà', sources([]))[0]).toMatchObject({ kind: 'building', label: 'Chợ Bà Điểm' });
    expect(searchPlaces('10.851, 106.602', sources([]))).toEqual([
      expect.objectContaining({ kind: 'coordinate', point: [106.602, 10.851] }),
    ]);
    expect(searchPlaces('t', sources([]))).toEqual([]);
  });
});
