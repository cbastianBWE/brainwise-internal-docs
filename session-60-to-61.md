# Session 60 → 61 Handoff

## What landed this session

**Prompt 6a — manual lesson-block editor — shipped end-to-end (initial + branding + crash hotfix + Rise-style stacked rebuild + late-session backend fixes + drafted polish prompt).**

### Backend migrations applied (8 total across the session)

All 8 applied to project `svprhtzawnbzmumxnhsq` (production) and verified clean via execute_sql:

1. `create_lesson_block_drafts_table` — table with PK (content_item_id, author_id), 4 RLS policies all gated on `author_id = auth.uid() AND public.is_super_admin()`
2. `create_lesson_block_draft_rpcs` — `save_lesson_block_draft` upsert + `discard_lesson_block_draft` delete
3. `extend_replace_lesson_blocks_for_option_b_and_draft_cleanup` — Option B asset-ref rebind loop in `replace_lesson_blocks` + draft cleanup; returns `asset_refs_rebound` in audit `after_value`
4. `extend_reap_pending_uploads_with_active_orphan_sweep` + `fix_reap_active_orphan_actor_to_null` — Sweep 2 in `reap_pending_uploads`, `super_admin_audit_log.super_admin_user_id` made nullable
5. `create_get_lesson_block_assets_rpc` — bulk asset path/bucket/kind fetch; accepts `p_extra_asset_ids` for unsaved uploads
6. `fix_cascade_helper_bare_delete` — `_cascade_archive_asset_refs_for_lesson_blocks` bare DELETE → TRUNCATE (Supabase Postgres rejects bare DELETE at runtime, even on temp tables)
7. `fix_bare_delete_in_all_cascade_helpers` — same bug existed in all 4 sibling cascade helpers (`_content_item`, `_module`, `_curriculum`, `_certification_path`); all 4 fixed via TRUNCATE. Latent bug from Sessions 58-59 that would have failed any cascade archive on entities with active asset refs in production.
8. `defer_cascade_archive_in_replace_lesson_blocks` — moved cascade-archive helper call to AFTER the FOR loop that creates new refs. When an asset is referenced by both an outgoing AND incoming block in the same save (common: save unchanged image), the helper used to see zero active refs at the moment it ran and auto-archived the still-needed asset.

### Lovable prompts shipped (4 commits during the session)

1. **Prompt 6a (initial)** at commit `638db60` — 9 block forms, TipTap v3.x stack, @dnd-kit, BlockListPane + BlockEditorPane two-pane layout, RichTextEditor, useLessonBlockDraft auto-save hook, useAssetSignedUrl
2. **Prompt 6a-brand** at commit `d44f7bc` — surgical branding pass: Navy h1, breadcrumb-style Back button, shadow-cta Save, font-display pane heading, subtle orange-tint active toolbar buttons
3. **useBlocker crash hotfix** at no specific commit (Lovable hotfix flow) — removed `useBlocker` import + replaced with manual `popstate` + `__browser_back__` sentinel guard pattern. Page crashed on mount because `useBlocker` requires a data router (`createBrowserRouter`) and the app uses legacy `<BrowserRouter>`.
4. **Prompt 6a-stacked** at commit `f3aab93` — Rise-style single-column stacked editor rebuild. 7 new files (StackedLessonEditor, EditorSlidePane, BlockRenderer, BlockHoverToolbar, InlineAddButton, useLessonBlockAssetUrls, UndoDeleteToast), 2 deleted (BlockListPane, useAssetSignedUrl), 5 modified (LessonBlocksEditor page rewrite, BlockEditorPane trimmed to dispatch-only, EmbedAudioBlockForm refField fix, ContentItemEditor block count badge, useLessonBlockDraft pause/resume methods).

### End-to-end testing — all 19 acceptance criteria verified

Routing, page render, branded shell, hover toolbar (6 actions: drag/edit/move-up/move-down/duplicate/delete), pane interactions (Esc close, X close, click-another-block switches), inline + Add, auto-save (3s debounce, draft row landed), Save dialog with reason validation, post-save state, race-condition fix (verified by 27s post-save observation of 0 draft rows), Option B asset rebind for image (`asset_refs_rebound: 1` in audit), Option B asset rebind for audio with `embed_audio_asset` refField fix, bulk asset URL fetch via new RPC, drag-and-drop, move up/down with disabled boundaries, duplicate (including shared asset_id case), delete with undo toast functional, block count badge on ContentItemEditor, navigation guard dialog with Stay/Discard, list block end-to-end (TipTap-per-item + @dnd-kit reorder), quote block, audio block end-to-end.

