import * as THREE from 'three';

export type RoofType = 'flat' | 'gabled' | 'hipped' | 'corrugated';

export interface Building3DParams {
  localPoints: [number, number][]; // [x, z] in local meters relative to centroid (0, 0)
  wallHeight: number;
  floors: number;
  roofType: RoofType;
  roofHeight?: number;
  wallColor?: string;
  roofColor?: string;
  category?: 'residential' | 'commercial' | 'other';
}

/**
 * Default color palettes matching authentic Vietnamese architecture in Bà Điểm, Hóc Môn
 */
export const DEFAULT_PALETTES = {
  residential: {
    wall: '#fef3c7', // Vàng kem kiến trúc nhà phố miền Nam
    roofTile: '#b91c1c', // Ngói đỏ đất nung Đồng Nai/Hạ Long
    roofSlate: '#334155', // Ngói màu xám đen Inari hiện đại
    roofBlue: '#0284c7', // Tôn xanh Hoa Sen
  },
  commercial: {
    wall: '#f1f5f9', // Tường sáng / showroom kính hiện đại
    roofTile: '#475569', // Mái bằng xám / bê tông chống thấm
    roofSlate: '#1e293b',
    roofBlue: '#0369a1',
  },
  other: {
    wall: '#fed7aa', // Vàng cam công sở, trường học, trạm y tế
    roofTile: '#c2410c', // Ngói đỏ truyền thống
    roofSlate: '#64748b',
    roofBlue: '#0284c7',
  },
};

/**
 * Ensures polygon points are oriented Counter-Clockwise (CCW) in 2D
 */
function ensureCounterClockwise(pts: [number, number][]): [number, number][] {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    area += p1[0] * p2[1] - p2[0] * p1[1];
  }
  // If Clockwise (area < 0), reverse array to make it CCW
  if (area < 0) {
    return [...pts].reverse();
  }
  return pts;
}

/**
 * Creates 3D extruded body, foundation plinth, architectural edges, and realistic roof
 */
