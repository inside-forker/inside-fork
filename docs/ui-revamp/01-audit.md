# 01 — Admin UI audit

Source of truth: [`docs/ADMIN_UI_REVAMP_PLAN.md`](../ADMIN_UI_REVAMP_PLAN.md). Read-only audit, 2 Nov 2026.

## Decisions already made (2 Nov 2026)

| Topic | Decision |
| --- | --- |
| Stat cards | The prompt overrides the doc. No sparklines or icon badges on metrics. A quiet metric bar with text deltas. Charts only where they carry information. |
| Status colour | Add exactly two tokens, `--success` and `--warning`. Nothing else is added. |
| Primary action | Ink (`foreground`) buttons. Pink is reserved for key state. White on pink is 3.81:1, which fails AA for 14px text. |
| Shell | A new admin-only shell. Consumer, organizer, writer and lister dashboards are untouched. |

Assumption: **light mode only.** The app forces light (`forcedTheme="light"` in `app/layout.tsx:121`), so every `dark:` class in admin is dead today. Dark tokens are specified in 02 so dark mode can be turned on later as a token-only pass. That is the doc's Sprint 5 theme audit.

## 1. Scope in numbers

- **45 routes** under `app/admin/` (see `find app/admin -name page.tsx`). `/admin` redirects to `/dashboard` (`app/admin/page.tsx`). `/admin/home-hero` redirects to `/admin/app-layout` (`app/admin/home-hero/page.tsx`).
- **About 47,000 lines** in `components/admin/`. Ten files are over 1,500 lines, including `AccountCreationHub.tsx` (2,610), `ListingModal.tsx` (2,282), `SystemSettingsPage.tsx` (1,759) and `SafeImportModal.tsx` (1,730).
- Shell: `app/admin/layout.tsx` → `components/dashboard/PremiumDashboardLayout.tsx` + `PremiumSidebar.tsx` (895 lines) + `PremiumHeader.tsx`. **The same shell wraps every role** (`app/(dashboard)/layout.tsx`).
- Admin overview: `components/dashboard/SuperAdminDashboard.tsx`, served at `/dashboard` (`app/(dashboard)/dashboard/page.tsx:188`).
- Navigation: `lib/navigation/role-navigation.tsx:108-145` has 37 admin items in **one flat list** with no groups. Related tools like Listings, Duplicator, Brand groups, Capacity and Approvals are scattered.

## 2. Measured inconsistencies

Counted across `components/admin`, `app/admin` and the dashboard shell/overview files.

| Pattern | Uses | Files | Note |
| --- | ---: | ---: | --- |
| Raw Tailwind palette (`green-500`, `blue-700`…) | 3,719 | 95 | 16 hue families. Blue 414, red 398, amber 391, green 358, emerald 349, orange 220, purple 198… |
| Gradients (`bg-gradient-*`, `linear-gradient`) | 356 | 72 | Includes gradient text and gradient progress bars |
| `backdrop-blur` | 131 | 45 | Glassmorphism on filter bars, menus, badges |
| Coloured shadows (`shadow-blue-500/25`…) | 101 | 19 | Coloured hover glows on stat cards |
| Any `shadow-*` | 607 | 65 | Shadows used for structure, not just floating layers |
| Hardcoded hex | 87 | 8 | |
| Arbitrary px (`[11px]`, `[600px]`…) | 375 | 49 | |
| `text-[10px]` / `text-[11px]` / `[9px]` / `[8px]` | 265 | — | Below a readable minimum for data |
| framer-motion `motion.*` | 467 | 49 | Mostly entrance staggers and `whileHover` scale |
| `hover:scale` / `hover:-translate` | 36 | 18 | Bouncy cards |
| Spinners (`animate-spin`) | 155 | 69 | Used for page loads where a skeleton belongs |
| `confirm()` | 12 | 10 | Native dialogs, e.g. `UserManagementPage.tsx:210,248`, `CleanupLogsClient.tsx:70` |
| Local status-badge helpers | — | 19 | Each page maps status → colours in its own way |
| `tabular-nums` | 19 | **1** | Only `mobile-events/MobileEventsDashboard.tsx` |
| `focus-visible:` | 14 | **4** | Keyboard focus is mostly invisible or browser default |
| Emoji in UI | 24 | 10 | e.g. `ExportImportModal.tsx`, `ManualXPAward.tsx`, `ShareVerificationPage.tsx` |
| Raw `<table>` | 3 | 2 | `ExportImportModal.tsx`, `AccountCreationHub.tsx` |
| `ui/card` imported | 62 | 62 | Cards are the default layout unit; cards nest inside cards |

Radius drift: `rounded-lg` 364, `rounded-xl` 289, `rounded-full` 206, `rounded` 110, `rounded-2xl` 97, `rounded-md` 82, `rounded-3xl` 3. Six radii are used where two would do.

Control height drift: `h-8` 135, `h-11` 89, `h-9` 65, `h-12` 59, `h-10` 41. Five heights for the same controls.

Type drift: 13 sizes in use, from `text-[8px]` to `text-6xl`. `uppercase tracking-wide` labels appear in stat cards (`PremiumStatCard.tsx:120`).

