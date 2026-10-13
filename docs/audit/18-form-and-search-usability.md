# Form, permission and lookup usability

## Changes

- Add, detail and renewal dialogs confirm before discarding changed input. Busy saves lock close/cancel controls and relevant fields. Browser reload/close uses the native unsaved-change guard. Cancelling a detail edit restores its original values; a server refresh no longer resets an active editor.
- New household input no longer prefills invented telephone, street, hamlet or population values. Optional counts remain optional and travel as null when unknown, supported by the existing nullable API DTO. The create input has a separate frontend type; loaded record types and backend schema stay intact. No demographic sum rule or new backend validation was introduced.
- Optional phone, group and alley values are no longer replaced by fabricated values in outgoing DTOs. The original API defaults used when reading legacy records and the owner-resident creation fallback still need separate integrity review.
- Household header, gallery and footer camera/OCR controls use the same existing permission checks. Editing is disabled without the existing inspection permission, with an explanatory message. Document actions similarly expose their existing permission restrictions.
- Renewal uses a date input with record context, inline failure feedback and duplicate-submit protection. If renewal persists but the subsequent list refresh fails, the UI reports that distinction.
- Shared household lookup supports Vietnamese accents/đ normalization and the existing household/resident identifiers and status keywords. The header, household list and MapLibre lookup use the same matcher. Resident and document text lookup also normalize Vietnamese. Existing filters remain in place.
- Added internal record section navigation, programmatic input labels, keyboard-operable household cards and a combobox/listbox keyboard pattern for searchable selects. Escape from a select closes its popup without closing the parent dialog. Capture dialogs participate in focus handling and block closing during save.
- Corrected the valid-document chip count so it excludes expired and pending records. Mobile dialog controls use larger text/touch targets.

## Verification

New tests cover unknown input defaults, discard/continue behavior, both detail close buttons during save, date retention after failed renewal, keyboard option selection, Escape handling, Vietnamese lookup and outgoing optional DTO values. TypeScript and Vite build passed; all 223 tests in 38 files passed. Targeted lint passed with two existing detail-dialog warnings (complexity and Date.now during render).

An authenticated local Chrome session was inspected at a 974 × 1032 window size, including the household table and blank add dialog. The table now has a minimum width with local horizontal scrolling to prevent squeezed columns. No production records were submitted during these checks. Complete browser journeys and visual checks at all six requested viewport sizes remain unverified. Camera/OCR device permissions, list refresh conflicts and multi-request household/resident persistence require real sessions. Capture drafts do not yet have the same discard confirmation as the core record forms. This change does not introduce backend transactions, offline draft storage, or reminder delivery.
