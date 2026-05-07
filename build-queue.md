# BrainWise Build Queue

*v31 - Session 39 closeout*

## Priority key

- LAUNCH-BLOCKING: must complete before soft launch
- HIGH: completes the AIRSA dual-rater feature; needed for v1 of dual-rater
- MEDIUM: improves quality but not required for v1
- LOW: post-launch hardening

## Session 39 deltas summary

Phase 3e backend shipped end-to-end and verified. Six AIRSA AI section generators deployed. The 24-skill `airsa_skills` reference table created and seeded. `skill_level_breakdown` JSONB column added to `assessment_results` and populated by `calculate-scores` Branch A. `calculate-scores` v42 now fans out to all six AI section generators on manager submission, parallel to the legacy `generate-report` call. Storage convention for AI section content: rows in the existing `facet_interpretations` table with `section_type = 'airsa_<key>'`, mirroring the PTP/NAI pattern. NAI Saturation color refactor (#FFB703 to #7a5800) shipped via Lovable. Test fixture renamed (Maya Employee, David Supervisor) to make AI directional output debuggable.

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

Fix:

```
const isAIRSA = (selected?.result.instrument_id ?? "") === "INST-003";
```

Note for Phase 3e: Phase 3e replaces the entire AIRSA rendering path with the new combined-report layout. This bug becomes part of that frontend prompt rather than a standalone fix. Do NOT fix in isolation; bundle into Phase 3e frontend.

### BUG-2 [HIGH, partially fixed]: calculate-scores AIRSA detection always evaluates false

File: supabase/functions/calculate-scores/index.ts (now version 42 deployed in Session 39)

Original code (lines ~124):

```
const isAIRSA = instrument_id.startsWith("AIRSA");
```

Why it's broken: actual AIRSA instrument_id is 'INST-003'. isAIRSA was always false, which routed AIRSA scoring through the catchall mean-calculation branch.

Status: PARTIALLY FIXED in Phase 3a. The legacy isAIRSA variable is preserved (still always false) so PTP/NAI/HSS code paths are not changed. The new `isAirsaCorrect` flag drives all AIRSA logic.

Remaining work: after Phase 3e frontend ships, verify a new end-to-end AIRSA submission produces dimension_scores with readiness_level values, not mean values.

### BUG-3 [MEDIUM, silent]: calculate-scores PTP/NAI/HSS prefix detection always false

Same shape as BUG-2 but applied to non-AIRSA instruments. The high_dimensions and low_dimensions arrays in overall_profile are computed using HSS thresholds against PTP/NAI 0-100 means, which never satisfy those thresholds. Both arrays are always empty for PTP/NAI.

User-facing impact: NONE found. high_dimensions and low_dimensions are declared in TypeScript interfaces but never consumed for rendering.

Recommended fix:

```
const isPTP = instrument_id === "INST-001";
const isNAI = instrument_id === "INST-002" || instrument_id === "INST-002L";
const isHSS = instrument_id === "INST-004";
```

Then verify trigger_logic firings against existing PTP/NAI dashboard outputs. Do NOT touch this until Phase 3e frontend ships.

### BUG-4 [LOW]: items.rater_type vs assessments.rater_type case mismatch

- items.rater_type values: 'Self', 'Manager' (capital)
- assessments.rater_type values: 'self', 'manager' (lowercase, enforced by CHECK constraint)

Cross-table joins on rater_type fail silently because of the case mismatch. Always normalize at the boundary.

Long-term fix: normalize one direction. Lowercase is more conventional. Not launch-blocking; fold into a future schema-cleanup pass.

### BUG-5 [HIGH]: calculate-scores Branch B re-stamps completed_at on release self-only

File: supabase/functions/calculate-scores/index.ts

Why it's broken: Branch B re-stamps the self assessment's completed_at column when the self-only release path is taken. Effect: the 90-day re-take cooldown window then anchors from the release date instead of the original self-completion date.

Recommended fix: in Branch B's self-only branch, do not re-stamp completed_at if self.status is already 'completed'. Stamp it only on the initial self-completion path.

Priority: HIGH. Fix as standalone hot-fix or bundled with Phase 3e frontend.

### BUG-6 [LOW, INVESTIGATIVE]: pre-trigger corporate invitation redemptions

Two corporate invitation redemptions completed successfully on 2026-04-18 despite the enforce_immutable_user_fields trigger having been created on 2026-04-09. Why these two succeeded is unknown.

Priority: LOW. Defer post-launch unless customer-reported pattern emerges.

### BUG-7 [LOW]: SECURITY DEFINER UPDATE audit on public.users

The Session 38 invitation-redemption fix added a GUC opt-out pattern. Other SECURITY DEFINER functions that UPDATE public.users have not been audited.

Priority: LOW (audit, not a known live failure). Do post-launch unless a related production error emerges.

## Bug claims I made and then RETRACTED after verification

- isSliderInstrument string match in MyResults.tsx (line 596) - LOOKS broken because it falls through to a string-match against 'PTP' and 'NAI' against actual INST-001/INST-002 IDs. NOT actually broken in practice because the FIRST check (selected?.scale_type?.includes('slider')) succeeds. Dead string-match fallback never matters.

## AIRSA remaining work - Phase 3 through Phase 8

### Phase 3b [SHIPPED in Session 38]: Self-rater post-submit experience

Status: Complete. End-to-end verified across three states (within 14 days, 15-day backdate, 91-day backdate).

### Phase 3c [SHIPPED]: Supervisor pending-manager surface

(Carried in Session 38's Build Queue as launch-blocking; if it is not yet built, schedule alongside Phase 3d frontend.)

### Phase 3d [SHIPPED]: Manager-rating assessment-taking flow

(Same note as 3c.)

### Phase 3e backend [SHIPPED in Session 39]: AI section generator infrastructure

Status: Complete. End-to-end verified.

What shipped:

- `airsa_skills` table with 24 rows seeded from the canonical AI Readiness Skills Profile source document. Columns: item_number (PK), dimension_id (FK), skill_name, short_description, full_definition, theoretical_basis, behavioral_indicators (JSONB), is_new_skill, primary_p, secondary_ps (JSONB).
- `skill_level_breakdown` JSONB column added to assessment_results. Shape: keyed by item_number string; each value is a denormalized per-skill object with self/manager levels, response text, delta, direction, and status.
- `status` field added to `self_manager_divergence` per dimension. Values: aligned, confirmed_strength, confirmed_gap, blind_spot, underestimate. Logic: both Foundational = confirmed_gap; both Proficient = aligned; both Advanced = confirmed_strength; self > manager = blind_spot; manager > self = underestimate.
- calculate-scores v41/v42 Branch A populates skill_level_breakdown and divergence.status atomically with the upsert.
- Six AI Edge Functions deployed (each with hybrid Class A/Class B auth, shared secrets.ts and errors.ts utilities, banned-words/banned-phrases discipline, skill-numbers-only output convention):
  - generate-airsa-profile-overview v5 (plain text, 800 max_tokens)
  - generate-airsa-what-this-means v3 (JSON 4-key object, 2000 max_tokens)
  - generate-airsa-action-plan v3 (JSON 3-key object, 600 max_tokens)
  - generate-airsa-conversation-guide v3 (JSON 3-key object, 600 max_tokens)
  - generate-airsa-top-priorities v2 (JSON 3-array, 1500 max_tokens)
  - generate-airsa-cross-instrument v2 (plain text, 1200 max_tokens, conditional on PTP or NAI)
- calculate-scores v42 fan-out: Branch A fires all six AI generators in parallel via fire-and-forget HTTP POST with x-internal-secret. Legacy generate-report call preserved alongside.
- Storage convention locked: AI section content writes to facet_interpretations rows with section_type = 'airsa_<key>'. Same pattern as PTP narrative_* and NAI nai_* rows. UNIQUE (assessment_result_id, section_type) constraint prevents duplicates; 23505 race-recovery path in each function reads cached row and returns. No new table created.

What did NOT ship and why:

- A separate `airsa_report_sections` JSONB column on assessment_results was tried, then dropped. Concurrent fan-out caused last-write-wins overwrites on the JSONB column.
- A SECURITY DEFINER atomic-merge RPC (airsa_set_report_section) was tried as a fix, then dropped. Although technically correct, it would have been the only centralized JSONB-merge pattern in the codebase. Inconsistent with the per-row precedent in facet_interpretations. Reverting to the proven pattern was the right call.

### Phase 3e frontend [LAUNCH-BLOCKING]: Combined results page (15-section layout)

Backend ready. Frontend Lovable prompt not yet written. Final layout decisions:

15 sections in order:
1. Header (no AI)
2. At a glance (4 metric cards, no AI)
3. Action buttons (moved up per locked decision, no AI)
4. How to read your results (with AIRSA overview folded in, 4-level frequency to 3-level readiness, no AI)
5. Domain heatmap with 5-status column including Confirmed strength (no AI)
6. Profile overview (AI - facet_interpretations.airsa_profile_overview)
7. What does this mean to me? (AI - airsa_what_this_means, 4 themed boxes)
8. Action plan (AI - airsa_action_plan, 3 timeframes)
9. Skill-by-skill comparison lollipop (no AI, all 24 skills)
10. Developmental quadrant map (no AI; brand colors not red/yellow/green; grid-aligned dots with comma-list labels)
11. Conversation guide (AI - airsa_conversation_guide, 3 openings)
12. Top 3 development priorities (AI - airsa_top_priorities)
13. How this connects to your other assessments (AI - airsa_cross_instrument, conditional)
14. Skill reference list, collapsed (no AI; all 24 skills with name + description + domain)
15. Methodology footer (no AI)

Required components:

- SkillReference shared hover-tooltip wrapper. Mobile: tap-popover. Accessibility: aria-describedby + keyboard focus.
- Markdown post-processor regex `/Skill\s+(\d+(?:\s*,\s*\d+)*)/g` wraps plain-text skill mentions across all AI sections.
- Lollipop chart component (24 skills; status-based color and dash pattern).
- Developmental quadrant scatter component. Color mapping: Underestimate = #006D77 (teal); Confirmed strength = #2D6A4F (green); Confirmed gap = #6D6875 (gray); Blind spot = #021F36 (navy). Sand quadrant fills with color tint.
- Loading states per section while AI fan-out is still running. Empty cross-instrument section shows unlock CTA when there is no facet_interpretations row.

Bundle BUG-1 fix into this Phase 3e frontend prompt. Bundle BUG-5 fix as well.

Self-only state: same layout structure with manager columns hidden, no divergence, banner explaining manager rating did not arrive.

### Phase 4 [LAUNCH-BLOCKING]: PDF export of combined report

Replicate the on-screen layout as a downloadable PDF. Mirror the existing PTP/NAI PDF export patterns (assemblePdfDataForUser.ts is the model). Self-only PDF variant for the timeout case. Use jsPDF native pattern. Deferred to its own session after Phase 3e frontend lands.

### Phase 5 [HIGH but POST-LAUNCH OK]: AIRSA org dashboard

Org admin view of aggregate AIRSA results: alignment %, blind-spot patterns, dev priorities by department. Different scope from individual report; can ship after soft launch.

### Phase 6 [SHIPPED]: Instrument toggle interactions

(Per Session 38 closeout; pending manager rows stay dormant when AIRSA is toggled off.)

### Phase 7 [MEDIUM]: Cross-instrument recommendations wiring for AIRSA

Required for the airsa_cross_instrument section to function for users with PTP or NAI completed. The Phase 3e backend implementation reads dimension_scores from existing PTP/NAI rows; no schema changes needed. trigger_logic table additions for source_instrument = 'INST-003' rules are still TBD.

If not done before launch, the cross-instrument section renders empty for users without PTP/NAI (acceptable degraded state for v1).

### Phase 8 [MEDIUM]: Cleanup verification

- Confirm UI handles superseded AIRSA results correctly
- Verify Cole Plummer's existing superseded result does not appear in his account UI
- Existing cron jobs (if any) that scan assessment_results properly skip superseded_at IS NOT NULL rows

## Top priority items for Session 40 opening

### [LAUNCH-BLOCKING] Phase 3e frontend Lovable prompt

Write the AirsaCombinedReport.tsx prompt covering all 15 sections, SkillReference component, lollipop, quadrant map, and brand-aligned styling. Read all data from assessment_results.skill_level_breakdown plus facet_interpretations rows where section_type LIKE 'airsa_%'. Single fetch on mount. Loading skeletons per section while AI sections are populating.

### [HIGH] AI generate pass

Final phrasing tweaks across all six AI functions. Specific items: residual "this creates" leakage in profile-overview, slight inference-overreach phrasing, fine-tuning toward purer factual observation. Deferred from Session 39 because the right time to evaluate tone is when all six sections render together in the frontend. Do this AFTER Phase 3e frontend lands.

## Color refactor follow-up items

### [SHIPPED in Session 39]: NAI Saturation color alignment

Decision shipped. NAI Saturation (DIM-NAI-05) is now mustard #7a5800 across all NAI individual report files, matching the dashboards. After this ship, #FFB703 exists only as the --bw-amber brand token (used by --warning semantic and other UI elements).

## Carried items from prior sessions (unchanged)

### [LOW] Audit and reconcile semantic-token coverage between marketing-tokens.css and index.css

marketing-tokens.css defines a full semantic alias layer; index.css mirrors only the raw --bw-* tokens. App code falls back to raw tokens or generic Tailwind utilities. Decision needed: replicate the semantic layer in index.css, or have index.css import from marketing-tokens.css.

### [LOW] Bulk supervisor reassignment for existing employees

Mirror existing bulk-deactivate pattern. Add user_assign_supervisor_bulk RPC plus 'Reassign supervisor for selected' affordance. Trigger condition: when a real corporate customer hits friction with > 10 reassignments by hand.

### [LOW] requires_assignment column has zero application readers

Decide: enforce via CHECK constraint that AIRSA Manager rows must have target_user_id set, or remove as dead schema.

### [MEDIUM] Email template helper duplication

Brand-color email template helpers are now copy-pasted across at least 10 Edge Functions. Future brand-color changes require touching all of them. Consider extracting to a shared module via the Supabase Edge Function _shared/ pattern.

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

### [POST-LAUNCH] Regression test for invitation_redeem corporate invitee path

Add an integration test that exercises a fresh anonymous user redeeming a corporate invitation. The Session 38 fix (GUC opt-out app.bypass_user_immutable_check) papered over a path that had been broken since the trigger was created on 2026-04-09. A regression test would catch a future regression.

### [POST-LAUNCH] Pricing-reads refactor

Eliminate hardcoded price IDs in favor of subscription_plans lookups.
