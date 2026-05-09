# BrainWise Session 52 to 53 Handoff

*Closeout: Session 52. Open: Session 53.*

## Where Session 52 left off

Phase B SHIPPED — six SECURITY DEFINER audit reporting RPCs deployed and verified end-to-end against the live audit log (367 production rows, 10 distinct action types, joins working, gates raising 42501 cleanly, UNION isolation correct on `my_access_history`). The audit reporting backend is now complete; A3 Phase 2 frontend (audit log viewer + session replay viewer) is unblocked but stays out of scope per Session 52 plan.

Phase C frontend recon COMPLETE. All four recon targets (super-admin landing, settings layout, app shell, MFA SDK shape) read against commit `a896b67…`. Six integration decisions locked, fully captured in architecture-reference.md §25. Phase C/D Lovable prompt sequencing locked at three scoped prompts.

Phase C and Phase D Lovable prompts NOT yet written. The plan was to write Phase C-1 in Session 52 if context allowed; instead the session focused on completing recon thoroughly and capturing the integration map so Session 53 can move directly to prompt construction without re-recon.

## Session 53 opening priorities, in order

### 1. Phase C-1 Lovable prompt construction (infrastructure)

**Pre-flight (15 min, before writing the prompt):**

- Read `impersonation-start` and `impersonation-end` Edge Function source (`get_edge_function` for both). Confirm response shape — specifically: do they return `{ access_token, refresh_token }` directly at the top level, or nested under a `session` key? Confirm what `impersonation-end` returns (original tokens? a status flag?). The Phase C-1 prompt depends on this exact shape.
- Audit the Tier 2 denylist: `SELECT action_type FROM super_admin_action_types WHERE denylist_during_impersonation = true ORDER BY action_type;` Confirm that any Edge Function called from `/demographic-form` (e.g. `submit-demographic-form` or similar) and from `/mfa-enrollment` (the verify call) is denylisted in act mode. If not denylisted, add a small backend task to the prompt to register them.

**Prompt scope:**

- `src/contexts/ImpersonationProvider.tsx` (new) — context reading JWT claims on auth state change, exposing `isImpersonating`, `session`, `beginImpersonation`, `endImpersonation`, `remainingSeconds`.
- `src/components/impersonation/ImpersonationBanner.tsx` (new) — orange `#F5741A` sticky-top banner with mode pill, target email, countdown, Exit button.
- `src/components/impersonation/ImpersonationChrome.tsx` (new) — render-only side effects: tab title prefix, favicon swap, four red 2px viewport-border divs.
- `src/components/MfaChallenge.tsx` (modify, additive) — add optional `onCancel?: () => void` prop. When provided, run instead of `signOut()`.
- `src/App.tsx` (modify) — wrap `<Routes>` in `<ImpersonationProvider>`; render `<ImpersonationBanner/>` inside provider, before `<Routes>`. Apply `body` padding-top via CSS variable when banner active.
- `public/brain-icon-impersonating.png` — new asset (red-dot variant of `brain-icon.png`). Generate or describe in prompt.

**Verification path:** ship dormant. Banner cannot appear because no `impersonation-start` call exists yet. Phase C-1 just stages the infrastructure; nothing user-visible changes.

Reference: architecture-reference.md §25.1-§25.3, §25.6-§25.9.

### 2. Phase C-2 Lovable prompt construction (entry + flow)

Only after Phase C-1 ships and is verified.

**Prompt scope:**

- `src/pages/super-admin/Users.tsx` (new) — universal user search page. Search input (debounced 250ms) → `search_impersonation_targets(query, 25)`. Table with Email, Full Name, Account Type, Organization, Actions columns. Action column: "Impersonate" button (opens JustificationModal); future actions (MFA reset, password reset, etc.) slot in here later.
- `src/components/impersonation/JustificationModal.tsx` (new) — two-step modal. Step 1: justification textarea (10 char min) + observe/act selector. Step 2: embedded `<MfaChallenge userId={...} onSuccess={...} onCancel={closeModal} />`. On MFA success: call `beginImpersonation(target.user_id, mode, justification)`. Loading state. On success: modal closes, navigate to `/dashboard`.
- `src/App.tsx` (modify) — register `/super-admin/users` route under `<RoleGuard allowedRoles={["brainwise_super_admin"]}>` like other super-admin routes. Replace `/super-admin` layout-only fallback (line 165) with `<Navigate to="/super-admin/users" replace />`.
- `src/hooks/useAuth.tsx` (modify, small) — change `redirectByRole` for `brainwise_super_admin` from `/super-admin/health` to `/super-admin/users`.
- `src/components/AppSidebar.tsx` (modify) — add `{ title: 'User Management', url: '/super-admin/users', icon: Users }` to top of `superAdminNav` array.

**Verification path:** end-to-end impersonation flow goes live. Test against test fixture: super admin from `/super-admin/users` → search "phildixon" → click Impersonate on `phildixon1@me.com` row → enter "Session 53 verification: full flow test" → select observe → MFA → start. Banner appears, countdown ticks, viewport border red. Click Exit → original session restored. Verify `super_admin_audit_log` rows for the session.

Reference: architecture-reference.md §25.4, §25.5, §25.10.

### 3. Phase D Lovable prompt construction (access history)

Independent of Phase C; can ship in parallel or after.

**Open decision to lock at prompt time:** CSV export approach for `my_access_history`. Two paths:

