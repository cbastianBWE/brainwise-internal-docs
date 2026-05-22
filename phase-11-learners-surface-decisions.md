# Phase 11 — Learners Surface Design Decisions

*Session 87 design phase. v1 scope: identity + roles + learning tree + completion actions + bulk actions + scheduled assignments + Excel import + per-user audit history.*

## Decisions log


### Decision 1 — Surface name, route, sidebar nav, scope

**Locked:**
- Name: **Members**
- Route: **/super-admin/members**
- Sidebar nav entry: **Members** (replaces both "Learning Admin" and "Users" entries)
- Scope expansion: the new surface **absorbs the existing /super-admin/users page** (impersonation search + super-admin user management) in addition to replacing Learning Admin's four tabs.

**Implications:**
- /super-admin/users becomes legacy; existing routes should redirect to /super-admin/members (or 404 cleanly).
- Existing Users.tsx page logic (impersonation search, user management) needs to be reconciled with new Members surface.
- Sidebar nav: one consolidated entry, not two.
- Scope grows beyond the original Learning Admin replacement. Phase 11 budget likely 3-4 sessions, not 2-3.


**Absorbed capabilities inventory (full v1 scope):**

From current LearningAdmin.tsx four tabs:
- Trainees list + per-row single-user assignment actions
- Bulk Assign / Unassign (cert_path / curriculum / module / mentor)
- Scheduled assignments (create + list + cancel)
- Excel bulk import via learning-admin-import EF
- Mentor role grant / revoke
- Per-learner learning tree (cert path → curriculum → module → item) with mark-complete/incomplete
- Per-content-item artifact inspection (8 item types: video, written, external link, live event, skills practice, quiz, file upload, lesson blocks)

From current /super-admin/users (SuperAdminUsers + UserDetailsModal):
- Impersonation (live; gated via JustificationModal)
- Free assessment attempts pool view + grant (coach-only; `grant_additional_free_attempts` RPC)
- Reset MFA (placeholder, "coming soon")
- Trigger password reset (placeholder)
- View access history (placeholder)
- Force pseudonymization (placeholder)

### Decision 2 — Top-level layout

**Locked:**
- Layout pattern: **Option A — Pure data table with filter chips above**
- Scheduled assignments + Excel bulk import: **Modal triggers from toolbar buttons** (only opened on demand)
- No secondary tabs; the surface is a single page.

**Shape:**
```
┌──────────────────────────────────────────────────────────────┐
│  Members                                                     │
│                              [Bulk Import] [Schedule] [⋮]    │
├──────────────────────────────────────────────────────────────┤
│  [Search...]                                                 │
│  [filter chips...]                                           │
├──────────────────────────────────────────────────────────────┤
│  (When rows selected: bulk actions bar appears)              │
├──────────────────────────────────────────────────────────────┤
│  ☐ Name    Email    Account    Mentor   Org    [Actions ⋮]  │
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
```

**Implications:**
- Toolbar buttons (top-right) trigger modals for Schedule Assignment, Bulk Import.
- An overflow `[⋮]` menu likely holds Recent Scheduled Assignments list (modal-triggered list view) and other ambient operations.
- Bulk actions bar appears when checkboxes are selected (multi-select pattern).
- No persistent visibility of pending scheduled assignments \u2014 they live behind the menu. Decision 12 (later) revisits if this proves wrong.

### Decision 3 — Table columns

**Locked:**
- Default visible columns:
  1. Checkbox (multi-select, fixed left)
  2. Name (sortable, default sort asc)
  3. Email (sortable)
  4. Account type (badge, filterable)
  5. Mentor (badge "Mentor" or "—", filterable)
  6. Organization (sortable, "—" for individuals)
  7. Active assignments (count, sortable, "0" or "—")
  8. Certifications (coach count + worst status pill, "—" for non-coaches)
  9. Status (active / deactivated badge, filterable)
  10. Last active (relative time, sortable)
  11. Actions menu (⋮, fixed right)
- Column show/hide control: **YES, with per-user persistence** (saved to user preferences server-side, scoped to this surface).
- Default sort: **Name ascending**.

**Implications:**
- `search_impersonation_targets` RPC needs extension to return: `is_mentor`, `active_assignment_count`, `certification_count`, `worst_certification_status`, `is_deactivated`, `last_sign_in_at`. Additive only \u2014 existing columns preserved \u2014 other five callsites unaffected.
- Need a persistence layer for column visibility prefs. Two options for next-round backend:
  - New `user_ui_preferences` table keyed `(user_id, surface_key)` storing jsonb prefs.
  - Reuse existing user preferences table if one exists (TBD: query for it).
- "Worst certification status" semantics: revoked > in_progress > certified for display priority (revocations are most attention-grabbing). Confirm later if needed.
- Server-side sort + filter is required for any column the admin wants to sort by. The RPC's RETURNS TABLE shape stays compatible; ORDER BY adds.
- Column show/hide pattern (shadcn): typically a `DropdownMenu` with checkboxes in the toolbar, plus localStorage fallback if server-side prefs RPC isn't ready.

**Open implementation Qs (defer to backend phase):**
- Is there an existing user-preferences table or RPC pattern in the codebase? If yes, reuse; if no, new table.
- Do we precompute the new columns in a view/materialized view, or inline LEFT JOINs in the RPC? Performance trade-off based on user count (current size is small, inline is fine).

### Decision 4 — Filters

**Locked:**
- Pattern: **Option D — hybrid chips with overflow**
- Always-visible chips (4): **Account type, Mentor, Status, Active assignments**
- Behind "More filters" overflow: Organization, Certifications (status), Last active range, Created date range, Has supervisor
- Default filter applied on initial load: **Status = Active** (admins can clear it explicitly)
- Saved filter views: **YES**, per-user persistence, name + filter snapshot. Surface via dropdown or sidebar entry on the chip bar.

**Shape:**
```
[Search...]                              [Saved views ▾]
[Account type: All ▾] [Mentor: All ▾] [Status: Active ▾] [Active assignments: All ▾] [More filters ▾]
```

**Filter value options per chip:**
- **Account type**: All / Super admin / Org admin / Company admin / Coach / Corporate employee / Individual (multi-select via checkboxes inside the dropdown)
- **Mentor**: All / Mentor / Not mentor (single-select)
- **Status**: Active (default) / Deactivated / All (single-select)
- **Active assignments**: All / Has any / Has none (single-select)
- **Organization** (in More filters): typeahead search of organizations + multi-select chips
- **Certifications** (in More filters): All / Certified / In progress / Revoked / None (multi-select)
- **Last active** (in More filters): All / Within 7 days / Within 30 days / Within 90 days / Dormant 90+ days (single-select preset, plus custom range option)
- **Created at** (in More filters): All / This week / This month / This year / Custom (single-select preset, plus custom range)
- **Has supervisor** (in More filters): All / Has supervisor / No supervisor (single-select)

**Saved views design:**
- "Saved views" dropdown on right side of chip bar. Items: list of saved views by name. Footer items: "Save current filters as view…" and "Manage views" (modal for rename / delete / reorder).
- Each saved view stores: name + filter state snapshot + column visibility snapshot + sort state snapshot. Survives across sessions.
- Default view (the one selected on page load) is configurable per-user. Falls back to system default (Status=Active, no other filters) if user hasn't picked one.
- "Saved views" is per-user; not shared across admins (no team views in v1).

**Implications for backend:**
- Need `user_ui_preferences` table or similar with jsonb prefs scoped to surface_key='members'. Will also hold column visibility prefs from Decision 3.
- `search_impersonation_targets` RPC must accept additional filter params (account_type[], is_mentor, is_deactivated, has_active_assignments, organization_id[], certification_status[], last_active_within, created_within, has_supervisor). Additive only to existing signature; existing callers keep working.
- Filter URL state: serialize filter+sort+visible-columns into URL query string so deep-links work and admins can share filtered views via URL.
- URL state is the source of truth on page load; saved view selection writes to URL on selection.

### Decision 5 — Search behavior

**Locked:**
- Search scope: **email + full_name + organization_name** (current `search_impersonation_targets` scope unchanged).
- Search × filters relationship: **compose** \u2014 search narrows within the active filter set.
- Behavior: **typeahead with 250ms debounce, min 2 chars** (current pattern preserved).
- Highlighting: **YES** \u2014 matched substring rendered with bold or background highlight in the visible row cells (email, full_name, organization_name columns).

**Implications:**
- `search_impersonation_targets` RPC SQL: existing ILIKE patterns on email/full_name/org.name unchanged. No backend work for search scope.
- Filter composition: filter WHERE clauses combine with `AND` against the search WHERE clause inside the RPC. Already structurally true \u2014 existing RPC has `v_has_query` branch that adds the search predicates; new filter params from Decision 4 add similar AND-ed predicates.
- Highlighting is purely frontend: receive the matched query in component state, render each text cell through a helper that splits-and-wraps the matched substring in a `<mark>` or styled `<span>`. Case-insensitive. Multiple match instances supported. Empty query renders raw text.
- Highlighting helper should live in shared utility (e.g., `src/lib/highlightMatch.ts`) since the column cells use it in 3+ places.

### Decision 6 — Row click behavior

**Locked:**
- Pattern: **Option D \u2014 drawer + "Open full view" escape hatch to a full-page route**
- Drawer width: **auto** \u2014 720px on desktop (\u22651024px viewport) / full-width below 1024px
- Dismiss: **X button + Escape + click outside, with unsaved-changes confirmation dialog**

**Implications:**
- Two surfaces to maintain:
  - Drawer (primary): opens via row click. Lives at `/super-admin/members?member={uuid}` (URL state). Refresh-safe.
  - Full page (escape hatch): lives at `/super-admin/members/{uuid}`. Drawer's "Open full view" button navigates here. Same content as drawer, more room.
- URL state for drawer: `?member={uuid}` query param. On page load, if present, drawer is auto-opened for that member. Closing drawer removes the param.
- Both surfaces share the same components/queries internally \u2014 the layout container differs but the inner content is identical (identity header, roles, learning tree, actions, audit history). Implementation should factor the shared content into a single component used by both.
- Dismiss-with-confirmation requires tracking unsaved state. The unsaved-state triggers:
  - Justification reason field has any text typed (cert action, role action, completion action)
  - Form fields in bulk modals (covered separately by Decision 12+)
- Confirmation dialog copy: standard "Unsaved changes. Discard and close?" with [Cancel] [Discard] buttons.
- Mobile (< 1024px): full-width drawer behaves like a full-screen overlay; "Open full view" button is hidden because the drawer already uses full viewport.
- The "Open full view" button lives in the drawer header next to the X (or as an icon button with tooltip "Open in full page").

