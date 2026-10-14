# Institutional design conventions

The supplied requirements are project design conventions, not verified government regulations. No legal compliance, institutional endorsement or WCAG certification is claimed.

## Applied

- Deep green #1C4E3A is the main action/selected-navigation color. Red remains for destructive/error semantics; geographic colors are not reassigned. Secondary informational blue and gold remain restrained supporting colors.
- Named tokens cover primary, hover, informational, success, warning, error, incomplete, selected, background, surface, borders and muted text. Green is used for solid primary actions; semantic and geographic colors continue to use their existing classes.
- Removed the remote decorative font import. Font stack uses Roboto, Inter and Arial with system fallbacks; no new font download dependency is introduced. Exact font availability differs by operating system and still needs visual verification.
- Administrative tables, header controls, sidebar navigation and form labels use readable 14px targets; small sidebar/header metadata is raised to 12px. Mobile inputs retain 16px.
- Common rectangular panels/controls use 6px corners, subtle shadows and compact table spacing. Circular indicators and map navigation controls retain their geometry. Bottom-sheet/fullscreen overrides need responsive verification.
- Neutral Lucide application icon replaces the decorative gradient badge and emoji. Household-type selectors use existing Lucide icons. No official emblem was invented.
- Removed hardcoded agency affiliation and occupational titles inferred from software roles in the shell. Displayed affiliation comes from the actual unit/assignedWard fields. Software-role labels are explicitly administrative roles; no authorization rule changes.
- Uniform selected navigation treatment replaces red/blue privileged-menu styling. Removed the unverified hardcoded version badge. Existing permission filtering remains.
- Disabled bounce/ping decorations in the GIS root; existing reduced-motion handling remains.

## Verification and outstanding acceptance

TypeScript, Vite build and full Vitest suite passed (38 files, 225 tests). Sidebar and add-form tests were rerun after final refinements: 5 passed. Targeted ESLint passed with no errors and one add-form complexity warning. Header clock state now uses a lazy initializer; its unused import was removed. Build retains existing large-chunk warnings.

Local Chrome inspection reached the existing authentication-server-unavailable screen at a 974 x 1032 outer window size. Authenticated UI inspection could not continue because the backend did not respond. No record submissions were made.

The required 1366 x 768, 1440 x 900, 1280 x 800, 1024 x 768, 768 x 1024, 390 x 844 and 360 x 800 viewports, browser zoom, light/dark contrast, Vietnamese font rendering and complete GIS overlays remain pending. The redesign is not fully accepted until these are checked with functioning authentication.

Remaining review includes legacy emoji/microtext in secondary modules, cross-screen branding consistency, formal asset approval, per-field error accessibility, confirmation on camera/OCR draft discard and privacy review of map previews. Existing backend authorization remains essential; hiding controls does not enforce access. The current work changes presentation and shell labels, not authentication, audit logging, data contracts or police rank policy.
