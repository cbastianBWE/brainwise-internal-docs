# BrainWise Session 58 to 59 Handoff

*Closeout: Session 58. Open: Session 59.*

## Where Session 58 left off

**Prompt 5.6 fully shipped end-to-end + Prompt 5.7 fully shipped.** Three frontend patches needed to get the upload path working (5.6.1, 5.6.2, 5.6.3) — all landed and live in production.

Backend: six migrations applied + one supplementary RLS migration (`prompt_5_6_1_super_admin_storage_rls_for_tus`). Three Edge Functions deployed: `request-asset-upload` v1, `finalize-asset-upload` v2, `run-asset-archive-sweep` v1. Three pg_cron jobs scheduled.

Frontend: FileUploadField primitive (inline previews for image/video/audio/PDF, "Open in new tab" for Office docs), ContentItemEditor integrates the FileUploadField under the `supabase_storage` video source type, AssetLibraryPicker + PromoteToLibraryButton for library workflow, AssetLibrary page at `/super-admin/asset-library`.

End-to-end smoke tested: 151 MB MP4 ("Dec 16 Promo.mp4") uploaded via TUS, registry active, storage bytes present at expected path, audit row landed, `content_items.video_source_id` updated, `content_asset_refs` active ref linked to the Test Video Item.

Project-level Storage upload limit raised to 5 GB in Supabase Dashboard (was below 158 MB by default). Without this, even TUS uploads hit a 413.

## Session 59 priorities, in order

**Session 59 will tackle both Prompt 7 (thumbnails on parent entities) AND Prompt 6 (LessonBlocksEditor) in the same session.** Locked at Session 58 close. Ambitious but feasible if Prompt 7 lands cleanly first — its schema work establishes patterns LessonBlocksEditor can lean on. If context runs out mid-session, Prompt 6 splits across Session 59 + 60.

Recommended sequence within the session:

### 1. Prompt 7 first — Thumbnails on parent entities

Smaller surface, fewer cross-cutting concerns, lands cleanly.

**Scope (Approach A locked):**
- Author always uploads thumbnail (optional)
- Fallback for entities without thumbnail: BrainWise orange swirl placeholder image
- Five entity types get `thumbnail_asset_id` column: `modules`, `content_items`, `curricula`, `cert_paths` (Cole said five, but four entity tables — confirm whether `lesson_blocks` is a fifth or if `content_items` covers what was meant)
- Each entity editor gets a `<FileUploadField assetKind="image">` for "Thumbnail"
- Learning-side renderer reads `thumbnail_asset_id` → signs URL → renders; falls back to orange-swirl placeholder

**Backend:**
- 4 migrations (one per entity table) adding `thumbnail_asset_id uuid REFERENCES content_assets(id)`
- Amend the upsert RPC for each entity to accept the new field
- The `replace_lesson_blocks` style `content_asset_refs` row creation needs an analog for parent entities (decide: do thumbnails go through `content_asset_refs` with a new `ref_field` value, or are they referenced directly via the new column? Probably direct via column for simpler model)

**Frontend:**
- 4 editor updates (CertPathEditor, CurriculumEditor, ModuleEditor, ContentItemEditor) — add a thumbnail FileUploadField at the top of each
- Learning-side renderer changes wherever entities are displayed as tiles
- Source the BrainWise orange swirl placeholder image (Cole has it, or we generate one)

**Tests:**
- Upload a thumbnail to each entity type
- Verify learning-side shows thumbnail
- Remove thumbnail, verify learning-side falls back to placeholder

### 2. Prompt 6 — LessonBlocksEditor

The bigger lift. New editor surface for `lesson_blocks` table at `src/pages/super-admin/editors/LessonBlocksEditor.tsx` (file structure already locked Session 57 §36).

Backend already prepared:
- `replace_lesson_blocks` RPC amended Session 58 to create `content_asset_refs` from `config.asset_id` fields with `ref_field = '<block_type>_asset'`
- Cascade archive on outgoing blocks already wired
- LessonBlocksEditor convention: image / video_embed / embed_audio blocks carry `config.asset_id` (UUID string)

Frontend work:
- Block type sub-components (image, video_embed, embed_audio, text, heading, divider, etc.)
- FileUploadField scopes via `lessonBlockId` for asset-bearing block types
- Drag-and-drop block reorder (Prompt 5 build-queue item; may fold in here)
- Per-block-type config validation

This is a real session-worth of work on its own. If Session 59 runs out of context before Prompt 6 finishes, split Prompt 6 across two sessions.

## Decisions locked in Session 58 (recap)

### Architectural

