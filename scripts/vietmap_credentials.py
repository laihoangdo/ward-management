"""Shared credential loading for GIS scripts; never logs credential values."""
import json
import os
from pathlib import Path


def load_vietmap_api_key(root: Path) -> str:
    key = os.environ.get("VIETMAP_API_KEY", "").strip()
    if not key:
        local = root / "config" / "vietmap.local.json"
        if local.is_file():
            key = str(json.loads(local.read_text(encoding="utf-8")).get("api_key", "")).strip()
    if not key:
        raise RuntimeError("Set VIETMAP_API_KEY or configure config/vietmap.local.json")
    return key
