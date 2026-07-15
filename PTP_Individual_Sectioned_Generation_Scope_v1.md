# PTP Individual Report — Mirror the Team/Paired Sectioned Generation (Scope v1)

**Status:** Scope for review (no build yet). **Author:** Session 175 (punch-list track), item F1.
**One-line goal:** Change *how* the individual PTP report is generated so it mirrors the team/paired orchestration — each section generated as its own tracked call, with a `sections_expected` / `sections_done` contract, a live "Section X of N generating…" progress indicator, and per-section failure isolation + retry. **The report's content, structure, and everything the user sees stays identical.** Orchestration + status + progress-UI change, not a content change.

## Why (the value)
- **Failure isolation.** Today a PTP generation is a fire-and-forget fan-out with a single aggregate `narrative_status` on `assessment_results`. One failure = one "failed" for the whole report, with no way to tell which piece broke. Per-section tracking makes the failing section obvious and individually retriable (same class of fragility hardened in A2).
- **Progress visibility.** The user sees a real "Section 1 of N generating…" count against a known expected list, like the team/paired reports, instead of one spinner.

## The reference architecture (team/paired) — what we're mirroring
1. **Profile / precompute** (`generate-paired-profile` / `generate-team-profile`): a pure, AI-free interpreter computes the analytical facts and stores a `structured` object on `paired_profiles` / `team_profiles`; `narrative_status='pending'`.
2. **Sectioned narrative** (`generate-paired-narrative` / `generate-team-narrative`): one contract, two modes — no `section_type` returns `{ narrative_status, sections_expected, sections_done }`; `section_type=<key>` generates exactly that section, writes it to `*_profile_sections`, recomputes status (`complete` when all expected done), returns the updated plan.
3. **Frontend driver** (`useNarrativeGenerator` hook, `kind: "team" | "paired"`): calls the plan endpoint, computes `todo = expected − done`, generates each remaining section one at a time with retry/backoff `[0, 5s, 10s, 20s]`, exposes `{ running, expected, done, failed, current, retry }`. The report page renders progress + per-section retry from that state.

The key property to copy: **each section is an independently addressable, independently tracked unit.**

## The individual PTP report — the 12 sections (from Cole)
The report the user sees, in order, per context:

1. **Dimension scores** — data/chart (not AI).
2. **Profile overview** ("What does this mean to me?") — AI narrative.
3. **Suggested next steps** — AI narrative.
4. **Dimension highlights** — AI narrative.
5. **Driving facets bar charts** (high-scoring drivers + low-scoring drivers) — data/chart.
6. **Driving facet insights for high-scoring drivers** — AI narrative.
7. **Driving facet insights for low-scoring drivers** — AI narrative.
8. **Cross-assessment connections** — AI narrative.
9. **All facet score bar charts** (all facets) — data/chart.
10. **Threat facet bar charts** (separate) — data/chart.
11. **Reward facet bar charts** (separate) — data/chart.
12. **Your assessment responses** — all assessment questions for that context, each with the clickable **impact table** (impact to positive / to negative, for self and for other) — data.

### AI-generated vs data-rendered (this is what the tracking is for)
- **AI-generated (need tracked generation):** 2 Profile overview, 3 Suggested next steps, 4 Dimension highlights, 6 Driving facet insights (high), 7 Driving facet insights (low), 8 Cross-assessment connections. **≈ 6 sections per context.**
- **Data-rendered (instant, no generation):** 1 Dimension scores, 5 Driving-facet bar charts, 9 All-facet bar charts, 10 Threat bar charts, 11 Reward bar charts, 12 Assessment responses + impact table.