- **Single bucket strategy** with audience-tier separation. `lesson-assets` for super-admin authored content learners consume; `asset-archives` for ZIP backups; future `ai-authoring-references` for Phase 4.5d.
- **Pattern C reads** (lesson-fetch endpoint bulk-signs asset URLs at 60-min expiry). Built into Phase 5 trainee learning UI.
- **22-day total recovery window**: 15 days soft-archive + daily ZIP+email backup + 7-day grace before hard-delete.
- **Auto-archive-on-zero-refs for non-library assets** (Option B from Session 58). Library assets never auto-archive.
- **Versioning supported now, rollback UI deferred.** Schema supports rollback; UI is future work.
- **One asset, many references.** Library assets link to many content_items / lesson_blocks; updates propagate at render time.
- **Browser-direct upload via TUS.** Bytes never proxy through Edge Functions.

### Implementation patterns

- **Two-step upload protocol**: `request-asset-upload` Edge Function → byte upload → `finalize-asset-upload` Edge Function. Pending rows reaped hourly after 24h if never finalized.
- **`{success: false}` return-value failure pattern for RPCs with side-effect updates.** RAISE EXCEPTION rolls back side-effects. Standing pattern for future RPCs.
- **TUS auth via user JWT Bearer header, NOT x-signature.** The signed-upload-token returned by `createSignedUploadUrl` is JWT-format and incompatible with the TUS server's `verifyObjectSignature` code path. RLS gates super-admin writes to `storage.objects` for the `lesson-assets` bucket.
- **Direct storage hostname for TUS**: `https://<project>.storage.supabase.co/storage/v1/upload/resumable`. The plain `<project>.supabase.co` hostname works but the direct one is recommended for large files.
- **`replace_lesson_blocks` convention for asset references**: blocks with `config.asset_id` (uuid string) get `content_asset_refs` rows with `ref_field = '<block_type>_asset'`.
- **`content_items.video_source_id` stores the asset_id UUID** when `video_source_type='supabase_storage'`.
- **Inline preview signed URL expiry: 3600s (1 hour).** Covers typical authoring sessions.

### Branding pass locked

- File-type pictograms split by extension: `FileText` for PDF/DOCX, `FileSpreadsheet` for XLSX, `Presentation` for PPTX, `Image`/`Video`/`Music` for the other kinds.
- Replace dialog uses default button variant (orange CTA), not destructive.
- Library asset badge: `bg-[#006D77]/10 text-[#006D77]`.
- Drag hover state: `border-[#006D77]` + `bg-[#006D77]/5`.
- Sand background `#F9F7F1` for audio/document preview cards.
- Progress bar fill: teal `#006D77`.

## Bugs surfaced + fixed in Session 58

