# BrainWise Session 145 to 146 Handoff

*Closeout: Session 145. Open: Session 146.*

## Where Session 145 left off

VIS-4, the `media_text` lesson-block type (Phase 4 of the Lesson Experience uplift), shipped end to end this session with full §61 five-surface parity. The block is a STATIC two-column "media beside text" layout: one image beside a rich-text column, collapsing to a single column on mobile. It is non-interactive and non-scored. The author chooses which side the image sits on, the column ratio, and the vertical alignment. It mirrors the `image` block for the media side and `statement_a_b` for the two-column scaffold.

All five §61 surfaces are done and verified this session:

- **Backend** (one migration `vis4_media_text_block_type_and_walker`, each part verified by a separate execute_sql): the `lesson_block_types` row `media_text` (category `content`, interactive false, scored false, v1-active) and `media_text` added to the legacy single-asset IN-list on `_walk_block_config_for_asset_refs` (a top-level `asset_id` emits `media_text_asset`; the one walker all three asset RPCs route through). Walker exercised live. NOTIFY pgrst run. No new table, no new edge fn.
- **The three AI generators**, reproduced full from `get_edge_function`, esbuild parse-clean, deployed by Cole with `verify_jwt` false, and boot-probed clean this session (OPTIONS 204 + no-auth POST 401 `missing_bearer_token`), version-confirmed in `list_edge_functions`: `draft-lesson-block` v20 (deploy 30), `scaffold-lesson-outline` v31 (deploy 31), `expand-lesson-from-outline` v32 (deploy 32). ai-authoring-chat stays exempt.
- **The frontend** (one Lovable prompt, SHA-verified at HEAD `9b33110`): all six touched files git-hash-object-matched their GitHub API blob SHAs per §117 — blockTypeMeta.ts (0426cfbd), the new block-forms/MediaTextBlockForm.tsx (90723382, emit spreads `...value` first), BlockEditorPane.tsx (93a2c060), BlockRenderer.tsx (f7d06c69, MediaTextRender), lesson-blocks.css (45c6cfcc), ai-pane/AiPane.tsx (d91e3668, resolveMediaTextImages wired into buildNextBatch + deps).

VIS-4 is complete. The first work item of Session 146 is INT-7.

## Session 146 opening priorities, in order

### VIS-4 (closed in Session 145)

VIS-4 `media_text` is complete and SHA-verified at HEAD `9b33110`; no carryover. Recorded here only for continuity. The six touched files (blockTypeMeta.ts 0426cfbd, the new block-forms/MediaTextBlockForm.tsx 90723382, BlockEditorPane.tsx 93a2c060, BlockRenderer.tsx f7d06c69, lesson-blocks.css 45c6cfcc, ai-pane/AiPane.tsx d91e3668) git-hash-object-matched their GitHub API blob SHAs per §117. MediaTextRender resolves the image via urlMap.get(assetId), shows the dashed `.bw-media-text-empty` when there is no asset, and renders body-first DOM when media_position is "right" (image-first by default); the form emit spreads `...value` first; AiPane resolveMediaTextImages is wired into buildNextBatch and its deps.

### 1. INT-7 confidence-weighted knowledge check

RECOMMENDED DIRECTION (confirm at recon against the live `knowledge_check` renderer + form before building): fold it into the existing `knowledge_check` as an optional block-level `confidence_weighted` MODE, NOT a new block type. Confidence-weighting is orthogonal to question type, so riding knowledge_check gives confidence-weighting across all 7 question types (MC, multi-select, true/false, fill-in-blank, match, ranking, timeline) instead of a narrow standalone block, and keeps one coherent check rather than two lookalikes.

The model changes the flag forces when ON: the question is SINGLE-ATTEMPT with confidence-by-correctness quadrant feedback (confident-and-wrong is the priority misconception to surface), and completion becomes "answered" not "answered correctly" (retry-until-correct destroys the first-pass confidence signal). Default knowledge_check behavior is untouched when the flag is off, which contains regression risk without a second block. This validated cleanly last arc against the live renderer, which already fires completion on allAttempted, not allCorrect. Medium weight. Because it is a MODE on an existing type rather than a new type, §61 is satisfied by editing the existing knowledge_check surfaces (form + renderer + the three generators) rather than adding a new lesson_block_types row.

