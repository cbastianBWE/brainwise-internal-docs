# Session 59 → 60 Handoff

## What landed this session

**Prompt 7 (parent entity thumbnails) — shipped and verified end-to-end.**

Backend: 8 named migrations applied for thumbnail infrastructure on `certification_paths`, `curricula`, `modules`, `content_items`. `request_asset_upload` RPC extended with 3 new parent modes; Edge Function v2 deployed.

Frontend: 3 Lovable prompts shipped (`prompt-7-thumbnails.md`, `prompt-7.1-tree-height.md` folded into 7.2, `prompt-7.2-isdirty-fix.md`). FileUploadField extended, 4 editors each got a thumbnail section, ContentAuthoring tree height fixed (sticky positioning replaced with direct height — sticky doesn't work inside AppLayout's overflow-auto context).

Verified: 5 entities tested (PTP-Coach, PTP VILT 1, Test Module C, Test Video Item, Test External Link). All have `thumbnail_asset_id` set, exactly 1 active thumbnail ref each, no duplicates. Library reuse working — one library asset referenced as thumbnail across 3 entities, no problem.

**Prompt 6 scoping — fully complete and locked.**

All design decisions for 6a, 6a-AI, 6b, 6c are captured in `prompt-6-scope-summary.md` (persisted in this repo). Cole loading this file to GitHub so Session 60 starts with full context.

## Standing rules surfaced this session

1. **CREATE OR REPLACE doesn't replace when arg list changes** — PostgreSQL treats the new signature as a separate overload, causing 42725 "function is not unique" errors on existing named-param callers. Standing rule: when amending an RPC with new params, follow `CREATE OR REPLACE FUNCTION ...` with explicit `DROP FUNCTION public.<name>(<old arg types>);` in the same migration.

2. **Sticky positioning inside AppLayout main is broken** — the `<main>` element has `overflow-auto`, which creates a new scroll context. CSS sticky anchors to the nearest scrolling ancestor (main), not the viewport. For any sticky-style layout in this codebase, use direct height calculations instead: `h-[calc(100vh-7rem)] self-start` accounts for AppLayout header (~3.5rem) + main's p-6 top padding (1.5rem) + small buffer. The `self-start` is required when the element is inside a CSS grid.

3. **Dual-write-path refs require idempotent server-side creation** — when frontend has two paths that might both create the same logical ref (upload-path creates ref at upload time; save-path tries to create ref at save time), the server-side ref creator MUST be idempotent via existence-check upsert pattern, not unconditional INSERT. Implemented for thumbnail refs via `_upsert_thumbnail_ref` helper. Pattern generalizes.

4. **Thumbnails always upload parent-scoped, never library** — preserves cascade-archive-on-parent-archive and prevents library page bloat. Tradeoff accepted: thumbnails can't be reused across entities without re-upload. Library reuse via library picker still works for cases where authors do want reuse — the library picker creates a ref pointing at the existing library asset.

## Where Session 60 picks up

**Primary agenda: Prompt 6a — LessonBlocksEditor manual editor + foundations.**

Reference document: `prompt-6-scope-summary.md` in this repo (loaded by Cole to GitHub at session close).

### Recon before any migration

Pull from Supabase:
- `replace_lesson_blocks` RPC full body — verify Session 58 cascade-archive behavior fires correctly for the save-without-block case
- `lesson_blocks` table schema and indexes
- `lesson_block_types` table contents (17 rows, all `is_v1_active = true` per Session 56)
- Three AI Edge Function bodies: `scaffold-lesson` v1, `draft-lesson-block` v1, `draft-text` v1 — verify BLOCK_SCHEMAS dispatch tables cover all 17 block types
- Current `reap_pending_uploads_hourly` cron logic — needs extension for active-orphan sweep

Pull from GitHub (`cbastianBWE/brainwise-blueprint`):
- Current `ContentItemEditor.tsx` lesson_blocks branch (around line 762) — confirm the "lands in future prompt" italic placeholder is what gets replaced with the "Edit lesson blocks →" button + completion mode selector
- `App.tsx` route table — confirm where to add the new route

