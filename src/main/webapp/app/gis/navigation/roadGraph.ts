import { distance, LngLat, projectOnSegment } from './geo';

export type TravelMode = 'motorbike' | 'walk';

export interface RoadProperties {
  name?: string | null;
  type: string;
  /** "yes": only along the drawn direction; "-1": only against it (motorbikes; walking ignores one-way). */
  oneway: 'no' | 'yes' | '-1';
  motorcycle: boolean;
  foot: boolean;
}
export type RoadCollection = GeoJSON.FeatureCollection<GeoJSON.LineString, RoadProperties>;

/** One straight piece of road between two consecutive vertices. */
export interface Segment {
  a: number;
  b: number;
  length: number;
  name: string | null;
  /** Motorbikes may go a→b / b→a. */
  bikeForward: boolean;
  bikeBackward: boolean;
  foot: boolean;
}

export interface RoadGraph {
  nodes: LngLat[];
  segments: Segment[];
  /** Segment ids touching each node. */
  nodeSegments: number[][];
  /** Spatial index: grid cell key → segment ids. */
  grid: Map<string, number[]>;
}

/** Grid cell about 110 m wide. */
const CELL = 0.001;
const cellKey = (x: number, y: number) => `${x},${y}`;

export const canTravel = (segment: Segment, mode: TravelMode, fromA: boolean): boolean =>
  mode === 'walk' ? segment.foot : fromA ? segment.bikeForward : segment.bikeBackward;
export const usable = (segment: Segment, mode: TravelMode) =>
  mode === 'walk' ? segment.foot : segment.bikeForward || segment.bikeBackward;

/** Builds the routable graph; OSM ways share vertex coordinates at junctions, so equal coordinates become one node. */
export function buildRoadGraph(roads: RoadCollection): RoadGraph {
  const nodes: LngLat[] = [];
  const nodeIndex = new Map<string, number>();
  const segments: Segment[] = [];
  const nodeSegments: number[][] = [];
  const grid = new Map<string, number[]>();
  const node = (p: LngLat) => {
    const key = `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
    let id = nodeIndex.get(key);
    if (id === undefined) {
      id = nodes.length;
      nodes.push([p[0], p[1]]);
      nodeSegments.push([]);
      nodeIndex.set(key, id);
    }
    return id;
  };
  for (const feature of roads.features) {
    const props = feature.properties;
    const coordinates = feature.geometry?.coordinates as LngLat[] | undefined;
    if (!props || !coordinates || coordinates.length < 2 || (!props.motorcycle && !props.foot)) continue;
    const forward = props.motorcycle && props.oneway !== '-1';
    const backward = props.motorcycle && props.oneway !== 'yes';
    for (let i = 1; i < coordinates.length; i++) {
      const a = node(coordinates[i - 1]);
      const b = node(coordinates[i]);
      if (a === b) continue;
      const id = segments.length;
      segments.push({
        a,
        b,
        length: distance(nodes[a], nodes[b]),
        name: props.name ?? null,
        bikeForward: forward,
        bikeBackward: backward,
        foot: props.foot,
      });
      nodeSegments[a].push(id);
      nodeSegments[b].push(id);
      const [ax, ay] = nodes[a];
      const [bx, by] = nodes[b];
      for (let x = Math.floor(Math.min(ax, bx) / CELL); x <= Math.floor(Math.max(ax, bx) / CELL); x++)
        for (let y = Math.floor(Math.min(ay, by) / CELL); y <= Math.floor(Math.max(ay, by) / CELL); y++) {
          const key = cellKey(x, y);
          const list = grid.get(key);
          if (list) list.push(id);
          else grid.set(key, [id]);
        }
    }
  }
  return { nodes, segments, nodeSegments, grid };
}

export interface Snap {
  segment: number;
  point: LngLat;
  /** Position along the segment from a (0) to b (1). */
  t: number;
  /** Metres from the query point to the road. */
  distance: number;
}

/** Nearest usable road point, searching outward ring by ring up to maxDistance metres. */
export function snapToRoad(graph: RoadGraph, p: LngLat, mode: TravelMode, maxDistance = 1500): Snap | null {
  const cx = Math.floor(p[0] / CELL);
  const cy = Math.floor(p[1] / CELL);
  const maxRing = Math.ceil(maxDistance / 100) + 1;
  let best = null as Snap | null;
  const seen = new Set<number>();
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let x = cx - ring; x <= cx + ring; x++)
      for (let y = cy - ring; y <= cy + ring; y++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== ring) continue;
        for (const id of graph.grid.get(cellKey(x, y)) ?? []) {
          if (seen.has(id)) continue;
          seen.add(id);
          const segment = graph.segments[id];
          if (!usable(segment, mode)) continue;
          const hit = projectOnSegment(p, graph.nodes[segment.a], graph.nodes[segment.b]);
          if (!best || hit.distance < best.distance) best = { segment: id, point: hit.point, t: hit.t, distance: hit.distance };
        }
      }
    // Cells of the next ring are at least ring × ~100 m away; stop once the best hit is closer than that.
    if (best && best.distance < ring * 100) break;
  }
  return best && best.distance <= maxDistance ? best : null;
}
