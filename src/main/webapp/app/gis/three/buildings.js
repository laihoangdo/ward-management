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
  uniform sampler2D uStack;
  uniform bool uUseStack;
  in float aFeature;
  #ifdef DIRECT_METADATA
    in vec4 aMetadata;
  #endif
  #ifndef USE_INSTANCING
    in vec2 aEdge;
  #endif
  out vec3 vWorld;
  // Outline data: x = signed distance from the middle of the wall, y = distance below the wall top (< 0: no outline).
  out vec2 vEdge;
  flat out float vEdgeHalf;
  // Cumulative share of households per status, most severe first; a < 0 means the building has no stack.
  flat out vec4 vStack;
  flat out vec4 vAppearance;
  flat out float vVisible;
  flat out float vHighlight;
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
      // Unit box: x and z span -0.5..0.5, y spans 0..1; the instance scale turns that into metres.
      vec3 size = vec3(length(m[0]), length(m[1]), length(m[2]));
      vEdge = vec2(0.0, -1.0);
      vEdgeHalf = 0.0;
      if (abs(normal.y) < 0.5) {
        bool alongZ = abs(normal.x) > 0.5;
        vEdgeHalf = 0.5 * (alongZ ? size.z : size.x);
        vEdge = vec2((alongZ ? position.z * size.z : position.x * size.x), (1.0 - position.y) * size.y);
      }
      p = instanceMatrix * p;
    #else
      vEdge = aEdge;
      vEdgeHalf = abs(aEdge.x);
    #endif
    vNormal = normalize(mat3(modelMatrix) * n);
    vec4 world = modelMatrix * p;
    if (uRealistic && uMode == 0) vColor = unpackColor(vNormal.y > 0.3 ? vAppearance.y : vAppearance.x);
    vVisible = 1.0;
    vHighlight = 0.0;
    vStack = vec4(-1.0);
    if (uUseStack && uRealistic && uMode == 0) vStack = texelFetch(uStack, ivec2(feature % uMetadataWidth, feature / uMetadataWidth), 0);
    if (uUseDisplay) {
      // x: packed colour (-1 keeps the appearance), y: 1 visible / 0.5 dimmed / 0 hidden, z: status tint, w: highlight level.
      vec4 display = texelFetch(uDisplay, ivec2(feature % uMetadataWidth, feature / uMetadataWidth), 0);
      vVisible = display.y;
      vHighlight = display.w;
      if (display.x >= 0.0) {
        vec3 tint = unpackColor(display.x);
        // A household status colours the roof; walls keep their material so the block still reads as a house.
        bool keepWall = display.z > 0.5 && uRealistic && uMode == 0 && vNormal.y <= 0.3;
        vColor = keepWall ? mix(vColor, tint, 0.3) : tint;
      }
      if (display.y > 0.25 && display.y < 0.75) {
        // Filtered out: a low grey block keeps the street layout readable without competing with the matches.
        world.y *= 0.25;
        vEdge.y *= 0.25;
        vColor = vec3(0.3, 0.33, 0.35);
      }
    }
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = `
  precision highp float;
  flat in vec3 vColor;
  flat in vec3 vNormal;
  in vec3 vWorld;
  flat in vec4 vAppearance;
  flat in float vVisible;
  flat in float vHighlight;
  in vec2 vEdge;
  flat in float vEdgeHalf;
  flat in vec4 vStack;
  uniform vec3 uStatusColors[5];
  uniform vec3 uCamera;
  uniform bool uRealistic;
  uniform int uMode;
  out vec4 outColor;
  vec3 linearToSrgb(vec3 color) {
    return mix(1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
      color * 12.92, lessThanEqual(color, vec3(0.0031308)));
  }
  void main() {
    if (vVisible < 0.25) discard;
    bool dimmed = vVisible < 0.75;
    vec3 n = normalize(vNormal);
    vec3 sunDir = normalize(vec3(0.55, 0.92, 0.38));
    vec3 fillDir = normalize(vec3(-0.45, 0.65, -0.35));
    float sun = max(dot(n, sunDir), 0.0);
    float fill = max(dot(n, fillDir), 0.0);
    float sky = 0.5 + 0.5 * n.y;
    float lighting = 0.34 + 0.54 * sun + 0.14 * fill + 0.08 * sky;
    vec3 albedo = vColor;
    if (vStack.a >= 0.0 && vEdge.y >= 0.0 && !dimmed) {
      // Walls of a multi-household building become a stacked bar: each band's height is that status's share of the
      // households (most severe on top, where it is seen first). It is a proportion, not the floor a household lives on.
      float share = vEdge.y / max(vWorld.y + vEdge.y, 0.001);
      vec3 band = share < vStack.r ? uStatusColors[0] : share < vStack.g ? uStatusColors[1]
        : share < vStack.b ? uStatusColors[2] : share < vStack.a ? uStatusColors[3] : uStatusColors[4];
      albedo = mix(vColor, band, 0.78);
    }
    vec3 color = albedo * lighting;
    if (uRealistic) {
      // Warm direct sun over a slightly cool sky fill, same overall exposure as the scalar term.
      color = albedo * ((0.34 + 0.08 * sky) * vec3(0.95, 0.99, 1.06) + 0.54 * sun * vec3(1.07, 1.0, 0.9) + 0.14 * fill);
      // Stylized base AO darkening + warm sunlit roof highlight
      color *= mix(0.62, 1.04, smoothstep(0.0, 2.6, vWorld.y));
      if (n.y > 0.35) {
        // Subtle roof ridge/tile texture modulation
        float roofWave = 0.96 + 0.04 * sin(dot(vWorld.xz, vec2(3.2, 3.2)));
        color *= roofWave;
      }
      if (uMode == 0 && abs(n.y) < 0.2 && !dimmed) {
        float floorH = max(vAppearance.z, 2.6);
        vec2 facade = vec2(dot(vWorld.xz, normalize(vec2(-n.z, n.x))), vWorld.y);
        // Floor slab horizontal band (chỉ phân tầng)
        float slabDist = abs(fract(vWorld.y / floorH) - 0.5);
        float slabLine = 1.0 - smoothstep(0.45, 0.49, slabDist);
        color = mix(color * 0.82, color, slabLine);

        vec2 cell = facade / vec2(2.3, floorH);
        vec2 aa = max(fwidth(cell), vec2(0.001));
        vec2 pane = abs(fract(cell + vec2(vAppearance.w, 0.0)) - 0.5);
        vec2 mask = 1.0 - smoothstep(vec2(0.21, 0.25) - aa, vec2(0.21, 0.25) + aa, pane);
        float detail = 1.0 - smoothstep(0.14, 0.58, max(aa.x, aa.y));
        float windowMask = mask.x * mask.y * detail * smoothstep(0.55, 1.15, vWorld.y);
        vec3 glassColor = mix(vec3(0.07, 0.12, 0.15), vec3(0.16, 0.24, 0.29), clamp(vWorld.y / 14.0, 0.0, 1.0)) * lighting;
        // Per-pane variation: drawn blinds and sky reflection differ from window to window.
        vec2 paneId = floor(cell + vec2(vAppearance.w, 0.0));
        float paneSeed = fract(sin(dot(paneId, vec2(12.9898, 78.233)) + vAppearance.w * 43.0) * 43758.5453);
        glassColor *= mix(0.7, 1.55, paneSeed);
        color = mix(color, glassColor, windowMask * 0.84);
      }
      if (vEdge.y >= 0.0) {
        // Drawn outline on wall corners and the roof line, like a modelling viewport. It fades out once a pixel
        // covers more than about a metre, so distant blocks do not turn into dark noise.
        float edge = min(vEdgeHalf - abs(vEdge.x), vEdge.y);
        float aa = max(fwidth(edge), 0.0001);
        float line = (1.0 - smoothstep(0.1, 0.1 + aa, edge)) * (1.0 - smoothstep(0.25, 1.2, aa));
        color *= 1.0 - 0.4 * line;
      }
      float haze = 1.0 - exp(-length(uCamera - vWorld) * 0.000022);
      color = mix(color, vec3(0.25, 0.30, 0.32), min(haze, 0.22));
    }
    // Selection (1.0) and hover (0.5) stay readable in every colour mode and at any distance.
    if (vHighlight > 0.0) {
      vec3 glow = vec3(0.965, 0.521, 0.018) * (0.62 + 0.5 * lighting);
      color = mix(color, glow, vHighlight > 0.75 ? 0.8 : 0.4);
    }
    outColor = vec4(linearToSrgb(color), 1.0);
  }
`;