The "Section X of 12 generating…" progress presents all 12; the data sections are effectively complete immediately, and the ~6 AI sections are the ones that actually generate and get tracked. (Decision to confirm: does the count run over all 12 with data sections instant-complete, or only over the ~6 AI sections? Recommend showing all 12 with the data ones pre-satisfied, since that matches the user's "12 sections" mental model.)

### Mapping to existing storage
These AI sections already exist as `facet_interpretations` rows keyed by `section_type` per context: `profile_overview_<context>`, `dimension_highlights_<context>`, `cross_and_action_<context>` (cross-assessment + action/next-steps), `driving_facets_<context>` / `facet_insights_<context>`, plus `facet_insights_all` and the `ai_narrative` overview. The exact section_type → visible-section mapping (e.g. whether "Suggested next steps" is the action half of `cross_and_action` or its own key) is finalized against the `MyResults` / `PTPNarrativeSections` renderer during build.

## Context handling (professional / personal / combined)
The individual PTP has three contexts. **Sections 1–11 are context-specific** — professional, personal, and combined each render differently. **The impact table (section 12) is shared across all three contexts for a given facet** (same impact values regardless of context); the *list of questions shown* in section 12 is still per-context.

Implication for generation:
- The AI sections generate **per context** (≈ 6 × 3 = ~18 tracked AI generations total across all contexts).
- The user viewing one context sees **12 sections** for that context; the "Section X of 12" progress is **per the viewed context**.
- The impact-table data is generated/derived **once** and reused across contexts (not regenerated per context).

## Proposed design (mirror, minimal content change)
1. **Canonical `sections_expected`** = the 12 sections for the active context (with the ~6 AI ones as the tracked/generated set), plus the report-level `facet_insights_all`. Impact-table data computed once, context-shared.
2. **`generate-ptp-narrative` contract** mirroring `generate-paired-narrative`, keyed by `assessment_result_id` (+ `narrative_context`): no `section_type` → `{ narrative_status, sections_expected, sections_done }` computed from existing `facet_interpretations` rows / `ai_narrative` / `facet_insights_all_total`; `section_type=<key>` → generate that one section by delegating to the existing per-section generator, write the row, recompute status. Per-section, tracked, retriable. **Prompts and outputs unchanged.**
3. **Kickoff:** `calculate-scores` stops the 15-call fan-out, stamps `narrative_status='pending'`, and lets the frontend driver (or a single server orchestrator) run the section loop. The A2 aggregate-failure fan-out is retired.
4. **Frontend:** extend `useNarrativeGenerator` with `kind: "ptp"` (`FN_NAME.ptp = "generate-ptp-narrative"`, `ID_KEY.ptp = "assessment_result_id"`), then `MyResults` / `PTPNarrativeSections` render "Section X of 12 generating…", current section label, and per-section failed + retry, like `PairedReport`. **Section rendering itself is unchanged.**

## What changes vs what stays
- **Stays identical:** every section's prompt, content, storage row, on-screen rendering, and the three-context behavior (incl. the shared impact table). The user sees the same report.
- **Changes:** orchestration (fan-out → tracked per-section loop), the status/plan contract, `narrative_status` semantics (`pending`→`generating`→`complete`), and the progress UI + per-section retry. The A2 aggregate-failure fan-out is retired.

## Migration
Forward-only. Existing reports already have their section rows, so the new plan endpoint computes them as `sections_done` → they read as `complete` with no backfill.

## Open decisions (need Cole's input before build)
1. **RESOLVED — the 12 sections + contexts** are captured above.
2. **Progress count basis:** show all 12 (data sections instant-complete) — recommended — vs count only the ~6 AI sections.
3. **Overview as a tracked section:** fold `ai_narrative` into the tracked set (recommended) vs leave `generate-report` separate.
4. **New function vs extend existing:** dedicated `generate-ptp-narrative` orchestrator (cleanest mirror) vs extend an existing function.
5. **Scope to PTP only?** `facet_interpretations` also holds NAI (INST-002) section types; do PTP (INST-001) first, or both.

## Build sequence (backend-first, when approved)
1. Finalize the section_type → visible-section mapping from `MyResults` / `PTPNarrativeSections` (fixes the exact expected list per context).
2. Build the `generate-ptp-narrative` plan + one-section contract wrapping the existing per-section generators; verify plan/`sections_done` accuracy + single-section generation via impersonation.
3. Switch `calculate-scores` off the fan-out to `pending` + orchestrator/driver; verify a fresh PTP generates section-by-section with correct status transitions and shared impact-table reuse.
4. Extend `useNarrativeGenerator` (`kind: "ptp"`) + add the progress UI + per-section retry to `MyResults` / `PTPNarrativeSections`; verify "Section X of 12" and per-section failure isolation live.
5. Confirm existing reports still render (forward-only migration).

## Verification notes
- Backend contract verified via minted fixture JWTs + rolled-back transactions (plan accuracy, single-section generation, status transitions), per house style.
- Live per-section progress + failure isolation verified on a test PTP re-score (a re-score exercises the full pipeline, as used for A2 this session).
