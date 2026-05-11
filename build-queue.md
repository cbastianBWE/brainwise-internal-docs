# BrainWise Build Queue

*v52 - Session 55 CLOSE (Phase 4 backend prep COMPLETE + Lovable Prompt 1 landed and verified. Backend: 8 migrations applied (notifications + content_items CHECKs + lesson_blocks infrastructure + 10 authoring CRUD RPCs + AI authoring infrastructure with voice presets and context blocks). Frontend: Content Authoring shell live in production. AI Edge Functions (3) drafted locally but not deployed pending canonical _shared/impersonation_gate.ts source confirmation in Session 56. New standing protocol locked: every Lovable prompt now requires backend + frontend + branding recon (3 passes) before being written; see architecture-reference §30. New build queue items: AI Edge Function deployment (Session 56 first task), --bw-mustard token addition, NAI inline-hex audit and refactor to token, h1 style consistency sweep across super-admin pages, name vs title field cleanup in ContentAuthoring tree fallbacks. Next Lovable surface: Cert Path editor (Prompt 2). See architecture-reference §28-§30 for full Session 55 detail.)*

*v51 - Session 55 IN-PROGRESS — superseded by v52 CLOSE marker above.

*v50 - Session 54 CLOSED (Group C Phases 1, 2, 3, 3.5 SHIPPED. Backend COMPLETE for Group C scope; Phase 4 frontend work begins Session 55. Phase 3 notification email channel verified end-to-end live: certification_granted dispatched via notify_user → user_notifications + pg_net.http_post → send-email Edge Function → Resend → email_logs row send_status=sent. Vault secret name correction shipped late-session: notify_user originally looked up 'internal_function_secret' (lowercase) but production vault row is INTERNAL_FUNCTION_SECRET (uppercase, created Session 48 alongside Edge Function Secrets sync). Migration groupc_phase3_10 fixed the lookup; no runbook setup needed. Phase 3.5 added: enroll_user_in_certification_path (fans out cert path enrollment → coach_certifications row + N user_curriculum_assignments with source=certification_path, idempotency guard rejects duplicate active enrollment of same certification_type, notifies via certification_enrolled important type), unassign_mentor (Tier 2; sets coach_mentor_assignments.ended_at + end_reason), unassign_curriculum (Tier 2; sets user_curriculum_assignments.status=unassigned preserving content_item_completions for CC7.2 audit retention). Both pre-existing coach_certification_actors (Q5 actor flow target) and coach_invitations (Q4A invitation lifecycle) verified to exist in schema from prior work. Group C deferred-to-future-session backend gaps logged: accept_coach_invitation RPC (Q4A — coach invitation accept does not currently create coach_certifications row; deferred until invitation-accept UX surfaces in dedicated phase), Phase 7 actor flow RPCs (per scope), audience_tag computation (Phase 5 problem when trainee learning UI consumes). Phase 4 starts Session 55: Lovable build of /super-admin/learning portal — cert path editor, curriculum editor, module editor, polymorphic content item editor, quiz authoring, mentor assignment UI, direct curriculum assignment UI.)*

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

## Session 44 deltas summary

Phase 5b SHIPPED. AIRSA org dashboard live at `/company/airsa-dashboard` route, gated identically to NAI and PTP (RoleGuard `["company_admin", "org_admin", "brainwise_super_admin"]`). End-to-end verified against the seeded fixture across all 5 tabs.

**Backend delta**: `get_airsa_aggregate` RPC extended with `per_department_breakdown` field on every skill aggregate. Migration `add_per_department_breakdown_to_get_airsa_aggregate` adds two new CTEs (`skill_dept_agg` and `skill_dept_object`) that compute per-(department, skill) cells with n, tci, modal_status (most-frequent actual status value), blind_spot_pct, underestimate_pct, confirmed_strength_pct, and per-cell suppression flag. Cells with n<5 carry `suppressed: true`. Department-keyed (with `(unassigned)` fallback for null department_id). All Session 43 baseline values verified unchanged: TCI 40.1, pair_count 1128, status distribution 276/229/214/233/176, top growth Identity Flexibility 1.8030, top strength Algorithmic Vigilance 85.1064, 10 supervisors meeting n>=3 threshold. Department slice returns single-key per_department_breakdown. Wholesale eligible-pool suppression at n<5 still fires correctly. `generate-airsa-org-narrative` Edge Function v1 unchanged (reads RPC payload as opaque JSONB; new field passes through cleanly).

**Frontend delta**: New file `src/pages/company/AirsaDashboard.tsx` (single coordinated build across two prompts). Modifications to `src/App.tsx` (route addition with RoleGuard) and `src/components/AppSidebar.tsx` (Dashboards submenu third entry). All 5 tabs implemented:

