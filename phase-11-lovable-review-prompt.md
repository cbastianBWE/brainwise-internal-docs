# Phase 11 — Members surface consolidation: plan review request

**This is a review request, not a build request. Do NOT write code yet.** Read the plan, ask clarifying questions, surface risks, and confirm or adjust before any implementation.

---

## What we're doing and why

We're consolidating three existing super-admin surfaces into one new surface called **Members** at `/super-admin/members`.

The three surfaces being absorbed:
1. `/super-admin/learning-admin` — 2,038-line file with four tabs: Trainees, Assign/Unassign, Mentor Role, Completion Control
2. `/super-admin/users` — 278-line user-management page (impersonation search + user details modal)
3. The `UserDetailsModal` (313 lines) used by the Users page for identity + coach-only attempt grants

The structural problem with the current state: five copies of essentially the same search-table-pagination-dropdown pattern across Users.tsx, TraineesTab, AssignUnassignTab's trainee picker, MentorRoleTab, and CompletionControlTab. Plus the "Completion Control" flow re-renders the entire tab area into a tree view when you pick a learner, losing your search context.

The replacement model: a single Members page with a data table, filter chips, multi-select for bulk actions, and a side drawer that slides in when you click a row. The drawer contains tabs for Learning (the existing AdminLearningTree migrated), Assignments, Coach (conditional), and Audit.

This pattern is industry-standard (Linear, Notion, Absorb's refreshed admin, Docebo's April 2026 redesign). We did a competitor recon to confirm.

---

## Key design decisions (already locked with the product owner)

1. **Name**: Members. Route: `/super-admin/members` + `/super-admin/members/:userId` for the full-page drawer view.
2. **Layout**: Pure data table with filter chips. Scheduled assignments and Excel bulk import as modal triggers from toolbar buttons.
3. **Columns** (10 default): checkbox, Name, Email, Account type, Mentor, Organization, Active assignments, Certifications, Status, Last active, Actions overflow ⋮. Column show/hide control with per-user persistence. Default sort: Name ascending.
4. **Filters**: Hybrid — 4 chips always visible (Account type, Mentor, Status, Active assignments) + "More filters" overflow (Organization, Certifications, Last active range, Created date range, Has supervisor). Default filter: Status=Active. Saved views with per-user persistence.
5. **Search**: Email + name + org (current `search_impersonation_targets` scope unchanged). Typeahead 250ms debounce, min 2 chars. Composes with filters. **Match highlighting** in row cells.
6. **Row click**: Side drawer (720px desktop / full-width below 1024px) + "Open full view" escape hatch to `/super-admin/members/{uuid}`. Dismiss via X / Escape / click-outside, with unsaved-changes confirmation.
7. **Drawer organization**: Sticky header (identity + Mentor toggle + Impersonate CTA + ⋮ overflow) + tabs below: Learning (default), Assignments, Coach (conditional), Audit.
8. **Justified-action modal**: **NEW shared `JustifiedActionDialog`** component generalizes the existing `CompletionConfirmDialog` and absorbs all justified actions (mentor role change, cert grant/revoke, completion override, grant attempts, future actions). Fixes the silent no-op lie in current MentorRoleTab.
9. **Learning tab**: Preserve existing 4-tier tree (cert path → curriculum → module → content item), all-collapsed default, filter chips above the tree (status + within-tree search), per-row overflow menu for actions.
10. **Submission viewer (ContentItemArtifactPanel)**: Improved inline expansion — single-open enforcement, full tab-content width (not indented).
11. **Audit tab**: Compact timeline with click-to-expand diff. Filter chips above (Role / Completion / Certification / Permission / Impersonation / Other). Last 50 with Load more. New SECDEF RPC `list_user_audit_history`.
12. **Bulk actions**: Sticky toolbar above table when rows checked. v1 actions: Assign, Unassign, Schedule, Override completion, Export completion data CSV. **Mentor bulk-assign included** with custom modal for per-trainee certification resolution. Deferred to v2: bulk role change, bulk MFA reset, bulk password reset, bulk send message.
13. **Schedule modal**: Single modal with two tabs (Create new / Scheduled (N)). Pending list shows all statuses by default with status filter chip.
14. **Bulk Import modal**: Single-action modal, current download-template → fill → upload → result flow preserved.

---

## Backend deliverables (Phase 11.B)

### Migrations (in this order)

