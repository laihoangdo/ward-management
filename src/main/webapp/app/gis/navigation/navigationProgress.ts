import { bearing, distance, LngLat, projectOnSegment } from './geo';
import type { Route } from './route';
import type { TravelMode } from './roadGraph';

/** Average speeds for the time estimate: motorbike in town ~25 km/h, walking ~4.5 km/h. */
export const SPEED_MPS: Record<TravelMode, number> = { motorbike: 25 / 3.6, walk: 4.5 / 3.6 };
export const OFF_ROUTE_METRES = 30;
export const ARRIVAL_METRES = 20;
export const REROUTE_INTERVAL_MS = 5000;

export interface Progress {
  /** Metres travelled along the road path. */
  along: number;
  /** Point on the road path closest to the officer. */
  point: LngLat;
  /** Index of the path piece the officer is on. */
  index: number;
  /** Metres from the officer to the road path (or to the straight line when there is no road path). */
  offRoute: number;
  /** Metres left: rest of the road path, plus the walk from the road to the building. */
  remaining: number;
  seconds: number;
  nextManeuver: { text: string; in: number } | null;
  /** Direction of travel on the path at the officer's position. */
  heading: number | null;
  arrived: boolean;
}

/** Where the officer is along the route and what comes next. */
export function routeProgress(route: Route, position: LngLat): Progress {
  const toDestination = distance(position, route.destination);
  const endWalk = route.endConnector ? distance(route.endConnector[0], route.endConnector[1]) : 0;
  if (route.straight || route.path.length < 2) {
    return {
      along: 0,
      point: position,
      index: 0,
      offRoute: 0,
      remaining: toDestination,
      seconds: toDestination / SPEED_MPS[route.mode],
      nextManeuver: null,
      heading: bearing(position, route.destination),
      arrived: toDestination <= ARRIVAL_METRES,
    };
  }
  let best = { distance: Infinity, along: 0, point: route.path[0], index: 0 };
  for (let i = 1; i < route.path.length; i++) {
    const hit = projectOnSegment(position, route.path[i - 1], route.path[i]);
    if (hit.distance < best.distance) {
      const piece = route.cumulative[i] - route.cumulative[i - 1];
      best = { distance: hit.distance, along: route.cumulative[i - 1] + piece * hit.t, point: hit.point, index: i - 1 };
    }
  }
  const remaining = Math.max(0, route.length - best.along) + endWalk;
  const next = route.maneuvers.find(m => m.at > best.along + 2);
  const a = route.path[best.index];
  const b = route.path[best.index + 1];
  return {
    along: best.along,
    point: best.point,
    index: best.index,
    offRoute: best.distance,
    remaining,
    seconds: remaining / SPEED_MPS[route.mode],
    nextManeuver: next ? { text: next.text, in: next.at - best.along } : null,
    heading: a && b && distance(a, b) > 0.5 ? bearing(a, b) : null,
    arrived: toDestination <= ARRIVAL_METRES || remaining <= ARRIVAL_METRES,
  };
}

/** Rerouting rule: off the path by more than 30 m on two fixes in a row, at most once every 5 seconds. */
export interface RerouteState {
  offCount: number;
  lastReroute: number;
}
export function shouldReroute(state: RerouteState, offRoute: number, now: number): boolean {
  state.offCount = offRoute > OFF_ROUTE_METRES ? state.offCount + 1 : 0;
  if (state.offCount < 2 || now - state.lastReroute < REROUTE_INTERVAL_MS) return false;
  state.offCount = 0;
  state.lastReroute = now;
  return true;
}

/** Road path split at the officer's position: the travelled part is drawn faded. */
export function splitPath(route: Route, progress: Progress): { walked: LngLat[]; ahead: LngLat[] } {
  if (route.path.length < 2) return { walked: [], ahead: [] };
  return {
    walked: [...route.path.slice(0, progress.index + 1), progress.point],
    ahead: [progress.point, ...route.path.slice(progress.index + 1)],
  };
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.max(0, Math.round(metres / 5) * 5)} m`;
  return `${(metres / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} phút`;
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}
