"""Audit existing sources and prepare metric, clipped, reproducible spatial tiles."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from collections import Counter
from shapely.geometry import shape, Polygon, LineString, box, mapping
from shapely import make_valid, constrained_delaunay_triangles
from shapely.ops import transform, unary_union
from pyproj import Transformer, Proj

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/hcmc_processed'
SCRATCH = ROOT / 'data/vietmap/vector_sources'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def parts(g, kind):
    if g.geom_type == kind:
        yield g
    elif hasattr(g, 'geoms'):
        for child in g.geoms:
            yield from parts(child, kind)

def mesh(g):
    vertices, faces = [], []
    for poly in parts(g, 'Polygon'):
        for tri in constrained_delaunay_triangles(poly).geoms:
            start = len(vertices)
            vertices.extend([list(c[:2]) for c in list(tri.exterior.coords)[:3]])
            faces.append([start, start + 1, start + 2])
    return {'vertices': vertices, 'faces': faces}

def number(value):
    try:
        n = float(str(value).lower().removesuffix('m').strip())
        return n if math.isfinite(n) and n > 0 else None
    except (ValueError, TypeError):
        return None

def estimated_massing(footprint):
    """Illustrative form from geometry only, never an inferred building use."""
    area = footprint.area
    hull = footprint.minimum_rotated_rectangle
    edges = [math.dist(a, b) for a, b in zip(list(hull.exterior.coords), list(hull.exterior.coords)[1:])]
    short = max(min(edges), 0.01)
    aspect = max(edges) / short
    if area < 80:
        form, height = 'small_footprint', 5.5
    elif aspect >= 3 and area < 600:
        form, height = 'narrow_footprint', 7.5
    elif area < 600:
        form, height = 'medium_footprint', 8.0
    elif area < 1500:
        form, height = 'broad_footprint', 10.0
    else:
        form, height = 'very_large_footprint', 12.0
    return {'visual_massing_class': form, 'visual_massing_estimated': True,
            'visual_massing_basis': 'footprint_area_and_aspect_only',
            'footprint_area_m2': round(area, 2), 'footprint_aspect_ratio': round(aspect, 2),
            'estimated_massing_height_m': height}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tile-size', type=float, default=1000)
    ap.add_argument('--floor-height', type=float, default=3.5)
    ap.add_argument('--default-height-scale', type=float, default=1.0)
    ap.add_argument('--default-width-scale', type=float, default=1.0)
    ap.add_argument('--sources', type=Path, default=SCRATCH)
    ap.add_argument('--provider', choices=['vietmap','osm'], default='vietmap')
    ap.add_argument('--boundary', type=Path, default=ROOT / 'data/gis_processed/ba_diem_post_merger_boundary_provisional.geojson')
    args = ap.parse_args()
    if any(not math.isfinite(v) or v <= 0 for v in (args.tile_size, args.floor_height, args.default_height_scale, args.default_width_scale)):
        ap.error('tile size and estimation parameters must be finite and positive')
    project = Transformer.from_crs(4326, 32648, always_xy=True).transform
    boundary_doc = read(args.boundary)
    outer = [f for f in boundary_doc['features'] if f['properties'].get('is_outer')]
    if not outer:
        raise ValueError('Boundary must explicitly identify authoritative outer features with is_outer=true')
    boundary = unary_union([make_valid(transform(project, shape(f['geometry']))) for f in outer])
    center = [boundary.centroid.x, boundary.centroid.y]
    stats, failures, records, sources = {}, [], [], []
    datasets=[('roads','road.geojson'),('buildings','building.geojson')] if args.provider=='vietmap' else [('roads','osm_roads_raw.json'),('buildings','osm_buildings.json')]
    for kind, filename in datasets:
        path = args.sources / filename
        doc = read(path)
        if args.provider=='vietmap':
            elements=[]
            for feature in doc['features']:
                tags=dict(feature['properties']['provider_properties'])
                if kind=='roads':
                    tags['highway']={'minor':'residential','street':'residential','path':'footway'}.get(tags.get('class'),tags.get('class','service'))
                    if tags.get('brunnel') not in (None,0,'0',''):tags['layer']='unresolved'
                else:tags['building']=tags.get('class','yes')
                elements.append({'id':feature['properties']['source_id'],'geojson':feature['geometry'],'tags':tags,'provider_metadata':feature['properties']})
            doc['elements']=elements
        sources.append({'provider':args.provider.upper(), 'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'metadata': doc.get('osm3s'), 'kind': kind})
        counts = Counter(input=len(doc['elements']))
        seen = set()
        for el in doc['elements']:
            sid = el['id'] if args.provider=='vietmap' else f"osm-{el.get('type')}-{el.get('id')}"
            try:
                tags = el.get('tags', {})
                if (kind == 'roads' and not tags.get('highway')) or (kind == 'buildings' and not tags.get('building')):
                    counts['unsupported'] += 1
                    failures.append({'id': sid, 'reason': 'missing required highway/building tag'})
                    continue
                if 'geojson' in el:
                    raw=shape(el['geojson'])
                else:
                    coords = [(p['lon'], p['lat']) for p in el.get('geometry', [])]
                    if kind == 'buildings' and (len(coords) < 4 or coords[0] != coords[-1]):
                        raise ValueError('Footprint not a closed source polygon; no invented closure')
                    raw = Polygon(coords) if kind == 'buildings' else LineString(coords)
                g = transform(project, raw)
                if not g.is_valid:
                    g = make_valid(g)
                    counts['repaired'] += 1
                key = (sid, g.wkb)
                if key in seen:
                    counts['duplicate'] += 1
                    failures.append({'id': sid, 'reason': 'duplicate source ID and geometry'})
                    continue
                seen.add(key)
                g = g.intersection(boundary)
                if g.is_empty:
                    counts['outside'] += 1
                    continue
                props = {'source_id': sid, 'tags': tags, 'source': 'VIETMAP' if args.provider=='vietmap' else 'OpenStreetMap', 'name': tags.get('name:vi', tags.get('name', ''))}
                if args.provider=='vietmap':props['provider_metadata']=el['provider_metadata']
                if kind == 'buildings':
                    h, levels = number(tags.get('height')), number(tags.get('building:levels'))
                    massing = estimated_massing(g)
                    category = tags.get('building', 'yes')
                    category = 'commercial' if tags.get('shop') or category in ('commercial', 'retail') else 'industrial' if category in ('industrial', 'warehouse') else 'residential' if category in ('house', 'residential', 'apartments', 'detached', 'terrace') else 'other'
                    props.update(massing)
                    props.update(category=category, height_m=h or ((levels * 3.5) if levels else massing['estimated_massing_height_m']), height_estimated=h is None, height_basis='source_height_unverified_measurement' if h else 'source_levels_times_3.5m' if levels else 'footprint_area_aspect_illustrative', floors=levels)
                    counts['estimated_heights' if h is None else 'source_heights'] += 1
                    if h is None:
                        props['height_m'] = levels * args.floor_height if levels else props['height_m'] * args.default_height_scale
                        if levels: props['height_basis'] = f'source_levels_times_{args.floor_height}m'
                else:
                    width = number(tags.get('width'))
                    cls = tags['highway']
                    props.update(width_m=width or {'motorway':20, 'trunk':16, 'primary':12, 'secondary':10, 'tertiary':8, 'residential':5, 'service':3.5, 'footway':1.5}.get(cls, 3.5), width_estimated=width is None, category='major' if cls in ('motorway','trunk','primary','secondary') else 'local', elevation_unresolved=tags.get('bridge') == 'yes' or tags.get('tunnel') == 'yes' or tags.get('layer', '0') != '0')
                    counts['unnamed' if not props['name'] else 'named'] += 1
                    counts['estimated_widths' if width is None else 'source_widths'] += 1
                    if width is None: props['width_m'] *= args.default_width_scale
                    if props['elevation_unresolved']:
                        counts['elevation_unresolved'] += 1
                records.append((kind, g, props))
                counts['accepted'] += 1
            except Exception as e:
                counts['failed'] += 1
                failures.append({'id': sid, 'reason': str(e)})
        stats[kind] = dict(counts)
    if args.provider=='vietmap':
        for path in sorted(args.sources.glob('*.geojson')):
            layer=path.stem
            if layer in ('road','building'):continue
            sources.append({'provider':'VIETMAP','path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'kind':layer})
            counts=Counter()
            for f in read(path)['features']:
                counts['input']+=1
                try:
                    g=make_valid(transform(project,shape(f['geometry']))).intersection(boundary)
                    if g.is_empty:counts['outside']+=1;continue
                    props=dict(f['properties']);props['name']=props['provider_properties'].get('name','')
                    props['category']=props['provider_properties'].get('class','')
                    records.append((layer,g,props));counts['accepted']+=1
                except Exception as e:
                    counts['failed']+=1;failures.append({'id':f['properties'].get('source_id'),'reason':str(e)})
            stats[layer]=dict(counts)
    tiles = []
    size = args.tile_size
    xmin, ymin, xmax, ymax = boundary.bounds
    # Store one tile at a time; index avoids scanning the full dataset per tile.
    from shapely.strtree import STRtree
    index = STRtree([r[1] for r in records])
    for ix in range(math.floor(xmin/size), math.ceil(xmax/size)):
        for iy in range(math.floor(ymin/size), math.ceil(ymax/size)):
            cell = box(ix*size, iy*size, (ix+1)*size, (iy+1)*size)
            land = boundary.intersection(cell)
            if land.area <= 0:
                continue
            origin = [ix*size, iy*size]
            local = lambda g: transform(lambda x,y,z=None: (x-origin[0], y-origin[1]), g)
            features = []
            assigned_road_surface = Polygon()
            assigned_mapped_surfaces = {}
            for rid in index.query(cell, predicate='intersects'):
                kind, geom, props = records[int(rid)]
                # Buildings remain complete and owned by one tile; roads clip at tile edges.
                if kind == 'buildings':
                    p = geom.representative_point()
                    if (math.floor(p.x/size), math.floor(p.y/size)) != (ix, iy):
                        continue
                    clipped = geom
                else:
                    clipped = geom.intersection(cell)
                component_kind='Polygon' if 'Polygon' in clipped.geom_type else 'LineString' if 'LineString' in clipped.geom_type else 'Point' if 'Point' in clipped.geom_type else None
                if kind=='roads' and component_kind!='LineString':
                    failures.append({'id':props['source_id'],'tile':f'{ix}_{iy}','reason':'road touches tile only at point; no pavement fragment'})
                    continue
                if component_kind is None:
                    failures.append({'id':props['source_id'],'reason':'unhandled clipped geometry '+clipped.geom_type});continue
                for part_idx, component in enumerate(parts(clipped, component_kind)):
                    geo = local(component)
                    feature = {'kind':kind, 'properties':props, 'part':part_idx, 'geometry':mapping(geo)}
                    if kind == 'buildings':
                        feature['mesh'] = mesh(geo)
                        feature['rings'] = [list(geo.exterior.coords)] + [list(r.coords) for r in geo.interiors]
                    elif kind=='roads':
                        surface = component.buffer(props['width_m']/2, cap_style=1).intersection(boundary).intersection(cell)
                        # Partition intersecting pavements without coplanar overlapping faces.
                        available_surface = surface.difference(assigned_road_surface)
                        assigned_road_surface = assigned_road_surface.union(surface)
                        feature['mesh'] = mesh(local(available_surface))
                    elif component_kind=='Polygon':
                        prior=assigned_mapped_surfaces.get(kind,Polygon())
                        feature['mesh']=mesh(local(component.difference(prior)))
                        assigned_mapped_surfaces[kind]=prior.union(component)
                    else:feature['mesh']={'vertices':[],'faces':[]}
                    features.append(feature)
            tid = f'{ix}_{iy}'
            payload = {'id':tid, 'origin':origin, 'terrain':mesh(local(land)), 'boundary':mapping(local(boundary.boundary.intersection(cell))), 'features':features}
            digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
            path = OUT / 'tiles' / f'{tid}.json'
            if not path.exists() or hashlib.sha256(json.dumps(read(path), sort_keys=True).encode()).hexdigest() != digest:
                write(path, payload)
            tiles.append({'id':tid, 'sha256':digest, 'features':len(features)})
    factors = [Proj(32648).get_factors(lon,lat).meridional_scale for lon,lat in [c[:2] for f in outer for p in parts(shape(f['geometry']), 'Polygon') for c in p.exterior.coords]]
    manifest = {'scope':'Post-merger Bà Điểm from union of three predecessor communes; geometry provisional, feature coverage incomplete', 'boundary':{'path':str(args.boundary), 'sha256':hashlib.sha256(args.boundary.read_bytes()).hexdigest(), 'administrative_level':'commune configuration', 'effective_date':'2025-07-01', 'legal_verification':False, 'geometry_status':'provisional_non_official_geometry', 'area_km2':boundary.area/1e6}, 'crs':'EPSG:32648', 'source_crs':'EPSG:4326', 'origin':center, 'projection_scale_range':[min(factors),max(factors)], 'tile_size_m':size, 'sources':sources, 'counts':stats, 'tiles':tiles, 'failures':failures, 'limitations':['The predecessor-commune geometry is from a public ArcGIS layer, not an official legal survey.', 'No DEM supplied; terrain is flat.', 'VietMap exposes sparse building polygons here; missing footprints are not fabricated.', 'Road widths and building heights are estimated where source attributes are absent.', 'Elevated/tunnel roads remain schematic at ground level and are flagged.', 'Features are loaded per source layer in memory; regional streaming is not yet implemented.']}
    manifest['estimation_settings'] = {'floor_height_m':args.floor_height, 'default_height_scale':args.default_height_scale, 'default_width_scale':args.default_width_scale}
    manifest['geometry_provider']=args.provider.upper()
    if args.provider=='vietmap':
        manifest['vector_source_manifest']=str(args.sources/'vector_manifest.json')
        manifest['vector_source_info']=read(args.sources/'vector_manifest.json')['source_info']
        manifest['limitations']=[s for s in manifest['limitations'] if s!='No DEM, water polygons or mapped vegetation supplied.' and not s.startswith('Input Overpass JSON')]+['No DEM supplied. VietMap water and landuse geometry used where present; unmapped areas are unknown.', 'Normalized SDK features and accepted geometries are retained in memory; larger extents require regional/streaming batches.']
    write(OUT/'dataset_manifest.json', manifest)
    write(OUT/'failures.json', failures)
    report = '# Ho Chi Minh City 3D — actual data quality\n\n' + manifest['scope'] + '\n\nBoundary effective date: unknown. Legal status: unverified. The existing preprocessing script hardcodes this polygon; it is not evidence of an official administrative boundary. Current-city equivalence cannot be established.\n\n' + f'Available extent: {boundary.area/1e6:.3f} km²; {len(tiles)} tiles. CRS EPSG:32648, metres; scale factors {min(factors):.8f}–{max(factors):.8f}. This projection assessment applies only to this supplied extent. Larger replacements require reassessment.\n\n' + '```json\n'+json.dumps(stats,indent=2)+'\n```\n\n' + '\n'.join('- '+s for s in manifest['limitations']) + '\n\nRaw OpenStreetMap files carry ODbL attribution in their headers. No VietMap imagery is redistributed: imagery permissions/georeferencing are unverified. Household point buffers, fake-data records, invented names, decorative trees and POI blocks are excluded. Source spelling and IDs are retained. Full-city percentage cannot be computed without a verified target boundary. All tiles have partial/unknown source completeness; outside this extent is missing coverage.\n\nFailures and duplicates: see `data/hcmc_processed/failures.json`. Original data is preserved. Prior Bà Điểm report retained in `docs/DATA_QUALITY_REPORT_BA_DIEM_PREVIOUS.md`; its accuracy claims are not adopted.\n'
    (ROOT/'DATA_QUALITY_REPORT.md').write_text(report, encoding='utf-8')
    if args.provider=='vietmap':
        report=report.replace('Raw OpenStreetMap files carry ODbL attribution in their headers.', 'All active geographic feature inputs now come from the current VIETMAP official SDK source. Original OSM datasets are retained but not used by the default pipeline.')
        report=report.replace('No VietMap imagery is redistributed: imagery permissions/georeferencing are unverified.', 'VIETMAP is the sole current map and feature provider. See its vector/basemap manifests for API source version, SDK, retrieval time and georeferencing. Account redistribution terms are not independently verified.')
        (ROOT/'DATA_QUALITY_REPORT.md').write_text(report, encoding='utf-8')
    if args.provider=='vietmap':
        vector_manifest=read(args.sources/'vector_manifest.json')
        road_stats=stats.get('roads',{})
        building_stats=stats.get('buildings',{})
        report=(
            '# Bà Điểm 3D — post-merger data quality\n\n'
            'The 2025 consolidation resolution combines Bà Điểm, Trung Chánh and Xuân Thới Thượng. '
            'Their polygons from a public ArcGIS layer were unioned into one **provisional, non-official** boundary. '
            'It resembles the supplied reference image but has not been certified as the legal surveyed boundary.\n\n'
            f'- Boundary: `{args.boundary.relative_to(ROOT)}`; {boundary.area/1e6:.3f} km², EPSG:4326 → EPSG:32648.\n'
            f'- VietMap source tiles: {vector_manifest["tile_count"]}; requested zoom {vector_manifest.get("requested_zoom")}, effective native zoom {vector_manifest["zoom"]}.\n'
            f'- Processed GIS tiles: {len(tiles)}; roads accepted: {road_stats.get("accepted",0)} '
            f'({road_stats.get("named",0)} named, {road_stats.get("unnamed",0)} unnamed); '
            f'building footprints accepted: {building_stats.get("accepted",0)}.\n'
            f'- Width estimates: {road_stats.get("estimated_widths",0)}; height estimates: {building_stats.get("estimated_heights",0)}.\n'
            f'- Source layer counts: `{json.dumps(vector_manifest["counts"],ensure_ascii=False)}`.\n'
            f'- Source-query failures: {len(vector_manifest.get("failures",[]))}; GIS processing failures: {len(failures)}.\n\n'
            'Only actual exposed VietMap features were modeled. Building coverage is sparse, and no absent footprints, roads, names, heights or terrain elevation were invented. '
            'See `data/vietmap/vector_sources/vector_manifest.json`, `data/hcmc_processed/dataset_manifest.json` and `data/hcmc_processed/failures.json` for provenance and detailed counts. '
            'VietMap account redistribution terms were not independently verified.\n'
        )
        (ROOT/'DATA_QUALITY_REPORT.md').write_text(report, encoding='utf-8')
    print(json.dumps({'tiles':len(tiles), 'counts':stats}, indent=2))

if __name__ == '__main__':
    main()
