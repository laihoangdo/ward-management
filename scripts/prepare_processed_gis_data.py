#!/usr/bin/env python3
"""
Prepares, validates, and exports standardized GIS datasets for Bà Điểm Commune 3D modeling.
Sources:
  1. Administrative boundary & hamlets from baDiemSpatialData.ts
  2. Road network from final_roads.json (682 segments)
  3. Real OSM building footprints from osm_buildings.json (600 polygons)
  4. Surveyed household records from household.csv (360 households)
  5. POIs from baDiemSpatialData.ts (13 landmark facilities)

Outputs to: d:\PROJECT\police\police-jhip\data\gis_processed\
"""

import json
import csv
import math
import os
from pathlib import Path

ROOT = Path(r"d:\PROJECT\police\police-jhip")
OUT_DIR = ROOT / "data" / "gis_processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# -------------------------------------------------------------
# 1. Geographic Constants & Projection
# -------------------------------------------------------------
CENTER_LAT = 10.8525
CENTER_LNG = 106.6110
METERS_PER_DEG_LAT = 111320.0
METERS_PER_DEG_LNG = 111320.0 * math.cos(math.radians(CENTER_LAT))

def latlng_to_local_meters(lat, lng):
    """Transform WGS84 GPS to local meter coordinate system centered at Bà Điểm."""
    x = (lng - CENTER_LNG) * METERS_PER_DEG_LNG
    y = (lat - CENTER_LAT) * METERS_PER_DEG_LAT
    return x, y