### Backend migrations to apply (before any Lovable prompt)

Per `prompt-6-scope-summary.md` 6a section:

1. **lesson_block_drafts table** — content_item_id uuid PK, author_id uuid (FK to users.id), draft_json jsonb, updated_at timestamptz. RLS: super admins read/write only their own draft rows.

2. **save_lesson_block_draft RPC** — upsert by (content_item_id, author_id). No reason field, no audit log. Returns the saved row.

3. **discard_lesson_block_draft RPC** — deletes the draft row for caller. Returns void.

4. **Extend replace_lesson_blocks (or add wrapper)** — on successful commit, delete the matching draft row by (content_item_id, caller=auth.uid()). This is the auto-reconciliation step.

5. **Extend reap_pending_uploads_hourly** — add second sweep clause: find `content_assets` where `is_library_asset = false` AND `status = 'active'` AND all active refs point exclusively to `lesson_block_id` values not in `lesson_blocks` (or to archived blocks). Threshold: 24 hours from asset creation. Archive via existing `_archive_asset_internal`.

6. **Verify Session 58 cascade behavior** — confirm `_cascade_archive_asset_refs_for_lesson_blocks` fires correctly when a block with an asset ref is removed from the editor and Save runs. May need a small extension if not.

### Frontend Lovable prompt for 6a

Per scope summary:
- LessonBlocksEditor.tsx at `/super-admin/content-authoring/lessons/:contentItemId`
- BlockListPane.tsx — left pane with type-aware previews + drag-and-drop reorder via @dnd-kit + inline + buttons
- BlockEditorPane.tsx — right pane routing to block forms
- RichTextEditor.tsx — TipTap wrapper
- 9 block forms: text, heading, divider, image, video_embed, quote, list, callout, embed_audio
- ContentItemEditor.tsx — replace placeholder with "Edit lesson blocks →" button
- App.tsx — add the new route
- TipTap as new npm dep (~100-130KB gzipped)
- Auto-save hook (debounced 3s) calling `save_lesson_block_draft`
- Draft-resume banner on editor load if draft row exists for current author
- Save flow calls `replace_lesson_blocks` with full block array + reason
- Navigation guards via React Router useBlocker + `window.beforeunload`

### Test fixtures for Session 60

Active content from Session 58 close + Session 59:
- 1 active cert path (PTP-Coach) with thumbnail
- 1 active curriculum (PTP VILT 1) with thumbnail
- 1 active module (Test Module C) with thumbnail
- 2 active content items: Test Video Item (item_type=video) with thumbnail, Test External Link (item_type=external_link) with thumbnail
- 2 active library assets in use as thumbnails

Test fixture: need to create a `lesson_blocks` item_type content_item for Prompt 6a testing. Create in Session 60 as part of the test setup.

Test password lives in `userMemories`. Test user emails per standing protocol (testclientbwe+orgmember/+supervisor/+employee@gmail.com).

## Outstanding from earlier sessions (not addressed)

- Six security warnings from Lovable scan deferred from Session 36 (items 105-109 + one more)
- Post-launch Build Queue items still queued (Action-Oriented Voice Redesign across six surfaces, pricing-reads refactor, corporate contract renewal schema change)
- Clarity Engine not yet built
- SOC 2 written policies deferred until feature-complete

## Build queue items added or modified Session 59

Added:
- Prompt 6a: LessonBlocksEditor manual editor + foundations (Session 60)
- Prompt 6a-AI: Staged AI authoring flow (after 6a)
- Prompt 6b: 7 remaining v1 block types (after 6a, may sequence before or after 6a-AI)
- Prompt 6c: knowledge_check block (after 6b)
- Backend: lesson_block_drafts infrastructure
- Backend: reap_pending_uploads_hourly extension for active-orphan sweep

Removed/closed:
- Prompt 7 thumbnails — DONE
- Prompt 7 tree height fix — DONE
- Prompt 7 isDirty bug — DONE
