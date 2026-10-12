"""Road paint geometry: source names only, curved placement, footprint containment."""
import math
import bpy
from mathutils import Vector
from shapely.geometry import LineString, Polygon
from generate_ba_diem_3d import create_text_bmesh

def embedded_name(feature, font, occupied, global_origin, obstacles):
    props = feature['properties']
    name = props['name'].strip()
    if not name:
        return None, 'unnamed'
    if props['elevation_unresolved']:
        return None, 'unresolved_elevation'
    line = LineString(feature['geometry']['coordinates'])
    width = props['width_m']
    length = min(line.length * .65, max(12, len(name)*width*.40), 120)
    if line.length < 12 or width < 2:
        return None, 'insufficient_space'
    mid = line.interpolate(.5, normalized=True)
    point = (mid.x + global_origin[0], mid.y + global_origin[1])
    if any(math.dist(point, p) < (160 if n == name else 25) for p,n in occupied):
        return None, 'spacing'
    bm = create_text_bmesh(name, font, min(width*.42, 6), Vector((0,0,.06)), 0, length, width*.65, z_offset=.002)
    if bm is None:
        return None, 'glyph_fit'
    for v in bm.verts:
        distance = line.length/2 + v.co.x
        sample = line.interpolate(distance)
        before, after = line.interpolate(max(0,distance-.15)), line.interpolate(min(line.length,distance+.15))
        angle = math.atan2(after.y-before.y, after.x-before.x)
        lateral = v.co.y
        v.co.x = sample.x - math.sin(angle)*lateral
        v.co.y = sample.y + math.cos(angle)*lateral
    surface = line.buffer(width/2, cap_style=2)
    # Validate against actual triangulated, boundary-clipped surface as well.
    from shapely.ops import unary_union
    mesh = feature['mesh']
    surface = unary_union([Polygon([mesh['vertices'][i] for i in face]) for face in mesh['faces']])
    for face in bm.faces:
        poly = Polygon([(v.co.x,v.co.y) for v in face.verts])
        if not surface.covers(poly) or any(o.intersects(poly) for o in obstacles):
            bm.free()
            return None, 'surface_or_building_collision'
    occupied.append((point,name))
    return bm, 'painted'
