# Session 98 → Session 99 Handoff

**Closing session:** 98
**Opening session:** 99
**Status:** Group H Cycle H2 Frontend Passes 2 + 3 + 5 SHIPPED + H2-MIG-8 backend migration SHIPPED. One new standing rule locked (§146). Remaining H2 frontend: Passes 6, 7, 8, Final.

---

## What shipped this session

Six Lovable build cycles + one backend migration + multiple recon round-trips. All ships type-check clean. Cole's runtime verification deferred to session close per protocol.

### Bundle A2a-1 — Step + Checklist composite pairs

NewsletterStepList + NewsletterStep + NewsletterChecklist + NewsletterChecklistItem.

- **StepList** parent uses `priority: 60` on `ol[data-newsletter-step-list]` to beat StarterKit orderedList per §144
- **Step** child uses `content: "heading block*"` so the step title is editable as a real h4 (no atom-attr title affordance gap)
- **Checklist** parent uses `priority: 60` on `ul[data-newsletter-checklist]` to beat StarterKit bulletList
- **ChecklistItem** child has `checked: boolean` attr round-tripped via `data-checked` for reader-path strikethrough without a NodeView
- **ChecklistItemNodeView** React NodeView with clickable checkbox calling `updateAttributes({ checked: !current })`, uses `NodeViewWrapper as="li"` + `NodeViewContent as="div"` + `onMouseDown preventDefault` on the checkbox button to block selection theft

§146 surfaced and locked during this bundle's plan review (see Standing rules below).

### Bundle A2a-2 — DomainGrid + IndexRow composite pairs

NewsletterDomainGrid + NewsletterDomainRow + NewsletterIndexRow + NewsletterIndexCard.

- **DomainGrid** parent has `style: "rows"|"cards"` + `show_numbers: boolean` attrs; CSS uses `[data-show-numbers="false"]` cascade to hide the number column
- **DomainRow** child is atom with 7 attrs (number, label, tag_text, tag_variant, description, count_value, count_label); ships with DomainRowNodeView (3-column grid with inline inputs + native `<select>` for tag_variant + `group/nl-dr` hover scope for trash/grip)
- **IndexRow** parent has `columns: 2|3` attr with mobile collapse to single column
- **IndexCard** child is atom with 5 attrs (tag, name, formula, note, accent_color); accent_color uses the locked palette enum `orange|forest|teal|plum|mustard|navy` matching AccentMarkAttrs from A1a per D-A5a-2
- **IndexCardNodeView** vertical-stack layout with native `<select>` for accent_color
- Tag chip styling scoped to `.newsletter-domain-row__tag--<variant>` per D-A5a-1 (no generic chip system)
- `formula` stored as null when empty per nullable schema typing

### Bundle A2b — Multi-column + reused-child composites — completes H2-FE-Pass 2

NewsletterThreeColumn + Pane, NewsletterFourColumn + Pane, NewsletterImageGallery, NewsletterStatGrid.

