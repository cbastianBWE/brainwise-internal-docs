# BrainWise Session 147 to 148 Handoff

*Closeout: Session 147. Open: Session 148.*

## Where Session 147 left off

INT-6, the `branching_scenario` lesson-block type, shipped end to end this session with full §61 five-surface parity, which makes Phase 4 of the Lesson Experience uplift COMPLETE (VIS-4 S145, INT-7 S146, INT-6 S147). It is a graph-shaped decision tree, deliberately distinct from the linear `scenario` block: each node shows a situation plus 2-4 choices that route to other nodes, and reaching any terminal node completes the block. Storage is a config JSON graph with no new table, progress is stateless on the existing `upsert_lesson_block_progress` path, and the AI generators emit an adjacency-embedded shape that a transform flattens and validates.

All five surfaces are done and verified:

- **Backend (2 migrations, each verified by a separate execute_sql):** `seed_branching_scenario_lesson_block_type` (lesson_block_types row, interactive, not scored, v1-active) and `add_branching_scenario_to_asset_ref_walker` (the `nodes[]` / `node_image_asset_id` branch on `_walk_block_config_for_asset_refs`, the one walker all three asset RPCs route through; signature unchanged so grants survived). Walker exercised live. No new table, no new edge fn.
- **Generators (all boot-probed OPTIONS 204 + no-auth POST 401, verify_jwt false):** `draft-lesson-block` v22 (function version 33, MCP deploy), `scaffold-lesson-outline` v32 (MCP deploy), `expand-lesson-from-outline` v34 (function version 34, dashboard-paste). draft and expand share byte-identical flatten logic. ai-authoring-chat exempt (v14).
- **Frontend (one Lovable prompt, SHA-verified at HEAD `6567950`):** `blockTypeMeta.ts` (Waypoints icon, union, IN_SCOPE, META defaultConfig seeding a start+terminal two-node graph), NEW `block-forms/BranchingScenarioBlockForm.tsx` (per-node-card editor, emit spreads `...value` first, node-delete prunes edges and reassigns start), `BlockEditorPane.tsx` dispatch, `BlockRenderer.tsx` (`BranchingScenarioRender`, all hooks before the empty-nodes early return per §137, completion fires `{path, reached_terminal:true}`), `lesson-blocks.css` (21 `bw-branching-*` rules).

Two durable findings landed this session. First, the deploy-mechanism correction: MCP `deploy_edge_function` does NOT truncate at ~25KB (the full 57KB draft and 34KB scaffold deployed intact via MCP); the real ceiling is Claude's own inline output, so only the 84KB expand needed the dashboard-paste fallback. The stale ~25KB MCP-truncation note is retired. Second, a logged incident: a 4-line probe stub was briefly deployed to the live draft-lesson-block (version 32), breaking per-block Refine for about 5 minutes, recovered by deploying real v22 (version 33). Never deploy a throwaway to a live function.

## Session 148 opening priorities, in order

### INT-6 (closed in Session 147)

Done and verified. No carryover except the optional live trainee click-through (walk the tree, completion unlocks Continue, resume restores `path`), which is structurally and logically verified and folds into Cole's deferred combined lesson-block smoke test. Lives in build-queue v150, architecture-reference v148, and this handoff.

### 1. Formal Group C closure documentation

Phase 4 is complete, so the Group C completion arc is now closeable. Produce the formal Group C closure write-up (the arc spanned the Lesson Experience uplift Phases 1-4 plus the earlier Group C items). Reference `group-c-completion-sequence.md` in the docs repo. INT-2 stays DEFERRED and INT-8 stays queued, so call those out explicitly as the two intentionally-open items at closure.

### 2. Forward vendor sequence (Cole-specified, build after closure)

Work this sequence in order. Cole confirmed the order this session as: Synthesia, ElevenLabs, DALL-E, SCORM, API. Note the build-queue/architecture deltas list it as Synthesia, DALL-E, ElevenLabs, SCORM, API; reconcile the DALL-E vs ElevenLabs ordering with Cole at the start of gate 2 before building.

1. **Synthesia AI video.** Matches the v144/v138 locked decision "AI video = Synthesia". The Descript MCP is currently connected and may factor into the video pipeline, so confirm Synthesia vs Descript with Cole first. Verify Synthesia API moderation plus SCORM/Enterprise caveats before building (Colossyan/HeyGen are the noted fallbacks).
2. **ElevenLabs voiceover** (Track 3 in the original Learning-Experience scope).
3. **DALL-E image creation** (an AI image-generation path alongside the existing Pexels picker). Decide the generation surface (per-block in the form, or build-time resolver like sequence/media_text) and the image storage / asset-walker treatment.
4. **SCORM import/export** (standing carryforward; pairs with the export seam noted in older handoffs and the lesson-asset RPC-gated signing checkpoint).
5. **Public API** (standing carryforward).

### 3. INT-8 activation poll (on the queue, build when prioritized)

Still queued with a fully locked design (S144). Block-level `poll` type. Full build = a `lesson_poll_votes` table + RLS (insert/update/select own only) + a SECURITY DEFINER aggregate RPC pair (`cast_poll_vote`, `get_poll_results`) revealing the per-choice distribution after voting, scoped per-org; lightweight alternative = vote in `lesson_block_progress.completion_data` with no aggregate reveal. Config `{ question, options:[{client_id, text}], allow_revote, show_results, gating_required }`. The aggregate reveal is the activation payoff. Not sequenced before the vendor work unless Cole reprioritizes.

