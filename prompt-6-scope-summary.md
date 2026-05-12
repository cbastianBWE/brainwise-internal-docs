# Prompt 6 — Sub-prompt scope summary

Reference document for the LessonBlocksEditor build sequence. Keep on hand across sessions.

Mount point locked: dedicated route at `/super-admin/content-authoring/lessons/<content_item_id>`. ContentItemEditor's `lesson_blocks` branch shows an "Edit lesson blocks →" button that navigates to this route. Separate Save buttons, separate RPCs (`upsert_content_item` for the parent metadata, `replace_lesson_blocks` for the block array).

Layout locked: two-pane. Left pane is a vertical compact-card list of all blocks in order with drag-and-drop reorder + inline "+ Add block" buttons between every pair of cards. Right pane is the config form for whichever block is currently selected. Header has lesson title, Save button, Back link.

Backend (already shipped, Session 56-58):
- `lesson_block_types` lookup table seeded with all 17 v1 block types
- `lesson_blocks` table with id, content_item_id (cascade), block_type (FK), display_order, config jsonb, archived_at
- `replace_lesson_blocks` RPC (atomic-replace pattern: archives all current blocks, inserts new array in order)
- Three Edge Functions deployed v1 ACTIVE: `scaffold-lesson`, `draft-lesson-block`, `draft-text`
- Session 58 amended `replace_lesson_blocks` to create `content_asset_refs` rows from `config.asset_id` fields and amended `archive_content_item` to cascade-archive associated assets

Backend pending for Prompt 6a-AI: new or extended Edge Functions for staged outline → full-content flow (see 6a-AI section below).

---

## Prompt 6a — Manual editor + foundations

No AI integration. Authors can manually build full lessons.

### Files created
- `src/pages/super-admin/LessonBlocksEditor.tsx` — the page component at the new route
- `src/components/super-admin/lesson-blocks/BlockListPane.tsx` — left pane: compact cards, drag-and-drop, inline + buttons
- `src/components/super-admin/lesson-blocks/BlockEditorPane.tsx` — right pane: routes to the per-block-type config form
- `src/components/super-admin/lesson-blocks/RichTextEditor.tsx` — TipTap wrapper component
- `src/components/super-admin/lesson-blocks/block-forms/` — one file per supported block type (9 in 6a):
  - `TextBlockForm.tsx`
  - `HeadingBlockForm.tsx`
  - `DividerBlockForm.tsx`
  - `ImageBlockForm.tsx`
  - `VideoEmbedBlockForm.tsx`
  - `QuoteBlockForm.tsx`
  - `ListBlockForm.tsx`
  - `CalloutBlockForm.tsx`
  - `EmbedAudioBlockForm.tsx`

### Files modified
- `src/pages/super-admin/editors/ContentItemEditor.tsx` — lesson_blocks branch replaces the "lands in future prompt" italic placeholder with an "Edit lesson blocks →" button that navigates to the new route. Completion mode selector stays.
- `src/App.tsx` — add the new route under super-admin role guard

### Features built
- LessonBlocksEditor page shell at `/super-admin/content-authoring/lessons/:contentItemId`
- Header: lesson title (read-only, fetched from content_items), Save button, Back to ContentAuthoring link
- Left pane (BlockListPane):
  - Vertical list of compact block cards. Each card: block_type icon + first ~50 chars of content + drag handle
  - Selected card has highlighted border
  - Click selects (no double-click behavior)
  - Inline "+ Add block" button between every pair of cards (including before-first and after-last). Click opens a small popover with 9 block-type options
  - Drag-and-drop reorder using `@dnd-kit/core` + `@dnd-kit/sortable`
  - Trash icon on each card to delete (with confirm dialog)
- Right pane (BlockEditorPane):
  - Renders the config form for whichever block is selected
  - One form per block type, routed by `block_type`
  - All forms share the pattern: config field inputs + `onChange` propagates to parent state
