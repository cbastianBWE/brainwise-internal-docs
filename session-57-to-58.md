# BrainWise Session 57 to 58 Handoff

*Closeout: Session 57. Open: Session 58.*

## Where Session 57 left off

Prompt 5 (polymorphic ContentItemEditor across 8 item_types) shipped with first live AI integration via the draft-text Edge Function — verified end-to-end against all 12 smoke tests. Prompt 5.5 (editor refactor: ContentAuthoring.tsx 3928→802 lines plus 5 editor files under src/pages/super-admin/editors/) also shipped and verified — editor bodies byte-identical to pre-refactor. Auth/audit fixes from draft-text v3-v5 ported to draft-lesson-block v2 and scaffold-lesson v2, so all three AI Edge Functions are ready for Prompt 6.

## Session 58 opening priorities, in order

### 1. Decide native file upload sequencing

Native file upload (Prompt 5.6 or thereabouts) covers video files, images, PDFs, Word docx, Excel, PowerPoint, audio. Decision needed at Session 58 kickoff: do we build it before Prompt 6 (so the lesson_blocks editor can use it for image/audio/video blocks from the start) or after Prompt 6 with external URLs as the v1 pattern?

Backend design questions to answer:
- One Storage bucket or per-type buckets?
- RLS: super admin upload only; read varies by content visibility
- File size limits per type (video gets 500MB, PDF gets 50MB, etc.)
- MIME allowlist enforcement
- Storage path convention (`<content_item_id>/<file_id>.<ext>`?)
- Registry table vs Storage metadata for tracking uploads
- Archive cleanup semantics

Frontend work:
- `<FileUploadField>` component using `supabase.storage.from(...).upload()`
- Drag-and-drop, progress UI, replace flow with orphaned-file cleanup
- Wire into ContentItemEditor and (later) lesson_blocks editor

### 2. Prompt 6 — Lesson blocks editor

Builds in its own file at `src/pages/super-admin/editors/LessonBlocksEditor.tsx` from inception. 17 block types. Drag-and-drop. Per-block AI Draft (calls draft-lesson-block v2). Scaffold-lesson invocation. Estimated 1,500+ lines.

Note: only renders when `selectedNode?.type === "ci" && initial.item_type === "lesson_blocks"`.

### 3. Drag-and-drop reorder of content items (build queue)

Currently content items use a display_order number input. RPC `reorder_content_items` requires the full array, so the drag-and-drop UI would need to send the entire reordered list. Deferred from Prompt 5; could be Prompt 5.7 or rolled into Prompt 6 alongside the lesson_blocks reorder UI.

## Decisions locked in Session 57 (recap)

- Edge Function auth pattern: `npm:@supabase/supabase-js@2.57.2`, `getClaims(token)` explicit-arg, `log_super_admin_action` via caller's auth-bound client (not service client). Locked across all three AI Edge Functions.
- ContentAuthoring editor file structure: tree+state shell in ContentAuthoring.tsx, individual editors in src/pages/super-admin/editors/. Prompt 6 follows this pattern from day one.
- Native file upload covers: video/image/PDF/docx/xlsx/pptx/audio. Sequencing TBD at Prompt 6 kickoff.
- draft-text output cleaning: system prompt forbids inline markdown + post-process strip pass. Strips bold/italic/code/headings. Preserves paragraph structure and bullet hyphens.

## Open questions / things to lock in Session 58

- Native file upload before or after Prompt 6? (see priority 1 above)
- Bucket strategy for native file upload (one vs per-type)
- Whether to keep AI Draft for content_item_title or move it to a different field type (post-launch UX question, not blocking)

## Bugs surfaced in Session 57 added to Build Queue

None outstanding. Two bugs surfaced and both fixed in-session:
- draft-text auth/audit (v1→v5 deploys; same pattern also applied to draft-lesson-block v2, scaffold-lesson v2)
- upsert_content_item COALESCE bug (migration fix_upsert_content_item_video_defaults shipped)

## What's NOT in scope for Session 58

- Prompts 7-9 (mentor assignment, quiz authoring, learning assignments)
- Pricing-reads refactor
- Action-Oriented Voice Redesign across PTP/NAI dashboards
- AIRSA Phases 3c-8 (deferred until content authoring track lands)
- Clarity Engine

## Architecture additions in Session 57

Three architecture-reference.md sections added (v56):
- §35 Edge Function auth pattern (canonical for super-admin-only functions calling Anthropic + audit log)
- §36 Content Authoring editor file structure
- §37 content_items per-type CHECK constraint pattern (any RPC with per-type defaults must gate them inside the per-type CASE branch, not the shared INSERT)

Migration shipped: `fix_upsert_content_item_video_defaults`

Edge Function deployments:
- `draft-text` v1 → v5 (4 deploys: v3 supabase-js + getClaims fix, v4 audit-log fix, v5 markdown strip)
- `draft-lesson-block` v1 → v2 (full fix port)
- `scaffold-lesson` v1 → v2 (full fix port)

## Test fixture state at end of Session 57

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Content authoring fixtures (under super_admin Cole Bastian):
- 1 active certification path: PTP-Coach (`57db528d-9715-4e23-9b40-82fc17a5b371`)
- 1 active curriculum: PTP VILT 1 (`aa221e50-e504-4568-a882-63a4ac567619`), attached to PTP-Coach
- 1 active module: Test Module C (`ece0a34f-b1ac-460b-a9eb-4cc38ee20750`), attached to PTP VILT 1
- 2 active content items inside Test Module C:
  - Test Video Item (item_type=video, youtube_unlisted dQw4w9WgXcQ, threshold 95, id `920e6f24-1163-4a54-90ab-f0b1790d8849`) — title and description both AI-drafted via Tests 6 and 7
  - Test External Link (item_type=external_link, https://example.com/some-resource)
- 1 archived content item: Test Written Summary (Test 10)
- 1 successful row in super_admin_audit_log for action_type=ai_authoring_draft_generated from Test 7 (content_item_description, voice=reflective_inquiry, model=claude-opus-4-7, 277 chars)

Recommended Session 58 cleanup at start: archive Test Video Item + Test External Link if Prompt 6 testing wants a clean slate, or keep them as authoring fixtures.

## Documents this session leaves behind

Per the closeout workflow, markdown source-of-truth at cbastianBWE/brainwise-internal-docs is the canonical record. Three files updated this session:

- build-queue.md (v59 → v60)
- architecture-reference.md (v55 → v56)
- session-57-to-58.md (this document)

Cole uploads markdown to brainwise-internal-docs via GitHub web UI drag-and-drop at session close (GitHub MCP is read-only).
