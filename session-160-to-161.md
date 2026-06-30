# BrainWise Session 160 to 161 Handoff

*Closeout: Session 160. Open: Session 161.*

## Where Session 160 left off

The PTP paired-context inclusion arc shipped end to end and is verified live on a real pair. Personal and romantic paired reports now compute against a new `personal_plus` item_set that pulls the 42 personal facets PLUS the 26 professional items flagged for romantic inclusion, and the Purpose + Pleasure personal facets that were never routed now surface. Work paired stays professional-only. The four agenda items (E2, D2, F1, G1) were deferred to Session 161 by Cole. Build Queue bumped v161 to v162; Architecture Reference v160 to v161.

## Shipped this session (all verified on production)

- **Item-level include flags** - New `items.include_in_romantic` (boolean) + `items.romantic_include_reason` (text), populated for all 47 professional items from a parsed Word source (`PTP_Questions_copy_2.docx`): 26 YES, 21 NO (most NO reasons = "covered by question N", the personal twin already in personal_42). The flag is the only thing logic reads; the reason is documentation. Personal items 48-89 untouched. Migration `add_items_include_in_romantic_flag_and_reason`, verified.
- **personal_plus item_set** - `public.ptp_profile_facet_rows(p_user_ids uuid[], p_item_set text)` (CREATE OR REPLACE, same signature) gained a `WHEN 'personal_plus'` branch = `context_type='personal' OR (context_type='professional' AND coalesce(include_in_romantic,false))`, plus a SELECT-level facet-name suffix strip (trailing `(personal)` or `(professional)`) applied ONLY for personal_plus. Other item_sets are byte-unchanged. The RPC is the single home of the strip; the interpreter/aggregate libs are mode-agnostic and were not touched. Migration `ptp_profile_facet_rows_add_personal_plus_branch`, verified by a live call (84 personal + 52 professional rows for the test pair, 0 suffixes).
- **Routing** - `routes=true` + `resource_logic` turned on for 12 personal reward facets (Pleasure 84-89, Purpose 75/77/79/80/81/83), 6 professional facets (1,9,17,20,24,47), and item 3 set to Complementary. After this, all 26 YES professional items route with real (non-Neutral) logic. Migrations `ptp_route_pleasure_purpose_personal_facets`, `ptp_route_professional_six_relational`, `ptp_item3_financial_security_complementary`, each verified.
- **generate-paired-profile v3** - Cole-deployed, function version 12. One functional change: the mode-to-item_set map went from `work?professional_47:personal_42` to `work?professional_47:personal_plus`, so personal AND romantic compute against personal_plus; work unchanged.
- **CHECK-constraint fix** - The v3 deploy 500'd romantic generation because `paired_profiles_item_set_check` and `paired_mode_itemset` enumerated the old item_sets. Both DROP+ADD to accept personal_plus, old values kept legal. Migration `paired_profiles_allow_personal_plus_itemset`, verified by a rolled-back insert.
- **End-to-end verification + cleanup** - A fresh romantic personal_plus profile reached narrative_status='complete' with 68 facets, all 26 professional + all 16 Purpose/Pleasure surfaced (bucket != not_a_pattern), 0 suffixed names. The stale 2026-06-27 personal_42 romantic profile was deleted scoped by id+item_set+mode (CASCADE clean: 0 orphan sections/subjects/highlights, new profile intact).

## Decisions locked in Session 160 (recap)

- **Option A (global routing) accepted.** `routes`/`resource_logic` on `ptp_facet_types` are GLOBAL per item_number, not per-context. Turning on items 20 + 24 makes them newly appear in WORK paired + team reports, and changing 1/9/17/47 logic reframes them there. Cole accepted that cross-context change rather than build a context-scoped routing schema (Option B).
- **routes is the surfacing gate** (routes=false forces driver_score 0 and bucket 'not_a_pattern'); `resource_logic` shapes interpretation of surfaced facets, not visibility. routes=true + resource_logic='Neutral' is a valid in-production combination.
- **resource_logic assignments:** Pleasure 84 Convergent / 85 Complementary / 86 Saturating / 87 Complementary / 88 Convergent / 89 Complementary (Phil-approved); Purpose 75 Convergent / 77 Convergent / 79 Complementary / 80 Convergent / 81 Complementary / 83 Convergent; professional 1 Complementary / 9 Complementary / 17 Convergent / 20 Complementary / 24 Complementary / 47 Convergent; item 3 Complementary (anchored to its personal twin item 49).
- **Suffix strip is dual** (`(personal)` and `(professional)`) and lives only in the personal_plus RPC branch.
- **Any new item_set must widen every CHECK that enumerates item_sets** (the constraint-fix lesson).

