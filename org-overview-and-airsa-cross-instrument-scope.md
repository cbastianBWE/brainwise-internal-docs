# Scope Doc: Org Overview Dashboard + AIRSA Cross-Instrument Wiring

**Drafted:** Session 45 (May 8, 2026)  
**Owner:** Cole Bastian  
**Status:** Detailed scope, ready to execute when prioritized  
**Estimated session count:** 3-5 sessions to complete in full  

---

## How to use this doc

Upload this file at the start of a future session. The session will pick up where this leaves off and execute the plan in the order described below. The doc is split into four phases. Each phase is independently shippable. Phases 1-2 are backend, Phase 3 is the Org Overview surface (highest user value), Phase 4 is the per-dashboard cross-instrument extensions.

Recommended execution order: **Phase 1 → Phase 2 → Phase 3 → Phase 4**. Phase 3 can ship before Phase 4 if needed; Phase 4 is structurally smaller but adds AIRSA cross-instrument to the existing per-dashboard tabs.

---

## Context already verified (Session 45 recon)

These facts are confirmed and do not need re-verification:

**Test fixture overlap (BrainWise Test Corp, org_id `2633a225-e071-4a73-b0ad-09b46ec3025f`):**
- 55 unique users with completed PTP (INST-001)
- 39 unique users with completed NAI (INST-002)
- 53 unique users with AIRSA (INST-003) self-rater data, 95 total assessments (47 self + ~48 manager pairs)
- **44 users with both PTP and AIRSA**
- **34 users with both NAI and AIRSA**
- **32 users with all three instruments**
- All overlaps well above n≥5 suppression threshold. **No test-fixture seeding needed.**

**Schema (already instrument-agnostic):**
- `org_dashboard_narratives` (id, organization_id, instrument_id text, slice_type, slice_value, participant_count, index_score numeric, dimension_scores jsonb, narrative_text jsonb, generated_by, generated_at, tri_score numeric, rsi_score numeric)
- `org_cross_instrument_recommendations` (id, organization_id, slice_type, slice_value, primary_instrument_id text, primary_narrative_id uuid, input_narrative_ids jsonb, recommendations jsonb, summary text, generated_by, generated_at)
- **No schema migration needed for either table.** Both already accept any instrument_id.

**Narrative structure per instrument (latest in BWE Test Corp):**
- All three instruments have these `narrative_text` keys: `summary`, `section_summaries`, `top_interventions`, `risk_flags`, `business_meaning`, `benefits`, `risks`, `next_steps`, `reassessment_note`, `interventions`
- PTP additionally has `archetype_name` and `archetype_description`
- AIRSA `index_score` = TCI (currently 40.1 in BWE Test Corp)
- NAI `index_score` = AI Readiness Index (currently 39.4)
- PTP `tri_score` = Threat Reactivity Index (46.9), `rsi_score` = Reward Sensitivity Index (65.2)

**Edge Function inventory (relevant):**
- `generate-dashboard-narrative` v22 — handles NAI (INST-002) and PTP (INST-001) per-instrument narratives
- `generate-airsa-org-narrative` v2 — handles AIRSA (INST-003) per-instrument narratives (Session 45 prompt rewrite)
- `generate-cross-instrument-recommendations` v7 — handles NAI×PTP cross-instrument only. **Hardcoded to reject `INST-003`** (`if (!["INST-001", "INST-002"].includes(primary_instrument_id)) throw new Error(...)`)
- v7 uses hardcoded `CO_ELEVATION_MAPPINGS` array (7 NAI↔PTP pairings from Oxford Brain Institute C.A.F.E.S.→PTP framework). **Does NOT read from `trigger_logic` table.**

**`trigger_logic` table (current state, 11 rules total):**
- INST-001 source: 2 rules (TRG-007, TRG-008 — PTP→AIRSA)
- INST-002 source: 6 rules (TRG-001 through TRG-006 — NAI→PTP, plus broader)
- INST-003 source: **only 1 rule** (TRG-011 — generic AIRSA self-vs-manager divergence → DIM-NAI-04)
- INST-004 source: 2 rules (TRG-009, TRG-010 — HSS related)
- **The table is currently a vestigial reference; no Edge Function actually reads from it.** Cole has confirmed B2 path: use `trigger_logic` as source of truth for the new AIRSA function (and refactor v7 to also read from it later).

**Routes (`src/App.tsx`):**
- `/company/nai-dashboard` → CompanyDashboard.tsx (NAI)
- `/company/dashboard` → redirects to `/company/nai-dashboard`
- `/company/ptp-dashboard` → PTPDashboard.tsx
- `/company/airsa-dashboard` → AirsaDashboard.tsx
- All gated by `RoleGuard allowedRoles={["company_admin", "org_admin", "brainwise_super_admin"]}`
- `AppLayout` wraps all corporate routes

**AIRSA dashboard tabs:** overview, domains, skill-inventory, manager-calibration, trends. The "Trends" tab is currently labeled "Trends + Cross-Instrument" and contains a TCI-over-time chart followed by **two placeholder cards** ("PTP × AIRSA correlation" and "NAI × AIRSA correlation") with text "Coming post-launch (Phase 7)".

