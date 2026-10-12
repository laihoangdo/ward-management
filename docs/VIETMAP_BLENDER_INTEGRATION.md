# Active VietMap-only Blender integration

Checked on 11 October 2026 (Asia/Barnaul).

The active pipeline imports features exclusively from VIETMAP. It uses the current documented street style `/maps/styles/tm/style.json`, whose source was `vlc-20261008` with native maximum zoom 15 at inspection. The older frontend light style pointed to `vlc-vt-sdk-20250122`. The frontend itself has not been modified: this change concerns the Blender pipeline.

Authenticated responses from both source versions failed ordinary Python MVT decoding. The official SDK successfully rendered the current style without errors and returned geographic feature objects through its public `querySourceFeatures` method. The extraction utility runs `@vietmap/vietmap-gl-js@6.0.1` in isolated headless Chrome; it does not reverse engineer or bypass the provider's transport. The in-app browser was unavailable, so the extractor uses local Playwright/Chrome.

For the supplied Bà Điểm extent, normalized feature counts after tile clipping/deduplication are:

| Layer | Features |
|---|---:|
| Building footprints | 692 |
| Roads | 3,456 |
| Water | 8 |
| Land use | 20 |
| Administrative lines | 29 |
| Administrative points | 2 |
| POIs | 6,659 |

Of the roads, 2,074 carry names directly in their own provider properties. The exposed building features contain no height, floor-count or category attributes. All modeled building heights therefore remain configurable estimates; unknown buildings remain uncategorized. Named roads preserve source spelling, including Vietnamese characters. No OSM feature files are read by the default pipeline.

Every source layer referenced by the current style is cached, including empty island, railway, waterway, boundary and place layers. This does not claim access to hidden layers or a complete proprietary database. Native provider feature IDs are absent on many records, so geometry/attribute hashes identify records, with that limitation retained in metadata. Matching polygon fragments are joined only across different source tiles and flagged as inferred.

The ground map is now rendered by the same current official SDK style over exact XYZ bounds at pitch/bearing zero. The basemap manifest records source version, bounds, hash, screenshot dimensions and capture method. Blender transforms metric terrain vertices into EPSG:3857 UVs and packs the texture into native libraries. Attribution `© VIETMAP` remains in scene/material metadata. The earlier raster-only helper is no longer part of the default workflow.

The supplied polygon is still an unverified local processing extent of about 9.615 km², not an official current Ho Chi Minh City boundary. The returned administrative lines include commune/ward labels and admin_level 3; a newer source identifier does not establish their legal effective date. No DEM was exposed. Geometry checks found 77 footprint intersections with estimated pavement widths, which remain reported without moving source footprints. These observations prevent a claim of guaranteed complete or survey-accurate coverage.

Scripts, native files and reports are documented in `README_BLENDER.md`. Original OSM files remain preserved but unused by the active provider selection. Credentials are read in memory from the existing integration or `VIETMAP_API_KEY` and excluded from new output metadata.

Official references: [Tilemap](https://maps.vietmap.vn/docs/map-api/tilemap/), [SDK overview](https://maps.vietmap.vn/docs/sdk-web-gl/overview/), [Map query API](https://maps.vietmap.vn/docs/sdk-web-gl/docs/classes/Map/).