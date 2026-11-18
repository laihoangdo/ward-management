import { bearing, distance, lineLength, LngLat, turnAngle } from './geo';
import { canTravel, RoadGraph, Snap, snapToRoad, TravelMode } from './roadGraph';

export interface Maneuver {
  /** Metres from the start of the road path where the manoeuvre happens. */
  at: number;
  text: string;
}

export interface Route {
  mode: TravelMode;
  /** Road path from the snapped start to the road point nearest the destination. */
  path: LngLat[];
  /** Cumulative metres at each path point. */
  cumulative: number[];
  /** Road path length in metres. */
  length: number;
  /** Straight pieces off the road network: officer → road and road → building. */
  startConnector: [LngLat, LngLat] | null;
  endConnector: [LngLat, LngLat] | null;
  destination: LngLat;
  maneuvers: Maneuver[];
  /** No road connection: only a straight line is drawn. */
  straight: boolean;
}

/** Off-road pieces shorter than this are not drawn. */
const CONNECTOR_MIN = 3;

class MinHeap {
  private items: { id: number; f: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(id: number, f: number) {
    const items = this.items;
    items.push({ id, f });
    let i = items.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (items[parent].f <= items[i].f) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): { id: number; f: number } {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l].f < items[m].f) m = l;
        if (r < items.length && items[r].f < items[m].f) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    }
    return top;
  }
}

function straightRoute(from: LngLat, to: LngLat, mode: TravelMode): Route {
  return {
    mode,
    path: [],
    cumulative: [],
    length: 0,
    startConnector: [from, to],
    endConnector: null,
    destination: to,
    maneuvers: [],
    straight: true,
  };
}

const connector = (a: LngLat, b: LngLat): [LngLat, LngLat] | null => (distance(a, b) >= CONNECTOR_MIN ? [a, b] : null);

/**
 * Shortest road route from the officer to a destination (A* over the road graph). Motorbikes respect one-way roads;
 * walking does not. Returns a straight line when either end is far from any road or the roads do not connect.
 */
export function findRoute(graph: RoadGraph, from: LngLat, to: LngLat, mode: TravelMode): Route {
  const start = snapToRoad(graph, from, mode);
  const end = snapToRoad(graph, to, mode);
  if (!start || !end) return straightRoute(from, to, mode);
  const { nodes, segments, nodeSegments } = graph;
  const s = segments[start.segment];
  const e = segments[end.segment];

  // Same piece of road, travel allowed in the needed direction: no search needed.
  if (start.segment === end.segment && canTravel(s, mode, end.t >= start.t)) {
    return assemble([start.point, end.point], [null], from, to, start, end, mode);
  }

  const g = new Map<number, number>();
  const previous = new Map<number, { node: number; segment: number }>();
  const heap = new MinHeap();
  const h = (n: number) => distance(nodes[n], end.point);
  // Leaving the start point: toward b means travelling a→b on the start segment.
  const seed = (n: number, cost: number) => {
    if (cost < (g.get(n) ?? Infinity)) {
      g.set(n, cost);
      previous.set(n, { node: -1, segment: start.segment });
      heap.push(n, cost + h(n));
    }
  };
  if (canTravel(s, mode, true)) seed(s.b, s.length * (1 - start.t));
  if (canTravel(s, mode, false)) seed(s.a, s.length * start.t);

  // Reaching the end point: from a means travelling a→b on the end segment.
  const finish = (n: number): number | null => {
    if (n === e.a && canTravel(e, mode, true)) return e.length * end.t;
    if (n === e.b && canTravel(e, mode, false)) return e.length * (1 - end.t);
    return null;
  };
  let best = Infinity;
  let bestNode = -1;
  const closed = new Set<number>();
  while (heap.size) {
    const { id: n, f } = heap.pop();
    if (f >= best) break;
    if (closed.has(n)) continue;
    closed.add(n);
    const cost = g.get(n)!;
    const tail = finish(n);
    if (tail !== null && cost + tail < best) {
      best = cost + tail;
      bestNode = n;
    }
    for (const id of nodeSegments[n]) {
      const seg = segments[id];
      const fromA = seg.a === n;
      if (!canTravel(seg, mode, fromA)) continue;
      const next = fromA ? seg.b : seg.a;
      if (closed.has(next)) continue;
      const nextCost = cost + seg.length;
      if (nextCost < (g.get(next) ?? Infinity)) {
        g.set(next, nextCost);
        previous.set(next, { node: n, segment: id });
        heap.push(next, nextCost + h(next));
      }
    }
  }
  if (bestNode < 0) return straightRoute(from, to, mode);

  const chain: number[] = [];
  const names: (string | null)[] = [];
  for (let n = bestNode; n >= 0;) {
    chain.push(n);
    const step = previous.get(n)!;
    names.push(segments[step.segment].name);
    n = step.node;
  }
  chain.reverse();
  names.reverse();
  // names[i] is the road leading into chain[i]; the last piece runs along the end segment.
  const path: LngLat[] = [start.point, ...chain.map(n => nodes[n]), end.point];
  return assemble(path, [...names, e.name], from, to, start, end, mode);
}

function assemble(rawPath: LngLat[], names: (string | null)[], from: LngLat, to: LngLat, start: Snap, end: Snap, mode: TravelMode): Route {
  // Drop zero-length steps (snap point on a vertex) together with their road names.
  const path: LngLat[] = [];
  const pieceNames: (string | null)[] = [];
  rawPath.forEach((point, i) => {
    if (path.length && distance(path[path.length - 1], point) < 0.5) return;
    if (i > 0) pieceNames.push(names[i - 1] ?? null);
    path.push(point);
  });
  if (path.length === 1) path.push(path[0]);
  const cumulative = [0];
  for (let i = 1; i < path.length; i++) cumulative.push(cumulative[i - 1] + distance(path[i - 1], path[i]));
  return {
    mode,
    path,
    cumulative,
    length: lineLength(path),
    startConnector: connector(from, start.point),
    endConnector: connector(end.point, to),
    destination: to,
    maneuvers: maneuvers(path, cumulative, pieceNames),
    straight: false,
  };
}

/** Turn instructions where the road bends more than 35° or the road name changes. */
export function maneuvers(path: LngLat[], cumulative: number[], names: (string | null)[]): Maneuver[] {
  const result: Maneuver[] = [];
  for (let i = 1; i < path.length - 1; i++) {
    const turn = turnAngle(bearing(path[i - 1], path[i]), bearing(path[i], path[i + 1]));
    const nextName = names[i] ?? null;
    const renamed = nextName !== null && nextName !== (names[i - 1] ?? null);
    const abs = Math.abs(turn);
    if (abs < 35 && !renamed) continue;
    const side = turn > 0 ? 'phải' : 'trái';
    const verb = abs >= 150 ? 'Quay đầu' : abs >= 60 ? `Rẽ ${side}` : abs >= 35 ? `Chếch ${side}` : 'Đi tiếp';
    const text = nextName ? `${verb} vào ${nextName}` : verb;
    // Several bends within a few metres (a curved junction) read as one manoeuvre.
    const last = result[result.length - 1];
    if (last && cumulative[i] - last.at < 12) {
      if (abs >= 35) last.text = text;
      continue;
    }
    result.push({ at: cumulative[i], text });
  }
  return result;
}
