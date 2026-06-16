# BrainWise Session 137 to 138 Handoff

*Closeout: Session 137. Open: Session 138.*

## Where Session 137 left off

Session 137 was a Learning-Experience / white-label arc. Track 1 (AI lesson authoring + the Pexels image pipeline) is fully fixed and confirmed working end to end. Track 2 (per-lesson branding / white-label) shipped Phases 1 through 3 (data layer, cover page + brand editor + topic ToC, per-block hex pickers) plus Phase 4a's outline-overview piece. The remaining Phase 4 work (the expand color-policy flip, chat brand intake, and AI rebrand of existing lessons) is queued for Session 138, followed by Tracks 3 through 6.

## Session 138 opening priorities, in order

### 1. Phase 4a remainder — expand-lesson-from-outline color-policy flip (the delicate core)

This is the riskiest single edit in the white-label arc. Do it first, carefully, with a rolled-back build test before it goes live.

Function: `expand-lesson-from-outline` (currently v25, ~49KB, verify_jwt false). Source on disk at `/home/claude/deploy/expand-lesson-from-outline/index.ts` (49039 bytes). It is too large for MCP inline deploy (MCP truncates around 25KB+), so it is DASHBOARD-PASTE. Only `index.ts` changes; `_shared/` is already deployed and unchanged.

Three changes:
1. Fetch the lesson brand server-side via `serviceClient` from `lesson_brands` by `content_item_id` (the expand request body already carries `content_item_id`).
2. Flip the color policy. Today expand FORCES color fields to null (flashcard card `background_color`, divider `color`) and the prompt tells the model to leave colors for the author. Instead, have the model emit on-brand colors: a tinted block-level `config.background_color` (softened from a brand color) for visual rhythm, plus saturated design-element colors (flashcard card backgrounds, divider colors) drawn from the brand palette. The block-level `background_color` + `padding` live in each block's `config` (that is what `BlockStyleSection` reads), so the model can include them there.
3. Loosen validation. The transform path (around line 255, the flashcard `background_color` guard; divider color guard) currently validates against a FIXED `BRAND_COLORS` set and nulls anything not in it. That will reject the lesson's actual brand hexes, which are now arbitrary. Validation must accept the fetched brand's hexes (and their tints). This is the guard on the core build path: a careless edit here breaks lesson building. Edit narrowly, keep the hex-format check, just widen the allowed-value set to the brand's colors.

Plan: edit on disk, `esbuild` check, then a rolled-back functional build test (simulate a small outline expansion, confirm valid blocks come back with brand colors, confirm zero residue), then stage to `/mnt/user-data/outputs/` for Cole to dashboard-paste, then anon-probe (OPTIONS 204, no-auth 401) after he deploys. Per-block picker still overrides AI colors (no live inheritance changed).

### 2. Phase 4b — ai-authoring-chat brand intake

Function: `ai-authoring-chat` (currently v14, ~18.5KB, verify_jwt false, MCP-deployable). Source at `/home/claude/deploy/ai-authoring-chat/index.ts`. When the user types brand guidelines in Stage-1 chat, the model proposes a brand (the 6 palette slots + optional fonts) and applies it automatically via `upsert_lesson_brand` (full-object upsert, so send the complete brand state). Confirm the chat function can call the RPC with the user's JWT context, or route through serviceClient with the actor captured. Deploy via MCP, anon-probe.

### 3. Phase 4c — AI rebrand of an existing lesson

Chat command that updates the brand object AND re-themes every existing block's stored colors (tinted background + saturated design-element) from the new brand, WITHOUT rewriting content. Needed because the no-live-inheritance model means changing the brand alone only updates the cover, not the already-built blocks. This touches stored `lesson_blocks.config` color fields across the lesson; do it as a controlled bulk update keyed off the new brand, with a rolled-back test on the test lesson first. Manual alternative already exists (Manage-mode bulk Apply Style), so 4c is a convenience layer, not load-bearing.

### 4. Tracks 3 through 6 (after Phase 4 closes)

