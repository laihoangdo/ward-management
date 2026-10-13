# Operational workspace redesign

## Implemented

- Sidebar groups authorized menus into daily work, territory/maps, history, administration and account. Server menu labels and role/permission filtering remain intact.
- Overview adds a short actionable household-warning queue and a permission-aware shortcut to the document expiry filter. Metric cards support keyboard activation. Removed unsupported 100% completeness wording and the hardcoded demographic year.
- Operational datasets load independently. Successful empty responses clear stale records; failed datasets preserve existing data and show a persistent warning with retry. Full-update timestamp changes only after every dataset succeeds. Initial load and refresh share the same loader.
- Notes, household edits, resident mutations and OCR completion await persistence. Failures retain the editor and entered data, and no longer announce success. Duplicate submissions are blocked. Manual patrol logs remain in the editor when the server does not confirm persistence; failed logs are not displayed as saved records.
- Map-origin household records use a side drawer on desktop and a bottom sheet on mobile. Existing maps, record content, actions and capture tools remain available. Map minimum height adapts to mobile.
- Household create/detail dialogs handle keyboard focus, Escape and focus restoration. Busy detail saves prevent closing the main dialog.
- Settings explicitly mark the existing unwired sound/refresh controls unavailable. Theme and account editing remain active.
- Home describes the actual territory workflow and uses the existing login route instead of advertising sample credentials.

## Constraints and remaining risks

No dependencies, backend contracts, authorization policy or provider changed. Capture photos and schematic grid positions are preserved when applying the server household response because they are outside that API.

Roster mutations and household transfers remain multiple API requests. A failure can leave partial server changes; the UI warns users to inspect records before retrying. Atomic persistence requires backend work and is not claimed here. Create-household resident synchronization and remaining legacy API fallbacks still need a separate integrity review. Dialog focus coverage does not certify every nested capture dialog. No new task statuses, reminder delivery or offline synchronization capabilities were invented.

## Validation

- TypeScript no-emit check passed.
- Vite production build passed; existing chunk-size warnings remain.
- Full Vitest suite passed: 34 files, 215 tests, including new partial-load, overview shortcut and failed-note-save coverage.
- Targeted lint of the principal changed screen components and new utilities passed with existing complexity/date-render warnings. Full-project lint failed: 281 errors and 24 warnings across legacy files and scripts. No lint rules were weakened.
- Git diff whitespace check passed.
- Authenticated browser journeys, real API failure injection, console checks and visual verification at all six requested viewports remain pending. Responsive changes are implemented but are not visually certified.

Further work should prioritize browser acceptance with officer/supervisor sessions, atomic roster persistence, remaining modal accessibility, and shared style tokens replacing broad global dark-mode overrides.
