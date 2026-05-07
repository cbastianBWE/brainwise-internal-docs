# BrainWise System Architecture Reference

*v32 - Session 38 closeout (Phase 3b shipped, production hot-fix, brand color update)*

## 1. Overview

This reference captures the canonical system architecture for the BrainWise platform as of Session 38 close. AIRSA dual-rater Phase 2 (backend workflow), Phase 3a (calculate-scores enhancement), and Phase 3b (self-rater post-submit experience) are shipped to production and verified. Phase 3c through 3e (frontend) and Phases 4 through 8 (PDF, dashboard, edge cases) are scoped in the Session Handoff and ready for execution.

A production hot-fix shipped in Session 38 unblocked corporate invitation redemption, which had been silently failing since 2026-04-09. PTP Pleasure brand color flipped from yellow to forest green across the entire codebase. NAI Saturation color alignment is queued (next Lovable prompt).

## 2. AIRSA dual-rater workflow - current state

### 2.1 State machine

AIRSA dual-rater is a paired-assessment workflow. A self-rater completes their AIRSA, which automatically creates a paired manager assessment row pointed at their supervisor. The supervisor takes the manager rating; once both legs complete, a combined results row is generated with self-manager divergence calculated.

Both legs of the pair use instrument_id = INST-003. The legs differ on rater_type (lowercase 'self' vs 'manager') and on which user_id is the rater versus the target_user_id.

Status flow per leg:

- Self leg: in_progress -> completed (created when user starts AIRSA, set to completed by calculate-scores when user submits)
- Manager leg: pending -> in_progress -> completed (pending set at row creation by trigger; in_progress when supervisor opens; completed when supervisor submits)

### 2.2 Database schema additions to assessments

- paired_assessment_id (uuid, FK to assessments.id, ON DELETE SET NULL) - reciprocal linkage between self and manager rows
- reminder_count (int, default 0) - tracks reminder emails sent by self-rater
- last_reminder_sent_at (timestamptz, nullable) - enforces 72-hour cooldown server-side
- self_only_released_at (timestamptz, nullable) - set when self-rater clicks Release self-only after 14d timeout
- status CHECK constraint extended to allow 'pending'

