# Bà Điểm 3D sau sáp nhập — Blender

The active `Ba_Diem_3D.blend` is generated from the **provisional** union of the former Bà Điểm, Trung Chánh and Xuân Thới Thượng commune polygons. The union follows the composition in Resolution 1685/NQ-UBTVQH15 (2025); its geometry comes from a public ArcGIS layer edited in May 2025, not a certified government survey. The supplied map image agrees with the general extent. See `config/ba_diem_3d.json` and `DATA_QUALITY_REPORT.md` before using it for any boundary decision.

The primary geometry and ground image come from the project's existing VietMap SDK integration. The source's native vector zoom is 15. The configured 5-level increment requests zoom 20 but is capped at 15; higher display zoom cannot reveal vector features absent from the provider. The vector source currently exposes only sparse building footprints. Missing buildings, roads, terrain heights and names are not invented.

The exposed building layer has no use, height, floor count or roof attributes. All buildings therefore remain in `Other_Buildings`; their varied heights, facade colors, shallow roof edges and window panels are **illustrative estimates** selected from footprint area and aspect ratio. Source footprints and IDs are preserved. The main building object records `visual_massing_class`, `visual_massing_estimated` and `height_basis`; roof and facade objects record `architectural_detail_estimated` and `associated_building_id`. Do not interpret these details as surveyed construction features.

## Open and inspect

Open `Ba_Diem_3D.blend` in Blender 5.2.2. Keep `data/hcmc_assets/` beside it: the master links editable tile libraries from this directory. Select `City_Overview_Camera` for the whole extent and `Road_Label_Test_Camera` for road lettering. Use Material Preview or Rendered mode to see the packed VietMap ground image. Road names are mesh markings within road objects, without an independent label collection. The previous scene is preserved at `data/legacy/Ba_Diem_3D_pre_merger.blend`.

`data/hcmc_assets/Ba_Diem_Building_Massing_Detail.png` is the close-up inspection render. Regenerate it with `$blenderExe --background Ba_Diem_3D.blend --python scripts/render_ba_diem_building_inspection.py` after setting `$blenderExe` as below.

## Regenerate in PowerShell from the project root

```powershell
$gisPython = 'C:\Program Files\Blender Foundation\Blender 5.2\5.2\python\bin\python.exe'
$blenderExe = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
& $gisPython -X utf8 scripts/prepare_ba_diem_boundary.py
& $gisPython -X utf8 scripts/prepare_vietmap_vectors.py
& $gisPython -X utf8 scripts/prepare_hcmc_gis.py --provider vietmap
& $gisPython -X utf8 scripts/validate_hcmc.py
& $blenderExe --background --python scripts/generate_hcmc_3d.py -- --pilot --render
& $blenderExe --background --python scripts/generate_hcmc_3d.py -- --force
& $blenderExe --background Ba_Diem_3D.blend --python scripts/verify_hcmc_blend.py
& $blenderExe --background Ba_Diem_3D.blend --python scripts/export_ba_diem_web_glb.py
node scripts/prepare_web_glb.cjs
```

The last two commands export the current linked scene to `Ba_Diem_3D.glb` and prepare `data/hcmc_assets/web_public/content/models/Ba_Diem_3D.glb` for the 3D web map. Vite serves this static file at `/content/models/Ba_Diem_3D.glb`. Keep the large GLB outside `src/main/webapp/`: Vite's source transform can otherwise exhaust memory. The web copy uses dark road-surface lettering because its roads are rendered white. The editable `.blend` remains the source of truth. Regenerate the web copy after rebuilding the Blender scene.

The VietMap key is read from `VIETMAP_API_KEY` or the existing project integration; no key is saved in reports. `--refresh` forces SDK tile requests; the default reuses cached snapshots. `--force` rebuilds Blender tile libraries. The processing uses EPSG:4326 inputs and EPSG:32648 metric scene coordinates. The manifest records the common origin and per-tile offsets. The raw predecessor polygons remain in `data/boundary_sources/`; the old model and old project data remain available for comparison.

The public ArcGIS boundary geometry and VietMap-derived features should be reviewed against official surveyed boundary data and provider usage terms before external distribution or legal use. The project does not yet have a certified post-merger polygon or comprehensive building footprints.