Icons: one library, `lucide-react` (111 imports). That's good, but sizes range from `h-3` to `h-8` with no rule, and some icons are hand-drawn inline SVG (`app/admin/events/page.tsx:29`).

## 3. Specific offenders

**Shell** (`PremiumDashboardLayout.tsx`)
- `:79` gradient page background. `:83-84` blurred decorative blobs. `:87` pink grid pattern. All three are hard bans.
- Main content animates `duration-500` when the sidebar toggles.
- `PremiumSidebar.tsx`: gamification XP card and access badges with gradients (`~:430-470`), a framer-animated progress bar, and a "Quick stats" grid repeated per role. None of this helps an admin find a tool.

**Events hub** (flagship, `app/admin/events/page.tsx` + `components/admin/EventsManagementPage.tsx` + `EventsTable.tsx`)
- Page title is gradient text (`page.tsx:43`) next to a tinted icon badge with an inline SVG.
- Six stat cards, each with a different hue gradient, a coloured hover shadow and `whileHover` scale (`EventsManagementPage.tsx:358-500`).
- Filter bar is translucent with a gradient and blur. The search icon sits in a pink tinted chip.
- The **"All Organizers" filter has no options.** It's a stub.
- Events are a 3-column card grid, not a table (`EventsTable.tsx:168,206`). That's hard to scan, compare or bulk-act on. Status badges carry their own blur and shadow (`:88-125`).
- Loading uses a spinner on Refresh and a card skeleton with a shimmer gradient.

**Event approvals** (`EventChangeRequestsPage.tsx`, 1,502 lines)
- Status tabs (pending/approved/rejected) plus a duplicate status `Select` (`:1257`).
- The change diff is shown inline per field. There's no side-by-side "current vs proposed" layout.

**Primitives** (`components/ui/`)
- `button.tsx:7`: focus is a `ring-[3px] ring-ring/50` pink halo. That's glow-adjacent and banned. Every variant has `shadow-xs`.
- `badge.tsx`: `success` variant is hardcoded `bg-emerald-500`, which isn't a theme token.
- `skeleton.tsx:13-14`: shimmer via `bg-gradient-to-r via-white/10`. Banned.
- `dialog.tsx:21-31`: body-lock cleanup hack. Keep the behaviour and don't touch it during restyle.
- `table.tsx`: no sticky header, no numeric alignment, no density option.
- No tooltip primitive (`@radix-ui/react-tooltip` isn't installed). Icon-only buttons rely on `title` or nothing.
- No date picker (no `react-day-picker`) and no drag-and-drop library.

**Theme** (`app/globals.css:14-81`, `tailwind.config.ts`)
- Tokens follow the shadcn pattern: background, foreground, card, popover, primary (pink `#FF184E`), secondary, muted, accent, destructive, border, input, ring, and brand `cream` and `ink`. `--radius: 0.75rem`.
- No success or warning tokens. This is why 3,700 raw palette classes exist.
- Global utilities that conflict with the direction: `.glass-card`, `.shadow-premium`, `.gradient-text-primary`, `.noise-overlay`, `.bg-radial-vignette`. Admin stops using them. They stay for consumer pages.

## 4. Contrast (light theme, measured)

| Pair | Ratio | AA (4.5 text / 3 UI) |
| --- | ---: | --- |
| `foreground` (ink) on `background` | 17.97 | Pass |
| `muted-foreground` on `background` | 6.01 | Pass |
| `muted-foreground` on `muted` | 5.47 | Pass |
| White on `primary` (pink) | 3.81 | **Fails for text**, passes for UI |
| `primary` on `background` (pink text) | 3.81 | **Fails for text**, passes for UI |
| White on `destructive` | 3.76 | **Fails for text** |
| `destructive` on `background` (error text) | 3.76 | **Fails for text** |
| `border` on `background` | 1.24 | Decorative hairline only |

The `destructive` result is an open question in 02.

## 5. What the doc asks us to change, and how we read it

| Doc item | Our reading |
| --- | --- |
| `AdminPageShell` (sticky header, breadcrumbs, actions, realtime indicator, metrics bar) | Keep as specified |
| `AdminDataTable` (sort, column visibility, bulk bar, skeletons, mobile cards) | Keep as specified. Mobile becomes stacked rows, not cards, to avoid stacked identical cards. |
| `AdminFilterBar` (debounced search, facet chips, status dropdown, date range, clear all) | Keep. Date range uses native date inputs in a popover, so no new dependency. |
| `AdminDrawer` / `AdminModal` | Keep. "Smooth transitions" means 200ms ease-out with reduced-motion fallback. |
| `AdminStatCard` with sparklines and icon badges | **Overridden.** Becomes `AdminMetricBar` with text deltas only. |
| `StatusBadge` (active, pending, rejected, draft, flagged, expired) | Keep, using the two new tokens |
| Events: calendar/agenda switch, banner cards, organizer pill, tier chips, side-by-side diff | Table is the default view, with a calendar view as a switch. The diff is side by side. "Banner cards" become a thumbnail in the row, avoiding a card wall. |
| Drag-and-drop (App layout, Categories) | Needs a dependency decision in Sprint 2 (see 04) |
| Sprint 5 dark/light audit | Dark mode is off today. Tokens are ready, but shipping it is a separate decision. |