def point_in_poly(x, y, poly):
    """Ray-casting point in polygon test."""
    n = len(poly)
    inside = False
    p1x, p1y = poly[0]
    for i in range(n + 1):
        p2x, p2y = poly[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def polygon_area_m2(ring_lnglat):
    """Compute polygon area in m² using projected local meters."""
    if len(ring_lnglat) < 3:
        return 0.0
    pts = [latlng_to_local_meters(p[1], p[0]) for p in ring_lnglat]
    area2 = sum(pts[i][0] * pts[i+1][1] - pts[i+1][0] * pts[i][1] for i in range(len(pts)-1))
    return abs(area2) / 2.0

# -------------------------------------------------------------
# 2. Administrative Boundaries
# -------------------------------------------------------------
COMMUNE_BOUNDARY_LATLNG = [
    [10.868, 106.602],
    [10.865, 106.618],
    [10.858, 106.626],
    [10.846, 106.623],
    [10.836, 106.615],
    [10.838, 106.598],
    [10.848, 106.592],
    [10.860, 106.595],
    [10.868, 106.602],
]
POLY_COMMUNE_LNGLAT = [[p[1], p[0]] for p in COMMUNE_BOUNDARY_LATLNG]

HAMLETS_DATA = [
    {
        "id": "hamlet-bac-lan",
        "code": "AP-BL",
        "name": "Ấp Bắc Lân",
        "center": [106.605, 10.862],
        "boundary": [[106.602, 10.868], [106.614, 10.865], [106.610, 10.858], [106.598, 10.859], [106.602, 10.868]],
        "officer": "Đại úy Nguyễn Văn Bình",
        "phone": "0908.123.456",
        "householdCount": 520,
        "populationCount": 1980
    },
    {
        "id": "hamlet-nam-lan",
        "code": "AP-NL",
        "name": "Ấp Nam Lân",
        "center": [106.608, 10.841],
        "boundary": [[106.602, 10.846], [106.616, 10.846], [106.615, 10.836], [106.598, 10.838], [106.602, 10.846]],
        "officer": "Thượng úy Trần Minh Hoàng",
        "phone": "0909.234.567",
        "householdCount": 485,
        "populationCount": 1740
    },
    {
        "id": "hamlet-tay-lan",
        "code": "AP-TL",
        "name": "Ấp Tây Lân",
        "center": [106.596, 10.851],
        "boundary": [[106.596, 10.858], [106.604, 10.854], [106.601, 10.845], [106.592, 10.848], [106.596, 10.858]],
        "officer": "Đại úy Lê Hữu Tài",
        "phone": "0913.345.678",
        "householdCount": 430,
        "populationCount": 1560
    },
    {
        "id": "hamlet-dong-lan",
        "code": "AP-DL",
        "name": "Ấp Đông Lân",
        "center": [106.621, 10.856],
        "boundary": [[106.616, 10.863], [106.626, 10.858], [106.622, 10.849], [106.614, 10.851], [106.616, 10.863]],
        "officer": "Trung tá Phạm Quốc Hùng",
        "phone": "0903.456.789",
        "householdCount": 640,
        "populationCount": 2350
    },
    {
        "id": "hamlet-hau-lan",
        "code": "AP-HL",
        "name": "Ấp Hậu Lân",
        "center": [106.608, 10.849],
        "boundary": [[106.605, 10.854], [106.614, 10.854], [106.613, 10.845], [106.604, 10.846], [106.605, 10.854]],
        "officer": "Đại úy Đặng Văn Nam",
        "phone": "0988.567.890",
        "householdCount": 510,
        "populationCount": 1890
    },
    {
        "id": "hamlet-tien-lan",
        "code": "AP-TIL",
        "name": "Ấp Tiền Lân",
        "center": [106.616, 10.852],
        "boundary": [[106.612, 10.856], [106.622, 10.855], [106.619, 10.847], [106.612, 10.848], [106.612, 10.856]],
        "officer": "Thiếu tá Nguyễn Thanh Sơn",
        "phone": "0977.678.901",
        "householdCount": 580,
        "populationCount": 2120
    },
    {
        "id": "hamlet-ap-1",
        "code": "AP-01",
        "name": "Ấp 1",
        "center": [106.601, 10.863],
        "boundary": [[106.598, 10.867], [106.606, 10.866], [106.604, 10.860], [106.596, 10.861], [106.598, 10.867]],
        "officer": "Đại úy Trần Văn Khoa",
        "phone": "0932.789.012",
        "householdCount": 390,
        "populationCount": 1420
    },
    {
        "id": "hamlet-ap-2",
        "code": "AP-02",
        "name": "Ấp 2",
        "center": [106.618, 10.843],
        "boundary": [[106.616, 10.848], [106.623, 10.846], [106.620, 10.839], [106.614, 10.841], [106.616, 10.848]],
        "officer": "Thượng úy Bùi Quốc Dũng",
        "phone": "0944.890.123",
        "householdCount": 460,
        "populationCount": 1680
    }
]

def export_boundary():
    features = [
        {
            "type": "Feature",
            "properties": {
                "kind": "commune_boundary",
                "name": "Xã Bà Điểm",
                "district": "Huyện Hóc Môn",
                "province": "Thành phố Hồ Chí Minh",
                "area_sqkm": round(polygon_area_m2(POLY_COMMUNE_LNGLAT) / 1e6, 2),
                "is_outer": True
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [POLY_COMMUNE_LNGLAT]
            }
        }
    ]
    for h in HAMLETS_DATA:
        features.append({
            "type": "Feature",
            "properties": {
                "kind": "hamlet_boundary",
                "id": h["id"],
                "code": h["code"],
                "name": h["name"],
                "officer": h["officer"],
                "phone": h["phone"],
                "householdCount": h["householdCount"],
                "populationCount": h["populationCount"],
                "center": h["center"]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [h["boundary"]]
            }
        })
    fc = {"type": "FeatureCollection", "features": features}
    out_file = OUT_DIR / "ba_diem_boundary.geojson"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, indent=2)
    print(f"Exported boundary GeoJSON with {len(features)} features to {out_file}")

