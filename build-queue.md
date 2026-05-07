# BrainWise Build Queue

*v32 - Session 40 closeout*

## Priority key

- LAUNCH-BLOCKING: must complete before soft launch
- HIGH: completes the AIRSA dual-rater feature; needed for v1 of dual-rater
- MEDIUM: improves quality but not required for v1
- LOW: post-launch hardening

## Session 39 deltas summary

Phase 3e backend shipped end-to-end and verified. Six AIRSA AI section generators deployed. The 24-skill `airsa_skills` reference table created and seeded. `skill_level_breakdown` JSONB column added to `assessment_results` and populated by `calculate-scores` Branch A. `calculate-scores` v42 now fans out to all six AI section generators on manager submission, parallel to the legacy `generate-report` call. Storage convention for AI section content: rows in the existing `facet_interpretations` table with `section_type = 'airsa_<key>'`, mirroring the PTP/NAI pattern. NAI Saturation color refactor (#FFB703 to #7a5800) shipped via Lovable. Test fixture renamed (Maya Employee, David Supervisor) to make AI directional output debuggable.

## Session 40 deltas summary

Phase 3e frontend SHIPPED. AirsaCombinedReport.tsx (~1360 lines) deployed end-to-end. BUG-1 (MyResults isAIRSA detection) fixed. BUG-5 RETRACTED — code review of calculate-scores v42 Branch B and airsa_release_self_only RPC confirmed neither path re-stamps completed_at; the reported bug does not exist. The original 15-section spec became a 14-section spec: the developmental quadrant map (Section 10) was removed because it duplicated the lollipop's information in less-readable form and its 3x3 cell encoding wasn't glanceable. STATUS_COLORS canonical mapping locked with five distinct brand hues (Underestimate moved from teal to purple #3C096C). Star (★) semantics changed from static is_new_skill flag to dynamic top-3-priorities marker, surfaced only in Section 9 lollipop row labels. Action buttons standardized to PTP/NAI pattern (Export PDF / Retake / Take Another). Lollipop level-zone shading colors locked. Multiple visual polish iterations (v1 through v6 plus a hotfix for a Rules of Hooks violation introduced by the v6 prompt). Maya test fixture repaired (16 missing response_value_text values backfilled, skill_level_breakdown self_response field patched). Session 41 opens with Phase 4 PDF export.

## Verified bugs with explicit fix instructions

Each bug below has been verified against production data or code review. Where I could not verify, I marked as Speculative and they are NOT in this section.

### BUG-1 [SHIPPED in Session 40]: MyResults.tsx isAIRSA detection always evaluates false

Fix landed in Session 40 as part of the Phase 3e frontend prompt. MyResults.tsx isAIRSA detection now uses strict equality `=== "INST-003"`. AIRSACards inline function and READINESS_COLORS const removed (replaced by AirsaCombinedReport import). Verified end-to-end against Maya fixture.

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

### BUG-5 [RETRACTED in Session 40]: calculate-scores Branch B re-stamps completed_at on release self-only

Retracted on review. Code audit of calculate-scores v42 Branch B and the airsa_release_self_only RPC confirmed neither path re-stamps `completed_at`. Branch B stamps `completed_at` only on initial self-completion. The release-self-only RPC sets only `self_only_released_at`, leaving `completed_at` untouched. The 90-day cooldown anchor is intact. Bug does not exist; no fix required.

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

### Phase 3e frontend [SHIPPED in Session 40]: Combined results page (14-section layout)

Shipped via AirsaCombinedReport.tsx (~1360 lines) and a routing update in MyResults.tsx. The original 15-section spec became a 14-section spec when the developmental quadrant map was removed mid-session (rationale: duplicated lollipop information in less-readable form, 3x3 cell encoding wasn't glanceable, position metaphor mismatched the discrete-level data). Multiple visual polish iterations landed (v1 initial build, restyle to PTP/NAI tokens, five-fixes, lollipop bands, chart width, action buttons, status colors + legend rebuild + star semantics, plus a hotfix for a Rules of Hooks violation introduced when `prioritySkillNumbers` was placed after the loading-state early return). BUG-1 fix bundled into the initial Phase 3e frontend prompt and verified.

Final 14-section layout in order:
1. Header (no AI)
2. At a glance (4 metric cards, no AI)
3. Action buttons (no AI; standardized to PTP/NAI: Export PDF / Retake Assessment / Take Another Assessment; the latter two gated on `!isCoachView && canTakeAssessments`)
4. How to read your results (with AIRSA overview folded in, 4-level frequency to 3-level readiness, no AI)
5. Domain heatmap with 5-status column (no AI; Status pill uses `display: inline-block`, `whiteSpace: nowrap`; Status column header carries `minWidth: 160`)
6. Profile overview (AI - airsa_profile_overview)
7. What does this mean to me? (AI - airsa_what_this_means, 4 themed boxes with tone pills)
8. Action plan (AI - airsa_action_plan, 3 timeframes with navy/teal/green branded pills)
9. Skill-by-skill comparison lollipop (no AI, all 24 skills, chartW=560, level-zone shading bands, combined legend at top with star explanation)
10. Conversation guide (AI - airsa_conversation_guide, 3 openings with role pills) [renumbered from former Section 11]
11. Top 3 development priorities (AI - airsa_top_priorities, status-color pills) [renumbered from 12]
12. How this connects to your other assessments (AI - airsa_cross_instrument, conditional) [renumbered from 13]
13. Skill reference list, collapsed (no AI; all 24 skills) [renumbered from 14]
14. Methodology footer (no AI) [renumbered from 15]

Self-only state: same layout structure with manager columns hidden, no divergence, banner explaining manager rating did not arrive. Verified on Maya fixture across 14d, 14-89d, 90+d release windows.

Maya fixture repaired during session: 16 self responses had null response_value_text (fixture script left them null); backfilled via SQL UPDATE mapping numeric values to the four frequency labels. skill_level_breakdown JSONB self_response field also patched via jsonb_set on the affected assessment_result. All 24/24 self_responses populated post-fix.

### Phase 4 [LAUNCH-BLOCKING, NEXT UP]: PDF export of combined report

Replicate the 14-section AirsaCombinedReport on-screen layout as a downloadable PDF. Mirror the existing PTP/NAI PDF export patterns (assemblePdfDataForUser.ts is the model). Self-only PDF variant for the timeout case. Use jsPDF native pattern, NOT html2canvas — text must be selectable and the PDF must render reliably across browsers without screen-shotting. Include all status colors (using the canonical STATUS_COLORS mapping locked in Session 40, including Underestimate = #3C096C purple), the lollipop level-zone shading bands (peach #FCE4D6 / sky-blue #D6E8F5 / green-tint #D8E8D0), star markers on the user's three top-priority skills in Section 9, and the standardized button row replaced by a footer link back to the report. Open Session 41 with this work.

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

## Top priority items for Session 41 opening

### [LAUNCH-BLOCKING] Phase 4: AIRSA combined report PDF export

Write the assemblePdfDataForUser-style helper for AIRSA. Mirror PTP/NAI PDF export patterns. Use jsPDF native (NOT html2canvas). All 14 sections render to PDF. Use the canonical STATUS_COLORS mapping, the level-zone shading, and the star markers exactly as they render on screen. Self-only PDF variant for the timeout case. After PDF lands, run a single end-to-end Maya fixture verification covering on-screen + PDF, both dual-rater and self-only.

### [HIGH] AI generate pass

Final phrasing tweaks across all six AI functions. Specific items: residual "this creates" leakage in profile-overview, slight inference-overreach phrasing, fine-tuning toward purer factual observation. Now that all six sections render together in the new frontend, the tone is evaluable end-to-end on Maya's fixture.

## Session 40 design decisions locked

### STATUS_COLORS canonical mapping (Session 40 lock)

Each of the five AIRSA dual-rater statuses uses a distinct brand color. No two statuses share a color anywhere in the AIRSA report or its downstream PDF.

- aligned: #006D77 (teal)
- confirmed_strength: #2D6A4F (green)
- confirmed_gap: #6D6875 (gray)
- blind_spot: #021F36 (navy)
- underestimate: #3C096C (purple)

Dash pattern is preserved on `blind_spot` only (intuitive "broken line for blind spot" iconography). Other statuses use solid lines and chips. The mapping is the authoritative source for the lollipop line color, the heatmap status pill, the priority card status pill, and the Section 5 "skills by status" indicator dots.

Cross-instrument note: #3C096C is also used as the PTP Purpose dimension color. Contexts never overlap on the same screen, so the reuse is acceptable. Same for #006D77 reused as the AIRSA Self-rating dot color (lollipop) and the Aligned line color — different surfaces (legend dot vs connecting line); contexts are visually distinct.

### Star (★) semantics (Session 40 lock)

Star marks the three skills returned by `airsa_top_priorities.content[].skill_number` for the current user. Dynamic per user, NOT static. Surfaced ONLY in the Section 9 lollipop row labels. Section 12 priority cards do NOT carry a star (the card itself IS the priority). Section 13 skill reference list does NOT carry a star (all-skills reference, no per-user marking applies).

The `airsa_skills.is_new_skill` boolean column stays in the database. Backend `generate-airsa-top-priorities` continues to use `is_new_skill = true` as a tiebreaker within priority pools (per Session 39 decision). Frontend stops surfacing it. The star symbol's UI meaning is now exclusively "your top development priority."

### Lollipop level-zone shading (Session 40 lock)

Three vertical band colors behind the dots, in `LollipopChart` only:

- Foundational (left third): #FCE4D6 (warm peach)
- Proficient (middle third): #D6E8F5 (clear sky blue)
- Advanced (right third): #D8E8D0 (fresh leaf green-tint)

All three at 60% fill opacity. Hardcoded hex literals in SVG `fill` attribute (CSS variables do NOT resolve in SVG fill attributes — confirmed during Session 40 debugging). These three colors must NOT be used anywhere outside the lollipop chart.

### Action plan timeframe pill colors (Session 40 lock)

Section 8 timeframe pills (THIS WEEK / NEXT 30 DAYS / IN 90 DAYS) use brand colors signaling time progression:

- This week: navy (#021F36) tinted pill (background `${navy}20`)
- Next 30 days: teal (#006D77) tinted pill
- In 90 days: green (#2D6A4F) tinted pill

Same pattern as PTP DimensionPill: background `${color}20` with full-saturation foreground.

### Section pill conventions (Session 40 lock)

- Section 7 boxes carry tone pills (Shared territory / Divergence / Brain frame / For the manager)
- Section 11 conversation guide cards carry role pills (For you / For your manager / For both)
- Section 12 priority cards carry status pills derived from `breakdown[String(p.skill_number)]?.status`
- Sections 6, 8 (body), 13 stay clean prose without pills

### Action button standardization (Session 40 lock)

AIRSA Section 3 buttons now match PTP/NAI exactly:

- Export PDF (outline, FileText icon, always visible)
- Retake Assessment (outline, RefreshCw icon, gated on `!isCoachView && canTakeAssessments`)
- Take Another Assessment (filled navy default, no icon, same gate)

Dropped from earlier AIRSA-only set: Schedule conversation with manager (feature not built), Resources (not on PTP/NAI), Share (AIRSA is auto-shared with supervisor and org admins via shared-results page).

### Quadrant map removed (Session 40 lock)

Section 10 (Developmental quadrant map) was built and shipped in v1, then removed mid-session. Rationale: it duplicated the lollipop's information in less-readable form; the 3x3 cell encoding wasn't glanceable; the position-as-data metaphor mismatched the discrete-level data; and the quadrant labels were already conveyed by the lollipop's connecting-line colors and the Section 5 heatmap status pills. Section count dropped from 15 to 14.

If a divergence-summary visual is wanted later, the recommended path is a horizontal stacked bar showing the count of skills per status (information density is higher than the quadrant's 3x3 collapse). Defer indefinitely; lollipop + heatmap + Section 7 prose cover this ground.

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
