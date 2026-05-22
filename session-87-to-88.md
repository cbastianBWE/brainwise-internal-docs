# Session 87 → Session 88 Handoff

**Session 87 close state:** Phase 11 design phase COMPLETE + Phase 11.B backend phase COMPLETE. Five migrations applied + verified. Coach gate audit performed (4 checks, all clean — Coach tab plan holds without modification). Plan locked end-to-end after two Lovable review passes with substantive adjustments adopted. **Session 88 opens on Phase 11.C cycle 1 — Members surface frontend skeleton.**

---

## What shipped in Session 87

### Phase 10 polish Round 4 — ABANDONED in favor of full Phase 11 consolidation

Session 87 opened with Round 4 audit of the learning-admin tooling. Cole's read after the audit landed: "this is clunky, not comprehensive enough." Round 4 audit findings (3 red, 11 yellow, 8 green) preserved at `/home/claude/round4-recon/` for use in **Phase 11.D polish pass** — they cover specific bugs (silent no-op on MentorRoleTab, missing impersonation guard, `as any` casts) that the new Members surface should pick up as it migrates the code.

Round 4 → Phase 11 pivot was the right call. The original four-tab `/super-admin/learning-admin` page is structurally five copies of the same search-table-pagination-dropdown pattern. Polishing that surface would have been re-skinning a duplicated structure. Consolidation into a single Members data table with side drawer collapses all five duplications.

### Phase 11 design phase

**14 design decisions locked.** Full decision log at `/home/claude/internal-docs/phase-11-learners-surface-decisions.md` (1262 lines).

**Surface name:** Members. **Route:** `/super-admin/members` + `/super-admin/members/:userId` (full-page drawer). Single sidebar entry replaces both "User Management" and "Learning Admin."

**Pattern:** Data table with filter chips + multi-select for bulk actions + side drawer on row click. Drawer has Learning / Assignments / Coach (conditional) / Audit tabs. Industry-standard pattern (Linear, Notion, Absorb, Docebo April 2026).

**Key design highlights:**
- 10 default columns: Name, Email, Account type, Mentor, Organization, Active assignments, Certifications, Status, **Last login** (renamed from "Last active" — auth.users.last_sign_in_at semantics are sign-in-only, not active-session)
- Hybrid filters: 4 always-visible chips + "More filters" overflow + saved views with per-user persistence
- `users.ui_preferences jsonb` column for per-user state (column visibility, saved views, default view) — write-from-frontend, read-whole-blob-on-mount, schema-versioned via `"version": 1`
- Side drawer 720px desktop / full-width below 1024px via shadcn Sheet native breakpoint
- Per-row overflow menu: `group-hover:opacity-100 md:opacity-0` (desktop hover, touch always-visible)
- Saved view detachment on chip toggle: Linear pattern with leading `●` indicator + 3-button switch dialog [Cancel] [Discard] [Save and switch]
- Columns are part of each saved view (not separate global preference); jsonb shape includes per-view columns array
- Bulk actions toolbar: assign, unassign, schedule, override completion, export completion CSV. **Mentor bulk-assign included** with custom per-trainee certification resolution modal (load-bearing for the operation to make sense)

### Phase 11.B backend — 5 migrations applied + verified

All five applied cleanly. JWT-context test pattern used for SECDEF RPC smoke tests. Final 7-of-7 PASS check confirmed all deliverables present.

**M1: `add_users_ui_preferences_column`**
- `users.ui_preferences jsonb NOT NULL DEFAULT '{}'::jsonb`
- Column comment documents write-from-frontend / read-whole-blob-on-mount contract
- Smoke test: round-trip write + read + restore succeeded

**M2: `extend_search_impersonation_targets`**
- DROP RESTRICT + CREATE on 3-arg version → new 14-arg signature
- 7 new returned columns: `is_mentor`, `active_assignment_count`, `certification_count`, `worst_certification_status`, `account_status`, `last_sign_in_at`, `show_coach_tab`
- 10 new optional filter params (all default NULL): `p_account_types`, `p_is_mentor`, `p_account_status_in`, `p_has_active_assignments`, `p_organization_ids`, `p_certification_statuses`, `p_last_active_within`, `p_created_within`, `p_has_supervisor`
- 2 new sort params: `p_sort_column`, `p_sort_direction`
- Existing 4 frontend callsites pass only 3 args; remain compatible
- `auth.users.last_sign_in_at` accessible via SECDEF (postgres role has SELECT on auth.users)
- `active_assignment_count` = sum of active curriculum + active module + active mentor-pairing (trainee side)
- `worst_certification_status` priority: revoked > in_progress > certified
- Smoke tests passed: real cbastian search returns 3 rows with all new columns populated; filter by is_mentor=true returns 3 mentors; composability (search + account_types + sort DESC) works

