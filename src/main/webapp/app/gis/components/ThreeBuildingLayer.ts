import maplibregl, { CustomLayerInterface, Map as MapLibreMap } from 'maplibre-gl';
import * as THREE from 'three';

export interface ThreeBuilding {
  id: string;
  coordinates: number[][][];
  height: number;
  color: string;
  statusColor?: string;
}

/** Instanced, lightweight building bodies and roofs in the MapLibre camera. */
export class ThreeBuildingLayer implements CustomLayerInterface {
  readonly id = 'three-buildings';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;
  visible = true;

  private map?: MapLibreMap;
  private renderer?: THREE.WebGLRenderer;
  private camera = new THREE.Camera();
  private scene = new THREE.Scene();
  private origin?: maplibregl.MercatorCoordinate;
  private scale = 1;
  private meshes: THREE.InstancedMesh[] = [];
  private data: ThreeBuilding[] = [];
  private hoveredId: string | null = null;
  private instanceColors = new Map<string, { index: number; body: THREE.Color; roof: THREE.Color; base: THREE.Color }>();

  constructor(data: ThreeBuilding[] = []) {
    this.data = data;
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(-40, 60, 120);
    this.scene.add(sun);
    this.rebuild();
  }

  setBuildings(data: ThreeBuilding[]): void {
    this.data = data;
    this.rebuild();
    this.map?.triggerRepaint();
  }

  setHoveredId(id: string | null): void {
    if (this.hoveredId === id) return;
    const previous = this.hoveredId;
    this.hoveredId = id;
    if (previous) this.paintInstance(previous, false);
    if (id) this.paintInstance(id, true);
    this.map?.triggerRepaint();
  }

  private paintInstance(id: string, highlighted: boolean): void {
    const stored = this.instanceColors.get(id);
    if (!stored || this.meshes.length !== 3) return;
    const [base, body, roof] = this.meshes;
    const accent = new THREE.Color('#fff2a8');
    base.setColorAt(stored.index, highlighted ? accent : stored.base);
    body.setColorAt(stored.index, highlighted ? accent : stored.body);
    roof.setColorAt(stored.index, highlighted ? accent : stored.roof);
    for (const mesh of this.meshes) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private rebuild(): void {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.meshes = [];
    this.instanceColors.clear();
    const first = this.data.find(building => building.coordinates[0]?.[0]);
    if (!first) return;
    const [lng, lat] = first.coordinates[0][0];
    this.origin = maplibregl.MercatorCoordinate.fromLngLat([lng, lat]);
    this.scale = this.origin.meterInMercatorCoordinateUnits();
    const body = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      this.data.length,
    );
    const roof = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      this.data.length,
    );
    const base = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      this.data.length,
    );
    const dummy = new THREE.Object3D();
    let count = 0;
    for (const building of this.data) {
      const ring = building.coordinates[0];
      if (!ring || ring.length < 4) continue;
      const points = ring.map(([x, y]) => maplibregl.MercatorCoordinate.fromLngLat([x, y]));
      const east = points.map(point => (point.x - this.origin!.x) / this.scale);
      const north = points.map(point => (this.origin!.y - point.y) / this.scale);
      const minX = Math.min(...east);
      const maxX = Math.max(...east);
      const minY = Math.min(...north);
      const maxY = Math.max(...north);
      const width = maxX - minX;
      const depth = maxY - minY;
      if (!(width > 0.25 && depth > 0.25 && width < 200 && depth < 200)) continue;
      const x = (minX + maxX) / 2;
      const y = (minY + maxY) / 2;
      const height = Math.max(2, Math.min(building.height || 3.5, 100));
      const color = new THREE.Color(building.color || '#d8e2e9');
      const roofColor = new THREE.Color(building.statusColor || building.color).multiplyScalar(0.88);
      const baseColor = color.clone().multiplyScalar(0.78);
      dummy.position.set(x, y, height / 2);
      // Slightly wider than the MapLibre extrusion beneath it, so the custom
      // material remains visible while the native block provides a fallback.
      dummy.scale.set(width + 0.08, depth + 0.08, height + 0.06);
      dummy.updateMatrix();
      body.setMatrixAt(count, dummy.matrix);
      body.setColorAt(count, color);
      dummy.position.set(x, y, height + 0.48);
      dummy.scale.set(width + 0.35, depth + 0.35, 0.35);
      dummy.updateMatrix();
      roof.setMatrixAt(count, dummy.matrix);
      roof.setColorAt(count, roofColor);
      dummy.position.set(x, y, 0.13);
      dummy.scale.set(width + 0.22, depth + 0.22, 0.26);
      dummy.updateMatrix();
      base.setMatrixAt(count, dummy.matrix);
      base.setColorAt(count, baseColor);
      this.instanceColors.set(building.id, { index: count, body: color, roof: roofColor, base: baseColor });
      count++;
    }
    for (const mesh of [base, body, roof]) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
    if (this.hoveredId) this.paintInstance(this.hoveredId, true);
  }

  render(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    { modelViewProjectionMatrix }: { modelViewProjectionMatrix: ArrayLike<number> },
  ): void {
    if (!this.visible || !this.renderer || !this.origin || !this.meshes.length) return;
    const transform = new THREE.Matrix4()
      .makeTranslation(this.origin.x, this.origin.y, this.origin.z)
      .scale(new THREE.Vector3(this.scale, -this.scale, this.scale));
    this.camera.projectionMatrix.fromArray(modelViewProjectionMatrix).multiply(transform);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();
  }

  onRemove(): void {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.meshes = [];
    this.renderer?.dispose();
    this.renderer = undefined;
    this.map = undefined;
  }
}