**AIRSA dashboard locked colors (architecture-reference §10.10):** Navy/Teal/Purple/Mustard/Green/Orange/Gray/`#5A1A4A` deep plum (D8 only). STATUS_COLORS canonical: aligned=teal, confirmed_strength=green, confirmed_gap=gray, blind_spot=navy with dash, underestimate=purple.

---

## Architectural decisions locked in Session 45

1. **B2 path:** New AIRSA cross-instrument Edge Function reads from `trigger_logic` table. Add AIRSA-source rules as table rows. Future-proofs the cross-instrument layer.
2. **Three pairings symmetric:** AIRSA×NAI, AIRSA×PTP, plus updates to NAI×AIRSA and PTP×AIRSA on the existing dashboards. The existing NAI×PTP pair stays untouched.
3. **Three-way analysis (NAI×PTP×AIRSA) lives ONLY on the Org Overview dashboard.** Per-dashboard tabs stay 1×1 pairings only.
4. **Org Overview is a new top-level surface** at `/company/overview`. Same role gating as other company dashboards. Default landing for `org_admin` and `company_admin` (replacing the current default which is `/company/nai-dashboard`).
5. **Headline numbers on Overview = 2 per instrument (6 total):**
   - NAI: AI Readiness Index, AI Usage / Adoption rate
   - PTP: TRI (Threat Reactivity Index), RSI (Reward Sensitivity Index)
   - AIRSA: TCI (Talent Calibration Index), Alignment Rate

---

# PHASE 1 — Backend: trigger_logic seed for AIRSA cross-instrument

## Goal
Seed `trigger_logic` table with AIRSA-source rules covering AIRSA→NAI and AIRSA→PTP correlations, plus NAI→AIRSA and PTP→AIRSA reverse rules. Document the schema as the source of truth for cross-instrument logic.

## Scope
- 1 SQL migration (additive INSERT statements only, no schema changes)
- ~12-16 new rule rows
- No code deploy, no frontend touch

## Rules to add

### AIRSA → NAI (4 rules)
| Trigger ID | Source | Source Dim | Trigger Condition | Target | Target Dim | Recommended Action |
|---|---|---|---|---|---|---|
| TRG-012 | INST-003 | DIM-AIRSA-03 (Psych Readiness) | AIRSA Psych Readiness CPS-growth ≥ 1.0 | INST-002 | DIM-NAI-04 (Ego Stability) | High calibration gap in psychological readiness skills correlates with NAI Ego Stability concerns. Recommend NAI re-administration if >90 days since last NAI completion. |
| TRG-013 | INST-003 | DIM-AIRSA-04, DIM-AIRSA-07 | AIRSA blind-spot rate ≥ 25% on Strategic or Information Mgmt domain | INST-002 | DIM-NAI-01 (Certainty) | Workforce overconfidence in AI strategy/information skills suggests NAI Certainty may be elevated due to over-reliance on perceived expertise. |
| TRG-014 | INST-003 | DIM-AIRSA-02 (Social) | AIRSA Social domain underestimate rate ≥ 25% | INST-002 | DIM-NAI-03 (Fairness) | Managers see capability employees aren't claiming in collaborative skills. Cross-reference NAI Fairness for distribution-justice concerns. |
| TRG-015 | INST-003 | ANY | AIRSA TCI < 50 | INST-002 | ANY | Overall talent miscalibration impedes accurate AI adoption planning. Flag NAI dashboard for re-review with calibration context. |

### AIRSA → PTP (4 rules)
| Trigger ID | Source | Source Dim | Trigger Condition | Target | Target Dim | Recommended Action |
|---|---|---|---|---|---|---|
| TRG-016 | INST-003 | DIM-AIRSA-03 (Psych Readiness) | AIRSA Psych Readiness CPS-growth ≥ 1.0 | INST-001 | DIM-PTP-01 (Protection) | Low psychological readiness for AI adoption correlates with PTP Protection threat (safety/security concerns). |
| TRG-017 | INST-003 | DIM-AIRSA-06 (Proactivity) | AIRSA Proactivity blind-spot rate ≥ 25% | INST-001 | DIM-PTP-02 (Participation) | Overconfidence in proactive/risk-taking skills may mask PTP Participation threat (status/inclusion concerns). |
| TRG-018 | INST-003 | DIM-AIRSA-08 (Ethical) | AIRSA Ethical Judgment underestimate rate ≥ 25% | INST-001 | DIM-PTP-04 (Purpose) | Hidden capability in ethical AI judgment may indicate latent Purpose-domain strength not being expressed. |
| TRG-019 | INST-003 | ANY | AIRSA TCI < 50 AND PTP TRI < 50 | INST-001 | ALL | Compound miscalibration + threat-reactive workforce = high-risk AI rollout context. Pair PTP threat-management work with AIRSA calibration sprints. |

