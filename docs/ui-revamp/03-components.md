# 03 — Admin component kit (as built)

Everything lives in `components/admin/ui/` and is exported from `@/components/admin/ui`. Built in INSID-201…217 (Nov 2026). Reference screens: Events (`/admin/events`), Event approvals (`/admin/events/approvals`), Overview (`/dashboard` for super admin). Visual target: round 2 mockups (`docs/ui-revamp/mockups/`, also published as an artifact).

## Ground rules

- **Revamp the view, not the logic.** Keep a page's state, effects, fetches and handlers. Replace only the JSX it returns. Verify with a diff that no `fetch(` or handler line changed.
- **`components/ui/*` stays shared.** Changes there are additive only (new variants and sizes). The admin look comes from the kit and from the `[data-admin]` scope.
- **Admin scope.** `AdminShell`, `AdminDrawer`, `AdminModal` and every kit popover set `data-admin`, which gives a 2px pink focus outline, a 1.75 icon stroke and no button shadows (`app/globals.css`). Anything you portal yourself (a `DropdownMenuContent`, `PopoverContent`) should get `data-admin=""` too.
- **No** gradients, blur, coloured shadows, raw palette classes (`green-500`), hex, `text-[11px]`, framer-motion entrances or count-ups.
- **CRLF:** many files use CRLF line endings. When you script edits, keep them, or the diff becomes a full rewrite.
- **Watch the shared Button:** `components/ui/button.tsx` with `asChild` must keep exactly one child (see the INSID-203 regression).

## Shell

### `AdminShell`
`app/admin/layout.tsx` and `app/(dashboard)/layout.tsx` use it for the active roles admin, super_admin, lister and data_entry (`usesAdminShell()` in `lib/navigation/role-navigation.tsx`). Everyone else keeps `PremiumDashboardLayout`.
- Ink sidebar: logo, city switcher (`useCity()`), nav groups from `ADMIN_NAV_GROUPS`, and a user menu (secondary links, View site, Switch to personal, Sign out, all the same behaviour as the old sidebar).
- **Link visibility still comes from the role lists** (`adminNavigation` etc., `requiredRole`, `requiredEmail`). `ADMIN_NAV_GROUPS` only groups and labels links. An allowed link missing from a group shows under "More". **To add a page:** add it to the role list, then to a group.
- Top bar: breadcrumb, ⌘K page palette (admin pages only), `SecurityAlertsBadge` (super admin), `NotificationBell`.
- `counts?: Record<href, number>` shows pink queue counts. Nothing passes it yet, because no API exposes pending counts.
- Sets `--admin-sticky-top` (the 56px top bar) for sticky table headers. Renders a `<div>`, because `ConditionalLayout` already provides `<main>`.

### `AdminPageShell`
`eyebrow`, `title`, `description`, `actions` (secondaries, then one `variant="solid"` primary), `live` (`"live" | "paused" | "offline"`), `metrics` (an `AdminMetric[]`), `tabs`, then children. Use it once per page, instead of hand-built headers.

## Display

| Component | Use | Key props |
|---|---|---|
| `AdminMetricBar` (via `metrics`) | 2–5 numbers split by hairlines. No icons or sparklines. | `label`, `value`, `unit`, `caption`, `delta {value, direction, good}`, `meter {value,max,label}`, `href`, `emphasis` (pink) |
| `AdminSection` | White panel with a title. Replaces `Card`, and never nests. | `title`, `description`, `actions`, `padded` (false for edge-to-edge lists) |
| `StatusBadge` | Status as a dot plus a label (tinted tag, or `inline`) | `status`, `tone?`, `label?`; map: published/approved/paid → positive, pending/unpaid → attention, rejected/flagged → negative, draft/scheduled → neutral, archived/expired/cancelled → ended |
| `Meter` | Sell-through and capacity bars. Ink fill, pink at 90% or more. | `value`, `max`, `label`, `hotAt` |
| `AdminAvatar` | People and organizers, with an initials fallback | `name`, `src`, `size` |
| `EmptyState` / `ErrorState` | Nothing to show, or a failed load (`role="alert"`, retry) | `icon`, `title`, `description`, `action` / `onRetry` |
| `KeyValueList` | Read-only details | `items`, `columns` |
| `DiffField` / `DiffGroup` | Live → proposed. Changed values tinted, unchanged rows faded. | `label`, `before`, `after`, `changed?` |

