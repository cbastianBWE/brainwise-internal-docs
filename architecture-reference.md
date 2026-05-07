# BrainWise System Architecture Reference

*v33 - Session 39 closeout (Phase 3e backend shipped, AI section generators live)*

## 1. Overview

This reference captures the canonical system architecture for the BrainWise platform as of Session 39 close. AIRSA dual-rater Phase 2 (backend workflow), Phase 3a (calculate-scores enhancement), Phase 3b (self-rater post-submit experience), and Phase 3e backend (AI section generators) are shipped to production and verified. Phase 3c and 3d (manager-rating frontend) carry forward from Session 38; Phase 3e frontend (15-section combined report) is the next launch-blocking deliverable.

A production hot-fix shipped in Session 38 unblocked corporate invitation redemption. PTP Pleasure brand color flipped from yellow to forest green across the entire codebase. NAI Saturation color refactor (#FFB703 to mustard #7a5800) shipped in Session 39 via Lovable. The complete brand color map is below in Section 5.

## 2. AIRSA dual-rater workflow - current state

### 2.1 State machine

AIRSA dual-rater is a paired-assessment workflow. A self-rater completes their AIRSA, which automatically creates a paired manager assessment row pointed at their supervisor. The supervisor takes the manager rating; once both legs complete, a combined results row is generated with self-manager divergence calculated, and AI section generators fan out to populate facet_interpretations rows.

Both legs of the pair use instrument_id = INST-003. The legs differ on rater_type (lowercase 'self' vs 'manager') and on which user_id is the rater versus the target_user_id.

Status flow per leg:

- Self leg: in_progress -> completed
- Manager leg: pending -> in_progress -> completed

### 2.2 Database schema additions to assessments

- paired_assessment_id (uuid, FK to assessments.id, ON DELETE SET NULL) - reciprocal linkage between self and manager rows
- reminder_count (int, default 0) - tracks reminder emails sent by self-rater
- last_reminder_sent_at (timestamptz, nullable) - enforces 72-hour cooldown server-side
- self_only_released_at (timestamptz, nullable) - set when self-rater clicks Release self-only after 14d timeout
- status CHECK constraint extended to allow 'pending'

Indexes: idx_assessments_paired_assessment_id, idx_assessments_target_user_status.

### 2.3 Database schema additions to assessment_results

- UNIQUE constraint on assessment_results.assessment_id (name: assessment_results_assessment_id_unique). Required for ON CONFLICT upsert in calculate-scores combined-result merge.
- skill_level_breakdown JSONB column (NEW in v33). Populated by calculate-scores Branch A. Shape: keyed by item_number string; each value contains skill_number, skill_name, skill_description, dimension_id, domain_name, self_level, manager_level, self_response, manager_response, delta, direction, status. Partial index where instrument_id = 'INST-003'.

manager_dimension_scores and self_manager_divergence columns already existed; they are now populated by Branch A. self_manager_divergence per-dimension entries now include a `status` field (NEW in v33) with values aligned, confirmed_strength, confirmed_gap, blind_spot, underestimate.

NOTE: an `airsa_report_sections` JSONB column was briefly added and then dropped during Session 39 after a concurrency-design pivot. AI section content lives in facet_interpretations (Section 2.11), not on this table.

### 2.4 Schema convention warning

rater_type case sensitivity is split across the schema. items.rater_type uses CAPITAL-S 'Self' and CAPITAL-M 'Manager'. assessments.rater_type uses LOWERCASE 'self' and 'manager' (per the assessments_rater_type_check CHECK constraint). All Phase 2 backend code conforms to the assessments lowercase convention. Phase 3 frontend code that loads items for the supervisor's rating flow must use capital-M 'Manager' when querying the items table. Cross-table joins on rater_type WILL FAIL silently because of the case mismatch. Always normalize at the boundary.

### 2.5 Pair-creation trigger

Function: public.create_airsa_manager_pair_on_self_complete (SECURITY DEFINER, search_path = public).
Trigger: on_airsa_self_completed_create_pair, AFTER UPDATE on assessments, FOR EACH ROW.

Logic, in order:

- Skip if not AIRSA, not self rater_type, not flipping to completed, or already completed (idempotent)
- Look up self-rater's supervisor_user_id; if null, skip pair creation (assessment proceeds solo)
- Validate supervisor: must be active and in same org as self-rater; otherwise skip
- Idempotency guard: skip if a paired manager row already exists
- INSERT manager assessment row: user_id = supervisor, target_user_id = self-rater, rater_type = 'manager', status = 'pending'
- UPDATE self assessment row to set its paired_assessment_id reciprocally
- Fire async pg_net.http_post to airsa-supervisor-invite Edge Function

All exception paths use RAISE WARNING and RETURN NEW. The trigger never blocks the parent transaction.

### 2.6 RLS anchoring fix on assessments

The original 'assessments: managers read assessments they ordered' policy used target_user_id = auth.uid() OR ordered_by_coach_id = auth.uid(). For AIRSA, the self-rater IS the target_user_id on the manager row, which would have leaked manager assessment metadata to them.

New policy expression:

```
(instrument_id != 'INST-003' AND (target_user_id = auth.uid() OR ordered_by_coach_id = auth.uid()))
OR (instrument_id = 'INST-003' AND ordered_by_coach_id = auth.uid())
```

Effect: non-AIRSA behavior preserved. For AIRSA, the target_user_id read path is removed; supervisors read their manager assessment via 'users read their own' (user_id = auth.uid()). Self-rater never reads the manager row metadata.

### 2.7 Combined-results gate RPC

public.airsa_can_generate_combined_result(p_self_assessment_id uuid)

Returns: out_can_generate, out_mode ('combined' | 'self_only' | 'blocked'), out_reason, plus context fields.

Decision tree:

- Self assessment not found or not AIRSA Self rater_type -> blocked / not_*
- Self status != 'completed' -> blocked / self_not_completed
- paired_assessment_id IS NULL -> self_only / no_paired_manager_no_supervisor
- Paired manager status = 'completed' -> combined / both_rater_types_completed
- self_only_released_at IS NOT NULL -> self_only / self_only_released_after_timeout
- Otherwise -> blocked / awaiting_manager_completion

calculate-scores invokes this gate before deciding what to write to assessment_results.

### 2.8 RPCs (all SECURITY DEFINER, GRANT EXECUTE TO authenticated unless noted)

- airsa_can_generate_combined_result(uuid) - the gate (see 2.7)
- airsa_release_self_only(uuid) - 14-day timeout self-only release
- airsa_send_reminder(uuid) - reminder with 72-hour cooldown
- airsa_request_rerate(uuid) - 90-day cooldown re-take
- my_pending_manager_assessments() - supervisor's pending cards on /assessment
- my_direct_reports_with_pending_ratings() - direct reports + AIRSA cycle status
- airsa_get_my_paired_manager_status(uuid) - self-rater reads minimal paired-manager metadata for awaiting-state UI; closes the RLS gap from 2.6
- airsa_get_paired_self_rater_name(uuid) - manager-side minimum-disclosure RPC for paired-name read by corporate_employee role

### 2.9 Edge Functions (rater-flow)

airsa-supervisor-invite v2 (Class B, INTERNAL_FUNCTION_SECRET gated)

- Triggered by: pg_net call from create_airsa_manager_pair_on_self_complete
- Input: { manager_assessment_id }
- Action: builds branded HTML email, forwards to send-email

airsa-supervisor-reminder v2 (Class A, JWT-required)

- Triggered by: frontend after airsa_send_reminder RPC succeeds
- Input: { manager_assessment_id }
- Authorization: caller must equal target_user_id on the manager assessment

Both deployed with verify_jwt: false (consistent with codebase; validation happens inside function bodies via auth.getClaims).

### 2.10 calculate-scores - v42 (Phase 3e fan-out wired)

Three explicit branches:

Branch A: AIRSA Manager submission. Loads paired self assessment + responses; computes self dimension scores; computes manager dimension scores; computes self-manager divergence with status field; computes skill_level_breakdown by joining assessment_responses self+manager with airsa_skills with dimensions; UPSERTs the assessment_results row keyed by SELF assessment_id with manager_dimension_scores, self_manager_divergence, and skill_level_breakdown populated; flips manager assessment to completed; triggers generate-report fire-and-forget (legacy narrative path) and ALSO triggers all six AIRSA AI section generators in parallel via fire-and-forget (Phase 3e fan-out).

Branch B: AIRSA Self submission. Flips self to completed; calls the gate; if 'blocked' returns awaiting_manager with no results row written; if 'self_only', upserts results row with no manager fields and triggers generate-report.

Branch C: All non-AIRSA paths. Preserved byte-for-byte from prior versions.

Detection: `isAirsaCorrect = instrument_id === 'INST-003'` drives all AIRSA branching. Legacy isAIRSA prefix check preserved (always false in practice) to avoid changing PTP/NAI/HSS code paths.

KNOWN BUG: Branch B re-stamps completed_at on the self-only release path. See Build Queue BUG-5.

### 2.11 AI section generators (NEW in v33) - storage, auth, and orchestration

Six Edge Functions, one per section. Storage shared with existing PTP/NAI AI content via the facet_interpretations table.

Functions:

- generate-airsa-profile-overview v5 - section_type airsa_profile_overview, plain text, 800 max_tokens
- generate-airsa-what-this-means v3 - section_type airsa_what_this_means, JSON 4-key object, 2000 max_tokens
- generate-airsa-action-plan v3 - section_type airsa_action_plan, JSON 3-key object, 600 max_tokens
- generate-airsa-conversation-guide v3 - section_type airsa_conversation_guide, JSON 3-key object, 600 max_tokens
- generate-airsa-top-priorities v2 - section_type airsa_top_priorities, JSON array of 3 objects, 1500 max_tokens
- generate-airsa-cross-instrument v2 - section_type airsa_cross_instrument, plain text, 1200 max_tokens, conditional

Orchestration: calculate-scores Branch A fires all six in parallel via fire-and-forget HTTP POST with `x-internal-secret`. Each writes its own facet_interpretations row keyed by (assessment_result_id, section_type) UNIQUE. Frontend reads all rows in a single SELECT WHERE assessment_result_id = ? AND section_type LIKE 'airsa_%'.

Storage row shape (facet_data JSONB):

- For plain-text sections: { content: "<text>", ai_version, model }
- For JSON-object sections: { content: { ...keys }, ai_version, model }
- For array sections: { content: [...], ai_version, model }
- For cross-instrument with PTP/NAI present: { content, ai_version, model, has_ptp, has_nai }

Auth model (per function): hybrid Class A + Class B. Internal secret with constant-time `safeEqual` comparison for service-to-service calls (calculate-scores Branch A, pg_net tests). User JWT via auth.getClaims for frontend calls, with ownership check against assessment_results.user_id and AIRSA-only gate (instrument_id === 'INST-003').

Cache discipline: each function checks for an existing row first. Returns cached content with no AI call if present and force_regenerate flag is not set. Force regenerate path deletes the row before insert. Concurrent same-section calls handled via 23505 unique-violation catch: re-read and return cached.

Race-condition fix history: an earlier attempt used a JSONB merge column on assessment_results, which suffered last-write-wins overwrites under parallel fan-out. A SECURITY DEFINER atomic-merge RPC was tried as a fix, then dropped. The current per-row pattern in facet_interpretations is the canonical solution and matches PTP/NAI precedent.

Cross-instrument skip behavior: when the user has neither PTP (INST-001) nor NAI (INST-002) results, the function returns success with skipped=true and writes NO row. Frontend treats absence of the row as "show unlock CTA". This mirrors the existing facet_interpretations convention where missing rows render empty.

Output discipline (all six functions):

- Reference skills by NUMBER only ("Skill 7"), never by name. Frontend post-processor wraps "Skill N" mentions with hover-tooltip components reading from skill_level_breakdown.
- BANNED words in AI output: fascinating, valuable, interesting, exciting, striking, remarkable, dynamic, masking
- BANNED phrases: "this creates", "this suggests you", "may be masking", "valuable calibration"
- No em-dashes
- Domain names used in prose, never dimension IDs
- Model: claude-sonnet-4-20250514 across all six

Shared utilities (inlined per function deploy because Edge Functions deploy per-folder):

- _shared/secrets.ts: `safeEqual` constant-time comparison (SOC 2 CC6.1)
- _shared/errors.ts: `serverError` sanitized 5xx (SOC 2 CC7.2)

### 2.12 airsa_skills reference table (NEW in v33)

Static lookup table seeded from the canonical AI Readiness Skills Profile source document (24 skills across 8 domains).

Schema:

- item_number INTEGER PRIMARY KEY
- dimension_id TEXT NOT NULL FK -> dimensions.dimension_id (UNIQUE constraint required for FK)
- skill_name TEXT NOT NULL
- short_description TEXT NOT NULL
- full_definition TEXT NOT NULL
- theoretical_basis TEXT
- behavioral_indicators JSONB
- is_new_skill BOOLEAN NOT NULL DEFAULT false (true for skills 10, 17, 22)
- primary_p TEXT CHECK (Protection|Participation|Prediction|Purpose|Pleasure)
- secondary_ps JSONB
- created_at, updated_at with updated_at trigger

RLS: read-only authenticated. No writes from app code.

Distribution verified: 24 total rows, 3 with is_new_skill = true (10, 17, 22), domain coverage D1=3 D2=3 D3=4 D4=3 D5=4 D6=2 D7=2 D8=3, primary_p coverage Protection=5 Participation=5 Prediction=6 Purpose=3 Pleasure=5.

Used by: calculate-scores Branch A (joins to build skill_level_breakdown); the 6 AI section generators (read indirectly through skill_level_breakdown which already contains the denormalized skill metadata).

## 3. Frontend - Phase 3b shipped, Phase 3e frontend pending

### 3.1 /my-results AIRSA awaiting-state (shipped Session 38)

Awaiting state polls airsa_get_my_paired_manager_status periodically with early-exit when status changes to completed mid-poll. Time-based UI:

- 0-13 days: awaiting card only
- 14-89 days: awaiting card + Send Reminder + Release Self-Only
- 90+ days: awaiting card + Re-take confirmation dialog

### 3.2 Self-rater frontend data path (shipped Session 38)

The self-rater cannot read the manager assessment row directly (RLS blocks via 2.6). The awaiting-state UI gets data exclusively through airsa_get_my_paired_manager_status RPC.

### 3.3 Combined report frontend (PENDING - Session 40 launch-blocking)

15-section AirsaCombinedReport.tsx layout, full spec in Build Queue Phase 3e frontend section. Reads assessment_results.skill_level_breakdown plus all facet_interpretations rows where section_type LIKE 'airsa_%' in a single fetch on mount. Loading skeletons per section while AI fan-out is still completing.

## 4. Production hot-fix: corporate invitation redemption (carried from v32)

GUC opt-out pattern: `app.bypass_user_immutable_check`, set transaction-locally via set_config(name, value, true) inside the invitation_redeem RPC body. The enforce_immutable_user_fields trigger reads current_setting(name, true) and short-circuits if 't'. Defense-in-depth via the users-update-own-safe-fields RLS WITH CHECK clause. SOC 2 CC6.1 / CC6.3 / CC7.2 compliant.

Audit follow-up logged in Build Queue (BUG-7): enumerate other SECURITY DEFINER functions that UPDATE public.users.

## 5. Brand color complete map

### 5.1 Locked dimension color assignments

PTP dimensions:

- Protection: #021F36 (navy)
- Participation: #006D77 (teal)
- Prediction: #6D6875 (slate gray)
- Purpose: #3C096C (plum/purple)
- Pleasure: #2D6A4F (forest green)

NAI dimensions:

- Certainty: #021F36 (navy)
- Agency: #F5741A (orange)
- Fairness: #006D77 (teal)
- Ego Stability: #3C096C (plum/purple)
- Saturation: #7a5800 (mustard)

Instrument-level:

- AIRSA primary: #2D6A4F (forest green)
- HSS primary: #6D6875 (slate gray)

### 5.2 Brand tokens preserved

The CSS token --bw-amber: #FFB703 in src/index.css and src/styles/marketing-tokens.css is preserved. It remains the brand palette yellow used by the --warning semantic token and other UI elements. After the v33 Saturation refactor, #FFB703 no longer appears as a dimension color anywhere.

### 5.3 AIRSA combined report quadrant colors (NEW in v33)

For the developmental quadrant map in the Phase 3e frontend (no red/yellow/green allowed; brand-aligned):

- Underestimate: #006D77 (teal)
- Confirmed strength: #2D6A4F (green)
- Confirmed gap: #6D6875 (gray)
- Blind spot: #021F36 (navy)

Sand quadrant fills (#F9F7F1 base) with color tint.

## 6. Edits to existing surfaces

### 6.1 marketing-tokens.css

Two semantic alias tokens added in Session 37 after the existing --success/--warning/--info/--premium line:

```
--danger: var(--bw-orange-700); --danger-soft: var(--bw-orange-100);
```

The brand uses orange (not red) for danger states. App-side index.css does NOT mirror these aliases yet (see Build Queue: semantic-token reconciliation).

### 6.2 AdminUsers.tsx

Two banners above the Users tab Card showing supervisor health (no supervisor assigned, deactivated supervisor). Each has a Review button that filters the user table.

## 7. Three-tier Edge Function auth model

Class A: JWT via auth.getClaims (user context, frontend-callable)

- Used by: airsa-supervisor-reminder v2, calculate-scores, invitation_send

Class B: x-internal-secret header (value INTERNAL_FUNCTION_SECRET from Edge Function Secrets, validated with constant-time `safeEqual` comparison)

- Used by: airsa-supervisor-invite v2, send-email, generate-report
- The 6 AIRSA AI section generators support BOTH Class A and Class B (hybrid) on the same function

Class C: x-dispatcher-secret (departure_dispatcher_shared_secret)

- Used by: pg_cron entry points only
- Currently: dispatch_grace_reminders_daily, sync_stripe_prices_daily

## 8. Locked architectural constraints

- Two sequential Anthropic Opus calls cannot be bundled in one Edge Function (Supabase 150-second timeout). Phase 3e splits this into 6 separate functions with frontend parallel fan-out.
- auth.getClaims is the canonical JWT verification method; not getUser, not local decode
- After every apply_migration via MCP, run a separate execute_sql verification query
- Multi-statement execute_sql returns only the last statement's result; split intermediate checks
- Edge Function Secrets are not readable/writable via MCP; verify via dashboard or indirect pg_net wrong-secret HTTP tests
- get_edge_function returns full source and is reliable for pre-patch audits
- deploy_edge_function requires complete file content; always preserve verify_jwt: false explicitly
- Before generating values for an existing table, query pg_constraint for CHECK rules. Reading information_schema.columns is not sufficient.
- GUC opt-out pattern for SECURITY DEFINER UPDATEs that legitimately need to bypass enforce_immutable_user_fields: app.bypass_user_immutable_check, transaction-local
- NEW (Session 39): When multiple Edge Functions write per-section AI content, use the per-row pattern in facet_interpretations with UNIQUE (assessment_result_id, section_type) and 23505 race-recovery, NOT a JSONB merge on a shared column. The merge approach suffers last-write-wins under fan-out.
- NEW (Session 39): Constant-time secret comparison via `safeEqual` for `x-internal-secret` validation in Class B and hybrid auth, not direct string equality. Inlined per Edge Function via _shared/secrets.ts pattern.

## 9. Test fixtures

Test org name: BrainWise Test Corp.

Test user emails follow the testclientbwe+role@gmail.com pattern (orgmember, supervisor, employee). Specific UUIDs and the test password are NOT stored in this public repo. Look them up at session start by:

- Querying Supabase via MCP for users where email matches the testclientbwe+ pattern
- Reading the test password from Claude's userMemories block
- If neither is available, ask the user

Session 39 fixture state at close:

- Test users renamed to Maya Employee (the self-rater) and David Supervisor (the manager-rater) so first-name extraction is testable in AI output. Production code does not hardcode these names; they are pulled from users.full_name and split on first space.
- AIRSA self assessment, manager assessment, and combined assessment_result row exist for the fixture.
- All six facet_interpretations rows for sections airsa_profile_overview, airsa_what_this_means, airsa_action_plan, airsa_conversation_guide, and airsa_top_priorities are populated; airsa_cross_instrument is NOT (Maya has no PTP/NAI, so the function correctly skips and writes no row).

When Session 40 begins, look up the current state via Supabase rather than relying on values written here at Session 39 close.