// Planar sun shadow: each roof is sheared onto the ground along the sun direction used by the facade lighting.
// One multiply pass, no shadow map, no extra geometry; walls are collapsed so a building darkens the ground once.
const shadowVertexShader = `
  uniform sampler2D uDisplay;
  uniform bool uUseDisplay;
  uniform int uMetadataWidth;
  in float aFeature;
  void main() {
    vec4 p = vec4(position, 1.0);
    float up = normal.y;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
    #endif
    float shown = 1.0;
    if (uUseDisplay) {
      int feature = int(aFeature + 0.5);
      shown = texelFetch(uDisplay, ivec2(feature % uMetadataWidth, feature / uMetadataWidth), 0).y;
    }
    if (up <= 0.3 || shown < 0.25) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec4 world = modelMatrix * p;
    if (shown < 0.75) world.y *= 0.25; // dimmed buildings are drawn flattened, so their shadow shortens with them
    // Same sun as the fragment shader: normalize(0.55, 0.92, 0.38). Length is capped so tall blocks keep an attached shadow.
    world.xz -= vec2(0.598, 0.413) * min(world.y, 12.0);
    world.y = 0.06;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const shadowFragmentShader = `
  precision highp float;
  out vec4 outColor;
  void main() {
    outColor = vec4(0.66, 0.69, 0.76, 1.0);
  }