### NAI → AIRSA (3 new rules; existing TRG-005 partially covers)
| Trigger ID | Source | Source Dim | Trigger Condition | Target | Target Dim | Recommended Action |
|---|---|---|---|---|---|---|
| TRG-020 | INST-002 | DIM-NAI-04 (Ego Stability) | NAI Ego avg ≥ 50 | INST-003 | DIM-AIRSA-03 (Psych Readiness) | Identity-threat in AI contexts predicts low Psych Readiness skill capability. Flag for skill development. |
| TRG-021 | INST-002 | DIM-NAI-01 (Certainty) | NAI Certainty avg ≥ 50 | INST-003 | DIM-AIRSA-04 (Strategic) | Uncertainty aversion may impede AIRSA Strategic & Systems Thinking development. Sequence training accordingly. |
| TRG-022 | INST-002 | DIM-NAI-02 (Agency) | NAI Agency avg ≥ 50 | INST-003 | DIM-AIRSA-06 (Proactivity) | Loss-of-control concerns in AI contexts suppress Proactivity skill expression. |

### PTP → AIRSA (2 new rules; existing TRG-007, TRG-008 already cover)
- Existing TRG-007 (PTP Prediction → AIRSA D4/D5) and TRG-008 (PTP Participation → AIRSA D2/D3) are kept as-is.
- New rule TRG-023 below adds Protection-domain coverage.

| Trigger ID | Source | Source Dim | Trigger Condition | Target | Target Dim | Recommended Action |
|---|---|---|---|---|---|---|
| TRG-023 | INST-001 | DIM-PTP-01 (Protection) | PTP Protection avg ≥ 50 | INST-003 | DIM-AIRSA-03, DIM-AIRSA-08 | Safety/security threat amplifies blind spots in Psych Readiness and Ethical Judgment. Address PTP Protection before AIRSA training in these domains. |

## Migration filename
`session-XX-airsa-cross-instrument-trigger-logic-seed.sql` (replace XX with the session number when executed)

## Verification queries after applying
```sql
-- Confirm 23 total rules now (11 existing + ~12 new)
SELECT source_instrument, COUNT(*) FROM trigger_logic GROUP BY source_instrument ORDER BY source_instrument;

-- Confirm INST-003 source rules now span multiple dimensions
SELECT trigger_id, source_dimension, target_instrument, target_dimension 
FROM trigger_logic 
WHERE source_instrument = 'INST-003' 
ORDER BY trigger_id;

-- Confirm bidirectional coverage exists for all three pairings
SELECT 
  CASE 
    WHEN source_instrument = 'INST-001' AND target_instrument = 'INST-003' THEN 'PTP→AIRSA'
    WHEN source_instrument = 'INST-003' AND target_instrument = 'INST-001' THEN 'AIRSA→PTP'
    WHEN source_instrument = 'INST-002' AND target_instrument = 'INST-003' THEN 'NAI→AIRSA'
    WHEN source_instrument = 'INST-003' AND target_instrument = 'INST-002' THEN 'AIRSA→NAI'
    WHEN source_instrument = 'INST-001' AND target_instrument = 'INST-002' THEN 'PTP→NAI'
    WHEN source_instrument = 'INST-002' AND target_instrument = 'INST-001' THEN 'NAI→PTP'
  END AS pairing,
  COUNT(*) AS rule_count
FROM trigger_logic
WHERE source_instrument IN ('INST-001','INST-002','INST-003')
  AND target_instrument LIKE 'INST-00%'
GROUP BY 1
ORDER BY 1;
```

## Open question for execution time
The recommended action text for these new rules is **placeholder content drafted by Claude during recon**. Cole should review the content before finalizing the migration. Specifically:
- TRG-013, TRG-014: the psychological mappings between AIRSA blind-spot patterns and NAI dimensions are inferences, not Oxford Brain Institute canonical mappings. Validate against Phil Dixon's framework or update.
- TRG-018: the AIRSA Ethical Judgment → PTP Purpose mapping is the weakest of the proposed rules. May want to drop or replace.

---

# PHASE 2 — Backend: New Edge Function `generate-airsa-cross-instrument-recommendations`

## Goal
Build a new Class A Edge Function that generates AIRSA cross-instrument recommendations. Reads from `trigger_logic` (B2 path). Supports both AIRSA×NAI and AIRSA×PTP pairings via a single `cross_instrument_id` parameter.

## Why a new function (vs. extending v7)
- v7 hardcodes NAI↔PTP via `CO_ELEVATION_MAPPINGS` array
- AIRSA's data shape (TCI, alignment_rate, status_distribution, manager_calibration) is fundamentally different from PTP/NAI dimension averages
- AIRSA conceptual question is different ("how accurately does the org see talent?")
- Lower regression risk to live production NAI↔PTP flow
- Cole approved this path in Session 45

## File structure
```
supabase/functions/generate-airsa-cross-instrument-recommendations/
  index.ts (~400-500 lines expected)
  _shared/secrets.ts (copy of existing safeEqual helper)
  _shared/errors.ts (copy of existing serverError helper)
```

## Function signature

### Request body
```ts
{
  cross_instrument_id: "INST-001" | "INST-002",  // PTP or NAI to pair with AIRSA
  slice_type?: "all" | "department" | "org_level" | "team",  // default "all"
  slice_value?: string  // default "all"
  organization_id?: uuid  // required only for Class B internal calls
}
```
Note: AIRSA is always the **primary** instrument for this function. The `cross_instrument_id` is the pairing partner.

### Response
```ts
{
  generated: boolean,
  recommendation_id?: uuid,
  primary_instrument_id: "INST-003",
  cross_instrument_id: "INST-001" | "INST-002",
  recommendation_count?: number,
  summary?: string,
  reason?: "primary_narrative_missing" | "cross_narrative_missing"  // when generated=false
}
```

