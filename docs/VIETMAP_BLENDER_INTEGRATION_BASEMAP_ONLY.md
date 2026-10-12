# VietMap integration audit

Checked on 11 October 2026 (Asia/Barnaul).

The existing `VietMapCompareTab.tsx` uses MapLibre with VietMap light/dark vector styles and a VietMap raster tile endpoint. Live authenticated probes returned HTTP 200 for the light style and a raster PNG tile. Credentials were read from the existing integration in memory and were not copied to Blender output metadata or new scripts. The environment variable `VIETMAP_API_KEY` overrides the existing value.

The returned style references building, transportation, transportation_name, water, waterway, boundary, landcover, landuse, park, place and POI source layers. This proves vector map display is configured, but a style is not a validated city-wide GIS export. No VietMap height completeness, legal administrative boundary date, or stable cross-tile feature IDs have been established. Replacing editable OSM footprints with display-tile geometry would require separate decoding, deduplication and validation.

The frontend's `satellite` option currently uses Esri World Imagery. Its name does not make it a VietMap satellite source. This Blender update uses the authenticated VietMap raster endpoint, not Esri.

The older `badiem_vietmap_basemap.png` is a readable map image, but has no accompanying verified georeferencing metadata. A new cached raster mosaic uses explicit XYZ indices at zoom 16. Its 49 tiles produce a 3584×3584 image, and exact EPSG:3857 bounds are recorded in `data/vietmap/basemap_manifest.json`. Each metric terrain vertex is transformed into Web Mercator before assigning its UV coordinate. One map therefore aligns consistently across terrain tiles. The terrain remains flat and unmeasured.

`generate_hcmc_3d.py` now requires this basemap by default. Textures are packed into native tile libraries, so the saved model opens without online credentials. Attribution is preserved in scene and material custom properties. `--no-basemap` explicitly opts out. The download command caches tiles, offers `--refresh`, and guards against more than 64 requests unless that limit is deliberately changed.

OSM continues to supply individual building footprints and source road/alley lettering. VietMap supplies the rendered ground map, including its baked cartographic labels. No floating Blender labels are added. Differences between the two providers can remain; neither map display nor HTTP access proves survey accuracy or export/redistribution rights under the account contract.

Official display documentation: [VietMap Tilemap](https://maps.vietmap.vn/docs/map-api/tilemap/).