- TipTap rich text editor (RichTextEditor.tsx):
  - Used in text, quote, callout, and any block with a rich-text body field
  - Toolbar with: bold, italic, underline, strike, bullet list, numbered list, heading (h2/h3), color picker, link
  - StarterKit + Color + TextStyle + Link extensions
  - Stores content as TipTap JSON in the block's config (e.g. `config.body`)
  - Custom CSS for branded list bullet styling (orange swirl marker or similar)
- Save flow:
  - Save button enabled only when local block array differs from initial load (isDirty)
  - Reason field (10+ chars required, same SOC 2 pattern as other editors)
  - Click Save → call `replace_lesson_blocks` RPC with full block array + reason
  - On success → refetch from DB → reset isDirty
- Block asset uploads (image, video_embed, embed_audio block types):
  - Each block gets a client-side generated UUID (`crypto.randomUUID()`) on creation. This becomes the lesson_block_id used during upload BEFORE the block is saved server-side
  - FileUploadField wired with `lessonBlockId={clientGeneratedId}` and `refField` matching the block_type's asset field (e.g. `image_asset`, `video_embed_asset`, `embed_audio_asset`)
  - Upload creates the asset + the ref scoped to that lesson_block_id
  - On Save, `replace_lesson_blocks` honors the client-generated IDs as the new row IDs, so refs stay linked

### What's NOT in 6a
- Knowledge check block (deferred to 6c)
- All 7 remaining v1 block types (stat_callout, statement_a_b, tabs, flashcards, accordion, button_stack, scenario — deferred to 6b)
- AI authoring (deferred to 6a-AI)
- Trainee-side renderer (Phase 5 work, separate prompt)
- AI draft helpers for parent content_item description / title (Prompt 6.5 or later)

---

## Prompt 6a-AI — Staged AI authoring flow

Builds on top of 6a. AI pane integrates with the existing editor.

### Backend work (Supabase MCP, before any Lovable prompt)
- New Edge Function `scaffold-lesson-outline` v1: takes a prompt + voice preset → returns structured outline array `[{block_type, summary_one_line, learning_objective_fragment}]`. Smaller token budget than full scaffold (~2000 max output). Uses same auth/gate/context/audit pattern as the three existing AI Edge Functions
- Extension to `scaffold-lesson` Edge Function (or new function `expand-lesson-from-outline`): accepts a structured outline array → returns full block content for each outline item. Token budget similar to existing scaffold-lesson
- Both Edge Functions use the existing `ai_authoring_context` rows and `ai_authoring_voice_presets` rows
- New action_type `ai_authoring_outline_generated` (if separating from the existing `ai_authoring_draft_generated`) — or reuse existing for simplicity. Lock during the backend work
- Token cost guardrails: enforce reasonable limits server-side (max prompt length, max outline length, etc.)

### Files created
- `src/components/super-admin/lesson-blocks/ai-pane/AiPane.tsx` — the right-side AI pane shell with stage state machine
- `src/components/super-admin/lesson-blocks/ai-pane/Stage1Prompt.tsx` — voice dropdown + "What should this lesson teach" textarea + Generate Outline button
- `src/components/super-admin/lesson-blocks/ai-pane/Stage2Outline.tsx` — outline list with per-item Iterate buttons + "Add item" + "Approve and generate full content" button
- `src/components/super-admin/lesson-blocks/ai-pane/Stage3FullContent.tsx` — full draft preview with per-block Iterate buttons + "Build lesson" button
- `src/components/super-admin/lesson-blocks/ai-pane/IterationModal.tsx` — small modal that opens when author clicks "Iterate this" on a specific item or block

### Files modified
- `src/pages/super-admin/LessonBlocksEditor.tsx` — empty-state replaces "Start blank" with two buttons: "Start with AI" (primary) and "Start blank" (secondary). Header gets "✨ AI Draft" button always available. Both routes open AiPane on the right side (pane takes ~40% width, editor canvas shrinks)
- `src/components/super-admin/lesson-blocks/BlockEditorPane.tsx` — each block's config form gets a "✨ Refine with AI" button at the top. Click opens an inline prompt textarea + Generate. Calls `draft-lesson-block` with refinement mode

