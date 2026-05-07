# BrainWise Build Queue

*v30 - Session 38 closeout*

## Priority key

- LAUNCH-BLOCKING: must complete before soft launch
- HIGH: completes the AIRSA dual-rater feature; needed for v1 of dual-rater
- MEDIUM: improves quality but not required for v1
- LOW: post-launch hardening

## Session 38 deltas summary

Phase 3b shipped end-to-end (self-rater post-submit experience). Production invitation-redemption bug fixed via GUC opt-out pattern. PTP Pleasure brand color flipped from yellow #FFB703 to forest green #2D6A4F across the codebase via Lovable refactor. NAI Saturation color alignment (yellow #FFB703 to mustard #7a5800 in NAI individual report files) is the next Lovable prompt; ready to ship, not yet sent.

## Verified bugs with explicit fix instructions

Each bug below has been verified against production data or code review. Where I could not verify, I marked as Speculative and they are NOT in this section.

### BUG-1 [HIGH]: MyResults.tsx isAIRSA detection always evaluates false

File: src/pages/MyResults.tsx, line 603-605

Current code:

```
const isAIRSA = (selected?.result.instrument_id ?? "")
  .toUpperCase()
  .includes("AIRSA");
```

Why it's broken: actual AIRSA instrument_id is 'INST-003', which does not contain the substring 'AIRSA'. isAIRSA is therefore always false in production.

Effect on users: the AIRSACards component (the dimension grid showing readiness levels) never renders. AIRSA users fall through to the generic ResponsiveContainer BarChart at line 1028.

Verified by: production database inspection of assessment_results.dimension_scores for INST-003 rows confirmed the rendered path matches the bar-chart fallback.

Fix:

```
const isAIRSA = (selected?.result.instrument_id ?? "") === "INST-003";
```

Note for Phase 3e: Phase 3e replaces the entire AIRSA rendering path with the new combined-report layout, so this fix becomes part of that prompt rather than a standalone fix. Do NOT fix this in isolation; bundle into Phase 3e.

### BUG-2 [HIGH, partially fixed]: calculate-scores AIRSA detection always evaluates false

File: supabase/functions/calculate-scores/index.ts (now version 40 deployed in Session 37)

Original code (lines ~124):

```
const isAIRSA = instrument_id.startsWith("AIRSA");
```

Why it's broken: actual AIRSA instrument_id is 'INST-003'. isAIRSA was always false, which routed AIRSA scoring through the catchall mean-calculation branch. AIRSA's 1-4 ordinal response values were averaged as numbers and stored as { mean: 1.33 } instead of mapped to readiness levels { readiness_level: 'Foundational' }.

Verified by: SELECT against assessment_results showed all INST-003 rows have dimension_scores objects with 'mean' fields, never 'readiness_level' fields. AIRSACards default of 'Foundational' is therefore what every existing user saw.

Status: PARTIALLY FIXED in Phase 3a. The new calculate-scores v40 adds a correct detection (isAirsaCorrect = instrument_id === 'INST-003') and uses it in the dimension-scoring conditional. The legacy isAIRSA variable is preserved (still always false) so PTP/NAI/HSS code paths are not changed.

Effect of partial fix: NEW AIRSA results from this point forward will be scored correctly with readiness_level. Existing AIRSA results (all of which are superseded per Phase 0) remain in the database with the old broken mean-based scoring. They are not displayed because they are superseded.

Remaining work: when Phase 3e ships, verify a new end-to-end AIRSA submission produces dimension_scores with readiness_level values, not mean values.

### BUG-3 [MEDIUM, silent]: calculate-scores PTP/NAI/HSS prefix detection always false

File: supabase/functions/calculate-scores/index.ts

Code:

```
const isPTP = instrument_id.startsWith("PTP");   // INST-001 actual
const isNAI = instrument_id.startsWith("NAI");   // INST-002 actual
const isHSS = instrument_id.startsWith("HSS");   // INST-004 actual
```

Why it's broken: instrument IDs use INST-NNN format. The prefix string-match never succeeds. isSlider = isPTP || isNAI is always false. The isSlider branch (which calls scoreBand for high/moderate/low banding) never runs.

Effect: PTP/NAI mean values are stored correctly in dimension_scores.mean (60-85 range). But the high_dimensions and low_dimensions arrays in overall_profile are computed using HSS thresholds (>=3.5 / <=1.5) against PTP/NAI 0-100 means, which never satisfy those thresholds. So both arrays are always empty for PTP/NAI.

