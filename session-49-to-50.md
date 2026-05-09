# BrainWise Session 49 to 50 Handoff

*Closeout: Session 49. Open: Session 50.*

## Where Session 49 left off

Session 49 shipped the Group A audit prequel and Group A Feature A1 (impersonation) Tier 1 backend complete. New schema additions to `super_admin_audit_log` and `company_admin_audit_log`, the action_types lookup table replacing the old CHECK constraint (Option C), the `log_super_admin_action` helper RPC with JWT-claim-aware actor derivation, the `impersonation_sessions` table with immutability and unique-active-per-admin enforcement, the `validate_impersonation_session` and `assert_impersonation_allows` RPCs with the full 9-category denylist mapped to scope 2.3.1-2.3.9, the `check_mfa_freshness` RPC, the `custom_access_token_hook` Postgres function (4 unit tests passing), and three new Edge Functions (`impersonation-start`, `impersonation-end`, `sweep_expired_impersonation_sessions`) plus the `*/5 * * * *` cron schedule. Sweep verified end-to-end against a pre-expired test session.

Session 49 also shipped the `_shared/impersonation_gate.ts` helper module deployed via the `test-impersonation-gate` test-only Edge Function to validate the bundling pattern. Full reconnaissance of all 52 deployed Edge Functions classified each one as gate-required or gate-not-required, with documented rationale for each non-gate function. 27 functions identified for Tier 2 rollout.

Cole registered the `custom_access_token_hook` in Dashboard → Authentication → Hooks. Edge Function secrets verified present (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) via probe.

## Session 50 opening priorities, in order

Plan A confirmed (Tier 2 backend → A3 Phase 2 backend → A1 impersonation frontend → access history page frontend), with all of Sessions 50-52 collapsed into Session 50 if pacing allows. Natural break points called out below.

### 1. Tier 2 backend rollout — denylist enforcement on 27 Edge Functions

For each of the 27 functions identified in the recon, splice in `enforceImpersonationGate(callerClient, "<category>")` from `_shared/impersonation_gate.ts` immediately after the JWT validation step (`auth.getClaims` succeeds) and before any mutation work. Catch `ImpersonationDeniedError` and return 403 with `{ error, code: "IMPERSONATION_DENIED", imp_session_id }`.

For functions whose category is **not** on the denylist (i.e., the gate returns `act_allowed`), the function MUST also call `logImpersonationAction()` after the mutation succeeds to record the impersonation_action audit row. Currently no such function exists in the 27 list — all 27 are on denylist categories that block in both observe AND act mode — but the helper supports it for future use.

For the hybrid-auth functions (generate-airsa-* with x-internal-secret pattern), only call the gate when `isInternal === false`. The pattern: `if (callerUserId !== null) { await enforceImpersonationGate(...); }`.

**The 27 functions, alphabetical, with category mapping:**

| # | Function | Category |
|---|---|---|
| 1 | ai-chat | outbound_user_communication |
| 2 | airsa-supervisor-invite | corporate_admin_action |
| 3 | airsa-supervisor-reminder | corporate_admin_action |
| 4 | assign_epn_send | corporate_admin_action |
| 5 | bulk-deactivate-and-notify | corporate_admin_action |
| 6 | bulk_coach_invite | coach_action |
| 7 | bulk_invitation_send | corporate_admin_action |
| 8 | calculate-scores | assessment_submission |
| 9 | coach_invitation_resend | coach_action |
| 10 | coach_invitation_revoke | coach_action |
| 11 | create-checkout | financial_transaction |
| 12 | customer-portal | financial_transaction |
| 13 | deactivate-and-notify | corporate_admin_action |
| 14 | delete-account | identity_change |
| 15 | generate-airsa-org-narrative | corporate_admin_action |
| 16 | generate-cross-instrument-recommendations | corporate_admin_action |
| 17 | generate-dashboard-narrative | corporate_admin_action |
| 18 | generate-departure-export | corporate_admin_action |
| 19 | generate-nai-delta-narrative | corporate_admin_action |
| 20 | generate-ptp-delta-narrative | corporate_admin_action |
| 21 | invitation_send | corporate_admin_action |
| 22 | peer-access-respond | privacy_consent |
| 23 | reactivate-account | lifecycle_action |
| 24 | send-departure-emails | corporate_admin_action |
| 25 | set-account-type | permission_change |
| 26 | submit-epn-assessment | assessment_submission |
| 27 | verify-conversion | lifecycle_action |

