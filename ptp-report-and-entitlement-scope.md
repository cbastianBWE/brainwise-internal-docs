# PTP Report Pipeline + Entitlement Scope (Session 71)

Status: IN PROGRESS. This document is a record of work as it lands, not a forecast.
Created Session 71. Bug B and Bug A are COMPLETE and VERIFIED. Bug D + the all-89
facet interpretation feature are DESIGNED but NOT STARTED — D1 design spec is written
out in full in this document so the next session executes rather than re-designs.

Supabase project ref: `svprhtzawnbzmumxnhsq`
Frontend repo: `cbastianBWE/brainwise-blueprint`, branch `main`
Internal docs repo: `cbastianBWE/brainwise-internal-docs` (files at repo root, not under `docs/`)

---

## 1. ORIGINAL PROBLEM REPORT (Session 71 open)

A new user took the PTP. Their report was missing surfaces that another user's report
correctly had: no "what does this mean to me" section, no action plan, no driving-facet
AI insights, no professional/personal/combined toggle. Cole also questioned the
elevated/suppressed standard-deviation math, and reported a stuck impersonation session.

Real identifiers established this session:
- Affected new user (referred to in this doc as "the coach-paid PTP user"):
  user id `db586ec5-08f9-435c-89db-8e60d2240fe1`,
  email `evazquezencarnacion@osmotica.com`,
  PTP assessment id `f0be3170-59d0-4aa2-8bd8-f9911bb35a16`,
  PTP assessment_result id `bfb71f2c-722d-4ef4-b8a5-cbb6d386c6c9`,
  context_type `professional` (professional-only — 47 items answered).
- The coach on that PTP: user id `cf3ccc21-a7e4-4b1b-bd77-b06c8add736e`,
  email `cheryl@defineconsulting.com`, account_type `coach`, full_name `Cheryl Kish`.
- Comparison user whose report was correct: user id `febd1505-cbc2-48ed-8aa3-6e1aa68fd273`,
  email `cplummer19912003@gmail.com`. Confirmed by Cole as a real user.
  Most recent PTP `both` assessment id `11435554-e30d-425c-b102-f37e537f306e`,
  its assessment_result id `570ceeb9-6ed7-48bf-b163-3822fc790cf2`.
- Super admin: user id `1d14e510-d0d0-4687-9741-4ddfc0c37253`,
  email `cbastian@brainwiseenterprises.com`, account_type `brainwise_super_admin`.
- Two-attempts test user (took personal then professional as two separate assessments,
  but has zero `assessment_purchases` and zero `coach_clients` rows — bypassed the
  entitlement layer entirely): user id `b278bb3f-1860-4fad-a47a-ecc177457862`.
  Personal assessment `f392fc5a-d03f-4efe-a979-54c810b125d9`,
  professional assessment `01fcad95-990c-4a8d-a762-59770f160a6d`.

Stuck impersonation session: RESOLVED this session. The coach-paid PTP user had an
un-ended row in `impersonation_sessions` (id `2be9e92f-94b5-418d-ab61-d4bf73e4424a`)
that blocked the partial unique index `impersonation_sessions_one_active_per_super_admin`,
which blocked ALL of Cole's impersonations. Closed via direct UPDATE setting
`ended_at = now()`, `end_reason = 'forced'`. The `impersonation_sessions` CHECK constraint
allows `end_reason` values `manual` / `timeout` / `forced` only; the immutability trigger
allows only the `ended_at` + `end_reason` NULL -> non-NULL transition. An audit-log
inconsistency was noted (no matching `impersonation_ended` audit row) and left as
cosmetic — not pursued.

---

## 2. INSTRUMENT FACTS (verified this session)

- PTP = `INST-001`. 89 items, instrument_version `INST-1.0.0`, 5 dimensions
  (`DIM-PTP-01` Protection, `DIM-PTP-02` Participation, `DIM-PTP-03` Prediction,
  `DIM-PTP-04` Purpose, `DIM-PTP-05` Pleasure). 3 reverse-scored items.
  Item split: 47 professional items spanning only `DIM-PTP-01`/`DIM-PTP-02`/`DIM-PTP-03`;
  42 personal items spanning all 5 dimensions.
- NAI = `INST-002`. 25 items, instrument_version `INST-1.0.0`, 5 dimensions
  (`DIM-NAI-01` Certainty, `DIM-NAI-02` Agency, `DIM-NAI-03` Fairness,
  `DIM-NAI-04` Ego Stability, `DIM-NAI-05` Saturation Threshold). 0 reverse-scored items.
- AIRSA = `INST-003`. HSS = `INST-004`.
- `assessment_responses.is_reverse_scored` was verified 100% consistent with
  `items.reverse_scored`: 0 mismatches across 5,129 PTP responses and 1,024 NAI responses.
- `items` table reverse-scored column name is `reverse_scored` (boolean).
  `items` has columns including `item_id`, `item_number`, `item_text`, `dimension_id`,
  `context_type`, `reverse_scored`, `facet_name`, `scale_type`, `instrument_id`,
  `instrument_version`.

---

## 3. BUG DIAGNOSES (all root-caused this session)

### Bug B — `calculate-scores` instrument detection. STATUS: FIXED + BACKFILLED.

Root cause: deployed `calculate-scores` v45 detected instruments with
`instrument_id.startsWith("PTP")`, `.startsWith("NAI")`, `.startsWith("AIRSA")`,
`.startsWith("HSS")`. The real instrument IDs are `INST-001` / `INST-002` / `INST-003` /
`INST-004`, so none of those `startsWith` checks ever matched. Consequence: `isSlider`
(`isPTP || isNAI`) was always false, so every PTP and NAI assessment fell through to the
HSS scoring branch — reverse scoring was skipped, dimension `band` was never written, and
`high_dimensions` received every dimension (the HSS `>= 3.5` threshold applied to 0-100
slider data).

### Bug A — `generate-facet-interpretations` authorization. STATUS: FIXED + VERIFIED.

