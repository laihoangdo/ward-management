"""Append actual saved-scene and geometry verification to the source audit report."""
import json
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text(encoding='utf-8'))
geometry=read('data/hcmc_processed/geometry_validation.json')
native=read('data/hcmc_assets/blend_verification.json')
generation=read('data/hcmc_assets/validation.json')
manifest=read('data/hcmc_processed/dataset_manifest.json')
counts=Counter()
for tile in generation['tiles']:counts.update(tile['label_counts'])
massing=Counter()
for tile in manifest['tiles']:
    data=read('data/hcmc_processed/tiles/'+tile['id']+'.json')
    massing.update(f['properties'].get('visual_massing_class','unknown') for f in data['features'] if f['kind']=='buildings')
asset_bytes=sum(p.stat().st_size for p in (ROOT/'data/hcmc_assets').glob('*.blend'))
summary={'native_scene':native,'road_label_results':dict(counts),'estimated_building_massing':dict(massing),'geometry_checks':geometry,'last_generation_seconds':generation['generation_seconds'],'tile_library_bytes':asset_bytes,'master_bytes':(ROOT/'Ba_Diem_3D.blend').stat().st_size,'peak_memory_measured':False}
if generation.get('geometry_provider')=='VIETMAP':
    summary['feature_provider']='VIETMAP'
    source_audit=read('data/vietmap/vector_sources/vector_manifest.json')
    summary['vector_source_audit']={k:source_audit.get(k) for k in ('zoom','requested_zoom','configured_native_max_zoom','tile_count','counts','failures','boundary_status')}
(ROOT/'data/hcmc_assets/final_results.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
report=ROOT/'DATA_QUALITY_REPORT.md'
base=report.read_text(encoding='utf-8').split('\n## Executed output verification')[0]
if generation.get('basemap_provider')=='VIETMAP':
    base=base.replace('No VietMap imagery is redistributed: imagery permissions/georeferencing are unverified.', 'VietMap raster tiles now provide the georeferenced ground map using the existing account integration. Attribution is stored in the scene/material and basemap manifest. XYZ tile bounds define EPSG:3857 UV mapping; textures are packed into native tile libraries for local inspection. Account export/redistribution terms were not independently verified.')
    summary['basemap']=read('data/vietmap/basemap_manifest.json')
    (ROOT/'data/hcmc_assets/final_results.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
memory_note='Source parsing retains normalized SDK features and accepted geometries in memory; regional/streaming batches are required before much larger city extracts.' if generation.get('geometry_provider')=='VIETMAP' else 'Source parsing currently loads Overpass JSON datasets and retains accepted geometries in memory.'
report.write_text(base+'\n## Executed output verification\n\nNative master saved and reopened in Blender 5.2.2; '+str(native['linked_libraries'])+' linked tile libraries resolved. Individual buildings are editable in their tile libraries. No final FONT objects or label collections exist. Road-paint and building-massing pilot renders were inspected. Pilot samples and generation logs are stored alongside outputs.\n\nAll building-use categories in the current VietMap extract are unknown, and none has source height or floor attributes. Building height, facade palette, shallow roof edge and window panels are **illustrative estimates based only on footprint area and aspect**, never verified architecture or use. See `visual_massing_estimated` and `architectural_detail_estimated` metadata.\n\n```json\n'+json.dumps(summary,indent=2)+'\n```\n\nFootprint/pavement intersections remain unresolved because road widths are estimated; no buildings were moved. The boundary polygon is provisional, DEM is unavailable, and completeness of VietMap features is unknown. Peak resident memory was not instrumented. '+memory_note+' Disk use and execution runtime are measured above; the last runtime can represent cached regeneration.\n',encoding='utf-8')
print(json.dumps(summary,indent=2))
