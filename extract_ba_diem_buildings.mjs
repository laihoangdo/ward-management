import fs from 'fs';
import path from 'path';
import https from 'https';

// 1. Load boundary
const boundaryPath = path.resolve('../xa_ba_diem.geojson');
if (!fs.existsSync(boundaryPath)) {
  console.error('Cannot find boundary file at:', boundaryPath);
  process.exit(1);
}

const boundaryData = JSON.parse(fs.readFileSync(boundaryPath, 'utf8'));
const boundaryRing = boundaryData.features[0].geometry.coordinates[0][0];

console.log(`Loaded boundary with ${boundaryRing.length} points.`);

let minLng = 180,
  maxLng = -180,
  minLat = 90,
  maxLat = -90;
boundaryRing.forEach(([lng, lat]) => {
  if (lng < minLng) minLng = lng;
  if (lng > maxLng) maxLng = lng;
  if (lat < minLat) minLat = lat;
  if (lat > maxLat) maxLat = lat;
});

console.log(`BBox: Lat [${minLat.toFixed(6)}, ${maxLat.toFixed(6)}], Lng [${minLng.toFixed(6)}, ${maxLng.toFixed(6)}]`);

// Point-in-polygon ray casting algorithm
function isPointInRing(pt, ring) {
  const [x, y] = pt; // x: lng, y: lat
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Calculate polygon area in m2
function calculateAreaM2(coords) {
  if (coords.length < 3) return 0;
  const centerLat = coords[0][1];
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((centerLat * Math.PI) / 180);

  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % n];
    const x1 = p1[0] * metersPerDegLng;
    const y1 = p1[1] * metersPerDegLat;
    const x2 = p2[0] * metersPerDegLng;
    const y2 = p2[1] * metersPerDegLat;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

// Query with reliable mirror list
async function queryOverpass(query) {
  const endpoints = [
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      const resData = await new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'PoliceGISBaDiem/1.0',
            },
            timeout: 25000,
          },
          res => {
            let body = '';
            res.on('data', chunk => (body += chunk));
            res.on('end', () => {
              if (res.statusCode === 200) {
                try {
                  resolve(JSON.parse(body));
                } catch (e) {
                  reject(new Error('JSON parse error'));
                }
              } else {
                reject(new Error(`HTTP ${res.statusCode}`));
              }
            });
          },
        );

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Timeout'));
        });

        req.write('data=' + encodeURIComponent(query));
        req.end();
      });

      return resData;
    } catch (err) {
      console.warn(`Mirror ${endpoint} failed (${err.message}). Trying fallback...`);
    }
  }
  return { elements: [] };
}