### Decision 7 — Drawer contents and section order

**Locked:**
- Organization: **Option D \u2014 sticky header (identity + primary actions) + tabs below**
- Sticky header contents:
  - Identity block: name, email, account type badge, organization, status
  - Mentor toggle (inline switch with reason prompt on change)
  - Primary CTA: **[Impersonate]** button (disabled if self)
  - Overflow menu **[\u22ee]**: Reset MFA, Trigger password reset, View access history, Force pseudonymization, (other low-frequency / placeholder actions)
- Tab order: **Learning (default) \u2192 Assignments \u2192 Coach (conditional) \u2192 Audit**

**Tab contents (detailed in later decisions):**
- **Learning** (default tab): the per-learner learning tree (cert path \u2192 curriculum \u2192 module \u2192 item) with mark-complete/incomplete actions and per-content-item submission viewer. Decision 9 covers tree structure; Decision 10 covers submission viewer placement.
- **Assignments**: single-user assign actions \u2014 assign a cert path / curriculum / module / mentor to THIS user. Per-target with due-date and reason. Mirrors the existing bulk flow's structure but scoped to one user.
- **Coach**: conditional tab \u2014 only shown when `account_type === 'coach'`. Contains the existing UserDetailsModal coach section: cert list, free-attempts pool view, grant attempts form. Migrated as-is into this tab.
- **Audit**: per-user history of admin actions taken ON this user. Decision 11 covers audit timeline format.

**Implications:**
- Sticky header is ~140-160px tall. Tabs + content below get the rest of drawer height. Acceptable trade-off.
- Mentor toggle inline in header: clicking flips it AND opens a small justification prompt inline (or as a confirm dialog) before submitting to `set_mentor_role`. Cannot be done without reason \u2014 server enforces 10-char minimum.
- Impersonate button: same JustificationModal flow as existing /super-admin/users page. Disabled when target.user_id === current.user.id.
- Overflow menu: current items are mostly placeholders ("coming soon"). They stay marked as such in v1; v2 wires them up.
- Coach tab conditional: query enabled only when account_type='coach'. If admin changes someone's account_type (not currently supported but possible future), tab visibility updates reactively.
- Tab state lives in URL: `?member={uuid}&tab=learning` etc. Refresh-safe and shareable.

### Decision 8 — Justified-action modal: pattern + unification

**Locked:**
- Mentor toggle interaction: **Option A \u2014 confirm dialog with reason field** (modal pattern)
- Unification scope: **YES, single shared component used across all justified actions**

**Implications:**
- New shared component `JustifiedActionDialog` (or similar name) lives at `src/components/justified-action/JustifiedActionDialog.tsx`.
- It is a generalization of the existing `CompletionConfirmDialog` pattern (which already handles 4 action tiers, error mapping, redundant-action no-op).
- Existing `CompletionConfirmDialog` is refactored to use the new shared component internally, OR replaced by it. To decide later in implementation.
- Existing inline confirm flow in `MentorRoleTab` (handleConfirm) is replaced by the shared component.
- Consumers in scope:
  - Mentor role grant / revoke (was MentorRoleTab.handleConfirm)
  - Cert path grant_certification / revoke_certification
  - set_content_item_completion / set_module_completion / set_curriculum_completion
  - grant_additional_free_attempts (was UserDetailsModal handleGrant)
  - All future justified RPCs (e.g., MFA reset, password reset, pseudonymization when those ship)
- The component's API: takes a `target` object describing the action, an `onSubmit` callback (returns a Promise that resolves with the RPC result), and renders title / preview / reason field / submit button uniformly.
- The component handles: 10-char minimum validation, submitting state, error-message mapping (extensible per consumer via a `mapError` prop), redundant-action no-op toast (when RPC returns `{changed: false}` and a `note`), success toast.
- Error mapping is the one piece that varies per RPC. The shared component accepts an optional `mapError(raw: string) => string` prop. Default maps the most common errors (reason_required_min_chars, authentication_required); per-consumer additions for tier-specific errors (manual_incomplete_blocked_certified_cert_path, certification_already_granted, certification_already_revoked, count_must_be_positive, invalid_instrument_id, etc.).
- Cancel button is disabled while submitting. Submit button shows Loader2 spinner when submitting.
- Confirmation dialog title and preview text are passed in via props.

**Why this matters:**
- Removes the silent-no-op lie (R1 audit finding) once for everyone, not per-surface.
- Makes future justified actions trivial to add \u2014 wire the RPC, pass the target, done.
- Centralizes the 10-char min, the redundant-no-op handling, the error mapping. The current code repeats this pattern 4+ times with subtle drift between copies.

### Decision 9 — Learning tab content: tree structure and behavior

**Locked:**
- Tree shape: **A1 \u2014 preserve existing 4-tier tree** (cert paths \u2192 curricula \u2192 modules \u2192 content items), plus orphan certs and directly-assigned curricula/modules sections. Migrated from existing `AdminLearningTree.tsx` with minimal structural change.
- Default expand state: **B1 \u2014 all collapsed.** Admin clicks chevrons to drill down. Lowest visual noise on drawer open.
- Filtering: **C4 \u2014 both status filter chips AND search-within-tree input.**
- Per-row actions: **D3 \u2014 per-row overflow menu (\u22ee)** holding all available actions for that tier.

**Tree section structure inside the Learning tab:**
```
\u250c\u2500 Filter bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  [Search tree...]                                  \u2502
\u2502  [Status: All \u25be]  [In progress] [Completed] [Not started] [Revision] \u2502
\u251c\u2500 Cert paths \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  \u25b6 PTP Certified Coach    [In progress]   [\u22ee]  \u2502
\u2502  \u25b6 ...                                            \u2502
\u251c\u2500 Orphan certifications (no curricula) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  AI Transformation Coach   [Certified]      [\u22ee]  \u2502
\u251c\u2500 Directly Assigned Curricula \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  \u25b6 Curriculum X            [Active]         [\u22ee]  \u2502
\u251c\u2500 Directly Assigned Modules \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  \u25b6 Module Y               [Completed]      [\u22ee]  \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
```

**Per-row overflow menu (\u22ee) contents by tier:**
- **Cert path tier**:
  - "Grant certification" (when status = in_progress; opens JustifiedActionDialog)
  - "Revoke certification" (when status = certified)
  - "View certification details" (future; opens detail panel; placeholder for v1)
  - "Expand all curricula"