**M3: `create_list_user_audit_history_rpc`**
- New SECDEF RPC `list_user_audit_history(p_user_id, p_limit=50, p_offset=0, p_categories[]=NULL)`
- Returns audit row + computed category bucket (role / completion / certification / permission / impersonation / other) + actor name/email/account_type via `users` join with `'Unknown admin'` fallback for missing actors
- EXPLAIN ANALYZE on representative user confirmed planner picks `idx_super_admin_audit_log_affected_user_created` (existing partial composite — 0.051ms execution, no seq scan)
- Lovable's index concern resolved without new migration

**M4: `create_completion_bulk_rpcs`**
- Three SECDEF wrappers following `assign_curriculum_bulk` template
- `set_content_item_completion_bulk(p_user_ids[], p_content_item_id, p_complete, p_reason)`
- `set_module_completion_bulk(p_user_ids[], p_module_id, p_complete, p_reason)`
- `set_curriculum_completion_bulk(p_user_ids[], p_curriculum_id, p_complete, p_reason)` — resolves user → assignment_id internally (prefers active over completed, most recent), per-user "no_curriculum_assignment_for_user" recorded as failure
- Each wrapper: 500-user max, BEGIN/EXCEPTION/END isolation per user, returns `{operation, requested, succeeded, failed, results[]}`
- Impersonation gate inherited from wrapped single-user RPCs (no double-gating)
- Did NOT exercise as real bulk operations (would mark real content complete); signature + structural match to assign_curriculum_bulk verified

**M5: `add_completion_export_rpc`**
- New SECDEF `get_user_completion_export(p_user_ids uuid[])`
- Returns flat per-user-per-item rowset via UNION ALL across 4 tiers (cert_path from coach_certifications, curriculum from user_curriculum_assignments, module from user_module_assignments, content_item from content_item_completions)
- Columns: user_id, user_email, user_full_name, tier, target_id, target_name, parent_path (module breadcrumb for content_items), status, started_at, completed_at, assigned_at
- Max 500 users
- Frontend builds CSV from result
- Smoke test on cbastian (super admin) returned 2 cert_path rows + 1 curriculum row — expected shape

### Coach gate audit — 4 checks, all clean

Performed before M2 to ensure plan holds. Findings:

1. **`grant_additional_free_attempts` body**: gates on `assert_super_admin + assert_impersonation_allows('permission_change')` only. Does NOT require `account_type='coach'` on target. Cert row existence is sufficient.

2. **`coach_certifications` RLS**: three policies. service_role bypass. super_admin full access. `coaches read own (user_id = auth.uid())` — does NOT require `account_type='coach'`, so practitioner-coaches can read their own cert rows. RLS is moot for the drawer anyway since SECDEF bypasses RLS.

3. **Other coach-gated RPCs**: 33 functions reference both `account_type` and `coach` in body. Most are content-fetching with coach-context checks for permission, not gates affecting the Members Coach tab.

4. **`_sync_is_practitioner_coach_on_account_type` trigger**: auto-sets `is_practitioner_coach=true` when account_type becomes `coach` OR `brainwise_super_admin`. Confirms why all 10 coaches + 2 super_admins have `is_practitioner_coach=true`. The Coach tab visibility expression `is_practitioner_coach=true OR account_type='coach'` is equivalent to just `is_practitioner_coach=true` given the trigger — the defensive OR doesn't hurt.

**Plan holds without modification.** Coach tab shows for `is_practitioner_coach=true OR account_type='coach'`. Inside the tab, cert list shows for all; grant-attempts action enabled for all (RPC does not gate on account_type).

### Two Lovable review passes — both substantive

Pass 1 prompt at `/home/claude/internal-docs/phase-11-lovable-review-prompt.md` (274 lines). Pass 2 at `/home/claude/internal-docs/phase-11-lovable-review-pass2.md` (201 lines). Both also at `/mnt/user-data/outputs/` for Cole's GitHub upload.

**Pass 1 adoptions:** Cycle 1 stubs completion actions (avoids dual code path during cycle 1→2 gap). Drop noop_types_regen migration (types regen automatically). DROP RESTRICT not CASCADE on search function recreation. Disable mentor-bulk-assign in cycle 1, build in cycle 2b. Drawer-vs-full-page rules: React Query key as pure function of userId, no scroll context assumptions, tab in URL `?tab=learning`. ui_preferences jsonb contract documented. Per-row overflow menu hover behavior. ContentItemArtifactPanel max-height fix. Saved views persist last-selected. "Last login" rename + tooltip. Frontend chunking UX. Legacy nav entries renamed during cycle 1 ("Legacy: Users" / "Legacy: Learning Admin"). 3-cycle frontend split (1 → 2a → 2b).

