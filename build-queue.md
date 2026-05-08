# BrainWise Build Queue

*v35 - Session 43 closeout*

## Priority key

- LAUNCH-BLOCKING: must complete before soft launch
- HIGH: completes the AIRSA dual-rater feature; needed for v1 of dual-rater
- MEDIUM: improves quality but not required for v1
- LOW: post-launch hardening

## Session 39 deltas summary

Phase 3e backend shipped end-to-end and verified. Six AIRSA AI section generators deployed. The 24-skill `airsa_skills` reference table created and seeded. `skill_level_breakdown` JSONB column added to `assessment_results` and populated by `calculate-scores` Branch A. `calculate-scores` v42 now fans out to all six AI section generators on manager submission, parallel to the legacy `generate-report` call. Storage convention for AI section content: rows in the existing `facet_interpretations` table with `section_type = 'airsa_<key>'`, mirroring the PTP/NAI pattern. NAI Saturation color refactor (#FFB703 to #7a5800) shipped via Lovable. Test fixture renamed (Maya Employee, David Supervisor) to make AI directional output debuggable.

## Session 40 deltas summary

Phase 3e frontend SHIPPED. AirsaCombinedReport.tsx (~1360 lines) deployed end-to-end. BUG-1 (MyResults isAIRSA detection) fixed. BUG-5 RETRACTED — code review of calculate-scores v42 Branch B and airsa_release_self_only RPC confirmed neither path re-stamps completed_at; the reported bug does not exist. The original 15-section spec became a 14-section spec: the developmental quadrant map (Section 10) was removed because it duplicated the lollipop's information in less-readable form and its 3x3 cell encoding wasn't glanceable. STATUS_COLORS canonical mapping locked with five distinct brand hues (Underestimate moved from teal to purple #3C096C). Star (★) semantics changed from static is_new_skill flag to dynamic top-3-priorities marker, surfaced only in Section 9 lollipop row labels. Action buttons standardized to PTP/NAI pattern (Export PDF / Retake / Take Another). Lollipop level-zone shading colors locked. Multiple visual polish iterations (v1 through v6 plus a hotfix for a Rules of Hooks violation introduced by the v6 prompt). Maya test fixture repaired (16 missing response_value_text values backfilled, skill_level_breakdown self_response field patched). Session 41 opens with Phase 4 PDF export.

## Session 41 deltas summary

Phase 4 SHIPPED. AIRSA combined report PDF export delivered end-to-end across three Lovable prompts: v1 (initial 5-file build covering generateAirsaPdf.ts, assemblePdfDataForUser.ts assembleAirsaPdfData export, ExportPdfModal AIRSA branch, MyResults dispatcher lift, AirsaCombinedReport onExportClick prop), v2 (four bug fixes: star ★ rendering as ampersand due to WinAnsiEncoding limitation, skill reference one-skill-per-page from incorrect entry-height calculation, top priorities cards splitting from same-shape height bug, methodology footer date showing em-dash placeholder from missing facet_data.generated_at field), v3 (Profile overview heading-orphan + narrow-wrap fix using sectionHeading minContentNeeded argument plus full CONTENT_W - 12 wrap width). Final 9-page PDF rendered cleanly across cover + 14 sections, jsPDF native primitives throughout, text fully selectable, lollipop rendered with native lines/circles preserving STATUS_COLORS canonical mapping including dash pattern on blind_spot only, level-zone shading bands present, ASCII asterisk replaces star glyph in PDF only (on-screen report keeps ★).

Phase 5 strategic frame designed and locked (build deferred to Sessions 42+). Five-tab IA mirroring PTP/NAI canonical structure (Overview / Domains / Skill Inventory / Manager Calibration / Trends + Cross-Instrument). Talent Calibration Index (TCI) locked as headline metric: % of pairs in aligned + confirmed_strength out of all assessed skill-pairs, 0-100 higher is better. Confirmed gaps do NOT count positive (real capability gap, not earned strength). Greatest Growth Opportunities / Strengths to Capitalize paired panels added on Overview tab between sub-metric cards and Calibration Map: top 2 skills + top 2 domains per panel, expand-link for full ranking. Composite Priority Score (CPS) formula locked: cps_growth = (1 - readiness_index) * misalignment_weight where misalignment_weight is bounded [1.0, 2.0] = 1 + (blind_spot_pct + confirmed_gap_pct) / 100; cps_strength = confirmed_strength_pct. Tie-breakers: growth prefers higher blind_spot_pct, strength prefers higher n. Calibration Map confirmed as visual centerpiece: 24-skill × N-departments heatmap using locked STATUS_COLORS by modal status, intensity by status %, priority markers (orange ▲ for top growth, green ◆ for top strength) on row labels tracking the active slice. Manager Calibration tab confirmed for v1 with min-3-reports privacy threshold. Cross-instrument tab confirmed for v1 matching PTP/NAI parity. Schema strategy locked: match PTP/NAI exactly, reuse org_dashboard_narratives with instrument_id = 'INST-003' carrying AIRSA-specific JSONB shape in dimension_scores + narrative_text columns; index_score column carries TCI. Aggregate cadence locked: live RPC computation per dashboard load (mirrors PTP/NAI get_instrument_aggregate pattern), no nightly cron, no aggregate table. AI narrative cached in org_dashboard_narratives, regenerated on user click. Phase 5 split into Phase 5a backend (RPC + Edge Function + schema additions) and Phase 5b frontend (5 tabs of UI) per Phase 3 precedent.

Two architectural learnings logged: (1) jsPDF default helvetica uses WinAnsiEncoding which excludes U+2605 (★); the encoder substitutes a fallback character (observed: ampersand). Loading custom Unicode fonts is heavyweight; safer pattern is to use ASCII-equivalent glyphs in PDFs and reserve Unicode for on-screen contexts. (2) jsPDF splitTextToSize uses the CURRENT font for width calc; setting font BEFORE calling splitTextToSize is the canonical pattern (already commented in generateNaiPdf.ts line 406-407). Skipping this produces correct text but wrong wrap width, causing entries to render at narrow column widths even when full content area is available. Section 6 Profile overview shipped with this bug in v2 and was fixed in v3.

## Session 42 deltas summary

Phase 5a backend recon completed across all 8 blocks. Production-realistic AIRSA test fixture seeded end-to-end on BrainWise Test Corp. Phase 5a build (RPC + Edge Function) deferred to Session 43.

Org structure built on BWE Test Corp. Created Executive department; moved 5 C-Suite users into it. Final department layout: Executive 5, Engineering 18, Finance 14, Marketing 13. Supervisor chain wired with 17 distinct supervisors, 10+ clearing the Manager Calibration min-3 threshold. Manager Calibration tab data quality is now sufficient to demo on the test org.

AIRSA fixture seeded. 46 new self+manager assessment pairs inserted alongside the existing Maya pair (47 total in production). 2,208 `assessment_responses` (46 × 24 × 2 raters). 46 `assessment_results` rows with full JSONB: `dimension_scores`, `manager_dimension_scores`, `self_manager_divergence` (with `status` field), `skill_level_breakdown`. All values derived server-side from responses; no AI calls used during seed.

Verified org-wide TCI = 40.1, with healthy status distribution: aligned 24.5%, underestimate 20.7%, blind_spot 20.3%, confirmed_gap 19.0%, confirmed_strength 15.6%. The mid-40 TCI gives the demo room to tell a real story (~40% in clear alignment, ~40% calibration mismatches, ~19% confirmed gaps as workforce risk).

Recon-driven decision corrections from the Session 41 frame:

- AIRSA org dashboard stays at 5 tabs. AI workforce narrative renders inline on Overview as expandable card, NOT a separate tab.
- No `'supervisor'` slice_type added. Existing `'team'` slice already routes by `supervisor_user_id`. Manager Calibration tab iterates supervisors inside the RPC rather than via a new slice_type. CHECK constraint migration is no longer needed.
- `org_dashboard_narratives` schema is sufficient as-is. No table migrations needed for Phase 5a.
- AIRSA org dashboard Edge Function will use Class A JWT via `auth.getClaims` (mirroring `generate-dashboard-narrative` v22), not Class B as the Session 41 handoff had specified.
- AIRSA scale labels confirmed: `0=Never, 1=Rarely, 2=Often, 3=Consistently` (NOT "Always"). Previously inconsistent in places.
- Domain coloring for AIRSA org dashboard deferred to Phase 5b. Start from individual results page colors; pull from the 8-9 brand palette colors.

No bugs surfaced or shipped in Session 42 (recon + seed only).


## Session 43 deltas summary

Phase 5a backend SHIPPED. Both pieces deployed and verified end-to-end against the Session 42 seeded fixture. No Lovable credits used.

**RPC: `get_airsa_aggregate(p_slice_type, p_slice_value)`** applied via two migrations (initial `create_get_airsa_aggregate_rpc`, then `fix_get_airsa_aggregate_suppression_check` to correct the suppression check from skill-pair count to participant pool size). SECURITY DEFINER, mirrors `get_instrument_aggregate` caller validation including supervisor-with-direct-reports gate against `corporate_contracts.supervisor_dashboard_enabled`. Returns full §10.6 JSONB shape: tci_overall, alignment_rate, blind_spot_rate, underestimate_rate, status_distribution, skill_aggregates (24 skills with CPS), domain_aggregates (8 domains with CPS), rankings (growth_skills, strength_skills, growth_domains, strength_domains, all CPS-sorted), manager_calibration (only supervisors with n>=3 reports). n=5 suppression on eligible pool. n=3 suppression on Manager Calibration entries. Instrument is implicit (always INST-003). Manager Calibration computed inside the RPC by iterating supervisors. GRANT EXECUTE TO authenticated.

**Edge Function: `generate-airsa-org-narrative` v1** deployed. Hybrid Class A + Class B auth: Class A JWT primary (frontend Regenerate AI button), Class B (X-Internal-Secret with `safeEqual` constant-time comparison) for future programmatic regen requiring `organization_id` in body. Mirrors `generate-dashboard-narrative` v22 structure. `claude-opus-4-6`, max_tokens 7000. AIRSA-specific calibration-focused prompt with 5-status framework, top-5 growth/strength rankings, top-3 manager blind-spot/underestimate panels. Banned words and phrases match individual AIRSA generators. INSERTs to `org_dashboard_narratives` append-only with `instrument_id='INST-003'`, `index_score=TCI`, full RPC payload in `dimension_scores`, AI JSON in `narrative_text`. Shared utilities: `_shared/secrets.ts` (safeEqual) and `_shared/errors.ts` (sanitized serverError). SOC 2 markers in code: CC6.1 hybrid auth + safeEqual, CC6.3 caller validation + org isolation via SECURITY DEFINER RPC, CC7.2 sanitized 5xx errors with no PII.

**RPC verifications passed:** TCI 40.1 against fixture (matches pre-build verification); status distribution 24.5/15.6/19.0/20.3/20.7; 24 skill_aggregates and 8 domain_aggregates returned; top growth = Skill 10 Identity Flexibility (cps_growth 1.803); top strength = Skill 23 Algorithmic Vigilance (85% confirmed_strength); 10 supervisors meeting n>=3 threshold; department slice 432 pairs/19 eligible/TCI 37.3; org_level IC slice 816 pairs/34 eligible/TCI 40.6; team slice with 5 reports 120 pairs/TCI 37.5; suppression triggers correctly at 1-report and 3-report teams; INSERT path simulation confirms all CHECK constraints pass and `index_score=40.10`.

**One implementation bug caught and fixed during verification:** First version of the RPC suppressed on `pair_count` (eligible × 24 skills), which would have allowed n=1 team slices through. Fixed in second migration to check `array_length(v_participant_ids)` directly, mirroring `get_instrument_aggregate` semantics. Documented as architectural constraint in arch-ref §8.

**Not verified by Session 43:** Full Anthropic-API-to-JSON-parse-to-INSERT happy path. Auth gate, RPC fetch, and INSERT shape verified individually but not chained through a real session token. First frontend call in Phase 5b will validate this. Edge function deployed v1 active, 282ms cold start, auth gate confirmed firing in logs.

Session 43 also consolidated all individual-instrument AI tone work into a single MEDIUM batch item (see "AI tone pass — DEFERRED BATCH" section below).

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

### Phase 4 [SHIPPED in Session 41]: PDF export of combined report

Status: Complete. End-to-end verified across three Lovable prompts (initial 5-file build + two fix passes for jsPDF rendering issues).

What shipped:

- `src/lib/generateAirsaPdf.ts` (NEW): jsPDF native renderer mirroring `generateNaiPdf.ts` structure. Cover page + 14 sections (Header always-on, 12 toggleable, Section 3 buttons skipped). All status colors hardcoded to match canonical Session 40 STATUS_COLORS mapping including blind_spot dash pattern. Lollipop rendered as native primitives (lines + circles) on its own page, level-zone shading bands pre-blended against white at 60% to dodge jsPDF GState reliability issues. Filename pattern `BrainWise-AIRSA[-Coach][-SelfOnly]-<LastName>-<YYYY-MM-DD>.pdf`. Text fully selectable.
- `src/lib/assemblePdfDataForUser.ts` (EDIT): added `assembleAirsaPdfData()` export. Existing PTP/NAI assembly untouched. Reuses `fetchCommon()` helper.
- `src/components/results/ExportPdfModal.tsx` (EDIT): added `AirsaPdfSectionsUi`, `AIRSA_GROUPS` config, `instrumentType: "AIRSA"` branch, `onExportAirsa` prop. PTP/NAI code paths untouched.
- `src/pages/MyResults.tsx` (EDIT): added `handleAirsaPdfExport` callback. Lifted `<ExportPdfModal>` out of `!isAIRSA` branch so it renders for all instruments. AIRSA dispatch wired correctly.
- `src/components/results/AirsaCombinedReport.tsx` (EDIT): replaced `alert("PDF export coming soon")` stub with `onExportClick` prop. Original 1360-line component otherwise untouched, preserving all Session 40 visual polish and Rules of Hooks structure.

Three bugs fixed across v2 and v3 prompts:

- BUG-A: Star ★ rendering as ampersand `&` due to jsPDF default helvetica using WinAnsiEncoding (no U+2605 codepoint). Fix: PRIORITY_GLYPH = "*" constant in PDF generator only; on-screen report keeps ★.
- BUG-B: Skill reference list rendering one entry per page due to height calc using `rowH + 2` against an undersized constant. Fix: compute actual entry height from headingH + domainH + descLines * 4.2 + padH, set font BEFORE splitTextToSize, use computed height for both ensureBlockSpace and y advance.
- BUG-C: Top 3 priorities cards splitting across pages with extra page break. Same root cause as BUG-B; same fix shape applied to priority card rendering.
- BUG-D: Methodology footer "Report generated —" missing date because AI section facet_data does not carry generated_at. Fix: fall back to assessment_results.created_at in assembler; replace em-dash placeholders with hyphens in generator.
- BUG-E: Profile overview heading orphaned from sand body card on prior page; sand body wrapping at ~110mm instead of full content width. Cause: page-break check ran AFTER heading was drawn, and wrap width was computed against stale narrow value. Fix: compute card height first, pass to sectionHeading as minContentNeeded argument so heading and card always land on the same page; use CONTENT_W - 12 wrap width matching the "What this means" cards.

Final PDF: 9 pages for Maya dual-rater fixture (cover + heatmap + Profile overview + What this means + Action plan + Lollipop + Conversation guide + Top priorities + Cross-instrument placeholder + Skill reference + Methodology). All toggles work; self-only variant verified with `-SelfOnly` filename suffix and lollipop single-dot mode.

### Phase 5 [HIGH but POST-LAUNCH OK, BACKEND SHIPPED in Session 43]: AIRSA org dashboard

Strategic frame designed and locked Session 41. Backend recon completed Session 42. Phase 5a backend (RPC + Edge Function) shipped Session 43 and verified against the seeded fixture. Phase 5b frontend (5 tabs) is the remaining piece.

**Central thesis:** AIRSA's dashboard answers a structurally different question than PTP/NAI. Where PTP/NAI tell leadership about population states (threat reactivity, cognitive friction), AIRSA tells leadership about **calibration** — how accurately the organization sees its own AI talent. The data shape is fundamentally different: AIRSA is the only dual-rater instrument, so the org-level data isn't a distribution of scores but a distribution of agreements and disagreements.

**Headline metric: Talent Calibration Index (TCI)**

- Range: 0-100, higher is better
- Formula: `TCI = (count of aligned + confirmed_strength) / (total assessed skill-pairs) × 100`
- Confirmed gaps do NOT count positive (real capability gap, not earned strength)
- Stored in `org_dashboard_narratives.index_score` (existing polymorphic column)

Three companion sub-metrics in the headline strip: Alignment rate (any same-direction read), Blind spot rate, Underestimate rate.

**Tab structure (5 tabs, mirrors PTP/NAI):**

1. **Overview**: persistent header with TCI; slice controls (All / Department / Level / Team — Manager Calibration data is computed by iterating supervisors INSIDE the RPC, no `'supervisor'` slice_type); 4 sub-metric cards; AI workforce narrative inline as expandable card (top 3 recommended actions surfaced when expanded); Greatest Growth Opportunities / Strengths to Capitalize paired panels (top 2 skills + top 2 domains per panel, full ranking via expand link); Calibration Map (visual centerpiece); Risk flags.

2. **Domains**: 8 domain cards (PTP dimension card pattern). Each card: domain name + colored dot, average self-readiness 3-zone bar, average manager-readiness 3-zone bar, status distribution 5-segment stacked bar using STATUS_COLORS. Click to expand for per-skill breakdown within domain.

3. **Skill Inventory**: sortable filterable table (Skill # | Name | Domain | Self avg | Manager avg | TCI | Blind spot % | Underestimate % | n). Default sort = `cps_growth DESC` ("Sort by growth priority"). Row expand: per-department TCI for that skill, top blind-spot departments, top underestimate departments, AI-generated intervention recommendation.

4. **Manager Calibration** (AIRSA-unique tab, NOT in PTP/NAI): aggregates by `users.supervisor_user_id` chain, computed inside the RPC. Per-manager panel: name, report count, TCI scoped to their reports, blind-spot rate vs underestimate rate (asymmetry signals over-estimator vs under-estimator tendency), calibration consistency. Top 5 best-calibrated / Bottom 5. **Privacy threshold: minimum 3 reports per manager** (otherwise suppressed with "n<3" tooltip).

5. **Trends + Cross-Instrument**: LineChart of TCI over time (PTP/NAI Trends pattern); PTP × AIRSA and NAI × AIRSA correlations using existing C.A.F.E.S–PTP co-elevation framework.

**Composite Priority Score (CPS) — locked Session 41**

Each skill and domain gets two scores per slice:

- `cps_growth = (1 - readiness_index) * misalignment_weight`
- `cps_strength = confirmed_strength_pct`

Where readiness_index maps Foundational=0.0 / Proficient=0.5 / Advanced=1.0 averaged across all pairs in the slice, and misalignment_weight = `1 + (blind_spot_pct + confirmed_gap_pct) / 100` bounded [1.0, 2.0]. Tie-breakers: growth prefers higher blind_spot_pct (org doesn't yet see the problem), strength prefers higher n (more reliable signal). Suppression: n < 5 excluded. Frontend slices [0..2) for the panel, [2..] for the expand-full view.

**Calibration Map (visual centerpiece):**

- Rows: 24 skills, grouped visually by 8 domain bands
- Columns: departments (or active slice value)
- Cell color: locked STATUS_COLORS by modal status; intensity by % of pairs in that status
- Priority markers (Session 41 lock): orange ▲ for top 2 growth skills, green ◆ for top 2 strength skills; markers track active slice's rankings
- Hover popover: n, % aligned, % blind, % under
- Click: drill into underlying pairs (privacy threshold respected)
- Suppressed cells (n < 5): rendered gray with "n<5" tooltip

**Schema strategy (locked Session 41, confirmed Session 42):**

Match PTP/NAI pattern. Reuse `org_dashboard_narratives` table with `instrument_id = 'INST-003'`. AIRSA-specific aggregates carried in existing `dimension_scores` JSONB column. AI workforce narrative cached in `narrative_text` JSONB column. TCI carried in `index_score` numeric column. **No new table. No CHECK constraint migration. No table migrations needed for Phase 5a** (Session 42 recon confirmed existing `'team'` slice routes by `supervisor_user_id`).

**Cadence (locked Session 41):**

Match PTP/NAI exactly. Live RPC `get_airsa_aggregate(p_slice_type, p_slice_value)` computes aggregates from `assessment_results` on each dashboard load. No nightly cron, no pre-computed aggregate table. AI narrative cached and regenerated on user click via new Edge Function `generate-airsa-org-narrative` (Class A JWT via `auth.getClaims`, mirrors `generate-dashboard-narrative` v22 — corrected from Session 41's Class B specification after recon).

**Privacy thresholds (locked):**

- Calibration Map cells, Skill Inventory rollups, Trends per-period: minimum 5 pairs
- Manager Calibration tab: minimum 3 reports per manager
- Suppressed everything renders gray with "n<X" tooltip

**Phase 5a backend** [SHIPPED in Session 43]. RPC `get_airsa_aggregate` and Edge Function `generate-airsa-org-narrative` v1 both deployed and verified end-to-end against the seeded fixture. Full RPC payload shape with worked example in architecture-reference.md §10.6. Edge Function auth model and SOC 2 markers in arch-ref §10.7 and §8.

**Phase 5b frontend** (5 tabs of UI; Calibration Map; Manager Calibration tab; cross-instrument tab). Mirror NAI's `CompanyDashboard.tsx` patterns where applicable.

**Deferred to v2 (post-launch):** skill-level radar chart on 24 axes (unreadable; heatmap is better); time-comparison overlays on Calibration Map; anonymous self-report mode; predictive "if you close blind spots in Skill X, expected TCI gain is Y" (requires platform-wide outcome data not yet available).

### Phase 6 [SHIPPED]: Instrument toggle interactions

(Per Session 38 closeout; pending manager rows stay dormant when AIRSA is toggled off.)

### Phase 7 [MEDIUM]: Cross-instrument recommendations wiring for AIRSA

Required for the airsa_cross_instrument section to function for users with PTP or NAI completed. The Phase 3e backend implementation reads dimension_scores from existing PTP/NAI rows; no schema changes needed. trigger_logic table additions for source_instrument = 'INST-003' rules are still TBD.

If not done before launch, the cross-instrument section renders empty for users without PTP/NAI (acceptable degraded state for v1).

### Phase 8 [MEDIUM]: Cleanup verification

- Confirm UI handles superseded AIRSA results correctly
- Verify Cole Plummer's existing superseded result does not appear in his account UI
- Existing cron jobs (if any) that scan assessment_results properly skip superseded_at IS NOT NULL rows

## Top priority items for Session 44 opening

### [HIGH] Phase 5b frontend build — AIRSA org dashboard

Single coordinated Lovable prompt covering 5 tabs of UI mirroring NAI's `CompanyDashboard.tsx` patterns. Backend is ready: RPC `get_airsa_aggregate` returns the full §10.6 shape, Edge Function `generate-airsa-org-narrative` is deployed at v1. Frontend wiring is the only remaining piece.

First sub-task before writing the Lovable prompt: pull `src/pages/company/CompanyDashboard.tsx` and related files via GitHub MCP (or curl with line ranges if files are too large) so the AIRSA mirroring is precise. Identify which patterns to reuse verbatim and which need AIRSA-specific variants (Calibration Map, Manager Calibration tab, status pills with STATUS_COLORS). Specifically check how NAI CompanyDashboard handles slice controls, AI narrative regeneration, and the skill-inventory-style sortable table.

Second sub-task: lock domain coloring before writing the prompt. Pull individual AIRSA results page palette from AirsaCombinedReport.tsx and assign 8 colors to the 8 domains. Avoid Green+Teal pairing in pastel contexts.

5 tabs: Overview / Domains / Skill Inventory / Manager Calibration / Trends + Cross-Instrument. Calibration Map as visual centerpiece with orange ▲ (top growth) and green ◆ (top strength) priority markers tracking the active slice's CPS rankings. Greatest Growth Opportunities / Strengths to Capitalize panels on Overview using CPS-ranked top 2 skills + top 2 domains from the RPC's `rankings` payload. AI workforce narrative as inline expandable card on Overview tab (NOT a separate tab). Manager Calibration tab consumes the `manager_calibration` array directly; suppression already applied by RPC at n>=3.

## AI tone pass — DEFERRED BATCH

### [MEDIUM] AI generator tone pass across all instrument-level generators

Consolidated batch covering all AI Edge Functions on the platform. Specific items previously logged from Sessions 41 and 42 (residual "this creates" leakage, slight inference-overreach phrasing, fine-tuning toward purer factual observation) plus a full review of language quality across:

- generate-airsa-profile-overview (v5)
- generate-airsa-what-this-means (v3)
- generate-airsa-action-plan (v3)
- generate-airsa-conversation-guide (v3)
- generate-airsa-top-priorities (v2)
- generate-airsa-cross-instrument (v2)
- generate-airsa-org-narrative (v1, NEW Session 43)
- generate-dashboard-narrative (v22, PTP+NAI org)
- generate-facet-interpretations (v23, PTP+NAI individual)
- generate-cross-instrument-recommendations (v7)
- generate-nai-delta-narrative (v10)
- generate-ptp-delta-narrative (v7)
- ai-chat (v29)

Approach: pull all prompt blocks side-by-side, identify shared banned-words list, identify shared tone-discipline rules, write a single cross-cutting tone-pass spec, then re-deploy each function with refined prompt. Run before launch but not launch-blocking. Do NOT touch generator infrastructure or auth — prompt body only.

Target session: post-Phase 5b frontend, pre-launch. Estimated 1 session if batched well.

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

## Session 41 design decisions locked

### Talent Calibration Index (TCI) — headline metric for AIRSA org dashboard

`TCI = (count of aligned + confirmed_strength) / (total assessed skill-pairs) × 100`. Range 0-100, higher is better. Confirmed gaps do NOT count positive (real capability gap, not earned strength). Stored in `org_dashboard_narratives.index_score` (existing polymorphic numeric column).

### Composite Priority Score (CPS) — drives Greatest Growth / Strengths panels and Skill Inventory default sort

`cps_growth = (1 - readiness_index) * misalignment_weight` where readiness_index = avg(self+manager levels) mapped to [0,1] (Foundational=0, Proficient=0.5, Advanced=1.0) and misalignment_weight = `1 + (blind_spot_pct + confirmed_gap_pct) / 100` bounded [1.0, 2.0]. `cps_strength = confirmed_strength_pct`. Tie-breakers: growth prefers higher blind_spot_pct, strength prefers higher n. Suppression at n < 5.

### Calibration Map — visual centerpiece of AIRSA org Overview tab

24-skill × N-departments heatmap. Cell color = locked STATUS_COLORS by modal status. Cell intensity = % of pairs with that status. Priority markers: orange ▲ for top 2 growth skills, green ◆ for top 2 strength skills, on row labels, tracking the active slice's CPS rankings.

### AIRSA org dashboard schema strategy

Match PTP/NAI exactly. Reuse `org_dashboard_narratives` table with `instrument_id = 'INST-003'`. Aggregates carried in `dimension_scores` JSONB. AI narrative cached in `narrative_text` JSONB. TCI in `index_score` numeric. No new aggregate table. No CHECK constraint migration (Session 42 recon).

### AIRSA org dashboard cadence

Live RPC computation per dashboard load via new `get_airsa_aggregate(p_slice_type, p_slice_value)`, mirroring PTP/NAI `get_instrument_aggregate` pattern. No nightly cron, no pre-computed aggregate table. AI narrative cached and regenerated on user-triggered click via new Edge Function `generate-airsa-org-narrative` (Class A JWT, corrected Session 42).

### Manager Calibration tab privacy threshold

Minimum 3 reports per manager required to display the manager's calibration breakdown. Cells below threshold render as suppressed gray with "n<3" tooltip. Coarser threshold than the 5-pair platform standard because manager cohort sizes are inherently smaller; the trade-off is intentional to make the tab usable in real-customer accounts.

### jsPDF rendering constraints (architectural learnings from Phase 4)

1. **WinAnsiEncoding limitation.** jsPDF default helvetica uses WinAnsiEncoding which excludes U+2605 (★). The encoder substitutes a fallback character (observed: ampersand `&`). Pattern: use ASCII-equivalent glyphs in PDFs, reserve Unicode glyphs for on-screen contexts. Loading custom Unicode fonts is heavyweight and not worth it for single-character substitutions.

2. **splitTextToSize font-state dependency.** jsPDF's `splitTextToSize(text, width)` uses the CURRENT font for width calculation. Setting font BEFORE calling splitTextToSize is the canonical pattern (already commented in `generateNaiPdf.ts` line 406-407). Skipping this produces correct text but wrong wrap width, causing entries to render at narrow column widths even when full content area is available.

3. **Section heading anti-orphan pattern.** When a section has a body card whose height is computable upfront, pass the card height + heading clearance as the `minContentNeeded` argument to `sectionHeading()`. This forces a page break BEFORE drawing the heading if the page can't fit heading + card together. Skipping this orphans the heading on one page with the body card on the next.

## Session 42 design decisions locked

### AIRSA scale labels

Confirmed during Session 42 fixture seeding: AIRSA frequency scale is `0=Never, 1=Rarely, 2=Often, 3=Consistently`. NOT "Always". Items table values verified against this convention. Frontend, PDF, and AI prompts must all use this labeling.

### No `'supervisor'` slice_type

Manager Calibration tab data is computed by iterating supervisors INSIDE the `get_airsa_aggregate` RPC, not via a separate slice_type. Existing `'team'` slice already routes by `supervisor_user_id`. No `slice_type` CHECK constraint migration is needed for Phase 5a.

### AIRSA org dashboard Edge Function uses Class A JWT

Corrected from Session 41 handoff specification of Class B internal-secret. The dashboard-level AI generator is user-triggered from the frontend (Regenerate AI button), so it has full JWT context. Pattern mirrors `generate-dashboard-narrative` v22 exactly. Class B was reserved for service-to-service calls (calculate-scores fan-out to individual AIRSA generators); the org-narrative path does not use that pattern.

### AI workforce narrative inline on Overview tab

Renders as expandable card on Overview, NOT as a separate sixth tab. Top 3 recommended actions surface when the card is expanded. Collapsed default state shows a 1-2 sentence summary. Pattern matches PTP/NAI Overview AI summary cards.

### [SHIPPED in Session 39]: NAI Saturation color alignment

Decision shipped. NAI Saturation (DIM-NAI-05) is now mustard #7a5800 across all NAI individual report files, matching the dashboards. After this ship, #FFB703 exists only as the --bw-amber brand token (used by --warning semantic and other UI elements).

## Session 43 design decisions locked

### get_airsa_aggregate suppression check is on eligible pool, not pair count

Initial implementation suppressed on `pair_count` (eligible_count × 24 skills), which would have allowed n=1 team slices through. Fixed in second migration to check `array_length(v_participant_ids)` directly, matching `get_instrument_aggregate` semantics. Documented as architectural constraint in arch-ref §8.

### generate-airsa-org-narrative is hybrid Class A + Class B

Class A primary for frontend Regenerate AI button (forwards user JWT to RPC client so `auth.uid()` resolves inside SECURITY DEFINER RPC). Class B retained as hybrid path for future programmatic regen, requiring `organization_id` in body since there's no JWT to derive it from. Mirrors AIRSA individual generator hybrid pattern.

### CPS tie-breakers in RPC ranking arrays

Growth ranking: `ORDER BY cps_growth DESC NULLS LAST, blind_spot_pct DESC NULLS LAST` (matches Session 41 design). Strength ranking: `ORDER BY cps_strength DESC NULLS LAST, n DESC` (more reliable signal preferred). Locked in RPC body, not configurable from caller.

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