Per the scope doc `BrainWise_Learning_Experience_and_WhiteLabel_Scope_v1.md`: T3 voiceover (ElevenLabs), T4 Synthesia video, T5 learner AI tutor, T6 visual shell. Sequence and decisions to be cut at the time.

## Decisions locked in Session 137 (recap)

Track 2 (the seven):
- Logo delivery is PUBLIC; the cover page is the logo's display home, so build order was data layer, then cover page, then per-block theming, then AI awareness.
- Storage is a dedicated `lesson_brands` table (1:1 with the lesson), not a column on `content_items`.
- Palette is 6 slots: primary, cta, surface, accent, free1, free2; pickers are presets-plus-hex.
- Keep the TRANSPARENT-by-default per-block model. NO live brand inheritance; per-block color is stored in the block's config.
- Per-block has TWO color pickers: a background picker (tinted, hex auto-softens to a tint) and a design-elements/flashcards picker (full saturated palette, raw hex).
- The table of contents shows ACTUAL TOPICS from heading blocks, on both the cover and the existing learner sidebar.
- The AI co-pilot learns lesson branding to color blocks and write the overview (Phase 4).

Phase 4 (the four):
- Brand source is a server-side fetch from `lesson_brands` by `content_item_id`.
- Flip the color policy so the AI sets on-brand colors by default; the per-block picker still overrides.
- The scaffold writes a 1 to 2 sentence overview to `content_items.description`.
- The chat proposes a brand from typed guidelines and applies it automatically via `upsert_lesson_brand`.

Phase 4c (confirmed): AI rebrand of an existing lesson re-themes every existing block's stored colors from the new brand without rewriting content.

## Open questions / things to lock in Session 138

None blocking. Two functional confirms are still pending from Cole and should be checked early:
- Phase 2: set a brand on a lesson, confirm the cover reflects it, the learner cover and sidebar show heading topics, the logo shows, and topic clicks scroll.
- Phase 4a scaffold v24: generate an outline, confirm `content_items.description` populates and the cover overview line fills.

## Bugs surfaced in Session 137 added to Build Queue

None net-new. The Pexels-ingest failure was root-caused and fixed this session (see Architecture additions). No new bugs carried forward.

## What's NOT in scope for Session 138

- Tracks 3 through 6 only begin after Phase 4 fully closes.
- No docx generation (standing Session 74 decision; `generate_docx.py` stays in the repo, never invoked).
- The expand function stays dashboard-paste; do not attempt MCP inline deploy on it (truncation).

## Architecture additions in Session 137

Data layer (Track 2 Phase 1, migration `track2_phase1_lesson_brands`, verified):
- Table `public.lesson_brands`. PK `content_item_id` FK `content_items(id)` ON DELETE CASCADE (1:1). Columns: `logo_path`; six color slots `color_primary/cta/surface/accent/free1/free2` (nullable text, hex CHECK `^#[0-9A-Fa-f]{6}$` or null = BrainWise default); `font_display_key`, `font_body_key`; `created_at/by`, `updated_at/by`. 14 columns, 6 hex CHECK constraints.
- RLS mirrors `lesson_blocks`: super-admin write (FOR ALL authenticated; WITH CHECK super_admin AND NOT is_impersonating()) and trainee read (SELECT gated through active/completed `user_curriculum_assignments` via content_items to modules to curriculum_modules).
- Public bucket `lesson-branding` + 4 storage.objects policies (super-admin insert/update/delete, public read).
- RPC `upsert_lesson_brand(p_content_item_id, p_logo_path, p_color_primary, p_color_cta, p_color_surface, p_color_accent, p_color_free1, p_color_free2, p_font_display_key, p_font_body_key)` SECURITY DEFINER, search_path public. FULL-OBJECT upsert: ON CONFLICT replaces ALL fields, so the frontend MUST send the complete brand state; null clears a field to default. Gates super_admin + NOT is_impersonating() + item_type = 'lesson_blocks'. REVOKE FROM PUBLIC, anon; GRANT authenticated, service_role. NOTIFY pgrst reload. Reads are a direct RLS-governed table select (no read RPC). No audit-log write (updated_by captures the actor, avoids the action_type FK dependency).

