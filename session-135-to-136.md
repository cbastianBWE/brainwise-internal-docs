# BrainWise Session 135 to 136 Handoff

*Closeout: Session 135. Open: Session 136.*

## Where Session 135 left off

A live-platform bug-fix and feature-gating session. Two production bugs were fixed and verified, plus one latent same-class fix; the `dashboard_access` feature gate was wired onto the company dashboards and the interventions page on the frontend (the backend resolver already supported it); and the two corporate "shared" pages were combined behind a toggle while the Teams page was hidden. No schema changes; one config function (`has_required_demographics`) was hardened.

## What shipped (all verified unless noted)

### Bug 1 - new-org onboarding redirect loop (backend, verified)

New org admins and employees were trapped in an infinite redirect to `/demographic-form`. `has_required_demographics` required `users.department_id` and `org_level` for corporate roles, but those are invite/admin-assigned (not user-supplied) and are legitimately null for a brand-new org with no departments or an unassigned invite, so the gate was unsatisfiable and `ProtectedRoute` bounced the user forever. Migration `has_required_demographics_gate_user_fields_only` changed the gate to require only the three user-supplied demographic fields (`role_in_org`, `industry`, `years_experience`) for every non-exempt role; coach and super-admin stay exempt; the `onboarding_completed_at` short-circuit is preserved. Verified with a rolled-back DO block. Affected users only need a fresh page load (the gate is cached ~60s with refetch-on-mount/focus off).

### Bug 2 - assessment crash, React #310 (frontend, SHA-verified)

`AssessmentFlow.tsx` threw "rendered more hooks than during the previous render" because a `useEffect` sat after the early returns. This was a platform-wide assessment-take outage since the Session-127 "Next Unanswered" work, not specific to one user. Fix moved the `allAnswered` const and its effect above the early returns; no behavior change (the effect is a no-op until items load). SHA `e24766c4` -> `673a65dd`.

### Bug 3 - latent same-class hooks bug (frontend, SHA-verified)

`Onboarding.tsx` had the same pattern (effect plus a `<Navigate>` after a spinner return). Fixed by moving the effect above all returns with a guard. SHA `e7dc1b38` -> `3c0a9a2f`.

### dashboard_access gating (frontend, SHA-verified)

Backend needed no change: `user_has_feature(user,'dashboard_access')` is super-admin-true, else `org_has_feature` (`dashboard_access_level IS DISTINCT FROM 'none'`) then a per-user `member_feature_overrides` off-switch. The company analytics routes were RoleGuard-only, so turning dashboards off never hid them. `App.tsx` (SHA `1b8c008f`) now wraps `/company/nai-dashboard`, `/company/ptp-dashboard`, `/company/airsa-dashboard`, and `/dashboard/interventions` in `<SubscriptionGate feature="dashboard_access">` inside the existing RoleGuard. `AppSidebar.tsx` (SHA `9539dd2e`) added a `hasDashboardAccess` flag (from `user_has_feature`, keyed on user, default false) and ANDed it into the Dashboards-submenu and Interventions render conditions. The personal `/dashboard` is intentionally not gated (it is the denial redirect target). The sidebar reads the flag once on mount, so a turn-off needs a reload to drop the nav.

### Shared combine + Teams hide (frontend, shipped by Cole, visually confirmed; SHA-verify carryforward)

New `src/pages/SharedHub.tsx` is a toggle page: "Corp Shared Results" renders `<SharedResults>` (org-peer, `get_accessible_peer_results`) and "Generally Shared" renders `<SharedWithMe>` (directed PTP shares, `list_ptp_shared_with_me`), at `/shared`. The corporate and admin navs now point one "Shared" entry at `/shared`; individual, coach, and super-admin navs are unchanged (single "Shared With Me"). Legacy `/shared-results` and `/shared-with-me` routes are retained. Teams is hidden: the admin nav Teams entry was removed, `/admin/teams` now redirects to `/dashboard`, and the `AdminTeams` import was removed (the page file stays for the future build).

