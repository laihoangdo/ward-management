"""Rebuild provisional hamlet boundaries from the vector PDF, never from household positions.

uv run --with pymupdf --with shapely --with numpy --with pyproj --with matplotlib python scripts/derive-badiem-hamlet-boundaries.py
Outputs are deterministic inputs for the one-time Liquibase migration.
"""
import hashlib
import json
import re
import unicodedata
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pymupdf
from pyproj import Transformer
from shapely import set_precision, voronoi_polygons, transform as transform_geometry
from shapely.geometry import LineString, MultiPoint, Point, Polygon, mapping, shape
from shapely.ops import polygonize, unary_union

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'src/main/resources/config/liquibase/data'
ASSETS = ROOT / 'src/main/webapp/content/data'
QA = ROOT / 'docs/badiem-boundaries'
VERSION = 'pdf-20261018-v1'


def transform(function, geometry):
    return transform_geometry(geometry, function, interleaved=False)


def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s.upper().replace('Đ', 'D')) if not unicodedata.combining(c))


def parts(g):
    return list(g.geoms) if hasattr(g, 'geoms') else [g]


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


def main():
    pdf = next(ROOT.glob('18.6B*.pdf'))
    page = pymupdf.open(pdf)[0]
    drawings = page.get_drawings()
    lines = []
    fills = {}
    for d in drawings:
        if d['type'] == 's' and d['color'] and d['color'][0] == 1 and d['color'][2] in (0, 1):
            for i in d['items']:
                if i[0] == 'l':
                    lines.append(set_precision(LineString([(i[1].y, i[1].x), (i[2].y, i[2].x)]), .01))
        if d['type'] == 'f':
            pts = [(i[1].y, i[1].x) for i in d['items'] if i[0] == 'l']
            if len(pts) >= 3:
                fills.setdefault(d['fill'], []).append(Polygon(pts).buffer(0))
    regions = [p for p in polygonize(unary_union(lines)) if p.area > 100]
    assert len(regions) == 49, 'PDF vector structure changed; review extraction'
    # Two shared boundaries have a stroke gap in the PDF. Recover their actual
    # coloured fill edges, rather than inventing a centroid/Voronoi hamlet split.
    fill_regions = [p for gs in fills.values() for p in parts(unary_union(gs)) if p.area > 100]
    for label in ((1049.9444, 373.4046), (919.0, 173.0)):
        seed = Point(label)
        parent = next(p for p in regions if p.covers(seed))
        child = min((p for p in fill_regions if p.covers(seed)), key=lambda p: p.area)
        regions.remove(parent)
        regions.extend([parent.intersection(child), parent.difference(child)])
    assert len(regions) == 51 and all(p.is_valid for p in regions)

    labels = []
    for b in page.get_text('dict')['blocks']:
        ss = [s for l in b.get('lines', []) for s in l['spans']
              if 5.2 < s['size'] < 11 and s['color'] in (16711935, 16711743, 65280, 16711680)]
        if not ss:
            continue
        name = ' '.join(s['text'] for s in ss)
        if norm(name) == 'TIEN LAN 2 TIEN LAN 3':
            groups = [ss[:2], ss[2:]]
        else:
            groups = [ss]
        for group in groups:
            bbox = [min(s['bbox'][0] for s in group), min(s['bbox'][1] for s in group),
                    max(s['bbox'][2] for s in group), max(s['bbox'][3] for s in group)]
            labels.append((' '.join(s['text'] for s in group), Point((bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2)))
    catalog = (ROOT / 'src/main/webapp/app/gis/data/baDiemHamlets.ts').read_text(encoding='utf-8')
    hamlets = [dict(id=int(i), code=c, name=n) for i, c, n in re.findall(r"id: (\d+), code: '([^']+)', name: '([^']+)'", catalog)]
    matched = []
    for h in hamlets:
        label = [p for n, p in labels if norm(n) == norm(h['name'])]
        assert len(label) == 1, h
        found = [p for p in regions if p.covers(label[0])]
        assert len(found) == 1, h
        matched.append(found[0])
    assert len({p.wkb for p in matched}) == 51, 'Labels must identify 51 distinct regions'

    commune_file = ROOT / 'src/main/webapp/content/assets/xa_ba_diem.geojson'
    assert hashlib.sha256(pdf.read_bytes()).hexdigest() == '5908c4d76d1d53fd77c712590f46cd95d6c941832518bc8513fe078ccfa9bb7a', 'Review changed PDF before reusing control points'
    assert hashlib.sha256(commune_file.read_bytes()).hexdigest() == '471b0e4109eef04172474631b6697ff0edfc11b8a0e9ca63a1d54b66506fd247', 'Review changed commune before reusing indexed control points'
    commune_json = json.loads(commune_file.read_text(encoding='utf-8'))
    commune_ll = unary_union([shape(f['geometry']) for f in commune_json['features']])
    forward = Transformer.from_crs(4326, 32648, always_xy=True)
    reverse = Transformer.from_crs(32648, 4326, always_xy=True)
    commune = set_precision(transform(forward.transform, commune_ll), .001)
    outer = unary_union(regions)
    pdf_coords = np.array(outer.exterior.coords)
    target_coords = np.array(max(parts(transform(forward.transform, commune_ll)), key=lambda p: p.area).simplify(30).exterior.coords)
    # Distinct corresponding corners, checked visually on both outlines. Indices
    # refer to the unchanged commune input, protected by its hash in the report.
    anchors = [(42, [125, 651]), (43, [50, 339]), (1, [1085, 719]),
               (67, [993, 70]), (66, [957, 67]), (40, [532, 652]), (41, [417, 607])]
    src = np.array([pdf_coords[np.argmin(np.linalg.norm(pdf_coords - p, axis=1))] for _, p in anchors])
    dst = np.array([target_coords[i] for i, _ in anchors])
    matrix = np.linalg.lstsq(np.c_[src, np.ones(len(src))], dst, rcond=None)[0]

    def affine(x, y, z=None):
        return matrix[0, 0] * np.asarray(x) + matrix[1, 0] * np.asarray(y) + matrix[2, 0], matrix[0, 1] * np.asarray(x) + matrix[1, 1] * np.asarray(y) + matrix[2, 1]

    projected = [set_precision(transform(affine, p), .001) for p in matched]
    # Sequential subtraction only resolves floating-point line intersections;
    # original polygonized faces already share the same edges.
    final = []
    used = Polygon()
    for p in projected:
        q = set_precision(p.intersection(commune).difference(used), .001)
        final.append(q)
        used = set_precision(used.union(q), .001)
    gap = set_precision(commune.difference(used), .001)
    assert gap.area / commune.area < .015, 'Georeferencing mismatch too large'
    # Only uncovered edge slivers inherit the nearest existing polygon boundary.
    # This does NOT generate internal hamlet boundaries from nearest centroids.
    sites = {}
    for i, p in enumerate(final):
        for ring in parts(p.boundary):
            for distance in np.arange(0, ring.length, 10):
                q = ring.interpolate(distance)
                sites.setdefault((round(q.x, 3), round(q.y, 3)), i)
    cells = voronoi_polygons(MultiPoint(list(sites)), extend_to=commune.envelope, ordered=True)
    additions = [[] for _ in final]
    for cell, owner in zip(cells.geoms, sites.values()):
        if cell.intersects(gap):
            additions[owner].append(cell.intersection(gap))
    final = [set_precision(unary_union([p, *adds]), .001) for p, adds in zip(final, additions)]
    assert all(p.is_valid and p.area > 100 for p in final)
    remaining = commune.difference(unary_union(final)).area
    balance_error = sum(p.area for p in final) - unary_union(final).area
    overlap = sum(p.intersection(q).area for i, p in enumerate(final) for q in final[i + 1:])
    assert remaining < 1 and abs(overlap) < 1, (remaining, overlap)
    residual = np.linalg.norm(np.c_[src, np.ones(len(src))] @ matrix - dst, axis=1)
    samples = [transform(affine, outer.exterior.interpolate(d)) for d in np.arange(0, outer.exterior.length, 1)]
    edge_errors = np.array([p.distance(commune.boundary) for p in samples])
    features = []
    for h, p in zip(hamlets, final):
        props = {**h, 'hamletId': h['id'], 'kind': 'hamlet_boundary', 'boundaryVersion': VERSION,
                 'provisional': True, 'source': pdf.name, 'sourceSha256': hashlib.sha256(pdf.read_bytes()).hexdigest(),
                 'method': 'PDF vector boundaries; affine registration to commune; outer slivers clipped/filled',
                 'areaM2': round(p.area, 2)}
        features.append({'type': 'Feature', 'id': h['id'], 'properties': props, 'geometry': mapping(transform(reverse.transform, p))})
    collection = {'type': 'FeatureCollection', 'features': features}
    write(OUT / 'badiem-hamlet-boundaries-20261018.geojson', collection)
    write(ASSETS / 'badiem-hamlet-boundaries.geojson', collection)
    # Safe to apply now and again on backend restart. Once replaced manually,
    # a boundary no longer equal to this revision's old value is left alone.
    sql = '''-- Generated by scripts/derive-badiem-hamlet-boundaries.py; provisional PDF boundaries.
CREATE TABLE IF NOT EXISTS hamlet_boundary_revision (
    boundary_version varchar(64) NOT NULL,
    hamlet_code varchar(50) NOT NULL,
    previous_boundary_geo_json text,
    applied_boundary_geo_json text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (boundary_version, hamlet_code)
);
CREATE TEMP TABLE badiem_boundary_import ON COMMIT DROP AS
SELECT feature->'properties'->>'code' AS code, feature::text AS boundary
FROM jsonb_array_elements($boundary$DATA$boundary$::jsonb->'features') feature;
DO $check$ BEGIN
    IF (SELECT count(DISTINCT code) FROM badiem_boundary_import) <> 51
       OR (SELECT count(*) FROM hamlet h JOIN badiem_boundary_import i ON i.code = h.code) <> 51 THEN
        RAISE EXCEPTION 'Expected exactly 51 matching Ba Diem hamlets; no boundaries applied';
    END IF;
END $check$;
INSERT INTO hamlet_boundary_revision (boundary_version, hamlet_code, previous_boundary_geo_json, applied_boundary_geo_json)
SELECT 'VERSION', h.code, h.boundary_geo_json, i.boundary
FROM hamlet h JOIN badiem_boundary_import i ON i.code = h.code
ON CONFLICT (boundary_version, hamlet_code) DO NOTHING;
UPDATE hamlet h SET boundary_geo_json = r.applied_boundary_geo_json
FROM hamlet_boundary_revision r
WHERE r.boundary_version = 'VERSION' AND r.hamlet_code = h.code
  AND h.boundary_geo_json IS NOT DISTINCT FROM r.previous_boundary_geo_json;
'''.replace('DATA', json.dumps(collection, ensure_ascii=False, separators=(',', ':'))).replace('VERSION', VERSION)
    (OUT / 'badiem-hamlet-boundaries-20261018.sql').write_text(sql, encoding='utf-8')
    report = {'version': VERSION, 'provisional': True, 'sourceSha256': hashlib.sha256(pdf.read_bytes()).hexdigest(),
              'communeSha256': hashlib.sha256(commune_file.read_bytes()).hexdigest(), 'featureCount': len(features),
              'anchorFitRmseM': float(np.sqrt(np.mean(residual ** 2))), 'anchorFitMaxM': float(max(residual)),
              'outlineDistanceMedianM': float(np.median(edge_errors)), 'outlineDistanceP95M': float(np.percentile(edge_errors, 95)),
              'outlineDistanceMaxM': float(max(edge_errors)), 'edgeGapFilledM2': gap.area,
              'uncoveredM2': remaining, 'overlapM2': overlap, 'areaBalanceErrorM2': balance_error, 'areaM2': commune.area,
              'anchors': [{'pdfXY': a.tolist(), 'utm48N': b.tolist(), 'fitResidualM': float(e)} for a,b,e in zip(src,dst,residual)],
              'affineMatrix': matrix.tolist(),
              'limitations': 'Fit residuals describe agreement with the supplied commune outline, NOT surveyed positional accuracy. Internal boundaries are provisional PDF interpretations.'}
    write(QA / 'validation.json', report)
    QA.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(18, 11))
    for h, p in zip(hamlets, final):
        for part in parts(p):
            if part.geom_type == 'Polygon':
                ax.fill(*part.exterior.xy, alpha=.55)
        label = p.representative_point()
        ax.text(label.x, label.y, str(h['id']), ha='center', fontsize=8)
    for p in parts(commune):
        ax.plot(*p.exterior.xy, color='black', linewidth=.8)
    ax.set_aspect('equal')
    ax.set_title('51 provisional PDF hamlets / supplied commune outline — IDs match hamlet catalog')
    ax.ticklabel_format(style='plain')
    fig.savefig(QA / 'preview.png', dpi=150, bbox_inches='tight')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