### 4. The combined lesson-block smoke test (still deferred)

INT-1 / INT-3 / INT-4 / INT-5 / INT-6 / VIS-4 / INT-7 plus the sequence and media_text auto-Pexels resolvers are all verified present but not yet exercised live in one pass. Cole is holding this until the lesson-block phases are done, which they now are, so this can be scheduled when convenient.

## Decisions locked in Session 147 (recap)

- branching_scenario is a graph-shaped data model, NOT an extension of the linear `scenario` block. Icon Waypoints.
- STORAGE is a config JSON graph (no new table); graph integrity is enforced in the renderer + generator transform, not the DB.
- PROGRESS is stateless on `upsert_lesson_block_progress`, completion_data `{path, reached_terminal}` (no new table).
- COMPLETION is reaching ANY terminal node (not visit-all); a zero-outgoing-edge node is terminal regardless of flag; an empty-nodes block auto-completes.
- GENERATOR EMIT is an adjacency-embedded AI shape flattened/validated by a transform shared byte-identically by draft and expand (key to uuid map, start resolve with nodes[0] fallback, dangling-edge prune, is_terminal derive, force at least one terminal). AI cap 3-10 nodes, 2-4 choices per node.
- DEPLOY MECHANISM: MCP deploy works to about 57KB; dashboard-paste is only needed around 84KB because the limit is Claude's inline output, not the tool. The ~25KB MCP-truncation note is retired.

## Open questions / things to lock in Session 148

- Group C closure write-up scope and where it lives (likely a new closure section in `group-c-completion-sequence.md` plus a build-queue note).
- Vendor-sequence ordering: confirm Synthesia, ElevenLabs, DALL-E, SCORM, API (Cole's stated order this session) vs the docs-delta order (Synthesia, DALL-E, ElevenLabs, SCORM, API).
- Synthesia vs Descript for the video pipeline (confirm at the start of gate 2).
- DALL-E generation surface (per-block form vs build-time resolver) and asset-walker treatment.

## Bugs in Build Queue (carried, non-blocking)

- **BranchingScenarioBlockForm refField:** Lovable set the node-image `refField` to a static `"image_asset"` instead of the per-node path. Harmless (refField only feeds the upload audit-reason text and the asset row's `ref_field` column, never a functional key). Fold the one-line fix into the next Lovable prompt that touches this form; do not spend a dedicated run.
- **FlashcardsBlockForm** still drops top-level `background_color`/`padding` in its emit (logged S143; not actioned). branching_scenario, reveal_cards, sequence, and media_text all avoid this by spreading `...value` first.
- **BQ-SUPERVISOR-DASH:** per-supervisor disable toggle for company dashboards.
- **Doc-1 invoice live refund test:** deferred until a real Stripe-paid transaction exists.
- **Newsletter STATIC_ROUTES reminder:** the `newsletter-sitemap` edge fn has hardcoded `STATIC_ROUTES`; when Cole adds a new public marketing page it must be updated manually. Surface this whenever newsletter / sitemap / SEO / new-marketing-page work comes up.
- Newsletter rendered-HTML preview in the AI co-pilot chat (logged in build queue); G3+G8+G9 SEO/AEO/RSS combined pass still pending.

## What is NOT in scope for Session 148

- INT-2 instrument-result personalization (DEFERRED).
- Any Stripe webhook change (platform `stripe-webhook` id fb9725d2 and `ops-stripe-webhook` id be435d9f are never cross-touched).
- Rewriting either large canonical doc in full (prepend deltas only; splice via Python/curl at pinned SHA).

## Architecture additions in Session 147

- New lesson-block type `branching_scenario` (lesson_block_types row).
- `_walk_block_config_for_asset_refs` gained a `branching_scenario` -> `nodes[]` / `node_image_asset_id` branch (signature unchanged, grants survived).
- New frontend file `block-forms/BranchingScenarioBlockForm.tsx`; `BranchingScenarioRender` added to `BlockRenderer.tsx`; 21 `bw-branching-*` CSS rules.
- Generators bumped: draft-lesson-block v22 (function version 33), scaffold-lesson-outline v32, expand-lesson-from-outline v34 (function version 34); ai-authoring-chat unchanged at v14.
- No new table, no new edge fn, no cron, no RLS change. See architecture-reference v148.

## Test fixture state at end of Session 147

Unchanged from Session 146. Test org BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`), test users `testclientbwe+orgmember@gmail.com` / `+supervisor` / `+employee`, test content item `32e0e966-4cb8-4e8b-abf8-5617de346f59`, test lesson `e5c208f2-6885-482e-8d8b-8325f9cbaf5d`. Test password lives in userMemories only. To exercise INT-6 live: add a branching_scenario block to the test lesson (the default config is immediately walkable), build out a few nodes and choices in the form, then in trainee view confirm the walk advances on choice clicks, a terminal node completes the block and unlocks Continue, and reloading restores the prior path.

## Documents this session leaves behind

- `build-queue.md` (SESSION 147 DELTA added; build-queue v150)
- `architecture-reference.md` (header bumped to v148; v148 entry added)
- `session-147-to-148.md` (this file)

Markdown only (Session-74 decision). GitHub MCP is read-only for this repo, so Cole uploads all three manually to `cbastianBWE/brainwise-internal-docs` (flat repo root).
