# Prompt 6 — Sub-prompt scope summary

Reference document for the LessonBlocksEditor build sequence. Keep on hand across sessions.

---

## SESSION 60 UPDATE — SUPERSEDES TWO-PANE LAYOUT AND EXPANDS SUB-PROMPT SEQUENCE

After shipping the original two-pane Prompt 6a in Session 60 and testing it in the UI, the layout was rebuilt to a Rise-style single-column stacked editor with a slide-in left pane. The two-pane design described in the historical section below is no longer the target. Read this section first; the rest of the doc is the original scope kept for historical context only.

### Updated layout — locked
Single scrolling column rendering all blocks in order with trainee-accurate previews (the `BlockRenderer` component renders blocks identically to how the trainee will see them in Phase 5; same component is reused there). On hover, a floating toolbar appears top-right of each block with: drag handle, edit, move up, move down, duplicate, delete. Inline thin `+ Add block` divider lines appear between every pair of blocks plus above the first and below the last; on hover they expand and reveal the add label, click opens the AddBlockPopover anchored there.

Editing happens in a slide-in left pane (NOT a shadcn Sheet — non-modal, no backdrop, lives inside main). Pane is `w-[480px]` absolutely positioned; the stack reflows right via `md:ml-[480px]` when open. The pane has an X close button + closes on Esc. Clicking another block in the stack switches the pane content without closing. Clicking outside the pane does NOT auto-close.

When a new block is inserted via `+ Add block`, the pane auto-opens on the new block (the user almost always wants to configure a freshly-added block).

Selected block is indicated in the stack with `bg-muted` (gray, not orange) + a `border-l-4 border-[#F5741A]` (BrainWise orange) left-edge indicator. Hover uses `bg-muted/30`. The codebase's TreeRow precedent in ContentAuthoring uses `bg-muted` for selection — this stacked editor matches that convention.

