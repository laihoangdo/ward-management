"""Extract TC2 house-number labels without inventing geographic coordinates.

Original Designer/DXF sources are read-only. Outputs are review drafts, not
production household records. Owner names are explicitly synthetic.
"""

import argparse
import csv
import hashlib
import json
import random
import re
from collections import Counter
from pathlib import Path

from extract_dxf_schematic import field, normalize_label, read_entities

ROOT = Path(__file__).resolve().parents[1]
ADDRESS = re.compile(r"[0-9]+[A-Z]?[0-9]?(?:/[0-9A-Z]+)*")


def prepare(source, output):
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    entities = read_entities(source)
    labels = []
    for index, entity in enumerate(entities):
        if entity["type"] != "MTEXT":
            continue
        number = normalize_label(field(entity, "1")).rstrip(".,")
        if not ADDRESS.fullmatch(number):
            continue
        labels.append((index, entity, number))
    counts = Counter(number for _, _, number in labels)
    rng = random.Random(digest)
    surnames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Võ", "Đặng", "Bùi"]
    middles = ["Minh", "Thanh", "Ngọc", "Quốc", "Gia", "Anh"]
    names = ["An", "Bình", "Châu", "Dũng", "Hà", "Huy", "Lan", "Linh", "Nam", "Phúc"]
    rows = []
    for index, entity, number in labels:
        rows.append({
            "source_id": f"DXF-{digest[:12]}-{index}",
            "dxf_handle": field(entity, "5"),
            "house_number": number,
            "street": "",
            "alley": "",
            "hamlet_id": 28,
            "hamlet": "Ấp Trung Chánh 2",
            "commune": "Xã Bà Điểm",
            "local_x": field(entity, "10"),
            "local_y": field(entity, "20"),
            "longitude": "",
            "latitude": "",
            "owner_name": "[GIẢ LẬP] " + " ".join([rng.choice(surnames), rng.choice(middles), rng.choice(names)]),
            "owner_is_synthetic": "true",
            "officer_requested_by_user": "Thành",
            "same_house_number_occurrences": counts[number],
            "address_verified": "false",
            "coordinate_verified": "false",
            "import_status": "BLOCKED_MISSING_STREET_AND_GPS",
        })
    output.mkdir(parents=True, exist_ok=True)
    with (output / "households_review.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    (output / "households_draft.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    with (output / "control_points_template.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        csv.writer(stream).writerow(["landmark", "local_x", "local_y", "longitude", "latitude", "gps_source", "role_fit_or_check"])
    report = {
        "source": str(source.relative_to(ROOT)),
        "source_sha256": digest,
        "address_labels": len(rows),
        "unique_house_numbers": len(counts),
        "repeated_house_numbers": sum(count > 1 for count in counts.values()),
        "labels_with_repeated_house_numbers": sum(count for count in counts.values() if count > 1),
        "gps_verified": 0,
        "ready_for_database_import": 0,
        "coordinate_reference_system": "Unknown local drawing units; NOT WGS84",
        "owner_names": "Deterministic random synthetic names, explicitly marked",
        "database_writes": 0,
        "geographic_search_hint_from_user": "Dọc Quốc lộ 22 và đường Song Hành từ Nguyễn Ảnh Thủ",
        "limitations": [
            "A house-number label is not a complete address or proof of a separate occupied household.",
            "Repeated house numbers are retained as separate drawing labels pending road/alley review.",
            "The DXF-to-Blender transform is local-to-local, not a GPS transformation.",
            "No individual street is inferred from proximity alone.",
            "No population, phone number, identity document, or verified building footprint is invented.",
            "The requested officer name does not independently verify the Keycloak account identity.",
        ],
    }
    (output / "inspection.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "ban-do-ve-tay/vector.DXF")
    parser.add_argument("--output", type=Path, default=ROOT / "data/tc2_household_import")
    args = parser.parse_args()
    report = prepare(args.source.resolve(), args.output.resolve())
    print(json.dumps({key: report[key] for key in ["address_labels", "unique_house_numbers", "labels_with_repeated_house_numbers", "ready_for_database_import", "database_writes"]}))