# -------------------------------------------------------------
# 3. Road Network
# -------------------------------------------------------------
def export_roads():
    roads_source_path = Path(r"C:\Users\admin\.gemini\antigravity-ide\brain\a389450d-338c-412c-97f0-ccaa4a010f9a\scratch\final_roads.json")
    with open(roads_source_path, "r", encoding="utf-8") as f:
        roads_raw = json.load(f)

    major_count = 0
    local_count = 0
    features = []

    for r in roads_raw:
        pts = r.get("points", [])
        if len(pts) < 2:
            continue
        
        # Check boundary touch
        in_commune = any(point_in_poly(p[0], p[1], POLY_COMMUNE_LNGLAT) for p in pts)
        rtype = r.get("type", "alley")
        name = r.get("name", "")
        name_lower = name.lower()
        width = float(r.get("width", 5.0))

        is_major = (
            rtype == "main" or 
            width >= 12.0 or 
            any(k in name_lower for k in ["quốc lộ", "phan văn hớn", "nguyễn ảnh thủ", "song hành", "xuyên á"])
        )

        category = "major" if is_major else "local"
        if is_major:
            major_count += 1
            if width < 12.0:
                width = 14.0  # standard arterial road width
        else:
            local_count += 1

        features.append({
            "type": "Feature",
            "properties": {
                "id": r.get("id", f"road-{len(features)}"),
                "name": name or ("Hẻm dân sinh" if rtype == "alley" else "Đường nội bộ"),
                "code": r.get("code", f"RD-{len(features)}"),
                "type": rtype,
                "category": category,
                "width": width,
                "speedLimit": r.get("speedLimit", 50 if is_major else 30),
                "laneCount": r.get("laneCount", 4 if is_major else 2),
                "in_commune": in_commune,
                "point_count": len(pts)
            },
            "geometry": {
                "type": "LineString",
                "coordinates": pts
            }
        })

    fc = {"type": "FeatureCollection", "features": features}
    out_file = OUT_DIR / "ba_diem_roads_processed.geojson"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, indent=2)
    print(f"Exported roads GeoJSON: total={len(features)} (major={major_count}, local={local_count}) to {out_file}")

