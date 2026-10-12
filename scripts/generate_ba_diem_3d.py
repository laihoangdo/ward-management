#!/usr/bin/env python3
"""
=============================================================================
GEOGRAPHIC 3D MODEL GENERATOR FOR BÀ ĐIỂM COMMUNE, HÓC MÔN, TP. HỒ CHÍ MINH
=============================================================================
Author: Senior GIS Engineer & Blender Python Automation Specialist
Target: Blender 4.x / 5.x LTS Python API (bpy)
Input Datasets:
  - data/gis_processed/ba_diem_boundary.geojson
  - data/gis_processed/ba_diem_roads_processed.geojson
  - data/gis_processed/ba_diem_buildings_processed.geojson
  - data/gis_processed/ba_diem_pois.geojson
  - src/main/webapp/content/images/badiem_vietmap_basemap.png

Outputs:
  - Ba_Diem_3D.blend (Native Blender scene with all structured collections)
  - Ba_Diem_3D.glb   (Optimized 3D transmission format)

Execution:
  blender --background --python generate_ba_diem_3d.py
  or run within an active Blender interactive session.
=============================================================================
"""

import os
import sys
import json
import math
import time
import re
from pathlib import Path

# Attempt bpy import
try:
    import bpy
    import bmesh
    from mathutils import Vector, Euler, Color
except ImportError:
    print("ERROR: This script must be executed within Blender's Python environment.")
    print("Usage: blender --background --python generate_ba_diem_3d.py")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Project Directories & Resolution
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR if (SCRIPT_DIR / "data" / "gis_processed").exists() else SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "data" / "gis_processed"
BASEMAP_IMG = PROJECT_ROOT / "src" / "main" / "webapp" / "content" / "images" / "badiem_vietmap_basemap.png"
OUTPUT_BLEND = PROJECT_ROOT / "Ba_Diem_3D.blend"
OUTPUT_GLB = PROJECT_ROOT / "Ba_Diem_3D.glb"

# ---------------------------------------------------------------------------
# Geographic Constants & Local Projected Coordinate System
# ---------------------------------------------------------------------------
# Commune Geographic Origin (Bà Điểm Center)
ORIGIN_LAT = 10.8525
ORIGIN_LNG = 106.6110
METERS_PER_DEG_LAT = 111320.0
METERS_PER_DEG_LNG = 111320.0 * math.cos(math.radians(ORIGIN_LAT))

def latlng_to_blender(lat, lng, z=0.0):
    """
    Transforms WGS84 GPS (lat, lng) to Blender Cartesian Coordinates (X, Y, Z) in meters.
    Blender X: East (+) / West (-)
    Blender Y: North (+) / South (-)
    Blender Z: Elevation / Height (meters)
    """
    x = (lng - ORIGIN_LNG) * METERS_PER_DEG_LNG
    y = (lat - ORIGIN_LAT) * METERS_PER_DEG_LAT
    return Vector((x, y, z))

def polygon_2d_area_signed(pts_2d):
    """Calculates signed 2D area to determine polygon winding order."""
    n = len(pts_2d)
    return sum(pts_2d[i][0] * pts_2d[(i + 1) % n][1] - pts_2d[(i + 1) % n][0] * pts_2d[i][1] for i in range(n)) / 2.0

