# BrainWise Build Queue


*v68 - Session 64 CLOSE — Prompt 6b complete end-to-end for 5 new block types (stat_callout, statement_a_b, accordion, tabs, button_stack). Both Concern A (§61, full block parity) and §64 (backend-frontend ordering) discipline applied successfully: Session 63 shipped backend, Session 64 shipped frontend in 3 sequential prompts (6b.1 + 6b.2 + 6b.3) plus one surgical follow-up (6b.4). Backend AI prompt-tightening deployed mid-session via 3 Edge Function bumps (scaffold-lesson-outline v4→v5, expand-lesson-from-outline v4→v5, draft-lesson-block v5→v6) addressing two AI bugs: (1) AI was producing degenerate 1-item accordions and 1-tab tabs blocks; (2) AI was padding outlines with extra blocks when user named specific block types. Fix: request-aware specificity rule in scaffold + CRITICAL min-2 rule in expand+draft schema hints + defensive pad-to-2 backstop in transformConfigForCanvas. Confirmed working in production post-deploy: AI now produces 3-tab + 3-section blocks where pre-deploy was 1-item degenerates. button_stack schema gains optional `caption` field for instructional subtitle text below buttons. Two new standing rules locked (architecture-reference §65 + §66). DB verification PASS: all 5 new types saving correctly with valid canvas-shape configs on test fixture 32e0e966. **Session 65 opens with two priorities pulled forward**: (1) **Priority 0 fix** — button_stack URL normalization bug. Link buttons with user-typed URLs lacking a scheme (e.g. "google.com") render as `<a href="google.com">` which the browser treats as a relative path and prepends to current location, producing wrong URLs like `https://brainwiseenterprises.com/super-admin/content-authoring/lessons/google.com`. Fix at render time in BlockRenderer.tsx's ButtonStackRender: if url is non-empty and lacks `http://`, `https://`, or leading `/`, prepend `https://`. Small surgical Lovable prompt — ~5K chars. (2) **Gate-button action_type** — PULLED FORWARD from Phase 5 to Session 65 alongside 6c. Cole requested it ship next session as a separate Lovable prompt from 6c. Adds a third action_type to button_stack: `gate_to_next` (or similar name TBD) that progresses trainee through structured lesson stages. Open design questions to resolve at Session 65 open: what minimum progression behavior (scroll-to-next-heading vs actual completion tracking)? requires new DB schema (e.g. lesson_progress table) or pure UI navigation? naming (gate_to_next / continue / advance)? separate action_type value vs link with special URL pattern? interaction with siblingBlocks Select for jump_to_block? Likely small scope independent of 6c — sequencing decision (gate-button before or after 6c) made at Session 65 open. (3) Prompt 6c — flashcards / scenario / knowledge_check (the 3 remaining block types from v1 catalog of 17, completing the whitelist). Block-by-block design decisions needed first: flashcards (front/back shape, flip animation, card navigation, completion criteria); scenario (branching graph vs linear, resolution shape, storage structure, revisit behavior); knowledge_check (likely smaller, may overlap with Phase 4 quiz authoring). Concern A applies — 5 touchpoints × 3 types = 15 code changes, may split into multiple Lovable prompts within Session 65. (4) After 6c ships, frontend block-type whitelist hits 17 of 17 v1 catalog, Edge Function ALLOWED_BLOCK_TYPES extended in parallel, Concern A closed for entire v1 block catalog.*