### Auth model (hybrid Class A/B, identical to generate-airsa-org-narrative v2)
- Primary path: JWT in Authorization header, validated via `auth.getClaims`, role check against `["company_admin", "org_admin", "brainwise_super_admin"]`
- Internal path: `X-Internal-Secret` header matched via `safeEqual` against `INTERNAL_FUNCTION_SECRET` env var
- Deploy with `verify_jwt: false` (function does its own auth)

## Logic flow

```
1. Auth (hybrid Class A/B)
2. Validate cross_instrument_id is INST-001 or INST-002
3. Fetch latest org_dashboard_narratives row for AIRSA (INST-003) for this org/slice
   - If missing, return { generated: false, reason: "primary_narrative_missing" }
4. Fetch latest org_dashboard_narratives row for cross instrument for same org/slice
   - If missing, return { generated: false, reason: "cross_narrative_missing" }
5. Fetch trigger_logic rules where:
   - (source_instrument = 'INST-003' AND target_instrument = cross_instrument_id) 
     OR (source_instrument = cross_instrument_id AND target_instrument = 'INST-003')
6. Evaluate each trigger_logic rule against the two narratives' dimension_scores 
   to detect which fire (e.g., "PTP Prediction avg > 50" requires reading 
   ptpNarrative.dimension_scores['DIM-PTP-03'].avg_score)
7. Build prompt with:
   - AIRSA aggregate snapshot (TCI, alignment, blind_spot, underestimate, top growth/strength domains)
   - Cross-instrument aggregate snapshot (NAI: index_score + dimension scores; OR PTP: TRI/RSI/archetype + dimension scores)
   - Fired triggers from step 6 (each with rule_id, condition that matched, recommended_action)
   - Existing AIRSA + cross-instrument interventions (from org_interventions table joined to narrative_id)
8. Call Anthropic claude-opus-4-6 with max_tokens 5000
9. Parse JSON response, validate shape
10. Insert into org_cross_instrument_recommendations:
    - primary_instrument_id = 'INST-003'
    - primary_narrative_id = AIRSA narrative ID
    - input_narrative_ids = [{ instrument_id: cross_instrument_id, narrative_id: cross narrative ID }]
    - recommendations = parsed.recommendations
    - summary = parsed.summary
11. Return success
```

## Prompt structure

Two prompt variants depending on `cross_instrument_id`:

### Variant A: AIRSA × NAI (`cross_instrument_id = 'INST-002'`)
- Primary lens: workforce TALENT CALIBRATION
- Cross lens: AI ADOPTION READINESS
- Key question: "Where does miscalibration in AI-readiness skills compound with workforce-level AI adoption friction?"
- Example compound finding: "Psychological Readiness blind spots (employees rating themselves higher than managers) coincide with elevated NAI Ego Stability — staff defensively over-rate themselves on adaptability while privately experiencing identity threat."

### Variant B: AIRSA × PTP (`cross_instrument_id = 'INST-001'`)
- Primary lens: workforce TALENT CALIBRATION
- Cross lens: ORGANIZATIONAL THREAT-RESPONSE PROFILE
- Key question: "Where does miscalibration in AI-readiness skills cluster with broader threat-reactive patterns?"
- Example compound finding: "Underestimate patterns in Social & Collaborative skills (managers seeing capability employees aren't claiming) cluster with PTP Participation threat — employees with capability are silencing themselves in low-belonging environments."

### Voice rules (mirror generate-airsa-org-narrative v2 voice)
- BANNED words: fascinating, valuable, interesting, exciting, striking, remarkable, dynamic, masking, concentrate, underpin, compound, destabilising, operationally significant
- BANNED phrases: "this creates", "this suggests you", "may be masking", "valuable calibration"
- No em-dashes
- Plain English, action-oriented
- Translate internal field names (cps_growth, blind_spot, underestimate) to plain English in prose

### Output JSON shape
```json
{
  "summary": "2-3 sentences naming the most consequential cross-instrument pattern in plain English.",
  "recommendations": [
    {
      "id": "rec_1",
      "title": "5-10 word action-oriented title",
      "rationale": "3-5 sentences explaining the compound pattern. Reference specific named skills, domains, dimensions. No internal field names. Reference at least one specific data point from EACH instrument.",
      "steps": ["Concrete step 1", "Concrete step 2", "Concrete step 3"],
      "priority": "high|medium|low",
      "time_horizon": "immediate|30-day|90-day",
      "anchor_trigger_ids": ["TRG-012", "TRG-016"],
      "primary_targets": ["DIM-AIRSA-XX array"],
      "cross_targets": ["DIM-NAI-XX or DIM-PTP-XX array"]
    }
  ]
}
```

Constraints: 2-4 recommendations, ordered priority high→low. `anchor_trigger_ids` references the trigger_logic rules that motivated the recommendation. `primary_targets` always uses DIM-AIRSA-XX. `cross_targets` uses the appropriate dimension namespace for the cross instrument.