### Features built
- AiPane is a right-side panel (~40% width when open). The editor canvas reflows to take the remaining width. Toggle to open/close
- Stage state machine:
  - `stage_1_prompt` — waiting for initial author prompt
  - `stage_2_outline` — outline generated, author iterating
  - `stage_3_full_content` — full content generated, author iterating
  - `stage_4_built` — author hit "Build lesson," outputs committed to editor canvas, AI pane returns to a quieter state
- Stage 1 → 2 transition: author types prompt → "Generate outline" → calls `scaffold-lesson-outline` → outline appears in Stage 2 view
- Stage 2 outline iteration: each outline item shows block_type icon + summary + objective + "Iterate this" button. Click opens iteration modal: prompt textarea + Generate. Result replaces only that one outline item. Other items unchanged. Token cost stays small
- Stage 2 → 3 transition: "Approve and generate full content" → calls extended `scaffold-lesson` (or `expand-lesson-from-outline`) with the approved outline → progress indicator → full content arrives → Stage 3 view
- Stage 3 block iteration: each block shows in compact preview. "Iterate this block" opens iteration modal. Calls `draft-lesson-block` with the existing block's config as input + refinement instruction. Result replaces only that block in the AI pane state (not yet in editor)
- Stage 3 → 4 transition: "Build lesson" button → commits the AI pane's full block array to the editor canvas as the editor's local block array → AI pane state resets or persists for further individual refinement
- After "Build lesson," editor is source of truth. The author can still call AI per-block via "Refine with AI" inside any block's config form (single-shot, uses `draft-lesson-block`)
- Voice preset dropdown surfaces in every AI prompt textarea. Default is whichever voice was used last on this lesson (sticky frontend-only). Initial default is first active row from `ai_authoring_voice_presets`
- Error handling: sanitized error codes from Edge Functions surface inline with retry button (no auto-retry). `IMPERSONATION_DENIED` surfaces "AI authoring is not available during impersonation" message

### Token cost design (key feature)
- Initial outline: ~1000 input + ~1000 output tokens
- Outline iteration: ~500 input + ~300 output tokens per iteration (sends existing outline + revision prompt for ONE item; AI returns only that item)
- Full content generation: ~3000 input + ~5000 output tokens (sends approved outline, returns full blocks)
- Block iteration: ~1500 input + ~1500 output tokens per block (existing block config + refinement instruction)
- Author iterating 5 times during outline phase + 3 block-level refinements = ~15K tokens total. Compare to a conversational-blob approach where each iteration could re-send the entire draft = 100K+ tokens for the same author session

### What's NOT in 6a-AI
- Multi-turn conversation history in a single text thread (architecturally rejected; staged flow is the alternative)
- AI generation of the parent content_item description / title (Prompt 6.5 via existing `draft-text` Edge Function)
- Auto-publish on "Build lesson" (built lesson lands as a draft; author still hits Save manually)

---

## Prompt 6b — Remaining 7 block types

Adds the remaining v1 block types to the existing editor.

### Files created
- `src/components/super-admin/lesson-blocks/block-forms/StatCalloutBlockForm.tsx`
- `src/components/super-admin/lesson-blocks/block-forms/StatementABBlockForm.tsx`
- `src/components/super-admin/lesson-blocks/block-forms/TabsBlockForm.tsx`
- `src/components/super-admin/lesson-blocks/block-forms/FlashcardsBlockForm.tsx`
- `src/components/super-admin/lesson-blocks/block-forms/AccordionBlockForm.tsx`
- `src/components/super-admin/lesson-blocks/block-forms/ButtonStackBlockForm.tsx`
- `src/components/super-admin/lesson-blocks/block-forms/ScenarioBlockForm.tsx`

### Files modified
- `src/components/super-admin/lesson-blocks/BlockEditorPane.tsx` — register the 7 new block-type forms in the dispatch
- `src/components/super-admin/lesson-blocks/BlockListPane.tsx` — add icons/colors for the 7 new types in the compact card display + add 7 new options in the inline "+ Add block" popover

