# 04 — Implementation plan

> **Status, 3 Nov 2026:** Phase 0 and Sprint 1 are built and on `main`, tracked as INSID-200 (parent) and INSID-201…217.
> - Tokens, scope and primitives: 201–203.
> - Kit: 204–209.
> - Shell: 210–211.
> - Events hub, event drawer, approvals: 212–214.
> - Super admin overview: 215. Docs: 216. Destructive contrast: 217.
> - Follow-up: INSID-218, the events API (posters, sales, and the 12-event load limit).
>
> **Decisions made along the way:**
> - Commits go straight to `main` with the INSID key. No branches or PRs.
> - No new dependencies: no tooltip, no Testing Library, no drag-and-drop yet.
> - Verification was typecheck, eslint and Jest, plus Playwright against `next dev` with mocked APIs.
>
> Component APIs as built are in `03-components.md`. Steps below are the original plan.

This covers Shuja's Phase 0 and Sprint 1 from [`ADMIN_UI_REVAMP_PLAN.md`](../ADMIN_UI_REVAMP_PLAN.md) in detail, and sketches the later sprints. Order: **tokens → primitives → composed kit → shell → screens.** One concern per commit. Nothing ships to a screen until the layer below it is merged.

**Ground rules for every step**
- No changes to business logic, fetching, routes or API contracts. Page components keep their state, effects and handlers. Only the JSX they return changes.
- `components/ui/*` changes are additive (03 §Scope strategy). Consumer pages must not change.
- Some files are CRLF. Edits preserve line endings so diffs stay reviewable.
- After each step: `npm run lint`, `npm run typecheck`, `npm test`. Before and after screenshots for every screen step.

## Step 0 — Foundation (≈ 4 commits)

| # | Commit | Files |
| --- | --- | --- |
| 0.1 | Add `--success` / `--warning` tokens and the `data` type step | `app/globals.css` (`:root`, `.dark`), `tailwind.config.ts` (`colors.success`, `colors.warning`, `fontSize.data`) |
| 0.2 | `Badge` success uses the token | `components/ui/badge.tsx` |
| 0.3 | Admin scope layer: focus outline, icon stroke, no level-0 shadows, under `[data-admin]` | `app/globals.css` (one `@layer components` block) |
| 0.4 | `Button`: `variant="solid"`, `size="xs"`, `loading` prop. `Tabs`: `underline` and `segmented` variants. | `components/ui/button.tsx`, `components/ui/tabs.tsx` |