**Pass 2 adoptions:** Chip+saved-view detach uses leading dot indicator + 3-button switch dialog + confirm on 3+ discards. NO system_default field in jsonb (frontend constant). ADD `"version": 1` field for schema versioning. Expanded coach audit to 4 checks (RPC body + migrations grep + RLS inspection + useCoachData hook check). Legacy nav banner links to specific equivalent location. JustifiedActionDialog API design — caller-owns-mutation pattern (Option B), not single-component-with-discriminated-union. Cycle 2b escape hatch: CSV export + audit polish can move to 11.D if cycle 2b slips.

**Three pushbacks Cole accepted with evidence:** Bulk RPC cap stays at 500 (Supabase project uses 2min statement_timeout, not Lovable's assumed 8s PostgREST cancellation). No new audit index needed (existing `idx_super_admin_audit_log_affected_user_created` partial composite covers the query). "Last login" rename instead of new `last_active_at` infra for v1 (Lovable accepted both as valid options; Cole picked the simpler one).

---

## What's locked for Session 88

### Phase 11.C cycle 1 — page + table + drawer skeleton

**Goal:** Ship Members page with full table + drawer shell + tab content using minimally-refactored existing dialogs. Completion + bulk + role actions STUBBED. Legacy routes preserved with deprecation banners.

**New files:**
- `src/pages/super-admin/Members.tsx` — page shell, route handlers for `/super-admin/members` and `/super-admin/members/:userId`
- `src/components/members/MembersTable.tsx` — data table, columns, multi-select checkboxes, sort
- `src/components/members/MembersFilterBar.tsx` — chip row with always-visible 4 chips + More filters overflow + Saved views dropdown
- `src/components/members/MembersBulkActionsBar.tsx` — sticky toolbar (buttons render but action handlers are stubs)
- `src/components/members/MemberDrawer.tsx` — drawer shell with sticky header + tabs
- `src/components/members/MemberDrawerLearning.tsx` — Learning tab; migrates `AdminLearningTree` near-as-is. Mark-complete actions STUBBED ("Available after next update") to avoid dual completion-confirm path
- `src/components/members/MemberDrawerCoach.tsx` — Coach tab; migrates `UserDetailsModal` coach section logic. Gate: `is_practitioner_coach=true OR account_type='coach'`
- `src/components/members/MemberDrawerAssignments.tsx` — Assignments tab; reuses `SingleUserAssignDialog` patterns inline
- `src/components/members/MemberDrawerAudit.tsx` — Audit tab; loads `list_user_audit_history` and renders timeline (no in-tab filter chips yet)
- `src/components/members/ColumnVisibilityMenu.tsx`
- `src/components/members/SavedViewsDropdown.tsx`
- `src/lib/highlightMatch.ts` — match highlighting helper for search

**Modified files:**
- `src/App.tsx` — add new routes
- `src/components/AppSidebar.tsx` — replace "User Management" and "Learning Admin" entries with single "Members" entry. Old entries renamed to "Legacy: Users" / "Legacy: Learning Admin" with deprecation banners on the pages themselves, linking to specific equivalents

**Out of scope cycle 1 (these are cycle 2a / 2b):**
- `JustifiedActionDialog` unification
- Real wiring of bulk-actions toolbar buttons to RPC modals
- New Schedule modal
- New Bulk Import modal
- Audit tab filter chips and pagination polish
- Mentor-bulk-assign custom modal

### Phase 11.C cycle 2a — JustifiedActionDialog + single-row actions

Write API spec one-pager BEFORE any code. Design: caller-owns-mutation pattern (Option B).

```typescript
interface JustifiedActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  onSubmit: (reason: string) => Promise<{ changed: boolean; note?: string }>;
  mapError?: (rawMessage: string) => string;
  successTitle: string;
  noopTitle?: string;
  confirmLabel?: string;
}
```

Dialog handles: 10-char-min validation, submitting state, error display, no-op handling (`changed: false`), success toast.
Caller handles: RPC selection, payload construction, React Query invalidation, post-success cleanup.

Wire single-row actions through it: mentor toggle (drawer header), cert grant/revoke (Coach tab), completion mark (Learning tab), grant attempts (Coach tab). Fixes silent no-op bug in current MentorRoleTab as a side effect.

### Phase 11.C cycle 2b — bulk modals + mentor bulk + audit polish

Bulk modals: `BulkAssignModal`, `BulkUnassignModal`, `BulkOverrideCompletionModal`. Mentor: `BulkAssignMentorModal` (custom per-trainee cert resolution). Modal: `ScheduleAssignmentModal` (two-tab Create + Pending). Modal: `BulkImportModal`. Audit tab: filter chips + Load more pagination. CSV export handler from `get_user_completion_export`. Frontend chunking UX for >50-user selections.

**Escape hatch:** CSV export and audit polish can move to 11.D if 2b overflows.

### Phase 11.D — cleanup + polish

Delete legacy files (LearningAdmin.tsx, Users.tsx, UserDetailsModal.tsx, CompletionControlTab, CompletionConfirmDialog, AdminLearningTree, TraineeMultiSelect, learnerSearchShared). Remove fallback nav/routes. Brand color tokens for status pills in migrated AdminLearningTree. a11y pass. Mobile responsiveness pass. File explicit v2 build-queue tickets for:
- `users.last_active_at` infrastructure (lightweight RPC on app load + column update)
- `user_ui_preferences` table migration (when 5+ admin surfaces have persisted prefs)
- Bulk role change (deferred from v1)
- Bulk MFA reset (deferred from v1)
- Bulk password reset (deferred from v1)
- Bulk send message (deferred from v1; prerequisite is messaging subsystem)

---

## Carryover from earlier sessions (unchanged this session)

- `results_available` notification type now ACTIVE since Session 86 (Phase 3 closed)
- AIRSA facet-interpretation generation gap investigation deferred (Session 84)
- `coach_messages` deferred pending messaging subsystem
- `platform_updates` deferred
- MFA trusted-device feature (Session 84 logged)
- Editor thumbnail-loss-on-republish hardening (Session 84 logged)
- Coach-paid invitation email verification (Session 82 carryover)
- `create-checkout` graceful-degradation hardening (~60-day comp coupon recurrence)
- AIRSA Phases 3e-8
- SOC 2 written policies
- Action-Oriented Voice Redesign across six surfaces
- Pricing-reads refactor
- Corporate contract renewal schema change
- Clarity Engine
- Session 71 anon EXECUTE audit on 95 SECDEF functions
- Post-launch `coach_clients_client_view` → SECDEF RPC refactor

---

## Standing rules to consider for v91 architecture-reference

**§121 candidate — Caller-owns-mutation pattern for shared action dialogs.** When a "shared" dialog component would otherwise require a discriminated union of action types (each with different RPC, payload, invalidation, error mapping), invert ownership: the dialog provides visual + UX + justification-field consistency; the caller passes the mutation function as a prop. Avoids ugly internal switches and ages better than a single-component-with-union pattern. Trade-off: callers carry slightly more responsibility for post-action cleanup, but the cleanup is genuinely caller-specific (different RPCs invalidate different query keys).

**§122 candidate — jsonb-on-row prefs vs table-of-prefs decision criterion.** For per-user preferences scoped to a single admin surface: column-on-users jsonb is fine. Migrate to dedicated `user_ui_preferences` table when 5+ surfaces have persisted prefs OR any query-into-preferences requirement emerges. Document the write-from-frontend, read-whole-blob-on-mount contract in column comment to prevent accidental GIN-indexing or jsonb_path_query in WHERE clauses. Include `"version": 1` field in stored jsonb for future schema evolution detection.

**§123 candidate — Bulk RPC cap vs frontend chunking discipline.** When wrapping single-user RPCs into bulk wrappers, cap matches the existing bulk pattern in the codebase for consistency (current: 500). Frontend chunking + progress UI ships independently as UX improvement, not as a backend timeout workaround. Chunks of 50-100 are pragmatic; cancel aborts the loop on frontend (each chunk RPC commits independently). Post-cancel UI must be honest: "Cancelled. {N} of {total} processed."

**§124 candidate — Saved view detachment pattern (Linear style).** When a UI surface has both saved views and inline filter controls, chip toggles detach the active view into an unsaved state rather than overwriting it. Indicator: leading `●` before view name (VS Code/Figma convention; italics reads as "system view," not "dirty"). Discard requires confirmation when 3+ changes detected. View-switch while detached uses three-button dialog [Cancel] [Discard] [Save and switch]. Standard pattern; do not invent variations.

Will pick the right subset for v91 in closeout. All four are candidates; some may be too specific to Phase 11 to warrant a §-number and instead become process notes.

---

## Open state at session close

**Backend:** all 5 migrations live and verified.

**Frontend:** untouched.

**Legacy surfaces:** still live at `/super-admin/users` and `/super-admin/learning-admin`. Cycle 1 will add deprecation banners; cycle 2b or 11.D will remove.

**Test fixture state:** no fixtures created this session. Coach gate audit was read-only.

**Edge Function versions:** unchanged from Session 86 close.

**Cole's Lovable usage:** none this session — all Lovable interaction was plan review (text exchange), no code generation. Lovable credit conservation discipline held.

**Next session opener:** draft Lovable prompt for Phase 11.C cycle 1. Reference `/home/claude/internal-docs/phase-11-learners-surface-decisions.md` as canonical source.