Frontend (Track 2 Phases 2 and 3, verified on main):
- `src/components/super-admin/lesson-blocks/lessonToc.ts` — `buildLessonToc(blocks)` returns ordered topics from heading blocks (config.text/level), accepts both id and client_id (works in learner and authoring).
- `LessonTitleCard.tsx` — cover page; reads brand via direct select; exports `lessonBrandQueryKey`; renders logo/title/overview(from description)/topic ToC; themed via inline CSS vars with BrainWise fallbacks. Mounted at the top of the learner LessonBlockViewer and the authoring canvas.
- `LessonBrandPanel.tsx` — brand editor Sheet; 6 ColorSlot pickers (presets + native input + hex + clear-to-null), font Selects, logo upload to `lesson-branding` at `${contentItemId}/logo-${Date.now()}.${ext}`; handleSave sends the FULL object to `upsert_lesson_brand`.
- `BrandColorSwatch.tsx` — gained `allowCustomHex` ("More colors" native input + validated #RRGGBB). `palette="tints"` softens custom hex via `toTint(hex, '#F9F7F1', 0.85)` before onChange; `palette="full"` uses raw hex. Custom hex enabled on all block color pickers.
- Learner `LessonBlockViewer.tsx` sidebar ToC now uses `buildLessonToc` topics.

Edge functions at end of Session 137:
- `scaffold-lesson-outline` v24 — single Anthropic call now returns a JSON OBJECT `{ overview, outline }` (no second Opus call, timeout-safe). Writes `overview` to `content_items.description` via serviceClient when non-empty (overwrites on every outline regen, intended). Response adds `overview`; `data.outline` unchanged so no frontend break. Deployed, anon-probe clean.
- `expand-lesson-from-outline` v25 — MAX_OUTPUT_TOKENS 16000, retry wrapper, max_tokens guard returns 502. Color policy NOT yet flipped (Session 138 item 1).
- `lesson-ingest-pexels-asset` v2 — root-cause fix: item_type guard was `!== "lesson"`, which rejected all real lessons (stored as `lesson_blocks`); changed to `!== "lesson_blocks"`. Pexels HEAD/fetch path confirmed clean.
- `ai-authoring-chat` v14 — added a "Lesson images" system-prompt section so Stage-1 co-pilot knows images are supported and resolved at outline-review; never declines images.

Environment notes worth keeping:
- Lessons are `content_items` with `item_type = 'lesson_blocks'` (NOT 'lesson'). This bit the Pexels guard.
- MCP `deploy_edge_function` truncates inline payloads around 25KB+ across files. Bundles up to ~18.5KB deploy fine via MCP; larger (scaffold ~28KB with shared, expand ~49KB) require dashboard-paste. A truncated bundle fails the build and leaves the prior version intact (safe).
- AI authoring functions pin model `claude-opus-4-7` (valid).
- Production `brainwiseenterprises.com` is Cloudflare-fronted, no service worker; index.html no-cache, JS bundle immutable. Cache config is correct; stale UI was browser/long-open-tab cache, not infra.

These are also recorded in architecture-reference.md (Session 137 delta).

## Test fixture state at end of Session 137

Test org: BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`).

Three test users (password in Claude's userMemories):
- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Lesson fixtures: test lesson "The Model and the Two States", content_item_id `e5c208f2-6885-482e-8d8b-8325f9cbaf5d`, item_type `lesson_blocks`. Use this lesson for the Phase 4 build tests (set a brand on it, then run expand and confirm on-brand block colors). No pending fixture cleanup.

## Documents this session leaves behind

- build-queue.md (Session 137 delta appended)
- architecture-reference.md (Session 137 delta appended)
- session-137-to-138.md (this handoff)

Markdown is the source of truth at cbastianBWE/brainwise-internal-docs. Cole uploads manually (GitHub MCP is read-only). No docx.