- **ThreeColumn / FourColumn** content-editable panes; mobile collapse breakpoints (768px to single column for 3-col; 1024px to 2x2 + 600px to single for 4-col)
- **ImageGallery** parent `content: "newsletterImage+"`, `columns: 2|3|4` + `gap` attrs
- **StatGrid** parent `content: "newsletterStatCallout+"`, `columns: 2|3|4` attr
- Per recon answer confirmed: ProseMirror permits a node type to be both `block`-group member AND named child of another node — group membership and content expressions are independent. Gallery and StatGrid reuse existing block-group atoms without schema conflict.
- Per §144, parent roots are `<section data-newsletter-image-gallery>` and `<section data-newsletter-stat-grid>` to avoid collision with `figure[data-newsletter-image]` and `figure[data-newsletter-stat-callout]` already claimed by the child atoms.
- First H2 bundle to ship without touching EDITABLE_NODE_OVERRIDES (no atoms, no new NodeViews; children's existing NodeViews handle all attr-level controls).

**H2-FE-Pass 2 = COMPLETE** — all 8 composite pairs from spec §4.13 shipped.

### Bundle A3a — 5 lower-risk refinements

Refinement attrs on Image, Embed, Callout, StatCallout, Pullquote.

- **Image**: `lightbox: boolean` (default false) + `lazy_load: boolean` (default true); render-side `loading="lazy"` on inner img tag, optional `data-lightbox="true"` cursor:zoom-in hint. UI: 2 toggle pills inserted into existing pill bar (Maximize2 + Clock icons).
- **Embed**: `aspect_ratio: "16:9"|"4:3"|"1:1"|"9:16"` (default 16:9); replaced hardcoded `aspect-video` with dynamic `aspectClass`. UI: new third field inside existing Edit URL dialog (native `<select>`).
- **Callout**: `with_icon: boolean` (default false); `::before` pseudo-element renders variant-specific unicode glyph (ⓘ / ⚠ / " / 📋 / ★ for the 5 variants). UI: new checkbox row inside existing variant dropdown panel.
- **StatCallout**: `trend: "up"|"down"|"flat"|null` (default null); renderHTML appends `<span class="newsletter-stat-callout__trend--{trend}">` after value, CSS renders ↗/↘/→ glyphs. UI: NEW inline 4-button row between value and label (TrendingUp/TrendingDown/Minus/X icons).
- **Pullquote**: `alignment: "left"|"center"|"right"` (default center); CSS applies text-align + margin-auto. UI: NEW hover-strip pill bar (first attr toolbar on Pullquote — modeled on Image's width pill pattern).

Pattern locked: when adding refinement attrs to nodes with existing NodeViews, surface in the existing chrome (pill bar / dropdown / dialog / inline). When no chrome exists (Pullquote), introduce a NEW hover-strip pill bar modeled on Image's convention. This brings divergent NodeView UIs toward a single hover-strip-with-pills standard.

### Bundle A3b — completes H2-FE-Pass 3

Refinements on TwoColumn, KeyMoments, codeBlock. Higher-risk because of new top-level package install + StarterKit configure change.

- **Package install**: `@tiptap/extension-code-block@^3.23.0` (matching other @tiptap/* deps)
- **StarterKit override mechanics** verified pre-build via source check: `StarterKit.configure({ codeBlock: false })` entirely omits CodeBlock from the extensions array (not stubbed). No duplicate-name conflict.
- **NewsletterCodeBlock standalone**: defined in buildExtensions.ts via `CodeBlock.extend({ addAttributes() { return { ...this.parent?.(), filename, highlight_lines } } })` — spread `...this.parent?.()` preserves the built-in `language` attr. Exported from buildExtensions.ts so NewsletterEditor.tsx can import it for §146 NodeView wiring. Registered AFTER StarterKit + TextStyle + Link + Placeholder, BEFORE NewsletterImage.
- **TwoColumn**: `gap: "tight"|"normal"|"wide"` (default normal). Previously had ZERO attrs — `NewsletterTwoColumnAttrs` interface created from scratch and union variant updated.
- **KeyMoments**: `numbered: boolean` (default true) + `accent_color: KeyMomentsAccentColor` (locked palette).
- **codeBlock**: `filename: string|null` + `highlight_lines: string|null` (plus `language` preserved from StarterKit).
- **NodeView edits**: TwoColumnNodeView gets hover-strip pill bar (Tight/Normal/Wide) + dynamic gapClass replacing hardcoded `gap-8` Tailwind class. KeyMomentsNodeView gets NEW always-visible control row at top (Numbered toggle + 6 accent color swatches with white-inner-ring + colored-outer-ring selection state).
- **NEW NodeView CodeBlockNodeView**: NodeViewWrapper as="div" with border-slate-200 rounded-md wrapper, filename input + native language select (13-option curated list), highlight-lines input, code body via NodeViewContent.
- **§146 wiring for codeBlock** (Option-W2): NewsletterCodeBlock re-exported from buildExtensions.ts, NodeCodeBlockEdit defined in NewsletterEditor.tsx, appended to EDITABLE_NODE_OVERRIDES. Existing useMemo extension swap-by-name picks it up under name `"codeBlock"` since NewsletterCodeBlock inherits the name from CodeBlock.extend().
- Visual line painting for `highlight_lines` deferred — schema-only. No syntax-highlighting library installed (matches spec §4.7 phase-2 framing).

**H2-FE-Pass 3 = COMPLETE** — all 8 refinements shipped.

### H2-MIG-8 backend migration — newsletter audio + ImageCompare support

Applied to svprhtzawnbzmumxnhsq via Supabase MCP `apply_migration` as `session98_h2_mig_8_newsletter_audio_imagecompare_ref_field_support`. All verifications pass post-apply.

**Three changes:**

1. **`request_asset_upload` RPC** expanded:
   - Newsletter ref_field whitelist expanded from `('cover', 'og_image', 'inline_image')` to include `'inline_audio'`, `'inline_image_compare_before'`, `'inline_image_compare_after'`
   - Image-only asset_kind gate replaced with ref_field-correspondence check (image ref_fields require asset_kind=image, inline_audio requires asset_kind=audio)
   - Function recreated via DROP+CREATE (signature unchanged, body logic only)

2. **`storage.buckets` row for `newsletter-article-images`** updated:
   - `allowed_mime_types` expanded from 4 image types to 11 types (added image/svg+xml + image/avif to align with `_asset_kind_mime_allowed('image')`; added 5 audio MIMEs `audio/mpeg`, `audio/wav`, `audio/webm`, `audio/ogg`, `audio/mp4` to match `_asset_kind_mime_allowed('audio')`)
   - `file_size_limit` raised from 10MB to 100MB (matches `_asset_kind_size_ceiling('audio')`)
   - Bucket name preserved despite being misnamed for the expanded purpose — bucket rename + row migration deferred to a future cleanup pass

3. **Per §140** — defensive triple grant pattern applied (`REVOKE FROM PUBLIC`, `REVOKE FROM anon`, `GRANT EXECUTE TO authenticated, service_role`). Verified post-apply.

**Pre-flight recon caught two blockers** that would have hidden until runtime: the hardcoded image-only asset_kind gate inside `request_asset_upload`, and the bucket-level MIME/size restrictions that would have rejected audio uploads even if the RPC accepted them. Both addressed in this single migration.

**Latent issue surfaced (not fixed):** `_walk_tiptap_for_image_asset_refs` walker targets `node ->> 'type' = 'image'` (NOT `newsletterImage`). The `_rebind_newsletter_article_asset_refs` RPC is either unused or doesn't currently pick up newsletterImage doc nodes. Live `content_asset_refs` table confirms all 8 newsletter inline_image refs have literal `ref_field = 'inline_image'` (the direct path from `request_asset_upload`), NOT the path-based `body.image[...]` format the walker would produce. Flagged as a future cleanup item — doesn't block A5c/A5d work since the direct upload path creates correctly-formatted ref rows.

### Bundle A5a — Math + Terminal + CodeDiff + Chart (Pass 5 Tier 1 schema-only-rendering)

4 atoms with text-input NodeView editors. No rendering libraries installed (KaTeX, chart.js, syntax highlighters all deferred to phase 2).

- **Math**: atom with `latex: string` + `display: "inline"|"block"`. MathNodeView follows CodeBlockNodeView pattern (display-mode pill toggle + textarea for LaTeX source + monospace fallback preview). Rendered HTML emits `<code class="newsletter-math__source">{latex}</code>` for readable plain-HTML export.
- **Terminal**: atom with `commands: TerminalCommand[]` + `theme: "dark"|"light"`. Uses JSON-via-data-attribute serialization matching Byline's pattern. TerminalNodeView uses full BylineNodeView pattern (dnd-kit DndContext + PointerSensor distance:4 + SortableContext + useSortable per row + idsRef parallel UUID array + localCommands buffer + shared debounceRef + flushDebounce + always-keep-one invariant).
- **CodeDiff**: atom with `before_text` + `after_text` + `language` + `filename`. CodeDiffNodeView with filename input + language select (13-option list reused from CodeBlock) + 2 side-by-side textareas. Reader: red-tinted BEFORE pane + green-tinted AFTER pane, mobile collapse at 640px.
- **Chart**: atom with `chart_type: "line"|"bar"|"pie"|"donut"|"area"|"image"` + `data_json: string` + `caption: string|null`. ChartNodeView with chart_type select + JSON config textarea + caption input. Reader emits placeholder block with chart-type label + "Chart rendering ships in phase 2" hint.

**New slash menu category "TECHNICAL"** introduced — SlashCommandItem type extended from `"BASIC"|"EDITORIAL"|"MEDIA"|"LAYOUT"` to include `"TECHNICAL"`. 4 new slash items in TECHNICAL: Math (Calculator), Terminal (Terminal), Code diff (GitCompare), Chart (LineChart).

### Bundle A5b — Table install (Pass 5 Tier 2)

- **Package install**: `@tiptap/extension-table@3.23.6` (single package exports 4 node classes — Table, TableRow, TableHeader, TableCell). No additional packages needed.
- **Configuration**: `NewsletterTable = Table.configure({ resizable: false, HTMLAttributes: { class: "newsletter-table" } })`. Column-resize handles disabled (not an editorial requirement, adds chrome). TableRow/TableHeader/TableCell registered as defaults.
- **No StarterKit collision** verified pre-recon — StarterKit ships paragraph/heading/blockquote/etc. but NOT Table.
- **Bubble menu `shouldShow` relaxed** to allow `from === to` when `editor.isActive("table")` — critical so table action buttons appear on caret-inside-table without text selection.
- **Bubble menu default-mode body extended**: `isInsideTable = editor.isActive("table")` computed per render; when true, appends conditional 8-button table action row to the existing default mode. 8 buttons grouped as `[row ops | column ops | table ops]`: addRowBefore/After, deleteRow, addColumnBefore/After, deleteColumn, toggleHeaderRow, deleteTable. mergeCells/splitCell intentionally skipped per D-A5b-3.
- Per recon: table commands are immediate-action buttons appearing automatically inside a cell — NOT a discriminated-union Mode variant. The existing selectionUpdate listener ensures `editor.isActive("table")` recomputes correctly on cursor move.
- **Slash menu Table item** in TECHNICAL category — seeds 3×3 table with header row via `insertTable({ rows: 3, cols: 3, withHeaderRow: true })`. Table icon imported as `TableIcon` to avoid name collision with the registered Table node class.
- **No NodeViews, no EDITABLE_NODE_OVERRIDES additions** — @tiptap/extension-table ships its own contentEditable behavior; bubble menu handles all attr-level controls.

### Bundle A5c — Audio (storage-coupled)

First storage-coupled node in Group H. Leverages H2-MIG-8 applied earlier this session.

- **Refactor**: `uploadNewsletterImage` → `uploadNewsletterAsset({ kind: AssetKind, file, articleId, refField?, onProgress? })`. Per-kind MIME whitelist + size ceiling + default ref_field lookup tables. AssetKind = `"image" | "audio"` exported type. Both existing callers (ImageNodeView, NewsletterToolbar) updated to pass `kind: "image"` explicitly. Old `uploadNewsletterImage.ts` deleted.
- **URL resolution hook**: `useNewsletterImageUrl` → `useNewsletterAssetUrl` aliased — same signed URL flow works for both kinds since H2-MIG-8 keeps both in the same bucket.
- **NewsletterAudio** atom with 4 attrs: `asset_id`, `title`, `duration_seconds`, `transcript_url`. Renders `<figure data-newsletter-audio>` wrapping `<audio controls preload="metadata">` + optional `<figcaption>` + optional transcript link.
- **AudioNodeView** mirrors ImageNodeView's upload dropzone pattern (clickable empty-state box with Music icon, hidden file input with `accept="audio/*"`, uploading spinner). Filled state shows native `<audio controls>` + title input + duration display + transcript URL input.
- **Auto-duration detection**: attaches `loadedmetadata` listener to `<audio>` element, reads `event.target.duration`, rounds to integer seconds, calls `updateAttributes({ duration_seconds })`. Handles `duration === Infinity` edge case (some WebM/streaming MP3 profiles) via seek-to-end trick (`audio.currentTime = 1e10` then one-shot `timeupdate` listener).

### Bundle A5d — ImageCompare (completes Pass 5)

Last node in Pass 5. Most novel interaction work in Group H to date.

- **NewsletterImageCompare** atom with 5 attrs: `before_asset_id`, `after_asset_id`, `before_label`, `after_label`, `default_position` (0-100, default 50). Two image uploads via the new `inline_image_compare_before` and `inline_image_compare_after` ref_fields (per H2-MIG-8).
- **ImageCompareNodeView** combines TWO upload dropzones (mirroring ImageNodeView's pattern per side) + a draggable slider divider. Empty state shows side-by-side dropzones; filled state shows overlaid images with draggable divider.
- **Drag implementation**: `onPointerDown` + `setPointerCapture` + window-level `pointermove`/`pointerup` with cleanup. Deviates from codebase's onMouseDown convention — pointer events handle touch + mouse + pen uniformly, which matters for drag specifically (codebase's onMouseDown uses elsewhere are click-time selection guards where touch parity is irrelevant).
- **Keyboard accessibility**: `role="slider"`, `aria-valuemin/max/now`, arrow-key handling with shift for 10× step, Home/End for 0/100.
- **Position state** committed to `default_position` attr on drag-end and on each key press (not on every drag-move — would generate too many transactions).
- **Reader rendering** is static at `default_position` (per D-A5d-2 — no hydration script, no drag in reader). CSS variable `--ic-position` set inline via `style` attribute on the viewport div; clip-path on the after image creates the masking effect.

**H2-FE-Pass 5 = COMPLETE** — all 7 nodes shipped.

---

## Standing rule locked Session 98

### §146 — Newsletter TipTap schema module is headless; React NodeViews wired via EDITABLE_NODE_OVERRIDES in NewsletterEditor.tsx

The `src/components/newsletter/tiptap/` module is consumed by three callers: the editor (`editable: true`), the G6 read-only public reader (`editable: false`), and the `convert_html_to_tiptap` Edge Function (server-side via JSDOM). The Edge Function and reader cannot tolerate React imports in the schema module — Edge Function runs in Deno without a DOM, reader bundles into the public-facing route where pulling unnecessary React tree weight is wasteful.

Pattern: `Node.create()` in `tiptap/nodes/` stays headless (no `addNodeView()`). For any node needing a React NodeView, define a `.extend({ addNodeView() { return ReactNodeViewRenderer(View); } })` wrapper in `NewsletterEditor.tsx` and add it to the `EDITABLE_NODE_OVERRIDES` array. The editor's `useMemo` over extensions then swaps each base node for its wrapped equivalent by name (OVERRIDE_NAMES Set membership check).

Pattern documented inline in NewsletterEditor.tsx header comment (lines 20-23 as of Session 98). NEVER put `addNodeView()` directly on a Node.create() definition in `tiptap/nodes/`.

**Discovered Session 98 during A2a-1 plan review** when initial build prompt for ChecklistItemNodeView wired `addNodeView()` on the headless NewsletterChecklistItem definition; corrected before any code shipped. Pattern was implicit in NewsletterEditor.tsx header but not yet §-numbered.

Pairs with §143 (atom + NodeView ship discipline) — §143 dictates timing (same cycle), §146 dictates wiring location (editor module, not schema module).

---

## Active deferred items

Carried forward unchanged from Session 97 unless noted:

- AIRSA Phases 3e-8
- `results_available` notification firing point wiring
- AIRSA facet-interpretation generation gap
- Messaging subsystem prerequisite for `coach_messages` notification type
- `platform_updates` notification type
- Module reorder gap
- MFA trusted-device
- Editor thumbnail-loss-on-republish
- Coach-paid invitation email verification
- `create-checkout` graceful degradation
- SOC 2 written policies
- Action-Oriented Voice Redesign
- Pricing-reads refactor
- Corporate contract renewal schema change
- Clarity Engine
- Session 71 anon EXECUTE audit
- `coach_clients_client_view` SECDEF refactor
- `results_available` NAI/AIRSA/HSS coverage
- `users.last_active_at` infrastructure
- `user_ui_preferences` dedicated table
- Bulk Phase 11 v2
- `/super-admin/coaches` consolidation
- Members Surface v2 polish
- Mentor Portal v2 MQ-1 through MQ-4
- G3 SEO/AEO infrastructure + RSS combined pass
- G9 RSS feed
- `newsletter_categories` v2
- Internal subscriber inclusion (G8)
- Author bio edit UI (backend ready post-H2-MIG-6; frontend pending, not blocking)
- **NEW: Newsletter asset-ref rebind walker mismatch** — `_walk_tiptap_for_image_asset_refs` walker targets `node ->> 'type' = 'image'` not `newsletterImage`. The rebind RPC is unused in current flow. Cleanup: either fix walker to match newsletterImage node type OR remove the unused rebind RPC. Surfaced during H2-MIG-8 recon, not blocking but should be addressed before any future code starts relying on the rebind path.

### Pass 8 Poll node — backend prerequisite

Pass 8 (Poll TipTap node) needs a precursor backend migration before Session 99 can ship it. The 5 existing poll RPCs (create/update/archive/vote/get_results) are all keyed by `p_poll_id`. There's no `list_admin_polls` RPC for the super-admin authoring UI to pick from. Session 99 opens with this as the first deliverable in Pass 8 work (H2-MIG-8 carried that scope but only for audio/ImageCompare ref_fields; the `list_admin_polls` work is a separate migration, e.g. H2-MIG-9).

---

## What Session 99 should open on

Per spec §4.13, remaining H2 frontend:

**H2-FE-Pass 6** — 4 article-end nodes: FooterMeta, AuthorBio, Citations, FurtherReading.
- **FooterMeta** — tags chip array + issue label. Auto-render from article fields when `is_issue_based=true` (reader auto-render hook is H3 work, but the body node ships here).
- **AuthorBio** — depends on `users.bio` column shipped in H2-MIG-6 (Session 96). Backend ready, frontend pending.
- **Citations** — numbered list with entries array.
- **FurtherReading** — external links list.

**H2-FE-Pass 7** — 6 interactive/social nodes: CTA, SubscribeBlock, RelatedArticles, Disclosure, Definition, FootnoteRef + Footnotes.
- **CTA** — simple button block (variant primary/secondary/ghost, label, url, tracking_id).
- **SubscribeBlock** — reuses existing G6 SubscribeForm component.
- **RelatedArticles** — needs `list_admin_newsletter_articles` filter + auto-by-tags/category modes (backend coupling).
- **Disclosure** — collapsible details/summary.
- **Definition** — inline term + definition pair (inline mark + card variant).
- **FootnoteRef + Footnotes** — paired mark + block system. Auto-numbering logic. Highest complexity in Pass 7.

**H2-FE-Pass 8** — Poll TipTap node (after H2-MIG-9 list_admin_polls migration).

**H2-FE-Final** — wireup cleanup: buildExtensions.ts final pass, tiptapDocToPlainText.ts node-type extensions for all Session 98 + 99 additions, final newsletter-prose.css pass.

**Reasonable Session 99 scope:** Pass 6 + part of Pass 7 likely. Pass 8 + Pass 7 finish + Final probably need Session 100. Cole's "do everything in one session" preference is great for momentum but be realistic about the FootnoteRef auto-numbering complexity and the RelatedArticles backend coupling.

---

## Session 98 totals

- **6 Lovable build cycles** (A2a-1, A2a-2, A2b, A3a, A3b, A5a, A5b, A5c, A5d — actually 9 cycles, plus recon round-trips). Re-counted: 9 build cycles + ~9 recon round-trips.
- **1 backend migration** (H2-MIG-8) applied to svprhtzawnbzmumxnhsq + verified
- **2 new top-level packages** installed: `@tiptap/extension-code-block@^3.23.0` (A3b), `@tiptap/extension-table@3.23.6` (A5b)
- **15 new node files** in `tiptap/nodes/`: StepList, Checklist, DomainGrid, IndexRow, ThreeColumn, FourColumn, ImageGallery, StatGrid, Math, Terminal, CodeDiff, Chart, Audio, ImageCompare (StepList exports 2 from one file, etc. — count is files, some files export multiple nodes)
- **10 new NodeView files** in `tiptap/nodeviews/`: ChecklistItemNodeView, DomainRowNodeView, IndexCardNodeView, CodeBlockNodeView, MathNodeView, TerminalNodeView, CodeDiffNodeView, ChartNodeView, AudioNodeView, ImageCompareNodeView
- **Multiple existing NodeView edits** for Pass 3 refinements (Image, Embed, Callout, StatCallout, Pullquote, TwoColumn, KeyMoments)
- **One new slash menu category** "TECHNICAL"
- **One new standing rule** locked (§146)
- **All ships type-check clean**

Cole runtime verification will happen on review of this batch. Future sessions assume Session 98 ships are working.

---

## Session 98 close artifacts

- This `session-98-to-99.md` handoff
- `build-queue.md` v104 (Session 98 ship narrative)
- `architecture-reference.md` v100 (adds §146)

Three markdown files for Cole to upload to `cbastianBWE/brainwise-internal-docs` via GitHub web UI drag-and-drop.