## Tables and filters

### `AdminDataTable<T>`
This component is presentational: the page owns fetching, filtering, sorting and paging.
- `columns`: `{ id, header, cell, align: "end"` for numbers, `sortable`, `hideable`, `priority` (phone layout: 1 title line, 2 meta line, 3 hidden), `className }`.
- `state`: `loading` (skeleton), `ready`, `refreshing` (2px bar), `error` (with `error.onRetry`).
- `empty` / `filteredEmpty`: nothing yet, vs. filters exclude everything (with a Clear filters button).
- `selection { selected: Set, onChange, actions(ids), noun }`: shows the ink bulk bar. Build its buttons with `<BulkAction>`.
- `onRowOpen` (row click or Enter). `rowActions` (shown on hover or focus, always on touch).
- `sort` + `onSortChange`, `hiddenColumns` (pair with `<ColumnPicker>` in the toolbar), `pagination` (`PaginationProps`).
- Keyboard: arrows move between rows, Space selects, Enter opens.

### `AdminFilterBar`
Pass it as the table's `toolbar`.
- `search` (debounced 250ms)
- `facets` (`{ id, label, options, selected, onChange, single? }`)
- `dateRange` (native date inputs)
- `onClearAll` (shown only while something is applied)
- `trailing` (view switch, `ColumnPicker`)

For a single-value filter that lives in page state as `"all"`: `selected = v === "all" ? [] : [v]` and `onChange = (vals) => set(vals[0] ?? "all")`.

### `SegmentedControl`
Mutually exclusive switches without panels (Table/Calendar, status). A radiogroup with arrow keys and optional pink `count`. For content panels, use `Tabs` with `TabsList variant="segmented" | "underline"`.

### `Pagination`
Used inside the table. Also works on its own, e.g. the approvals queue.

## Forms and overlays

| Component | Use |
|---|---|
| `AdminDrawer` | Inspect or edit one record without leaving the list. `size` md 576px or lg 672px. `media`, `meta`, `headerActions`, `tabs`, `footer`. To share tab state between the header tabs and the body panels, wrap it in `<Tabs>` (see `EventModal`). |
| `AdminModal` | Confirmations and up to 4 fields |
| `FormField` | Label, control, then a hint or an error. It passes `id`, `aria-describedby` and `aria-invalid` to its single child and keeps an `id` the child already has. `optional` marks optional fields. |
| `FormSection` | A field group: title and description on the left, fields on the right |
| `FormFooter` | Sticky status line and actions. Put it in a drawer's `footer`. |
| `AdminCheckbox` | 16px with a 4px radius. Supports `checked="indeterminate"`. Use it instead of `ui/checkbox` in admin. |

Drawers and modals return focus to whatever opened them (`useReturnFocus`). Radix alone only does that for its own Trigger.

## Shared primitives changed (additive)

- `Button`: `variant="solid"` (ink primary), `size="xs"` / `"icon-xs"` (28px), `loading`.
- `Tabs`: `TabsList variant="underline" | "segmented"`.
- `Badge success` uses the `success` token.
- `cn()` knows `text-data` is a font size.

## Migration recipe (per screen)

1. Read the page. Write down its state, effects, fetches and handlers, and don't touch them.
2. Wrap the return in `AdminPageShell` and move the header buttons into `actions`. Stat cards become `metrics`, using numbers the page already has. Never invent numbers.
3. Card grids and raw tables become `AdminDataTable`. Selects and inputs above them become `AdminFilterBar`.
4. Local status colour helpers become `StatusBadge`. `confirm()` becomes `ConfirmationDialog` or `AdminModal`.
5. Modals with long forms become `AdminDrawer`.
6. Remove framer wrappers, gradients, blur and raw palette classes. Snap sizes to the scale in 02.
7. Diff-check that no logic lines changed. Then lint, typecheck, and check it in the browser.

## Not built yet

- Poster thumbnails, tickets sold and gross sales on Events: the API doesn't return them (INSID-218).
- Bulk actions on Events: no bulk endpoints exist.
- `EventModal` field markup still uses its original structure, with banned styles removed. Moving it to `FormField`/`FormSection` is a follow-up.
- `AdminDashboard` (admin and lister overview) is untouched. Only the super admin overview was revamped.
