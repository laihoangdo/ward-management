# Remove only the obsolete spatial menu

Requested scope: remove “Không gian 3D” (spatial-3d-map), preserve “Bản Đồ Không Gian 3D” (field-3d-map) and all other app features.

Removed the Spatial3DMapTab import/render branch, NavigationTab entry, default menu configuration, sidebar icon/injection and backend menu-catalog registration. Deleted only components/Spatial3DMapTab.tsx and utils/googleMapsBasemapGenerator.ts after reference search established that the latter was imported solely by the removed component. Copies of both files are in target/removed-spatial-menu for local recovery; target is disposable build output, not permanent backup.

Existing stored menu configuration is filtered by the exact obsolete ID in backend menu reads, the frontend subscription and sidebar. No database records were deleted and no migration was added. Retired-ID references intentionally remain in these compatibility filters and regression tests. Other configuration items retain their metadata/order; the VietMap fallback now anchors after advanced-map instead of after the removed entry. The server catalog no longer accepts the removed ID in menu updates or creates it on startup.

Preserved Field3DMapTab, its app branch, sidebar/default/backend menu entries, Three.js dependencies, shared spatial types/data/coordinate functions, VietMap comparison, GIS datasets, Blender scripts/projects and GLB assets. No direct changes to their implementation or files. Shared GIS exports were retained conservatively because their module is used by other maps and processing scripts.

Validation:

- Frontend Vite build passed with existing chunk warnings.
- Vitest: 28 suites / 205 tests passed. New sidebar regression hides stale obsolete configuration and clicks every retained default menu successfully, including field-3d-map. Subscription regression confirms polling filters only the retired ID.
- Maven targeted RbacMenuRemovalTest passed: one test, zero failures/errors. Confirms only the retired menu is filtered, retained 3D/VietMap catalog entries remain, authentication is still checked, and no storage mutation occurs on read.
- Root TypeScript currently fails with four hamletId diagnostics in HouseholdDetailModal, outside the changed files. That component was not modified in this task; no claim of a green project typecheck or a repaired administrative-unit feature.
- New/updated frontend tests lint clean; git diff --check passes. Full-file formatting checks also report existing formatting issues in App.tsx and initialAuthData.ts; broad formatting of user edits was avoided.

No authenticated browser E2E or live database/app restart was executed. Tests/build establish the bounded removal; they do not constitute an absolute guarantee about every live workflow. Deploy/restart the updated backend and frontend together so the default catalog and retired-menu filtering take effect consistently.
