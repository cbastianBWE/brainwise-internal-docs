# Session 163 to 164 Handoff

**Docs bumped:** Build Queue v164 to v165 (Session 163 DELTA banner). Architecture Reference v163 to v164 (header + v164 changelog entry). This handoff: session-163-to-164.md. Markdown only (Session-74 decision). Repo is flat-root; upload all three files to the repository root.

**Session shape:** PTP scoring-integrity and report-quality work. Shipped: the PTP health-question dimension-naming text edits, the Group 2 assessment save/nav reliability changes (verified on main), and the Group 3 action-plan narrative code-leak fix at the generator (deployed, boot-probed, verified clean on the super-admin report). Parked with Phil: the reverse-scoring items (Group 1 items 1/2). Not scoped: the report video slot (Group 3 item 2), pending Cole loading the video. Next session starts Group 4, then Group 5, then Group 6.

---

## Group 1 - PTP scoring integrity

**Item 3 - health-question dimension naming (SHIPPED, text-only, zero scoring impact).** Items 9/54/55/56 are the 4-part health block (all INST-001, all reverse_scored=false). Each now names its dimension in the body and low anchor: item 9 physical, 54 mental, 55 emotional, 56 spiritual. Migrations `ptp_items_54_55_specify_health_dimension` + `ptp_items_9_56_specify_health_dimension`, each verified by a separate execute_sql. The shared 4-part framing sentence was left unchanged.

**Items 1 + 2 - reverse-scoring (PARKED with Phil).** The audit concluded the defect is display-only: the generator already scores reverse items correctly (100 minus raw). A rename/display proposal (`ptp-reverse-scoring-rename-proposal.md`) went to Phil. Item 1 (audit) and item 2 (anchor reversal on reverse items for display) are both on hold pending his decision; item 2's scope depends on which items stay reverse. When the reverse-scoring change lands it triggers a delete-and-regen pass across affected reports, which is the hook the code-leak remediation piggybacks on (below).

---

## Group 2 - assessment save / nav reliability (SHIPPED, verified on main)

**File:** `src/components/assessment/AssessmentFlow.tsx`, blob SHA `1c9bb956ba92083136a988f69fad5d280215a3c7`. One comprehensive Lovable prompt, no backend (save path is a client upsert on the unique (assessment_id, item_id); RLS owner + status in_progress; no schema/RPC/RLS change).

**Change 1 - save reliability (real bug).** `saveResponse` now checks the upsert error: on failure it adds the item to an `unsavedItems` Set and shows a destructive toast (no false "Saved"); on success it removes the item and shows the saved indicator. New `flushUnsaved()` re-attempts every unsaved item; the previously fake 60s auto-save interval now calls it. `handleSubmit` awaits `flushUnsaved()` and blocks submit while `unsavedItems.size > 0`; every submit control (both footer and dialog) is disabled on unsaved.

**Change 2 - tab-jump.** A `loadedAssessmentRef` guard makes the Phase 2 loader run once per assessmentId and never re-clobber the current position on tab refocus (the loader used to re-run via unstable onExit/user deps and snap back to firstUnanswered).

**Change 3 - review-answers (net-new, all instruments).** The last item shows "Review your responses" vs "Submit". The review view renders each item's REAL control (SliderControl with full question + 0-100 slider + both anchors, FrequencyControl, LevelMatchControl) prefilled and wired to `saveResponse` for inline edit while scrolling, flags unanswered per card, shows "Answered X of N", "Back to questions", and a Submit gated on `allAnswered && unsavedItems.size === 0`.

Cole's other two Group 2 items (resume position, end-of-assessment unanswered flow) needed no change and were left as-is.

---

## Group 3 - report fixes

**Item 1 - action-plan narrative dimension label / code leak (ROOT-CAUSED, FIXED at the generator, VERIFIED).**

The reported raw `DIM-PTP-0N` in the report's Suggested Next Steps was NOT a render bug. Every on-screen surface already name-maps the tag (DimensionPill via PTP_DIMENSION_NAMES; DevelopmentPlan `PTP_DIMENSION_NAMES[tag] ?? tag`; PeerPtpReport `DIM_NAMES[tag] ?? tag`; NAI maps too), and the PDF maps via `data.dimensions`. The raw codes were in the AI NARRATIVE PROSE, and the model was also mis-pairing codes with wrong names (e.g. "DIM-PTP-04 (Protection)" when 04 is Purpose; "Future certainty need (Prediction, DIM-PTP-01)" when Prediction is 03).

Root cause: `generate-facet-interpretations` fed the model the dimension scores as CODE-keyed JSON (`{"DIM-PTP-01":n,...}` from roundedMeans / roundedScores) in every PTP prose builder, so the model parroted the codes and guessed names. The driving-facets block below it already printed names.

