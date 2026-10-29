import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { readAppearance } from './appearance.js';

const vertexShader = `
  uniform sampler2D uMetadata;
  uniform sampler2D uPalette;
  uniform int uMetadataWidth;
  uniform int uMode;
  uniform float uPopulationMax;
  uniform vec3 uAlignmentColor;
  uniform sampler2D uAppearance;
  uniform bool uRealistic;
  uniform sampler2D uDisplay;
  uniform bool uUseDisplay;
  in float aFeature;
  #ifdef DIRECT_METADATA
    in vec4 aMetadata;
  #endif
  out vec3 vWorld;
  flat out vec4 vAppearance;
  flat out float vVisible;
  flat out vec3 vColor;
  flat out vec3 vNormal;
  vec3 palette(int index) { return texelFetch(uPalette, ivec2(index, 0), 0).rgb; }
  vec3 unpackColor(float packed) {
    uint value = uint(packed);
    vec3 rgb = vec3(float((value >> 16u) & 255u), float((value >> 8u) & 255u), float(value & 255u)) / 255.0;
    return pow(rgb, vec3(2.2));
  }
  void main() {
    int feature = int(aFeature + 0.5);
    vAppearance = texelFetch(uAppearance, ivec2(feature % uMetadataWidth, feature / uMetadataWidth), 0);
    #ifdef DIRECT_METADATA
      vec4 metadata = aMetadata;
    #else
      vec4 metadata = texelFetch(uMetadata, ivec2(feature % uMetadataWidth, feature / uMetadataWidth), 0);
    #endif
    vColor = uAlignmentColor;
    if (uMode == 1) vColor = metadata.z < 0.0 ? palette(0) : palette(1 + clamp(int(metadata.z), 0, 3));
    if (uMode == 2 || uMode == 3) {
      float value = uMode == 2 ? metadata.x : metadata.y;
      float maximum = uMode == 2 ? uPopulationMax : 130.0;
      vColor = value < 0.0 ? palette(0) : mix(palette(1), palette(4), clamp(value / maximum, 0.0, 1.0));
    }
    vec4 p = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      mat3 m = mat3(instanceMatrix);
      // Inverse-transpose equivalent for rotation + positive non-uniform scale, no shear.
      n /= vec3(dot(m[0], m[0]), dot(m[1], m[1]), dot(m[2], m[2]));
      n = m * n;
      p = instanceMatrix * p;
    #endif
    vNormal = normalize(mat3(modelMatrix) * n);
    vWorld = (modelMatrix * p).xyz;
    if (uRealistic && uMode == 0) vColor = unpackColor(vNormal.y > 0.3 ? vAppearance.y : vAppearance.x);
    vVisible = 1.0;
    if (uUseDisplay) {
      vec4 display = texelFetch(uDisplay, ivec2(feature % uMetadataWidth, feature / uMetadataWidth), 0);
      vVisible = display.y;
      if (display.x >= 0.0) vColor = unpackColor(display.x);
    }
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * p;
  }
`;

const fragmentShader = `
  precision highp float;
  flat in vec3 vColor;
  flat in vec3 vNormal;
  in vec3 vWorld;
  flat in vec4 vAppearance;
  flat in float vVisible;
  uniform bool uRealistic;
  uniform int uMode;
  out vec4 outColor;
  vec3 linearToSrgb(vec3 color) {
    return mix(1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
      color * 12.92, lessThanEqual(color, vec3(0.0031308)));
  }
  void main() {
    if (vVisible < 0.5) discard;
    float lighting = 0.40 + 0.60 * max(dot(normalize(vNormal), normalize(vec3(0.5, 1.0, 0.3))), 0.0);
    vec3 color = vColor * lighting;
    if (uRealistic) {
      // Stylized base darkening, not screen-space AO or cast shadows.
      color *= mix(0.64, 1.0, smoothstep(0.0, 2.0, vWorld.y));
      if (uMode == 0 && abs(vNormal.y) < 0.2) {
        vec2 facade = vec2(dot(vWorld.xz, normalize(vec2(-vNormal.z, vNormal.x))), vWorld.y);
        vec2 cell = facade / vec2(2.5, vAppearance.z);
        vec2 aa = max(fwidth(cell), vec2(0.001));
        vec2 pane = abs(fract(cell + vec2(vAppearance.w, 0.0)) - 0.5);
        vec2 mask = 1.0 - smoothstep(vec2(0.22, 0.26) - aa, vec2(0.22, 0.26) + aa, pane);
        float detail = 1.0 - smoothstep(0.12, 0.55, max(aa.x, aa.y));
        float windowMask = mask.x * mask.y * detail * smoothstep(0.5, 1.0, vWorld.y);
        color = mix(color, vec3(0.065, 0.10, 0.115) * lighting, windowMask * 0.82);
      }
      float haze = 1.0 - exp(-length(cameraPosition - vWorld) * 0.000025);
      color = mix(color, vec3(0.23, 0.28, 0.30), min(haze, 0.25));
    }
    outColor = vec4(linearToSrgb(color), 1.0);
  }
`;