- **Overview**: sticky header with TCI big number + 3 sub-metric chips; AI workforce narrative card with summary, Top 3 actions, and expand-for-full-narrative; Greatest Growth / Strengths to Capitalize paired panels (top 2 / top 5 expandable, with disambiguating subtitles for cps_growth 0-2 scale vs cps_strength %); Calibration Map (HTML CSS Grid, 24 skill rows × N department columns, locked STATUS_COLORS with dashed-border blind_spot, ▲ orange / ◆ green priority markers tracking active slice's CPS rankings, hover popover with n/TCI/blind/under, suppressed cells gray with n<5 tooltip); risk flags from latestNarrative.narrative_text.risk_flags
- **Domains**: 8 cards ordered by cps_growth DESC, each with colored dot, growth and strength CPS chips, big TCI, and status distribution stacked bar (4 segments since RPC currently returns confirmed_strength_pct, blind_spot_pct, underestimate_pct only; aligned + confirmed_gap combined into "Other" middle segment)
- **Skill Inventory**: sortable filterable table (default sort cps_growth DESC, click any column header to re-sort), domain filter dropdown, search by skill name, click-to-expand row showing per-department TCI cards using the new per_department_breakdown field
- **Manager Calibration**: Top 5 best-calibrated and Bottom 5 requiring-attention sections from manager_calibration array (already n>=3 suppressed in RPC), each card showing name, TCI, n_reports/n_skill_pairs, asymmetry label (Over-rates / Under-rates / Balanced via blind - underestimate threshold), blind/under breakdown
- **Trends + Cross-Instrument**: TCI-over-time LineChart from org_dashboard_narratives history filtered to instrument_id='INST-003' (renders empty state at 0 narratives, single-point notice at 1, full chart at 2+); placeholder cards for PTP×AIRSA and NAI×AIRSA correlations marked "Coming post-launch (Phase 7)"

**End-to-end verification first achieved this session**: full Anthropic-API-to-JSON-parse-to-INSERT chain on `generate-airsa-org-narrative` v1, validating the path Session 43 noted as not-yet-verifiable. Real session token POST returned 200 OK; row inserted at `org_dashboard_narratives` with index_score=40.10, participant_count=47, narrative_text containing summary + 3 top_interventions + 3 risk_flags + 5 interventions structured per the prompt JSON spec. AI narrative tone confirmed working end-to-end.

**Three latent bugs surfaced and fixed in Prompt 2**: (1) Team `<select>` was inheriting NAI/PTP pattern of populating from departments instead of supervisors, sending department_id where supervisor_user_id is expected — fixed via direct `users` table query under existing RLS, no new RPC; (2) slice control dropdowns lacked clearable first option after selection — first option labels changed from "Department ▾" / "Level ▾" / "Team ▾" to "All departments" / "All levels" / "All teams"; (3) cps_growth (0-2 composite) and cps_strength (%) panels lacked unit disambiguation — added italic subtitle line under each panel header. The first two bugs exist latently in NAI and PTP dashboards; deferred for post-launch fix to avoid regression risk on dashboards already in production use.

**Architectural constraint added** (arch-ref §8): when extending an existing RPC's payload shape, new JSONB fields pass through Edge Functions that read the payload as opaque (no field iteration in their own logic) without redeployment. Verified for `generate-airsa-org-narrative` consuming the new `per_department_breakdown` field with no Edge Function changes.

**Documented test fixture drift**: arch-ref §11.1 said Engineering 18, Marketing 13. Actual on Session 44 verification: Engineering 19 users (18 with AIRSA), Marketing 16 users (15 with AIRSA), Finance unchanged at 14, Executive still 5 users with 0 AIRSA. The 47 AIRSA pair total is unchanged from Session 42 close. Calibration Map renders 3 columns (Eng/Fin/Mkt) on the test fixture; Executive will appear automatically once seeded with AIRSA pairs. Not blocking.

**Risk-flag color bug observed but NOT fixed in Session 44**: HIGH risk flags render with Tailwind red (#dc2626 / #fee2e2 / #991b1b) instead of brand orange variants per arch-ref §6.1. Logged as top Session 45 priority below.

## Session 45 deltas summary

Multiple parallel tracks shipped this session: AIRSA dashboard PDF export, AIRSA AI workforce narrative voice rewrite, NAI dashboard PDF generator extraction (Option A foundation), risk-flag color fix, two PDF/UI rendering fixes, plus full recon and scope doc for the Org Overview Dashboard and AIRSA cross-instrument extensions.

**Sub-task 1 SHIPPED — Risk-flag color fix.** Per Cole's call (Option B over Option A), HIGH = solid `ORANGE` chrome with white badge text + ORANGE borderLeft preserved; WARN = `#fef0e7` peach fill + `ORANGE` 4px borderLeft + ORANGE badge text on tint. Three single-character edits in `AirsaDashboard.tsx` lines 750-776.

**Sub-task 3 SHIPPED — AIRSA org dashboard PDF export.** New file `src/lib/generateAIRSADashboardPdf.ts` (~1276 lines after Lovable). PTP-pattern mirror with AIRSA-specific helpers: `cleanMarkdown`, ASCII glyph substitutions (`^` for ▲, `+` for ◆), `sectionHeading(title, minContentNeeded)` anti-orphan pattern, page geometry (PAGE_W=210, MARGIN_L/R=15, CONTENT_W=180). Sections: Cover (NAVY hero band, 4-card metric strip) → Overview (calibration summary card + always-expanded narrative + 2 ranking panels + Calibration Map + risk flags) → Domains (8 cards stacked-bar) → Skill Inventory (24-row table, columns sum to 180mm) → Manager Calibration (top 5/bottom 5 cards) → Trends (TCI history table only). Calibration Map: 60mm skill column + dept columns at `(180-60)/N` mm, max 8 columns with overflow note, dashed border on blind_spot via `setLineDashPattern([1.5,1.5])` then reset. Filename: `BrainWise-AIRSA-CompanyDashboard-YYYY-MM-DD.pdf`.

**NAI PDF generator extracted.** New file `src/lib/generateNAIDashboardPdf.ts` mirrors `generatePTPDashboardPdf.ts` structure. Replaced ~890-line inline jsPDF block in `CompanyDashboard.tsx` lines 753-1644 with imported function call. Decisions locked: camelCase keys for `NAIDashboardPdfSections` (overview, dimensions, interpretation, leaderPerspective, trends, interventions, crossInstrument), full PTP modal mirror dropping "No data yet" indicators, 360px width modal, single h2 title. Surfaced previously-dead `interventions` section that was gated on a key never set under old kebab-case state.

**AIRSA AI narrative voice rewrite — `generate-airsa-org-narrative` v2 deployed.** Skill names confirmed at 13-37 chars (avg 21) — short enough to drop skill numbers from prose without bloating. New prompt structure: AUDIENCE block targeting CPO/VP HR; VOCABULARY RULES table mapping internal terms (cps_growth, blind_spot, underestimate, confirmed_strength, confirmed_gap, aligned-Proficient) to plain-English substitutes; expanded BANNED words/phrases (concentrate, underpin, compound, destabilising, "the symmetry of", "the data tells us"); SECTION STRUCTURES enforcing lead paragraph + 2-3 hyphen bullets + closing paragraph for business_meaning/benefits/risks; numbered sequence (no opener/closer) for next_steps; "What this means:" + "What to do:" hyphen-bullet block for risk_flags detail. TCI introduced as "Talent Calibration Index (TCI)" first, then TCI thereafter. Edge function source saved at `/home/claude/edge-functions/generate-airsa-org-narrative/index.ts`. Cole regenerated test org narrative — voice "is great" per his feedback.

**Two rendering bugs fixed (Prompts 3 + 4).** Both shipped first try.

Prompt 3 — `bodyText` helper in `generateAIRSADashboardPdf.ts`. Two fixes:
1. Font-state leak: `renderContinuationHeader` set 10pt italic and reset weight but not size, causing splitTextToSize-measured 8.5pt lines to render at 10pt and overflow right margin (visible page 3 of first AIRSA PDF). Fix: re-apply `setFontSize(8.5)`, `setFont("helvetica", "normal")`, `setText(BLACK)` inside the for-loop after `checkPageBreak()` and before `doc.text()`.
2. Bullet rendering: split text on `\n` first; detect lines matching `/^[-*]\s+(.+)$/` (bullets) or `/^(\d+\.)\s+(.+)$/` (numbered); render with 4mm hanging indent + 1mm extra spacing before each list item; wrapped continuation lines indent past prefix.

Prompt 4 — `renderNarrativeText(text, fontSize, color)` helper inside `AirsaDashboard.tsx`. Splits on `\n`, classifies each line, buffers prose into `<p>`, renders bullets as flex rows with `paddingLeft: 16, marginBottom: 4`, numbered items with hanging-indent flex layout. Replaced 7 render points (summary card + 5 expanded narrative subsections + risk flag detail).

Send order was Prompt 4 first (frontend, instant verification), Prompt 3 second (PDF re-export). Both landed perfectly.

**Sub-task 2 (originally "Phase 7 cross-instrument wiring + test fixture seeding") PIVOTED then SCOPED for future session.** Recon completed in full:
- Test fixture overlap verified excellent: 44 PTP+AIRSA users, 34 NAI+AIRSA users, 32 all-three. **Sub-task 2b (test fixture seeding) DROPPED entirely** — no seeding needed.
- `org_cross_instrument_recommendations` schema already instrument-agnostic. **No migration needed.**
- `trigger_logic` table inventory: 11 rules total. INST-003 source has only 1 generic rule (TRG-011). Existing v7 Edge Function does NOT read from trigger_logic — uses hardcoded `CO_ELEVATION_MAPPINGS` array (7 NAI↔PTP pairings).
- v7 Edge Function source review: hardcoded reject `if (!["INST-001", "INST-002"].includes(primary_instrument_id)) throw`. Two prompt builders both NAI↔PTP focused. AIRSA's data shape (TCI, alignment_rate, status_distribution, manager_calibration) fundamentally different from PTP/NAI dimension averages.
- Cole's decision: build BOTH the per-dashboard AIRSA cross-instrument AND a new Org Overview dashboard. Three-way analysis (NAI×PTP×AIRSA) lives ONLY on Overview. Per-dashboard tabs stay 1×1 pairings (PTP×AIRSA, NAI×AIRSA, plus existing PTP×NAI). B2 path locked: use trigger_logic as actual source of truth (vs B1 which would hardcode mappings in code mirroring v7).

**Comprehensive scope document produced** at `/mnt/user-data/outputs/org-overview-and-airsa-cross-instrument-scope.md` (~720 lines, 4 phases). Phase 1 = trigger_logic seed (~12 new rules). Phase 2 = new Edge Function `generate-airsa-cross-instrument-recommendations`. Phase 3 = new Org Overview dashboard at `/company/overview` with 6 headline numbers (2 per instrument), synthesis narrative, cross-cutting actions, deep-dive links, new `org_overview_narratives` table. Phase 4 = wire AIRSA cross-instrument cards on AIRSA dashboard's Trends tab + add ×AIRSA sub-tabs to PTP and NAI dashboards via shared `CrossInstrumentCard` component. Estimated 3-5 sessions to execute in full. Doc is upload-ready as a session-opener.

**Architectural learnings logged** (added to arch-ref §8):
- jsPDF font-state leak through `renderContinuationHeader` requires re-applying font state on EVERY `doc.text()` call inside a multi-line wrapped-text loop, not just before `splitTextToSize`. The previous §5.6 rule 2 only addressed the measure step, not the render step.
- Frontend bullet rendering for AI-emitted hyphen-prefixed lines requires explicit string-split + line-classification rendering. `whiteSpace: pre-wrap` preserves newlines but provides zero visual hierarchy. Pattern locked in `renderNarrativeText` helper, portable to other dashboards.

**Voice work decision**: AIRSA voice rewrite (this session) was a one-instrument case study. Action-Oriented Voice Redesign across NAI/PTP individual report and dashboard surfaces remains in build queue. Sequencing matters: Voice Redesign should ship BEFORE Org Overview, otherwise the Overview will surface NAI/PTP narratives in the old clinical voice while AIRSA shows the new voice — inconsistent.

## Session 46 deltas summary

Pivot session away from AIRSA / cross-instrument workstream toward coach-tier and supervisor-tier features. Two items shipped end-to-end.

**Group C Phase 8 (Item 37) SHIPPED — Order Assessment certification gating in `CoachClients.tsx`.** Cole flagged this as a clean carve-out from the larger Group C scope: gating layer reads from existing `coach_certifications.status` and `certification_type` columns, no new schema needed. Verified during recon that the live CHECK constraint allows four `certification_type` values (`ptp_coach`, `ai_transformation_coach`, `ai_transformation_ptp_coach`, `my_brainwise_coach`) and three `status` values (`in_progress`, `certified`, `suspended`) — both diverge from the Group C scope doc's stated enums. Phase 8 standalone uses the conservative gating rule: only `status = 'certified'` allows ordering; all other statuses block. Forward-compatible with Group C Phase 1's planned revocation enum extension (Q9). Decision locked: `my_brainwise_coach` certifies for all four instruments (PTP, NAI, AIRSA, HSS), same as Combined.

Mapping table locked at `CERT_TYPE_TO_INSTRUMENTS` in `CoachClients.tsx`:
- `ptp_coach` → {PTP}
- `ai_transformation_coach` → {NAI, AIRSA, HSS}
- `ai_transformation_ptp_coach` → {PTP, NAI, AIRSA, HSS}
- `my_brainwise_coach` → {PTP, NAI, AIRSA, HSS}

Frontend changes (single Lovable prompt): new `useEffect` fetching `coach_certifications` rows where `user_id = user.id AND status = 'certified'` on mount; derives `allowedInstrumentIds: Set<string>` via union of mapping table; filters the dialog instrument-list render at line 519; disables both "Order Assessment for New Client" (line 482) and "Order Assessment for This Client" (line 706) buttons when allowed set is empty, with tooltip "You need an active certification to order assessments"; renders empty-state message inside dialog with link to `/certifications` when allowed set is empty.

Test fixture: seeded one `coach_certifications` row for `testcoach@gmail.com` (account_type `coach`, `is_internal_test = true`, no organization). Verified 7-state matrix end-to-end: Combined → PTP-only → AI Transformation only → my_brainwise_coach → in_progress → suspended → zero-rows. All cases gated correctly. `auto_grant_combined_certification` trigger fires AFTER UPDATE only (not INSERT), so direct insertion of certified rows during seeding doesn't interfere — verified during recon.

Build Queue Item 37 closed. Group C Phase 8 absorbed.

**Shared Results "My direct reports only" toggle SHIPPED.** Replaced the previously-considered "My Team tab" idea (never written into the build queue, only floated in conversation). Single toggle pill on the existing `/shared-results` page, only visible when `get_my_direct_reports()` RPC returns ≥1 row for the viewer.

Backend: no new RPC needed. `get_my_direct_reports()` already exists (returns `out_user_id, out_email, out_full_name, out_org_level, out_department_id, out_department_name`).

Frontend changes (single Lovable prompt): two new state declarations (`directReportIds: Set<string>`, `myReportsOnly: boolean`); new `useEffect` calling `get_my_direct_reports()` on mount, storing the IDs; `myReportsOnly` reset added to existing instrument-change reset block (lines 57-77 region); filter clause added to `filteredPeers` memo: `if (myReportsOnly && !directReportIds.has(p.user_id)) return false;`; toggle pill rendered conditionally between department dropdown and existing supervisor dropdown, using shadcn `Button` with variant flip on active state, `Users` icon from lucide-react (already imported).

Verified end-to-end with `testclientbwe+supervisor@gmail.com` (David Supervisor, 2 direct reports: Demo Lane Nelson with PTP+AIRSA, Maya Employee with AIRSA only). Toggle hidden for non-supervisors implicitly (button doesn't render when set is empty). Toggle on AIRSA narrows correctly to both reports. Toggle on PTP narrows to direct reports who have shared PTP — zero in the current test fixture state since neither has completed PTP yet. All four filters (name, department, existing supervisor dropdown, new toggle) compose with AND semantics.

The existing supervisor-filter dropdown at `SharedResults.tsx` lines 173-185 is left intact. It does something different: it filters peers by `peer.supervisor_user_id === <some other supervisor>` rather than narrowing to the viewer's own direct reports. Latent bug noted but not fixed: the supervisors list at lines 87-93 only includes a supervisor if that supervisor is also a peer in the result list, so many supervisors silently won't appear in the dropdown. Not fixing in Session 46.

## Session 47 deltas summary

Group D backend (Phases 1-3 of the locked Group D scope) shipped end-to-end. Schema additions to `coach_clients`: `expires_at`, `revoked_at`, `invitation_source`, `client_first_name`, `client_last_name`. New `coach_pending_bulk_batches` table for stripe-webhook to recreate rows on coach-paid bulk checkout completion. New RPCs: `bulk_coach_invitation_create` (per-row BEGIN/EXCEPTION isolation, 75-row cap, certification gating reuse), `coach_invitation_revoke` (RPC + Edge Function pair). New Edge Function `bulk_coach_invite` v2. `create-checkout` extended with `coach_bulk_order` mode (Lovable-fragile per standing rule — verify `coach_user_id` after every Lovable prompt touching checkout-adjacent code). `stripe-webhook` v23 with new `coach_bulk_order` branch iterating over batch metadata, generating per-row coupons via `recalculateCombinedCouponForEmail` helper.

Session 47 was backend-only. Session 47-to-48 handoff was never written; Session 48 verified Session 47's backend during Phase 4-5 frontend work.

## Session 48 deltas summary

Single largest-shipping session in BrainWise history. Group D Phases 4-5-6 shipped (frontend + polish), email infrastructure shipped, refund automation shipped, terms of service updated.

**Group D Phase 4-5 frontend shipped.** Three Lovable prompts plus remediation. `BulkInviteModal.tsx` (607 lines, three-stage flow: Validate / Preview / Dispatch+Results, CSV upload via xlsx@^0.18.5, 75-row cap, cert gating, sticky defaults, payment_mode self_pay/coach_paid lowercase). `ShareableLinkModal.tsx` (287 lines, qrcode.react@^4.0.1 dependency added, both self-pay and coach-paid paths). `PendingInvitations.tsx` (Card→Tab refactor, query filters revoked_at IS NULL + expires_at, per-row Copy link / Revoke / Resend actions). `CoachClients.tsx` updated with DropdownMenu (Single client / Bulk invite / Generate shareable link), `perAssessmentPrice` state querying `subscription_plans` for dynamic price ($29.99 Per Assessment), URL parameter handler for `?bulk_checkout=success|cancelled`.

**Group D Phase 6 polish completed in two prompts.** Polish prompt (8 changes): Tooltip primitive replaces `title` attribute on disabled DropdownMenu trigger, empty-state cert gating, new stat semantics (`totalSignedUpClients`, `pendingInvitationsCount`, `assessmentsPending`), 4-card grid layout, `email_type` and `source` parameters added to send-email calls, `border-red-*` → `border-destructive`, PendingInvitations table tightening (MMM d dates, Coach/Self/Bulk/Single/Link badges). Stat fix prompt: `pendingInvitationsCount` filter corrected to exclude revoked + expired rows (was showing 23 instead of 21).

**email_logs table shipped (Option A + Option B).** Schema: id, email_type, recipient_email, subject, resend_message_id, send_status (sent|failed), error_message, source, sent_at, delivered_at, bounced_at, complained_at, last_status_event, last_status_at. RLS: super_admin SELECT only via account_type check, service role bypasses. 4 indexes (recipient_sent_at, resend_message_id partial, failures partial, problem_events partial). pg_cron `purge_email_logs_90d` daily 03:00 UTC. `send-email` v8: `logEmailDispatch` helper writing to email_logs on every code path with optional `email_type` and `source` parameters (default `unknown`). Captures Resend message_id.

**Resend webhook integration shipped.** `resend-webhook` Edge Function v1 verifies Svix signature (HMAC-SHA256 with `whsec_` prefix stripped), 5-minute timestamp freshness window. Looks up email_logs by resend_message_id, updates delivery status. If no match (Auth-system email), inserts new row with `email_type='auth_or_external'`. Endpoint: `https://svprhtzawnbzmumxnhsq.supabase.co/functions/v1/resend-webhook`. Subscribed events: email.sent, email.delivered, email.bounced, email.complained, email.delivery_delayed. Secret stored in Supabase Edge Function Secrets as `RESEND_WEBHOOK_SECRET`. Verified end-to-end: send-email writes row → Resend processes → webhook fires ~1s later → delivered_at populated.

**`coach_invitation_resend` Edge Function v1 shipped.** Per-client scope: clicking Resend on any pending row reminds client about ALL pending instruments under that coach. 24-hour rate limit per recipient_email + email_type='coach_reminder_pending' enforced via email_logs query. Class A JWT auth via auth.getClaims. shareable_link rows treated as first-send template ("Your coach prepared an assessment for you"). Other sources use reminder template ("Reminder: Your BrainWise Assessment is Waiting"). Error codes: unauthorized, not_found, rate_limited, nothing_to_remind, send_failed. PendingInvitations.tsx Resend button wired up with handleResend → toast variants per result. Rate limit verified end-to-end (second click within 24h returns "Reminder already sent recently" toast).

**Expiry sweep + auto-refund automation shipped.** Schema additions to `coach_clients`: `refunded_at`, `stripe_refund_id`, `refund_amount`, `refund_failure_reason`. Index on refunded_at DESC partial. New Edge Function `sweep_expired_invitations` v3 (Class C cron auth via `DISPATCHER_SHARED_SECRET` env, matches dispatch-grace-reminders convention). Filter: expires_at IS NOT NULL AND expires_at < NOW() AND revoked_at IS NULL AND assessment_id IS NULL. Per-row: stamps revoked_at → `recalcCouponAfterRevoke` (deletes Stripe coupon if last row, else recreates at lower amount) → `processAutoRefund` (per refund policy gate). Trigger metadata: `auto_expiry_sweep`. `coach_invitation_revoke` v3: added `processAutoRefund` helper alongside existing `recalcCouponAfterRevoke`. Trigger metadata: `manual_revoke`. Returns `refund: {refunded, amount, refund_id, reason}` in response. pg_cron `sweep_expired_coach_invitations` schedule moved from raw SQL UPDATE to `net.http_post` calling sweep_expired_invitations Edge Function. Schedule `45 3 * * *` (03:45 UTC daily, staggered after email_logs purge at 03:00 and dispatch_grace_reminders at 03:15). Vault secret name: `departure_dispatcher_shared_secret`.

**Locked refund policy (decision):**
- Auto-refund eligibility gate (ALL must be true): `coupon_redeemed = false AND assessment_id IS NULL AND payment_age <= 90 days AND payment_intent_id IS NOT NULL AND coupon_amount > 0`
- Both manual revoke AND automatic expiry trigger auto-refund through same `processAutoRefund` helper
- Individual purchases: 14-day refund window if assessment not started; manual processing only (no auto-refund Edge Function)
- Corporate contracts: all sales final per executed contract
- Verified end-to-end: real $29.99 refund processed against pi_3TVBck2FY7qIyIXA0xp2yuMN, refund_id `re_3TVBck2FY7qIyIXA0oApv0dD`, full pipeline (revoke → coupon deletion → refund → DB stamp) executed in ~1 second

**Schema additions to `assessment_purchases` for individual refund tracking** (manual processing only, no auto-refund): `refunded_at`, `stripe_refund_id`, `refund_amount`, `refund_failure_reason`, `refund_processed_by` (UUID FK users — audits which super_admin approved the refund).

**Terms of Service updated to v2** (effective May 9, 2026). Section 5.3 Coach-paid client assessments rewritten to reference auto-refund policy. Section 5.5 Refund policy rewritten with three buckets (Individual / Coach-paid / Corporate) and explicit eligibility rules. File path: `src/content/legal/termsContent.ts` (Terms.tsx is a thin wrapper consuming this content via LegalPageLayout).

## Session 49 deltas summary

Group A audit prequel SHIPPED + Group A Feature A1 Tier 1 backend SHIPPED. Larger than scoped at session open (originally just the prequel), but kept entirely backend-only and verified end-to-end before close. Cohort timeline preserved (Plan A confirmed: A1 frontend in Session 50, Group C starts Session 51).

**Audit log schema additions.** `super_admin_audit_log` got 9 new columns (ip_address, user_agent, reason, before_value, after_value, mode, expires_at, ended_at, end_reason) plus 2 new partial indexes (mode, session_id). `company_admin_audit_log` got 4 new columns (reason, before_value, after_value, super_admin_acting_as_user_id with FK to users) plus 1 partial index. Both tables had RLS preserved unchanged.

**Option C lookup table.** Replaced `super_admin_audit_log_action_type_check` CHECK constraint (15 hardcoded strings) with FK to new `public.super_admin_action_types` table. 19 action types seeded across 8 categories (15 carried from CHECK + 4 new for impersonation: impersonation_started, impersonation_ended, impersonation_action, impersonation_denied_action). Table includes metadata columns (requires_mfa, requires_justification, is_mutation, denylist_during_impersonation) for future enforcement use.

**`log_super_admin_action()` helper RPC.** Standardized argument signature `(p_target_user_id, p_target_org_id, p_action_type, p_before, p_after, p_reason, p_mode)`, returns inserted row's UUID. Actor derivation reads `request.jwt.claims` for `imp_actor_user_id` (Path 3 — works correctly pre-A1 with auth.uid() fallback AND post-A1 with impersonation claims). Session id from `imp_session_id` claim if present (so audit_session_replay groups all events from one impersonation). Mode prefixed with `impersonation:<imp_mode>:` when in impersonation context. Caller responsibility to gate on assert_super_admin (helper does NOT self-gate because in dual-attribution land auth.uid() = impersonated user).

**A1 impersonation infrastructure.** New `impersonation_sessions` table with immutability trigger (only ended_at + end_reason mutable, never DELETE), unique-active-per-admin INDEX (DB-level nested impersonation prevention), no-self-impersonation CHECK, justification length >= 10 CHECK. `validate_impersonation_session()` SECURITY DEFINER STABLE for cheap repeated calls. `assert_impersonation_allows()` enforces 9-category denylist mapped to scope 2.3.1-2.3.9 (identity_change, assessment_submission, privacy_consent, financial_transaction, outbound_user_communication, permission_change, corporate_admin_action, coach_action, lifecycle_action). Mode read from DB row not JWT (defense in depth).

**Custom Access Token Hook for impersonation claims.** `public.custom_access_token_hook(event jsonb)` injects imp_session_id, imp_actor_user_id, imp_mode, imp_expires_at into JWTs at issuance time. Auth method gate: only fires on `magiclink` or `token_refresh` (prevents target user's normal logins from inheriting impersonation context). EXCEPTION WHEN OTHERS wrapper ensures hook errors NEVER break platform auth. Cole registered hook in Dashboard → Auth → Hooks. 4 unit tests passing (no-session passthrough, auth-method-gate-blocks-password, magiclink-injects-all-four-claims, malformed-event-safe-fallback).

**MFA freshness via `check_mfa_freshness()`.** Service-role-only RPC reading `auth.mfa_amr_claims` for the caller's session, returns boolean for "TOTP within last p_max_age_seconds." Used by impersonation-start to enforce fresh-MFA gate (scope 2.2.7). Pattern B confirmed (Supabase Auth supports mid-session TOTP via auth.mfa.challenge() + auth.mfa.verify()).

**Three new Edge Functions.** `impersonation-start` v1: 8-gate pipeline (auth → super_admin → fresh MFA → target exists → not self → no nested → mode valid → justification valid), insert sessions row, write audit, generateLink + verifyOtp produces target-user session, hook decorates JWT with imp_* claims. Rollback on any post-insert failure. `impersonation-end` v1: ends session via impersonation token, dual-attribution audit row writes correctly via JWT-claim-aware helper. `sweep_expired_impersonation_sessions` v1: Class C cron auth, ends expired-but-not-ended sessions with end_reason='timeout', uses direct INSERT into super_admin_audit_log (cron-context exception since log_super_admin_action requires auth.uid()). Verified end-to-end: pre-expired test session swept, audit row written, ended_at = expires_at exactly.

**`*/5 * * * *` cron schedule.** `sweep_expired_impersonation_sessions` runs every 5 minutes (not the daily/15-min stagger convention) because impersonation sessions are 30-minute lifecycle. Worst-case post-expiry session lingering = 5 minutes server-side; frontend client-side timeout enforces the user-visible countdown.

**`_shared/impersonation_gate.ts` helper module.** Canonical Tier 2 enforcement helper. Exports `enforceImpersonationGate(client, category)` returning `{gated: false}` or `{gated: true, ...}` or throwing `ImpersonationDeniedError`. Plus `logImpersonationAction()` for callers to write impersonation_action audit rows after allowed mutations. Module deployed via `test-impersonation-gate` Edge Function (test-only) to validate bundling. Probe with no-auth confirmed clean 401 — module bundling resolved correctly.

**Edge Function reconnaissance complete.** Surveyed all 52 deployed Edge Functions (48 pre-Session 49 + 4 added this session). 27 require Tier 2 gating per scope 2.6.3 expanded for new functions (AIRSA supervisor flow, Group D coach functions, lifecycle functions, set-account-type — none of which were in the original scope's ~12-function list). 25 explicitly do not need gating with documented rationale: 8 per-user AI functions (user-scoped, ownership-checked), 3 cron, 2 webhook, 2 read-only, 3 internal helpers, 3 impersonation infrastructure, 3 public unauthenticated forms, 1 admin utility. Recon doc captured in Session 49→50 handoff.

**Architectural decision: Custom Access Token Hook over separate cookie.** Analyzed three options (JWT manual mint, separate cookie, Custom Access Token Hook). Chose Custom Access Token Hook with auth_method gate. Rationale: lowest build cost (~1 session backend vs 2-3 for cookie), preserves existing helper RPCs (no rework), single signed channel for SOC 2 defensibility, hook errors cannot break platform auth (EXCEPTION wrapper). Decision documented inline in custom_access_token_hook function comments.

**Edge Function `verify_jwt: false` convention preserved.** All Session 49 Edge Functions use `verify_jwt: false` with explicit `auth.getClaims` inside the function body. Matches existing convention. Build queue item: consider migration toward `verify_jwt: true` as SOC 2 hardening pass.

## Session 50 deltas summary

Tier 2 impersonation gate rollout PARTIAL — 17 of 23 in-scope Edge Functions spliced and probed. Floor was Phase A only; B and C did not start.

The 17 deployed: `set-account-type` v43 (permission_change), `ai-chat` v31 (outbound_user_communication), `delete-account` v8 (identity_change), `create-checkout` v49 (financial_transaction), `customer-portal` v35 (financial_transaction), `coach_invitation_revoke` v4 (coach_action), `coach_invitation_resend` v2 (coach_action), `reactivate-account` v8 (lifecycle_action), `airsa-supervisor-reminder` v4 (outbound_user_communication; recat from corporate_admin_action — self-rater initiates, not admin), `assign_epn_send` v9 (corporate_admin_action), `deactivate-and-notify` v7 (corporate_admin_action), `bulk-deactivate-and-notify` v7 (corporate_admin_action), `bulk_coach_invite` v4 (coach_action), `invitation_send` v10 (corporate_admin_action), `bulk_invitation_send` v9 (corporate_admin_action), `calculate-scores` v44 (assessment_submission), `submit-epn-assessment` v7 (assessment_submission). Each verified via no-auth probe (HTTP 401 or sanitized 500 — no module-bundling failures).

Four functions removed from the original 27-function Tier 2 list as misclassified: `peer-access-respond` and `verify-conversion` (email-link unauthenticated forms with token query param, no JWT possible) and `airsa-supervisor-invite` and `send-departure-emails` (Class B internal-secret receivers, no caller user JWT possible). Their CALLERS are gated, which is the correct architectural placement. Tier 2 list reduces from 27 to 23 functions.

Helper RPC behavior verified end-to-end via direct SQL JWT-claim simulation (5 test cases — all pass). DETAIL field format `imp_session_id=<uuid>` confirmed to match helper TypeScript regex `/imp_session_id=([0-9a-f-]+)/i`.

Three architectural learnings captured in architecture-reference.md §23:
- §23.2 Edge Function file-path conventions (4 distinct prefix styles)
- §23.3 Gate client requirement: anon-key + JWT, NEVER service-role (silent-failure mode)
- §23.4 Tier 2 recon corrections (4 functions reclassified)

Pre-existing security observation flagged but out of scope: `reactivate-account` allows any authenticated user to reactivate any deleted account by passing the email — no caller-vs-target ownership check. The impersonation gate adds defense for the impersonation case; the broader hole is a separate hardening item.

## Session 51 deltas summary

Tier 2 impersonation gate rollout COMPLETE — final 6 corporate_admin_action AI narrative generators shipped. 23 of 23 in-scope functions spliced.

Six functions deployed: `generate-departure-export` v8 (lifecycle_action — recon correction #5, recategorized from corporate_admin_action because caller is the deactivated employee retrieving their own data export, not an admin), `generate-airsa-org-narrative` v4 (HYBRID auth — gate only fires when `!isInternal`; internal-secret path skips the gate), `generate-cross-instrument-recommendations` v9, `generate-dashboard-narrative` v24, `generate-nai-delta-narrative` v12, `generate-ptp-delta-narrative` v9. Each verified via no-auth probe — clean HTTP 401.

One architectural delta surfaced and logged in architecture-reference.md §23.7: `Supabase:deploy_edge_function` prepends `source/` to the entrypoint_path automatically. Pass `entrypoint_path: "index.ts"` (naked, no prefix). Passing `source/index.ts` causes path doubling and BadRequestException. Discovered during the `generate-dashboard-narrative` deploy: first attempt with `source/index.ts` failed, retry with naked `index.ts` succeeded. This corrects/clarifies §23.2 which had implied the entrypoint_path was passed verbatim.

Phase B (A3 Phase 2 reporting RPCs), Phase C (A1 impersonation frontend), and Phase D (`/settings/access-history` page) move to Session 52. Group C Phase 1 originally targeted Session 51 → now Session 53 at earliest depending on whether Phase B/C/D fit in one session.

## Session 52 deltas summary

Phase B SHIPPED. Six SECURITY DEFINER RPCs deployed and verified for the audit reporting surface: `list_audit_events`, `audit_event_detail`, `audit_session_replay`, `export_audit_events`, `my_access_history`, `search_impersonation_targets`. All gated via `assert_super_admin()` except `my_access_history` (gated by `auth.uid() IS NOT NULL` since each user reads their own history). Filter shape locked as jsonb with seven keys: actor_user_id, target_user_id, action_type, date_from, date_to, mode, session_id. `export_audit_events` cap = 10,000 rows with `truncated` flag (graceful truncation, SOC 2 CC7.2 friendly). `my_access_history` UNIONs `super_admin_audit_log` (filtered on affected_user_id) and `company_admin_audit_log` (filtered on target_user_id) with an `audit_source` discriminator for the frontend. `audit_session_replay` returns single jsonb (`{session, events}`) for atomic gate + atomic session/event consistency. `pg_trgm` extension enabled to support ILIKE substring acceleration on user search. Full RPC catalog and design rationale in architecture-reference.md §24.

Phase B verification: production has 367 audit log rows across 10 distinct action types. Smoke tests confirmed: real-data joins working, filter exactness against COUNT ground truth, gate raises 42501 for non-super-admin callers, UNION isolation correct (orgmember test user shows 30 super_admin + 2 company_admin = 32 events, matches actor/target counts).

Phase C frontend recon COMPLETE. Read App.tsx, AppLayout.tsx, RoleGuard.tsx, ProtectedRoute.tsx, MfaChallenge.tsx, MfaEnrollment.tsx, useAuth.tsx, useUserProfile.tsx, useSuperAdminSession.tsx, AppSidebar.tsx, Settings.tsx, CompanyAccounts.tsx, PlatformHealth.tsx. Six integration decisions locked, captured in architecture-reference.md §25:

1. Banner injection at App.tsx-level (NOT AppLayout) so banner persists on bypass-AppLayout protected routes (Onboarding, MFA enrollment, demographic-form).
2. New `ImpersonationProvider` context between AuthProvider and Routes; reads JWT claims on every auth state change.
3. Impersonate entry: NEW `/super-admin/users` page (universal user search + row actions), NOT PlatformHealth or CompanyAccounts. Universal across account types, future actions slot in cleanly.
4. `MfaChallenge.tsx` gets one additive prop: optional `onCancel?: () => void`. Backwards-compatible.
5. `ProtectedRoute` does NOT bypass demographic/MFA/deactivation gates during impersonation (Option B locked) — Tier 2 backend denylist is the security layer.
6. Phase C is split into two prompts: C-1 (dormant infrastructure) and C-2 (entry + flow). Phase D is independent.

Three-prompt sequencing locked for Session 53:

- **Phase C-1**: ImpersonationProvider + ImpersonationBanner + ImpersonationChrome + MfaChallenge `onCancel` additive + App.tsx wiring + Tier 2 denylist audit.
- **Phase C-2**: SuperAdminUsers page + JustificationModal + sidebar nav update + redirectByRole update + impersonation-start/impersonation-end integration.
- **Phase D**: AccessHistory page + sidebar settings update + route registration.

Architecture-reference.md §20 schema clarification logged in §24.6: §20.1 and §20.2 ALTER TABLEs are CORRECT and verified against live DB. The actor column on `super_admin_audit_log` is `super_admin_user_id`, target is `affected_user_id`, org is `company_id`, jsonb detail is `detail`. The actor column on `company_admin_audit_log` is `actor_user_id`, target is `target_user_id`, org is `organization_id`, jsonb detail is `action_details`. Names matter for any RPC writing or filtering against these tables.

## Session 53 deltas summary

Phase C-1 pre-flight backend SHIPPED. Three Edge Function/migration deliveries unblocked the Phase C-1 Lovable prompt and closed two security gaps that Session 52 architectural decisions had assumed already covered.

**impersonation-end v2 (Session 53)**: Modified to mint fresh super admin tokens via generateLink + verifyOtp pattern (mirrors impersonation-start). Returns `{ success, restored: true, super_admin_user_id, access_token, refresh_token, expires_at }` at top level. Critical sequencing: ended_at set BEFORE generateLink fires, guaranteeing custom_access_token_hook does not stamp imp_* claims on the restored super admin token. Failure path returns `{ restored: false, restore_error }` with HTTP 200 — session is still ended at DB level even if token mint fails; frontend signs out and redirects to /login. Architecture-reference §26.1.

**is_impersonating() and is_impersonating_act() helpers + user_demographics RLS WITH CHECK (Session 53)**: Two SECURITY DEFINER STABLE helpers that read JWT claims for active impersonation, defense-in-depth verifying against impersonation_sessions DB row. Both granted EXECUTE to authenticated. user_demographics policy refactored from FOR ALL into split policies: SELECT allowed regardless of impersonation context (super admin observers can read), but INSERT/UPDATE/DELETE require NOT is_impersonating(). Both observe AND act mode block writes. Verification matrix passed all five scenarios. Architecture-reference §26.2.

**identity-mutation Edge Function v1 (Session 53)**: Single chokepoint for identity_change category mutations going through Supabase auth APIs (auth.updateUser for password/email; auth.mfa.enroll/unenroll). Class A explicit (verify_jwt=false; auth.getClaims inside). Calls enforceImpersonationGate("identity_change") first, raises 403 IMPERSONATION_DENIED for any impersonation context. Forwards via callerClient (pattern Z) so auth.mfa.enroll/unenroll work natively. Phase C-1.5 frontend rewires (folded into Phase C-1 prompt) point ResetPassword.tsx, Settings.tsx saveEmail, MfaEnrollment.tsx handleEnroll, and any unenroll surface at the wrapper. Architecture-reference §26.3.

**§25.9 partial reversal locked**: Original Session 52 decision that ProtectedRoute does NOT bypass demographic/MFA/deactivation gates during impersonation rested on the assumption that the Tier 2 backend denylist alone covered all paths. That assumption was false (RLS-only direct writes and Supabase auth APIs bypass the gate). With §26.2 and §26.3 closing the database and application paths, the frontend complement is to ALSO redirect /onboarding, /demographic-consent, /demographic-form, /mfa-enrollment, /peer-sharing-optin to /dashboard during impersonation. Defense in depth, three layers. Architecture-reference §26.4.

**Phase C-2 hotfix (mid-session 53)**: `/super-admin/users` page crashed with blank screen + console TypeError when search results contained any user with `account_type IS NULL`. Two production users in this state (`test@test.com`, `testclientbwe+testnewuser@gmail.com`) — both half-finished signups where the user authenticated but never picked an account type. Root cause: `formatAccountType` and `accountTypeBadgeVariant` in Users.tsx called `.split(...)` and `switch` on null. Fixed at the backend layer by patching `search_impersonation_targets` to `COALESCE(account_type, 'unknown')` so the RPC contract effectively guarantees a string. Frontend null-guards (Layer 2) added as defense in depth via small follow-up Lovable prompt. Schema-level fix to `users.account_type` nullability deferred — see new build queue item below.

**Three new build queue items logged (Session 53 mid)**:

- **MEDIUM (post-launch)**: Refactor `current_user_mfa_satisfied()` from factor-existence check to session-AAL check. Currently a user with a verified factor returns mfaSatisfied=true regardless of session aal1/aal2 — weaker than Supabase native AAL-based enforcement. Required for proper post-impersonation re-MFA flow. Architecture-reference §26.6.
- **LOW (post-launch)**: Replace hardcoded `v_denylist text[]` array in `assert_impersonation_allows` with a SELECT against a new `super_admin_denylist_categories` table. Drop the vestigial `super_admin_action_types.denylist_during_impersonation` column in the same migration. Benefits: queryable denylist for SOC 2 evidence collection. Architecture-reference §26.5.
- **LOW (post-launch)**: Audit other RLS-only direct-write tables for impersonation gaps. user_demographics was the obvious one; sweep for `users` self-update fields, `user_subscription_preferences`, `user_results_consent` etc. Add `NOT is_impersonating()` to WITH CHECK on any table where a super admin should not be able to mutate as the target.
- **MEDIUM (post-launch)**: Investigate and clean up `users.account_type IS NULL` rows. Currently 2 users in this state (1 marked is_internal_test=true, 1 marked false despite testclientbwe email pattern). Either backfill to `individual` based on signup intent, or constrain the column NOT NULL once data is clean. Today's hotfix masks the symptom at the RPC layer (COALESCE to 'unknown') but the underlying schema permits a state that no UX can produce intentionally.
- **HOOK HARDENING SHIPPED Session 53 close**: `custom_access_token_hook` now distinguishes legitimate impersonation-start token mints from stranded-session contamination. For `'otp'`/`'magiclink'` initial mints, the hook requires the matching `impersonation_sessions` row was created < 60 seconds ago (impersonation-start mints within ~2s; stranded rows are minutes+ old). For `'token_refresh'`, the hook requires the incoming JWT already carries `imp_session_id` matching the active row (refreshes preserve, never create). Investigated `auth.sessions` DELETE trigger as alternative; Supabase does NOT delete auth.sessions on logout (only expires them via expires_at), so a delete trigger would never fire on signOut events. The hook freshness gate solves the same problem at the right layer. Stranded rows still get cleaned by the existing 30-min cron sweep, but they can no longer pollute subsequent target-user logins while pending cleanup.

- **NICE-TO-HAVE (post-launch)**: Frontend `SIGNED_OUT` listener that calls `impersonation-end` before the JWT is destroyed. Belt-and-suspenders on top of the hook freshness gate. The user clicks Log Out → ImpersonationProvider's auth state listener catches `SIGNED_OUT` → calls impersonation-end if currently impersonating → updates DB row ended_at promptly. Race condition risk: JWT may already be invalidating by the time the call fires, so impersonation-end could 401. Acceptable — the cron sweep is the floor, the hook gate is the security boundary, this would just clean up the audit timeline faster.
- **LOW (post-launch)**: AccessHistory.tsx frontend null-guard for `formatActionType(action_category)`. Backend defense added in Session 53 (RPC now COALESCEs `action_category` to `'organization_admin_action'` for company_admin source rows), but frontend also calls `.replace()` on the value so a future RPC regression would crash again. Mirror the pattern from Users.tsx null-guard work.

Phase C-1, C-2, D Lovable prompts unblocked. Session 53 continues with frontend prompts.

**Phase C-2 frontend SHIPPED**: One Lovable prompt covering 7 files. 2 new (Users.tsx super admin search page with debounced query, kebab-dropdown action menu per row, separator above destructive Force pseudonymization stub; JustificationModal with two-step flow — justification + mode radio, then embedded MfaChallenge with onCancel back-to-step-1, plus error-code-aware toasts for MFA_REQUIRED/NESTED_IMPERSONATION/SELF_IMPERSONATION/TARGET_NOT_FOUND); 5 modified (ImpersonationProvider extends interface with targetEmail field populated via localStorage stash keyed by session_id, with cleanup in all three endImpersonation branches; ImpersonationBanner displays email when present and falls back to monospace user_id; App.tsx registers /super-admin/users route with RoleGuard + SuperAdminSessionProvider wrapping pattern and replaces /super-admin layout-only fallback with Navigate redirect; useAuth.redirectByRole changes super admin landing from /super-admin/health to /super-admin/users; AppSidebar adds User Management nav entry with UserSearch icon between My Results and Platform Health). Verified file-by-file post-Lovable: kebab-dropdown action pattern with five menu items in correct order, account type badges per the brand mapping (destructive for super_admin, default for org/company admin, secondary for coach, outline for individual/corporate), self-impersonation prevention at UX layer, debounced search at 250ms with p_limit 25, all four table states handled (empty/loading/error/no-results/results). Architecturally Phase C is complete; end-to-end impersonation flow live pending Cole's manual integration test.

**Phase D frontend SHIPPED**: One Lovable prompt covering 3 files. 1 new (AccessHistory.tsx at /settings/access-history — six columns When/Action/Actor/Source/Mode/Reason, source badges destructive=Super Admin/default=Org Admin, mode badges secondary=Observe/outline=Act, pagination 50 per page hidden when single page, Path A CSV export with 200-per-call RPC pagination up to 1000 cap, all states handled). 2 modified (App.tsx registers route as sibling of /settings/billing, no RoleGuard needed since auth wrapper handles it; AppSidebar adds Access History entry to BOTH settingsSubItems and coachSettingsSubItems arrays between Privacy & Permissions and Billing & Receipts using already-imported History icon). Verified file-by-file post-Lovable: pagination logic correct, CSV column structure matches spec, data flowed through cleanly.

**Mid-session hotfixes shipped (Session 53)**:

- search_impersonation_targets COALESCE account_type and paginated default-load (multi-field search across email + full_name + organization_name; total_count window function for pagination; includes self after frontend self-impersonation prevention proven sufficient at UX layer)
- check_mfa_freshness reads BOTH auth.mfa_amr_claims AND auth.mfa_challenges.verified_at (Supabase doesn't write amr_claims rows on subsequent mfa.verify calls of an already-aal2 session; the verified_at fallback bridges this) — Architecture-reference §26.8
- custom_access_token_hook accepts 'otp' as valid impersonation auth method (Supabase records verifyOtp({type:'magiclink'}) as 'otp' regardless of link type), then tightened with 60s freshness gate so stranded sessions can't contaminate normal user logins — Architecture-reference §26.7
- log_super_admin_action skips impersonation: prefix on lifecycle events (impersonation_started, impersonation_ended, impersonation_denied_action) for grouping parity — Architecture-reference §26.9
- my_access_history defaults action_category to 'organization_admin_action' for company_admin source rows (RPC was returning NULL which crashed AccessHistory.tsx formatActionType) — Architecture-reference §26.11
- identity-mutation friendly error toasts via new src/lib/identityMutation.ts helper that parses error.context.json() for FunctionsHttpError and surfaces "This action is blocked while impersonating" message for IMPERSONATION_DENIED code — Architecture-reference §26.12

**Manual integration tests passed end-to-end (Session 53 close)**:

- T1.1-T1.22: User Management page — landing redirect, sidebar entry, default 25-user load, pagination Next, org search, kebab dropdown structure, null-account-type "Unknown" badge rendering without crash
- T2.1-T2.7: Dropdown menu — Impersonate enabled, four stubs disabled with "(coming soon)", separator above Force pseudonymization
- T3.1-T3.18: Justification modal — title, description with target email, justification gate at 10 chars, mode radio with Observe default, character counter, Continue gate, embedded MfaChallenge step 2, full chrome on impersonation start (orange banner with OBSERVE/ACT pill, target email, countdown 30:00→0, Exit button, red 4px viewport border, [IMPERSONATING] tab title, navy "B" red dot favicon)
- T4.1-T4.5: Exit Impersonation — banner removed, border removed, tab title restored, lands on /super-admin/users, sidebar shows super admin nav
- Audit log query: impersonation_started + impersonation_ended pair linked by session_id with 20-second duration and end_reason='manual'; lifecycle events have clean mode column ('observe', not 'impersonation:observe:observe')
- T-E: Self-impersonation prevention — search cbastian, confirm Impersonate disabled with "(cannot impersonate yourself)" hint
- T-B: Act-mode denylist (security half) — email change attempt during act mode returned 403 IMPERSONATION_DENIED, Phil's email unchanged in DB
- T-B-UX: Act-mode denylist (UX half after hotfix) — friendly toast: "This action is blocked while impersonating. Identity changes (email, password, MFA) are not permitted during impersonation, even in act mode."
- T-C-RLS: user_demographics RLS WITH CHECK — gender_identity edit attempt and consent_withdraw button both showed optimistic toast success but DB writes blocked at RLS layer; hard refresh restored Phil's actual values; SQL verification confirmed gender_identity=Man and consent_withdrawn_at=null untouched. **Most important security verification of the entire impersonation security stack passed.**
- T-C: ProtectedRoute gate-redirect — manual /demographic-form URL navigation while impersonating bounces to /dashboard (banner persists)
- T-D: Phase D Access History — orgmember view shows 36 events on record (30 super_admin + 4 impersonation lifecycle + 2 company_admin), all six columns render correctly, badges display per brand mapping, CSV download produces well-formed file with all 36 rows

## Session 53 close — Group A Phase C + Phase D done

Group A architectural state at end of Session 53:

| Item | State |
|---|---|
| A1 — User impersonation | **DONE** end-to-end (backend + frontend + UI flow + audit verification + RLS + denylist) |
| A2 — Direct user editing | Tier 1 backend SHIPPED Session 49; remainder DEFERRED behind Group C |
| A3 Phase 1 — Audit schema additions | DONE (Session 49) |
| A3 Phase 2 — Reporting RPCs | DONE (Session 52: list_audit_events, audit_event_detail, export_audit_events, audit_session_replay) |
| A3 Phase 3 — Super admin /super-admin/audit reporting UI | DEFERRED behind Group C |
| A3 Phase 4 — User-facing /settings/access-history | **DONE** Session 53 |
| A3 Phase 5 — Quarterly review runbook | OPERATIONAL, not code; first review due 90d after launch |

Cole's intent at Session 53 close: Group C ships next, then the residual Group A super-admin assignment + completion-tracking work for curricula/modules/content items follows immediately. Group C Phase 4 (authoring UI Option A) already includes super admin curriculum/module/cert path management portal at /super-admin/learning, including direct curriculum assignment, mentor assignment, and cert path enrollment. So most of what Cole wants on the super admin LMS-management side gets built as part of Group C Phase 4 if Option A is chosen at Session 54 start.

## Session 54 opening — Group C Coach Certification + Resources / Learning Paths

Two source documents in project knowledge:

- **BrainWise_Group_C_Scope_Coach_Certification_v1.docx** — locked at Session 34 scoping; 13 foundational decisions Q1-Q13, 17 tables (15 NEW, 2 EXTENDS), 10 build phases
- **BrainWise_Group_A_Scope_Super_Admin_Core_v1.docx** — for cross-reference; Q4B in Group C (super admin direct enrollment) is shared infrastructure

Phase 1 (schema) is the immediate first task. All 17 tables, RLS, indexes, notification types catalog seed data. Backend-only, verified via SQL. See session-handoffs/session-53-to-54.md for full Phase 1-10 sequencing.

**Phase 4 Option A LOCKED at Session 54 start.** Full authoring UI in /super-admin/learning. Covers cert path editor, curriculum editor, module editor, content item editor (polymorphic by item_type), quiz authoring with question bank and answer options, mentor assignment UI, direct curriculum assignment UI. Rationale: Cole's stated intent is super-admin LMS-management tooling out of this build; Option A delivers that natively as part of Phase 4 rather than as a separate post-Group-C workstream. Data model identical to Option C, so Phase 1 schema work is unaffected by the option choice; only Phase 4 surface differs.

**Two standing rules apply to all Group C work (and forward):**

**Rule 1 — SOC 2 compliance built in from inception.** Every table, RPC, Edge Function, and migration in Group C must satisfy CC6.1 (RLS + caller validation), CC6.3 (least privilege via SECURITY DEFINER + explicit GRANT), CC7.2 (sanitized errors, no PII leakage). Markers called out inline on each migration the way Sessions 49–53 did for impersonation infrastructure. Audit columns (`created_by`, `updated_by`, `created_at`, `updated_at`) present on every authoring/configuration table for content provenance.

**Rule 2 — Impersonation gate built in from inception.** Every new RPC and Edge Function performing a mutation gets categorized against the 9-category denylist (architecture-reference §21.3) at design time. Every RLS WITH CHECK on a user-self-write table includes `NOT public.is_impersonating()` from day one, mirroring §26.2's user_demographics pattern. Every super-admin-write RLS policy includes `NOT public.is_impersonating()` in WITH CHECK as defense in depth (Session 54 Migration 08.5 established this for the 6 catalog tables; all subsequent tables follow the pattern from inception). This is the lesson from Sessions 49-53: we retrofit §26.2 + §26.3 + §26.4 because impersonation security wasn't designed in from the start; Group C does not repeat that pattern.



## Group C three-week sequencing plan (revised Session 49)

**Cohort target: three weeks from Session 48 close.** Plan A confirmed Session 49: Tier 2 backend + A3 Phase 2 + A1 frontend land before Group C starts (Cole prefers to finish A1 while context is fresh). Group C ships Sessions 51-60 instead of 50-58 — slight slip but still within the cohort window.

### Session 49 (SHIPPED)

Group A audit prequel + Group A Feature A1 Tier 1 backend SHIPPED:
- `super_admin_audit_log` 9 new columns + `company_admin_audit_log` 4 new columns
- `super_admin_action_types` lookup table (Option C) replaces CHECK constraint, 19 action types seeded
- `log_super_admin_action()` helper RPC with JWT-claim-aware actor derivation
- `impersonation_sessions` table with immutability + unique-active-per-admin
- `validate_impersonation_session()`, `assert_impersonation_allows()` RPCs (full 9-category denylist)
- `check_mfa_freshness()` RPC, `custom_access_token_hook()` Postgres function
- 3 new Edge Functions: `impersonation-start`, `impersonation-end`, `sweep_expired_impersonation_sessions` (cron at `*/5 * * * *`)
- `_shared/impersonation_gate.ts` helper module deployed via `test-impersonation-gate`
- Full reconnaissance of all 52 deployed Edge Functions: 27 require Tier 2 gating, 25 explicitly do not
- Cole registered hook in Dashboard ✓

### Session 50 (Tier 2 + A3 Phase 2 + A1 frontend — Plan A)

Cole's preference: finish A1 entirely before Group C. Session 50 may absorb all of Tier 2 + A3 Phase 2 + A1 frontend OR may break naturally between phases.

**Phase A: Tier 2 backend rollout** — splice `enforceImpersonationGate(callerClient, "<category>")` into 27 Edge Functions per the recon classification (see Session 49→50 handoff for full list with categories). Per-function deploy verification via no-auth probe = clean 401 (not 500).

**Phase B: A3 Phase 2 backend** — four reporting RPCs: `list_audit_events()`, `audit_event_detail()`, `audit_session_replay()`, `export_audit_events()`. SECURITY DEFINER, super-admin gated. Plus user-scoped variants for the access-history page.

**Phase C: A1 impersonation frontend** — justification modal with mode selector and target user lookup, fresh MFA TOTP challenge before impersonation-start, persistent orange banner with countdown / mode / Exit button, browser tab title prefix `[IMPERSONATING]`, favicon swap with red dot, 2px red viewport border, token swap logic for impersonation access_token + refresh_token, exit flow calling impersonation-end.

**Phase D: `/settings/access-history` page** — user-facing access history for all users (launch blocker A1 per scope 2.4.2). Shows impersonation sessions, super admin direct edits (when A2 ships), individual_record_viewed events affecting the user. Read-only, paginated, CSV export.

Natural break points: end of Phase A → Session 51 starts Phase B; end of Phase B → Session 51 starts Phase C; etc. Group C Phase 1 always starts in the session AFTER Session 50's last phase completes.

### Sessions 51-60 (Group C Phases 1-10, Option A)

Same compressed phase ordering as before, just shifted by 1 session:
- **Session 51**: Phase 1 (Schema, all 17 tables) + Phase 2 start (Core RPCs)
- **Session 52**: Phase 2 finish + Phase 3 (Notifications subsystem)
- **Session 53**: Phase 4 start (Authoring UI cert path / curriculum / module CRUD)
- **Session 54**: Phase 4 finish (Content item editor polymorphic UI, quiz authoring) — Cole starts authoring PTP content after this lands
- **Session 55**: Phase 5 start (Trainee learning UI shell + first 3 content viewers)
- **Session 56**: Phase 5 finish (remaining content viewers, video progress, cert path detail)
- **Session 57**: Phase 6 (Mentor review UI)
- **Session 58**: Phase 7 (Actor flow) + Phase 8 verification (Order Assessment gating already shipped Session 46)
- **Session 59**: Phase 9 (Resources tab redesign) + Phase 10 (Polish)
- **Session 60**: Buffer / launch readiness

### Sessions 61-65 (Group A remaining work)

A2 (direct user editing — Tier 1/2/3 fields), A3 Phase 3 super admin reporting UI, A3 Phase 5 quarterly review runbook, refund processing UI for individuals.

### Parallel work (Cole)

- Authoring PTP cert path content in the UI starting Session 54 onward
- Privacy policy update with admin-access clause (hard launch blocker for A1, scope 2.4.1)
- Coordinate with auditor on A1 design before launch (scope section 6.2 known gaps)

### Risk register

- Tier 2 rollout risk: 27 deploy splices means 27 chances to break a production function. Per-function probe verification mitigates. Rollback path: `get_edge_function` previous version + redeploy. Highest single Session 50 risk.
- Lovable disasters on polymorphic content editor (Phase 4 / Session 53-54) — second highest
- Decision stalls during build (build sessions need fast Cole responsiveness)
- Cohort content authoring stalling — Cole is the bottleneck if authoring runs slower than UI ships
- Notification subsystem bugs cascading into all later phases (Phase 3 needs thorough impersonation testing)
- A1 launch blockers (privacy policy update, access-history page) are NOT on the Group C critical path — A1 launch can lag cohort by sessions

## Build queue items added Session 49

- **Tier 2 enforcement rollout** (Session 51 COMPLETE — 23 of 23 functions shipped)
  - SHIPPED Session 50 (17 functions): set-account-type v43 (permission_change), ai-chat v31 (outbound_user_communication), delete-account v8 (identity_change), create-checkout v49 (financial_transaction), customer-portal v35 (financial_transaction), coach_invitation_revoke v4 (coach_action), coach_invitation_resend v2 (coach_action), reactivate-account v8 (lifecycle_action), airsa-supervisor-reminder v4 (outbound_user_communication; recat from corporate_admin_action — self-rater initiates, not admin), assign_epn_send v9 (corporate_admin_action), deactivate-and-notify v7 (corporate_admin_action), bulk-deactivate-and-notify v7 (corporate_admin_action), bulk_coach_invite v4 (coach_action), invitation_send v10 (corporate_admin_action), bulk_invitation_send v9 (corporate_admin_action), calculate-scores v44 (assessment_submission), submit-epn-assessment v7 (assessment_submission)
  - SHIPPED Session 51 (6 functions): generate-departure-export v8 (lifecycle_action — recon correction #5, recategorized from corporate_admin_action), generate-airsa-org-narrative v4 (corporate_admin_action HYBRID — gate only when !isInternal), generate-cross-instrument-recommendations v9 (corporate_admin_action), generate-dashboard-narrative v24 (corporate_admin_action), generate-nai-delta-narrative v12 (corporate_admin_action), generate-ptp-delta-narrative v9 (corporate_admin_action). All probed clean HTTP 401.
  - **CORRECTIONS Session 50** (4 functions): `peer-access-respond` and `verify-conversion` (email-link unauthenticated, no JWT possible); `airsa-supervisor-invite` and `send-departure-emails` (Class B internal-secret receivers, no caller user JWT). All four reclassified to "explicitly NOT gated"; their CALLERS are gated. Tier 2 list reduced 27 → 23.
  - **CORRECTION Session 51** (1 function): `generate-departure-export` recategorized from corporate_admin_action → lifecycle_action. Caller is the deactivated employee retrieving their own data export, not an admin. Both denylisted equally; runtime identical, audit label more accurate.
  - **VERIFICATION** (Session 50 + 51): Full helper RPC behavior tested end-to-end via direct SQL JWT-claim simulation. DETAIL format `imp_session_id=<uuid>` matches helper regex. Per-function probe: every deployed function returns expected 401 (no module-bundling failures). Frontend integration test deferred to Phase C completion.
- **A3 Phase 2 reporting RPCs** [SHIPPED Session 52] — six RPCs deployed and verified: list_audit_events, audit_event_detail, audit_session_replay (single-jsonb shape), export_audit_events (10k cap with truncated flag), my_access_history (UNION across both audit tables with audit_source discriminator), search_impersonation_targets (gin_trgm-backed user search). Full RPC catalog and rationale in architecture-reference.md §24. Hard-blocker resolved.
- **A1 impersonation frontend Phase C-1** (Session 53) — dormant infrastructure: ImpersonationProvider context, ImpersonationBanner, ImpersonationChrome (tab title + favicon + red border), MfaChallenge `onCancel` additive prop, App.tsx wiring, Tier 2 denylist audit (verify demographic-form-submit + mfa-enrollment-completion are denylisted). Recon complete (architecture-reference.md §25.1-§25.3, §25.6, §25.7, §25.8, §25.9). Pre-flight: read `impersonation-start` and `impersonation-end` Edge Function source to confirm response token shape before writing frontend code.
- **A1 impersonation frontend Phase C-2** (Session 53 if pacing allows, else Session 54) — entry + flow: NEW `/super-admin/users` page (universal user search via `search_impersonation_targets` RPC + row actions), JustificationModal (10-char min + observe/act selector + embedded MfaChallenge), sidebar superAdminNav update, `useAuth.redirectByRole` update (super admins land on `/super-admin/users` instead of `/super-admin/health`), removal of `/super-admin` layout-only fallback (replace with redirect). End-to-end impersonation goes live. Recon complete (architecture-reference.md §25.4, §25.5, §25.10).
- **`/settings/access-history` page** Phase D (Session 53 if pacing allows, else Session 54) — top-level route at `/settings/access-history` (sibling pattern to `/settings/privacy`), reads `my_access_history` RPC, sidebar update in both `settingsSubItems` and `coachSettingsSubItems` arrays. Open question: CSV export uses paginated client-side assembly capped at 1000 rows OR new `my_access_history_export` RPC. Decide at prompt construction. Recon complete (architecture-reference.md §25.11). Independent of Phase C.
- **Standardize on `auth.getClaims` across all Edge Functions** — `ai-chat` uses `auth.getUser` while everyone else uses `auth.getClaims`. Migrate ai-chat to getClaims for consistency. Low priority.
- **Migrate verify_jwt: false → verify_jwt: true on sensitive Edge Functions** — SOC 2 hardening pass; defensible either way but tightening reduces a class of bug. Low priority.
- **Align brainwise-blueprint Lovable repo with deployed Edge Function reality** — repo tracks ~10 functions, 52 deployed. Low priority, no blocking work depends on it.
- **Consider `is_test` column on `super_admin_audit_log`** — Session 49 left 9 test marker rows that can't be deleted (immutability trigger). Cleaner filtering than `WHERE detail->>'test' IS NULL`. Low priority.
- **`impersonation_denied_action` audit row writes** — when assert_impersonation_allows raises 42501, the calling Edge Function could write an audit row capturing the denied attempt. Builds SOC 2 evidence of enforcement. Add during Tier 2 rollout if pacing allows; otherwise build queue item.
- **Background-job CSV export for >10000-row audit reporting** — DECIDED Session 52: `export_audit_events` returns up to 10k rows with `truncated` flag and `total_matched` count; frontend renders banner instructing user to narrow filters. Hard-fail rejected; async pattern not built (CC7.2-friendlier to give a graceful slice than nothing). Reopen if observed audit volume exceeds 100k/month.

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

### Phase 5 [SHIPPED in Sessions 43-44]: AIRSA org dashboard

Strategic frame designed and locked Session 41. Backend recon completed Session 42. Phase 5a backend (RPC + Edge Function) shipped Session 43 and verified against the seeded fixture. **Phase 5b frontend (5 tabs) shipped Session 44** end-to-end, including the new `per_department_breakdown` field on skill aggregates added via Session 44 migration. AI narrative generation chain (Anthropic API → JSON parse → INSERT) verified live for the first time in Session 44.

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

**Phase 5b frontend** [SHIPPED in Session 44]. Single coordinated build across two Lovable prompts. New file `src/pages/company/AirsaDashboard.tsx`, route `/company/airsa-dashboard` gated by RoleGuard `["company_admin", "org_admin", "brainwise_super_admin"]` matching NAI/PTP. All 5 tabs functional. Calibration Map renders 24 skill rows × N department columns using new `per_department_breakdown` RPC field with locked STATUS_COLORS, dashed-border blind_spot, ▲/◆ priority markers, hover popover, n<5 suppression. Domain coloring locked to 8-color brand map (D8 uses new `#5A1A4A` deep plum to avoid conflict with PTP Purpose `#3C096C`). Three latent NAI/PTP-inherited bugs surfaced and fixed in AIRSA build (Team selector populated supervisors instead of departments; clearable "All ___" dropdown labels; cps_growth vs cps_strength unit disambiguation subtitles). Latent NAI/PTP versions of the first two bugs deferred for post-launch fix to avoid regression risk on dashboards already in production use.

**Deferred to v2 (post-launch):** skill-level radar chart on 24 axes (unreadable; heatmap is better); time-comparison overlays on Calibration Map; anonymous self-report mode; predictive "if you close blind spots in Skill X, expected TCI gain is Y" (requires platform-wide outcome data not yet available).

### Phase 6 [SHIPPED]: Instrument toggle interactions

(Per Session 38 closeout; pending manager rows stay dormant when AIRSA is toggled off.)

### Phase 7 [HIGH for Session 45]: Cross-instrument recommendations wiring for AIRSA

Promoted to HIGH priority in Session 44 closeout. Currently the AIRSA dashboard Trends + Cross-Instrument tab renders placeholder cards for PTP × AIRSA and NAI × AIRSA marked "Coming post-launch (Phase 7)". Session 45 work to populate them.

Two sub-tasks:

- **Backend wiring**: Add `trigger_logic` table rules for `source_instrument='INST-003'`. Reuse the existing instrument-agnostic `org_cross_instrument_recommendations` table (already used by NAI and PTP). AIRSA-specific correlations: PTP dimension → AIRSA skill calibration patterns; NAI C.A.F.E.S. dimension → AIRSA domain readiness patterns.
- **Test fixture seeding**: Seed PTP and NAI completions for ~20 of the 47 AIRSA users on BrainWise Test Corp so cross-instrument has data to render at all. Without this seed, even with backend wiring complete, the section renders empty on the test org.

If both sub-tasks are deferred past launch, the cross-instrument section continues to render placeholder cards on the AIRSA dashboard. Acceptable degraded state for v1 launch.

### Phase 8 [MEDIUM]: Cleanup verification

- Confirm UI handles superseded AIRSA results correctly
- Verify Cole Plummer's existing superseded result does not appear in his account UI
- Existing cron jobs (if any) that scan assessment_results properly skip superseded_at IS NOT NULL rows

## Top priority items for Session 49 opening

### [LAUNCH-BLOCKING] Group A audit prequel — Session 49 entire focus

Session 48 closed with Group D end-to-end shipped, refund automation verified, and a locked three-week sequencing plan for Group C (full LMS + coach certification with Option A authoring UI). Session 49 is the small audit-infrastructure prequel that unblocks Group C builds.

**Scope (single session):**

1. Schema additions to `super_admin_audit_log`:
   - `ip_address inet`
   - `user_agent text`
   - `reason text`
   - `before_value jsonb`
   - `after_value jsonb`
   - `mode text` (impersonation observe/act, nullable)
   - `expires_at timestamptz`
   - `ended_at timestamptz`
   - `end_reason text`

2. Schema additions to `company_admin_audit_log`:
   - `reason text`
   - `before_value jsonb`
   - `after_value jsonb`
   - `super_admin_acting_as_user_id uuid` (nullable; populated only when action was taken by super admin during impersonation)

3. New `log_super_admin_action()` helper RPC with consistent argument signature: actor, target, action_type, before, after, reason, mode

4. Verify schema via execute_sql post-migration

**Acceptance:** all columns exist, helper RPC callable from SECURITY DEFINER context, ready to be consumed by Group C super-admin actions (revoke certification, direct-enroll user, assign mentor).

This is intentionally small. Estimate: 1 session, possibly half-session if clean.

### [LAUNCH-BLOCKING] Group C — Coach Certification + LMS (Sessions 50-58)

10-session plan locked Session 48. See "Group C three-week sequencing plan" earlier in this build queue. Option A confirmed (full authoring UI). Cole owns content authoring as parallel task starting Session 53.

Full Group C scope at `/mnt/project/BrainWise_Group_C_Scope_Coach_Certification_v1.docx` (uploaded Session 48). The scope's Q7 decision is locked at Option A despite the scope's hedged language.

### [HIGH, deferred] Action-Oriented Voice Redesign across NAI and PTP surfaces

Carried forward from Session 47 priority list. The voice work is sequenced AFTER Group C ships because Group C is launch-blocking for the cohort and voice redesign isn't. Apply the canonical AIRSA voice template (`generate-airsa-org-narrative` v2 prompt's VOCABULARY RULES, BANNED words/phrases, SECTION STRUCTURES discipline) to NAI and PTP generators.

Affected Edge Functions:
- `generate-dashboard-narrative` v22 (NAI + PTP org)
- `generate-facet-interpretations` v23 (NAI + PTP individual)
- `generate-nai-delta-narrative` v10
- `generate-ptp-delta-narrative` v7

### [HIGH, deferred] Group A remaining work (Sessions 59-65)

Impersonation, Tier 1/2/3 user editing, audit reporting UI, user access history page. After Group C cohort launches.

### [HIGH, deferred] Org Overview Dashboard + AIRSA Cross-Instrument

Full scope at `/mnt/user-data/outputs/org-overview-and-airsa-cross-instrument-scope.md`. 4 phases, 3-5 sessions estimated. Sequenced after Group A remaining work.

### [MEDIUM, carried] Outstanding pre-launch quality items

Various small items carried from prior sessions: NAI/PTP latent slice-control bugs (deferred for post-launch per Session 44), aligned_pct/confirmed_gap_pct split on Domains tab (Session 44 open question), and the AI tone pass DEFERRED BATCH below for any remaining tone leakage.

### [MEDIUM, new from Session 48] Build queue items added during Session 48

- **Brand error color decision.** `--destructive` HSL `0 72% 55%` reads as a non-brand red. Decide on a brand-aligned error color (likely a darker terracotta/rust orange) that doesn't conflict with the existing `--brand-orange` CTA color but is visibly distinct.
- **Edge Function audit + email_type/source backfill.** Identify Edge Functions calling Resend directly vs through send-email. Backfill `email_type`/`source` parameters on Edge Functions that currently route through send-email without these fields: stripe-webhook, bulk_coach_invite, invite-coach, send-departure-emails, generate-departure-export, others TBD.
- **Extract shared coupon/refund helper module.** `recalcCouponAfterRevoke` and `processAutoRefund` are duplicated verbatim between `coach_invitation_revoke` and `sweep_expired_invitations` Edge Functions. Extract to shared helper file. Build queue impact when changing coupon math: must update both copies in lockstep until extraction lands.
- **Level 3 archive setup for email_logs** (pre-launch priority — SOC 2 evidence retention beyond 90-day rolling window).
- **Super admin refund processing UI for individual purchases.** UI surface in /super-admin showing: user's `assessment_purchases` rows with eligibility status (within 14 days? unused?), a "Process refund" button gating on Tier 2 audit (justification ≥ 10 chars + 5-min fresh MFA per Group A), Edge Function `process_individual_refund` (super-admin only) that takes an `assessment_purchase_id`, validates calling user is super_admin, calls Stripe refunds API, stamps the row with `refunded_at`, `stripe_refund_id`, `refund_amount`, `refund_processed_by`. Depends on Group A audit prequel being complete.
- **Pricing-reads refactor** (carried from Session 38). Eliminate hardcoded price IDs in favor of `subscription_plans` lookups (post-launch).
- **Token-based invitation upgrade (Path B).** Migrate coach_clients invitations from email-prefill to single-use token model. Closes pre-existing security concern documented in Group D scope. Build session: dedicated, not combined with other work.

## AI tone pass — DEFERRED BATCH

### [MEDIUM] AI generator tone pass across all instrument-level generators

Consolidated batch covering all AI Edge Functions on the platform. Specific items previously logged from Sessions 41 and 42 (residual "this creates" leakage, slight inference-overreach phrasing, fine-tuning toward purer factual observation) plus a full review of language quality across:

- generate-airsa-profile-overview (v5)
- generate-airsa-what-this-means (v3)
- generate-airsa-action-plan (v3)
- generate-airsa-conversation-guide (v3)
- generate-airsa-top-priorities (v2)
- generate-airsa-cross-instrument (v2)
- generate-airsa-org-narrative (v2, voice redesigned in Session 45 — use as canonical voice template for the rest of this batch)
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

### [POST-LAUNCH] NAI and PTP dashboard slice-control parity fixes

Two latent bugs identified in Session 44 while building AIRSA Phase 5b. Both exist in `CompanyDashboard.tsx` (NAI) and `PTPDashboard.tsx` (PTP). Fixed in AIRSA Session 44; deferred for NAI/PTP to avoid regression risk on production dashboards.

1. **Team `<select>` populated from departments instead of supervisors**: lines around CompanyDashboard.tsx 1798-1807 use `departments.map(d => ...)` for the Team dropdown, sending `department_id` where the RPC expects `supervisor_user_id`. The RPC correctly returns suppressed empty state, but the user can't actually select a team. Fix follows AIRSA pattern: add a supervisors loader querying `users` table directly under existing RLS, populate Team dropdown from that.

2. **Dropdowns lack clearable first option after selection**: the placeholder labels "Department ▾" / "Level ▾" / "Team ▾" disappear after a value is selected, leaving no in-dropdown reset. Change first option labels to "All departments" / "All levels" / "All teams".

Address in a single coordinated post-launch Lovable prompt covering both NAI and PTP. Frontend-only, no migrations.

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