## Session 161 opening priorities, in order

### 1. E2 - Mentor view of mentee assessment completion

The same completion view as the Session-159 D1/E1 work, but for a mentor over assigned mentees. Mentor relationship is `coach_mentor_assignments` (mentor_user_id, trainee_user_id, active = ended_at IS NULL), the same source `assign_mentor_pairs_bulk` uses. Backend-first (a mentor-scoped completion RPC reusing the D1 completion-join), then a mentor-portal frontend surface.

### 2. D2 - Org assessment invitation due dates + 48h reminders

Heaviest remaining item, likely its own session. Backend-first: a `due_date` column on the invitation table (likely `corporate_invitations`, confirm at session open), a cron job (precedent `dp_due_date_scan_daily` jobid 33), the Resend email path via `compose_notification_email` mindful of the existing 24h resend rate-limit, and a stop-on-completion guard reusing the completion signal (an `assessment_results` row for user+instrument).

### 3. F1 - MFA trust-this-device

Security-sensitive; own session. Default 30-day window, super-admin configurable. Needs a trusted-device table + token + RPC and a session-start AAL gate that consults it to skip the MFA prompt on a remembered device. Logged in the queue since Session 84.

### 4. G1 - Quiz AI authoring

Mirrors the knowledge_check AI authoring pattern, but the target is the `item_type='quiz'` content item with its own authoring page and `upsert_quiz_question` / `upsert_quiz_answer_option` RPCs, NOT the in-lesson knowledge_check block. Backend-first, then frontend.

## Open questions / things to lock in Session 161

- D2: confirm the invitation backing table (corporate_invitations assumed) and the reminder cadence beyond the single 48h reminder.
- The deferred 10-item personal-instrument expansion (42 to 52 personal facets, the S158 Tier 1/2 proposal) stays a PROPOSAL gated on a validation strategy with Phil; the cheap routing-first move is now DONE, so the next PTP-instrument decision is purely the expansion scope/validation call.

## What's NOT in scope for Session 161

- The paired/team PDF exporter (separate from the individual PDF; still queued).
- The deferred 10-item personal-instrument expansion build (proposal only until scope + validation are set).
- PTP team report sharing model (queued, part of the paired/team arc).

## Tooling note carried into Session 161

During the build portion of this session the Supabase MCP toolset did NOT include `get_edge_function` / `deploy_edge_function` (edge source is not SQL-reachable and the two paired functions are not in the GitHub repo), so the v3 edge function was dashboard-pasted and deployed by Cole. To restore live edge read/deploy, enable the edge-function scopes (or disable read-only mode) on the Supabase MCP connector and reconnect. `execute_sql` / `apply_migration` were available throughout.

## Architecture additions in Session 160

- Columns: `public.items.include_in_romantic` (boolean), `public.items.romantic_include_reason` (text).
- RPC branch: `public.ptp_profile_facet_rows` gained a `personal_plus` item_set with a `(personal)`/`(professional)` suffix strip.
- Classification: `ptp_facet_types.routes` + `resource_logic` turned on for 12 personal reward facets + 6 professional facets + item 3 (Option A, global per item_number).
- Edge fn: `generate-paired-profile` v3 (function version 12), personal + romantic now use personal_plus.
- Constraints: `paired_profiles_item_set_check` and `paired_mode_itemset` widened to accept personal_plus.

## Test fixture state at end of Session 160

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

The Becky/Josh romantic paired profile is the NEW personal_plus build (narrative_status complete; item_set personal_plus). The prior personal_42 romantic profile (computed 2026-06-27) was deleted this session; no pending cleanup. Profile ids are derived and regenerable; look up current ids via Supabase MCP if needed.

## Documents this session leaves behind

- build-queue.md (v161 to v162; new Session 160 DELTA banner)
- architecture-reference.md (v160 to v161; new v161 changelog entry + updated LATEST ENTRY header)
- session-160-to-161.md (this document)

Markdown only (Session-74 decision; no .docx). Markdown source-of-truth at cbastianBWE/brainwise-internal-docs.