## Deploy command (template)
```ts
deploy_edge_function({
  name: "generate-airsa-cross-instrument-recommendations",
  project_id: "svprhtzawnbzmumxnhsq",
  verify_jwt: false,
  entrypoint_path: "index.ts",
  files: [
    { name: "index.ts", content: "..." },
    { name: "_shared/secrets.ts", content: "..." },
    { name: "_shared/errors.ts", content: "..." }
  ]
})
```

## Verification after deploy
1. List edge functions, confirm v1 ACTIVE with `verify_jwt: false`
2. Test invocation from AIRSA dashboard "↻ Regenerate Cross-Instrument" button (built in Phase 4)
3. Check `org_cross_instrument_recommendations` for new rows with `primary_instrument_id = 'INST-003'`
4. Check Postgres logs for any RLS / SECURITY DEFINER errors

---

# PHASE 3 — Frontend: Org Overview Dashboard

## Goal
Build a new top-level org dashboard at `/company/overview` that surfaces all three instruments at once with a synthesized cross-instrument narrative. **This is the single highest-value user-facing surface** in the entire scope.

## File structure
```
src/pages/company/OverviewDashboard.tsx (new file, ~600-800 lines expected)
src/lib/generateOverviewDashboardPdf.ts (new file, mirror of generateAIRSADashboardPdf.ts pattern)
```

## Backend additions for Overview

### New Edge Function: `generate-overview-narrative`
Reads the latest narrative for each of the three instruments + the latest cross-instrument recommendations across all three pairings, synthesizes a top-level executive read.

#### Request body
```ts
{
  slice_type?: "all" | "department" | "org_level" | "team",
  slice_value?: string,
  organization_id?: uuid  // for Class B
}
```

#### Response
```ts
{
  success: boolean,
  narrative_id: uuid,
  participant_count: number,  // unique users across all three instruments
  instruments_present: ("INST-001" | "INST-002" | "INST-003")[]
}
```

#### Logic flow
```
1. Auth (hybrid Class A/B same as other functions)
2. Fetch latest narrative for each of INST-001, INST-002, INST-003 for org/slice
3. Compute instruments_present (subset that have data)
4. Fetch latest cross-instrument recommendations across all three pairings
   (NAI×PTP from v7, AIRSA×NAI and AIRSA×PTP from generate-airsa-cross-instrument-recommendations)
5. Build synthesis prompt (see structure below)
6. Call Anthropic claude-opus-4-6, max_tokens 6000
7. Parse JSON
8. Insert into NEW table org_overview_narratives (see schema below)
9. Return
```

#### Synthesis prompt structure
- AUDIENCE: CPO/VP HR with 15 minutes. Executive briefing register.
- INPUTS:
  - NAI summary + AI Readiness Index + top intervention
  - PTP summary + TRI + RSI + archetype + top intervention
  - AIRSA summary + TCI + alignment_rate + top intervention
  - Cross-instrument recommendation summaries (up to 3) from existing pairings
- OUTPUT:
  - 1 sentence headline (≤ 25 words) naming the single most consequential pattern across ALL three instruments
  - 3-5 cross-cutting actions integrating all three signals (each: 5-9 word title + 1 sentence rationale + ownership/time horizon)
  - 1 paragraph (3-5 sentences) "what this means for the next quarter" expanding on the headline
  - "instruments_present" coverage note (e.g., if AIRSA missing, narrative degrades gracefully)

### New table: `org_overview_narratives`
```sql
CREATE TABLE public.org_overview_narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slice_type text NOT NULL DEFAULT 'all',
  slice_value text NOT NULL DEFAULT 'all',
  participant_count integer NOT NULL,
  instruments_present jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ["INST-001","INST-002","INST-003"]
  source_narrative_ids jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{instrument_id, narrative_id}]
  source_cross_recommendation_ids jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{primary_instrument_id, cross_instrument_id, recommendation_id}]
  narrative_text jsonb NOT NULL,
  generated_by uuid REFERENCES public.users(id),
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_overview_narratives_org_slice 
  ON public.org_overview_narratives(organization_id, slice_type, slice_value, generated_at DESC);

ALTER TABLE public.org_overview_narratives ENABLE ROW LEVEL SECURITY;

-- RLS: only company_admin/org_admin/super_admin can read their org's narratives
CREATE POLICY org_overview_narratives_select ON public.org_overview_narratives
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type = 'brainwise_super_admin')
  );
```

## Overview dashboard UI structure

### Route registration in `src/App.tsx`
Add inside the `<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>` block:
```tsx
<Route path="/company/overview" element={
  <RoleGuard allowedRoles={["company_admin", "org_admin", "brainwise_super_admin"]}>
    <OverviewDashboard />
  </RoleGuard>
} />
```

Update default-landing logic so that `org_admin` and `company_admin` users land on `/company/overview` instead of `/company/nai-dashboard`. The existing `/company/dashboard` redirect should also point to `/company/overview`. (Verify which file controls the post-login redirect — likely `src/pages/Dashboard.tsx` or `src/components/CorpRedirect.tsx`. Recon at execution time.)

### Page layout (top to bottom)

**Section 1: Header**
- Title: "Workforce Overview"
- Subtitle: "Three-instrument view of AI workforce calibration, threat-response, and adoption readiness"
- Slice selector (department / org_level / team) — same component pattern as other dashboards
- "↻ Regenerate AI Synthesis" button (NAVY, primary action) — calls generate-overview-narrative
- "Export PDF" button (outline)
- Last generated timestamp

