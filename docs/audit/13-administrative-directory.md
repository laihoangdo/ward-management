# Administrative directory in delegation

Added DB-backed province/commune/hamlet browsing to SubAdminDelegationTab. New GET /api/administrative-units/provinces reads active admin_province rows; existing commune and hamlet endpoints receive the selected parent ID explicitly, avoiding their default ID 1. UI uses database fullName/id, clears child selections on parent changes and ignores obsolete responses. Fetch failures are shown without synthetic fallback names.

This is an administrative directory for reference, not a replacement authorization assignment contract. Existing area_zone assignment IDs and saveDelegation behavior remain unchanged. There is no direct area_zone-to-hamlet foreign key in the inspected entity; administrative hamlet IDs must not be written as area-zone IDs. Connecting administrative selections to saved permissions requires an explicit validated relationship/schema change.

TypeScript passed; 30 Vitest suites / 207 tests passed, including parent-ID query/reset regression. Maven compile passed. No database mutation or authenticated live API/E2E verification executed. Availability and coverage depend on existing DB records; no province/commune/hamlet data seeded by this change.
