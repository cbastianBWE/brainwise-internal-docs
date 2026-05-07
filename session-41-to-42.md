# BrainWise Session 41 to 42 Handoff

*Closeout: Session 41. Open: Session 42.*

## Where Session 41 left off

Phase 4 SHIPPED. AIRSA combined report PDF export is live, end-to-end verified against Maya dual-rater fixture. Three Lovable prompts: v1 (initial 5-file build), v2 (4 bug fixes for jsPDF rendering), v3 (Profile overview heading-orphan + narrow-wrap fix). Final 9-page PDF rendering cleanly with all 14 sections, jsPDF native primitives throughout, text fully selectable, lollipop with native lines/circles preserving STATUS_COLORS canonical mapping, ASCII asterisk replacing star glyph in PDF only.

Phase 5 strategic frame designed and locked. Five-tab IA mirroring PTP/NAI canonical structure. Talent Calibration Index (TCI) locked as headline metric. Greatest Growth Opportunities / Strengths to Capitalize paired panels designed for Overview tab with top 2 skills + top 2 domains per panel. Composite Priority Score (CPS) formula locked. Calibration Map confirmed as visual centerpiece with priority markers tracking active slice's CPS rankings. Manager Calibration tab confirmed for v1 with minimum-3-reports privacy threshold. Cross-instrument tab confirmed for v1 matching PTP/NAI parity. Schema strategy locked to reuse `org_dashboard_narratives` with `instrument_id = 'INST-003'`. Cadence locked to live RPC computation per dashboard load (matches PTP/NAI). Phase 5 split into Phase 5a backend and Phase 5b frontend per Phase 3 split precedent.

Two architectural learnings logged in §8 of architecture-reference.md and detailed in §5.6: jsPDF WinAnsiEncoding glyph constraint, jsPDF splitTextToSize font-state dependency, and section heading anti-orphan pattern.

## Session 42 opening priorities, in order

### 1. [HIGH] Phase 5a backend recon (do FIRST, before any migration)

Eight recon blocks. Run each before writing the Phase 5a build prompt. Findings get summarized to Cole; the build prompt is written only after the summary is approved.

**Block 1: How `get_instrument_aggregate` actually works.**

```sql
-- Function definition
SELECT pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'get_instrument_aggregate';

-- Parameter signature
SELECT
  p.proname,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS returns
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'get_instrument_aggregate';

-- SECURITY DEFINER vs INVOKER
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'get_instrument_aggregate';

-- Related variants
SELECT proname FROM pg_proc
WHERE proname ILIKE '%instrument_aggregate%' OR proname ILIKE '%get_aggregate%';
```

Extract: exact return shape (RECORD vs JSONB), privacy threshold (probably `participant_count >= 5`), RLS posture, JSONB shape pattern.

**Block 2: How `CompanyDashboard.tsx` calls the RPC and unpacks the response.**

File: `src/pages/company/CompanyDashboard.tsx` line ~422-440 (the `Load aggregate` block). Read the TypeScript interface (`type AggregateResult`), how `slice_type` and `slice_value` are passed, how `dimensions` is iterated for cards, how `participant_count` flows into suppression logic.

**Block 3: Existing org-narrative generators.**

```bash
ls supabase/functions/ | grep -E "narrative|org|delta"
```

Likely candidates: `generate-ptp-org-narrative`, `generate-nai-org-narrative`, `generate-leadership-delta-narrative`. Read each: auth pattern (X-Internal-Secret), prompt construction, JSON output parsing → `narrative_text` JSONB column, error handling, frontend dispatch (which RPC or function does the dashboard call when user clicks Regenerate AI?).

**Block 4: Slice enum verification.**

```sql
-- CHECK constraint on slice_type
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.org_dashboard_narratives'::regclass
  AND contype = 'c';

-- Existing slice_type values
SELECT slice_type, COUNT(*) AS n
FROM org_dashboard_narratives
GROUP BY slice_type
ORDER BY n DESC;
```

Confirms whether `'supervisor'` needs to be added to a CHECK constraint or just used as a new free-text value.

**Block 5: Manager Calibration data quality audit.**