**Per-function deploy verification:** after each redeploy, probe with no-auth POST and confirm clean 401 (not 500). If 500, the splice broke something — roll back by redeploying the previous version (use `get_edge_function` with the prior version, redeploy). 

**Functions explicitly NOT gated (rationale documented for SOC 2 defensibility):**

- 8 per-user AI generation functions (generate-airsa-action-plan, -conversation-guide, -cross-instrument, -profile-overview, -top-priorities, -what-this-means, generate-facet-interpretations, generate-report) — function code enforces user_id == caller, regenerating user's own narrative is not a denylist concern
- 3 cron-triggered (dispatch-grace-reminders, sweep_expired_impersonation_sessions, sweep_expired_invitations) — Class C auth, no user JWT
- 2 webhook-triggered (resend-webhook, stripe-webhook) — Class B auth, no user JWT
- 2 read-only (check-subscription, validate-coach-invite)
- 3 internal helpers gated by callers (check-ai-usage, send-email, log-audit)
- 3 impersonation infrastructure (impersonation-start, impersonation-end, test-impersonation-gate)
- 3 public unauthenticated forms (submit-briefing-request, submit-contact-request, accept-coach-invitation)
- 1 admin utility (sync-stripe-prices)

**Estimated cost:** 27 deploys × ~5 minutes each = 2-3 hours of focused mechanical work. This may be a natural session break point.

### 2. A3 Phase 2 backend — audit reporting RPCs

Required for the user-facing access history page (launch blocker per scope 2.4.2). Four RPCs:

- `list_audit_events(p_filters jsonb, p_limit int, p_offset int)` — paginated, filterable by actor, target user, target org, action_type, date range, mode, free-text reason search. Returns from `super_admin_audit_log` joined with the action_types lookup for category/description metadata.
- `audit_event_detail(p_event_id uuid)` — full detail of a single event including before/after diff, IP, user agent, full reason text.
- `audit_session_replay(p_session_id uuid)` — returns ALL events tagged with same session_id in chronological order. For impersonation forensics. The `session_id` column already supports this from Session 49 work.
- `export_audit_events(p_filters jsonb)` — CSV export. Synchronous for small exports (<5000 rows); for larger exports, defer to background job pattern. Background-job version may slip to a follow-up session if pressed for time.