### Lovable Prompt 6a-stacked-fix drafted (sent to Lovable at session close)

1136-line follow-up prompt bundling 12 issues (7 frontend bugs + 5 feature additions) surfaced during E2E testing. Drafted at `/home/claude/internal-docs/lovable-prompts/prompt-6a-stacked-fix.md`. **SENT TO LOVABLE.** Awaiting build at Session 61 start. Scope:

- Column-name fix (`user_id` → `author_id`) for draft resume banner
- Slide-in pane no longer covers global AppLayout sidebar (`fixed` → `absolute`, viewport → contained)
- Heading sizes lifted (H2 → text-3xl, H3 → text-2xl, H4 → text-xl with mt/mb)
- TipTap JSON normalization for dirty detection (fixes spurious autosave on block select)
- Inline `+ Add block` visible at rest (12px cream dashed → 36px orange on hover)
- Save button added to slide-in pane footer
- Undo toast moved to bottom-right
- H2/H3/H4 toolbar buttons in all RichTextEditor uses including compact list-item mode, plus Lead paragraph toggle (1.15rem) in non-compact uses
- "Save and leave" third option on unsaved-changes dialog (primary shadow-cta, between Stay and Discard)
- Body font 17px / 1.65 line-height baseline lift in `.tiptap-prose`
- Bullets = forest green `#2D6A4F` filled disc; numbered = orange `#F5741A` filled circle with white Poppins numeral inside
- Divider = 3px rounded line, default Navy, brand-only color picker (Navy/Orange/Teal/Forest/Slate)
- New `BrandColorSwatch.tsx` component locks pickers to 5 brand hex values; reusable by 6a-style block-background picker

### Lovable Prompt 6a-stacked-fix-v2 drafted (sent to Lovable at session close)

403-line follow-up to 6a-stacked-fix after two issues surfaced during post-build testing:

- **Image block rendered "No image uploaded" placeholder despite asset existing.** Root cause was data state, not code: when asset `6ce8bc29` was manually un-archived earlier in the session, only `content_assets` was reverted — the matching `content_asset_versions` row stayed archived. The `get_lesson_block_assets` RPC correctly filters out assets whose current version is archived (`cav.archived_at IS NULL` required). Fixed via direct UPDATE on the version row. New standing rule logged below.
- **Lead paragraph toggle visible but clicking did nothing.** Root cause: TipTap's default `TextStyle` extension has no `fontSize` attribute defined; calling `setMark("textStyle", { fontSize: "lead" })` silently drops the attribute on JSON serialize. Fix requires `TextStyle.extend()` with a custom `fontSize` attribute that wires `parseHTML`/`renderHTML` to a `data-font-size` HTML attribute. Must be applied to BOTH the editable `RichTextEditor` and the readonly `ReadOnlyTipTap` in `BlockRenderer`. Bundled into v2 prompt.

v2 also expands `BrandColorSwatch` palette from 5 → 8 colors (Cole-locked order: Navy / Orange / Sand / Teal / Mustard / Slate / Purple / Forest) and adds bullet + numbered marker color pickers to the List block form via the expanded swatch.

Black and white explicitly EXCLUDED from palette (white invisible on sand background; black undercuts Navy as platform dark color). Per-block override of heading / body / link / callout-variant text colors explicitly DECLINED for v2 — those stay platform-locked. Build queue carries Cole's "color anywhere" recommendation as a deferred post-launch revisit item.

### Lovable Prompt 6a-stacked-fix-v2 SHIPPED + 6a-stacked-fix-v3.x SHIPPED

v2 shipped first — fixed Lead toggle via TextStyleWithFontSize wrapper extension, expanded BrandColorSwatch palette from 5 to 8 colors (Cole-locked order: Navy / Orange / Sand / Teal / Mustard / Slate / Purple / Forest), added bullet color picker (forest green default) and numbered marker color picker (orange default) to List block via the expanded swatch.

After v2 landed, one final UX issue surfaced: slide-in pane stayed anchored to page-top while user scrolled down the stack to edit blocks deep in the lesson — pane should track viewport, not stay attached to top of page content.

**Three iterations to converge on the pane positioning fix:**