### 2. INT-6 branching scenario

The HEAVIEST Phase 4 item, built last; may not finish in one session. The existing `scenario` block (Session 70) is deliberately LINEAR (a list of moments); INT-6 branching is the GRAPH-shaped version where a choice routes to a different next moment, which is a different data shape, not an extension of the linear block. Present design locks for Cole's decision BEFORE any code (the INT-8 treatment).

Each genuinely-new block type triggers §61 5-surface parity (lesson_block_types row + config schema; editor form + blockTypeMeta; BlockRenderer editor+trainee; draft-lesson-block; scaffold-lesson-outline + expand-lesson-from-outline). ai-authoring-chat stays exempt.

### 3. INT-8 activation poll (on the queue, build when prioritized)

Deferred but fully designed. Locked decisions, do not re-open:

- **Block-level `poll` block type, NOT a cover feature.** Reuses §61 machinery; place as the first block for activation or mid-lesson.
- **Response-storage fork (Cole's scope call):** FULL (recommended) = a new `lesson_poll_votes` table (one row per user per poll block, upsert on re-vote) + RLS (insert/update/select own only) + a SECURITY DEFINER aggregate RPC pair (`cast_poll_vote`, `get_poll_results`) revealing the per-choice distribution after voting, scoped PER-ORG for multi-tenant correctness. LIGHTWEIGHT = vote in `lesson_block_progress.completion_data`, no new table, no aggregate reveal. The aggregate reveal is the activation payoff (why it was sequenced last and is the heaviest queued item).
- **Config schema:** `{ question, options:[{client_id, text}], allow_revote, show_results, gating_required }`. Options text-only in v1, so no walker change.
- **Build plan (full):** migration 1 = lesson_block_types poll row; migration 2 = lesson_poll_votes + RLS; migration 3 = cast_poll_vote + get_poll_results (REVOKE public/anon + grant authenticated, RLS functional test as a rolled-back DO block, NOTIFY pgrst); generators draft v21 / scaffold v32 / expand v33 (AI emits question + 2-8 options, never votes); frontend PollBlockForm + blockTypeMeta + BlockEditorPane dispatch + BlockRenderer case + PollRender + css, SHA-verify.

### 4. The combined lesson-block smoke test (still deferred)

Cole is deferring one combined functional test until the lesson-block phases are done. In-app, it covers the whole recent arc:

- **media_text (VIS-4):** build a lesson via the AI chat that warrants an image beside text; confirm `scaffold` proposes `media_text` and `expand` builds it; confirm the build-time `resolveMediaTextImages` resolver populates the image during the build (this path is verified present in code, not yet run live). Then view as trainee.
- **sequence (INT-5):** build a lesson warranting ordering; confirm scaffold/expand and the auto-Pexels per-item resolver; trainee-drag to the correct order and confirm completion.
- **reveal_cards (INT-4), hotspot (INT-3), open_response (INT-1):** carried, exercised in the same pass.

If the smoke test surfaces anything, fix it in the same arc.

## Decisions locked in Session 145 (recap)

- `media_text` is a STATIC content block: no table, no RPC, non-interactive, non-scored.
- Config schema is FLAT, `asset_id` top-level (like the image block): `{ asset_id, alt, caption, attribution, image_query, body(TipTap), media_position(left|right), media_ratio(half|third), vertical_align(top|center), background_color, padding }`.
- Walker: `media_text` added to the legacy single-asset IN-list, emitting `media_text_asset`.
- Option A (build-time resolver): AI image auto-resolution at full-lesson build only, via `resolveMediaTextImages` in `AiPane.tsx` on the single top-level `image_query`/`asset_id`; the draft single-block path stays picker-only (same asymmetry as sequence). Attribution left author-set, mirroring the sequence resolver.
- Renderer: image-first DOM by default; body-first when media_position is "right". Ratio "third" = image is the narrow column.
- In expand, the generic post-transform background tinting is a deliberate NO-OP for media_text (it never emits background_color; background is author-set, matching the image-block precedent).

## Open questions / things to lock in Session 146

- INT-7: confirm the `confidence_weighted` MODE-on-existing-type direction against the live knowledge_check form + renderer at recon before building.
- INT-6: present the branching-scenario design locks (graph data model, completion model, generator emission) for Cole's decision before any code.
- INT-8 response-storage fork: full-aggregate vs lightweight (decide when INT-8 is prioritized).

## Bugs in Build Queue (carried, non-blocking)

- **FlashcardsBlockForm config-drop (candidate fix, logged, not actioned).** Its emit returns only `{ cards, gating_required }`, dropping any top-level `background_color`/`padding`. RevealCardsBlockForm and SequenceBlockForm both avoid this by spreading `...value` first; MediaTextBlockForm is specified to do the same. Fix flashcards in a future arc.

## What's NOT in scope for Session 146

- INT-2 (instrument-result personalization): DEFERRED to the build queue for later, at Cole's direction.
- INT-8 build itself, until prioritized (it sits on the queue with the locked design).
- The standing carryforwards untouched this arc: SCORM export + external launch/tracking API; in-system support chatbot + admin capture; BQ-SUPERVISOR-DASH (supervisor access to company dashboards with a per-supervisor disable toggle); the Operations externalization arc (tenant-scoped RLS, non-super-admin routing, provisioning, billing; Stripe Connect / per-tenant payment collection deferred); Doc-1 invoice live refund test (pending a real Stripe-paid transaction); certificate date-placement verification; SHA verification of SharedHub.tsx; newsletter rendered-HTML preview in the AI co-pilot; the G3+G8+G9 SEO/AEO/RSS combined pass; the `newsletter-sitemap` STATIC_ROUTES manual-edit reminder (still standing whenever a new public marketing page or sitemap/SEO work comes up).

## Architecture additions in Session 145

Recorded in architecture-reference.md v146:

- `public.lesson_block_types` row `media_text` (category `content`, interactive false, scored false, v1-active).
- `public._walk_block_config_for_asset_refs` extended: `media_text` added to the legacy single-asset IN-list, emitting `media_text_asset` for a top-level `asset_id` (the one walker all three asset RPCs route through).
- No new table (static block) and no new edge fn this session.
- The AiPane `resolveMediaTextImages` post-build Pexels resolver as the Option-A, build-time-only image path for media_text (single top-level field, mirroring `resolveSequenceImages`).
- Generators versioned: `draft-lesson-block` v20, `scaffold-lesson-outline` v31, `expand-lesson-from-outline` v32 (all dashboard-paste; boot-probed OPTIONS 204 + no-auth POST 401; versions confirmed in list_edge_functions).
- ENV learning reaffirmed: reproducing expand (~77KB after edits) tripped the ~69KB create_file ceiling and the interrupted write produced nothing; recovery is a small create_file for chunk 1 then quoted-heredoc (`<< 'BWEOF'`) appends per section.
- FRONTEND SHIPPED + SHA-verified at HEAD `9b33110`: blockTypeMeta + MediaTextBlockForm + BlockEditorPane dispatch + MediaTextRender + lesson-blocks.css + the AiPane resolver; all six touched files git-hash-object-matched their GitHub API blob SHAs per §117.

## Test fixture state at end of Session 145

Test org: BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`).

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Test lesson content_item: `e5c208f2-6885-482e-8d8b-8325f9cbaf5d`. No fixtures were created or left dirty this session (media_text is static; no new table). The deferred smoke test will create lesson content under this item.

## Documents this session leaves behind

- build-queue.md (v151)
- architecture-reference.md (v146)
- session-145-to-146.md (this document)

Markdown only (Session-74 decision; no .docx). Cole uploads all three manually to `cbastianBWE/brainwise-internal-docs` (flat repo root); GitHub MCP is READ-ONLY.