**Section 2: Six Headline Numbers (2 per instrument)**
Three color-coded cards in a 3-column responsive grid (collapses to 1 column on mobile).

| Card | Top metric | Bottom metric | Color | Click action |
|---|---|---|---|---|
| NAI | AI Readiness Index (XX/100) | AI Adoption Rate (XX%) | NAVY | → /company/nai-dashboard |
| PTP | TRI (XX/100) | RSI (XX/100) + archetype name | TEAL | → /company/ptp-dashboard |
| AIRSA | TCI (XX/100) | Alignment Rate (XX%) | GREEN | → /company/airsa-dashboard |

Each card shows the metric value, label, and a small explainer ("higher = better calibrated" / "see deep dive →").

If any instrument has no narrative data: show greyed-out card with "No data yet — complete assessments to populate" and link to the relevant feature/setup page.

**Section 3: Single Most Consequential Pattern (the headline narrative)**
Large white card with sand background highlight. Renders the synthesis Edge Function's headline (1 sentence) at fontSize 18-20, then the supporting paragraph (3-5 sentences) at fontSize 14. Uses the same `renderNarrativeText` helper as AirsaDashboard for hyphen/numbered list support.

**Section 4: Cross-Cutting Actions**
Stacked card list of 3-5 actions, each:
- Numbered prefix (1., 2., 3.)
- Action title (font-weight 600, NAVY)
- 1-sentence rationale (smaller, muted)
- Ownership + time horizon chip (e.g., "CPO · 30-day")
- Tag chips showing which instruments inform the action (e.g., "AIRSA + NAI", "All three")

**Section 5: Deep Dive Links**
Three large clickable tiles in a 3-column grid:
- "Explore NAI dashboard →" (with one-line teaser of latest NAI summary)
- "Explore PTP dashboard →" (with archetype name + TRI score)
- "Explore AIRSA dashboard →" (with TCI + most-pressed domain)

**Section 6 (optional): Coverage footer**
Small print: "This view synthesizes data from N participants across X instruments. Last regenerated: TIMESTAMP. Synthesis covers: [instruments_present]."

### Component scaffolding (skeleton)

```tsx
// src/pages/company/OverviewDashboard.tsx
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
// ... color constants matching architecture-reference §5.1

export default function OverviewDashboard() {
  const { user } = useAuth();
  const [overviewNarrative, setOverviewNarrative] = useState<OverviewNarrative | null>(null);
  const [naiNarrative, setNaiNarrative] = useState<NaiSnapshot | null>(null);
  const [ptpNarrative, setPtpNarrative] = useState<PtpSnapshot | null>(null);
  const [airsaNarrative, setAirsaNarrative] = useState<AirsaSnapshot | null>(null);
  const [sliceType, setSliceType] = useState("all");
  const [sliceValue, setSliceValue] = useState("all");
  const [regenerating, setRegenerating] = useState(false);
  
  // Load each narrative independently from org_dashboard_narratives + org_overview_narratives
  // Render headline numbers from each
  // Render synthesis from overviewNarrative
  // Render deep-dive links
  // ...
}
```

### PDF export
- File: `src/lib/generateOverviewDashboardPdf.ts`
- Mirrors `generateAIRSADashboardPdf.ts` pattern: cover page + six-card metric strip + synthesis narrative + cross-cutting actions + deep-dive teasers
- Filename: `BrainWise-Overview-CompanyDashboard-YYYY-MM-DD.pdf`
- Reuse helpers: `cleanMarkdown`, `sectionHeading`, font-state-safe `bodyText` (from Session 45 fix), `renderContinuationHeader`

## Verification

1. SQL: confirm `org_overview_narratives` table created and RLS enabled
2. Edge Function: deploy v1 with `verify_jwt: false`, confirm in `list_edge_functions`
3. Frontend: navigate to `/company/overview` as company_admin → page renders
4. Click "↻ Regenerate AI Synthesis" → spinner → narrative populates
5. With BWE Test Corp data, expected output:
   - NAI card shows index_score 39.4, AI Adoption (compute from check-ai-usage or skip if not available v1)
   - PTP card shows TRI 46.9, RSI 65.2, archetype "Vigilant Striver" (or current value)
   - AIRSA card shows TCI 40.1, Alignment 59%
   - Synthesis narrative names a cross-cutting pattern referencing all three
6. Click each "Explore X dashboard →" tile → navigates correctly
7. PDF export → renders all sections cleanly with no font-state overflow
8. Default-landing redirect: a fresh login as company_admin lands on `/company/overview`, not `/company/nai-dashboard`

## Open question for execution time
**AI Adoption Rate metric source for NAI card.** This may not be a standard NAI dashboard metric. Options:
- (a) Pull from `check-ai-usage` Edge Function (org-level usage stats)
- (b) Compute from `ai_chat_messages` table count
- (c) Drop the second NAI metric and use only the index_score (revert to "1 metric per card" for NAI)

Recon needed at execution time. If unclear, ship v1 with single NAI metric and add Adoption Rate in v2.

---

# PHASE 4 — Frontend: AIRSA cross-instrument on per-dashboard tabs