`;

// Selected building seen through whatever stands in front of it: drawn only where the depth test fails.
const ghostVertexShader = `
  uniform sampler2D uDisplay;
  uniform int uMetadataWidth;
  in float aFeature;
  void main() {
    vec4 p = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
    #endif
    int feature = int(aFeature + 0.5);
    vec4 display = texelFetch(uDisplay, ivec2(feature % uMetadataWidth, feature / uMetadataWidth), 0);
    if (display.w < 0.75 || display.y < 0.25) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec4 world = modelMatrix * p;
    if (display.y < 0.75) world.y *= 0.25;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const ghostFragmentShader = `
  precision highp float;
  out vec4 outColor;
  void main() {
    outColor = vec4(0.984, 0.749, 0.141, 0.38);
  }
`;

/** Most severe first; must match the band order in the fragment shader and the caller's `stack` arrays. */
const statusColors = ['#ef4444', '#f59e0b', '#38bdf8', '#10b981', '#94a3b8']; // taste-skill-ignore: màu trạng thái hộ dân có sẵn

const paletteColors = ['#64748b', '#22c55e', '#facc15', '#ef4444', '#a855f7']; // taste-skill-ignore: thang màu dữ liệu công trình, không đổi renderer trong đợt UI

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
      uCamera: { value: new THREE.Vector3() },
      uStack: { value: null },
      uUseStack: { value: false },
      uStatusColors: { value: statusColors.map(value => new THREE.Color(value)) },
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
    // Opaque queue (drawn before the buildings via renderOrder) with multiply blending: dst * shade.
    this.shadowMaterial = new THREE.ShaderMaterial({
      vertexShader: shadowVertexShader,
      fragmentShader: shadowFragmentShader,
      uniforms: this.uniforms,
      glslVersion: THREE.GLSL3,
      depthTest: true,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
    });
    // Transparent queue, so it draws after every building; GreaterDepth keeps it to the occluded part only.
    this.ghostMaterial = new THREE.ShaderMaterial({
      vertexShader: ghostVertexShader,
      fragmentShader: ghostFragmentShader,
      uniforms: this.uniforms,
      glslVersion: THREE.GLSL3,
      depthTest: true,
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
    });
    this.ghostRoot = new THREE.Group();
    scene.add(this.ghostRoot);
    this.featureMeshes = new Map();
    this.ghostFeature = -1;
    this.shadowRoot = new THREE.Group();
    this.shadowRoot.visible = realistic;
    scene.add(this.shadowRoot);
    this.setPalette(paletteColors);
    this.highlights = [];
    this.highlighted = [];
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
    this.stackData?.fill(-1);
    this.stackUsed = false;
    for (const state of states) {
      const index = this.indices.get(String(state.id));
      if (index === undefined) continue;
      this.displayData[index * 4] = /^#[\da-f]{6}$/i.test(state.color ?? '') ? Number.parseInt(state.color.slice(1), 16) : -1;
      this.displayData[index * 4 + 1] = state.visible ? (state.dim ? 0.5 : 1) : 0;
      this.displayData[index * 4 + 2] = state.tint ? 1 : 0;
      if (state.stack) this.writeStack(index, state.stack);
    }
    if (this.stack) this.stack.needsUpdate = true;
    this.uniforms.uUseStack.value = Boolean(this.stackUsed);
    this.highlighted = [];
    this.display.needsUpdate = true;
    this.uniforms.uUseDisplay.value = true;
    this.setHighlights(this.highlights);
  }

  /** counts: households per status in the order alert, warning, business, normal, unverified. */
  writeStack(index, counts) {
    const total = counts.reduce((sum, value) => sum + value, 0);
    if (!(total > 0)) return;
    if (!this.stack) {
      const { width, height } = this.metadata.image;
      this.stackData = new Float32Array(width * height * 4).fill(-1);
      this.stack = new THREE.DataTexture(this.stackData, width, height, THREE.RGBAFormat, THREE.FloatType);
      this.stack.minFilter = this.stack.magFilter = THREE.NearestFilter;
      this.stack.generateMipmaps = false;
      this.uniforms.uStack.value = this.stack;
    }
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      sum += counts[i] || 0;
      this.stackData[index * 4 + i] = sum / total;
    }
    this.stackUsed = true;
  }

  /** Re-point the see-through pass at the meshes that hold the selected building (level 1), or clear it. */
  updateGhost() {
    let selected = -1;
    for (const index of this.highlighted) if (this.displayData[index * 4 + 3] > 0.75) selected = index;
    if (selected === this.ghostFeature) return;
    this.ghostFeature = selected;
    for (const ghost of this.ghostRoot.children) if (ghost.isInstancedMesh) ghost.dispose(); // geometry is owned by the building mesh
    this.ghostRoot.clear();
    for (const mesh of this.featureMeshes.get(selected) ?? []) {
      let ghost;
      if (mesh.isInstancedMesh) {
        ghost = new THREE.InstancedMesh(mesh.geometry, this.ghostMaterial, mesh.count);
        ghost.instanceMatrix = mesh.instanceMatrix;
        ghost.boundingBox = mesh.boundingBox;
        ghost.boundingSphere = mesh.boundingSphere;
      } else ghost = new THREE.Mesh(mesh.geometry, this.ghostMaterial);
      ghost.matrix.copy(mesh.matrix);
      ghost.matrixAutoUpdate = false;
      this.ghostRoot.add(ghost);
    }
  }

  /** Remember which mesh draws each feature, so the see-through pass touches one or two meshes, not the scene. */
  indexFeatures(features, mesh) {
    let previous = -1;
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      if (feature === previous) continue;
      previous = feature;
      const list = this.featureMeshes.get(feature);
      if (!list) this.featureMeshes.set(feature, [mesh]);
      else if (!list.includes(mesh)) list.push(mesh);
    }
  }

  /** O(changed) selection/hover: touches only the texels involved, never the 79k-entry state list. */
  setHighlights(highlights) {
    if (this.disposed) return;
    this.highlights = highlights;
    if (!this.display || this.pendingIds) return;
    for (const index of this.highlighted) this.displayData[index * 4 + 3] = 0;
    this.highlighted = [];
    for (const { id, level } of highlights) {
      const index = this.indices.get(String(id));
      if (index === undefined) continue;
      this.displayData[index * 4 + 3] = level;
      this.highlighted.push(index);
    }
    this.updateGhost();
    this.display.needsUpdate = true;
  }

  add({ origin, packet }) {
    if (this.disposed) return;
    if (packet.indices.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(packet.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(packet.normals, 3));
      geometry.setAttribute('aFeature', new THREE.BufferAttribute(packet.features, 1));
      // Packets built without outline data must not default to (0, 0), which would paint every wall dark.
      let edges = packet.edges;
      if (!edges || edges.length !== packet.features.length * 2) {
        edges = new Float32Array(packet.features.length * 2);
        for (let i = 1; i < edges.length; i += 2) edges[i] = -1;
      }
      geometry.setAttribute('aEdge', new THREE.BufferAttribute(edges, 2));
      geometry.setIndex(new THREE.BufferAttribute(packet.indices, 1));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.material);
      this.place(mesh, origin);
      this.indexFeatures(packet.features, mesh);
      this.placeShadow(new THREE.Mesh(geometry, this.shadowMaterial), origin);
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
      this.indexFeatures(features.array, mesh);
      const shadow = new THREE.InstancedMesh(geometry, this.shadowMaterial, count);
      shadow.instanceMatrix = mesh.instanceMatrix;
      shadow.boundingBox = mesh.boundingBox;
      shadow.boundingSphere = mesh.boundingSphere.clone();
      shadow.boundingSphere.radius += 8; // the cast shadow reaches a few metres past the sector
      this.placeShadow(shadow, origin);
    }
  }

  place(mesh, origin) {
    mesh.position.set(origin[0], 0, origin[1]);
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    this.root.add(mesh);
  }

  /** Shadows share the building geometry; they only get their own transform and draw order. */
  placeShadow(mesh, origin) {
    mesh.position.set(origin[0], 0, origin[1]);
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = -1;
    this.shadowRoot.add(mesh);
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
    for (const mesh of this.shadowRoot.children) if (mesh.isInstancedMesh) mesh.dispose(); // geometry is owned by the building mesh
    this.shadowRoot.clear();
    this.scene.remove(this.shadowRoot);
    for (const ghost of this.ghostRoot.children) if (ghost.isInstancedMesh) ghost.dispose();
    this.ghostRoot.clear();
    this.scene.remove(this.ghostRoot);
    this.ghostMaterial.dispose();
    this.featureMeshes.clear();
    this.stack?.dispose();
    if (this.stack) this.stack.image = null;
    this.stackData = null;
    this.uniforms.uStack.value = null;
    this.shadowMaterial.dispose();
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
