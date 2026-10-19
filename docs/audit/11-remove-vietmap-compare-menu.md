> Historical snapshot: VietMap Compare and its unused Blender pipeline were subsequently removed. See `18-remove-vietmap-pipeline.md` for current status.

# Remove the VietMap comparison menu

Removed only the vietmap-compare menu: App import/render branch, navigation type, default configuration, sidebar icon/automatic injection and backend catalog registration. Deleted components/VietMapCompareTab.tsx after saving a local recovery copy in target/removed-vietmap-menu. Exact retired-ID filters exclude stored legacy configuration on backend reads, frontend subscriptions and sidebar rendering; no database deletion/migration executed. Field 3D fallback placement now anchors after advanced-map when absent from server configuration.

Preserved MapLibreAreaMap, Field3DMapTab, other menus/maps, shared GIS types/data, MapLibre/Three dependencies, Blender files/assets and processing scripts. Reference review found three Blender/GIS scripts reading credentials from the deleted component. Replaced that coupling with scripts/vietmap_credentials.py: environment VIETMAP_API_KEY takes precedence over ignored config/vietmap.local.json. Existing local credentials were migrated without logging their value; git check-ignore confirmed exclusion. New checkouts must supply the environment variable or local file. No credential-bearing file added to tracked source.

Executed verification:

- Root TypeScript: exit 0.
- Vite frontend build: exit 0, existing chunk warnings.
- Vitest: 28 suites / 205 tests passed. Sidebar regression checks both retired menu IDs are absent even in stale configuration and clicks every retained default menu; subscription regression preserves other records and polling behavior.
- Targeted backend RbacMenuRemovalTest: one test passed, zero failures/errors; retained field-3d-map and area-map settings remain, catalog rejects both retired IDs, read authentication remains, no storage mutation occurs.
- Python 3.14 parsed all four credential-related scripts. Synthetic credential checks passed for missing credentials, local configuration and environment precedence; no network/API requests made.
- Sidebar/test formatting and git diff --check passed. Search found the retired menu ID only in compatibility filters and tests, with no remaining component import or script dependency.

No authenticated E2E, live application restart or real VietMap download executed. This bounds the verification and does not imply an absolute guarantee for all live workflows. Update frontend/backend together; otherwise an older server can still offer the retired catalog item to older clients.