## Goal
Wire the placeholder Cross-Instrument cards on the AIRSA dashboard's Trends tab AND add new AIRSA cross-instrument sections to the existing PTP and NAI dashboards.

## File touches
- `src/pages/company/AirsaDashboard.tsx` — replace placeholder cards in Trends tab
- `src/pages/company/PTPDashboard.tsx` — add AIRSA cross-instrument tab/section
- `src/pages/company/CompanyDashboard.tsx` (NAI dashboard) — add AIRSA cross-instrument tab/section

## AIRSA dashboard changes (replace placeholders)

In the existing `activeTab === "trends"` block, replace the current two placeholder cards (lines ~887-905 in AirsaDashboard.tsx as of Session 45):

```tsx
// CURRENT (placeholder):
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
  <div style={{ background: "var(--muted)", border: "0.5px dashed var(--border)", ... }}>
    <div>PTP × AIRSA correlation</div>
    <div>Coming post-launch (Phase 7). ...</div>
  </div>
  <div style={{ background: "var(--muted)", ... }}>
    <div>NAI × AIRSA correlation</div>
    <div>...</div>
  </div>
</div>
```

Replace with two real cross-instrument cards, each with its own state hook for the latest recommendation, "↻ Regenerate" button, summary text, and 2-4 recommendation list items.

```tsx
// NEW:
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
  <CrossInstrumentCard
    primaryInstrumentId="INST-003"
    crossInstrumentId="INST-001"
    title="AIRSA × PTP"
    subtitle="Where calibration gaps cluster with threat-response patterns"
    accent={NAVY}
  />
  <CrossInstrumentCard
    primaryInstrumentId="INST-003"
    crossInstrumentId="INST-002"
    title="AIRSA × NAI"
    subtitle="Where calibration gaps coincide with AI adoption friction"
    accent={ORANGE}
  />
</div>
```

The `CrossInstrumentCard` component:
- Loads latest `org_cross_instrument_recommendations` row WHERE `primary_instrument_id = primaryInstrumentId AND input_narrative_ids @> [{"instrument_id": crossInstrumentId}]` for the current org/slice
- Renders summary at top, then numbered recommendations with title + rationale
- "↻ Regenerate" button calls `generate-airsa-cross-instrument-recommendations` with `cross_instrument_id`
- Empty state: "No cross-instrument analysis yet. Generate one below." with Generate button

## PTP dashboard changes (add AIRSA × PTP)

The PTP dashboard's existing Cross-Instrument tab currently surfaces **PTP × NAI only** (from v7). Add a sibling tab or section for **PTP × AIRSA**.

Recommended UI: convert the existing tab from "Cross-Instrument" (single section) to a sub-tabbed area:
- Sub-tab 1: "× NAI" (existing, no changes)
- Sub-tab 2: "× AIRSA" (new — uses `CrossInstrumentCard` reading the AIRSA-source recommendation from generate-airsa-cross-instrument-recommendations)

Note: when a user is on the PTP dashboard viewing the "× AIRSA" sub-tab, they're seeing the SAME `org_cross_instrument_recommendations` row that the AIRSA dashboard's "AIRSA × PTP" card surfaces — just from the inverse perspective. The recommendation is the same data; the dashboard just displays it. This means **only one Edge Function call regenerates both views**.

## NAI dashboard changes (add NAI × AIRSA)

Same pattern as PTP. Add a sub-tab to the existing Cross-Instrument tab:
- Sub-tab 1: "× PTP" (existing, no changes)
- Sub-tab 2: "× AIRSA" (new — uses `CrossInstrumentCard` reading the AIRSA-source recommendation)

## Shared component to extract

Create `src/components/company/CrossInstrumentCard.tsx`:
```tsx
interface Props {
  primaryInstrumentId: "INST-001" | "INST-002" | "INST-003";
  crossInstrumentId: "INST-001" | "INST-002" | "INST-003";
  title: string;
  subtitle: string;
  accent: string;  // hex color
  sliceType: string;
  sliceValue: string;
}

export function CrossInstrumentCard({ ... }) {
  // 1. Load latest org_cross_instrument_recommendations row matching the pair
  // 2. Render summary + recommendations
  // 3. "↻ Regenerate" button calls the right Edge Function:
  //    - If primary = INST-003: generate-airsa-cross-instrument-recommendations
  //    - Else: generate-cross-instrument-recommendations (v7) with primary_instrument_id
  // 4. Empty state with Generate button
}
```

## Verification

1. AIRSA dashboard → Trends tab → both cross-instrument cards render with AIRSA Test Corp data
2. PTP dashboard → Cross-Instrument tab → both sub-tabs render
3. NAI dashboard → Cross-Instrument tab → both sub-tabs render
4. Regenerate from any of the four cards triggers the right Edge Function
5. Regenerated recommendation appears identically across paired dashboards (e.g., AIRSA dashboard's "AIRSA × PTP" card and PTP dashboard's "× AIRSA" sub-tab show the same recommendation)
6. PDF exports (existing PTP dashboard PDF, existing NAI dashboard PDF) optionally include the new sub-tab content. **Decision deferred:** include in v1 PDF or post-launch enhancement.

---

# Cross-cutting concerns