Fix (all backend, in the edge fn, dashboard-paste since it is ~170KB; index.ts only, drivingFacets.ts unchanged):
1. Scores handed to the model are now NAME-keyed (built from PTP_DIMENSION_NAMES) in all five PTP prose builders: buildCrossAndActionPrompt, buildContextNarrativePrompt, buildCoachQuestionsPrompt, the legacy buildNarrativePrompt, and buildDimensionHighlightsPrompt.
2. A module-level `PTP_DIMENSION_NAME_RULE` constant (refer to dimensions only by name; never write a DIM-PTP-0N code in a sentence) is injected into all five PTP prose prompts, mirroring the rule the NAI action-plan prompt already carried.
3. The bare code was dropped from the dimension-highlights block header.

Structured fields unchanged: `dimension_tags` and the dimension-highlights object keys stay as codes because the frontend maps them. PTP_DIMENSION_NAMES: 01 Protection, 02 Participation, 03 Prediction, 04 Purpose, 05 Pleasure.

Deploy + verify: Cole dashboard-pasted the edited index.ts. Boot-probe clean (OPTIONS 200 + CORS headers; unauthenticated POST returns the function's own `{"error":"No authorization header"}` - this fn throws its own auth error, not the Class A 401 gate). Verified on the super-admin's own report: the 12 cached prose rows were deleted, regenerated on reopen, and confirmed to contain zero `DIM-PTP` in prose across cross_and_action / profile_overview / personal_summary / dimension_highlights, all three contexts.

**BQ-PTP-NARRATIVE-CODE-LEAK-REMEDIATION (queued; gated on the reverse-scoring regeneration).** 20 contaminated prose rows across 14 pre-fix reports still hold leaked codes (measured this session; 279 of 299 prose rows were already clean because the model only parrots sometimes). Do NOT purge standalone. Fold the row deletion into the reverse-scoring delete-and-regen pass (the BQ-PTP-REVERSE-BACKFILL method) so every affected report regenerates once through the fixed prompt. Detection predicate: the prose blob (cross_assessment plus each action_plan title/rationale/steps; profile_overview text; personal_summary bullets; dimension_highlights values; coach_questions) contains the substring `DIM-PTP`. Deleting a contaminated row triggers lazy on-view regeneration.

Durable learning: on-screen pills and the PDF already name-map the tag, so a leaked code in a report is a GENERATION artifact in the cached prose, not a render bug. Look at the facet_interpretations prose, not the frontend.

**Item 2 - report video slot (NOT scoped).** Pending Cole loading the video. Recommended default on the table (super-admin-configured explainer video at the report top, one per instrument, played through the existing Mux content_item chain, visible to all viewers of that instrument's report). Scope to be set once Cole has the video: placement, owner, per-instrument/context/user, source (Mux vs HeyGen/URL).

---

## Edge function versions this session

- `generate-facet-interpretations`: new version deployed (from v64 base) with the five-builder prose dimension-naming fix. Dashboard-paste only (~170KB). boot-probe: OPTIONS 200 + CORS; unauthenticated POST returns `{"error":"No authorization header"}` at HTTP 500 (this fn's own auth throw, not the Class A 401 pattern).
- No other edge functions changed.

---

## Carried / next

- **Next session, in order:** Group 4 (paired/team repair-conflict section [Phil scope] + team/paired PDF exporter), then Group 5 (coach-client results-access gating: hold client results email until debrief), then Group 6 (drip campaign, one-page profile summary, tech/system-health chatbot).
- **On hold:** Group 1 items 1/2 (reverse-scoring, Phil); Group 3 item 2 (report video slot, pending Cole's video).
- **BQ-PTP-NARRATIVE-CODE-LEAK-REMEDIATION:** execute with the reverse-scoring regen.
- Newsletter-sitemap STATIC_ROUTES reminder NOT triggered this session (no new public marketing pages).

---

## Standing discipline reminders (unchanged)

- Backend-first; no Lovable prompt until SQL-verified. Plan-then-wait before any migration or deploy; single-letter approvals accepted.
- `apply_migration` success never confirms DB state; always follow with a separate `execute_sql` verify. Multi-statement `execute_sql` returns only the last result; split verifies.
- `get_edge_function` is authoritative for live source; do not reconstruct from memory. `generate-facet-interpretations` is ~170KB, dashboard-paste only, never MCP deploy. Boot-probe after deploy.
- GitHub MCP is read-only; Cole uploads the three markdown files to `cbastianBWE/brainwise-internal-docs` (flat root) via the web UI.
- Lovable Credit Conservation: read exact current frontend source before writing any prompt; one comprehensive additive prompt; diagnose before prescribing; SHA-verify shipped files.
- No em-dashes. Lead with the strongest objection; recommend a single path; max three asks per turn.