**1. `add_users_ui_preferences_column`**
```sql
ALTER TABLE public.users
  ADD COLUMN ui_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Decision rationale: simpler than a new `user_ui_preferences` table for one surface. If we reach 5+ admin surfaces with persisted prefs we'd refactor to a table; not yet.

Stored shape: `{"members": {"columns": [...], "saved_views": [...], "default_view": "..."}}`

**2. `extend_search_impersonation_targets`**

Drop and recreate the 3-arg version with additional returned columns and filter params. The existing 2-arg legacy version stays untouched.

New returned columns:
- `is_mentor boolean`
- `active_assignment_count integer`
- `certification_count integer`
- `worst_certification_status text` (priority: revoked > in_progress > certified)
- `account_status text` (canonical 'active' / 'departed_individual' / 'pseudonymized')
- `last_sign_in_at timestamptz` (from auth.users)
- `show_coach_tab boolean` (`is_practitioner_coach OR account_type='coach'`)

New optional filter params (all default NULL):
- `p_account_types text[]`
- `p_is_mentor boolean`
- `p_account_status_in text[]` (e.g. `['active']` or `['departed_individual', 'pseudonymized']`)
- `p_has_active_assignments boolean`
- `p_organization_ids uuid[]`
- `p_certification_statuses text[]`
- `p_last_active_within interval` (e.g. `'30 days'::interval`)
- `p_created_within interval`
- `p_has_supervisor boolean`
- `p_sort_column text` and `p_sort_direction text` for column sort

Confirmed safe: 4 frontend callsites all use `{ p_query, p_limit, p_offset }` and none of the new params; they'll all continue to work with the new defaults.

**3. `create_list_user_audit_history_rpc`**

```sql
CREATE OR REPLACE FUNCTION public.list_user_audit_history(
  p_user_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_categories text[] DEFAULT NULL  -- null/empty = no category filter
) RETURNS TABLE (
  audit_id uuid,
  created_at timestamptz,
  action_type text,
  category text,  -- computed: 'role' | 'completion' | 'certification' | 'permission' | 'impersonation' | 'other'
  actor_user_id uuid,
  actor_name text,
  actor_email text,
  actor_account_type text,
  reason text,
  before_value jsonb,
  after_value jsonb,
  total_count bigint
) ...
```

SECDEF, super_admin-gated via `assert_super_admin()`. Filters on `affected_user_id = p_user_id`. Joins `super_admin_audit_log` → `users` for actor name (falls back to 'Unknown admin' if user_id is null or missing). Category computed via CASE on action_type. No new action_types needed — categories map onto existing action_type values.

**4. `create_completion_bulk_rpcs`**

Three new SECDEF wrappers following the existing `assign_curriculum_bulk` template:

- `set_content_item_completion_bulk(p_user_ids uuid[], p_content_item_id uuid, p_complete boolean, p_reason text) RETURNS jsonb`
- `set_module_completion_bulk(p_user_ids uuid[], p_module_id uuid, p_complete boolean, p_reason text) RETURNS jsonb`
- `set_curriculum_completion_bulk(p_user_ids uuid[], p_curriculum_id uuid, p_complete boolean, p_reason text) RETURNS jsonb` — internally resolves each user's assignment_id for that curriculum, then calls the single-user `set_curriculum_completion(p_assignment_id, ...)`. Per-user "no assignment found" is recorded as a per-user failure.

Each loops the existing single-user RPC per user_id with BEGIN/EXCEPTION/END isolation. Returns `{operation, requested, succeeded, failed, results[]}`. Max 500 users per call.

Gating: the wrapper calls `assert_super_admin()` once at top. Impersonation gate is **inherited** via the single-user RPC's existing `assert_impersonation_allows('permission_change')` call. Do not double-gate.

**5. `add_completion_export_rpc`**

```sql
CREATE OR REPLACE FUNCTION public.get_user_completion_export(
  p_user_ids uuid[]
) RETURNS TABLE (
  user_id uuid,
  user_email text,
  user_full_name text,
  tier text,                -- 'cert_path' | 'curriculum' | 'module' | 'content_item'
  parent_path text,         -- "CertPath > Curriculum > Module" for content items, etc
  target_name text,
  status text,
  completed_at timestamptz,
  reason text               -- last admin-set reason if applicable
) ...
```

SECDEF, super_admin-gated. Returns one row per user-per-item across all four tiers. Frontend builds the CSV.

**6. `noop_types_regen`**

```sql
COMMENT ON SCHEMA public IS 'public';
```

To trigger Lovable's types.ts regeneration after the new RPCs land.

### Notes on what we do NOT need

- **No new action_type rows in `super_admin_action_types`.** The bulk wrappers call single-user RPCs that emit existing action types. The bulk operation does not get its own audit row.
- **No `cancel_scheduled_assignment` change.** We're dropping the reason requirement on cancel (it's reversible by re-scheduling); the existing no-reason RPC stays as-is.
- **No new `user_ui_preferences` table.** A jsonb column on `users` covers v1.
- **No `assert_impersonation_allows` extension.** The denylist categories are correctly inherited via wrapped single-user RPCs.

### Existing RPCs reused unchanged

- `assign_curriculum_bulk`, `assign_module_bulk`, `enroll_users_in_certification_path_bulk`, `assign_mentor_pairs_bulk`
- `unassign_curriculum_bulk`, `unassign_module_bulk`, `unassign_mentor_bulk` (note: take `p_assignment_ids[]`, not `p_user_ids[]` + target — frontend resolves user→assignment first)
- `create_scheduled_assignment`, `list_scheduled_assignments`, `cancel_scheduled_assignment`
- `set_content_item_completion`, `set_module_completion`, `set_curriculum_completion`
- `set_mentor_role`, `grant_certification`, `revoke_certification`, `grant_additional_free_attempts`
- `get_user_learning_state`, `get_content_item_for_viewer`, `get_quiz_attempt_results`, `get_thumbnail_urls_for_entities`
- `learning-admin-import` Edge Function
- `get_learning_import_reference`

---

## Frontend deliverables (Phase 11.C) — 2 cycles

### Cycle 1 — Page, table, drawer skeleton

**Scope:** Ship the new Members page with full table behavior + drawer shell + tab content using minimally-refactored existing dialogs. Verify the structural shape end-to-end before adding bulk-action complexity.

**New files:**
- `src/pages/super-admin/Members.tsx` — page shell, route handlers for `/super-admin/members` and `/super-admin/members/:userId`
- `src/components/members/MembersTable.tsx` — data table, columns, multi-select checkboxes, sort
- `src/components/members/MembersFilterBar.tsx` — chip row with always-visible 4 chips + More filters overflow + Saved views dropdown
- `src/components/members/MembersBulkActionsBar.tsx` — sticky toolbar (buttons render but action handlers are stubs in cycle 1)
- `src/components/members/MemberDrawer.tsx` — drawer shell with sticky header + tabs
- `src/components/members/MemberDrawerLearning.tsx` — Learning tab; migrates `AdminLearningTree` near-as-is. Uses existing `CompletionConfirmDialog` initially.
- `src/components/members/MemberDrawerCoach.tsx` — Coach tab; migrates `UserDetailsModal` coach section logic
- `src/components/members/MemberDrawerAssignments.tsx` — Assignments tab; reuses `SingleUserAssignDialog` patterns inline
- `src/components/members/MemberDrawerAudit.tsx` — Audit tab; loads `list_user_audit_history` and renders the timeline (no in-tab filter chips yet)
- `src/components/members/ColumnVisibilityMenu.tsx`
- `src/components/members/SavedViewsDropdown.tsx`
- `src/lib/highlightMatch.ts`

**Modified files:**
- `src/App.tsx` — add new routes
- `src/components/AppSidebar.tsx` — replace "User Management" and "Learning Admin" entries with single "Members" entry

**Out of scope (cycle 2):**
- `JustifiedActionDialog` unification
- Real wiring of bulk-actions toolbar buttons to RPC modals
- New Schedule modal (continues using LearningAdmin's existing form temporarily in cycle 1 via route preservation)
- New Bulk Import modal (same)
- Audit tab filter chips and pagination polish

**Safety net:** Cycle 1 keeps the old routes `/super-admin/users` and `/super-admin/learning-admin` live but removes them from nav. Old surfaces remain functional as fallback while new surface is verified. Cycle 2 deletes them.

### Cycle 2 — Polish, bulk-actions, modals

**New files:**
- `src/components/justified-action/JustifiedActionDialog.tsx` — shared generalized component
- `src/components/members/BulkAssignModal.tsx`
- `src/components/members/BulkUnassignModal.tsx`
- `src/components/members/BulkAssignMentorModal.tsx` — the custom per-trainee cert resolution modal
- `src/components/members/BulkOverrideCompletionModal.tsx`
- `src/components/members/ScheduleAssignmentModal.tsx` — two-tab Create/Pending
- `src/components/members/BulkImportModal.tsx`

**Refactor:**
- Mentor toggle in drawer header → JustifiedActionDialog (fixes the silent-no-op bug in current MentorRoleTab)
- Cert grant/revoke → JustifiedActionDialog
- Completion mark → JustifiedActionDialog (absorbs CompletionConfirmDialog)
- Grant attempts → JustifiedActionDialog
- Audit tab filter chips and Load more pagination
- Bulk Export Completion handler (CSV download from `get_user_completion_export`)

**Deletes (after migration verified):**
- `src/pages/super-admin/LearningAdmin.tsx` (2,038 lines)
- `src/pages/super-admin/Users.tsx` (278 lines)
- `src/components/super-admin/UserDetailsModal.tsx` (313 lines)
- `src/components/learning-admin/CompletionControlTab.tsx`
- `src/components/learning-admin/CompletionConfirmDialog.tsx`
- `src/components/learning-admin/AdminLearningTree.tsx` (after migration into MemberDrawerLearning)
- `src/components/learning-admin/TraineeMultiSelect.tsx`
- `src/components/learning-admin/learnerSearchShared.ts`
- Route entries for `/super-admin/users` and `/super-admin/learning-admin` (or convert to redirects)

**Reuses:**
- `src/components/learning-admin/ContentItemArtifactPanel.tsx` — moves into members directory; wrapper class change for full-width inline expansion
- `src/components/learning-admin/ResultPanel.tsx` — moves to shared location
- `src/components/impersonation/JustificationModal.tsx` — used as-is by the [Impersonate] button in drawer header

---

## Specific things we want Lovable's opinion on

This is the part where we want you to actually engage with the plan critically.

1. **The 2-cycle split.** Cycle 1 ships a skeleton with old-dialog reuse, cycle 2 swaps in JustifiedActionDialog and wires bulk actions. Is this the right split? Should we collapse to one cycle, or split further into three? Is there a sequencing risk where cycle 1's interim state introduces bugs we'd then have to undo in cycle 2?

2. **Backend migration order.** The 6 migrations above run in order. Is the dependency chain correct? Should the noop_types_regen (migration 6) happen earlier so cycle 1 can see the new RPC signatures? Is there a way to batch some of these to reduce ceremony?

3. **The mentor-bulk-assign custom modal.** The decision is to keep it in v1 because the per-trainee certification resolution is load-bearing for the action to make sense. Are we underestimating the modal's complexity? Should we ship cycle 1 with mentor-bulk-assign disabled (toast "coming in next update") and add it as part of cycle 2 to keep cycle 1 focused?

4. **The drawer-vs-full-page duplication.** We want the drawer at `?member={uuid}` AND a full-page view at `/super-admin/members/{uuid}` for "Open in full view." Plan: shared inner component, two outer wrappers. Concrete risks here — duplicate state, double-fetch, route mismatch?

5. **The `users.ui_preferences jsonb` column choice.** We picked the column over a `user_ui_preferences` table for simplicity. Is the jsonb-on-users approach going to bite us when we add more admin surfaces with their own prefs? Or is the migration to a table easy enough later that it's not worth doing now?

6. **The 4-tier per-row overflow menu in the Learning tab.** Decision 9 D3 said each tier (cert path / curriculum / module / content item) has its own overflow menu with tier-appropriate actions. Is this going to feel cluttered with one ⋮ button per row across hundreds of tree nodes? Should we conditionally show only when hovered, or accept the always-visible standard?

7. **The single-open inline expansion for ContentItemArtifactPanel.** We discussed sub-drawer vs inline, picked inline for simpler ship. Risk: long submissions (5,000-char written, 5-attempt quiz histories) push tree items off-screen. Is the scroll-with-it pattern actually acceptable, or should we revisit?

8. **The 720px desktop / full-width-below-1024px drawer behavior.** Reasonable choice or should we be doing something else for the 1024-1280px range? Are there shadcn primitives that handle this responsively without manual breakpoint code?

9. **Saved views per-user persistence.** Stored in `users.ui_preferences.members.saved_views[]` as `{name, filters, sort, columns}`. Should view selection survive across sessions (always reopens last view) or always default to system default ("Status=Active") on fresh page load?

10. **Anything we missed.** What are the structural risks in this plan that we didn't account for? Where do you predict we'll hit something hard?

---

## What we want back from Lovable

- **Confirm or adjust** each of the 10 questions above
- **Surface risks** we missed (architectural, performance, type, dependency)
- **Flag any RPC signature gotchas** in the proposed extension to `search_impersonation_targets` — particularly around `auth.users` access for `last_sign_in_at`
- **Recommend** the actual sequence of work: do you agree backend goes first (Phase 11.B), then cycle 1, then cycle 2, then polish (11.D)?
- **Do NOT write code yet.** This is a plan review.

After your review, we'll lock the final plan, then proceed to migrations.
