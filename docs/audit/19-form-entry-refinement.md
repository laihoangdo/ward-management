# Form entry refinement

- Classification precedes address entry; representative labels respond to business selection.
- Assigned areas are filtered by the selected hamlet. Changing an area no longer silently changes the hamlet. Clearing an assignment sends undefined rather than ID 0.
- Address fields in the detail editor retain blank optional values; zero residents stays zero. The arbitrary 20-person maximum is removed, and the save handler checks nonnegative integers.
- Population controls use two columns on small screens. Complete count groups show a nonblocking mismatch warning; unknown groups stay blank. Zero is allowed for confirmed unoccupied premises.
- Add-form actions remain visible while scrolling. Labels and coordinate guidance are larger, with coordinate error focus and accessibility attributes.
- Device location is an explicit user action, with timeout and failure feedback. Results from a closed form are ignored. Submission waits for location lookup, and the user is asked to verify that the device is at the household. Selecting a position on the existing 3D map remains supported.
- Past renewal dates produce a warning without introducing an unapproved business rule that blocks historical entry.

Verification: TypeScript and Vite build passed; tests cover preserved zero counts, blank optional address fields and incomplete versus inconsistent population groups. Browser/device GPS and complete responsive journeys still require verification. Camera/OCR draft confirmation and full per-field validation remain follow-up work; no backend schema or permission changes were made.