### Updated sub-prompt sequence — locked
1. **Prompt 6a-stacked** (Session 60+) — Rise-style stacked editor rebuild. Replaces BlockListPane with StackedLessonEditor, adds EditorSlidePane, adds BlockRenderer (canonical, Phase 5 reuses), adds BlockHoverToolbar with 6 actions (drag/edit/move-up/move-down/duplicate/delete), adds InlineAddButton, adds UndoDeleteToast (bottom-left, 6s undo), adds useLessonBlockAssetUrls (bulk asset URL fetch via new RPC). Bundles three Session 60 test-surfaced fixes: race condition between manual Save and auto-save (cancel pending debounce + pause auto-save during Save), post-save deselect (preserve selected block by display_order), `EmbedAudioBlockForm` refField mismatch (`audio_asset` → `embed_audio_asset` to match backend's `<block_type>_asset` construction). ContentItemEditor gains a block count next to the "Edit lesson blocks" button.
2. **Prompt 6a-style** (after 6a-stacked verified) — Background color + padding per block. Schema migration: add `background_color text NULL`, `padding_top int NULL`, `padding_bottom int NULL` to `lesson_blocks` (or extend config jsonb shape; decide at scoping). Style form section per block. BlockRenderer honors the style. NOT in 6a-stacked because it requires schema work and adds independent surface area.
3. **Prompt 6a-manage** (after 6a-style verified) — Multi-select + Manage Blocks sidebar. New mode toggle, checkbox UI, bulk delete, copy-to-lesson, bulk operations toolbar. Independent of style work. NOT in 6a-stacked because it's a separate interaction model.
4. **Prompt 6a-AI** (after 6a-manage verified) — Staged AI authoring. Requires backend work first (new/extended Edge Functions for outline-then-full-content flow). AiPane component, stage state machine, AI button per block, AI buttons in the stacked editor toolbar.
5. **Prompt 6b** (after 6a-AI verified) — 7 remaining block types: stat_callout, statement_a_b, tabs, flashcards, accordion, button_stack, scenario. New form files, new BlockRenderer paths, no AI in 6b initially (folded into 6a-AI pattern when those types get AI support).
6. **Prompt 6c** (last) — knowledge_check block. Highest complexity single block. Requires understanding of completion + scoring + trainee response capture (Phase 5 concern overlap).

Sequencing rationale: style before AI because BlockRenderer needs to honor styling before AI generates blocks (otherwise AI-generated blocks land without style support and the schema gets retrofitted). Multi-select fits between style and AI because it's a self-contained UX improvement that benefits authors before AI authoring goes live.

### Backend additions shipped in Session 60 (no further backend work needed for 6a-stacked)
- `lesson_block_drafts` table (PK content_item_id+author_id) + 4 RLS policies (super_admin AND own author_id)
- `save_lesson_block_draft(p_content_item_id, p_draft_json)` upsert RPC
- `discard_lesson_block_draft(p_content_item_id)` delete RPC
- `replace_lesson_blocks` extended with Option B rebind loop (rebind parent-scoped asset refs to lesson_block_ids at Save) + draft cleanup (delete drafts for `(content_item, auth.uid())` on success). Returns `asset_refs_rebound` count in audit `after_value`.
- `reap_pending_uploads` (NOT `_hourly` — the cron and function are named `reap_pending_uploads`) extended with Sweep 2 — active non-library assets >24h whose every active ref points at archived/missing parent → `_archive_asset_internal` with NULL caller (updated_by column made nullable in the same migration).
- `get_lesson_block_assets(p_content_item_id, p_extra_asset_ids uuid[] DEFAULT NULL)` — bulk asset path/bucket/kind fetch for stacked editor. Accepts extra_asset_ids for unsaved-but-uploaded assets that haven't been persisted to lesson_blocks yet.

### Standing rules locked in Session 60
- Auto-save debounce timer MUST be cancellable. Any hook that auto-saves on a debounce needs `pause()` / `resume()` so the parent can cancel the pending timer around explicit save operations. Otherwise the debounce fires after Save completes and undoes the save's cleanup work (the lesson_block_drafts race condition that surfaced in Session 60 testing).
- Every asset-bearing block form MUST use exactly `<block_type>_asset` as its `refField`. The backend `replace_lesson_blocks` constructs the ref_field as `v_block_type || '_asset'` for rebind matching. The `EmbedAudioBlockForm` originally used `audio_asset` and Option B rebind silently failed for audio blocks until fixed.
- `useBlocker` from react-router-dom v6 requires a data router (`createBrowserRouter`). The app uses legacy `<BrowserRouter>` which does not support it. Pages that need navigation blocking on dirty state must use the manual `popstate` + `__browser_back__` sentinel pattern documented in `LessonBlocksEditor.tsx`. Do not import `useBlocker`.
- Shadcn `Sheet` is a modal overlay primitive — not appropriate for non-modal slide-in panes. For non-modal slide-in panes (where content behind should remain interactive), build a regular flex/grid sibling with CSS `transform` animation. See `EditorSlidePane.tsx`.
- The `BlockRenderer` component established in 6a-stacked is the canonical block renderer for the whole platform. Phase 5 trainee UI reuses it directly. Any future block type added in 6b/6c MUST add a render path to `BlockRenderer.tsx`. Never fork into a separate trainee renderer.

### Branding lock for stacked editor
- Selected block: `bg-muted` + `border-l-4 border-[#F5741A]` (gray fill + orange left edge — matches the codebase's existing tree-row selection convention)
- Hover (non-selected): `bg-muted/30`
- Page h1: Navy `#021F36` + `font-display` (Poppins) + `text-3xl font-bold tracking-tight`
- Save button: `shadow-cta` (orange glow) — primary CTA marker
- Editor pane heading (block type label at top of slide-in pane): Navy + `font-display` + `text-base font-semibold`
- Active TipTap toolbar button: `bg-[#F5741A]/15 text-[#F5741A]` (light orange tint, not solid)
- BrainWise orange `#F5741A` is reserved for: TipTap list bullets (`lesson-blocks.css`), inline links, focus rings, active toolbar buttons, selection left-border, inline `+ Add block` hover, primary CTAs (`shadow-cta`)
- Callout variant colors (locked, do not change): info=teal `#006D77`, warning=amber `#FFB703`, success=forest `#2D6A4F`, important=orange `#F5741A`
- Undo toast: white card, `border-l-4 border-[#006D77]` (teal accent indicates a recoverable action)
- Do NOT use `bg-accent` or `bg-accent/50` as a card or selection fill — too loud orange. Use `bg-muted` for fill, orange only as edge/border/icon accent.

### Performance note for stacked editor
Readonly TipTap-per-block (for text/quote/callout/list blocks) is borderline acceptable for ~20-block lessons. Each block instantiates a TipTap editor instance with `editable: false`. If performance degrades on larger lessons, switch to TipTap's `generateHTML(json, extensions)` utility from `@tiptap/html` package — produces static HTML without per-render editor instances. Flagged as known optimization; not implemented in 6a-stacked.

---

## SESSION 60 SECOND UPDATE — POST-STACKED E2E TESTING + 6a-STACKED-FIX ADDED + STYLING BASELINE LIFTED

After 6a-stacked shipped and was tested end-to-end against all 19 acceptance criteria, 12 polish items surfaced (7 bugs + 5 feature additions). All 19 ACs verified working. 3 additional backend bugs were surfaced and fixed in Session 60 (separate from the bugs bundled into 6a-stacked itself). The fixes plus the 12 polish items are bundled into a new sub-prompt `6a-stacked-fix` inserted between `6a-stacked` and `6a-style`. The styling baseline is also lifted in 6a-stacked-fix and applies to every downstream prompt (6a-style, 6a-manage, 6a-AI, 6b, 6c).

### Updated sub-prompt sequence (supersedes the one in the first Session 60 update above)
1. **Prompt 6a-stacked** ✅ shipped + tested Session 60
2. **Prompt 6a-stacked-fix** (NEXT — drafted Session 60, sends Session 61 start) — 12 polish items + new BrandColorSwatch component + typography baseline lift
3. **Prompt 6a-style** — Background color + padding per block. Inherits BrandColorSwatch from 6a-stacked-fix and brand-only color enforcement principle.
4. **Prompt 6a-manage** — Multi-select + Manage Blocks sidebar (unchanged from first Session 60 update)
5. **Prompt 6a-AI** — Staged AI authoring (unchanged from first Session 60 update)
6. **Prompt 6b** — 7 remaining block types (unchanged)
7. **Prompt 6c** — knowledge_check block (unchanged)

### Backend additions shipped late Session 60 (no further backend work needed for 6a-stacked-fix)
- `fix_cascade_helper_bare_delete` migration — `_cascade_archive_asset_refs_for_lesson_blocks` had a bare `DELETE FROM _affected_assets_blocks;` that tripped Supabase's runtime no-WHERE-clause-DELETE rule. Replaced with `TRUNCATE`.
- `fix_bare_delete_in_all_cascade_helpers` migration — same bug existed in all 4 sibling cascade helpers (`_cascade_archive_asset_refs_for_content_item`, `_module`, `_curriculum`, `_certification_path`). All 4 fixed via TRUNCATE. Latent bug from Sessions 58–59 that would have failed any cascade archive on entities with active asset refs.
- `defer_cascade_archive_in_replace_lesson_blocks` migration — cascade-archive call inside `replace_lesson_blocks` ran BEFORE the FOR loop that creates new refs. When an asset was referenced by both an outgoing block AND an incoming block in the same save (common case: save a lesson without changing the image), the cascade helper saw zero active refs at the moment it ran and auto-archived the still-needed asset. Moved cascade-archive to AFTER the FOR loop so new refs exist before the helper's active-ref-count check runs.

### Bugs surfaced + bundled into 6a-stacked-fix (frontend only — backend fixes above are already live)
1. `lesson_block_drafts` queried by `user_id` (column is `author_id`) — draft-resume banner never shows
2. Slide-in pane covers global AppLayout sidebar — `fixed left-0 h-screen z-30` must become `absolute left-0 h-full z-20` constrained to main content area
3. Heading sizes smaller than spec — H2 `text-2xl` → `text-3xl`, H3 `text-xl` → `text-2xl`, H4 `text-lg` → `text-xl`, with mt/mb breathing room
4. Spurious draft autosave on block select — TipTap normalizes JSON shape on readonly mount differently than editable form output. Fix via deep-normalize JSON before dirty comparison (strip empty arrays, normalize key order, drop null/empty). Same fix applied to `isDirty` detection in `LessonBlocksEditor.tsx`.
5. Inline `+ Add block` invisible at rest — bumped from 6px to 12px visible dashed cream line with 50%-opacity `+` icon, expands to 36px with full orange treatment on hover
6. ~~Bare DELETE in cascade helpers~~ — fixed backend (see above)
7. ~~Race condition (autosave re-creates draft after Save)~~ — fixed in 6a-stacked + verified Session 60
8. ~~Post-save deselects block~~ — fixed in 6a-stacked + verified Session 60
9. No Save button in slide-in pane — added to pane footer, `shadow-cta`, full-width, opens existing save reason dialog
10. ~~Save button blocked by pane~~ — resolved automatically by fix #2 (pane no longer covers viewport so page header Save stays reachable)
11. Undo toast at bottom-LEFT, platform convention is bottom-RIGHT — single-attribute fix `left-6` → `right-6`
12. ~~Spurious-save investigation~~ — same root cause as #4, merged
13. Toolbar text-size controls — H2/H3/H4 buttons unified across all uses (text, quote, callout, list-items including compact mode), plus a Lead paragraph toggle (1.15rem, font-weight 500) gated to non-compact uses only
14. "Save and leave" third option on unsaved-changes dialog — third button between Stay (cancel) and Discard and leave (outline). Save and leave is the primary action (`shadow-cta`). Clicking opens the existing save reason dialog with `saveAndNavigateTo` state set; on successful save, navigation proceeds to the originally-attempted destination.
15. ~~`replace_lesson_blocks` cascade-archive timing bug~~ — fixed backend (see above)
16. Body font size bump + bigger bullets + filled-circle numbered markers — 16→17px body, 1.65 line-height, bullets switch from CSS `•` to forest green `#2D6A4F` filled disc (0.65em diameter), numbered markers become orange `#F5741A` filled circles (1.5em diameter) with white Poppins numerals inside
17. Divider more distinct + brand color choice — 1px hairline → 3px rounded line, default Navy, form gets `BrandColorSwatch` picker constrained to 5 brand colors (Navy / Orange / Teal / Forest / Slate)
18. Brand-only color enforcement — new shared `BrandColorSwatch.tsx` component locks the picker to 5 brand hex values. No hex input, no system color picker, no off-palette colors. Reused by 6a-style for block background pickers, and any future per-block color override added in later prompts.

### Cross-prompt standing rules locked late Session 60 (apply to all downstream sub-prompts)
- **Brand-only color enforcement**: any color chooser added in 6a-style, 6a-manage, 6a-AI, 6b, or 6c MUST use the `BrandColorSwatch` component built in 6a-stacked-fix (or a strict subset of its `BRAND_SWATCH_COLORS` list). No hex input field. No system color picker. No off-palette colors. This is non-negotiable for content portability across organizations licensing BrainWise content.
- **Bare `DELETE FROM <table>;` is rejected at runtime in Supabase Postgres** (even for temp tables). Use `TRUNCATE <table>;` to clear a table, or include a `WHERE` clause on every DELETE.
- **In `replace_lesson_blocks` and any future replace-style RPC with auto-archive cascade, the cascade MUST run AFTER incoming refs are created.** Helpers that check "any active refs?" need the new refs to be visible. Otherwise transient zero-ref states cause spurious cascade-archives of still-referenced assets.
- **Typography baseline lifted to 17px body / 1.65 line-height** in `lesson-blocks.css`. Applies wherever `.tiptap-prose` is rendered (stacked editor, slide-in pane previews, future trainee Phase 5 UI). Any new block type in 6b/6c that introduces new rendered content inherits this baseline automatically by using the `.tiptap-prose` wrapper.
- **List markers locked**: bullets = forest green `#2D6A4F` filled disc, numbered = orange `#F5741A` filled circle with white Poppins numeral inside. These are the defaults. Future per-block override (if ever added) MUST use the `BrandColorSwatch` palette.
- **Divider default locked**: 3px rounded line, default Navy `#021F36`, color overridable via `BrandColorSwatch` constrained to 5 brand colors.
- **Save-and-leave is the primary path** when the user has unsaved changes and tries to navigate away. Discard-and-leave is the de-emphasized escape hatch. Stay is cancel. This ordering applies to any future dirty-state navigation guard added in 6a-manage or elsewhere.

### Branding lock additions (supplement to the first Session 60 update lock)
- `BrandColorSwatch` palette: Navy `#021F36`, Orange `#F5741A`, Teal `#006D77`, Forest `#2D6A4F`, Slate `#6D6875`. Subset-able via `allowedHexes` prop for cases where only a specific subset makes sense (e.g., dividers can be any of the 5; future stripe accents might be teal-or-forest-only).
- `RichTextEditor` toolbar buttons (locked order, left to right): Bold / Italic / Strike / Bullet / Numbered / H2 / H3 / H4 / Lead. Bold / Italic remain visible in all modes including compact. Lead is the only button gated to non-compact mode.
- Numbered list markers in trainee-facing rendered content use the Poppins font family explicitly to ensure the white numeral inside the orange circle reads as a deliberate design choice rather than a default browser glyph.

### 6a-style — scope refinement (incorporates Session 60 second-update learnings)
6a-style remains the next major sub-prompt after 6a-stacked-fix. Scope unchanged at the high level (per-block background color + top/bottom padding) but now inherits these constraints:
- Block background color picker MUST use `BrandColorSwatch` from 6a-stacked-fix. Default is "Default" (no override, transparent — block inherits page sand background). Allowed overrides: all 5 brand colors, but the swatch should render lighter "tinted" variants (e.g. Navy at 4% opacity background, not full Navy) for readability. Implementation: 5 hex values stored, BlockRenderer applies them with low alpha. OR: define a separate `BRAND_TINT_COLORS` palette with pre-mixed near-neutral tints. Decide at scoping time.
- Padding choices remain a small fixed set (none / small / medium / large) rather than arbitrary px input — keeps the lesson visual rhythm predictable across authors.
- Schema decision: lean toward extending the existing `config` jsonb shape rather than adding `background_color`/`padding_top`/`padding_bottom` columns. Reason: BlockRenderer already routes config-driven styling, and the typed columns don't add useful constraint enforcement (the values are CSS-shaped, not enum-shaped). Decide at scoping time.
- 6a-style MUST NOT introduce any per-block override of heading color, link color, callout variant color, or list marker color. Those decisions are platform-locked. The author tools for visual differentiation are: background color, padding, divider color (already shipped in 6a-stacked-fix), and structural choices (heading level, list type).

---

## ORIGINAL SCOPE (Session 59 — superseded by Session 60 update above)

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
  - Vertical list of compact block cards with type-aware previews:
    - Text block: block_type icon + first 2 lines of prose
    - Heading block: icon + full heading text (usually short)
    - Image block: icon + small 40×40 thumbnail + filename
    - Video embed block: icon + small thumbnail + title
    - Callout block: icon + variant-color stripe on left edge + first line
    - List block: icon + "List (N items)" summary
    - Quote block: icon + first line of quote + attribution line
    - Audio embed block: icon + filename + duration if known
    - Divider block: icon only (it's just a divider)
  - When a block has both a text body and an asset, prioritize asset thumbnail with text caption smaller underneath
  - Drag handle on the left of every card, trash icon on the right
  - Selected card has highlighted border + slight background tint
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

### Auto-save + draft/commit pattern (locked Session 59)

Authors don't lose work between manual Saves. Auto-save persists to a separate draft table; manual Save is the only path that writes to canonical lesson_blocks.

**SOC 2 posture:** drafts are explicitly outside the audit boundary. Canonical lesson_blocks changes only via `replace_lesson_blocks` (one audit row per commit, unchanged from existing pattern). When asked "where are work-in-progress edits?" the answer is "in `lesson_block_drafts`, not audit-logged because they're not canonical changes."

**Backend additions (Prompt 6a backend):**
- New table `lesson_block_drafts`: content_item_id uuid (PK), author_id uuid, draft_json jsonb, updated_at. One draft per (content_item, author).
- RLS: super admins read/write only their own draft rows
- New RPC `save_lesson_block_draft(p_content_item_id, p_draft_json)` — no reason field, no audit log
- New RPC `discard_lesson_block_draft(p_content_item_id)` — deletes the draft row
- `replace_lesson_blocks` extended (or wrapper added) to delete the matching draft row on successful commit. Match by (content_item_id, author=caller).

**Frontend flow:**
- Auto-save: debounced ~3 seconds after author stops typing. Calls `save_lesson_block_draft`. Silent. Failure shows a non-blocking toast.
- Load: on editor open, check for an existing draft for (content_item, current author). If found, show a banner: "You have an unsaved draft from <timestamp>. Resume / Discard?" Resume loads the draft into editor state; Discard calls `discard_lesson_block_draft` and loads canonical state.
- Manual Save (existing flow): author hits Save with reason → `replace_lesson_blocks` runs → draft row deleted server-side → one audit row written.
- Navigation away with isDirty (Question 5 outcome): confirm dialog "You have draft changes that haven't been committed yet. Stay / Discard." Discard calls `discard_lesson_block_draft` before navigating. Stay returns to editor with draft loaded.
- Browser tab close with isDirty: `window.beforeunload` set to true while isDirty, removed on commit.

### Orphan asset cleanup (locked Session 59)

Authors might upload assets to blocks they later delete in-session, or upload then close the tab without saving. Storage shouldn't accumulate dead assets.

**Two-mechanism design:**

1. **Server-side atomic cleanup at Save (existing — verify).** `replace_lesson_blocks` is already atomic-replace per Session 58: archives all current active blocks, inserts the new array, and the cascade helper `_cascade_archive_asset_refs_for_lesson_blocks` archives refs pointing at blocks that no longer exist. Any non-library asset with zero remaining refs auto-archives. Need to verify before 6a backend that this fires correctly for the save-without-the-block case (block was in initial load with asset ref → block removed from editor → Save → block ref archived → asset auto-archived if no other refs).

2. **Server-side sweep for tab-close / abandonment (new — extend existing cron).** Extend `reap_pending_uploads_hourly` cron with a second sweep clause: find `content_assets` where `is_library_asset = false` AND `status = 'active'` AND all active refs point exclusively to `lesson_block_id` values not in `lesson_blocks` (or `lesson_block_id` is in archived blocks with `archived_at < threshold`). Threshold: 24 hours from asset creation. Archive these via `_archive_asset_internal` so they enter the standard 22-day soft-delete recovery window.

**What's NOT in the cleanup design:**
- No per-block-delete frontend RPC calls (Orphan-2 rejected — too much frontend complexity for marginal benefit; the two backend mechanisms cover all real cases).
- No live tracking of "which assets did this editor session upload that haven't been committed yet" — server figures it out from ref state.

**Risk acknowledged:** an asset uploaded, used in a draft (auto-saved to `lesson_block_drafts`), then never committed will be archived by the sweep after 24 hours. This is acceptable: the draft still references the asset_id, but the asset is in 22-day recovery, and an author returning after 24+ hours to a draft will see broken asset references but the editor can show a "this asset was archived; re-upload?" message. Better to recover storage than retain dead assets indefinitely.

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