User-facing impact: NONE found. high_dimensions and low_dimensions are declared in TypeScript interfaces in MyResults.tsx and assemblePdfDataForUser.ts but never consumed for rendering. Verified by grep across the entire repo.

Priority: MEDIUM (silent, no user impact today, but indicates the trigger_logic evaluation may also be skipping conditions it should match). Fix requires regression testing because changing high/low computation could surface unintended trigger_logic firings.

Recommended fix:

```
const isPTP = instrument_id === "INST-001";
const isNAI = instrument_id === "INST-002" || instrument_id === "INST-002L";
const isHSS = instrument_id === "INST-004";
```

Then verify trigger_logic firings against existing PTP/NAI dashboard outputs. Do NOT touch this until Phase 3e ships AIRSA dual-rater.

### BUG-4 [LOW]: items.rater_type vs assessments.rater_type case mismatch

Schema convention split:

- items.rater_type values: 'Self', 'Manager' (capital)
- assessments.rater_type values: 'self', 'manager' (lowercase, enforced by CHECK constraint)

Why it matters: any frontend or RPC code that joins or compares across these tables must normalize. Phase 3 frontend code that loads items WHERE rater_type = 'Manager' (correct for items) cannot reuse the same string value when filtering assessments WHERE rater_type = 'manager' (correct for assessments).

Recommended fix path: long-term, normalize one direction. Lowercase is more conventional for code values, but the items table has 193 rows and the standardization should happen via a migration plus an RPC update. Not launch-blocking; fold into a future schema-cleanup pass.

### BUG-5 [HIGH, NEW Session 38]: calculate-scores Branch B re-stamps completed_at on release self-only

File: supabase/functions/calculate-scores/index.ts

Why it's broken: Branch B (AIRSA Self submission path) re-stamps the self assessment's completed_at column when the self-only release path is taken. Effect: the 90-day re-take cooldown window then anchors from the release date instead of the original self-completion date. A user who completes self on day 0, releases self-only on day 14, and tries to re-take on day 95 (95 days from original completion, 81 days from release) is told they must wait until day 104.

Effect on users: edge case. Most users will retake well past 104 days regardless. But for any user using re-take to recalibrate around a new direct-report relationship, the cooldown should anchor on the original completion not the release.

Recommended fix: in Branch B's self-only branch, do not re-stamp completed_at if self.status is already 'completed'. Stamp it only on the initial self-completion path.

Priority: HIGH (data correctness, anchor-date semantics). Fix as part of Phase 3e or as a standalone hot-fix before launch.

### BUG-6 [LOW, INVESTIGATIVE, NEW Session 38]: pre-trigger corporate invitation redemptions

Two corporate invitation redemptions completed successfully on 2026-04-18 despite the enforce_immutable_user_fields trigger having been created on 2026-04-09. The trigger's behavior on first-time corporate invitee path (clobbering NEW.organization_id to NULL because the new user has no auth.uid() context yet) means most subsequent attempts would have failed. Why these two succeeded is unknown.

Action: query assessments and users from those two redemption events, inspect trigger evaluation order, look for race-condition-permissive paths.

Priority: LOW (historical, not blocking new business). Defer post-launch unless customer-reported pattern emerges.

### BUG-7 [LOW, NEW Session 38]: SECURITY DEFINER UPDATE audit on public.users

The Session 38 invitation-redemption fix added a GUC opt-out pattern (app.bypass_user_immutable_check) so that the invitation_redeem RPC could legitimately UPDATE public.users without being clobbered by the enforce_immutable_user_fields trigger. The pattern works for that one RPC. Other SECURITY DEFINER functions that UPDATE public.users have not been audited.

Action: enumerate all SECURITY DEFINER functions whose body contains UPDATE public.users; verify each one either does not need the GUC opt-out (because it operates on rows owned by the calling user) or correctly opts out.

Priority: LOW (audit, not a known live failure). Do post-launch unless a related production error emerges.

## Bug claims I made and then RETRACTED after verification

Including these to prevent the next session from re-investigating ground I already covered.