```sql
-- % of users with supervisor_user_id set
SELECT
  COUNT(*) FILTER (WHERE supervisor_user_id IS NOT NULL) AS with_supervisor,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE supervisor_user_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS pct
FROM users
WHERE organization_id IS NOT NULL;

-- For AIRSA self-completers, % with supervisor_user_id
SELECT
  COUNT(DISTINCT u.id) FILTER (WHERE u.supervisor_user_id IS NOT NULL) AS with_supervisor,
  COUNT(DISTINCT u.id) AS total
FROM assessment_results ar
JOIN assessments a ON a.id = ar.assessment_id
JOIN users u ON u.id = ar.user_id
WHERE ar.instrument_id = 'INST-003'
  AND a.rater_type = 'self'
  AND ar.superseded_at IS NULL;
```

If coverage < 50%, decide: ship Manager Calibration tab anyway with a coverage-caveat banner, defer to v2, or make it an admin onboarding requirement.

**Block 6: AIRSA dimension JSONB shape compatibility.**

```sql
-- Sample existing aggregate JSONB shapes
SELECT instrument_id, dimension_scores
FROM org_dashboard_narratives
WHERE instrument_id IN ('INST-001', 'INST-002')
ORDER BY generated_at DESC
LIMIT 3;
```

Confirm the proposed AIRSA shape (documented in architecture-reference.md §10.6) doesn't break PTP/NAI consumers. The polymorphic JSONB column supports different shapes per instrument; verify by running a TypeScript type-check against `CompanyDashboard.tsx`'s `AggregateResult` interface.

**Block 7: Production AIRSA row audit.**

```sql
-- AIRSA results missing the divergence or breakdown payloads
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE self_manager_divergence IS NULL) AS null_divergence,
  COUNT(*) FILTER (WHERE skill_level_breakdown IS NULL) AS null_breakdown,
  COUNT(*) FILTER (WHERE manager_dimension_scores IS NULL) AS null_manager_scores
FROM assessment_results
WHERE instrument_id = 'INST-003'
  AND superseded_at IS NULL;
```

