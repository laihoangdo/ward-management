"""Validate tiled metric meshes and report overlaps without altering source geometry."""
import json
from pathlib import Path
from collections import Counter
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data/hcmc_processed'

def surface(mesh):
    return unary_union([Polygon([mesh['vertices'][i] for i in face]) for face in mesh['faces']])

def main():
    manifest=json.loads((DATA/'dataset_manifest.json').read_text(encoding='utf-8'))
    terrain=[];buildings=[];roads=[];errors=[];counts=Counter()
    from shapely.affinity import translate
    for tile in manifest['tiles']:
        data=json.loads((DATA/'tiles'/f"{tile['id']}.json").read_text(encoding='utf-8'))
        dx,dy=data['origin']
        land=surface(data['terrain']);terrain.append(translate(land,dx,dy))
        pavements=[]
        for f in data['features']:
            counts[f['kind']+'_parts']+=1
            geo=shape(f['geometry'])
            mesh=surface(f['mesh'])
            if not geo.is_valid or not mesh.is_valid:
                errors.append({'tile':tile['id'],'id':f['properties']['source_id'],'reason':'invalid processed geometry'})
            if f['kind']=='buildings':
                if geo.symmetric_difference(mesh).area>1e-5:
                    errors.append({'tile':tile['id'],'id':f['properties']['source_id'],'reason':'triangulation footprint mismatch'})
                buildings.append(translate(geo,dx,dy))
            elif f['kind']=='roads':
                pavements.append(mesh);roads.append(translate(mesh,dx,dy))
        overlap=sum(g.area for g in pavements)-unary_union(pavements).area
        if overlap>1e-5:errors.append({'tile':tile['id'],'reason':'overlapping road faces','area':overlap})
    union=unary_union(terrain)
    seam_overlap=sum(g.area for g in terrain)-union.area
    area_error=abs(union.area/1e6-manifest['boundary']['area_km2'])
    if seam_overlap>1e-5 or area_error>1e-8:errors.append({'reason':'terrain tiling mismatch'})
    index=STRtree(roads)
    conflicts=0
    for building in buildings:
        if any(building.intersection(roads[int(i)]).area>.1 for i in index.query(building,predicate='intersects')):
            conflicts+=1
    report={'counts':dict(counts),'terrain_overlap_m2':seam_overlap,'terrain_area_error_km2':area_error,'buildings_intersecting_estimated_road_surfaces':conflicts,'errors':errors,'note':'Road widths are estimated; intersections with footprints are unresolved source/width conflicts, not coordinate corrections. No source footprints displaced.'}
    (DATA/'geometry_validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
    if errors:raise SystemExit(1)

if __name__=='__main__':main()
