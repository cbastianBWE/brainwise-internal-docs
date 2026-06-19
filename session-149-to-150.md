# BrainWise Session 149 to 150 Handoff

*Closeout: Session 149. Open: Session 150.*

## Where Session 149 left off

Two HeyGen things shipped on top of the Session 148 reference framework. First, the in-block HeyGen generator: a `video_embed` block can now generate its own AI presenter video through an embed-only video content_item (so the generated video never becomes a required, navigable, completion-blocking module item). Second, AI-authoring script support: the three lesson-authoring generators now write a plain-text presenter script for video blocks, the block defaults to `source_type:"content_item"`, and the frontend threads that script into the HeyGen panel with a draft-a-script button and a regenerate path. All backend verified and all frontend SHA-verified on main. The one open item is the live end-to-end test, deferred by Cole to a later session.

## Session 150 opening priorities, in order

### 1. DALL-E image creation

Cole's stated next build. The likely shape mirrors the HeyGen reference pattern: a generate path that produces an asset, ingested through the existing lesson asset pipeline. Worth opening by reading the current image path (`lesson-ingest-pexels-asset` v2, the AiPane outline-stage image-resolution flow, and `request_asset_upload` / `finalize_asset_upload`) before proposing a design, since image assets already have a working ingest + signing seam that a DALL-E result can plug into rather than rebuild.

### 2. ElevenLabs voiceover

Second on Cole's list. Decide early whether voiceover is its own content type, a property of an existing block, or a standalone audio asset, and whether it rides the Mux chain (as HeyGen video does) or the storage/signing path (as images do). Present the design fork before any code.

### 3. Deferred end-to-end test of the Session 149 work (carry, Cole-side)

When Cole is ready, walk: AI-build a lesson with a video block and confirm the script is pre-filled in the HeyGen panel; edit a word and reopen to confirm persistence; try the draft-a-script button on a manually added video block; generate a video then hit Regenerate. Watch step four: regenerate reuses the same content_item (re-runs `lesson-heygen-generate` on an item that already has a video). If it misbehaves, the fix is backend in `lesson-heygen-generate`.

## Decisions locked in Session 149 (recap)

- The in-block generator uses an EMBED-ONLY video content_item: new `content_items.is_embed_only` flag (boolean, NOT NULL default false), created by `create_lesson_embed_video_content_item` (super-admin + impersonation gate; inserts the video into the lesson's module with `is_required=false`, `is_embed_only=true`, quiz fields NULL; logs the new audit action `lesson_embed_video_created`). The embed content_item is created lazily on the first Generate click, not at block insert.
- Every module-content consumer skips embed-only items (`get_module_detail`, `get_learning_report_detail`, `get_content_item_for_viewer` raises `content_item_embed_only` for non-admins, `get_user_learning_state`) while playback (`get_content_item_video_playback`) still resolves them, so the video plays inside the lesson without polluting navigation, completion, or reporting.
- `video_embed` config gained a plain-text `script` field (the spoken presenter narration). It is REQUIRED in the AI generators, has no markdown or stage directions, runs roughly 150 to 350 words, and is capped near 4000 chars in generation (the panel itself caps at SCRIPT_MAX 4900).
- The generators only ever produce the script TEXT; they never call HeyGen, so AI authoring spends zero HeyGen credits. The actual video is generated only on an explicit Generate click in the panel.
- `video_embed` now defaults to `source_type:"content_item"` (with `source_id` null) out of the generators. Rationale: because the generator always writes a script, the block's intent is always an AI presenter, and `content_item` is what routes `VideoEmbedBlockForm` into the HeyGen generate panel instead of the manual-upload view.
- §61 five-surface parity does NOT trigger: this is a config-field addition plus a `source_type` variant on the existing `video_embed` block, not a new block type. The generators were edited but no new type was introduced.
- Next-session order is DALL-E first, then ElevenLabs (Cole's call).

## Open questions / things to lock in Session 150

- DALL-E: which model/endpoint, where the generated image lands (reuse the private lesson asset bucket + signing, almost certainly), and whether generation is per-block author-triggered or part of the AI build flow.
- ElevenLabs: content-type shape and whether it rides Mux or storage/signing (see priority 2).
- None of the above is blocking; both are greenfield design decisions to settle at session open.

## Bugs surfaced in Session 149 added to Build Queue

- None new. The two video_embed bugs logged in Session 148 (BQ-VIDEOEMBED-STALE-SOURCEID, BQ-BLOCKRENDERER-DUP-IMPORT) were addressed inside the in-block rework.

## What's NOT in scope for Session 150

- The live end-to-end test of the Session 149 HeyGen work stays Cole-side and deferred (see priority 3).
- The combined lesson-block smoke test (INT-1 / INT-3 / INT-4 / INT-5 plus the sequence auto-Pexels resolver) stays deferred per Cole until the lesson-block phases are fully exercised.
- Carried, untouched: per-supervisor company-dashboard disable toggle (BQ-SUPERVISOR-DASH); live Stripe refund test (waits on a real Stripe-paid transaction); newsletter `STATIC_ROUTES` manual-update reminder whenever a new public marketing page is added; formal Group C closure documentation.

## Architecture additions in Session 149

- `content_items.is_embed_only` (boolean, NOT NULL default false). All 56 existing rows backfilled false.
- RPC `create_lesson_embed_video_content_item(p_lesson_content_item_id, p_title, p_reason)`: super-admin + impersonation gate; inserts a video into the lesson's module with `is_required=false`, `is_embed_only=true`, quiz fields NULL; returns the new `content_item_id`.
- New audit action type `lesson_embed_video_created` registered in `super_admin_action_types` (FK requirement per §99).
- `lesson-heygen-generate` advanced to v2 to support `target_kind:"lesson_block"`.
- Generators: `draft-lesson-block` v24, `scaffold-lesson-outline` v33, `expand-lesson-from-outline` v36. All dashboard-paste, `verify_jwt` false, esbuild-clean. draft and expand now emit the `script` field and `source_type:"content_item"` (source_id null) for video_embed; scaffold reworded its video intent-guide bullet (no per-lesson video cap, per Cole) since it emits no block config.
- Frontend, SHA-verified on main: NEW `src/components/super-admin/HeygenGeneratePanel.tsx` (SHA d9a907e2) with `initialScript`/`onScriptChange` props, seeded script state + re-seed effect, a draft-a-script-with-AI row calling `draft-lesson-block` for a video_embed script, and a Regenerate button on the ready state; `src/components/super-admin/lesson-blocks/block-forms/VideoEmbedBlockForm.tsx` (SHA d603c052) with `script?: string | null` on `Props.value` and the panel wired with `initialScript={value.script ?? ""}` plus an `onScriptChange` that persists `config.script`. The form already spreads `...value` first in every emit, so the script survives save (this is the safe pattern, not the FlashcardsBlockForm drop bug).
- These all live in `architecture-reference.md` v150.

## Test fixture state at end of Session 149

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Test lesson `e5c208f2-6885-482e-8d8b-8325f9cbaf5d` is the working fixture for the deferred video-block end-to-end test. No fixture changes or pending cleanup this session.

## Documents this session leaves behind

- build-queue.md (markdown source of truth, build-queue v151)
- architecture-reference.md (markdown source of truth, v150)
- session-149-to-150.md (this document)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs. No .docx generated (Session-74 decision).