If any rows are NULL on the new aggregation columns AND `manager_dimension_scores` is set (manager submitted but the new columns weren't populated), there's a backfill task to run. The `calculate-scores` v42 logic can be re-run on those rows.

**Block 8: Feature flag check.**

```sql
SELECT * FROM organization_features_view LIMIT 3;
SELECT * FROM organization_instruments LIMIT 5;
```

Confirm whether the AIRSA company dashboard nav entry needs to be conditional on a feature flag for the soft launch.

**After all 8 blocks return clean data:** present findings as a summary to Cole. Specifically: confirmed RPC signature, confirmed JSONB shape that fits the existing column, confirmed slice_type values to add, confirmed manager-calibration coverage, confirmed any backfill needed. Then write the Phase 5a build prompt as a single pass.

### 2. [HIGH] Phase 5a backend build

Single Lovable prompt covering: migration to add `'supervisor'` slice_type (and any other slice values needed); new RPC `get_airsa_aggregate(organization_id, slice_type, slice_value)`; new Edge Function `generate-airsa-org-narrative` (Class B internal-secret pattern, mirrors AIRSA individual-level generators).

Verify SQL end-to-end against Maya fixture before scheduling Phase 5b.

### 3. [HIGH] Phase 5b frontend build

Mirror NAI's `CompanyDashboard.tsx` patterns. 5 tabs: Overview / Domains / Skill Inventory / Manager Calibration / Trends + Cross-Instrument. Calibration Map as visual centerpiece with orange ▲ (top growth) and green ◆ (top strength) priority markers. Greatest Growth Opportunities / Strengths to Capitalize panels on Overview using CPS-ranked top 2 skills + top 2 domains. Coverage caveat banner if Manager Calibration tab data quality is poor.

### 4. [HIGH] AI tone pass on the six AIRSA AI generators

Carried from Session 41. Final phrasing tweaks across all six AIRSA AI functions. Specific items: residual "this creates" leakage in profile-overview, slight inference-overreach phrasing, fine-tuning toward purer factual observation. Now that all six sections render together in both the on-screen frontend and the PDF, the tone is evaluable end-to-end on Maya's fixture in both surfaces.

## Decisions locked in Session 41 (recap)

- Talent Calibration Index (TCI): `(aligned + confirmed_strength) / total × 100`. Confirmed gaps do NOT count positive.
- Composite Priority Score (CPS) formula for both growth and strength rankings, with bounded misalignment_weight [1.0, 2.0].
- Greatest Growth Opportunities / Strengths to Capitalize panels: top 2 skills + top 2 domains per panel, expand link for full ranking.
- Calibration Map: 24-skill × N-department heatmap with priority markers tracking active slice.
- Manager Calibration tab in v1, min-3-reports privacy threshold.
- Cross-instrument tab in v1.
- Schema reuses `org_dashboard_narratives` with `instrument_id = 'INST-003'`. No new aggregate table.
- Cadence: live RPC per dashboard load, mirrors PTP/NAI exactly.
- Phase 5 splits into Phase 5a backend + Phase 5b frontend.
- jsPDF rendering rules locked in §5.6 of architecture-reference.md.

## Open questions / things to lock in Session 42

- Manager Calibration tab data quality. If recon Block 5 returns < 50% coverage on `supervisor_user_id`, decide whether to ship the tab anyway with a coverage-caveat banner, defer to v2, or make supervisor-assignment an admin onboarding requirement.
- Backfill task scope. If recon Block 7 surfaces production AIRSA rows missing the new aggregation columns, decide on backfill timing (before Phase 5a backend ships, or alongside).
- Feature flag posture. If `organization_features_view` shows AIRSA already gated, confirm the dashboard nav entry inherits that gate.

## Bugs surfaced in Session 41 added to Build Queue

None new. All four bugs found during Phase 4 (BUG-A through BUG-E using v2/v3 letter labeling) were fixed in the same session. None carry into Session 42.

## What's NOT in scope for Session 42

- Action-Oriented Voice Redesign across NAI/PTP individual report and dashboard surfaces (POST-LAUNCH)
- Corporate contract renewal schema change (POST-LAUNCH)
- Pricing-reads refactor (POST-LAUNCH)
- Clarity Engine (deferred until Resources pages are built)
- Three-wave validation pathway work (Q3 2026 onward)

## Architecture additions in Session 41

- `src/lib/generateAirsaPdf.ts` (NEW): jsPDF native PDF renderer for AIRSA combined report. Mirrors `generateNaiPdf.ts` structurally. Cover + 14 sections.
- `assembleAirsaPdfData()` added to `src/lib/assemblePdfDataForUser.ts`. Existing PTP/NAI assembly untouched.
- `AirsaPdfSectionsUi` interface, `AIRSA_GROUPS` config, `instrumentType: "AIRSA"` branch added to `ExportPdfModal.tsx`. PTP/NAI code paths untouched.
- `<ExportPdfModal>` lifted out of `!isAIRSA` branch in `MyResults.tsx` so it renders for all instruments.
- `onExportClick` prop added to `AirsaCombinedReport.tsx` (only change to that 1360-line component).
- §5.6 jsPDF rendering rules added to architecture-reference.md.
- §10 AIRSA Company Dashboard design added to architecture-reference.md (Phase 5 strategic frame).

No backend, Supabase, or Edge Function changes in Session 41. Phase 4 was pure frontend.

## Test fixture state at end of Session 41

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Maya Employee + David Supervisor AIRSA fixture state (unchanged from Session 40 close, verified working in Session 41):

- AIRSA self assessment, manager assessment, and combined assessment_result row all present
- All six facet_interpretations rows populated (airsa_profile_overview, airsa_what_this_means, airsa_action_plan, airsa_conversation_guide, airsa_top_priorities, airsa_cross_instrument has no row because Maya has no PTP/NAI)
- skill_level_breakdown JSONB fully populated with 24 entries
- Verified via PDF export end-to-end on the fixture in Session 41

When Session 42 begins, look up the current state via Supabase rather than relying on values written here at Session 41 close.

## Documents this session leaves behind

- BrainWise_Build_Queue_v33.docx (uploaded to project knowledge)
- BrainWise_System_Architecture_Reference_v35.docx (uploaded to project knowledge)
- BrainWise_Session_41_to_42_Handoff.docx (this document, uploaded to project knowledge)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs.
