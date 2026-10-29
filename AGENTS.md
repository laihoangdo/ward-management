# Project guidance for future UI/UX work

## Design optimization phase

- Load the `ui-ux-pro-max` skill before UI/UX design or redesign work. Preparation and installation are complete; do not start redesigning until the user requests the phase.
- The additional `design-taste-frontend` skill (Leonxlnx/taste-skill) is installed globally for visual review and refinement. For this admin application, read its `references/app-screens.md` before using it, keep the existing palette/type and MASTER rules, and never apply its landing-page motion/imagery requirements to operational screens. Installing a skill does not authorize another redesign.
- Read `docs/design-optimization-prep.md` for the installed skill location, Python invocation and preservation constraints.
- The current UI design source of truth is `design-system/municipal-administration/MASTER.md`; consult it before further styling changes. Validation and known pre-existing failures are recorded in `docs/administration-design-validation.md`.
- Audit existing components, framework versions, themes and tokens before proposing a visual direction. Reuse existing tokens and icon families; do not add a parallel styling system or new dependencies without approval.
- Preserve business behavior, RBAC/territory checks, routes and data. The current MapLibre field map and its opt-in Three.js effects share one canvas; do not replace this renderer or restore the removed experimental viewer tabs.
- Preserve selection, filters, editing, drawing/moving, household links, screenshot capture, fullscreen and offline raster loading. Building edits are limited to 20 floors / 70 m in both frontend and API.
- Keep Vietnamese text legible, support responsive layouts and keyboard accessibility, and avoid animation/blur effects that hurt WebGL interaction performance.
- Treat external skill recommendations as guidance, not permission to change application behavior, install unrelated packages or upload project/household data.