# ---------------------------------------------------------------------------
# Scene & Collection Management
# ---------------------------------------------------------------------------
def setup_scene(scene_name="Scene_Ba_Diem_3D"):
    """Creates a pristine, dedicated scene and required collection hierarchy."""
    if scene_name in bpy.data.scenes:
        scene = bpy.data.scenes[scene_name]
        # Clean existing objects in this scene
        for obj in list(scene.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
    else:
        scene = bpy.data.scenes.new(scene_name)

    # Set as active window scene
    if bpy.context.window:
        bpy.context.window.scene = scene

    # Units: Metric, 1.0 scale
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = 'METERS'

    root_col = scene.collection

    # Clear root children
    for c in list(root_col.children):
        root_col.children.unlink(c)

    # Required Collection Structure (Section 4)
    collection_names = [
        "Administrative_Boundary",
        "Terrain",
        "Major_Roads",
        "Local_Roads",
        "Residential_Buildings",
        "Commercial_Buildings",
        "Other_Buildings",
        "Vegetation",
        "Cameras_And_Lighting"
    ]
    collections = {}
    for name in collection_names:
        c = bpy.data.collections.get(name)
        if not c:
            c = bpy.data.collections.new(name)
        else:
            for obj in list(c.objects):
                bpy.data.objects.remove(obj, do_unlink=True)
        if c.name not in [col.name for col in root_col.children]:
            root_col.children.link(c)
        collections[name] = c

    return scene, collections

# ---------------------------------------------------------------------------
# Material Library (PBR Principled BSDF with Rich Aesthetics)
# ---------------------------------------------------------------------------
class MaterialLibrary:
    def __init__(self):
        self.materials = {}

    def get_or_create(self, name, base_color=(0.8, 0.8, 0.8, 1.0), roughness=0.7, specular=0.2, metallic=0.0, emission=None, emission_strength=1.0):
        if name in bpy.data.materials:
            return bpy.data.materials[name]

        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        nodes.clear()

        node_out = nodes.new(type="ShaderNodeOutputMaterial")
        node_out.location = (300, 0)
        node_bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
        node_bsdf.location = (0, 0)

        # Set PBR inputs
        if 'Base Color' in node_bsdf.inputs:
            node_bsdf.inputs['Base Color'].default_value = base_color
        if 'Roughness' in node_bsdf.inputs:
            node_bsdf.inputs['Roughness'].default_value = roughness
        if 'Metallic' in node_bsdf.inputs:
            node_bsdf.inputs['Metallic'].default_value = metallic
        if 'Specular IOR Level' in node_bsdf.inputs:
            node_bsdf.inputs['Specular IOR Level'].default_value = specular
        elif 'Specular' in node_bsdf.inputs:
            node_bsdf.inputs['Specular'].default_value = specular

        if emission:
            if 'Emission Color' in node_bsdf.inputs:
                node_bsdf.inputs['Emission Color'].default_value = emission
            elif 'Emission' in node_bsdf.inputs:
                node_bsdf.inputs['Emission'].default_value = emission
            if 'Emission Strength' in node_bsdf.inputs:
                node_bsdf.inputs['Emission Strength'].default_value = emission_strength

        links.new(node_bsdf.outputs['BSDF'], node_out.inputs['Surface'])
        self.materials[name] = mat
        return mat

    def create_terrain_material(self, image_path):
        mat_name = "Mat_Terrain_VietMap"
        if mat_name in bpy.data.materials:
            return bpy.data.materials[mat_name]

        mat = bpy.data.materials.new(name=mat_name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        nodes.clear()

        node_out = nodes.new(type="ShaderNodeOutputMaterial")
        node_out.location = (350, 0)
        node_bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
        node_bsdf.location = (50, 0)
        node_bsdf.inputs['Roughness'].default_value = 0.88
        if 'Specular IOR Level' in node_bsdf.inputs:
            node_bsdf.inputs['Specular IOR Level'].default_value = 0.08

        if image_path.exists():
            node_tex = nodes.new(type="ShaderNodeTexImage")
            node_tex.location = (-300, 0)
            img = bpy.data.images.load(str(image_path), check_existing=True)
            node_tex.image = img
            links.new(node_tex.outputs['Color'], node_bsdf.inputs['Base Color'])
        else:
            node_bsdf.inputs['Base Color'].default_value = (0.92, 0.93, 0.90, 1.0)

        links.new(node_bsdf.outputs['BSDF'], node_out.inputs['Surface'])
        return mat

# ---------------------------------------------------------------------------
# Section 3.B: Terrain & Administrative Boundary
# ---------------------------------------------------------------------------
def build_terrain_and_boundaries(collections, mat_lib):
    print("--- Building Terrain & Administrative Boundary ---")
    boundary_file = DATA_DIR / "ba_diem_boundary.geojson"
    if not boundary_file.exists():
        print(f"WARNING: Boundary file not found at {boundary_file}")
        return

    with open(boundary_file, "r", encoding="utf-8") as f:
        boundary_data = json.load(f)

    # 1. Base Terrain Ground Plane
    s_lat, n_lat = 10.822515, 10.887254
    w_lng, e_lng = 106.567383, 106.633301

    min_corner = latlng_to_blender(s_lat, w_lng, 0.0)
    max_corner = latlng_to_blender(n_lat, e_lng, 0.0)

    t_width = abs(max_corner.x - min_corner.x)
    t_height = abs(max_corner.y - min_corner.y)
    t_center_x = (min_corner.x + max_corner.x) / 2.0
    t_center_y = (min_corner.y + max_corner.y) / 2.0

    mesh_terrain = bpy.data.meshes.new("Mesh_Terrain_Ground")
    obj_terrain = bpy.data.objects.new("Terrain_Ground_VietMap", mesh_terrain)
    collections["Terrain"].objects.link(obj_terrain)

    bm_t = bmesh.new()
    hw, hh = t_width / 2.0, t_height / 2.0
    v1 = bm_t.verts.new((-hw, -hh, 0.0))
    v2 = bm_t.verts.new((hw, -hh, 0.0))
    v3 = bm_t.verts.new((hw, hh, 0.0))
    v4 = bm_t.verts.new((-hw, hh, 0.0))
    face_t = bm_t.faces.new((v1, v2, v3, v4))

    # UV Mapping
    uv_layer = bm_t.loops.layers.uv.new("UVMap")
    for loop in face_t.loops:
        v = loop.vert
        u = (v.co.x + hw) / t_width
        v_coord = (v.co.y + hh) / t_height
        loop[uv_layer].uv = (u, v_coord)

    bm_t.to_mesh(mesh_terrain)
    bm_t.free()

    obj_terrain.location = (t_center_x, t_center_y, 0.0)
    mat_terrain = mat_lib.create_terrain_material(BASEMAP_IMG)
    obj_terrain.data.materials.append(mat_terrain)

    # 2. Administrative Boundaries
    mat_commune_boundary = mat_lib.get_or_create(
        "Mat_Boundary_Commune",
        base_color=(0.95, 0.12, 0.12, 1.0),
        emission=(1.0, 0.20, 0.20, 1.0),
        emission_strength=3.5
    )
    mat_hamlet_boundary = mat_lib.get_or_create(
        "Mat_Boundary_Hamlet",
        base_color=(0.10, 0.75, 0.95, 1.0),
        emission=(0.15, 0.80, 1.0, 1.0),
        emission_strength=2.0
    )

    for feat in boundary_data.get("features", []):
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        kind = props.get("kind")
        coords = geom.get("coordinates", [[]])[0]

        if len(coords) < 3:
            continue

        is_commune = (kind == "commune_boundary")
        outline_width = 10.0 if is_commune else 4.0
        z_elevation = 1.8 if is_commune else 0.8
        obj_name = "Boundary_Commune_Outline" if is_commune else f"Boundary_{props.get('id', 'hamlet')}"

        mesh_b = bpy.data.meshes.new(f"Mesh_{obj_name}")
        obj_b = bpy.data.objects.new(obj_name, mesh_b)
        collections["Administrative_Boundary"].objects.link(obj_b)
        obj_b.data.materials.append(mat_commune_boundary if is_commune else mat_hamlet_boundary)

        # Store geographic attributes in custom properties
        obj_b["boundary_kind"] = kind
        obj_b["name_vi"] = props.get("name", "")
        if is_commune:
            obj_b["area_sqkm"] = props.get("area_sqkm", 0.0)
        else:
            obj_b["hamlet_code"] = props.get("code", "")
            obj_b["officer"] = props.get("officer", "")
            obj_b["household_count"] = props.get("householdCount", 0)
            obj_b["population"] = props.get("populationCount", 0)

        # Extrude boundary perimeter ribbon
        bm_b = bmesh.new()
        world_pts = [latlng_to_blender(p[1], p[0], z_elevation) for p in coords]

        half_w = outline_width / 2.0
        n_pts = len(world_pts)
        left_verts = []
        right_verts = []

        for i in range(n_pts):
            p = world_pts[i]
            p_prev = world_pts[(i - 1) % n_pts]
            p_next = world_pts[(i + 1) % n_pts]
            tangent = ((p_next - p).normalized() + (p - p_prev).normalized()).normalized()
            normal = Vector((-tangent.y, tangent.x, 0.0)).normalized()

            left_verts.append(bm_b.verts.new(p + normal * half_w))
            right_verts.append(bm_b.verts.new(p - normal * half_w))

        for i in range(n_pts - 1):
            try:
                bm_b.faces.new((left_verts[i], right_verts[i], right_verts[i + 1], left_verts[i + 1]))
            except:
                pass

        bm_b.to_mesh(mesh_b)
        bm_b.free()

    print("Completed Terrain & Boundary generation.")

# ---------------------------------------------------------------------------
# Section 3.C: Roads & Streets (Major & Local Networks with Embedded Surface Markings)
# ---------------------------------------------------------------------------
def clean_road_name(name):
    """Keep the source spelling; omit only segment numbers used by this dataset."""
    if not name:
        return ""
    return re.sub(r'\s*\(Đoạn\s+\d+\)\s*$', '', str(name)).strip()

def create_text_bmesh(text_body, font, font_size, location, angle_z,
                      max_length, max_width, z_offset=0.005):
    """
    Creates flat 2D text geometry oriented along the road direction,
    positioned at road surface level. Returns bmesh with material_index = 1.
    """
    curve = bpy.data.curves.new(f"Text_{text_body[:8]}", type='FONT')
    curve.body = text_body
    if font:
        curve.font = font
    curve.size = font_size
    curve.resolution_u = 2
    curve.extrude = 0.0  # Zero 3D extrusion, totally flat 2D lettering on road surface!
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'

    temp_obj = bpy.data.objects.new("Temp_Text_Obj", curve)
    bpy.context.scene.collection.objects.link(temp_obj)
    temp_obj.location = Vector((location.x, location.y, location.z + z_offset))
    temp_obj.rotation_euler = Euler((0.0, 0.0, angle_z), 'XYZ')

    dg = bpy.context.evaluated_depsgraph_get()
    mesh_eval = bpy.data.meshes.new_from_object(temp_obj.evaluated_get(dg))

    # The actual glyph bounds (including Vietnamese diacritics) determine fit.
    # Font-size estimates based on character count can spill onto adjacent land.
    bounds_x = [v.co.x for v in mesh_eval.vertices]
    bounds_y = [v.co.y for v in mesh_eval.vertices]
    if not bounds_x or not bounds_y:
        bpy.data.objects.remove(temp_obj)
        bpy.data.meshes.remove(mesh_eval)
        bpy.data.curves.remove(curve)
        return None
    glyph_length = max(bounds_x) - min(bounds_x)
    glyph_width = max(bounds_y) - min(bounds_y)
    scale = min(1.0, max_length / max(glyph_length, 1e-6),
                max_width / max(glyph_width, 1e-6))
    if scale < 0.35:
        bpy.data.objects.remove(temp_obj)
        bpy.data.meshes.remove(mesh_eval)
        bpy.data.curves.remove(curve)
        return None

    bm_text = bmesh.new()
    bm_text.from_mesh(mesh_eval)
    center_x = (min(bounds_x) + max(bounds_x)) / 2.0
    center_y = (min(bounds_y) + max(bounds_y)) / 2.0
    for v in bm_text.verts:
        v.co.x = (v.co.x - center_x) * scale
        v.co.y = (v.co.y - center_y) * scale
    bm_text.transform(temp_obj.matrix_world)

    for f in bm_text.faces:
        f.material_index = 1

    bpy.data.objects.remove(temp_obj)
    bpy.data.meshes.remove(mesh_eval)
    bpy.data.curves.remove(curve)

    return bm_text

def append_bmesh_faces(bm_target, bm_source, mat_idx=1):
    """Appends all vertices and faces of bm_source to bm_target."""
    vert_map = {}
    for v in bm_source.verts:
        vert_map[v] = bm_target.verts.new(v.co)
    for f in bm_source.faces:
        try:
            new_f = bm_target.faces.new([vert_map[v] for v in f.verts])
            new_f.material_index = mat_idx
        except:
            pass

def build_roads(collections, mat_lib):
    print("--- Building Roads & Streets Network with Embedded Surface Markings ---")
    roads_file = DATA_DIR / "ba_diem_roads_processed.geojson"
    if not roads_file.exists():
        print(f"WARNING: Roads file not found at {roads_file}")
        return [], []

    with open(roads_file, "r", encoding="utf-8") as f:
        roads_data = json.load(f)

    # Load TrueType font from Windows system fonts for 100% accurate Vietnamese diacritics
    road_font = None
    font_candidates = [
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
    ]
    for fp in font_candidates:
        if os.path.exists(fp):
            try:
                road_font = bpy.data.fonts.load(fp)
                print(f"Loaded road font for Vietnamese diacritics: {fp}")
                break
            except Exception as e:
                pass

    # Rich road materials
    mat_major = mat_lib.get_or_create(
        "Mat_Road_Major",
        base_color=(0.12, 0.14, 0.17, 1.0),  # Deep charcoal asphalt
        roughness=0.70,
        specular=0.25
    )
    mat_local = mat_lib.get_or_create(
        "Mat_Road_Local",
        base_color=(0.24, 0.26, 0.29, 1.0),  # Smooth local asphalt
        roughness=0.78,
        specular=0.18
    )
    mat_alley = mat_lib.get_or_create(
        "Mat_Road_Alley",
        base_color=(0.36, 0.38, 0.40, 1.0),  # Light alley pavement
        roughness=0.85,
        specular=0.12
    )
    # Road Surface Marking Paint (Muted white/light gray thermoplastic paint)
    mat_marking = mat_lib.get_or_create(
        "Mat_Road_Marking_Paint",
        base_color=(0.88, 0.89, 0.92, 1.0),  # Subtle crisp road marking white/light gray
        roughness=0.65,
        specular=0.15,
        metallic=0.0
    )

    major_features = []
    local_features = []

    for f in roads_data.get("features", []):
        cat = f.get("properties", {}).get("category", "local")
        if cat == "major":
            major_features.append(f)
        else:
            local_features.append(f)

    # Tracking placed labels for spacing and camera targeting
    placed_labels = []
    placed_major_samples = []
    placed_alley_samples = []

    # 1. Build Major Roads as distinct individual corridor objects
    for idx, f in enumerate(major_features):
        props = f.get("properties", {})
        coords = f.get("geometry", {}).get("coordinates", [])
        if len(coords) < 2:
            continue

        road_name = props.get("name") or ""
        safe_name = "".join(c if c.isalnum() else "_" for c in road_name)[:30]
        obj_name = f"Road_Major_{idx + 1:02d}_{safe_name}"

        mesh = bpy.data.meshes.new(f"Mesh_{obj_name}")
        obj = bpy.data.objects.new(obj_name, mesh)
        collections["Major_Roads"].objects.link(obj)

        # Slot 0 = Asphalt, Slot 1 = Road Marking Paint
        obj.data.materials.append(mat_major)
        obj.data.materials.append(mat_marking)

        # Attributes
        obj["road_id"] = props.get("id", "")
        obj["road_name"] = road_name
        obj["category"] = "major"
        obj["width_m"] = props.get("width", 14.0)
        obj["speed_limit"] = props.get("speedLimit", 50)
        obj["lane_count"] = props.get("laneCount", 4)

        bm = bmesh.new()
        width = float(props.get("width", 14.0))
        half_w = width / 2.0
        z_elev = 0.14  # Raised slightly to avoid any z-fighting with terrain

        world_pts = [latlng_to_blender(p[1], p[0], z_elev) for p in coords]
        n_pts = len(world_pts)
        left_verts = []
        right_verts = []

        for i in range(n_pts):
            p = world_pts[i]
            if i == 0:
                tangent = (world_pts[1] - p).normalized()
            elif i == n_pts - 1:
                tangent = (p - world_pts[i - 1]).normalized()
            else:
                tangent = ((world_pts[i + 1] - p).normalized() + (p - world_pts[i - 1]).normalized()).normalized()
            normal = Vector((-tangent.y, tangent.x, 0.0)).normalized()

            left_verts.append(bm.verts.new(p + normal * half_w))
            right_verts.append(bm.verts.new(p - normal * half_w))

        for i in range(n_pts - 1):
            try:
                f_asphalt = bm.faces.new((left_verts[i], right_verts[i], right_verts[i + 1], left_verts[i + 1]))
                f_asphalt.material_index = 0
            except:
                pass

        # Embed Road Name Markings into Major Road Surface
        disp_name = clean_road_name(road_name)
        font_size = min(width * 0.50, 9.0)

        corridor_len = sum((world_pts[i + 1] - world_pts[i]).length for i in range(n_pts - 1))
        candidate_seg_indices = []
        if corridor_len > 400.0 and n_pts >= 4:
            step = max(1, (n_pts - 1) // 3)
            for idx_s in range(step // 2, n_pts - 1, step):
                candidate_seg_indices.append(idx_s)
        else:
            best_idx = 0
            best_l = 0.0
            for i in range(n_pts - 1):
                l = (world_pts[i + 1] - world_pts[i]).length
                if l > best_l:
                    best_l = l
                    best_idx = i
            candidate_seg_indices.append(best_idx)

        for s_idx in candidate_seg_indices:
            pA = world_pts[s_idx]
            pB = world_pts[s_idx + 1]
            seg_v = pB - pA
            seg_len = seg_v.length
            if not disp_name or seg_len < 8.0:
                continue

            mid_pos = (pA + pB) / 2.0
            tangent = seg_v.normalized()
            angle_z = math.atan2(tangent.y, tangent.x)
            if angle_z > math.pi / 2:
                angle_z -= math.pi
            elif angle_z < -math.pi / 2:
                angle_z += math.pi

            too_close = False
            for p_pos, _ in placed_labels:
                if (mid_pos - p_pos).length < 50.0:
                    too_close = True
                    break
            if too_close:
                continue

            bm_txt = create_text_bmesh(
                disp_name, road_font, font_size, mid_pos, angle_z,
                max_length=seg_len * 0.78, max_width=width * 0.72,
                z_offset=0.006,
            )
            if bm_txt is None:
                continue
            append_bmesh_faces(bm, bm_txt, mat_idx=1)
            bm_txt.free()
            placed_labels.append((mid_pos, "major"))
            placed_major_samples.append((disp_name, mid_pos))

        bm.to_mesh(mesh)
        bm.free()

    # 2. Build Local Roads & Alleys partitioned into clean neighborhood clusters
    sectors = {
        "Sector_North": {"bounds": (10.858, 10.870), "features": []},
        "Sector_Central": {"bounds": (10.849, 10.858), "features": []},
        "Sector_South": {"bounds": (10.835, 10.849), "features": []}
    }

    for f in local_features:
        coords = f.get("geometry", {}).get("coordinates", [])
        if not coords:
            continue
        mid_lat = coords[len(coords) // 2][1]
        placed = False
        for sec_name, sec_data in sectors.items():
            if sec_data["bounds"][0] <= mid_lat < sec_data["bounds"][1]:
                sec_data["features"].append(f)
                placed = True
                break
        if not placed:
            sectors["Sector_Central"]["features"].append(f)

    for sec_name, sec_data in sectors.items():
        feats = sec_data["features"]
        if not feats:
            continue
        obj_name = f"Roads_Local_{sec_name}"
        mesh = bpy.data.meshes.new(f"Mesh_{obj_name}")
        obj = bpy.data.objects.new(obj_name, mesh)
        collections["Local_Roads"].objects.link(obj)

        # Slot 0 = Local Asphalt, Slot 1 = Road Marking Paint
        obj.data.materials.append(mat_local)
        obj.data.materials.append(mat_marking)

        obj["sector"] = sec_name
        obj["segment_count"] = len(feats)

        bm = bmesh.new()
        z_elev = 0.07

        for f in feats:
            coords = f.get("geometry", {}).get("coordinates", [])
            if len(coords) < 2:
                continue
            width = float(f.get("properties", {}).get("width", 5.0))
            half_w = max(width / 2.0, 1.5)

            world_pts = [latlng_to_blender(p[1], p[0], z_elev) for p in coords]
            n_pts = len(world_pts)
            l_verts = []
            r_verts = []

            for i in range(n_pts):
                p = world_pts[i]
                if i == 0:
                    tangent = (world_pts[1] - p).normalized()
                elif i == n_pts - 1:
                    tangent = (p - world_pts[i - 1]).normalized()
                else:
                    tangent = ((world_pts[i + 1] - p).normalized() + (p - world_pts[i - 1]).normalized()).normalized()
                normal = Vector((-tangent.y, tangent.x, 0.0)).normalized()
                l_verts.append(bm.verts.new(p + normal * half_w))
                r_verts.append(bm.verts.new(p - normal * half_w))

            for i in range(n_pts - 1):
                try:
                    f_asphalt = bm.faces.new((l_verts[i], r_verts[i], r_verts[i + 1], l_verts[i + 1]))
                    f_asphalt.material_index = 0
                except:
                    pass

            # Embed Road/Alley Name Markings into Local Road Surface
            props = f.get("properties", {})
            name = props.get("name", "")
            if not name:
                continue

            disp_name = clean_road_name(name)
            is_alley = disp_name.casefold().startswith('hẻm')
            font_size = min(width * (0.64 if is_alley else 0.58), 4.8)

            best_idx = 0
            best_l = 0.0
            for i in range(len(world_pts) - 1):
                l = (world_pts[i + 1] - world_pts[i]).length
                if l > best_l:
                    best_l = l
                    best_idx = i

            if best_l < 5.0:
                continue

            pA = world_pts[best_idx]
            pB = world_pts[best_idx + 1]
            seg_v = pB - pA
            mid_pos = (pA + pB) / 2.0
            tangent = seg_v.normalized()
            angle_z = math.atan2(tangent.y, tangent.x)
            if angle_z > math.pi / 2:
                angle_z -= math.pi
            elif angle_z < -math.pi / 2:
                angle_z += math.pi

            req_dist = 24.0 if is_alley else 34.0
            too_close = False
            for p_pos, _ in placed_labels:
                if (mid_pos - p_pos).length < req_dist:
                    too_close = True
                    break
            if too_close:
                continue

            bm_txt = create_text_bmesh(
                disp_name, road_font, font_size, mid_pos, angle_z,
                max_length=best_l * 0.78, max_width=width * 0.72,
                z_offset=0.005,
            )
            if bm_txt is None:
                continue
            append_bmesh_faces(bm, bm_txt, mat_idx=1)
            bm_txt.free()
            placed_labels.append((mid_pos, "alley" if is_alley else "local"))
            if is_alley:
                placed_alley_samples.append((disp_name, mid_pos))

        bm.to_mesh(mesh)
        bm.free()

    print(f"Completed Roads: {len(major_features)} Major Corridors, {len(local_features)} Local/Alley Segments.")
    print(f"Total Road & Alley Surface Markings Embedded: {len(placed_labels)} labels.")
    return placed_major_samples, placed_alley_samples

# ---------------------------------------------------------------------------
# Section 3.D: Individual 3D Buildings
# ---------------------------------------------------------------------------
def build_individual_buildings(collections, mat_lib):
    print("--- Building Individual 3D Buildings ---")
    bldg_file = DATA_DIR / "ba_diem_buildings_processed.geojson"
    if not bldg_file.exists():
        print(f"WARNING: Buildings file not found at {bldg_file}")
        return

    with open(bldg_file, "r", encoding="utf-8") as f:
        bldg_data = json.load(f)

    # Distinct PBR Materials for Building Typologies
    mat_residential = mat_lib.get_or_create(
        "Mat_Bldg_Residential",
        base_color=(0.85, 0.78, 0.68, 1.0),  # Warm architectural sandstone/stucco
        roughness=0.60,
        specular=0.25
    )
    mat_commercial = mat_lib.get_or_create(
        "Mat_Bldg_Commercial",
        base_color=(0.18, 0.42, 0.62, 1.0),  # Modern commercial facade / corporate blue
        roughness=0.28,
        specular=0.65,
        metallic=0.10
    )
    mat_other = mat_lib.get_or_create(
        "Mat_Bldg_Public",
        base_color=(0.82, 0.48, 0.20, 1.0),  # Institutional civic terracotta / ochre
        roughness=0.50,
        specular=0.35
    )

    features = bldg_data.get("features", [])
    total_created = 0
    skipped_count = 0

    for idx, f in enumerate(features):
        props = f.get("properties", {})
        geom = f.get("geometry", {})
        coords = geom.get("coordinates", [[]])[0]

        if len(coords) < 3:
            skipped_count += 1
            continue

        pts_raw = coords[:-1] if coords[0] == coords[-1] else coords
        if len(pts_raw) < 3:
            skipped_count += 1
            continue

        category = props.get("category", "residential")
        height = float(props.get("height_m", 7.0))
        floors = int(props.get("floors", 2))
        fid = props.get("id", f"bldg-{idx}")
        name_vi = props.get("name", "")

        # Target Collection & Material
        if category == "commercial":
            target_col = collections["Commercial_Buildings"]
            mat = mat_commercial
            prefix = "Bldg_Com"
        elif category == "other":
            target_col = collections["Other_Buildings"]
            mat = mat_other
            prefix = "Bldg_Pub"
        else:
            target_col = collections["Residential_Buildings"]
            mat = mat_residential
            prefix = "Bldg_Res"

        local_pts = [latlng_to_blender(p[1], p[0], 0.0) for p in pts_raw]

        # Centroid in local meters
        cx = sum(p.x for p in local_pts) / len(local_pts)
        cy = sum(p.y for p in local_pts) / len(local_pts)
        cz = 0.08

        # 2D normalization relative to centroid
        pts_2d = [(p.x - cx, p.y - cy) for p in local_pts]
        if polygon_2d_area_signed(pts_2d) < 0:
            pts_2d.reverse()

        N = len(pts_2d)
        if N < 3:
            skipped_count += 1
            continue

        # Build clean extruded prism
        bm = bmesh.new()
        v_bot = [bm.verts.new(Vector((x, y, 0.0))) for x, y in pts_2d]
        v_top = [bm.verts.new(Vector((x, y, height))) for x, y in pts_2d]

        try:
            bm.faces.new(list(reversed(v_bot)))
        except:
            pass

        try:
            bm.faces.new(v_top)
        except:
            pass

        for i in range(N):
            try:
                bm.faces.new((v_bot[i], v_bot[(i + 1) % N], v_top[(i + 1) % N], v_top[i]))
            except:
                pass

        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

        obj_name = f"{prefix}_{fid.replace('-', '_')}"
        mesh = bpy.data.meshes.new(f"Mesh_{obj_name}")
        bm.to_mesh(mesh)
        bm.free()

        obj = bpy.data.objects.new(obj_name, mesh)
        obj.location = Vector((cx, cy, cz))
        obj.data.materials.append(mat)
        target_col.objects.link(obj)

        # Custom Geographic Properties (Preserving Source Attributes)
        obj["source"] = props.get("source", "Unknown")
        obj["source_id"] = str(props.get("source_id", ""))
        obj["name"] = name_vi
        obj["category"] = category
        obj["building_type"] = props.get("building_type", "")
        obj["height_m"] = height
        obj["floors"] = floors
        obj["height_estimated"] = props.get("height_estimated", True)
        obj["footprint_area_m2"] = props.get("area_m2", 0.0)
        obj["footprint_type"] = props.get("footprint_type", "")
        obj["in_boundary"] = props.get("in_boundary", True)

        if props.get("source") == "Household_Database":
            obj["address"] = props.get("address", "")
            obj["owner_name"] = props.get("owner_name", "")
            obj["owner_phone"] = props.get("owner_phone", "")
            obj["status"] = props.get("status", "NORMAL")
            obj["hamlet"] = props.get("hamlet", "")
            obj["residents_count"] = props.get("residents_count", 3)

        total_created += 1

    print(f"Completed Individual 3D Buildings: {total_created} generated, {skipped_count} skipped.")

# ---------------------------------------------------------------------------
# Section 3.E: Vegetation & Landmarks
# ---------------------------------------------------------------------------
def build_vegetation_and_landmarks(collections, mat_lib):
    print("--- Building Vegetation & POI Landmarks ---")
    pois_file = DATA_DIR / "ba_diem_pois.geojson"
    if not pois_file.exists():
        return

    with open(pois_file, "r", encoding="utf-8") as f:
        pois_data = json.load(f)

    mat_veg = mat_lib.get_or_create(
        "Mat_Vegetation_Green",
        base_color=(0.14, 0.58, 0.22, 1.0),
        roughness=0.85
    )
    mat_marker_poi = mat_lib.get_or_create(
        "Mat_POI_Marker",
        base_color=(1.0, 0.85, 0.10, 1.0),
        emission=(1.0, 0.85, 0.10, 1.0),
        emission_strength=2.5
    )

    # 1. Landmark Beacons & Proportional 3D Signs
    for f in pois_data.get("features", []):
        props = f.get("properties", {})
        coords = f.get("geometry", {}).get("coordinates", [])
        if len(coords) < 2:
            continue

        loc = latlng_to_blender(coords[1], coords[0], 0.0)
        poi_name = props.get("name", "POI")
        safe_id = props.get("id", "poi").replace("-", "_")

        # 3D Pin Column (beacon)
        mesh_pin = bpy.data.meshes.new(f"Mesh_POI_{safe_id}")
        obj_pin = bpy.data.objects.new(f"POI_Beacon_{safe_id}", mesh_pin)
        collections["Other_Buildings"].objects.link(obj_pin)
        obj_pin.data.materials.append(mat_marker_poi)

        bm = bmesh.new()
        bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            cap_tris=False,
            segments=12,
            radius1=3.0,
            radius2=0.5,
            depth=28.0
        )
        bm.to_mesh(mesh_pin)
        bm.free()
        obj_pin.location = Vector((loc.x, loc.y, 14.0))
        obj_pin["poi_id"] = props.get("id")
        obj_pin["poi_name"] = poi_name
        obj_pin["category"] = props.get("category")

        # 3D Text Sign (proportional size: 8m height)
        curve_text = bpy.data.curves.new(name=f"Curve_Sign_{safe_id}", type='FONT')
        curve_text.body = poi_name.upper()
        curve_text.size = 8.0
        curve_text.extrude = 0.6
        curve_text.align_x = 'CENTER'

        obj_text = bpy.data.objects.new(f"POI_Label_{safe_id}", curve_text)
        obj_text.location = Vector((loc.x, loc.y, 32.0))
        obj_text.rotation_euler = Euler((math.radians(90), 0, 0), 'XYZ')
        obj_text.data.materials.append(mat_marker_poi)
        collections["Other_Buildings"].objects.link(obj_text)

    # 2. Vegetation tree clusters around historic parks
    tree_spots = [
        latlng_to_blender(10.8655, 106.609, 0.0),  # Chợ Đầu Mối / Park
        latlng_to_blender(10.8495, 106.598, 0.0),  # Đình Thần Bà Điểm
        latlng_to_blender(10.8538, 106.6115, 0.0), # Công viên UBND
        latlng_to_blender(10.8580, 106.6080, 0.0), # Khuôn viên Giáo xứ
    ]

    for s_idx, center in enumerate(tree_spots):
        mesh_park = bpy.data.meshes.new(f"Mesh_Park_Green_{s_idx}")
        obj_park = bpy.data.objects.new(f"Park_Green_Zone_{s_idx + 1}", mesh_park)
        collections["Vegetation"].objects.link(obj_park)
        obj_park.data.materials.append(mat_veg)

        bm_p = bmesh.new()
        bmesh.ops.create_circle(bm_p, cap_ends=True, segments=16, radius=40.0)
        bm_p.to_mesh(mesh_park)
        bm_p.free()
        obj_park.location = Vector((center.x, center.y, 0.04))

        # Trees
        for t_idx in range(6):
            ang = (t_idx / 6.0) * math.tau
            tx = center.x + math.cos(ang) * 24.0
            ty = center.y + math.sin(ang) * 24.0

            mesh_tree = bpy.data.meshes.new(f"Mesh_Tree_{s_idx}_{t_idx}")
            obj_tree = bpy.data.objects.new(f"Tree_{s_idx + 1}_{t_idx + 1}", mesh_tree)
            collections["Vegetation"].objects.link(obj_tree)
            obj_tree.data.materials.append(mat_veg)

            bm_t = bmesh.new()
            bmesh.ops.create_icosphere(bm_t, subdivisions=2, radius=6.0)
            bm_t.to_mesh(mesh_tree)
            bm_t.free()
            obj_tree.location = Vector((tx, ty, 6.0))

    print("Completed Vegetation & Landmarks.")

# ---------------------------------------------------------------------------
# Section 3.E: Lighting & Multi-view Cameras
# ---------------------------------------------------------------------------
# Section 3.E: Lighting & Multi-view Cameras
# ---------------------------------------------------------------------------
def point_camera_at(cam_obj, target_loc):
    direction = target_loc - cam_obj.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

def setup_lighting_and_cameras(scene, collections, placed_major_samples=None, placed_alley_samples=None):
    print("--- Setting Up Cameras & Lighting ---")
    col_cam = collections["Cameras_And_Lighting"]

    # 1. Main Sun Lamp (Natural warm sunlight with soft contact shadows)
    light_data = bpy.data.lights.new(name="Light_Sun_Main", type='SUN')
    light_data.energy = 4.2
    light_data.color = (1.0, 0.97, 0.92)
    light_data.angle = math.radians(2.0)  # Soft realistic penumbra

    light_obj = bpy.data.objects.new(name="Sun_Light_Main", object_data=light_data)
    light_obj.location = Vector((-600, -1200, 1500))
    light_obj.rotation_euler = Euler((math.radians(52), math.radians(18), math.radians(-38)), 'XYZ')
    col_cam.objects.link(light_obj)

    # 2. Balanced World Ambient Lighting
    if not scene.world:
        scene.world = bpy.data.worlds.new("World_Ba_Diem")
    world = scene.world
    world.use_nodes = True
    w_nodes = world.node_tree.nodes
    w_links = world.node_tree.links
    w_nodes.clear()

    w_out = w_nodes.new(type="ShaderNodeOutputWorld")
    w_bg = w_nodes.new(type="ShaderNodeBackground")
    w_bg.inputs['Color'].default_value = (0.65, 0.75, 0.88, 1.0)
    w_bg.inputs['Strength'].default_value = 0.65  # Clear contrast and deep shadows
    w_links.new(w_bg.outputs['Background'], w_out.inputs['Surface'])

    # 3. Camera 1: Full Commune Overview (Cinematic Oblique View from SW looking NE)
    cam1_data = bpy.data.cameras.new(name="Data_Cam_Overview")
    cam1_data.lens = 42.0
    cam1_data.clip_start = 1.0
    cam1_data.clip_end = 25000.0

    cam1_obj = bpy.data.objects.new(name="Camera_Full_Commune_Overview", object_data=cam1_data)
    cam1_obj.location = Vector((-1000, -2500, 2000))
    point_camera_at(cam1_obj, Vector((-1165.0, 265.0, 0.0)))
    col_cam.objects.link(cam1_obj)

    # 4. Camera 2: Street-Level Neighborhood Inspection (Central Core: Phan Văn Hớn - QL22)
    cam2_data = bpy.data.cameras.new(name="Data_Cam_Neighborhood")
    cam2_data.lens = 38.0
    cam2_data.clip_start = 0.5
    cam2_data.clip_end = 8000.0

    cam2_obj = bpy.data.objects.new(name="Camera_Neighborhood_Detail", object_data=cam2_data)
    cam2_obj.location = Vector((-150, -450, 220))
    cam2_obj.rotation_euler = Euler((math.radians(55), 0, math.radians(-15)), 'XYZ')
    col_cam.objects.link(cam2_obj)

    # 5. Camera 3: Top-Down Orthographic (1:1 GIS Basemap Verification)
    cam3_data = bpy.data.cameras.new(name="Data_Cam_Ortho")
    cam3_data.type = 'ORTHO'
    cam3_data.ortho_scale = 5800.0
    cam3_data.clip_start = 10.0
    cam3_data.clip_end = 15000.0

    cam3_obj = bpy.data.objects.new(name="Camera_TopDown_Ortho", object_data=cam3_data)
    cam3_obj.location = Vector((-1165.0, 265.0, 6000.0))
    cam3_obj.rotation_euler = Euler((0, 0, 0), 'XYZ')
    col_cam.objects.link(cam3_obj)

    # 6. Camera 4: Major Road Closeup (Focus on embedded road surface text)
    cam_maj_data = bpy.data.cameras.new(name="Data_Cam_Major_Road")
    cam_maj_data.lens = 45.0
    cam_maj_data.clip_start = 0.2
    cam_maj_data.clip_end = 2000.0
    cam_maj_obj = bpy.data.objects.new(name="Camera_Major_Road_Closeup", object_data=cam_maj_data)

    maj_target = None
    if placed_major_samples:
        for name, pos in placed_major_samples:
            if "phan văn hớn" in name.casefold():
                maj_target = (name, pos)
                break
        if not maj_target:
            maj_target = placed_major_samples[0]

    if maj_target:
        T_m = maj_target[1]
        print(f"Targeting Major Road Camera to: {maj_target[0]} at {T_m}")
        cam_maj_obj.location = Vector((T_m.x + 45.0, T_m.y - 70.0, T_m.z + 55.0))
        point_camera_at(cam_maj_obj, T_m)
    else:
        cam_maj_obj.location = Vector((-200.0, -100.0, 30.0))
        point_camera_at(cam_maj_obj, Vector((-200.0, -80.0, 0.0)))
    col_cam.objects.link(cam_maj_obj)

    # 7. Camera 5: Narrow Alley Closeup (Focus on embedded alley surface text)
    cam_aly_data = bpy.data.cameras.new(name="Data_Cam_Narrow_Alley")
    cam_aly_data.lens = 42.0
    cam_aly_data.clip_start = 0.2
    cam_aly_data.clip_end = 1000.0
    cam_aly_obj = bpy.data.objects.new(name="Camera_Narrow_Alley_Closeup", object_data=cam_aly_data)

    aly_target = None
    if placed_alley_samples:
        for name, pos in placed_alley_samples:
            if name.casefold().startswith("hẻm"):
                aly_target = (name, pos)
                break
        if not aly_target:
            aly_target = placed_alley_samples[0]

    if aly_target:
        T_a = aly_target[1]
        print(f"Targeting Narrow Alley Camera to: {aly_target[0]} at {T_a}")
        cam_aly_obj.location = Vector((T_a.x + 8.0, T_a.y - 12.0, T_a.z + 9.5))
        point_camera_at(cam_aly_obj, T_a)
    else:
        cam_aly_obj.location = Vector((-300.0, -200.0, 15.0))
        point_camera_at(cam_aly_obj, Vector((-300.0, -190.0, 0.0)))
    col_cam.objects.link(cam_aly_obj)

    # Default active camera
    scene.camera = cam1_obj
    print("Completed Cameras & Lighting.")

# ---------------------------------------------------------------------------
# Section 5.B: Render Validation Images
# ---------------------------------------------------------------------------
def render_validation_images(scene, collections):
    print("--- Rendering High-Fidelity Validation Images ---")
    render_dir = PROJECT_ROOT / "data" / "renders"
    render_dir.mkdir(parents=True, exist_ok=True)
    brain_dir = Path(r"C:\Users\admin\.gemini\antigravity-ide\brain\f141ab4b-d4f1-44d1-9401-8f3790af2db3")

    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'

    render_tasks = [
        ("Camera_Full_Commune_Overview", "render_overview.png"),
        ("Camera_Major_Road_Closeup", "render_major_road.png"),
        ("Camera_Narrow_Alley_Closeup", "render_narrow_alley.png")
    ]

    import shutil
    for cam_name, filename in render_tasks:
        cam_obj = bpy.data.objects.get(cam_name)
        if not cam_obj:
            print(f"Warning: camera {cam_name} not found, skipping render.")
            continue
        scene.camera = cam_obj
        out_path = render_dir / filename
        scene.render.filepath = str(out_path)
        print(f"Rendering {cam_name} -> {out_path}...")
        bpy.ops.render.render(write_still=True)
        print(f"Successfully rendered: {out_path}")

        try:
            target_artifact = brain_dir / filename
            shutil.copyfile(out_path, target_artifact)
            print(f"Copied render to artifact dir: {target_artifact}")
        except Exception as e:
            print(f"Notice copying to artifact: {e}")

# ---------------------------------------------------------------------------
# Section 6: File Export & Verification
# ---------------------------------------------------------------------------
def save_and_export(scene):
    print("--- Saving Native .blend Project & Exporting .glb ---")
    t0 = time.time()

    # Save Native Blender .blend project
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(f"Successfully saved native project to: {OUTPUT_BLEND}")

    # Also save to ban-do-ve-tay/Ba_Diem_3D.blend for redundancy
    sub_blend = PROJECT_ROOT / "ban-do-ve-tay" / "Ba_Diem_3D.blend"
    sub_blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(sub_blend), copy=True)
    print(f"Saved synchronized copy to: {sub_blend}")

    # Export Intermediate GLB
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(OUTPUT_GLB),
            export_format='GLB',
            use_selection=False,
            export_apply=True,
            export_materials='EXPORT',
            export_cameras=True,
            export_lights=True
        )
        print(f"Exported .glb model to: {OUTPUT_GLB} (Size: {os.path.getsize(OUTPUT_GLB) / (1024*1024):.2f} MB)")
    except Exception as e:
        print(f"GLTF Export Notice: {e}")

    dt = time.time() - t0
    print(f"File saving & export completed in {dt:.2f}s.")

# ---------------------------------------------------------------------------
# Main Orchestration
# ---------------------------------------------------------------------------
def main():
    print("=================================================================")
    print("  STARTING GEOGRAPHIC 3D MODEL GENERATION: XÃ BÀ ĐIỂM, TP.HCM   ")
    print("=================================================================")
    t_start = time.time()

    scene, collections = setup_scene("Scene_Ba_Diem_3D")
    mat_lib = MaterialLibrary()

    # Step 1: Terrain & Boundary
    build_terrain_and_boundaries(collections, mat_lib)

    # Step 2: Road Network
    placed_major_samples, placed_alley_samples = build_roads(collections, mat_lib)

    # Step 3: Individual 3D Buildings
    build_individual_buildings(collections, mat_lib)

    # Step 4: Vegetation & POIs
    build_vegetation_and_landmarks(collections, mat_lib)

    # Step 5: Lighting & Multi-view Cameras
    setup_lighting_and_cameras(scene, collections, placed_major_samples, placed_alley_samples)

    # Step 6: Render Validation Images
    render_validation_images(scene, collections)

    # Step 7: Save & Export
    save_and_export(scene)

    t_total = time.time() - t_start
    print(f"=================================================================")
    print(f"  ALL TASKS FINISHED SUCCESSFULLY IN {t_total:.2f}s!             ")
    print(f"  Scene Objects: {len(scene.objects)}                           ")
    print(f"=================================================================")

if __name__ == "__main__":
    main()
