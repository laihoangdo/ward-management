"""Render an actual VietMap footprint and its explicitly estimated massing details."""
import bpy
from mathutils import Vector
from pathlib import Path

root = Path(__file__).resolve().parents[1]
buildings = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH'
             and obj.get('source') == 'VIETMAP' and obj.get('visual_massing_estimated')]
if not buildings:
    raise RuntimeError('No VietMap building massing found in the open scene')
target = min(buildings, key=lambda obj: abs(obj.get('footprint_area_m2', 0) - 400))
center = target.matrix_world @ (sum((Vector(corner) for corner in target.bound_box), Vector()) / 8)
camera_data = bpy.data.cameras.new('Building_Massing_Inspection')
camera = bpy.data.objects.new('Building_Massing_Inspection', camera_data)
bpy.context.scene.collection.objects.link(camera)
camera.location = center + Vector((33, -42, 28))
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 70
bpy.context.scene.camera = camera
bpy.context.scene.render.resolution_x = 1400
bpy.context.scene.render.resolution_y = 1000
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.cycles.samples = 20
bpy.context.scene.render.filepath = str(root / 'data/hcmc_assets/Ba_Diem_Building_Massing_Detail.png')
bpy.ops.render.render(write_still=True)
print(f'Inspected {target.name}: {target.get("visual_massing_class")}, area {target.get("footprint_area_m2")} m2')
