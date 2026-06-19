# BrainWise Session 146 to 147 Handoff

*Closeout: Session 146. Open: Session 147.*

## Where Session 146 left off

INT-7, the confidence-weighted knowledge_check, shipped end to end this session. It is a block-level `confidence_weighted` MODE on the EXISTING knowledge_check type, NOT a new block type, so §61 five-surface parity was satisfied by editing existing surfaces with NO migration and NO new edge fn. When the flag is off (default/absent), knowledge_check behavior is byte-identical to before. A bonus frontend-only Refine style-preservation fix (BQ-REFINE-STYLE-DROP) shipped in the same arc.

What confidence mode does, on the trainee renderer only: each question shows a two-point confidence control ("I'm confident" / "Not sure") that must be chosen before Check is enabled; Check is a single terminal attempt (reveal locks regardless of correctness, inputs disable, no retry); the explanation renders either way; and a 2x2 confidence-by-correctness quadrant tags each answer, with confident-and-wrong flagged "Confident but incorrect - review this" on the amber warning token as the priority misconception. A quadrant recap sits below the questions. Completion is unchanged: it still fires on allAttempted (answered, not answered-correctly) in both modes.

All surfaces done and verified this session:

- **Backend:** no migration. Confirmed `replace_lesson_blocks` / `save_lesson_block_draft` / `upsert_lesson_block_progress` are type-agnostic and store config verbatim with no per-key allowlist and no config-shape CHECK constraint, so the new boolean and the per-question `confidence` value both pass through untouched.
- **Generators** (dashboard-paste, reproduced full from `get_edge_function`, esbuild parse-clean, deployed by Cole with `verify_jwt` false, boot-probed OPTIONS 204 + no-auth POST 401 this session, live source re-verified): `draft-lesson-block` v21 (deploy 31) and `expand-lesson-from-outline` v33 (deploy 33) each gained `confidence_weighted: false` in the kc schema/hint + a preserve-only-if-already-present rule + `confidence_weighted` in the transform return. `scaffold-lesson-outline` (v31, deploy 31) is EXEMPT (emits outline shape only). ai-authoring-chat exempt.
- **Frontend** (one Lovable prompt, SHA-verified at HEAD `7db25ac`): `blockTypeMeta.ts` (blob 53191de7), `block-forms/KnowledgeCheckBlockForm.tsx` (toggle + emit spreads `...value` first + carries the flag + corrected gating copy), `BlockRenderer.tsx` (blob 360ed7e9; confidenceWeighted prop, KCPerQuestionState.confidence seeded null, canCheck gate, single-attempt reveal `confidenceWeighted ? true : correct ? true : s.revealed`, quadrant tags + summary).
- **BQ-REFINE-STYLE-DROP fix:** `BlockEditorPane.tsx` (blob 50312917) handleRefine now merges `background_color`/`padding` forward from the pre-refine config, so a per-block Refine no longer wipes author-set style for any block type. Frontend-only by design (style is owned by the shared BlockStyleSection; generators return clean type shapes on purpose).

## Session 147 opening priorities, in order

### INT-7 (closed in Session 146)

Done and verified. No carryover. Lives in the v149 build-queue changelog entry, the S146 open-queue banner, and architecture-reference v147.

### 1. INT-6 branching scenario (the Phase 4 build)

The one genuinely-active build left in Phase 4. It is a graph-shaped data model, NOT an extension of the linear `scenario` block. It is the heaviest remaining item in the arc and may span more than one session. Treat it INT-8-style: present design locks for Cole's decision before writing any code. Open design questions to settle first: node/edge storage shape (new table vs config JSON graph), whether progress is stateful (per-node visited set) or stateless on the existing `upsert_lesson_block_progress` path, completion definition (reach a terminal node vs visit all reachable nodes), and how the three generators emit a branching graph. Once locked, it is a new block type, so full §61 five-surface parity is MANDATORY (backend migration + draft-lesson-block + scaffold-lesson-outline + expand-lesson-from-outline + frontend form/renderer).

### 2. Forward vendor sequence (Cole-specified S146, build after INT-6)

After INT-6, work this sequence in order:

1. **Synthesia AI video for building videos** (Cole's term was "synesthesia integration for building videos"; this matches the v144/v138 locked decision "AI video = Synthesia". The Descript MCP is currently connected and may factor into the video pipeline, so confirm Synthesia vs Descript with Cole at the start of that session. Verify Synthesia API moderation + SCORM/Enterprise caveats before building, per the v144 note; Colossyan/HeyGen are the noted fallbacks).
2. **DALL-E image creation** (an AI image-generation path alongside the existing Pexels picker).
3. **ElevenLabs voiceover** (Track 3 in the original Learning-Experience scope).
4. **SCORM import/export** (standing carryforward; pairs with the export side noted in older handoffs).
5. **API** (public API setup; standing carryforward).

### 3. INT-8 activation poll (on the queue, build when prioritized)

Still queued with a fully locked design (S144). Block-level `poll` type. Full build = `lesson_poll_votes` table + RLS (insert/update/select own only) + a SECURITY DEFINER aggregate RPC pair (`cast_poll_vote`, `get_poll_results`) revealing the per-choice distribution after voting, scoped per-org; lightweight alternative = vote in `lesson_block_progress.completion_data` with no aggregate reveal. Config `{ question, options:[{client_id, text}], allow_revote, show_results, gating_required }`. The aggregate reveal is the activation payoff. Not sequenced before the vendor work unless Cole reprioritizes.

### 4. The combined lesson-block smoke test (still deferred)

INT-1 / INT-3 / INT-4 / INT-5 / VIS-4 / INT-7 plus the sequence and media_text auto-Pexels resolvers are all verified present but not yet exercised live in one pass. Cole is holding this until the lesson-block phases are done.

## Decisions locked in Session 146 (recap)

- INT-7 is a MODE on knowledge_check, not a new block type. No migration. §61 satisfied via existing-surface edits.
- Confidence scale is two-point ("I'm confident" / "Not sure"), captured before Check is enabled, feeding a 2x2 quadrant. Confident-and-wrong is the priority misconception and uses the amber warning token (#FFB703).
- Refine preserves author style at the FRONTEND layer (handleRefine merge), not via a generator change. The kc-form `...value` emit closes the same latent FlashcardsBlockForm drop class for knowledge_check.
- Default knowledge_check path stays byte-identical when the flag is off (the reveal ternary preserves the prior branch).

## Open questions / things to lock in Session 147

- INT-6 design locks (see priority 1) before any code.
- Synthesia vs Descript for the video pipeline (confirm at the start of the video session).
- DALL-E: which generation surface (per-block in the form, or build-time resolver like sequence/media_text), and image storage/asset-walker treatment.

## Bugs in Build Queue (carried, non-blocking)

- **BQ-SUPERVISOR-DASH:** per-supervisor disable toggle for company dashboards.
- **Doc-1 invoice live refund test:** deferred until a real Stripe-paid transaction exists.
- **FlashcardsBlockForm** still drops top-level `background_color`/`padding` in its emit (logged S143; not actioned; the knowledge_check instance is now fixed, flashcards remains).
- **Newsletter STATIC_ROUTES reminder:** the `newsletter-sitemap` edge fn has hardcoded `STATIC_ROUTES`; when Cole adds a new public marketing page it must be updated manually. Surface this whenever newsletter / sitemap / SEO / new-marketing-page work comes up.
- Newsletter rendered-HTML preview in the AI co-pilot chat (logged in build queue); G3+G8+G9 SEO/AEO/RSS combined pass still pending.

## What is NOT in scope for Session 147

- INT-2 instrument-result personalization (DEFERRED).
- Formal Group C closure documentation (after Phase 4 completes, i.e. after INT-6).
- Any Stripe webhook change (platform `stripe-webhook` and `ops-stripe-webhook` are never cross-touched).

## Architecture additions in Session 146

- `confidence_weighted` optional boolean on knowledge_check config (additive, default false).
- `BlockRenderer` KCPerQuestionState gained `confidence: "confident"|"unsure"|null`.
- No schema, RPC, edge-fn-count, RLS, or cron change. Generators bumped: draft-lesson-block v21, expand-lesson-from-outline v33 (scaffold unchanged at v31). See architecture-reference v147.

## Test fixture state at end of Session 146

Unchanged from Session 145. Test org BrainWise Test Corp, test users `testclientbwe+orgmember@gmail.com` / `+supervisor` / `+employee`, test content item `32e0e966-4cb8-4e8b-abf8-5617de346f59`, test lesson `e5c208f2-6885-482e-8d8b-8325f9cbaf5d`. Test password lives in userMemories only. To exercise INT-7 live: add a knowledge_check block to the test lesson, toggle "Confidence-weighted (single attempt)" on, and confirm the confidence-gated single attempt + quadrant feedback in trainee view, and that toggling it off restores the retry/reveal-on-correct behavior.

## Documents this session leaves behind

- `build-queue.md` (S146 open-queue banner added; v149 changelog entry added)
- `architecture-reference.md` (header bumped to v147; v147 entry added)
- `session-146-to-147.md` (this file)

Markdown only (Session-74 decision). GitHub MCP is read-only, so Cole uploads all three manually to `cbastianBWE/brainwise-internal-docs` (flat repo root).