# -------------------------------------------------------------
# 4. Building Footprints & Households
# -------------------------------------------------------------
def export_buildings():
    # 4.1 Load OSM buildings
    osm_path = Path(r"C:\Users\admin\.gemini\antigravity-ide\brain\a389450d-338c-412c-97f0-ccaa4a010f9a\scratch\osm_buildings.json")
    with open(osm_path, "r", encoding="utf-8") as f:
        osm_data = json.load(f)

    # 4.2 Load Households
    hh_path = ROOT / "src/main/resources/config/liquibase/fake-data/household.csv"
    with open(hh_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        households = list(reader)

    features = []
    category_counts = {"residential": 0, "commercial": 0, "other": 0}
    height_estimated_count = 0
    height_exact_count = 0

    # Process OSM Buildings
    for el in osm_data.get("elements", []):
        geom = el.get("geometry", [])
        if len(geom) < 3:
            continue
        pts = [[p["lon"], p["lat"]] for p in geom]
        if pts[0] != pts[-1]:
            pts.append(pts[0])

        c_lon = sum(p[0] for p in pts[:-1]) / (len(pts) - 1)
        c_lat = sum(p[1] for p in pts[:-1]) / (len(pts) - 1)
        in_boundary = point_in_poly(c_lon, c_lat, POLY_COMMUNE_LNGLAT)

        tags = el.get("tags", {})
        name = tags.get("name", "")
        bldg_tag = tags.get("building", "yes")
        shop_tag = tags.get("shop", "")
        amenity_tag = tags.get("amenity", "")
        office_tag = tags.get("office", "")

        # Categorize
        if (
            shop_tag or 
            amenity_tag in ["marketplace", "restaurant", "cafe", "fast_food", "bank"] or 
            bldg_tag in ["commercial", "retail", "supermarket"] or
            "co.opmart" in name.lower() or "chợ" in name.lower()
        ):
            category = "commercial"
            category_counts["commercial"] += 1
            default_floors = 3
            default_height = 10.5
        elif (
            amenity_tag in ["school", "kindergarten", "college", "clinic", "hospital", "townhall", "police", "place_of_worship"] or
            office_tag in ["government", "research", "yes"] or
            bldg_tag in ["public", "civic", "school", "hospital", "church", "temple", "apartments"]
        ):
            category = "other"
            category_counts["other"] += 1
            if bldg_tag == "apartments":
                default_floors = 5
                default_height = 18.0
            else:
                default_floors = 3
                default_height = 12.0
        else:
            category = "residential"
            category_counts["residential"] += 1
            default_floors = 2
            default_height = 7.0

        # Height
        is_estimated = True
        if "height" in tags:
            try:
                height = float(tags["height"].replace("m", "").strip())
                is_estimated = False
                height_exact_count += 1
            except:
                height = default_height
                height_estimated_count += 1
        elif "building:levels" in tags:
            try:
                levels = int(tags["building:levels"])
                height = levels * 3.5
                default_floors = levels
                is_estimated = False
                height_exact_count += 1
            except:
                height = default_height
                height_estimated_count += 1
        else:
            height = default_height
            height_estimated_count += 1

        area = polygon_area_m2(pts)

        features.append({
            "type": "Feature",
            "properties": {
                "id": f"osm-{el['id']}",
                "source": "OSM",
                "source_id": str(el["id"]),
                "name": name or f"Công trình #{el['id']}",
                "category": category,
                "building_type": bldg_tag,
                "height_m": round(height, 2),
                "floors": default_floors,
                "height_estimated": is_estimated,
                "area_m2": round(area, 1),
                "in_boundary": in_boundary,
                "footprint_type": "polygon_traced",
                "tags": tags
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [pts]
            }
        })

    # Process Households
    # Link or generate 6x8m footprint for households
    for h in households:
        lat = float(h["latitude"])
        lng = float(h["longitude"])
        in_boundary = point_in_poly(lng, lat, POLY_COMMUNE_LNGLAT)

        htype = h.get("type", "RESIDENTIAL")
        hstatus = h.get("status", "NORMAL")
        biz_name = h.get("business_name", "")
        biz_cat = h.get("business_category", "")

        if htype == "BUSINESS" or biz_name:
            category = "commercial"
            category_counts["commercial"] += 1
            floors = 3
            height = 10.5
        elif hstatus in ["ALERT", "CRITICAL"]:
            category = "residential"
            category_counts["residential"] += 1
            floors = 2
            height = 7.0
        else:
            category = "residential"
            category_counts["residential"] += 1
            floors = 2
            height = 7.0

        height_estimated_count += 1

        # Generate 6x8m footprint (or 7x10m for business)
        fw = 7.0 if category == "commercial" else 6.0
        fd = 10.0 if category == "commercial" else 8.0
        
        dx = fw / (2.0 * METERS_PER_DEG_LNG)
        dy = fd / (2.0 * METERS_PER_DEG_LAT)
        footprint_pts = [
            [lng - dx, lat - dy],
            [lng + dx, lat - dy],
            [lng + dx, lat + dy],
            [lng - dx, lat + dy],
            [lng - dx, lat - dy]
        ]
        area = fw * fd

        features.append({
            "type": "Feature",
            "properties": {
                "id": f"hh-{h['id']}",
                "source": "Household_Database",
                "source_id": h["id"],
                "code": h["code"],
                "name": biz_name or f"Hộ {h['owner_name']}",
                "owner_name": h["owner_name"],
                "owner_phone": h["owner_phone"],
                "address": f"{h['house_number']} {h['street']}, {h['hamlet']}",
                "street": h["street"],
                "hamlet": h["hamlet"],
                "status": hstatus,
                "category": category,
                "building_type": "residential_house" if category == "residential" else "shop_house",
                "height_m": height,
                "floors": floors,
                "height_estimated": True,
                "area_m2": area,
                "in_boundary": in_boundary,
                "footprint_type": "point_buffer_6x8m",
                "residents_count": int(h.get("residents_count", 3) or 3),
                "officer_in_charge": h.get("officer_in_charge", "")
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [footprint_pts]
            }
        })

    fc = {"type": "FeatureCollection", "features": features}
    out_file = OUT_DIR / "ba_diem_buildings_processed.geojson"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, indent=2)
    print(f"Exported buildings GeoJSON: total={len(features)} "
          f"(residential={category_counts['residential']}, commercial={category_counts['commercial']}, other={category_counts['other']}) "
          f"height_estimated={height_estimated_count}, height_exact={height_exact_count} to {out_file}")