*v67 - Session 63 IN-PROGRESS — Prompt 6b backend SHIPPED for 5 of 7 new block types: stat_callout, statement_a_b, accordion, tabs, button_stack. flashcards + scenario explicitly deferred to Prompt 6c on design-complexity grounds (flashcards flip-animation engineering nontrivial; scenario v1-minimum 1-context+1-decision+1-resolution is a degenerate-branching shape and warrants its own scoping — proper branching has graph-not-list data shape). Three Edge Functions redeployed: scaffold-lesson-outline v4 (ALLOWED_BLOCK_TYPES extended 9→14, plus a new "Block type intent guide" section in system prompt teaching AI when to pick stat_callout vs callout, statement_a_b vs two adjacent text blocks, accordion vs separate sections, tabs vs separate blocks, button_stack vs in-prose links), expand-lesson-from-outline v4 (ALLOWED_BLOCK_TYPES + BLOCK_SCHEMA_HINTS + transformConfigForCanvas() each extended with 5 new cases; AI output → canvas-shape conversion handles server-generated client_ids for accordion items + tab entries + button_stack buttons; button_stack jump_to_block actions always emit target_block_client_id:null from AI since AI doesn't have block ids — author wires jump-target in the form before save), draft-lesson-block v5 (BLOCK_SCHEMAS + transformConfigForCanvas() same five-case extensions for single-block AI authoring including canvas Refine-with-AI). All three deployed with verify_jwt:false (custom auth via getClaims inside Edge Function body, per Class A pattern). _shared modules unchanged (impersonation_gate.ts, markdown_to_tiptap.ts, length_guidance.ts byte-identical to v3/v3/v4). Anon probe (POST without auth header) returns HTTP 401 missing_bearer_token on all three — clean. Frontend NOT YET SHIPPED — Lovable prompt drafted (1,514 lines, internal-docs/prompt-6b-five-block-types.md) covering 6 modified files (blockTypeMeta.ts adds 5 BlockType union entries + 5 BLOCK_TYPE_META.defaultConfig entries with universal background_color:null+padding:"none" inheritance; BlockEditorPane.tsx adds 5 dispatch cases + siblingBlocks prop; EditorSlidePane.tsx adds siblingBlocks pass-through; BlockRenderer.tsx adds 5 renderInner cases + 5 sub-Render components + data-block-client-id attribute on outer wrapper for button_stack jump targets; lesson-blocks.css adds 5 block-type-specific class groups; LessonBlocksEditor.tsx adds siblingBlocks={blocks} at EditorSlidePane callsite) + 5 created BlockForm files (StatCalloutBlockForm with live-preview of the stat as author types; StatementABBlockForm with side-by-side card preview mirroring trainee render; AccordionBlockForm copying ListBlockForm @dnd-kit reorder pattern with Enter-to-add-section keyboard shortcut; TabsBlockForm with 2-6 tab limit + reorder-aware default_tab adjustment; ButtonStackBlockForm with siblingBlocks dropdown showing friendly per-block-type labels for jump targets). Concern A (§61) discipline: backend is currently AHEAD of frontend. AI could propose these 5 types in outlines and generate them in full content, but BlockRenderer doesn't yet have render cases and the blocks would save fine in DB but render as null. Mitigated by limited test surface (only super_admin cbastian has access; production has no other authors). Will be resolved when Lovable executes the Session 63 frontend prompt. UX bar for the 5 new types: explicitly aimed at exceeding Rise/Articulate — live-preview stat rendering as author types (Rise has no live preview), jump-to-block dropdown with content-derived friendly labels (Rise only does external links), 2-tab minimum and 6-tab maximum enforced in form (Rise allows unlimited tabs but UX-degrades past 5), accordion type="multiple" for compare-multiple-sections-at-once (Rise defaults type="single" and forces close on open). Test fixture 32e0e966 at Session 63 mid-point: stage='chat', length_preference='detailed', 10 active lesson_blocks across 5 existing block types (heading, text, callout, text, heading, text, list, quote, text, callout) — unchanged from Session 62 close-1-day-later state. No new tables. No migrations. Standing rule §64 added (architecture-reference): backend-frontend ordering for block_type additions — when block parity (§61) cannot complete in one session, prefer backend-ahead-of-frontend over frontend-ahead-of-backend. Backend-ahead means AI may produce blocks that save but don't render (visible bug, easy to spot). Frontend-ahead means the form/renderer exists for a type that the AI can't produce — silent capability gap that's harder to detect. Both are temporary; both close when the matching half ships. Backend-ahead is the safer transient state because rendering failures surface immediately whereas missing AI generation surfaces only when someone tries a workflow that doesn't exist.*

*v66 - Session 62 CLOSE — Prompt 6a-AI staged AI authoring SHIPPED end-to-end + Tier 1 length-preference selector SHIPPED + critical doc-TTL RPC bug fixed + Session 63+ direction LOCKED: complete Group C v1 in order (6b → 6c → quiz authoring → mentor assignment → direct curriculum assignment → trainee learning UI → mentor review UI → actor flow → Order Assessment gating → Resources tab redesign → Phase 10 polish). AI authoring panel is feature-complete for v1 across 9 block types. Final Edge Function versions: ai-authoring-chat v2, scaffold-lesson-outline v3, expand-lesson-from-outline v3, draft-lesson-block v4. New shared modules: _shared/length_guidance.ts (resolveLength + 3 guidance generators, one per surface), _shared/markdown_to_tiptap.ts (mdToTipTap converter with bold/italic/link mark support + hardBreak insertion). Schema: ai_authoring_conversations.length_preference text column with CHECK (concise|standard|detailed), default 'standard'. Two RPCs updated: upsert_ai_authoring_conversation now 11-param with p_length_preference text DEFAULT 'standard' (DROP-then-CREATE migration since add-with-default would have caused PostgreSQL overload ambiguity for existing 10-param callers), get_ai_authoring_conversation now returns 13 columns including out_length_preference. Critical production RPC bug fixed: delete_ai_authoring_conversation was silently force-expiring all session documents for the content_item when the conversation was deleted (typically via Start over), violating the documented rule that docs should outlive any single conversation. Original buggy logic: `UPDATE ai_authoring_session_documents SET expires_at = now() - interval '1 second' WHERE content_item_id = p_content_item_id AND author_id = v_caller_id AND expires_at >= now()`. Fix: removed the doc-expiry update entirely. Return signature preserved (out_documents_deleted always returns 0 going forward; frontend handles gracefully). One-time data fix applied to victim row e3497657-aaf6-49eb-8431-6982119e301b (un-expired with expires_at = last_accessed_at + 14 days). Session shipped 4 Lovable prompts total: prompt-6a-ai (initial 580-line build), prompt-6a-ai-fix1 (247-line surgical fix covering 4 bugs: Generate outline button hidden / Stage2Outline single-line Input / handleBuild stale-closure on flushNow / Stage4Built missing Save warning), prompt-6a-ai-fix2 (374-line Tier 1 length selector covering 7 files), prompt-6a-ai-fix4 (Lovable-diagnosed 4-file layout fix swapping `flex h-full flex-col` to `flex flex-1 min-h-0 flex-col` on all stage component roots). Cost-benefit reflection: 4 follow-up prompts for one feature signals the original 6a-AI prompt under-specified UX details; logged as lesson — future sub-prompts of this scope should get explicit visual checks of (a) all panel-bottom CTAs at common viewport sizes, (b) all input fields against text-wrap behavior, (c) all multi-stage flows with at-least-one Build/Save persistence to DB before declaring backend layer done. End-to-end production verification clean: 12 lesson_blocks committed to canvas with valid TipTap configs across 5 block types, audit log shows length:detailed correctly propagated to all four Edge Functions across two full Start-over cycles, conversation row state persists stage='built' (Bug 3 stale-closure fix verified). Three concerns locked as standing rules (architecture-reference §61, §62, §63): **Concern A — block parity discipline** (any session adding/modifying block_types must update 5 points in same session: ALLOWED_BLOCK_TYPES in 2 Edge Functions + BLOCK_SCHEMAS/HINTS + transformConfigForCanvas + frontend block-form component + BlockRenderer switch + blockTypeMeta entry); **Concern B — AI surface area discipline** (future AI authoring surfaces — assessment items, coach comms, report templates, in-lesson AI explainer chat in trainee UI, etc. — get separate Edge Functions, not retrofits of the existing AI panel; the 6a-AI Edge Functions are specialized for lesson-block authoring); **AI session close-out verification** (any session touching AI content generation runs a mandatory backend verification SQL pass at close — conversation row stage progression, lesson_blocks canvas validity, audit log entries, doc TTL extensions). Plus three new standing rules surfaced in Session 62: **Flex column rule for fixed-position panels** (§58 — child stages of a fixed top:X bottom:0 flex flex-col aside must use `flex flex-1 min-h-0 flex-col` not `flex h-full flex-col`; h-full ignores siblings and overflows; flex-1 + min-h-0 takes remaining space and allows nested overflow-y-auto to engage; applies to AI panel stages, side-drawers, modals with scrollable content, any flex-column with header + scrollable body + footer); **flushNow override pattern** (§59 — hooks wrapping debounced auto-save must expose flushNow(overrideState?: Partial<State>) so callers can bypass stale closure when new state hasn't propagated to stateRef yet; pattern: `await persistence.flushNow({ stage: "built" })` before navigating away); **localStorage sticky-per-content_item convention** (§60 — localStorage keys for AI authoring use `ai-authoring:<scope>:<contentItemId>`; scope-then-id ordering enables prefix-scans by scope). **Session 63+ trajectory LOCKED: complete Group C v1.** Group C v1 is the largest single workstream remaining and is the gating dependency for coach certification, the Resources tab redesign, and the trainee learning UI. Per Group C scope §9 success criteria the work is not done until: a new coach can be invited → enroll → complete every content item type → receive certified status via UI; a mentor can review submissions; super admin can author a complete cert path; super admin can revoke certifications with audit; 14 v1 notification types fire correctly; Order Assessment gating works; Resources tab redesigned; trainee can use free_assessment_uses allotment to invite actors; Build Queue items 31, 32, 33, 35, 37, 38 are closed. Session-by-session sequence locked Session 62 close: **(63) Prompt 6b — 7 remaining lesson block types** (stat_callout, statement_a_b, tabs, flashcards, accordion, button_stack, scenario). Concern A applies: 5 touchpoints × 7 block types = 35 distinct code changes in one session (may split frontend portion across 2-3 Lovable prompts but all 35 touchpoints MUST land same session). Visual design spec lock required per block type before prompt write. **(64) Prompt 6c — knowledge_check block.** Smaller than 6b. Closes out the lesson-block side of Phase 4 authoring. **(65+) Phase 4 quiz authoring** — full question bank + 5 question formats (multiple choice / true-false / select all that apply / match definition / match picture), pass threshold + retake config + show-correct-answers mode per Group C scope §3 Q2. Broader than 6c's knowledge_check block — the block embeds in lessons, the quiz authoring infrastructure powers reusable question banks. New tables likely needed: quiz_questions, quiz_answer_options, quiz_attempts. **(next) Phase 4 mentor assignment UI** — super admin assigns mentor to trainee. Backend likely supports this already (coach_mentor_assignments table from earlier Group C work). **(next) Phase 4 direct curriculum assignment UI** — super admin direct-assigns curriculum to user (bypassing cert path enrollment per Q4C source='direct_assignment'). **(next, large) Phase 5 trainee learning UI** — replace placeholder /certifications page with full LMS experience. My Learning landing + cert path detail + curriculum detail + module detail + per-item viewers for all 7 content item types (video with watch-progress, quiz interface, written summary editor, skills practice with sign-off, file upload, external link, live event stub). Largest single phase. BlockRenderer is the canonical renderer reused here — any new block type added in 6b/6c MUST add render path to BlockRenderer.tsx per Session 60 standing rule. Per Concern B, if AI tooling is added here (e.g., AI explainer chat alongside a video), it gets separate Edge Functions, not a retrofit of the 6a-AI panel. **(next) Phase 6 mentor review UI** — /mentor/queue (pending reviews list), review detail page with full submission context + attempt history + comment field + approve/revise actions, /mentor/trainees (assigned trainees with progress overview), trainee progress page. **(next) Phase 7 actor flow** — skills practice items wired to existing client invitation flow with three differentiators (allotment-based pricing using free_assessment_uses, no-subscription actor account, certification metadata tag). Regression risk on standard coach-paid client invitations per Group C scope §8.1; mandatory regression test before merge. **(next) Phase 8 Order Assessment gating** — Build Queue Item 37: CoachClients.tsx gates Order Assessment by certification_type (PTP-only certified → only PTP; AI Transformation certified → NAI/AIRSA/HSS; Combined → anything) and revocation status. **(next) Phase 9 Resources tab redesign** — Q10 decision: overview landing → category sub-pages with 5 v1 categories. Migrate existing resources into new category structure. Preserve audience tag visibility rules. **(final) Phase 10 polish** — empty states for all new screens, loading skeletons, error boundaries on RPC calls, notification preferences UI at /settings/notifications, bell icon + notification dropdown in main nav, /notifications full page, audit log integration verification, brand styling pass on all new screens (Navy/Orange/Sand/Teal palette compliance + 8-color BrandColorSwatch where applicable), accessibility baseline (focus order, keyboard nav, screen reader labels). After Group C v1 ships per success criteria, queue order returns to: Group E remaining (deployment readiness items still pending), then Group D OR Group A based on customer feedback, then Groups A and B last. **AI authoring polish bundle** (deferred — not blocking Group C completion, opportunistic pickup any time AI authoring is being touched during 6b/6c integration work): duplicate-file upload handling (backend dedupe in upload-ai-authoring-doc + frontend Replace/Keep both/Skip dialog), AI authoring console-noise cleanup (TipTap Duplicate Link extension warning + Blocked aria-hidden on slide-pane focus race), Regenerate-from-scratch button on Stage 2 outline (missing affordance), TTL hardening CHECK constraint on ai_authoring_session_documents (expires_at >= uploaded_at + interval '7 days' to prevent regression). Test fixture content_item 32e0e966-4cb8-4e8b-abf8-5617de346f59 ends Session 62 with 12 active lesson_blocks across 5 block types, 1 ai_authoring_conversations row at stage='built' with length_preference='detailed' and 10 ready-to-commit blocks in full_content_state, 2 live ai_authoring_session_documents both `MODULE 1 - Bias.docx` (duplicates from session testing) at 14-day TTL, 1 dead doc row pending daily reaper purge.*


*v65 - Session 61 CLOSE — three Lovable prompts shipped end-to-end clean: (A) Prompt 6a-style — per-block background color + padding, (B) Prompt 6a-manage — multi-select + Manage Blocks sidebar + bulk operations, (C) Prompt 6a-manage-multidrag — multi-block drag-and-drop with DragOverlay. Zero backend changes across all three. Zero new dependencies. All acceptance criteria passed end-to-end with production-DB SQL round-trip verification on test content_item 32e0e966-4cb8-4e8b-abf8-5617de346f59. Sub-prompt 6a-AI deferred to Session 62 per hard-stop discipline (Edge Function work is backend mode, mixing modes causes scope creep). (A) 6a-style SHIPPED at the start of the session: new fields ride in existing lesson_blocks.config jsonb (config.background_color string|null tinted hex from locked palette, config.padding enum "none"/"small"/"medium"/"large") — no migration. 6 frontend files: (a) new BlockStyleSection.tsx — shared Style section component with background color picker (BrandColorSwatch palette="tints" + Default option) + padding dropdown, takes (value, onConfigChange) prop shape; (b) BrandColorSwatch.tsx extended with new BRAND_TINT_COLORS exported constant (8 pre-mixed near-neutral tints against sand bg: Navy tint #EDEFF2, Orange tint #FDEFE3, Sand tint #F9F7F1, Teal tint #E3EDED, Mustard tint #F3EEDF, Slate tint #EFEDEF, Purple tint #EAE4EE, Forest tint #E5EBE7) plus new palette?: "full" | "tints" prop defaulting to "full" so existing call sites (DividerBlockForm, ListBlockForm) work unchanged; (c) blockTypeMeta.ts — every defaultConfig() across all 9 block types extended with background_color:null and padding:"none"; (d) BlockRenderer.tsx wraps 8 of 9 block render outputs in a styled wrapper div with inline styles (background, paddingTop/paddingBottom from padding token, plus borderRadius:8 + horizontal padding 16px only when bg is truthy so tinted blocks read as cards) — divider returns the unwrapped 3px line, geometric no-op for both background and padding; (e) BlockEditorPane.tsx renders BlockStyleSection ONCE after the dispatched block-type form (Choice B locked — universal style fields live in the pane not duplicated across 9 forms); (f) lesson-blocks.css removed background-color: hsl(var(--muted)) from .stacked-block.is-selected so muted chrome doesn't fight author-set tints, kept orange border-left as selection indicator. 10 acceptance criteria all PASSED: Style section visible on every block type, 8 tinted swatches in locked order, tooltips correct, tint applies + Default clears with rounded-corners semantics correct, padding dropdown has exactly 4 options, padding token mapping (0/12/24/48px) applies live to preview, new blocks default to (null,"none") from defaultConfig, divider Style fields round-trip through save but have zero visual effect (intentional), tinted blocks during selection keep tint visible with orange left-border only, hover state unaffected on un-tinted blocks. SQL verification on production svprhtzawnbzmumxnhsq: callout at display_order 9 confirmed bg='#F3EEDF' and padding='small' (round-trip clean). Legacy blocks (display_orders not touched) show padding=null — note paddingPxFor(null) in BlockRenderer returns 0 same as "none" so legacy blocks render identically; BlockStyleSection's display-only ?? "none" fallback in dropdown means user sees correct UI even on legacy data; calling this benign (no backfill needed for v1, functional behavior is identical). Cole-locked decisions during scoping: D1 pre-mixed tinted hex values stored as BRAND_TINT_COLORS constant (predictable across browser/context); D2 extend config jsonb not typed columns (zero migration, BlockRenderer already config-routed); D3 padding tokens 0/12/24/48px (lands at "noticeable gap"/"skip-a-line"/"section break" rhythm at 17px body baseline); D4 Style section at bottom of form not top (keeps content fields above-the-fold); D5 Default=null=truly transparent (no inline style applied); D6 apply to all 9 block types but divider is no-op (consistent API for subsequent bulk-apply, geometric edge case for divider). Architectural decision Choice B (Style section in BlockEditorPane once, not per-form) locked over Choice A (Style section in each of 9 forms): every plausible v1+ block-level style field (margin, corner radius, border, shadow, max-width) is universal across block types not block-type-specific; standing rules push toward MORE platform-locked styling not less (rule 10 brand-only enforcement, rule 18 8-color palette locked); type-specific style refactor B→A or hybrid is half-day not a rewrite if ever needed. (B) 6a-manage SHIPPED mid-session: Manage mode toggle on stacked editor, multi-select with checkboxes + Manage Blocks right-side sidebar (320px fixed, animates `right` per standing rule 20) + bulk operations: delete, duplicate, move up/down, apply background, apply padding. Zero backend changes — existing replace_lesson_blocks RPC handles "N blocks come in, N blocks go out" for free. 6 frontend files: (a) new ManageBlocksSidebar.tsx (selection count header, action buttons with hasSelection + canMoveUp/canMoveDown disabled gating, inline BrandColorSwatch tinted palette + padding dropdown with Apply buttons per field); (b) StackedLessonEditor.tsx extended with mode/selectedClientIds/onToggleSelect props, checkbox visual on left of each block in Manage mode (orange-fill + white check when selected, muted border when not), conditional suppression of BlockHoverToolbar and InlineAddButton in Manage mode, drag listeners attached to outer container in Manage mode (relies on @dnd-kit activationConstraint: { distance: 4 } to disambiguate click-toggle vs drag-start); (c) EditorSlidePane.tsx accepts mode prop, computes effectiveOpen=mode==="edit"&&open so pane force-closes in Manage; (d) UndoDeleteToast.tsx accepts message prop with default "Block deleted" so bulk path passes "X blocks deleted"; (e) lesson-blocks.css adds .stacked-block.is-manage-selected (Orange tint #FDEFE3 background + orange 4px left border + 12px padding-left, hover deepens to #FCE4D0); (f) LessonBlocksEditor.tsx adds mode state (default "edit"), selectedClientIds Set state, lastClickedClientId for shift-range tracking, bulkDeletedBlocks for undo, segmented mode toggle UI in page header (left of action cluster, with Edit2 and Layers lucide icons), bulk handlers (handleBulkDelete with removed[] capture and reverse-walk reinsertion in handleUndoBulkDelete, handleBulkDuplicate with reverse-walk to avoid index shift, handleBulkMoveUp/Down with "skip swap if adjacent also selected" check to handle adjacent selected blocks as a coherent group, handleBulkApplyBackground and handleBulkApplyPadding that map over blocks with selectedClientIds.has check), canBulkMoveUp/canBulkMoveDown memoized booleans (topmost selected index > 0 / bottommost selected index < blocks.length-1), keyboard shortcuts effect (Manage mode only: Cmd/Ctrl+A select-all with preventDefault to override browser text-select, Esc clear-selection), handleToggleSelect with Shift+click range logic using lastClickedClientId, updated handleSelectBlock so single-block click in Edit mode collapses any lingering multi-selection down to that one block, Save handler clears selectedClientIds and lastClickedClientId after reload, stack container gets md:mr-[320px] when mode==="manage", UndoDeleteToast rendering switches text/duration based on whether bulkDeletedBlocks or deletedBlock is active (12s for bulk vs 6s for single). 21 acceptance criteria all PASSED including selection persists across mode toggle (D2-corrected per user-first review), drag-and-drop single block always works regardless of mode (D5-corrected — original "disable drag in Manage" was developer rationale not user rationale), shift+click range select + Cmd/Ctrl+A select-all + Esc clear keyboard shortcuts work in Manage mode only, bulk apply background and padding both round-trip through save verified via SQL. (C) 6a-manage-multidrag SHIPPED late session: when an author drags a block that is part of a multi-selection (selectedClientIds.size >= 2), the entire selection moves together preserving internal relative order — using @dnd-kit DragOverlay for the cursor preview. Originally deferred per developer-rationale ("multi-block drag is implementation-complex") but reconsidered when user pointed out this is standard behavior in Notion/Figma/file managers. 2 files modified: (a) StackedLessonEditor.tsx adds activeId state + handleDragStart that captures it + isGroupDragActive boolean (activeId!==null && selectedClientIds.size>=2 && selectedClientIds.has(activeId)), dispatches onGroupReorder(activeClientId, overClientId) when group condition met else falls through to existing onReorder(from, to) single-block path, computes topmostSelectedBlock for DragOverlay icon, passes isGroupMember bool to each SortableStackBlock so non-active group members fade to 0.4 opacity alongside the actively-dragged block (which already fades via @dnd-kit isDragging), renders DragOverlay child as "Moving N blocks" pill (240px wide, sand bg, orange 4px left border, font-display Navy text + orange block-type icon from BLOCK_TYPE_META) only when isGroupDragActive; (b) LessonBlocksEditor.tsx adds handleGroupReorder(activeClientId, overClientId) that builds selectedSeq[] (selected blocks in original array order) and remaining[] (non-selected blocks in original order), finds dropIdxInRemaining via overClientId lookup with fallback to nearest non-selected position if overClientId itself is in selection (defensive edge), determines drag direction via draggingDown=activeIdx<overIdx, inserts selectedSeq into remaining at dropIdxInRemaining+1 if dragging down else at dropIdxInRemaining (insert BEFORE drop target when dragging up, AFTER when dragging down). 10 acceptance criteria all PASSED including group drag down + up land correctly with internal order preserved, non-contiguous selections (e.g. blocks 1 and 9) drag as a group correctly, non-selected block dragged in Manage mode uses single-block path with no overlay and selection untouched, single-block "selection" of size 1 doesn't trigger group mode, group drag results survive mode toggle (Manage→Edit→Manage preserves the post-drag positions AND the selection set), save round-trip verified via SQL showing post-drag order in lesson_blocks.display_order. No new standing rules surfaced across the three prompts. No new architectural patterns. No backend bugs surfaced. No production data fixes required. Test fixture content_item 32e0e966 ends Session 61 with 10 active lesson_blocks across 9 block types (text, quote, divider, image, text, list, heading, embed_audio, text, callout — post-multidrag order), 0 lesson_block_drafts rows, image+audio assets active with their refs intact, several lesson_blocks_replaced audit rows from the session's testing. Session 62 picks up with 6a-AI scoping (Edge Function work first: extended draft-text or new draft-lesson-block-stream, then frontend AI panel + stage state machine + AI buttons per block-type form + per-block AI shortcuts in stacked editor toolbar).)*

*v64 - Session 60 CLOSE (Prompt 6a manual lesson-block editor backend SHIPPED + initial Lovable prompt SHIPPED + branding pass SHIPPED + useBlocker crash hotfix SHIPPED + end-to-end UI testing through Save flow surfaced two real bugs and a UX gap, pivot decision made to rebuild from two-pane to Rise-style stacked editor. Five migrations applied to Supabase project svprhtzawnbzmumxnhsq (all verified clean): (1) create_lesson_block_drafts_table — table with PK (content_item_id, author_id), index on author_id, 4 RLS policies (select/insert/update/delete) all gated on author_id=auth.uid() AND public.is_super_admin(); (2) create_lesson_block_draft_rpcs — save_lesson_block_draft(p_content_item_id, p_draft_json) upsert + discard_lesson_block_draft(p_content_item_id) delete; (3) extend_replace_lesson_blocks_for_option_b_and_draft_cleanup — Option B asset-ref rebind loop (SELECT FOR UPDATE on parent-scoped ref matching asset_id+content_item_id+ref_field, UPDATE setting lesson_block_id=new+content_item_id=NULL, fallback INSERT block-scoped when no parent-scoped ref exists), draft cleanup (DELETE drafts for (content_item_id, auth.uid()) on success), returns asset_refs_rebound count in audit after_value; (4) extend_reap_pending_uploads_with_active_orphan_sweep + fix_reap_active_orphan_actor_to_null — added Sweep 2 in reap_pending_uploads (cron name confirmed reap_pending_uploads NOT _hourly — earlier doc references corrected this session): active non-library assets >24h whose every active ref points at archived/missing parent → _archive_asset_internal with NULL caller (super_admin_audit_log.super_admin_user_id made nullable in same migration); (5) create_get_lesson_block_assets_rpc — bulk asset path/bucket/kind fetch for stacked editor, accepts p_extra_asset_ids uuid[] for unsaved uploads, returns out_asset_id/out_bucket/out_path/out_asset_kind for active assets only. Lovable Prompt 6a (initial) SHIPPED at commit 638db60fbe0ee68c1f1484b3a4f80193c1238b0f: 9 block forms (text/heading/divider/image/video_embed/quote/list/callout/embed_audio), TipTap v3.x dependencies @tiptap/react+pm+starter-kit+extension-text-style+extension-link+extensions, @dnd-kit for drag-and-drop reorder, BlockListPane + BlockEditorPane two-pane layout, RichTextEditor wrapper, AddBlockPopover, blockTypeMeta, useLessonBlockDraft auto-save hook (3s debounce), useAssetSignedUrl per-asset URL hook, lesson-blocks.css (orange list bullets, orange links, orange placeholder), List block uses TipTap-per-item with @dnd-kit reorder + Numbered toggle switch. Lovable Prompt 6a-brand SHIPPED at commit d44f7bc7423b178108a0c7c4cb136378c6ac0b21: 5 surgical changes — page container space-y-6 p-6 (matched ContentAuthoring), Navy h1 text-3xl font-bold tracking-tight style={{color:"#021F36"}} matching AssetLibrary precedent, Back button moved above title with text-muted-foreground breadcrumb style, Save button gets shadow-cta orange-glow shadow, BlockEditorPane heading uses font-display text-base font-semibold Navy, RichTextEditor active toolbar button bg-[#F5741A]/15 text-[#F5741A]/hover:bg-[#F5741A]/20 subtle orange tint replacing solid bg-accent. Lovable useBlocker-crash hotfix SHIPPED: page crashed on mount with minified Uncaught Error because useBlocker from react-router-dom v6 requires data router (createBrowserRouter); project uses legacy <BrowserRouter> which does not support useBlocker. Hotfix removed useBlocker import + replaced with pendingNavigation state + __browser_back__ sentinel + popstate handler that re-pushes history state + guardedNavigate wrapper for in-app nav + reworked leave dialog to read pendingNavigation. Standing rule logged: useBlocker requires data router; legacy BrowserRouter pages must use manual popstate-based guard pattern. End-to-end UI testing through Save flow: navigation, routing, page render, Navy h1, branded shell, shadow-cta, two-pane layout, TipTap toolbar, typing, live card preview, Bold/Italic with orange-tint active state, auto-save fires 3s after edit and lesson_block_drafts row landed (verified in DB), Save dialog opens with reason-required text validation, Save succeeds (replace_lesson_blocks RPC returns success with audit row + 1 lesson_block created), status badge transitions Saved (draft) → Saved. Two bugs surfaced during testing (both bundled into the stacked rebuild prompt rather than fixed standalone): (BUG-1) race condition — Save runs at T+0, replace_lesson_blocks succeeds and deletes draft row (audit after_value.draft_deleted=true), but useLessonBlockDraft auto-save fires 3s later (debounce timer was never cancelled) and re-inserts the draft row → user reload shows draft-resume banner even after successful save; fix is pause()/resume() methods on useLessonBlockDraft that cancel pending timer + suspend new saves while manual Save is in flight. (BUG-2) post-save deselects block — reload() unconditionally sets setSelectedClientId(null) so the right pane reverts to "Select a block from the left to edit" after every save; fix is to preserve selection by display_order index (since block IDs change on save), matching the new block at same position. Third issue surfaced: EmbedAudioBlockForm refField="audio_asset" mismatch — backend constructs ref_field as v_block_type || '_asset' (i.e., embed_audio_asset for embed_audio blocks), so Option B rebind silently fails for audio blocks creating orphan content_item-scoped refs; one-line fix audio_asset → embed_audio_asset. UX gap surfaced: post-save UX is wrong — user expects to keep editing the same block (or land in "add another block" mode), not deselect; combined with the two-pane layout feeling cramped, Cole asked for full pivot to Rise-style stacked single-column editor. After Rise research + design lock session: locked layout to single scrolling column with trainee-accurate block previews via new canonical BlockRenderer component (reused by Phase 5 trainee UI), per-block floating hover toolbar with 6 actions (drag handle, edit, move up, move down, duplicate, delete), inline thin "+ Add block" dividers between every pair of blocks expanding on hover, slide-in left pane (480px, non-modal, NOT shadcn Sheet — built as flex/grid sibling with CSS transform animation since Sheet is modal-overlay primitive) that auto-opens on new block insert + closes on X + closes on Esc + switches block on stack click + does NOT close on outside click, drag-and-drop semi-transparent dragged block via @dnd-kit sortable, undo-delete toast bottom-left 6s with teal border-l-4 #006D77 accent. Branding lock for stacked editor: bg-muted for selected fill + border-l-4 border-[#F5741A] left edge (gray + orange edge, NOT solid orange — matches ContentAuthoring TreeRow precedent), bg-muted/30 hover, Navy h1 + Poppins font-display + shadow-cta on Save, orange #F5741A reserved for list bullets/links/focus rings/active toolbar/selection edge/inline-add-hover, callout variants locked info=teal #006D77 / warning=amber #FFB703 / success=forest #2D6A4F / important=orange #F5741A. Prompt 6a-stacked DRAFTED at /home/claude/internal-docs/lovable-prompts/prompt-6a-stacked.md (707 lines): 7 new files (StackedLessonEditor, EditorSlidePane, BlockRenderer with 9 block-type render paths specced verbatim, BlockHoverToolbar, InlineAddButton, useLessonBlockAssetUrls bulk-fetch hook, UndoDeleteToast), 2 files deleted (BlockListPane, useAssetSignedUrl), 5 files modified (LessonBlocksEditor page rewrite with race+selection+pane state, BlockEditorPane trimmed to dispatch-only, EmbedAudioBlockForm refField fix, ContentItemEditor block count badge "(N blocks)" / "(no blocks yet)", useLessonBlockDraft pause/resume methods), 19 acceptance criteria, explicit non-goals list. Prompt 6a-stacked SENT TO LOVABLE — awaiting build completion at session continuation. Updated sub-prompt sequence locked (supersedes Session 59 4-prompt sequence): 6a-stacked → 6a-style (background color + padding per block, schema migration required) → 6a-manage (multi-select + Manage Blocks sidebar + bulk operations) → 6a-AI (staged outline-to-content authoring, backend Edge Function additions first) → 6b (7 remaining block types) → 6c (knowledge_check). Style before AI confirmed by Cole. Standing rules locked Session 60: (a) useBlocker requires data router — legacy BrowserRouter pages use manual popstate guard; (b) every asset-bearing block form MUST use exactly `<block_type>_asset` as refField to match backend rebind; (c) BlockRenderer is canonical block renderer reused by Phase 5 trainee UI — any new block type added in 6b/6c MUST add render path to BlockRenderer.tsx; (d) shadcn Sheet is modal overlay only — non-modal slide-in panes built as flex/grid sibling with CSS transform; (e) auto-save debounce timers MUST be cancellable via hook-exposed pause()/resume() so explicit save operations can cancel pending debounce; (f) super_admin_audit_log uses FK to super_admin_action_types table (NOT a CHECK whitelist as earlier docs implied — correction logged Session 60); (g) reap_pending_uploads cron and function are named reap_pending_uploads NOT _hourly — earlier doc references corrected. Test fixture state: content_item 32e0e966-4cb8-4e8b-abf8-5617de346f59 "Test Lesson Blocks Item" in Test Module C has 1 active text block 7feefbcd-2154-47d8-a146-84c9325b601d with TipTap body, 1 lesson_block_drafts row still present from BUG-1 race (will get cleaned up after Save in stacked rebuild), 1 super_admin_audit_log row action_type=lesson_blocks_replaced with after_value showing inserted_count:1 draft_deleted:true asset_refs_rebound:0. Prompt 6 scope summary doc updated at /home/claude/internal-docs/prompt-6-scope-summary.md with Session 60 supersede block at top — original two-pane scope preserved below as historical context. LATE SESSION 60 (post-stacked-rebuild): Lovable Prompt 6a-stacked SHIPPED at commit f3aab9335f8b929b2c5b3f7b76876bee83c39bb1 (707-line prompt, 7 new files + 2 deleted + 5 modified). End-to-end UI testing against all 19 acceptance criteria — every AC verified working in the UI (routing, page render, branded shell, hover toolbar with 6 actions, pane interactions including Esc/X close + click-another-block switches, inline + Add, auto-save 3s debounce with draft row landing in DB, Save dialog with reason validation, post-save state, race-condition fix verified by 27s post-save observation of 0 draft rows, Option B asset rebind for image with asset_refs_rebound:1 in audit, Option B asset rebind for audio with refField fix verified embed_audio_asset not audio_asset, bulk asset URL fetch via new get_lesson_block_assets RPC, drag-and-drop reorder, move up/down with disabled boundary states, duplicate including shared asset_id case, delete with undo toast functional, block count badge on ContentItemEditor, navigation guard dialog with Stay/Discard, list block end-to-end with TipTap-per-item + @dnd-kit reorder, quote block, audio block end-to-end). Three additional backend bugs surfaced during testing and fixed in-session via Supabase migrations: (a) fix_cascade_helper_bare_delete — _cascade_archive_asset_refs_for_lesson_blocks had bare DELETE FROM _affected_assets_blocks; that tripped Supabase's runtime no-WHERE-clause-DELETE rule when called with non-empty input array; replaced with TRUNCATE; (b) fix_bare_delete_in_all_cascade_helpers — same bug existed in all 4 sibling cascade helpers (_cascade_archive_asset_refs_for_content_item, _module, _curriculum, _certification_path); all 4 fixed via TRUNCATE; latent bug from Sessions 58-59 that would have failed any cascade archive on entities with active asset refs; (c) defer_cascade_archive_in_replace_lesson_blocks — cascade-archive helper call inside replace_lesson_blocks ran BEFORE the FOR loop that creates new refs; when an asset was referenced by both an outgoing block AND an incoming block in the same save (common: save unchanged image), helper saw zero active refs at the moment it ran and auto-archived the still-needed asset, leaving subsequent saves failing validation block_at_index_N_references_inactive_or_missing_asset; fix moves cascade-archive to AFTER the FOR loop so new refs exist before the active-ref-count check. One manual data fix during testing: asset 6ce8bc29-1580-44ca-8baf-10d7a70ffa77 was unarchived via direct UPDATE (status=active + archived_at/archive_reason NULL) after being caught by the cascade-archive timing bug; subsequent saves verified clean with this asset reattached. 12 frontend bugs/feature additions bundled into a follow-up Lovable prompt 6a-stacked-fix DRAFTED at /home/claude/internal-docs/lovable-prompts/prompt-6a-stacked-fix.md (1136 lines): #1 lesson_block_drafts queried by user_id (column is author_id) so draft-resume banner never showed, fix via single-line column reference change in LessonBlocksEditor.tsx; #2 slide-in pane covers global AppLayout sidebar (fixed left-0 h-screen z-30 → absolute left-0 h-full z-20 with pointer-events-none when closed); #3 heading sizes smaller than spec (H2 text-2xl→3xl, H3 text-xl→2xl, H4 text-lg→xl with mt/mb breathing room); #4 spurious draft autosave fires on block select with no edits — TipTap normalizes JSON on readonly mount differently than editable form output, fix is deep-normalize JSON before dirty comparison (strip empty arrays, sort keys, drop null/empty values) applied to both useLessonBlockDraft hook and isDirty memo in LessonBlocksEditor; #5 inline + Add invisible at rest, fix via 12px visible dashed cream baseline with 50%-opacity + icon expanding to 36px orange on hover; #9 no Save button in slide-in pane, added full-width shadow-cta Save button to pane footer with isDirty + saving + onRequestSave props; #11 undo toast at bottom-left should be bottom-right to match platform Toaster convention (single attribute change left-6 → right-6); #13 toolbar text-size controls — H2/H3/H4 buttons unified across all RichTextEditor uses including compact list-item mode, plus a Lead paragraph toggle (1.15rem, font-weight 500) gated to non-compact uses only, requires lead CSS class in lesson-blocks.css and TipTap TextStyle mark with fontSize=lead attribute; #14 Save and leave third option on unsaved-changes dialog (between Stay and Discard) styled as primary action with shadow-cta, clicking closes leave dialog + opens save reason dialog with saveAndNavigateTo state set + on successful save navigation proceeds to originally-attempted destination, handles cancel by clearing saveAndNavigateTo on dialog Cancel; #16 body font + bigger bullets + filled-circle numbered markers — base body 16→17px with 1.65 line-height in .tiptap-prose, bullets switch from CSS bullet char to forest green #2D6A4F filled disc 0.65em diameter, numbered markers become orange #F5741A filled circles 1.5em diameter with white Poppins numerals inside; #17 divider more distinct — 1px hairline → 3px rounded line, default Navy, form gets BrandColorSwatch picker constrained to 5 brand colors; #18 brand-only color enforcement — new shared BrandColorSwatch.tsx component locks pickers to BRAND_SWATCH_COLORS array of 5 brand hex values (Navy/Orange/Teal/Forest/Slate) with optional allowedHexes subset prop, no hex input + no system color picker anywhere. Cole-locked decisions in scoping: divider color palette = all 5 brand colors, numbered marker default Orange filled circle with white number, bullet default Forest green disc, body 17px, Lead 1.15rem, undo toast bottom-right, Save-and-leave primary shadow-cta styling. Prompt 6a-stacked-fix SENT TO LOVABLE — awaiting build at Session 61 start. Updated sub-prompt sequence inserts 6a-stacked-fix between 6a-stacked and 6a-style: 6a-stacked ✅ → 6a-stacked-fix NEXT → 6a-style → 6a-manage → 6a-AI → 6b → 6c. Cross-prompt standing rules locked late Session 60 (apply to all downstream sub-prompts): brand-only color enforcement (any color chooser added in any future prompt MUST use BrandColorSwatch from 6a-stacked-fix or strict subset of its BRAND_SWATCH_COLORS, no hex input, no system color picker — non-negotiable for content portability across organizations); bare DELETE FROM table; rejected at runtime in Supabase Postgres even for temp tables, use TRUNCATE or include WHERE; in replace_lesson_blocks and any future replace-style RPC with auto-archive cascade the cascade MUST run AFTER incoming refs are created (helpers checking any-active-refs need new refs visible, otherwise transient zero-ref states cause spurious cascade-archives); typography baseline locked at 17px body + 1.65 line-height in .tiptap-prose applies wherever lesson content renders including Phase 5 trainee UI; list marker defaults locked (bullets forest green #2D6A4F filled disc, numbered orange #F5741A filled circle with white Poppins numeral inside); divider default locked (3px rounded line Navy with BrandColorSwatch override); Save-and-leave is the primary path when user has unsaved changes and tries to navigate away (Discard-and-leave is the de-emphasized escape hatch, Stay is cancel). 6a-style scope refined late Session 60: block-background color picker MUST use BrandColorSwatch (likely with lighter tinted hex variants for readability), padding stays fixed choice set (none/small/medium/large) not arbitrary px, schema decision leans toward extending config jsonb rather than typed columns, explicitly forbids per-block override of heading/link/callout-variant/list-marker colors (those decisions are platform-locked, author tools for visual differentiation are background + padding + divider color + structural choices like heading level and list type). Final DB state Session 60 close: content_item 32e0e966 has 6 active lesson_blocks (text, text, image, heading, embed_audio, quote), 0 lesson_block_drafts rows, image asset 6ce8bc29 active with 1 active ref to its lesson_block, audio asset active with 1 active ref to its lesson_block scoped with ref_field=embed_audio_asset, 5+ super_admin_audit_log rows for lesson_blocks_replaced action_type from the testing session. Pending Session 61 work: verify 6a-stacked-fix lands cleanly per the 15 acceptance criteria in that prompt, re-test draft-resume banner path (item #1), verify slide-in pane no longer covers sidebar (item #2), brand color swatch visual check on divider (items #17+#18), lead paragraph + new bullet/numbered marker styling (items #13+#16), begin scoping 6a-style block-background-and-padding prompt with BrandColorSwatch inheritance. BUILD QUEUE ITEM RECORDED (Cole proposal, deferred for evaluation): expand BrandColorSwatch palette to 8 colors in this order — Navy, Orange, Sand, Teal, Mustard, Slate (gray), Purple, Forest green — and extend brand-only color enforcement to allow author overrides of body text color, heading color, link color, and inline highlight/shading anywhere in lesson content via toolbar buttons. Currently DECLINED for v1 on brand-consistency grounds (heading/body/link/callout-variant colors stay platform-locked to preserve BrainWise visual identity across all licensed content; authors only control decorative/structural color — block background, divider, bullet color, numbered marker color). Cole acknowledged the brand-drift risk and chose Option A locked for v1. Revisit post-launch if real authoring usage shows the lock is too restrictive in practice OR if the platform expands to allow per-organization theming where each licensing org gets a sanctioned alternative palette. Until then: 8-color palette ships in 6a-stacked-fix but only governs background-style fields. Item lives in build queue awaiting Cole's explicit go-ahead. LATEST LATE SESSION 60 UPDATE: 6a-stacked-fix v1 built successfully by Lovable and post-build testing surfaced two issues — (a) image block rendered "No image uploaded" placeholder despite asset existing on the block; root cause was data state not code: when asset 6ce8bc29 was manually un-archived earlier in session via direct UPDATE on content_assets only, the matching content_asset_versions row stayed archived, causing get_lesson_block_assets RPC to correctly filter the asset out (RPC requires cav.archived_at IS NULL); fixed via second UPDATE on content_asset_versions setting archived_at=NULL on the matching version row 996342bb-d56e-402c-81bb-d98a6550bde5; reload restored image rendering. New standing rule logged: manual un-archive of an asset must touch BOTH content_assets AND content_asset_versions tables — _archive_asset_internal helper archives both atomically, so any manual reversal must do the same; if only content_assets is reverted the get_lesson_block_assets RPC and any future signed-URL resolver still filter the asset out. (b) Lead paragraph toolbar toggle visible but clicking had no effect — root cause: TipTap's default TextStyle extension does not declare a fontSize attribute, so setMark("textStyle", { fontSize: "lead" }) calls succeed but the attribute is silently dropped on JSON serialize and never reaches the rendered output; fix requires TextStyle.extend() pattern with custom addAttributes({ fontSize: ... }) that wires parseHTML/renderHTML to a data-font-size HTML attribute; applies to both RichTextEditor (editable mode) AND BlockRenderer (readonly mode); fix bundled into v2 prompt. Lovable prompt 6a-stacked-fix-v2 DRAFTED at /home/claude/internal-docs/lovable-prompts/prompt-6a-stacked-fix-v2.md (403 lines) with three scoped changes: (1) Lead-toggle fix via new TextStyleWithFontSize.ts wrapper extension swapped into RichTextEditor and BlockRenderer extension arrays, plus CSS [data-font-size="lead"] rule lift; (2) BrandColorSwatch palette expanded from 5 to 8 colors in Cole-locked order — Navy/Orange/Sand/Teal/Mustard/Slate/Purple/Forest, all are existing locked brand hex values used elsewhere in platform; (3) bullet color + numbered marker color pickers added to ListBlockForm via BrandColorSwatch, with marker color passed to BlockRenderer's ListRender component as CSS custom property --list-marker-color used as background fallback in lesson-blocks.css ul/ol li::before rules (defaults preserved: forest green for unordered, orange for ordered). 13 acceptance criteria. Black and white EXCLUDED from palette by design — white as text color invisibly disappears on sand background, black breaks brand by undercutting Navy as the platform dark color; also explicitly DECLINED for v2 author overrides of heading color, link color, callout variant color, body text color (those stay platform-locked, decorative-only colors are author-configurable). 6a-stacked-fix-v2 SENT TO LOVABLE — awaiting build at next test cycle. v2 SHIPPED and tested: Lead toggle worked after TextStyle.extend pattern, 8-color BrandColorSwatch landed with Cole-locked order (Navy/Orange/Sand/Teal/Mustard/Slate/Purple/Forest), bullet color picker shipped with forest-green default, numbered marker color picker shipped with orange default, list block end-to-end tested with purple numbered circles + white Poppins numerals. Post-v2 testing surfaced one final UX issue: slide-in pane stayed anchored to page-top instead of tracking viewport as user scrolled down the stack to edit blocks deep in the lesson. Three iterations to fix (v3 saga): v3 attempted position:sticky inside a flex sibling layout — sticky never engaged because the pane had a CSS transform (for the slide-in animation) which creates a new containing block context that breaks sticky's scroll-context detection in most browsers; v3.1 attempted to separate sticky (outer wrapper) from transform (inner aside) but sticky still didn't engage due to the combination of <main>'s overflow-auto + nested flex containers + the scroll context detection edge case; v3.2 abandoned sticky entirely and switched to position:fixed with explicit pixel offsets (top:56px from AppLayout header height, left:var(--sidebar-width, 0px) referencing the SidebarProvider's CSS variable, bottom:0, width:min(480px, calc(100vw - var(--sidebar-width)))) — open-state worked perfectly but closed-state still visually covered the global AppLayout sidebar because the transform-based slide animation (-translate-x-full) translated the pane from left:256px to visual position [-224px,256px] which overlaps the sidebar's [0,256] range; v3.3 switched from transform-based animation to animating the `left` property directly (closed: left:-480px putting pane fully off-screen in negative coordinate space [-480,0], open: left:var(--sidebar-width)), eliminating any overlap with sidebar's [0,256] range at any animation frame. v3.3 SHIPPED and tested clean: sidebar fully visible at all times (when pane closed, when pane open, during slide animations), pane appears in correct position at viewport top:56px regardless of scroll position, scrolling the stack while pane is open works correctly (pane stays anchored to viewport), all v1+v2 functionality intact. Three new standing rules locked from v3 saga: (a) position:sticky and CSS transform on the same element break sticky engagement — element with transform becomes a new containing block which interferes with sticky's scroll-context detection in most browsers, separate the concerns via nested wrappers if both are needed, or pick fixed positioning instead; (b) position:sticky inside ancestor chains with overflow:auto + nested flex containers is unreliable in this codebase (AppLayout's <main> has overflow-auto creating the scroll context, and nested flex parents introduce edge cases), prefer position:fixed with explicit offsets for any viewport-tracking UI; (c) for slide-in/slide-out pane animations against a global sidebar, animate the `left` property directly rather than using transform, so the closed-state position can be placed in fully negative coordinate space (off-screen) and never visually overlaps the sidebar during transitions. Additional tiptap warning surfaced in console "Duplicate extension names found: ['link']" — logged for future cleanup, non-blocking, likely from the StarterKit including Link by default while RichTextEditor + ReadOnlyTipTap both add Link.configure() explicitly, fix is to drop the explicit Link import and use StarterKit's bundled Link (not addressed Session 60 — added to build queue as cleanup item). Final Session 60 DB state at close: content_item 32e0e966 has 10 active lesson_blocks (text×3, divider, image, heading, embed_audio, quote, list, callout — covers 9 of 9 block types in v1 catalog), 0 lesson_block_drafts rows, image asset 6ce8bc29 active with 1 active version row, audio asset active with 1 active block-scoped ref, 14 successful lesson_blocks_replaced audit rows across the session. Updated sub-prompt sequence stays the same as documented in earlier blocks: 6a-stacked ✅ → 6a-stacked-fix-v1+v2+v3.3 ✅ → 6a-style → 6a-manage → 6a-AI → 6b → 6c. Six prompts shipped this session total: 6a (initial 9 block forms), 6a-brand, useBlocker hotfix, 6a-stacked (Rise-style rebuild), 6a-stacked-fix v1 (12 polish items + BrandColorSwatch), 6a-stacked-fix v2 (Lead toggle + palette expansion + list marker pickers), and three quick iterations to converge pane positioning: v3.2 (switch to fixed) + v3.3 (animate left not transform). v3 and v3.1 drafted but rolled back/replaced. Cost-benefit reflection: would have been single-prompt cheaper to go straight to fixed positioning in v3 instead of trying sticky first; logged as lesson for future "stay visible while content scrolls" requirements — fixed is the default primitive, sticky is for "scroll with then stop at target" cases.)*

*v63 - Session 59 CLOSE (Prompt 7 thumbnails SHIPPED end-to-end backend + frontend + verified across all 4 parent entity types + Prompt 6 sub-prompt scoping complete with full design decisions locked across 6a/6a-AI/6b/6c). Eight migrations applied for Prompt 7 backend: prompt_7_a extends content_asset_refs with module_id/curriculum_id/certification_path_id columns + replaces 2-way exactly-one-parent CHECK with 5-way + 3 partial indexes; prompt_7_b adds thumbnail_asset_id uuid REFERENCES content_assets(id) ON DELETE SET NULL on certification_paths/curricula/modules/content_items; prompt_7_c adds _cascade_archive_asset_refs_for_module/curriculum/certification_path helpers mirroring content_item helper; prompt_7_d1 adds _validate_thumbnail_asset (image kind + active status) and _archive_thumbnail_ref_and_maybe_asset (archives ref + auto-archives non-library asset at zero refs); prompt_7_d2 amends upsert_certification_path/curriculum/module with p_thumbnail_asset_id DEFAULT NULL + diff-and-update ref logic; prompt_7_d3 amends upsert_content_item same; prompt_7_d4 drops legacy upsert overloads (CREATE OR REPLACE doesn't replace when arg list grows — surfaces 42725 "function is not unique" on existing named-param callers); prompt_7_e amends archive_module/curriculum/certification_path to call cascade helpers; prompt_7_f extends request_asset_upload RPC with p_module_id/p_curriculum_id/p_certification_path_id new mode branches + path conventions module/<id>/<asset>.<ext>, curriculum/<id>/<asset>.<ext>, certification_path/<id>/<asset>.<ext>; prompt_7_g adds _upsert_thumbnail_ref idempotent helper (existence check before INSERT) to handle dual-path ref creation (request_asset_upload creates on upload, upsert RPC creates on save); prompt_7_h+h2 amend all four upsert RPCs to use the idempotent helper instead of unconditional INSERT — resolves duplicate-ref design flaw surfaced during testing. request-asset-upload Edge Function v1→v2 with three new body fields forwarded to RPC. Frontend SHIPPED via three Lovable prompts: 7-thumbnails (FileUploadField extended with 3 new optional parent_id props + body field pass-through + dependency arrays; 4 editors get thumbnail state + payload entry + UI section above slug/title with create-mode disabled state; ContentAuthoring.tsx tree height fix sticky→direct-height because parent AppLayout main has overflow-auto preventing sticky), 7.1 (tree height refinement to h-[calc(100vh-7rem)] self-start dropping sticky), 7.2 (isDirty added thumbnailAssetId to all four editor dirty checks + dep arrays). Verification COMPLETE: 5 entities tested end-to-end (PTP-Coach cert path, PTP VILT 1 curriculum, Test Module C module, Test Video Item content_item, Test External Link content_item) all have thumbnail_asset_id column set + exactly 1 active thumbnail ref each + no duplicates; library reuse confirmed working (one asset f8b13cb2 referenced as thumbnail across 3 entities, one asset 0400f749 across 2 entities — "one asset many refs" pattern healthy). Standing rules locked: (1) CREATE OR REPLACE on RPC with new arg list creates separate overload NOT replacement — same migration MUST follow with explicit DROP FUNCTION of legacy signature; (2) Option B locked one-mechanism authoritative ref counting (refs rows for all 5 parent types not split direct columns); (3) Option X locked parent-scoped thumbnail uploads not library to enable cascade-archive + prevent library bloat; (4) Idempotent ref creation pattern via _upsert_thumbnail_ref handles both upload-path (request_asset_upload created ref) and library-pick-path (no ref existed) without duplication. Placeholder image confirmed at /public/brain-icon.png (BrainWise orange swirl 512x512 transparent PNG). Prompt 6 scoping work: locked TipTap as rich text engine (free MIT, ~100-130KB gzipped), kept list block in v1 (17 total active), split scope into 4 sub-prompts in sequence (6a manual editor + foundations + 9 block types text/heading/divider/image/video_embed/quote/list/callout/embed_audio + drag-and-drop reorder via @dnd-kit + TipTap; 6a-AI staged AI authoring with new/extended Edge Functions for outline-then-full-content flow with per-item iteration; 6b remaining 7 block types stat_callout/statement_a_b/tabs/flashcards/accordion/button_stack/scenario; 6c knowledge_check), locked Option B mount point at separate route /super-admin/content-authoring/lessons/<content_item_id>, locked two-pane layout (left compact cards with type-aware previews + right config form) with inline "+ Add block" popover between every pair of cards (B2), locked Option B confirm dialog on navigate-away with isDirty + window.beforeunload for tab close, locked Option Auto-3 auto-save to lesson_block_drafts table outside audit boundary (drafts not audit-logged because not canonical changes; SOC 2 CC7.2 compliance preserved because canonical lesson_blocks changes still happen only via replace_lesson_blocks with reason), locked dual-mechanism orphan asset cleanup (existing replace_lesson_blocks cascade for save-with-block-removed case + new sweep clause in reap_pending_uploads_hourly cron for tab-close abandonment case 24hr threshold). Full Prompt 6 scope summary persisted at internal-docs/prompt-6-scope-summary.md — Cole loading to GitHub for Session 60 reference. Build queue queued items for Session 60: backend recon for Prompt 6a (existing replace_lesson_blocks body, lesson_blocks/lesson_block_types schemas, AI Edge Function BLOCK_SCHEMAS dispatch); apply lesson_block_drafts table + save_lesson_block_draft RPC + discard_lesson_block_draft RPC + RLS migration; verify replace_lesson_blocks cascade-archive behavior for the save-without-block case (existing _cascade_archive_asset_refs_for_lesson_blocks helper from Session 58); extend reap_pending_uploads_hourly with active-orphan sweep clause; verify TipTap can be added as Lovable dep; draft and ship Prompt 6a Lovable prompt; verify end-to-end before 6a-AI work starts.)*

*v62 - Session 58 CLOSE (Prompt 5.6 backend SHIPPED end-to-end + Prompt 5.7 SHIPPED + three frontend patches landed (5.6.1, 5.6.2, 5.6.3). Six migrations applied to backend + one supplementary RLS migration: A buckets+schema (2 buckets lesson-assets/asset-archives, 3 tables content_assets/content_asset_versions/content_asset_refs, 17 indexes, 6 RLS policies, 2 storage.objects policies); B 10 action types under category=content_authoring; C 4 core RPCs (request_asset_upload mode-dispatched, finalize_asset_upload, create_asset_ref, archive_asset_ref) + 3 helpers; D 5 RPCs (promote_to_library, request_new_asset_version, finalize_new_asset_version, replace_asset, archive_asset_manual) + 2 helpers; archive_asset_ref upgraded with auto-archive-on-zero-refs for non-library assets; E amended archive_content_item and replace_lesson_blocks with cascade-archive helpers; F sweep RPCs (reap_pending_uploads, get_assets_due_for_archive_email, mark_archive_email_sent, run_asset_hard_delete); supplementary migration prompt_5_6_1_super_admin_storage_rls_for_tus added 4 super-admin INSERT/SELECT/UPDATE/DELETE RLS policies on storage.objects for lesson-assets bucket (required for TUS uploads which authenticate via user JWT). Three Edge Functions deployed: request-asset-upload v1, finalize-asset-upload v2, run-asset-archive-sweep v1. Three pg_cron jobs: reap_pending_uploads_hourly at :07, run_asset_archive_sweep_daily at 04:30 UTC, run_asset_hard_delete_daily at 05:00 UTC. Frontend Lovable prompts: 5.6 FileUploadField + ContentItemEditor.supabase_storage video branch + 5.7 AssetLibraryPicker + PromoteToLibraryButton + AssetLibrary page at /super-admin/asset-library + 5.6.1 swap XHR PUT to TUS resumable (fixes 413 on files >50MB) + 5.6.2 swap TUS auth from x-signature to Authorization Bearer user JWT (fixes Invalid Compact JWS) + use direct storage hostname svprhtzawnbzmumxnhsq.storage.supabase.co + uploadDataDuringCreation:true + 5.6.3 inline previews for video/audio/PDF (HTML5 video controls, HTML5 audio controls, 600px iframe for PDF) + Open-in-new-tab fallback for DOCX/XLSX/PPTX. Project-level Storage upload limit raised to 5 GB in Supabase Dashboard. End-to-end smoke tested: 151 MB MP4 uploaded via TUS, registry active, storage object exists at expected path with matching size, audit row landed, content_item.video_source_id updated, content_asset_refs active ref linked. Backend posture: SOC 2 CC6.1/CC6.3/CC7.2 audit chain enforced via Edge Function impersonation gate + RPC justification-required action types + WITH CHECK RLS predicates. New build queue items added for Session 59+: Prompt 7 thumbnails on parent entities (modules + content_items + curricula + cert_paths get thumbnail_asset_id column; Approach A author-uploads optional with BrainWise orange swirl placeholder fallback; defer video auto-extraction to Phase 4.5c when video pipeline matures); lesson-fetch endpoint for Phase 5 trainee learning UI (bulk-sign asset URLs from lesson_blocks config.asset_id + content_items.video_source_id + thumbnail_asset_id chains; 60-min signed URL expiry). Frontend NOT YET SHIPPED items moved out of v60 build-queue: native file upload UI (Prompt 5.6/5.7 SHIPPED), drag-and-drop reorder content items (still pending, no longer blocking).)*


*v60 - Session 57 CLOSE (Prompt 4 SHIPPED Session 56 + Prompt 5 SHIPPED + Prompt 5.5 SHIPPED Session 57. Prompt 5: polymorphic ContentItemEditor across 8 item_types + first live AI integration via draft-text Edge Function. All 12 smoke tests passed. Five draft-text versions deployed during testing: v3 fixed esm.sh@2.45.0 vs npm@2.57.2 supabase-js mismatch (getClaims didn't exist in 2.45.0), v4 fixed audit-log silent-fail (log_super_admin_action requires auth.uid() so must be called via callerClient not serviceClient), v5 stripped inline markdown from output + tightened system prompt. Auth/audit/version fixes ported to draft-lesson-block v2 and scaffold-lesson v2 same session for Prompt 6 readiness. RPC bug fixed: upsert_content_item COALESCE(v_video_completion_threshold, 95) ran unconditionally, forced 95 onto all non-video rows, violated content_items_video_fields_only_on_video CHECK; migration fix_upsert_content_item_video_defaults wrapped COALESCE inside WHEN 'video' branch. Voice-presets-patch shipped mid-session: hardcoded VOICE_PRESETS const had 3 wrong keys (academic_precise, warm_supportive, playful_energetic) that didn't exist in ai_authoring_voice_presets table; replaced with useQuery filtered by is_active. Prompt 5.5: pure file-moves refactor split ContentAuthoring.tsx 3928 → 802 lines + 5 editor files under src/pages/super-admin/editors/ (_shared.tsx 88L, CertPathEditor.tsx 806L, CurriculumEditor.tsx 854L, ModuleEditor.tsx 612L, ContentItemEditor.tsx 874L). Editor bodies byte-identical verified via diff. Total 4036 lines across 6 files vs 3928 original — delta is import duplication. Prompt 6 builds in new file from inception. End-of-session DB state: 1 active cert path (PTP-Coach), 1 active curriculum (PTP VILT 1), 1 active module (Test Module C), 2 active content items (Test Video Item, Test External Link), 1 archived content item (Test Written Summary), 1 successful ai_authoring_draft_generated audit row from Test 7. New build queue items added: native file upload UI (video/image/PDF/docx/xlsx/pptx/audio, scoped at Prompt 5.6 or later), drag-and-drop reorder content items.)*

*v59 - Session 56 IN-PROGRESS (Prompts 3.1, 3.2, 3.3, 3.4 SHIPPED — full Prompt 3 UX bug-fix cycle complete. ContentAuthoring.tsx ~1897 → ~2000 lines. (3.1) Auto-expand parent cert path after attach/create + await refetch. (3.2) Invalidate AttachedCurriculaSection cache after writes via queryClient.invalidateQueries threaded through new onInvalidateAttachedList prop. (3.3) Fix PostgREST FK-ambiguity: certification_path_curricula has two FKs to curricula (curriculum_id + prerequisite_curriculum_id) so implicit embed was returning null curricula; one-line fix to !curriculum_id syntax. This was the actual blocker for "attached curricula not displaying" — 3.1/3.2 were correct but didn't address the failing query. (3.4) Tree section rename "Standalone" → "All" with attached items included; pencil icon on AttachedCurriculaSection rows for inline edit navigation; selectNode rewritten to auto-expand ancestor chain when selecting cu: or mo: nodes via new reverse-lookup Maps. Two patterns locked Session 56 for Prompts 4-8: (a) key prop on all editor JSX usages forces remount on selection swap, (b) PostgREST FK-disambiguation required on all join-table embeds — add to recon checklist. End-of-session DB state: 1 active cert path (PTP-Coach), 1 active curriculum (PTP VILT 1), 1 attachment row. Modules/content_items still 0 — Prompt 4+ scope.)*

*v58 - Session 56 IN-PROGRESS (Prompt 3 SHIPPED + slug-uniqueness migration shipped. Prompt 3 verified end-to-end against all 20 acceptance criteria. ContentAuthoring.tsx 1130 → 1897 lines. CurriculumEditor sub-component, sentinel parsing for cu:new/cu:new:<cp-id>/cu:<uuid>, "Add curriculum to this path" Dialog fully wired (Pull-existing with author-configurable display_order/is_required defaults + search + Attach buttons; Create-new tab opens new-curriculum editor with attachment pre-bound), key props on all four editor JSX usages fix the useState-stale-on-mount bug. Cole then surfaced bug: archiving PTP-Coach cert path then trying to recreate with same slug returned 23505. Root cause: global UNIQUE on slug covered archived rows. Fix shipped Session 56 via migration slug_unique_only_among_active_for_authoring_tables: dropped *_slug_key UNIQUE constraints on certification_paths/curricula/modules, replaced with partial unique indexes (slug) WHERE archived_at IS NULL. Matches existing lesson_blocks_active_order_uniq pattern. Verified: archive-recreate now works; active-active collision still rejected with 23505. RPCs and frontend unchanged.)*

*v57 - Session 56 IN-PROGRESS (Prompt 3 — Curriculum editor — drafted and ready to send. Recon complete: curricula table 13 cols, upsert_curriculum 13-param RPC handles curriculum + optional attachment in one txn, archive_curriculum mirrors archive_certification_path. New sentinel pattern: cu:new (standalone), cu:new:<cert-path-id> (attached), cu:<uuid> (edit). audience_tags rendered as comma-separated text input (no chip primitive in codebase; premature to build). CertPathEditor gets four new props: allCurricula, attachedCurriculumIds, onRequestCreateAttachedCurriculum, onRefetch. "Add curriculum to this path" Dialog tabs both made functional. Attach-existing flow uses re-send-existing-values pattern through upsert_curriculum (cleaner attach_curriculum_to_cert_path RPC logged at build-queue line ~989 for Prompt 4-5 territory). Attach-existing tab gets author-configurable display_order + is_required defaults, with display_order seeded to attachedCurriculumIds.size (next available position) — fixes "everything attaches at position 0" collision bug. useState-stale-on-mount fix folded in via key prop on all four editor JSX usages (cp:new, cp:<id>, cu:new, cu:<id>) — establishes standing pattern for Prompts 4-8. 20 acceptance criteria. Sent next.)*

*v56 - Session 56 IN-PROGRESS (Step 1 SHIPPED + Step 2 SHIPPED. Step 2: Cert Path editor Lovable Prompt 2 sent and verified end-to-end against 15 acceptance criteria. ContentAuthoring.tsx 473 → 1130 lines. All structural landmarks correct: CERT_INSTRUMENTS/CERTIFICATION_TYPES/DELIVERY_MODES constants, slugify helper, AttachedCurriculaSection sub-component, CertPathEditor sub-component, breadcrumb + right-pane branch on selectedKey === "cp:new". Tested with first real cert path PTP-Coach (id 562a0536-...). Three retrospective items logged: (1) useState-stale-on-mount fix for CertPathEditor — fold key={initial?.id ?? "new"} into Prompt 3; (2) voice dictation + file upload as AI authoring input modalities (Phase 4.5d, 2 sessions, Web Speech API + Anthropic vision for images); (3) extend voice + file upload to /ai-chat, /my-results bubble, /shared-results bubble (Phase 4.5e, 2 sessions, requires ai-chat Edge Function extension + privacy policy update for file content disclosure). Phase 4.5 sequencing extended: 4.5a image → 4.5d authoring inputs → 4.5b voiceover → 4.5c video → 4.5e end-user AI inputs. Build queue Session 56 retrospective section captures all three. Step 1 (3 AI Edge Functions) still ACTIVE v1. See architecture-reference.md §29.5.)*

*v55 - Session 56 IN-PROGRESS (Step 1 SHIPPED + Step 2 recon COMPLETE + Phase 4.5 AI media scope added. Step 1: three AI authoring Edge Functions deployed v1 ACTIVE — draft-lesson-block, scaffold-lesson, draft-text. Step 2 recon: Cert Path editor Lovable Prompt 2 written and ready to send to Cole — backend RPCs verified, frontend seam at ContentAuthoring.tsx lines 449-466 identified, branding tokens locked (shadcn HSL, not marketing tokens), multi-select pattern adopted from CompanyDetail.tsx Checkbox grid, 4 instruments PTP/NAI/AIRSA/HSS only (INST-002L EPN excluded). Phase 4.5 AI media generation scope locked Session 56: Imagen 4 for image generation (Flux 2 Pro backup), ElevenLabs for voiceover, Synthesia for avatar video (Colossyan alt). Each is a separate Phase 4.5 sub-phase post-Prompt-6. ai_authoring_drafts capture table EXPLICITLY DEFERRED — current audit log row is sufficient at N=1 author; trigger to revisit is second author OR prompt-quality tuning needs. Frontend should keep last 3-5 AI outputs in local React state in Prompt 6 for in-session undo. See architecture-reference.md §29.5 for Edge Function deploy detail; build-queue Phase 4.5 section for media-generation scope.)*

*v54 - Session 56 IN-PROGRESS (Step 1 SHIPPED: three AI authoring Edge Functions deployed v1 ACTIVE — draft-lesson-block, scaffold-lesson, draft-text. Canonical `_shared/impersonation_gate.ts` extracted verbatim from production `set-account-type` v43 via `get_edge_function`. All three deploys curl-probed clean HTTP 401 anonymous; no module-bundling failures. Deploy followed §23.7's "Custom (set-account-type)" `entrypoint_path` pattern verbatim. End-to-end happy-path (super-admin → 200 with parsed AI output) and impersonation-denied path (403 IMPERSONATION_DENIED) deferred to first frontend integration in Lovable Prompt 5. Next: Lovable Prompt 2 — Cert Path editor — requires full 3-pass recon. See architecture-reference.md §29.5 for Session 56 deploy detail.)*

*v53 - Session 55 CLOSE (Phase 4 backend prep COMPLETE + Lovable Prompt 1 landed + invite-coach hardening FULLY shipped (backend + frontend) late-session. Backend additions: coach_invitations email tracking migration (email_send_status, email_send_error, email_last_attempt_at columns); invite-coach redeployed v10→v11 (resend-aware logic, proper email_type/source labeling, hard email-send failure surfacing, email status persistence). Resend button bug diagnosed and fixed end-to-end via test row. Cheryl's invitation flow verified separately. Frontend: Coach Management hardening Lovable prompt landed and verified — CoachManagement.tsx 495 → 584 lines, 4 invite-coach call sites use new inspectInviteCoachResponse helper, Email Status column with Sent/Failed/Pending badges, Retry Email button on failed rows. AI Edge Functions (3) drafted locally with full source bodies in handoff artifact but not deployed pending canonical _shared/impersonation_gate.ts source. Next session: (1) AI Edge Function deployment; (2) Lovable Prompt 2 — Cert Path editor. New build queue items added: audit all Edge Function callers for same data.results[] inspection bug pattern; add impersonation gate to invite-coach (Tier 2 backlog); delete diag-env-check throwaway function. See architecture-reference.md §28-§31 for full Session 55 detail.)*

*v52 - Session 55 CLOSE (initial close marker — superseded by v53 above after invite-coach hardening late-session).

*v51 - Session 55 IN-PROGRESS — superseded by v52 CLOSE marker above.

*v50 - Session 54 CLOSED (Group C Phases 1, 2, 3, 3.5 SHIPPED. Backend COMPLETE for Group C scope; Phase 4 frontend work begins Session 55. Phase 3 notification email channel verified end-to-end live: certification_granted dispatched via notify_user → user_notifications + pg_net.http_post → send-email Edge Function → Resend → email_logs row send_status=sent. Vault secret name correction shipped late-session: notify_user originally looked up 'internal_function_secret' (lowercase) but production vault row is INTERNAL_FUNCTION_SECRET (uppercase, created Session 48 alongside Edge Function Secrets sync). Migration groupc_phase3_10 fixed the lookup; no runbook setup needed. Phase 3.5 added: enroll_user_in_certification_path (fans out cert path enrollment → coach_certifications row + N user_curriculum_assignments with source=certification_path, idempotency guard rejects duplicate active enrollment of same certification_type, notifies via certification_enrolled important type), unassign_mentor (Tier 2; sets coach_mentor_assignments.ended_at + end_reason), unassign_curriculum (Tier 2; sets user_curriculum_assignments.status=unassigned preserving content_item_completions for CC7.2 audit retention). Both pre-existing coach_certification_actors (Q5 actor flow target) and coach_invitations (Q4A invitation lifecycle) verified to exist in schema from prior work. Group C deferred-to-future-session backend gaps logged: accept_coach_invitation RPC (Q4A — coach invitation accept does not currently create coach_certifications row; deferred until invitation-accept UX surfaces in dedicated phase), Phase 7 actor flow RPCs (per scope), audience_tag computation (Phase 5 problem when trainee learning UI consumes). Phase 4 starts Session 55: Lovable build of /super-admin/learning portal — cert path editor, curriculum editor, module editor, polymorphic content item editor, quiz authoring, mentor assignment UI, direct curriculum assignment UI.)*

## Priority key

- LAUNCH-BLOCKING: must complete before soft launch
- HIGH: completes the AIRSA dual-rater feature; needed for v1 of dual-rater
- MEDIUM: improves quality but not required for v1
- LOW: post-launch hardening

## Session 39 deltas summary

Phase 3e backend shipped end-to-end and verified. Six AIRSA AI section generators deployed. The 24-skill `airsa_skills` reference table created and seeded. `skill_level_breakdown` JSONB column added to `assessment_results` and populated by `calculate-scores` Branch A. `calculate-scores` v42 now fans out to all six AI section generators on manager submission, parallel to the legacy `generate-report` call. Storage convention for AI section content: rows in the existing `facet_interpretations` table with `section_type = 'airsa_<key>'`, mirroring the PTP/NAI pattern. NAI Saturation color refactor (#FFB703 to #7a5800) shipped via Lovable. Test fixture renamed (Maya Employee, David Supervisor) to make AI directional output debuggable.

## Session 40 deltas summary

Phase 3e frontend SHIPPED. AirsaCombinedReport.tsx (~1360 lines) deployed end-to-end. BUG-1 (MyResults isAIRSA detection) fixed. BUG-5 RETRACTED — code review of calculate-scores v42 Branch B and airsa_release_self_only RPC confirmed neither path re-stamps completed_at; the reported bug does not exist. The original 15-section spec became a 14-section spec: the developmental quadrant map (Section 10) was removed because it duplicated the lollipop's information in less-readable form and its 3x3 cell encoding wasn't glanceable. STATUS_COLORS canonical mapping locked with five distinct brand hues (Underestimate moved from teal to purple #3C096C). Star (★) semantics changed from static is_new_skill flag to dynamic top-3-priorities marker, surfaced only in Section 9 lollipop row labels. Action buttons standardized to PTP/NAI pattern (Export PDF / Retake / Take Another). Lollipop level-zone shading colors locked. Multiple visual polish iterations (v1 through v6 plus a hotfix for a Rules of Hooks violation introduced by the v6 prompt). Maya test fixture repaired (16 missing response_value_text values backfilled, skill_level_breakdown self_response field patched). Session 41 opens with Phase 4 PDF export.

## Session 41 deltas summary

Phase 4 SHIPPED. AIRSA combined report PDF export delivered end-to-end across three Lovable prompts: v1 (initial 5-file build covering generateAirsaPdf.ts, assemblePdfDataForUser.ts assembleAirsaPdfData export, ExportPdfModal AIRSA branch, MyResults dispatcher lift, AirsaCombinedReport onExportClick prop), v2 (four bug fixes: star ★ rendering as ampersand due to WinAnsiEncoding limitation, skill reference one-skill-per-page from incorrect entry-height calculation, top priorities cards splitting from same-shape height bug, methodology footer date showing em-dash placeholder from missing facet_data.generated_at field), v3 (Profile overview heading-orphan + narrow-wrap fix using sectionHeading minContentNeeded argument plus full CONTENT_W - 12 wrap width). Final 9-page PDF rendered cleanly across cover + 14 sections, jsPDF native primitives throughout, text fully selectable, lollipop rendered with native lines/circles preserving STATUS_COLORS canonical mapping including dash pattern on blind_spot only, level-zone shading bands present, ASCII asterisk replaces star glyph in PDF only (on-screen report keeps ★).

Phase 5 strategic frame designed and locked (build deferred to Sessions 42+). Five-tab IA mirroring PTP/NAI canonical structure (Overview / Domains / Skill Inventory / Manager Calibration / Trends + Cross-Instrument). Talent Calibration Index (TCI) locked as headline metric: % of pairs in aligned + confirmed_strength out of all assessed skill-pairs, 0-100 higher is better. Confirmed gaps do NOT count positive (real capability gap, not earned strength). Greatest Growth Opportunities / Strengths to Capitalize paired panels added on Overview tab between sub-metric cards and Calibration Map: top 2 skills + top 2 domains per panel, expand-link for full ranking. Composite Priority Score (CPS) formula locked: cps_growth = (1 - readiness_index) * misalignment_weight where misalignment_weight is bounded [1.0, 2.0] = 1 + (blind_spot_pct + confirmed_gap_pct) / 100; cps_strength = confirmed_strength_pct. Tie-breakers: growth prefers higher blind_spot_pct, strength prefers higher n. Calibration Map confirmed as visual centerpiece: 24-skill × N-departments heatmap using locked STATUS_COLORS by modal status, intensity by status %, priority markers (orange ▲ for top growth, green ◆ for top strength) on row labels tracking the active slice. Manager Calibration tab confirmed for v1 with min-3-reports privacy threshold. Cross-instrument tab confirmed for v1 matching PTP/NAI parity. Schema strategy locked: match PTP/NAI exactly, reuse org_dashboard_narratives with instrument_id = 'INST-003' carrying AIRSA-specific JSONB shape in dimension_scores + narrative_text columns; index_score column carries TCI. Aggregate cadence locked: live RPC computation per dashboard load (mirrors PTP/NAI get_instrument_aggregate pattern), no nightly cron, no aggregate table. AI narrative cached in org_dashboard_narratives, regenerated on user click. Phase 5 split into Phase 5a backend (RPC + Edge Function + schema additions) and Phase 5b frontend (5 tabs of UI) per Phase 3 precedent.

Two architectural learnings logged: (1) jsPDF default helvetica uses WinAnsiEncoding which excludes U+2605 (★); the encoder substitutes a fallback character (observed: ampersand). Loading custom Unicode fonts is heavyweight; safer pattern is to use ASCII-equivalent glyphs in PDFs and reserve Unicode for on-screen contexts. (2) jsPDF splitTextToSize uses the CURRENT font for width calc; setting font BEFORE calling splitTextToSize is the canonical pattern (already commented in generateNaiPdf.ts line 406-407). Skipping this produces correct text but wrong wrap width, causing entries to render at narrow column widths even when full content area is available. Section 6 Profile overview shipped with this bug in v2 and was fixed in v3.

## Session 42 deltas summary

Phase 5a backend recon completed across all 8 blocks. Production-realistic AIRSA test fixture seeded end-to-end on BrainWise Test Corp. Phase 5a build (RPC + Edge Function) deferred to Session 43.

Org structure built on BWE Test Corp. Created Executive department; moved 5 C-Suite users into it. Final department layout: Executive 5, Engineering 18, Finance 14, Marketing 13. Supervisor chain wired with 17 distinct supervisors, 10+ clearing the Manager Calibration min-3 threshold. Manager Calibration tab data quality is now sufficient to demo on the test org.

AIRSA fixture seeded. 46 new self+manager assessment pairs inserted alongside the existing Maya pair (47 total in production). 2,208 `assessment_responses` (46 × 24 × 2 raters). 46 `assessment_results` rows with full JSONB: `dimension_scores`, `manager_dimension_scores`, `self_manager_divergence` (with `status` field), `skill_level_breakdown`. All values derived server-side from responses; no AI calls used during seed.

Verified org-wide TCI = 40.1, with healthy status distribution: aligned 24.5%, underestimate 20.7%, blind_spot 20.3%, confirmed_gap 19.0%, confirmed_strength 15.6%. The mid-40 TCI gives the demo room to tell a real story (~40% in clear alignment, ~40% calibration mismatches, ~19% confirmed gaps as workforce risk).

Recon-driven decision corrections from the Session 41 frame:

- AIRSA org dashboard stays at 5 tabs. AI workforce narrative renders inline on Overview as expandable card, NOT a separate tab.
- No `'supervisor'` slice_type added. Existing `'team'` slice already routes by `supervisor_user_id`. Manager Calibration tab iterates supervisors inside the RPC rather than via a new slice_type. CHECK constraint migration is no longer needed.
- `org_dashboard_narratives` schema is sufficient as-is. No table migrations needed for Phase 5a.
- AIRSA org dashboard Edge Function will use Class A JWT via `auth.getClaims` (mirroring `generate-dashboard-narrative` v22), not Class B as the Session 41 handoff had specified.
- AIRSA scale labels confirmed: `0=Never, 1=Rarely, 2=Often, 3=Consistently` (NOT "Always"). Previously inconsistent in places.
- Domain coloring for AIRSA org dashboard deferred to Phase 5b. Start from individual results page colors; pull from the 8-9 brand palette colors.

No bugs surfaced or shipped in Session 42 (recon + seed only).


## Session 43 deltas summary

Phase 5a backend SHIPPED. Both pieces deployed and verified end-to-end against the Session 42 seeded fixture. No Lovable credits used.

**RPC: `get_airsa_aggregate(p_slice_type, p_slice_value)`** applied via two migrations (initial `create_get_airsa_aggregate_rpc`, then `fix_get_airsa_aggregate_suppression_check` to correct the suppression check from skill-pair count to participant pool size). SECURITY DEFINER, mirrors `get_instrument_aggregate` caller validation including supervisor-with-direct-reports gate against `corporate_contracts.supervisor_dashboard_enabled`. Returns full §10.6 JSONB shape: tci_overall, alignment_rate, blind_spot_rate, underestimate_rate, status_distribution, skill_aggregates (24 skills with CPS), domain_aggregates (8 domains with CPS), rankings (growth_skills, strength_skills, growth_domains, strength_domains, all CPS-sorted), manager_calibration (only supervisors with n>=3 reports). n=5 suppression on eligible pool. n=3 suppression on Manager Calibration entries. Instrument is implicit (always INST-003). Manager Calibration computed inside the RPC by iterating supervisors. GRANT EXECUTE TO authenticated.

**Edge Function: `generate-airsa-org-narrative` v1** deployed. Hybrid Class A + Class B auth: Class A JWT primary (frontend Regenerate AI button), Class B (X-Internal-Secret with `safeEqual` constant-time comparison) for future programmatic regen requiring `organization_id` in body. Mirrors `generate-dashboard-narrative` v22 structure. `claude-opus-4-6`, max_tokens 7000. AIRSA-specific calibration-focused prompt with 5-status framework, top-5 growth/strength rankings, top-3 manager blind-spot/underestimate panels. Banned words and phrases match individual AIRSA generators. INSERTs to `org_dashboard_narratives` append-only with `instrument_id='INST-003'`, `index_score=TCI`, full RPC payload in `dimension_scores`, AI JSON in `narrative_text`. Shared utilities: `_shared/secrets.ts` (safeEqual) and `_shared/errors.ts` (sanitized serverError). SOC 2 markers in code: CC6.1 hybrid auth + safeEqual, CC6.3 caller validation + org isolation via SECURITY DEFINER RPC, CC7.2 sanitized 5xx errors with no PII.

**RPC verifications passed:** TCI 40.1 against fixture (matches pre-build verification); status distribution 24.5/15.6/19.0/20.3/20.7; 24 skill_aggregates and 8 domain_aggregates returned; top growth = Skill 10 Identity Flexibility (cps_growth 1.803); top strength = Skill 23 Algorithmic Vigilance (85% confirmed_strength); 10 supervisors meeting n>=3 threshold; department slice 432 pairs/19 eligible/TCI 37.3; org_level IC slice 816 pairs/34 eligible/TCI 40.6; team slice with 5 reports 120 pairs/TCI 37.5; suppression triggers correctly at 1-report and 3-report teams; INSERT path simulation confirms all CHECK constraints pass and `index_score=40.10`.

**One implementation bug caught and fixed during verification:** First version of the RPC suppressed on `pair_count` (eligible × 24 skills), which would have allowed n=1 team slices through. Fixed in second migration to check `array_length(v_participant_ids)` directly, mirroring `get_instrument_aggregate` semantics. Documented as architectural constraint in arch-ref §8.

**Not verified by Session 43:** Full Anthropic-API-to-JSON-parse-to-INSERT happy path. Auth gate, RPC fetch, and INSERT shape verified individually but not chained through a real session token. First frontend call in Phase 5b will validate this. Edge function deployed v1 active, 282ms cold start, auth gate confirmed firing in logs.

Session 43 also consolidated all individual-instrument AI tone work into a single MEDIUM batch item (see "AI tone pass — DEFERRED BATCH" section below).

## Session 44 deltas summary

Phase 5b SHIPPED. AIRSA org dashboard live at `/company/airsa-dashboard` route, gated identically to NAI and PTP (RoleGuard `["company_admin", "org_admin", "brainwise_super_admin"]`). End-to-end verified against the seeded fixture across all 5 tabs.

**Backend delta**: `get_airsa_aggregate` RPC extended with `per_department_breakdown` field on every skill aggregate. Migration `add_per_department_breakdown_to_get_airsa_aggregate` adds two new CTEs (`skill_dept_agg` and `skill_dept_object`) that compute per-(department, skill) cells with n, tci, modal_status (most-frequent actual status value), blind_spot_pct, underestimate_pct, confirmed_strength_pct, and per-cell suppression flag. Cells with n<5 carry `suppressed: true`. Department-keyed (with `(unassigned)` fallback for null department_id). All Session 43 baseline values verified unchanged: TCI 40.1, pair_count 1128, status distribution 276/229/214/233/176, top growth Identity Flexibility 1.8030, top strength Algorithmic Vigilance 85.1064, 10 supervisors meeting n>=3 threshold. Department slice returns single-key per_department_breakdown. Wholesale eligible-pool suppression at n<5 still fires correctly. `generate-airsa-org-narrative` Edge Function v1 unchanged (reads RPC payload as opaque JSONB; new field passes through cleanly).

**Frontend delta**: New file `src/pages/company/AirsaDashboard.tsx` (single coordinated build across two prompts). Modifications to `src/App.tsx` (route addition with RoleGuard) and `src/components/AppSidebar.tsx` (Dashboards submenu third entry). All 5 tabs implemented:

- **Overview**: sticky header with TCI big number + 3 sub-metric chips; AI workforce narrative card with summary, Top 3 actions, and expand-for-full-narrative; Greatest Growth / Strengths to Capitalize paired panels (top 2 / top 5 expandable, with disambiguating subtitles for cps_growth 0-2 scale vs cps_strength %); Calibration Map (HTML CSS Grid, 24 skill rows × N department columns, locked STATUS_COLORS with dashed-border blind_spot, ▲ orange / ◆ green priority markers tracking active slice's CPS rankings, hover popover with n/TCI/blind/under, suppressed cells gray with n<5 tooltip); risk flags from latestNarrative.narrative_text.risk_flags
- **Domains**: 8 cards ordered by cps_growth DESC, each with colored dot, growth and strength CPS chips, big TCI, and status distribution stacked bar (4 segments since RPC currently returns confirmed_strength_pct, blind_spot_pct, underestimate_pct only; aligned + confirmed_gap combined into "Other" middle segment)
- **Skill Inventory**: sortable filterable table (default sort cps_growth DESC, click any column header to re-sort), domain filter dropdown, search by skill name, click-to-expand row showing per-department TCI cards using the new per_department_breakdown field
- **Manager Calibration**: Top 5 best-calibrated and Bottom 5 requiring-attention sections from manager_calibration array (already n>=3 suppressed in RPC), each card showing name, TCI, n_reports/n_skill_pairs, asymmetry label (Over-rates / Under-rates / Balanced via blind - underestimate threshold), blind/under breakdown
- **Trends + Cross-Instrument**: TCI-over-time LineChart from org_dashboard_narratives history filtered to instrument_id='INST-003' (renders empty state at 0 narratives, single-point notice at 1, full chart at 2+); placeholder cards for PTP×AIRSA and NAI×AIRSA correlations marked "Coming post-launch (Phase 7)"

**End-to-end verification first achieved this session**: full Anthropic-API-to-JSON-parse-to-INSERT chain on `generate-airsa-org-narrative` v1, validating the path Session 43 noted as not-yet-verifiable. Real session token POST returned 200 OK; row inserted at `org_dashboard_narratives` with index_score=40.10, participant_count=47, narrative_text containing summary + 3 top_interventions + 3 risk_flags + 5 interventions structured per the prompt JSON spec. AI narrative tone confirmed working end-to-end.

**Three latent bugs surfaced and fixed in Prompt 2**: (1) Team `<select>` was inheriting NAI/PTP pattern of populating from departments instead of supervisors, sending department_id where supervisor_user_id is expected — fixed via direct `users` table query under existing RLS, no new RPC; (2) slice control dropdowns lacked clearable first option after selection — first option labels changed from "Department ▾" / "Level ▾" / "Team ▾" to "All departments" / "All levels" / "All teams"; (3) cps_growth (0-2 composite) and cps_strength (%) panels lacked unit disambiguation — added italic subtitle line under each panel header. The first two bugs exist latently in NAI and PTP dashboards; deferred for post-launch fix to avoid regression risk on dashboards already in production use.

**Architectural constraint added** (arch-ref §8): when extending an existing RPC's payload shape, new JSONB fields pass through Edge Functions that read the payload as opaque (no field iteration in their own logic) without redeployment. Verified for `generate-airsa-org-narrative` consuming the new `per_department_breakdown` field with no Edge Function changes.

**Documented test fixture drift**: arch-ref §11.1 said Engineering 18, Marketing 13. Actual on Session 44 verification: Engineering 19 users (18 with AIRSA), Marketing 16 users (15 with AIRSA), Finance unchanged at 14, Executive still 5 users with 0 AIRSA. The 47 AIRSA pair total is unchanged from Session 42 close. Calibration Map renders 3 columns (Eng/Fin/Mkt) on the test fixture; Executive will appear automatically once seeded with AIRSA pairs. Not blocking.

**Risk-flag color bug observed but NOT fixed in Session 44**: HIGH risk flags render with Tailwind red (#dc2626 / #fee2e2 / #991b1b) instead of brand orange variants per arch-ref §6.1. Logged as top Session 45 priority below.

## Session 45 deltas summary

Multiple parallel tracks shipped this session: AIRSA dashboard PDF export, AIRSA AI workforce narrative voice rewrite, NAI dashboard PDF generator extraction (Option A foundation), risk-flag color fix, two PDF/UI rendering fixes, plus full recon and scope doc for the Org Overview Dashboard and AIRSA cross-instrument extensions.

**Sub-task 1 SHIPPED — Risk-flag color fix.** Per Cole's call (Option B over Option A), HIGH = solid `ORANGE` chrome with white badge text + ORANGE borderLeft preserved; WARN = `#fef0e7` peach fill + `ORANGE` 4px borderLeft + ORANGE badge text on tint. Three single-character edits in `AirsaDashboard.tsx` lines 750-776.

**Sub-task 3 SHIPPED — AIRSA org dashboard PDF export.** New file `src/lib/generateAIRSADashboardPdf.ts` (~1276 lines after Lovable). PTP-pattern mirror with AIRSA-specific helpers: `cleanMarkdown`, ASCII glyph substitutions (`^` for ▲, `+` for ◆), `sectionHeading(title, minContentNeeded)` anti-orphan pattern, page geometry (PAGE_W=210, MARGIN_L/R=15, CONTENT_W=180). Sections: Cover (NAVY hero band, 4-card metric strip) → Overview (calibration summary card + always-expanded narrative + 2 ranking panels + Calibration Map + risk flags) → Domains (8 cards stacked-bar) → Skill Inventory (24-row table, columns sum to 180mm) → Manager Calibration (top 5/bottom 5 cards) → Trends (TCI history table only). Calibration Map: 60mm skill column + dept columns at `(180-60)/N` mm, max 8 columns with overflow note, dashed border on blind_spot via `setLineDashPattern([1.5,1.5])` then reset. Filename: `BrainWise-AIRSA-CompanyDashboard-YYYY-MM-DD.pdf`.

**NAI PDF generator extracted.** New file `src/lib/generateNAIDashboardPdf.ts` mirrors `generatePTPDashboardPdf.ts` structure. Replaced ~890-line inline jsPDF block in `CompanyDashboard.tsx` lines 753-1644 with imported function call. Decisions locked: camelCase keys for `NAIDashboardPdfSections` (overview, dimensions, interpretation, leaderPerspective, trends, interventions, crossInstrument), full PTP modal mirror dropping "No data yet" indicators, 360px width modal, single h2 title. Surfaced previously-dead `interventions` section that was gated on a key never set under old kebab-case state.

**AIRSA AI narrative voice rewrite — `generate-airsa-org-narrative` v2 deployed.** Skill names confirmed at 13-37 chars (avg 21) — short enough to drop skill numbers from prose without bloating. New prompt structure: AUDIENCE block targeting CPO/VP HR; VOCABULARY RULES table mapping internal terms (cps_growth, blind_spot, underestimate, confirmed_strength, confirmed_gap, aligned-Proficient) to plain-English substitutes; expanded BANNED words/phrases (concentrate, underpin, compound, destabilising, "the symmetry of", "the data tells us"); SECTION STRUCTURES enforcing lead paragraph + 2-3 hyphen bullets + closing paragraph for business_meaning/benefits/risks; numbered sequence (no opener/closer) for next_steps; "What this means:" + "What to do:" hyphen-bullet block for risk_flags detail. TCI introduced as "Talent Calibration Index (TCI)" first, then TCI thereafter. Edge function source saved at `/home/claude/edge-functions/generate-airsa-org-narrative/index.ts`. Cole regenerated test org narrative — voice "is great" per his feedback.

**Two rendering bugs fixed (Prompts 3 + 4).** Both shipped first try.

Prompt 3 — `bodyText` helper in `generateAIRSADashboardPdf.ts`. Two fixes:
1. Font-state leak: `renderContinuationHeader` set 10pt italic and reset weight but not size, causing splitTextToSize-measured 8.5pt lines to render at 10pt and overflow right margin (visible page 3 of first AIRSA PDF). Fix: re-apply `setFontSize(8.5)`, `setFont("helvetica", "normal")`, `setText(BLACK)` inside the for-loop after `checkPageBreak()` and before `doc.text()`.
2. Bullet rendering: split text on `\n` first; detect lines matching `/^[-*]\s+(.+)$/` (bullets) or `/^(\d+\.)\s+(.+)$/` (numbered); render with 4mm hanging indent + 1mm extra spacing before each list item; wrapped continuation lines indent past prefix.

Prompt 4 — `renderNarrativeText(text, fontSize, color)` helper inside `AirsaDashboard.tsx`. Splits on `\n`, classifies each line, buffers prose into `<p>`, renders bullets as flex rows with `paddingLeft: 16, marginBottom: 4`, numbered items with hanging-indent flex layout. Replaced 7 render points (summary card + 5 expanded narrative subsections + risk flag detail).

Send order was Prompt 4 first (frontend, instant verification), Prompt 3 second (PDF re-export). Both landed perfectly.

**Sub-task 2 (originally "Phase 7 cross-instrument wiring + test fixture seeding") PIVOTED then SCOPED for future session.** Recon completed in full:
- Test fixture overlap verified excellent: 44 PTP+AIRSA users, 34 NAI+AIRSA users, 32 all-three. **Sub-task 2b (test fixture seeding) DROPPED entirely** — no seeding needed.
- `org_cross_instrument_recommendations` schema already instrument-agnostic. **No migration needed.**
- `trigger_logic` table inventory: 11 rules total. INST-003 source has only 1 generic rule (TRG-011). Existing v7 Edge Function does NOT read from trigger_logic — uses hardcoded `CO_ELEVATION_MAPPINGS` array (7 NAI↔PTP pairings).
- v7 Edge Function source review: hardcoded reject `if (!["INST-001", "INST-002"].includes(primary_instrument_id)) throw`. Two prompt builders both NAI↔PTP focused. AIRSA's data shape (TCI, alignment_rate, status_distribution, manager_calibration) fundamentally different from PTP/NAI dimension averages.
- Cole's decision: build BOTH the per-dashboard AIRSA cross-instrument AND a new Org Overview dashboard. Three-way analysis (NAI×PTP×AIRSA) lives ONLY on Overview. Per-dashboard tabs stay 1×1 pairings (PTP×AIRSA, NAI×AIRSA, plus existing PTP×NAI). B2 path locked: use trigger_logic as actual source of truth (vs B1 which would hardcode mappings in code mirroring v7).

**Comprehensive scope document produced** at `/mnt/user-data/outputs/org-overview-and-airsa-cross-instrument-scope.md` (~720 lines, 4 phases). Phase 1 = trigger_logic seed (~12 new rules). Phase 2 = new Edge Function `generate-airsa-cross-instrument-recommendations`. Phase 3 = new Org Overview dashboard at `/company/overview` with 6 headline numbers (2 per instrument), synthesis narrative, cross-cutting actions, deep-dive links, new `org_overview_narratives` table. Phase 4 = wire AIRSA cross-instrument cards on AIRSA dashboard's Trends tab + add ×AIRSA sub-tabs to PTP and NAI dashboards via shared `CrossInstrumentCard` component. Estimated 3-5 sessions to execute in full. Doc is upload-ready as a session-opener.

**Architectural learnings logged** (added to arch-ref §8):
- jsPDF font-state leak through `renderContinuationHeader` requires re-applying font state on EVERY `doc.text()` call inside a multi-line wrapped-text loop, not just before `splitTextToSize`. The previous §5.6 rule 2 only addressed the measure step, not the render step.
- Frontend bullet rendering for AI-emitted hyphen-prefixed lines requires explicit string-split + line-classification rendering. `whiteSpace: pre-wrap` preserves newlines but provides zero visual hierarchy. Pattern locked in `renderNarrativeText` helper, portable to other dashboards.

**Voice work decision**: AIRSA voice rewrite (this session) was a one-instrument case study. Action-Oriented Voice Redesign across NAI/PTP individual report and dashboard surfaces remains in build queue. Sequencing matters: Voice Redesign should ship BEFORE Org Overview, otherwise the Overview will surface NAI/PTP narratives in the old clinical voice while AIRSA shows the new voice — inconsistent.

## Session 46 deltas summary

Pivot session away from AIRSA / cross-instrument workstream toward coach-tier and supervisor-tier features. Two items shipped end-to-end.

**Group C Phase 8 (Item 37) SHIPPED — Order Assessment certification gating in `CoachClients.tsx`.** Cole flagged this as a clean carve-out from the larger Group C scope: gating layer reads from existing `coach_certifications.status` and `certification_type` columns, no new schema needed. Verified during recon that the live CHECK constraint allows four `certification_type` values (`ptp_coach`, `ai_transformation_coach`, `ai_transformation_ptp_coach`, `my_brainwise_coach`) and three `status` values (`in_progress`, `certified`, `suspended`) — both diverge from the Group C scope doc's stated enums. Phase 8 standalone uses the conservative gating rule: only `status = 'certified'` allows ordering; all other statuses block. Forward-compatible with Group C Phase 1's planned revocation enum extension (Q9). Decision locked: `my_brainwise_coach` certifies for all four instruments (PTP, NAI, AIRSA, HSS), same as Combined.

Mapping table locked at `CERT_TYPE_TO_INSTRUMENTS` in `CoachClients.tsx`:
- `ptp_coach` → {PTP}
- `ai_transformation_coach` → {NAI, AIRSA, HSS}
- `ai_transformation_ptp_coach` → {PTP, NAI, AIRSA, HSS}
- `my_brainwise_coach` → {PTP, NAI, AIRSA, HSS}

Frontend changes (single Lovable prompt): new `useEffect` fetching `coach_certifications` rows where `user_id = user.id AND status = 'certified'` on mount; derives `allowedInstrumentIds: Set<string>` via union of mapping table; filters the dialog instrument-list render at line 519; disables both "Order Assessment for New Client" (line 482) and "Order Assessment for This Client" (line 706) buttons when allowed set is empty, with tooltip "You need an active certification to order assessments"; renders empty-state message inside dialog with link to `/certifications` when allowed set is empty.

Test fixture: seeded one `coach_certifications` row for `testcoach@gmail.com` (account_type `coach`, `is_internal_test = true`, no organization). Verified 7-state matrix end-to-end: Combined → PTP-only → AI Transformation only → my_brainwise_coach → in_progress → suspended → zero-rows. All cases gated correctly. `auto_grant_combined_certification` trigger fires AFTER UPDATE only (not INSERT), so direct insertion of certified rows during seeding doesn't interfere — verified during recon.

Build Queue Item 37 closed. Group C Phase 8 absorbed.

**Shared Results "My direct reports only" toggle SHIPPED.** Replaced the previously-considered "My Team tab" idea (never written into the build queue, only floated in conversation). Single toggle pill on the existing `/shared-results` page, only visible when `get_my_direct_reports()` RPC returns ≥1 row for the viewer.

Backend: no new RPC needed. `get_my_direct_reports()` already exists (returns `out_user_id, out_email, out_full_name, out_org_level, out_department_id, out_department_name`).

Frontend changes (single Lovable prompt): two new state declarations (`directReportIds: Set<string>`, `myReportsOnly: boolean`); new `useEffect` calling `get_my_direct_reports()` on mount, storing the IDs; `myReportsOnly` reset added to existing instrument-change reset block (lines 57-77 region); filter clause added to `filteredPeers` memo: `if (myReportsOnly && !directReportIds.has(p.user_id)) return false;`; toggle pill rendered conditionally between department dropdown and existing supervisor dropdown, using shadcn `Button` with variant flip on active state, `Users` icon from lucide-react (already imported).

Verified end-to-end with `testclientbwe+supervisor@gmail.com` (David Supervisor, 2 direct reports: Demo Lane Nelson with PTP+AIRSA, Maya Employee with AIRSA only). Toggle hidden for non-supervisors implicitly (button doesn't render when set is empty). Toggle on AIRSA narrows correctly to both reports. Toggle on PTP narrows to direct reports who have shared PTP — zero in the current test fixture state since neither has completed PTP yet. All four filters (name, department, existing supervisor dropdown, new toggle) compose with AND semantics.

The existing supervisor-filter dropdown at `SharedResults.tsx` lines 173-185 is left intact. It does something different: it filters peers by `peer.supervisor_user_id === <some other supervisor>` rather than narrowing to the viewer's own direct reports. Latent bug noted but not fixed: the supervisors list at lines 87-93 only includes a supervisor if that supervisor is also a peer in the result list, so many supervisors silently won't appear in the dropdown. Not fixing in Session 46.

## Session 47 deltas summary

Group D backend (Phases 1-3 of the locked Group D scope) shipped end-to-end. Schema additions to `coach_clients`: `expires_at`, `revoked_at`, `invitation_source`, `client_first_name`, `client_last_name`. New `coach_pending_bulk_batches` table for stripe-webhook to recreate rows on coach-paid bulk checkout completion. New RPCs: `bulk_coach_invitation_create` (per-row BEGIN/EXCEPTION isolation, 75-row cap, certification gating reuse), `coach_invitation_revoke` (RPC + Edge Function pair). New Edge Function `bulk_coach_invite` v2. `create-checkout` extended with `coach_bulk_order` mode (Lovable-fragile per standing rule — verify `coach_user_id` after every Lovable prompt touching checkout-adjacent code). `stripe-webhook` v23 with new `coach_bulk_order` branch iterating over batch metadata, generating per-row coupons via `recalculateCombinedCouponForEmail` helper.

Session 47 was backend-only. Session 47-to-48 handoff was never written; Session 48 verified Session 47's backend during Phase 4-5 frontend work.

## Session 48 deltas summary

Single largest-shipping session in BrainWise history. Group D Phases 4-5-6 shipped (frontend + polish), email infrastructure shipped, refund automation shipped, terms of service updated.

**Group D Phase 4-5 frontend shipped.** Three Lovable prompts plus remediation. `BulkInviteModal.tsx` (607 lines, three-stage flow: Validate / Preview / Dispatch+Results, CSV upload via xlsx@^0.18.5, 75-row cap, cert gating, sticky defaults, payment_mode self_pay/coach_paid lowercase). `ShareableLinkModal.tsx` (287 lines, qrcode.react@^4.0.1 dependency added, both self-pay and coach-paid paths). `PendingInvitations.tsx` (Card→Tab refactor, query filters revoked_at IS NULL + expires_at, per-row Copy link / Revoke / Resend actions). `CoachClients.tsx` updated with DropdownMenu (Single client / Bulk invite / Generate shareable link), `perAssessmentPrice` state querying `subscription_plans` for dynamic price ($29.99 Per Assessment), URL parameter handler for `?bulk_checkout=success|cancelled`.

**Group D Phase 6 polish completed in two prompts.** Polish prompt (8 changes): Tooltip primitive replaces `title` attribute on disabled DropdownMenu trigger, empty-state cert gating, new stat semantics (`totalSignedUpClients`, `pendingInvitationsCount`, `assessmentsPending`), 4-card grid layout, `email_type` and `source` parameters added to send-email calls, `border-red-*` → `border-destructive`, PendingInvitations table tightening (MMM d dates, Coach/Self/Bulk/Single/Link badges). Stat fix prompt: `pendingInvitationsCount` filter corrected to exclude revoked + expired rows (was showing 23 instead of 21).

**email_logs table shipped (Option A + Option B).** Schema: id, email_type, recipient_email, subject, resend_message_id, send_status (sent|failed), error_message, source, sent_at, delivered_at, bounced_at, complained_at, last_status_event, last_status_at. RLS: super_admin SELECT only via account_type check, service role bypasses. 4 indexes (recipient_sent_at, resend_message_id partial, failures partial, problem_events partial). pg_cron `purge_email_logs_90d` daily 03:00 UTC. `send-email` v8: `logEmailDispatch` helper writing to email_logs on every code path with optional `email_type` and `source` parameters (default `unknown`). Captures Resend message_id.

**Resend webhook integration shipped.** `resend-webhook` Edge Function v1 verifies Svix signature (HMAC-SHA256 with `whsec_` prefix stripped), 5-minute timestamp freshness window. Looks up email_logs by resend_message_id, updates delivery status. If no match (Auth-system email), inserts new row with `email_type='auth_or_external'`. Endpoint: `https://svprhtzawnbzmumxnhsq.supabase.co/functions/v1/resend-webhook`. Subscribed events: email.sent, email.delivered, email.bounced, email.complained, email.delivery_delayed. Secret stored in Supabase Edge Function Secrets as `RESEND_WEBHOOK_SECRET`. Verified end-to-end: send-email writes row → Resend processes → webhook fires ~1s later → delivered_at populated.

**`coach_invitation_resend` Edge Function v1 shipped.** Per-client scope: clicking Resend on any pending row reminds client about ALL pending instruments under that coach. 24-hour rate limit per recipient_email + email_type='coach_reminder_pending' enforced via email_logs query. Class A JWT auth via auth.getClaims. shareable_link rows treated as first-send template ("Your coach prepared an assessment for you"). Other sources use reminder template ("Reminder: Your BrainWise Assessment is Waiting"). Error codes: unauthorized, not_found, rate_limited, nothing_to_remind, send_failed. PendingInvitations.tsx Resend button wired up with handleResend → toast variants per result. Rate limit verified end-to-end (second click within 24h returns "Reminder already sent recently" toast).

**Expiry sweep + auto-refund automation shipped.** Schema additions to `coach_clients`: `refunded_at`, `stripe_refund_id`, `refund_amount`, `refund_failure_reason`. Index on refunded_at DESC partial. New Edge Function `sweep_expired_invitations` v3 (Class C cron auth via `DISPATCHER_SHARED_SECRET` env, matches dispatch-grace-reminders convention). Filter: expires_at IS NOT NULL AND expires_at < NOW() AND revoked_at IS NULL AND assessment_id IS NULL. Per-row: stamps revoked_at → `recalcCouponAfterRevoke` (deletes Stripe coupon if last row, else recreates at lower amount) → `processAutoRefund` (per refund policy gate). Trigger metadata: `auto_expiry_sweep`. `coach_invitation_revoke` v3: added `processAutoRefund` helper alongside existing `recalcCouponAfterRevoke`. Trigger metadata: `manual_revoke`. Returns `refund: {refunded, amount, refund_id, reason}` in response. pg_cron `sweep_expired_coach_invitations` schedule moved from raw SQL UPDATE to `net.http_post` calling sweep_expired_invitations Edge Function. Schedule `45 3 * * *` (03:45 UTC daily, staggered after email_logs purge at 03:00 and dispatch_grace_reminders at 03:15). Vault secret name: `departure_dispatcher_shared_secret`.

**Locked refund policy (decision):**
- Auto-refund eligibility gate (ALL must be true): `coupon_redeemed = false AND assessment_id IS NULL AND payment_age <= 90 days AND payment_intent_id IS NOT NULL AND coupon_amount > 0`
- Both manual revoke AND automatic expiry trigger auto-refund through same `processAutoRefund` helper
- Individual purchases: 14-day refund window if assessment not started; manual processing only (no auto-refund Edge Function)
- Corporate contracts: all sales final per executed contract
- Verified end-to-end: real $29.99 refund processed against pi_3TVBck2FY7qIyIXA0xp2yuMN, refund_id `re_3TVBck2FY7qIyIXA0oApv0dD`, full pipeline (revoke → coupon deletion → refund → DB stamp) executed in ~1 second

**Schema additions to `assessment_purchases` for individual refund tracking** (manual processing only, no auto-refund): `refunded_at`, `stripe_refund_id`, `refund_amount`, `refund_failure_reason`, `refund_processed_by` (UUID FK users — audits which super_admin approved the refund).

**Terms of Service updated to v2** (effective May 9, 2026). Section 5.3 Coach-paid client assessments rewritten to reference auto-refund policy. Section 5.5 Refund policy rewritten with three buckets (Individual / Coach-paid / Corporate) and explicit eligibility rules. File path: `src/content/legal/termsContent.ts` (Terms.tsx is a thin wrapper consuming this content via LegalPageLayout).

## Session 49 deltas summary

Group A audit prequel SHIPPED + Group A Feature A1 Tier 1 backend SHIPPED. Larger than scoped at session open (originally just the prequel), but kept entirely backend-only and verified end-to-end before close. Cohort timeline preserved (Plan A confirmed: A1 frontend in Session 50, Group C starts Session 51).

**Audit log schema additions.** `super_admin_audit_log` got 9 new columns (ip_address, user_agent, reason, before_value, after_value, mode, expires_at, ended_at, end_reason) plus 2 new partial indexes (mode, session_id). `company_admin_audit_log` got 4 new columns (reason, before_value, after_value, super_admin_acting_as_user_id with FK to users) plus 1 partial index. Both tables had RLS preserved unchanged.

**Option C lookup table.** Replaced `super_admin_audit_log_action_type_check` CHECK constraint (15 hardcoded strings) with FK to new `public.super_admin_action_types` table. 19 action types seeded across 8 categories (15 carried from CHECK + 4 new for impersonation: impersonation_started, impersonation_ended, impersonation_action, impersonation_denied_action). Table includes metadata columns (requires_mfa, requires_justification, is_mutation, denylist_during_impersonation) for future enforcement use.

**`log_super_admin_action()` helper RPC.** Standardized argument signature `(p_target_user_id, p_target_org_id, p_action_type, p_before, p_after, p_reason, p_mode)`, returns inserted row's UUID. Actor derivation reads `request.jwt.claims` for `imp_actor_user_id` (Path 3 — works correctly pre-A1 with auth.uid() fallback AND post-A1 with impersonation claims). Session id from `imp_session_id` claim if present (so audit_session_replay groups all events from one impersonation). Mode prefixed with `impersonation:<imp_mode>:` when in impersonation context. Caller responsibility to gate on assert_super_admin (helper does NOT self-gate because in dual-attribution land auth.uid() = impersonated user).

**A1 impersonation infrastructure.** New `impersonation_sessions` table with immutability trigger (only ended_at + end_reason mutable, never DELETE), unique-active-per-admin INDEX (DB-level nested impersonation prevention), no-self-impersonation CHECK, justification length >= 10 CHECK. `validate_impersonation_session()` SECURITY DEFINER STABLE for cheap repeated calls. `assert_impersonation_allows()` enforces 9-category denylist mapped to scope 2.3.1-2.3.9 (identity_change, assessment_submission, privacy_consent, financial_transaction, outbound_user_communication, permission_change, corporate_admin_action, coach_action, lifecycle_action). Mode read from DB row not JWT (defense in depth).

**Custom Access Token Hook for impersonation claims.** `public.custom_access_token_hook(event jsonb)` injects imp_session_id, imp_actor_user_id, imp_mode, imp_expires_at into JWTs at issuance time. Auth method gate: only fires on `magiclink` or `token_refresh` (prevents target user's normal logins from inheriting impersonation context). EXCEPTION WHEN OTHERS wrapper ensures hook errors NEVER break platform auth. Cole registered hook in Dashboard → Auth → Hooks. 4 unit tests passing (no-session passthrough, auth-method-gate-blocks-password, magiclink-injects-all-four-claims, malformed-event-safe-fallback).

**MFA freshness via `check_mfa_freshness()`.** Service-role-only RPC reading `auth.mfa_amr_claims` for the caller's session, returns boolean for "TOTP within last p_max_age_seconds." Used by impersonation-start to enforce fresh-MFA gate (scope 2.2.7). Pattern B confirmed (Supabase Auth supports mid-session TOTP via auth.mfa.challenge() + auth.mfa.verify()).

**Three new Edge Functions.** `impersonation-start` v1: 8-gate pipeline (auth → super_admin → fresh MFA → target exists → not self → no nested → mode valid → justification valid), insert sessions row, write audit, generateLink + verifyOtp produces target-user session, hook decorates JWT with imp_* claims. Rollback on any post-insert failure. `impersonation-end` v1: ends session via impersonation token, dual-attribution audit row writes correctly via JWT-claim-aware helper. `sweep_expired_impersonation_sessions` v1: Class C cron auth, ends expired-but-not-ended sessions with end_reason='timeout', uses direct INSERT into super_admin_audit_log (cron-context exception since log_super_admin_action requires auth.uid()). Verified end-to-end: pre-expired test session swept, audit row written, ended_at = expires_at exactly.

**`*/5 * * * *` cron schedule.** `sweep_expired_impersonation_sessions` runs every 5 minutes (not the daily/15-min stagger convention) because impersonation sessions are 30-minute lifecycle. Worst-case post-expiry session lingering = 5 minutes server-side; frontend client-side timeout enforces the user-visible countdown.

**`_shared/impersonation_gate.ts` helper module.** Canonical Tier 2 enforcement helper. Exports `enforceImpersonationGate(client, category)` returning `{gated: false}` or `{gated: true, ...}` or throwing `ImpersonationDeniedError`. Plus `logImpersonationAction()` for callers to write impersonation_action audit rows after allowed mutations. Module deployed via `test-impersonation-gate` Edge Function (test-only) to validate bundling. Probe with no-auth confirmed clean 401 — module bundling resolved correctly.

**Edge Function reconnaissance complete.** Surveyed all 52 deployed Edge Functions (48 pre-Session 49 + 4 added this session). 27 require Tier 2 gating per scope 2.6.3 expanded for new functions (AIRSA supervisor flow, Group D coach functions, lifecycle functions, set-account-type — none of which were in the original scope's ~12-function list). 25 explicitly do not need gating with documented rationale: 8 per-user AI functions (user-scoped, ownership-checked), 3 cron, 2 webhook, 2 read-only, 3 internal helpers, 3 impersonation infrastructure, 3 public unauthenticated forms, 1 admin utility. Recon doc captured in Session 49→50 handoff.

**Architectural decision: Custom Access Token Hook over separate cookie.** Analyzed three options (JWT manual mint, separate cookie, Custom Access Token Hook). Chose Custom Access Token Hook with auth_method gate. Rationale: lowest build cost (~1 session backend vs 2-3 for cookie), preserves existing helper RPCs (no rework), single signed channel for SOC 2 defensibility, hook errors cannot break platform auth (EXCEPTION wrapper). Decision documented inline in custom_access_token_hook function comments.

**Edge Function `verify_jwt: false` convention preserved.** All Session 49 Edge Functions use `verify_jwt: false` with explicit `auth.getClaims` inside the function body. Matches existing convention. Build queue item: consider migration toward `verify_jwt: true` as SOC 2 hardening pass.

## Session 50 deltas summary

Tier 2 impersonation gate rollout PARTIAL — 17 of 23 in-scope Edge Functions spliced and probed. Floor was Phase A only; B and C did not start.

The 17 deployed: `set-account-type` v43 (permission_change), `ai-chat` v31 (outbound_user_communication), `delete-account` v8 (identity_change), `create-checkout` v49 (financial_transaction), `customer-portal` v35 (financial_transaction), `coach_invitation_revoke` v4 (coach_action), `coach_invitation_resend` v2 (coach_action), `reactivate-account` v8 (lifecycle_action), `airsa-supervisor-reminder` v4 (outbound_user_communication; recat from corporate_admin_action — self-rater initiates, not admin), `assign_epn_send` v9 (corporate_admin_action), `deactivate-and-notify` v7 (corporate_admin_action), `bulk-deactivate-and-notify` v7 (corporate_admin_action), `bulk_coach_invite` v4 (coach_action), `invitation_send` v10 (corporate_admin_action), `bulk_invitation_send` v9 (corporate_admin_action), `calculate-scores` v44 (assessment_submission), `submit-epn-assessment` v7 (assessment_submission). Each verified via no-auth probe (HTTP 401 or sanitized 500 — no module-bundling failures).

Four functions removed from the original 27-function Tier 2 list as misclassified: `peer-access-respond` and `verify-conversion` (email-link unauthenticated forms with token query param, no JWT possible) and `airsa-supervisor-invite` and `send-departure-emails` (Class B internal-secret receivers, no caller user JWT possible). Their CALLERS are gated, which is the correct architectural placement. Tier 2 list reduces from 27 to 23 functions.

Helper RPC behavior verified end-to-end via direct SQL JWT-claim simulation (5 test cases — all pass). DETAIL field format `imp_session_id=<uuid>` confirmed to match helper TypeScript regex `/imp_session_id=([0-9a-f-]+)/i`.

Three architectural learnings captured in architecture-reference.md §23:
- §23.2 Edge Function file-path conventions (4 distinct prefix styles)
- §23.3 Gate client requirement: anon-key + JWT, NEVER service-role (silent-failure mode)
- §23.4 Tier 2 recon corrections (4 functions reclassified)

Pre-existing security observation flagged but out of scope: `reactivate-account` allows any authenticated user to reactivate any deleted account by passing the email — no caller-vs-target ownership check. The impersonation gate adds defense for the impersonation case; the broader hole is a separate hardening item.

## Session 51 deltas summary

Tier 2 impersonation gate rollout COMPLETE — final 6 corporate_admin_action AI narrative generators shipped. 23 of 23 in-scope functions spliced.

Six functions deployed: `generate-departure-export` v8 (lifecycle_action — recon correction #5, recategorized from corporate_admin_action because caller is the deactivated employee retrieving their own data export, not an admin), `generate-airsa-org-narrative` v4 (HYBRID auth — gate only fires when `!isInternal`; internal-secret path skips the gate), `generate-cross-instrument-recommendations` v9, `generate-dashboard-narrative` v24, `generate-nai-delta-narrative` v12, `generate-ptp-delta-narrative` v9. Each verified via no-auth probe — clean HTTP 401.

One architectural delta surfaced and logged in architecture-reference.md §23.7: `Supabase:deploy_edge_function` prepends `source/` to the entrypoint_path automatically. Pass `entrypoint_path: "index.ts"` (naked, no prefix). Passing `source/index.ts` causes path doubling and BadRequestException. Discovered during the `generate-dashboard-narrative` deploy: first attempt with `source/index.ts` failed, retry with naked `index.ts` succeeded. This corrects/clarifies §23.2 which had implied the entrypoint_path was passed verbatim.

Phase B (A3 Phase 2 reporting RPCs), Phase C (A1 impersonation frontend), and Phase D (`/settings/access-history` page) move to Session 52. Group C Phase 1 originally targeted Session 51 → now Session 53 at earliest depending on whether Phase B/C/D fit in one session.

## Session 52 deltas summary

Phase B SHIPPED. Six SECURITY DEFINER RPCs deployed and verified for the audit reporting surface: `list_audit_events`, `audit_event_detail`, `audit_session_replay`, `export_audit_events`, `my_access_history`, `search_impersonation_targets`. All gated via `assert_super_admin()` except `my_access_history` (gated by `auth.uid() IS NOT NULL` since each user reads their own history). Filter shape locked as jsonb with seven keys: actor_user_id, target_user_id, action_type, date_from, date_to, mode, session_id. `export_audit_events` cap = 10,000 rows with `truncated` flag (graceful truncation, SOC 2 CC7.2 friendly). `my_access_history` UNIONs `super_admin_audit_log` (filtered on affected_user_id) and `company_admin_audit_log` (filtered on target_user_id) with an `audit_source` discriminator for the frontend. `audit_session_replay` returns single jsonb (`{session, events}`) for atomic gate + atomic session/event consistency. `pg_trgm` extension enabled to support ILIKE substring acceleration on user search. Full RPC catalog and design rationale in architecture-reference.md §24.

Phase B verification: production has 367 audit log rows across 10 distinct action types. Smoke tests confirmed: real-data joins working, filter exactness against COUNT ground truth, gate raises 42501 for non-super-admin callers, UNION isolation correct (orgmember test user shows 30 super_admin + 2 company_admin = 32 events, matches actor/target counts).

Phase C frontend recon COMPLETE. Read App.tsx, AppLayout.tsx, RoleGuard.tsx, ProtectedRoute.tsx, MfaChallenge.tsx, MfaEnrollment.tsx, useAuth.tsx, useUserProfile.tsx, useSuperAdminSession.tsx, AppSidebar.tsx, Settings.tsx, CompanyAccounts.tsx, PlatformHealth.tsx. Six integration decisions locked, captured in architecture-reference.md §25:

1. Banner injection at App.tsx-level (NOT AppLayout) so banner persists on bypass-AppLayout protected routes (Onboarding, MFA enrollment, demographic-form).
2. New `ImpersonationProvider` context between AuthProvider and Routes; reads JWT claims on every auth state change.
3. Impersonate entry: NEW `/super-admin/users` page (universal user search + row actions), NOT PlatformHealth or CompanyAccounts. Universal across account types, future actions slot in cleanly.
4. `MfaChallenge.tsx` gets one additive prop: optional `onCancel?: () => void`. Backwards-compatible.
5. `ProtectedRoute` does NOT bypass demographic/MFA/deactivation gates during impersonation (Option B locked) — Tier 2 backend denylist is the security layer.
6. Phase C is split into two prompts: C-1 (dormant infrastructure) and C-2 (entry + flow). Phase D is independent.

Three-prompt sequencing locked for Session 53:

- **Phase C-1**: ImpersonationProvider + ImpersonationBanner + ImpersonationChrome + MfaChallenge `onCancel` additive + App.tsx wiring + Tier 2 denylist audit.
- **Phase C-2**: SuperAdminUsers page + JustificationModal + sidebar nav update + redirectByRole update + impersonation-start/impersonation-end integration.
- **Phase D**: AccessHistory page + sidebar settings update + route registration.

Architecture-reference.md §20 schema clarification logged in §24.6: §20.1 and §20.2 ALTER TABLEs are CORRECT and verified against live DB. The actor column on `super_admin_audit_log` is `super_admin_user_id`, target is `affected_user_id`, org is `company_id`, jsonb detail is `detail`. The actor column on `company_admin_audit_log` is `actor_user_id`, target is `target_user_id`, org is `organization_id`, jsonb detail is `action_details`. Names matter for any RPC writing or filtering against these tables.

## Session 53 deltas summary

Phase C-1 pre-flight backend SHIPPED. Three Edge Function/migration deliveries unblocked the Phase C-1 Lovable prompt and closed two security gaps that Session 52 architectural decisions had assumed already covered.

**impersonation-end v2 (Session 53)**: Modified to mint fresh super admin tokens via generateLink + verifyOtp pattern (mirrors impersonation-start). Returns `{ success, restored: true, super_admin_user_id, access_token, refresh_token, expires_at }` at top level. Critical sequencing: ended_at set BEFORE generateLink fires, guaranteeing custom_access_token_hook does not stamp imp_* claims on the restored super admin token. Failure path returns `{ restored: false, restore_error }` with HTTP 200 — session is still ended at DB level even if token mint fails; frontend signs out and redirects to /login. Architecture-reference §26.1.

**is_impersonating() and is_impersonating_act() helpers + user_demographics RLS WITH CHECK (Session 53)**: Two SECURITY DEFINER STABLE helpers that read JWT claims for active impersonation, defense-in-depth verifying against impersonation_sessions DB row. Both granted EXECUTE to authenticated. user_demographics policy refactored from FOR ALL into split policies: SELECT allowed regardless of impersonation context (super admin observers can read), but INSERT/UPDATE/DELETE require NOT is_impersonating(). Both observe AND act mode block writes. Verification matrix passed all five scenarios. Architecture-reference §26.2.

**identity-mutation Edge Function v1 (Session 53)**: Single chokepoint for identity_change category mutations going through Supabase auth APIs (auth.updateUser for password/email; auth.mfa.enroll/unenroll). Class A explicit (verify_jwt=false; auth.getClaims inside). Calls enforceImpersonationGate("identity_change") first, raises 403 IMPERSONATION_DENIED for any impersonation context. Forwards via callerClient (pattern Z) so auth.mfa.enroll/unenroll work natively. Phase C-1.5 frontend rewires (folded into Phase C-1 prompt) point ResetPassword.tsx, Settings.tsx saveEmail, MfaEnrollment.tsx handleEnroll, and any unenroll surface at the wrapper. Architecture-reference §26.3.

**§25.9 partial reversal locked**: Original Session 52 decision that ProtectedRoute does NOT bypass demographic/MFA/deactivation gates during impersonation rested on the assumption that the Tier 2 backend denylist alone covered all paths. That assumption was false (RLS-only direct writes and Supabase auth APIs bypass the gate). With §26.2 and §26.3 closing the database and application paths, the frontend complement is to ALSO redirect /onboarding, /demographic-consent, /demographic-form, /mfa-enrollment, /peer-sharing-optin to /dashboard during impersonation. Defense in depth, three layers. Architecture-reference §26.4.

**Phase C-2 hotfix (mid-session 53)**: `/super-admin/users` page crashed with blank screen + console TypeError when search results contained any user with `account_type IS NULL`. Two production users in this state (`test@test.com`, `testclientbwe+testnewuser@gmail.com`) — both half-finished signups where the user authenticated but never picked an account type. Root cause: `formatAccountType` and `accountTypeBadgeVariant` in Users.tsx called `.split(...)` and `switch` on null. Fixed at the backend layer by patching `search_impersonation_targets` to `COALESCE(account_type, 'unknown')` so the RPC contract effectively guarantees a string. Frontend null-guards (Layer 2) added as defense in depth via small follow-up Lovable prompt. Schema-level fix to `users.account_type` nullability deferred — see new build queue item below.

**Three new build queue items logged (Session 53 mid)**:

- **MEDIUM (post-launch)**: Refactor `current_user_mfa_satisfied()` from factor-existence check to session-AAL check. Currently a user with a verified factor returns mfaSatisfied=true regardless of session aal1/aal2 — weaker than Supabase native AAL-based enforcement. Required for proper post-impersonation re-MFA flow. Architecture-reference §26.6.
- **LOW (post-launch)**: Replace hardcoded `v_denylist text[]` array in `assert_impersonation_allows` with a SELECT against a new `super_admin_denylist_categories` table. Drop the vestigial `super_admin_action_types.denylist_during_impersonation` column in the same migration. Benefits: queryable denylist for SOC 2 evidence collection. Architecture-reference §26.5.
- **LOW (post-launch)**: Audit other RLS-only direct-write tables for impersonation gaps. user_demographics was the obvious one; sweep for `users` self-update fields, `user_subscription_preferences`, `user_results_consent` etc. Add `NOT is_impersonating()` to WITH CHECK on any table where a super admin should not be able to mutate as the target.
- **MEDIUM (post-launch)**: Investigate and clean up `users.account_type IS NULL` rows. Currently 2 users in this state (1 marked is_internal_test=true, 1 marked false despite testclientbwe email pattern). Either backfill to `individual` based on signup intent, or constrain the column NOT NULL once data is clean. Today's hotfix masks the symptom at the RPC layer (COALESCE to 'unknown') but the underlying schema permits a state that no UX can produce intentionally.
- **HOOK HARDENING SHIPPED Session 53 close**: `custom_access_token_hook` now distinguishes legitimate impersonation-start token mints from stranded-session contamination. For `'otp'`/`'magiclink'` initial mints, the hook requires the matching `impersonation_sessions` row was created < 60 seconds ago (impersonation-start mints within ~2s; stranded rows are minutes+ old). For `'token_refresh'`, the hook requires the incoming JWT already carries `imp_session_id` matching the active row (refreshes preserve, never create). Investigated `auth.sessions` DELETE trigger as alternative; Supabase does NOT delete auth.sessions on logout (only expires them via expires_at), so a delete trigger would never fire on signOut events. The hook freshness gate solves the same problem at the right layer. Stranded rows still get cleaned by the existing 30-min cron sweep, but they can no longer pollute subsequent target-user logins while pending cleanup.

- **NICE-TO-HAVE (post-launch)**: Frontend `SIGNED_OUT` listener that calls `impersonation-end` before the JWT is destroyed. Belt-and-suspenders on top of the hook freshness gate. The user clicks Log Out → ImpersonationProvider's auth state listener catches `SIGNED_OUT` → calls impersonation-end if currently impersonating → updates DB row ended_at promptly. Race condition risk: JWT may already be invalidating by the time the call fires, so impersonation-end could 401. Acceptable — the cron sweep is the floor, the hook gate is the security boundary, this would just clean up the audit timeline faster.
- **LOW (post-launch)**: AccessHistory.tsx frontend null-guard for `formatActionType(action_category)`. Backend defense added in Session 53 (RPC now COALESCEs `action_category` to `'organization_admin_action'` for company_admin source rows), but frontend also calls `.replace()` on the value so a future RPC regression would crash again. Mirror the pattern from Users.tsx null-guard work.

Phase C-1, C-2, D Lovable prompts unblocked. Session 53 continues with frontend prompts.

**Phase C-2 frontend SHIPPED**: One Lovable prompt covering 7 files. 2 new (Users.tsx super admin search page with debounced query, kebab-dropdown action menu per row, separator above destructive Force pseudonymization stub; JustificationModal with two-step flow — justification + mode radio, then embedded MfaChallenge with onCancel back-to-step-1, plus error-code-aware toasts for MFA_REQUIRED/NESTED_IMPERSONATION/SELF_IMPERSONATION/TARGET_NOT_FOUND); 5 modified (ImpersonationProvider extends interface with targetEmail field populated via localStorage stash keyed by session_id, with cleanup in all three endImpersonation branches; ImpersonationBanner displays email when present and falls back to monospace user_id; App.tsx registers /super-admin/users route with RoleGuard + SuperAdminSessionProvider wrapping pattern and replaces /super-admin layout-only fallback with Navigate redirect; useAuth.redirectByRole changes super admin landing from /super-admin/health to /super-admin/users; AppSidebar adds User Management nav entry with UserSearch icon between My Results and Platform Health). Verified file-by-file post-Lovable: kebab-dropdown action pattern with five menu items in correct order, account type badges per the brand mapping (destructive for super_admin, default for org/company admin, secondary for coach, outline for individual/corporate), self-impersonation prevention at UX layer, debounced search at 250ms with p_limit 25, all four table states handled (empty/loading/error/no-results/results). Architecturally Phase C is complete; end-to-end impersonation flow live pending Cole's manual integration test.

**Phase D frontend SHIPPED**: One Lovable prompt covering 3 files. 1 new (AccessHistory.tsx at /settings/access-history — six columns When/Action/Actor/Source/Mode/Reason, source badges destructive=Super Admin/default=Org Admin, mode badges secondary=Observe/outline=Act, pagination 50 per page hidden when single page, Path A CSV export with 200-per-call RPC pagination up to 1000 cap, all states handled). 2 modified (App.tsx registers route as sibling of /settings/billing, no RoleGuard needed since auth wrapper handles it; AppSidebar adds Access History entry to BOTH settingsSubItems and coachSettingsSubItems arrays between Privacy & Permissions and Billing & Receipts using already-imported History icon). Verified file-by-file post-Lovable: pagination logic correct, CSV column structure matches spec, data flowed through cleanly.

**Mid-session hotfixes shipped (Session 53)**:

- search_impersonation_targets COALESCE account_type and paginated default-load (multi-field search across email + full_name + organization_name; total_count window function for pagination; includes self after frontend self-impersonation prevention proven sufficient at UX layer)
- check_mfa_freshness reads BOTH auth.mfa_amr_claims AND auth.mfa_challenges.verified_at (Supabase doesn't write amr_claims rows on subsequent mfa.verify calls of an already-aal2 session; the verified_at fallback bridges this) — Architecture-reference §26.8
- custom_access_token_hook accepts 'otp' as valid impersonation auth method (Supabase records verifyOtp({type:'magiclink'}) as 'otp' regardless of link type), then tightened with 60s freshness gate so stranded sessions can't contaminate normal user logins — Architecture-reference §26.7
- log_super_admin_action skips impersonation: prefix on lifecycle events (impersonation_started, impersonation_ended, impersonation_denied_action) for grouping parity — Architecture-reference §26.9
- my_access_history defaults action_category to 'organization_admin_action' for company_admin source rows (RPC was returning NULL which crashed AccessHistory.tsx formatActionType) — Architecture-reference §26.11
- identity-mutation friendly error toasts via new src/lib/identityMutation.ts helper that parses error.context.json() for FunctionsHttpError and surfaces "This action is blocked while impersonating" message for IMPERSONATION_DENIED code — Architecture-reference §26.12

**Manual integration tests passed end-to-end (Session 53 close)**:

- T1.1-T1.22: User Management page — landing redirect, sidebar entry, default 25-user load, pagination Next, org search, kebab dropdown structure, null-account-type "Unknown" badge rendering without crash
- T2.1-T2.7: Dropdown menu — Impersonate enabled, four stubs disabled with "(coming soon)", separator above Force pseudonymization
- T3.1-T3.18: Justification modal — title, description with target email, justification gate at 10 chars, mode radio with Observe default, character counter, Continue gate, embedded MfaChallenge step 2, full chrome on impersonation start (orange banner with OBSERVE/ACT pill, target email, countdown 30:00→0, Exit button, red 4px viewport border, [IMPERSONATING] tab title, navy "B" red dot favicon)
- T4.1-T4.5: Exit Impersonation — banner removed, border removed, tab title restored, lands on /super-admin/users, sidebar shows super admin nav
- Audit log query: impersonation_started + impersonation_ended pair linked by session_id with 20-second duration and end_reason='manual'; lifecycle events have clean mode column ('observe', not 'impersonation:observe:observe')
- T-E: Self-impersonation prevention — search cbastian, confirm Impersonate disabled with "(cannot impersonate yourself)" hint
- T-B: Act-mode denylist (security half) — email change attempt during act mode returned 403 IMPERSONATION_DENIED, Phil's email unchanged in DB
- T-B-UX: Act-mode denylist (UX half after hotfix) — friendly toast: "This action is blocked while impersonating. Identity changes (email, password, MFA) are not permitted during impersonation, even in act mode."
- T-C-RLS: user_demographics RLS WITH CHECK — gender_identity edit attempt and consent_withdraw button both showed optimistic toast success but DB writes blocked at RLS layer; hard refresh restored Phil's actual values; SQL verification confirmed gender_identity=Man and consent_withdrawn_at=null untouched. **Most important security verification of the entire impersonation security stack passed.**
- T-C: ProtectedRoute gate-redirect — manual /demographic-form URL navigation while impersonating bounces to /dashboard (banner persists)
- T-D: Phase D Access History — orgmember view shows 36 events on record (30 super_admin + 4 impersonation lifecycle + 2 company_admin), all six columns render correctly, badges display per brand mapping, CSV download produces well-formed file with all 36 rows

## Session 53 close — Group A Phase C + Phase D done

Group A architectural state at end of Session 53:

| Item | State |
|---|---|
| A1 — User impersonation | **DONE** end-to-end (backend + frontend + UI flow + audit verification + RLS + denylist) |
| A2 — Direct user editing | Tier 1 backend SHIPPED Session 49; remainder DEFERRED behind Group C |
| A3 Phase 1 — Audit schema additions | DONE (Session 49) |
| A3 Phase 2 — Reporting RPCs | DONE (Session 52: list_audit_events, audit_event_detail, export_audit_events, audit_session_replay) |
| A3 Phase 3 — Super admin /super-admin/audit reporting UI | DEFERRED behind Group C |
| A3 Phase 4 — User-facing /settings/access-history | **DONE** Session 53 |
| A3 Phase 5 — Quarterly review runbook | OPERATIONAL, not code; first review due 90d after launch |

Cole's intent at Session 53 close: Group C ships next, then the residual Group A super-admin assignment + completion-tracking work for curricula/modules/content items follows immediately. Group C Phase 4 (authoring UI Option A) already includes super admin curriculum/module/cert path management portal at /super-admin/learning, including direct curriculum assignment, mentor assignment, and cert path enrollment. So most of what Cole wants on the super admin LMS-management side gets built as part of Group C Phase 4 if Option A is chosen at Session 54 start.

## Session 54 opening — Group C Coach Certification + Resources / Learning Paths

Two source documents in project knowledge:

- **BrainWise_Group_C_Scope_Coach_Certification_v1.docx** — locked at Session 34 scoping; 13 foundational decisions Q1-Q13, 17 tables (15 NEW, 2 EXTENDS), 10 build phases
- **BrainWise_Group_A_Scope_Super_Admin_Core_v1.docx** — for cross-reference; Q4B in Group C (super admin direct enrollment) is shared infrastructure

Phase 1 (schema) is the immediate first task. All 17 tables, RLS, indexes, notification types catalog seed data. Backend-only, verified via SQL. See session-handoffs/session-53-to-54.md for full Phase 1-10 sequencing.

**Phase 4 Option A LOCKED at Session 54 start.** Full authoring UI in /super-admin/learning. Covers cert path editor, curriculum editor, module editor, content item editor (polymorphic by item_type), quiz authoring with question bank and answer options, mentor assignment UI, direct curriculum assignment UI. Rationale: Cole's stated intent is super-admin LMS-management tooling out of this build; Option A delivers that natively as part of Phase 4 rather than as a separate post-Group-C workstream. Data model identical to Option C, so Phase 1 schema work is unaffected by the option choice; only Phase 4 surface differs.

**Two standing rules apply to all Group C work (and forward):**

**Rule 1 — SOC 2 compliance built in from inception.** Every table, RPC, Edge Function, and migration in Group C must satisfy CC6.1 (RLS + caller validation), CC6.3 (least privilege via SECURITY DEFINER + explicit GRANT), CC7.2 (sanitized errors, no PII leakage). Markers called out inline on each migration the way Sessions 49–53 did for impersonation infrastructure. Audit columns (`created_by`, `updated_by`, `created_at`, `updated_at`) present on every authoring/configuration table for content provenance.

**Rule 2 — Impersonation gate built in from inception.** Every new RPC and Edge Function performing a mutation gets categorized against the 9-category denylist (architecture-reference §21.3) at design time. Every RLS WITH CHECK on a user-self-write table includes `NOT public.is_impersonating()` from day one, mirroring §26.2's user_demographics pattern. Every super-admin-write RLS policy includes `NOT public.is_impersonating()` in WITH CHECK as defense in depth (Session 54 Migration 08.5 established this for the 6 catalog tables; all subsequent tables follow the pattern from inception). This is the lesson from Sessions 49-53: we retrofit §26.2 + §26.3 + §26.4 because impersonation security wasn't designed in from the start; Group C does not repeat that pattern.



## Group C three-week sequencing plan (revised Session 49)

**Cohort target: three weeks from Session 48 close.** Plan A confirmed Session 49: Tier 2 backend + A3 Phase 2 + A1 frontend land before Group C starts (Cole prefers to finish A1 while context is fresh). Group C ships Sessions 51-60 instead of 50-58 — slight slip but still within the cohort window.

### Session 49 (SHIPPED)

Group A audit prequel + Group A Feature A1 Tier 1 backend SHIPPED:
- `super_admin_audit_log` 9 new columns + `company_admin_audit_log` 4 new columns
- `super_admin_action_types` lookup table (Option C) replaces CHECK constraint, 19 action types seeded
- `log_super_admin_action()` helper RPC with JWT-claim-aware actor derivation
- `impersonation_sessions` table with immutability + unique-active-per-admin
- `validate_impersonation_session()`, `assert_impersonation_allows()` RPCs (full 9-category denylist)
- `check_mfa_freshness()` RPC, `custom_access_token_hook()` Postgres function
- 3 new Edge Functions: `impersonation-start`, `impersonation-end`, `sweep_expired_impersonation_sessions` (cron at `*/5 * * * *`)
- `_shared/impersonation_gate.ts` helper module deployed via `test-impersonation-gate`
- Full reconnaissance of all 52 deployed Edge Functions: 27 require Tier 2 gating, 25 explicitly do not
- Cole registered hook in Dashboard ✓

### Session 50 (Tier 2 + A3 Phase 2 + A1 frontend — Plan A)

Cole's preference: finish A1 entirely before Group C. Session 50 may absorb all of Tier 2 + A3 Phase 2 + A1 frontend OR may break naturally between phases.

**Phase A: Tier 2 backend rollout** — splice `enforceImpersonationGate(callerClient, "<category>")` into 27 Edge Functions per the recon classification (see Session 49→50 handoff for full list with categories). Per-function deploy verification via no-auth probe = clean 401 (not 500).

**Phase B: A3 Phase 2 backend** — four reporting RPCs: `list_audit_events()`, `audit_event_detail()`, `audit_session_replay()`, `export_audit_events()`. SECURITY DEFINER, super-admin gated. Plus user-scoped variants for the access-history page.

**Phase C: A1 impersonation frontend** — justification modal with mode selector and target user lookup, fresh MFA TOTP challenge before impersonation-start, persistent orange banner with countdown / mode / Exit button, browser tab title prefix `[IMPERSONATING]`, favicon swap with red dot, 2px red viewport border, token swap logic for impersonation access_token + refresh_token, exit flow calling impersonation-end.

**Phase D: `/settings/access-history` page** — user-facing access history for all users (launch blocker A1 per scope 2.4.2). Shows impersonation sessions, super admin direct edits (when A2 ships), individual_record_viewed events affecting the user. Read-only, paginated, CSV export.

Natural break points: end of Phase A → Session 51 starts Phase B; end of Phase B → Session 51 starts Phase C; etc. Group C Phase 1 always starts in the session AFTER Session 50's last phase completes.

### Sessions 51-60 (Group C Phases 1-10, Option A)

Same compressed phase ordering as before, just shifted by 1 session:
- **Session 51**: Phase 1 (Schema, all 17 tables) + Phase 2 start (Core RPCs)
- **Session 52**: Phase 2 finish + Phase 3 (Notifications subsystem)
- **Session 53**: Phase 4 start (Authoring UI cert path / curriculum / module CRUD)
- **Session 54**: Phase 4 finish (Content item editor polymorphic UI, quiz authoring) — Cole starts authoring PTP content after this lands
- **Session 55**: Phase 5 start (Trainee learning UI shell + first 3 content viewers)
- **Session 56**: Phase 5 finish (remaining content viewers, video progress, cert path detail)
- **Session 57**: Phase 6 (Mentor review UI)
- **Session 58**: Phase 7 (Actor flow) + Phase 8 verification (Order Assessment gating already shipped Session 46)
- **Session 59**: Phase 9 (Resources tab redesign) + Phase 10 (Polish)
- **Session 60**: Buffer / launch readiness

### Sessions 61-65 (Group A remaining work)

A2 (direct user editing — Tier 1/2/3 fields), A3 Phase 3 super admin reporting UI, A3 Phase 5 quarterly review runbook, refund processing UI for individuals.

### Parallel work (Cole)

- Authoring PTP cert path content in the UI starting Session 54 onward
- Privacy policy update with admin-access clause (hard launch blocker for A1, scope 2.4.1)
- Coordinate with auditor on A1 design before launch (scope section 6.2 known gaps)

### Risk register

- Tier 2 rollout risk: 27 deploy splices means 27 chances to break a production function. Per-function probe verification mitigates. Rollback path: `get_edge_function` previous version + redeploy. Highest single Session 50 risk.
- Lovable disasters on polymorphic content editor (Phase 4 / Session 53-54) — second highest
- Decision stalls during build (build sessions need fast Cole responsiveness)
- Cohort content authoring stalling — Cole is the bottleneck if authoring runs slower than UI ships
- Notification subsystem bugs cascading into all later phases (Phase 3 needs thorough impersonation testing)
- A1 launch blockers (privacy policy update, access-history page) are NOT on the Group C critical path — A1 launch can lag cohort by sessions

## Build queue items added Session 49

- **Tier 2 enforcement rollout** (Session 51 COMPLETE — 23 of 23 functions shipped)
  - SHIPPED Session 50 (17 functions): set-account-type v43 (permission_change), ai-chat v31 (outbound_user_communication), delete-account v8 (identity_change), create-checkout v49 (financial_transaction), customer-portal v35 (financial_transaction), coach_invitation_revoke v4 (coach_action), coach_invitation_resend v2 (coach_action), reactivate-account v8 (lifecycle_action), airsa-supervisor-reminder v4 (outbound_user_communication; recat from corporate_admin_action — self-rater initiates, not admin), assign_epn_send v9 (corporate_admin_action), deactivate-and-notify v7 (corporate_admin_action), bulk-deactivate-and-notify v7 (corporate_admin_action), bulk_coach_invite v4 (coach_action), invitation_send v10 (corporate_admin_action), bulk_invitation_send v9 (corporate_admin_action), calculate-scores v44 (assessment_submission), submit-epn-assessment v7 (assessment_submission)
  - SHIPPED Session 51 (6 functions): generate-departure-export v8 (lifecycle_action — recon correction #5, recategorized from corporate_admin_action), generate-airsa-org-narrative v4 (corporate_admin_action HYBRID — gate only when !isInternal), generate-cross-instrument-recommendations v9 (corporate_admin_action), generate-dashboard-narrative v24 (corporate_admin_action), generate-nai-delta-narrative v12 (corporate_admin_action), generate-ptp-delta-narrative v9 (corporate_admin_action). All probed clean HTTP 401.
  - **CORRECTIONS Session 50** (4 functions): `peer-access-respond` and `verify-conversion` (email-link unauthenticated, no JWT possible); `airsa-supervisor-invite` and `send-departure-emails` (Class B internal-secret receivers, no caller user JWT). All four reclassified to "explicitly NOT gated"; their CALLERS are gated. Tier 2 list reduced 27 → 23.
  - **CORRECTION Session 51** (1 function): `generate-departure-export` recategorized from corporate_admin_action → lifecycle_action. Caller is the deactivated employee retrieving their own data export, not an admin. Both denylisted equally; runtime identical, audit label more accurate.
  - **VERIFICATION** (Session 50 + 51): Full helper RPC behavior tested end-to-end via direct SQL JWT-claim simulation. DETAIL format `imp_session_id=<uuid>` matches helper regex. Per-function probe: every deployed function returns expected 401 (no module-bundling failures). Frontend integration test deferred to Phase C completion.
- **A3 Phase 2 reporting RPCs** [SHIPPED Session 52] — six RPCs deployed and verified: list_audit_events, audit_event_detail, audit_session_replay (single-jsonb shape), export_audit_events (10k cap with truncated flag), my_access_history (UNION across both audit tables with audit_source discriminator), search_impersonation_targets (gin_trgm-backed user search). Full RPC catalog and rationale in architecture-reference.md §24. Hard-blocker resolved.
- **A1 impersonation frontend Phase C-1** (Session 53) — dormant infrastructure: ImpersonationProvider context, ImpersonationBanner, ImpersonationChrome (tab title + favicon + red border), MfaChallenge `onCancel` additive prop, App.tsx wiring, Tier 2 denylist audit (verify demographic-form-submit + mfa-enrollment-completion are denylisted). Recon complete (architecture-reference.md §25.1-§25.3, §25.6, §25.7, §25.8, §25.9). Pre-flight: read `impersonation-start` and `impersonation-end` Edge Function source to confirm response token shape before writing frontend code.
- **A1 impersonation frontend Phase C-2** (Session 53 if pacing allows, else Session 54) — entry + flow: NEW `/super-admin/users` page (universal user search via `search_impersonation_targets` RPC + row actions), JustificationModal (10-char min + observe/act selector + embedded MfaChallenge), sidebar superAdminNav update, `useAuth.redirectByRole` update (super admins land on `/super-admin/users` instead of `/super-admin/health`), removal of `/super-admin` layout-only fallback (replace with redirect). End-to-end impersonation goes live. Recon complete (architecture-reference.md §25.4, §25.5, §25.10).
- **`/settings/access-history` page** Phase D (Session 53 if pacing allows, else Session 54) — top-level route at `/settings/access-history` (sibling pattern to `/settings/privacy`), reads `my_access_history` RPC, sidebar update in both `settingsSubItems` and `coachSettingsSubItems` arrays. Open question: CSV export uses paginated client-side assembly capped at 1000 rows OR new `my_access_history_export` RPC. Decide at prompt construction. Recon complete (architecture-reference.md §25.11). Independent of Phase C.
- **Standardize on `auth.getClaims` across all Edge Functions** — `ai-chat` uses `auth.getUser` while everyone else uses `auth.getClaims`. Migrate ai-chat to getClaims for consistency. Low priority.
- **Migrate verify_jwt: false → verify_jwt: true on sensitive Edge Functions** — SOC 2 hardening pass; defensible either way but tightening reduces a class of bug. Low priority.
- **Align brainwise-blueprint Lovable repo with deployed Edge Function reality** — repo tracks ~10 functions, 52 deployed. Low priority, no blocking work depends on it.
- **Consider `is_test` column on `super_admin_audit_log`** — Session 49 left 9 test marker rows that can't be deleted (immutability trigger). Cleaner filtering than `WHERE detail->>'test' IS NULL`. Low priority.
- **`impersonation_denied_action` audit row writes** — when assert_impersonation_allows raises 42501, the calling Edge Function could write an audit row capturing the denied attempt. Builds SOC 2 evidence of enforcement. Add during Tier 2 rollout if pacing allows; otherwise build queue item.
- **Background-job CSV export for >10000-row audit reporting** — DECIDED Session 52: `export_audit_events` returns up to 10k rows with `truncated` flag and `total_matched` count; frontend renders banner instructing user to narrow filters. Hard-fail rejected; async pattern not built (CC7.2-friendlier to give a graceful slice than nothing). Reopen if observed audit volume exceeds 100k/month.

## Verified bugs with explicit fix instructions

Each bug below has been verified against production data or code review. Where I could not verify, I marked as Speculative and they are NOT in this section.

### BUG-1 [SHIPPED in Session 40]: MyResults.tsx isAIRSA detection always evaluates false

Fix landed in Session 40 as part of the Phase 3e frontend prompt. MyResults.tsx isAIRSA detection now uses strict equality `=== "INST-003"`. AIRSACards inline function and READINESS_COLORS const removed (replaced by AirsaCombinedReport import). Verified end-to-end against Maya fixture.

### BUG-2 [HIGH, partially fixed]: calculate-scores AIRSA detection always evaluates false

File: supabase/functions/calculate-scores/index.ts (now version 42 deployed in Session 39)

Original code (lines ~124):

```
const isAIRSA = instrument_id.startsWith("AIRSA");
```

Why it's broken: actual AIRSA instrument_id is 'INST-003'. isAIRSA was always false, which routed AIRSA scoring through the catchall mean-calculation branch.

Status: PARTIALLY FIXED in Phase 3a. The legacy isAIRSA variable is preserved (still always false) so PTP/NAI/HSS code paths are not changed. The new `isAirsaCorrect` flag drives all AIRSA logic.

Remaining work: after Phase 3e frontend ships, verify a new end-to-end AIRSA submission produces dimension_scores with readiness_level values, not mean values.

### BUG-3 [MEDIUM, silent]: calculate-scores PTP/NAI/HSS prefix detection always false

Same shape as BUG-2 but applied to non-AIRSA instruments. The high_dimensions and low_dimensions arrays in overall_profile are computed using HSS thresholds against PTP/NAI 0-100 means, which never satisfy those thresholds. Both arrays are always empty for PTP/NAI.

User-facing impact: NONE found. high_dimensions and low_dimensions are declared in TypeScript interfaces but never consumed for rendering.

Recommended fix:

```
const isPTP = instrument_id === "INST-001";
const isNAI = instrument_id === "INST-002" || instrument_id === "INST-002L";
const isHSS = instrument_id === "INST-004";
```

Then verify trigger_logic firings against existing PTP/NAI dashboard outputs. Do NOT touch this until Phase 3e frontend ships.

### BUG-4 [LOW]: items.rater_type vs assessments.rater_type case mismatch

- items.rater_type values: 'Self', 'Manager' (capital)
- assessments.rater_type values: 'self', 'manager' (lowercase, enforced by CHECK constraint)

Cross-table joins on rater_type fail silently because of the case mismatch. Always normalize at the boundary.

Long-term fix: normalize one direction. Lowercase is more conventional. Not launch-blocking; fold into a future schema-cleanup pass.

### BUG-5 [RETRACTED in Session 40]: calculate-scores Branch B re-stamps completed_at on release self-only

Retracted on review. Code audit of calculate-scores v42 Branch B and the airsa_release_self_only RPC confirmed neither path re-stamps `completed_at`. Branch B stamps `completed_at` only on initial self-completion. The release-self-only RPC sets only `self_only_released_at`, leaving `completed_at` untouched. The 90-day cooldown anchor is intact. Bug does not exist; no fix required.

### BUG-6 [LOW, INVESTIGATIVE]: pre-trigger corporate invitation redemptions

Two corporate invitation redemptions completed successfully on 2026-04-18 despite the enforce_immutable_user_fields trigger having been created on 2026-04-09. Why these two succeeded is unknown.

Priority: LOW. Defer post-launch unless customer-reported pattern emerges.

### BUG-7 [LOW]: SECURITY DEFINER UPDATE audit on public.users

The Session 38 invitation-redemption fix added a GUC opt-out pattern. Other SECURITY DEFINER functions that UPDATE public.users have not been audited.

Priority: LOW (audit, not a known live failure). Do post-launch unless a related production error emerges.

## Bug claims I made and then RETRACTED after verification

- isSliderInstrument string match in MyResults.tsx (line 596) - LOOKS broken because it falls through to a string-match against 'PTP' and 'NAI' against actual INST-001/INST-002 IDs. NOT actually broken in practice because the FIRST check (selected?.scale_type?.includes('slider')) succeeds. Dead string-match fallback never matters.

## AIRSA remaining work - Phase 3 through Phase 8

### Phase 3b [SHIPPED in Session 38]: Self-rater post-submit experience

Status: Complete. End-to-end verified across three states (within 14 days, 15-day backdate, 91-day backdate).

### Phase 3c [SHIPPED]: Supervisor pending-manager surface

(Carried in Session 38's Build Queue as launch-blocking; if it is not yet built, schedule alongside Phase 3d frontend.)

### Phase 3d [SHIPPED]: Manager-rating assessment-taking flow

(Same note as 3c.)

### Phase 3e backend [SHIPPED in Session 39]: AI section generator infrastructure

Status: Complete. End-to-end verified.

What shipped:

- `airsa_skills` table with 24 rows seeded from the canonical AI Readiness Skills Profile source document. Columns: item_number (PK), dimension_id (FK), skill_name, short_description, full_definition, theoretical_basis, behavioral_indicators (JSONB), is_new_skill, primary_p, secondary_ps (JSONB).
- `skill_level_breakdown` JSONB column added to assessment_results. Shape: keyed by item_number string; each value is a denormalized per-skill object with self/manager levels, response text, delta, direction, and status.
- `status` field added to `self_manager_divergence` per dimension. Values: aligned, confirmed_strength, confirmed_gap, blind_spot, underestimate. Logic: both Foundational = confirmed_gap; both Proficient = aligned; both Advanced = confirmed_strength; self > manager = blind_spot; manager > self = underestimate.
- calculate-scores v41/v42 Branch A populates skill_level_breakdown and divergence.status atomically with the upsert.
- Six AI Edge Functions deployed (each with hybrid Class A/Class B auth, shared secrets.ts and errors.ts utilities, banned-words/banned-phrases discipline, skill-numbers-only output convention):
  - generate-airsa-profile-overview v5 (plain text, 800 max_tokens)
  - generate-airsa-what-this-means v3 (JSON 4-key object, 2000 max_tokens)
  - generate-airsa-action-plan v3 (JSON 3-key object, 600 max_tokens)
  - generate-airsa-conversation-guide v3 (JSON 3-key object, 600 max_tokens)
  - generate-airsa-top-priorities v2 (JSON 3-array, 1500 max_tokens)
  - generate-airsa-cross-instrument v2 (plain text, 1200 max_tokens, conditional on PTP or NAI)
- calculate-scores v42 fan-out: Branch A fires all six AI generators in parallel via fire-and-forget HTTP POST with x-internal-secret. Legacy generate-report call preserved alongside.
- Storage convention locked: AI section content writes to facet_interpretations rows with section_type = 'airsa_<key>'. Same pattern as PTP narrative_* and NAI nai_* rows. UNIQUE (assessment_result_id, section_type) constraint prevents duplicates; 23505 race-recovery path in each function reads cached row and returns. No new table created.

What did NOT ship and why:

- A separate `airsa_report_sections` JSONB column on assessment_results was tried, then dropped. Concurrent fan-out caused last-write-wins overwrites on the JSONB column.
- A SECURITY DEFINER atomic-merge RPC (airsa_set_report_section) was tried as a fix, then dropped. Although technically correct, it would have been the only centralized JSONB-merge pattern in the codebase. Inconsistent with the per-row precedent in facet_interpretations. Reverting to the proven pattern was the right call.

### Phase 3e frontend [SHIPPED in Session 40]: Combined results page (14-section layout)

Shipped via AirsaCombinedReport.tsx (~1360 lines) and a routing update in MyResults.tsx. The original 15-section spec became a 14-section spec when the developmental quadrant map was removed mid-session (rationale: duplicated lollipop information in less-readable form, 3x3 cell encoding wasn't glanceable, position metaphor mismatched the discrete-level data). Multiple visual polish iterations landed (v1 initial build, restyle to PTP/NAI tokens, five-fixes, lollipop bands, chart width, action buttons, status colors + legend rebuild + star semantics, plus a hotfix for a Rules of Hooks violation introduced when `prioritySkillNumbers` was placed after the loading-state early return). BUG-1 fix bundled into the initial Phase 3e frontend prompt and verified.

Final 14-section layout in order:
1. Header (no AI)
2. At a glance (4 metric cards, no AI)
3. Action buttons (no AI; standardized to PTP/NAI: Export PDF / Retake Assessment / Take Another Assessment; the latter two gated on `!isCoachView && canTakeAssessments`)
4. How to read your results (with AIRSA overview folded in, 4-level frequency to 3-level readiness, no AI)
5. Domain heatmap with 5-status column (no AI; Status pill uses `display: inline-block`, `whiteSpace: nowrap`; Status column header carries `minWidth: 160`)
6. Profile overview (AI - airsa_profile_overview)
7. What does this mean to me? (AI - airsa_what_this_means, 4 themed boxes with tone pills)
8. Action plan (AI - airsa_action_plan, 3 timeframes with navy/teal/green branded pills)
9. Skill-by-skill comparison lollipop (no AI, all 24 skills, chartW=560, level-zone shading bands, combined legend at top with star explanation)
10. Conversation guide (AI - airsa_conversation_guide, 3 openings with role pills) [renumbered from former Section 11]
11. Top 3 development priorities (AI - airsa_top_priorities, status-color pills) [renumbered from 12]
12. How this connects to your other assessments (AI - airsa_cross_instrument, conditional) [renumbered from 13]
13. Skill reference list, collapsed (no AI; all 24 skills) [renumbered from 14]
14. Methodology footer (no AI) [renumbered from 15]

Self-only state: same layout structure with manager columns hidden, no divergence, banner explaining manager rating did not arrive. Verified on Maya fixture across 14d, 14-89d, 90+d release windows.

Maya fixture repaired during session: 16 self responses had null response_value_text (fixture script left them null); backfilled via SQL UPDATE mapping numeric values to the four frequency labels. skill_level_breakdown JSONB self_response field also patched via jsonb_set on the affected assessment_result. All 24/24 self_responses populated post-fix.

### Phase 4 [SHIPPED in Session 41]: PDF export of combined report

Status: Complete. End-to-end verified across three Lovable prompts (initial 5-file build + two fix passes for jsPDF rendering issues).

What shipped:

- `src/lib/generateAirsaPdf.ts` (NEW): jsPDF native renderer mirroring `generateNaiPdf.ts` structure. Cover page + 14 sections (Header always-on, 12 toggleable, Section 3 buttons skipped). All status colors hardcoded to match canonical Session 40 STATUS_COLORS mapping including blind_spot dash pattern. Lollipop rendered as native primitives (lines + circles) on its own page, level-zone shading bands pre-blended against white at 60% to dodge jsPDF GState reliability issues. Filename pattern `BrainWise-AIRSA[-Coach][-SelfOnly]-<LastName>-<YYYY-MM-DD>.pdf`. Text fully selectable.
- `src/lib/assemblePdfDataForUser.ts` (EDIT): added `assembleAirsaPdfData()` export. Existing PTP/NAI assembly untouched. Reuses `fetchCommon()` helper.
- `src/components/results/ExportPdfModal.tsx` (EDIT): added `AirsaPdfSectionsUi`, `AIRSA_GROUPS` config, `instrumentType: "AIRSA"` branch, `onExportAirsa` prop. PTP/NAI code paths untouched.
- `src/pages/MyResults.tsx` (EDIT): added `handleAirsaPdfExport` callback. Lifted `<ExportPdfModal>` out of `!isAIRSA` branch so it renders for all instruments. AIRSA dispatch wired correctly.
- `src/components/results/AirsaCombinedReport.tsx` (EDIT): replaced `alert("PDF export coming soon")` stub with `onExportClick` prop. Original 1360-line component otherwise untouched, preserving all Session 40 visual polish and Rules of Hooks structure.

Three bugs fixed across v2 and v3 prompts:

- BUG-A: Star ★ rendering as ampersand `&` due to jsPDF default helvetica using WinAnsiEncoding (no U+2605 codepoint). Fix: PRIORITY_GLYPH = "*" constant in PDF generator only; on-screen report keeps ★.
- BUG-B: Skill reference list rendering one entry per page due to height calc using `rowH + 2` against an undersized constant. Fix: compute actual entry height from headingH + domainH + descLines * 4.2 + padH, set font BEFORE splitTextToSize, use computed height for both ensureBlockSpace and y advance.
- BUG-C: Top 3 priorities cards splitting across pages with extra page break. Same root cause as BUG-B; same fix shape applied to priority card rendering.
- BUG-D: Methodology footer "Report generated —" missing date because AI section facet_data does not carry generated_at. Fix: fall back to assessment_results.created_at in assembler; replace em-dash placeholders with hyphens in generator.
- BUG-E: Profile overview heading orphaned from sand body card on prior page; sand body wrapping at ~110mm instead of full content width. Cause: page-break check ran AFTER heading was drawn, and wrap width was computed against stale narrow value. Fix: compute card height first, pass to sectionHeading as minContentNeeded argument so heading and card always land on the same page; use CONTENT_W - 12 wrap width matching the "What this means" cards.

Final PDF: 9 pages for Maya dual-rater fixture (cover + heatmap + Profile overview + What this means + Action plan + Lollipop + Conversation guide + Top priorities + Cross-instrument placeholder + Skill reference + Methodology). All toggles work; self-only variant verified with `-SelfOnly` filename suffix and lollipop single-dot mode.

### Phase 5 [SHIPPED in Sessions 43-44]: AIRSA org dashboard

Strategic frame designed and locked Session 41. Backend recon completed Session 42. Phase 5a backend (RPC + Edge Function) shipped Session 43 and verified against the seeded fixture. **Phase 5b frontend (5 tabs) shipped Session 44** end-to-end, including the new `per_department_breakdown` field on skill aggregates added via Session 44 migration. AI narrative generation chain (Anthropic API → JSON parse → INSERT) verified live for the first time in Session 44.

**Central thesis:** AIRSA's dashboard answers a structurally different question than PTP/NAI. Where PTP/NAI tell leadership about population states (threat reactivity, cognitive friction), AIRSA tells leadership about **calibration** — how accurately the organization sees its own AI talent. The data shape is fundamentally different: AIRSA is the only dual-rater instrument, so the org-level data isn't a distribution of scores but a distribution of agreements and disagreements.

**Headline metric: Talent Calibration Index (TCI)**

- Range: 0-100, higher is better
- Formula: `TCI = (count of aligned + confirmed_strength) / (total assessed skill-pairs) × 100`
- Confirmed gaps do NOT count positive (real capability gap, not earned strength)
- Stored in `org_dashboard_narratives.index_score` (existing polymorphic column)

Three companion sub-metrics in the headline strip: Alignment rate (any same-direction read), Blind spot rate, Underestimate rate.

**Tab structure (5 tabs, mirrors PTP/NAI):**

1. **Overview**: persistent header with TCI; slice controls (All / Department / Level / Team — Manager Calibration data is computed by iterating supervisors INSIDE the RPC, no `'supervisor'` slice_type); 4 sub-metric cards; AI workforce narrative inline as expandable card (top 3 recommended actions surfaced when expanded); Greatest Growth Opportunities / Strengths to Capitalize paired panels (top 2 skills + top 2 domains per panel, full ranking via expand link); Calibration Map (visual centerpiece); Risk flags.

2. **Domains**: 8 domain cards (PTP dimension card pattern). Each card: domain name + colored dot, average self-readiness 3-zone bar, average manager-readiness 3-zone bar, status distribution 5-segment stacked bar using STATUS_COLORS. Click to expand for per-skill breakdown within domain.

3. **Skill Inventory**: sortable filterable table (Skill # | Name | Domain | Self avg | Manager avg | TCI | Blind spot % | Underestimate % | n). Default sort = `cps_growth DESC` ("Sort by growth priority"). Row expand: per-department TCI for that skill, top blind-spot departments, top underestimate departments, AI-generated intervention recommendation.

4. **Manager Calibration** (AIRSA-unique tab, NOT in PTP/NAI): aggregates by `users.supervisor_user_id` chain, computed inside the RPC. Per-manager panel: name, report count, TCI scoped to their reports, blind-spot rate vs underestimate rate (asymmetry signals over-estimator vs under-estimator tendency), calibration consistency. Top 5 best-calibrated / Bottom 5. **Privacy threshold: minimum 3 reports per manager** (otherwise suppressed with "n<3" tooltip).

5. **Trends + Cross-Instrument**: LineChart of TCI over time (PTP/NAI Trends pattern); PTP × AIRSA and NAI × AIRSA correlations using existing C.A.F.E.S–PTP co-elevation framework.

**Composite Priority Score (CPS) — locked Session 41**

Each skill and domain gets two scores per slice:

- `cps_growth = (1 - readiness_index) * misalignment_weight`
- `cps_strength = confirmed_strength_pct`

Where readiness_index maps Foundational=0.0 / Proficient=0.5 / Advanced=1.0 averaged across all pairs in the slice, and misalignment_weight = `1 + (blind_spot_pct + confirmed_gap_pct) / 100` bounded [1.0, 2.0]. Tie-breakers: growth prefers higher blind_spot_pct (org doesn't yet see the problem), strength prefers higher n (more reliable signal). Suppression: n < 5 excluded. Frontend slices [0..2) for the panel, [2..] for the expand-full view.

**Calibration Map (visual centerpiece):**

- Rows: 24 skills, grouped visually by 8 domain bands
- Columns: departments (or active slice value)
- Cell color: locked STATUS_COLORS by modal status; intensity by % of pairs in that status
- Priority markers (Session 41 lock): orange ▲ for top 2 growth skills, green ◆ for top 2 strength skills; markers track active slice's rankings
- Hover popover: n, % aligned, % blind, % under
- Click: drill into underlying pairs (privacy threshold respected)
- Suppressed cells (n < 5): rendered gray with "n<5" tooltip

**Schema strategy (locked Session 41, confirmed Session 42):**

Match PTP/NAI pattern. Reuse `org_dashboard_narratives` table with `instrument_id = 'INST-003'`. AIRSA-specific aggregates carried in existing `dimension_scores` JSONB column. AI workforce narrative cached in `narrative_text` JSONB column. TCI carried in `index_score` numeric column. **No new table. No CHECK constraint migration. No table migrations needed for Phase 5a** (Session 42 recon confirmed existing `'team'` slice routes by `supervisor_user_id`).

**Cadence (locked Session 41):**

Match PTP/NAI exactly. Live RPC `get_airsa_aggregate(p_slice_type, p_slice_value)` computes aggregates from `assessment_results` on each dashboard load. No nightly cron, no pre-computed aggregate table. AI narrative cached and regenerated on user click via new Edge Function `generate-airsa-org-narrative` (Class A JWT via `auth.getClaims`, mirrors `generate-dashboard-narrative` v22 — corrected from Session 41's Class B specification after recon).

**Privacy thresholds (locked):**

- Calibration Map cells, Skill Inventory rollups, Trends per-period: minimum 5 pairs
- Manager Calibration tab: minimum 3 reports per manager
- Suppressed everything renders gray with "n<X" tooltip

**Phase 5a backend** [SHIPPED in Session 43]. RPC `get_airsa_aggregate` and Edge Function `generate-airsa-org-narrative` v1 both deployed and verified end-to-end against the seeded fixture. Full RPC payload shape with worked example in architecture-reference.md §10.6. Edge Function auth model and SOC 2 markers in arch-ref §10.7 and §8.

**Phase 5b frontend** [SHIPPED in Session 44]. Single coordinated build across two Lovable prompts. New file `src/pages/company/AirsaDashboard.tsx`, route `/company/airsa-dashboard` gated by RoleGuard `["company_admin", "org_admin", "brainwise_super_admin"]` matching NAI/PTP. All 5 tabs functional. Calibration Map renders 24 skill rows × N department columns using new `per_department_breakdown` RPC field with locked STATUS_COLORS, dashed-border blind_spot, ▲/◆ priority markers, hover popover, n<5 suppression. Domain coloring locked to 8-color brand map (D8 uses new `#5A1A4A` deep plum to avoid conflict with PTP Purpose `#3C096C`). Three latent NAI/PTP-inherited bugs surfaced and fixed in AIRSA build (Team selector populated supervisors instead of departments; clearable "All ___" dropdown labels; cps_growth vs cps_strength unit disambiguation subtitles). Latent NAI/PTP versions of the first two bugs deferred for post-launch fix to avoid regression risk on dashboards already in production use.

**Deferred to v2 (post-launch):** skill-level radar chart on 24 axes (unreadable; heatmap is better); time-comparison overlays on Calibration Map; anonymous self-report mode; predictive "if you close blind spots in Skill X, expected TCI gain is Y" (requires platform-wide outcome data not yet available).

### Phase 6 [SHIPPED]: Instrument toggle interactions

(Per Session 38 closeout; pending manager rows stay dormant when AIRSA is toggled off.)

### Phase 7 [HIGH for Session 45]: Cross-instrument recommendations wiring for AIRSA

Promoted to HIGH priority in Session 44 closeout. Currently the AIRSA dashboard Trends + Cross-Instrument tab renders placeholder cards for PTP × AIRSA and NAI × AIRSA marked "Coming post-launch (Phase 7)". Session 45 work to populate them.

Two sub-tasks:

- **Backend wiring**: Add `trigger_logic` table rules for `source_instrument='INST-003'`. Reuse the existing instrument-agnostic `org_cross_instrument_recommendations` table (already used by NAI and PTP). AIRSA-specific correlations: PTP dimension → AIRSA skill calibration patterns; NAI C.A.F.E.S. dimension → AIRSA domain readiness patterns.
- **Test fixture seeding**: Seed PTP and NAI completions for ~20 of the 47 AIRSA users on BrainWise Test Corp so cross-instrument has data to render at all. Without this seed, even with backend wiring complete, the section renders empty on the test org.

If both sub-tasks are deferred past launch, the cross-instrument section continues to render placeholder cards on the AIRSA dashboard. Acceptable degraded state for v1 launch.

### Phase 8 [MEDIUM]: Cleanup verification

- Confirm UI handles superseded AIRSA results correctly
- Verify Cole Plummer's existing superseded result does not appear in his account UI
- Existing cron jobs (if any) that scan assessment_results properly skip superseded_at IS NOT NULL rows

## Top priority items for Session 49 opening

### [LAUNCH-BLOCKING] Group A audit prequel — Session 49 entire focus

Session 48 closed with Group D end-to-end shipped, refund automation verified, and a locked three-week sequencing plan for Group C (full LMS + coach certification with Option A authoring UI). Session 49 is the small audit-infrastructure prequel that unblocks Group C builds.

**Scope (single session):**

1. Schema additions to `super_admin_audit_log`:
   - `ip_address inet`
   - `user_agent text`
   - `reason text`
   - `before_value jsonb`
   - `after_value jsonb`
   - `mode text` (impersonation observe/act, nullable)
   - `expires_at timestamptz`
   - `ended_at timestamptz`
   - `end_reason text`

2. Schema additions to `company_admin_audit_log`:
   - `reason text`
   - `before_value jsonb`
   - `after_value jsonb`
   - `super_admin_acting_as_user_id uuid` (nullable; populated only when action was taken by super admin during impersonation)

3. New `log_super_admin_action()` helper RPC with consistent argument signature: actor, target, action_type, before, after, reason, mode

4. Verify schema via execute_sql post-migration

**Acceptance:** all columns exist, helper RPC callable from SECURITY DEFINER context, ready to be consumed by Group C super-admin actions (revoke certification, direct-enroll user, assign mentor).

This is intentionally small. Estimate: 1 session, possibly half-session if clean.

### [LAUNCH-BLOCKING] Group C — Coach Certification + LMS (Sessions 50-58)

10-session plan locked Session 48. See "Group C three-week sequencing plan" earlier in this build queue. Option A confirmed (full authoring UI). Cole owns content authoring as parallel task starting Session 53.

Full Group C scope at `/mnt/project/BrainWise_Group_C_Scope_Coach_Certification_v1.docx` (uploaded Session 48). The scope's Q7 decision is locked at Option A despite the scope's hedged language.

### [HIGH, deferred] Action-Oriented Voice Redesign across NAI and PTP surfaces

Carried forward from Session 47 priority list. The voice work is sequenced AFTER Group C ships because Group C is launch-blocking for the cohort and voice redesign isn't. Apply the canonical AIRSA voice template (`generate-airsa-org-narrative` v2 prompt's VOCABULARY RULES, BANNED words/phrases, SECTION STRUCTURES discipline) to NAI and PTP generators.

Affected Edge Functions:
- `generate-dashboard-narrative` v22 (NAI + PTP org)
- `generate-facet-interpretations` v23 (NAI + PTP individual)
- `generate-nai-delta-narrative` v10
- `generate-ptp-delta-narrative` v7

### [HIGH, deferred] Group A remaining work (Sessions 59-65)

Impersonation, Tier 1/2/3 user editing, audit reporting UI, user access history page. After Group C cohort launches.

### [HIGH, deferred] Org Overview Dashboard + AIRSA Cross-Instrument

Full scope at `/mnt/user-data/outputs/org-overview-and-airsa-cross-instrument-scope.md`. 4 phases, 3-5 sessions estimated. Sequenced after Group A remaining work.

### [MEDIUM, carried] Outstanding pre-launch quality items

Various small items carried from prior sessions: NAI/PTP latent slice-control bugs (deferred for post-launch per Session 44), aligned_pct/confirmed_gap_pct split on Domains tab (Session 44 open question), and the AI tone pass DEFERRED BATCH below for any remaining tone leakage.

### [MEDIUM, new from Session 48] Build queue items added during Session 48

- **Brand error color decision.** `--destructive` HSL `0 72% 55%` reads as a non-brand red. Decide on a brand-aligned error color (likely a darker terracotta/rust orange) that doesn't conflict with the existing `--brand-orange` CTA color but is visibly distinct.
- **Edge Function audit + email_type/source backfill.** Identify Edge Functions calling Resend directly vs through send-email. Backfill `email_type`/`source` parameters on Edge Functions that currently route through send-email without these fields: stripe-webhook, bulk_coach_invite, invite-coach, send-departure-emails, generate-departure-export, others TBD.
- **Extract shared coupon/refund helper module.** `recalcCouponAfterRevoke` and `processAutoRefund` are duplicated verbatim between `coach_invitation_revoke` and `sweep_expired_invitations` Edge Functions. Extract to shared helper file. Build queue impact when changing coupon math: must update both copies in lockstep until extraction lands.
- **Level 3 archive setup for email_logs** (pre-launch priority — SOC 2 evidence retention beyond 90-day rolling window).
- **Super admin refund processing UI for individual purchases.** UI surface in /super-admin showing: user's `assessment_purchases` rows with eligibility status (within 14 days? unused?), a "Process refund" button gating on Tier 2 audit (justification ≥ 10 chars + 5-min fresh MFA per Group A), Edge Function `process_individual_refund` (super-admin only) that takes an `assessment_purchase_id`, validates calling user is super_admin, calls Stripe refunds API, stamps the row with `refunded_at`, `stripe_refund_id`, `refund_amount`, `refund_processed_by`. Depends on Group A audit prequel being complete.
- **Pricing-reads refactor** (carried from Session 38). Eliminate hardcoded price IDs in favor of `subscription_plans` lookups (post-launch).
- **Token-based invitation upgrade (Path B).** Migrate coach_clients invitations from email-prefill to single-use token model. Closes pre-existing security concern documented in Group D scope. Build session: dedicated, not combined with other work.

## AI tone pass — DEFERRED BATCH

### [MEDIUM] AI generator tone pass across all instrument-level generators

Consolidated batch covering all AI Edge Functions on the platform. Specific items previously logged from Sessions 41 and 42 (residual "this creates" leakage, slight inference-overreach phrasing, fine-tuning toward purer factual observation) plus a full review of language quality across:

- generate-airsa-profile-overview (v5)
- generate-airsa-what-this-means (v3)
- generate-airsa-action-plan (v3)
- generate-airsa-conversation-guide (v3)
- generate-airsa-top-priorities (v2)
- generate-airsa-cross-instrument (v2)
- generate-airsa-org-narrative (v2, voice redesigned in Session 45 — use as canonical voice template for the rest of this batch)
- generate-dashboard-narrative (v22, PTP+NAI org)
- generate-facet-interpretations (v23, PTP+NAI individual)
- generate-cross-instrument-recommendations (v7)
- generate-nai-delta-narrative (v10)
- generate-ptp-delta-narrative (v7)
- ai-chat (v29)

Approach: pull all prompt blocks side-by-side, identify shared banned-words list, identify shared tone-discipline rules, write a single cross-cutting tone-pass spec, then re-deploy each function with refined prompt. Run before launch but not launch-blocking. Do NOT touch generator infrastructure or auth — prompt body only.

Target session: post-Phase 5b frontend, pre-launch. Estimated 1 session if batched well.

## Session 40 design decisions locked

### STATUS_COLORS canonical mapping (Session 40 lock)

Each of the five AIRSA dual-rater statuses uses a distinct brand color. No two statuses share a color anywhere in the AIRSA report or its downstream PDF.

- aligned: #006D77 (teal)
- confirmed_strength: #2D6A4F (green)
- confirmed_gap: #6D6875 (gray)
- blind_spot: #021F36 (navy)
- underestimate: #3C096C (purple)

Dash pattern is preserved on `blind_spot` only (intuitive "broken line for blind spot" iconography). Other statuses use solid lines and chips. The mapping is the authoritative source for the lollipop line color, the heatmap status pill, the priority card status pill, and the Section 5 "skills by status" indicator dots.

Cross-instrument note: #3C096C is also used as the PTP Purpose dimension color. Contexts never overlap on the same screen, so the reuse is acceptable. Same for #006D77 reused as the AIRSA Self-rating dot color (lollipop) and the Aligned line color — different surfaces (legend dot vs connecting line); contexts are visually distinct.

### Star (★) semantics (Session 40 lock)

Star marks the three skills returned by `airsa_top_priorities.content[].skill_number` for the current user. Dynamic per user, NOT static. Surfaced ONLY in the Section 9 lollipop row labels. Section 12 priority cards do NOT carry a star (the card itself IS the priority). Section 13 skill reference list does NOT carry a star (all-skills reference, no per-user marking applies).

The `airsa_skills.is_new_skill` boolean column stays in the database. Backend `generate-airsa-top-priorities` continues to use `is_new_skill = true` as a tiebreaker within priority pools (per Session 39 decision). Frontend stops surfacing it. The star symbol's UI meaning is now exclusively "your top development priority."

### Lollipop level-zone shading (Session 40 lock)

Three vertical band colors behind the dots, in `LollipopChart` only:

- Foundational (left third): #FCE4D6 (warm peach)
- Proficient (middle third): #D6E8F5 (clear sky blue)
- Advanced (right third): #D8E8D0 (fresh leaf green-tint)

All three at 60% fill opacity. Hardcoded hex literals in SVG `fill` attribute (CSS variables do NOT resolve in SVG fill attributes — confirmed during Session 40 debugging). These three colors must NOT be used anywhere outside the lollipop chart.

### Action plan timeframe pill colors (Session 40 lock)

Section 8 timeframe pills (THIS WEEK / NEXT 30 DAYS / IN 90 DAYS) use brand colors signaling time progression:

- This week: navy (#021F36) tinted pill (background `${navy}20`)
- Next 30 days: teal (#006D77) tinted pill
- In 90 days: green (#2D6A4F) tinted pill

Same pattern as PTP DimensionPill: background `${color}20` with full-saturation foreground.

### Section pill conventions (Session 40 lock)

- Section 7 boxes carry tone pills (Shared territory / Divergence / Brain frame / For the manager)
- Section 11 conversation guide cards carry role pills (For you / For your manager / For both)
- Section 12 priority cards carry status pills derived from `breakdown[String(p.skill_number)]?.status`
- Sections 6, 8 (body), 13 stay clean prose without pills

### Action button standardization (Session 40 lock)

AIRSA Section 3 buttons now match PTP/NAI exactly:

- Export PDF (outline, FileText icon, always visible)
- Retake Assessment (outline, RefreshCw icon, gated on `!isCoachView && canTakeAssessments`)
- Take Another Assessment (filled navy default, no icon, same gate)

Dropped from earlier AIRSA-only set: Schedule conversation with manager (feature not built), Resources (not on PTP/NAI), Share (AIRSA is auto-shared with supervisor and org admins via shared-results page).

### Quadrant map removed (Session 40 lock)

Section 10 (Developmental quadrant map) was built and shipped in v1, then removed mid-session. Rationale: it duplicated the lollipop's information in less-readable form; the 3x3 cell encoding wasn't glanceable; the position-as-data metaphor mismatched the discrete-level data; and the quadrant labels were already conveyed by the lollipop's connecting-line colors and the Section 5 heatmap status pills. Section count dropped from 15 to 14.

If a divergence-summary visual is wanted later, the recommended path is a horizontal stacked bar showing the count of skills per status (information density is higher than the quadrant's 3x3 collapse). Defer indefinitely; lollipop + heatmap + Section 7 prose cover this ground.

## Session 41 design decisions locked

### Talent Calibration Index (TCI) — headline metric for AIRSA org dashboard

`TCI = (count of aligned + confirmed_strength) / (total assessed skill-pairs) × 100`. Range 0-100, higher is better. Confirmed gaps do NOT count positive (real capability gap, not earned strength). Stored in `org_dashboard_narratives.index_score` (existing polymorphic numeric column).

### Composite Priority Score (CPS) — drives Greatest Growth / Strengths panels and Skill Inventory default sort

`cps_growth = (1 - readiness_index) * misalignment_weight` where readiness_index = avg(self+manager levels) mapped to [0,1] (Foundational=0, Proficient=0.5, Advanced=1.0) and misalignment_weight = `1 + (blind_spot_pct + confirmed_gap_pct) / 100` bounded [1.0, 2.0]. `cps_strength = confirmed_strength_pct`. Tie-breakers: growth prefers higher blind_spot_pct, strength prefers higher n. Suppression at n < 5.

### Calibration Map — visual centerpiece of AIRSA org Overview tab

24-skill × N-departments heatmap. Cell color = locked STATUS_COLORS by modal status. Cell intensity = % of pairs with that status. Priority markers: orange ▲ for top 2 growth skills, green ◆ for top 2 strength skills, on row labels, tracking the active slice's CPS rankings.

### AIRSA org dashboard schema strategy

Match PTP/NAI exactly. Reuse `org_dashboard_narratives` table with `instrument_id = 'INST-003'`. Aggregates carried in `dimension_scores` JSONB. AI narrative cached in `narrative_text` JSONB. TCI in `index_score` numeric. No new aggregate table. No CHECK constraint migration (Session 42 recon).

### AIRSA org dashboard cadence

Live RPC computation per dashboard load via new `get_airsa_aggregate(p_slice_type, p_slice_value)`, mirroring PTP/NAI `get_instrument_aggregate` pattern. No nightly cron, no pre-computed aggregate table. AI narrative cached and regenerated on user-triggered click via new Edge Function `generate-airsa-org-narrative` (Class A JWT, corrected Session 42).

### Manager Calibration tab privacy threshold

Minimum 3 reports per manager required to display the manager's calibration breakdown. Cells below threshold render as suppressed gray with "n<3" tooltip. Coarser threshold than the 5-pair platform standard because manager cohort sizes are inherently smaller; the trade-off is intentional to make the tab usable in real-customer accounts.

### jsPDF rendering constraints (architectural learnings from Phase 4)

1. **WinAnsiEncoding limitation.** jsPDF default helvetica uses WinAnsiEncoding which excludes U+2605 (★). The encoder substitutes a fallback character (observed: ampersand `&`). Pattern: use ASCII-equivalent glyphs in PDFs, reserve Unicode glyphs for on-screen contexts. Loading custom Unicode fonts is heavyweight and not worth it for single-character substitutions.

2. **splitTextToSize font-state dependency.** jsPDF's `splitTextToSize(text, width)` uses the CURRENT font for width calculation. Setting font BEFORE calling splitTextToSize is the canonical pattern (already commented in `generateNaiPdf.ts` line 406-407). Skipping this produces correct text but wrong wrap width, causing entries to render at narrow column widths even when full content area is available.

3. **Section heading anti-orphan pattern.** When a section has a body card whose height is computable upfront, pass the card height + heading clearance as the `minContentNeeded` argument to `sectionHeading()`. This forces a page break BEFORE drawing the heading if the page can't fit heading + card together. Skipping this orphans the heading on one page with the body card on the next.

## Session 42 design decisions locked

### AIRSA scale labels

Confirmed during Session 42 fixture seeding: AIRSA frequency scale is `0=Never, 1=Rarely, 2=Often, 3=Consistently`. NOT "Always". Items table values verified against this convention. Frontend, PDF, and AI prompts must all use this labeling.

### No `'supervisor'` slice_type

Manager Calibration tab data is computed by iterating supervisors INSIDE the `get_airsa_aggregate` RPC, not via a separate slice_type. Existing `'team'` slice already routes by `supervisor_user_id`. No `slice_type` CHECK constraint migration is needed for Phase 5a.

### AIRSA org dashboard Edge Function uses Class A JWT

Corrected from Session 41 handoff specification of Class B internal-secret. The dashboard-level AI generator is user-triggered from the frontend (Regenerate AI button), so it has full JWT context. Pattern mirrors `generate-dashboard-narrative` v22 exactly. Class B was reserved for service-to-service calls (calculate-scores fan-out to individual AIRSA generators); the org-narrative path does not use that pattern.

### AI workforce narrative inline on Overview tab

Renders as expandable card on Overview, NOT as a separate sixth tab. Top 3 recommended actions surface when the card is expanded. Collapsed default state shows a 1-2 sentence summary. Pattern matches PTP/NAI Overview AI summary cards.

### [SHIPPED in Session 39]: NAI Saturation color alignment

Decision shipped. NAI Saturation (DIM-NAI-05) is now mustard #7a5800 across all NAI individual report files, matching the dashboards. After this ship, #FFB703 exists only as the --bw-amber brand token (used by --warning semantic and other UI elements).

## Session 43 design decisions locked

### get_airsa_aggregate suppression check is on eligible pool, not pair count

Initial implementation suppressed on `pair_count` (eligible_count × 24 skills), which would have allowed n=1 team slices through. Fixed in second migration to check `array_length(v_participant_ids)` directly, matching `get_instrument_aggregate` semantics. Documented as architectural constraint in arch-ref §8.

### generate-airsa-org-narrative is hybrid Class A + Class B

Class A primary for frontend Regenerate AI button (forwards user JWT to RPC client so `auth.uid()` resolves inside SECURITY DEFINER RPC). Class B retained as hybrid path for future programmatic regen, requiring `organization_id` in body since there's no JWT to derive it from. Mirrors AIRSA individual generator hybrid pattern.

### CPS tie-breakers in RPC ranking arrays

Growth ranking: `ORDER BY cps_growth DESC NULLS LAST, blind_spot_pct DESC NULLS LAST` (matches Session 41 design). Strength ranking: `ORDER BY cps_strength DESC NULLS LAST, n DESC` (more reliable signal preferred). Locked in RPC body, not configurable from caller.

## Session 56 — Lovable Prompts 2, 3, 3.1, 3.2, 3.3, 3.4 retrospectives (post-send)

Prompt 2 (Cert Path editor) and Prompt 3 (Curriculum editor) shipped and work end-to-end. Four post-Prompt-3 follow-up prompts (3.1-3.4) plus a slug-uniqueness migration shipped and verified Session 56. Final ContentAuthoring.tsx line count ~2000.

### [SHIPPED Session 56] Prompts 3.1, 3.2, 3.3, 3.4 — Prompt 3 UX bug-fix cycle

Four small targeted Lovable prompts after Prompt 3 shipped, all on `src/pages/super-admin/ContentAuthoring.tsx`:

**Prompt 3.1 — Auto-expand parent cert path after curriculum attach/create.** CurriculumEditor `onSaved` callback was ignoring its second arg `attachedCertPathId`. Fixed by accepting it, adding `cp:<id>` to expanded set, and `await`ing refetch before swapping `selectedKey`. Also added `onExpandSelf` prop on CertPathEditor for the pull-existing flow's analogous auto-expand. ~16 line delta.

**Prompt 3.2 — Invalidate AttachedCurriculaSection cache after writes.** AttachedCurriculaSection had its own React Query key `["cert-path-attached-curricula", certPathId]` with staleTime 15s, never invalidated by writes. Added `useQueryClient` import, threaded `onInvalidateAttachedList` prop through CertPathEditor, called `queryClient.invalidateQueries` after both write paths (create-with-attachment + pull-existing-and-attach). ~20 line delta.

**Prompt 3.3 — Fix FK-ambiguity in PostgREST embed (the actual bug).** Root cause of "attached curriculum not displaying" was NOT cache invalidation — Prompts 3.1 and 3.2 were correct but didn't address the failing query. `certification_path_curricula` has TWO FKs to `curricula` (`curriculum_id` and `prerequisite_curriculum_id`). The embed `curriculum:curricula(...)` was ambiguous; PostgREST silently returned null curricula. The `.filter(r => r.curriculum && !r.curriculum.archived_at)` then dropped all rows. Fix: one-line change to `curriculum:curricula!curriculum_id(...)` for explicit FK disambiguation. ~1 line delta.

**Prompt 3.4 — Tree section rename + attached row pencil edit + auto-expand-ancestors on selection.** Three coupled changes: (1) renamed "Standalone Curricula" → "All Curricula" and "Standalone Modules" → "All Modules", removed the `!linkedCurriculumIds.has(c.id)` filters so all non-archived items show in their section regardless of attachment status. (2) Added pencil button (lucide `Pencil` icon) to each AttachedCurriculaSection row that navigates the right pane to that curriculum's editor via new `onSelectCurriculum` callback. (3) Rewrote `selectNode` to auto-expand the ancestor chain when selecting a `cu:` or `mo:` node — looks up parents via new `certPathsByCurriculum` and `curriculaByModule` reverse-lookup Maps and adds them to the `expanded` set. Same curriculum/module now appears in both "Certification Paths" (nested) and "All <type>" (top-level) — selection highlights both because they share `nodeKey`. ~80 line delta.

### [SHIPPED Session 56] Standing patterns established for Prompts 4-8

Two patterns locked Session 56 to apply to all subsequent editor sub-components (Module, Content Item, Quiz, Mentor, etc.):

1. **Key prop on all editor JSX usages** (`cp:new`, `cp:${id}`, `cu:new`, `cu:${id}`, future `mo:new`, `mo:${id}`, etc.) — forces React remount on selection swap so useState initializers re-run with correct `initial` values. Eliminates the useState-stale-on-mount bug for direct URL navigation, hard reloads, and rapid selection swaps.

2. **PostgREST FK-disambiguation** — any embedded select traversing a table with multiple FKs to the same target table MUST use `!<column_name>` syntax. The bug shipped silently in Prompt 2 (AttachedCurriculaSection) and wasn't visible until Cole tried to use the feature. Add to recon checklist for Prompts 4+: enumerate FKs on every join table before writing embeds.

3. **Tree "All <type>" sections include attached items** — going forward, when Prompts 4+ add Module editor with curriculum-attachment flows, the "All Modules" section already lists every non-archived module (attached or not). No additional tree logic needed.

### [SHIPPED Session 56] Slug uniqueness should not block archive-recreate

Bug: archiving a cert path (or curriculum or module) left its slug occupying the global `*_slug_key` UNIQUE constraint, so trying to recreate the same slug returned 23505 "Slug already in use" even though no active row used it.

Fix shipped Session 56 via migration `slug_unique_only_among_active_for_authoring_tables`:
- Dropped `certification_paths_slug_key`, `curricula_slug_key`, `modules_slug_key`
- Replaced with partial unique indexes (`certification_paths_slug_active_uniq`, `curricula_slug_active_uniq`, `modules_slug_active_uniq`) on `(slug) WHERE archived_at IS NULL`
- Matches existing pattern set by `lesson_blocks_active_order_uniq`

Verified: archived rows + new active row with same slug now coexist; two active rows with same slug still rejected with 23505. RPCs and frontend unchanged. `mapRpcError` still maps 23505 to "Slug already in use" for the case where it actually fires now (two active rows colliding).

content_items doesn't have a slug column, so no change there. When Prompt 4 (Module editor) lands the module side of this is already covered.

### [SHIPPED Session 56 via Prompt 3 — superseded] CertPathEditor useState-stale-on-mount fix

Folded into Prompt 3 via `key` props on all four editor JSX usages (`cp:new`, `cp:${id}`, `cu:new`, `cu:${id}`). Confirmed working end-to-end with no observed regressions. Now a standing pattern for Prompts 4-8.

### [HIGH / new feature] Voice dictation + file upload for AI authoring prompts

Cole asked for: voice dictation (mic button → speech-to-text) and file/image upload as input modalities for the AI authoring prompts. Goal: dictate a lesson concept instead of typing it, or upload an existing reference document and ask AI to draft a block from it.

Build in Prompt 6 (lesson_blocks editor where AI buttons live) alongside the existing text prompt input. Architecture:

**Voice dictation:**
- Use the browser's native Web Speech API (`SpeechRecognition`) — free, no provider cost, real-time transcription
- Frontend-only feature; no Edge Function or migration needed
- Add a mic button next to each "Draft with AI" prompt input. Click → starts listening, transcribes to the textarea, click again to stop
- Fallback if Web Speech API unsupported: hide the button, no degradation
- Cross-browser: Chrome/Edge/Safari support; Firefox is iffy but the fallback handles it

**File upload as AI context:**
- Add an "Attach reference" affordance next to the prompt input
- Supported types: PDF, DOCX, TXT, MD, plus PNG/JPG for image-based references
- File parsed client-side or server-side, extracted text fed into the Edge Function as a new optional request param `reference_context` (string, max 50K chars to keep token budget sane)
- Client-side parsing for TXT/MD (trivial). PDF/DOCX server-side via Edge Function that uses `pdfjs-dist` or `mammoth` — could be a new `extract-document-text` Edge Function. Images server-side via Claude's vision capability since `claude-opus-4-7` accepts image input — pass image bytes to Anthropic API, ask "transcribe and summarize this image's relevant content"
- New Storage bucket `ai-authoring-references` for any uploaded files Cole wants persisted (vs. one-shot ephemeral parse-and-discard)
- The three existing AI Edge Functions (`draft-lesson-block`, `scaffold-lesson`, `draft-text`) get a new optional `reference_context` request field appended to the user message in the Anthropic call: `Author request: <prompt>\n\nReference material (do not quote verbatim, use as context):\n<reference_context>`

Estimated effort: 1 session for voice dictation + text/markdown file parsing (browser-only, no migrations). 1 additional session for PDF/DOCX/image parsing (new Edge Function + Storage bucket). Total: ~2 sessions, both in Phase 4.5d.

### [HIGH / extend to other AI surfaces] Voice dictation + file upload across all AI features

Same input-modality additions should land on the non-authoring AI surfaces too. Three places identified Session 56:

1. **AI Chat page** (`/ai-chat` or similar; check actual route) — primary chat interface
2. **AI Chat bubble on `/my-results`** — per-result conversational helper
3. **AI Chat bubble on `/shared-results`** — peer-result conversational helper

Each currently has a text-only input. Add:
- Voice dictation button (Web Speech API, same pattern as Phase 4.5d)
- File upload button — for these user-facing surfaces, scope is narrower: PDF/TXT/MD only (no DOCX needed for end-users), image upload to ask Claude vision questions about a chart/report screenshot

Backend implication: `ai-chat` Edge Function (currently v31) needs a `reference_context` request param and a new `attached_image` param (base64 or URL) that gets forwarded to the Anthropic API call as a vision-input content block. Same shape as Phase 4.5d's authoring extension.

Cost concern: end-users have AI quotas (`check-ai-usage`), so heavy attachment use could blow through monthly allowances faster. Quota policy decision needed: does an image-attached message count as 1 use or N uses based on token consumption? Defer to Phase 4.5e kickoff.

Privacy implication: user-uploaded files containing PII go through Anthropic's API. Update privacy policy + ai_chat consent UI to disclose this before shipping. Existing consent text covers "AI conversation" but not "file content sent to AI."

Estimated effort: ~2 sessions for the three surfaces collectively (one to wire all three frontend inputs, one to add the request params + privacy disclosure). Phase 4.5e.

### Phase 4.5d and 4.5e sequencing

Insert between 4.5c (avatar video) and original Phase 5 (consumer learning UI):
- **4.5d** — Authoring AI input modalities (voice + file upload). 2 sessions.
- **4.5e** — End-user AI chat input modalities (voice + file upload on /ai-chat, /my-results bubble, /shared-results bubble). 2 sessions.

Both 4.5d and 4.5e are independent of 4.5a/b/c — they can be sequenced flexibly. Cole's call. Reasonable default: 4.5a (image) → 4.5d (authoring inputs, faster to build than voiceover/video) → 4.5b → 4.5c → 4.5e.

---

### [DEFERRED / POST-LAUNCH evaluation] BrainWise MCP server for Claude.ai connector access

Cole asked Session 62 whether the BrainWise lesson editor could be exposed as an MCP server so super-admins could use their own paid Claude.ai accounts (instead of the platform's Anthropic API) to author lessons via Claude.ai's Connectors feature.

**Decision Session 62: NOT for v1.** The in-platform AI panel approach (Path C, shipping in 6a-AI Sessions 62-63) is the right primary path because:

1. **Bypasses BrainWise AI infrastructure** — `ai_authoring_context` rows (5 versioned platform context blocks), `ai_authoring_voice_presets` (5 system voices), the canonical context-injection ordering, and the `ai_authoring_draft_generated` audit log all live in the Edge Function layer. Routing authoring through Claude.ai's chat means none of that fires — author gets generic Claude, not BrainWise-flavored Claude. SOC 2 CC7.2 traceability evaporates.
2. **Single-user solution** — Claude.ai Connectors live in individual user accounts. Cannot ship as a platform feature; every super-admin or future licensee would need their own Claude.ai Team/Enterprise plan and individual connector configuration.
3. **Not portable to trainees** — Phase 5 trainee surfaces and any future trainee-facing AI (coaching chat, knowledge check feedback) use the platform's own Anthropic API. MCP-via-Claude.ai for authoring would create two completely different AI architectures inside one product.
4. **UX surface loss** — chat lives in Claude.ai's chrome (their input box, their message bubbles). No voice preset dropdown next to textarea, no stage state machine, no "Build lesson" commit button. Would approximate the staged outline→blocks→build UX rather than build it.
5. **Higher build cost, not lower** — MCP server requires publicly-routable HTTPS endpoint with SSE/JSON-RPC, OAuth 2.0 against Supabase auth, token refresh, 6+ tool schemas, per-tool authorization, MCP-layer rate limits. Weeks of work, and still need temp-storage doc infrastructure separately (Claude.ai connectors don't expose file uploads through the connector — file context comes from Claude.ai's own attachment flow which goes to Anthropic, not to BrainWise storage).
6. **Cost angle** — "use my paid Claude.ai instead of API tokens" doesn't scale. Personal Claude.ai pricing covers personal usage; commercial use of model output via personal Claude.ai TOS is at minimum gray-area. Multi-user platform feature requires the platform's own API integration with volume pricing as the lever.

**When to revisit**: after 6a-AI ships and authoring usage produces real signal. If the bottleneck for power users is that they want richer chat ergonomics Claude.ai's chrome provides, an MCP server could be added as a parallel-path option for super-admins who want it — alongside the in-platform UX, never as a replacement. Trigger to build: actual authoring-power-user complaints OR a B2B partner explicitly requesting MCP integration. Estimated effort if built: 2-3 sessions for the MCP server itself plus OAuth flow plus tool schemas; still need the existing in-platform infrastructure as the primary path for non-Claude.ai-paying users.

---

### [MEDIUM / Prompt 4-5 territory] Generic attach_*_to_* RPC family

Prompt 3 attaches existing curricula to cert paths by re-sending the curriculum's full field set through `upsert_curriculum` (because the RPC validates name/slug as required). It works, but:
- Each attach-existing action writes a `curriculum_updated` audit row with `before == after` for the curriculum portion. Phantom edit, harmless but noisy on audit log review.
- Prompts 4 (modules → curricula) and 5 (content items → modules) will need the same attach-existing pattern. Each will inherit the same ugly re-send.

When the second consumer of the pattern lands (Prompt 4 module-to-curriculum attachment), refactor to a generic family:
- `attach_curriculum_to_cert_path(p_curriculum_id, p_cert_path_id, p_display_order, p_is_required, p_prerequisite_curriculum_id, p_reason)` — pure attach, no curriculum update
- `attach_module_to_curriculum(...)` — same shape for modules
- `attach_content_item_to_module(...)` — same shape for content items
- Each writes exactly one audit row of action_type `*_attached`, no phantom curriculum/module/content_item edits

The existing `upsert_curriculum`/`upsert_module`/`upsert_content_item` RPCs keep their attachment params for the create-with-attachment flow (one transaction, one RPC call) — they remain useful for that specific case. The new attach_* family is only for "attach an already-existing thing to a parent" flows.

Trigger to build: when Prompt 4 introduces the second consumer of the re-send pattern. Estimated effort: ~1 session (3 new RPCs, audit action_types, frontend swap in two places).



## Phase 4.5 — AI media generation (NEW Session 56, decided pre-Prompt 2 send)

Three new AI-powered media generation features for the lesson_blocks editor (Phase 4.5, post-launch). Each is a separate Edge Function + frontend integration in the lesson_blocks editor. Provider decisions locked Session 56 based on current 2026 landscape research.

Solo-author deferred decision: **`ai_authoring_drafts` capture table NOT being built.** The current `super_admin_audit_log` row (action_type `ai_authoring_draft_generated` with prompt excerpt + metadata) is sufficient for SOC 2 CC7.2. Trigger to revisit: (a) second author joins, OR (b) prompt-quality tuning needs structured data. Until then, frontend should keep the last 3-5 AI outputs in local React state per editor so author can "undo to last AI suggestion" within a session — note this in Prompt 6 acceptance criteria when lesson_blocks editor is built.

### [MEDIUM / Phase 4.5a] AI image generation

**Provider locked: Google Imagen 4 Standard (primary), Flux 2 Pro (backup).** Imagen 4 Standard at $0.04/image leads on photorealism in 2026; Flux 2 Pro at $0.045-0.055/image is the strongest commercial-license backup. Both via direct API (no aggregator needed at solo-author volume — projected $2-8/month cost).

Build:
- New Edge Function `generate-image-asset`:
  - Class A JWT auth + super_admin gate + impersonation gate (`permission_change` category) — same pattern as the three Session 56 AI Edge Functions
  - Accepts `prompt`, `aspect_ratio`, `style_preset` (optional), `provider` ("imagen-4" default | "flux-2-pro")
  - Calls Imagen 4 via Google AI API (key in Edge Function Secrets as `GOOGLE_AI_API_KEY`), falls back to Flux via FAL or direct Black Forest Labs API on Imagen failure
  - Receives bytes/URL, downloads, uploads to new Supabase Storage bucket `lesson-assets` (super-admin write, authenticated read), returns public URL + provenance metadata (`generated_by`, `generation_prompt`, `model`)
  - Audit row via `log_super_admin_action` with action_type `ai_authoring_image_generated`
- New Supabase Storage bucket `lesson-assets` with RLS policies
- New `super_admin_action_types` row: `ai_authoring_image_generated`
- Frontend integration in `image` block editor (lands in Prompt 6 alongside the lesson_blocks visual editor)
- Acceptable use review: Google Imagen 4 terms permit commercial use including training/educational materials. Flux 2 Pro likewise. Document the provenance metadata stored alongside the image so SOC 2 auditors can trace AI-generated content if asked.

Estimated effort: 1 session (Edge Function + Storage bucket + frontend wiring batched with Prompt 6).

### [MEDIUM / Phase 4.5b] AI voiceover generation

**Provider locked: ElevenLabs (primary).** Highest voice naturalness in 2026, mature commercial licensing, voice cloning available if Cole wants a consistent BrainWise narrator. Cost ~$0.06/1K characters at Flash tier = roughly $0.27 for a 5-min voiceover. Pro tier ($99/mo) recommended for commercial use clause.

Build:
- New Edge Function `generate-voiceover`:
  - Class A JWT + super_admin gate + impersonation gate (`permission_change` category)
  - Accepts `text`, `voice_id`, `model` (default "eleven_multilingual_v2" for long-form, "eleven_flash_v2_5" for short snippets), `stability` and `similarity_boost` for voice tuning
  - Calls ElevenLabs TTS API (key in Edge Function Secrets as `ELEVENLABS_API_KEY`), receives MP3 stream
  - Uploads MP3 to `lesson-assets` Storage bucket, returns public URL + provenance metadata
  - Optional: optionally generate matching transcript via Claude (reuse `draft-text` pattern) for the `embed_audio` block's `transcript_markdown` field — accessibility win
  - Audit row with action_type `ai_authoring_voiceover_generated`
- New `super_admin_action_types` row: `ai_authoring_voiceover_generated`
- Frontend integration in `embed_audio` block editor (Prompt 6)
- ElevenLabs Pro plan or Scale plan signup decision (Pro $99/mo, Scale $330/mo — Pro is the floor for commercial license)
- Voice cloning decision deferred: Cole can record his own voice sample (1 minute for Instant Voice Clone, 30+ min for Professional Voice Clone) if a consistent "BrainWise narrator" voice is wanted across content. Out of scope for the initial Phase 4.5b build.

Estimated effort: 1 session.

### [ADVANCED FEATURE / Phase 4.5c] AI avatar video generation

**Provider locked: Synthesia (primary), Colossyan as L&D-focused alternative.** Synthesia specifically chosen over HeyGen for educational/coach-training use case — Synthesia is built for L&D with FOCA structured-training framework, native quiz/branching scenario support, SOC 2 Type II compliance, and instructor-tone avatars rather than HeyGen's energetic-marketing avatars. Colossyan kept as alternative if Synthesia integration friction is high.

This is the most complex Phase 4.5 integration. Marked as ADVANCED FEATURE UPDATE per Session 56 decision.

Build:
- Synthesia account (Personal $30/mo for evaluation, Creator $89/mo for production, or Enterprise for full API access — pricing tier decision needed)
- Custom avatar creation flow (one-time setup): Cole records 5-10 photos + voice sample, Synthesia generates a digital twin of Cole as BrainWise's canonical narrator. Alternative: pick a stock professional avatar from Synthesia's 230+ library and lock it as the BrainWise voice. Decision deferred to Phase 4.5c kickoff.
- New Edge Function `generate-avatar-video`:
  - Class A JWT + super_admin gate + impersonation gate (`permission_change` category)
  - Accepts `script`, `avatar_id`, `voice_id`, `background_id`, `template_id` (Synthesia has FOCA training templates)
  - Calls Synthesia API to submit video generation job — async, returns job_id
  - Stores job_id + metadata in new `ai_video_generation_jobs` table (id, super_admin_user_id, synthesia_job_id, status, created_at, completed_at, output_url, target_block_id nullable)
  - Returns job_id to frontend (which polls via `get_video_generation_status` RPC)
- Async pattern: video generation takes 1-5 minutes, not seconds. Frontend polls every 10 seconds for status. When complete, downloads MP4 from Synthesia, uploads to Storage bucket, populates the lesson_blocks `video_embed` block with the URL.
- Companion cleanup job: cron sweeps old in-flight jobs (>1 hour stuck) and marks them failed
- New `super_admin_action_types` row: `ai_authoring_video_generated`
- New `ai_video_generation_jobs` table (schema TBD when Phase 4.5c lands — defer details)
- Frontend integration in `video_embed` block editor with "Generate with AI avatar" mode alongside existing "Embed URL" mode (Prompt 6 or as a Prompt 6.5 follow-up)
- LMS integration consideration: Synthesia supports SCORM export. If BrainWise ever pursues SCORM compliance, the cross-system handoff is already half-built via Synthesia.

Estimated effort: 2-3 sessions including async pattern, Storage handling, Synthesia API integration, frontend polling UI.

### Phase 4.5 sequencing

Order of build: 4.5a (image) → 4.5b (voiceover) → 4.5c (video). Each is independent — sequencing reflects increasing complexity and decreasing utility-per-curriculum-hour. Image is used in nearly every lesson; voiceover in many; avatar video in few.

All three depend on Phase 4 (lesson_blocks editor) shipping first. Earliest 4.5 start: after Prompt 6 lands.



### [POST-LAUNCH] NAI and PTP dashboard slice-control parity fixes

Two latent bugs identified in Session 44 while building AIRSA Phase 5b. Both exist in `CompanyDashboard.tsx` (NAI) and `PTPDashboard.tsx` (PTP). Fixed in AIRSA Session 44; deferred for NAI/PTP to avoid regression risk on production dashboards.

1. **Team `<select>` populated from departments instead of supervisors**: lines around CompanyDashboard.tsx 1798-1807 use `departments.map(d => ...)` for the Team dropdown, sending `department_id` where the RPC expects `supervisor_user_id`. The RPC correctly returns suppressed empty state, but the user can't actually select a team. Fix follows AIRSA pattern: add a supervisors loader querying `users` table directly under existing RLS, populate Team dropdown from that.

2. **Dropdowns lack clearable first option after selection**: the placeholder labels "Department ▾" / "Level ▾" / "Team ▾" disappear after a value is selected, leaving no in-dropdown reset. Change first option labels to "All departments" / "All levels" / "All teams".

Address in a single coordinated post-launch Lovable prompt covering both NAI and PTP. Frontend-only, no migrations.

### [LOW] Audit and reconcile semantic-token coverage between marketing-tokens.css and index.css

marketing-tokens.css defines a full semantic alias layer; index.css mirrors only the raw --bw-* tokens. App code falls back to raw tokens or generic Tailwind utilities. Decision needed: replicate the semantic layer in index.css, or have index.css import from marketing-tokens.css.

### [LOW] Bulk supervisor reassignment for existing employees

Mirror existing bulk-deactivate pattern. Add user_assign_supervisor_bulk RPC plus 'Reassign supervisor for selected' affordance. Trigger condition: when a real corporate customer hits friction with > 10 reassignments by hand.

### [LOW] requires_assignment column has zero application readers

Decide: enforce via CHECK constraint that AIRSA Manager rows must have target_user_id set, or remove as dead schema.

### [MEDIUM] Email template helper duplication

Brand-color email template helpers are now copy-pasted across at least 10 Edge Functions. Future brand-color changes require touching all of them. Consider extracting to a shared module via the Supabase Edge Function _shared/ pattern.

### [POST-LAUNCH] Action-Oriented Voice Redesign

Replace neuropsychology consulting prose with scannable action-oriented language plus expandable detail cards across 6 surfaces (NAI/PTP dashboard UI + inline PDF, NAI/PTP individual results UI + PDF). Top Build Queue priority after launch.

### [POST-LAUNCH] Corporate contract renewal schema change

Drop UNIQUE (organization_id) on corporate_contracts, add is_current semantics. Deferred until first renewal occurs.

### [POST-LAUNCH] Department FK migration

Normalize free-text department names to a per-org departments table.

### [POST-LAUNCH] ai_usage / ai_usage_counters table unification

Build Queue Item 98.

### [POST-LAUNCH] Bulk invite/bulk purchase flow with per-client instrument selection

Self-pay vs. coach-paid routing.

### [POST-LAUNCH] Organization grouping layer for My Clients page

(coach feature)

### [POST-LAUNCH] Clarity Engine

Deferred until Resources pages built.

### [POST-LAUNCH] Coach certification portal, Trends tab completion, Path B token-based client upgrade

### [POST-LAUNCH] Regression test for invitation_redeem corporate invitee path

Add an integration test that exercises a fresh anonymous user redeeming a corporate invitation. The Session 38 fix (GUC opt-out app.bypass_user_immutable_check) papered over a path that had been broken since the trigger was created on 2026-04-09. A regression test would catch a future regression.

### [POST-LAUNCH] Pricing-reads refactor

Eliminate hardcoded price IDs in favor of subscription_plans lookups.