All RPCs are SECURITY DEFINER, gated on `current_user_account_type() = 'brainwise_super_admin'`. The user-scoped variant (for access history page filtered to user's own events) reuses these via RLS-friendly invocation patterns or via a separate set of RPCs filtered to `affected_user_id = auth.uid()`.

**Estimated cost:** half a session.

### 3. A1 impersonation frontend

Per scope 2.2.6-2.2.8:

- **Justification modal at impersonation start** — input min 10 chars, mode selector (observe/act), target user lookup
- **Fresh MFA challenge** — Supabase Auth `mfa.challenge()` + `mfa.verify()` flow before calling `impersonation-start`
- **Persistent orange banner** — full-width, top of viewport, Orange #F5741A, content: "Impersonating [user email] · [Observe|Act] mode · [time remaining] · [Exit] button". Persistent across navigation.
- **Browser tab title prefix** — "[IMPERSONATING] " before original page title
- **Favicon swap** — distinct version with red dot overlay
- **Viewport border** — 2px red border around entire viewport
- **Token swap** — frontend stores impersonation access_token + refresh_token from impersonation-start response, swaps Supabase auth client to use impersonation token
- **Exit flow** — Exit button calls impersonation-end, restores super admin session, clears all impersonation chrome

**Estimated cost:** focused session by itself, or a substantial chunk of one.

### 4. /settings/access-history page (launch blocker A1)

User-facing access history page per scope 2.4.2 / 4.4.4. Visible to all users. Shows every super admin access event affecting their account: timestamp, mode (observe/act), reason given, end reason. Read-only, paginated, exportable as CSV. Reads from A3 Phase 2 RPCs filtered to `affected_user_id = auth.uid()`.

Shown event types per scope:
- Impersonation sessions (start, end, mode, reason)
- Super admin direct edits to the user's record (Tier 1/2/3 — when A2 ships)
- Super admin views of the user's record (existing individual_record_viewed)
- Excluded: routine company admin actions on the user

**Estimated cost:** small frontend page; depends on A3 Phase 2 RPCs landing first.

### Session 50 break points

If the full plan doesn't fit:
- Break after Tier 2 if needed → A3 Phase 2 + frontend slip to Session 51
- Break after A3 Phase 2 if needed → frontend slips to Session 51

Group C Phase 1 starts in Session 51 if Session 50 absorbs everything; otherwise Session 52.

## Decisions locked in Session 49 (recap)

### Custom Access Token Hook over separate cookie

Chose Custom Access Token Hook with auth_method gate over separate cookie pattern after analysis of build cost, SOC 2 defensibility, compatibility with Session 49 helper RPCs, and long-term maintenance burden. Decision rationale documented inline in `custom_access_token_hook` function comments and in architecture-reference.md.

### Option C lookup table over CHECK constraint

Replaced `super_admin_audit_log_action_type_check` with FK to new `super_admin_action_types` lookup table. 19 action types seeded across 8 categories. Long-term: 40-60 action types expected over next 12 months. Lookup table provides typo protection (FK enforces existence) plus queryable SOC 2 inventory plus metadata (requires_mfa, requires_justification, denylist_during_impersonation) for future enforcement use.

### Actor derivation from JWT, not arguments

`log_super_admin_action` derives actor from JWT claims (`imp_actor_user_id` if present, else `auth.uid()`) rather than accepting actor as a passed argument. Prevents spoofing. Pre-A1: claim absent, falls back to `auth.uid()`. Post-A1: claim present (set by hook), correctly attributes to super admin during impersonation.

### Auth method gate on hook

The `custom_access_token_hook` only injects `imp_*` claims when `authentication_method` is `magiclink` or `token_refresh`. Prevents the target user's normal logins from accidentally inheriting impersonation context if they happen to log in during an active impersonation session.

### MFA freshness via mfa_amr_claims

The `check_mfa_freshness` RPC reads `auth.mfa_amr_claims` for the caller's session and verifies a TOTP verification within the last 300 seconds (5 min). Pattern B confirmed (Supabase Auth supports mid-session TOTP challenge via `auth.mfa.challenge()` + `auth.mfa.verify()`).

### Sweep cron at 5-minute intervals

`sweep_expired_impersonation_sessions` runs every 5 minutes (not the 15-minute stagger convention) because impersonation sessions are 30 minutes total — a 15-minute sweep would mean up to 15 minutes of post-expiry session lingering in the DB. Frontend client-side timeout enforces user-visible countdown; this cron is the server-side backstop.

### Edge Function verify_jwt convention preserved

All new Edge Functions deployed in Session 49 use `verify_jwt: false` with explicit `auth.getClaims` inside the function body. Matches existing convention. Build queue item: consider migration toward `verify_jwt: true` for SOC 2 hardening in a future hardening pass — defensible to auditor either way.

## Open questions / things to lock in Session 50

None blocking. Session 50 plan is fully scoped from Session 49 close. The only build-time decisions during Session 50:

- Specific MFA prompt UX (TOTP-only since that's the only enrolled factor; WebAuthn deferred until enrolled)
- Frontend state management for impersonation session (Zustand vs React Context vs query params) — scope notes both viable, decide at build time
- A3 Phase 2 export CSV: synchronous vs background job for >5000-row exports — pick at build time based on observed query performance

## What's NOT in scope for Session 50

- Group C work — Sessions 51+ (or 52 if Session 50 doesn't absorb everything)
- A2 (Direct user editing — Tier 1/2/3 fields) — Sessions 59+
- A3 Phase 3 super admin reporting UI — separate session
- A3 Phase 5 quarterly review runbook — operational, not blocking launch
- Privacy policy update — Cole owns, not blocking Session 50 backend work but blocking A1 launch
- Action-Oriented Voice Redesign — deferred until after cohort
- Org Overview Dashboard + AIRSA Cross-Instrument — deferred

## Bugs surfaced in Session 49 added to Build Queue

None. Session 49 added build queue items but no bugs (all migrations and Edge Functions deployed cleanly and passed verification).

## Architecture additions in Session 49

See architecture-reference.md v43, new sections 19-22:

- Section 19: `super_admin_action_types` lookup table and FK migration from CHECK
- Section 20: Audit log infrastructure additions (super_admin_audit_log + company_admin_audit_log new columns)
- Section 21: A1 impersonation Tier 1 backend (impersonation_sessions table, validate/assert RPCs, custom_access_token_hook, check_mfa_freshness, log_super_admin_action helper, three new Edge Functions, sweep cron)
- Section 22: `_shared/impersonation_gate.ts` helper module convention

## Edge Function inventory (post-Session 49)

Total deployed: 52
- Pre-Session 49: 48
- Added Session 49: 4 (impersonation-start, impersonation-end, sweep_expired_impersonation_sessions, test-impersonation-gate)

For Tier 2 rollout: 27 require gating, 25 explicitly do not (per recon classification).

The repo at `cbastianBWE/brainwise-blueprint/supabase/functions` only tracks ~10 of these. Build queue item: align Lovable repo with deployed reality (low priority — doesn't block any work).

## Test fixture state at end of Session 49

Test org: BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`).

Three corporate test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):
- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Coach test fixture: testcoach@gmail.com. Used for Group D and now Tier 2 testing once frontend ships.

Coach-client test fixtures created Session 48 still in place; see Session 47-48 handoff for state.

**Test rows in `super_admin_audit_log` from Session 49:** 4 marker rows tagged in `detail` field (`hook_test_*`), 1 sweep test marker row, 4 helper-RPC test rows. All immutable (cannot delete due to `block_audit_log_mutations` trigger). Filter audit reporting via `WHERE detail->>'test' IS NULL` to exclude in production reporting (build queue item: consider an `is_test` column on `super_admin_audit_log` for cleaner filtering).

**Test impersonation_sessions row from Session 49:** one row created during sweep verification, ended via cron-context audit insert. Has `justification = 'Sweep test: pre-expired session for verification'` and `end_reason = 'timeout'`. Useful as a real audit trail example for A3 Phase 2 query development.

## Operational steps Cole completed Session 49

- Registered `custom_access_token_hook` in Dashboard → Authentication → Hooks ✓
- Edge Function secrets verified (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY all present) ✓

## Operational steps still needed for A1 launch

- Privacy policy update with admin-access clause (scope 2.4.1, hard launch blocker)
- Quarterly review runbook documented (scope 2.4.3 / 4.4.5, due 90 days post-launch)
- Coordinate with auditor on A1 design before launch (scope section 6.2 known gaps)

## Documents this session leaves behind

Markdown files for upload to cbastianBWE/brainwise-internal-docs:

- build-queue.md (v41)
- architecture-reference.md (v43)
- session-49-to-50.md (this document)

Markdown source-of-truth at https://github.com/cbastianBWE/brainwise-internal-docs.

Per closeout workflow standing rules: Cole drag-uploads these markdown files to the GitHub repo via web UI at session close. GitHub MCP is read-only; no automated push.