# -------------------------------------------------------------
# 5. POIs
# -------------------------------------------------------------
def export_pois():
    pois_data = [
        {"id": "poi-police-hq", "name": "Trụ sở Công an Xã Bà Điểm", "category": "police", "address": "Đường Phan Văn Hớn, Ấp Tiền Lân", "coords": [106.6125, 10.8532]},
        {"id": "poi-police-baclan", "name": "Điểm CSKV Ấp Bắc Lân", "category": "police", "address": "Đường Nguyễn Ảnh Thủ, Ấp Bắc Lân", "coords": [106.605, 10.8635]},
        {"id": "poi-police-tienlan", "name": "Điểm CSKV Ấp Tiền Lân & Chợ", "category": "police", "address": "Ngã ba Phan Văn Hớn - Bà Điểm 4", "coords": [106.615, 10.8515]},
        {"id": "poi-police-donglan", "name": "Điểm CSKV Ấp Đông Lân (Giáp Q12)", "category": "police", "address": "QL1A giao Phan Văn Hớn", "coords": [106.622, 10.8565]},
        {"id": "poi-ubnd", "name": "UBND Xã Bà Điểm", "category": "public", "address": "Đường Phan Văn Hớn, Ấp Tiền Lân", "coords": [106.6115, 10.8538]},
        {"id": "poi-market-badiem", "name": "Chợ Bà Điểm", "category": "market", "address": "Đường Phan Văn Hớn, Ấp Hậu Lân", "coords": [106.6095, 10.8508]},
        {"id": "poi-market-hocmon", "name": "Chợ Đầu Mối Hóc Môn", "category": "market", "address": "Đường Nguyễn Thị Sóc - QL22", "coords": [106.609, 10.8655]},
        {"id": "poi-school-thcs", "name": "Trường THCS Bà Điểm", "category": "school", "address": "Đường Bà Điểm 4, Ấp Tiền Lân", "coords": [106.614, 10.8545]},
        {"id": "poi-school-primary", "name": "Trường Tiểu học Tây Bắc Lân", "category": "school", "address": "Đường Nguyễn Ảnh Thủ, Ấp Bắc Lân", "coords": [106.603, 10.861]},
        {"id": "poi-school-kinder", "name": "Trường Mầm non Hướng Dương", "category": "school", "address": "Đường Hưng Lân, Ấp Hậu Lân", "coords": [106.606, 10.8475]},
        {"id": "poi-pagoda-vp", "name": "Chùa Vĩnh Phước", "category": "religious", "address": "Đường Phan Văn Hớn, Ấp Tiền Lân", "coords": [106.618, 10.855]},
        {"id": "poi-temple-bd", "name": "Đình Thần Bà Điểm", "category": "religious", "address": "Ấp Tây Lân, Xã Bà Điểm", "coords": [106.598, 10.8495]},
        {"id": "poi-church-bd", "name": "Giáo xứ Bà Điểm", "category": "religious", "address": "Đường Phan Văn Hớn, Ấp Bắc Lân", "coords": [106.608, 10.858]},
        {"id": "poi-health-station", "name": "Trạm Y Tế Xã Bà Điểm", "category": "public", "address": "Đường Bà Điểm 5, Ấp Hậu Lân", "coords": [106.6075, 10.8502]}
    ]

    features = []
    for p in pois_data:
        features.append({
            "type": "Feature",
            "properties": {
                "id": p["id"],
                "name": p["name"],
                "category": p["category"],
                "address": p["address"]
            },
            "geometry": {
                "type": "Point",
                "coordinates": p["coords"]
            }
        })

    fc = {"type": "FeatureCollection", "features": features}
    out_file = OUT_DIR / "ba_diem_pois.geojson"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, indent=2)
    print(f"Exported POIs GeoJSON: total={len(features)} to {out_file}")

if __name__ == "__main__":
    print("=== PROCESSING AND EXPORTING STANDARDIZED GIS DATASETS ===")
    export_boundary()
    export_roads()
    export_buildings()
    export_pois()
    print("=== FINISHED GIS DATASET EXPORT ===")
