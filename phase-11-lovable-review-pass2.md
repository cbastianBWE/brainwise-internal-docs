# Phase 11 — Members surface: revised plan, second-pass review

**Still a review request, not a build request. Do NOT write code yet.** Confirm the revisions, surface any remaining risks, then we proceed to migrations.

---

## Context

You reviewed our Phase 11 plan in a previous message. Thank you for the substantive engagement — you caught real gaps (the dual-completion-path risk in cycle 1, the saved-view-vs-chip interaction, columns-vs-views ambiguity, the auth.users semantic issue). This document lays out what we adopted, what we adjusted, and three new specifications that came out of your gap-flagging. Then asks focused questions.

---

## What we adopted from your review (no changes to your recommendations)

1. **Cycle 1 stubs completion actions** instead of reusing `CompletionConfirmDialog`. The dual code path risk is real. Stub buttons render but trigger "available after next update" toast.
2. **Drop migration 6** (noop_types_regen). Types regen happens automatically after migrations 4-5.
3. **DROP FUNCTION ... RESTRICT** (default, no CASCADE) on the `search_impersonation_targets` recreation. Fail loud if anything depends on it.
4. **Disable mentor-bulk-assign in cycle 1.** Build it as a discrete piece in cycle 2b.
5. **Drawer-vs-full-page**: React Query key as pure function of `userId`. Shared inner makes no scroll assumptions. Tab state in URL `?tab=learning`.
6. **`ui_preferences` jsonb contract**: write-from-frontend, read-whole-blob-on-mount, never query into. Column comment documents this.
7. **Per-row overflow menu**: `group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100`. Hover on desktop, always-visible on touch. Action lists computed inside `DropdownMenuContent` render, not at row render (lazy mount).
8. **ContentItemArtifactPanel**: `max-h-[60vh] overflow-y-auto` + sticky internal header showing "Viewing: [name] [Collapse]". Inline expansion stays viable with this fix.
9. **Drawer responsive**: `className="w-full sm:max-w-[720px]"` — shadcn Sheet handles it natively, no manual breakpoint code.
10. **Saved views persist across sessions**. `default_view` field is set to last-selected. System default only when unset.
11. **Last sign-in column renamed to "Last login"** to be honest about `auth.users.last_sign_in_at` semantics (doesn't update on JWT refresh).
12. **Frontend bulk-action chunking with progress UI** for selections >50 users. Allow cancel mid-batch.
13. **Legacy nav entries during cycle 1**: rename to "Legacy: Users" / "Legacy: Learning Admin" with deprecation banners on the pages themselves. Removed in cycle 2b or 11.D.
14. **3-cycle frontend split** (not 2): cycle 1 (skeleton) → cycle 2a (`JustifiedActionDialog` + single-row actions) → cycle 2b (bulk modals + mentor-bulk-assign + audit polish). Plus 11.D cleanup.

---

## Three places we adjusted your recommendations (with reasoning)

### A. Bulk RPC timeout — we verified your math was wrong

You recommended lowering the bulk cap to 100 because 500 × ~80ms = 40s would exceed an 8s PostgREST cancellation.

We checked: `SHOW statement_timeout` on this Supabase project returns **2 minutes**, not 8 seconds. The existing `assign_curriculum_bulk`, `assign_module_bulk`, etc all have `c_max_bulk = 500` and have been working in production.

**Decision:** Keep backend cap at 500 (matches existing bulks for consistency). Frontend chunking + progress UI ships as UX improvement, not as a timeout workaround. The 50-100-per-batch chunks happen client-side for progress feedback, but the backend can handle a single 500-user call without timing out.

If you have evidence that's wrong (production runtime data, PostgREST-specific cancellation different from statement_timeout, etc), say so.

### B. `super_admin_audit_log(affected_user_id)` index — already exists

You flagged the audit tab `COUNT(*) OVER ()` cost without an index on `affected_user_id` would be a seq scan.

We checked. The index exists already as `idx_super_admin_audit_log_affected_user_created` — a composite btree on `(affected_user_id, created_at DESC)` with a partial WHERE for `affected_user_id IS NOT NULL`. This is the optimal index for our query pattern. No migration needed.

### C. `auth.users.last_sign_in_at` — we chose the rename, not the new infra

You correctly flagged that `last_sign_in_at` only updates on password sign-in, not JWT refresh, so "Last active 30 days ago" lies for users on long sessions. You suggested either (a) rename to "Last login" or (b) add `users.last_active_at` updated by lightweight RPC on app load.

**Decision:** (a) rename to "Last login" for v1. Honest semantics, no new infra. Last-active tracking is a separate piece of infra worth its own design pass; deferring to v2.

We will still verify in Phase 11.B implementation that the SECDEF function owner has SELECT on `auth.users` before assuming. If the postgres role doesn't have it, we'll either GRANT or fall back to a join via `public.users.last_sign_in_at` if we add that column.

---

## Three NEW specifications from your gap-flagging

These weren't in the original plan; you correctly identified them as ambiguous.

### Spec 1. Filter chip + saved view interaction

**When a saved view is active and the user toggles a chip:** detach into unsaved state (Linear pattern).

UI behavior:
- Saved-views dropdown shows the active view name with an "Edited" indicator next to it (small dot or italics).
- The dropdown also shows "Save changes" and "Discard changes" actions when in detached state.
- "Save changes" overwrites the saved view's snapshot. Confirms with "Overwrite '{view name}'?"
- "Discard changes" reverts filter/sort/column state to the last-saved version of that view.
- Switching to a different saved view while in detached state prompts: "You have unsaved changes to '{view name}'. Discard?" with [Cancel] [Discard and switch].

### Spec 2. Columns are part of each saved view

The jsonb shape:

```json
{
  "members": {
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

Each view is a complete state snapshot: filters + sort + visible columns. Toggling a column while a view is active triggers the same detached-state behavior as toggling a filter chip.

A "system default" view is hardcoded in frontend code (not stored in user prefs) and applied only when `default_view` is unset OR the user clicks "Reset to default."

### Spec 3. `UserDetailsModal` coach section gate audit (Phase 11.B implementation task)

During Phase 11.B implementation, before migrating the coach section into `MemberDrawerCoach`, we will read `grant_additional_free_attempts` RPC body and confirm:

- Whether it requires `account_type = 'coach'` strictly, OR
- Whether it works for any user with active `coach_certifications` rows (which `is_practitioner_coach OR account_type='coach'` should cover)

If the RPC strictly requires `account_type = 'coach'`, the Coach tab will:
- Show for `is_practitioner_coach OR account_type='coach'`
- Render the cert list and pool view for all
- Disable the "Grant attempts" form (with explanation) for users where `account_type != 'coach'`

This is a Phase 11.B verify-then-decide step, not a frontend design decision.

---

## Revised migration sequence (5 migrations, in order)

1. **`add_users_ui_preferences_column`**
   ```sql
   ALTER TABLE public.users
     ADD COLUMN ui_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
   COMMENT ON COLUMN public.users.ui_preferences IS
     'Per-user UI preferences (column visibility, saved views, default view selection). Write-from-frontend, read-whole-blob-on-mount. Do not query into this jsonb (no GIN, no jsonb_path_query in WHERE). If you need to query by preference value, migrate to a dedicated user_ui_preferences table first.';
   ```

2. **`extend_search_impersonation_targets`** — DROP RESTRICT the 3-arg version, recreate with:
   - 7 new returned columns: `is_mentor`, `active_assignment_count`, `certification_count`, `worst_certification_status`, `account_status`, `last_sign_in_at`, `show_coach_tab`
   - 10 new optional filter params (all default NULL): `p_account_types text[]`, `p_is_mentor boolean`, `p_account_status_in text[]`, `p_has_active_assignments boolean`, `p_organization_ids uuid[]`, `p_certification_statuses text[]`, `p_last_active_within interval`, `p_created_within interval`, `p_has_supervisor boolean`, `p_sort_column text` + `p_sort_direction text`
   - Existing 4 frontend callsites use only `{p_query, p_limit, p_offset}` — additive extension verified safe
   - SECDEF gating preserved (`assert_super_admin`)

3. **`create_list_user_audit_history_rpc`** — new SECDEF RPC with the signature documented in the original plan. Filters on `affected_user_id = p_user_id`. Joins to `users` for actor name with `COALESCE(actor_name, 'Unknown admin')`. Category computed via CASE on action_type. Existing index `idx_super_admin_audit_log_affected_user_created` covers it.

4. **`create_completion_bulk_rpcs`** — three SECDEF wrappers following `assign_curriculum_bulk` template (BEGIN/EXCEPTION/END per user, max 500, return `{operation, requested, succeeded, failed, results[]}`):
   - `set_content_item_completion_bulk`
   - `set_module_completion_bulk`
   - `set_curriculum_completion_bulk` (resolves user→assignment_id internally, per-user "no assignment" recorded as a failure)

5. **`add_completion_export_rpc`** — new SECDEF `get_user_completion_export(p_user_ids uuid[])` returning flat per-user-per-item rowset across all four tiers.

No migration 6. Types regen happens automatically.

---

## Revised cycle plan (4 phases)

- **Phase 11.B** — 5 migrations + verification queries after each + auth.users SELECT grant test + coach RPC gate audit
- **Phase 11.C cycle 1** — page + table + drawer skeleton + tab content with completion/bulk/role actions STUBBED. Legacy routes preserved with deprecation banners.
- **Phase 11.C cycle 2a** — `JustifiedActionDialog` shared component + wire mentor toggle, cert grant/revoke, completion mark, grant attempts through it
- **Phase 11.C cycle 2b** — bulk modals (assign / unassign / override completion / schedule / import) + mentor-bulk-assign custom modal + audit tab filter chips & pagination + bulk export CSV + chunking UX
- **Phase 11.D** — delete legacy surfaces, remove fallback nav/routes, brand color tokens for status pills, a11y pass, mobile pass

**Total: ~5-6 sessions.**

---

## Questions for this pass

Focused, three categories:

### Category 1 — Do you accept our three adjustments to your recommendations?

1. **Bulk cap stays at 500** (2min Supabase timeout verified). Frontend chunks 50-100 per batch for progress UX, not for timeout safety. Acceptable, or do you have other evidence we should lower the cap?

2. **No new audit-log index needed** (verified existing composite covers it). Confirm or push back if you see a different access pattern that needs another index.

3. **"Last login" rename instead of new `last_active_at` infra**. Acceptable for v1, or do you think the imprecision will cause real operational problems?

### Category 2 — Do the three new specs hold?

4. **Filter chip + saved view detachment** (Linear pattern with "Edited" indicator + Save/Discard). Anything to refine in the interaction model?

5. **Columns-as-part-of-saved-view** (the jsonb shape above). Anything broken in that shape? Specifically: do we need a `system_default` field that captures what the un-customized view looks like, or is that a hardcoded frontend constant?

6. **Coach tab gate audit task** scheduled for Phase 11.B. Is reading `grant_additional_free_attempts` body enough to settle the question, or do you anticipate other coach-only gates we'd miss?

### Category 3 — Anything else still wrong

7. **The revised cycle plan**: cycle 1 skeleton with stubbed actions → 2a JustifiedActionDialog rollout → 2b bulk modals. Now that you see the full sequence, any cycle that's still overstuffed?

8. **Legacy nav entries during cycle 1**: "Legacy: Users" / "Legacy: Learning Admin" with deprecation banners. Better than my original "remove from nav, route still live" — but is the deprecation banner approach right, or should we just hard-redirect immediately and accept the brittleness?

9. **The five-migration sequence**. Anything still in the wrong order or anything we'd want to split?

10. **Final risk you'd predict**. With the revised plan, where do you predict the implementation will hit something hard? Be specific.

---

## What we want back

- **Confirm or push back** on each adjustment in Category 1
- **Refine or approve** the three new specs in Category 2
- **Surface remaining risks** in Category 3
- **Do NOT write code yet.** After this pass, we lock and proceed to migrations.