**Verify:** lint, typecheck, test. Screenshot `/`, `/events`, `/listing/[slug]` and consumer `/dashboard` before and after. They must be pixel-identical apart from the `success` badge (grep shows where it's used).

## Step 1 — Kit primitives (`components/admin/ui/`, ≈ 6 commits)

Small, leaf-first. Each commit adds a component and its first consumer in the mockup routes (step 3), or nothing renders it yet.

1. `StatusBadge` + default status→tone map
2. `AdminSection`, `EmptyState`, `ErrorState`
3. `AdminMetricBar`
4. `FormField`, `FormFooter`, `KeyValueList`, `DiffField`
5. `Pagination`, `SegmentedControl`
6. `AdminDrawer`, `AdminModal` (wrap `Sheet` / `Dialog`)

**Verify:** typecheck. Keyboard pass on each (Tab order, focus visible, Escape closes overlays). Contrast spot-check with DevTools.

## Step 2 — Composed kit (≈ 3 commits)

1. `AdminFilterBar`: debounced search, facet chips, date-range popover, clear-all
2. `AdminDataTable`: sticky header, sort, selection and bulk bar, column visibility, skeleton/empty/error/refetch states, stacked rows below `md`
3. `AdminPageShell`: header, breadcrumbs, actions, realtime dot, metrics slot

**Verify:** a throwaway Playwright script, not committed, renders each state from `mockups/states.html` against a page that uses them. Compare side by side with the mockup.

## Step 3 — Shell (≈ 3 commits)

1. Add a `group` field to admin nav items. Same hrefs and the same `requiredRole`. (`lib/navigation/role-navigation.tsx`)
2. `AdminShell`: sidebar, topbar, ⌘K (reuses `ui/command`), mobile `Sheet`, `data-admin` root (`components/admin/ui/AdminShell.tsx`)
3. Use it: `app/admin/layout.tsx` swaps `PremiumDashboardLayout` → `AdminShell`. `app/(dashboard)/layout.tsx` picks `AdminShell` for admin, super_admin, lister and data_entry, and keeps the old shell for everyone else. The role check uses the profile the layout already loads.

**Verify:** log in as each role (user, organizer, lister, admin, super_admin). Every nav link resolves. Non-admin dashboards are unchanged. Organizer is allowed through `app/admin/layout.tsx` today, so confirm which pages it actually reaches and that the nav is filtered correctly.

## Step 4 — Flagship screens (Sprint 1)

| # | Screen | Files | Notes |
| --- | --- | --- | --- |
| 4.1 | Events hub | `app/admin/events/page.tsx` (header markup removed), `components/admin/EventsManagementPage.tsx`, `EventsTable.tsx` | Card grid → `AdminDataTable`. 6 stat cards → 4 metrics. The empty organizer filter is populated from loaded events or removed (ask). Calendar view is client-side over the already-loaded events, with no new fetch. |
| 4.2 | Event edit/create | `components/admin/EventModal.tsx` | Modal → `AdminDrawer` (`max-w-2xl`). Same fields, same validation, same submit. Restyle only. |
| 4.3 | Event approvals | `app/admin/events/approvals/page.tsx`, `components/admin/EventChangeRequestsPage.tsx` | Queue + `DiffField` detail. Remove the duplicate status select. Reject requires a reason (already supported by the API? Check before building; if not, keep the current flow). |
| 4.4 | Admin overview | `components/dashboard/SuperAdminDashboard.tsx` | Needs attention + metrics + one chart + recent bookings. Cards without a data source ("Database load", "API response") are removed, not faked. Confirm with you before removing. |

**Verify per screen:** lint, typecheck, test. Before and after screenshots at 1440 and 390 widths. A keyboard-only pass. Scan the changed files for banned patterns (`bg-gradient`, `backdrop-blur`, `shadow-*-500`, raw palette, `text-[`, hex) with an expected count of zero.

## Step 5 — Later sprints (owner per doc)

Each screen follows the same recipe: swap the header for `AdminPageShell`, tables for `AdminDataTable`, filters for `AdminFilterBar`, cards for `AdminSection`, local status helpers for `StatusBadge`, `confirm()` for `ConfirmationDialog`, then do the token sweep.

| Sprint | Shuja | Umer |
| --- | --- | --- |
| 2 | App layout & hero, Categories, Blog categories | Listings hub & approvals |
| 3 | Gamification (7 pages) | Bookings, Redemptions, Ticket inventory, Gate hub |
| 4 | Users, Reviews, Reports, Cards, Creator codes, Settings | Catalog tools, Analytics, Mobile events, Demand gap, Security, Logs, Forms, Segments, Editorial |
| 5 | Joint QA. Delete `PremiumStatCard` if no non-admin uses remain. Remove now-unused admin framer imports. Dark mode only if you approve it. | |

## Risks

| Risk | Mitigation |
| --- | --- |
| Shared `components/ui` edits shift consumer pages | Additive variants only. Consumer screenshot diff in step 0. |
| `/dashboard` serves both admin and consumers | The role picks the shell in `app/(dashboard)/layout.tsx`, with no route change. Tested per role. |
| 1,000–2,600-line page components are hard to restyle safely | Change returned JSX only, never hooks or handlers. Don't split files in the same commit as a restyle. |
| Umer starts before the kit settles | Kit APIs in 03 are frozen after step 2. Changes go through a short note in 03. |
| `--destructive` fails AA (02 Q1) | Until decided, destructive text uses `foreground` with a destructive dot or border |
| No component test tooling (Jest runs in Node, no Testing Library) | Verification uses typecheck plus Playwright screenshots, since `@playwright/test` is already installed. See question below. |

## Questions before Phase 2

1. **`--destructive` contrast** (02 Q1): darken the token (my recommendation), or keep it?
2. **`@radix-ui/react-tooltip`** for icon-only buttons: OK to add?
3. **Component tests:** add `@testing-library/react` + `jest-environment-jsdom` (dev only) so `AdminDataTable` and `AdminFilterBar` behaviour is unit-tested? Otherwise we rely on Playwright smoke checks.
4. **Drag-and-drop** (Sprint 2): `@dnd-kit`, or move-up/move-down buttons?
5. **Branching:** your usual flow is direct to `main`. For a multi-week revamp I'd suggest an `admin-revamp` branch with small commits, merged per step. Your call.
6. **Events organizer filter:** populate it from loaded events, or remove it?
