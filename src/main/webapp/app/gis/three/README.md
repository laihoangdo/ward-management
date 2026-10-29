# Three.js effects on the existing MapLibre field map

The dashboard has one existing `FieldHouseMap` renderer. The two separate standalone/experimental viewer tabs have been removed. Its opt-in **Hiệu ứng Three.js** button attaches an effect layer to the same map, camera and WebGL canvas; it does not replace map navigation or business functionality.

## Retained modules

| Module                  | Purpose                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `field-effects.js`      | Attach/remove effects on an existing MapLibre map; bounded worker admission and lifecycle                          |
| `maplibre-transform.js` | Convert local east/up/south coordinates to MapLibre normalized Mercator                                            |
| `geo.js`                | Explicit EPSG:4326/3857 conversion and anchored coordinate helpers                                                 |
| `geometry.worker.js`    | Worker parsing, sector grouping, acknowledged transferable geometry packets                                        |
| `geometry.js`           | Earcut roofs/courtyards, direct wall streams, exact rectangular templates and gable roofs                          |
| `appearance.js`         | Appearance parsing and deterministic fallbacks for features without material fields                                |
| `buildings.js`          | Batched/instanced geometry, procedural windows, colors, base darkening, haze and GPU display-state synchronization |

MapLibre continues to load the original offline raster sources. There is no separate Three.js tile loader, canvas, OrbitControls or standalone viewer. `maplibre-gl-three` is not installed: MapLibre 5's native custom layer avoids a major-version upgrade.

## Data

`src/main/webapp/content/data/badiem-houses.geojson` is the single shared dataset for MapLibre and Three.js: 79,109 features with unchanged IDs/footprints. Explicit `height`, `levels`, `floorHeight`, `wallColor`, `roofColor`, `roofShape` and `appearanceSeed` were merged from the former visual copy **by buildingId**, including 238 gabled features. No feature lists were concatenated. The visual copy, its generator and the secondary HTTP fetch were removed. Both render paths read the same materialized heights; toggling effects no longer changes their source.

The unified file retains `synthetic:true`, the pre-merge source SHA-256, derivation version and `unified:true` in `visualizationProvenance`; feature-level `visualizationSource`, `heightSource` and `estimated` retain provenance. These are explicit visualization inputs, not surveyed facts or verified satellite classifications. No demographics or security statuses are fabricated. The one-time migration verified every ID and footprint, and backed up the previous source under ignored `target/building-data-migration/badiem-houses.before-merge.geojson` (not an application asset). The unified file is about 45.7 MiB. Full JSON parsing and worker structured cloning can still cause load-time pauses, but no second coordinate collection is downloaded or retained for effects.

## Preservation of existing functions

- `houses` state comes from the shared GeoJSON merged with saved API records. Saved geometry, heights, household links and permissions take precedence; base material fields absent from API DTOs are retained during initial loading and save/auto-link responses.
- Moving, drawing, linking and permission checks retain their existing behavior, with the 20-floor cap on new saves. Height/estimated fields use the shared record. Inherited visual-only fields are stripped from save/auto-link DTOs; explicitly edited manual materials are retained. No database migration is required. Merely enabling effects does not invoke persistence endpoints.
- Native `houses-3d` stays installed and queryable. Its opacity becomes zero only after effects are ready; disabling effects or a load/render failure restores native opacity 0.88.
- GPU display state mirrors occupancy/status filters, household colors and gold selection highlights. Geometry is not rebuilt for selection/filter changes.
- The effect layer is placed before household/point layers. Point representation and the buildings checkbox disable effects appropriately. Existing screenshot capture keeps using the same canvas.

## Editing selected buildings

Users with coordinate-edit permission and territory access can open **Sửa thuộc tính khối nhà** in the selected-building panel. They can change name, floors, height, wall/roof colors, flat/gable roof and the estimated-height checkbox. Geometry, ID and household links are retained. Input is limited to integral 1–20 floors and height 0.5–70 m; changing floors suggests 3.5 m per floor, while height can be adjusted independently within the cap. The same cap applies when drawing a new building and is enforced by the API (including alternate `levels` input).

Edits use the existing permission/territory-checked PUT endpoint and `gis_field_building.feature_json` storage; no schema migration is needed. Manual appearance is marked `appearanceSource:'manual'` so material fields survive persistence, linking and movement. Inherited synthetic material metadata is still not implicitly persisted. Native MapLibre uses wall color for its single extrusion color; Three.js keeps separate wall/roof colors except when selection or household status overrides the display. Gable geometry remains restricted to rectangular footprints; unsupported footprints retain flat roofs. Estimated height is never silently relabeled as surveyed.

## Coordinates, rendering and disposal

Projection subtracts the anchor in double precision and uploads sector-local Float32 vertices. East is +X, north is −Z and Y is up. Horizontal normalization uses EPSG:3857's circumference and anchor cosine; elevation uses MapLibre's altitude scale separately to avoid radius-dependent alignment drift.

Workers batch irregular footprints by sector and instance only exact rectangles. Courtyards are preserved. Gables are restricted to exact rectangular footprints; irregular/unsupported roofs stay flat. Procedural windows are derivative-filtered and fade at distance. Base darkening and haze are decorative approximations, not real AO or cast shadows. Shader haze uses an approximate local eye because the shared camera transform is folded into the projection.

The shared renderer uses `autoClear:false` and resets GL state before/after rendering. Disposal terminates the worker, clears queued packets and GPU lookups, disposes geometries/materials/metadata/appearance/display textures and removes only the custom layer. It **never** loses the host MapLibre context or removes the host map. Host-map removal and repeated disposal are safe.

## Validation

```sh
npx vitest run src/main/webapp/app/gis/components/FieldHouseMap.spec.tsx src/main/webapp/app/gis/three
npx tsc --noEmit
```

Tests cover coordinates/elevation alignment, polygon winding/courtyards, deterministic appearance, GPU display state and disposal, existing field-map controls, native fallback, selection synchronization and synthetic-free household-link payloads. The isolated browser fixture under ignored `target/` exercises the actual field-map component with real GeoJSON/offline tiles and fixture-only API responses: one shared canvas, native picking at opacity zero, selected-building panel, drawing controls, effect removal and native restoration.

**60 FPS is not established.** Profile the complete scene on target hardware. Worker packets reduce interaction-thread work but cannot preempt individual uploads, shader compilation or garbage collection. No terrain, online DEM, globe, external GLTF or remote 3D Tiles is added.