Indexes added: idx_assessments_paired_assessment_id (for fast pair lookup), idx_assessments_target_user_status (for the supervisor's pending-manager queries).

### 2.3 Database schema additions to assessment_results

- UNIQUE constraint added on assessment_results.assessment_id (name: assessment_results_assessment_id_unique). Required for ON CONFLICT upsert in calculate-scores combined-result merge.

manager_dimension_scores and self_manager_divergence columns already existed; they are now populated by Branch A of calculate-scores.

### 2.4 Schema convention warning - CRITICAL FOR PHASE 3c/3d

rater_type case sensitivity is split across the schema. items.rater_type uses CAPITAL-S 'Self' and CAPITAL-M 'Manager'. assessments.rater_type uses LOWERCASE 'self' and 'manager' (per the assessments_rater_type_check CHECK constraint). All Phase 2 backend code conforms to the assessments lowercase convention. Phase 3 frontend code that loads items for the supervisor's rating flow must use capital-M 'Manager' when querying the items table. Cross-table joins on rater_type WILL FAIL silently because of the case mismatch. Always normalize at the boundary.

### 2.5 Pair-creation trigger

Function: public.create_airsa_manager_pair_on_self_complete (SECURITY DEFINER, search_path = public)

Trigger: on_airsa_self_completed_create_pair, AFTER UPDATE on assessments, FOR EACH ROW

Logic, in order:

- Skip if not AIRSA, not self rater_type, not flipping to completed, or already completed (idempotent)
- Look up self-rater's supervisor_user_id; if null, skip pair creation (assessment proceeds solo)
- Validate supervisor: must be active and in same org as self-rater; otherwise skip
- Idempotency guard: skip if a paired manager row already exists for this self assessment
- INSERT manager assessment row: user_id = supervisor, target_user_id = self-rater, rater_type = 'manager', status = 'pending'
- UPDATE self assessment row to set its paired_assessment_id reciprocally
- Fire async pg_net.http_post to airsa-supervisor-invite Edge Function with the new manager_assessment_id, using INTERNAL_FUNCTION_SECRET from vault.decrypted_secrets

All exception paths use RAISE WARNING and RETURN NEW. The trigger never blocks the parent transaction.

### 2.6 RLS anchoring fix on assessments

The original 'assessments: managers read assessments they ordered' policy used target_user_id = auth.uid() OR ordered_by_coach_id = auth.uid(). For AIRSA, the self-rater IS the target_user_id on the manager row, which would have leaked manager assessment metadata to them.

New policy expression:

```
(instrument_id != 'INST-003' AND (target_user_id = auth.uid() OR ordered_by_coach_id = auth.uid()))
OR (instrument_id = 'INST-003' AND ordered_by_coach_id = auth.uid())
```

Effect: non-AIRSA behavior is preserved exactly. For AIRSA, the target_user_id read path is removed; supervisors read their manager assessment via 'users read their own' (user_id = auth.uid()). Self-rater never reads the manager row metadata.

To allow the self-rater to read minimal paired-manager metadata (status, reminder_count, last_reminder_sent_at) for the awaiting-state UI, the airsa_get_my_paired_manager_status RPC was added (see 2.8).

### 2.7 Combined-results gate RPC

public.airsa_can_generate_combined_result(p_self_assessment_id uuid)

Returns: out_can_generate, out_mode ('combined' | 'self_only' | 'blocked'), out_reason, plus context fields

Decision tree:

- Self assessment not found or not AIRSA Self rater_type -> blocked / not_*
- Self status != 'completed' -> blocked / self_not_completed
- paired_assessment_id IS NULL -> self_only / no_paired_manager_no_supervisor
- Paired manager status = 'completed' -> combined / both_rater_types_completed
- self_only_released_at IS NOT NULL -> self_only / self_only_released_after_timeout
- Otherwise -> blocked / awaiting_manager_completion

calculate-scores invokes this gate before deciding what to write to assessment_results.

### 2.8 RPCs (all SECURITY DEFINER, GRANT EXECUTE TO authenticated)

- airsa_can_generate_combined_result(uuid) - the gate (see 2.7)
- airsa_release_self_only(uuid) - self-rater triggers self-only release after 14 days. Idempotent, returns existing release timestamp if already released. Errors: 22023 if not yet 14 days, if manager has completed, if not AIRSA Self, if not the caller's own assessment. Errors: 42501 if not the self-rater.
- airsa_send_reminder(uuid) - self-rater triggers reminder email to supervisor. 72-hour server-side cooldown. Returns supervisor email payload for the frontend or Edge Function to forward to Resend. Increments reminder_count, sets last_reminder_sent_at.
- airsa_request_rerate(uuid) - 90-day cooldown. Marks any in-progress paired manager as 'abandoned', creates fresh self assessment in_progress, returns out_manager_in_progress_discarded boolean. Frontend must show confirmation dialog when this is true.
- my_pending_manager_assessments() - returns supervisor's own pending or in_progress manager assessments with paired self details. Used for the supervisor's pending cards on /assessment.
- my_direct_reports_with_pending_ratings() - returns all direct reports of caller plus their AIRSA cycle status. Used for the My Team page (Phase 3 will decide whether to add this surface or wait for v2).
- airsa_get_my_paired_manager_status(uuid) - NEW in Session 38. Self-rater calls this to read minimal paired-manager metadata for the awaiting-state UI on /my-results. Returns paired_assessment_id, paired_status, reminder_count, last_reminder_sent_at. Authorization: caller must equal user_id on the self assessment passed in. Closes the RLS gap created when the manager-side target_user_id read path was removed in 2.6.

### 2.9 Edge Functions

airsa-supervisor-invite v2 (Class B, INTERNAL_FUNCTION_SECRET gated)

- Triggered by: pg_net call from create_airsa_manager_pair_on_self_complete
- Input: { manager_assessment_id }
- Action: looks up supervisor + self-rater + org name, builds branded HTML email, forwards to send-email
- Returns: { success, sent_to, manager_assessment_id }
- v2 update (Session 38): rewrote the 'How this works' body to honest framing - removes language that overpromised what the supervisor would see and clarifies the reciprocal nature of the rating

airsa-supervisor-reminder v2 (Class A, JWT-required, self-rater authorization check)

- Triggered by: frontend after airsa_send_reminder RPC succeeds
- Input: { manager_assessment_id }
- Authorization: caller must equal target_user_id on the manager assessment (i.e. the self-rater)
- Returns 403 if caller is not the self-rater
- Returns 400 if manager already completed
- v2 update (Session 38): same body rewrite as airsa-supervisor-invite

Both functions deployed with verify_jwt: false (consistent with the rest of this codebase, which validates JWT inside function bodies via auth.getClaims).

### 2.10 calculate-scores - enhanced in Phase 3a (v40)

The function now contains three explicit branches:

Branch A: AIRSA Manager submission. Loads paired self assessment + responses; computes self dimension scores using the AIRSA mostCommonReadiness logic; computes manager dimension scores; computes self-manager divergence per dimension as { self_level, manager_level, delta, direction }; UPSERTS the assessment_results row keyed by SELF assessment_id (using the new UNIQUE constraint) with manager_dimension_scores and self_manager_divergence populated; flips manager assessment to completed; triggers generate-report fire-and-forget.

Branch B: AIRSA Self submission. Flips self to completed; calls the gate; if 'blocked', returns { mode: 'awaiting_manager' } with no results row written; if 'self_only', upserts results row with no manager fields, triggers generate-report. If 'combined' returns on a Self submission, defensively treated as self_only with a logged warning (this state should not occur because manager cannot complete before self).

Branch C: All non-AIRSA paths. Preserved byte-for-byte from the prior version. PTP, NAI, HSS, EPN scoring is unchanged.

Detection note: the function adds a correct AIRSA detection (isAirsaCorrect = instrument_id === 'INST-003') and uses it in the dimension-scoring conditional ALONGSIDE the legacy isAIRSA prefix-startsWith check. The legacy check is preserved (always false in practice) to avoid changing PTP/NAI/HSS code paths.

KNOWN BUG (Session 38): Branch B re-stamps completed_at on the self-only release path. This causes the 90-day re-take cooldown to anchor from the release date instead of the original self-completion date. Fix scoped to Phase 3e or earlier hot-fix. See Build Queue BUG-5.

## 3. Frontend - Phase 3b shipped (NEW IN v32)

### 3.1 /my-results AIRSA awaiting-state

When the gate returns 'blocked' (self completed, manager not yet completed, no self-only release), the AIRSA tile in the user's results list renders in awaiting state at 0.7 opacity. The main panel area shows an awaiting card explaining the workflow status.

State branches by elapsed time since self.completed_at:

- 0-13 days: awaiting card only, no action buttons. Body explains supervisor has been notified.
- 14-89 days: awaiting card + 'Send Reminder' button (if cooldown not active) + 'Release Self-Only Report' button. Reminder click hits airsa_send_reminder RPC, then airsa-supervisor-reminder Edge Function. Release click confirms then hits airsa_release_self_only RPC.
- 90+ days: awaiting card + Re-take button. Click triggers confirmation dialog warning that any in-progress manager rating will be discarded. Confirm hits airsa_request_rerate RPC.

Awaiting state polls airsa_get_my_paired_manager_status periodically with early-exit logic if status changes to completed mid-poll.

### 3.2 Self-rater frontend data path

The self-rater cannot read the manager assessment row directly (RLS blocks via the policy in 2.6). The awaiting-state UI gets its data exclusively through airsa_get_my_paired_manager_status RPC, which is SECURITY DEFINER and authorizes the caller as the self-rater on the passed self_assessment_id.

## 4. Production hot-fix: corporate invitation redemption (NEW IN v32)

### 4.1 Bug

A new user redeeming a corporate invitation hit a 22023 error: "User without organization cannot have a department".

### 4.2 Root cause

The enforce_immutable_user_fields trigger (BEFORE UPDATE on public.users) reads auth.uid() of the caller, looks up the caller's account_type and organization_id from public.users, and clobbers NEW.organization_id and NEW.account_type if the caller is a regular user (not super_admin or service_role).

For a fresh invitation redemption, auth.uid() is the new user themselves, who has not yet been assigned an organization_id. The trigger looks up its own row, finds account_type and organization_id both NULL, falls into the ELSE branch, and clobbers NEW.organization_id := OLD.organization_id (also NULL). Then enforce_user_department_same_org sees department_id non-null with organization_id NULL and raises 22023.

The trigger had existed since 2026-04-09. The invitation_redeem RPC was therefore broken for first-time corporate invitees from that date forward, with two anomalous successes on 2026-04-18 (logged in Build Queue for investigation; mechanism unknown).

### 4.3 Fix

Migration: fix_invitation_redeem_immutable_fields_bypass.

Pattern: GUC opt-out scoped to the invitation_redeem RPC only.

- Added: enforce_immutable_user_fields trigger now reads current_setting('app.bypass_user_immutable_check', true). If 't', the trigger short-circuits and returns NEW unchanged.
- Modified: invitation_redeem RPC body sets the GUC transaction-locally via set_config('app.bypass_user_immutable_check', 't', true) before its UPDATE on public.users.

Defense-in-depth: the existing 'users: update own safe fields' RLS policy with WITH CHECK clause prevents misuse of the GUC opt-out for unauthorized field changes. SOC 2 CC6.1 / CC6.3 / CC7.2 compliant.

Verified non-impact paths: individual signup, coach signup, coach client signup, corporate->individual conversion, supervisor reconciliation. None hit this code path.

Audit follow-up logged in Build Queue: enumerate other SECURITY DEFINER functions that UPDATE public.users to ensure no other path is silently affected by the immutable-fields trigger.

## 5. Brand color updates

### 5.1 PTP Pleasure (DIM-PTP-05): yellow #FFB703 -> forest green #2D6A4F

Locked decision and shipped via Lovable refactor in Session 38. Files updated: src/pages/MyResults.tsx, src/pages/company/PTPDashboard.tsx, src/pages/company/CompanyDashboard.tsx (three PTP color maps: PTP_DIM_COLORS, PTP_COLORS_LOCAL, PTP_COLORS_CO), src/lib/generateResultsPdf.ts, src/lib/generatePTPDashboardPdf.ts, src/lib/assemblePdfDataForUser.ts, src/components/results/PTPNarrativeSections.tsx, src/components/results/PTPFullFacetCharts.tsx, src/components/results/DrivingFacetScores.tsx.

Pastel/tint companion colors updated to green tints in same files.

The CSS token --bw-amber: #FFB703 in src/index.css and src/styles/marketing-tokens.css was NOT changed. It remains the brand palette yellow used by the --warning semantic token and other UI elements.

### 5.2 NAI Saturation (DIM-NAI-05): yellow #FFB703 -> mustard #7a5800 (PENDING)

Locked decision in Session 38. Shipping in Session 39 via Lovable. Aligns NAI individual report files (MyResults.tsx, NAINarrativeSections.tsx) with the dashboard color (CompanyDashboard.tsx, PTPDashboard.tsx) which were already at #7a5800.

Rationale: the dashboard color is almost certainly an accessibility-driven correction that didn't propagate to the individual report or the architecture brand-color spec. After this ships, #FFB703 will exist only as the --bw-amber brand token, no longer as a dimension color anywhere in the app.

### 5.3 Updated brand color lock

The complete dimension color map after both refactors complete:

PTP dimensions:

- Protection: #021F36 (navy)
- Participation: #006D77 (teal)
- Prediction: #6D6875 (slate gray)
- Purpose: #3C096C (plum/purple)
- Pleasure: #2D6A4F (forest green)  [updated v32]

NAI dimensions:

- Certainty: #021F36 (navy)
- Agency: #F5741A (orange)
- Fairness: #006D77 (teal)
- Ego Stability: #3C096C (plum/purple)
- Saturation: #7a5800 (mustard)  [pending v32 -> v33]

Instrument-level colors (unchanged): AIRSA forest #2D6A4F primary; HSS gray #6D6875.

## 6. Edit to existing surfaces (Session 37 carry-forward)

### 6.1 marketing-tokens.css

Two semantic alias tokens added in Session 37 after the existing --success/--warning/--info/--premium line:

```
--danger: var(--bw-orange-700); --danger-soft: var(--bw-orange-100);
```

The brand uses orange (not red) for danger states. App-side index.css does NOT mirror these aliases yet (see Build Queue: semantic-token reconciliation).

### 6.2 AdminUsers.tsx (admin user management page)

Phase 1 work added two banners above the Users tab Card showing supervisor health:

- 'X users have no supervisor assigned' - amber accent (var(--bw-amber)), cream background
- 'X users have a deactivated supervisor' - orange-700 accent (var(--bw-orange-700)), light orange background

Each banner has a Review button that filters the user table to that subset. Mutually exclusive filters. Filter indicator badge with clear-X inside the Card.

## 7. Three-tier Edge Function auth model (locked, recap)

Class A: JWT via auth.getClaims (user context, frontend-callable)

- Used by: airsa-supervisor-reminder v2, calculate-scores, invitation_send, etc.

Class B: X-Internal-Secret (or x-internal-secret header, value INTERNAL_FUNCTION_SECRET from Edge Function Secrets)

- Used by: airsa-supervisor-invite v2, send-email, generate-report
- Service-to-service authentication; never callable from browser

Class C: X-Dispatcher-Secret (departure_dispatcher_shared_secret)

- Used by: pg_cron entry points only
- Currently: dispatch_grace_reminders_daily, sync_stripe_prices_daily

## 8. Locked architectural constraints (unchanged this session, except as noted)

- Two sequential Anthropic Opus calls cannot be bundled in one Edge Function (Supabase 150-second timeout)
- auth.getClaims is the canonical JWT verification method; not getUser, not local decode
- After every apply_migration via MCP, run a separate execute_sql verification query
- Multi-statement execute_sql returns only the last statement's result; split intermediate checks
- Edge Function Secrets are not readable/writable via MCP; verify via dashboard or indirect pg_net wrong-secret HTTP tests
- get_edge_function returns full source and is reliable for pre-patch audits
- deploy_edge_function requires complete file content; always preserve verify_jwt: false explicitly
- Before generating values for an existing table, query pg_constraint for CHECK rules. Reading information_schema.columns is not sufficient.
- NEW (Session 38) GUC opt-out pattern for SECURITY DEFINER UPDATEs that legitimately need to bypass enforce_immutable_user_fields: app.bypass_user_immutable_check, set transaction-locally via set_config(name, value, true) inside the RPC body. The trigger reads current_setting(name, true) and short-circuits if 't'. Defense-in-depth via the users-update-own-safe-fields RLS WITH CHECK clause.

## 9. Test fixtures

Test org name: BrainWise Test Corp. Test user emails follow the testclientbwe+role@gmail.com pattern (orgmember, supervisor, employee). Specific UUIDs and the test password are NOT stored in this public repo. Look them up at session start by:

- Querying Supabase via MCP for users where email matches the testclientbwe+ pattern
- Reading the test password from Claude's userMemories block (always present)
- If neither is available, ask the user

The Phase 3b verification fixture is documented in the Session 38 to 39 handoff (test users, AIRSA assessment IDs, fixture state). When Phase 3c, 3d, or 3e begin in Session 39, look up the current state via Supabase rather than relying on the values written here at Session 38 close.

The .test TLD is no longer used by the canonical fixture (replaced by gmail+ aliases for real deliverable email during Session 38 Phase 3b verification).