- **v3** attempted `position: sticky` inside a restructured flex sibling layout (pane and stack side-by-side instead of overlay). Sticky never engaged because the pane had a CSS transform for slide animation, and `transform` on the same element as `position: sticky` creates a new containing block context that breaks sticky's scroll-context detection in most browsers.
- **v3.1** attempted to separate sticky (outer wrapper) from transform (inner aside). Still didn't engage because of a deeper issue: the combination of AppLayout's `<main>` having `overflow-auto` (creating the scroll context) AND nested flex containers in between is unreliable for sticky engagement in this codebase.
- **v3.2** abandoned sticky entirely and switched to `position: fixed` with explicit offsets: `top: 56px` (AppLayout header height, confirmed from source), `left: var(--sidebar-width, 0px)` (SidebarProvider's CSS variable), `bottom: 0`, `width: min(480px, calc(100vw - var(--sidebar-width, 0px)))`. Open-state worked perfectly. Closed-state still visually covered the global sidebar because the transform-based slide animation (`-translate-x-full`) translated the pane from `left: 256px` to visual position `[-224px, 256px]` which overlaps the sidebar's `[0, 256]` range.
- **v3.3** kept fixed positioning from v3.2 but switched from transform-based animation to animating `left` directly: closed = `left: -480px` (fully off-screen in negative coordinate space `[-480, 0]`), open = `left: var(--sidebar-width)`. Pane's coordinate range during closed state never overlaps sidebar's `[0, 256]` range at any animation frame. **Shipped clean.**

All v3.3 acceptance criteria verified: sidebar fully visible at all times (closed pane, open pane, mid-animation), pane appears in correct viewport position regardless of scroll depth, scrolling stack while pane is open works (pane stays anchored), open/close animations smooth, no regressions.

Lesson learned (logged as cross-prompt rule): for "stay visible while content scrolls past" UI, `position: fixed` is the default — `position: sticky` is for "scroll with content then stop at target" cases (table headers, day separators). Should have shipped fixed-positioning in v3 first instead of three iterations on sticky.

Bonus warning surfaced in console: `tiptap warn: Duplicate extension names found: ['link']`. StarterKit bundles Link by default; RichTextEditor + ReadOnlyTipTap both add `Link.configure({...})` explicitly, registering Link twice. Non-fatal, logged in build queue for cleanup in a future prompt.

## Standing rules surfaced this session

1. **`useBlocker` from react-router-dom v6 requires a data router** (`createBrowserRouter`). Legacy `<BrowserRouter>` pages crash on mount when `useBlocker` is imported. Use manual `popstate` + `__browser_back__` sentinel guard pattern documented in `LessonBlocksEditor.tsx`.

2. **Every asset-bearing block form MUST use exactly `<block_type>_asset` as its `refField`** to match the backend's `replace_lesson_blocks` ref construction (`v_block_type || '_asset'`). Mismatches silently fail Option B rebind and leave orphan content_item-scoped refs. EmbedAudioBlockForm originally used `audio_asset` for `block_type='embed_audio'` — fixed to `embed_audio_asset`.

3. **`BlockRenderer` is canonical for the platform.** Phase 5 trainee learning UI reuses it directly. Any new block type added in 6b/6c MUST add a render path to `BlockRenderer.tsx`. Never fork into a separate trainee renderer.

4. **shadcn `Sheet` primitive is modal-overlay only** (uses Radix Portal + fixed positioning + backdrop). For non-modal slide-in panes where content behind remains interactive, build as a flex/grid sibling with CSS transform animation, see `EditorSlidePane.tsx`.

5. **Auto-save debounce hooks MUST expose `pause()`/`resume()`** so parent components can cancel pending debounce timers around explicit save operations. Otherwise the debounce fires after the explicit save completes and undoes the save's cleanup work. Caused the `lesson_block_drafts` race condition where the draft row re-appeared 3 seconds after Save.

6. **`super_admin_audit_log.action_type` uses an FK to `super_admin_action_types` table** (lookup table, not CHECK whitelist). Correction to earlier doc references that incorrectly described it as a CHECK constraint.

7. **`reap_pending_uploads` cron and function are named without `_hourly` suffix.** Earlier doc references corrected.

8. **Bare `DELETE FROM <table>;` is rejected at runtime in Supabase Postgres** even on temp tables. Use `TRUNCATE <table>;` to clear all rows or include a `WHERE` clause on every DELETE.

9. **In `replace_lesson_blocks` and any future replace-style RPC with auto-archive cascade, the cascade MUST run AFTER incoming refs are created.** Helpers checking "any active refs?" need the new refs to be visible. Otherwise transient zero-ref states cause spurious cascade-archives of still-referenced assets.

10. **Brand-only color enforcement.** Any color chooser added in any future sub-prompt (6a-style, 6a-manage, 6a-AI, 6b, 6c) MUST use the `BrandColorSwatch` component built in 6a-stacked-fix or a strict subset of its `BRAND_SWATCH_COLORS` list. No hex input, no system color picker, no off-palette colors anywhere in lesson authoring.

11. **TipTap JSON normalization for dirty detection.** TipTap normalizes its JSON shape on readonly editor mount differently than the editable form's output. Naive `JSON.stringify` comparison triggers false-dirty detection every time a readonly TipTap instance mounts. Standing fix: deep-normalize the JSON before comparison (strip empty arrays, sort object keys, drop null/empty-string values).

12. **Typography baseline locked at 17px body / 1.65 line-height** in `lesson-blocks.css` `.tiptap-prose` wrapper applies wherever lesson content renders.

13. **List marker defaults locked:** bullets = forest green `#2D6A4F` filled disc; numbered = orange `#F5741A` filled circle with white Poppins numeral inside. Non-overridable per-block in v1.

14. **Divider default locked:** 3px rounded line, default Navy `#021F36`, color overridable via `BrandColorSwatch`. Palette expanded to 8 colors in v2 (Navy / Orange / Sand / Teal / Mustard / Slate / Purple / Forest).

15. **Save-and-leave is the primary path** when user has unsaved changes and tries to navigate away. Discard-and-leave is the de-emphasized escape hatch. Stay is cancel. Applies to any future dirty-state navigation guard.

16. **Manual asset un-archive must reverse both tables.** The `_archive_asset_internal` helper archives `content_assets` AND the matching `content_asset_versions` row atomically. Any manual data fix that un-archives an asset must reverse BOTH — otherwise `get_lesson_block_assets` and any future signed-URL resolver continue filtering the asset out because they require `cav.archived_at IS NULL`. Caused the "image disappears from stack after un-archive" symptom in late Session 60.

17. **TipTap TextStyle cannot accept arbitrary attributes without explicit `extend()`.** Default `TextStyle` has no attribute schema; `setMark("textStyle", { customAttr: ... })` succeeds at chain level but the unknown attribute drops on JSON serialize. Standing fix: extend `TextStyle` with `addAttributes` that wires `parseHTML`/`renderHTML` to a `data-<attr>` HTML attribute, export as a named const, swap into the `extensions` array in BOTH the editable `RichTextEditor` AND the readonly `ReadOnlyTipTap` in `BlockRenderer`. Applies to any future custom TipTap mark attribute (font weight, sanctioned text color, paragraph alignment, etc.).

18. **Brand color palette locked to 8 colors in fixed order:** Navy, Orange, Sand, Teal, Mustard, Slate, Purple, Forest. Black and white explicitly excluded — white invisible on sand background, black undercuts Navy as the platform's dark color. Any future per-block color override added in 6a-style or beyond must use this palette via `BrandColorSwatch` (or a `allowedHexes`-filtered subset for context-specific cases).

19. **`position: sticky` is unreliable in this codebase for viewport-tracking UI — use `position: fixed` with explicit offsets.** Two failure modes confirmed in Session 60: (a) sticky + CSS transform on the same element breaks sticky's scroll-context detection because transform creates a new containing block; (b) sticky inside AppLayout's `<main>` (which has `overflow-auto` creating the scroll context) combined with nested flex containers is unreliable for engagement detection. Standing fix: for viewport-tracking UI (sidebar panes, sticky toolbars, persistent action bars), use `position: fixed` with explicit offsets keyed off AppLayout's known dimensions — header is 56px, sidebar width is `var(--sidebar-width)` cascaded from SidebarProvider.

20. **Slide-in pane animations should animate the `left` CSS property directly, not CSS transform, when the closed state needs to be off-screen and there's a global sidebar to avoid covering.** Transform-based animation translates the pane FROM its open coordinate range, so a pane open at `left: 256px` with width 480px translated `-100%` ends up at visual position `[-224px, 256px]` which overlaps the sidebar's `[0, 256px]` range. Animating `left` directly between open (e.g., `var(--sidebar-width)`) and closed (e.g., `-480px`) keeps the closed pane in negative coordinate space `[-480px, 0px]` with no overlap. Use `transition-[left]` Tailwind class. Trade-off: animating `left` triggers layout/paint vs transform's compositor-only, but for typical pane sizes (480px) the perf cost is unmeasurable. Use transform-based slide ONLY when there's no global sidebar to overlap with.

21. **TipTap StarterKit + explicit Link extension causes "Duplicate extension names" warning.** StarterKit bundles a Link extension by default. Adding `Link.configure({...})` alongside StarterKit registers Link twice. Fix is either drop the explicit Link import OR `StarterKit.configure({ link: false })` then add explicitly. Non-fatal warning. Logged for future cleanup.

## Where Session 61 picks up

**Primary agenda: begin scoping 6a-style. 6a-stacked-fix is COMPLETE across v1+v2+v3.3.**

### 6a-stacked-fix — DONE (all four versions shipped + tested Session 60)

No further work on 6a-stacked-fix needed. v1 shipped 12 polish items + introduced BrandColorSwatch. v2 fixed Lead toggle (TipTap TextStyle.extend pattern), expanded palette to 8 colors, added bullet/numbered marker color pickers. v3.2+v3.3 fixed pane scroll-tracking (position:fixed approach) and closed-state sidebar overlap (animate-left approach). All acceptance criteria for all versions verified.

### Round 1 — begin 6a-style scoping

### Round 2 — begin 6a-style scoping

The next sub-prompt is **6a-style**: per-block background color + top/bottom padding (Rise pattern). Locked constraints from late Session 60:

- Block background color picker MUST use `BrandColorSwatch` (likely with lighter tinted hex variants for readability — exact tints to be decided at scoping)
- Padding stays fixed enumerated set: none / small / medium / large (not arbitrary px)
- Schema decision leans toward extending `lesson_blocks.config` jsonb shape rather than adding typed columns
- 6a-style MUST NOT introduce per-block override of heading color, link color, callout variant color, or list marker color — those are platform-locked

Recon needed before writing the prompt:

- Pull current `BlockRenderer.tsx` from GitHub to confirm config dispatch shape after all 6a-stacked-fix iterations
- Pull `BrandColorSwatch.tsx` to confirm 8-color palette + props interface (allowDefault, allowedHexes, etc.)
- Decide whether to extend config or add typed columns (recommend config)
- Decide tint variant approach (single set of pre-mixed brand-tint hex values OR a `tintIntensity` prop on BlockRenderer that does alpha math at render time)
- Verify pane positioning fix from v3.3 doesn't conflict with any new 6a-style UI (it shouldn't — the pane is `position: fixed` and self-contained)

