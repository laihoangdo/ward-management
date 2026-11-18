#!/usr/bin/env python3
"""Schema-name/table-name metadata only, no records or secrets."""
import importlib.util
from pathlib import Path

spec=importlib.util.spec_from_file_location('drill',Path(__file__).with_name('restore-drill.py'))
drill=importlib.util.module_from_spec(spec)
spec.loader.exec_module(drill)
print(drill.sql('Monolithic', "select schemaname||'.'||tablename from pg_tables where schemaname in ('public','tc2_roster','database_repair','legacy_mock_20261027') and tablename not in ('databasechangelog','databasechangeloglock','spatial_ref_sys') order by 1;"))
