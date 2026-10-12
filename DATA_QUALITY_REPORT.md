# Bà Điểm 3D — post-merger data quality

The 2025 consolidation resolution combines Bà Điểm, Trung Chánh and Xuân Thới Thượng. Their polygons from a public ArcGIS layer were unioned into one **provisional, non-official** boundary. It resembles the supplied reference image but has not been certified as the legal surveyed boundary.

- Boundary: `data\gis_processed\ba_diem_post_merger_boundary_provisional.geojson`; 27.219 km², EPSG:4326 → EPSG:32648.
- VietMap source tiles: 37; requested zoom 20, effective native zoom 15.
- Processed GIS tiles: 48; roads accepted: 4020 (2180 named, 1840 unnamed); building footprints accepted: 190.
- Width estimates: 4020; height estimates: 190.
- Source layer counts: `{"water": 77, "island": 0, "landuse": 22, "waterway": 66, "road": 4021, "railway": 0, "building": 190, "admin_line": 50, "boundary": 0, "admin_point": 1, "poi": 5841, "place": 0}`.
- Source-query failures: 0; GIS processing failures: 1.

Only actual exposed VietMap features were modeled. Building coverage is sparse, and no absent footprints, roads, names, heights or terrain elevation were invented. See `data/vietmap/vector_sources/vector_manifest.json`, `data/hcmc_processed/dataset_manifest.json` and `data/hcmc_processed/failures.json` for provenance and detailed counts. VietMap account redistribution terms were not independently verified.

## Executed output verification

Native master saved and reopened in Blender 5.2.2; 48 linked tile libraries resolved. Individual buildings are editable in their tile libraries. No final FONT objects or label collections exist. Road-paint and building-massing pilot renders were inspected. Pilot samples and generation logs are stored alongside outputs.

All building-use categories in the current VietMap extract are unknown, and none has source height or floor attributes. Building height, facade palette, shallow roof edge and window panels are **illustrative estimates based only on footprint area and aspect**, never verified architecture or use. See `visual_massing_estimated` and `architectural_detail_estimated` metadata.

```json
{
  "native_scene": {
    "saved_master_reopened": "D:\\PROJECT\\police\\police-jhip\\Ba_Diem_3D.blend",
    "buildings": 190,
    "painted_road_objects": 681,
    "linked_libraries": 48,
    "objects": 11241,
    "errors": [],
    "estimated_roofs": 190,
    "estimated_facades": 190,
    "vietmap_textured_tiles": 48,
    "geometry_provider": "VIETMAP"
  },
  "road_label_results": {
    "unnamed": 1840,
    "unresolved_elevation": 33,
    "other_tile_or_part": 377,
    "insufficient_space": 276,
    "surface_or_building_collision": 35,
    "painted": 681,
    "spacing": 1154
  },
  "estimated_building_massing": {
    "broad_footprint": 48,
    "very_large_footprint": 26,
    "medium_footprint": 64,
    "small_footprint": 17,
    "narrow_footprint": 35
  },
  "geometry_checks": {
    "counts": {
      "admin_line_parts": 68,
      "water_parts": 150,
      "roads_parts": 4396,
      "poi_parts": 5841,
      "waterway_parts": 88,
      "buildings_parts": 190,
      "landuse_parts": 26,
      "admin_point_parts": 1
    },
    "terrain_overlap_m2": 7.450580596923828e-9,
    "terrain_area_error_km2": 2.842170943040401e-14,
    "buildings_intersecting_estimated_road_surfaces": 11,
    "errors": [],
    "note": "Road widths are estimated; intersections with footprints are unresolved source/width conflicts, not coordinate corrections. No source footprints displaced."
  },
  "last_generation_seconds": 33.85216899999796,
  "tile_library_bytes": 270678256,
  "master_bytes": 5918633,
  "peak_memory_measured": false,
  "feature_provider": "VIETMAP",
  "vector_source_audit": {
    "zoom": 15,
    "requested_zoom": 20,
    "configured_native_max_zoom": 15,
    "tile_count": 37,
    "counts": {
      "water": 77,
      "island": 0,
      "landuse": 22,
      "waterway": 66,
      "road": 4021,
      "railway": 0,
      "building": 190,
      "admin_line": 50,
      "boundary": 0,
      "admin_point": 1,
      "poi": 5841,
      "place": 0
    },
    "failures": [],
    "boundary_status": "provisional_non_official_geometry"
  },
  "basemap": {
    "provider": "VIETMAP",
    "attribution": "\u00a9 VIETMAP",
    "purpose": "Current official SDK style ground map; all active features also from VIETMAP",
    "checked_at_utc": "2026-10-11T13:29:55.474567+00:00",
    "style_http_status": 200,
    "style_url_redacted": "https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=REDACTED",
    "source_info": {
      "openmaptiles": {
        "type": "vector",
        "tiles": ["https://maps.vietmap.vn/maps/tiles/vlc-20261008/{z}/{x}/{y}.pbf?apikey=REDACTED"],
        "minzoom": 0,
        "maxzoom": 15
      }
    },
    "zoom": 15,
    "requested_zoom": 20,
    "configured_native_max_zoom": 15,
    "boundary_file": "data/gis_processed/ba_diem_post_merger_boundary_provisional.geojson",
    "tile_count": 37,
    "image": "data/vietmap/hcmc_vietmap_basemap.png",
    "image_sha256": "e8bce42794777b1bc671c3a36d7178af4959c8b12bcf75a4bde0adc6e4cf8578",
    "image_size": [4608, 3072],
    "crs": "EPSG:3857",
    "bounds": [11858134.820049103, 1211985.520489756, 11869141.752122167, 1219323.4752051309],
    "xyz_tile_range": [26080, 15387, 26088, 15392],
    "capture_method": "official SDK, pitch 0, bearing 0, device pixel ratio 1, exact 512 pixels per XYZ cell",
    "licensing": "Existing account access used; no independently verified redistribution terms."
  }
}
```

Footprint/pavement intersections remain unresolved because road widths are estimated; no buildings were moved. The boundary polygon is provisional, DEM is unavailable, and completeness of VietMap features is unknown. Peak resident memory was not instrumented. Source parsing retains normalized SDK features and accepted geometries in memory; regional/streaming batches are required before much larger city extracts. Disk use and execution runtime are measured above; the last runtime can represent cached regeneration.
