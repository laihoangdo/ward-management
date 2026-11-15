import { describe, expect, it } from 'vitest';
import { distance, LngLat } from './geo';
import { buildRoadGraph, RoadCollection, RoadProperties, snapToRoad } from './roadGraph';
import { findRoute } from './route';
import { formatDistance, formatDuration, routeProgress, shouldReroute, splitPath } from './navigationProgress';

// Synthetic grid around (106.60, 10.85): about 110 m between parallel streets.
const X0 = 106.6;
const Y0 = 10.85;
const D = 0.001;
const p = (x: number, y: number): LngLat => [X0 + x * D, Y0 + y * D];
const road = (coordinates: LngLat[], props: Partial<RoadProperties> = {}): RoadCollection['features'][number] => ({
  type: 'Feature',
  properties: { name: null, type: 'residential', oneway: 'no', motorcycle: true, foot: true, ...props },
  geometry: { type: 'LineString', coordinates },
});
const collection = (...features: RoadCollection['features']): RoadCollection => ({ type: 'FeatureCollection', features });

/**
 *   y=2  A ---- B ---- C        "Đường số 1" along y=0, "Đường số 2" along y=2;
 *        |             |        west street x=0 and east street x=2.
 *   y=0  D ---- E ---- F        E–B is a one-way alley going north (E→B).
 */
const grid = () =>
  buildRoadGraph(
    collection(
      road([p(0, 0), p(1, 0), p(2, 0)], { name: 'Đường số 1' }),
      road([p(0, 2), p(1, 2), p(2, 2)], { name: 'Đường số 2' }),
      road([p(0, 0), p(0, 2)], { name: 'Đường Tây' }),
      road([p(2, 0), p(2, 2)], { name: 'Đường Đông' }),
      road([p(1, 0), p(1, 2)], { name: 'Hẻm một chiều', oneway: 'yes' }),
    ),
  );

describe('road graph', () => {
  it('joins roads that share a vertex and snaps a point to the nearest usable road', () => {
    const graph = grid();
    expect(graph.nodes).toHaveLength(6);
    expect(graph.segments).toHaveLength(7);
    const snap = snapToRoad(graph, [X0 + 0.5 * D, Y0 + 0.0002], 'motorbike')!;
    expect(snap.distance).toBeLessThan(25);
    expect(snap.point[1]).toBeCloseTo(Y0, 6);
  });

  it('leaves footpaths out of motorbike routing but walks them', () => {
    const graph = buildRoadGraph(collection(road([p(0, 0), p(1, 0)], { type: 'footway', motorcycle: false })));
    expect(snapToRoad(graph, p(0.5, 0), 'motorbike')).toBeNull();
    expect(snapToRoad(graph, p(0.5, 0), 'walk')).not.toBeNull();
  });
});

describe('findRoute', () => {
  it('takes the one-way alley northbound by motorbike', () => {
    const route = findRoute(grid(), p(1, -0.05), p(1, 2.05), 'motorbike');
    expect(route.straight).toBe(false);
    expect(route.length).toBeGreaterThan(200);
    expect(route.length).toBeLessThan(240);
    expect(route.startConnector).not.toBeNull();
    expect(route.endConnector).not.toBeNull();
  });

  it('goes around the one-way alley southbound by motorbike, but walks straight down it', () => {
    const bike = findRoute(grid(), p(1, 2.05), p(1, -0.05), 'motorbike');
    const walk = findRoute(grid(), p(1, 2.05), p(1, -0.05), 'walk');
    expect(walk.length).toBeLessThan(240);
    // Around the block: ~110 to a corner, 220 down, ~110 back.
    expect(bike.length).toBeGreaterThan(400);
    expect(bike.maneuvers.map(m => m.text)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Rẽ (trái|phải) vào Đường (Tây|Đông)$/)]),
    );
  });

  it('routes along a single road piece without a search', () => {
    const route = findRoute(grid(), p(0.2, 0), p(0.8, 0), 'motorbike');
    expect(route.path).toHaveLength(2);
    expect(route.length).toBeGreaterThan(60);
    expect(route.maneuvers).toEqual([]);
  });

  it('falls back to a straight line when the roads do not connect or are too far', () => {
    const islands = buildRoadGraph(collection(road([p(0, 0), p(1, 0)]), road([p(0, 5), p(1, 5)])));
    expect(findRoute(islands, p(0.5, 0), p(0.5, 5), 'motorbike').straight).toBe(true);
    expect(findRoute(grid(), p(0, 0), p(40, 40), 'walk').straight).toBe(true);
  });
});

describe('navigation progress', () => {
  const route = findRoute(grid(), p(0, 0.02), p(2, 2.05), 'motorbike');

  it('tracks distance left, the next manoeuvre and arrival', () => {
    const start = routeProgress(route, p(0, 0.02));
    expect(start.offRoute).toBeLessThan(5);
    expect(start.remaining).toBeGreaterThan(400);
    expect(start.nextManeuver?.text).toMatch(/^Rẽ/);
    expect(start.arrived).toBe(false);
    const later = routeProgress(route, route.path[2]);
    expect(later.remaining).toBeLessThan(start.remaining);
    expect(later.seconds).toBeCloseTo(later.remaining / (25 / 3.6), 3);
    expect(routeProgress(route, p(2, 2.04)).arrived).toBe(true);
    const { walked, ahead } = splitPath(route, later);
    expect(walked[walked.length - 1]).toEqual(ahead[0]);
  });

  it('reroutes after two fixes more than 30 m off the path, at most every 5 seconds', () => {
    const state = { offCount: 0, lastReroute: 0 };
    expect(shouldReroute(state, 50, 10_000)).toBe(false);
    expect(shouldReroute(state, 50, 11_000)).toBe(true);
    expect(shouldReroute(state, 50, 12_000)).toBe(false);
    expect(shouldReroute(state, 50, 13_000)).toBe(false);
    expect(shouldReroute(state, 10, 20_000)).toBe(false);
    expect(shouldReroute(state, 50, 21_000)).toBe(false);
    expect(shouldReroute(state, 50, 22_000)).toBe(true);
  });

  it('formats distance and time in Vietnamese', () => {
    expect(formatDistance(123)).toBe('125 m');
    expect(formatDistance(1530)).toBe('1,5 km');
    expect(formatDuration(30)).toBe('1 phút');
    expect(formatDuration(3900)).toBe('1 giờ 5 phút');
    expect(distance(p(0, 0), p(1, 0))).toBeGreaterThan(100);
  });
});
