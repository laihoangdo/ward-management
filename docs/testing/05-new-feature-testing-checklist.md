# New feature testing checklist

- Assign feature ID; record approved acceptance criteria and distinguish inferred behavior.
- Identify affected entities, relationships, API contracts, UI entry, generator/configuration and integration dependencies.
- Specify role, territory, record scope, grant/revocation and cross-scope direct-access behavior.
- Add meaningful business unit tests, transaction/database integration and validation/error API checks.
- Add an E2E happy path that verifies the user outcome and fresh persisted state after reload.
- Cover negative/boundary inputs, partial network/service failure, forbidden mutations and unchanged rejected state.
- Use synthetic unique data, independent contexts, reliable cleanup and disposable services; never rely on order.
- Test loading/empty/error states, keyboard/accessibility labels, mobile layout and relevant browsers.
- Add stable accessible locators; introduce test IDs only when meaningful actions cannot otherwise be located.
- Keep provider doubles explicitly labeled; retain separate critical live contract checks.
- Update inventory, traceability matrix, architecture and verified execution commands.
- Run PR gates: Java unit/architecture, lint, typecheck, Vitest, build, smoke; add affected API/real-session E2E for security/record changes.
- Run full/scheduled gates: isolated DB migrations, all roles/scope variants, cross-browser/mobile, OCR/camera and provider contracts.
- Record exact command, environment, test counts, actual failures/skips/blockers and report location. Never equate unexecuted tests with passes.
- Review artifact confidentiality, retries and newly observed flakes; resolve failures without weakening business assertions.
- Preserve existing user work and deployment compatibility; intentional behavior changes require updated approved requirements and regression expectations.