- **Path A**: Frontend assembles CSV from paginated `my_access_history` results. Cap at 1000 rows, show banner if user hits the cap. Zero backend work.
- **Path B**: Build a `my_access_history_export` RPC mirroring `export_audit_events` shape but scoped to the caller's own events. ~30 min backend work.

Recommendation: Path A (simpler, the user's own audit history is small). Reopen if a user complains about hitting 1000 rows.

**Prompt scope:**

- `src/pages/AccessHistory.tsx` (new) — page reading `my_access_history` RPC, paginated table, CSV export button (Path A). Read-only.
- `src/App.tsx` (modify) — register `/settings/access-history` as a sibling of `/settings/privacy` and `/settings/billing` (flat pattern, line 128-131).
- `src/components/AppSidebar.tsx` (modify) — add `{ title: 'Access History', url: '/settings/access-history', icon: History }` to BOTH `settingsSubItems` (line 137) and `coachSettingsSubItems` (line 143) arrays.

Reference: architecture-reference.md §25.11.

## Decisions locked in Session 52 (recap)

- `my_access_history` shape: UNION inside RPC (not a pre-unified view). audit_source discriminator column. Long-term cleanest path; no view RLS sync burden.
- `export_audit_events` cap behavior: return first 10,000 rows + `truncated: true` flag. SOC 2 CC7.2 friendly; investigators get the most recent slice when they hit the cap.
- `audit_session_replay` shape: single jsonb (`{session, events}`). Atomic gate, atomic session/event consistency, no risk of split-fetch staleness.
- `pg_trgm` extension enabled. Available for future user-search RPCs.
- Banner injection in App.tsx, NOT AppLayout. Persists on bypass-AppLayout protected routes.
- Impersonate entry: NEW `/super-admin/users` page (universal user search), NOT button on PlatformHealth or row action on CompanyAccounts.
- `MfaChallenge` modification: additive `onCancel` prop.
- `ProtectedRoute` does NOT bypass demographic/MFA/deactivation gates during impersonation. Tier 2 backend denylist is the security layer.
- Phase C/D sequencing: 3 scoped prompts (C-1 infra, C-2 entry+flow, D access-history).

## Open questions / things to lock in Session 53

- `impersonation-start`/`impersonation-end` exact response token shape (resolved at Phase C-1 pre-flight, not blocking).
- Tier 2 denylist coverage of `/demographic-form` and `/mfa-enrollment` mutation endpoints (resolved at Phase C-1 pre-flight; if missing, add backend task to prompt).
- Phase D CSV export path A vs B (resolved at Phase D prompt construction).
- `/super-admin/users` page scope: Impersonate-only first, OR include a stub menu for future actions (MFA reset, password reset, force pseudonymization)? Recommendation: Impersonate-only with a single dropdown menu placeholder so the row pattern is established for future expansion. Lock at Phase C-2 prompt time.

## Bugs surfaced in Session 52 added to Build Queue

None. Recon surfaced edge cases (demographic gate during impersonation, MfaChallenge signOut-on-cancel) but these are Phase C scope items, not bugs.

## What's NOT in scope for Session 53

- A3 Phase 2 frontend audit log viewer + session replay viewer (reads list_audit_events, audit_event_detail, audit_session_replay, export_audit_events). Backend is ready; frontend is its own significant build. Targets Session 54.
- A2 direct user editing surface. Out-of-scope for A1 launch.
- Group C Phase 1 (schema + 17 tables). Targets Session 54 or 55 depending on Phase C/D pacing.
- Action-Oriented Voice Redesign across NAI/PTP surfaces. Top deferred Build Queue priority but not Session 53.

## Architecture additions in Session 52

- Six new RPCs in `public` schema (architecture-reference.md §24): `list_audit_events`, `audit_event_detail`, `audit_session_replay`, `export_audit_events`, `my_access_history`, `search_impersonation_targets`.
- Four new indexes: `idx_super_admin_audit_log_affected_user_created`, `idx_super_admin_audit_log_actor_created`, `idx_users_email_trgm`, `idx_users_full_name_trgm`.
- `pg_trgm` extension installed.
- No new tables, no new columns, no new triggers.

## Test fixture state at end of Session 52

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

For Phase C integration testing (Session 53), additional fixtures useful:

- A super admin account (`cbastian@brainwiseenterprises.com` exists in production). For Phase C testing, use this account as the impersonator.
- A non-super-admin target with audit history. `testclientbwe+orgmember@gmail.com` has 30 super_admin + 2 company_admin audit events from prior sessions, ideal for replay-testing.
- A second super admin (`phildixon1@me.com`) exists, useful for testing impersonation between super admins (allowed; only self-impersonation is blocked by `no_self_impersonation` CHECK).

No fixture cleanup needed. Phase B verification did not write any test rows to production tables.

## Documents this session leaves behind

- build-queue.md (v44) — Session 52 deltas added; Phase B marked SHIPPED; Phase C-1, C-2, D status updated with recon-complete + Session 53 target; CSV export decision logged.
- architecture-reference.md (v46) — §24 added (A3 Phase 2 RPC catalog, filter schema, decision rationale, schema clarification, pg_trgm note, verification record). §25 added (Phase C frontend integration map, 12 subsections covering routing, banner injection, ImpersonationProvider, /super-admin/users, JustificationModal, MfaChallenge change, ImpersonationChrome, ImpersonationBanner, ProtectedRoute decision, token swap, Phase D integration, three-prompt sequencing).
- session-52-to-53.md (this document).

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs. Cole uploads manually via GitHub web UI at session close.