- **Curriculum tier**:
  - "Mark curriculum complete" (when not already complete; opens JustifiedActionDialog)
  - "Mark curriculum incomplete" (when complete)
  - "Unassign curriculum" (when not under a cert path; cert-path-attached curricula can't be unassigned individually)
  - "Expand all modules"
- **Module tier**:
  - "Mark module complete" / "Mark module incomplete"
  - "Unassign module" (when directly assigned, not part of curriculum)
  - "Expand all items"
- **Content item tier**:
  - "Mark item complete" / "Mark item incomplete"
  - "View submission" \u2014 opens the artifact panel (Decision 10 covers placement)
  - "View admin activity on this item" (future)

**Filter chip behavior:**
- Status filter chips multi-select: clicking each toggles inclusion in visible set. Default state = all selected (all visible). 
- "All" chip is a special clear-all behavior.
- Search input filters tree items by node name (cert path label, curriculum name, module name, content item title). Case-insensitive substring match. Parent nodes auto-expand when a child matches.
- When filtering is active, the tree shows an indicator at the top "Filtered: 3 of 47 items" with a [Clear filters] link.

**Implications:**
- Existing `AdminLearningTree.tsx` becomes the source for the migration. Most logic preserved; UI shape refactored.
- Tree node components extract overflow menu into separate sub-components (CertPathNode, CurriculumNode, ModuleNode, ItemNode each get an overflow menu trigger).
- Filter state lives in tab-local state (not URL) for v1 \u2014 the URL drawer state covers `?tab=learning` but not within-tree filters. Could change in v2 if deep-linking to filtered tree views becomes useful.
- Auto-expand behavior on search match needs careful handling: collapsing-and-restoring expand state when search clears. Standard pattern is to track user-explicit-expand vs search-implicit-expand separately.

### Decision 10 — Submission viewer (ContentItemArtifactPanel) placement

**Locked:**
- Pattern: **E \u2014 improved inline expansion**
- Single-open enforcement: only one artifact panel open at a time inside the tree. Opening a second one auto-closes the first.
- Width: panel breaks out of tree indentation; uses full tab-content width (~690px on desktop drawer).
- Trigger: per-row overflow menu \u2192 "View submission" (from Decision 9).
- Close: same overflow menu (toggle off) OR an "X" close button on the panel header itself.

**Implications:**
- The existing `ContentItemArtifactPanel.tsx` (435 lines, 8 artifact types) migrates with minimal logic change \u2014 the dispatch by `item.item_type` stays. The structural change is:
  - Outer wrapper class swaps from `ml-6` (tree indent) to full-width inside the tab.
  - Width-related CSS adjustments inside artifact components (image max-height, table column widths, iteration card layout) revisit at implementation time.
  - Existing "expand chevron next to row" pattern is replaced by "View submission" menu item (from Decision 9 D3 per-row overflow).
- Single-open state: the parent tree component owns the `openArtifactItemId` state (single string|null). Opening a new artifact updates state \u2014 the previous one collapses naturally.
- Long submissions: tree scroll handles them. Acceptable trade-off vs sub-drawer complexity.
- Future migration to sub-drawer (Decision A) remains an option for v2 if Cole finds the long-submission scroll problem real in practice.

### Decision 11 — Audit tab content

**Locked:**
- Entry shape: **A1 \u2014 compact timeline list, click-to-expand for before/after diff**
- Filtering: **B2 \u2014 filter chips above the list** (categories: Role / Completion / Certification / Permission / Impersonation / Other)
- Pagination: **D1 \u2014 last 50 entries with "Load more" button**
- Actor display: **C2 default \u2014 actor name + role, fallback "Unknown admin" if user deleted/missing**
- Data source: **new SECDEF RPC** `list_user_audit_history(p_user_id, p_limit, p_offset, p_categories[])`

**Tab layout:**
```
\u250c\u2500 Filter chips \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 [All] [Role] [Completion] [Certification] [Permission] [Impersonation] [Other] \u2502
\u251c\u2500 Timeline \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 \u25b6 May 14, 2026 14:32 \u00b7 Cheryl K \u00b7 Granted mentor role            \u2502
\u2502   Reason: "New mentor onboarding cohort"                              \u2502
\u2502                                                                       \u2502
\u2502 \u25b6 May 12, 2026 09:11 \u00b7 Cole B \u00b7 Marked module complete                \u2502
\u2502   Reason: "Trainee completed off-platform pre-launch"                 \u2502
\u2502                                                                       \u2502
\u2502 \u25b6 May 10, 2026 10:45 \u00b7 Cole B \u00b7 Granted PTP Coach certification        \u2502
\u2502   Reason: "Manually granted post-program completion"                  \u2502
\u2502 ...                                                                   \u2502
\u251c\u2500 Footer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                                              [Load 50 more]          \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
```

**Expanded row (click \u25b6) reveals:**
- Action type (technical: `mentor_role_changed`)
- Full target reference (e.g., "Certification: PTP Coach Cert (UUID prefix)")
- Before/After JSON diff in a compact two-column view
- Actor full email + account type
- IP / session info if available (deferred to v2)

**Category mapping (frontend-side, server provides raw action_type):**
- **Role** \u2014 `mentor_role_changed`, future role-change actions
- **Completion** \u2014 `content_item_completion_set`, `module_completion_set`, `curriculum_completion_set`
- **Certification** \u2014 `certification_granted`, `certification_revoked`, `grant_additional_free_attempts`
- **Permission** \u2014 future actions; password/MFA reset, account_type changes, pseudonymization
- **Impersonation** \u2014 `impersonation_start`, `impersonation_end`, `impersonation_action_taken`
- **Other** \u2014 anything user-targeted not in the above buckets

**New backend RPC:**
- Name: `list_user_audit_history(p_user_id uuid, p_limit integer, p_offset integer, p_categories text[])`
- SECURITY DEFINER, super_admin-gated via `assert_super_admin()`.
- Joins `super_admin_audit_log` \u2192 `users` (actor name resolution); falls back to "Unknown admin" if actor row missing.
- Returns: `audit_id`, `created_at`, `action_type`, `category` (computed), `actor_name`, `actor_email`, `actor_account_type`, `target_summary` (short label), `reason`, `before_value`, `after_value`, `total_count` (window function for pagination).
- Filter: `WHERE target_user_id = p_user_id` AND (if p_categories is non-empty) action_type IN (categories' action_types).

**Implications:**
- New RPC means new migration. Action-type whitelist for the user-targeted set lives in the RPC (no schema change).
- Category mapping is duplicated server-side (in the RPC for filtering) and frontend-side (for display). Could be a `user_audit_action_categories` table down the road; for v1, hardcoded both sides with a single comment marking it.
- Audit entries for impersonation include both "impersonation started against this user" and "actions taken DURING impersonation against this user" \u2014 the second case has the actor as the *impersonator* (super_admin), not the impersonated user. The display should clarify "Cole B (impersonating Alice S) granted certification" or similar.
- Before/after diff rendering: render JSON keys side-by-side; highlight changed values. shadcn doesn't have a diff primitive; light custom rendering of `before \u2192 after` per top-level key.

### Decision 12 \u2014 Bulk actions: which, trigger, justification

**Locked:**
- Trigger: **A1 \u2014 sticky toolbar above the table** appears when one or more rows are checked. Replaces nothing; sits above the column header row when active. Hides on deselect.
- v1 actions: **assign, unassign, schedule, completion override, completion export**.
- Deferred to v2: **bulk role change, bulk MFA reset, bulk password reset, bulk send message, bulk impersonate (never makes sense)**.
- Justification: **C1 \u2014 single reason applied across all N per-user audit entries** for justified bulk actions (the existing single-user pattern extended).

**Bulk toolbar shape:**
```
\u250c\u2500 Bulk actions bar (only when rows checked) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  [12 selected]                                                    \u2502
\u2502  [Assign \u25be] [Unassign \u25be] [Schedule] [Override completion] [Export \u25be]   \u2502
\u2502                                                  [Clear selection]  \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
```

**Per-button behavior:**

- **[Assign \u25be]** \u2014 dropdown with: Cert path, Curriculum, Module, Mentor. Selecting opens a modal for picking the target entity + due date + reason. Calls the matching bulk RPC.
- **[Unassign \u25be]** \u2014 dropdown with: Curriculum, Module, Mentor. Selecting opens a modal for picking the target to unassign + reason. Calls the matching bulk RPC. Note: cert paths can't be unassigned in bulk (they're managed via curriculum unassign).
- **[Schedule]** \u2014 opens the same scheduled-assignment modal from the table toolbar but pre-populates with the selected user set. The admin picks assignment type, target, schedule time, reason. Calls `create_scheduled_assignment` with the multi-user payload.
- **[Override completion]** \u2014 opens a tier-picker modal (cert path / curriculum / module / content item), then a target-picker modal, then a complete/incomplete toggle and reason. Calls the new bulk completion RPCs. **NEW BACKEND** (see below).
- **[Export \u25be]** \u2014 dropdown with: "Completion data" (per-user completion CSV across cert paths, curricula, modules, content items they're assigned to), and possibly "User directory" (just the visible columns). v1 ships completion data export; user directory export is a stretch. **NEW BACKEND** (see below).
- **[Clear selection]** \u2014 deselects all rows. Bulk toolbar collapses.

**New backend RPCs needed for v1 bulk:**

1. **`set_content_item_completion_bulk(p_user_ids uuid[], p_content_item_id uuid, p_complete boolean, p_reason text)`** \u2014 same shape as the existing single-target, extended to multiple users. Per-user iteration with per-element exception isolation, returns the standard `{requested, succeeded, failed, results[]}` bulk shape.
2. **`set_module_completion_bulk(...)`** \u2014 same structure as 1.
3. **`set_curriculum_completion_bulk(...)`** \u2014 wraps `set_curriculum_completion` per assignment-id. Tricky because the existing single-target keys on `p_assignment_id` (not `p_curriculum_id`), so bulk needs to resolve each user's assignment first, then iterate. Backend phase to resolve.
4. **Completion data export query** \u2014 either a new RPC `get_user_completion_export(p_user_ids uuid[])` returning a flat row per user-item, OR a frontend-side query that joins existing tables. Backend phase to decide based on data volume.

**Existing bulk RPCs reused:**

- `assign_curriculum_bulk`, `assign_module_bulk`, `enroll_users_in_certification_path_bulk`, `assign_mentor_pairs_bulk` \u2014 existing single-target bulks built Session 80.
- `unassign_curriculum_bulk`, `unassign_module_bulk`, `unassign_mentor_bulk` \u2014 existing.
- `create_scheduled_assignment` \u2014 existing, takes multi-user payload natively.

**Justification flow:**

- Each bulk action that requires a reason (assign, unassign, override completion, schedule) routes through the shared `JustifiedActionDialog` from Decision 8.
- The dialog's "target" prop encodes the bulk shape: `{action_type, user_ids, target_entity_ref, complete?}`.
- On submit, the dialog calls the chosen bulk RPC with the single `p_reason` string. The RPC inserts N per-user audit rows, each carrying the same reason string. Per-user audit history (Decision 11) then naturally shows each user's entry with the shared reason.

**Implementation notes:**

- The sticky bulk-actions toolbar is a horizontal bar that appears between the filter chips and the column headers. Animates in/out on selection state change. Mobile: stacks vertically.
- Selection state lives in component state (Set<string> of user_ids). Cleared on filter/search change \u2014 with a confirmation if more than 5 selected ("Clearing 12 selected users \u2014 continue?").
- Selection state survives page navigation within results (pagination), but resets on filter change.
- Bulk error reporting reuses the existing `ResultPanel.tsx` component for the per-row succeeded/failed/results display.

### Decision 13 \u2014 Scheduled assignments management UI

**Locked:**
- Container: **A1 \u2014 single modal with two tabs**, triggered by the "Schedule" toolbar button.
  - Tab 1: **"Create new"** (the create form, including multi-user picker when launched without selected rows; pre-populated when launched with selected rows from the bulk-actions bar in Decision 12).
  - Tab 2: **"Pending (N)"** (badge with count of currently-pending scheduled assignments).
- Tab 2 default view: **C2 \u2014 all statuses visible**, status filter chip to narrow (pending / processing / completed / partial / failed / cancelled).
- Default sort: **scheduled_for ascending** (next to fire at top).

**Modal shape:**
```
\u250c\u2500 Schedule assignment \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 [Create new]  [Scheduled (12)]                                \u2502
\u251c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  (Tab 1: Create new form \u2014 type selector, target picker,    \u2502
\u2502   user picker (or pre-populated from bulk selection),         \u2502
\u2502   scheduled date/time, reason, [Schedule] button)             \u2502
\u2502                                                                \u2502
\u2502  (Tab 2: Pending list)                                         \u2502
\u2502  [Status: All \u25be]                                                \u2502
\u2502  Scheduled for      Type       Users  Status      By      Actions  \u2502
\u2502  May 22, 2026 09:00 Curriculum 12     Pending     Cole B  [Cancel]  \u2502
\u2502  May 20, 2026 12:00 Mentor     5      Pending     Cole B  [Cancel]  \u2502
\u2502  May 18, 2026 06:20 Module     8      Completed   Cole B    \u2014       \u2502
\u2502  ...                                                          \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
```

**Pending list row contents:**
- Scheduled for (timestamp; sortable; default sort ascending)
- Type (curriculum / module / cert_path / mentor) with a small icon
- Users (count)
- Status badge (pending = amber, processing = teal, completed = green, partial = amber-ish, failed = destructive, cancelled = muted)
- Scheduled by (admin name)
- Actions per row:
  - **Cancel** (only when status = pending; opens JustifiedActionDialog confirming cancellation, calls `cancel_scheduled_assignment`).
  - **View details** (expand row inline to show target name, reason, result summary if completed/failed/partial, list of user IDs).

**Status filter chip values:**
- All (default)
- Pending
- Processing
- Completed
- Partial
- Failed
- Cancelled

**Backend reuse:**
- `create_scheduled_assignment` \u2014 existing, used by Create tab.
- `list_scheduled_assignments` \u2014 existing, used by Pending list. Already supports filtering.
- `cancel_scheduled_assignment` \u2014 existing, called from Cancel action with reason.

**Implications:**
- Tab badge count (`Scheduled (12)`) is the count of `status = 'pending'` entries only \u2014 even though the list shows all statuses by default. Keeps the badge meaningful as an actionable count.
- Modal is the same modal whether it's triggered by the toolbar "Schedule" button (no pre-selection) or by the bulk-actions toolbar "Schedule" button (with pre-selected users). The Create tab adapts: shows the user-picker control normally, hides it and shows the locked user count when launched with selection.
- Both tabs share modal real estate; switching tabs preserves state in each.
- Modal is wide enough to render the list comfortably (~720-800px). Specific width to lock in implementation phase based on column count.
- The list refetches on tab switch and after a cancel action lands.

### Decision 14 \u2014 Excel bulk import management UI

**Locked:**
- Modal structure: **A1 \u2014 single-action modal**, no persistent history. Matches today's behavior exactly.
- Flow: **B1 \u2014 download template / fill / upload**. Unchanged from current implementation.
- Failure handling: **C1 \u2014 show report, admin fixes spreadsheet, re-uploads.** Unchanged.

**Modal shape:**
```
\u250c\u2500 Bulk import \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  Step 1: Download template                                    \u2502
\u2502  Fills in known reference data (cert paths, curricula,        \u2502
\u2502  modules, mentors).                                            \u2502
\u2502  [Download .xlsx template]                                     \u2502
\u2502                                                                \u2502
\u2502  Step 2: Upload completed file                                 \u2502
\u2502  [Choose file]    File: import-2026-05-22.xlsx (12 rows)       \u2502
\u2502                                                                \u2502
\u2502  [Import]                                                      \u2502
\u2502                                                                \u2502
\u2502  (Results panel below appears after import completes)          \u2502
\u2502  Total: 12 | Succeeded: 9 | Failed: 3                         \u2502
\u2502    Row 4: ambiguous email                                      \u2502
\u2502    Row 7: unknown curriculum                                   \u2502
\u2502    Row 11: unknown mentor                                      \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
```

**Backend reuse:**
- `get_learning_import_reference()` RPC \u2014 existing, used for template build.
- `learning-admin-import` Edge Function \u2014 existing, used for upload + execution.

**Implications:**
- No new tables, no new RPCs, no new Edge Functions for v1 import. Migration cost is purely UI \u2014 the import modal becomes a peer of the Schedule modal in the Members surface toolbar.
- The existing `ResultPanel.tsx` component renders the result. Reused.
- B3 (preview-before-commit) is logged as a v2 candidate. The modal is structurally ready to accept a "Preview" sub-step in v2 without breaking the v1 flow.


---

## Design phase summary

**The Members surface, end to end:**

A single page at `/super-admin/members` replaces Learning Admin's four tabs AND the existing `/super-admin/users` page. Sidebar nav has one entry: "Members." The page is a pure data table with:

- **Search input** (email + name + org, typeahead, 250ms debounce, match-highlight in cells).
- **Filter chip row**: Account type / Mentor / Status / Active assignments always visible. Organization / Certifications / Last active / Created at / Has supervisor behind "More filters."
- **Saved views** dropdown on right of chip row; per-user persistence; default view = Status:Active applied.
- **Toolbar buttons** (right-aligned): [Bulk Import] [Schedule] [\u22ee].
- **Column show/hide** control (in the [\u22ee] menu); per-user persistence.
- **Data table** with multi-select checkboxes, 10 visible columns by default (Name / Email / Account type / Mentor / Organization / Active assignments / Certifications / Status / Last active / Actions \u22ee). Default sort: Name asc.
- **Sticky bulk-actions toolbar** appears between filter chips and column headers when rows are checked: [N selected] [Assign \u25be] [Unassign \u25be] [Schedule] [Override completion] [Export \u25be] [Clear].

**Clicking a row** opens a side drawer (auto: 720px desktop / full-width below 1024px) with X + Escape + click-outside-with-confirmation dismissal. The drawer also has an "Open full view" button that navigates to `/super-admin/members/{uuid}` for the same content in full-page form.

**Drawer structure:**

- **Sticky header**: identity (name / email / account type / org / status) + Mentor toggle + [Impersonate] CTA + [\u22ee overflow] (Reset MFA, Trigger password reset, View access history, Force pseudonymization).
- **Tab bar**: Learning (default) \u2192 Assignments \u2192 Coach (conditional) \u2192 Audit.
  - **Learning**: preserved 4-tier tree (cert paths \u2192 curricula \u2192 modules \u2192 items + orphan certs + directly-assigned curricula/modules). All collapsed by default. Filter chip row above the tree (status filter + within-tree search). Per-row overflow menus (\u22ee) hold all tier actions (grant/revoke cert, mark complete/incomplete, view submission, unassign). Submission viewer inline-expands under the content item row at full tab width (single-open enforced).
  - **Assignments**: per-user assign actions (cert path / curriculum / module / mentor) with due date and reason.
  - **Coach** (only when account_type=coach): cert list + free-attempts pool view + grant-attempts form (migrated from existing UserDetailsModal).
  - **Audit**: per-user history of admin actions. Compact timeline with click-to-expand for before/after diff. Filter chips above (Role / Completion / Certification / Permission / Impersonation / Other). Last 50 entries with Load more.

**All justified actions** route through a single shared `JustifiedActionDialog` component (mentor role change, cert grant/revoke, completion override, grant attempts, future actions). Handles 10-char-min validation, redundant no-op handling, error mapping.

**Bulk actions modal flows:**
- **Assign / Unassign**: tier-specific bulk modals using existing `assign_*_bulk` / `unassign_*_bulk` RPCs.
- **Schedule**: same modal whether triggered from toolbar (no pre-selection) or bulk-actions bar (with pre-selection). Two tabs: "Create new" / "Scheduled (N)" with the pending list defaulting to all-statuses with filter chip to narrow.
- **Override completion**: NEW bulk completion RPCs (`set_content_item_completion_bulk`, `set_module_completion_bulk`, `set_curriculum_completion_bulk`).
- **Export \u25be**: NEW backend (RPC or frontend join) for completion-data CSV export.
- **Bulk Import**: single-action modal, current download-template / upload / report flow preserved.

**Deferred to v2:**
- Bulk role change (set_mentor_role_bulk)
- Bulk MFA reset, password reset, send message
- Sub-drawer pattern for submission viewer (current inline-expansion ships v1)
- Persistent import history with new audit table
- Preview-before-commit on bulk import
- Mobile-specific drawer behavior optimizations beyond auto-width breakpoint

---

## Backend deliverables (Phase 11.B)

**New RPCs:**
1. `search_impersonation_targets` \u2014 EXTEND to return additional columns (is_mentor, active_assignment_count, certification_count, worst_certification_status, is_deactivated, last_sign_in_at) AND accept additional filter params (account_type[], is_mentor, is_deactivated, has_active_assignments, organization_id[], certification_status[], last_active_within, created_within, has_supervisor). Additive only; existing callsites unaffected.
2. `list_user_audit_history(p_user_id, p_limit, p_offset, p_categories[])` \u2014 NEW SECDEF RPC.
3. `set_content_item_completion_bulk(p_user_ids[], p_content_item_id, p_complete, p_reason)` \u2014 NEW.
4. `set_module_completion_bulk(p_user_ids[], p_module_id, p_complete, p_reason)` \u2014 NEW.
5. `set_curriculum_completion_bulk(...)` \u2014 NEW. Backend phase to resolve the assignment-id-per-user shape.
6. `get_user_completion_export(p_user_ids[])` or equivalent \u2014 NEW. Backend phase to choose RPC vs frontend join.

**New tables:**
1. `user_ui_preferences(user_id uuid, surface_key text, prefs jsonb, updated_at timestamptz, primary key (user_id, surface_key))` \u2014 for column visibility, saved filter views, default view selection.

**Existing reused:**
- `assign_curriculum_bulk`, `assign_module_bulk`, `enroll_users_in_certification_path_bulk`, `assign_mentor_pairs_bulk`
- `unassign_curriculum_bulk`, `unassign_module_bulk`, `unassign_mentor_bulk`
- `create_scheduled_assignment`, `list_scheduled_assignments`, `cancel_scheduled_assignment`
- `set_content_item_completion`, `set_module_completion`, `set_curriculum_completion` (single-user; bulk versions wrap)
- `set_mentor_role`, `grant_certification`, `revoke_certification`, `grant_additional_free_attempts`
- `get_user_learning_state`, `get_content_item_for_viewer`, `get_quiz_attempt_results`, `get_thumbnail_urls_for_entities`
- `learning-admin-import` Edge Function
- `get_learning_import_reference`

---

## Frontend deliverables (Phase 11.C)

**New components:**
- `src/pages/super-admin/Members.tsx` \u2014 the page itself
- `src/components/members/MembersTable.tsx` \u2014 the data table
- `src/components/members/MembersFilterBar.tsx` \u2014 filter chips + saved views
- `src/components/members/MembersBulkActionsBar.tsx` \u2014 sticky bulk toolbar
- `src/components/members/MemberDrawer.tsx` \u2014 drawer container with sticky header + tabs
- `src/components/members/MemberDrawerLearning.tsx` \u2014 Learning tab content (migrated from AdminLearningTree)
- `src/components/members/MemberDrawerAssignments.tsx` \u2014 Assignments tab content
- `src/components/members/MemberDrawerCoach.tsx` \u2014 Coach tab content (migrated from UserDetailsModal)
- `src/components/members/MemberDrawerAudit.tsx` \u2014 Audit tab content
- `src/components/justified-action/JustifiedActionDialog.tsx` \u2014 shared justified-action modal (generalization of CompletionConfirmDialog)
- `src/components/members/ScheduleAssignmentModal.tsx` \u2014 the Schedule modal with two tabs
- `src/components/members/BulkImportModal.tsx` \u2014 the Bulk Import modal (migrated as-is)
- `src/components/members/SavedViewsDropdown.tsx` \u2014 saved filter views control
- `src/components/members/ColumnVisibilityMenu.tsx` \u2014 column show/hide control
- `src/lib/highlightMatch.ts` \u2014 search-match-highlight utility

**Modified components:**
- `src/App.tsx` \u2014 update routes; remove SuperAdminUsers route; remove LearningAdmin route; add /super-admin/members and /super-admin/members/:userId routes
- `src/components/AppSidebar.tsx` \u2014 remove "Users" and "Learning Admin" entries; add "Members" entry

**Migrated / deleted:**
- `src/pages/super-admin/LearningAdmin.tsx` (2038 lines) \u2014 DELETE after Members lands; logic migrates into Members components.
- `src/pages/super-admin/Users.tsx` (278 lines) \u2014 DELETE after Members lands.
- `src/components/super-admin/UserDetailsModal.tsx` (313 lines) \u2014 logic migrates into MemberDrawerCoach.tsx; delete after migration.
- `src/components/learning-admin/CompletionControlTab.tsx` \u2014 logic migrates into MemberDrawerLearning; delete.
- `src/components/learning-admin/CompletionConfirmDialog.tsx` \u2014 absorbed by JustifiedActionDialog; delete.
- `src/components/learning-admin/AdminLearningTree.tsx` (472 lines) \u2014 logic migrates into MemberDrawerLearning; delete.
- `src/components/learning-admin/ContentItemArtifactPanel.tsx` (435 lines) \u2014 migrate as-is into a sub-component used by MemberDrawerLearning; rename only.
- `src/components/learning-admin/TraineeMultiSelect.tsx` \u2014 absorbed by MembersTable selection; delete after migration.
- `src/components/learning-admin/ResultPanel.tsx` \u2014 reused by bulk-action result displays; keep but possibly move to shared location.
- `src/components/learning-admin/learnerSearchShared.ts` \u2014 absorbed by Members shared types; delete after migration.

**Touch budget estimate:**
- ~14 new component files
- ~2,200 lines of frontend code to delete (existing surfaces)
- ~3,000-4,000 lines of frontend code to write (rough; depends on JustifiedActionDialog reuse efficiency)
- ~6-10 new backend migrations (RPC extensions + new RPCs + new table)


---

## Phase 11.B backend recon corrections (Session 87)

**Correction to Decision 7 — Coach tab visibility:**
- Original lock: "Coach tab shown when `account_type === 'coach'`"
- Corrected: **Coach tab shown when `is_practitioner_coach === true`**, regardless of account_type
- Rationale: live data shows `is_practitioner_coach=true` includes 10 `account_type='coach'` AND 2 `account_type='brainwise_super_admin'` users. The `is_practitioner_coach` flag is the canonical practitioner status, not account_type. The 2 super_admin practitioners need the Coach tab (cert list, grant attempts) too.

**Correction to Decision 4 — Status filter values:**
- Original lock: "Active (default) / Deactivated / All"
- Corrected: **Active (default) / Departed / Pseudonymized / All**
- Rationale: live `account_status` column has three values today: `active`, `departed_individual`, `pseudonymized`. "Deactivated" doesn't exist as a status. The filter should expose all three real states or roll the non-active ones into a single "Not active" bucket. Choice between:
  - **Verbose**: All / Active / Departed / Pseudonymized (4 options) — more transparent
  - **Collapsed**: All / Active / Not active (3 options) — simpler
  - Locking this in next sub-decision.

**Correction to Decision 3 — column derivation:**
- "Status" badge in column 9 derives from `account_status`, not from a boolean `is_deactivated`. Three badge values: Active (green), Departed (muted), Pseudonymized (warning amber).
- `last_sign_in_at` is in `auth.users`, not `public.users`. SECDEF RPC reads from `auth.users` directly. Test access at RPC implementation time.

**Decision 4 status filter — sub-question to lock:**


**Status filter locked (corrected from Decision 4):**
- Values: **All / Active / Not active** (3 options)
- "Active" maps to `account_status = 'active'`
- "Not active" maps to `account_status IN ('departed_individual', 'pseudonymized')` \u2014 collapsed bucket
- Default applied filter: Active

**Coach tab visibility locked (corrected from Decision 7):**
- Logic: **Coach tab visible when `is_practitioner_coach = true` OR `account_type = 'coach'`** (defensive OR)
- Rationale: catches both the live `is_practitioner_coach=true` set (12 users including 2 super_admins who practice) AND the `account_type='coach'` set (10 users, all of which already have is_practitioner_coach=true today). The OR is defensive against future drift where someone might have account_type='coach' without the flag set.
- Backend implementation: `search_impersonation_targets` extended-return-column `show_coach_tab` is `(u.is_practitioner_coach = true OR u.account_type = 'coach')`.


---

## Phase 11.B backend recon \u2014 findings and migration plan

**Verified existing RPCs (all live, all reusable):**

| RPC | Sig confirmed | Notes |
|---|---|---|
| `search_impersonation_targets` (3-arg) | p_query, p_limit, p_offset | RETURN columns: user_id, email, full_name, account_type, organization_id, organization_name, total_count. SECDEF, super_admin gate. ILIKE search on email/full_name/org.name with sort_priority. 4 frontend callsites confirmed all use this 3-arg version. |
| `assign_curriculum_bulk` | p_user_ids[], p_curriculum_id, p_source, p_certification_id, p_source_reference_id, p_due_at, p_reason | Loops `assign_curriculum_directly` per user. Max 500. Returns `{operation, requested, succeeded, failed, results[]}`. Template for new bulks. |
| `assign_module_bulk` | p_user_ids[], p_module_id, p_source, p_source_reference_id, p_due_at, p_reason | Same template. |
| `enroll_users_in_certification_path_bulk` | p_user_ids[], p_certification_path_id, p_reason, p_due_at | Calls `enroll_user_in_certification_path` per user. Logs action_type `curriculum_directly_assigned` with `certification_path_id` in detail JSON. |
| `assign_mentor_pairs_bulk` | p_mentor_user_id, p_pairs jsonb, p_reason | DIFFERENT SHAPE: one mentor + N (trainee_user_id, instrument_id) pairs. Frontend bulk-assign-mentor needs a different modal from assign-curriculum/module/cert-path. |
| `unassign_curriculum_bulk` | p_assignment_ids[], p_reason | Takes assignment IDs, not user IDs. Frontend must resolve user\u2192assignment first. |
| `unassign_module_bulk` | p_assignment_ids[], p_reason | Same pattern. |
| `unassign_mentor_bulk` | p_assignment_ids[], p_end_reason, p_reason | Takes two reason params; `p_end_reason` is the user-visible severance note, `p_reason` is the audit reason. Frontend needs both in the UI. |
| `create_scheduled_assignment` | p_assignment_type, p_target_id, p_user_ids[], p_scheduled_for, p_reason, p_mentor_certification_id | Native multi-user. Reusable from both toolbar and bulk-actions trigger paths. |
| `list_scheduled_assignments` | (no args) | Returns all scheduled assignments. Status filter is frontend-side. |
| `cancel_scheduled_assignment` | p_id | NO p_reason parameter. Decision 13 design assumed reason \u2014 see open question below. |
| `set_content_item_completion` | p_user_id, p_content_item_id, p_complete, p_reason | Gates: assert_super_admin + assert_impersonation_allows('permission_change'). Action type: `content_item_completion_set`. Bulk wrapper calls this per user. |
| `set_module_completion` | p_user_id, p_module_id, p_complete, p_reason | Same gate. Action type: `module_completion_set`. |
| `set_curriculum_completion` | p_assignment_id, p_complete, p_reason | Same gate. KEYS ON p_assignment_id, NOT p_curriculum_id. Bulk wrapper must resolve user\u2192assignment first. Action type: `curriculum_completion_set`. |
| `set_mentor_role` | p_user_id, p_is_mentor, p_reason | Action type: `mentor_role_changed`. |
| `grant_certification` | p_certification_id, p_reason | Action type: `certification_granted`. |
| `revoke_certification` | p_certification_id, p_reason | Action type: `certification_revoked`. |
| `grant_additional_free_attempts` | p_certification_id, p_instrument_id text, p_count, p_reason | Action type: `free_attempts_granted`. Note: instrument is text (code: PTP, NAI, AIRSA, HSS), not UUID. |
| `get_user_learning_state` | p_user_id | Returns jsonb. NOT YET READ \u2014 deferred to Phase 11.B implementation start. |
| `assert_impersonation_allows` | p_action_category | Denylist (not allowlist) of 9 categories: identity_change, assessment_submission, privacy_consent, financial_transaction, outbound_user_communication, permission_change, corporate_admin_action, coach_action, lifecycle_action. Observe mode blocks all mutations; act mode blocks denylisted categories only. New bulks inherit this via the single-user RPCs they wrap. |

**Action types verified present (no new ones needed for v1 bulks):**
- content_item_completion_set, module_completion_set, curriculum_completion_set
- mentor_role_changed, mentor_assigned, mentor_unassigned
- certification_granted, certification_revoked, free_attempts_granted
- curriculum_directly_assigned, curriculum_unassigned
- module_directly_assigned, module_unassigned
- impersonation_started / impersonation_action / impersonation_denied_action / impersonation_ended
- org_admin_assigned / org_admin_transferred (out of v1 Members scope)

**Schema findings:**
- `users.is_mentor` boolean NOT NULL default false \u2014 directly filterable/returnable.
- `users.is_practitioner_coach` boolean NOT NULL default false \u2014 use for Coach tab visibility (see Decision 7 correction).
- `users.account_status` text NOT NULL default 'active'. Live values: 'active' (98), 'departed_individual' (1), 'pseudonymized' (2). Status filter collapses to Active/Not-active.
- `users.supervisor_user_id` uuid nullable \u2014 has-supervisor filter source.
- `users.created_at` \u2014 created-date-range filter source.
- `users.deactivated_at`, `users.pseudonymized_at` \u2014 status detail derivers; not exposed as separate filters.
- `last_sign_in_at` is NOT on public.users \u2014 lives in auth.users. SECDEF RPC reads from auth.users.
- `super_admin_audit_log` columns: `affected_user_id` (target user; NOT target_user_id), `super_admin_user_id` (actor; NOT actor_user_id). list_user_audit_history RPC must use these names.
- `super_admin_audit_log.action_type` is a FOREIGN KEY to `super_admin_action_types.action_type`, NOT a CHECK constraint. Adding new action types requires INSERT into super_admin_action_types first.
- No existing user-preferences table fits the column-visibility / saved-views use case. Choice: new `user_ui_preferences` table vs `users.ui_preferences jsonb` column \u2014 see open question below.

**Phase 11.B open backend questions (need locking before migrations):**


**Backend questions locked:**
1. **UI preferences storage**: `users.ui_preferences jsonb` column (NOT a new table). Simpler, ships faster, fine for one surface.
2. **Cancel reason**: drop the reason requirement on `cancel_scheduled_assignment`. No backend change; Decision 13 design updated to skip JustifiedActionDialog on cancel \u2014 a simple "Cancel this scheduled assignment?" confirm dialog instead.
3. **Bulk-assign-mentor**: dropped from v1. Mentor assignment in v1 happens per-trainee via the row drawer's Assignments tab. Deferred to v2.

**Correction to Decision 12** (bulk actions list):
- Original v1 list: assign, unassign, schedule, completion override, completion export
- Corrected v1 list: assign (cert path / curriculum / module \u2014 NO mentor), unassign (curriculum / module \u2014 NO mentor), schedule (multi-user), completion override (NEW bulk RPCs), completion export
- Deferred to v2: bulk-assign-mentor, bulk-unassign-mentor, bulk role change, bulk MFA reset, bulk password reset, bulk send message

**Correction to Decision 13** (Cancel scheduled assignment):
- Original: route Cancel through JustifiedActionDialog with reason
- Corrected: simple confirm dialog ("Cancel this scheduled assignment? It will not run."). No reason captured. cancel_scheduled_assignment RPC unchanged.


---

## Phase 11.B migration sequence (proposed)

Five migrations, applied in this order. Each is independently verifiable. None depends on frontend changes shipping first.

### Migration 1: `phase11_users_ui_preferences_column`

**Adds** the `users.ui_preferences jsonb` column with default `'{}'::jsonb`. Backfills nothing (column starts empty per user).

```sql
ALTER TABLE public.users
  ADD COLUMN ui_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.users.ui_preferences IS
  'Per-user UI preferences keyed by surface_key. Shape: {<surface_key>: {<arbitrary_prefs>}}. Example: {"members": {"visible_columns": ["name","email","status"], "default_view": "active_only", "saved_views": [...]}}';
```

**Verification:** column exists, default is `{}`, all existing rows have it. No RPC needs touching \u2014 the new Members frontend reads/writes via direct SELECT/UPDATE through Supabase client.

**Trade-off:** Direct table writes mean RLS must allow users to update their own `ui_preferences` row. The `users` table already has RLS policies; need to confirm the existing self-update policy covers the new column.

---

### Migration 2: `phase11_search_impersonation_targets_extended`

**Replaces** the 3-arg `search_impersonation_targets` with a new signature carrying additional optional filter params and additional returned columns. Existing 4 frontend callsites continue working because all new params have defaults; existing returned columns preserved in the same order at the front of the RETURNS TABLE.

**Returned columns (in order):**
1. user_id (existing)
2. email (existing)
3. full_name (existing)
4. account_type (existing)
5. organization_id (existing)
6. organization_name (existing)
7. total_count (existing)
8. is_mentor (NEW)
9. is_practitioner_coach (NEW) \u2014 for Coach tab visibility
10. account_status (NEW) \u2014 for Status badge in column 9
11. active_assignment_count (NEW) \u2014 derived from active curriculum_assignments + module_assignments + cert_path enrollments
12. certification_count (NEW) \u2014 from coach_certifications WHERE status IN ('in_progress', 'certified')
13. worst_certification_status (NEW) \u2014 priority: revoked > in_progress > certified > NULL
14. last_sign_in_at (NEW) \u2014 from auth.users (SECDEF lets us read)
15. supervisor_user_id (NEW) \u2014 has-supervisor filter source

**New filter params (all default NULL = no filter):**
- `p_account_types text[] DEFAULT NULL` \u2014 IN-list filter on account_type
- `p_is_mentor boolean DEFAULT NULL` \u2014 NULL=any, true/false strict
- `p_account_status_active boolean DEFAULT NULL` \u2014 NULL=any, true=only 'active', false=NOT 'active'
- `p_has_active_assignments boolean DEFAULT NULL`
- `p_organization_ids uuid[] DEFAULT NULL`
- `p_certification_statuses text[] DEFAULT NULL`
- `p_last_active_within_days integer DEFAULT NULL`
- `p_created_within_days integer DEFAULT NULL`
- `p_has_supervisor boolean DEFAULT NULL`

**Sort params (optional, defaults to existing sort_priority + email):**
- `p_sort_by text DEFAULT 'name'` \u2014 'name' | 'email' | 'created_at' | 'last_active' | 'active_assignment_count' | 'certifications'
- `p_sort_dir text DEFAULT 'asc'` \u2014 'asc' | 'desc'

**Implementation notes:**
- Use the existing CTE pattern. Add a second CTE for active_assignment_count joining the 3 assignment tables. Computed columns done in the CTE.
- COUNT(*) OVER () for total_count remains the pagination signal.
- Sort uses a CASE expression on p_sort_by; safer than dynamic SQL.
- Backward compatibility: positional args. The 4 existing callsites call by named-argument style with `p_query`, `p_limit`, `p_offset` only. Adding more named params with defaults doesn't break them.

**Verification:**
- Test that existing 3-arg callers still get expected results
- Test each new filter individually
- Test combinations
- Test sort orderings
- Test that pagination + total_count still works

---

### Migration 3: `phase11_bulk_completion_rpcs`

**Adds** 3 new bulk completion RPCs as thin wrappers around the existing single-user RPCs.

```sql
-- 3a. set_content_item_completion_bulk
CREATE OR REPLACE FUNCTION public.set_content_item_completion_bulk(
  p_user_ids uuid[],
  p_content_item_id uuid,
  p_complete boolean,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  c_max_bulk constant integer := 500;
  v_uid uuid; v_n integer;
  v_ok integer := 0; v_failed integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_inner jsonb;
BEGIN
  PERFORM public.assert_super_admin();
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no_user_ids_provided' USING ERRCODE = '22023';
  END IF;
  v_n := array_length(p_user_ids, 1);
  IF v_n > c_max_bulk THEN
    RAISE EXCEPTION 'bulk_limit_exceeded: % (max %)', v_n, c_max_bulk USING ERRCODE = '22023';
  END IF;
  FOREACH v_uid IN ARRAY (SELECT array_agg(DISTINCT u) FROM unnest(p_user_ids) u)
  LOOP
    BEGIN
      v_inner := public.set_content_item_completion(v_uid, p_content_item_id, p_complete, p_reason);
      v_ok := v_ok + 1;
      v_results := v_results || jsonb_build_object('user_id', v_uid, 'status', 'succeeded', 'detail', v_inner);
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_object('user_id', v_uid, 'status', 'failed', 'detail', SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object(
    'operation', 'set_content_item_completion_bulk',
    'requested', v_n, 'succeeded', v_ok, 'failed', v_failed, 'results', v_results);
END;
$$;

-- 3b. set_module_completion_bulk \u2014 identical pattern, wraps set_module_completion(uid, p_module_id, p_complete, p_reason)
-- 3c. set_curriculum_completion_bulk \u2014 resolver step needed
```

**Migration 3c (set_curriculum_completion_bulk) \u2014 tricky one:**

Because `set_curriculum_completion` keys on `p_assignment_id`, not `p_curriculum_id`, the bulk wrapper has to resolve user\u2192assignment first. The resolver:

```sql
-- For each user_id, find the active assignment for the curriculum.
-- If user has no active assignment for that curriculum: record as failed for that user (per-element exception isolation).
-- If user has multiple active assignments for the same curriculum (cert-path-attached + directly-assigned): pick the one matching p_source preference, or apply to all? \u2014 decision below.

FOREACH v_uid IN ARRAY (...)
LOOP
  BEGIN
    SELECT id INTO v_assignment_id
    FROM public.user_curriculum_assignments
    WHERE user_id = v_uid
      AND curriculum_id = p_curriculum_id
      AND status IN ('active', 'completed');  -- 'completed' included for reverse (incomplete) operations
    IF NOT FOUND THEN
      RAISE EXCEPTION 'no_assignment_found_for_user_curriculum';
    END IF;
    v_inner := public.set_curriculum_completion(v_assignment_id, p_complete, p_reason);
    v_ok := v_ok + 1;
    ...
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    ...
  END;
END LOOP;
```

**Edge case:** if a user has BOTH a cert-path-attached curriculum assignment AND a directly-assigned-curriculum assignment for the same curriculum_id, the resolver picks one. The current `SELECT INTO ... LIMIT 1` would non-deterministically pick. **Better:** prefer the directly-assigned source (since bulk completion override is typically "force the manual assignment complete," not "force the cert-path attached one"). Or fail the user with `ambiguous_assignment_for_curriculum` and let the admin disambiguate via the row drawer. Recommend the latter \u2014 safer to surface the ambiguity than to silently pick.

**Verification:**
- Test each bulk RPC against a small set of test users
- Verify per-user audit rows are written (each per-user call writes one row, so N user audit rows expected)
- Verify per-user reason matches across all rows (Decision 12 C1 confirmed)
- Verify per-element exception isolation (one bad user doesn't kill the others)
- Verify total_count + succeeded + failed sums correctly

---

### Migration 4: `phase11_list_user_audit_history_rpc`

**Adds** the `list_user_audit_history` RPC for the per-user Audit tab.

```sql
CREATE OR REPLACE FUNCTION public.list_user_audit_history(
  p_user_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_categories text[] DEFAULT NULL  -- NULL = all categories
) RETURNS TABLE(
  audit_id uuid,
  created_at timestamptz,
  action_type text,
  category text,        -- mapped: 'role' | 'completion' | 'certification' | 'permission' | 'impersonation' | 'other'
  actor_name text,      -- NULL fallback "Unknown admin"
  actor_email text,
  actor_account_type text,
  target_summary text,  -- short label, e.g. "PTP Coach Cert" or "Module: Intro to PTP"
  reason text,
  before_value jsonb,
  after_value jsonb,
  total_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  PERFORM public.assert_super_admin();
  -- (Standard impl: CTE with action_type \u2192 category mapping via CASE,
  --  WHERE affected_user_id = p_user_id,
  --  AND (p_categories IS NULL OR category = ANY(p_categories)),
  --  LEFT JOIN users on super_admin_user_id for actor display,
  --  ORDER BY created_at DESC,
  --  COUNT(*) OVER () AS total_count,
  --  LIMIT v_limit OFFSET v_offset)
  RETURN QUERY ...;
END;
$$;
```

**Category mapping** (server-side, mirrored frontend-side):
- `'role'` \u2190 `mentor_role_changed`
- `'completion'` \u2190 `content_item_completion_set`, `module_completion_set`, `curriculum_completion_set`
- `'certification'` \u2190 `certification_granted`, `certification_revoked`, `free_attempts_granted`
- `'permission'` \u2190 (placeholder for future password reset / MFA reset / pseudonymization actions; empty in v1)
- `'impersonation'` \u2190 `impersonation_started`, `impersonation_action`, `impersonation_denied_action`, `impersonation_ended`
- `'assignment'` \u2190 `curriculum_directly_assigned`, `module_directly_assigned`, `mentor_assigned`, `mentor_unassigned`, `curriculum_unassigned`, `module_unassigned`
- `'other'` \u2190 any user-targeted action_type not in the above sets

**Note:** Decision 11 listed 6 categories (role / completion / cert / permission / impersonation / other). Adding 'assignment' is necessary because curriculum/module/mentor assign-and-unassign actions are user-targeted and the user would want to see them. Frontend filter chip set needs to be updated to 7 categories (or fold 'assignment' into 'role' or 'other').

**Verification:**
- Test against the live super_admin_user_id (cbastian@brainwiseenterprises.com) since his audit log has plenty of rows
- Test the category filter individually
- Test pagination
- Test actor name fallback on a row whose actor was deleted (synthetic test)
- Test target_summary derivation for each action type

---

### Migration 5: `phase11_audit_log_assignment_category` (optional)

If we decide to keep 'assignment' as its own audit category (rather than folding it into 'role' or 'other'), no schema change needed \u2014 the category mapping is in the RPC, not in a table. So this migration may not exist.

If we DO want to formalize the category list (so multiple consumers stay in sync), we could add a `super_admin_action_types.user_audit_category text` column with a CHECK constraint and seed it. That would also let the RPC join `super_admin_action_types` rather than hardcoding the case expression.

**Decision deferred:** keep mapping in RPC for v1 (simpler), formalize in v2 if other consumers (e.g., system-wide audit dashboard) want consistent categories.

---

## Migration application order

1. `phase11_users_ui_preferences_column` (column add, additive, no break risk)
2. `phase11_search_impersonation_targets_extended` (RPC replace, additive params, no break risk per backward-compat verification)
3. `phase11_bulk_completion_rpcs` (3 new RPCs, no break risk)
4. `phase11_list_user_audit_history_rpc` (1 new RPC, no break risk)

Each can be applied independently and verified before the next. No interdependencies.

---

## Post-migration verification queries

After each migration, run these to confirm intent landed correctly:

```sql
-- After M1: column exists with default
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'ui_preferences';

-- After M2: extended search returns new columns
SELECT * FROM public.search_impersonation_targets(NULL, 5, 0) LIMIT 1;
-- Should see 15 columns instead of 7.

-- After M3: bulk RPCs are callable
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name LIKE 'set_%_completion_bulk';
-- Should list: set_content_item_completion_bulk, set_module_completion_bulk, set_curriculum_completion_bulk

-- After M4: audit history RPC is callable
SELECT * FROM public.list_user_audit_history('<cole-uuid>', 5, 0, NULL) LIMIT 1;

-- After all: trigger a small bulk completion override against a test user via the new RPC; verify audit row written.
```


**Phase 11.B backend questions locked (partial):**

- **User UI preferences storage**: **Add `users.ui_preferences jsonb` column.** No new table. Default value `'{}'::jsonb`. Surface-keyed contents (`{"members": {"columns": [...], "saved_views": [...], "default_view": "..."}}`). Migration: single ADD COLUMN.

- **cancel_scheduled_assignment reason**: **Drop the reason requirement on Cancel.** Cancellation is reversible by re-scheduling; low-stakes. Frontend Cancel action skips the JustifiedActionDialog flow and goes to a simple confirm dialog ("Cancel this scheduled assignment? [Cancel] [Confirm]"). No backend RPC change needed.

- **Mentor-bulk-assign asymmetry**: **DEFERRED** \u2014 pending frontend recon + recommendation. See Phase 11.C below.


---

## Phase 11.C frontend recon findings

**Existing surfaces inventoried (all read):**

| File | Lines | What it does | Disposition |
|---|---|---|---|
| LearningAdmin.tsx | 2038 | Page shell + 4 inline functions (SingleUserAssignDialog 181-392, TraineesTab 393-588, AssignUnassignTab 589-1735, MentorRoleTab 1736-1996) | DELETE after migration. Logic redistributed. |
| Users.tsx | 278 | Search + table + per-row Impersonate/View details dropdown. JustificationModal + UserDetailsModal | DELETE after migration. Members table + drawer absorb it. |
| UserDetailsModal.tsx | 313 | Modal with identity block + coach-only cert/grant-attempts form | DELETE after migration. Coach tab in drawer absorbs it. |
| CompletionControlTab.tsx | 197 | LearnerPicker (table) + selected-mode (tree+dialog) | DELETE. Learning tab in drawer absorbs it. |
| CompletionConfirmDialog.tsx | 226 | Justified-action dialog for completion mark/unmark, 4 tiers, error mapping | DELETE; absorbed by JustifiedActionDialog (Decision 8). |
| AdminLearningTree.tsx | 472 | 4-tier hierarchical tree, status pills, mark buttons | MIGRATE near-as-is into Learning tab subcomponent. Per-row UI changes to overflow menu per Decision 9. |
| ContentItemArtifactPanel.tsx | 435 | 8-artifact-type dispatcher (video/written/external/live/skills/quiz/file/lesson_blocks) | MIGRATE as-is. Wrapper class change for full-width inline expansion (Decision 10). |
| TraineeMultiSelect.tsx | small | Multi-select search input for trainees in bulk Assign | DELETE; replaced by table-level multi-select checkboxes. |
| ResultPanel.tsx | small | Per-row bulk-result display (succeeded/failed/results) | REUSE as shared component for bulk-action result displays. Move to shared location. |
| learnerSearchShared.ts | 40 | Shared types (SearchRow, PAGE_SIZE, formatAccountType, accountTypeBadgeVariant) | ABSORB into Members shared types; delete after migration. |
| JustificationModal.tsx | 174 | Impersonation justification + MFA challenge + observe/act mode picker | REUSE as-is for [Impersonate] button in drawer header. |

**Pattern duplication count:** Five copies of essentially the same search-table-pagination-dropdown pattern across Users.tsx, TraineesTab, AssignUnassignTab (trainee picker section), MentorRoleTab, and CompletionControlTab.LearnerPicker. Members surface collapses all five to one.

**Mentor-bulk-assign asymmetry, re-examined:**

Reading `renderTargetPicker()` in AssignUnassignTab lines 1168-1323 surfaces what mentor-assign actually does in practice:

1. Admin picks ONE mentor (from `mentorListQuery`, users with is_mentor=true)
2. Admin picks N trainees (via TraineeMultiSelect, the existing multi-select)
3. **Per-trainee certification resolution**: when admin picks mentor + trainees, the system auto-queries which cert(s) this mentor is qualified for AND which cert(s) the trainee has in_progress. The intersection becomes the eligible cert set per trainee.
4. If intersection is empty: warning "this trainee will be skipped"
5. If intersection is 1: auto-selected, displayed inline
6. If intersection is multiple: admin picks per-trainee from a dropdown
7. On submit: `assign_mentor_pairs_bulk(p_mentor_user_id, p_pairs jsonb, p_reason)` with array of (trainee_user_id, certification_id) pairs

The certification axis is what makes mentor-bulk-assign different from curriculum/module/cert-path bulk-assign. Trainees aren't just "being assigned a mentor"; they're being assigned a mentor for a specific cert program. Without certification scoping, the action is meaningless.

**Recommendation: KEEP mentor-bulk-assign in v1, with a custom modal.** The pattern is non-trivial but well-defined. Defer-to-v2 risks the Members surface looking comprehensive on the front but missing a real operational flow.

The custom modal for [Assign mentor] in the bulk-actions toolbar:
- Step 1: pick mentor from dropdown (mentorListQuery filtered to is_mentor=true)
- Step 2: per-trainee certification resolution renders inline (auto-resolves on mentor+trainees change)
- Step 3: justification reason (10-char min via JustifiedActionDialog)
- Step 4: confirm; calls assign_mentor_pairs_bulk

The other bulk-assign modals (cert path, curriculum, module) use a simpler pattern: target picker + due date + reason + confirm.


**Q3 mentor-bulk-assign locked: KEEP in v1** with custom modal (per-trainee certification resolution).
**Frontend cycle split locked: 2 cycles** (skeleton then polish).
**Backend next step locked: send full plan to Lovable for review** before any migrations.


---

## Phase 11 plan revisions after Lovable review

### Adopted (no adjustment)

1. **Cycle 1 stubs completion actions** instead of reusing CompletionConfirmDialog. Avoids two parallel code paths during cycle 1→2 gap.
2. **Drop migration 6 (noop_types_regen).** Types regen happens automatically after migrations 4-5.
3. **Use DROP FUNCTION ... RESTRICT (default)** for the search_impersonation_targets recreation. No CASCADE.
4. **Disable mentor-bulk-assign in cycle 1.** Toolbar [Assign mentor] shows "Coming soon" toast. Build mentor-bulk-assign modal as discrete piece in cycle 2b.
5. **Drawer-vs-full-page implementation rules**:
   - React Query key MUST be pure function of userId (no drawer-vs-page context in key)
   - Shared inner component MUST NOT assume scroll context
   - Active tab in URL as `?tab=learning` (already in Decision 7; emphasized for transition)
6. **ui_preferences jsonb column contract**: write-from-frontend, read-whole-blob-on-mount, never query into. Add column comment documenting this.
7. **Per-row overflow menu hover behavior**: `group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100` (desktop hover, touch always-visible). Updates Decision 9.
8. **Lazy-render dropdown menu contents**: action lists computed inside DropdownMenuContent render, not at row render.
9. **ContentItemArtifactPanel max-height fix**: `max-h-[60vh] overflow-y-auto` on the expanded panel + sticky internal header showing "Viewing: [name] [Collapse]". Updates Decision 10.
10. **Drawer responsive via shadcn Sheet native**: `className="w-full sm:max-w-[720px]"`. Updates Decision 6 implementation note.
11. **Saved views persist last-selected across sessions.** `default_view` field set to last-active. System default applies only when unset. Updates Decision 4.
12. **Last sign-in column renamed to "Last login"** to be honest about semantics (auth.users.last_sign_in_at doesn't update on JWT refresh). Frontend column label changes. No new infra. Updates Decision 3.
13. **Frontend bulk action chunking + progress UI** (UX improvement, not timeout fix). Frontend chunks 500-user selections into batches of 50-100, shows progress indicator, allows cancel. Backend bulk cap stays at 500 to match existing pattern.
14. **Legacy nav entries during cycle 1**: rename existing entries to "Legacy: Users" / "Legacy: Learning Admin" with deprecation banners on the pages themselves. Remove in cycle 2.
15. **React Query key stable serialization**: helper that JSON.stringify's after sorting keys for the 10+ filter-dimension queries.
16. **3-cycle frontend split**: cycle 1 (skeleton) → cycle 2a (JustifiedActionDialog + single-row actions) → cycle 2b (bulk modals + mentor-bulk-assign + audit polish). Plus 11.D for legacy delete + polish.

### Adopted with adjustment

17. **Bulk RPC timeout — Lovable's math was wrong (2min Supabase timeout, not 8s).** Backend cap stays at 500 (matches existing bulks). Frontend chunking + progress UI ships as UX polish, not as a timeout workaround. The 500-cap is verified safe for completion bulks given statement_timeout = 2min.

18. **super_admin_audit_log(affected_user_id) index — already exists** as `idx_super_admin_audit_log_affected_user_created (affected_user_id, created_at DESC) WHERE affected_user_id IS NOT NULL`. No new index migration needed.

19. **Filter chip + saved view interaction (Lovable flagged gap)**:
    - When saved view is active and user toggles a chip → **detach into unsaved state** (Linear pattern). Show "unsaved changes" indicator next to view name + Save / Discard buttons in saved-views dropdown.

20. **Column visibility + saved views interaction (Lovable flagged gap)**:
    - Column visibility is **PART of each saved view**, not a separate global preference. Each view stores its own column set. System default has a system default column set. Updates Decision 3 + 4 jsonb shape:
      ```json
      {
        "members": {
          "default_view": "active_learners",
          "saved_views": [
            {"id": "active_learners", "name": "Active learners", "filters": {...}, "sort": {...}, "columns": [...]},
            {"id": "compliance", "name": "Compliance", "filters": {...}, "sort": {...}, "columns": [...]}
          ]
        }
      }
      ```

21. **auth.users SELECT grant + last_sign_in_at semantics**:
    - Verify postgres role has SELECT on auth.users in Phase 11.B implementation (run test query, confirm before deploying RPC).
    - Rename frontend column to "Last login" (honest naming). Defer `users.last_active_at` infra to v2.

22. **UserDetailsModal coach section gate audit**: Phase 11.B implementation must read `grant_additional_free_attempts` RPC and verify the gate matches `is_practitioner_coach OR account_type='coach'`. If RPC strictly requires `account_type='coach'`, the Coach tab must show the cert list but disable grant-attempts for practitioner-coaches without account_type='coach'. Lock at implementation time.

### Final migration sequence (revised, 5 migrations)

1. `add_users_ui_preferences_column` — `ALTER TABLE public.users ADD COLUMN ui_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;` + column comment documenting the write-whole-read-whole contract.
2. `extend_search_impersonation_targets` — DROP RESTRICT then CREATE OR REPLACE with new columns + filter params + sort params.
3. `create_list_user_audit_history_rpc` — new SECDEF RPC.
4. `create_completion_bulk_rpcs` — three new SECDEF wrappers (set_content_item_completion_bulk, set_module_completion_bulk, set_curriculum_completion_bulk).
5. `add_completion_export_rpc` — new SECDEF `get_user_completion_export`.

### Final cycle plan

- **Phase 11.B** — 5 migrations (this session or next)
- **Phase 11.C cycle 1** — page + table + drawer skeleton + tab content with completion/bulk actions STUBBED
- **Phase 11.C cycle 2a** — JustifiedActionDialog + wire single-row actions (mentor toggle, cert grant/revoke, completion mark, grant attempts) through it
- **Phase 11.C cycle 2b** — bulk modals (assign / unassign / override completion / schedule / import) + mentor-bulk-assign custom modal + audit tab polish + bulk export CSV + chunking UX
- **Phase 11.D** — delete legacy surfaces, remove fallback nav/routes, brand tokens, a11y, mobile pass

**Total: ~5-6 sessions.**


---

## Phase 11 plan — FINAL LOCK after Lovable pass 2

All three pushbacks accepted. Three specs approved with refinements. Final risk identified.

### Category 1 — Pushbacks accepted

**Bulk cap 500 with cancel semantics:**
- Cancel button aborts frontend loop, does NOT attempt to roll back committed batches.
- Each chunk RPC commits independently.
- Post-cancel UI message: "Cancelled. {N} of {total} processed." Not "Cancelled. Nothing was changed."
- Implementation note for cycle 2b chunking UX.

**Audit log index verification:**
- Phase 11.B includes `EXPLAIN ANALYZE` on `list_user_audit_history(p_user_id=...)` with a representative super-admin's `affected_user_id` value.
- Verify planner picks `idx_super_admin_audit_log_affected_user_created` (the partial composite).
- Statistics-driven seq scan is the failure mode to catch in 11.B, not 11.C.

**"Last login" tooltip + v2 ticket:**
- Column header tooltip: "Last password sign-in. Does not reflect active sessions."
- Add explicit v2 build-queue ticket for `users.last_active_at` infrastructure (lightweight RPC on app load + column update). Not vague "deferred" — concrete ticket so it doesn't get re-discovered in six months.

### Category 2 — Spec refinements approved

**Spec 1 chip+saved view detachment refinements:**
- Indicator: **leading dot `●`** before view name, not italics. VS Code/Figma convention; italics reads as "system view," not "dirty."
- Discard on **3+ filters/columns changed**: confirm dialog "Discard {N} changes to '{view name}'?" with [Cancel] [Discard]. Single-chip discard is silent.
- View-switch while detached: **three-button** dialog. [Cancel] [Discard] [Save and switch]. Standard pattern.

**Spec 2 columns-in-view jsonb refinements:**
- **NO `system_default` field in stored jsonb.** Frontend constant. Stale-snapshot risk + "Reset to default" semantics + smaller blob.
- **ADD `"version": 1` to `members` object** for future schema migrations. Frontend detects payload version on read and migrates-in-place-on-write or falls back to defaults if drift detected.

Revised jsonb shape:
```json
{
  "members": {
    "version": 1,
    "default_view": "active_learners",
    "saved_views": [
      {
        "id": "active_learners",
        "name": "Active learners",
        "filters": { "status": "active" },
        "sort": { "column": "name", "direction": "asc" },
        "columns": ["name", "email", "account_type", "mentor", "organization", "active_assignments", "status", "last_login", "actions"]
      },
      {
        "id": "compliance",
        "name": "Compliance",
        "filters": { "status": ["active"], "has_active_assignments": true, "certification_statuses": ["in_progress", "revoked"] },
        "sort": { "column": "last_login", "direction": "asc" },
        "columns": ["name", "email", "account_type", "certifications", "active_assignments", "last_login", "actions"]
      }
    ]
  }
}
```

**Spec 3 coach gate audit — EXPANDED scope (4 checks, not 1):**
1. Read `grant_additional_free_attempts` RPC body (original plan)
2. Grep `supabase/migrations/` for `account_type.*coach|coach.*account_type` to find any other coach-gated RPCs
3. Inspect `coach_certifications` RLS policies — second-gate risk. If RLS strictly checks `account_type = 'coach'`, `is_practitioner_coach` users without that account_type cannot read their own cert rows, breaking the "show cert list for all practitioners" plan.
4. Grep frontend for `useCoachData` and similar hooks in current learning-admin and Users.tsx codebases for implicit gates.

If step 3 (RLS check) reveals the second gate, Coach tab visibility plan revisits: either widen RLS, or restrict Coach tab to strict `account_type='coach'` only.

### Category 3 — Risks adopted

**Cycle 2b escape hatch:**
- If 2b slips, **CSV export and audit polish move to 11.D**. They have no migration dependencies and are independent of the bulk-action core.
- Don't pre-split; identify the escape hatch in cycle 2b's kickoff.

**Legacy nav banner — link to specific equivalent location:**
- "Completion controls have moved to Members → {user} → Learning tab."
- "User search has moved to Members → search bar."
- "Mentor role management has moved to Members → {user} → header → Mentor toggle."
- The banner links to the appropriate target.

**Migration 2 transaction safety:**
- Confirmed: `apply_migration` in Supabase MCP wraps each migration SQL string in a single transaction.
- DROP RESTRICT + CREATE OR REPLACE in the same migration file = same transaction = zero-downtime gap.
- No change to migration plan; just confirming the safety.

### FINAL RISK to pre-decide before cycle 2a kickoff

**JustifiedActionDialog API design — caller-owns-mutation (Option B).**

Lovable's framing: dialog owns mutation (Option A) → 400-line switch with action-type discriminated union; caller owns mutation (Option B) → thin shell that handles justification field + validation + error mapping framework + success/dismiss, callers pass mutation function as prop.

Decision: **Option B.** The shared value is visual + UX + justification-field-handling consistency. The mutations themselves are genuinely diverse (different RPCs, different post-action invalidation keys, different error message maps). Forcing them into a shared union creates ugly internal switches without buying much.

API sketch:
```typescript
interface JustifiedActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  // Caller-owned mutation. Receives the justification string; returns the RPC result.
  // Throws on failure; dialog catches and renders error message via mapError.
  onSubmit: (reason: string) => Promise<{ changed: boolean; note?: string }>;
  // Optional caller-specific error mapping. Default maps common errors (reason_required_min_chars, authentication_required).
  mapError?: (rawMessage: string) => string;
  // Success and no-op toast titles. Caller-controlled.
  successTitle: string;
  noopTitle?: string;  // shown when result.changed === false
  // Optional confirm button label override.
  confirmLabel?: string;
}
```

The dialog handles: 10-char-min validation, submitting state, error display, redundant no-op handling (when result.changed=false), success toast.
The caller handles: RPC selection, payload construction, post-action React Query invalidation, post-success navigation/state cleanup.

Write a one-page spec document at start of cycle 2a kickoff. Don't decide by accretion.

### Plan locked. Ready for migrations.

**Confirmed plan:**
- **Phase 11.B** — 5 migrations + 4 verification tasks (auth.users SELECT, EXPLAIN ANALYZE on audit RPC, coach RPC body read, coach_certifications RLS inspection)
- **Phase 11.C cycle 1** — page + table + drawer skeleton + tab content with completion/bulk/role actions STUBBED. Legacy routes preserved with deprecation banners linking to specific equivalent locations.
- **Phase 11.C cycle 2a** — JustifiedActionDialog (caller-owns-mutation pattern) + wire single-row actions through it
- **Phase 11.C cycle 2b** — bulk modals + mentor-bulk-assign custom modal + audit tab filter chips & pagination + chunking UX (CSV export + audit polish are 11.D escape-hatch candidates if 2b overflows)
- **Phase 11.D** — delete legacy surfaces (after 2b parity verified), remove fallback nav/routes, brand color tokens, a11y pass, mobile pass, v2 build-queue entries for `last_active_at` and table-vs-jsonb migration

**Total: 5-6 sessions.**

