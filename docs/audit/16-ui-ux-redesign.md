# UI/UX audit and implementation batches

## Source review

React/Vite GIS workspace uses Tailwind, Lucide, local component state and backend household/RBAC services. JHipster Redux owns authentication and generated routes. App checks menu permissions and scopes households by territory. Existing screens include overview, schematic map, MapLibre advanced map, field 3D, households, residents, documents, areas, logs, settings, delegation and system administration. Existing records open detail/edit dialogs; capture supports camera, OCR and voice search. See the source inventory in 01-feature-inventory.md; older spatial/comparison menu entries were subsequently removed, as documented in 10 and 11.

## Priorities

| Classification | Problem and user impact                                            | Solution / benefit                                                                                   | Regression risk                                         |
| -------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| KEEP           | Working authentication, scoped records, permissions and map layers | Preserve service contracts, record actions and providers                                             | High if changed; untouched                              |
| SIMPLIFY       | Header clock and shortcuts compete with title/search               | Show clock only on wide displays; retain all actions                                                 | Medium: responsive layout needs browser review          |
| FIX            | Header and household search compound independently                 | Share query state; retain standalone component search fallback                                       | Medium: covered by component test                       |
| IMPROVE        | Card-first desktop list makes record comparison slow               | Default to table; retain grid toggle and mobile cards                                                | Low                                                     |
| FIX            | Dataset shrink leaves page beyond results                          | Clamp both rendered slice and current page                                                           | Low: covered by regression test                         |
| FIX            | Hardcoded ward misrepresents assigned territory                    | Describe authorized scope and configured ward                                                        | Low                                                     |
| FIX            | Refresh catch reports success                                      | Show actionable failure message                                                                      | Low; partial API failures still require separate review |
| IMPROVE        | Small controls and weak keyboard focus                             | Scoped focus outlines, larger touch controls, reduced motion, search labels and pagination semantics | Medium: visual QA remains pending                       |
| ADD            | Household load can look like empty data                            | Busy semantics and loading message                                                                   | Low                                                     |

## Implemented batch

Shared shell and household lookup: App.tsx, Header.tsx, HouseholdsTab.tsx, Pagination.tsx and index.css. No dependencies, backend, authentication rules, provider or record actions changed. Household list receives the same authorized scoped dataset and applies the shared query once. Other views retain their existing map/list filtering.

## Validation and remaining work

TypeScript check passed. Vite production build passed with existing large-chunk warnings. Two household component tests passed: shared search updates and last-page dataset shrink. Targeted ESLint reported existing unused imports and legacy App warnings/errors; lint is not passing. Authenticated browser journeys, console checks and visual checks at 1440×900, 1280×800, 1024×768, 768×1024, 390×844 and 360×800 have not been completed.

Next reviewable batches: map panels/layers and provider failure states; resident/document filter and form layouts; modal focus management; overview and administration density. Verify reminder delivery, partial refresh failures and multi-request roster persistence separately before changing their business behavior. This batch is not certification of a complete application redesign.
