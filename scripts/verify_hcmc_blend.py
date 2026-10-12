"""Run in Blender against the saved master, not the generation scene."""
import bpy
import bmesh
import json
import math
from pathlib import Path

root=Path(__file__).resolve().parents[1]
scene=bpy.context.scene
errors=[];buildings=0;painted=0
building_ids=set();roof_ids=set();facade_ids=set()
textured_terrain=0
for obj in scene.objects:
    if scene.get('geometry_provider')=='VIETMAP' and 'source' in obj and obj['source']!='VIETMAP':errors.append('Non-VietMap feature source '+obj.name)
    if obj.type=='FONT':errors.append('Unexpected text object '+obj.name)
    if obj.type!='MESH':continue
    if obj.get('basemap_provider')=='VIETMAP':
        textured_terrain+=1
        if not obj.data.uv_layers:errors.append('Missing VietMap UVs '+obj.name)
        elif any(not 0<=value<=1 for uv in obj.data.uv_layers.active.data for value in uv.uv):errors.append('VietMap UV outside image '+obj.name)
        images=[node.image for mat in obj.data.materials for node in mat.node_tree.nodes if node.type=='TEX_IMAGE' and node.image]
        if not images or any(not image.packed_file for image in images):errors.append('Missing packed VietMap image '+obj.name)
    if any(not math.isfinite(v) for vertex in obj.data.vertices for v in vertex.co):
        errors.append('Nonfinite vertex '+obj.name)
    if 'height_m' in obj:
        buildings+=1
        building_ids.add(obj.get('source_id'))
        bm=bmesh.new();bm.from_mesh(obj.data)
        if any(not e.is_manifold for e in bm.edges):errors.append('Nonmanifold building '+obj.name)
        bm.free()
    if obj.get('detail_kind')=='illustrative_roof_edge':roof_ids.add(obj.get('associated_building_id'))
    if obj.get('detail_kind')=='illustrative_facade_panels':facade_ids.add(obj.get('associated_building_id'))
    if 'embedded_road_name' in obj:
        painted+=1
        if len(obj.data.materials)!=2:errors.append('Missing paint material '+obj.name)
for library in bpy.data.libraries:
    if not Path(bpy.path.abspath(library.filepath)).exists():errors.append('Missing library '+library.filepath)
if scene.get('geometry_provider')=='VIETMAP' and (roof_ids!=building_ids or facade_ids!=building_ids):
    errors.append('Estimated roof/facade details do not match every VietMap building')
result={'saved_master_reopened':bpy.data.filepath,'buildings':buildings,'painted_road_objects':painted,'linked_libraries':len(bpy.data.libraries),'objects':len(scene.objects),'errors':errors}
result['estimated_roofs']=len(roof_ids)
result['estimated_facades']=len(facade_ids)
result['vietmap_textured_tiles']=textured_terrain
result['geometry_provider']=scene.get('geometry_provider','unknown')
(root/'data/hcmc_assets/blend_verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
if errors:raise RuntimeError('Saved scene verification failed')