Root cause: deployed `generate-facet-interpretations` v25 had a bare ownership check:
`if (resultRow.user_id !== callerUserId)` returned HTTP 403, with no coach branch and no
super-admin branch. `generate-facet-interpretations` is frontend-triggered from the
`PTPNarrativeSections.tsx` useEffects. When the coach (Cheryl Kish) opened the coach-paid
PTP user's report in coach-view, her JWT was the caller; `resultRow.user_id` was the
client; every facet-interpretation call 403'd and wrote nothing. Because the debrief gate
means the coach is the first and only viewer of a coach-paid PTP until debrief, this fired
on essentially every coach-paid PTP and NAI. The dashboard `ai_narrative` was unaffected
because `generate-report` is called server-side by `calculate-scores` with the internal
secret, which bypasses the ownership check.

Second part of Bug A, discovered during recon: `facet_interpretations` had only an
owner-only SELECT RLS policy ("Users can view own facet interpretations"). Even after the
Edge Function was fixed to let a coach TRIGGER generation, the frontend reading those rows
back with the coach's JWT would have returned nothing. The fix required both the Edge
Function change AND new RLS policies.

### Bug D — five divergent scoring / facet-calculation implementations. STATUS: NOT STARTED.

There is no single "elevated/suppressed driving facet" calculation. There are FIVE places
that independently re-derive scoring or facet calculations, found via recon this session:

1. `src/components/results/PTPNarrativeSections.tsx`, the `fetchFacets` useEffect
   (lines 385-491 in the version read this session). Population standard deviation:
   `mean = values.reduce((a,b)=>a+b,0) / values.length`,
   `stdDev = Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0) / values.length)`.
   Elevated = `s.value > mean + stdDev`, suppressed = `s.value < mean - stdDev`, each
   `.slice(0, 10)`. Context-filtered on `s.context_type === ptpContextTab` for
   `professional`/`personal`, with the fallback `if (filtered.length > 0) scored = filtered`.
   This drives the on-screen elevated/suppressed lists AND determines which facets get sent
   to `generate-facet-interpretations` (the `facets` array, tagged `type: "elevated"` /
   `type: "suppressed"`).
2. `src/components/results/DrivingFacetScores.tsx` (full file, 257 lines, read this
   session). Population standard deviation:
   `variance = values.reduce((sum,v)=>sum+(v-mean)**2,0) / values.length`,
   `stdDev = Math.sqrt(variance)`. `upperThreshold = mean + stdDev`,
   `lowerThreshold = mean - stdDev`. Context-filtered via a SEPARATE query against
   `items.context_type` (props `contextFilter`), with the same fallback
   `if (!filteredItems.length) filteredItems = scoredItems`. Handles the two-separate-
   attempts case via the `additionalAssessmentId` prop, which fetches a second assessment's
   `assessment_responses` and concatenates: `allResponses = [...responses, ...additionalResponses]`.
   This drives the on-screen Driving Facet Scores chart.
3. `generate-report` Edge Function (deployed v34, full source read this session). Population
   standard deviation, computed in step "4b. Fetch driving facet scores (elevated/suppressed)".
   NO context filter — pools across whatever `assessment_responses` rows the assessment has.
   This drives the `driving_facets` block passed into the dashboard narrative AI prompt.
   `generate-report` runs once, server-side, at scoring time (called by `calculate-scores`),
   before any context tab exists.
