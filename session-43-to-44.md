# BrainWise Session 43 to 44 Handoff

*Closeout: Session 43. Open: Session 44.*

## Where Session 43 left off

Phase 5a backend SHIPPED. The RPC `get_airsa_aggregate` and the Edge Function `generate-airsa-org-narrative` are both deployed and verified end-to-end against the Session 42 seeded fixture. No Lovable credits used this session.

Frontend (Phase 5b) is the only remaining piece for AIRSA org dashboard launch readiness. The AI tone pass previously flagged HIGH was consolidated into a single MEDIUM batch covering all instrument-level generators across the platform; details in build-queue.md under "AI tone pass — DEFERRED BATCH".

## Session 43 accomplishments

### Pre-build recon (8 blocks)

Pulled the canonical reference function `get_instrument_aggregate` (full SECURITY DEFINER definition with caller validation, slice routing, and n<5 suppression). Confirmed `org_dashboard_narratives` schema has all required columns and CHECK constraints already permit `INST-003` and the 4 needed slice_types — no migration needed. Pulled the gold-standard Edge Function `generate-dashboard-narrative` v22 to mirror its Class A JWT pattern and INSERT shape. Pulled `generate-airsa-profile-overview` v5 to confirm the SOC 2 utility pattern (`safeEqual`, `serverError`) and hybrid Class A + Class B auth. Verified AIRSA dimension_scores shape (`{readiness_level: 'Foundational'|'Proficient'|'Advanced'}` per dimension), skill_level_breakdown shape (denormalized per-skill object with status field), and the 24-row airsa_skills reference table.

### RPC: `get_airsa_aggregate` shipped via two migrations

1. `create_get_airsa_aggregate_rpc` — initial implementation
2. `fix_get_airsa_aggregate_suppression_check` — corrected suppression check from `pair_count` (participants × 24) to `array_length(v_participant_ids)` directly, matching `get_instrument_aggregate` semantics

SECURITY DEFINER, `SET search_path TO 'public', 'extensions', 'auth'`. Caller validation supports brainwise_super_admin / company_admin / org_admin / corporate_employee-with-direct-reports gated on `corporate_contracts.supervisor_dashboard_enabled`. Slice routing matches `get_instrument_aggregate`: 'all' / 'department' / 'org_level' / 'team'. Manager Calibration computed by iterating supervisors with n>=3 reports threshold inside the RPC body.

CPS formulas locked: `cps_growth = (1 - readiness_index) * misalignment_weight` with `misalignment_weight = LEAST(2.0, GREATEST(1.0, 1 + (blind_spot_pct + confirmed_gap_pct)/100))`; `cps_strength = confirmed_strength_pct`. Tie-breakers: growth orders by `cps_growth DESC, blind_spot_pct DESC NULLS LAST`; strength orders by `cps_strength DESC, n DESC`.

Returns full §10.6 JSONB shape: tci_overall, alignment_rate, blind_spot_rate, underestimate_rate, status_distribution, skill_aggregates (24 skills with CPS), domain_aggregates (8 domains with CPS), rankings (growth_skills, strength_skills, growth_domains, strength_domains), manager_calibration (only supervisors with n>=3 reports).

### Edge Function: `generate-airsa-org-narrative` v1 shipped

Hybrid Class A + Class B auth. Class A primary (frontend Regenerate AI button) forwards user JWT to RPC client so `auth.uid()` resolves inside SECURITY DEFINER. Class B (X-Internal-Secret with `safeEqual`) for future programmatic regen, requires `organization_id` in body. `claude-opus-4-6`, max_tokens 7000. AIRSA-specific calibration-focused prompt with 5-status framework, top-5 growth/strength rankings, top-3 manager blind-spot/underestimate panels. Banned words and phrases match individual AIRSA generators. INSERTs to `org_dashboard_narratives` append-only with `instrument_id='INST-003'`, `index_score=TCI`, full RPC payload in `dimension_scores`, AI JSON in `narrative_text`. Shared utilities `_shared/secrets.ts` (safeEqual) and `_shared/errors.ts` (sanitized serverError). SOC 2 markers throughout: CC6.1 hybrid auth + safeEqual, CC6.3 caller validation + org isolation, CC7.2 sanitized 5xx errors with no PII.

### Verifications passed

- TCI 40.1 against fixture (matches pre-build verification exactly)
- Status distribution 24.5/15.6/19.0/20.3/20.7
- 24 skill_aggregates and 8 domain_aggregates returned
- Top growth = Skill 10 Identity Flexibility (cps_growth 1.803)
- Top strength = Skill 23 Algorithmic Vigilance (85% confirmed_strength)
- 10 supervisors meeting n>=3 threshold in manager_calibration array
- Department slice: 432 pairs, 19 eligible, TCI 37.3
- Org_level IC slice: 816 pairs, 34 eligible, TCI 40.6
- Team slice with 5 reports: 120 pairs, TCI 37.5
- Suppression triggers correctly at 1-report and 3-report teams
- INSERT path simulation confirms all CHECK constraints pass and `index_score=40.10`
- Edge Function deployed v1 active, 282ms cold start, auth gate confirmed firing in logs

