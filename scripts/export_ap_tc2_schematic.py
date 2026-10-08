"""Export lightweight house blocks from the supplied Blender scene.

Run with Blender: blender --background BanDo_3D_ApTC2.blend --python scripts/export_ap_tc2_schematic.py
The coordinates remain local to the Blender drawing and are NOT GPS coordinates.
"""

import json
from pathlib import Path

import bpy


OUTPUT = Path(__file__).resolve().parents[1] / "src/main/webapp/app/gis/data/apTc2Schematic.json"
COLORS = {
    "Mat_Nha_BeTrang": "#e8dccc",
    "Mat_Nha_TrangXam": "#dfe8ed",
    "Mat_Nha_VangKem": "#f3e6c5",
    "Mat_Nha_XanhNhat": "#c9e0e6",
    "Mat_Diem_Do_Goc": "#dd715d",
}
LABELS = {
    "Nhan_CHO_DAU_MOI": ("Chợ đầu mối", "place"),
    "Nhan_DUONG_SONG_H": ("Đường song hành", "road"),
    "Nhan_HEM_136": ("Hẻm 136", "alley"),
    "Nhan_HEM_17": ("Hẻm 17", "alley"),
    "Nhan_HEM_170": ("Hẻm 170", "alley"),
    "Nhan_KHU_BIET_THU": ("Khu biệt thự", "place"),
    "Nhan_QUOC_LO_22": ("Quốc lộ 22", "road"),
}

buildings = []
for obj in sorted(bpy.data.objects, key=lambda item: item.name):
    if not obj.name.startswith("Nha_") or obj.type != "MESH":
        continue
    vertices = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    x0, x1 = min(v.x for v in vertices), max(v.x for v in vertices)
    y0, y1 = min(v.y for v in vertices), max(v.y for v in vertices)
    z0, z1 = min(v.z for v in vertices), max(v.z for v in vertices)
    if x1 <= x0 or y1 <= y0 or z1 <= z0:
        continue
    material = obj.data.materials[0].name if obj.data.materials else ""
    buildings.append(
        {
            "id": obj.name,
            "bounds": [round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3)],
            "height": round(z1 - z0, 2),
            "color": COLORS.get(material, "#d6dde4"),
        }
    )

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
labels = []
for name, (text, kind) in LABELS.items():
    obj = bpy.data.objects.get(name)
    if obj and obj.type == "FONT":
        position = obj.matrix_world.translation
        labels.append({"id": name, "text": text, "kind": kind, "x": round(position.x, 3), "y": round(position.y, 3)})

OUTPUT.write_text(json.dumps({"source": "Blender local coordinates; not georeferenced", "buildings": buildings, "labels": labels}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Exported {len(buildings)} building blocks to {OUTPUT}")