4. `src/pages/MyResults.tsx`, the `combinedDimensionScores` useMemo (lines 475-493 in the
   version read this session). For the two-separate-attempts combined tab, it merges the
   stored `dimension_scores` of `ptpProfessionalResults[0]` and `ptpPersonalResults[0]`:
   when both have a mean for a dimension, `merged[dim] = { mean: (profMean + persMean) / 2, ... }`.
   CONFIRMED BUG: this equal-weights the professional dimension mean and the personal
   dimension mean regardless of how many items underlie each. A dimension has a different
   item count in professional vs personal (e.g. professional `DIM-PTP-01` has 9 items in
   the coach-paid PTP user's data; personal spans all 5 dimensions with a different split).
   Equal-weighting two dimension means is not the same as pooling the underlying items.
5. `src/pages/MyResults.tsx`, the `fetchSplitScores` effect that calls `setBothSplitScores`
   (around lines 563-610 in the version read this session). For a single `both`-context
   assessment, it re-derives professional and personal dimension means directly from
   `assessment_responses` filtered by `items.context_type`, applying reverse scoring
   inline (`value = r.is_reverse_scored ? 100 - raw : raw`). Yet another independent
   reverse-scoring + mean implementation.

All five happen to use POPULATION standard deviation (divide by N, not N-1). They diverge
structurally because (2) and (1) context-scope, (3) does not, (4) equal-weights two means
instead of pooling items, and (5) is a fifth independent reverse-scoring pass.

### The all-89 facet interpretation feature. STATUS: NOT STARTED.

Currently `generate-facet-interpretations` only ever receives the elevated + suppressed
facets in its `facets` array (at most 10 elevated + 10 suppressed = 20), built in
`PTPNarrativeSections.tsx` `fetchFacets`. The Edge Function's `buildPrompt(facetList)`
generates the 8-statement block (2 positive-self, 2 negative-self, 2 positive-others,
2 negative-others) only for those driving facets, and the prompt text branches on the
facet `type` ("Elevated facets ... Suppressed facets ... Tailor your language
accordingly."). The all-89 feature requires generating the 8-statement block for every
one of the 89 facets, context-free, with the prompt NOT branching on elevation status.

### NOT bugs (verified this session)

- The missing professional/personal/combined toggle on the coach-paid PTP user's report
  is correct behavior. That user is professional-only context. `hasPtpTabs` in
  `MyResults.tsx` is correctly false for a single professional-only result.
- The coach-paid PTP user not seeing their own report is correct behavior. The debrief
  gate is working as designed. `debriefPendingIds` in `MyResults.tsx` (populated lines
  408-425 in the version read this session) is set from `coach_clients.results_released =
  false`, and the populating block is guarded by `if (!isCoachView && effectiveUserId)`.
  So the client (self-view) sees the "Results Pending Coach Debrief" card; the coach
  (`isCoachView` true) skips that block and sees the full report. What the coach sees in
  coach-view is what the client will see after debrief release.

---

## 4. WORK COMPLETED THIS SESSION

### Bug B fix — `calculate-scores` v46. COMPLETE + VERIFIED.

Re-pulled deployed `calculate-scores` via `get_edge_function`, confirmed still v45 and
byte-identical to prior read. Surgical edit, instrument-detection block only:

Replaced:
```
const isPTP = instrument_id.startsWith("PTP");
const isNAI = instrument_id.startsWith("NAI");
const isAIRSA_legacy = instrument_id.startsWith("AIRSA");
const isHSS = instrument_id.startsWith("HSS");
const isSlider = isPTP || isNAI;
```
With:
```
const isPTP = instrument_id === "INST-001";
const isNAI = instrument_id === "INST-002";
const isHSS = instrument_id === "INST-004";
const isSlider = isPTP || isNAI;
```
`isAIRSA_legacy` was deleted entirely. The branch that was
`if (isAirsaCorrect || isAIRSA_legacy)` is now `if (isAirsaCorrect)`. `isAirsaCorrect`
was already `instrument_id === "INST-003"` and was correct; AIRSA behavior is unchanged.
One explanatory comment was added above the detection block. Nothing else in the file
changed (285 lines total).

Deployed via `deploy_edge_function` with `verify_jwt: false` explicitly. Result:
`calculate-scores` version 46, status ACTIVE, `verify_jwt: false`, ezbr_sha256
`76b53fec5aae7519ff1cb13bf3a22e1a849c64cd746d7daf941e7859335af0cd`. Deployed source
re-pulled and confirmed byte-correct.

Verification: ran SQL replicating v46's PTP scoring math against the coach-paid PTP user's
assessment `f0be3170-59d0-4aa2-8bd8-f9911bb35a16`, comparing to the values then stored
(produced by v45). v46 produces `band` on all dimensions (v45 stored had `band` null).
Reverse-scoring deltas were correct in direction and magnitude: `DIM-PTP-01` 68.11 -> 67.89,
`DIM-PTP-02` 59.47 -> 59.33, `DIM-PTP-03` 77.96 -> 79.70 (the +1.74 on `DIM-PTP-03` is the
single reverse-scored item in that dimension being correctly inverted). v46 only fixes
scoring going forward; it does not alter existing stored rows.

Staged source files (local, this session): `/home/claude/edge-functions/calculate-scores-v46/index.ts`
and `/home/claude/edge-functions/calculate-scores-v46/_shared/impersonation_gate.ts`.

### Bug B backfill — migration `backfill_ptp_nai_scores_v46_session71`. COMPLETE + VERIFIED.

Scope established: 65 PTP + 51 NAI = 116 `assessment_results` rows with
`instrument_id IN ('INST-001','INST-002')`, all active (none superseded), none with
`manager_dimension_scores`.

A dry-run SELECT found only 100 rows (59 PTP + 41 NAI) could be re-scored. The 16 missing
rows were investigated: all 16 have zero `assessment_responses` for their `assessment_id`
(`response_count = 0`), so they are un-scoreable. All 16 were confirmed to belong to
BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`) or test-harness users —
`synthetic-*@brainwise.test` accounts, `@deidentified.brainwise.local` accounts, and
`testclientbwe+%@gmail.com` accounts. They are test fixtures with assessment/result shells
but no response data. Cole's decision: exclude them from the backfill, no separate cleanup
item, just a record-keeping note. Relevant to deferred Build Queue item 102.5
(`is_internal_test` flag RLS exclusions) when that lands.

Migration applied as `backfill_ptp_nai_scores_v46_session71`. It recomputes
`dimension_scores` and `overall_profile` in place for the 100 real rows, mirroring v46
math: reverse-score flagged items (`100 - response_value_numeric`), mean per
`dimension_id` rounded to 2 decimals, `scoreBand` thresholds (`> 70` high,
`> 55` moderate_high, `> 40` moderate, `> 25` moderate_low, else low), rebuild
`high_dimensions` (band high) and `low_dimensions` (band low), rebuild `profile_summary`.
The 16 test-fixture rows are excluded automatically because the migration's inner joins
to `assessment_responses` produce no rows for them.

Verification: post-migration, all 65 PTP result rows have `band` on every dimension; 41
of 51 NAI result rows have `band` on every dimension (the 10 without are the 10 NAI
test-fixture rows, correctly untouched). The coach-paid PTP user's result
`bfb71f2c-722d-4ef4-b8a5-cbb6d386c6c9` post-backfill: `DIM-PTP-01` 67.89 moderate_high,
`DIM-PTP-02` 59.33 moderate_high, `DIM-PTP-03` 79.70 high — matches the independently
computed v46 values exactly. `cplummer19912003@gmail.com`'s result
`570ceeb9-6ed7-48bf-b163-3822fc790cf2` post-backfill: 5 dimensions, all banded, means in
the 51-54 range, all `moderate`.

### Bug B narrative regeneration. STATUS: MECHANISM VERIFIED, EXECUTION DEFERRED.

The 100 backfilled rows still carry `ai_narrative` text generated against the old (v45,
broken) scores. Cole's decision: regenerate all. Execution deferred until after Bug D +
the all-89 work, because `generate-report` re-derives driving facets with the
pre-Bug-D pooled SD method; regenerating now would bake in soon-to-be-replaced facet
content and force a second regeneration.

Mechanism verified this session: `INTERNAL_FUNCTION_SECRET` is present and non-empty in
Supabase Vault (`vault.decrypted_secrets`). `generate-report` (v34) accepts
`assessment_result_id` and has an internal-secret bypass (`x-internal-secret` header
checked with `safeEqual`); its `ai_narrative` write at step 11 is a clean overwrite
(`.update({ ai_narrative, ai_narrative_generated_at, ai_version, ai_version_history })`),
so re-running is idempotent. Regeneration can therefore be triggered via `pg_net`
`net.http_post` to `generate-report` reading the secret from the vault, without the
secret entering plaintext.

Two regeneration tasks logged (see Section 7).

### Bug A fix — Part 2 RLS migration. COMPLETE + VERIFIED.

Migration applied as `session71_bug_a_facet_interpretations_coach_superadmin_rls`. Added
two SELECT policies to `facet_interpretations`, mirroring the existing `assessment_results`
policies exactly:
- `facet_interpretations: coaches read client interpretations` — USING
  `current_user_account_type() = 'coach' AND assessment_result_id IN (SELECT ar.id FROM
  assessment_results ar WHERE ar.user_id IN (SELECT cc.client_user_id FROM coach_clients
  cc WHERE cc.coach_user_id = auth.uid()))`.
- `facet_interpretations: super admin can read all` — USING
  `current_user_account_type() = 'brainwise_super_admin'`.
The pre-existing owner-only policy ("Users can view own facet interpretations") and the
service-role policy ("Service role can manage facet interpretations") are unchanged.
Verification: `pg_policies` query confirmed all four policies present and shaped correctly.

`current_user_account_type()` is a SECURITY DEFINER SQL function defined as
`SELECT account_type FROM users WHERE id = auth.uid()`. Stored `account_type` values
confirmed this session: `brainwise_super_admin`, `coach`, `company_admin`,
`corporate_employee`, `individual`, `org_admin`, and NULL.

### Bug A fix — Part 1 Edge Function `generate-facet-interpretations` v26. COMPLETE + VERIFIED.

Re-pulled deployed v25 via `get_edge_function`, confirmed unchanged. Surgical edit, auth
block only. Replaced the bare check:
```
if (resultRow.user_id !== callerUserId) {
  logStep("Ownership check failed", { caller: callerUserId, owner: resultRow.user_id, assessment_result_id });
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```
With a tiered check: if `resultRow.user_id !== callerUserId`, fetch
`users.account_type` for `callerUserId` via the service-role client; allow if
`account_type === "brainwise_super_admin"`; else allow if `account_type === "coach"` AND
a `coach_clients` row exists with `coach_user_id = callerUserId AND client_user_id =
resultRow.user_id`; else return HTTP 403. An explanatory comment block was added. All
nine prompt-builder functions and the rest of the file are unchanged (647 lines total).

Deployed via `deploy_edge_function` with `verify_jwt: false` explicitly. Result:
`generate-facet-interpretations` version 26, status ACTIVE, `verify_jwt: false`,
ezbr_sha256 `a5d0e46daabdcaaae67451d9fb84770a7694b6742ccc5ba9f55786ec2b48dfab`.
Deployed source re-pulled and confirmed byte-correct.

Verification: Cole opened the coach-paid PTP user's report as the coach (Cheryl Kish) in
coach-view. All sections generated. Confirmed end to end — the coach's JWT now passes the
coach branch, generation runs, rows are written, and the new `facet_interpretations` RLS
policy lets the coach read them back.

Staged source file (local, this session):
`/home/claude/edge-functions/generate-facet-interpretations-v26/index.ts`.

NOTE on Bug A scope: the coach branch intentionally mirrors the existing
`assessment_results: coaches read client results` RLS policy, which does NOT exclude
`coach_clients` rows with `revoked_at` or `refunded_at` set. Tightening that is logged as
a Build Queue item (see Section 7), not done inside Bug A, to avoid an inconsistency where
the Edge Function check is stricter than the RLS policy.

---

## 5. LOCKED DESIGN DECISIONS — BUG D + ALL-89

Every decision below was made explicitly by Cole this session.

1. Bug B handling: fix-and-backfill (re-score all existing PTP/NAI results), and
   regenerate ALL narratives for affected results (not leave stale). DONE for fix and
   backfill; regeneration deferred per Section 4.

2. Standard deviation: POPULATION standard deviation (divide by N, not N-1). This is
   correct for a within-person complete-data calculation; there is no sampling. Keep what
   all five current implementations already do; do not switch to N-1.

3. "Pooled" means pooled WITHIN the active context. The professional tab computes its
   mean and SD across only the professional-context items; the personal tab across only
   the personal-context items; the combined tab across all 89. Three different
   denominators, three different means, three different SDs, three different
   elevated/suppressed sets. This is the behavior `cplummer19912003@gmail.com`'s report
   already exhibits correctly for a single `both` assessment, verified this session with
   real data: professional pool n=47 mean 52.55 sd_pop 22.58 -> 11 elevated / 12
   suppressed; personal pool n=42 mean 52.24 sd_pop 23.94 -> 7 elevated / 10 suppressed;
   combined pool n=89 mean 52.40 sd_pop 23.23 -> 18 elevated / 23 suppressed.

4. One source of truth = one canonical function, three parameterized calls — NOT one
   number. The canonical function takes `(responses, context)` and returns the
   elevated/suppressed result for that context. It is called three times per
   fully-complete PTP (professional, personal, combined). Each call is self-consistent.
   The single source of truth is the CODE, not a stored number.

5. The all-89 facet interpretation (the 8-statement positive/negative block) is generated
   for ALL 89 facets, context-free, once per attempt. It is the single source of truth
   for facet MEANING. It is NOT branched on elevation status. With the all-89 block in
   place, the interpretation for a facet is a function of `(facet, score)`, not
   `(facet, elevation-status)`, so the same facet reads identically on every tab.

6. The elevated/suppressed badge is a separate, context-scoped, CALCULATED label — not a
   separate AI call. The canonical `(responses, context)` function decides which facets
   carry the "elevated" or "suppressed" badge in a given tab and which facets appear in
   the Driving Facets section. The interpretation text those facets point at is the
   context-free all-89 block. Only the badge and the section membership change by tab; the
   interpretation text does not.

7. Three genuine per-context narrative passes — `profile_overview`, "what this means to
   me", `dimension_highlights` — generated three times (professional / personal /
   combined), because they are narrative syntheses of a pattern and the pattern genuinely
   differs by context. Each receives the FULL item-level response set for its context, not
   dimension averages. `profile_overview` and "what this means to me" each receive all
   facets for the context (professional = all 47, personal = all 42, combined = all 89).
   `dimension_highlights`: the interpretation for a given dimension receives ONLY the
   facets belonging to that dimension, in that context.

8. `dimension_highlights` generation method = Option 2 (Cole's explicit choice). ONE AI
   call per context. Inside that single call, each dimension's data is presented in
   clearly labeled, walled-off sections, with hard instructions that each dimension's
   highlight is written only from that dimension's own block. Not N separate calls per
   dimension. The requested section count must match the context's actual dimension
   coverage: professional = 3 dimensions (`DIM-PTP-01`, `DIM-PTP-02`, `DIM-PTP-03` —
   professional items do not span Purpose or Pleasure), personal = 5, combined = 5.

9. Action plan: generated per-context-attempt, so a single-context user is not left with
   an empty action plan. When both halves exist, the COMBINED action plan is canonical and
   is what displays. The per-context action plans exist as the fallback for users who only
   have one half. A fully-complete user sees one action plan (the combined one), not three.

10. Combined is its own genuine 89-item generation pass — NOT a stitch or concatenation of
    the professional and personal outputs. The combined elevated/suppressed calculation,
    the combined narrative passes, and the combined action plan are all computed over the
    full 89-item set. When the second half is taken, that triggers TWO generations: the
    second half's own context pass AND the now-unlocked combined pass.

11. AI calls cache per context — generated once, reused. The existing
    `generate-facet-interpretations` already checks `facet_interpretations` for an existing
    row by `(assessment_result_id, section_type)` before generating; that caching pattern
    is kept.

12. Confusion mitigation: framing text on each tab making the comparison group explicit
    (the professional tab states these facets stand out within the professional context;
    the combined tab states these stand out across the whole profile, and that facets
    standing out within a single context may settle closer to average in the combined
    view), plus a global note that scores do not change between tabs — only which facets
    stand out changes, because each view compares the person to a different slice of their
    own responses. This is a frontend-only addition; it does not change generation.

13. The all-89 build must right-size `max_tokens` on `generate-facet-interpretations` for
    the all-89 facet-interpretation call. Generating the 8-statement block for 89 facets
    is roughly a 7x increase in output over the current ~13-20 driving facets. The current
    `facets`-path call uses `max_tokens: 8000` and already batches in groups of 10
    (`generateBatch(facets.slice(0, 10))` then `generateBatch(facets.slice(10, 20))`). The
    all-89 build must verify the actual output is not truncated and either raise
    `max_tokens` or extend the batching to cover all 89.

14. Personal-half entitlement model: one `assessment_purchases` row (regardless of payer —
    coach-paid, self-paid, individual-paid) entitles the holder to one complete 89-item
    PTP, consumable as both-at-once OR half-then-half in any order. The purchase is not
    fully consumed until all 89 are done. Once all 89 are done, "Purchase to Access"
    returns and a new `assessment_purchases` row is required for the next PTP, producing a
    separate report following the same structure. The report layer is already partly built
    for this (see Section 6). The entitlement layer is NOT (see Section 6). This is a
    feature gap requiring schema work. Cole's instruction: design it together with Bug D
    because the report is supposed to work off the entitlement model, but it is sequenced
    LAST (after the four defects).

---

## 6. ENTITLEMENT-LAYER RECON (verified this session)

The personal-half model requires schema work. Current state, verified this session:

- `coach_clients` columns: `id`, `coach_user_id` (NOT NULL), `client_user_id` (nullable),
  `client_email` (NOT NULL), `invitation_status` (NOT NULL), `assessment_id` (nullable,
  FK to `assessments`), `coach_notes`, `created_at`, `instrument_id` (nullable, FK to
  `instruments` — the UUID-form instrument id), `stripe_payment_intent_id`,
  `stripe_coupon_id`, `coupon_amount`, `coupon_expires_at`, `coupon_redeemed` (NOT NULL),
  `results_released` (NOT NULL), `debrief_completed` (NOT NULL), `expires_at`,
  `revoked_at`, `invitation_source` (NOT NULL), `client_first_name`, `client_last_name`,
  `refunded_at`, `stripe_refund_id`, `refund_amount`, `refund_failure_reason`.
  `coach_clients` has NO context column — it cannot represent professional-half vs
  personal-half vs both.
- `coach_clients.invitation_status` CHECK constraint allows `sent` / `opened` /
  `completed` only. No "partially complete" state.
- `coach_clients.invitation_source` CHECK constraint allows `single` / `bulk` /
  `shareable_link`.
- `assessment_purchases` has `consumed_by_assessment_id` — a SINGLE FK to `assessments`
  (`ON DELETE SET NULL`). One purchase can point at one consuming assessment. There is no
  schema representation of a half-consumed purchase.
- `assessment_purchases.instrument_id` stores instrument IDs in mixed form, and some rows
  store comma-joined multi-instrument strings. Verified distinct values this session
  included `02618e9a-d411-44cf-b316-fe368edeac03` (PTP UUID, 7 rows),
  `77d1290f-1daf-44e0-931f-b9b8ad185520` (NAI UUID, 6 rows),
  `90216d9d-153c-4b7b-abe0-1d7845c9e6e0` (HSS UUID, 1 row),
  `abb62120-8cc8-435f-babc-dd6a27fbc235` (AIRSA UUID, 1 row), and the comma-joined
  `77d1290f-1daf-44e0-931f-b9b8ad185520,abb62120-8cc8-435f-babc-dd6a27fbc235` (2 rows).
- There are NO triggers on `coach_clients` or `assessment_purchases`.
- Consumption logic lives in RPCs and one trigger on `assessments`:
  - `consume_assessment_purchase(p_user_id uuid, p_instrument_short_name text,
    p_assessment_id uuid)` — SECURITY DEFINER. Builds a list of possible instrument-id
    formats from `p_instrument_short_name` (e.g. `'PTP'` -> `ARRAY['PTP','INST-001',
    '02618e9a-d411-44cf-b316-fe368edeac03']`), finds the oldest `assessment_purchases` row
    for that user with `consumed_at IS NULL` (`ORDER BY purchased_at ASC LIMIT 1 FOR
    UPDATE SKIP LOCKED`), and sets `consumed_at = NOW()`, `consumed_by_assessment_id =
    p_assessment_id`. It is all-or-nothing and context-blind: the first PTP attempt of any
    context fully consumes the purchase.
  - `link_assessment_to_coach_client()` — SECURITY DEFINER trigger function. The trigger
    `on_assessment_completed_link_coach_client` is `AFTER UPDATE ON public.assessments
    FOR EACH ROW`. When an assessment's `status` becomes `completed` (and was not
    `completed` before), it updates the matching `coach_clients` row
    (`cc.client_user_id = new.user_id`, instrument match via the `instruments` table,
    `cc.invitation_status IN ('sent','opened')`, `cc.assessment_id IS NULL`) setting
    `assessment_id = new.id`, `invitation_status = 'completed'`. It is all-or-nothing and
    context-blind: the first completed PTP of any context "completes" the `coach_clients`
    row.
  - `invitation_redeem(p_invite_code text, p_user_id uuid)` — this is the CORPORATE
    invitation flow (org membership, departments, supervisors). NOT relevant to the
    coach-paid / self-paid PTP entitlement path.
  - `link_coach_client_on_signup` — exists; not fully read this session; believed to be
    the signup-time email-match linker, not consumption-relevant.
- The two-attempts data join at the data layer is clean. For two-attempts test user
  `b278bb3f-1860-4fad-a47a-ecc177457862`, concatenating the responses of personal
  assessment `f392fc5a-d03f-4efe-a979-54c810b125d9` and professional assessment
  `01fcad95-990c-4a8d-a762-59770f160a6d` and joining to `items` produced exactly 89 total
  rows, 89 distinct `item_id`, 47 professional + 42 personal, 5 distinct dimensions, 0
  items appearing twice. Combined population mean 52.88, combined population SD 27.27.
  This confirms the data model supports joining two single-context attempts into a clean
  89-item set. NOT verified: that the frontend actually performs and consumes this join
  correctly across all surfaces (see Section 8 open items).

What the report layer already has for two-attempts: `MyResults.tsx` computes
`ptpProfessionalResults` and `ptpPersonalResults` as separate arrays, `combinedDimensionScores`
merges the two, `hasPtpTabs` becomes true when both exist, and `DrivingFacetScores` accepts
an `additionalAssessmentId` prop to fetch and concatenate the second attempt's responses.
What the entitlement layer does NOT have: any representation of a half-consumed purchase,
any context column on `coach_clients` or `assessment_purchases`, any context-awareness in
`consume_assessment_purchase` or `link_assessment_to_coach_client`.

---

## 7. IMPLEMENTATION SEQUENCING — BUG D + ALL-89 + ENTITLEMENT

Cole's instruction: backend-first, one sub-stop at a time, STOP after each for Cole's
review, Cole says continue. The overall order:

- D1 — Backend: canonical scoring module + all-89 facet interpretation generation.
- D2 — Backend: three per-context narrative passes restructure.
- D3 — Backend: combined-join correctness fix (the `combinedDimensionScores`
  equal-weighting bug and the two-attempts combined pooling).
- D4 — Frontend: collapse the five call sites onto the canonical module; remove the
  `if (filtered.length > 0)` / `if (!filteredItems.length)` fallbacks.
- D5 — Frontend: confusion-mitigation framing text; elevated/suppressed badge becomes a
  calculated label over the all-89 interpretations.
- Then: final narrative regeneration (deferred Bug B Stop 3) — trigger `generate-report`
  via `pg_net` / vault for the 5 real-user result IDs:
  `bfb71f2c-722d-4ef4-b8a5-cbb6d386c6c9` (coach-paid PTP user, PTP),
  `876485c5-1fe0-4339-b821-169c986db632` (cplummer, PTP),
  `570ceeb9-6ed7-48bf-b163-3822fc790cf2` (cplummer, PTP),
  `282f88b6-afc6-41e5-8dee-1d3cbbb6060c` (cplummer, NAI),
  `0f90d2e7-223c-4375-ad93-74a11920b4d5` (cplummer, NAI).
- Then: personal-half entitlement model + intake routing (the feature, last).

Build Queue items logged this session (to be added to build-queue.md):
- Tighten coach access RLS to exclude revoked/refunded `coach_clients` rows. The existing
  `assessment_results: coaches read client results` policy and the two new
  `facet_interpretations` coach/super-admin policies do not check `revoked_at` or
  `refunded_at`. A single migration should add `AND revoked_at IS NULL AND refunded_at IS
  NULL` (or equivalent) consistently across the `assessment_results` coach policy and the
  `facet_interpretations` coach policy together.
- Test-user demo-readiness narrative regeneration. The ~93 test-user PTP/NAI result rows
  that were backfilled also carry stale `ai_narrative`. Not real users, no urgency, but
  their reports must render correctly for demo purposes. Bulk-regenerate test-user
  narratives before any demo, via the same `pg_net` / vault `generate-report` mechanism,
  with a wider result-id set. No correctness dependency on Bug D for these.

Record-keeping note (not a Build Queue item): 16 PTP/NAI `assessment_results` rows have
zero `assessment_responses` and were correctly excluded from the Bug B backfill. All 16
are BrainWise Test Corp / test-harness fixtures. If a future row count shows 100 vs 116,
this is why.

---

## 8. D1 DESIGN SPEC (written in full so the next session executes, not re-designs)

D1 is the foundational backend sub-stop: the canonical scoring module and the all-89
facet-interpretation generation. Everything in D2-D5 depends on it.

### D1 scope

D1.a — Define the canonical driving-facet calculation as a single function, used by every
consumer. Signature and contract:
- Input: a set of scored responses (each carrying at minimum the numeric value with
  reverse scoring already applied, the `item_id` or `item_number`, the `dimension_id`,
  the `facet_name`, and the `context_type`), and a context selector
  (`professional` | `personal` | `combined`).
- The function filters the responses to the requested context (`professional` keeps
  `context_type = 'professional'`; `personal` keeps `context_type = 'personal'`;
  `combined` keeps all). NO `if (filtered.length > 0)` fallback — if a context filter
  yields zero items that is an error condition to surface, not silently revert.
- It computes the population mean and population standard deviation over the context's
  values: `mean = sum(values) / n`, `sd = sqrt(sum((v - mean)^2) / n)`.
- It returns, for that context: the mean, the SD, the list of elevated facets
  (`value > mean + sd`), and the list of suppressed facets (`value < mean - sd`), each
  facet carrying its `facet_name`, `value`, `dimension_id`, `item_number`. Sorting and any
  display cap (the current frontend uses `.slice(0, 10)`; `DrivingFacetScores` shows top
  10 of N) are applied by the caller, not baked into the canonical function — the function
  returns the full elevated/suppressed sets.
- DECISION NEEDED at D1 execution: where this function physically lives so that BOTH the
  Edge Functions (`generate-report`, `generate-facet-interpretations`) AND the frontend
  (`PTPNarrativeSections.tsx`, `DrivingFacetScores.tsx`, `MyResults.tsx`) can call the
  same implementation. The Edge Functions are Deno/TypeScript; the frontend is
  React/TypeScript. A shared `_shared/` module in the Supabase functions directory is
  reachable by the Edge Functions; the frontend cannot import from there directly. The
  options to resolve at execution: (a) one shared TypeScript source duplicated/synced into
  both the frontend and the Edge Function `_shared/` directory; (b) the calculation lives
  only in the Edge Function and the frontend stops computing it locally, instead reading a
  computed result the backend persists or returns; (c) a frontend `src/lib/` module that
  the Edge Functions cannot share, accepting that the Edge Function keeps its own copy but
  both copies are byte-identical and tested against each other. This decision was NOT made
  this session and must be made at the start of D1 with Cole.

D1.b — Restructure the facet-interpretation generation in `generate-facet-interpretations`
so the 8-statement block is generated for ALL 89 facets, context-free, decoupled from
elevation status:
- The current `buildPrompt(facetList)` text branches on facet `type` ("Elevated facets ...
  Suppressed facets ... Tailor your language accordingly."). The all-89 prompt must not
  branch on elevation. It describes the facet at its actual score.
- The current `facets` path receives only elevated + suppressed facets (built in
  `PTPNarrativeSections.tsx` `fetchFacets`). The all-89 path must receive all 89 facets
  for the attempt (or, for a single-context attempt, all the facets that attempt has).
- The current batching is `generateBatch(facets.slice(0, 10))` then
  `generateBatch(facets.slice(10, 20))` at `max_tokens: 8000`. For 89 facets this must be
  extended — either more batches of 10 (9 batches for 89) or larger batches with verified
  non-truncation. The existing cache check is by `(assessment_result_id, section_type)`
  with `section_type = "facet_insights"`; keep a cache check, keyed so the all-89 block is
  generated once per attempt.
- `max_tokens` must be right-sized and the output verified non-truncated (locked decision
  13).
- The elevated/suppressed badge stops being driven by which facets were sent to the AI.
  Instead the badge is computed by the D1.a canonical function per context, and the badge
  points at the already-generated all-89 interpretation for that facet.

### D1 execution steps (the order to actually do it in)

1. `get_edge_function` on `generate-facet-interpretations` to confirm it is still v26 and
   matches the staged source at
   `/home/claude/edge-functions/generate-facet-interpretations-v26/index.ts`.
2. `get_edge_function` on `generate-report` to confirm it is still v34.
3. With Cole, make the D1.a "where does the canonical function live" decision (a/b/c
   above).
4. Write the canonical function. Write unit-level verification SQL or a test that proves
   it reproduces the known-correct numbers for `cplummer19912003@gmail.com`'s
   `both` assessment `11435554-e30d-425c-b102-f37e537f306e`: professional n=47 mean 52.55
   sd_pop 22.58 elevated 11 suppressed 12; personal n=42 mean 52.24 sd_pop 23.94
   elevated 7 suppressed 10; combined n=89 mean 52.40 sd_pop 23.23 elevated 18
   suppressed 23.
5. Restructure `generate-facet-interpretations` for all-89 generation. Keep the auth block
   from v26 (Bug A) byte-unchanged. Keep the NAI path unchanged. Right-size `max_tokens`
   and the batching.
6. Deploy `generate-facet-interpretations` with `verify_jwt: false` explicitly.
7. `get_edge_function` to confirm the deployed source is byte-correct.
8. Verify the all-89 generation produces 89 facet interpretations (not 20), non-truncated,
   for a test assessment.
9. STOP for Cole's review before D2.

### D1 constraints carried from this session

- Every `deploy_edge_function` call MUST pass `verify_jwt: false` explicitly. These Class
  A custom-auth functions do not inherit it and it reverts to JWT-required if omitted.
- `get_edge_function` before any patch. Never reconstruct an Edge Function from memory.
- `apply_migration` does not confirm DB state — always follow with a separate
  `execute_sql` verify query.
- Multi-statement `execute_sql` blocks return only the last statement's result — split
  intermediate checks into separate calls.
- For CHECK constraints, query `pg_constraint` directly
  (`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'table'::regclass`);
  `information_schema.columns` is insufficient.
- The GitHub MCP connector is read-only. Cole uploads markdown to `brainwise-internal-docs`
  manually via the GitHub web UI at session close.

---

## 9. CURRENT-STATE FILE MAP (as of end of Session 71)

Deployed Edge Function versions confirmed this session:
- `calculate-scores` — v46, ACTIVE, `verify_jwt: false`. FIXED this session (Bug B).
- `generate-facet-interpretations` — v26, ACTIVE, `verify_jwt: false`. FIXED this session
  (Bug A). This is the D1.b target.
- `generate-report` — v34, ACTIVE, `verify_jwt: false`. Unchanged this session. Its
  step-4b driving-facet calculation is one of the five Bug D call sites and is a D1 / D3
  consumer of the canonical function.
- `generate-dashboard-narrative` — was v25 per prior context; not pulled this session.

Frontend files read in full this session (from `cbastianBWE/brainwise-blueprint`, branch
`main`):
- `src/pages/MyResults.tsx` — 91,693 bytes in the version read. Contains:
  `ptpProfessionalResults` / `ptpPersonalResults` useMemos (lines ~460-470),
  `combinedDimensionScores` useMemo (lines ~475-493, the equal-weighting bug — Bug D call
  site 4), `effectiveSelected` useMemo (lines ~496-508), `effectiveDimensionScores` useMemo
  (lines ~511-521), `bothSplitScores` state and the `fetchSplitScores` effect calling
  `setBothSplitScores` (Bug D call site 5), `debriefPendingIds` population (lines 408-425),
  the "Poll for AI narrative" useEffect (line ~525, only polls when
  `!selected.result.ai_narrative` — does not detect stale, does not generate), the
  `handleRegenerate` path that calls `supabase.functions.invoke("generate-report")` and
  consumes a message via `consumeMessage` (lines ~620-660 — NOTE: Cole stated the
  user-facing regenerate button no longer exists in the live UI; the only
  `generate-report` invoke site in the frontend is this handler), `ptpNarrativeProps`
  object (lines ~1231-1242), and the mount sites for `PTPProfileOverviewSection`,
  `PTPDimensionHighlightsSection`, `DrivingFacetScores`, `PTPFacetInsightsElevatedSection`,
  `PTPFacetInsightsSuppressedSection`, `PTPCrossAssessmentSection`, `PTPFullFacetCharts`,
  `PTPAssessmentResponsesSection` (lines ~1245-1305).
- `src/components/results/PTPNarrativeSections.tsx` — 42,659 bytes / 1,121 lines in the
  version read. Contains the `usePTPNarrativeData` hook with three useEffects:
  `fetchResponses` (lines ~225-270, builds `assessmentResponses`, context-filters with the
  fallback), `fetchNarrativeSections` (lines ~272-383, builds `dimensionItemsMap`,
  enriches `otherAssessments`, calls `generate-facet-interpretations` with `context_tab` /
  `dimension_scores` / `dimension_items`), and `fetchFacets` (lines ~385-491, the SD calc
  — Bug D call site 1 — and the `generate-facet-interpretations` call with the `facets`
  array). The `if (filtered.length > 0) scored = filtered` fallback appears in
  `fetchResponses` and again in `fetchFacets`.
- `src/components/results/DrivingFacetScores.tsx` — 8,196 bytes / 257 lines in the version
  read. Full SD calc — Bug D call site 2. Accepts props `assessmentId`,
  `additionalAssessmentId`, `contextFilter`. The `if (!filteredItems.length) filteredItems
  = scoredItems` fallback is here.
- `src/pages/Assessment.tsx` — 12,269 bytes, read this session.
- `src/components/.../InstrumentSelection.tsx` — 23,157 bytes, read this session. Relevant
  to the personal-half entitlement work: a `coach_clients` row that is `completed` with
  `assessment_id` populated matches no "unredeemed" path and falls through to "Purchase to
  Access".

Local working copies this session:
- `/home/claude/internal-docs/` — `build-queue.md`, `architecture-reference.md`,
  `session-69-to-70.md`, `_template.md`, plus this file
  `ptp-report-and-entitlement-scope.md`.
- `/home/claude/edge-functions/calculate-scores-v46/` — deployed Bug B source.
- `/home/claude/edge-functions/generate-facet-interpretations-v26/` — deployed Bug A source.
- `/home/claude/frontend/` — `MyResults.tsx`, `PTPNarrativeSections.tsx`,
  `DrivingFacetScores.tsx`, `Assessment.tsx`, `InstrumentSelection.tsx`.

---

## 10. OPEN DESIGN ITEMS (must be resolved during D2/D3/D4, flagged here so they are not missed)

1. The D1.a "where does the canonical function live" decision (a/b/c in Section 8) — must
   be made at the start of D1 with Cole.
2. `combinedDimensionScores` in `MyResults.tsx` equal-weights two dimension means
   (`(profMean + persMean) / 2`) instead of pooling the underlying items. D3 must replace
   this with a true 89-item pooled computation.
3. The combined narrative generation for a two-attempts user must join BOTH attempts'
   `assessment_responses` before building the item set. `PTPNarrativeSections.tsx`
   `fetchResponses` and `fetchFacets` each fetch responses for a single `assessmentId`;
   only `DrivingFacetScores` joins the second attempt via `additionalAssessmentId`. D2/D4
   must make the narrative and facet-insight paths join both attempts for the combined
   context.
4. `facet_interpretations` keying when a two-attempts user has two `assessment_results`
   rows: which result row do the combined-context interpretations (`narrative_combined`,
   the combined all-89 facet block) get written against, and is that keying deterministic.
   Resolve during D2.
5. The `if (filtered.length > 0)` / `if (!filteredItems.length)` fallbacks in
   `PTPNarrativeSections.tsx` (two places) and `DrivingFacetScores.tsx` (one place) must
   be removed during D4 — replaced by the canonical function's no-fallback behavior.
6. Personal-half entitlement model: the `consume_assessment_purchase` RPC, the
   `link_assessment_to_coach_client` trigger function, the `coach_clients` and
   `assessment_purchases` schemas, and `InstrumentSelection.tsx` intake routing all need
   changes to represent and handle a half-consumed purchase. Designed at the model level
   in Section 5 item 14; the detailed schema design is NOT yet written and must be done as
   its own sub-stop, last, after D1-D5.
