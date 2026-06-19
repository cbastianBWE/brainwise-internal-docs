# BrainWise Session 144 to 145 Handoff

*Closeout: Session 144. Open: Session 145.*

## Where Session 144 left off

INT-5, the `sequence` interactive lesson-block type (Phase 3 of the Lesson Experience uplift), shipped end to end with full §61 5-surface parity. The block is a vertical list of 2-8 items the trainee drags into the correct order. The authored array order IS the correct order; the trainee sees the list shuffled and drags to match. It is STATELESS (no table, no block-specific RPC); completion rides the existing sticky `upsert_lesson_block_progress` path, card_sort-style: the block completes the moment the learner reaches the correct order (the completion effect fires even before they press "Check my answers"), the Check button paints each row green/red, retries are unlimited, and `gating_required` defaults false. Each item carries a TipTap text plus an OPTIONAL per-item image.

Backend (two migrations, each verified by a separate execute_sql), frontend (one Lovable arc, SHA-verified at HEAD), and three versioned generators (draft v19 / scaffold v30 / expand v31, deployed by Cole and boot-probed clean this session) are all in. No new edge fn and no new table.

The one thing unique to sequence is the AUTO-PEXELS RESOLVER: per-item images auto-resolve at full-lesson build via `resolveSequenceImages` in `AiPane.tsx` (the draft single-block path stays picker-only). This is verified present in the deployed code, NOT yet run live.

INT-8 (activation poll), the last Phase 3 item, was designed this session but DEFERRED to the build queue at Cole's direction. Its full design is locked (see below) so it is not re-litigated when it comes up.

## Session 145 opening priorities, in order

### 1. Start Phase 4 (INT-2 deferred to the build queue)

Cole's directive: next session starts Phase 4, but INT-2 (instrument-result personalization) is DEFERRED to the build queue for later. Phase 4 this session is the remaining three items, ordered lightest to heaviest:

- **VIS-4 media-beside-text two-column.** A layout block pairing media (image) beside text. Likely a new block type (so §61 parity), but visual/static, the lightest of the three.
- **INT-7 confidence-weighted knowledge check.** RECOMMENDED DIRECTION (learner-first, confirm at recon against the live `knowledge_check` renderer + form): fold it into the existing `knowledge_check` as an optional block-level `confidence_weighted` mode, NOT a new block type. Confidence-weighting is orthogonal to question type, so riding knowledge_check gives the learner confidence-weighting across all 7 question types (MC, multi-select, true/false, fill-in-blank, match, ranking, timeline) instead of a narrow standalone block, and keeps one coherent check rather than two lookalikes. The one model change the flag forces: when confidence mode is ON, the question is SINGLE-ATTEMPT with confidence-by-correctness quadrant feedback (confident-and-wrong is the priority misconception to surface), and completion becomes "answered" not "answered correctly" (retry-until-correct destroys the first-pass confidence signal). Default knowledge_check behavior is untouched when the flag is off, which contains regression risk without a second block. Medium weight.
- **INT-6 branching scenario.** The HEAVIEST and built last. The existing `scenario` block (Session 70) is deliberately LINEAR (a list of moments); INT-6 branching is the graph-shaped version where a choice routes to a different next moment, which is a different data shape, not an extension of the linear block. Present design locks before any build (the INT-8 treatment); it may not finish in one session.

Each new block type triggers §61 5-surface parity (lesson_block_types row + config schema; editor form + blockTypeMeta; BlockRenderer editor+trainee; draft-lesson-block; scaffold-lesson-outline + expand-lesson-from-outline). ai-authoring-chat stays exempt. Confirm exact scope/order against the build queue at session open; do not assume beyond what the docs define.

### 2. INT-8 activation poll (on the queue, build when prioritized)

Deferred but fully designed. Locked decisions, do not re-open:

