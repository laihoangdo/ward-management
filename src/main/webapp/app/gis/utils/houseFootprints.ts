export function containsHousePoint(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon, point: number[]): boolean {
  const inRing = (ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i];
      const [px, py] = ring[j];
      if (y > point[1] !== py > point[1] && point[0] < ((px - x) * (point[1] - y)) / (py - y) + x) inside = !inside;
    }
    return inside;
  };
  return (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).some(
    rings => inRing(rings[0]) && !rings.slice(1).some(inRing),
  );
}