### Features built
- `stat_callout` — big number stat + caption + optional source. Config: `{number, caption, source?}`
- `statement_a_b` — side-by-side compare. Config: `{a: {body, variant: 'positive'|'negative'|'neutral'}, b: {body, variant}}` where body uses TipTap
- `tabs` — tabbed content. Config: `{tabs: [{label, body: <TipTap JSON>}]}`. Editor lets author add/remove/reorder tabs
- `flashcards` — flippable cards. Config: `{cards: [{front: <TipTap JSON>, back: <TipTap JSON>}]}`. Editor lets author add/remove/reorder cards
- `accordion` — collapsible panels. Config: `{panels: [{title, body: <TipTap JSON>}]}`. Editor lets author add/remove/reorder panels
- `button_stack` — buttons that reveal content. Config: `{buttons: [{label, revealed_body: <TipTap JSON>}]}`. Editor lets author add/remove/reorder
- `scenario` — single-decision branching narrative. Config: `{setup: <TipTap JSON>, options: [{label, outcome: <TipTap JSON>}]}`

### What's NOT in 6b
- Knowledge check (6c)
- Any backend RPC changes (the existing `replace_lesson_blocks` already accepts any block_type via FK; just need to verify the AI Edge Functions' BLOCK_SCHEMAS dispatch table covers these 7 — Session 56 should have seeded them; verify before 6b)

---

## Prompt 6c — knowledge_check block

The scored interactive block. Most complex of the 17.

### Files created
- `src/components/super-admin/lesson-blocks/block-forms/KnowledgeCheckBlockForm.tsx`

### Files modified
- `src/components/super-admin/lesson-blocks/BlockEditorPane.tsx` — register knowledge_check form
- `src/components/super-admin/lesson-blocks/BlockListPane.tsx` — add to inline + popover
- Possibly `replace_lesson_blocks` RPC — add validation for knowledge_check config shape (right_answer must be valid index, at least 2 answer options, etc.). Verify Session 56 didn't already cover this

### Features built
- knowledge_check config shape: `{question: <TipTap JSON>, answer_type: 'multiple_choice' | 'true_false', options: [{label, is_correct, explanation?: <TipTap JSON>}], passing_explanation?: <TipTap JSON>, failing_explanation?: <TipTap JSON>}`
- Editor: question rich text, answer type radio (multiple_choice / true_false), repeating option editor (label + is_correct checkbox + optional explanation per option), optional pass/fail messages
- Validation in the form: at least 2 options (or exactly 2 for true_false), at least 1 marked correct, question text non-empty
- Trainee-side behavior (Phase 5, NOT in 6c): trainee answers → reveal correct/incorrect + explanation. Lesson completion gated on correct answer if `content_items.lesson_completion_mode = 'scroll_and_checks'`

### What's NOT in 6c
- Trainee-side rendering (Phase 5)
- AI generation of knowledge_check questions (could extend `draft-lesson-block` later but not in 6c)
- Multi-question knowledge_check blocks (each block is one question; if a lesson needs many, the author adds many blocks)

---

## Sequencing reminders
- 6a ships and verifies end-to-end before 6a-AI begins
- 6a-AI requires Supabase backend changes (new/extended Edge Functions) BEFORE any Lovable prompt
- 6b can ship before or after 6a-AI; they're independent
- 6c ships last because knowledge_check is the highest-complexity single block
- TipTap is added as a dependency in 6a. Lovable should support adding npm packages

## Locked decisions reference
- TipTap as rich text engine (Q decision Session 59)
- 17 v1 block types stay active (list NOT removed; standalone list block remains useful)
- Block forms scoped: 9 in 6a, 7 in 6b, 1 in 6c
- AI flow: staged outline → outline-iterate → full-content → block-iterate → build (NOT conversational blob)
- Mount point: separate route, not inline
- Layout: two-pane (left list, right editor) with inline + Add buttons between blocks