async function main() {
  console.log('=== TRÍCH XUẤT TOÀN BỘ KHỐI NHÀ XÃ BÀ ĐIỂM (27.36 km²) ===');

  // Split into 4x4 = 16 sub-tiles for fast & reliable execution
  const latSteps = 4;
  const lngSteps = 4;
  const latDelta = (maxLat - minLat) / latSteps;
  const lngDelta = (maxLng - minLng) / lngSteps;

  const allBuildingsMap = new Map();

  for (let i = 0; i < latSteps; i++) {
    for (let j = 0; j < lngSteps; j++) {
      const tileMinLat = (minLat + i * latDelta).toFixed(6);
      const tileMaxLat = (minLat + (i + 1) * latDelta).toFixed(6);
      const tileMinLng = (minLng + j * lngDelta).toFixed(6);
      const tileMaxLng = (minLng + (j + 1) * lngDelta).toFixed(6);

      process.stdout.write(`Đang tải Tile [${i + 1}/${latSteps}, ${j + 1}/${lngSteps}]... `);

      const query = `
[out:json][timeout:25];
(
  way["building"](${tileMinLat},${tileMinLng},${tileMaxLat},${tileMaxLng});
);
out geom;
`;

      try {
        const result = await queryOverpass(query);
        const elements = result.elements || [];

        let tileAccepted = 0;
        for (const el of elements) {
          if (!el.geometry || el.geometry.length < 3) continue;

          // Deduplicate
          if (allBuildingsMap.has(el.id)) continue;

          // Coordinates [lng, lat]
          const coords = el.geometry.map(pt => [Number(pt.lon.toFixed(6)), Number(pt.lat.toFixed(6))]);
          // Close loop if not closed
          if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
            coords.push([...coords[0]]);
          }

          // Centroid
          const centroidLng = coords.reduce((sum, pt) => sum + pt[0], 0) / coords.length;
          const centroidLat = coords.reduce((sum, pt) => sum + pt[1], 0) / coords.length;

          // Strict boundary check: Must be inside Xã Bà Điểm!
          if (!isPointInRing([centroidLng, centroidLat], boundaryRing)) {
            continue;
          }

          const tags = el.tags || {};
          const buildingType = tags.building || 'yes';
          const name = tags.name || tags['name:vi'] || (tags.shop ? `Cửa hàng ${tags.shop}` : `Công trình #${el.id}`);

          let category = 'residential';
          if (
            tags.shop ||
            tags.amenity === 'restaurant' ||
            tags.amenity === 'cafe' ||
            tags.amenity === 'bank' ||
            tags.commercial === 'yes' ||
            tags.office ||
            tags.industrial ||
            buildingType === 'commercial' ||
            buildingType === 'retail' ||
            buildingType === 'supermarket' ||
            buildingType === 'industrial'
          ) {
            category = 'commercial';
          } else if (
            tags.amenity === 'school' ||
            tags.amenity === 'hospital' ||
            tags.amenity === 'clinic' ||
            tags.amenity === 'police' ||
            tags.amenity === 'townhall' ||
            tags.amenity === 'place_of_worship' ||
            buildingType === 'public' ||
            buildingType === 'civic'
          ) {
            category = 'other';
          }

          const rawLevels = tags['building:levels'] || tags.levels;
          let floors = rawLevels ? parseInt(rawLevels, 10) : category === 'commercial' ? 3 : 2;
          if (isNaN(floors) || floors <= 0) floors = 2;

          let height_m = tags.height ? parseFloat(tags.height) : floors * 3.5;
          if (isNaN(height_m) || height_m <= 0) height_m = floors * 3.5;

          const area_m2 = parseFloat(calculateAreaM2(coords).toFixed(1));

          allBuildingsMap.set(el.id, {
            type: 'Feature',
            properties: {
              id: `osm-${el.id}`,
              source: 'OSM',
              source_id: String(el.id),
              name,
              category,
              building_type: buildingType,
              height_m: parseFloat(height_m.toFixed(1)),
              floors,
              height_estimated: !tags.height,
              area_m2,
              in_boundary: true,
              footprint_type: 'polygon_traced',
              tags,
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coords],
            },
          });
          tileAccepted++;
        }
        console.log(`Tìm thấy: ${elements.length} | Trong Xã Bà Điểm: +${tileAccepted} (Tổng: ${allBuildingsMap.size})`);
      } catch (tileErr) {
        console.error(`Lỗi: ${tileErr.message}`);
      }

      // Small pause to be polite
      await new Promise(r => setTimeout(r, 600));
    }
  }

  const buildingFeatures = Array.from(allBuildingsMap.values());
  console.log(`\n======================================================`);
  console.log(`HOÀN TẤT: ĐÃ THU THẬP ${buildingFeatures.length} KHỐI NHÀ THỰC TẾ XÃ BÀ ĐIỂM`);
  console.log(`======================================================`);

  const outputPath = path.resolve('src/main/webapp/app/gis/data/baDiemBuildingsGis.json');
  const backupPath = path.resolve('src/main/webapp/app/gis/data/baDiemBuildingsGis.backup.json');

  if (fs.existsSync(outputPath)) {
    fs.copyFileSync(outputPath, backupPath);
    console.log(`Đã sao lưu file cũ sang: ${backupPath}`);
  }

  const geoJson = {
    type: 'FeatureCollection',
    name: 'baDiemBuildingsGis',
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
    },
    features: buildingFeatures,
  };

  fs.writeFileSync(outputPath, JSON.stringify(geoJson, null, 2), 'utf8');
  console.log(`Đã ghi thành công ${buildingFeatures.length} khối nhà vào: ${outputPath}`);
}

main().catch(console.error);
