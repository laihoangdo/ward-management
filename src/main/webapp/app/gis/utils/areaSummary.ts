import { HouseholdFacility, HouseholdStatus } from '../types';
import { FieldHouse, houseBounds } from './fieldHouseGeometry';
import { containsHousePoint } from './houseFootprints';

export interface AreaSummary {
  /** Buildings whose centre lies inside the drawn area. */
  buildingIds: string[];
  occupiedBuildings: number;
  /** Households of those buildings, followed by household points that sit in the area without a building. */
  households: HouseholdFacility[];
  looseHouseholds: number;
  residents: number;
  byStatus: Record<HouseholdStatus, number>;
}

/** Footprints are far smaller than this, so a building this far outside the area's box cannot have its centre inside. */
const MARGIN = 0.002;

/**
 * Counts what lies inside a drawn polygon ([lng, lat] vertices, not closed). It only sees the buildings and
 * households it is given, so the caller's territory scope carries over unchanged.
 */
export function areaSummary(
  polygon: number[][],
  houses: FieldHouse[],
  indexed: Map<string, HouseholdFacility[]>,
  loose: HouseholdFacility[] = [],
): AreaSummary {
  const summary: AreaSummary = {
    buildingIds: [],
    occupiedBuildings: 0,
    households: [],
    looseHouseholds: 0,
    residents: 0,
    byStatus: { normal: 0, warning: 0, alert: 0, business: 0, unverified: 0 },
  };
  if (polygon.length < 3) return summary;
  const geometry: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[...polygon, polygon[0]]] };
  let west = Infinity,
    south = Infinity,
    east = -Infinity,
    north = -Infinity;
  for (const [lng, lat] of polygon) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  const near = (lng: number, lat: number, margin: number) =>
    lng >= west - margin && lng <= east + margin && lat >= south - margin && lat <= north + margin;
  const seen = new Set<string>();
  const add = (household: HouseholdFacility) => {
    if (seen.has(household.id)) return false;
    seen.add(household.id);
    summary.households.push(household);
    summary.residents += household.residentsCount || 0;
    if (household.status in summary.byStatus) summary.byStatus[household.status] += 1;
    return true;
  };
  for (const house of houses) {
    const first = house.geometry.type === 'Polygon' ? house.geometry.coordinates[0]?.[0] : house.geometry.coordinates[0]?.[0]?.[0];
    if (!first || !near(first[0], first[1], MARGIN)) continue;
    const [w, s, e, n] = houseBounds(house);
    if (!containsHousePoint(geometry, [(w + e) / 2, (s + n) / 2])) continue;
    const id = house.properties.buildingId;
    summary.buildingIds.push(id);
    const residents = indexed.get(id) ?? [];
    if (residents.length) summary.occupiedBuildings += 1;
    residents.forEach(add);
  }
  for (const household of loose) {
    const [lat, lng] = household.coordinates ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !near(lng, lat, 0) || !containsHousePoint(geometry, [lng, lat])) continue;
    if (add(household)) summary.looseHouseholds += 1;
  }
  return summary;
}