1. **413 Payload Too Large on 151 MB MP4 standard PUT upload.** Fix: switched FileUploadField byte upload from `XMLHttpRequest PUT` to TUS resumable via `tus-js-client` (Prompt 5.6.1).
2. **403 Invalid Compact JWS on TUS upload with `x-signature` header.** Fix: switched TUS auth from signed-upload-token to user session JWT Bearer header; added four super-admin RLS policies on `storage.objects` for `lesson-assets` (Prompt 5.6.2 + supplementary migration).
3. **413 Maximum size exceeded on 151 MB MP4 TUS upload (separate from #1).** Fix: raised the project-level `UPLOAD_FILE_SIZE_LIMIT` to 5 GB in the Supabase Dashboard (independent of bucket file_size_limit setting). Manual one-time action in dashboard.
4. **finalize_asset_upload v1 used RAISE EXCEPTION on orphan path**, which rolled back side-effect archive updates. Fix: switched to `{success: false}` return-value pattern. v2 deployed.
5. **Deploy bundler quirk**: Edge Function `files` array entries must include the function name as leading directory (e.g. `request-asset-upload/index.ts`, `_shared/impersonation_gate.ts`). Standing rule.

## Open questions for Session 59

- **Prompt 7 entity count**: Cole said "modules + content_items + curricula + cert_paths" plus mentioned "five different entity types" earlier — confirm whether `lesson_blocks` is the fifth, or just the four entity tables. (LessonBlocks have their own visual via block content; might not need a separate thumbnail field.)
- **Thumbnail referencing mechanism**: direct column `thumbnail_asset_id` (simpler) vs. `content_asset_refs` row (consistent with the existing pattern). Recommendation: direct column for parent entities (saves a join, no need for refs-style cascade on parent archives).
- **Orange swirl placeholder source**: Cole has it, or generate. Where does it live — `lesson-assets` bucket as a library asset, or `/public/` in the frontend repo as a static asset? Recommendation: `/public/` static asset, since it's a UI fallback not a content asset (no audit trail needed, no signed URL needed).

## Items NOT in scope for Session 59

- Phase 5 trainee learning UI (Sessions 60+, depends on Prompt 6 + Prompt 7 + lesson-fetch endpoint)
- Phase 4.5a-c AI media generation (post-Prompt 6)
- AIRSA Phases 3c-8 (deferred)
- Lesson-fetch endpoint with bulk URL signing (Phase 5)
- Video auto-thumbnail extraction (Phase 4.5c when video pipeline matures)

## Architecture additions Session 58

- §38 added to architecture-reference.md (Prompt 5.6 native asset upload infrastructure). Full schema, RPC catalog, Edge Function catalog, cron schedule, helper functions, semantic decisions, frontend preview integration.
- §39 added to architecture-reference.md (storage.objects RLS for super-admin TUS uploads + project-level upload limit notes).

§35, §36, §37 — the v56 marker text in architecture-reference describes these but the section headers were not added to the file body in Session 57. Cole to decide whether to backfill from the v56 marker text or leave as-is. Not blocking.

## Migrations shipped Session 58

- `prompt_5_6_a_buckets_and_schema`
- `prompt_5_6_b_action_types`
- `prompt_5_6_c_core_rpcs`
- `prompt_5_6_c2_finalize_asset_upload_return_based_failure`
- `prompt_5_6_d_library_and_replace_rpcs`
- `prompt_5_6_e_amend_existing_rpcs`
- `prompt_5_6_f_sweep_infrastructure`
- `prompt_5_6_f2_cron_sql_jobs`
- `prompt_5_6_f3_cron_archive_sweep`
- `prompt_5_6_1_super_admin_storage_rls_for_tus`

## Edge Function deployments

- `request-asset-upload` v1 (`verify_jwt: false`)
- `finalize-asset-upload` v1 → v2 (`verify_jwt: false`; v2 fix to return-based failure path)
- `run-asset-archive-sweep` v1 (`verify_jwt: false`, gated by X-Dispatcher-Secret)

## Test fixture state at end of Session 58

Test org: BrainWise Test Corp (`<test-org-uuid>`). Three test users (`testclientbwe+orgmember@gmail.com`, `+supervisor@gmail.com`, `+employee@gmail.com`). Test password in Claude's userMemories.

Content authoring fixtures (unchanged from Session 57):
- 1 active cert path: PTP-Coach
- 1 active curriculum: PTP VILT 1
- 1 active module: Test Module C
- 2 active content items: Test Video Item, Test External Link
- 1 archived content item: Test Written Summary

Session 58 asset fixtures (in `content_assets`):

- **Active**: `<library-test-asset-uuid>` — library asset, 5 KB png, library_name "Session 58 E2E Test Asset", tags `['test','session58']`. INSERT-stub bytes (will render broken; harmless for backend testing).
- **Active**: `<dec-16-promo-uuid>` — the 151 MB MP4 "Dec 16 Promo.mp4" uploaded via TUS, scoped to Test Video Item, ref_field `content_item_video_source`. Real playable video.
- **Archived (orphaned_pending_expired)**: 5 assets from the failed-upload-attempts journey (XHR PUT fail, TUS x-signature fail × 3, TUS without raised project limit fail). All cleaned via manual archive; will hard-delete after 7-day grace.
- **Archived (replaced_by_author auto-cascade)**: 1 asset that tested the auto-archive-on-zero-refs cascade path.

Refs state: one active ref (Dec 16 Promo MP4 linked to Test Video Item via `content_item_video_source`). All orphans archived.

Recommended Session 59 cleanup at start: leave fixtures alone. The hard-delete cron at 05:00 UTC will clean up orphans after 7-day grace.

## Documents this session leaves behind

- `build-queue.md` (v60 → v62; v61 was an interim never pushed)
- `architecture-reference.md` (v56 → v58; v57 was an interim never pushed)
- `session-58-to-59.md` (this document)

All pushed to cbastianBWE/brainwise-internal-docs via GitHub MCP at session close.

Also at `/mnt/user-data/outputs/lovable-prompts/` for reference (not part of canonical repo):

- `prompt-5.6.md` — sent + landed Session 58
- `prompt-5.7.md` — sent + landed Session 58
- `prompt-5.6.1.md` — sent + landed Session 58 (XHR → TUS)
- `prompt-5.6.2.md` — sent + landed Session 58 (x-signature → Bearer JWT)
- `prompt-5.6.3.md` — sent + landed Session 58 (inline previews)
