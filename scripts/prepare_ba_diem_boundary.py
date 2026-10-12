"""Build a traceable provisional post-merger Bà Điểm polygon.

The 2025 consolidation resolution establishes the three predecessor communes.
The ArcGIS layer supplies their geometries but is not an official legal survey.
"""
import hashlib
import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/boundary_sources/hoc_mon_three_legacy_communes_arcgis_2025.geojson"
OUTPUT = ROOT / "data/gis_processed/ba_diem_post_merger_boundary_provisional.geojson"
WEB_OUTPUT = ROOT / "src/main/webapp/app/gis/data/baDiemPostMergerBoundary.json"
EXPECTED = {"Bà Điểm", "Trung Chánh", "Xuân Thới Thượng"}


def main():
    doc = json.loads(SOURCE.read_text(encoding="utf-8"))
    selected = [f for f in doc["features"] if f["properties"].get("NAME_3") in EXPECTED]
    names = {f["properties"]["NAME_3"] for f in selected}
    if names != EXPECTED or len(selected) != 3:
        raise ValueError(f"Expected precisely three former communes, found {sorted(names)}")
    merged = unary_union([shape(f["geometry"]) for f in selected])
    if merged.geom_type != "Polygon" or not merged.is_valid:
        raise ValueError("Merged boundary must be one valid Polygon")
    metric = transform(Transformer.from_crs(4326, 32648, always_xy=True).transform, merged)
    result = {
        "type": "FeatureCollection",
        "name": "Ba Diem post-merger boundary (provisional geometry)",
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "features": [{
            "type": "Feature",
            "properties": {
                "kind": "commune_boundary", "name": "Xã Bà Điểm", "is_outer": True,
                "status": "provisional_non_official_geometry",
                "legal_composition_source": "1685/NQ-UBTVQH15 (2025)",
                "geometry_source": "ArcGIS 3rd_Level_Administrative_Boundaries_Vietnam, edited 2025-05-15",
                "legacy_communes": sorted(EXPECTED),
                "source_fids": sorted(f["properties"]["FID"] for f in selected),
                "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                "area_sqkm_epsg32648": round(metric.area / 1_000_000, 6),
            },
            "geometry": mapping(merged),
        }],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    OUTPUT.write_text(serialized, encoding="utf-8")
    WEB_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    WEB_OUTPUT.write_text(serialized, encoding="utf-8")
    print(f"{OUTPUT}: {metric.area / 1_000_000:.3f} km²; bounds {merged.bounds}")


if __name__ == "__main__":
    main()