export function createBuilding3DMesh(params: Building3DParams): {
  body: THREE.Mesh;
  roof: THREE.Mesh;
  group: THREE.Group;
} {
  const {
    localPoints: rawPoints,
    wallHeight,
    roofType = 'gabled',
    roofHeight = Math.max(1.8, Math.min(3.6, wallHeight * 0.32)),
    wallColor,
    roofColor,
    category = 'residential',
  } = params;

  // 1. Normalize winding order to CCW so Three.js ExtrudeGeometry faces outward
  const localPoints = ensureCounterClockwise(rawPoints);

  const defaultPalette = DEFAULT_PALETTES[category] || DEFAULT_PALETTES.residential;
  const effectiveWallColor = wallColor || defaultPalette.wall;
  const effectiveRoofColor =
    roofColor || (roofType === 'corrugated' ? defaultPalette.roofBlue : roofType === 'flat' ? '#64748b' : defaultPalette.roofTile);

  // Group containing all parts of the building
  const group = new THREE.Group();

  // 2. Build 2D Shape
  // (x, z) in Three.js -> Shape (x, -z) so North (-z) is +Y in 2D shape
  const shape = new THREE.Shape();
  localPoints.forEach(([px, pz], idx) => {
    if (idx === 0) shape.moveTo(px, -pz);
    else shape.lineTo(px, -pz);
  });
  shape.closePath();

  // 3. Extruded Foundation Plinth (Chân móng bê tông cao 0.3m tạo độ nổi rõ ràng)
  const plinthHeight = 0.35;
  const plinthGeom = new THREE.ExtrudeGeometry(shape, {
    depth: plinthHeight,
    bevelEnabled: false,
  });
  plinthGeom.rotateX(-Math.PI / 2);

  const plinthMat = new THREE.MeshStandardMaterial({
    color: '#334155', // Màu xám chân tường đá / bê tông
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const plinthMesh = new THREE.Mesh(plinthGeom, plinthMat);
  plinthMesh.position.y = 0.02;
  plinthMesh.receiveShadow = true;
  group.add(plinthMesh);

  // 4. Extruded Walls
  const netWallHeight = Math.max(2.5, wallHeight - plinthHeight);
  const wallGeom = new THREE.ExtrudeGeometry(shape, {
    depth: netWallHeight,
    bevelEnabled: false,
    curveSegments: 1,
  });
  wallGeom.rotateX(-Math.PI / 2);

  const wallMat = new THREE.MeshStandardMaterial({
    color: effectiveWallColor,
    roughness: 0.65,
    metalness: 0.08,
    side: THREE.DoubleSide,
    shadowSide: THREE.DoubleSide,
  });

  const wallMesh = new THREE.Mesh(wallGeom, wallMat);
  wallMesh.position.y = plinthHeight;
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  wallMesh.name = 'building-walls';
  group.add(wallMesh);

  // 5. Architectural Edges for Crisp Protrusion
  const edgesGeom = new THREE.EdgesGeometry(wallGeom, 35);
  const edgesMat = new THREE.LineBasicMaterial({
    color: 0x1e293b,
    linewidth: 1,
    transparent: true,
    opacity: 0.45,
  });
  const edgeLines = new THREE.LineSegments(edgesGeom, edgesMat);
  edgeLines.position.y = plinthHeight;
  group.add(edgeLines);

  // 6. Build Realistic Roof Geometry
  let roofGeom: THREE.BufferGeometry;

  if (roofType === 'flat') {
    roofGeom = createFlatRoofGeometry(localPoints, wallHeight, 0.75);
  } else if (roofType === 'hipped') {
    roofGeom = createHippedRoofGeometry(localPoints, wallHeight, roofHeight);
  } else if (roofType === 'corrugated') {
    roofGeom = createGabledRoofGeometry(localPoints, wallHeight, roofHeight * 0.65);
  } else {
    // Default Gabled roof (Mái thái chữ A)
    roofGeom = createGabledRoofGeometry(localPoints, wallHeight, roofHeight);
  }

  const roofMat = new THREE.MeshStandardMaterial({
    color: effectiveRoofColor,
    roughness: roofType === 'corrugated' ? 0.35 : 0.5,
    metalness: roofType === 'corrugated' ? 0.35 : 0.08,
    flatShading: true,
    side: THREE.DoubleSide,
    shadowSide: THREE.DoubleSide,
  });

  const roofMesh = new THREE.Mesh(roofGeom, roofMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  roofMesh.name = 'building-roof';
  group.add(roofMesh);

  // Add Roof Ridge & Eaves outline
  const roofEdgesGeom = new THREE.EdgesGeometry(roofGeom, 25);
  const roofEdgeLines = new THREE.LineSegments(
    roofEdgesGeom,
    new THREE.LineBasicMaterial({
      color: 0x0f172a,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.6,
    }),
  );
  group.add(roofEdgeLines);

  return { body: wallMesh, roof: roofMesh, group };
}

/**
 * Creates a gabled pitched roof (mái dốc 2 mái chữ A)
 */
function createGabledRoofGeometry(
  points: [number, number][],
  wallHeight: number,
  roofHeight: number,
  overhang = 0.35,
): THREE.BufferGeometry {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  points.forEach(([x, z]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  });

  const widthX = maxX - minX;
  const depthZ = maxZ - minZ;
  const isXLonger = widthX >= depthZ;

  const ridgeHeight = wallHeight + roofHeight;
  const vertices: number[] = [];
  const normals: number[] = [];

  let ridgeStart: [number, number, number];
  let ridgeEnd: [number, number, number];

  if (isXLonger) {
    const midZ = (minZ + maxZ) / 2;
    ridgeStart = [minX - overhang, ridgeHeight, midZ];
    ridgeEnd = [maxX + overhang, ridgeHeight, midZ];
  } else {
    const midX = (minX + maxX) / 2;
    ridgeStart = [midX, ridgeHeight, minZ - overhang];
    ridgeEnd = [midX, ridgeHeight, maxZ + overhang];
  }

  const N = points.length;
  for (let i = 0; i < N; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % N];

    const e1: [number, number, number] = [p1[0], wallHeight - 0.05, p1[1]];
    const e2: [number, number, number] = [p2[0], wallHeight - 0.05, p2[1]];

    const midP: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    let rPt: [number, number, number];

    if (isXLonger) {
      const clampedX = Math.max(ridgeStart[0], Math.min(ridgeEnd[0], midP[0]));
      rPt = [clampedX, ridgeHeight, ridgeStart[2]];
    } else {
      const clampedZ = Math.max(ridgeStart[2], Math.min(ridgeEnd[2], midP[1]));
      rPt = [ridgeStart[0], ridgeHeight, clampedZ];
    }

    addTriangle(vertices, normals, e1, e2, rPt);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a hipped / pyramidal 4-sloped roof (mái chóp thái)
 */
function createHippedRoofGeometry(points: [number, number][], wallHeight: number, roofHeight: number): THREE.BufferGeometry {
  const apex: [number, number, number] = [0, wallHeight + roofHeight, 0];
  const vertices: number[] = [];
  const normals: number[] = [];

  const N = points.length;
  for (let i = 0; i < N; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % N];

    const v1: [number, number, number] = [p1[0], wallHeight - 0.05, p1[1]];
    const v2: [number, number, number] = [p2[0], wallHeight - 0.05, p2[1]];

    addTriangle(vertices, normals, v1, v2, apex);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates flat roof slab with parapet lip
 */
function createFlatRoofGeometry(points: [number, number][], wallHeight: number, parapetHeight = 0.75): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  points.forEach(([px, pz], idx) => {
    if (idx === 0) shape.moveTo(px, -pz);
    else shape.lineTo(px, -pz);
  });
  shape.closePath();

  const slabGeom = new THREE.ExtrudeGeometry(shape, {
    depth: parapetHeight,
    bevelEnabled: false,
  });
  slabGeom.rotateX(-Math.PI / 2);
  slabGeom.translate(0, wallHeight, 0);

  return slabGeom;
}

function addTriangle(
  verts: number[],
  norms: number[],
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
) {
  verts.push(a[0], a[1], a[2]);
  verts.push(b[0], b[1], b[2]);
  verts.push(c[0], c[1], c[2]);

  const vA = new THREE.Vector3(...a);
  const vB = new THREE.Vector3(...b);
  const vC = new THREE.Vector3(...c);
  const cb = new THREE.Vector3().subVectors(vC, vB);
  const ab = new THREE.Vector3().subVectors(vA, vB);
  const norm = new THREE.Vector3().crossVectors(cb, ab).normalize();

  for (let i = 0; i < 3; i++) {
    norms.push(norm.x, norm.y, norm.z);
  }
}
