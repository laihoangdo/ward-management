"""Fit confirmed TC2 controls and prepare an idempotent, explicit household import.

Coordinates are estimates from a hand-drawn DXF, not surveyed house GPS.
Names are synthetic. Unknown roads and demographics are never inferred.
"""

import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/tc2_household_import"


def solve(matrix, rhs):
    values = [list(row) + [value] for row, value in zip(matrix, rhs)]
    for column in range(3):
        pivot = max(range(column, 3), key=lambda index: abs(values[index][column]))
        values[column], values[pivot] = values[pivot], values[column]
        divisor = values[column][column]
        if abs(divisor) < 1e-12:
            raise ValueError("Control points are collinear")
        values[column] = [value / divisor for value in values[column]]
        for index in range(3):
            if index != column:
                factor = values[index][column]
                values[index] = [value - factor * ref for value, ref in zip(values[index], values[column])]
    return [values[index][3] for index in range(3)]


def in_ring(point, ring):
    x, y = point
    inside = False
    for a, b in zip(ring, ring[1:] + ring[:1]):
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside


def in_geometry(point, geometry):
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    return any(in_ring(point, polygon[0]) and not any(in_ring(point, hole) for hole in polygon[1:]) for polygon in polygons)


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def main():
    controls = json.loads((OUT / "user_gps_control_points.json").read_text(encoding="utf-8"))
    if controls.get("local_correspondences_confirmed") is not True:
        raise ValueError("Confirm local control-point correspondence before generating an import")
    points = controls["points"]
    if len(points) < 4:
        raise ValueError("At least four confirmed controls required")
    if any(not all(math.isfinite(p[key]) for key in ("local_x", "local_y", "longitude", "latitude")) for p in points):
        raise ValueError("Control coordinates must be finite numbers")
    lon0, lat0 = points[0]["longitude"], points[0]["latitude"]
    east_scale, north_scale = 111320 * math.cos(math.radians(lat0)), 111320
    design = [[p["local_x"], p["local_y"], 1.0] for p in points]
    targets = [[(p["longitude"] - lon0) * east_scale, (p["latitude"] - lat0) * north_scale] for p in points]
    normal = [[sum(row[i] * row[j] for row in design) for j in range(3)] for i in range(3)]
    coefficients = [solve(normal, [sum(row[i] * target[axis] for row, target in zip(design, targets)) for i in range(3)]) for axis in range(2)]

    def project(x, y):
        row = [x, y, 1.0]
        east, north = [sum(c * value for c, value in zip(coef, row)) for coef in coefficients]
        return lon0 + east / east_scale, lat0 + north / north_scale

    residuals = []
    for point in points:
        lon, lat = project(point["local_x"], point["local_y"])
        residuals.append(math.hypot((lon - point["longitude"]) * east_scale, (lat - point["latitude"]) * north_scale))
    if any(not math.isfinite(value) for value in residuals) or max(residuals) > 25:
        raise ValueError("Affine control fit exceeds 25 metres; inspect controls before importing")

    boundary = json.loads((ROOT / "data/gis_processed/ba_diem_post_merger_boundary_provisional.geojson").read_text(encoding="utf-8"))
    geometries = [f["geometry"] for f in boundary["features"]] if boundary["type"] == "FeatureCollection" else [boundary["geometry"]]
    rows = list(csv.DictReader((OUT / "households_review.csv").open(encoding="utf-8-sig")))
    located = []
    for source in rows:
        row = dict(source)
        lon, lat = project(float(row["local_x"]), float(row["local_y"]))
        if not (106 < lon < 107 and 10 < lat < 12):
            raise ValueError("Invalid geographic result")
        row["longitude"], row["latitude"] = round(lon, 9), round(lat, 9)
        row["code"] = "TC2-" + row["source_id"][4:]
        row["street"] = row["street"] or "Chưa đối chiếu đường/hẻm (sơ đồ TC2)"
        row["coordinate_verified"] = "false"
        row["coordinate_method"] = "USER_CONTROLLED_DXF_AFFINE_ESTIMATE"
        row["within_commune_reference"] = str(any(in_geometry((lon, lat), geometry) for geometry in geometries)).lower()
        row["import_status"] = "READY_WITH_EXPLICIT_ESTIMATE" if row["within_commune_reference"] == "true" else "BLOCKED_OUTSIDE_REFERENCE"
        located.append(row)

    ready = [row for row in located if row["import_status"] == "READY_WITH_EXPLICIT_ESTIMATE"]
    with (OUT / "households_georeferenced.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(located[0]))
        writer.writeheader()
        writer.writerows(located)
    features = [{"type": "Feature", "properties": {"sourceId": row["source_id"], "code": row["code"], "houseNumber": row["house_number"], "hamletId": 28, "coordinateMethod": row["coordinate_method"]}, "geometry": {"type": "Point", "coordinates": [row["longitude"], row["latitude"]]}} for row in located]
    (OUT / "household_points.estimated.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False), encoding="utf-8")
    report = {"labels": len(located), "ready": len(ready), "outside_reference": len(located) - len(ready), "method": "Affine least squares; local east/north metre approximation around G1", "reference_lon_lat": [lon0, lat0], "coefficients_east_north": coefficients, "control_residuals_m": [round(x, 3) for x in residuals], "fit_rmse_m": round(math.sqrt(sum(x * x for x in residuals) / len(residuals)), 3), "independent_check_points": 0, "coordinates_are_estimated": True, "streets_unverified": sum(row["address_verified"] != "true" for row in ready), "commune_boundary_is_provisional": True}
    (OUT / "georeference_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    statements = ["BEGIN;", "SELECT pg_advisory_xact_lock(2813102026);", "LOCK TABLE household IN SHARE ROW EXCLUSIVE MODE;", "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM hamlet WHERE id=28 AND code='27592-TRUNGCHANH-2' AND valid_to IS NULL) THEN RAISE EXCEPTION 'TC2 administrative identity changed'; END IF; END $$;"]
    for row in ready:
        metadata = {"source_id": row["source_id"], "coordinate_method": row["coordinate_method"], "owner_is_synthetic": True, "address_verified": False, "local_dxf": [float(row["local_x"]), float(row["local_y"])], "fit_rmse_m": report["fit_rmse_m"], "same_house_number_occurrences": int(row["same_house_number_occurrences"])}
        notes = "[TC2_DXF_ESTIMATED] Chủ hộ GIẢ LẬP; tọa độ ước lượng từ sơ đồ, chưa đo GPS từng nhà; chưa xác minh đường/hẻm và nhân khẩu. " + json.dumps(metadata, ensure_ascii=False)
        values = ["nextval('sequence_generator')", quote(row["code"]), quote(row["house_number"]), quote(row["street"]), "28", "(SELECT full_name FROM hamlet WHERE id=28)", quote(row["owner_name"]), "''", "'RESIDENTIAL'", str(row["latitude"]), str(row["longitude"]), quote(notes), quote("Thành"), "0", "0", "0", "0", "0", quote("Chưa xác minh"), "'NORMAL'", quote("Chưa xác minh"), quote("Chưa xác minh")]
        statements.append("INSERT INTO household(id,code,house_number,street,hamlet_id,hamlet,owner_name,owner_phone,type,latitude,longitude,notes,officer_in_charge,residents_count,male_count,female_count,under_18_count,above_18_count,alley,status,neighborhood_group,last_checked_date) SELECT " + ",".join(values) + " WHERE NOT EXISTS (SELECT 1 FROM household WHERE code=" + quote(row["code"]) + ");")
    codes = ",".join(quote(row["code"]) for row in ready)
    if ready:
        statements.append("DO $$ BEGIN IF (SELECT count(*) FROM household WHERE hamlet_id=28 AND code IN (" + codes + ")) <> " + str(len(ready)) + " THEN RAISE EXCEPTION 'Import count mismatch'; END IF; END $$;")
        audit = json.dumps({"source": "vector.DXF", "hamlet_id": 28, "prepared_count": len(ready), "estimated_coordinates": True, "synthetic_owner_names": True})
        statements.append("INSERT INTO rbac_audit(actor,action,target,details) VALUES ('codex-user-authorized-import','tc2-dxf-households-import','hamlet:28'," + quote(audit) + ");")
    statements.append("COMMIT;")
    (OUT / "import_households.sql").write_text("\n".join(statements) + "\n", encoding="utf-8")
    (OUT / "rollback_import.sql").write_text("BEGIN;\nDELETE FROM household WHERE code IN (" + codes + ") AND hamlet_id=28 AND notes LIKE '[TC2_DXF_ESTIMATED]%';\nCOMMIT;\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