const paletteColors = ['#64748b', '#22c55e', '#facc15', '#ef4444', '#a855f7'];

/** Geometry roots are translation-only. Do not apply a non-uniform parent scale. */
export class BuildingLayer {
  constructor(scene, renderer, { populationMax = 250, realistic = false } = {}) {
    this.renderer = renderer;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.scene = scene;
    this.boxReferences = new Map();
    this.paletteData = new Float32Array(5 * 4);
    this.palette = new THREE.DataTexture(this.paletteData, 5, 1, THREE.RGBAFormat, THREE.FloatType);
    this.palette.minFilter = this.palette.magFilter = THREE.NearestFilter;
    this.palette.generateMipmaps = false;
    this.uniforms = {
      uMetadata: { value: null },
      uMetadataWidth: { value: 1 },
      uPalette: { value: this.palette },
      uMode: { value: 0 },
      uPopulationMax: { value: Math.max(1, populationMax) },
      uAlignmentColor: { value: new THREE.Color('#b6c9d6') },
      uAppearance: { value: null },
      uRealistic: { value: realistic },
      uDisplay: { value: null },
      uUseDisplay: { value: false },
    };
    const parameters = {
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      glslVersion: THREE.GLSL3,
      depthTest: true,
      depthWrite: true,
      transparent: false,
      toneMapped: false,
    };
    this.material = new THREE.ShaderMaterial(parameters);
    this.instancedMaterial = new THREE.ShaderMaterial({ ...parameters, defines: { DIRECT_METADATA: 1 } });
    this.setPalette(paletteColors);
    this.disposed = false;
  }

  initialize(ids, metadata, appearance) {
    if (this.metadata) throw new Error('Metadata already initialized');
    this.indices = new Map();
    this.pendingIds = ids;
    this.indexCursor = 0;
    const max = this.renderer.capabilities.maxTextureSize;
    const width = Math.min(1024, max),
      height = Math.max(1, Math.ceil(ids.length / width));
    if (height > max) throw new Error('Metadata texture exceeds GPU limits');
    this.data = new Float32Array(width * height * 4).fill(-1);
    this.data.set(metadata);
    this.metadata = new THREE.DataTexture(this.data, width, height, THREE.RGBAFormat, THREE.FloatType);
    this.metadata.minFilter = this.metadata.magFilter = THREE.NearestFilter;
    this.metadata.generateMipmaps = false;
    this.metadata.needsUpdate = true;
    this.uniforms.uMetadata.value = this.metadata;
    this.uniforms.uMetadataWidth.value = width;
    const styles = new Float32Array(width * height * 4);
    if (appearance) styles.set(appearance);
    else
      ids.forEach((id, index) => {
        const style = readAppearance({}, id);
        styles.set([style.wall, style.roof, 3.2, style.seed], index * 4);
      });
    this.appearance = new THREE.DataTexture(styles, width, height, THREE.RGBAFormat, THREE.FloatType);
    this.appearance.minFilter = this.appearance.magFilter = THREE.NearestFilter;
    this.appearance.generateMipmaps = false;
    this.appearance.needsUpdate = true;
    this.uniforms.uAppearance.value = this.appearance;
  }

  buildIdIndex(budgetMs = 1) {
    if (!this.pendingIds || this.disposed) return;
    const deadline = performance.now() + budgetMs;
    while (this.indexCursor < this.pendingIds.length) {
      const end = Math.min(this.pendingIds.length, this.indexCursor + 256);
      for (; this.indexCursor < end; this.indexCursor++) this.indices.set(String(this.pendingIds[this.indexCursor]), this.indexCursor);
      if (performance.now() >= deadline) break;
    }
    if (this.indexCursor === this.pendingIds.length) this.pendingIds = null;
  }

  /** Preserve MapLibre filtering, household colors and selection on the custom layer. */
  setDisplayState(states) {
    if (this.disposed || this.pendingIds || !this.metadata) return;
    if (!this.display) {
      const { width, height } = this.metadata.image;
      this.displayData = new Float32Array(width * height * 4);
      this.display = new THREE.DataTexture(this.displayData, width, height, THREE.RGBAFormat, THREE.FloatType);
      this.display.minFilter = this.display.magFilter = THREE.NearestFilter;
      this.display.generateMipmaps = false;
      this.uniforms.uDisplay.value = this.display;
    }
    this.displayData.fill(0); // Missing/filtered features must never leak into the view.
    for (const state of states) {
      const index = this.indices.get(String(state.id));
      if (index === undefined) continue;
      this.displayData[index * 4] = /^#[\da-f]{6}$/i.test(state.color ?? '') ? Number.parseInt(state.color.slice(1), 16) : -1;
      this.displayData[index * 4 + 1] = state.visible ? 1 : 0;
    }
    this.display.needsUpdate = true;
    this.uniforms.uUseDisplay.value = true;
  }