## Voice consistency
All AI narratives across this scope (Phase 2, Phase 3) follow the **action-oriented voice** established by `generate-airsa-org-narrative` v2 in Session 45:
- Plain English, written for CPO/VP HR
- BANNED words list (consistent across all functions)
- BANNED phrases list
- No em-dashes
- Skill names not skill numbers
- Internal field names translated to plain English

When implementing, reference the v2 prompt structure as the canonical voice guide. Copy the VOCABULARY RULES table verbatim where applicable.

## Build queue priority sequencing
This scope (Org Overview + AIRSA cross-instrument) should be sequenced **AFTER** the Action-Oriented Voice Redesign (current top Build Queue priority) because:
- The Voice Redesign rewrites NAI and PTP per-instrument narrative voice to match AIRSA's new voice
- The Overview dashboard pulls headlines and summaries from those per-instrument narratives
- If Overview ships first, it will surface the old clinical voice for NAI/PTP and the new voice for AIRSA — inconsistent

If Cole prioritizes Overview before Voice Redesign, accept the temporary voice mismatch and revisit after Voice Redesign completes.

## Anthropic usage cost
Phases 2 and 3 add new AI calls:
- `generate-airsa-cross-instrument-recommendations`: ~5000 tokens per call, called per slice when user regenerates (rare)
- `generate-overview-narrative`: ~6000 tokens per call, called per slice when user regenerates

Both gated by `check-ai-usage` Edge Function (existing). No new usage tracking required; the existing `org_ai_usage` table covers all org-level AI calls by `function_name`.

## Lovable credit conservation
Phase 3 (Org Overview) is the largest frontend deliverable. Recommendation: split into two Lovable prompts:
- Prompt A: Overview page scaffold (route, layout, data loading, headline cards)
- Prompt B: Synthesis card + cross-cutting actions list + deep-dive tiles + PDF export

Phase 4 is smaller — likely 1 Lovable prompt covering all three dashboards' changes plus the new shared `CrossInstrumentCard` component.

## SOC 2 considerations
- All new Edge Functions follow existing Class A/B hybrid auth pattern with `safeEqual` for constant-time secret comparison (CC6.1)
- All new RPCs and queries enforce org isolation via RLS or explicit `organization_id` checks (CC6.3)
- New `org_overview_narratives` table has RLS enabled with same pattern as `org_dashboard_narratives` (CC6.3)
- All errors sanitized via `serverError` helper (CC7.2)
- No PII in error responses

---

# Estimated session breakdown

**Session A:** Phase 1 (trigger_logic seed) + Phase 2 (new Edge Function backend) — pure backend, no Lovable
**Session B:** Phase 3 part 1 (Overview page scaffold + headline cards) — first Lovable prompt
**Session C:** Phase 3 part 2 (synthesis narrative + actions + deep-dive tiles + PDF) — second Lovable prompt
**Session D:** Phase 4 (per-dashboard cross-instrument extensions) — third Lovable prompt
**Session E (optional):** Polish, voice tuning, PDF refinements based on test fixture output

If sessions are long enough to combine, Phase 1+2 fit in one session; Phase 3 fits in one session if the Overview page complexity stays manageable.

---

# Files this scope will create or modify

**New files (8):**
- `supabase/migrations/session-XX-airsa-cross-instrument-trigger-logic-seed.sql`
- `supabase/migrations/session-XX-org-overview-narratives-table.sql`
- `supabase/functions/generate-airsa-cross-instrument-recommendations/index.ts`
- `supabase/functions/generate-airsa-cross-instrument-recommendations/_shared/secrets.ts`
- `supabase/functions/generate-airsa-cross-instrument-recommendations/_shared/errors.ts`
- `supabase/functions/generate-overview-narrative/index.ts` (+ same _shared files)
- `src/pages/company/OverviewDashboard.tsx`
- `src/lib/generateOverviewDashboardPdf.ts`
- `src/components/company/CrossInstrumentCard.tsx`

**Modified files (4):**
- `src/App.tsx` (add Overview route, update default landing)
- `src/pages/company/AirsaDashboard.tsx` (replace placeholder cards in Trends tab)
- `src/pages/company/PTPDashboard.tsx` (add × AIRSA sub-tab)
- `src/pages/company/CompanyDashboard.tsx` (add × AIRSA sub-tab)

**Possibly modified (recon-dependent):**
- `src/pages/Dashboard.tsx` or `src/components/CorpRedirect.tsx` (default-landing redirect logic)

---

# Open questions for Cole at execution time

1. **AI Adoption Rate metric on Overview NAI card** — pull from check-ai-usage, compute from ai_chat_messages, or drop?
2. **Trigger logic rule content** — the recommended_action text drafted in this scope is placeholder. Cole should review against Phil Dixon's framework before applying the migration.
3. **PDF export from PTP/NAI dashboards** — should new × AIRSA sub-tab content be included in those existing PDFs, or kept dashboard-only for v1?
4. **Default-landing redirect for super_admin** — should brainwise_super_admin land on `/company/overview` or `/super-admin/health`? (Probably keep super_admin on health.)
5. **Slice support on Overview** — does the Overview dashboard support department/team slices like the per-instrument dashboards, or stay org-wide only for v1?

---

*End of scope doc. Save this file to project knowledge or upload at the start of the implementation session. The receiving session will execute Phase 1 → Phase 4 in order.*
