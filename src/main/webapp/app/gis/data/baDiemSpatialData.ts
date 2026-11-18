/** Map coordinate conversion only. Operational records must come from the API. */
export const BA_DIEM_CENTER: [number, number] = [10.8525, 106.611];

export function latLngToWorld(lat: number, lng: number): [number, number] {
  const [centerLat, centerLng] = BA_DIEM_CENTER;
  const metersPerDegLng = 111320 * Math.cos((centerLat * Math.PI) / 180);
  return [(lng - centerLng) * metersPerDegLng, -(lat - centerLat) * 111320];
}

export function worldToLatLng(x: number, z: number): [number, number] {
  const [centerLat, centerLng] = BA_DIEM_CENTER;
  const metersPerDegLng = 111320 * Math.cos((centerLat * Math.PI) / 180);
  return [centerLat - z / 111320, centerLng + x / metersPerDegLng];
}
