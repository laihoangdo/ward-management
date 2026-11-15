import { HouseholdFacility } from '../types';
import { matchesHouseholdSearch, normalizeSearch, parseCoordinateQuery } from '../utils/householdSearch';
import { distance, LngLat } from './geo';
import type { RoadGraph } from './roadGraph';

/** A start point found by text: everything is looked up on the device, nothing is sent to a geocoding service. */
export interface Place {
  id: string;
  kind: 'coordinate' | 'household' | 'building' | 'road';
  label: string;
  detail: string;
  point: LngLat;
}

export interface PlaceSources {
  households: HouseholdFacility[];
  /** Building centre for a household linked to a building, or its surveyed coordinates; null when only provisional. */
  householdPoint: (household: HouseholdFacility) => LngLat | null;
  /** Named buildings (landmarks). */
  buildings: { id: string; name: string; point: LngLat }[];
  graph: RoadGraph | null;
}

const LIMIT = { household: 5, building: 3, road: 5 };
/** "Đường Tiền Lân 17" and "Tiền Lân 17" are the same street in OSM names. */
const roadKey = (name: string) => normalizeSearch(name).replace(/^(duong|pho)\s+/, '');
/** Leading house number such as "86", "12a", "144/2" or "86/3b". */
const HOUSE_NUMBER = /^(\d+[a-z]?(?:\/\d+[a-z]?)*)\s+(.+)$/;

const roadIndexes = new WeakMap<RoadGraph, Map<string, { name: string; point: LngLat }>>();

/** One point per road name: the piece of that road closest to the middle of all its pieces. */
export function roadIndex(graph: RoadGraph) {
  const cached = roadIndexes.get(graph);
  if (cached) return cached;
  const groups = new Map<string, { name: string; mids: LngLat[] }>();
  for (const segment of graph.segments) {
    if (!segment.name) continue;
    const key = roadKey(segment.name);
    const a = graph.nodes[segment.a];
    const b = graph.nodes[segment.b];
    const mid: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const group = groups.get(key);
    if (group) group.mids.push(mid);
    // Prefer the full "Đường …" spelling when OSM uses both.
    else groups.set(key, { name: segment.name, mids: [mid] });
    if (group && segment.name.length > group.name.length) group.name = segment.name;
  }
  const index = new Map<string, { name: string; point: LngLat }>();
  for (const [key, { name, mids }] of groups) {
    const centre: LngLat = [mids.reduce((s, p) => s + p[0], 0) / mids.length, mids.reduce((s, p) => s + p[1], 0) / mids.length];
    let best = mids[0];
    for (const mid of mids) if (distance(mid, centre) < distance(best, centre)) best = mid;
    index.set(key, { name, point: best });
  }
  roadIndexes.set(graph, index);
  return index;
}

export function searchPlaces(query: string, sources: PlaceSources): Place[] {
  const q = normalizeSearch(query);
  if (q.length < 2) return [];
  const places: Place[] = [];
  const coordinate = parseCoordinateQuery(query);
  if (coordinate) {
    places.push({
      id: 'coordinate',
      kind: 'coordinate',
      label: `${coordinate[1].toFixed(6)}, ${coordinate[0].toFixed(6)}`,
      detail: 'Toạ độ đã nhập',
      point: coordinate,
    });
    return places;
  }

  let households = 0;
  for (const household of sources.households) {
    if (households >= LIMIT.household) break;
    if (!matchesHouseholdSearch(household, query)) continue;
    const point = sources.householdPoint(household);
    if (!point) continue;
    households++;
    places.push({
      id: `household-${household.id}`,
      kind: 'household',
      label: `${household.houseNumber ?? ''} ${household.street ?? ''}`.trim() || household.ownerName,
      detail: `Hộ ${household.ownerName}${household.hamlet ? ` · ${household.hamlet}` : ''}`,
      point,
    });
  }

  places.push(
    ...sources.buildings
      .filter(b => normalizeSearch(b.name).includes(q))
      .slice(0, LIMIT.building)
      .map(b => ({ id: `building-${b.id}`, kind: 'building' as const, label: b.name, detail: 'Công trình trên bản đồ', point: b.point })),
  );

  if (sources.graph) {
    const numbered = HOUSE_NUMBER.exec(q);
    const roadQuery = (numbered ? numbered[2] : q).replace(/^(duong|pho)\s+/, '');
    const rank = (key: string) => (key === roadQuery ? 0 : key.startsWith(roadQuery) ? 1 : 2);
    const roads = [...roadIndex(sources.graph)]
      .filter(([key]) => key.includes(roadQuery))
      .sort(([a], [b]) => rank(a) - rank(b) || a.length - b.length || a.localeCompare(b))
      .slice(0, LIMIT.road);
    for (const [key, road] of roads) {
      places.push({
        id: `road-${key}`,
        kind: 'road',
        label: road.name,
        detail:
          numbered && households === 0
            ? `Chưa có số nhà ${numbered[1]} trong dữ liệu; điểm giữa tuyến đường, chọn lại trên bản đồ nếu cần chính xác`
            : 'Điểm giữa tuyến đường (dữ liệu OSM)',
        point: road.point,
      });
    }
  }
  return places;
}
