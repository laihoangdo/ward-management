"""Export the linked post-merger Blender scene with road paint and building detail."""
import bpy
from pathlib import Path

root = Path(__file__).resolve().parents[1]
output = root / 'Ba_Diem_3D.glb'
scene = bpy.context.scene
if scene.name != 'Ba_Diem_Post_Merger_Available_Extent':
    raise RuntimeError(f'Unexpected scene: {scene.name}')
buildings = [obj for obj in scene.objects if obj.type == 'MESH' and 'height_m' in obj]
painted = [obj for obj in scene.objects if obj.get('embedded_road_name')]
roofs = [obj for obj in scene.objects if obj.get('detail_kind') == 'illustrative_roof_edge']
if len(buildings) != 190 or not painted or len(roofs) != len(buildings):
    raise RuntimeError('Building detail or road paint missing; refusing to replace web model')
bpy.ops.export_scene.gltf(
    filepath=str(output), export_format='GLB', export_apply=True,
    export_materials='EXPORT', export_texcoords=True, export_extras=True,
    export_cameras=False, export_lights=False,
)
print(f'Exported {output} ({output.stat().st_size} bytes), '
      f'{len(buildings)} buildings, {len(roofs)} roofs, {len(painted)} painted roads')
