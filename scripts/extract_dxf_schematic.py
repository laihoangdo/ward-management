"""Align DXF linework to the Blender schematic using unique house-number labels.

Output is in local Blender drawing units, NOT longitude/latitude. No line is
classified as a road automatically because the source DXF has only layer 0.
"""

import json
import math
import random
import re
import csv
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DXF = ROOT / "vector.DXF"
BUILDINGS = ROOT / "src/main/webapp/app/gis/data/apTc2Schematic.json"
OUTPUT = ROOT / "src/main/webapp/app/gis/data/apTc2DxfLinework.json"
REVIEW = ROOT / "docs/tc2-dxf-blender-match-review.csv"


def read_entities(path):
    lines = path.read_bytes().decode("cp1252").splitlines()
    if len(lines) % 2:
        raise ValueError("Incomplete DXF group-code pair")
    pairs = list(zip((line.strip() for line in lines[::2]), (line.strip() for line in lines[1::2])))
    section = ""
    entities = []
    current = None
    for index, (code, value) in enumerate(pairs):
        if code == "0" and value == "SECTION":
            section = pairs[index + 1][1]
            current = None
        elif code == "0" and value == "ENDSEC":
            section = ""
            current = None
        elif section == "ENTITIES":
            if code == "0":
                current = {"type": value, "pairs": []}
                entities.append(current)
            elif current is not None:
                current["pairs"].append((code, value))
    return entities


def field(entity, code, default=""):
    return next((value for key, value in entity["pairs"] if key == code), default)


def normalize_label(value):
    return re.sub(r"^\\f[^;]*;", "", value).strip().upper()


def candidate_pairs(entities, buildings):
    house_centers = defaultdict(list)
    for building in buildings:
        label = re.sub(r"\.\d+$", "", building["id"][4:]).replace("_", "/").upper()
        x0, y0, x1, y1 = building["bounds"]
        house_centers[label].append(((x0 + x1) / 2, (y0 + y1) / 2))

    text_points = defaultdict(list)
    for entity in entities:
        if entity["type"] != "MTEXT":
            continue
        label = normalize_label(field(entity, "1"))
        try:
            text_points[label].append((float(field(entity, "10")), float(field(entity, "20"))))
        except ValueError:
            continue
    return [
        (label, text_points[label][0], house_centers[label][0])
        for label in sorted(house_centers.keys() & text_points.keys())
        if len(text_points[label]) == len(house_centers[label]) == 1
    ]


def apply_transform(point, transform):
    x, y = point
    a, b, tx, ty, mirrored = transform
    if mirrored:
        return (a * x + b * y + tx, b * x - a * y + ty)
    return (a * x - b * y + tx, b * x + a * y + ty)


def transform_from_pair(first, second, mirrored):
    _, (x1, y1), (u1, v1) = first
    _, (x2, y2), (u2, v2) = second
    dx, dy = x2 - x1, y2 - y1
    du, dv = u2 - u1, v2 - v1
    denominator = dx * dx + dy * dy
    if denominator < 1e-8:
        return None
    if mirrored:
        a = (dx * du - dy * dv) / denominator
        b = (dy * du + dx * dv) / denominator
        return (a, b, u1 - a * x1 - b * y1, v1 - b * x1 + a * y1, True)
    a = (dx * du + dy * dv) / denominator
    b = (dx * dv - dy * du) / denominator
    return (a, b, u1 - a * x1 + b * y1, v1 - b * x1 - a * y1, False)


def fit_transform(pairs, mirrored):
    count = len(pairs)
    xbar = sum(item[1][0] for item in pairs) / count
    ybar = sum(item[1][1] for item in pairs) / count
    ubar = sum(item[2][0] for item in pairs) / count
    vbar = sum(item[2][1] for item in pairs) / count
    denominator = 0
    sum_a = 0
    sum_b = 0
    for _, (x, y), (u, v) in pairs:
        x, y, u, v = x - xbar, y - ybar, u - ubar, v - vbar
        denominator += x * x + y * y
        if mirrored:
            sum_a += x * u - y * v
            sum_b += y * u + x * v
        else:
            sum_a += x * u + y * v
            sum_b += x * v - y * u
    a, b = sum_a / denominator, sum_b / denominator
    if mirrored:
        return (a, b, ubar - a * xbar - b * ybar, vbar - b * xbar + a * ybar, True)
    return (a, b, ubar - a * xbar + b * ybar, vbar - b * xbar - a * ybar, False)


def residual(pair, transform):
    u, v = apply_transform(pair[1], transform)
    return math.hypot(u - pair[2][0], v - pair[2][1])


def robust_alignment(pairs):
    rng = random.Random(20261008)
    best = None
    best_inliers = []
    threshold = 4.0  # Local Blender units; labels are not always centered in houses.
    for mirrored in (False, True):
        for _ in range(3000):
            first, second = rng.sample(pairs, 2)
            transform = transform_from_pair(first, second, mirrored)
            if transform is None:
                continue
            inliers = [pair for pair in pairs if residual(pair, transform) <= threshold]
            if len(inliers) > len(best_inliers):
                best, best_inliers = transform, inliers
    if len(best_inliers) < 30:
        raise ValueError(f"Only {len(best_inliers)} matching addresses; alignment is not reliable")
    for _ in range(5):
        best = fit_transform(best_inliers, best[4])
        best_inliers = [pair for pair in pairs if residual(pair, best) <= threshold]
    errors = sorted(residual(pair, best) for pair in best_inliers)
    return best, best_inliers, errors


