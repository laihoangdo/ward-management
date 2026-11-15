import axios from 'axios';
import { buildRoadGraph, RoadCollection, RoadGraph } from './roadGraph';

let graph: Promise<RoadGraph> | null = null;

/** Road network (© OpenStreetMap contributors), downloaded and built once per page; a failed load is retried next time. */
export function loadRoadGraph(): Promise<RoadGraph> {
  graph ??= axios
    .get<RoadCollection>('/api/gis/roads')
    .then(({ data }) => buildRoadGraph(data))
    .catch(error => {
      graph = null;
      throw error;
    });
  return graph;
}

/** Test hook. */
export function resetRoadGraph() {
  graph = null;
}
