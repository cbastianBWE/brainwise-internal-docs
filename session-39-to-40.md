# BrainWise Session 39 to 40 Handoff

*Closeout: Session 39. Open: Session 40.*

## Where Session 39 left off

Phase 3e backend shipped end-to-end. The 24-skill `airsa_skills` reference table is created and seeded; the `skill_level_breakdown` JSONB column on assessment_results is populated by calculate-scores Branch A; six AIRSA AI section generator Edge Functions are deployed; and calculate-scores v42 fans out to all six in parallel via fire-and-forget HTTP POST on manager submission. AI section content writes to facet_interpretations rows with section_type prefixed `airsa_`, mirroring the existing PTP/NAI pattern. NAI Saturation color refactor (#FFB703 to #7a5800) shipped via Lovable.

Session 40 opens with the Phase 3e frontend Lovable prompt (15-section AirsaCombinedReport.tsx) as the next launch-blocking deliverable.

## Session 40 opening priorities, in order

### 1. [LAUNCH-BLOCKING] Phase 3e frontend Lovable prompt

Write the AirsaCombinedReport.tsx prompt covering the full 15-section layout. Read assessment_results.skill_level_breakdown plus all facet_interpretations rows where section_type LIKE 'airsa_%' in a single mount-time fetch. Loading skeletons per AI section while fan-out is still completing.

15 sections in order:
1. Header (no AI)
2. At a glance (4 metric cards, no AI)
3. Action buttons (moved up per locked decision, no AI)
4. How to read your results (with AIRSA overview folded in, no AI)
5. Domain heatmap with 5-status column (no AI)
6. Profile overview (AI - airsa_profile_overview, plain text)
7. What does this mean to me? (AI - airsa_what_this_means, 4 themed boxes)
8. Action plan (AI - airsa_action_plan, 3 timeframes)
9. Skill-by-skill comparison lollipop (no AI, all 24 skills)
10. Developmental quadrant map (no AI; brand colors not red/yellow/green)
11. Conversation guide (AI - airsa_conversation_guide, 3 openings)
12. Top 3 development priorities (AI - airsa_top_priorities, array of 3)
13. How this connects to your other assessments (AI - airsa_cross_instrument, conditional - missing row means show unlock CTA)
14. Skill reference list, collapsed (no AI; all 24 skills with name + description + domain)
15. Methodology footer (no AI)

Required components:

- SkillReference shared hover-tooltip wrapper. Mobile: tap-popover. Accessibility: aria-describedby + keyboard focus.
- Markdown post-processor: regex `/Skill\s+(\d+(?:\s*,\s*\d+)*)/g` wraps "Skill N" mentions across all AI sections with the SkillReference component. Reads name + description from skill_level_breakdown.
- Lollipop chart: 24 skills; status-based color and dash pattern.
- Quadrant scatter: brand colors (Underestimate teal, Confirmed strength green, Confirmed gap gray, Blind spot navy). Sand quadrant fills with color tint.

Bundle BUG-1 fix (MyResults.tsx isAIRSA detection) into this prompt. Bundle BUG-5 fix (Branch B completed_at re-stamp) into the same prompt.

Self-only state: same layout structure with manager columns hidden, no divergence section, banner explaining manager rating did not arrive.

### 2. [HIGH] Phase 4 PDF export

After frontend lands and is signed off, replicate the on-screen layout as a downloadable PDF. Mirror existing PTP/NAI patterns (assemblePdfDataForUser.ts is the model). jsPDF native. Self-only PDF variant for the timeout case.

### 3. [HIGH] AI generate pass

Final phrasing tweaks across all six AI section functions. Specific items: residual "this creates" leakage in profile-overview, slight inference-overreach phrasing in some boxes, fine-tuning toward purer factual observation. Deferred from Session 39 because the right time to evaluate tone is when all six sections render together in the frontend. Do this AFTER Phase 3e frontend lands, not before.

## Decisions locked in Session 39

- Storage convention: AI section content goes in `facet_interpretations` table with section_type = `airsa_<key>`. Same pattern as PTP `narrative_*` and NAI `nai_*`. UNIQUE (assessment_result_id, section_type) prevents duplicates; 23505 race-recovery path in each function reads cached row and returns. No new table needed.
- 15-section combined report layout (replaces the earlier 13-section count). Action buttons moved up to position 3. Skill reference list collapsed at position 14.
- Quadrant map color palette: brand colors only (no red/yellow/green). Underestimate = #006D77 (teal); Confirmed strength = #2D6A4F (green); Confirmed gap = #6D6875 (gray); Blind spot = #021F36 (navy).
- All six AI generators write skill numbers in prose ("Skill 7"), never names. Frontend post-processor wraps with hover-tooltip on render. AI never sees skill names on output.
- Banned word/phrase list locked: words = fascinating, valuable, interesting, exciting, striking, remarkable, dynamic, masking; phrases = "this creates", "this suggests you", "may be masking", "valuable calibration".
- AI tone: warm, factual, no inference overreach beyond what the data and framework explicitly support. Address user as "you". For the note-for-manager box, "you" means the manager.
- ★ NEW skills (Skills 10, 17, 22) get preference within priority pools when generate-airsa-top-priorities selects from a pool.
- Cross-instrument skip behavior: when user has neither PTP nor NAI, function returns success with skipped=true and writes no row. Frontend treats absence as unlock CTA.
- Hybrid Class A + Class B auth pattern for all 6 AI generators on a single function (constant-time `safeEqual` for the internal secret).
- Inline shared utilities (`_shared/secrets.ts`, `_shared/errors.ts`) per Edge Function deploy. No cross-function imports because Edge Functions deploy per-folder.
- NAI Saturation locked at #7a5800 (mustard). #FFB703 is now exclusively the --bw-amber brand token.

## Decisions backtracked in Session 39 (recorded for institutional memory)

- An `airsa_report_sections` JSONB column on assessment_results was added, then dropped. Concurrent fan-out caused last-write-wins overwrites because each function did read-modify-write on the shared column.
- A SECURITY DEFINER atomic-merge RPC `airsa_set_report_section` was created as a fix, then dropped. Although technically correct, it would have been the only centralized JSONB-merge pattern in the codebase. Inconsistent with the per-row precedent in facet_interpretations. The right call was reverting to the proven pattern.

## Open questions / things to lock in Session 40

- Should the AI generate pass tweak prompts in place (and bump version numbers) or create a v2 prompt template loaded from a config? Lean toward in-place edits unless a runtime A/B test is needed.
- Cross-instrument framework mappings: the current prompt embeds the AIRSA-domain to PTP/NAI-dimension mappings as static prose. If these ever evolve, that's 1 file to update per change. Acceptable for v1; consider extracting to a lookup table only if the mappings start changing weekly.

## Bugs surfaced in Session 39

None new. All bugs in the queue are carried from prior sessions. Session 39 work was on a clean greenfield (Phase 3e backend) and did not surface new defects.

## What's NOT in scope for Session 40

- Phase 3e backend re-architecture. The current per-row facet_interpretations storage is the canonical pattern. Do not propose alternatives.
- AI generate pass tone tweaks BEFORE the frontend ships. Tone judgment is meaningfully easier when all six sections render together.
- Phase 4 PDF export until Phase 3e frontend signs off. The PDF is a translation of the on-screen layout; building it before the layout is final wastes work.
- Phase 5 (org dashboard) - post-launch.
- Phase 7 (cross-instrument trigger_logic for AIRSA) - degraded state acceptable for v1; the section just won't fire for users without PTP/NAI.

## Architecture additions in Session 39

Schema:

- `airsa_skills` table (24 rows seeded). RLS read-only authenticated.
- `assessment_results.skill_level_breakdown` JSONB column. Partial index where instrument_id = 'INST-003'.
- `assessment_results.self_manager_divergence` per-dimension entries now include a `status` field.

Edge Functions:

- generate-airsa-profile-overview v5
- generate-airsa-what-this-means v3
- generate-airsa-action-plan v3
- generate-airsa-conversation-guide v3
- generate-airsa-top-priorities v2
- generate-airsa-cross-instrument v2
- calculate-scores v42 (Branch A fan-out wired)

Patterns:

- Hybrid Class A + Class B auth on a single Edge Function (frontend-direct calls AND service-to-service calls supported by the same handler with branching auth logic).
- Inline `_shared/` utility files per Edge Function deploy (`secrets.ts`, `errors.ts`).
- Per-row AI section content in `facet_interpretations` with section_type prefix `airsa_` (PTP uses `narrative_*`, NAI uses `nai_*`).
- Concurrent-fan-out race-safety via UNIQUE (assessment_result_id, section_type) + 23505 cache-read recovery, instead of a centralized merge column.

## Test fixture state at end of Session 39

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Session 39 renamed full_names to Maya Employee (the self-rater, +employee@) and David Supervisor (the manager-rater, +supervisor@) so AI directional output is debuggable. Production code does not hardcode these names; they are pulled from users.full_name and split on first space.

AIRSA fixture state:

- Self assessment row at status='completed' (instrument_id='INST-003', user_id = Maya)
- Manager assessment row at status='completed' (paired_assessment_id back to self, user_id = David, target_user_id = Maya)
- assessment_results combined row exists, with skill_level_breakdown populated and self_manager_divergence including status field
- facet_interpretations rows present for: airsa_profile_overview, airsa_what_this_means, airsa_action_plan, airsa_conversation_guide, airsa_top_priorities (all populated by parallel fan-out test on 2026-05-07)
- airsa_cross_instrument: NO row (Maya has no PTP/NAI; function correctly returns skipped=true and writes nothing)

Look up current state via Supabase rather than relying on the values here at Session 40 open.

## Documents this session leaves behind

- BrainWise_Build_Queue_v31.docx (uploaded to project knowledge)
- BrainWise_System_Architecture_Reference_v33.docx (uploaded to project knowledge)
- BrainWise_Session_39_to_40_Handoff.docx (this document, uploaded to project knowledge)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs.