## Session 136 opening priorities, in order

### 1. (Cole-requested) Start the SCORM export + external API set-up work

Backlog items 6 (SCORM export) and 7 (lesson-block tracking / external API). The single authorization checkpoint for lesson assets is the RPC-gated signing seam (`get_lesson_block_assets_for_trainee` -> service-role signed URLs); SCORM/export must go through that seam and must never touch `supabase.storage` directly. Org-id attribution stamping for stable seat/attempt accounting was deferred into these items by design (stamp at launch/attempt write-time; do not mass-retrofit the learning tables).

### 2. SHA-verify the Shared/Teams ship

Confirm `SharedHub.tsx` exists and is correct, `App.tsx` has the `/shared` route plus the `/admin/teams` redirect with no `AdminTeams` import, and `AppSidebar.tsx` shows a single "Shared" entry in both the corporate and admin navs with Teams gone. (Cole confirmed the combined tabs render; the SHA check just wasn't run before close.)

### 3. Carryforward UX prompt from Session 134 (still not run)

`AdminUsers.tsx`: gate the "Executive Perspective NAI" tab on `useOrgInstrumentAccess().orgInstrumentIncluded(DASHBOARD_INSTRUMENT_UUIDS.NAI)`, and collapse the per-row Users-tab action buttons into a kebab `DropdownMenu`. Plus SHA-verify `PublicInvoicePay.tsx`, `OperationsSettings.tsx`, `CompanyMembersSection.tsx`, `AdminUsers.tsx`.

## New build-queue item added this session

**BQ-SUPERVISOR-DASH.** Supervisors should see the actual company dashboards (NAI/PTP/AIRSA), with the per-supervisor disable driven from the Members section of the org page (turns it off for all supervisors, leaves org_admin/company_admin on). Today the Dashboards submenu and Interventions render only for `company_admin`/`org_admin`/super-admin and the routes' RoleGuard excludes `corporate_employee`, so supervisors do not see them at all and the per-user `dashboard_access` override has nothing supervisor-visible to hide. Work: (a) extend company-dashboard nav and route visibility to supervisor `corporate_employees` (define supervisor = `corporate_employee` with at least one direct report, via a hook/RPC); (b) keep the `dashboard_access` gate so a per-supervisor `member_feature_overrides('dashboard_access', enabled=false)` hides it for that supervisor while admins stay on; (c) build the per-supervisor toggle in the Members section writing `member_feature_overrides` (the backend resolver already supports per-user `dashboard_access`).

## Operator note (durable, not a code bug)

The "Dashboard Access" control on the super-admin Contract & Features tab only persists `dashboard_access_level_override` when its "Override tier default" switch is ON. With the switch off it sends null, and `contract_upsert` overwrites the column on every save, so the org falls back to its tier default (basic = dashboards on). To disable org-wide: switch ON, dropdown "None", Save. A single unambiguous "Dashboards on/off" toggle would remove this trap; optional, not queued unless Cole wants it.

## Test fixture state at end of Session 135

Test org: BrainWise Test Corp (dashboards on, `basic`, by design). A separate org-admin-2 test org had its `dashboard_access_level_override` set to `none` directly during this session to exercise the gate; it will revert to null if its contract is re-saved with the Dashboard Access override switch off. Test users follow the `testclientbwe+...@gmail.com` pattern (look up current UUIDs via Supabase MCP; password is in Claude's userMemories).

## What is NOT in scope for Session 136 unless raised

- CRM/OPERATIONS route gating and the broader customer-access/externalization arc.
- Module subscription billing wiring; per-tenant Stripe Connect.
- Per-org custom From-domain and the `/pay/:token` public header literal.

## Documents this session leaves behind

- build-queue.md (v143)
- architecture-reference.md (v137)
- session-135-to-136.md (this document)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs. No .docx generation (Session-74 decision).