- **Block-level `poll` block type, NOT a cover feature.** Reuses §61 machinery; place as the first block for activation or mid-lesson. (Origin was the TP-4 title-page item.)
- **Response-storage fork (Cole's scope call):** FULL (recommended) = a new `lesson_poll_votes` table (one row per user per poll block, upsert on re-vote) + RLS (insert/update/select own only) + a SECURITY DEFINER aggregate RPC pair (`cast_poll_vote`, `get_poll_results`) that reveals the per-choice distribution after voting, scoped PER-ORG for multi-tenant correctness. LIGHTWEIGHT = vote in `lesson_block_progress.completion_data`, no new table, no aggregate reveal. The aggregate reveal is the activation payoff, which is why this is the heaviest remaining item and was sequenced last.
- **Config schema:** `{ question, options:[{client_id, text}], allow_revote, show_results, gating_required }`. Options text-only in v1, so no walker change.
- **Build plan (full):** migration 1 = lesson_block_types poll row; migration 2 = lesson_poll_votes + RLS; migration 3 = cast_poll_vote + get_poll_results (REVOKE public/anon + grant authenticated, RLS functional test as a rolled-back DO block, NOTIFY pgrst); generators draft v20 / scaffold v31 / expand v32 (AI emits question + 2-8 options, never votes); frontend PollBlockForm + blockTypeMeta + BlockEditorPane dispatch + BlockRenderer case + PollRender + css, SHA-verify.

### 3. The combined lesson-block smoke test (still deferred)

Cole is deferring one combined functional test until the lesson-block phases are done. It covers, in-app, the whole recent arc:

- **sequence (INT-5):** build a lesson via the AI chat that warrants ordering; confirm `scaffold` proposes `sequence` and `expand` builds it; confirm the AUTO-PEXELS RESOLVER actually populates per-item images during the build (this is the one INT-5 path verified only structurally so far). Then trainee-drag to the correct order and confirm completion.
- **reveal_cards (INT-4), hotspot (INT-3), open_response (INT-1):** carried from prior sessions, exercised in the same pass.

If the smoke test surfaces anything, fix it in the same arc.

## Decisions locked in Session 144 (recap)

- sequence is STATELESS: no table, no block-specific RPC; completion via the sticky `upsert_lesson_block_progress` path, card_sort-style (completes on reaching the correct order, fires before Check is pressed); `gating_required` defaults false.
- Authored array order = correct order; trainee sees a shuffle (re-swapped if the shuffle is degenerately already-correct).
- Config schema is FLAT, array key `items`: `{ instructions, items:[{client_id, text, image_query, image_asset_id, caption}], gating_required, background_color, padding }`.
- Per-item images auto-resolve at full-lesson build only (Option A), via `resolveSequenceImages` in `AiPane.tsx`. The draft single-block path is picker-only (intentional asymmetry).
- Icon `ArrowUpDown`. dnd-kit vertical sortable. MIN_ITEMS 2 / MAX_ITEMS 8 / MAX_CAPTION_LENGTH 80.
- INT-8 deferred to the build queue with the design above.

## Open questions / things to lock in Session 145

- Phase 4 exact scope and order (confirm against the build queue at open).
- INT-8 response-storage fork: full-aggregate vs lightweight (decide when INT-8 is prioritized).

## Bugs in Build Queue (carried, non-blocking)

- **FlashcardsBlockForm config-drop (candidate fix, logged, not actioned).** Its emit returns only `{ cards, gating_required }`, dropping any top-level `background_color`/`padding`. RevealCardsBlockForm and SequenceBlockForm both avoid this by spreading `...value` first. Fix flashcards in a future arc.

## What's NOT in scope for Session 145

- INT-2 (instrument-result personalization): DEFERRED to the build queue for later, at Cole's direction. Not built this session.
- INT-8 build itself, until prioritized (it sits on the queue with the locked design).
- The standing carryforwards untouched this arc: SCORM export + external launch/tracking API; in-system support chatbot + admin capture; BQ-SUPERVISOR-DASH (supervisor access to company dashboards with a per-supervisor disable toggle); the Operations externalization arc (tenant-scoped RLS, non-super-admin routing, provisioning, billing; Stripe Connect / per-tenant payment collection deferred); Doc-1 invoice live refund test (pending a real Stripe-paid transaction); certificate date-placement verification; the `newsletter-sitemap` STATIC_ROUTES manual-edit reminder (still standing whenever a new public marketing page or sitemap/SEO work comes up).

## Architecture additions in Session 144

Recorded in architecture-reference.md v145:

- `public.lesson_block_types` row `sequence` (interactive, not scored, v1-active).
- `public._walk_block_config_for_asset_refs` extended: a `sequence` branch walking `items[]` and emitting each item's `image_asset_id` (the one walker all three asset RPCs route through, so it covers ref-tracking + editor signing + trainee signing).
- No new table (stateless block) and no new edge fn this session.
- The AiPane `resolveSequenceImages` post-build Pexels resolver as the Option-A, build-time-only image path for sequence.
- Generators versioned: `draft-lesson-block` v19, `scaffold-lesson-outline` v30, `expand-lesson-from-outline` v31 (all dashboard-paste; boot-probed OPTIONS 204 + no-auth POST 401).
- Frontend at HEAD: SequenceBlockForm (blob `907a6270`) and BlockRenderer (blob `06dd161c`) verified by full GitHub-API content; blockTypeMeta, BlockEditorPane, AiPane, lesson-blocks.css verified by HEAD grep of the sequence wiring.
- INT-8 poll design captured (block-level type; full-aggregate vs lightweight fork; per-org scoping; schema; build plan).

## Test fixture state at end of Session 144

Test org: BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`).

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Test lesson content_item: `e5c208f2-6885-482e-8d8b-8325f9cbaf5d`. No fixtures were created or left dirty this session (sequence is stateless; no new table). The deferred smoke test will create lesson content under this item.

## Documents this session leaves behind

- build-queue.md (v150)
- architecture-reference.md (v145)
- session-144-to-145.md (this document)

Markdown only (Session-74 decision; no .docx). Cole uploads all three manually to `cbastianBWE/brainwise-internal-docs` (flat repo root); GitHub MCP is READ-ONLY.