  add({ origin, packet }) {
    if (this.disposed) return;
    if (packet.indices.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(packet.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(packet.normals, 3));
      geometry.setAttribute('aFeature', new THREE.BufferAttribute(packet.features, 1));
      geometry.setIndex(new THREE.BufferAttribute(packet.indices, 1));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.material);
      this.place(mesh, origin);
    }
    if (packet.boxes.length) {
      const count = packet.boxes.length / 7;
      const geometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const attribute = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('aMetadata', attribute);
      const features = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
      geometry.setAttribute('aFeature', features);
      const mesh = new THREE.InstancedMesh(geometry, this.instancedMaterial, count);
      const matrix = new THREE.Matrix4(),
        quaternion = new THREE.Quaternion(),
        scale = new THREE.Vector3(),
        position = new THREE.Vector3();
      const axis = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < count; i++) {
        const offset = i * 7,
          values = packet.boxes;
        const feature = values[offset + 6];
        features.array[i] = feature;
        position.set(values[offset], 0, values[offset + 1]);
        quaternion.setFromAxisAngle(axis, values[offset + 5]);
        scale.set(values[offset + 2], values[offset + 4], values[offset + 3]);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(i, matrix);
        attribute.array.set(this.data.subarray(feature * 4, feature * 4 + 4), i * 4);
        if (!this.boxReferences.has(feature)) this.boxReferences.set(feature, []);
        this.boxReferences.get(feature).push({ attribute, index: i });
      }
      mesh.instanceMatrix.needsUpdate = true;
      attribute.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      this.place(mesh, origin);
    }
  }

  place(mesh, origin) {
    mesh.position.set(origin[0], 0, origin[1]);
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    this.root.add(mesh);
  }

  setMode(mode) {
    if (this.disposed) return;
    const modes = { alignment: 0, safety: 1, population: 2, age: 3 };
    if (!Object.hasOwn(modes, mode)) throw new Error('Unknown visualization mode');
    this.uniforms.uMode.value = modes[mode]; // O(1): never recolor 79k meshes in a React render.
  }

  setPalette(colors) {
    if (this.disposed) return;
    if (colors.length !== 5) throw new Error('Palette requires unknown, normal, warning, danger, critical');
    const color = new THREE.Color();
    colors.forEach((value, i) => {
      color.set(value); // Three.js converts input sRGB colors into linear working colors.
      this.paletteData.set([color.r, color.g, color.b, 1], i * 4);
    });
    this.palette.needsUpdate = true; // Only 80 bytes, not a per-building recolor pass.
  }

  updateMetadata(id, { population, averageAge, status }) {
    if (this.disposed) return false;
    const feature = this.indices?.get(String(id));
    if (feature === undefined) return false;
    const offset = feature * 4;
    if (population !== undefined) this.data[offset] = Number.isFinite(population) && population >= 0 ? population : -1;
    if (averageAge !== undefined)
      this.data[offset + 1] = Number.isFinite(averageAge) && averageAge >= 0 && averageAge <= 130 ? averageAge : -1;
    if (status !== undefined) this.data[offset + 2] = Number.isInteger(status) && status >= 0 && status <= 3 ? status : -1;
    this.metadata.needsUpdate = true; // Batch many edits before the next render; ~1.3 MB for 79k features.
    for (const { attribute, index } of this.boxReferences.get(feature) || []) {
      attribute.array.set(this.data.subarray(offset, offset + 4), index * 4);
      attribute.addUpdateRange(index * 4, 4);
      attribute.needsUpdate = true;
    }
    return true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of this.root.children) {
      if (mesh.isInstancedMesh) mesh.dispose();
      mesh.geometry.dispose();
    }
    this.root.clear();
    this.scene.remove(this.root);
    this.material.dispose();
    this.instancedMaterial.dispose();
    this.metadata?.dispose();
    this.appearance?.dispose();
    this.display?.dispose();
    if (this.display) this.display.image = null;
    this.displayData = null;
    this.uniforms.uDisplay.value = null;
    if (this.appearance) this.appearance.image = null;
    this.uniforms.uAppearance.value = null;
    this.palette.dispose();
    if (this.metadata) this.metadata.image = null;
    this.palette.image = null;
    this.uniforms.uMetadata.value = this.uniforms.uPalette.value = null;
    this.data = this.paletteData = null;
    this.pendingIds = null;
    this.indices?.clear();
    this.boxReferences.clear();
  }
}

/** Alternative for existing compatible BufferGeometries. Ownership of inputs is transferred. */
export function mergeOwnedSectorGeometries(geometries) {
  try {
    const merged = mergeGeometries(geometries, false);
    if (!merged) throw new Error('Geometry attributes/indexing are not compatible');
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
  } finally {
    for (const geometry of geometries) geometry.dispose();
    geometries.length = 0;
  }
}
