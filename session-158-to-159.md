# BrainWise Session 158 to 159 Handoff

*Closeout: Session 158. Open: Session 159.*

## Where Session 158 left off

Shipped generate-paired-narrative v8 (prompt-only): an unnamed couple-repair principle in the repair section, plus a holistic per-person conflict-susceptibility field. Reviewed cross-report differentiation on the regenerated paired and team profiles (verdict: dedup works well, do not spend more on it). Delivered three frontend prompts (paired Accordion + team/paired driver-card dynamic height, conflict per_person render). Drafted a deferred 10-item personal-instrument facet-gap proposal. Deleted the Becky/Josh romantic paired profile for a clean rebuild. No migration, no new table or RPC, no cron; section 61 not triggered; numbered standing rules 1-158 hold.

## Session 159 opening priorities, in order

### 1. SHA-confirm the three frontend prompts from Session 158

Cole reports all three ran. Verify at HEAD via the GitHub API blob SHA (not raw CDN, per the verification convention): PairedReport.tsx (the Accordion grid-rows height fix at the old ~line 428 hard maxHeight 600, the driver-card expander at the old ~line 397 maxHeight open?400:0, and the new guarded per_person two-column card on ConflictSection) and TeamReport.tsx (the driver-card expander at the old ~line 463 maxHeight open?600:0). All four edits convert hard maxHeight caps to the grid-rows pattern (gridTemplateRows open?1fr:0fr + inner overflow:hidden, marginTop preserved).

### 2. Rebuild the deleted Becky/Josh paired profile against v8 and eyeball it live

The romantic paired profile 2c3afedf-b220-4666-a773-4eb53b33348b was deleted this session. Rebuild order: generate-paired-profile FIRST (recomputes the structured profile), then generate-paired-narrative v8 per section. Then confirm live that the conflict section renders the per_person card (both partners, real names via nm()) and the repair section reflects the new unnamed couple-repair wording. Becky Moore 125f0109-f262-4f0d-ae26-f20cc9ed428a, josh russo 34a377d7-660c-4554-bd6b-29f76e54e296, pair mode romantic.

### 3. Decide scope on the deferred personal-instrument expansion

Cole said the question update happens later. The 10 drafted personal-context items (full text + anchors + classifications) are recorded verbatim in the Session 158 build-queue DELTA. This is an instrument expansion (42 to 52 items), not a config tweak: it needs new items rows, ptp_facet_types classifications, an assessment version bump, a decision for the 127 existing respondents (re-take or partial scoring), and pentagon-scoring absorption. Resolve the three classification flags first (trust salience Quiet to Moderate; well-being vigilance DIM-PTP-01 and Convergent vs Neutral; social comparison Moderate vs Quiet), then sequence the versioning work.

### 4. Carried queue (unchanged from Session 157 close)

Completion-triggered team/paired notifications, BQ-PTP-DEBRIEF-REMINDERS, a report PDF exporter, and the Heygen-for-resources follow-up. Then PTP Phase 2 (load classification rationale into the coach section) and Phase 3 (the ptp_facet_interactions table).

## Decisions locked in Session 158 (recap)

- Couple-repair principles inform the repair section but are NEVER named (no external method or model). The romantic lens already forbids naming any third-party framework; trademark and affiliation risk.
- Conflict per_person is reasoned holistically across each person's whole pattern, not trait-by-trait. No named horsemen, soft "may be prone to" phrasing, a counter-move per person, defer to qualified help if harm is indicated.
- The repair principle line is pair-agnostic (applied through the drivers wherever the two compete for the same ground), not hardcoded to autonomy.
- Do not spend more effort on cross-section dedup; differentiation now works.
- The 10-item personal-instrument expansion is a proposal only until Cole sets scope.

## Open questions / things to lock in Session 159

- Scope and versioning plan for the personal-instrument expansion (which of the 10 items, and the 42 to 52 re-take/scoring path).
- The three classification flags on the drafted items.

## Bugs surfaced in Session 158 added to Build Queue

- None. (One durable deploy lesson logged: on-disk working copies of edge functions can be stale; get_edge_function is authoritative for live source. Already standing practice, reaffirmed.)

## What's NOT in scope for Session 159

- Writing any of the 10 new personal items to the live instrument before Cole sets scope.
- Any newsletter or public-marketing-page work this session did not touch (the newsletter-sitemap STATIC_ROUTES reminder was not triggered).

## Architecture additions in Session 158

generate-paired-narrative v8 is a prompt-only change: no migration, no new table, no new RPC, no edge-to-edge call, no cron. The new conflict output schema is {summary, mitigate, promote_healthy, per_person:{a:{read,counter_move}, b:{read,counter_move}}}; the conflict prompt now also receives standouts(facets,"a"/"b") and its token budget rose 1400 to 2400. Full detail in architecture-reference.md v159.

## Test fixture state at end of Session 158

Test org: BrainWise Test Corp (2633a225-e071-4a73-b0ad-09b46ec3025f).

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

PTP paired fixtures: the only romantic paired profile (Becky Moore and josh russo) was DELETED this session and needs rebuilding (generate-paired-profile then generate-paired-narrative v8) before any paired smoke test. total_paired_profiles is currently 0.

## Documents this session leaves behind

- build-queue.md (v160, Session 158 DELTA added)
- architecture-reference.md (v159, Session 158 CLOSE entry added)
- session-158-to-159.md (this document)

Markdown only (Session-74 decision; no .docx). Markdown source-of-truth at cbastianBWE/brainwise-internal-docs.