### Updated sub-prompt sequence (locked)

1. ✅ **Prompt 6a-stacked** (shipped Session 60)
2. ✅ **Prompt 6a-stacked-fix** (v1 + v2 + v3.2 + v3.3 all shipped + tested Session 60 — DONE)
3. **Prompt 6a-style** (NEXT — Session 61; scope above)
4. **Prompt 6a-manage** — multi-select + Manage Blocks sidebar + bulk operations
5. **Prompt 6a-AI** — staged AI authoring (Edge Function additions first)
6. **Prompt 6b** — 7 remaining block types (stat_callout, statement_a_b, tabs, flashcards, accordion, button_stack, scenario)
7. **Prompt 6c** — knowledge_check block (last; highest complexity single block)

## DB state at session close

- Test content_item `32e0e966-4cb8-4e8b-abf8-5617de346f59` ("Test Lesson Blocks Item" in Test Module C) has **10 active lesson_blocks** in this order: text, text, text, divider, image, heading, embed_audio, quote, list, callout — covers all 9 block types in the v1 catalog
- **0 `lesson_block_drafts` rows** — race condition fix held solid through 14 saves
- Image asset `6ce8bc29` active, version row active (was archived mid-session by cascade-archive timing bug, manually fixed by un-archiving BOTH `content_assets` and `content_asset_versions` — see rule 16)
- Audio asset active with 1 active ref to its lesson_block, `ref_field = 'embed_audio_asset'` (refField fix verified)
- **14 `super_admin_audit_log` rows** for `lesson_blocks_replaced` across the session (extensive testing)

## Recon for Session 61 start

- Pull `LessonBlocksEditor.tsx`, `EditorSlidePane.tsx`, `BlockRenderer.tsx`, `useLessonBlockDraft.ts`, `RichTextEditor.tsx`, `UndoDeleteToast.tsx`, `InlineAddButton.tsx`, `BrandColorSwatch.tsx` (new), `DividerBlockForm.tsx`, `blockTypeMeta.ts`, `lesson-blocks.css` from the `cbastianBWE/brainwise-blueprint` repo after 6a-stacked-fix lands
- Confirm `BrandColorSwatch` props interface for reuse in 6a-style
- Verify the 12 changes from 6a-stacked-fix all landed cleanly without regressions
- Test the 15 acceptance criteria from the 6a-stacked-fix prompt (Cole has the test order)