- isSliderInstrument string match in MyResults.tsx (line 596) - LOOKS broken at first glance because it falls through to a string-match against 'PTP' and 'NAI' against actual INST-001/INST-002 IDs. NOT actually broken in practice because the FIRST check (selected?.scale_type?.includes('slider')) succeeds for the only sliders. The dead string-match fallback never matters.

## AIRSA remaining work - Phase 3 through Phase 8

Each phase has a number, a priority, and a one-line summary. Full execution scope for Phase 3b through 3e and Phases 4 through 8 is in the Session Handoff document.

### Phase 3b [SHIPPED in Session 38]: Self-rater post-submit experience

Status: Complete. End-to-end verified across three states (within 14 days, 15-day backdate, 91-day backdate).

What shipped:

- /my-results: replace immediate AIRSA results with awaiting-supervisor state when gate is blocked
- After 14 days post self-completion: surface 'Release self-only report' + 'Send reminder to supervisor' buttons
- After 90 days: surface 'Re-take AIRSA' button with confirmation dialog
- airsa-supervisor-reminder Edge Function v2 deployed (corrected privacy framing in email body)
- airsa-supervisor-invite Edge Function v2 deployed (same corrected framing)
- New RPC: airsa_get_my_paired_manager_status(uuid) - Class A, SECURITY DEFINER, returns paired_assessment_id, paired_status, reminder_count, last_reminder_sent_at to the self-rater for awaiting-state UI

### Phase 3c [LAUNCH-BLOCKING]: Supervisor pending-manager surface

- Top of /assessment: pending AIRSA manager assessment cards (mirrors EPN pattern)
- Wires to: my_pending_manager_assessments RPC
- Card shows: self-rater name, department, days since self completed, Start button

### Phase 3d [LAUNCH-BLOCKING]: Manager-rating assessment-taking flow

- AssessmentFlow handles preexistingAssessmentId for AIRSA manager rating
- Loads items with rater_type = 'Manager' (capital M, items table convention)
- Same UI as self-rating; different items, different submit destination
- Submit goes to calculate-scores; Branch A handles the merge

### Phase 3e [LAUNCH-BLOCKING]: Combined results page

- Six-section layout matching prototype screenshots (locked in this session)
- PLUS three Cole-requested additions: AIRSA overview at top, cross-instrument analysis section, action plan reusing PTP/NAI patterns
- Includes BUG-1 fix as part of the rewrite
- Self-only state: shows the same layout structure but with manager columns hidden, no divergence, with a banner explaining manager rating did not arrive
- Branch B completed_at re-stamp fix (BUG-5) bundled here

### Phase 4 [LAUNCH-BLOCKING]: PDF export of combined report

- Replicate the on-screen layout as a downloadable PDF
- Mirror the existing PTP and NAI PDF export patterns (assemblePdfDataForUser.ts is the model)
- Self-only PDF variant for the timeout case

### Phase 5 [HIGH but POST-LAUNCH OK]: AIRSA org dashboard

- Org admin view of aggregate AIRSA results: alignment %, blind-spot patterns, dev priorities by department
- Different scope from individual report; can ship after soft launch
- Memory previously logged this as 'AIRSA dashboards completion' on the Build Queue

### Phase 6 [HIGH]: Instrument toggle interactions

- Locked decision (Session 38): pending manager rows stay dormant when AIRSA is toggled off
- Hide via filter on my_pending_manager_assessments RPC; do not auto-abandon
- Existing results remain visible after instrument toggle-off; access gate covers both taking and viewing
- RPC update deferred to Phase 3c

### Phase 7 [MEDIUM]: Cross-instrument recommendations wiring for AIRSA