def export_linework(entities, transform):
    paths = []
    for index, entity in enumerate(entities):
        kind = entity["type"]
        if kind == "POLYLINE":
            vertices = []
            cursor = index + 1
            while cursor < len(entities) and entities[cursor]["type"] == "VERTEX":
                vertex = entities[cursor]
                try:
                    vertices.append((float(field(vertex, "10")), float(field(vertex, "20"))))
                except ValueError:
                    pass
                cursor += 1
            closed = bool(int(field(entity, "70", "0")) & 1)
            if len(vertices) < 2:
                continue
            if closed and vertices[0] != vertices[-1]:
                vertices.append(vertices[0])
        elif kind == "LINE":
            try:
                vertices = [(float(field(entity, "10")), float(field(entity, "20"))), (float(field(entity, "11")), float(field(entity, "21")))]
            except ValueError:
                continue
            closed = False
        else:
            continue
        points = [[round(x, 2), round(y, 2)] for x, y in (apply_transform(p, transform) for p in vertices)]
        paths.append({"closed": closed, "points": points})
    return paths


def point_in_polygon(point, polygon):
    x, y = point
    inside = False
    for (x1, y1), (x2, y2) in zip(polygon, polygon[1:]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def polygon_area(points):
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(points, points[1:]))) / 2


def export_address_blocks(entities, transform, paths):
    polygons = [path["points"] for path in paths if path["closed"] and len(path["points"]) >= 4]
    candidates = [(polygon_area(points), points) for points in polygons]
    candidates = [(area, points) for area, points in candidates if 2 <= area <= 250]
    used = set()
    blocks = []
    for entity in entities:
        if entity["type"] != "MTEXT":
            continue
        address = normalize_label(field(entity, "1")).rstrip(".,")
        if not re.fullmatch(r"[0-9]+[A-Z]?[0-9]?(?:/[0-9A-Z]+)*", address):
            continue
        try:
            point = apply_transform((float(field(entity, "10")), float(field(entity, "20"))), transform)
        except ValueError:
            continue
        matches = [(area, index) for index, (area, polygon) in enumerate(candidates) if index not in used and point_in_polygon(point, polygon)]
        if matches:
            _, index = min(matches)
            used.add(index)
            ring = candidates[index][1]
            estimated = False
        else:
            x, y = point
            ring = [[x - 1.5, y - 1.5], [x + 1.5, y - 1.5], [x + 1.5, y + 1.5], [x - 1.5, y + 1.5], [x - 1.5, y - 1.5]]
            estimated = True
        blocks.append({"address": address, "points": ring, "estimated": estimated, "height": 5.8})
    return blocks


def export_street_labels(entities, transform):
    names = {"QL22": "Quốc lộ 22", "SONG HA": "Đường song hành", "V��NG 3": "Trưng Vương 3"}
    labels = []
    for entity in entities:
        if entity["type"] != "MTEXT":
            continue
        raw = normalize_label(field(entity, "1"))
        name = next((label for fragment, label in names.items() if fragment in raw), None)
        if not name:
            continue
        try:
            x, y = apply_transform((float(field(entity, "10")), float(field(entity, "20"))), transform)
        except ValueError:
            continue
        labels.append({"text": name, "x": round(x, 2), "y": round(y, 2)})
    return labels


def main():
    buildings = json.loads(BUILDINGS.read_text(encoding="utf-8"))["buildings"]
    entities = read_entities(DXF)
    pairs = candidate_pairs(entities, buildings)
    transform, inliers, errors = robust_alignment(pairs)
    paths = export_linework(entities, transform)
    address_blocks = export_address_blocks(entities, transform, paths)
    street_labels = export_street_labels(entities, transform)
    report = {
        "source": "vector.DXF aligned to Blender schematic; NOT GPS coordinates",
        "transform": {"a": round(transform[0], 8), "b": round(transform[1], 8), "tx": round(transform[2], 5), "ty": round(transform[3], 5), "mirrored": transform[4]},
        "quality": {"uniqueAddressPairs": len(pairs), "inliersWithin4Units": len(inliers), "medianError": round(errors[len(errors) // 2], 2), "maxInlierError": round(errors[-1], 2)},
        "alignedHouseLabels": sorted(label for label, _, _ in inliers),
        "paths": paths,
        "addressBlocks": address_blocks,
        "streetLabels": street_labels,
    }
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    REVIEW.parent.mkdir(parents=True, exist_ok=True)
    accepted = {label for label, _, _ in inliers}
    with REVIEW.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["house_label", "dxf_x", "dxf_y", "blender_x", "blender_y", "error_blender_units", "alignment_status"])
        for label, (dx, dy), (bx, by) in sorted(pairs):
            writer.writerow([label, round(dx, 4), round(dy, 4), round(bx, 3), round(by, 3), round(residual((label, (dx, dy), (bx, by)), transform), 2), "within_4_units" if label in accepted else "review"])
    print(json.dumps({"quality": report["quality"], "transform": report["transform"], "paths": len(paths), "bytes": OUTPUT.stat().st_size}, ensure_ascii=False))


if __name__ == "__main__":
    main()