### One bug caught and fixed during verification

First version of the RPC suppressed on `pair_count` (eligible × 24 skills), which would have allowed n=1 team slices through. Fixed in second migration to check `array_length(v_participant_ids)` directly. Documented as architectural constraint in arch-ref §8.

### Not verified by Session 43

Full Anthropic-API-to-JSON-parse-to-INSERT happy path. Auth gate, RPC fetch, and INSERT shape verified individually but not chained through a real session token (can't mint user JWT from SQL). First frontend call in Phase 5b will validate this.

## Session 44 opening priorities, in order

### 1. [HIGH] Phase 5b frontend build — AIRSA org dashboard

Single coordinated Lovable prompt covering 5 tabs of UI mirroring NAI's `CompanyDashboard.tsx` patterns. Backend is ready: RPC `get_airsa_aggregate` returns the full §10.6 shape, Edge Function `generate-airsa-org-narrative` is deployed at v1.

First sub-task before writing the Lovable prompt: pull `src/pages/company/CompanyDashboard.tsx` and related files via GitHub MCP (or curl with line ranges if files are too large) so the AIRSA mirroring is precise. Identify which patterns to reuse verbatim and which need AIRSA-specific variants (Calibration Map, Manager Calibration tab, status pills with STATUS_COLORS). Specifically check how NAI CompanyDashboard handles slice controls, AI narrative regeneration, and the skill-inventory-style sortable table.

Second sub-task: lock domain coloring before writing the prompt. Pull individual AIRSA results page palette from AirsaCombinedReport.tsx and assign 8 colors to the 8 domains. Avoid Green+Teal pairing in pastel contexts.

5 tabs: Overview / Domains / Skill Inventory / Manager Calibration / Trends + Cross-Instrument. Calibration Map as visual centerpiece with orange ▲ (top growth) and green ◆ (top strength) priority markers tracking the active slice's CPS rankings. AI workforce narrative as inline expandable card on Overview tab (NOT a separate tab). Manager Calibration tab consumes the `manager_calibration` array directly; suppression already applied by RPC at n>=3.

### 2. [MEDIUM] AI tone pass — deferred batch

Consolidated review of all instrument-level AI generators across the platform. See build-queue.md "AI tone pass — DEFERRED BATCH" for the full function list and approach. Run after Phase 5b frontend, pre-launch.

## Decisions locked in Session 43

- Suppression check on aggregate RPCs uses `array_length(v_participant_ids)`, NOT pair count or any participant × items product
- generate-airsa-org-narrative is hybrid Class A + Class B (Class A primary; Class B requires organization_id in body)
- CPS tie-breakers locked in RPC body: growth by cps_growth DESC, blind_spot_pct DESC; strength by cps_strength DESC, n DESC
- AI tone pass consolidated to a single MEDIUM batch covering all 13 instrument-level AI generators

## Open questions for Session 44

- Domain coloring for the 8 AIRSA domains — to be locked before writing the Phase 5b Lovable prompt
- Whether the AI workforce narrative card on Overview should auto-generate on first dashboard load OR require explicit Generate button click (PTP/NAI use the latter; AIRSA defaulting may want the same to avoid surprise Anthropic charges)
- Skill Inventory row-expand behavior: per-department TCI breakdown for the expanded skill requires either additional RPC calls per row or a payload-bloat decision. Current RPC returns aggregates but not per-department-per-skill. Decide in Phase 5b whether to issue follow-up RPC calls on row expand or add `per_department_breakdown` to skill_aggregates

## What's NOT in scope for Session 44

- Action-Oriented Voice Redesign across NAI/PTP individual report and dashboard surfaces (POST-LAUNCH)
- Corporate contract renewal schema change (POST-LAUNCH)
- Pricing-reads refactor (POST-LAUNCH)
- Clarity Engine (deferred until Resources pages are built)
- Three-wave validation pathway work (Q3 2026 onward)

## Architecture additions in Session 43

- `get_airsa_aggregate(p_slice_type, p_slice_value)` RPC (SECURITY DEFINER, GRANT EXECUTE TO authenticated)
- `generate-airsa-org-narrative` Edge Function v1 (hybrid Class A + Class B auth)
- §10.6 expanded with full RPC payload spec including worked example tied to actual fixture values
- §10.7 expanded with full Edge Function spec
- Two new locked architectural constraints in §8 (suppression on eligible pool; user JWT forwarding to RPC clients)

## Test fixture state at end of Session 43

Unchanged from Session 42 close. 47 AIRSA pairs in BrainWise Test Corp. 4 departments (Executive 5, Engineering 18, Finance 14, Marketing 13). 17-18 distinct supervisors, 10+ meeting n>=3 threshold. Org-wide TCI = 40.1.

When Session 44 begins, look up current state via Supabase rather than relying on values written here at Session 43 close.

## Documents this session leaves behind

- build-queue.md v35 (uploaded to GitHub repo)
- architecture-reference.md v37 (uploaded to GitHub repo)
- session-43-to-44.md (this document, uploaded to GitHub repo)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs.