- Required for the 'How this connects to your other assessments' section in the combined report
- AIRSA must be wired into existing generate-cross-instrument-recommendations Edge Function
- Single post-AIRSA + post-HSS Build Queue item updating BOTH individual reports AND dashboards (locked decision Session 38)
- trigger_logic table needs entries with source_instrument = 'INST-003' or rules that map AIRSA dimensions to PTP/NAI patterns
- If not done, the cross-instrument section renders empty (acceptable degraded state for v1 if it doesn't make launch)

### Phase 8 [MEDIUM]: Cleanup verification

- Confirm UI handles superseded AIRSA results correctly (don't display, don't double-count, don't trigger re-rate cooldown against superseded rows)
- Verify Cole Plummer's existing superseded result does not appear in his account UI
- Existing cron jobs (if any) that scan assessment_results properly skip superseded_at IS NOT NULL
- Test fixture cleanup: stale in-progress AIRSA self assessment from Session 38 State D Re-take test (id unknown; query on test +employee user, status = 'in_progress')

## Color refactor follow-up items

### [READY TO SHIP, NEW Session 38]: NAI Saturation color alignment

Decision locked: align NAI Saturation (DIM-NAI-05) to mustard #7a5800 across the codebase. Currently the NAI individual report uses bright yellow #FFB703 while the NAI dashboard uses mustard #7a5800. The dashboard color is likely an accessibility-driven correction that didn't propagate. After this ships, #FFB703 will only exist as the --bw-amber brand token (used by --warning semantic and other UI elements).

Files to update: src/pages/MyResults.tsx (NAI map only), src/components/results/NAINarrativeSections.tsx, plus any other DIM-NAI-05: #FFB703 occurrences via repo-wide search.

DO NOT change: --bw-amber CSS token (stays #FFB703 for warning/UI use), DIM-PTP-05 entries (already shipped as #2D6A4F), DIM-NAI-05 entries already at #7a5800.

After shipping: update Architecture Reference brand lock to NAI Saturation = #7a5800.

Lovable prompt drafted and ready to send. Status: not yet sent.

## Carried items from prior sessions (unchanged)

### [LOW] Audit and reconcile semantic-token coverage between marketing-tokens.css and index.css

marketing-tokens.css defines a full semantic alias layer (--accent, --success, --warning, --info, --premium, --danger, --danger-soft). index.css mirrors only the raw --bw-* tokens, not the semantic aliases. App code falls back to raw tokens or generic Tailwind utilities. Decision needed: replicate the semantic layer in index.css, or have index.css import from marketing-tokens.css. Audit existing app pages for off-palette color usage as part of the same effort.

### [LOW] Bulk supervisor reassignment for existing employees

Mirror existing bulk-deactivate pattern. Add user_assign_supervisor_bulk RPC plus 'Reassign supervisor for selected' affordance in the user table toolbar. Trigger condition: when a real corporate customer hits friction with > 10 reassignments by hand.

### [LOW] requires_assignment column has zero application readers

Decide: enforce via CHECK constraint that AIRSA Manager rows must have target_user_id set, or remove as dead schema. Currently flipped to false on all instruments; flipping to true on AIRSA changes nothing because no code reads the column.

### [MEDIUM] Email template helper duplication

The brand-color email template helpers are now copy-pasted across at least 10 Edge Functions: assign_epn_send, invitation_send, bulk_invitation_send, admin_trigger_password_reset, invite-coach, send-departure-emails, deactivate-and-notify, bulk-deactivate-and-notify, airsa-supervisor-invite, airsa-supervisor-reminder. Future brand-color changes require touching all of them. Consider extracting to a shared module via the Supabase Edge Function _shared/ pattern.

### [POST-LAUNCH] Action-Oriented Voice Redesign

Replace neuropsychology consulting prose with scannable action-oriented language plus expandable detail cards across 6 surfaces (NAI/PTP dashboard UI + inline PDF, NAI/PTP individual results UI + PDF). Top Build Queue priority after launch.

### [POST-LAUNCH] Corporate contract renewal schema change

Drop UNIQUE (organization_id) on corporate_contracts, add is_current semantics. Deferred until first renewal occurs.

### [POST-LAUNCH] Department FK migration

Normalize free-text department names to a per-org departments table.

### [POST-LAUNCH] ai_usage / ai_usage_counters table unification

Build Queue Item 98.

### [POST-LAUNCH] Bulk invite/bulk purchase flow with per-client instrument selection

Self-pay vs. coach-paid routing.

### [POST-LAUNCH] Organization grouping layer for My Clients page

(coach feature)

### [POST-LAUNCH] Clarity Engine

Deferred until Resources pages built.

### [POST-LAUNCH] Coach certification portal, Trends tab completion, Path B token-based client upgrade

### [POST-LAUNCH, NEW Session 38] Regression test for invitation_redeem corporate invitee path

Add an integration test that exercises a fresh anonymous user redeeming a corporate invitation. The Session 38 fix (GUC opt-out app.bypass_user_immutable_check) papered over a path that had been broken since the trigger was created on 2026-04-09. A regression test would catch a future regression of this specific interaction (SECURITY DEFINER RPC + immutable-fields trigger + new user without auth context).
