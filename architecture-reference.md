# BrainWise System Architecture Reference

*v80 - Session 76 CLOSE — §99 added (FK lookup tables must be audited alongside CHECK constraints when adding auditable actions); §100 added (structured response shapes for client-side rendering simplification). Group Z content item viewer infrastructure substantially scoped and partially shipped: quiz authoring + quiz viewer backend RPCs shipped + verified end-to-end; quiz authoring frontend (Prompt 1) shipped + verified by Cole; quiz viewer frontend (Prompt 2) drafted but deferred pending Prompt 0 (unified viewer chrome). Comprehensive content item viewer scope doc shipped covering all 8 viewers with locked decisions, gap matrix, per-viewer feature specs, chrome contract, and competitor recon synthesis. (1) §99 added: FK lookup tables must be audited alongside CHECK constraints when adding auditable actions. Standing rule surfaced from Session 76 quiz authoring RPC build. `super_admin_audit_log.action_type` is an FK to `super_admin_action_types`, NOT a CHECK constraint as is the case for many other validation fields. When adding any new RPC that emits an audit log entry via `log_super_admin_action(action_type=>'foo')`, the action_type MUST exist in the `super_admin_action_types` lookup table or the RPC fails with FK violation at audit-log-insert time (which is INSIDE the RPC transaction, so the entire RPC rolls back even though the business logic succeeded). Pattern: any migration adding an auditable-action RPC also INSERTs the action_type row in the SAME migration. Standing query: `SELECT * FROM super_admin_action_types WHERE action_type = 'foo';` before adding any new audit-emitting RPC. Pairs with §96 (relax-RPC-validation requires matching CHECK-constraint audit) — both reinforce that validation lives at multiple layers and ALL must be touched atomically. Action_type fields required per row: `action_type` (PK), `category` (e.g. 'content_authoring'), `description`, `requires_justification` (boolean, almost always true), `is_mutation` (boolean), `denylist_during_impersonation` (boolean — for content_authoring category usually true so super admin cannot impersonate to write content). The pattern also generalizes to ANY FK lookup table used as a discriminator/whitelist in audit or workflow systems — `notification_kinds`, `assessment_instruments.instrument_code`, payment provider type lookups, etc. Standing rule expanded: when adding a new value of a discriminator that lives in a separate lookup table, INSERT into that lookup table in the same migration. (2) §100 added: Structured response shapes for client-side rendering simplification. Standing pattern when a single SQL-driven response shape can produce client-side bugs around how to interpret/filter the data. Refactor to a structured shape with explicit named arrays per logical role, server-side ordered/shuffled as appropriate, rather than returning a flat array that clients must inspect, filter, and shuffle. Example from Session 76 `get_quiz_for_trainee`: for match question types, instead of returning a flat `options` array forcing client to separate `display_order=0` rows (prompts) from `display_order=1` rows (answers), then shuffle the answer subset client-side, the RPC returns `prompts` (server-ordered) + `answers` (server-shuffled via `ORDER BY random()`) as separate named arrays. Net effects: (a) client code is simpler and less bug-prone — no need to filter/partition the array client-side, no need to shuffle client-side; (b) one security boundary made structural — server doesn't need to return `match_pair_key` to client because the answer-side shuffle happens server-side, so the client never sees which prompt matches which answer until it submits (server scores via `submit_quiz_attempt`); (c) the SQL response shape is self-documenting — `prompts` and `answers` field names communicate semantic role, where `display_order=0` and `display_order=1` would communicate only mechanical role. Apply this pattern when: (i) SQL response shape forces client to make role-decisions based on data values rather than data structure; (ii) the client-side filtering/shuffling logic could leak invariants the server should protect (answer keys, pair groupings, correctness flags); (iii) different rows in the same array have semantically different consumer behavior. The pattern extends naturally to: assessment items with multiple item types in one response (separate `multiple_choice_items` and `free_text_items` instead of flat `items` + discriminator), report sections with different render flows (separate `summary_sections` and `detail_sections`), workflow step lists (separate `completed_steps` and `pending_steps` server-side rather than client filter). Net rule: when in doubt about whether the server should return a tagged-union flat array vs separate named-role arrays, prefer separate named-role arrays. (3) **Group Z content item viewer infrastructure work overview (full detail in build-queue.md v84 entry):** Quiz authoring backend shipped — 5 RPCs (`upsert_quiz_question`, `archive_quiz_question`, `reorder_quiz_questions`, `upsert_quiz_answer_option`, `archive_quiz_answer_option`) + 7 new audit action_types. Quiz viewer backend shipped — 2 RPCs (`get_quiz_for_trainee`, `get_quiz_attempt_results`) + 1 M2b patch for ORDER BY outside jsonb_agg in no-reveal branch. Quiz authoring frontend SHIPPED + verified by Cole (Prompt 1 — new page `/super-admin/content-authoring/quizzes/:contentItemId`, mirrors LessonBlocksEditor pattern, 4 question types exposed, text-only options). Quiz viewer frontend prompt DRAFTED but DEFERRED pending Prompt 0 (file: `prompts/prompt-2-quiz-viewer.md`). Comprehensive scope doc shipped: `content-item-viewer-scope.md` covering all 8 viewers with locked decisions, completion-RPC gap matrix verified live, per-viewer feature specs (each with Tier 3 distinctive features), backend work needed, chrome contract spec for Prompt 0, competitor recon synthesis. (4) **Locked architectural decisions Session 76 (full detail in scope doc):** **Sequencing:** Prompt 0 (chrome) → Prompt 2 (quiz viewer) → remaining per-type viewers. Verify chrome with simpler viewers (external_link, video, written_summary) first. Per-viewer prompts plug into chrome's `item_type` branch — they do NOT ship as standalone routes. **Viewer ambition Tier 3 — distinctive:** each viewer gets one differentiator (video AI summary card, quiz smoothness, written AI starter prompt, skills mentor revision status, external link reflection prompt, file upload smoothness, live event Resend reminder, lesson blocks SCORM/API export abstractions). **SCORM/API export Path (a):** post-launch for tooling, abstractions in v1 (`useCompletionReporter`, `useAssetResolver` hooks). **BlockRenderer reuse Path (b):** extract shared visual primitives to `src/components/lesson-blocks/shared/`, fork orchestration for trainee. **Quiz match_picture Path C — defer from v1:** root cause is `content_asset_refs` has no `quiz_question_id`/`quiz_answer_option_id` columns, so existing asset upload infrastructure cannot link uploads to quiz rows. Edge Function fragile — defer until own backend-first work block. **Quiz match pair storage convention:** prompt row `display_order=0, is_correct=false`; answer row `display_order=1, is_correct=true`; shared `match_pair_key`. **Quiz reveal RPC shape Path (a):** structured `prompts` + `answers` for match types, flat `options` for non-match (becomes §100). **Quiz feedback per mode:** `always`→real-time per-question feedback (client gets is_correct flags), `after_each_attempt`/`after_pass`→post-submit per gate, `never`→score only. (5) **Net backend gap before Group Z viewer build completes** (per scope doc §4): `get_content_item_for_viewer` unified read RPC (needed for Prompt 0); `submit_file_upload_completion` RPC (file upload viewer); widen `get_lesson_block_assets` for trainee access OR build parallel `get_lesson_block_assets_for_trainee` (lesson blocks viewer); additive migration `content_item_completions.external_link_reflection_text` + `confirm_external_link` accepts optional p_reflection_text (external link distinctive feature); Resend cron integration 1hr pre-event (live event distinctive feature). Completion-tracking RPCs verified live for all other viewers: `record_video_progress`, `submit_quiz_attempt`, `submit_written_summary`, `mark_skills_practice_signoff`, `confirm_external_link`, `upsert_lesson_block_progress`, `mark_live_event_attendance`. (6) **Chrome contract for Prompt 0** (per scope doc §5): page chrome at `/learning/content-item/:contentItemId` owns route + breadcrumbs (cert path → curriculum → module → content item) + header band (thumbnail, title, completion pill) + action strip (state-adaptive CTA) + loading/error states + completion-driven navigation (refetch user state → detect cascade → ONE modal at highest transitioned tier → next item navigation). Per-type viewers receive: `contentItem` row, `completionState`, `reportCompletion(payload)`, `useCompletionReporter()` hook (debounced for incremental progress reporters like video and lesson_blocks), `useAssetResolver()` hook (wraps existing infrastructure), `navigateToNextItem()`. Per-type viewers MUST NOT own page routes, render breadcrumbs, directly fetch content_item rows, or handle completion-cascade modal logic. (7) **Sequencing locked for Session 77:** Open with Prompt 0 drafting. Pre-work: `get_content_item_for_viewer` RPC. Verify chrome with 3 simplest viewers (external_link, video, written_summary). After Prompt 0 ships+verifies, send drafted Prompt 2 (quiz viewer). Then per-type prompts in order: Prompt 3 (skills practice), Prompt 4 (lesson blocks — largest scope), Prompt 5 (file upload + live event paired). Backend prep can run parallel to viewer prompts. (8) Standing patterns from prior sessions all hold: §61 through §98 unchanged. NO movement Session 76 on: AIRSA Phases 3e-8, SOC 2 written policies, Action-Oriented Voice Redesign, pricing-reads refactor, corporate contract renewal schema change, Clarity Engine, six §82 RLS issues on `coach_disclosure_acceptances` + `user_curriculum_assignments` deferred from prior sessions. (9) **Edge Function versions at Session 76 close:** unchanged from Session 75 close. `get-resource-signed-url` v2 ACTIVE, `request-asset-upload` (RPC) v5 ACTIVE. (10) Session 76 close artifacts: build-queue.md v84 entry, this v80 architecture-reference entry (§99 + §100), session-76-to-77.md handoff, content-item-viewer-scope.md scope doc. All four uploaded manually by Cole to `cbastianBWE/brainwise-internal-docs` per session-close protocol. GitHub MCP READ-ONLY confirmed Session 39 onwards; `create_or_update_file` returns 403. Cole's drag-upload via GitHub web UI is the canonical path.*

*v79 - Session 75 CLOSE — §96 added (relax-RPC-validation requires matching CHECK-constraint audit in same migration); §97 added (detach pattern — hard delete link rows, not soft archive, user enrollments preserved); §98 added (duplicate pattern — deep copy with assets SHARED by reference, new entities start unpublished). Resources flow + detach/duplicate workstream shipped end-to-end this session; 10 bugs fixed; Content Authoring restructure + Rise first-class scoped for future sessions. (1) §96 added: When relaxing RPC validation, audit table-level CHECK constraints in same migration. Standing rule surfaced from Session 75 video content_item chicken-and-egg bug. `upsert_content_item` RPC was updated to accept NULL `video_source_id` when `video_source_type='supabase_storage'` — at the application layer the change was correct. But the table also had a CHECK constraint `content_items_video_required` enforcing the same invariant at the data layer, and it was missed in the initial migration. First save attempt failed at the table check before the RPC's relaxed logic could matter. Pattern: any RPC validation relaxation needs a same-migration audit of `pg_constraint` rows for the affected table — relaxation at the application layer without matching relaxation at the data layer produces silent breakage where the RPC accepts the input but the INSERT/UPDATE fails inside the RPC transaction. Standing query before any RPC validation change: `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = '<table_name>'::regclass AND contype='c';` Pairs with §94 (read-RPC-before-rewrite) and §93 (per-content_type field model with publish-gate validation). The three together form the validation-layer audit discipline: read deployed RPC source first (§94), audit CHECK constraints alongside (§96), update both layers atomically. (2) §97 added: Detach pattern — hard delete link rows, not soft archive. Standing pattern for detaching entities from parent hierarchies (curriculum from cert path, module from curriculum, lesson from module when Rise first-class ships). Link tables (`certification_path_curricula`, `curriculum_modules`) carry UNIQUE constraints on `(parent_id, child_id)` — soft-deleting via `archived_at` would block reattach because the unique constraint still sees the old row. Hard DELETE the link row instead. **Critical: user enrollments preserved (Option A locked Session 75).** Detaching curriculum from cert path does NOT cascade to `user_curriculum_assignments` — users actively progressing through the curriculum keep their enrollment, the curriculum now exists standalone, they continue working. Detaching module from curriculum does NOT cascade to `user_module_assignments`. Rationale: detach is a structural reorganization by super admin, not a user-facing event. Punishing trainees for super admin's curation choices breaks trust. If revocation is the intent, that's a separate action (`revoke_certification` already exists). **Implementation gotcha: clear sibling prerequisite references first.** Curriculum-to-module link rows may carry `prerequisite_module_id` referencing sibling modules; deleting one module's link row without first nulling sibling prerequisite_module_id values will hit FK violation. Pattern: UPDATE all sibling rows in the same link table SET prerequisite_*_id = NULL WHERE prerequisite_*_id = p_target_id, THEN DELETE the target link row, all inside the RPC transaction. RPCs implementing this pattern: `detach_curriculum_from_certification_path(p_certification_path_id, p_curriculum_id, p_reason)` and `detach_module_from_curriculum(p_curriculum_id, p_module_id, p_reason)`. Both assert_super_admin + content_authoring impersonation gate + reason min 10 chars + log_super_admin_action. New action_types: `curriculum_detached_from_path`, `module_detached_from_curriculum`. Forward extension to Rise first-class (Part 2 of scope-content-authoring-restructure.md): `detach_lesson_from_module` follows the same shape — DELETE the lesson_blocks content_item's `module_id`, preserve user progress on lesson_block_progress. (3) §98 added: Duplicate pattern — deep copy with assets SHARED by reference, new entities start unpublished. Standing pattern for duplicating cert paths, curricula, modules (and lessons when Rise first-class ships). Composition: (a) **Deep copy of structural children** — duplicating a module copies its content_items + lesson_blocks + asset_refs + completion_rules. Duplicating a curriculum copies the curriculum row + all modules via internal helper + all module children recursively. Duplicating a cert path copies cert_path + all curricula via internal helper + all curriculum/module children. (b) **Assets SHARED by reference, not duplicated.** Same asset_id appears in `content_asset_refs` rows for both source and duplicate entities. Storage-efficient (no asset bytes duplicated, no new uploads triggered) and semantically correct (the duplicate IS the same content with different metadata). Verified Session 75: duplicate module ended with 4 distinct asset_ids referenced by both source and duplicate's content_items. If an author wants distinct assets per duplicate, they can replace them post-duplicate. (c) **New entities start `is_published=false`.** Forces author review of the duplicate before exposure to trainees. Default to private prevents accidental publish of a half-finished copy. (d) **Slug + name editable in dialog.** Pre-fill with source values + " (copy)" suffix; allow author to set distinct identifiers before save. Slug uniqueness enforced as elsewhere. (e) **Reusable internal helper RPCs.** `_duplicate_module_children(p_source_module_id, p_target_module_id, p_caller_id)` and `_duplicate_curriculum_full(p_source_curriculum_id, p_new_slug, p_new_name, p_caller_id)` are internal helpers (not GRANT'd to authenticated), called from the public-facing `duplicate_module` / `duplicate_curriculum` / `duplicate_certification_path` RPCs. Same internal helpers reusable across the public RPCs prevents duplication of duplication-logic. (f) **Map-tracking for cross-references.** Cert path duplication needs to remap prerequisite_curriculum_id references inside the new cert path's link rows — old prerequisite_curriculum_id points at source curriculum, must point at duplicated curriculum in the new cert path. Pattern: build `v_module_id_map jsonb` as **object** (NOT array) keyed by source_id with value target_id; resolve via `(v_module_id_map ->> source_id::text)::uuid`. **Bug caught Session 75: don't use `jsonb_array_length` on an object** — it's not an array, returns NULL. Use `jsonb_object_keys` if iterating. New action_types: `certification_path_duplicated`, `curriculum_duplicated`, `module_duplicated`. All three public-facing RPCs: assert_super_admin + content_authoring impersonation gate + log_super_admin_action with source_id + new_id + duplicated children counts in audit after_value. (4) **Session 75 work overview (full detail in build-queue.md v83 entry):** Resources flow functional verification (~95% complete) — 6 bugs fixed (RPC type guardrails, FK ambiguity, asset_kind hardcoded, XOR violation, friendly filenames, video routing); locked-tile defaulting bug fixed (defensive frontend pattern: `entity.is_accessible === false` not `!entity.is_accessible`); video content_item chicken-and-egg + stale-state fixes shipped via 2 backend migrations + 2 frontend changes; paid enrollment modal replaces toast; Browse & Enroll label fix; detach + duplicate workstream end-to-end with 5 new super_admin_action_types, 2 detach RPCs, 3 duplicate RPCs, 2 helpers; frontend X-icon detach buttons + Duplicate buttons across CertPathEditor/CurriculumEditor/ModuleEditor; 18+ test scenarios verified PASSED end-to-end. (5) **Content Authoring restructure + Rise first-class scoping (deferred to future sessions).** Cole identified two UX gaps in Content Authoring page Session 75. Full scope doc shipped at `/home/claude/internal-docs/scope-content-authoring-restructure.md` (437 lines). Part 1: replace tree with action sidebar + tile/carousel main area, 6-8 hours, 2 focused sessions. Part 2: Rise first-class with 3 architecture options scoped (Option A decouple lesson_blocks from content_items entirely, Option B nullable module_id only for lesson_blocks — RECOMMENDED v1, Option C hidden "lesson library" module hack), 7-9 hours, 2 focused sessions. Frontend recon: ContentAuthoring.tsx 33KB, ~80% tree logic + ~20% editor routing, heavy rewrite. Backend recon: `content_items.module_id` NOT NULL — Option B requires schema migration. 9 RPCs reference `content_items.module_id` (full list in scope doc). Sequencing recommendation: Part 1 first (establishes tile surface), Part 2 second (plugs into it). DO NOT do both same session. Pre-build decisions required from Cole before either part starts (Part 1 Q1/Q2/Q4/Q5 + Part 2 architecture A/B/C + detach semantics + publish state). (6) **Sequencing decision for Session 76:** Two valid paths. (Path A) Content Authoring restructure + Rise first-class workstream — pre-build decisions first, then ship over 4-5 sessions. Higher author velocity gain. (Path B) Group Z detail pages — continue locked X→Y→Z→V→W arc. Detail pages for cert path / curriculum / module with completion modal sequence + stubs for Restart/Review/Request Access. Cole picks Session 76 open. (7) **Edge Function versions at Session 75 close:** `get-resource-signed-url` v2 ACTIVE (added `as_attachment` boolean param + Content-Disposition transform via Supabase Storage `?download=` param), `request_asset_upload` (RPC) v5 ACTIVE (content-type-aware asset_kind allowing video files), all other Edge Functions unchanged from Session 74 close. (8) **Test fixture state at Session 75 close:** PTP VILT 1 curriculum is DETACHED from PTP-Coach cert path (re-attach via UI or SQL for full hierarchy testing). PTP-Coach is PAID (toggled during paid modal test). `testclientbwe+coupontest@gmail.com` is active+base (revert to inactive+base if cleanup desired). Premium-Only Locked Tile Test resource exists as fixture. Test duplicate module from verification archived for cleanup. (9) Standing patterns from prior sessions all hold: §61 through §95 unchanged. NO movement Session 75 on: AIRSA Phases 3e-8, SOC 2 written policies, Action-Oriented Voice Redesign, pricing-reads refactor, corporate contract renewal schema change, Clarity Engine. Three new build queue items added Session 75 — see build-queue.md v83 entry. (10) Session 75 close artifacts: build-queue.md v83 entry, this v79 architecture-reference entry (§96-§98), scope-content-authoring-restructure.md scope doc, session-75-to-76.md handoff. All four uploaded manually by Cole to `cbastianBWE/brainwise-internal-docs` per Cole's session-close protocol. GitHub MCP READ-ONLY confirmed Session 39 onwards; `create_or_update_file` returns 403.*

*v78 - Session 74 CLOSE — Group Y (My Learning + Resources tabs) shipped end-to-end. §93 added (per-content_type field model with publish-gate validation in the upsert RPC). §94 added (RPC-read-before-rewrite discipline — extends §92 from Edge Functions to PL/pgSQL RPCs). §95 added (server-side signed URL pattern via SECDEF access-check RPC + service-role Edge Function when storage RLS blocks client-side createSignedUrl). Eight backend migrations + 1 new Edge Function + 2 Lovable prompts shipped. (1) §93 added: Per-content_type field model with publish-gate validation in the upsert RPC. Standing pattern when an entity has multiple legitimate content shapes that vary by a discriminator column (e.g. `content_type`) and validation rules differ per shape. Composition: (a) **CHECK constraint covers only invariants** that hold across ALL shapes. CHECK is fast and table-wide but cannot encode publish-state-conditional rules. Drafts (`is_published=false`) typically have no field requirements. (b) **Publish-gate validation in the upsert SECDEF RPC** — `IF NEW.is_published THEN check fields per content_type END IF`. The RPC is the single write path for the entity (RLS blocks direct table writes); validation in the RPC fires only at publish time and can be discriminator-aware. (c) **Distinct error codes per failure mode** — `content_asset_required_to_publish_<type>`, `url_or_file_required_to_publish_<type>`, `provide_url_or_file_not_both_to_publish_<type>`. Named codes are greppable, map cleanly to frontend toasts, and document intent. (d) **XOR (exclusive OR) shapes are explicit** — for article/video both file and URL are legitimate content carriers but never both simultaneously; the RPC validates `(url IS NOT NULL) <> (file_asset_id IS NOT NULL)` at publish time. (e) **Single-shape requirements explicit** — guide/worksheet/template require file when published; URL field is unused for these types. Applied Session 74 to `resources` table + `upsert_resource` RPC. The original Group Y Migration M2 model (article/guide/video → NULL content_asset_id, worksheet/template → required file) was revised mid-session per Cole's product decision: guide is file-only; article/video are file-OR-URL XOR. Migration M7 shipped the revised model with publish-gate validation. The pattern applies forward to any entity whose content shape varies by discriminator: future asset variants (transcript-or-audio for podcast content_type), assessment item shapes (multiple-choice vs free-text vs file-upload responses), notification template variants (text-only vs rich-html-with-images). Standing rule: when adding a new content_type or shape variant, ALWAYS audit the upsert RPC publish-gate alongside the CHECK constraint — they are two layers and both need updating. (2) §94 added: RPC-read-before-rewrite discipline. Standing rule extending §92 (deploy-Edge-Function-then-commit-source) from Edge Functions to PL/pgSQL RPCs. Before rewriting any existing RPC, ALWAYS run `pg_get_functiondef('rpc_name'::regprocedure)` (or `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='rpc_name'`) to read the current deployed source. Never reconstruct from memory; never trust documentation summaries. Why: RPCs accumulate guardrails over their lifespan. The `request_asset_upload` RPC had a legacy guardrail rejecting any `ref_field` other than 'thumbnail' when the parent scope was 'resource' — added in Session 70 when resource-mode was first introduced and not documented anywhere as a constraint. Session 74 surface: Cole tested Prompt B's file upload on a guide resource, got "Edge Function returned non-2xx status code" with no useful client-side error. Diagnosis path: read the deployed RPC body via execute_sql, found the legacy guardrail at line 47, shipped Migration M8 to extend the allow-list to include 'content' for resource scope. Without reading the deployed body first, the natural debugging path would have been to suspect the Edge Function, the storage RLS, the asset_kind validation, or the request format — burning 30+ minutes before getting to the actual cause. Standing rule: `pg_get_functiondef` is free; misdiagnosed RPCs cost session time. Reading the deployed source first turns this from a 30-minute investigation into a 5-minute fix. The same logic explicitly covers RLS policies (`pg_policies` SELECT before policy changes), CHECK constraints (`pg_get_constraintdef` before adding new values), and trigger bodies (`pg_get_triggerdef` before modifying trigger behavior). Apply the read-first discipline to ANY backend object being modified, not just Edge Functions. (3) §95 added: Server-side signed URL pattern via SECDEF access-check RPC + service-role Edge Function. Standing pattern when storage RLS blocks the client-side `supabase.storage.createSignedUrl()` path for an end-user class but those users still need to read the asset. Composition: (a) **Storage RLS stays locked** — the bucket's SELECT policy continues to restrict reads to the original authorized class (e.g. super_admin only for `lesson-assets`). Don't loosen storage RLS to accommodate the broader user class — that would unlock direct-table reads, leaking metadata. (b) **SECURITY DEFINER access-check RPC** at the DB layer (`get_resource_content_asset(p_resource_id)` is the Session 74 example) — runs the full access-grant evaluation logic (plan_tier / org / role / cert / account_type grants OR'd), returns the asset's `bucket` + `path` + `mime_type` + `original_filename` + `size_bytes` if access is granted, raises if not. EXECUTE granted to authenticated, REVOKED from anon. (c) **Edge Function as the storage proxy** (`get-resource-signed-url` v1 is the Session 74 example) — Class A custom auth via getClaims, calls the access-check RPC via the user's JWT-bearing client (so RLS and auth attribution work correctly), then uses a SEPARATE service-role storage client to call `storage.createSignedUrl(bucket, path, 900)` which bypasses storage RLS. The Edge Function NEVER stores the signed URL or extends its lifetime — it returns the URL directly to the caller. (d) **15-minute expiry default** — short enough that a leaked URL has bounded blast radius, long enough that a typical viewer session won't expire mid-read. Tune per asset_kind: thumbnails 12h fine (low sensitivity), videos and PDFs 1-2h (Group Y deferred item). (e) **Frontend pattern: `supabase.functions.invoke()`, never `supabase.storage.createSignedUrl()`** — the latter would call storage directly under the user's JWT and fail. Field-driven routing: `content_asset_id != null` triggers the Edge Function path; URL-only resources route through `url_or_content` directly with no Edge Function involvement. Applied Session 74 to `get-resource-signed-url` for resources. The pattern extends naturally to: lesson_block assets when Group W ships (trainees need `get_lesson_block_assets` RPC widened or a new resolver — currently super-admin only, logged as Build Queue item), assessment file uploads, certification PDF downloads (Group V will need this for personalized PNG/PDF generation). Standing rule for any new asset-read path: if storage RLS is locked tighter than the read-class, build a SECDEF-RPC + service-role-Edge-Function proxy; do NOT loosen storage RLS. (4) Six gap decisions locked Session 74 for Group Y design: locked-tile = plan_tier-gated visible-but-locked, org/role/cert/account_type-gated hidden entirely (visibility-vs-conversion design); resource sort by content_type group then published_at DESC; My Learning sort by status_group then last_engaged_at DESC; new `list_available_learning` RPC for All Available view; standalone modules get full `user_module_assignments` parallel-to-curriculum schema; worksheet/template content reuses private `lesson-assets` bucket with server-side signed URLs (§95 pattern). Self-enrollable model: per-entity boolean + price_cents nullable (NULL=free) + wipe-on-toggle-off. Upgrade modal routes to `/pricing` (PricingRouter resolves to /settings/plan or /dashboard per account_type). (5) **Eight backend migrations shipped + 1 Edge Function deploy.** M1 (self_enrollable columns × 3 tables + extended upsert signatures), M2 (resources.content_asset_id + get_resource_content_asset SECDEF RPC + extended upsert_resource), M3 (get_user_resources extended with is_accessible + content_asset_id + content_type sort group), M4 (user_module_assignments table + 4 §82-clean RLS policies + 2 admin action_types + 5 self-enroll/admin-assign RPCs), M5 (get_user_learning_state extended with last_engaged_at + status_group + module_assignments[]), M6 (list_available_learning new SECDEF RPC), M7 (revised content-field model per §93 + publish-gate validation in upsert_resource), M8 (request_asset_upload extended to allow ref_field='content' for resource scope, document asset_kind validation, content_asset_id pointer-stamp on parent row). Edge Function get-resource-signed-url v1 NEW deployed (verify_jwt:true, Class A custom auth, GitHub commit pending per §92). (6) Two Lovable prompts shipped Session 74: **Prompt B (super-admin authoring extensions, 4 files)** — full DB round-trip verification PASSED. ResourceEditor.tsx + CertPathEditor.tsx + CurriculumEditor.tsx + ModuleEditor.tsx. Self-enrollable Free/Paid radio conditional on toggle, Price input conditional on Paid, wipe-on-toggle-off, round-trip persistence. Audit log shows symmetric before/after JSON across cert_path (flat), curriculum (nested), module (nested) entity shapes. **Prompt A (trainee surfaces, 10+ files)** — Resources.tsx rewrite, 6 files in src/components/resources/ (3 thin wrappers + ResourceGridTab shared logic + MyLearningTab + UpgradeNudgeModal + types), ResourceReader.tsx, assetUrls.ts helper, Tile.tsx additive `locked` prop, App.tsx route wiring. Verified: Edge Function call path correct (not client-side createSignedUrl), field-driven XOR routing on `content_asset_id` not content_type, locked-tile flow opens UpgradeNudgeModal not redirect, self-enroll handler dispatches by entity type, payment_required returns toast not crash. (7) **Soft-stub in Prompt A: paid self-enroll path returns toast "Payment flow coming soon — contact support to enroll" when RPC returns `payment_required`.** Intentional for launch — Stripe Checkout integration for cert path / curriculum / module purchase enrollment is deferred to post-launch (needs metadata-driven session creation + webhook handler that creates the user_curriculum_assignments / user_module_assignments / coach_certifications row post-payment). Logged in Build Queue v82 entry. (8) **Pre-existing carry-forward issues observed Session 74 but NOT fixed.** §82 RLS violations on `user_curriculum_assignments` (3 policies with `roles: {public}` instead of `{authenticated}`) — pre-existing, deferred to next §82 audit pass. `get_lesson_block_assets` gates on super-admin only — trainees can't use; needs own resolver RPC when Group W ships (lesson_blocks content item viewer). Tile.tsx latent footgun: locked tile renders inline CTA if both `inlineCtaLabel` and `onInlineCtaClick` provided; MyLearningTab call site correctly gates this via `shouldShowEnrollButton`, so theoretical only — defensive `&& !locked` gate to be added next Tile.tsx touch. (9) Sequencing locked for Session 75+ per the X→Y→Z→V→W Group C completion arc (locked Session 72): Session 75 opens with Cole authoring content (1-2 hours) before Prompt A functional testing — full prerequisite list in Build Queue v82 entry. After functional verification: Group Z (detail pages — cert path, curriculum, module + completion modals + stubs for Restart/Review/Request Access). Then Group V (Certification page at /certifications/<id> with Canvas API PNG personalization). Then Group W (Content item viewers — Video, External Link, lesson_blocks minimum — requires lesson_blocks interactive widget recon first). NO movement Session 74 on: AIRSA Phases 3e-8, SOC 2 written policies, Action-Oriented Voice Redesign, pricing-reads refactor, corporate contract renewal schema change, Clarity Engine. (10) **Edge Function versions at Session 74 close:** `get-resource-signed-url` v1 NEW ACTIVE verify_jwt:true (Class A custom auth — getClaims + access-check RPC via callerClient + signed URL via serviceClient). All other Edge Functions unchanged from Session 73 close: `create-checkout` v56, `customer-portal` v41, `create-comp-coupon` v2, `stripe-webhook` v26, `ai-chat` + `generate-report` (Session 73 §90 deploys). Standing patterns from prior sessions all hold: §61 through §92 unchanged. The `lesson-blocks-content-schema.md` doc remains unwritten (carried forward from Session 70). (11) Session 74 close artifacts: build-queue.md v82 entry, this v78 architecture-reference entry (§93-§95), session-74-to-75.md handoff. All three uploaded manually by Cole to `cbastianBWE/brainwise-internal-docs` per session-close protocol. GitHub MCP READ-ONLY confirmed Session 39 onwards; `create_or_update_file` returns 403. Cole's drag-upload via GitHub web UI is the canonical path. Edge Function source for `get-resource-signed-url` ALSO needs Cole's upload to repo `main` per §92.*

*v77 - Session 73 CLOSE (security audit cycle) — §89 added (view-as-gate pattern for column-level privacy on row-readable tables); §90 added (AI rate limit + length cap pattern via `check-ai-usage` Edge Function with `usage_type` parameter, gated by `!isInternal` for server orchestration paths); §91 added (Stripe-and-external-API Edge Function security hardening pattern: allowlist Set + Origin validation + quantity bounds + named constants); §92 added (repo↔runtime sync discipline — every Supabase MCP `deploy_edge_function` followed same-session by GitHub commit). Security audit cycle ran end-to-end Session 73 close: initial Lovable scan surfaced 2 errors + 9 warnings; four diagnostic rounds with Lovable to triage; 7 backend migrations + 2 Edge Function deploys + 2 GitHub commits + 2 Lovable frontend prompts; final scanner state 0 errors / 0 warnings / 15 ignored with documented rationale. (1) §89 added: View-as-gate pattern for column-level privacy on row-readable tables. Standing pattern when a base table has rows that some viewer class should see SOME columns of but not OTHERS — and direct base-table SELECT cannot project columns because RLS policies act at row not column level. Composition: (a) **Drop the base-table SELECT policy** for the limited-access viewer class. After the drop, that viewer class has zero base-table read access. (b) **Create a SECURITY DEFINER view** projecting only the safe columns, with the row-filter WHERE clause baked in. The view's definer privileges read the base table; the view's WHERE clause is the authorization gate. Example from `coach_clients_client_view`: 16 client-safe columns SELECTed, `WHERE client_user_id = auth.uid()`, explicitly excludes `coach_notes`, all Stripe fields, refund/coupon/revoked/source columns. (c) **Revoke non-SELECT grants** from `authenticated` on the view (INSERT/UPDATE/DELETE/TRUNCATE). Defense-in-depth against Postgres view-update rules silently allowing writes back to base table. (d) **Frontend reads via the view exclusively** — all `.from("base_table")` calls for the limited viewer class swap to `.from("view_name")`. Coach-side queries on the base table remain (coaches need full access including their own `coach_notes`). **Why SECURITY DEFINER over SECURITY INVOKER:** invoker mode would resolve RLS at the viewer's privilege level, requiring a base-table SELECT policy for that viewer class — which is precisely what got dropped. Definer mode bypasses base-table RLS; the WHERE clause IS the gate. This is intentional, not a security smell. The Supabase advisor flags SECURITY DEFINER views as `security_definer_view` warnings — those need to be marked ignored with rationale documenting that the WHERE-clause-as-gate is the design intent. Applies forward to any base table where column-level access asymmetry is needed: notification preferences (some columns admin-readable, others private), assessment_results (some columns peer-shareable per PTP toggles, scores never), user PII tables (some columns role-aware visible). Always pair with §82 — every new view + every modified base-table policy needs explicit `TO role`. (2) §90 added: AI rate limit + length cap pattern. Standing pattern for any Edge Function that calls Anthropic API on behalf of end users. Two layers, both pre-Anthropic-call: (a) **Length caps on user input** — `if (input.length > MAX_INPUT_CHARS) return 400 input_too_long`. Sized to the practical limit of the surface (4000 chars for chat message, 50000 chars for AI authoring config-in-context). Returns structured error code, not generic 400. Stops oversized payloads from consuming Anthropic credits and from triggering max_tokens issues downstream. (b) **Rate limit via `check-ai-usage` Edge Function** before invoking Anthropic. Pattern: POST to `check-ai-usage` with `{usage_type: "<surface_name>"}` body, await response, return 429 if `!usage.allowed`. The `usage_type` parameter discriminates between surfaces so per-surface quotas can be tuned independently (chat vs report generation vs lesson authoring). Internal callers (server-to-server, x-internal-secret authenticated) bypass via `if (!isInternal)` guard — the internal secret-bearing path is trusted infrastructure (e.g., `retry-ptp-narratives` calling `generate-report`), not user-driven. **Ownership checks remain regardless of rate limit.** Rate limiting is one of three independent gates: auth (JWT or internal secret), ownership (caller has rights to the resource), and rate limit (caller is within quota). All three required for user paths; internal bypasses rate limit only. Applied Session 73 to `ai-chat` (length caps) and `generate-report` (rate limit). Standing rule for new AI-call Edge Functions: implement all three gates before merging. (3) §91 added: Stripe-and-external-API Edge Function security hardening pattern. Standing pattern for Edge Functions that consume external request data and pass it to third-party APIs (Stripe, webhook receivers, payment processors). Composition: (a) **Named-constant allowlist Sets** at module top — `const PRICE_ID_ALLOWLIST = new Set<string>([...])`, `const ALLOWED_ORIGINS = new Set<string>([...])`. Sets give O(1) lookup and self-document intent. Hardcoded values, NOT environment-variable-driven, so the allowlist itself is reviewable in code review. (b) **Validation BEFORE downstream call** — `if (!PRICE_ID_ALLOWLIST.has(body.price_id)) return 400 price_id_not_allowed` happens BEFORE the Stripe API call. Stripe API errors are slow and consume rate budget; allowlist rejection is fast and free. (c) **Origin validation for redirect URLs** — Stripe `success_url`/`cancel_url`/`return_url` get constructed from request Origin header. Origin must be validated against allowlist + regex (for preview environments like Lovable). Pattern: `const safeOrigin = isOriginAllowed(req.headers.get("origin")) ? req.headers.get("origin") : null; if (!safeOrigin) return 400 origin_not_allowed;` Then `success_url: \`${safeOrigin}/success\`` is safe. The fallback-to-localhost pattern (`origin || "http://localhost:3000"`) is the anti-pattern — never use it. (d) **Quantity / amount bounds** — `const MAX_QUANTITY = 50; if (quantity > MAX_QUANTITY) return 400 quantity_out_of_bounds`. Even if Stripe enforces its own limits, doing the bounds check locally produces a faster, cheaper error and documents intent in code. (e) **Per-Edge-Function error codes** — `price_id_not_allowed`, `origin_not_allowed`, `quantity_out_of_bounds`. Named codes are greppable, debuggable, and aliasable from frontend to user-facing messages. Applied Session 73 to `create-checkout` v56 + `customer-portal` v41. Standing rule for new Stripe-or-external-API Edge Functions: implement all four hardening layers. The Lovable security scanner will flag missing pieces; future audits should re-validate after any Lovable rewrite of these functions (per Cole's earlier note: `create-checkout` is rewritten frequently by Lovable when adjacent files are touched). (4) §92 added: Repo↔runtime sync discipline. Standing rule: every Supabase MCP `deploy_edge_function` call MUST be followed same-session by GitHub commit of the deployed source via `create_or_update_file` (or manual web UI upload when MCP is read-only). Why: deployed Edge Functions run from Supabase's edge runtime, but `cbastianBWE/brainwise-blueprint` repo is the canonical source of truth for code review, future modification reference, and Lovable's awareness of current state. Drift produces real cost: Round 2 of Session 73's security audit spent ~30 minutes diagnosing why Lovable's scanner was flagging code lines that didn't match the deployed version — the deployed function had been updated via MCP in Session 72 Pattern C work, but the repo still showed the pre-Pattern-C source. **Failure mode the drift creates:** Lovable bases its work (and its security scanner) on the repo source. When Lovable rewrites an Edge Function, it overwrites the deployed runtime with its own version of the repo source — which may LOSE security hardening or feature edits that were MCP-deployed but never committed. The `create-checkout` function is particularly vulnerable because Lovable frequently rewrites it when adjacent checkout-flow files are touched. Mitigation: after every `deploy_edge_function`, immediately `create_or_update_file` to repo `main` with the same source. When MCP write is unavailable (current GitHub MCP returns 403 on `create_or_update_file` and `push_files`), Cole uploads manually via GitHub web UI same session. Cole's session-close protocol already covers this for the three markdown closeout docs; Edge Function source files need the same discipline. Standing addition to closeout discipline: deployed-but-not-committed Edge Functions are listed in the session handoff with their current deployed version and the same source attached as a file artifact for Cole to upload. (5) Security audit cycle pattern (informal — not a §-numbered standing rule but a process pattern worth recording). When a scanner produces N findings, the cost-efficient triage flow is: **Round 1 — Diagnose only.** Send all findings to Lovable with explicit "diagnose only, do not write code" instruction. Lovable reads the live source, reports back which findings reference real code that matches the scanner's described vulnerability, and which findings reference cached or pre-fixed code. **Round 2 — Verify real findings.** Claude uses Supabase MCP queries + GitHub `get_file_contents` to confirm Lovable's verdicts on each "real" finding. Surfaces drift (Session 73 caught the repo↔runtime drift here) and any cases where Lovable's diagnosis missed nuance. **Round 3 — Ship fixes.** Migrations + Edge Function deploys + GitHub commits + Lovable frontend prompts execute the fix plan for confirmed real bugs. **Round 4 — Re-scan and ignore false positives.** Scanner re-run produces a smaller list with cache + lingering false positives. Each gets marked ignored in Lovable UI with documented rationale (code location proving the fix is in place; the scanner's stated "acceptable if X" branch being matched; design-intentional with §-reference to the standing rule). Four rounds beats four sequential fix-then-rescan cycles because Round 1 eliminates wasted work on non-bugs. (6) Two-stage RLS audit pattern (process not §-numbered). **Stage 1 — Common-case sweep.** `SELECT tablename, policyname, roles FROM pg_policies WHERE schemaname='public' AND 'public'=ANY(roles) AND qual='true';` Surfaces every §82 anti-pattern (service_role policy with `roles: {public}` defaulted-in) in one query. Stage 1 finds the systematic-misconfiguration cases — typically 20-30 tables when a sweep is overdue. **Stage 2 — High-value-table inspection.** Read all policies on each table holding PII or scored assessment data (assessments, assessment_results, assessment_acknowledgments, coach_clients, users, user_notifications, sharing_preferences, permissions). Verify explicit `TO role` declaration AND non-trivial qual. Stage 2 finds subtle cases Stage 1 misses — policies with `roles: {authenticated}` but `qual: 'true'`, or `qual` matching too broadly. Applied Session 71 (initial RLS audit, Stage 1 + Stage 2 surfaced 27+ findings) and Session 73 (security audit cycle, both stages re-run, surfaced quiz_questions + cohorts + module_completions §82 gaps). Standing rule for future audits: both stages, every time. (7) Final disposition of Session 73 security findings (15 items): 5 real bugs closed via migrations + Edge Function deploys + Lovable prompts; 5 scanner cache false positives ignored with rationale; 3 design-intentional warnings ignored with §-reference (§84 storage tier, Session 71 webhook reconstruction, §89 view-as-gate); 2 deferred-by-design forward-looking items (cohort SELECT when feature ships, anon EXECUTE audit session). Build queue items for forward work logged in build-queue.md v81 entry: post-launch view→RPC refactor for `coach_clients_client_view`, Session 71 anon EXECUTE audit dedicated session, Phase 5/Group D cohort SELECT when feature ships, Stripe-pattern lessons-learned doc (this entry §91 closes that item). (8) Edge Function versions at Session 73 close (FULL list including security audit updates): `create-checkout` v56 ACTIVE verify_jwt:true (Pattern C + §91 hardening), `customer-portal` v41 ACTIVE verify_jwt:true (§91 hardening), `create-comp-coupon` v2 ACTIVE verify_jwt:false (Pattern C, unchanged this audit), `stripe-webhook` v26 ACTIVE verify_jwt:false (Pattern C, unchanged this audit), `ai-chat` (latest Lovable deploy with §90 length caps in `supabase/functions/ai-chat/index.ts` lines 70-83), `generate-report` (latest Lovable deploy with §90 rate limit in `supabase/functions/generate-report/index.ts` lines 70-94). Other Edge Functions unchanged from Session 72/73 close. (9) Standing patterns from prior sessions all hold: §61 through §88 unchanged. The `lesson-blocks-content-schema.md` doc remains unwritten (carried forward from Session 70). (10) Session 73 close artifacts: build-queue.md v81 entry (security audit cycle), this v77 architecture-reference entry (§89-§92 + audit process patterns), session-73-to-74.md handoff. All three uploaded manually by Cole to `cbastianBWE/brainwise-internal-docs` per Cole's session-close protocol.*



*v76 - Session 73 CLOSE — Pattern C "super admin acts as practitioner coach" shipped end-to-end. §87 added (decoupling-account-type-from-functional-role pattern via per-user boolean flag + helper function + RLS swap, illustrated by `is_practitioner_coach`). §88 added (comp coupon system as forward-thinking infrastructure — Stripe coupon admin UI built once, reusable for any future promotional/discount scenario). Eight backend migrations shipped this session (Migration A–H, including hotfix B2 and B3), three Edge Function deploys (`create-comp-coupon` v1→v2, `create-checkout` v54→v55, `stripe-webhook` v25→v26), one Lovable frontend prompt covering 6 files, one synthetic data row to bridge a frontend cert-check gap, end-to-end verified twice. (1) §87 added: Decoupling account-type from functional-role via per-user boolean flag + SQL helper function + RLS swap. Standing pattern for any future case where the platform needs to grant a functional capability to a user without changing their primary `account_type` (which carries org/admin/billing semantics and shouldn't be repurposed for capability flags). The pattern has 5 components: (a) **Per-user boolean column on `public.users`** carrying the capability flag, e.g. `is_practitioner_coach boolean NOT NULL DEFAULT false`. Partial index `WHERE flag = true` for selective lookup. Backfilled at column-add time to match existing account_type semantics. (b) **SECURITY DEFINER STABLE SQL helper function** mirroring the `current_user_account_type()` convention, e.g. `current_user_is_practitioner_coach()` returning boolean, COALESCE'ing to false. SET search_path. EXECUTE granted to authenticated + service_role. Postgres can cache STABLE function results per row during RLS evaluation, making per-row filtering performant. (c) **RLS policy swap on capability-gated tables** DROP+CREATE each policy replacing `current_user_account_type()='ROLE'` with `current_user_helper_function() = true`. Backfill from (a) means real-role users still pass; flag-also-true users newly pass. All recreated policies §82-clean with explicit `TO authenticated`. (d) **RPC widening on capability-gated PL/pgSQL functions** that have their own auth gate. Read both `account_type` and the new flag from users in the same SELECT; introduce `v_is_super_admin_with_capability := (account_type='brainwise_super_admin' AND capability_flag)`; widen gate to accept real role OR super-admin-with-flag; bypass any role-specific downstream gates (cert checks, etc.) when super admin path is active. (e) **BEFORE trigger on users INSERT/UPDATE OF account_type** auto-flips the flag to true when account_type transitions INTO the target roles. Does NOT auto-flip OFF — removal of capability must be a deliberate manual UPDATE. WHEN clause on the trigger to skip no-op fires. Why each piece matters: (a) decouples capability from billing/org semantics; (b+c) gives RLS a fast, centralized check that doesn't bloat individual policies; (d) handles the auth-gating PL/pgSQL functions that exist outside RLS; (e) makes the capability state self-maintaining for new signups + role transitions. Pattern applies forward to any future "X user role can also do Y" requirement (e.g. "company_admin can also act as a coach" would be the same 5-component shape). The frontend half is parallel: a guard component checking the flag (PractitionerCoachGuard), conditional sidebar nav entries, role-aware page sections. Frontend route guards stay separate from account-type RoleGuard because the flag is independent of account_type. (2) §88 added: Forward-thinking infrastructure — the `comp_coupons` system as one-time investment for many future use cases. The Pattern C super_admin_comp coupon need is one specific case of a general capability: super admin needs to create Stripe-side coupons via BrainWise admin UI rather than the Stripe Dashboard. The simpler path would have been a one-shot Stripe Dashboard coupon + a hardcoded coupon ID lookup in `create-checkout`. The path chosen instead: a full coupon-management subsystem covering (a) `comp_coupons` table with all fields needed for any percent_off Stripe coupon (1-100% covers comp through promotional discount), (b) duration enum (once/repeating/forever) supports one-time promos and recurring subscription discounts, (c) `applicable_account_types text[]` array filter so future promos can target specific account types ("free trial conversion bonus for individuals", "premium coach loyalty discount", etc.) without code changes, (d) `applicable_instrument_ids uuid[]` for per-instrument promotions, (e) `redeem_by NOT NULL` so every coupon expires (forcing renewal hygiene), (f) `archived_at` soft-delete so historical coupons remain auditable, (g) 3 RPCs covering create/lookup/archive lifecycle with full super-admin audit log integration, (h) Edge Function (`create-comp-coupon`) that wraps Stripe API + DB insert in transactional cleanup (Stripe coupon rolled back if DB insert fails), (i) frontend admin UI at `/super-admin/coupons` for non-engineer coupon management. Cost-vs-value math: ~3 hours of engineering for the infrastructure once vs. ~30 minutes per future ad-hoc coupon need plus inconsistent audit trails plus risk of hardcoded coupon IDs going stale plus risk of one-shot scripts being lost. Standing pattern: when a specific need surfaces, consider whether the general case is worth the same investment now vs. the cumulative cost of one-shots later. For coupons, the general case won — coupons are inherently a recurring authoring need (promos, comps, partner discounts, etc.). The same logic should apply to future "admin needs to do thing X via Stripe Dashboard" needs — build the admin UI once. (3) Eight backend migrations + hotfix progression (full detail in build-queue.md v80 entry): Migration A (comp_coupons table + indexes + RLS), Migration B (3 RPCs + 2 action_type whitelist rows), Migration B2 (impersonation gate added to `_insert_comp_coupon_row` per defense-in-depth at SQL layer rather than Edge Function layer — keeps gate enforcement in one place regardless of caller path, avoids `_shared/impersonation_gate.ts` repo sync gap), Migration B3 (HOTFIX — granted EXECUTE on `_insert_comp_coupon_row` to `authenticated` role; was service-role-only originally, but the internal call to `log_super_admin_action` requires non-null auth.uid() which service-role doesn't provide; defense-in-depth via the internal super-admin check inside the RPC body remains intact), Migration C (`users.is_practitioner_coach` column + index + backfill), Migration D (`current_user_is_practitioner_coach()` SECURITY DEFINER STABLE helper), Migration E (7 RLS policies DROP+CREATE swap on coach-affordance tables), Migration F (2 PL/pgSQL coach_shareable_link RPCs widened with super-admin-practitioner path + cert check bypass), Migration G (2 BEFORE triggers on users for auto-flip on account_type transitions INTO target roles), Migration H (synthetic `my_brainwise_coach` certification row for Cole's super admin user — frontend cert check on My Clients page disables Order Assessment button when coach_certifications empty regardless of is_practitioner_coach flag; chose backend synthetic-row fix over frontend-rework fix per Cole's earlier explicit "we are not gated by being certified" instruction). (4) Three Edge Function deploys: `create-comp-coupon` v2 (Class A custom auth via getClaims, super-admin gate, Stripe coupon create, RPC insert via caller JWT not service role for audit attribution — see standing pattern below), `create-checkout` v55 (surgical edit adding `get_applicable_comp_coupon` lookup before sessionParams build; applies `discounts: [{coupon}]` + stamps `metadata.bw_super_admin_comp:"true"` when coupon found; real coach flows unchanged because `applicable_account_types=['brainwise_super_admin']` excludes them at the RPC level), `stripe-webhook` v26 (surgical guards on the `recalculateCombinedCouponForEmail` call in BOTH coach_order and coach_bulk_order branches: `if (!isSuperAdminComp)` where `isSuperAdminComp = metadata.bw_super_admin_comp === "true"`; real coach orders never have this metadata so their flow runs verbatim including credit-coupon generation; super admin $0 comp orders skip the meaningless $0-credit-coupon generation). All other webhook logic preserved: coach_clients insertion, assessment_purchases insertion, sendInvitationEmail (fires unconditionally, preserves invitation flow integrity), bulk batch completion, subscription handling. (5) **Standing pattern reinforced — SECURITY DEFINER RPCs that internally call audit logging MUST be invoked via JWT-bearing client, not service-role.** Discovered in Pattern C via the v1→v2 Edge Function bug. The internal `log_super_admin_action` call reads `auth.uid()` to attribute the audit row to the human actor; service-role has no auth.uid() so this fails with `Authentication required`. The whole transaction rolls back, surfacing as `db_insert_failed` 500 from the Edge Function. Fix: invoke the RPC via `callerClient` (constructed with the user's JWT in Authorization header) rather than `serviceClient`. The internal super-admin check inside the RPC body remains the auth gate (granted EXECUTE to authenticated since service-role can't reach it anymore). Pattern: any RPC that calls `log_super_admin_action`, or any other auth.uid()-dependent function, MUST be reachable via the user's JWT. Edge Functions typically construct two clients — one with anon+JWT (`callerClient`) and one with service-role (`serviceClient`). Use `callerClient` for RPCs that audit; use `serviceClient` for table-level reads that bypass RLS for cross-cutting concerns. Diagnostic shortcut for this failure mode in future work: zero rows in `super_admin_audit_log` for the expected action_type within the failure window → failure happened BEFORE audit logging → narrow to auth/validation/business-logic; synthetic execute_sql call to the RPC directly from MCP isolates which step. (6) Pattern C synthetic-cert observation: extending pre-existing tables for capability bridging carries risks the §81 standing rule covers (full DDL audit before extending an established table). The synthetic `coach_certifications` row inserted Session 73 for Cole's super admin is functionally clean (matches all CHECK constraints, populates audit fields with self-attestation, notes flag the row as non-real) but it pollutes any analytics that count "certified coaches". Standing rule for analytics queries that count certified coaches: filter `account_type != 'brainwise_super_admin'`. Logged in build-queue.md v80 Build Queue items. This pattern (synthetic data row to bridge a capability gap) is acceptable for one-off cases but is anti-pattern for repeated extension — if it would need to happen for every new super admin who wants to act as a coach, the right fix is the frontend cert-check rework. Currently 2 super admins in production, both auto-flipped to is_practitioner_coach=true via Migration C backfill; only Cole has the synthetic cert row. If the second super admin needs to act as a coach, manually insert a matching row using Migration H as template. (7) **Real coach flow protection verified live.** Cole's hard constraint Session 73 ("make sure these changes don't break any of the invitation stuff as that needs to stay intact") was honored via three layers: (a) Migration F preserved real coach `coach_shareable_link_*` path verbatim — auth gate accepts coach OR super-admin-practitioner, but real coaches still hit the cert check + cert-derived instrument filter; (b) `get_applicable_comp_coupon` returns empty for any non-super-admin caller (verified live via 3 real coach UUIDs returning 0 hits each); (c) `stripe-webhook` guard fires on purpose-built `bw_super_admin_comp` metadata key, not a generic "discount applied" signal — future promotional coupons for real coaches won't trigger the credit-skip behavior. Standing pattern: when adding new code paths alongside existing critical paths, use purpose-built signals (named metadata keys, named flag columns) over generic-attribute detection (presence/absence of discount, presence/absence of any flag). Generic-attribute detection is fragile; purpose-built signals are intent-explicit and stable under feature additions. (8) **Frontend Stripe-bypass path discovered during testing.** Test invites to two real emails completed without Stripe Checkout firing. `coach_clients` rows created, `assessment_purchases` rows with `amount_paid=0` and `stripe_payment_intent_id=NULL`, invitation emails sent. Pattern C's `create-checkout` + `stripe-webhook` edits were NOT exercised by this flow. Investigation deferred to Session 74. Two possibilities: (a) frontend has a pre-existing "if 100% comp coupon applies, skip Stripe and write rows directly" path that I missed during recon; (b) Lovable added new frontend logic during Pattern C frontend ship that took this shortcut. Either way the outcome is functionally correct (no money charged, invitation delivered, $0 assessment purchase entitled for the client to consume on signup) — the architectural question is whether Pattern C's Stripe-mediated path or the direct-write path is the canonical implementation. Build Queue item logged. (9) **Frontend hotfix pattern: revoked-data filtering.** Pre-existing My Clients roster bug (predates Pattern C, affects all coaches) — the stat-card "Pending Invitations" count correctly filters `revoked_at IS NOT NULL` but the unique-clients-derivation loop powering the table did not, producing a mismatch. Two-line surgical fix to `src/pages/coach/CoachClients.tsx` — added `if (row.revoked_at !== null) continue;` at top of derivation loop + extended the Level 2 TableBody filter from `c.client_email === selectedClientEmail` to `c.client_email === selectedClientEmail && c.revoked_at === null`. Revocation is signaled exclusively by `coach_clients.revoked_at IS NOT NULL` (the `invitation_status` enum CHECK constraint does NOT include a "revoked" value — only 'sent'/'opened'/'partially_completed'/'completed'); timestamp column is the only signal. Standing reminder for any future feature that needs to distinguish active vs revoked invitations: ALWAYS filter `revoked_at IS NULL` at the data layer; relying on `invitation_status` will silently include revoked rows. (10) **Edge Function versions at Session 73 close:** `create-comp-coupon` v2 (NEW this session, ACTIVE, verify_jwt:false), `create-checkout` v55 (Pattern C edit, ACTIVE, verify_jwt:true), `stripe-webhook` v26 (Pattern C edit, ACTIVE, verify_jwt:false). Other Edge Function versions unchanged from Session 72 close. Standing patterns from prior sessions all hold: §61 (block parity), §63 (brand-only colors), §64 (backend-ahead-of-frontend), §69 (plain-text choice cards), §70 (knowledge_check vs quiz boundary), §71 (nested asset-ref walker), §72 (B-2 rebind strategy), §73 (brand-color enforcement on author fields), §74 (named-constant extraction), §75 (batch-recon-batch-design-lock-serial-Lovable), §76 (client_id-based refField for nested arrays), §77 (AI Refine sends user instruction in author_prompt + existing config in lesson_context), §78 (MAX_OUTPUT_TOKENS audit when adding structured-JSON block types), §79 (Resources three-tab data-driven gating), §80 (resource_id asset-pipeline extension + Edge-Function-source-not-in-repo sync gap), §81 (full DDL audit before extending established tables), §82 (TO {role} discipline on every RLS policy), §83 (per-instrument visibility model), §84 (per-tier asset classification), §85 (unified Tile primitive contract), §86 (brand variable extension protocol). The `lesson-blocks-content-schema.md` doc remains unwritten (carried forward from Session 70).*



*v75 - Session 72 CLOSE — Group C completion arc opened. §84 added (per-tier asset classification — public-tier thumbnails go in `lesson-thumbnails` bucket, private-tier content body files stay in `lesson-assets`). §85 added (the unified Tile primitive contract — single visual component, 5 variants, all 21 design decisions baked in). §86 added (the brand variable extension protocol — when locked palette grows, add `--bw-*` token to `src/index.css` `:root` alongside existing tokens, never hardcode hex inline). Five backend migrations shipped. Group X (tile primitive + Resources page shell) SHIPPED via Lovable; routing sweep prompt drafted. Pattern C "super admin acts as coach" scoped to standalone session. (1) §84 added: per-tier asset classification. The platform's storage model now distinguishes two tiers by classification, enforced in code via `request_asset_upload` bucket routing: **Public tier** = thumbnails (cert path, curriculum, module, content_item, resource), classified as public-tier promotional/UI imagery per industry standard (Coursera/Udemy/Notion all serve thumbnails via public CDN). Bucket = `lesson-thumbnails` (public=true, 10MB ceiling, image MIME types only). RLS = public SELECT for anyone including anon; super_admin INSERT/UPDATE/DELETE; service_role ALL. Frontend reads via `supabase.storage.from('lesson-thumbnails').getPublicUrl(path)` — no auth, no signing. **Private tier** = content body files (videos, PDFs, lesson_block assets, written submissions, file uploads). Bucket = `lesson-assets`. RLS = super_admin only for direct access; trainees/coaches access via signed URLs from SECURITY DEFINER RPCs (`get_lesson_block_assets`). When the same signed-URL pattern is extended to trainee/coach access to content body files (Phase 5.5 viewers), expiry should be per-asset-kind — 12h fine for thumbnails (already in this tier — they're public anyway), 1-2h for videos/PDFs to limit leak window. Boundary enforcement: `request_asset_upload` RPC reads `p_ref_field` — when `='thumbnail'`, `v_bucket = 'lesson-thumbnails'`; else `v_bucket = 'lesson-assets'`. The bucket value persists into `content_asset_versions.bucket` and is returned in the response. The Edge Function `request-asset-upload` is a thin wrapper around the RPC and required NO redeploy. SOC 2 classification (CC6.1/CC6.3/CC7.2 — public-tier thumbnails are non-sensitive promotional imagery, defensible with documented classification policy when SOC 2 written policies session lands). Future caveat: if introducing private/internal cert paths whose EXISTENCE is sensitive (not just their content), the public-thumbnail pattern would leak existence — switch back to signed URLs at that point. Not relevant for any current/launch cert path. (2) §85 added: the unified Tile primitive contract. ONE React component (`src/components/tile/Tile.tsx`) renders all 5 tile variants via a `variant` prop: `resource | cert_path | curriculum | module | content_item`. Locked behavioral contract: (a) 16:9 image area via `aspect-video` Tailwind class, parent grid controls outer sizing, tile owns only its internal proportions; (b) image fallback via `<img onError>` that hides broken image so the placeholder block underneath shows (also covers 403s from legacy private-bucket thumbnails Cole hasn't re-uploaded yet); (c) top-left overlay for instrument badges (cert_path variant only); (d) bottom-right overlay for status pill (learning-tree variants) OR content_type pill (resource variant) — never both; (e) status pill rules: in_progress → `var(--bw-amber)` + CircleDot + "In progress"; completed (non-cert_path) → `var(--bw-forest)` + CircleCheck + "Completed"; completed + cert_path → `var(--bw-plum)` + Award + "Certified"; (f) hover overlay = gradient backdrop with CTA label ("Open" / "Start" / "Resume" / "Review" derived from variant + status), suppressed in `detailPageMode`; (g) name 1-line `line-clamp-1`, summary 2-line `line-clamp-2`; (h) bottom metadata row variant-dependent: resources have no metadata row; cert_path/curriculum/module/content_item show Required (filled `var(--bw-orange)`) or Optional (outlined gray) chip + variant-specific extras (prerequisite, estimated_minutes, item_type label); (i) optional inline CTA button in `detailPageMode` only, with `e.stopPropagation()` on click to prevent tile-body click bubbling; (j) current-location accent via `border-l-[3px] border-l-[var(--bw-orange)]` triggered by `isCurrentLocation` alone (not gated by detailPageMode); (k) keyboard accessibility — when interactive, `role="button"` + `tabIndex={0}` + Enter/Space handler with `e.preventDefault()`; non-interactive renders as plain div. The same component serves both standalone tiles (My Learning carousels, All Available catalog, All Resources grid) and detail-page child tiles (cert path → curricula grid, curriculum → modules grid, module → content_items grid). Drift between tile usages across Groups Y/Z/V/W is prevented by this single source of truth. Any extension (new variant, new overlay) should ADD to this component, never fork. (3) §86 added: brand variable extension protocol. The codebase already has named CSS custom properties for brand colors in `src/index.css` `:root` block: `--bw-navy #021F36`, `--bw-orange #F5741A`, `--bw-cream #F9F7F1`, `--bw-teal #006D77`, `--bw-amber #FFB703`, `--bw-slate #6D6875`, `--bw-plum #3C096C`, `--bw-forest #2D6A4F`, `--bw-white #FFFFFF`, plus tinted scales `--bw-navy-{900,800,700,600,500}`, `--bw-orange-{700,600,500,400,300,100}`, `--bw-cream-{100,200,300,400}`, `--bw-slate-{700,500,400,300,200,100}`. **Session 72 added `--bw-mustard: #7a5800;`** alongside other `--bw-*` tokens (NAI instrument badge color). Standing rule: when the locked brand palette grows (a new color is added), the canonical action is to add the named token to `src/index.css` `:root` adjacent to existing `--bw-*` tokens, then reference it everywhere via `var(--bw-NAME)` — never hardcode the hex inline. Inline `style={{ backgroundColor: 'var(--bw-amber)' }}` is the accepted pattern when the brand color doesn't have a shadcn semantic token equivalent. Tailwind arbitrary syntax `bg-[var(--bw-orange)]` and `border-l-[var(--bw-orange)]` also accepted. Exception: `#FFFFFF` (white text on colored backgrounds) is hardcoded because there's no `--bw-white-on-badge` semantic intent token and the meaning is unambiguous. The pre-existing pattern in the codebase was already using `var(--bw-*)` for the body background gradient and shadow tokens — Session 72 extends the discipline to per-component inline colors. Audit pattern: any new component referencing brand colors should grep for `#` in the file at PR time — the only hex value remaining should be `#FFFFFF`. (4) Migration count: 5 this session (`phase72_a` through `phase72_e`). Detail: `phase72_a_module_completions_rls_to_role` (§82 fix on 3 module_completions policies); `phase72_b_get_user_learning_state_thumbnails_and_module_status` (RPC extension surfacing thumbnails and module_completion on all tiers); `phase72_c_lesson_thumbnails_public_bucket` (new public bucket + 5 §82-clean policies); `phase72_d_request_asset_upload_route_thumbnails_to_public_bucket` (RPC bucket routing); `phase72_e_resource_access_log` (analytics table + RPC for tracking resource opens). Edge Function versions unchanged from Session 71 close. (5) Group X Lovable prompt SHIPPED — 776 lines drafted, transport-stripped JSX issue surfaced twice (markdown→Lovable transport eating angle brackets on `Tile.tsx`'s fenced code block specifically), Lovable accepted reconstruction-from-spec on third cycle with explicit audit list of preserved behavioral details. Preserved correctly (verified): onMouseEnter/Leave wiring, conditional onClick/role/tabIndex/keyboard handler, `<img onError>` placeholder fallback, `e.stopPropagation()` on inline CTA, `aspect-video` wrapper, `line-clamp-1`/`line-clamp-2` truncation, hover overlay suppression in detailPageMode, resource variant metadata-row suppression, cn() conditional classes, all `var(--bw-*)` token references. One drift caught and fixed before ship: current-location border condition was initially reconstructed as `detailPageMode && isCurrentLocation`, corrected to `isCurrentLocation` alone. Cole verified visual rendering against design lock via dev preview page `/_dev/tile-preview` showing all 5 variants. The dev preview route was kept in place as a visual regression-test surface for Groups Y/Z/V/W. (6) Group X routing sweep prompt DRAFTED (not yet shipped). Surgical edits to make Resources reachable for all user types: remove `SubscriptionGate` from `/resources` route in App.tsx (free users currently get redirected to `/settings/plan`); replace `AdminResources.tsx` body with `<Resources />` (corporate org_admin and company_admin currently see "Coming soon" placeholder); add Resources entry to super admin sidebar nav. The locked-tile pattern (showing free users locked resources with upgrade nudge instead of redirecting to billing) is Group Y scope. Path at `/home/claude/internal-docs/lovable-prompts/prompt-group-x-routing-sweep.md`. (7) Pattern C super-admin-as-coach scope drafted (one-off session). Scope doc at `/home/claude/internal-docs/scope-docs/super-admin-as-coach-pattern-c.md` defines what it takes for super admin to be functionally a coach (own client list, can order assessments, see client results) — schema changes, RLS policy updates, frontend route allowances, audit boundary. Cole confirmed Pattern C (super admin IS a coach themselves) over Pattern B (impersonate existing coach). Estimated 1 focused session of careful work. Pattern B's impersonation infrastructure stays unrelated. (8) §82 RLS-TO-role discipline reinforced. 5 new policies this session, all clean. Single subtle observation: `lesson_thumbnails_public_select` has `polroles: {-}` (PostgreSQL `regrole[]` rendering of the default `public` role), which LOOKS identical to the §82 anti-pattern (`roles: {public}` defaulted-in). Distinction: this is INTENTIONAL public-select on a public bucket — the policy's predicate `bucket_id = 'lesson-thumbnails'` documents the intent in code, and the bucket is explicitly `public=true`. The §82 audit pattern (`SELECT ... WHERE qual='true'`) correctly does NOT flag this — the policy's qual is bucket-scoped, not blanket `true`. When future audits find policies with `roles: {public}`, check the qual: blanket `true` is the anti-pattern; bucket-scoped on a deliberately-public bucket is intended behavior. (9) `lesson-blocks-content-schema.md` doc STILL UNWRITTEN (carried forward from Session 70). Becomes a prerequisite for Group W's lesson_blocks viewer. (10) Standing patterns reinforced: §61 (block parity discipline — no changes to Edge Functions this session, but pattern stands); §64 (backend-ahead-of-frontend is the safer transient state — backend migrations shipped + verified before drafting the Lovable prompt); §82 (TO {role} on every policy — 5 new policies all clean); diagnose-before-prescribe (third Lovable cycle was wasted not because of a wrong fix but because of a transport-layer issue between the prompt body and Lovable's parser — accepting Lovable's reconstruction-from-spec with an audit list was the right call to break the ping-pong); product-decision-explicit (when Cole asked about free users seeing Resources, walked through three options with explicit trade-offs before recommending Option (a2) — visible-but-locked — over the silent redirect-to-billing default).*

*v74 - Session 71 CLOSE — Security audit. §82 added (the `TO service_role` / `TO authenticated` discipline — every RLS policy MUST declare its target role explicitly, defaulting `roles` to `{public}` is the most common live anon-exposure root cause on this codebase); §83 added (per-instrument visibility model — how PTP / NAI / AIRSA / HSS confidentiality boundaries map to RLS policies on the assessment-family tables, including the supervisor-AIRSA new policy added Session 71). One migration shipped fixed seven findings across `public.*` tables, the `org_users_public` view, seven SECURITY INVOKER functions, the `ai-authoring-temp` storage bucket, and the assessment-results permission-gated path; one new policy added for supervisor AIRSA metadata reads. Final advisor lint count: 304 (zero ERROR, all WARN). (1) §82 added: TO {role} discipline on every RLS policy. Standing rule: every `CREATE POLICY` MUST declare its target role explicitly via `TO service_role` / `TO authenticated` / `TO anon`. Omitting the role defaults `roles` to `{public}`, which means Postgres OR's the policy with EVERY role's policy — including anon's. Combined with `USING (true)` or `WITH CHECK (true)` (common in service-role full-access policies), this produces a live anon read on the table. The Session 71 audit found this anti-pattern on 27 `public.*` tables, 4 published-content tables, and 1 storage policy — every one was a service_role policy with `roles: {public}` defaulted in. The Supabase advisor surfaces this as `rls_public_role_overpermissive` (the WARN tier — not ERROR). Live exposure includes table-level row counts even when scores are gated elsewhere (e.g. anon could read `assessment_acknowledgments` rows revealing assessment completion timestamps even though `assessment_results` was correctly gated). Standard fix shape: `DROP POLICY "..." ON public.table; CREATE POLICY "..." ON public.table FOR ALL TO service_role USING (true) WITH CHECK (true);` Confirmation pattern after the fix: `SET LOCAL role anon; SELECT count(*) FROM table` — expect zero rows or permission denied. Detection pattern: `SELECT tablename, policyname, roles FROM pg_policies WHERE schemaname='public' AND 'public'=ANY(roles) AND qual='true';` Storage advisor blind spot: `pg_policies` against `storage.objects` is the only way to detect this on Storage policies — the Supabase security advisor does NOT surface storage policy roles. Lovable's security scanner DOES surface them. Standing addition to the closeout discipline: any new RLS policy in this codebase MUST be reviewed for explicit `TO role` declaration before merge. (2) §83 added: per-instrument visibility model and its RLS enforcement. The product visibility model: PTP (INST-001) is shareable via the user's PrivacySettings toggles (peer/supervisor/team/whole-org/company-admin); AIRSA (INST-003) is dual-rater and is always visible to the rated employee's supervisor + org/company admins; NAI (INST-002) and HSS (INST-004) are individual-only, aggregate-only at the org dashboard level. Enforcement layer mapping at Session 71 close: (a) PTP peer + admin visibility on `assessment_results` flows through `peer_ptp_visible(owner_user_id, viewer_user_id)` SECURITY DEFINER STABLE, called from the `assessment_results: PTP peer sharing via toggles` policy. The function reads `sharing_preferences.share_ptp_with_company_admin/supervisor/team/organization/direct_reports` and matches the viewer's account_type + supervisor chain accordingly. The `permissions` table org-gated path (`assessment_results: permission-gated org access`) is parallel infrastructure that is currently dormant — no code writes `viewer_organization_id` today, so the policy never fires in production. Session 71 hardened this policy with `instrument_id = 'INST-001'` as defense-in-depth in case future code does start writing org-scoped permissions. (b) AIRSA scores visibility on `assessment_results` flows through `airsa_role_access(p_assessment_result_id, p_viewer_user_id)` for supervisor and org admin paths. Session 71 added a NEW policy `assessments: supervisors read direct reports AIRSA` for the parent metadata table — uses `get_my_direct_reports()` SECURITY DEFINER (NOT an inline subquery against `users`, which fails for non-admin supervisors because their `users` RLS only gives them their own row). The policy is scoped to `instrument_id = 'INST-003' AND user_id IN (SELECT out_user_id FROM public.get_my_direct_reports())`. (c) Corporate-admin paths on `assessments` and `assessment_acknowledgments` remain instrument-blind by Cole's product decision (Q1=B at Session 71). Admins see row-level completion metadata across all instruments for their org members; the privacy line is at scores in `assessment_results`, not at completion metadata in the parent tables. (d) Coach paths on all four assessment-family tables remain instrument-blind by Cole's product decision (Q3=A at Session 71). Coach-client instrument matchups are gated upstream by `CERT_TYPE_TO_INSTRUMENTS` in `src/pages/coach/CoachClients.tsx`; the RLS doesn't enforce certification-to-instrument matching because the UI does. Defense-in-depth via a `current_user_coach_certs()` helper is technically possible but adds RLS surface area without proportional security gain — deferred indefinitely. Standing pattern for new instrument-keyed RLS: ask the four Q1-Q4 product questions before adding any per-instrument scoping; refer to `security-audit-finding-6-product-questions.md` for the question shapes and Session 71 answers. (3) Verification pattern locked Session 71 for any RLS scoping change: synthesize the target caller's JWT via `SET LOCAL request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'` then run the suspect query — both positive (expected rows visible) and negative (instruments/users that should be invisible). The supervisor-AIRSA Change 2 was verified this way: simulated demo-csuite-1's JWT in Test Corp, saw 9 INST-003 rows for 2 direct reports, zero INST-001/002/004 rows. (4) Lovable diagnostic-only rounds locked Session 71 as standard pattern when shipping RLS changes that depend on understanding the frontend's read patterns. Round 1 narrow diagnosis confirmed the anon-exposure finding. Round 2 broadened to surface the visibility-model gap (Lovable correctly noted scores leak through coach + permission-gated paths, not just metadata as Claude initially framed). Round 3 caught a real bug in Claude's first Change 2 attempt (inline subquery against `users` fails for non-admin supervisors). Round 3.5 confirmed the corrected migration. Pattern: write the migration plan, send it to Lovable with full context and explicit "diagnose only do not write code", let Lovable verify or push back, iterate until both agree, ship. Each round on average caught one real issue Claude missed. (5) Note on the supervisor JWT simulation: when running `SET LOCAL request.jwt.claims = '{"sub":"..."}'` to test RLS, NOTE that the synthesized JWT does not actually invoke `auth.getClaims` — Postgres reads the claim directly from the GUC. Anon checks via `SET LOCAL role anon` work standalone. For RPCs that read `auth.uid()`, the GUC simulation works. For RPCs that read other JWT claims (e.g. `app_metadata`), the synthesized JWT may need more fields. (6) §41 (D-series, "Your assessment responses" per-item facet insights) carried unchanged from v73. §1–§40 unchanged. (7) §44 (defense-in-depth on dormant code paths) implicit standing pattern reinforced this session: when fixing a security issue on a dormant code path (zero rows touch the affected RLS qual today), the migration comment MUST explicitly state the dormancy so future readers don't assume the path was producing rows. Applied Session 71 to the `assessment_results: permission-gated org access` change — comment block says "currently zero permissions rows have `viewer_organization_id` set ... change ensures that if any future code path ever does start writing `viewer_organization_id`, only PTP results can flow through it." (8) NO new Edge Functions deployed this session. NO new RPCs. One new policy (`assessments: supervisors read direct reports AIRSA`). One policy DROP+CREATE (`assessment_results: permission-gated org access`). Seven function `ALTER FUNCTION ... SET search_path` calls. One view `ALTER VIEW ... SET (security_invoker=true)`. Two storage policy DROP+CREATEs (one for `ai_authoring_temp_service_role_all`, plus the pattern would re-apply to any other storage anti-pattern — none found in the sweep).*

*v73 - One-off D-series + coach-client bug fixes (between Sessions 71-72). §41 added: generate-all-facets Edge Function (v3, dual-auth x-internal-secret + JWT ownership, self-chaining); generate-facet-interpretations v41 x-internal-secret bypass; assessment_results.facet_insights_all_total new column; PTPNarrativeSections.tsx effect rewritten to fire-and-forget + poll + combined tab merge; MyResults.tsx coach filter + debriefPendingIds both fixed to include paired_assessment_id from coach_clients; retry button 403 in coach impersonation view logged as known issue.*

*v72 - Session 70 CLOSE — §79 added (Resources-tab three-tab data-driven gating architecture + the resource_access_grants additive model); §80 added (the resource_id asset-pipeline extension — content_asset_refs 6-way parent, the request-asset-upload v4 deploy, and the Edge-Function-source-not-in-repo sync gap); §81 added (extending a pre-existing table requires a full audit of defaults + CHECK constraints + RLS policies — the four-bug recurring lesson). Group C Phase 5 backend + Phase 9 backend + the Resource Authoring UI all shipped this session; 19 migrations, request-asset-upload Edge Function v4. (1) §79 added: Resources-tab three-tab data-driven gating architecture. The Resources tab is THREE tabs, not five categories, and the tab list is data-driven so more tabs can be added without a migration. `resource_tabs` is a lookup table (slug, name, display_order, is_coach_only, is_learning_tree) seeded with three launch rows: my_learning (is_learning_tree=true), all_resources, coach_resources (is_coach_only=true). Design decision: my_learning IS a row in this table with is_learning_tree=true — this keeps the tab list fully data-driven and reorderable; the frontend renders the trainee learning tree there (via get_user_learning_state / get_cert_path_detail) instead of resource tiles, and get_user_resources returns null content for it. Resource visibility is an additive, multi-dimensional gating layer, NOT a `resources.audiences` array match (the legacy `audiences` + `content_type` columns are left dormant — relaxed from NOT-NULL to nullable in `phase9_b2` so they don't block new-model inserts). `resource_access_grants` is a polymorphic junction table — one row is one grant, grants are OR'd. grant_type CHECK enumerates organization / account_type / plan_tier / corporate_level / coach_certification / all_coaches; a shape-consistency CHECK enforces each grant_type populates exactly its needed fields. A resource visible to "this org AND all premium individuals AND PTP-certified coaches" is one resource with three grant rows. `get_user_resources(p_user_id)` is the SECURITY DEFINER gating evaluator — it returns the full tab list plus, for resource-backed tabs, the published non-archived resources the user matches via additive OR; super admin sees all published resources; the coach_resources tab only surfaces to coaches + super admin; plan_tier grant_value maps 'free'→subscription inactive, 'base'/'premium'→active AND tier matches. RLS on `resource_access_grants` is service_role + super_admin only — trainees and coaches never read it directly, get_user_resources evaluates on their behalf. RLS on `resources` (added in `phase9_b3`): super-admin ALL policy; regular users do NOT get direct-table SELECT — they read exclusively through get_user_resources. Authoring is three SECURITY DEFINER RPCs — `upsert_resource` (rejects placing a resource in a learning-tree tab), `archive_resource` (soft-delete + unpublish), `set_resource_access_grants` (replace-all the grants for a resource; a bad grant spec rolls back the whole RPC atomically via the table CHECK constraints) — all assert_super_admin + content_authoring impersonation gate + reason>=10 + log_super_admin_action. Standing pattern: a data-driven tab/category model that includes a "computed/special" surface (like the learning tree) as a flagged row in the same lookup table — rather than hardcoding the special surface separately — keeps the whole list reorderable and extensible, at the cost of the read RPC branching on the flag. (2) §80 added: the resource_id asset-pipeline extension + the Edge-Function-source-not-in-repo sync gap. `content_asset_refs` previously supported 5 parent types (content_item, lesson_block, module, curriculum, certification_path) via an `exactly_one_parent` CHECK. Adding `resources` as a thumbnail-bearing entity required a 6th: `content_asset_refs.resource_id` column + FK + the CHECK widened 5-way→6-way + partial indexes (`phase9_f1`). `create_asset_ref` and `request_asset_upload` were each extended with a `p_resource_id` param and a `resource` parent mode; in BOTH cases the prior overload had to be explicitly dropped (the §59 CREATE-OR-REPLACE-adds-an-overload trap — `request_asset_upload` went 14-arg→15-arg, old overload dropped). Path convention for the new mode: `resource/<resource_id>/<asset_id>.<ext>`, consistent with the module/curriculum/certification_path prefixes from §40. The `request-asset-upload` Edge Function was deployed **v4** (verify_jwt:true) — a two-line change: `resource_id` added to the request interface, passed as `p_resource_id` to the RPC. **Sync gap (standing):** the asset Edge Functions (`request-asset-upload` and siblings) and `_shared/impersonation_gate.ts` exist in the deployed Supabase runtime but are NOT committed to the GitHub repo — the repo's `_shared/` directory contains only `errors.ts` and `secrets.ts`. Deploying v4 required Cole to supply the full deploy bundle (entrypoint + every relative import) via the Supabase Dashboard's function Download button, because this session's Supabase MCP had no `get_edge_function` tool and Claude cannot read the deployed Edge Function runtime. Standing rule: any future Edge Function patch that touches `_shared/impersonation_gate.ts` or any uncommitted shared module needs the Dashboard Download-button bundle — ask Cole for it up front. Tooling-capability boundary (clarified Session 70): Claude can read/write Postgres functions via `pg_get_functiondef` + `execute_sql` (they live in the DB), can write Edge Functions via `deploy_edge_function`, but cannot read the deployed Edge Function runtime. (3) §81 added: extending a pre-existing table requires a full audit of its defaults, CHECK constraints, AND RLS policies — ADD COLUMN is never the whole job. Extending the pre-existing `resources` table (as opposed to building `module_completions` greenfield) caused FOUR separate bugs in Session 70, every one from the same root — a column was added or a value supplied without auditing what the established table already enforced: (a) `phase9_b2` — the legacy `audiences` / `content_type` columns were NOT NULL with no default, blocking every new-model insert; (b) `phase9_e2b` — `upsert_resource`'s create path passed an explicit `p_id = null` into the INSERT, overriding the column's `gen_random_uuid()` default (a column default fires only when the column is OMITTED, never when NULL is explicitly supplied — fixed with `COALESCE(p_id, gen_random_uuid())`); (c) `phase9_b3` — `resources` RLS carried only the legacy "audience overlap" SELECT policy gating on the dormant `audiences` array, so new-model rows (audiences=null) were invisible even to the super admin who created them; (d) the `content_type` CHECK guess — the Resource Authoring UI prompt originally guessed `pdf/link/reference_library` for CONTENT_TYPE_OPTIONS, which would have failed `resources_content_type_check` (the real values are `article/video/guide/worksheet/template`; `reference_library` is a `category` value, not a content_type) — caught pre-build only because the CHECK was inspected. Greenfield tables built this session (`module_completions`, `resource_tabs`, `resource_access_grants`) had none of these failures — the hazard is specific to extending tables that already carry constraints and policies. Standing rule: before extending any established table, audit its full DDL — `\d+ <table>`, plus `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='<table>'::regclass` for CHECK constraints, plus `SELECT * FROM pg_policies WHERE tablename='<table>'` for RLS. This is the table-extension analogue of the §59 overload-drop discipline and the Session 66 "query pg_constraint directly, information_schema is insufficient for CHECKs" note. (4) Phase 5 backend shipped — 5 migration groups. Group 1 (`phase5_g1a/b/c`): `module_completions` table + the 4-tier rollup trigger chain `_rollup_content_item_to_module` → `_rollup_module_to_curriculum` → `_rollup_curriculum_to_cert_path`, which flips `coach_certifications.status='certified'` (certified_by=NULL, system-granted) and fires module_completed / curriculum_completed / certification_granted notifications on the transition moments. Every trigger function is idempotent (checks TG_OP + transitioned-INTO-completed + parent-not-already-completed). The g1c patch handles a required non-archived module with zero required content items as vacuously complete — correct defensive logic, though the Group 1 test actually passed because Test Modules A/B are `archived` (every rollup tier filters `archived_at IS NULL`) not because the vacuous-complete path was exercised. Group 2 (`phase5_g2a/b`): the four missing content-item completion writers — `record_video_progress` (watch_pct uses GREATEST so it never regresses; completes at video_completion_threshold_pct), `confirm_external_link`, `submit_file_upload` (auto-completes on upload, validates against file_upload_max_bytes), `mark_live_event_attendance` (mentor/super-admin ONLY, not trainee-callable, same auth block as mark_skills_practice_signoff's mentor path) — plus the `live_event_attendance_marked` action_type whitelist row (the FK-to-super_admin_action_types gotcha). All four UPSERT `content_item_completions` so they feed the Group 1 rollup automatically. Group 3 (`phase5_g3`): four lesson RPCs — `upsert_lesson_progress`, `upsert_lesson_block_progress`, `start_lesson_reattempt` (full-lesson re-attempts ARE supported; prior lesson_block_progress rows retained, keyed by attempt_number), `complete_lesson` (trusts the viewer's per-lesson_completion_mode completion judgment rather than re-deriving server-side — consistent with confirm_external_link / record_video_progress). No audit logging on Group 3 RPCs — progress is high-volume and already captured in the progress tables, not a super-admin action. DOC CORRECTION logged: `lesson_completion_mode` lives on `content_items`, NOT on `content_item_completions` as phase-5-lesson-progress-carry-forward.md §5.2 stated. Group 4 (`phase5_g4`): `get_cert_path_detail(p_certification_path_id, p_user_id)` — the cert-path-rooted read RPC companion to the curriculum-rooted get_user_learning_state, for Phase 5.2; returns the cert path row + the user's coach_certifications row (linked by certification_type) + the certification_path_curricula in display_order each with the user's assignment status; auth is self / mentor-of / super_admin. Group 5: an operational fixture-setup PERSISTED to production (not a migration, not rolled back) — published the test tree (PTP VILT 1 + Test Module C), attached PTP VILT 1 to testcoach2's existing in-progress ptp_coach cert via assign_curriculum_directly (re-enrolling would have hit the already-enrolled guard), walked real completions through the Group 2 writers, verified the full rollup chain landed on persisted data. testcoach2 is now `certified` — Phase 5 frontend not-started/in-progress testing needs a different fixture (testclientbwe+branding, a clean individual account, is available). (5) Phase 9 backend shipped — 7 migrations, see §79. (6) Resource Authoring UI (G8) built via Lovable — 6 files verified in `cbastianBWE/brainwise-blueprint` main, tested end-to-end. NEW `src/pages/super-admin/resource-editors/_resourceShared.tsx` + `ResourceEditor.tsx` (~26.6KB, on the Phase 4 ModuleEditor pattern, with a grants sub-section carrying its own reason field + save button because grants are a distinct audited action — set_resource_access_grants is separate from upsert_resource) + `AdminResourceAuthoring.tsx` (flat list grouped by tab, single Promise.all useQuery); EDIT `App.tsx` (route /super-admin/resources), `AppSidebar.tsx` (nav entry), `FileUploadField.tsx` (resourceId prop threaded through interface + signature + both defaultReason chains + both invoke bodies + both useCallback dep arrays + a `handleLibraryPick` `else if (resourceId)` branch). Three bug-fix migrations were found during end-to-end UI testing — `phase9_e2b` (null-id default override, §81), `phase9_b3` (resources RLS gap, §81), `phase9_f4` (two fixes to request_asset_upload's parented-upload block: Fix 1 all 6 parent modes — archive any existing active ref for the same (parent, ref_field) before inserting a new one, fixes orphaned-ref accumulation on repeated uploads; Fix 2 / Option C, 5 of 6 modes excluding lesson_block which has no thumbnail_asset_id column — when ref_field='thumbnail' also set the parent row's thumbnail_asset_id, fixes the uploaded thumbnail not being linked to the parent row until editor Save; no Edge Function redeploy needed, all of F4's logic is in the RPC). (7) STANDING BUILD-QUEUE GAP: `phase9_f4`'s archive-prior-ref + link-thumbnail logic was applied only to the UPLOAD path (`request_asset_upload`). The LIBRARY-PICK path through `create_asset_ref` did not get the parallel fix. Any entity that supports both fresh-upload and library-pick for the same logical ref needs the F4 logic on both paths — currently only the upload path has it. (8) Edge Function versions at Session 70 close: **request-asset-upload v4** (resource parent mode); AI authoring functions all unchanged from Session 69 close (draft-lesson-block v15, expand-lesson-from-outline v13, scaffold-lesson v6, scaffold-lesson-outline v11). (9) Tool/MCP notes carried forward + reinforced: this session's Supabase MCP had only apply_migration / deploy_edge_function / execute_sql / list_tables — NO get_edge_function (cannot read deployed Edge Function runtime); apply_migration does not confirm DB state, always follow with execute_sql verification; multi-statement execute_sql returns only the last statement's result, split verification queries; CREATE OR REPLACE on a function with an added parameter creates an overload, drop the prior signature explicitly; GitHub MCP is READ-ONLY (Cole uploads internal-docs markdown manually via the web UI; frontend code is delivered as Lovable prompts). (10) NO movement this session on: AIRSA Phases 3e-8 (a separate Group C track), SOC 2 written policies, Action-Oriented Voice Redesign across six surfaces, pricing-reads refactor, corporate contract renewal schema change, Clarity Engine, the three [POST-LAUNCH] items from the v71 entry. Session 71 opens with the remaining Phase 5 + Phase 9 frontend sequence: the unified visual primitive design-lock, then the Phase 9 Resources tab frontend, then the Phase 5 structural navigator + content-item players (the lesson_blocks player needs an interactive-widget recon done first — that recon is unstarted). Completing that frontend sequence closes the trainee-facing and resources-facing FRONTEND for Phases 5 and 9 — it does NOT close all of Group C: AIRSA Phases 3e-8, the interactive-widget recon, and the create_asset_ref library-pick gap all remain.*

*v71 - Session 69 CLOSE — §77 added (AI Refine sends user instruction in author_prompt and existing block config in lesson_context, never concatenated); §78 added (audit MAX_OUTPUT_TOKENS when adding new block types that emit structured JSON across many sub-items); Edge Function progression draft-lesson-block v12→v15 and expand-lesson-from-outline v11→v13 with three matched hot-fix pairs; all four interactive block types (flashcards, card_sort, scenario, knowledge_check) now SHIPPED with §61 Concern A closed for the entire v1 catalog. (1) §77 added: AI Refine request shape — user instruction in author_prompt, existing config in lesson_context. Standing pattern for any AI Refine flow that needs to give the AI both the user's natural-language instruction AND the existing block configuration as context: the two go in SEPARATE request fields, never concatenated. `author_prompt` carries ONLY the user's textarea text (e.g. "make this scenario have 10 moments instead of 5"). `lesson_context` carries the JSON-stringified existing block config or surrounding lesson content (e.g. `JSON.stringify(block.config)`). The Edge Function's DraftRequest interface exposes both fields; the system prompt formatter wraps `lesson_context` as "Surrounding lesson context (for cohesion, do not repeat verbatim)." Antipattern (shipped pre-Session-69, fixed Session 69 by Lovable prompt across two files): `author_prompt = JSON.stringify(block.config) + " --- Change request: " + textarea.trim()`. Failure mode of the antipattern: the AI receives its own existing config as if it were the user's instruction; the user's actual textarea text is buried after a 5-10KB JSON blob; the AI treats the config as the primary signal and produces sparse output (especially for interactive blocks where it focuses on the type-discriminator fields and emits empty markdown fields). Diagnosis lever for this failure: query `super_admin_audit_log.after_value->>'author_prompt_excerpt'` for the failing call — if the excerpt starts with `{` or shows JSON structure, the antipattern is active. The two call sites that needed fixing in Session 69 were `src/components/super-admin/lesson-blocks/BlockEditorPane.tsx handleRefine` and `src/components/super-admin/lesson-blocks/ai-pane/IterationModal.tsx` full_block branch — both used identical `JSON.stringify + " --- Change request: "` concatenation. Pattern applies forward to any new AI Refine surface (mentor comm AI, report template AI, in-lesson AI explainer — none built yet but all expected per Session 62 §62). Standing rule: when implementing an AI Refine that needs context, use the dedicated context field; never concatenate context into the instruction field. (2) §78 added: Audit MAX_OUTPUT_TOKENS when adding new block types with structured JSON output across many sub-items. Standing rule: any new block_type whose canvas config emits structured JSON across many sub-items (e.g. scenario with 1-12 moments × 2-4 choices, knowledge_check with 1-5 questions × per-question fields, flashcards with 2-20 cards × front+back+optional fields) must trigger a review of the relevant AI Edge Function's MAX_OUTPUT_TOKENS constant for sufficient headroom BEFORE shipping. Token math: each sub-item carries roughly 200-400 tokens of structural JSON + content per moment/question/card; a 10-moment scenario or 5-question knowledge_check easily exceeds 3,000 output tokens; the pre-Session-69 cap of 3,000 in draft-lesson-block was sized for single-instruction refines on simple blocks (text, heading, etc.) and was never re-tuned when interactive blocks shipped Sessions 65-66. Symptom of an undersized cap: Anthropic returns max_tokens-truncated JSON; JSON.parse throws on the truncated tail; Edge Function returns 502 ai_output_unparseable. Recovery: raise cap to a value with comfortable headroom (8,000 for the current 18-block catalog; revisit if catalog or per-item complexity grows further). Anthropic charges per actual output token used, not the cap, so raising the cap has zero cost on normal-sized calls — it only enables high-density calls to succeed. The cap can safely sit at 8,000 for all interactive blocks at Standard length; Detailed length on a 10-moment scenario approaches the 8,000 boundary and may need 16,000 if it ever bumps the cap (Anthropic Opus 4.7 supports up to 128k output tokens, so headroom is generous). Applied Session 69 via draft-lesson-block v12→v13 raising the cap from 3,000 to 8,000. (3) §61 Concern A FULLY CLOSED for v1 block catalog. Frontend whitelist (blockTypeMeta.ts IN_SCOPE_BLOCK_TYPES) now contains all 18 block types: text, heading, divider, image, video_embed, quote, list, callout, embed_audio, stat_callout, statement_a_b, accordion, tabs, button_stack, flashcards, card_sort, scenario, knowledge_check. Edge Function ALLOWED_BLOCK_TYPES (across all four AI authoring functions) matches. lesson_block_types registry matches. BlockRenderer.tsx has render cases for all 18. block-forms/ directory contains 18 form components. lesson-blocks.css has section headers and class groups for all 18. The Concern A discipline (Session 62 §61) — keep the AI proposing-side, Edge Function generating-side, DB registry-side, and frontend rendering/authoring side all in sync — is now satisfied for the entire v1 catalog. Any v2 block additions will need to follow the same 5-touchpoint discipline. (4) Edge Function hot-fix progression Session 69 — draft-lesson-block v12→v13→v14→v15 + matched parity v11→v12→v13 on expand-lesson-from-outline. **v12→v13:** MAX_OUTPUT_TOKENS raised 3000→8000 (per §78 above). **v13→v14 + v11→v12 parity:** Added explicit "EVERY markdown-typed field MUST be populated with non-empty Markdown STRING" directive to system prompt Critical rules section. Root cause: AI was returning structurally-valid output for interactive blocks with type-discriminator fields populated but the rich-text markdown fields (prompt_markdown, explanation_markdown, setup_markdown, outcome_markdown) emitted as missing or non-string, causing transformConfigForCanvas to fall through to empty TipTap docs via mdToTipTap("") — empty `{"type":"doc","content":[{"type":"paragraph"}]}`. **v14→v15 + v12→v13 parity:** Tightened directive to INLINE markdown ONLY (bold, italic, links). Root cause: v14 told AI to populate markdown fields with "real content" — AI interpreted broadly and started emitting `## headings` inside prompt_markdown for ranking and timeline question types. Since mdToTipTap parses only inline marks + paragraphs + hard breaks, heading syntax rendered as literal '##' text in trainee view. New v15 directive explicitly enumerates forbidden block-level markdown (no #/##/###, no -/* bullets, no 1./2./3. numbered, no > blockquotes, no ``` code fences, no --- horizontal rules) and explains the failure mode in-prompt with the example "If you emit '## My Heading' inside one of these fields, the literal characters '## My Heading' will appear in the trainee view." All three deploy pairs preserved verify_jwt:false (Class A custom-auth pattern); §61 block parity preserved across both functions in each deploy. Standing pattern reinforced: when tightening AI system prompts, the directive must be specific about the failure mode (not just "do X" but "if you don't do X, here is exactly what breaks") — the AI is much more reliable when it understands the consequence of non-compliance. (5) Standing patterns reinforced this session: §61 block parity discipline (always update draft-lesson-block AND expand-lesson-from-outline in matching surgical-edit pairs — three deploy pairs this session); §75 batch-recon-batch-design-lock-serial-Lovable (recon once for interactive blocks at Session 68, design-lock once, ship serially with verify cycles between each — Session 69 shipped 5 Lovable prompts serially across card_sort + scenario + 3× knowledge_check sub-prompts); §74 named-constant extraction (MAX_OUTPUT_TOKENS was a magic number 3000 at top of draft-lesson-block but had been there since v8 — named constant extraction reinforced before raising it); approve→verify→fix-what-breaks (per Lovable Credit Conservation Protocol from standing prompt — don't burn cycles on speculative pre-emption; AI Refine bugs surfaced during real use, not from anticipating them; each bug got its own diagnostic-then-fix cycle, not a kitchen-sink prompt). (6) Tool/MCP notes carried forward + reinforced: Supabase:get_logs for edge-function service is broken (use audit log + pg_net synthetic requests instead); list_edge_functions is stale within a conversation after deploy_edge_function (use get_edge_function for fresh state); deploy_edge_function requires verify_jwt:false passed explicitly every deploy for Class A custom-auth functions (does NOT inherit from prior version); apply_migration does not confirm DB state (always follow with execute_sql verification); GitHub MCP is READ-ONLY (returns 403 on create_or_update_file and push_files — Cole uploads markdown manually via web UI at session close, this is by design not a bug). New tool finding Session 69: Lovable input cap is effectively ~48,000 characters; one prompt this session (scenario, 1401 lines) exceeded the cap and required a `-plain` version with markdown formatting stripped (48,749 chars after formatting strip), which fit and shipped successfully. Standing tip: if a prompt approaches 50k chars, strip non-functional formatting (bold/italic emphasis, decorative headers, redundant whitespace) before resorting to splitting into multiple prompts. (7) Frontend AI Refine `lesson_context` fix shipped via Lovable in two files (BlockEditorPane.tsx handleRefine, IterationModal.tsx full_block branch) — see §77 above. Lovable Credit Conservation Protocol applied: diagnostic prompt first (no code changes — Lovable reported back the exact concatenation pattern in both files), then fix prompt second once the diagnosis was confirmed. The two-step pattern (diagnose → confirm → fix) avoided a kitchen-sink rebuild and used minimal credits. Standing rule for any future cross-file bug across the codebase: diagnose first, confirm the diagnosis with the actual file contents, then prescribe the fix in a separate prompt. (8) Build queue items added this session ([POST-LAUNCH], not blocking launch): Flashcards renderer state reset on AI Refine — after Refine, canvas preview shows all cards in reviewed/locked state until Save → reload restores correct rendering; suspected fix is mirror the pattern in scenario and card_sort renderers (useEffect resetting per-card state when joined client_id list changes); ~5 LOC fix in BlockRenderer.tsx FlashcardsRender. Refine textarea voice dictation — no mic icon on either BlockEditorPane Refine textarea or IterationModal Refine textarea; Web Speech API would cover it. Lovable preview-in-new-tab spins forever — Lovable platform issue, not application code; in-editor iframe preview works fine; new-tab hangs on spinner. (9) Final Edge Function versions at Session 69 close: **draft-lesson-block v15** (INLINE-only markdown directive), **expand-lesson-from-outline v13** (INLINE-only markdown directive parity), scaffold-lesson v6 (unchanged from Session 67 silent bump), scaffold-lesson-outline v11 (unchanged from Session 66). (10) Session 70 opens with Group C Phase 5 (trainee learning UI) as the destination. Two paths to evaluate at session open: Path A — trainee-side schema recon first (~20 min Supabase-only investigation: trainee_progress / module_completion / cert_path_grants table existence + state + write paths, interactive block completion data persistence, /certifications route current behavior, cert path grant mechanism end-to-end) then design-lock Phase 5 into sub-phases (5.1 My Learning landing, 5.2 cert path detail, 5.3 curriculum detail, 5.4 module detail, 5.5 per-item viewers, 5.6 cert grant) and ship serially per §75. Path B — start with Phase 5.1 read-only landing immediately; pivot to backend if data isn't there. Recommend Path A. Phase 5 acceptance criterion: "trainee can complete a full cert path from invitation to certification grant via the UI alone." After Phase 5: Phase 6 mentor review UI, Phase 7 actor flow, Phase 8 Order Assessment gating, Phase 9 Resources tab redesign, Phase 10 polish.*

*v70 - Session 68 PARTIAL CLOSE — §75 added (batch-recon-batch-design-lock-serial-Lovable pattern); §76 added (FileUploadField refField uses client_id for nested-array items, NOT array index). No code shipped this session — pure recon + design-lock prep work. Flashcards (Prompt 6d) was confirmed working end-to-end before session open. (1) §75 added: Batch-recon-batch-design-lock-serial-Lovable pattern. Standing pattern for any time the platform adds multiple block types (or other multi-feature batches) that share frontend touchpoints. The work decomposes into three phases with different scaling characteristics: (a) **Recon** — read the canonical files once for the whole batch. Files like blockTypeMeta.ts, BlockRenderer.tsx, BlockEditorPane.tsx, lesson-blocks.css get touched by every block type, so reading them per-block-type is N× redundant work. Read once at the start, save synthesis to a session-portable markdown doc that loads at the start of every subsequent session in the arc. Cheap. (b) **Design-lock** — resolve open design questions for the whole batch. Some decisions on block type A inform decisions on block types B and C (e.g., per-item color: do we add it to card_sort buckets because flashcards has it per-card? answer needs to come from the design space as a whole, not in isolation). Some decisions are independent. Walking through all of them once produces a coherent set; resolving them per-session produces drift. Cheap-to-moderate. (c) **Lovable prompt write + ship + verify** — this is the actual cost driver. One Lovable prompt per block type, serialized. Each ship needs its own verify cycle (smoke-test acceptance criteria, fix surfaced bugs, possibly iterate once). Trying to bundle two block types into one Lovable prompt invites a rebuild loop that costs more credits than two clean serial prompts (Lovable Credit Conservation Protocol from standing prompt). Locked Session 68 after exploring "ship all three frontends this session" and pushing back on grounds of realistic verify-cycle math. Session 69 onward opens with the recon doc loaded and goes straight to one block type's Lovable prompt write. Pattern applies forward to: future block-type batches (none currently planned post-knowledge_check, but the v2 catalog could surface more), any multi-screen feature where the screens share components (e.g., the future mentor review UI + trainee learning UI, which will share renderers and progress widgets), any multi-RPC migration where the RPCs share helpers (e.g., the asset-cascade helpers in Session 58 §43). The pattern is also a corrective against scope-creep within a single session: "do recon for all three" can drift into "do design-lock for all three" can drift into "ship all three" if the discipline isn't applied. The check: at session open, name the artifact that will exist at session close (e.g., "card_sort shipped, verified, audit-log row exists"), and reject any scope that prevents reaching that artifact. (2) §76 added: FileUploadField refField pattern for nested-array items. Standing rule for any block type whose config has arrays of items where individual items can reference assets: the refField passed to FileUploadField MUST use the item's `client_id` literal, NOT the array index. Pattern: `refField={\`<block_type>.<array_name>.${item.client_id}.<field>\`}`. Example from flashcards (Session 67 ship): `flashcards.cards.${card.client_id}.front_image_asset_id`. Forward applications: `card_sort.cards.${card.client_id}.image_asset_id`, `scenario.moments.${moment.client_id}.setup_image_asset_id`. Rationale: array-index-based refField breaks on reorder. Author drags card 0 below card 1, the post-reorder array has card 1 at index 0 — but the content_asset_refs row was created with `ref_field='card_sort.cards.0.image_asset_id'` pointing at what is NOW card 1's asset. Subsequent saves either lose the reference, reassign it incorrectly, or trigger an asset cascade-archive of the still-needed asset. client_id-based refField is reorder-stable. The backend walker pattern §71 already handles dotted/indexed-path ref_fields, so this is purely a frontend convention — but it's a frontend convention that must hold for the backend cascade logic to work correctly. Discovered Session 67 during flashcards form ship (FlashcardsBlockForm uses client_id-based refField verbatim); now formalized as a rule for the three remaining interactive block types and any future asset-bearing-array block type. NOTE — apparent conflict with backend §71's walker emit pattern: the walker emits `ref_field='<block_type>.<array>[<idx>].<field>'` (indexed) when walking the saved JSONB config because the WALKER reads positional indices from the saved data. The FRONTEND writes refs via FileUploadField BEFORE the block is saved (at upload-time), so the FE has the client_id available but no stable index yet. The B-2 rebind logic (§72) reconciles the two: ref created at upload-time with client_id-based ref_field is rebound on save by matching `(asset_id, content_item_id, lesson_block_id IS NULL)` IGNORING ref_field, then UPDATEs ref_field to whatever the walker emits on the saved block. So FE writes client_id-based, backend rewrites to index-based on save — both shapes are valid, the walker normalizes. The standing rule is: FE writes client_id-based at upload-time; backend rewrites on save via walker + B-2 rebind. (3) Pattern reinforced: Backend-status spot-check before agreeing to "do X for all three at once" requests. Cole proposed "do backend for all three at once" Session 68; the answer was "it's already done" because Session 66 had shipped the four-types-at-once backend pass (lesson_block_types registry + walker + Edge Function ALLOWED_BLOCK_TYPES + BLOCK_SCHEMAS + transformConfigForCanvas). Verified via Supabase MCP execute_sql against lesson_block_types AND list_edge_functions before drafting the recon plan. Standing protocol: before agreeing to multi-block (or multi-feature) backend work, query the current state and confirm the work isn't already shipped. The build-queue.md vXX entries are authoritative for "what's done"; reading them at session open prevents redundant work. (4) Standing code-style patterns unchanged from Session 66 + Session 67. Block parity §61 unchanged. §63 brand-only color enforcement unchanged. §64 backend-ahead-of-frontend ordering unchanged. §71 walker pattern unchanged. §72 B-2 rebind unchanged. §73 brand-color enforcement on per-block author-controlled fields unchanged. §74 named-constant-extraction discipline unchanged. (5) Test fixture status carried unchanged from Session 67 close: stale draft row on test fixture (1 row in lesson_block_drafts with 20 blocks including 1 flashcards block, content_item_id=32e0e966-4cb8-4e8b-abf8-5617de346f59, author_id=super admin — Cole's discretion to clean up or resume). Final Edge Function versions at Session 68 close: unchanged from Session 67. (6) Session 68 close-out artifacts: this v70 entry; build-queue.md v74 entry; session-68-to-69.md handoff; interactive-blocks-frontend-recon.md (524 lines, 24KB) NEW FILE persisted to internal-docs/ for Sessions 69+ to load at open.*

*v69 - Session 67 CLOSE — Flashcards FRONT-image flip + per-card background_color field added to canvas schema (§71 walker pattern extended); §73 added for brand-color enforcement on per-block author-controlled fields; §74 added for the named-constant-extraction discipline on validation thresholds; AUTHOR_PROMPT_MAX_CHARS hot-fix from 4000 to 50000. (1) §71 walker pattern (designed Session 65, implemented Session 66) extended Session 67 — flashcards nested asset_id path is now `flashcards.cards[N].front_image_asset_id` (was `back_image_asset_id` pre-v9). Locked design C1 moved the optional image from BACK to FRONT of each flashcard. Walker still emits one (path, asset_id) pair per card with a non-null `front_image_asset_id`. B-2 rebind logic (§72) unchanged — matches by `(asset_id, content_item_id, lesson_block_id IS NULL)` ignoring ref_field, then UPDATEs lesson_block_id AND ref_field together on rebind. Pattern extends cleanly: any future field rename within an existing block_type's nested array preserves walker behavior because the walker reads field names from a per-block-type lookup. (2) Canvas flashcards config schema gains `background_color` per-card field. Schema shape per card is now `{ client_id: <string>, front: <TipTap doc>, back: <TipTap doc>, front_image_asset_id: <uuid|null>, front_caption: <string|null>, background_color: <hex|null> }`. `background_color` is one of the 8 locked brand hex values or `null`. Validation lives in both `draft-lesson-block` v11+ and `expand-lesson-from-outline` v11+ via a module-level `BRAND_COLORS = new Set<string>([...])` constant; `transformConfigForCanvas` coerces any other string to `null` via `typeof c.background_color === "string" && BRAND_COLORS.has(c.background_color) ? c.background_color : null`. AI emits `null` always per system prompt rule — author picks post-generation. Renderer auto-pairs text color via locked lookup table (null+Sand→Navy text #021F36, Navy/Orange/Teal/Mustard/Slate/Purple/Forest→White text #FFFFFF). Block parity §61 preserved between the two Edge Functions — both deployed in matching surgical-edit pairs same session. (3) §73 added: Brand-color enforcement on per-block author-controlled fields. Standing rule for any future block_type that exposes a color field to the author (background, accent, badge, divider color, etc.): the field MUST validate against a module-level `BRAND_COLORS` Set at the Edge Function `transformConfigForCanvas` boundary AND the frontend renderer must consume only from the same locked palette. Out-of-palette values are silently coerced to `null` at the backend boundary (NOT rejected with a 400 — coercion preserves the rest of the block, rejection would lose the whole config). Frontend pickers use the existing `BrandColorSwatch` component (palette="full" for the 8 saturated hexes or palette="tints" for the 8 pastel hexes per Session 60 §53). Pattern preserves §63 brand-only color enforcement: the AI can't drift to off-palette colors because it's instructed to emit null; the author can't pick off-palette colors because the picker is constrained; legacy data is safe because validation accepts null. Applied Session 67 to flashcards per-card background_color; applies forward to any new author color field. The locked 8-color palette (Navy #021F36, Orange #F5741A, Sand #F9F7F1, Teal #006D77, Mustard #7a5800, Slate #6D6875, Purple #3C096C, Forest #2D6A4F) stays the single source of truth. (4) §74 added: Named-constant extraction discipline on validation thresholds. Standing pattern: any numeric threshold inside a request validation gate MUST be extracted to a named module-level constant before the cap is raised or lowered. The pattern: `const AUTHOR_PROMPT_MAX_CHARS = 50000;` declared near the top of the file alongside other module constants (CORS_HEADERS, ANTHROPIC_MODEL, MAX_OUTPUT_TOKENS), then referenced from the gate: `if (body.author_prompt.length > AUTHOR_PROMPT_MAX_CHARS) return jsonError(400, "author_prompt_too_long");`. Benefits: (a) greppable — any future review can find the cap by name not by magic number; (b) intent self-documenting — the constant name carries semantics that `> 4000` does not; (c) one-line tuning — future cap changes touch one line not multiple; (d) testable — synthetic requests can probe the boundary by reading the exported constant rather than guessing. Applied Session 67 hot-fix when raising the draft-lesson-block author_prompt cap from 4000 to 50000. Discipline applies forward to: payload size caps, retry limits, timeout values, batch sizes, anywhere a magic number gates request-handling logic. Inline magic numbers are tolerable only for trivial low-stakes thresholds (e.g. `slice(0, 200)` for audit log excerpt truncation, where the value has no semantic name and never needs tuning). (5) Pre-existing fragility surfaced + post-launch fix queued: `draft-lesson-block`'s `author_prompt` cap (originally 4000, now 50000) is sized for single-instruction Refine prompts. The frontend's later switch to context-aware Refine — which serializes the existing block config as JSON and stuffs it into `author_prompt` — was never reconciled with this cap. The `DraftRequest` schema already exposes a separate `lesson_context` field for exactly this purpose; the FE should be using it. Until that refactor lands, the 50000-char cap is the right buffer. Logged as a post-launch Build Queue item: refactor Refine to move existing config from prompt→lesson_context. (6) Pattern reinforced: in-place UPDATE for `ai_authoring_context` rows. The table has a `version` column but the established convention is in-place edits (no historical row preservation, no `updated_at` column either). Session 67 UPDATEd the `platform_overview` row in place to fix Issue A (AI grounding). AI Edge Functions read the active row at runtime — content edits do NOT require Edge Function redeploys. Pattern applies to any future ai_authoring_context content edits: UPDATE the active row directly. (7) Source-of-truth for instrument names locked: `public.instruments` table is canonical. NOT userMemories, NOT any markdown doc. When updating AI grounding content or anywhere else that references instruments by full name, query `public.instruments` directly and use the values verbatim. Session 67 confirmed the four rows: INST-001/PTP/Personal Threat Profile, INST-002/NAI/Neuroscience Adoption Index, INST-003/AIRSA/AI Readiness Skills Assessment, INST-004/HSS/Habit Stabilization Scorecard. Userland-facing AI content should use the full names, not the INST-00X codes. (8) Tool/MCP notes added Session 67: (a) `Supabase:get_logs` for `edge-function` service is broken — analytics endpoint returns `INVALID_ARGUMENT: User specified reservation projects/supabase-analytics-ext-queries/locations/EU/reservations/queries-short-12hr is not found`; use `pg_net` synthetic HTTP requests + audit log inspection instead; pattern is two-statement: first `SELECT net.http_post(url, headers, body) AS request_id` (returns a pg_net request id), then in a separate execute_sql `SELECT pg_sleep(2); SELECT status_code, content::text FROM net._http_response WHERE id = <id>;` (pg_net is async, response not immediate); (b) `super_admin_audit_log` after-state column is `after_value` NOT `after_json` (correction to a name I tried first); full column list: id, super_admin_user_id, action_type, company_id, affected_user_id, session_id, detail, created_at, ip_address, user_agent, reason, before_value, after_value, mode, expires_at, ended_at, end_reason; (c) `list_edge_functions` returns are stale within a single conversation — after a `deploy_edge_function` call, subsequent `list_edge_functions` may still show the old version; use `get_edge_function` against the specific slug for fresh state. (9) Diagnosis discipline reinforced Session 67: the right first question on a "function broke" report is "what does the response body actually say" — not "what did I change last." When a deploy is suspected as the cause, audit-log timestamps disprove or confirm the framing within one query: if the last successful call predates the deploy, the deploy is not the cause. The deploy-as-cause framing is a common false signal because deploys are recent and salient; the actual cause is often a pre-existing fragility that exposure increased without a code change. (10) Standing code-style patterns from Session 66 unchanged. Block parity §61 unchanged. §63 brand-only color enforcement unchanged. §64 backend-ahead-of-frontend ordering unchanged. §71 walker pattern unchanged in shape, extended in field-rename application. §72 B-2 rebind unchanged. Edge Function deploy discipline unchanged (verify_jwt:false explicit every deploy, _shared/ modules byte-identical across functions, header changelog with session ref). Final Edge Function versions at Session 67 close: draft-lesson-block v12, expand-lesson-from-outline v11, scaffold-lesson-outline v11 (unchanged), scaffold-lesson v5 (unchanged).*

*v68 - Session 66 CLOSE — Backend SHIPPED for the four new v1 interactive block types (flashcards, card_sort, scenario, knowledge_check). §71 walker pattern (designed Session 65) now IMPLEMENTED end-to-end with three regression scenarios passed. §72 added: B-2 rebind strategy locked. Standing code-style patterns committed to for cross-session consistency. (1) §71 implementation: `public._walk_block_config_for_asset_refs(p_block_type text, p_config jsonb) RETURNS TABLE(out_ref_field text, out_asset_id uuid)` deployed, IMMUTABLE, `SECURITY DEFINER`, `SET search_path TO 'public', 'pg_temp'`. Behavior verified against 11 isolated synthetic configs: legacy single-asset (image/video_embed/embed_audio emit one pair with `ref_field='<block_type>_asset'` preserving prior naming so existing rows still match on rebind), nested arrays (flashcards.cards[N].back_image_asset_id, card_sort.cards[N].image_asset_id, scenario.moments[N].setup_image_asset_id emit N≥0 pairs with `ref_field='<block_type>.<array>[<idx>].<field>'` — readable dotted/indexed path), and zero-rows-for-no-asset-blocks (knowledge_check/text/heading/etc — unified call site, no rejection). `replace_lesson_blocks` reworked to use the walker in both validation loop (verifies every asset_id top-level or nested points to active content_asset) and insert-and-rebind loop (calls walker per block, processes each (ref_field, asset_id) pair). `get_lesson_block_assets` reworked to use the walker via `CROSS JOIN LATERAL` in the saved_asset_ids CTE. `_cascade_archive_asset_refs_for_lesson_blocks` unchanged — operates on lesson_block_id not ref_field, handles multi-ref-per-block automatically (verified Session 65 recon, behavior confirmed in Session 66 regression). Session 60 ordering preserved: rebind/insert BEFORE cascade helper, so still-referenced assets don't get auto-archived during the rebind window — confirmed via Test B-Phase-2 where an asset survived a save that simultaneously archived its old image-block ref and created a new flashcards-block ref. (2) §72 added: B-2 rebind strategy locked. When a lesson block's asset reference moves to a different ref_field within the same content_item (e.g. an image block is replaced with a flashcards block that uses the same asset on a nested card), the rebind logic matches by `(asset_id, content_item_id, lesson_block_id IS NULL, archived_at IS NULL)` IGNORING ref_field, then UPDATEs both `lesson_block_id` AND `ref_field` together. B-2 was chosen over B-1 (match by ref_field literal) on cleaner-data grounds: B-1 would leave content_item-scoped refs as orphans when array indices shift on reorder (e.g. swapping `flashcards.cards[0]` and `flashcards.cards[1]` would create two new refs and orphan the original two); B-2 finds the asset by id regardless of path and rewrites the path on rebind. The rebind WHERE clause requires `lesson_block_id IS NULL` because this matches the upload-pathway state — refs created by `request_asset_upload` with content_item_id set but lesson_block_id NULL — not refs already bound to a previous lesson_block. Refs from outgoing blocks are handled by the cascade helper, which archives the old ref AFTER the new ref is created. Outcome: asset survives a same-asset reshuffle without ever transiently dropping to zero active refs. Locked decision Session 66 after considering the B-1 alternative and rejecting it on the reorder-orphan grounds. Pattern extends to any future block type whose config exposes asset_ids — walker emits the (path, id) pair, B-2 rebind matches by id alone, ref_field path updates atomically with lesson_block_id. (3) Regression results that locked B-2: Test A (no-op resave of 19-block fixture, zero assets) returned archived 19 inserted 19 zero refs touched — confirms the 14 non-asset block types unaffected; Test B-Phase-1 (add image block referencing synthetic asset to 19-block fixture) returned archived 19 inserted 20 1 ref created (`ref_field='image_asset'`, lesson_block-scoped, asset stayed active) — confirms legacy single-asset path still works via walker; Test B-Phase-2 (replace image block with flashcards block sharing same asset on card 0) returned archived 20 inserted 20 1 ref created at `ref_field='flashcards.cards[0].back_image_asset_id'` 0 rebound cascade archived 1 prior image-block-scoped ref 0 assets archived — asset survived because new ref created BEFORE cascade ran; cleanup save (remove flashcards block) → cascade auto-archived the synthetic asset once zero active refs remained, confirming the auto-archive logic still works correctly. Fixture restored to original 19 blocks, synthetic asset archived, zero junk left in production data. (4) lesson_block_types registry now at 18 rows (was 17). card_sort INSERTed (category='interactive', is_interactive=true, is_scored=false, is_v1_active=true). flashcards/scenario/knowledge_check descriptions UPDATEd to match Session 65 locked design — prior descriptions were severely stale (flashcards missing self-rating model, scenario described as "single-decision branching" instead of LINEAR 1-12 moments, knowledge_check missing 5 of 7 question types). Description text now authoritative source for what each block IS at the registry level. (5) Four AI Edge Functions deployed: scaffold-lesson-outline v9→v11 (silent Lovable bump to v10 then deploy to v11; ALLOWED_BLOCK_TYPES at 18 types; intent guide bullets added for each new type describing when AI should propose them at outline stage; no schema hints — outline shape only), scaffold-lesson v3→v5 (silent bump to v4 then deploy to v5; ALLOWED_BLOCK_TYPES extended — card_sort added, three others were already listed but with badly stale hints; full BLOCK_SCHEMA_HINTS rewrite for all 4 new types matching locked design — markdown-shape emit since this is the legacy one-shot scaffolder NOT canvas-final-TipTap; removed hard-recommended knowledge_check-at-end-of-every-lesson — now describes when each interactive type is appropriate), expand-lesson-from-outline v7→v9 (silent bump to v8 then deploy to v9; ALLOWED + BLOCK_SCHEMA_HINTS + transformConfigForCanvas all extended for 4 new types; schema hints document gating_required defaults — false for flashcards/card_sort/scenario, TRUE for knowledge_check; transformConfigForCanvas branches do md→TipTap on rich-text fields and client_id-assigned-if-missing on array items; card_sort.cards[N].correct_bucket_id validated against actual bucket client_ids and dropped to null if dangling; scenario per-moment prompt_type switch handles MC choices vs reflection prompt; knowledge_check 7-question-type switch handles per-type fields choices/blanks/pairs/items/events), draft-lesson-block v8→v9 (BLOCK_SCHEMAS extended; transformConfigForCanvas branches IDENTICAL to expand's — intentional consistency, a block drafted via draft-lesson-block and one expanded via expand-lesson-from-outline produce byte-equivalent canvas configs). All four anon-probed clean (HTTP 401 missing_bearer_token). _shared/ modules byte-identical across all four deploys (impersonation_gate.ts, markdown_to_tiptap.ts, length_guidance.ts). verify_jwt:false on all four per Class A custom-auth pattern (does NOT inherit from prior version — must be passed explicitly every deploy). (6) Per-AI-Edge-Function role boundary committed to (formalized in session-66-to-67.md, stays consistent going forward): ai-authoring-chat = block-type-agnostic conversational planning (no block-type enumeration in system prompt); scaffold-lesson-outline = outline shape only `{block_type, summary_one_line, learning_objective_fragment}` per item; scaffold-lesson = legacy markdown-shape one-shot emit (NOT canvas-final TipTap — different role from expand/draft despite block-types-overlap); expand-lesson-from-outline = canvas-final TipTap via transformConfigForCanvas, outline→full-blocks; draft-lesson-block = canvas-final TipTap, single-block. Boundary discovered Session 65 recon (scaffold-lesson is a distinct function from scaffold-lesson-outline, easy to confuse on name; the two emit different shapes). Per-function specialization stays clean as long as each adds its own block-type-handling code path in its own role — no cross-function sharing of BLOCK_SCHEMA_HINTS or transformConfigForCanvas, because role-distinct outputs require role-distinct logic. (7) Standing code-style patterns committed to in Session 66 for cross-session consistency. PL/pgSQL functions: `SECURITY DEFINER`, `LANGUAGE plpgsql`, `SET search_path TO 'public', 'pg_temp'`; top-of-function order is declare-all-vars-first then `v_caller_id := auth.uid()` then `IF v_caller_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'` then `PERFORM public.assert_super_admin()` then `PERFORM public.assert_impersonation_allows(<category>)`; argument validation uses `RAISE EXCEPTION '<snake_case_error_code>'` with matching ERRCODE; `v_` prefix on variables, `_underscore_prefix` for internal helpers (e.g. `_walk_block_config_for_asset_refs`, `_cascade_archive_asset_refs_for_lesson_blocks`), `out_` prefix on RETURNS TABLE columns to avoid OUT-parameter-shadows-column-reference trap; `RETURN jsonb_build_object(...)` for outputs; audit log entries via `PERFORM public.log_super_admin_action(...)` near the end. Edge Functions: header changelog comment with session ref; imports in fixed order jsr→npm@2.57.2→../_shared/; constants block before types; fixed serve handler order OPTIONS preflight→method check→auth header→token extraction→env reads→`userClient.auth.getClaims(token)`→service+caller client construction→super-admin check→impersonation gate→body parse→body validation→business logic→audit log via callerClient→response; `jsonError(status, code)` for codes, `jsonResponse(status, body)` for structured; outer try/catch with `console.error` stable label and 500 fallback. _shared/ modules byte-identical across functions that import them. Migrations: one logical change per migration, snake_case names reflecting the change, DDL via apply_migration with verification via execute_sql. JSONB schema invariants for interactive block configs: every interactive block has top-level `gating_required` boolean (Session 65 design); array items use `client_id` strings not indices; optional fields are `null` not absent; unknown enum values fall through to safe default (Session 65 pattern in button_stack — unknown action_type falls to "link"). (8) Tool/MCP notes carried forward (already-known patterns reinforced this session): multi-statement `execute_sql` returns only the last statement's result — for tests needing JWT claims set, the `set_config('request.jwt.claims', json_build_object('sub', '<uuid>', 'role', 'authenticated')::text, true)` call must live in the same `execute_sql` invocation as the RPC call (transaction-local); `information_schema.columns` is insufficient for CHECK constraints — query `pg_constraint` directly via `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = '<table>'::regclass`; `apply_migration` does not confirm DB state — always follow with `execute_sql` verification; `deploy_edge_function` requires `verify_jwt:false` passed explicitly every time for custom-auth functions; Lovable silent redeploys are real and can bump Edge Function versions between sessions without code changes (handoff predicted v10/v4/v8/v9, live ended at v11/v5/v9/v9 due to silent bumps on outline and scaffold before Session 66 deploys landed). (9) Phase 5 doc updates queued (deferred to Phase 5 work resumption — listed in session-66-to-67.md): phase-5-lesson-progress-carry-forward.md §1.2 needs card_sort added to the "who writes to lesson_block_progress" list and the completion_data shapes table updated to locked Session 65 shapes (flashcards `{cards_completed:[], cards_review_count:{}}`, card_sort `{final_score_pct:100, attempts_count:N, incorrect_cards_history:[]}`, scenario `{moments_submitted:{client_id:{type,choice_id or text}}}`, knowledge_check `{answered:{q_id:{type,selected/filled,attempts}}}`); §4 gating_required defaults table needs card_sort row with value false. Edits should happen BEFORE Phase 5 writer code is created. (10) Frontend recon preserved at /home/claude/recon/ for Session 67 — AccordionBlockForm.tsx + TabsBlockForm.tsx + ButtonStackBlockForm.tsx are the canonical templates for array-of-items block forms (identical @dnd-kit + SortableItem pattern, PointerSensor with activationConstraint distance:4, arrayMove on drag end, useSortable per item, crypto.randomUUID for new client_ids); AddBlockPopover.tsx iterates IN_SCOPE_BLOCK_TYPES so no changes needed once blockTypeMeta.ts is extended; lesson-blocks.css is greenfield for the four new types (no existing 3D-flip / drag-drop / modal-overlay styles). Session 67 opens with the choice between (Option A) Phase 3+ frontend kickoff starting with flashcards form Lovable prompt or (Option B) a different queued item. No backend blocks either choice.*

*v67 - Session 65 CLOSE — Continue button frontend shipped + five v1 interactive block types fully designed and locked + comprehensive backend recon for Prompt 6c batch + partial frontend recon + three new standing rules locked (§69 §70 §71). (1) Continue button frontend ship: §61 Concern A FULLY CLOSED for Continue button. Lovable applied changes verified end-to-end via 12 acceptance checks. Files modified: src/components/super-admin/lesson-blocks/BlockRenderer.tsx (610→619 lines, ChevronRight icon import added, ButtonStackRender action_type union extended to include "continue", new Continue render branch with wrapper `my-8 flex w-full flex-col items-center gap-4` + rule `h-0.5 w-full backgroundColor:"#F5741A" opacity:0.6` (tweaked mid-prompt from initial h-px/0.4 attempt for orange-line visibility) + larger button with ChevronRight; verified ButtonStackRender renders Continue button at correct width, alignment, and rule-color visibility per all 5 visual checks). src/components/super-admin/lesson-blocks/block-forms/ButtonStackBlockForm.tsx (ActionType union extended, ButtonEntry shape gained `section_title: string | null`, RadioGroup changed to grid-cols-3 with Continue option visible, conditional section_title Input with maxLength 80 + helper text appears only when action_type='continue', handleAdd seeds section_title:null per default, friendlyBlockLabel helper shows "Continue: <section_title>" or "Continue" if null, buttons normalization at line 232 fills section_title:null for legacy rows missing the field — handles backward-compat without migration). src/components/super-admin/lesson-blocks/blockTypeMeta.ts (defaultConfig for button_stack now seeds section_title:null, description text updated). The §64 backend-ahead-of-frontend state for Continue button action_type is now resolved. (2) Five v1 interactive block types fully designed and locked during Session 65 design conversation, NOT yet shipped — they are the next §61 Concern A batch (4 NEW block types: flashcards, card_sort, scenario, knowledge_check). Net: lesson_block_types lookup-table state from recon (verbatim quoted in session-65-to-66.md): three of four targets already registered with is_v1_active=true but STALE descriptions (flashcards "Flippable cards. Trainee clicks to flip from front to back." — missing self-rating + image fields; scenario "Single-decision branching narrative. Setup, options, outcome reveals on selection." — severely stale, locked design is LINEAR 1-12 moments not single-decision branching; knowledge_check "Inline multiple-choice or true/false question." — stale, locked has 7 question types and 1-5 questions per block). card_sort not registered. Session 66 migration UPDATEs three rows + INSERTs card_sort. (3) Locked design specs for all four block types captured in detail in session-65-to-66.md. Summary: flashcards (2-20 cards single-card carousel, TipTap front + TipTap+optional-image+caption back, CSS 3D flip ~400ms, "Got it"/"Review again" self-rating, default gating_required=false, completion_data `{cards_completed:[], cards_review_count:{}}`, nested asset_id at cards[N].back_image_asset_id); card_sort (4-12 cards × 2-4 buckets, each card has exactly one correct_bucket_id, "Check my answers" end-of-sort feedback with unlimited retries to 100%, plain-text bucket title 1-4 words + optional ≤120 char description, default gating_required=false, completion_data `{final_score_pct:100, attempts_count:N, incorrect_cards_history:[{attempt:1, card_ids:[...]}]}`, nested asset_id at cards[N].image_asset_id); scenario (LINEAR 1-12 moments not branching, optional block-level title ≤120 chars + intro_markdown TipTap, per-moment client_id+setup_markdown TipTap+prompt_type "multiple_choice"|"reflection"+optional setup_image_asset_id+optional moment_label, MC moments 2-4 choices with plain text choice_text ≤200 chars + TipTap per-choice outcome_markdown, reflection moments reflection_prompt plain text ≤300 chars + TipTap outcome_markdown + trainee response max 2000 chars stored in completion_data, **outcome reveal MODAL/OVERLAY** Cole's pick with Esc+Enter dismiss + focus-trap + backdrop blur, default gating_required=false, completion_data `{moments_submitted:{client_id1:{type:"mc",choice_id:"..."}, client_id2:{type:"reflection",text:"..."}}}`, nested asset_id at moments[N].setup_image_asset_id); knowledge_check (1-5 questions, 7 question types MC + multi-select + true/false + fill-in-the-blank + match + ranking + timeline, TipTap question prompts, **plain text choices ≤200 chars** per §69 below, MC 2-5 choices 1 correct, multi-select 2-6 choices 1+ correct, true/false fixed True/False, fill-in-the-blank prompt with `___` tokens + per-blank correct_value + optional acceptable_alternatives[] case-insensitive, match 2-6 pairs left+right plain text ≤120 chars drag-pair-validate, ranking 3-7 items plain text ≤150 chars author-specified-correct-order drag-to-reorder, timeline v1=ordered-placement-on-horizontal-axis 3-7 events with author-defined position labels (NOT date-precision, that's a future enhancement), immediate per-question feedback with single canonical TipTap explanation, unlimited retry per question, **default gating_required=TRUE** (only block type with default true), completion_data `{answered:{q_id:{type,selected/filled,attempts}}}`). (4) Nested asset reference architecture concern surfaced + Cole's v1 decision: replace_lesson_blocks PL/pgSQL function (200-line SECURITY DEFINER) and get_lesson_block_assets PL/pgSQL function both assume SINGLE asset_id field at top of every block's config with ref_field = `block_type || '_asset'` (verbatim verified — exact code section quoted in session-65-to-66.md Finding 4). Three of four new block types need NESTED image refs inside arrays: flashcards cards[N].back_image_asset_id, card_sort cards[N].image_asset_id, scenario moments[N].setup_image_asset_id. Cole explicitly opted into images-in-v1 (rejected the option to defer images for later). Session 66 backend work therefore includes rework of both SECURITY DEFINER functions. Verified safe via cascade helper inspection: _cascade_archive_asset_refs_for_lesson_blocks operates on lesson_block_id NOT ref_field (verbatim quoted in handoff doc), so it handles multi-ref-per-block automatically — no rework needed there. (5) AI Edge Function update list expanded from 3 to 4 during recon: scaffold-lesson-outline v8 (needs card_sort added to ALLOWED_BLOCK_TYPES + intent guide), scaffold-lesson v2 (DIFFERENT function from scaffold-lesson-outline — discovered second-pass — one-shot lesson scaffolder peer to the outline-step function, has VERBATIM stale BLOCK_SCHEMA_HINTS for flashcards/scenario/knowledge_check that need full rewrite + card_sort addition; verbatim current shape quoted in handoff Finding 8), expand-lesson-from-outline v6 (ALLOWED + BLOCK_SCHEMA_HINTS + transformConfigForCanvas for all 4 types), draft-lesson-block v7 (BLOCK_SCHEMAS + transformConfigForCanvas for all 4 types). Three other AI Edge Functions verified NOT requiring updates: ai-authoring-chat v2 (system prompt has no block-type enumeration — pulls platform context from ai_authoring_context table which also has no block-type enumeration; verified by reading both platform_overview and output_format_rules context rows in full this session; AI conversational planning surface is intentionally context-aware-not-block-aware), draft-text v5 (operates on top-level metadata text fields via FIELD_SPECS whitelist, no block awareness), ai-chat (generic non-authoring). (6) Partial frontend recon completed this session: block-forms directory inventoried — 14 form files exist (one per implemented block type), four new files needed for Session 66 (FlashcardsBlockForm.tsx, CardSortBlockForm.tsx, ScenarioBlockForm.tsx, KnowledgeCheckBlockForm.tsx — last is largest due to 7 question-type sub-forms inside). ImageBlockForm.tsx full source quoted verbatim in handoff Finding 12 — establishes template for image-bearing blocks via FileUploadField with `refField="image_asset"` hardcoded literal. FileUploadField.tsx full prop interface quoted verbatim in handoff Finding 13 — refField is a single string prop passed through to request-asset-upload Edge Function as ref_field, and also through to create_asset_ref RPC on library-pick flow; should accept indexed-path strings (e.g. `flashcards.cards[0].back_image_asset_id`) without code changes, but request-asset-upload Edge Function should be inspected Session 66 to verify how it handles the ref_field string when writing content_asset_refs row. Frontend recon items NOT YET done (queued for Session 66 opening minutes — all cheap reads): AccordionBlockForm.tsx (5KB array-of-items pattern), TabsBlockForm.tsx (7KB array-of-items pattern + tab-label mgmt), AddBlockPopover (block picker UI), blockTypeMeta.ts in full (central registry to update), request-asset-upload Edge Function (verify indexed-path handling), lesson-blocks.css (CSS-class inventory, plan for 3D-flip + drag-drop + modal-overlay additions), save_lesson_block_draft + discard_lesson_block_draft RPCs (JSONB-blind check), @dnd-kit import pattern in ButtonStackBlockForm. (7) Phase 5 trainee renderer carry-forward written this session: /home/claude/internal-docs/phase-5-lesson-progress-carry-forward.md (369 lines, separate scope from Session 66's block-type backend work, sits queued behind the block type batch until interactive blocks ship). Phase 5 work: 3 RPCs (upsert_lesson_progress, upsert_lesson_block_progress, start_lesson_reattempt), trainee renderer progressive reveal, TOC sidebar showing section_title per sub-section, summary collapse for completed sections, Model X gating evaluation. (8) THREE new standing rules locked Session 65 CLOSE. §69 added: Plain-text-choice-cards in all scannable-options blocks. Standing rule for all blocks where the trainee picks one or more options from a card-like grid: choice_text MUST be plain text with a max length cap, NOT TipTap rich text. Bold/italic in one choice biases attention against siblings, inline links inside choices create UX traps (does clicking the link count as picking the choice? what if the link is in only one of the three options?). Locked Session 65 design decision after revising mid-conversation. Applies to: scenario MC moment choices (≤200 chars), knowledge_check MC choices (≤200 chars), knowledge_check multi-select choices (≤200 chars), card_sort bucket titles (1-4 words plain text), match left+right items (≤120 chars), ranking items (≤150 chars), timeline event labels (TBD char limit). Rich content (TipTap with bold/italic/links/lists) is appropriate for: question prompts, outcome reveals, per-question explanations, scenario setup_markdown, flashcard front/back, block-level intros. Standing fix pattern if a future block type proposal puts rich text on choice cards: stop and explain the scannability concern before locking that design. §70 added: Knowledge_check vs Quiz semantic boundary. Standing distinction: knowledge_check is a block_type that lives INSIDE a lesson as a mid-lesson check-for-understanding (low stakes, learning-oriented, unlimited retry, completion = answered correctly eventually); quiz is a future content_item type that lives at the END of a lesson (or as a standalone item in a curriculum) as a high-stakes assessment (scoring thresholds, pass/fail, optional time limits, attempts caps). Cole's framing locked Session 65: "quizzes go at the end of a total lesson to capture final knowledge." Quiz feature is NOT a block, NOT in scope for Prompt 6c, but WILL reuse knowledge_check's 7 question types when built. Standing pattern: when designing a future quiz feature, the question-type implementations from knowledge_check are the canonical source — the quiz layer adds scoring + thresholds + pass/fail + time limits + attempts caps ON TOP of the same question-rendering primitives. Avoid building parallel question-type implementations. The two features may share form components for question authoring, with quiz adding the scoring fields above the question shape. §71 added: Nested-asset-ref walker pattern for block types with arrays containing image refs. Standing pattern for any block_type whose config contains arrays-of-objects where individual objects can reference assets: instead of extending the single-asset-id model on replace_lesson_blocks (which assumed top-of-config `asset_id` field + ref_field = `block_type || '_asset'`), implement a PL/pgSQL helper `_walk_block_config_for_asset_refs(p_block_type text, p_config jsonb) RETURNS TABLE(out_ref_field text, out_asset_id uuid)` that walks the JSONB and returns all (path, asset_id) pairs at any nesting depth. ref_field naming convention LOCKED: dotted/indexed path (e.g. `flashcards.cards[0].back_image_asset_id` literal — readable, parseable, matches the JSONB path structure). Both replace_lesson_blocks and get_lesson_block_assets refactor to use the walker; the single-asset-id code path can either be retained for backward compat OR unified — recommendation is UNIFY (the walker for an "image" block returns one pair, same logic applies, less drift). _cascade_archive_asset_refs_for_lesson_blocks does NOT need walker integration — it operates on lesson_block_id not ref_field, handles multi-ref-per-block automatically. This pattern handles current 3 array-asset cases (flashcards.cards, card_sort.cards, scenario.moments) and any future array-asset block design without further function rework. Session 66 work: implement walker as new function FIRST, test in isolation against synthetic configs per block_type, THEN rework replace_lesson_blocks with regression test against existing image-block save, THEN rework get_lesson_block_assets. (9) Edge Function deploy approach for Prompt 6c (Session 66): single focused backend session — 4 Edge Function deploys + 5 migrations (lesson_block_types update + walker + replace_lesson_blocks rework + get_lesson_block_assets rework + verification). Frontend portion follows Session 66+ via one Lovable prompt per block type, sequential per §64 backend-first discipline and Concern A 5-touchpoint parity (now expanded — for the four new block types each one needs ALLOWED_BLOCK_TYPES across 4 Edge Functions, BLOCK_SCHEMA_HINTS/BLOCK_SCHEMAS in 2 Edge Functions, transformConfigForCanvas in 2 Edge Functions, BlockRenderer switch case, blockTypeMeta entry, block-form file — Concern A's 5 touchpoints now span 4 Edge Functions instead of 3 because of the scaffold-lesson v2 discovery). Realistic estimate 4-6 sessions from Session 66 to all four block types fully shipped. Test fixture status carried unchanged from Session 64 close: 13 active blocks across 9 types on fixture 32e0e966-4cb8-4e8b-abf8-5617de346f59 (plus whatever Session 65 added via Continue button form during Lovable verification — small amount, no schema impact). (10) Session 65 close-out doc artifacts: build-queue.md → v71 entry; this v67 entry; session-65-to-66.md handoff at repo root (809 lines, complete verbatim spec for Session 66 open including all backend recon findings, all four block type spec tables, frontend recon partial state with 8 items queued, nested-asset-ref architectural concern + Cole's images-in-v1 decision, recommended Session 66 sequence in 4 phases). Phase 5 carry-forward also lives at /home/claude/internal-docs/phase-5-lesson-progress-carry-forward.md (369 lines). Three Lovable prompts written this session as ad-hoc artifacts also live at /home/claude/internal-docs/ (prompt-session-65-p0-url-normalization.md, prompt-session-65-p1-continue-frontend.md). NO movement this session on Group E/C/D/A/B deployment readiness, security warnings, action-oriented voice redesign, or SOC 2 policies — those carry forward unchanged.*

*v66 - Session 65 CLOSE — Lesson sub-section progress schema SHIPPED (Priority 1 backend). Two migrations applied + verified. Migration A: `content_item_completions` ALTER TABLE adding two nullable columns — `lesson_furthest_continue_client_id text` (the Continue-button client_id the trainee has clicked past most recently; NULL = trainee has not advanced past any Continue button OR lesson has none) and `lesson_last_block_id uuid REFERENCES lesson_blocks(id) ON DELETE SET NULL` (lesson_blocks row the trainee was last viewing for scroll-position resume). Both meaningful only when parent content_item.item_type='lesson'; NULL for all other item_types. Migration B: new `lesson_block_progress` table — per-block progress for INTERACTIVE block types only (flashcards, knowledge_check, scenario, and any future interactive type). Non-interactive blocks (text/heading/callout/accordion/tabs/button_stack/stat_callout/statement_a_b/list/quote/divider/image/video_embed/embed_audio) do NOT write here — their "completion" is implicit (rendered = seen). Schema: id uuid PK, completion_id uuid NOT NULL REFERENCES content_item_completions(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE, block_id uuid NOT NULL REFERENCES lesson_blocks(id) ON DELETE CASCADE, attempt_number int NOT NULL, status text NOT NULL DEFAULT 'not_started' CHECK status IN (not_started/in_progress/completed), completion_data jsonb NOT NULL DEFAULT '{}'::jsonb (block-type-specific payload — flashcards={cards_flipped[],marked_known[]}, knowledge_check={answer_index,is_correct,score_pct}, scenario={path_taken[],resolution_id}), started_at/completed_at/created_at/updated_at. Five indexes: PK + UNIQUE(completion_id, block_id, attempt_number) + idx_user_item_attempt(user_id, content_item_id, attempt_number) + idx_block(block_id) for cross-trainee block analytics + idx_completed partial index on (user_id, completed_at) WHERE completed_at IS NOT NULL. attempt_number is denormalized from content_item_completions.attempts_count at write time, mirroring quiz_attempts.attempt_number pattern — preserves history across re-attempts (prior rows retained, new rows written with incremented attempt_number). user_id and content_item_id denormalized from completion_id rather than join-derived for RLS performance + house pattern (every existing progress table policy filters on user_id=auth.uid() directly). Six RLS policies matching content_item_completions exactly: trainee SELECT own (user_id=auth.uid()), trainee INSERT own NOT impersonating (with_check user_id=auth.uid() AND NOT is_impersonating()), trainee UPDATE own NOT impersonating (using user_id=auth.uid(), with_check same as INSERT), mentor SELECT via coach_mentor_assignments active (cma.trainee_user_id=lesson_block_progress.user_id AND cma.mentor_user_id=auth.uid() AND cma.ended_at IS NULL), super_admin ALL NOT impersonating on writes, service_role ALL using true. No updated_at trigger (matches content_item_completions — maintained by application/RPC). No RPCs deployed — premature without callers; Phase 5 trainee renderer will define call signatures. Table sits empty until Phase 5 writers come online. CRITICAL schema discovery during Session 65 recon: there is NO `lessons` table. Lessons are `content_items` rows with item_type='lesson'. `content_item_completions` already exists with extensive completion infrastructure: status enum (not_started→in_progress→submitted_for_review→revision_requested→completed), started_at, completed_at, attempts_count, plus type-specific columns (video_watch_pct, video_last_position_seconds, quiz_best_score_pct, quiz_passed, written_review_status, skills_trainee_signed_off+at, skills_mentor_signed_off+at+by, skills_attachment_url, file_upload_url+filename+size_bytes, external_link_confirmed_at, live_event_attendance_status+marked_by, reviewer_user_id+comments). The existing pattern for type-specific completion fields is to add columns directly to content_item_completions; lesson sub-section progress follows that pattern via Migration A's two new columns rather than creating a parallel `lesson_progress` table. content_items.lesson_completion_mode column also exists at recon time but is unused — Phase 5 will define its values (likely something like 'reveal_all'/'gated_by_continue_buttons'/etc). §67 added: Schema-first recon for progress/completion features. Standing rule: before designing any new progress-tracking table or column, query `information_schema.tables WHERE table_schema='public' AND (table_name LIKE '%progress%' OR table_name LIKE '%completion%' OR table_name LIKE '%attempt%')` AND inspect the columns of `content_item_completions` AND any related per-type table. The platform's progress model is content_item-centric not lesson-centric (because lessons are one of ~8 content_item types alongside video/quiz/written/skills/file/external/event/etc). Any new "lesson-X-progress" idea is probably actually "content_item-X-progress" or "content_item_completions extension". Surfacing the existing infrastructure first prevents designing parallel tables that don't integrate with the platform's existing completion model. §68 added: Re-attempt history preservation for per-block progress. Standing pattern: tables capturing per-block trainee interaction within a content_item attempt MUST include attempt_number as a denormalized integer mirroring content_item_completions.attempts_count at write time, with UNIQUE constraint including attempt_number (e.g., UNIQUE(completion_id, block_id, attempt_number)). On re-attempt, application increments attempts_count on content_item_completions and writes new rows with the new attempt_number; prior rows retained for audit/analytics. Mirrors quiz_attempts.attempt_number pattern. Distinguishes from lesson_furthest_continue_client_id on content_item_completions which is the CURRENT rollup (one value per attempt, overwritten on progress) — the rollup is overwritten; the per-block detail is history-preserved. Locked design from Session 65 Priority 1 thread (continuing into frontend prompt): Continue buttons are sole sub-section delimiter (headings remain visual hierarchy, never gate); hybrid title resolution (optional section_title field on Continue button → fallback to first heading in preceding sub-section → fallback to "Section N"); Model X gating semantics (gating_mode enum on Continue button: 'none' or 'require_all_interactive_above', per-button author choice); Shape P storage (single lesson_block_progress table with JSONB completion_data, not per-block-type tables); per-interactive-block `gating_required` boolean flag defaulting to true for knowledge_check, false for flashcards/scenario (defaults pre-checked in form; folds into Prompt 6c rather than Continue button prompt because interactive blocks don't exist yet); trainee free back-and-forth navigation across revealed sub-sections (no schema impact, pure UI state). Edge Function deploys for §61 Concern A 3-of-5 touchpoints landed Session 65 alongside schema: scaffold-lesson-outline v5→v8 (Block type intent guide updated for button_stack to mention three action_types: link/jump_to_block/continue; scaffold emits no config so no schema-hint changes needed; v7 had stale 'v6' header comment from interrupted deploy, v8 corrects it cosmetically — no functional change v7→v8), expand-lesson-from-outline v5→v6 (BLOCK_SCHEMA_HINTS.button_stack extended: action_type enum now "link"|"jump_to_block"|"continue"; new optional section_title field documented as only meaningful when action_type:"continue"; transformConfigForCanvas button_stack converted from ternary to three-way switch with explicit branches for link/jump_to_block/continue, each emitting section_title field consistently (null for non-continue, trimmed-string-or-null for continue); Rules section adds new bullet on continue semantics — when AI should propose it, what fields to set, section_title heuristic for themed groupings 1-4 words), draft-lesson-block v6→v7 (BLOCK_SCHEMAS.button_stack.schema text extended same way as expand, .rules explains all three action_types and section_title semantics; same three-way transformConfigForCanvas switch). All _shared/ modules (impersonation_gate.ts + markdown_to_tiptap.ts + length_guidance.ts) byte-identical across all three deploys. All three anon-probed clean (HTTP 401 missing_bearer_token). verify_jwt:false preserved on all three per Class A custom-auth pattern. §64 backend-ahead-of-frontend state intentionally active until the Continue button Lovable prompt ships: AI could produce action_type:"continue" output via the AI panel that saves to lesson_blocks.config as valid JSON but the current ButtonStackRender has only two branches (jump_to_block + link/default) so a continue button would fall through the default and render as a broken link with empty href. Visible bug, easy to spot, recoverable by rolling back the prompt. Frontend Continue button Lovable prompt next: adds 'continue' to button_stack.action_type union with optional section_title input + render branch in BlockRenderer with auto-prefix "Continue →" fallback when label blank + subtle visual treatment (top-orange border + bw-button-continue class) marking it as a structural break.*

*v65 - Session 64 CLOSE — Prompt 6b complete for 5 new block types end-to-end (stat_callout, statement_a_b, accordion, tabs, button_stack) + AI prompt-tightening shipped + 2 new standing rules locked. Backend deploys: scaffold-lesson-outline v4→v5 (request-aware specificity rule prevents block-type padding when user names specific types; accordion/tabs 2-6 minimum stated in block intent guide; mandatory "end with important callout" rule loosened to natural ending); expand-lesson-from-outline v4→v5 (CRITICAL min-2 rule in BLOCK_SCHEMA_HINTS for accordion/tabs; defensive while-loop pad-to-2 in transformConfigForCanvas as backstop when AI ignores prompt rule; button_stack schema gains optional `caption` field, preserved through transformConfigForCanvas with default null); draft-lesson-block v5→v6 (same min-2 enforcement for accordion/tabs in BLOCK_SCHEMAS; same defensive pad-to-2; button_stack caption field). All `_shared/` modules byte-identical across deploys. All anon-probed clean. Frontend ships via 4 Lovable prompts: 6b.1 (stat_callout + statement_a_b — BlockType union + defaultConfig + BlockEditorPane dispatch + scaffolding + siblingBlocks prop threading + EditorSlidePane/LessonBlocksEditor pass-through + ALL 5 render components in BlockRenderer with switch cases + data-block-client-id attribute + lesson-blocks.css for all 5 + StatCalloutBlockForm with live-preview + StatementABBlockForm with RadioGroup variant + side-by-side cards), 6b.2 (AccordionBlockForm with Enter-to-add shortcut + dnd-kit reorder + 1-6 sections + TabsBlockForm with 2-6 tabs + reorder-aware default_tab adjustment + style RadioGroup + ButtonStackBlockForm with 1-4 buttons + link/jump_to_block action_type swap + siblingBlocks dropdown with friendlyBlockLabel helper using extractTextFromTipTap + BlockEditorPane dispatch cases for all 3), 6b.3 (Tabs CSS attempt failed-centering + button_stack `caption` Textarea field 240-char with empty-to-null normalization + render below buttons via fragment wrapping + caption: null in blockTypeMeta defaultConfig + lesson-blocks.css for button_stack caption), 6b.4 (pills/underline centering surgical fix via inline Tailwind override pattern on TabsList/TabsTrigger className props, deletes obsolete `.bw-tabs-list-*` and `.bw-tabs-trigger-*` CSS rules that were losing specificity battle against shadcn defaults applied via cn() merge). DB verification PASS: 13 active lesson_blocks on test fixture 32e0e966 across all 5 new types with valid canvas-shape configs. AI prompt-tightening confirmed working in production: post-deploy AI output produces 3-tab + 3-section blocks where pre-deploy AI had been producing degenerate 1-item blocks for the same prompts. §65 added: AI prompt-tightening pattern for multi-item block types. When a block_type has internal items/tabs/sections with a minimum count requirement, that minimum MUST appear in THREE places: (1) outline-stage system prompt block intent guide saying "MUST have N-M items"; (2) expansion-stage BLOCK_SCHEMA_HINTS marked **CRITICAL** inline within the JSON shape description; (3) defensive while-loop pad-to-min in transformConfigForCanvas() as a backstop for when AI ignores the rule. Layered enforcement prevents degenerate output reaching the DB. Pattern locked Session 64 for accordion (min 2) and tabs (min 2). Applies to any future block type with structural minimum constraints. §66 added: shadcn override pattern — inline Tailwind on className props, not custom CSS classes. Custom CSS class names lose specificity battles against shadcn defaults applied via `cn()` merge (which uses tailwind-merge to combine and resolve Tailwind utilities). shadcn's TabsList applies `inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground` via cn() — custom CSS attempting `background: transparent` or `height: auto` on a class added to className loses because Tailwind utilities have higher specificity in the production build. Standing fix pattern: when overriding shadcn component defaults, pass Tailwind utility classes directly on the component's className prop so they merge correctly via cn() and resolve via tailwind-merge. Custom CSS classes remain useful for additive styling that doesn't fight defaults. Locked Session 64 after 6b.3 shipped CSS-class-based approach failed centering, 6b.4 reverted to inline-Tailwind approach and works. Open bug carrying into Session 65: button_stack link buttons render as `<a href="google.com">` for user-typed URLs lacking a scheme, browser treats as relative path and prepends current location (e.g. produces `https://brainwiseenterprises.com/super-admin/content-authoring/lessons/google.com` instead of going to google.com). Fix is URL normalization at render time: if url is non-empty and lacks `http://`, `https://`, or leading `/`, prepend `https://`. Logged as Session 65 Priority 0 fix. Test fixture status at Session 64 close: 13 active blocks across 9 types (text x4, heading x2, callout x2, list x1, quote x1, stat_callout x1, statement_a_b x1, accordion x2, tabs x3, button_stack x1).*

*v63 - Session 63 IN-PROGRESS — Prompt 6b backend SHIPPED for 5 of 7 new block types (stat_callout, statement_a_b, accordion, tabs, button_stack). flashcards + scenario deferred to 6c per design-complexity gate. Edge Function versions at Session 63 mid-point: scaffold-lesson-outline v4, expand-lesson-from-outline v4, draft-lesson-block v5, ai-authoring-chat v2 (unchanged). ALLOWED_BLOCK_TYPES now 14 of 17 v1 catalog. BLOCK_SCHEMA_HINTS (expand) and BLOCK_SCHEMAS (draft) extended in parallel. transformConfigForCanvas() in both block-producing Edge Functions extended with 5 new cases. Key per-type AI-output → canvas conversion semantics locked: stat_callout (stat is plain text not numeric — supports "47%", "1 in 3", "$2.4M", "5x"; body_markdown optional, defaults to empty TipTap doc); statement_a_b (a_markdown + b_markdown both converted via mdToTipTap, variant defaults to "contrast"); accordion (items[] each get server-generated client_id via crypto.randomUUID() at AI-output time, mirroring list block pattern); tabs (same client_id pattern + integer-validated default_tab + underline/pills style validation + falls back to 0/underline on invalid); button_stack (buttons[] each get server-generated client_id; for action_type:"jump_to_block" target_block_client_id is ALWAYS null at AI-output time because AI doesn't see real block ids — author wires the jump target in the form before save; for action_type:"link" url is preserved as-is). System prompts updated in scaffold to include a Block type intent guide section teaching when to reach for each new type vs alternatives (e.g., "stat_callout when a number is the point, not just a sentence with a percentage in it"; "statement_a_b for teaching by contrast — vague vs SBI, weak vs strong, before vs after"; "accordion for reference content the trainee may or may not need to expand, NOT for primary teaching flow"; "tabs for parallel content branches with the same conceptual structure, e.g. Manager view vs Direct report view of the same scenario"; "button_stack rarely — only when navigation genuinely aids learning"). The Frontend half of Concern A discipline is NOT yet landed — Lovable prompt drafted at internal-docs/prompt-6b-five-block-types.md (1,514 lines) but not yet sent to Lovable. §64 added: Backend-frontend ordering for block_type additions when parity cannot complete in one session. Standing rule: prefer backend-ahead-of-frontend over frontend-ahead-of-backend. Backend-ahead state means AI may produce blocks that save to DB with valid canvas-shape configs but the frontend BlockRenderer falls through to `default: return null` so they appear as empty space in the canvas. This is a visible bug — author sees an empty block where one should be. Easy to spot, easy to diagnose, no data corruption. Frontend-ahead state means the BlockForm exists for a type that the backend whitelist rejects — AI cannot generate it, and manual author authoring may or may not work depending on whether the type is also in ALLOWED_BLOCK_TYPES at the replace_lesson_blocks RPC level. The capability gap surfaces only when the author tries a workflow that doesn't exist (e.g. "make a flashcards block via AI" → AI refuses because not in whitelist) — silent, harder to detect, depends on author behavior to surface. Both states are transient and resolve when the matching half ships. Backend-ahead state is also more recoverable: rolling backend back means redeploying prior Edge Function versions (15K-token cost). Frontend-ahead state is also recoverable but means rolling back a Lovable build, which costs more author time and credit. Apply this rule whenever Concern A's "all 5 touchpoints in one session" cannot hold — choose backend-first split, accept the visible-but-temporary-broken-render state, and ship the frontend in the next session. Document the gap in the closeout, and note that the test surface is limited (super_admin only at this stage), making the visible-bug exposure small. §61 Concern A still binds — this is a refinement, not an override. If Concern A's full-session-parity discipline IS achievable, the rule remains: ship both halves in one session. §64 only applies as a fallback when context budget or scope makes single-session parity infeasible. Session 63 demonstrates the application — backend shipped, frontend prompt drafted but Lovable execution deferred. Test fixture 32e0e966-4cb8-4e8b-abf8-5617de346f59 unchanged from Session 62 close+1day: 10 active lesson_blocks across 5 existing types, ai_authoring_conversations row at stage='chat' with length_preference='detailed' and voice_preset_key='conversational_coach'.*

*v62 - Session 62 CLOSE — AI authoring panel (Prompt 6a-AI) shipped end-to-end + Tier 1 length-preference selector + critical doc-TTL RPC bug fixed + 4 follow-up surgical fixes. §55 added: Staged AI authoring flow architecture. Four-stage state machine (chat → outline → full_content → built) owned by AiPane.tsx, with stage transitions persisted to `ai_authoring_conversations` via 11-param upsert RPC (debounced 2s autosave). Four AI Edge Functions: `ai-authoring-chat` (Stage 1 conversational planning), `scaffold-lesson-outline` (Stage 1→2 outline generation), `expand-lesson-from-outline` (Stage 2→3 full block generation), `draft-lesson-block` (Stage 3 single-block refine + canvas Refine-with-AI). All four enforce a 9-block-type whitelist (text, heading, divider, image, video_embed, quote, list, callout, embed_audio) consistent with the v1 canvas catalog from §41; the other 8 block types in the broader v1 catalog (stat_callout, statement_a_b, tabs, flashcards, accordion, button_stack, scenario, knowledge_check) are deferred to 6b/6c per scope. All four use Class A auth (auth.getClaims JWT verification), super_admin gate via users.account_type check, impersonation_gate.ts denial for category=permission_change (AI authoring is not permitted during impersonation — sound default for SOC 2 traceability). Anthropic API model claude-opus-4-7 across all four. Two new shared modules: `_shared/length_guidance.ts` (resolveLength validates concise|standard|detailed and defaults to standard, lengthGuidanceForOutline returns item count range scaled by length tier, lengthGuidanceForBlock returns per-block-type word count guidance to inject in system prompt, lengthGuidanceForChat returns reply verbosity guidance); `_shared/markdown_to_tiptap.ts` (inline mdToTipTap converter — no library dep — supports paragraphs split on blank lines, hardBreak on single newlines, bold via **text** or __text__, italic via *text* or _text_, links via [text](url), correctly nests marks when multiple apply to same text run). The two block-producing Edge Functions (expand-lesson-from-outline, draft-lesson-block) invoke mdToTipTap inside transformConfigForCanvas() which converts AI output shapes to canvas-valid shapes — text/quote/callout get `body: TipTapDoc`, list items get `[{ client_id: uuid, body: TipTapDoc }]`, heading gets `{text, level}`, divider gets `{color}`, image gets `{asset_id:null, alt, caption}`, video_embed gets `{asset_id:null, source_type:'supabase_storage', source_id:null, title}`, embed_audio gets `{asset_id:null, transcript}`. Length parameter is optional with backend-side resolveLength fallback to 'standard'. Audit log every call with action_type='ai_authoring_draft_generated', after_value JSONB carries edge_function name + content_item_id + block_count/block_types/outline_item_count/length/voice_preset_key/mode + token usage. §56 added: ai_authoring_conversations schema and persistence model. Table has PK (content_item_id, author_id) — exactly one active conversation per author per content_item. Columns: stage (CHECK chat|outline|full_content|built), mode (CHECK fresh|append|replace), messages jsonb (array of {role, content} chat turns), outline_state jsonb (Stage 2 working state — array of OutlineItem with block_type+summary+objective), full_content_state jsonb (Stage 3 working state — array of FullContentItem with block_type+config), attached_document_ids uuid[] (FK to ai_authoring_session_documents), voice_preset_key text (FK to ai_authoring_voice_presets), custom_voice_guidance text + custom_voice_example text (when voice_preset_key='custom'), length_preference text CHECK (concise|standard|detailed) DEFAULT 'standard' (added Session 62), updated_at trigger. Two SECURITY DEFINER RPCs gate on auth.uid()+account_type='brainwise_super_admin' (anon REVOKED): upsert_ai_authoring_conversation (11-param signature with p_length_preference text DEFAULT 'standard'; INSERT ... ON CONFLICT (content_item_id, author_id) DO UPDATE preserving v_caller_id as author_id) — note DROP-then-CREATE migration was required when adding the 11th param because PostgreSQL function overloading would have created a separate 10-param overload alongside the new 11-param signature rather than replacing it cleanly; get_ai_authoring_conversation (13-column return TABLE shape including out_length_preference at position 11). delete_ai_authoring_conversation RPC has session-specific HISTORY: original Session 62 version included a side effect that forcibly expired all ai_authoring_session_documents for the content_item when the conversation was deleted (via UPDATE setting expires_at = now() - interval '1 second'), which silently broke the documented rule that uploaded docs outlive any single conversation on a 14-day-from-last-reference TTL. Bug surfaced when user reported docs disappearing after Start over. Fix shipped same-session: removed the doc-expiry update entirely. Return signature preserved (out_documents_deleted always returns 0 going forward; frontend handles gracefully). Standing rule locked: RPCs that DELETE conversation-scoped working state must NOT touch reference data that has its own lifecycle (docs, assets, etc.) — those have their own TTL/reaper logic and should be allowed to outlive the conversation. §57 added: AI authoring session documents — TTL model and reaper. ai_authoring_session_documents stores author-uploaded reference docs (PDF/TXT/MD/DOCX/PPTX) used as AI prompt context. Per-conversation 150K-token cap with chars/4 estimator; per-file 50K-token cap with [TRUNCATED] marker on overflow. Storage in ai-authoring-temp bucket (25MB cap, 6 MIME types whitelisted in RLS); rows in ai_authoring_session_documents with file_name, file_size_bytes, mime_type, storage_path, extracted_text (full text capped at 50K tokens), extracted_text_token_count, uploaded_at, last_accessed_at, expires_at (default now()+14 days). TTL behavior: on upload, expires_at = now() + 14 days. On reference by any AI Edge Function (chat, scaffold, expand, draft), expires_at = now() + 14 days (reset on reference, NOT extended from existing value). The reset on reference is the key invariant — a doc that's actively used in chat stays alive indefinitely; a doc that's been silent for 14 days gets reaped. Daily cron `reap_ai_authoring_temp_docs_daily` runs at 04:45 UTC, calls reap-ai-authoring-temp-storage Edge Function (Class C dispatcher secret) which finds expires_at < now(), deletes the storage object first then the row (storage-first means a transient storage error leaves the row for next-day retry; row-first would orphan storage). list_ai_authoring_session_documents RPC filters by expires_at > now() so expired-but-not-yet-reaped rows are invisible to UI. Frontend AiPane.tsx on rehydration calls list_ai_authoring_session_documents (line 157-158) to auto-attach all live docs for the content_item — this means docs survive across Start over and across different conversation cycles for the same lesson, which IS the documented behavior. §58 added: Layout rule for fixed-position panels with stage-based content. CONCERN observed Session 62: bottom-anchored controls (chat input in Stage 1, Approve button in Stage 2) were getting clipped past the aside's bottom edge despite fix1 and fix3 adding `flex-shrink-0` and `max-h-[45vh] overflow-y-auto` to internal blocks. Root cause diagnosed by Lovable (verified): the `<aside>` wrapping AiPane is `position: fixed; top: 56px; bottom: 0; flex flex-col`; its stage children (Stage1Chat/Stage2Outline/Stage3FullContent/Stage4Built) had root `flex h-full flex-col`. `h-full` on a flex child claims `height: 100%` of the parent's content box, which equals the full aside height ignoring the header sibling. Header (~40px) plus stage (=aside height) overflows by header's height — clipping anything bottom-anchored inside the stage. flex-shrink-0 on inner footers was the right behavior at the right scope but ineffective because the entire stage canvas was already overflowing. Standing fix pattern: child stages of a `<aside fixed top:X bottom:0 flex flex-col>` MUST use `flex flex-1 min-h-0 flex-col`, NOT `flex h-full flex-col`. `flex-1` correctly takes remaining space after sibling natural heights; `min-h-0` is required so the flex child is allowed to shrink below its intrinsic content height, which is what enables nested `flex-1 overflow-y-auto` regions to scroll. Applied in fix4 to all four stage components. Pattern applies broadly: any flex-column layout with a header + scrollable body + footer in a bounded parent (modal, drawer, slide-pane) must use flex-1 + min-h-0 on the body-and-footer container, NOT h-full. §59 added: flushNow override pattern for debounced auto-save hooks. CONCERN observed Session 62 (Bug 3 in fix1): handleBuild called persistence.flushNow() expecting the conversation row to persist `stage: "built"` before navigating, but the stateRef pattern inside useAiAuthoringPersistence captured `stateRef.current = state` synchronously which meant flushNow read the SAME stale state that triggered the call — the React render that would have set state.stage='built' hadn't completed yet when handleBuild called flushNow. Standing fix pattern: hooks that wrap debounced auto-save MUST expose `flushNow(overrideState?: Partial<State>)` with an optional override Partial, then internally `const s = { ...stateRef.current, ...(overrideState ?? {}) }` before persisting. Caller pattern: `await persistence.flushNow({ stage: "built" })` provides the new state inline without depending on React render cycle. Applied in fix1 to useAiAuthoringPersistence.ts. Generalizes to any hook with stale-closure risk in async flush handlers. §60 added: localStorage sticky-per-content_item convention for authoring scopes. Multiple authoring features need per-lesson sticky settings: voice preference (Session 60), length preference (Session 62), more in 6b/6c. Standing convention: localStorage keys use `ai-authoring:<scope>:<contentItemId>` format. Scope-then-id ordering enables prefix-scans by scope (e.g., enumerate all voice preferences across lessons via prefix `ai-authoring:voice:`) and groups per-content-item keys lexicographically. Pattern in use: `ai-authoring:voice:<contentItemId>` (BlockEditorPane canvas Refine voice), `ai-authoring:length:<contentItemId>` (BlockEditorPane canvas Refine length). The Stage 1/2/3 AI panel surfaces use the SERVER-SIDE ai_authoring_conversations row for persistence (because they're conversation-scoped and need to survive device switches), while the canvas Refine surfaces use localStorage (lesson-scoped sticky on the current device). Different scopes intentionally — canvas Refine doesn't have a conversation row to attach to. §61 added: Concern A — block parity discipline (standing rule for all 6b/6c sessions and beyond). When any session adds, removes, or modifies a block_type in the canvas, the session MUST update all 5 of: (1) ALLOWED_BLOCK_TYPES array in scaffold-lesson-outline Edge Function; (2) ALLOWED_BLOCK_TYPES array in expand-lesson-from-outline Edge Function (also BLOCK_SCHEMAS_HINTS entry); (3) BLOCK_SCHEMAS entry in draft-lesson-block Edge Function; (4) transformConfigForCanvas() switch case in BOTH expand-lesson-from-outline AND draft-lesson-block Edge Functions for AI-output → canvas shape conversion; (5) frontend BlockRenderer switch case + blockTypeMeta.ts entry + block-form component at src/components/super-admin/lesson-blocks/block-forms/<Type>BlockForm.tsx. Skipping any one of the 5 causes silent failures: AI proposes block types that get rejected at expand-time, AI generates outputs in shapes the canvas can't render, frontend forms don't exist for new types, etc. Sessions touching block types start by acknowledging this rule before any code changes. §62 added: Concern B — AI surface area discipline (standing rule for any session that adds AI to a new authoring surface). When a future session adds AI tooling to a non-lesson surface (assessment items, coach communications, report templates, anything beyond lessons), the new surface MUST get its own Edge Functions, not retrofits of the existing AI panel. Rationale: the 6a-AI Edge Functions are specialized for lesson-block authoring — system prompts reference the BrainWise platform context for licensed coach training, BLOCK_SCHEMAS describes 9 specific canvas block shapes, voice presets are coach-voice-oriented, length tiers are tuned to lesson block word counts. Retrofitting them to also handle assessment item authoring would require either dispatching on surface_type (introduces fragile coupling) or accepting that they'd produce wrong outputs for non-lesson surfaces. Standing pattern: new authoring surface = new Edge Function (e.g., `draft-assessment-item`, `scaffold-coach-comm`) with its own system prompts, its own schemas, its own audit log entries. Shared concerns (impersonation gate, auth, length parameter resolution, Markdown→TipTap conversion if applicable) live in _shared modules. §63 added: AI session close-out verification protocol. Standing rule: any session that touches AI content generation MUST run a backend verification SQL pass at close, before doc updates. The pass confirms (a) conversation row stage progression (any active conversations end at stage='built' or 'chat'/'outline' if author paused mid-flow, never at an inconsistent state); (b) lesson_blocks created during the session have canvas-valid configs (TipTap docs for rich-text fields, no Markdown strings leaked through, no asset_id placeholders left as ::null:: instead of NULL); (c) audit log entries from all AI Edge Functions called during session contain the required after_value fields (edge_function name, content_item_id, model, token usage, length tier if applicable); (d) attached document TTLs were extended on every AI reference (last_accessed_at within the session window, expires_at = last_accessed_at + 14 days within reasonable jitter). Catches: silent canvas-shape bugs that don't crash but produce blocks that fail to render in Phase 5 trainee UI, audit-log misses that violate SOC 2 CC7.2, doc-TTL bugs (like the §57 delete_ai_authoring_conversation bug from this session) before they hit production usage.)*


*v61 - Session 61 CLOSE — three architectural sections added covering the lesson-block editor's author-styling and multi-select-bulk-ops capabilities. §52 added: Lesson editor block-level styling architecture (Prompt 6a-style). Choice B locked: universal style fields (background_color, padding) live in BlockEditorPane.tsx rendering BlockStyleSection ONCE after the dispatched block-type form, NOT duplicated across each of the 9 block forms. Rationale: every plausible v1+ universal style field (margin, corner radius, border, shadow, max-width) is universal across block types, not block-type-specific; standing rules push toward MORE platform-locked styling not less. If type-specific style ever comes up later, refactor B→A or hybrid is half-day not a rewrite. Schema: config jsonb extension only — lesson_blocks.config.background_color is string|null (tinted hex from locked palette, null = transparent/no override) and lesson_blocks.config.padding is enum string "none"|"small"|"medium"|"large" (null treated identical to "none" by both display fallback in BlockStyleSection.tsx ?? "none" and BlockRenderer's paddingPxFor helper returning 0 for null/undefined/"none"). No new typed columns, no migration. BlockRenderer wraps 8 of 9 block render outputs in <div className="block-style-wrapper"> with inline styles (background, paddingTop, paddingBottom; plus borderRadius:8 + horizontal 16px padding ONLY when bg is truthy so tinted blocks read as cards while un-tinted blocks render edge-to-edge). Divider case is a geometric no-op — returns its unwrapped 3px line regardless of config.background_color and config.padding values; the fields still round-trip through save for API consistency but have zero visual effect. BRAND_TINT_COLORS palette locked in BrandColorSwatch.tsx alongside existing BRAND_SWATCH_COLORS, same 8-color order: Navy tint #EDEFF2, Orange tint #FDEFE3, Sand tint #F9F7F1, Teal tint #E3EDED, Mustard tint #F3EEDF, Slate tint #EFEDEF, Purple tint #EAE4EE, Forest tint #E5EBE7. Pre-mixed near-neutrals against sand bg, not alpha-blended at render time — predictable across browser, context (editor vs pane preview vs future trainee), and futureproofed for any dark-mode or per-org theming. Sand tint hex equals page background hex (#F9F7F1) intentionally — selecting it stores explicit "Sand" intent but renders identically to Default visually; the difference is semantic, not visual. New palette?: "full" | "tints" prop on BrandColorSwatch defaults to "full" preserving all existing call sites unchanged (DividerBlockForm, ListBlockForm). Padding token mapping locked: none→0px, small→12px, medium→24px, large→48px applied as paddingTop+paddingBottom inline style (horizontal padding NOT configurable in v1, only vertical breathing room). Selection chrome change: .stacked-block.is-selected no longer applies background-color: hsl(var(--muted)) because the muted grey fight any author-set tint — selection signal is now exclusively the orange border-left: 4px solid #F5741A plus the 12px left-padding indent. Hover state untouched. Phase 5 trainee rendering inherits the styling for free because BlockRenderer is the canonical renderer and the styling is applied inside it — no second code path needed. §53 added: Manage mode + multi-select + bulk operations architecture (Prompt 6a-manage). Two-mode editor with mode state ("edit" | "manage") owned by LessonBlocksEditor.tsx, threaded through StackedLessonEditor and conditionally to EditorSlidePane (computes effectiveOpen=mode==="edit"&&open so the slide-in pane force-closes in Manage mode regardless of caller's open prop). Selection state: two parallel pieces, selectedClientId (string|null, single-block edit pane focus) and selectedClientIds (Set<string>, multi-select bulk operation set) — coexist deliberately. lastClickedClientId tracks the last clicked block for shift+click range select. In Manage mode the entire block surface is the click target (toggles selection); the visible checkbox in the upper-left is a visual indicator only. Selection PRESERVES across mode toggle (user-first reconsideration of developer instinct to clear) — the only thing that clears selection is Save (because block IDs change on Save via reload()). Single-block click in Edit mode collapses any lingering multi-selection down to that one block. Keyboard shortcuts (Manage mode only, guarded by mode!=="manage" early return): Cmd/Ctrl+A select-all with e.preventDefault() to suppress browser text-select default, Esc clears all selection. ManageBlocksSidebar (new component, 320px fixed positioning per standing rule 19, animates `right` directly between right:-320px closed and right:0 open per standing rule 20) houses the selection count header, action buttons (Select all / Clear / Move up / Move down / Duplicate / Delete), and inline Apply Style picker (BrandColorSwatch palette="tints" + padding dropdown, each with its own "Apply to N" button so the picker is a deliberate commit not a live mutation). Sidebar buttons gate on hasSelection (most disabled when zero selected, only Select all stays enabled — discoverability over minimalism: author sees the tools available before figuring out what to select). Move up/down further gate on canBulkMoveUp/canBulkMoveDown memoized booleans (topmost selected index > 0 / bottommost selected index < blocks.length-1). Bulk operation algorithms: handleBulkDelete captures {block, index} for each removed block into bulkDeletedBlocks[] sorted by ascending original index, then handleUndoBulkDelete restores by splicing each in at its original index in ascending order (each subsequent splice's original index correctly accounts for all prior splices already in place); handleBulkDuplicate walks the blocks array IN REVERSE to insert duplicates after each selected without index-shift bugs; handleBulkMoveUp walks top-to-bottom swapping each selected block with the one above IF that one above is not also selected (the !selectedClientIds.has check makes adjacent selected blocks move as a coherent group rather than swap with each other); handleBulkMoveDown is the mirror walking bottom-to-top. handleBulkApplyBackground and handleBulkApplyPadding map over blocks setting config.background_color or config.padding on selected ones — uniform handling via the BlockStyleSection fields established in §52, no per-form code paths. UndoDeleteToast extended with optional message prop (default "Block deleted", bulk passes "X blocks deleted") and existing durationMs prop used to differentiate 6s single vs 12s bulk timeout (longer recovery window for destructive bulk action). Cross-mode integration: toggling to Manage closes the edit pane unconditionally via effectiveOpen=false, toggling to Edit does not auto-reopen, first click in Edit mode resets selectedClientIds to that one block and opens the pane. No backend changes — bulk operations are working-state mutations followed by the existing replace_lesson_blocks RPC flow which handles "N blocks come in, N blocks go out" identically regardless of how many. Drag-and-drop always enabled regardless of mode (user-first reconsideration); single-block drag preserves selection. §54 added: Multi-block drag with @dnd-kit DragOverlay (Prompt 6a-manage-multidrag). Group drag is dispatched when the actively-dragged block is part of a multi-selection of size >= 2; otherwise falls through to single-block drag. StackedLessonEditor.tsx manages activeId state via onDragStart/onDragEnd, computes isGroupDragActive boolean (activeId!==null && selectedClientIds.size>=2 && selectedClientIds.has(activeId)), dispatches onGroupReorder(activeClientId, overClientId) to LessonBlocksEditor.tsx when group condition met, else dispatches existing onReorder(fromIndex, toIndex) for single. The two-prop contract (onReorder + onGroupReorder) keeps the single-block path 100% untouched — only adds a new code path for the group case. Visual feedback during group drag: @dnd-kit DragOverlay renders a 240px-wide pill at the cursor showing "Moving N blocks" in Navy font-display + topmost-selected block-type icon in Orange #F5741A, with sand bg + orange 4px left border + shadow-md. Topmost is the lowest-display-order selected block (loop over blocks in array order, first selectedClientIds.has match). Group members fade to 0.4 opacity in place during drag via new isGroupMember prop on SortableStackBlock (computed in parent as isGroupDragActive && selectedClientIds.has && b.client_id !== activeId — the active block already fades via @dnd-kit isDragging). handleGroupReorder math: build selectedSeq[] (selected blocks in original array order to preserve internal relative order) and remaining[] (non-selected blocks); find drop target overClientId's index in remaining (defensive fallback: if overClientId is itself selected — shouldn't happen with @dnd-kit collision but be safe — walk forward in original array from overIdx until hitting a non-selected block, look up its index in remaining); determine drag direction via draggingDown=activeIdx<overIdx; insertAt=draggingDown ? dropIdxInRemaining+1 : dropIdxInRemaining (insert AFTER drop target when dragging down, BEFORE when dragging up — matches @dnd-kit's visual semantics of "dragging past a block places after it" / "dragging up to a block places before it"); splice selectedSeq into remaining at insertAt. Selection set untouched by drag (selectedClientIds members are by client_id which doesn't change during reorder), so post-drag the same blocks are still selected and the sidebar count is unchanged. No new dependencies — DragOverlay is part of @dnd-kit/core already imported via the existing DndContext usage. Activation constraint of distance:4 preserved: a quick click without motion fires onClick (selection toggle), 4+ pixels of motion starts a drag. Test fixture state at Session 61 close: content_item 32e0e966 has 10 active lesson_blocks across all 9 v1 block types, 0 lesson_block_drafts rows, image+audio assets active with refs intact. Saved lesson_blocks_replaced audit rows from session testing. No production data fixes required during the session. No new standing rules surfaced. Phase 5 trainee rendering remains unaffected by §53/§54 (Manage mode and multidrag are authoring-only concerns) and continues to inherit §52 styling for free via the canonical BlockRenderer.)*

*v60 - Session 60 CLOSE (§41 added: Prompt 6a lesson-block editor backend architecture — lesson_block_drafts table (PK content_item_id+author_id) outside audit boundary because drafts are author-private working copies not canonical changes, 4 RLS policies all gated on author_id=auth.uid() AND public.is_super_admin() so each author only sees their own drafts. save_lesson_block_draft / discard_lesson_block_draft RPCs are unaudited (drafts are not canonical state). replace_lesson_blocks extended with Option B asset-ref rebind loop: parent-scoped refs created during upload (asset_id+content_item_id+ref_field='<block_type>_asset') get rebound to lesson_block_ids at Save via SELECT FOR UPDATE + UPDATE setting lesson_block_id=new+content_item_id=NULL, with INSERT fallback when no parent-scoped ref exists (the library-pick path). Returns asset_refs_rebound count in audit after_value for verification. Same RPC also deletes lesson_block_drafts for (content_item_id, auth.uid()) on success. reap_pending_uploads extended with Sweep 2: active non-library assets >24h whose every active ref points at archived/missing parent → _archive_asset_internal with NULL caller (super_admin_audit_log.super_admin_user_id made nullable in same migration to support cron-initiated archival without a human actor). Confirmed cron and function are named reap_pending_uploads (not _hourly — earlier doc references corrected). get_lesson_block_assets(p_content_item_id, p_extra_asset_ids uuid[]) bulk fetch RPC returns out_asset_id/out_bucket/out_path/out_asset_kind for all active asset_ids found in lesson_blocks.config plus any p_extra_asset_ids passed in (used by stacked editor for unsaved-but-uploaded assets). All SECURITY DEFINER + SET search_path='public,pg_temp' + assert_super_admin() guard. Six standing rules locked Session 60: (1) useBlocker from react-router-dom v6 requires a data router (createBrowserRouter); legacy <BrowserRouter> pages must use manual popstate + __browser_back__ sentinel guard pattern documented in LessonBlocksEditor.tsx — useBlocker throws on mount under BrowserRouter and crashes the page; (2) every asset-bearing block form MUST use exactly `<block_type>_asset` as its refField prop on FileUploadField — backend replace_lesson_blocks constructs ref_field as v_block_type || '_asset' for Option B rebind matching, mismatches silently fail to rebind and leave orphan content_item-scoped refs (EmbedAudioBlockForm originally used 'audio_asset' for block_type='embed_audio' creating mismatch); (3) BlockRenderer component (added 6a-stacked) is the canonical block renderer for the platform — Phase 5 trainee learning UI reuses it directly, any new block type added in 6b/6c MUST add render path to BlockRenderer.tsx, never fork into a separate trainee renderer; (4) shadcn Sheet primitive is modal-overlay only (uses Radix Portal + fixed positioning + backdrop) — for non-modal slide-in panes where content behind remains interactive, build a regular flex/grid sibling with CSS transform animation, see EditorSlidePane.tsx; (5) auto-save debounce hooks MUST expose pause()/resume() methods so parent components can cancel pending debounce timers around explicit save operations — otherwise the debounce fires after the explicit save completes and undoes the save's cleanup work (caused the lesson_block_drafts race condition surfaced in Session 60 testing where draft row re-appeared 3 seconds after Save); (6) super_admin_audit_log.action_type uses an FK to super_admin_action_types table (lookup table, not CHECK whitelist) — correction to standing rule that previously stated CHECK constraint. §42 added: Lesson editor branding lock — bg-muted for selected fill + border-l-4 border-[#F5741A] for left-edge indicator (gray fill + orange edge, matches ContentAuthoring TreeRow precedent), bg-muted/30 for hover, Navy #021F36 + font-display (Poppins) for page h1 and editor pane heading, shadow-cta only on Save button, BrainWise orange #F5741A reserved for: TipTap list bullets, inline links, focus rings, active toolbar buttons (bg-[#F5741A]/15 subtle tint), selection left-border, inline + Add block hover state, primary CTAs (shadow-cta). Callout variant colors locked: info=teal #006D77, warning=amber #FFB703, success=forest #2D6A4F, important=orange #F5741A. Undo toast: white card + border-l-4 border-[#006D77] teal accent. Do NOT use bg-accent/bg-accent/50 for cards or selection — too loud orange, broke contrast in 6a v1. Lovable Prompt 6a initial (commit 638db60fbe0ee68c1f1484b3a4f80193c1238b0f) and 6a-brand (commit d44f7bc7423b178108a0c7c4cb136378c6ac0b21) SHIPPED; useBlocker crash hotfix landed mid-session; Prompt 6a-stacked SENT awaiting build. Updated sub-prompt sequence locked supersede Session 59: 6a-stacked → 6a-style → 6a-manage → 6a-AI → 6b → 6c. §43 added late Session 60 (post-stacked-rebuild): three additional backend migrations applied during E2E testing of 6a-stacked. (a) fix_cascade_helper_bare_delete and (b) fix_bare_delete_in_all_cascade_helpers: all 5 cascade-archive helpers (_cascade_archive_asset_refs_for_lesson_blocks, _content_item, _module, _curriculum, _certification_path) used bare DELETE FROM <temp_table>; statements to clear their working temp tables. Supabase's Postgres runtime rejects bare DELETE without a WHERE clause at the SQL layer (even on pg_temp.* schema temp tables); the error "DELETE requires a WHERE clause" only surfaces when the helper is called with a non-empty input array (early-return on empty masked the bug across Sessions 58-59). All 5 helpers fixed via TRUNCATE <temp_table>; replacement. This was a latent bug from Sessions 58-59 that would have failed any cascade archive on entities with active asset refs in production. (c) defer_cascade_archive_in_replace_lesson_blocks: cascade-archive helper call inside replace_lesson_blocks ran BEFORE the FOR loop that inserts new blocks and creates new asset refs. When an asset was referenced by both an outgoing block (being archived) AND an incoming block (being inserted) in the same save (the common case for "save a lesson without changing an existing image"), the helper saw zero active refs at the moment it ran — the outgoing ref was archived but the new ref didn't exist yet — and auto-archived the still-needed asset. Subsequent saves then failed validation block_at_index_N_references_inactive_or_missing_asset because the validation loop at the top of replace_lesson_blocks rejects refs to non-active assets. Fix moves the v_cascade_result := public._cascade_archive_asset_refs_for_lesson_blocks(...) call to AFTER the FOR loop that inserts new blocks + creates new refs. By then, any asset that's still referenced by an incoming block has at least one active ref pointing at it, so the cascade helper's "any active refs?" check correctly returns true and skips the auto-archive. Refs for assets no longer referenced (true orphans) still get archived and cascade their asset correctly. §44 added: cross-prompt standing rules locked late Session 60 for all downstream sub-prompts. (1) Brand-only color enforcement: any color chooser added in 6a-style, 6a-manage, 6a-AI, 6b, 6c MUST use the BrandColorSwatch component built in 6a-stacked-fix or a strict subset of its BRAND_SWATCH_COLORS list (Navy #021F36, Orange #F5741A, Teal #006D77, Forest #2D6A4F, Slate #6D6875). No hex input field, no system color picker, no off-palette colors anywhere in lesson authoring. Non-negotiable for content portability across organizations licensing BrainWise content. (2) Bare DELETE FROM <table>; is rejected at runtime in Supabase Postgres even on temp tables — use TRUNCATE <table>; to clear all rows or include a WHERE clause on every DELETE. (3) In replace_lesson_blocks and any future replace-style RPC with auto-archive cascade, the cascade MUST run AFTER incoming refs are created — helpers checking "any active refs?" need the new refs to be visible, otherwise transient zero-ref states cause spurious cascade-archives of still-referenced assets. (4) Typography baseline lifted to 17px body / 1.65 line-height in lesson-blocks.css .tiptap-prose wrapper applies wherever lesson content renders (stacked editor, slide-in pane previews, future Phase 5 trainee UI) — any new block type in 6b/6c that introduces new rendered content inherits this baseline automatically by using the .tiptap-prose wrapper. (5) List marker defaults locked: bullets = forest green #2D6A4F filled disc (0.65em diameter), numbered = orange #F5741A filled circle (1.5em diameter) with white Poppins numeral inside; defaults non-overridable per-block in v1, future per-block override (if ever added) MUST use BrandColorSwatch palette. (6) Divider default locked: 3px rounded line, default Navy #021F36, color overridable via BrandColorSwatch constrained to 5 brand colors. (7) Save-and-leave is the primary path when user has unsaved changes and tries to navigate away — Discard-and-leave is the de-emphasized escape hatch, Stay is cancel. Applies to any future dirty-state navigation guard added in 6a-manage or elsewhere. §45 added: 6a-style scope refinements. Block background color picker in 6a-style MUST use BrandColorSwatch from 6a-stacked-fix, likely with pre-mixed lighter tint variants for readability (definite values to be locked at 6a-style scoping). Padding stays a fixed enumerated set (none / small / medium / large) rather than arbitrary px input — keeps lesson visual rhythm predictable across authors. Schema decision leans toward extending the existing lesson_blocks.config jsonb shape rather than adding typed columns (BlockRenderer already routes config-driven styling, typed columns add no useful constraint enforcement since values are CSS-shaped not enum-shaped). 6a-style MUST NOT introduce per-block override of heading color, link color, callout variant color, or list marker color — those are platform-locked; the author tools for visual differentiation are: background color, padding, divider color (already shipped), and structural choices (heading level, list type). §46 added: TipTap JSON normalization for dirty detection. TipTap normalizes its JSON shape on readonly editor mount differently than the editable form's output (adds marks: [] to empty text nodes, sorts attribute keys differently, etc.). Naively comparing JSON.stringify(blocks) to a prior snapshot triggers false-dirty detection every time a readonly TipTap instance mounts. Standing fix: deep-normalize the JSON before comparison — strip empty arrays, sort object keys, drop null/empty-string values. Applied in 6a-stacked-fix to both useLessonBlockDraft auto-save dirty detection and isDirty memo in LessonBlocksEditor. Any future hook or component that compares TipTap-bearing block snapshots MUST use the same normalization (provided as inline helper in 6a-stacked-fix, not yet extracted to shared utility — extract if used in a third place). §47 added late Session 60: manual asset un-archive must reverse both tables. The `_archive_asset_internal` helper archives the asset row in `content_assets` AND the matching `current_version_id` row in `content_asset_versions` atomically. Any data fix that manually un-archives an asset (UPDATE setting status='active', archived_at=NULL, archive_reason=NULL on content_assets) MUST also reverse the version row (UPDATE archived_at=NULL on the matching content_asset_versions row). Otherwise the `get_lesson_block_assets` RPC and any future signed-URL resolver continue to filter the asset out because they require `cav.archived_at IS NULL` to consider the version usable for storage path lookup. Discovered Session 60 when asset 6ce8bc29 was un-archived after the cascade-archive timing bug fix but its version stayed archived, causing the image block to render "No image uploaded" placeholder despite the asset row showing status='active'. §48 added late Session 60: TipTap TextStyle extension cannot accept arbitrary attributes without explicit extension. TipTap's default `TextStyle` extension from `@tiptap/extension-text-style` registers no per-attribute schema; calling `editor.chain().setMark("textStyle", { fontSize: "lead" }).run()` succeeds at the chain level but the unknown attribute is silently dropped during JSON serialization, leaving the rendered HTML without the attribute and CSS selectors targeting it without anything to match. Standing fix pattern: extend TextStyle via `TextStyle.extend({ addAttributes() { return { ...this.parent?.(), <attr>: { default: null, parseHTML: el => el.getAttribute("data-<attr>"), renderHTML: attrs => attrs.<attr> ? { "data-<attr>": attrs.<attr> } : {} } } } })` exported as a named const, then swap that into the editor's `extensions` array in BOTH the editable RichTextEditor AND the readonly ReadOnlyTipTap in BlockRenderer (otherwise rendered output won't carry the attribute even if the editor does). Pattern applies to any future TipTap custom mark attribute (font weight, custom text color when allowed, paragraph alignment, etc.). §49 added late Session 60: position:sticky is unreliable in this codebase for viewport-tracking UI — use position:fixed with explicit offsets. Three v3 sub-iterations attempted to make a slide-in editor pane track scroll via position:sticky and all three failed for distinct reasons: (a) sticky + CSS transform on the same element breaks sticky's scroll-context detection because transform creates a new containing block in most browsers (documented quirk); (b) sticky inside ancestor chains that combine overflow:auto AND nested flex containers (AppLayout's <main> is overflow-auto creating the scroll context, with nested flex parents in the lesson-blocks editor page) is unreliable for engagement detection; (c) the workarounds (separating sticky from transform via nested wrappers) still don't engage reliably because of (b). Standing fix pattern: for any UI that needs to stay visible while sibling content scrolls past, use position:fixed with explicit offsets keyed off AppLayout's known dimensions. The AppLayout exposes two reliable anchors: header height is 56px (set inline on the <header> element in AppLayout.tsx), and global sidebar width is var(--sidebar-width) set by SidebarProvider in src/components/ui/sidebar.tsx (16rem expanded, 3rem icon-collapsed, 0 offcanvas-closed). For pane-style UI sitting alongside the global sidebar, use top:56px + left:var(--sidebar-width, 0px) + bottom:0 + width:min(<desired>, calc(100vw - var(--sidebar-width, 0px))). The position:fixed pane responds correctly to sidebar state changes because both reference the same CSS variable. §50 added late Session 60: slide-in/slide-out pane animations should animate the `left` CSS property directly rather than using CSS transform when the closed state needs to be fully off-screen and there's a global sidebar to avoid covering. Transform-based animation translates the pane FROM its open coordinate range — so a pane that's open at left:256px with a 480px width, when transformed -translate-x-full (translateX(-100%)), ends up at visual position [-224px, 256px] which overlaps the sidebar's [0, 256px] range. By contrast, animating `left` directly between open value (left:var(--sidebar-width)) and closed value (left:-480px, putting the pane fully in negative coordinate space) means the pane's coordinate range during the closed state is [-480px, 0px] which never overlaps the sidebar. Both approaches produce visually equivalent slide animations (300ms ease-out), but only the `left`-animation approach avoids sidebar overlap. Use `transition-[left]` Tailwind class to opt into this. Trade-off: animating `left` is slightly less performant than animating `transform` (left triggers layout/paint, transform is compositor-only), but for the size of pane involved (480px) and the frequency (open/close on user action) the performance cost is unmeasurable in practice. Use transform-based slide ONLY when the closed state can be in transform-translated coordinates without overlapping anything important — e.g., when there's no global sidebar to worry about, or when the pane is positioned far enough right that translating left still keeps the pane within main content area bounds. §51 added: TipTap StarterKit + explicit Link extension causes "Duplicate extension names found: ['link']" warning. StarterKit (from @tiptap/starter-kit) bundles a Link extension by default. Adding `Link.configure({...})` explicitly to the extensions array alongside StarterKit registers Link twice. Console warning is non-fatal but should be cleaned up — either drop the explicit Link import (lose configure access) or use StarterKit's configure pattern to disable its bundled Link and re-add explicitly: `StarterKit.configure({ link: false })`. Logged as build queue cleanup item, not addressed Session 60.)*

*v59 - Session 59 CLOSE (§40 added: Parent entity thumbnails — schema extensions to content_asset_refs for 5-way parent FK, thumbnail_asset_id columns on all 4 parent tables, cascade helpers, validation + idempotent ref helpers, amended upsert/archive RPCs, extended request_asset_upload RPC + Edge Function v2, frontend integration, idempotent ref creation pattern locked as standing rule for any dual-write-path refs, verified end-to-end across all 4 entity types with library reuse pattern confirmed. Two new architectural standing rules embedded: (1) CREATE OR REPLACE on RPC with new arg list creates separate overload NOT replacement — same migration MUST follow with explicit DROP FUNCTION of legacy signature; (2) Sticky positioning does NOT work inside AppLayout main's overflow-auto scroll context — use direct height calculations like h-[calc(100vh-7rem)] self-start instead. Prompt 6 sub-prompt scoping for Sessions 60+ persisted to internal-docs/prompt-6-scope-summary.md with locked decisions across 6a/6a-AI/6b/6c.)*

*v58 - Session 58 CLOSE (§38 added: Prompt 5.6 native asset upload infrastructure — buckets, schema, RPC catalog, Edge Functions, cron schedule, helper functions, two-step browser-direct upload protocol, Pattern C reads decision. §39 added: storage.objects RLS for super-admin TUS uploads — the supplementary migration prompt_5_6_1_super_admin_storage_rls_for_tus added 4 super-admin policies (INSERT, SELECT, UPDATE, DELETE) on storage.objects scoped to bucket_id='lesson-assets' with NOT public.is_impersonating() guards on writes. Required because TUS resumable uploads at /storage/v1/upload/resumable authenticate via Authorization: Bearer <user JWT>, not via signed-upload-tokens. The x-signature header path uses a different signature format (verifyObjectSignature) and would have required an undocumented /upload/resumable/sign endpoint. Using user JWT with RLS gates is cleaner, follows the canonical Supabase docs example, and the audit/registry chain still goes through the Edge Function. The service_role-ALL policy stays in place for sweep cron access.)*

*v57 - Session 58 INTERIM (Never pushed to GitHub. Content folded into v58.)*


*v56 - Session 57 CLOSE (§35 added: Edge Function auth pattern locked after draft-text v1-v5 debugging cycle. Three rules: (1) supabase-js must be imported as `npm:@supabase/supabase-js@2.57.2` NOT `https://esm.sh/@supabase/supabase-js@2.45.0` — esm.sh@2.45.0 lacks `auth.getClaims()`; (2) JWT verification uses `userClient.auth.getClaims(token)` with explicit token arg, called against an anon-key client (no Authorization header injection on that client); (3) `log_super_admin_action` RPC must be called via the caller's auth-bound anon+Bearer client, NOT the service client — the RPC raises 42501 when `auth.uid()` IS NULL and service role bypasses auth. Same fixes deployed to draft-lesson-block v2 and scaffold-lesson v2. §36 added: ContentAuthoring editor file structure post-Prompt-5.5. ContentAuthoring.tsx now 802 lines as tree+state shell; editors live at src/pages/super-admin/editors/{CertPathEditor.tsx, CurriculumEditor.tsx, ModuleEditor.tsx, ContentItemEditor.tsx, _shared.tsx}. _shared.tsx houses constants, NodeType/TreeNode types, ItemTypeIcon/NodeTypeIcon components, slugify helper. Prompt 6 builds LessonBlocksEditor.tsx in this same editors/ directory from inception. §37 added: content_items RPC bug pattern. upsert_content_item v1 had per-type default-values applied unconditionally in the INSERT/UPDATE block, violating per-type CHECK constraints on cross-type rows. Fix: any COALESCE(<type-specific>, <default>) must live inside the WHEN '<type>' branch of the CASE statement, not in the shared INSERT clause. Pattern applies to any future RPC that updates rows with per-type fields gated by per-type CHECK constraints.)*

*v55 - Session 56 IN-PROGRESS (§33 and §34 added: standing patterns from Prompts 3.1-3.4 cycle. §33 covers PostgREST FK-disambiguation in embedded selects — when a child table has multiple FKs to the same parent, embedded selects MUST use `!<column_name>` syntax or return silently-null rows. Discovered Session 56 in AttachedCurriculaSection; one-line fix in Prompt 3.3. Standing recon protocol added for Prompts 4+: enumerate FKs on every join table before writing embeds. §34 covers content authoring tree's "All <type>" sections — Prompt 3.4 renamed Standalone → All, removed attachment-status filters, added selection-ancestor auto-expand via reverse-lookup Maps for cu and mo nodes. Same curriculum now appears in both hierarchical and flat sections, selection state shared via nodeKey. Forward-compat notes for Prompts 4-5 included.)*

*v54 - Session 56 IN-PROGRESS (§32 added: soft-archive slug uniqueness fix. Migration slug_unique_only_among_active_for_authoring_tables shipped: dropped global *_slug_key UNIQUE constraints on certification_paths/curricula/modules, replaced with partial unique indexes (slug) WHERE archived_at IS NULL. Matches existing lesson_blocks_active_order_uniq pattern. Discovered when Cole archived PTP-Coach and tried to recreate — 23505 toast incorrectly suggested active-slug collision. Now archived rows release their slug for reuse; active-active collisions still rejected. Established as standing pattern for any future authoring table with slug + archived_at.)*

*v53 - Session 56 IN-PROGRESS (Step 1 SHIPPED: AI authoring Edge Functions deployed. draft-lesson-block v1, scaffold-lesson v1, draft-text v1 all ACTIVE. Canonical `_shared/impersonation_gate.ts` source extracted from production via `get_edge_function` on set-account-type v43. Deploy followed §23.7's "Custom (set-account-type)" `entrypoint_path` pattern: `<function-name>/index.ts` plus `_shared/<file>.ts` in the files array. §29.5 updated from "pending Session 56" to SHIPPED state with full deploy parameters, audit pattern, and deferred-verification list. Live super-admin happy-path and impersonation-denied path verification deferred to Lovable Prompt 5 frontend integration.)*

*v52 - Session 55 CLOSE (Phase 4 backend prep COMPLETE + Lovable Prompt 1 landed + invite-coach hardening FULLY shipped: backend + frontend. Backend: 8 prep migrations (notifications/CHECKs/lesson_blocks/CRUD/AI infra) + 1 hardening migration (coach_invitations email tracking columns: email_send_status/email_send_error/email_last_attempt_at); 10 authoring CRUD RPCs deployed; AI authoring infrastructure with 5 voice presets and 5 context blocks. Edge Functions: invite-coach redeployed v10→v11 with resend-aware logic (detects existing pending row and resends instead of refusing), email_type/source passed to send-email (was 'unknown'), hard email-send failure surfacing, email status persisted to row. End-to-end Resend button verified via test row. Cheryl's invitation flow verified separately. Frontend: Content Authoring shell live in production; Coach Management hardening Lovable prompt landed and verified (584 lines, up from 495) — 4 call sites use new inspectInviteCoachResponse helper, Email Status column with Sent/Failed/Pending badges, Retry Email button with destructive styling on failed rows. AI Edge Functions (3) drafted locally but not deployed pending canonical _shared/impersonation_gate.ts source confirmation in Session 56. New standing protocol locked: every Lovable prompt now requires backend + frontend + branding recon (3 passes). See architecture-reference §28-§31 for full Session 55 detail.)*

*v51 - Session 55 CLOSE (initial close marker — superseded by v52 above after invite-coach hardening late-session).

*v50 - Session 55 IN-PROGRESS — superseded by v51 CLOSE marker above.

*v49 - Session 54 CLOSE (Group C backend complete through Phase 3.5; new §27 covers all Group C tables, RPCs, notifications subsystem, and Phase 3.5 authoring-adjacent RPCs. Two standing rules locked: SOC 2 from inception, Impersonation gate from inception. Vault secret `internal_function_secret` runbook pending Cole's one-time setup before any email-channel notification fires in production. Phase 4 frontend work begins Session 55.)*

*v48 - Session 53 CLOSE (Group A Phase C + Phase D fully shipped and verified end-to-end. New §26.7 hook freshness gate, §26.8 mfa_challenges fallback, §26.9 lifecycle event mode column, §26.10 paginated multi-field search, §26.11 my_access_history category default, §26.12 identityMutation helper. §25.9 partially reversed in §26.4. §25.10 corrected in §26.1. Session 54 opens Group C — Coach Certification + Resources / Learning Paths.)*

## 1. Overview

This reference captures the canonical system architecture for the BrainWise platform as of Session 45 close. **Three Session 45 shipments**: AIRSA org dashboard PDF export delivered end-to-end (`src/lib/generateAIRSADashboardPdf.ts` ~1276 lines, sections: Cover + Overview + Domains + Skill Inventory + Manager Calibration + Trends), `generate-airsa-org-narrative` v2 deployed with rewritten action-oriented voice prompt (canonical template for future voice work), and risk-flag color fix shipped. Two rendering bugs fixed: PDF `bodyText` font-state leak through continuation pages, and frontend hyphen-bullet rendering via new `renderNarrativeText` helper.

A comprehensive scope doc was produced for the Org Overview Dashboard + AIRSA cross-instrument extensions (4 phases, 3-5 sessions estimated, parked at `/mnt/user-data/outputs/org-overview-and-airsa-cross-instrument-scope.md`). Test fixture overlap verified: 44 PTP+AIRSA users, 34 NAI+AIRSA users, 32 all-three. **Sub-task 2b (test fixture seeding) dropped entirely** — no seeding needed.

Prior context: Phase 5b AIRSA org dashboard frontend shipped Session 44. Phase 5a backend (RPC and Edge Function) shipped Session 43. AIRSA dual-rater Phase 2 (backend workflow), Phase 3a (calculate-scores enhancement), Phase 3b (self-rater post-submit experience), Phase 3e backend (AI section generators), Phase 3e frontend (AirsaCombinedReport.tsx, 14-section combined report), and Phase 4 (PDF export) are all shipped to production and verified.

A production hot-fix shipped in Session 38 unblocked corporate invitation redemption. PTP Pleasure brand color flipped from yellow to forest green across the entire codebase. NAI Saturation color refactor (#FFB703 to mustard #7a5800) shipped in Session 39 via Lovable. Phase 3e frontend shipped via AirsaCombinedReport.tsx in Session 40 with multiple visual polish iterations. Phase 4 PDF export shipped in Session 41. Phase 5a backend recon completed and AIRSA test fixture seeded in Session 42 (47 pairs total in production, org-wide TCI = 40.1). The complete brand color map and the AIRSA STATUS_COLORS canonical mapping are in Section 5.

## 2. AIRSA dual-rater workflow - current state

### 2.1 State machine

AIRSA dual-rater is a paired-assessment workflow. A self-rater completes their AIRSA, which automatically creates a paired manager assessment row pointed at their supervisor. The supervisor takes the manager rating; once both legs complete, a combined results row is generated with self-manager divergence calculated, and AI section generators fan out to populate facet_interpretations rows.

Both legs of the pair use instrument_id = INST-003. The legs differ on rater_type (lowercase 'self' vs 'manager') and on which user_id is the rater versus the target_user_id.

Status flow per leg:

- Self leg: in_progress -> completed
- Manager leg: pending -> in_progress -> completed

### 2.2 Database schema additions to assessments

- paired_assessment_id (uuid, FK to assessments.id, ON DELETE SET NULL) - reciprocal linkage between self and manager rows
- reminder_count (int, default 0) - tracks reminder emails sent by self-rater
- last_reminder_sent_at (timestamptz, nullable) - enforces 72-hour cooldown server-side
- self_only_released_at (timestamptz, nullable) - set when self-rater clicks Release self-only after 14d timeout
- status CHECK constraint extended to allow 'pending'

Indexes: idx_assessments_paired_assessment_id, idx_assessments_target_user_status.

### 2.3 Database schema additions to assessment_results

- UNIQUE constraint on assessment_results.assessment_id (name: assessment_results_assessment_id_unique). Required for ON CONFLICT upsert in calculate-scores combined-result merge.
- skill_level_breakdown JSONB column (NEW in v33). Populated by calculate-scores Branch A. Shape: keyed by item_number string; each value contains skill_number, skill_name, skill_description, dimension_id, domain_name, self_level, manager_level, self_response, manager_response, delta, direction, status. Partial index where instrument_id = 'INST-003'.

manager_dimension_scores and self_manager_divergence columns already existed; they are now populated by Branch A. self_manager_divergence per-dimension entries now include a `status` field (NEW in v33) with values aligned, confirmed_strength, confirmed_gap, blind_spot, underestimate.

NOTE: an `airsa_report_sections` JSONB column was briefly added and then dropped during Session 39 after a concurrency-design pivot. AI section content lives in facet_interpretations (Section 2.11), not on this table.

### 2.4 Schema convention warning

rater_type case sensitivity is split across the schema. items.rater_type uses CAPITAL-S 'Self' and CAPITAL-M 'Manager'. assessments.rater_type uses LOWERCASE 'self' and 'manager' (per the assessments_rater_type_check CHECK constraint). All Phase 2 backend code conforms to the assessments lowercase convention. Phase 3 frontend code that loads items for the supervisor's rating flow must use capital-M 'Manager' when querying the items table. Cross-table joins on rater_type WILL FAIL silently because of the case mismatch. Always normalize at the boundary.

### 2.5 Pair-creation trigger

Function: public.create_airsa_manager_pair_on_self_complete (SECURITY DEFINER, search_path = public).
Trigger: on_airsa_self_completed_create_pair, AFTER UPDATE on assessments, FOR EACH ROW.

Logic, in order:

- Skip if not AIRSA, not self rater_type, not flipping to completed, or already completed (idempotent)
- Look up self-rater's supervisor_user_id; if null, skip pair creation (assessment proceeds solo)
- Validate supervisor: must be active and in same org as self-rater; otherwise skip
- Idempotency guard: skip if a paired manager row already exists
- INSERT manager assessment row: user_id = supervisor, target_user_id = self-rater, rater_type = 'manager', status = 'pending'
- UPDATE self assessment row to set its paired_assessment_id reciprocally
- Fire async pg_net.http_post to airsa-supervisor-invite Edge Function

All exception paths use RAISE WARNING and RETURN NEW. The trigger never blocks the parent transaction.

### 2.6 RLS anchoring fix on assessments

The original 'assessments: managers read assessments they ordered' policy used target_user_id = auth.uid() OR ordered_by_coach_id = auth.uid(). For AIRSA, the self-rater IS the target_user_id on the manager row, which would have leaked manager assessment metadata to them.

New policy expression:

```
(instrument_id != 'INST-003' AND (target_user_id = auth.uid() OR ordered_by_coach_id = auth.uid()))
OR (instrument_id = 'INST-003' AND ordered_by_coach_id = auth.uid())
```

Effect: non-AIRSA behavior preserved. For AIRSA, the target_user_id read path is removed; supervisors read their manager assessment via 'users read their own' (user_id = auth.uid()). Self-rater never reads the manager row metadata.

### 2.7 Combined-results gate RPC

public.airsa_can_generate_combined_result(p_self_assessment_id uuid)

Returns: out_can_generate, out_mode ('combined' | 'self_only' | 'blocked'), out_reason, plus context fields.

Decision tree:

- Self assessment not found or not AIRSA Self rater_type -> blocked / not_*
- Self status != 'completed' -> blocked / self_not_completed
- paired_assessment_id IS NULL -> self_only / no_paired_manager_no_supervisor
- Paired manager status = 'completed' -> combined / both_rater_types_completed
- self_only_released_at IS NOT NULL -> self_only / self_only_released_after_timeout
- Otherwise -> blocked / awaiting_manager_completion

calculate-scores invokes this gate before deciding what to write to assessment_results.

### 2.8 RPCs (all SECURITY DEFINER, GRANT EXECUTE TO authenticated unless noted)

- airsa_can_generate_combined_result(uuid) - the gate (see 2.7)
- airsa_release_self_only(uuid) - 14-day timeout self-only release
- airsa_send_reminder(uuid) - reminder with 72-hour cooldown
- airsa_request_rerate(uuid) - 90-day cooldown re-take
- my_pending_manager_assessments() - supervisor's pending cards on /assessment
- my_direct_reports_with_pending_ratings() - direct reports + AIRSA cycle status
- airsa_get_my_paired_manager_status(uuid) - self-rater reads minimal paired-manager metadata for awaiting-state UI; closes the RLS gap from 2.6
- airsa_get_paired_self_rater_name(uuid) - manager-side minimum-disclosure RPC for paired-name read by corporate_employee role
- **get_airsa_aggregate(p_slice_type text, p_slice_value text)** - org dashboard aggregate (NEW Session 43, see §10.6 for full payload shape and §10.7 for the consuming Edge Function)

### 2.9 Edge Functions (rater-flow)

airsa-supervisor-invite v2 (Class B, INTERNAL_FUNCTION_SECRET gated)

- Triggered by: pg_net call from create_airsa_manager_pair_on_self_complete
- Input: { manager_assessment_id }
- Action: builds branded HTML email, forwards to send-email

airsa-supervisor-reminder v2 (Class A, JWT-required)

- Triggered by: frontend after airsa_send_reminder RPC succeeds
- Input: { manager_assessment_id }
- Authorization: caller must equal target_user_id on the manager assessment

Both deployed with verify_jwt: false (consistent with codebase; validation happens inside function bodies via auth.getClaims).

### 2.10 calculate-scores - v42 (Phase 3e fan-out wired)

Three explicit branches:

Branch A: AIRSA Manager submission. Loads paired self assessment + responses; computes self dimension scores; computes manager dimension scores; computes self-manager divergence with status field; computes skill_level_breakdown by joining assessment_responses self+manager with airsa_skills with dimensions; UPSERTs the assessment_results row keyed by SELF assessment_id with manager_dimension_scores, self_manager_divergence, and skill_level_breakdown populated; flips manager assessment to completed; triggers generate-report fire-and-forget (legacy narrative path) and ALSO triggers all six AIRSA AI section generators in parallel via fire-and-forget (Phase 3e fan-out).

Branch B: AIRSA Self submission. Flips self to completed; calls the gate; if 'blocked' returns awaiting_manager with no results row written; if 'self_only', upserts results row with no manager fields and triggers generate-report.

Branch C: All non-AIRSA paths. Preserved byte-for-byte from prior versions.

Detection: `isAirsaCorrect = instrument_id === 'INST-003'` drives all AIRSA branching. Legacy isAIRSA prefix check preserved (always false in practice) to avoid changing PTP/NAI/HSS code paths.

KNOWN BUG: Branch B re-stamps completed_at on the self-only release path. See Build Queue BUG-5.

### 2.11 AI section generators (NEW in v33) - storage, auth, and orchestration

Six Edge Functions, one per section. Storage shared with existing PTP/NAI AI content via the facet_interpretations table.

Functions:

- generate-airsa-profile-overview v5 - section_type airsa_profile_overview, plain text, 800 max_tokens
- generate-airsa-what-this-means v3 - section_type airsa_what_this_means, JSON 4-key object, 2000 max_tokens
- generate-airsa-action-plan v3 - section_type airsa_action_plan, JSON 3-key object, 600 max_tokens
- generate-airsa-conversation-guide v3 - section_type airsa_conversation_guide, JSON 3-key object, 600 max_tokens
- generate-airsa-top-priorities v2 - section_type airsa_top_priorities, JSON array of 3 objects, 1500 max_tokens
- generate-airsa-cross-instrument v2 - section_type airsa_cross_instrument, plain text, 1200 max_tokens, conditional

Orchestration: calculate-scores Branch A fires all six in parallel via fire-and-forget HTTP POST with `x-internal-secret`. Each writes its own facet_interpretations row keyed by (assessment_result_id, section_type) UNIQUE. Frontend reads all rows in a single SELECT WHERE assessment_result_id = ? AND section_type LIKE 'airsa_%'.

Storage row shape (facet_data JSONB):

- For plain-text sections: { content: "<text>", ai_version, model }
- For JSON-object sections: { content: { ...keys }, ai_version, model }
- For array sections: { content: [...], ai_version, model }
- For cross-instrument with PTP/NAI present: { content, ai_version, model, has_ptp, has_nai }

Auth model (per function): hybrid Class A + Class B. Internal secret with constant-time `safeEqual` comparison for service-to-service calls (calculate-scores Branch A, pg_net tests). User JWT via auth.getClaims for frontend calls, with ownership check against assessment_results.user_id and AIRSA-only gate (instrument_id === 'INST-003').

Cache discipline: each function checks for an existing row first. Returns cached content with no AI call if present and force_regenerate flag is not set. Force regenerate path deletes the row before insert. Concurrent same-section calls handled via 23505 unique-violation catch: re-read and return cached.

Race-condition fix history: an earlier attempt used a JSONB merge column on assessment_results, which suffered last-write-wins overwrites under parallel fan-out. A SECURITY DEFINER atomic-merge RPC was tried as a fix, then dropped. The current per-row pattern in facet_interpretations is the canonical solution and matches PTP/NAI precedent.

Cross-instrument skip behavior: when the user has neither PTP (INST-001) nor NAI (INST-002) results, the function returns success with skipped=true and writes NO row. Frontend treats absence of the row as "show unlock CTA". This mirrors the existing facet_interpretations convention where missing rows render empty.

Output discipline (all six functions):

- Reference skills by NUMBER only ("Skill 7"), never by name. Frontend post-processor wraps "Skill N" mentions with hover-tooltip components reading from skill_level_breakdown.
- BANNED words in AI output: fascinating, valuable, interesting, exciting, striking, remarkable, dynamic, masking
- BANNED phrases: "this creates", "this suggests you", "may be masking", "valuable calibration"
- No em-dashes
- Domain names used in prose, never dimension IDs
- Model: claude-sonnet-4-20250514 across all six

Shared utilities (inlined per function deploy because Edge Functions deploy per-folder):

- _shared/secrets.ts: `safeEqual` constant-time comparison (SOC 2 CC6.1)
- _shared/errors.ts: `serverError` sanitized 5xx (SOC 2 CC7.2)

### 2.12 airsa_skills reference table (NEW in v33)

Static lookup table seeded from the canonical AI Readiness Skills Profile source document (24 skills across 8 domains).

Schema:

- item_number INTEGER PRIMARY KEY
- dimension_id TEXT NOT NULL FK -> dimensions.dimension_id (UNIQUE constraint required for FK)
- skill_name TEXT NOT NULL
- short_description TEXT NOT NULL
- full_definition TEXT NOT NULL
- theoretical_basis TEXT
- behavioral_indicators JSONB
- is_new_skill BOOLEAN NOT NULL DEFAULT false (true for skills 10, 17, 22)
- primary_p TEXT CHECK (Protection|Participation|Prediction|Purpose|Pleasure)
- secondary_ps JSONB
- created_at, updated_at with updated_at trigger

RLS: read-only authenticated. No writes from app code.

Distribution verified: 24 total rows, 3 with is_new_skill = true (10, 17, 22), domain coverage D1=3 D2=3 D3=4 D4=3 D5=4 D6=2 D7=2 D8=3, primary_p coverage Protection=5 Participation=5 Prediction=6 Purpose=3 Pleasure=5.

Used by: calculate-scores Branch A (joins to build skill_level_breakdown); the 6 AI section generators (read indirectly through skill_level_breakdown which already contains the denormalized skill metadata).

### 2.13 AIRSA scale labels (Session 42 lock)

AIRSA frequency scale: `0=Never, 1=Rarely, 2=Often, 3=Consistently`. NOT "Always". Items table values verified during Session 42 fixture seeding. Frontend, PDF, and AI prompts must all use this exact labeling. Any drift to "Always" in copy is a bug.

## 3. Frontend - Phase 3b through Phase 3e shipped

### 3.1 /my-results AIRSA awaiting-state (shipped Session 38)

Awaiting state polls airsa_get_my_paired_manager_status periodically with early-exit when status changes to completed mid-poll. Time-based UI:

- 0-13 days: awaiting card only
- 14-89 days: awaiting card + Send Reminder + Release Self-Only
- 90+ days: awaiting card + Re-take confirmation dialog

### 3.2 Self-rater frontend data path (shipped Session 38)

The self-rater cannot read the manager assessment row directly (RLS blocks via 2.6). The awaiting-state UI gets data exclusively through airsa_get_my_paired_manager_status RPC.

### 3.3 Combined report frontend (SHIPPED in Session 40)

AirsaCombinedReport.tsx (~1360 lines) is the canonical 14-section AIRSA combined report. Mounted at `/my-results` for users whose selected result has `instrument_id === "INST-003"`. Reads `assessment_results.skill_level_breakdown` plus all `facet_interpretations` rows where `section_type LIKE 'airsa_%'` in a single fetch on mount. Loading skeletons per section while AI fan-out is still completing. Polls every 8 seconds for missing AI sections until all six arrive or 90 seconds elapsed.

Section list (14 sections, Section 10 quadrant removed in Session 40):

1. Header
2. At a glance (4 metric cards)
3. Action buttons (Export PDF / Retake / Take Another - matches PTP/NAI standard)
4. How to read your results (with AIRSA overview folded in, 4-level frequency to 3-level readiness)
5. Domain heatmap (5-status column with `whiteSpace: nowrap` pill, Status column min-width 160)
6. Profile overview (AI - airsa_profile_overview)
7. What does this mean to me? (AI - airsa_what_this_means, 4 themed boxes with tone pills)
8. Action plan (AI - airsa_action_plan, 3 timeframes with navy/teal/green branded pills)
9. Skill-by-skill comparison lollipop (24 skills, chartW=560, level-zone shading, combined legend at top with star explanation)
10. Conversation guide (AI - airsa_conversation_guide, 3 openings with role pills)
11. Top 3 development priorities (AI - airsa_top_priorities, status-color pills)
12. How this connects to your other assessments (AI - airsa_cross_instrument, conditional)
13. Skill reference list, collapsed (all 24 skills)
14. Methodology footer

Star marker semantics: `★` next to a skill name in Section 9 indicates the skill is one of the user's three top priorities (sourced from `airsa_top_priorities.content[].skill_number`). Computed via useMemo on the `data` object. NOT surfaced in Section 11 priority cards or Section 13 reference list.

Self-only mode: same layout structure, manager columns hidden, no divergence pills, banner explaining manager rating did not arrive. The SkillReference popover, the lollipop legend, and the heatmap status column all gate on `!isSelfOnly`.

### 3.4 AIRSA combined report PDF export (SHIPPED in Session 41)

`src/lib/generateAirsaPdf.ts` (NEW) is the canonical PDF renderer for AIRSA. Pattern mirrors `generateNaiPdf.ts` exactly: jsPDF native primitives only, helvetica family, page-numbering loop at the end, `addFooter` / `checkPageBreak` / `ensureBlockSpace` / `sectionHeading` / `bodyText` / `cleanMarkdown` / `hexToRgb` helpers. Cover page + 14 sections (Header always rendered, Section 3 buttons skipped because they're screen-only, all other 12 sections individually toggleable via `AirsaPdfSections` interface). Filename pattern `BrainWise-AIRSA[-Coach][-SelfOnly]-<LastName>-<YYYY-MM-DD>.pdf`.

`src/lib/assemblePdfDataForUser.ts` (EDIT) gained `assembleAirsaPdfData()` export. Reuses `fetchCommon()` helper, queries `assessment_results.skill_level_breakdown` and all `facet_interpretations` rows where `section_type LIKE 'airsa_%'`, plus `airsa_skills` for the 24-row self-only fallback. Returns typed `AirsaPdfData` object. Footer metadata fallback: `aiGeneratedAt = anySection?.generated_at ?? result.created_at ?? null` because AI generator Edge Functions do not consistently populate `generated_at` in the `facet_data` JSONB.

`src/components/results/ExportPdfModal.tsx` (EDIT) gained `AirsaPdfSectionsUi` interface, `AIRSA_GROUPS` config (4 groups: Profile sections / Skill detail / Cross-cutting / Reference), `instrumentType: "AIRSA"` branch, `onExportAirsa` prop. PTP/NAI code paths untouched.

`src/pages/MyResults.tsx` (EDIT): the `<ExportPdfModal>` was lifted out of the `!isAIRSA` branch so it renders for all instruments. `instrumentType` switches on `isAIRSA / isNAI / isPTP / "OTHER"`. `handleAirsaPdfExport` callback dispatches `assembleAirsaPdfData()` then `generateAirsaPdf()`.

`src/components/results/AirsaCombinedReport.tsx` (EDIT): `onExportClick?: () => void` prop added; the Export PDF button stub (`alert("PDF export coming soon")`) replaced with `onExportClick?.()`. The 1360-line component is otherwise untouched, preserving Session 40 visual polish and Rules of Hooks structure.

PDF rendering decisions locked in Session 41:

- **Lollipop** rendered as native jsPDF lines + circles on its own page. Level-zone shading uses pre-blended values (peach/sky-blue/green-tint blended against white at 60% opacity) so jsPDF GState reliability across viewers is not a concern. STATUS_COLORS mapping reproduced exactly: aligned dot, blind_spot dashed line via `setLineDashPattern([1.2, 1.0], 0)`, all other statuses solid lines. Self-only mode: single teal dot per skill, no lines.

- **Star glyph substitution.** ★ (U+2605) is not in WinAnsiEncoding which jsPDF default helvetica uses. PRIORITY_GLYPH = "*" constant in `generateAirsaPdf.ts`. The on-screen `AirsaCombinedReport.tsx` continues to use ★. Pattern documented in §5.6.

- **Section 6 Profile overview** uses the sectionHeading anti-orphan pattern: card height computed first (5mm padding + descLines × 4.5mm leading + 5mm padding), passed as `minContentNeeded` argument to sectionHeading. Wrap width is `CONTENT_W - 12` (full content area minus 6mm × 2 inner padding) to match the "What this means" cards.

- **Skill reference list** computes per-entry height from `headingH (4.5) + domainH (3.8) + descLines × 4.2 + padH (4)`, sets font BEFORE splitTextToSize (canonical pattern, see §5.6), and uses computed height for both `ensureBlockSpace` and `y` advance. Result: ~6-8 skills per page comfortably.

- **Top priorities cards** computes per-card height from pill (5+2) + title row (6+4) + 2 eyebrows (each 4+1) + targetLines (×4.5) + practiceLines (×4.5) + padding. Same pattern as skill reference. Status pill bg blended at 20% saturation, text at full saturation.

## 4. Production hot-fix: corporate invitation redemption (carried from v32)

GUC opt-out pattern: `app.bypass_user_immutable_check`, set transaction-locally via set_config(name, value, true) inside the invitation_redeem RPC body. The enforce_immutable_user_fields trigger reads current_setting(name, true) and short-circuits if 't'. Defense-in-depth via the users-update-own-safe-fields RLS WITH CHECK clause. SOC 2 CC6.1 / CC6.3 / CC7.2 compliant.

Audit follow-up logged in Build Queue (BUG-7): enumerate other SECURITY DEFINER functions that UPDATE public.users.

## 5. Brand color complete map

### 5.1 Locked dimension color assignments

PTP dimensions:

- Protection: #021F36 (navy)
- Participation: #006D77 (teal)
- Prediction: #6D6875 (slate gray)
- Purpose: #3C096C (plum/purple)
- Pleasure: #2D6A4F (forest green)

NAI dimensions:

- Certainty: #021F36 (navy)
- Agency: #F5741A (orange)
- Fairness: #006D77 (teal)
- Ego Stability: #3C096C (plum/purple)
- Saturation: #7a5800 (mustard)

Instrument-level:

- AIRSA primary: #2D6A4F (forest green)
- HSS primary: #6D6875 (slate gray)

### 5.2 Brand tokens preserved

The CSS token --bw-amber: #FFB703 in src/index.css and src/styles/marketing-tokens.css is preserved. It remains the brand palette yellow used by the --warning semantic token and other UI elements. After the v33 Saturation refactor, #FFB703 no longer appears as a dimension color anywhere.

### 5.3 AIRSA combined report STATUS_COLORS canonical mapping (Session 40 lock)

The five AIRSA dual-rater statuses each use a distinct brand color. This mapping is authoritative — it drives the lollipop line color, the heatmap status pill, the priority card status pill, and the Section 5 "skills by status" indicator dots in AirsaCombinedReport.tsx.

- aligned: #006D77 (teal)
- confirmed_strength: #2D6A4F (green)
- confirmed_gap: #6D6875 (gray)
- blind_spot: #021F36 (navy)
- underestimate: #3C096C (purple)

Dash pattern is preserved on `blind_spot` only. Other statuses use solid lines and chips.

Cross-instrument note: #3C096C is also used as the PTP Purpose dimension color. Contexts never overlap on the same screen, so the reuse is acceptable.

### 5.4 AIRSA lollipop level-zone shading (Session 40 lock)

Three vertical band colors behind the dots in `LollipopChart` only. These three hex values must NOT be used anywhere else in the codebase:

- Foundational (left third): #FCE4D6 (warm peach)
- Proficient (middle third): #D6E8F5 (clear sky blue)
- Advanced (right third): #D8E8D0 (fresh leaf green-tint)

All three at fillOpacity 0.6. Hardcoded hex literals required in the SVG `fill` attribute (CSS variables do not resolve there).

### 5.5 Quadrant map removed (historical note)

Section 5.3 of v33 documented quadrant map colors. The developmental quadrant section was built in Session 40 and then removed mid-session. Rationale: it duplicated lollipop information in less-readable form. Section count dropped from 15 to 14. The four quadrant labels (Underestimate, Confirmed strength, Confirmed gap, Blind spot) are now visible exclusively through the STATUS_COLORS mapping above.

### 5.6 jsPDF rendering rules (Session 41 lock)

Three rules govern PDF generation across all instruments:

**WinAnsiEncoding glyph constraint.** jsPDF default helvetica uses WinAnsiEncoding. Unicode glyphs outside that codepoint range (★ U+2605, ◆ U+25C6, etc.) get substituted by jsPDF's encoder to a fallback character (observed: ampersand `&`). Pattern: define an ASCII-equivalent constant in the PDF generator (`PRIORITY_GLYPH = "*"`) and use it everywhere the on-screen report uses the Unicode glyph. The on-screen component continues to use the Unicode glyph because browsers handle U+2605 fine. This rule applies to the AIRSA PDF (★ → `*`) and any future PDF generator that wants to mirror an on-screen Unicode glyph.

**splitTextToSize font-state dependency.** `doc.splitTextToSize(text, width)` uses the CURRENT font for width calculation. Setting font BEFORE calling splitTextToSize is the canonical pattern, already commented in `generateNaiPdf.ts` line 406-407: "splitTextToSize uses the CURRENT font for width calc. Set font to match rendering font BEFORE splitting, or wrap widths come out wrong." Skipping this produces correct text but wrong wrap width, causing entries to render at narrow column widths even when full content area is available. All four AIRSA PDF render loops (Profile overview, Skill reference, Top priorities, What this means cards) follow this pattern.

**Section heading anti-orphan pattern.** When a section has a body card whose total height is computable upfront, pass that height plus heading clearance as the `minContentNeeded` argument to `sectionHeading()`. The helper does a page-break check before drawing the heading; if the page can't fit heading + card together, it advances to a new page first. Skipping this orphans the heading on one page with the body card on the next. Examples: `sectionHeading("Profile overview", overviewCardH + 6)`, `sectionHeading("Skill reference list", 60)`, `sectionHeading("Top 3 development priorities", 70)`.

## 6. Edits to existing surfaces

### 6.1 marketing-tokens.css

Two semantic alias tokens added in Session 37 after the existing --success/--warning/--info/--premium line:

```
--danger: var(--bw-orange-700); --danger-soft: var(--bw-orange-100);
```

The brand uses orange (not red) for danger states. App-side index.css does NOT mirror these aliases yet (see Build Queue: semantic-token reconciliation).

### 6.2 AdminUsers.tsx

Two banners above the Users tab Card showing supervisor health (no supervisor assigned, deactivated supervisor). Each has a Review button that filters the user table.

## 7. Three-tier Edge Function auth model

Class A: JWT via auth.getClaims (user context, frontend-callable)

- Used by: airsa-supervisor-reminder v2, calculate-scores, invitation_send, generate-airsa-org-narrative v1 (primary path)
- Will be used by: generate-airsa-org-narrative (Phase 5a, mirrors generate-dashboard-narrative v22)

Class B: x-internal-secret header (value INTERNAL_FUNCTION_SECRET from Edge Function Secrets, validated with constant-time `safeEqual` comparison)

- Used by: airsa-supervisor-invite v2, send-email, generate-report
- The 6 AIRSA AI section generators support BOTH Class A and Class B (hybrid) on the same function

Class C: x-dispatcher-secret (departure_dispatcher_shared_secret)

- Used by: pg_cron entry points only
- Currently: dispatch_grace_reminders_daily, sync_stripe_prices_daily

## 8. Locked architectural constraints

- Two sequential Anthropic Opus calls cannot be bundled in one Edge Function (Supabase 150-second timeout). Phase 3e splits this into 6 separate functions with frontend parallel fan-out.
- auth.getClaims is the canonical JWT verification method; not getUser, not local decode
- After every apply_migration via MCP, run a separate execute_sql verification query
- Multi-statement execute_sql returns only the last statement's result; split intermediate checks
- Edge Function Secrets are not readable/writable via MCP; verify via dashboard or indirect pg_net wrong-secret HTTP tests
- get_edge_function returns full source and is reliable for pre-patch audits
- deploy_edge_function requires complete file content; always preserve verify_jwt: false explicitly
- Before generating values for an existing table, query pg_constraint for CHECK rules. Reading information_schema.columns is not sufficient.
- GUC opt-out pattern for SECURITY DEFINER UPDATEs that legitimately need to bypass enforce_immutable_user_fields: app.bypass_user_immutable_check, transaction-local
- NEW (Session 39): When multiple Edge Functions write per-section AI content, use the per-row pattern in facet_interpretations with UNIQUE (assessment_result_id, section_type) and 23505 race-recovery, NOT a JSONB merge on a shared column. The merge approach suffers last-write-wins under fan-out.
- NEW (Session 39): Constant-time secret comparison via `safeEqual` for `x-internal-secret` validation in Class B and hybrid auth, not direct string equality. Inlined per Edge Function via _shared/secrets.ts pattern.
- NEW (Session 40): SVG `fill` attribute does NOT resolve CSS variables in production browsers. `fill="var(--bw-cream)"` evaluates to nothing and the shape doesn't render. Use either hardcoded hex literals (`fill="#F9F7F1"`) or the inline `style={{ fill: "var(--bw-cream)" }}` form. The lollipop level-zone bands surfaced this during debugging.
- NEW (Session 40): React Rules of Hooks violations cause silent blank pages in production builds (no visible error, just an empty render tree because there's no error boundary above the failing component). Diagnostic signature: console shows minified React error #310 ("Rendered more hooks than during the previous render"). Mechanism: any hook placed AFTER an early return causes hook-count mismatch between renders. Mitigation: ALL hook calls (useState, useEffect, useMemo, useRef, useCallback) must appear at the top of a component body, BEFORE any `if (loading || !data) return ...` guard. Verified via the Phase 3e frontend `prioritySkillNumbers` useMemo bug.
- NEW (Session 40): When passing computed Sets/Maps from a parent component into a memoized child, derive them via useMemo with the underlying data object as the dependency. Source the data via optional chaining (`data?.sections?.foo?.bar`) so the useMemo can run unconditionally before the loading guard fires. The dependency array on `[data]` is correct even though `data` changes only at fetch boundaries.
- NEW (Session 41): jsPDF default helvetica uses WinAnsiEncoding; Unicode glyphs outside that range (★ ◆ etc.) get substituted to an in-range fallback character. Pattern: ASCII-equivalent constants in PDF generators, Unicode glyph in on-screen contexts. See §5.6 rule 1.
- NEW (Session 41): jsPDF's splitTextToSize uses CURRENT font for width calc; setting font BEFORE the call is mandatory or wrap widths come out wrong. See §5.6 rule 2.
- NEW (Session 41): When a section heading has a body card whose height is computable upfront, pass that height as the minContentNeeded argument to sectionHeading() to prevent heading orphaning. See §5.6 rule 3.
- NEW (Session 42): For dashboard-level AI generators that are user-triggered from the frontend (Regenerate AI button), use Class A JWT via auth.getClaims, not Class B internal-secret. The Class B path is reserved for service-to-service calls (e.g., calculate-scores fan-out to individual report generators). Pattern reference: generate-dashboard-narrative v22.
- NEW (Session 42): When designing org-level aggregations that include a supervisor-rollup view, do NOT add a `'supervisor'` slice_type. The existing `'team'` slice already routes by `supervisor_user_id`. Iterate supervisors INSIDE the RPC body for per-supervisor rollups instead of adding a new slice enum value. This avoids a CHECK constraint migration and keeps slice_type semantics clean.

- NEW (Session 43): n<5 suppression in aggregate RPCs must be applied to the eligible participant pool size (`array_length(v_participant_ids)`), NOT the skill-pair count or any product of participants × items. Suppressing on a participant × items product silently allows single-participant slices through, breaking privacy guarantees. Caught and fixed during Session 43 verification of `get_airsa_aggregate`.
- NEW (Session 43): When an Edge Function calls a SECURITY DEFINER RPC on behalf of a user, the RPC client must be created with the user's JWT forwarded as Authorization header: `createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: 'Bearer <userToken>' } } })`. This makes `auth.uid()` resolve correctly inside the RPC. Service-role clients bypass `auth.uid()` entirely (returns NULL), which would break SECURITY DEFINER caller validation. The Class B path uses the service-role client because there's no user JWT, and instead requires `organization_id` in the request body.
- NEW (Session 44): When extending an existing RPC's payload shape with new fields, Edge Functions that read the payload as opaque JSONB (no per-field iteration) accept the new fields without redeployment. Verified for `generate-airsa-org-narrative` consuming the new `per_department_breakdown` field added in Session 44 — function was unchanged, just stored the larger payload in `org_dashboard_narratives.dimension_scores`. This is the safe extension pattern: add new fields rather than restructuring existing ones, and downstream consumers that don't reference the new fields keep working.
- NEW (Session 44): When populating a frontend dropdown with org-scoped data that doesn't have a dedicated RPC, prefer a direct `users` table query under existing RLS over creating a new SECURITY DEFINER RPC. The supervisor list for the AIRSA Team selector uses two PostgREST queries (subordinates with non-null supervisor_user_id, then a name lookup on the distinct supervisor IDs) instead of adding a `list_org_supervisors()` RPC. This pattern is appropriate when (a) the data is already exposed to the role via existing RLS, (b) the lookup is cheap (typically dozens of rows), and (c) the alternative would be a single-purpose RPC that adds maintenance surface without unique value. Reserve new RPCs for cases requiring SECURITY DEFINER privilege escalation, multi-table joins beyond what RLS allows, or computation that can't be done client-side.
- NEW (Session 45): jsPDF font-state must be re-applied on EVERY `doc.text()` call inside a multi-line wrapped-text loop, not just before `splitTextToSize`. The previous §5.6 rule 2 only addressed measurement (set font before splitTextToSize so wrap widths are correct). It missed the render-side leak: `renderContinuationHeader` runs INSIDE the loop when a pagebreak fires mid-section, sets 10pt italic for the "(cont.)" label, then resets weight back to "normal" but NOT the font size. Control returns to the caller's loop, which calls `doc.text(line, ...)` directly without re-applying font state. The line was split for 8.5pt width but renders at 10pt, overflowing the right margin. Visible on page 3 of the first AIRSA dashboard PDF export with clipped words ("Ethical and Re", "Information and Resource Management fo"). Fix: every multi-line render loop that can pagebreak must re-apply `setFontSize`, `setFont`, `setText` AFTER `checkPageBreak()` and BEFORE `doc.text()` on each iteration. Updated `bodyText` helper in `generateAIRSADashboardPdf.ts` reflects this. The same bug likely exists latently in `generatePTPDashboardPdf.ts` — to verify and fix when convenient.
- NEW (Session 45): For frontend rendering of AI-emitted hyphen-prefixed bullet lines and numbered steps, `whiteSpace: pre-wrap` is insufficient. It preserves newlines but produces zero visual hierarchy — bullets read as a wall of hyphens. The pattern locked in `renderNarrativeText` helper in `AirsaDashboard.tsx`: split text on `\n`, classify each line via regex (`/^[-*]\s+(.+)$/` for bullets, `/^(\d+)\.\s+(.+)$/` for numbered, blank lines as paragraph breaks), buffer consecutive prose lines into single `<p>` elements, render bullets as flex rows with `paddingLeft: 16, marginBottom: 4` and a hanging-indent layout for wrapped continuation lines. The helper takes `(text, fontSize, color)` so it's reusable across narrative subsections, summary cards, and risk flag detail blocks. Same logic ported to PDF generator's `bodyText` helper with 4mm hanging indent and 1mm extra spacing before each list item. This pattern is portable to NAI/PTP dashboards if/when those are voice-redesigned.
- NEW (Session 45): When rewriting an AI generator's prompt for action-oriented voice across multiple instruments, pull existing skill names and confirm character lengths first. AIRSA's 24 skill names are 13-37 chars (avg 21) — short enough to drop "Skill N." prefix from prose without bloating the text. Numbers can stay only in on-screen lookup tables (Calibration Map, Skill Inventory) where users cross-reference visually. The verification query is `SELECT MIN(LENGTH(skill_name)), MAX(LENGTH(skill_name)), AVG(LENGTH(skill_name))::int FROM airsa_skills`. Apply same check before extending this voice pattern to PTP/NAI dimension or facet names.
- NEW (Session 45): For instrument-agnostic table designs, the `org_cross_instrument_recommendations` schema (id, organization_id, slice_type, slice_value, primary_instrument_id text, primary_narrative_id uuid, input_narrative_ids jsonb, recommendations jsonb, summary text) supports any instrument as primary or cross — verified via Session 45 recon. Adding new instruments (AIRSA cross-instrument coming in scoped future work) requires no migration. The `input_narrative_ids` jsonb array can hold any number of cross-referenced narrative IDs, supporting both 1×1 pairings and the future 3-way Overview synthesis without schema changes.

## 9. Test fixtures

Test org name: BrainWise Test Corp.

Test user emails follow the testclientbwe+role@gmail.com pattern (orgmember, supervisor, employee). Specific UUIDs and the test password are NOT stored in this public repo. Look them up at session start by:

- Querying Supabase via MCP for users where email matches the testclientbwe+ pattern
- Reading the test password from Claude's userMemories block
- If neither is available, ask the user

Session 39 fixture state at close:

- Test users renamed to Maya Employee (the self-rater) and David Supervisor (the manager-rater) so first-name extraction is testable in AI output. Production code does not hardcode these names; they are pulled from users.full_name and split on first space.
- AIRSA self assessment, manager assessment, and combined assessment_result row exist for the fixture.
- All six facet_interpretations rows for sections airsa_profile_overview, airsa_what_this_means, airsa_action_plan, airsa_conversation_guide, and airsa_top_priorities are populated; airsa_cross_instrument is NOT (Maya has no PTP/NAI, so the function correctly skips and writes no row).

When a new session begins, look up the current state via Supabase rather than relying on values written in prior closeouts. The full Session 42 seed structure is documented in §11.

## 10. AIRSA Company Dashboard (Session 41 strategic frame, Session 42 recon, Phase 5a backend SHIPPED Session 43, Phase 5b frontend remaining)

The strategic frame for the AIRSA org dashboard is locked. Phase 5a backend (RPC + Edge Function) shipped Session 43 and is verified against the seeded fixture. Phase 5b frontend is the remaining piece. The full RPC payload spec is in §10.6 and the Edge Function spec is in §10.7.

### 10.1 Central thesis

PTP and NAI dashboards answer "what's the population state?" — distributions of latent constructs (threat reactivity, cognitive friction). Each leads with a composite (Threat Profile / AI Readiness Index) and breaks down into dimension cards.

The AIRSA dashboard answers a structurally different question: **how accurately does the organization see its own AI talent?** This comes from two AIRSA-unique properties:

1. AIRSA is the only dual-rater instrument. The org-level data is fundamentally about agreement and disagreement, not population state.
2. AIRSA measures observable skills, not latent constructs. The org-level question becomes "where are we wasting talent?" and "where do we have a calibration problem?"

### 10.2 Headline metric: Talent Calibration Index (TCI)

`TCI = (count of aligned + confirmed_strength) / (total assessed skill-pairs) × 100`. Range 0-100, higher is better. Confirmed gaps do NOT count positive (real capability gap, not earned strength). Stored in `org_dashboard_narratives.index_score` (existing polymorphic numeric column).

Three companion sub-metrics in the headline strip: Alignment rate (any same-direction read), Blind spot rate, Underestimate rate.

### 10.3 Tab structure (5 tabs, mirrors PTP/NAI)

1. **Overview**: persistent header with TCI; slice controls (All / Department / Level / Team — Manager Calibration data is computed by iterating supervisors INSIDE the RPC, no `'supervisor'` slice_type); 4 sub-metric cards; **AI workforce narrative inline as expandable card** (top 3 recommended actions surfaced when expanded); Greatest Growth Opportunities / Strengths to Capitalize paired panels (top 2 skills + top 2 domains per panel, full ranking via expand link); Calibration Map (visual centerpiece); Risk flags.

2. **Domains**: 8 domain cards (PTP dimension card pattern). Each card: domain name + colored dot, average self-readiness 3-zone bar, average manager-readiness 3-zone bar, status distribution 5-segment stacked bar using STATUS_COLORS. Click to expand for per-skill breakdown.

3. **Skill Inventory**: sortable filterable table (Skill # | Name | Domain | Self avg | Manager avg | TCI | Blind spot % | Underestimate % | n). Default sort: `cps_growth DESC` ("Sort by growth priority"). Row expand: per-department TCI for that skill, top blind-spot departments, top underestimate departments, AI-generated intervention recommendation.

4. **Manager Calibration** (AIRSA-unique tab, NOT in PTP/NAI): aggregates by `users.supervisor_user_id` chain, computed inside the RPC. Per-manager panel: name, report count, TCI scoped to their reports, blind-spot rate vs underestimate rate (asymmetry signals over-estimator vs under-estimator tendency), calibration consistency. Top 5 best-calibrated / Bottom 5. Privacy threshold: minimum 3 reports per manager.

5. **Trends + Cross-Instrument**: LineChart of TCI over time (PTP/NAI Trends pattern); PTP × AIRSA and NAI × AIRSA correlations using existing C.A.F.E.S–PTP co-elevation framework.

### 10.4 Composite Priority Score (CPS)

Each skill and domain gets two scores per slice:

- `cps_growth = (1 - readiness_index) * misalignment_weight`
- `cps_strength = confirmed_strength_pct`

Where `readiness_index` = avg(self+manager levels) mapped to [0,1] (Foundational=0, Proficient=0.5, Advanced=1.0) averaged across all pairs in the slice, and `misalignment_weight = 1 + (blind_spot_pct + confirmed_gap_pct) / 100` bounded [1.0, 2.0]. A skill with no misalignment gets weight 1.0 (raw capability gap); a skill with full misalignment gets weight 2.0 (gap doubled because the org is weak AND unaware).

Tie-breakers: growth prefers higher blind_spot_pct (org doesn't see the problem yet), strength prefers higher n. Suppression: n < 5 excluded.

### 10.5 Calibration Map (visual centerpiece)

24-skill × N-departments heatmap. Rows = 24 skills grouped visually by 8 domain bands. Columns = active slice values. Cell color = locked STATUS_COLORS by modal status. Cell intensity = % of pairs with that status. Hover popover: n, % aligned, % blind, % under. Click: drill into underlying pairs (privacy threshold respected). Suppressed cells (n < 5): rendered gray with "n<5" tooltip.

Priority markers (Session 41 lock): orange ▲ for top 2 growth skills, green ◆ for top 2 strength skills, on row labels. Markers track the active slice's CPS rankings (when a department slice is on, markers reflect that department's priorities, not the org-wide priorities).

### 10.6 Schema strategy and verified RPC payload

Match PTP/NAI exactly. Reuse `org_dashboard_narratives` table with `instrument_id = 'INST-003'`. AIRSA-specific aggregates carried in `dimension_scores` JSONB. AI workforce narrative cached in `narrative_text` JSONB. TCI carried in `index_score` numeric column. NO new aggregate table.

Session 42 recon confirmed: existing `'team'` slice already routes by `supervisor_user_id`. Manager Calibration tab is computed inside the RPC by iterating supervisors with min-3-reports threshold.

Session 44 added a `per_department_breakdown` field on every skill aggregate via migration `add_per_department_breakdown_to_get_airsa_aggregate`. This was needed for the Calibration Map's 24-skill × N-department visualization (Phase 5b frontend). Implementation adds two CTEs (`skill_dept_agg` and `skill_dept_object`) that group `skills_long` by `(skill_number, department_name)` joined to `users.department_id` → `departments.id` → `departments.name`. Null-safe fallback to `(unassigned)`. Per-cell `modal_status` is computed via `MODE() WITHIN GROUP (ORDER BY status)` over the actual per-pair status values, more accurate than recomputing from modal levels. Per-cell n<5 suppression flag is set independently of wholesale RPC suppression.

**Verified RPC payload shape** (live against the seeded fixture as of Session 44 close):

```jsonc
{
  "suppressed": false,
  "instrument_id": "INST-003",
  "slice_type": "all",
  "slice_value": "all",
  "pair_count": 1128,
  "eligible_count": 54,
  "completed_count": 47,
  "tci_overall": 40.1,
  "alignment_rate": 59.0,
  "blind_spot_rate": 20.3,
  "underestimate_rate": 20.7,
  "status_distribution": {
    "aligned": 276,
    "confirmed_strength": 176,
    "confirmed_gap": 214,
    "blind_spot": 229,
    "underestimate": 233
  },
  "skill_aggregates": {
    "1": {
      "skill_name": "Cognitive Adaptability",
      "dimension_id": "DIM-AIRSA-01",
      "domain_name": "Cognitive & Learning Skills",
      "modal_self_level": "Proficient",
      "modal_manager_level": "Proficient",
      "tci": 72.3,
      "blind_spot_pct": 8.5,
      "underestimate_pct": 14.9,
      "confirmed_strength_pct": 8.5,
      "n": 47,
      "cps_growth": 0.5458,
      "cps_strength": 8.5106,
      "suppressed": false,
      "per_department_breakdown": {
        "Engineering": { "n": 18, "tci": 72.2, "modal_status": "aligned",
                         "blind_spot_pct": 11.1, "underestimate_pct": 16.7,
                         "confirmed_strength_pct": 11.1, "suppressed": false },
        "Finance":     { "n": 14, "tci": 64.3, "modal_status": "aligned", ... },
        "Marketing":   { "n": 15, "tci": 80.0, "modal_status": "aligned", ... }
      }
    },
    // ... 23 more skills keyed by skill_number string
  },
  "domain_aggregates": {
    "DIM-AIRSA-01": {
      "domain_name": "Cognitive & Learning Skills",
      "tci": 53.9,
      "blind_spot_pct": 31.9,
      "underestimate_pct": 11.3,
      "confirmed_strength_pct": 5.0,
      "n": 141,
      "cps_growth": 0.5806,
      "cps_strength": 4.9645,
      "suppressed": false
    },
    // ... 7 more domains
  },
  "rankings": {
    "growth_skills":   [{ "skill_number": 10, "skill_name": "Identity Flexibility",
                          "dimension_id": "DIM-AIRSA-03", "cps_growth": 1.8030 }, ...],
    "strength_skills": [{ "skill_number": 23, "skill_name": "Algorithmic Vigilance",
                          "dimension_id": "DIM-AIRSA-08", "cps_strength": 85.1064 }, ...],
    "growth_domains":  [{ "dimension_id": "DIM-AIRSA-03", "domain_name": "Psychological Readiness",
                          "cps_growth": 1.4350 }, ...],
    "strength_domains":[{ "dimension_id": "DIM-AIRSA-04", "domain_name": "Strategic & Systems Thinking",
                          "cps_strength": 51.0638 }, ...]
  },
  "manager_calibration": [
    { "supervisor_id": "...", "supervisor_name": "Demo Reese Thomas",
      "n_reports": 3, "n_skill_pairs": 72,
      "tci": 47.2, "blind_spot_pct": 16.7, "underestimate_pct": 13.9 },
    // ... 9 more (only supervisors meeting n>=3 threshold)
  ]
}
```

Notes on the actual shape vs the original Session 41 spec:

- `status_distribution` returns RAW COUNTS, not percentages. Frontend computes percentages by dividing each by `pair_count`.
- Skill aggregates carry `modal_self_level` and `modal_manager_level` (categorical), not numeric averages.
- Both skill and domain aggregates carry `domain_name` directly (no need to join `dimensions` table on the frontend).
- `per_department_breakdown` keys are `departments.name` strings (with `(unassigned)` fallback for null department_id). When slice is `department=X`, the breakdown returns a single key matching that department.
- No top-level `calibration_map` array exists. The frontend reconstructs the calibration matrix from `skill_aggregates[N].per_department_breakdown` per skill.

### 10.7 Cadence

Match PTP/NAI exactly. Live RPC `get_airsa_aggregate(p_slice_type, p_slice_value)` computes aggregates from `assessment_results` on each dashboard load. No nightly cron, no pre-computed aggregate table. AI workforce narrative cached in `org_dashboard_narratives.narrative_text` and regenerated on user-triggered click via new Edge Function `generate-airsa-org-narrative` (**Class A JWT** via `auth.getClaims`, mirrors `generate-dashboard-narrative` v22). The Class B path documented in Session 41 was corrected after recon: dashboard-level AI generators are user-triggered from the frontend with full JWT context, matching PTP/NAI cadence. Model: `claude-opus-4-6`, `max_tokens` 7000.

### 10.8 Privacy thresholds

- Calibration Map cells, Skill Inventory rollups, Trends per-period: minimum 5 pairs
- Manager Calibration tab: minimum 3 reports per manager
- All suppressed cells render gray with "n<X" tooltip

### 10.9 Deferred to v2 (post-launch)

- Skill-level radar chart on 24 axes (unreadable; heatmap is better)
- Time-comparison overlays on Calibration Map (state management complexity; Trends tab handles longitudinal)
- Anonymous self-report mode (defer until customer asks)
- Predictive "if you close blind spots in Skill X, expected TCI gain is Y" (requires platform-wide outcome data; Wave 2/3 validation pathway)

### 10.10 Phase 5b frontend (SHIPPED Session 44)

Single new file: `src/pages/company/AirsaDashboard.tsx`. Modifications to `src/App.tsx` (route addition) and `src/components/AppSidebar.tsx` (Dashboards submenu third entry).

Route: `/company/airsa-dashboard`. RoleGuard `["company_admin", "org_admin", "brainwise_super_admin"]` — identical to NAI and PTP. Defense-in-depth: the route gate at the React layer, the Edge Function caller validation against the same role set in `generate-airsa-org-narrative`, and the SECURITY DEFINER RPC's caller validation inside `get_airsa_aggregate`.

**Locked AIRSA dashboard domain coloring** (frontend-only constants in `AirsaDashboard.tsx`):

- DIM-AIRSA-01 Cognitive & Learning Skills — Navy `#021F36`
- DIM-AIRSA-02 Social & Collaborative Skills — Teal `#006D77`
- DIM-AIRSA-03 Psychological Readiness — Purple `#3C096C`
- DIM-AIRSA-04 Strategic & Systems Thinking — Mustard `#7a5800`
- DIM-AIRSA-05 Execution & Practical Skills — Green `#2D6A4F`
- DIM-AIRSA-06 Proactivity & Personal Drive — Orange `#F5741A`
- DIM-AIRSA-07 Information & Resource Management — Gray `#6D6875`
- DIM-AIRSA-08 Ethical & Reflective Judgment — Deep plum `#5A1A4A`

The new `#5A1A4A` is dashboard-scoped (not part of the global brand palette). It avoids reusing PTP Purpose `#3C096C` in a context where AIRSA Psychological Readiness already takes Purple. PTP Purpose and AIRSA D8 will never appear on the same dashboard, but the visual proximity in the AIRSA Calibration Map's domain-band ordering required a distinct hue.

**Calibration Map implementation**: HTML CSS Grid (NOT SVG). 24 skill rows × N department columns. Cell rendering iterates `skill_aggregates[N].per_department_breakdown[deptName]`. Cells with `suppressed: true` render gray with "n<5" tooltip. Cells with `modal_status === 'blind_spot'` render with dashed border and transparent fill (preserving STATUS_COLORS canonical iconography). Hover popover via native `title` attribute. Priority markers ▲ (orange) for top 2 growth skills and ◆ (green) for top 2 strength skills, sourced from `aggregate.rankings.growth_skills.slice(0,2)` and `strength_skills.slice(0,2)`.

**Three latent bugs surfaced and fixed in AIRSA build, deferred for NAI/PTP**:

1. Team `<select>` populated from `departments.map` (sending `department_id` where RPC expects `supervisor_user_id`). Fixed in AIRSA via direct `users` table query under existing RLS.
2. Slice control dropdowns lacked clearable first option; placeholder "Department ▾" / "Level ▾" / "Team ▾" disappeared after selection. Fixed in AIRSA by changing first-option labels to "All departments" / "All levels" / "All teams".
3. cps_growth (0-2 composite) and cps_strength (%) panels displayed without unit context. Fixed in AIRSA via italic subtitle line under each panel header.

NAI and PTP still carry bugs 1 and 2; deferred for post-launch fix to avoid regression risk on dashboards already in production use.

**Known UX issue carried to Session 45**: HIGH risk-flag rendering uses Tailwind red (`#dc2626` / `#fee2e2` / `#991b1b`) instead of brand orange variants per §6.1. Fix is a three-edit patch in the risk flag render block.

## 11. AIRSA test fixture seed (Session 42)

A production-realistic AIRSA test fixture lives on the BrainWise Test Corp organization. Seeded in Session 42 to enable end-to-end validation of the Phase 5a RPC + Edge Function and the Phase 5b dashboard UI before any real customer data exists.

### 11.1 Org structure

BrainWise Test Corp now has 4 departments and 50 corporate employees:

- **Executive**: 5 (5 C-Suite users moved here in Session 42)
- **Engineering**: 18
- **Finance**: 14
- **Marketing**: 13

Supervisor chain: 17 distinct supervisors, with 10+ clearing the Manager Calibration min-3-reports threshold. `users.supervisor_user_id` populated for all corporate_employee rows that have a supervisor.

**Session 44 fixture drift observed**: live counts are Engineering 19 users (18 with AIRSA), Marketing 16 users (15 with AIRSA), Finance unchanged at 14. Executive still has 5 users with 0 AIRSA pairs. The 47 AIRSA pair total is unchanged from Session 42 close. Calibration Map renders 3 columns (Engineering, Finance, Marketing) on the test fixture as of Session 44; Executive will appear automatically once seeded with AIRSA pairs.

### 11.2 AIRSA pairs

**47 self+manager assessment pairs** in production (Maya = pair #47 from prior fixture work; 46 pairs new in Session 42).

- 94 `assessments` rows total: 47 self + 47 manager, all `instrument_id = 'INST-003'`, all `status = 'completed'`
- **2,208 `assessment_responses`**: 46 new pairs × 24 items × 2 raters
- **46 `assessment_results`** rows with full JSONB derived server-side from responses (no AI calls used during seed):
  - `dimension_scores` (self per-domain readiness)
  - `manager_dimension_scores` (manager per-domain readiness)
  - `self_manager_divergence` (per-domain with `status` field)
  - `skill_level_breakdown` (24 entries per row, per the §2.3 schema)

The Maya fixture's six `facet_interpretations` rows (AI section content) are unchanged from Session 39 close. The 46 new pairs do NOT have AI section content; they exist for org-level aggregate validation, not individual-report rendering.

### 11.3 Org-level distribution (verified)

Across all 47 AIRSA pairs:

- Org-wide TCI = **40.1**
- aligned: 24.5%
- underestimate: 20.7%
- blind_spot: 20.3%
- confirmed_gap: 19.0%
- confirmed_strength: 15.6%

This distribution gives the Phase 5b dashboard a realistic demo: enough alignment to show a working organization, enough divergence in both directions to populate the Calibration Map, and enough confirmed gaps to surface workforce-risk callouts.

### 11.4 Seed mechanics (for reference)

The seed script lived in `/home/claude/internal-docs/` during Session 42 and is not committed. The relevant facts for future sessions:

- All scoring derived server-side. The seed inserts `assessment_responses`, then runs `calculate-scores` Branch A logic (or its SQL equivalent) to produce `assessment_results`. No AI Edge Functions called.
- AIRSA scale labels confirmed during seed: **`0=Never, 1=Rarely, 2=Often, 3=Consistently`** (NOT "Always"). Items table values verified.
- Self/manager rater assignments use the **lowercase `'self'`/`'manager'`** convention (per §2.4 schema warning) on the `assessments` table.
- `paired_assessment_id` reciprocal linkage populated for all 47 pairs.

If the seed needs to be regenerated or extended, mirror the structure: 50 employees, 4 departments, supervisor chain with 17 distinct supervisors, 47+ AIRSA pairs with computed JSONB aggregates.

### 11.5 What the fixture does NOT cover

- AI section content for the 46 new pairs (only Maya has facet_interpretations rows). The Phase 5a `generate-airsa-org-narrative` Edge Function will be tested against the Maya pair plus the org-wide aggregate.
- PTP or NAI cross-instrument pairings for the 46 new users. The cross-instrument tab on the AIRSA org dashboard will render limited data on the test org until additional fixtures are seeded for those instruments.
- Trend data over time. All 47 pairs share a single timestamp window. The Trends tab on the dashboard will show a single point until time-spread fixtures are added.

## 12. Coach certification gating (Session 46 — Group C Phase 8 absorbed)

Live state of the `coach_certifications` table diverges from the Group C scope doc as authored. Recon at session open verified actual schema constraints, then locked the gating rules forward-compatible with future Group C Phase 1 (Q9 revocation enum extension).

### 12.1 Live CHECK constraints

`coach_certifications.certification_type`: four allowed values, not three.

| Value | Maps to instruments |
|-------|---------------------|
| `ptp_coach` | PTP |
| `ai_transformation_coach` | NAI, AIRSA, HSS |
| `ai_transformation_ptp_coach` | PTP, NAI, AIRSA, HSS (Combined) |
| `my_brainwise_coach` | PTP, NAI, AIRSA, HSS |

`coach_certifications.status`: three allowed values: `in_progress`, `certified`, `suspended`. The Group C scope doc anticipates a future revocation extension via Q9; the gating logic shipped in Session 46 is forward-compatible with that extension because the rule reads "only `certified` allows," not "anything-not-revoked."

### 12.2 Gating rule (locked)

In `src/pages/coach/CoachClients.tsx`, the Order Assessment dialog instrument-list filters by the union of the active coach's `certified` rows mapped through `CERT_TYPE_TO_INSTRUMENTS`. Both entry-point buttons ("Order Assessment for New Client" and "Order Assessment for This Client") feed the same `<Dialog>` instance — gating is applied once at the dialog's render block.

Shipped behavior:
- Coach with zero `certified` rows: both buttons disabled, tooltip "You need an active certification to order assessments," empty-state message inside dialog with link to `/certifications`.
- Coach with one or more `certified` rows: dialog shows checkboxes only for instruments in the union of allowed sets. Submission logic and Stripe metadata unchanged.
- `in_progress` and `suspended` rows do not contribute to the allowed set.

### 12.3 `auto_grant_combined_certification` trigger behavior

Trigger is `AFTER UPDATE` only on `public.coach_certifications`, not `AFTER INSERT`. Direct seeding of `certified` rows via INSERT does NOT fire the trigger. The trigger only auto-grants Combined when an existing in_progress row transitions to certified via UPDATE AND the user has both `ptp_coach` and `ai_transformation_coach` rows certified AND no Combined row exists.

This matters for future test seeding and for any path where Combined cert is granted programmatically: if the path uses INSERT directly to a certified state, no auto-grant fires; if it uses UPDATE through certification, auto-grant fires.

## 13. Shared Results supervisor toggle (Session 46)

Single toggle pill on the existing `/shared-results` page filters the peer list to the viewer's own direct reports. Replaces the previously-considered "My Team tab" idea (never written into the build queue).

### 13.1 Backend

No new RPC. Reuses the existing `get_my_direct_reports()` SECURITY DEFINER function which returns the caller's direct reports as `out_user_id, out_email, out_full_name, out_org_level, out_department_id, out_department_name`. Function filters by `users.supervisor_user_id = auth.uid() AND deactivated_at IS NULL`, ordered by `full_name NULLS LAST, email`.

### 13.2 Frontend

In `src/pages/SharedResults.tsx`:
- New state: `directReportIds: Set<string>`, `myReportsOnly: boolean` (default false).
- New `useEffect` calls `get_my_direct_reports()` on `[user]` change, populates `directReportIds` from `out_user_id` field.
- Toggle pill rendered conditionally on `directReportIds.size > 0` between the existing department dropdown and the existing supervisor dropdown.
- `myReportsOnly` resets to false on instrument change (joins existing reset block at the top of the peer-fetch effect).
- `filteredPeers` memo gains clause: `if (myReportsOnly && !directReportIds.has(p.user_id)) return false;`
- All four filters (name search, department, existing supervisor dropdown, new toggle) compose with AND semantics.

### 13.3 Existing supervisor dropdown unchanged

The existing `supervisorFilter` dropdown at `SharedResults.tsx` lines 173-185 (filters peers by their `supervisor_user_id` matching some other peer's user_id) is left intact in Session 46. It does something different from the new toggle: it lets the viewer scope to "people who report to person X" rather than "people who report to me."

Latent bug noted but not fixed in Session 46: the `supervisors` array is built only from peers whose `user_id` appears as another peer's `supervisor_user_id` AND who are themselves in the peer list. Many supervisors silently won't appear in the dropdown if they haven't shared their own results. Carried as a deferred quality item.

## 14. Group D — Coach Bulk Invite + Shareable Link (Sessions 47 + 48)

Group D extends the existing single-client invitation flow with two new entry points: bulk invite (table or CSV) and individual shareable link generation. Backend (Phases 1-3) shipped Session 47. Frontend (Phases 4-6 + polish) shipped Session 48. Auto-refund extension (Phase 6 polish addition) shipped Session 48.

### 14.1 Schema additions to `coach_clients`

| Column | Purpose |
|---|---|
| `expires_at timestamptz` | 30 days from creation for shareable_link and bulk source rows. NULL for legacy single-source invitations (pre-Group-D). Sweep job marks rows revoked when expires_at passes. |
| `revoked_at timestamptz` | Stamped when row is revoked (manual via coach_invitation_revoke OR automatic via sweep_expired_invitations). |
| `invitation_source text` | Values: 'single', 'bulk', 'shareable_link'. |
| `client_first_name text` | Optional first name captured at invitation time. |
| `client_last_name text` | Optional last name captured at invitation time. |
| `refunded_at timestamptz` | Stamped when auto-refund processed. NULL = not refunded. |
| `stripe_refund_id text` | Stripe refund object ID for audit trail. Format: `re_xxx`. |
| `refund_amount numeric(10,2)` | Dollar amount refunded for this row (per-row share of original payment). |
| `refund_failure_reason text` | If Stripe rejected refund (e.g., charge too old), reason logged here. |

### 14.2 New table `coach_pending_bulk_batches`

Holds metadata for in-flight Stripe checkout sessions for coach-paid bulk invites. Webhook iterates over the batch on `checkout.session.completed` and inserts coach_clients rows + generates per-row coupons. Self-pay rows do NOT use this table (they're inserted directly during dispatch).

### 14.3 RPCs

- `bulk_coach_invitation_create(rows jsonb)` — Per-row BEGIN/EXCEPTION isolation, 75-row cap, certification gating reuse from Item 37 mapping. Returns per-row outcomes. Called by `bulk_coach_invite` Edge Function for self-pay rows. Coach-paid rows are NOT created here; they wait for stripe-webhook.
- `coach_invitation_revoke(p_coach_client_id uuid)` — Validates ownership via `auth.uid()`, stamps `revoked_at`. Returns `out_*` columns for the calling Edge Function to use in coupon recalc + refund logic.

### 14.4 Edge Functions

| Function | Version | Purpose |
|---|---|---|
| `bulk_coach_invite` | v2 | Wraps `bulk_coach_invitation_create` RPC + email dispatch in parallel batches of 10. 75-row cap. Self-pay path inserts rows immediately; coach-paid path returns Stripe checkout session URL. |
| `coach_invitation_revoke` | v3 | Class A JWT auth. Calls revoke RPC, then `recalcCouponAfterRevoke` (deletes Stripe coupon if last row, else recreates at lower amount), then `processAutoRefund` (per refund policy gate). Trigger metadata: `manual_revoke`. |
| `sweep_expired_invitations` | v3 | Class C cron auth via `DISPATCHER_SHARED_SECRET`. Loops over expired-but-not-revoked rows, stamps revoked_at, recalcs coupon, processes auto-refund. Trigger metadata: `auto_expiry_sweep`. Schedule `45 3 * * *`. |
| `coach_invitation_resend` | v1 | Class A JWT auth. Per-client scope: lists ALL pending instruments for that coach + client_email. 24-hour rate limit per recipient_email + email_type='coach_reminder_pending' enforced via email_logs query. shareable_link rows treated as first-send template. |
| `create-checkout` | v47 | Extended with `coach_bulk_order` mode. Lovable-fragile per standing rule — `coach_user_id` regularly dropped from Stripe metadata. Verify after every Lovable prompt touching checkout-adjacent code. |
| `stripe-webhook` | v23 | New `coach_bulk_order` branch iterates over pending batch metadata, generates per-row coupons via `recalculateCombinedCouponForEmail`, creates coach_clients rows, dispatches emails in parallel batches of 10. |

### 14.5 Refund policy (locked Session 48)

**Auto-refund eligibility gate (ALL must be true):**
- `coupon_redeemed = false`
- `assessment_id IS NULL`
- `payment_age <= 90 days` (computed from row created_at)
- `payment_intent_id IS NOT NULL`
- `coupon_amount > 0`

**Triggers:**
- Manual revoke via `coach_invitation_revoke` Edge Function (`processAutoRefund` called after coupon recalc)
- Automatic expiry via `sweep_expired_invitations` Edge Function (`processAutoRefund` called per swept row)

**Both paths use the same `processAutoRefund` helper.** Logic is duplicated verbatim between the two Edge Functions (build queue item exists to extract to shared module). Trigger metadata differentiates: `manual_revoke` vs `auto_expiry_sweep`.

**Refunded amount = `coach_clients.coupon_amount`** (per-row share of original payment, not full payment_intent amount). Calls `stripe.refunds.create({ payment_intent, amount: rowAmount * 100, reason: 'requested_by_customer', metadata: { coach_client_id, trigger } })`.

**On Stripe rejection** (e.g., charge already refunded, charge too old): row stamped with `refund_failure_reason`, helper returns `{refunded: false, reason: 'stripe_error: ...'}`. Doesn't fail the surrounding revoke or sweep — those succeed regardless.

### 14.6 Frontend surfaces

In `src/pages/coach/CoachClients.tsx`:
- DropdownMenu on header with three options: Single client / Bulk invite / Generate shareable link
- `perAssessmentPrice` state querying `subscription_plans` for dynamic price (not hardcoded)
- URL parameter handler for `?bulk_checkout=success|cancelled`
- Tabs structure: Clients tab (default) + Pending Invitations tab
- Stat cards: Total Clients (signed-up), Pending Invitations, Completed This Month, Assessments Pending
- Tooltip primitive replaces `title` attribute on disabled DropdownMenu trigger (Radix asChild swallowed it)

In `src/components/coach/BulkInviteModal.tsx` (607 lines):
- Three-stage flow: Validate (table editor + CSV upload) / Preview (per-row outcome) / Dispatch+Results
- xlsx@^0.18.5 dependency for CSV parsing
- 75-row cap, sticky defaults, payment_mode self_pay/coach_paid lowercase
- Cert gating reuses `allowedInstrumentIds` from `CoachClients.tsx`

In `src/components/coach/ShareableLinkModal.tsx` (287 lines):
- qrcode.react@^4.0.1 dependency (`QRCodeSVG` component)
- Both self-pay and coach-paid paths
- 30-day expiry displayed

In `src/components/coach/PendingInvitations.tsx` (295 lines):
- Tab-based, replaces card-based design from initial Phase 5 ship
- Per-row Copy link / Revoke (with confirmation dialog) / Resend (24h rate-limited via Edge Function) actions
- Date formatting MMM d (no year) for tightness
- Payment badges Coach / Self
- Source badges Bulk / Single / Link

## 15. Email infrastructure (Session 48 — Option A + Option B)

### 15.1 `email_logs` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email_type` | text NOT NULL | Categorical (`coach_invitation_self_pay`, `coach_reminder_pending`, `auth_or_external`, etc) |
| `recipient_email` | text NOT NULL | |
| `subject` | text NOT NULL | |
| `resend_message_id` | text | Resend's message ID, used for webhook correlation |
| `send_status` | text NOT NULL | `sent` or `failed` |
| `error_message` | text | Populated when send_status='failed' |
| `source` | text | Where in the codebase the send originated (e.g., `CoachClients.handleRemind`, `coach_invitation_resend`) |
| `sent_at` | timestamptz NOT NULL | |
| `delivered_at` | timestamptz | Populated by webhook when Resend delivers |
| `bounced_at` | timestamptz | Populated by webhook on bounce |
| `complained_at` | timestamptz | Populated by webhook on spam complaint |
| `last_status_event` | text | Most recent webhook event type |
| `last_status_at` | timestamptz | Timestamp of last_status_event |

**RLS:** super_admin SELECT only via account_type check. Service role bypasses RLS for writes from Edge Functions.

**Indexes:**
- `recipient_sent_at`: `(recipient_email, sent_at DESC)`
- `resend_message_id_partial`: `(resend_message_id)` WHERE `resend_message_id IS NOT NULL`
- `failures_partial`: `(sent_at DESC)` WHERE `send_status = 'failed'`
- `problem_events_partial`: `(last_status_at DESC)` WHERE `last_status_event IN ('bounced', 'complained')`

**Retention:** pg_cron `purge_email_logs_90d` schedule `0 3 * * *` (03:00 UTC daily) executes `DELETE FROM email_logs WHERE sent_at < NOW() - INTERVAL '90 days'`.

### 15.2 `send-email` Edge Function v8

Internal-secret authenticated via `X-Internal-Secret` header (`INTERNAL_FUNCTION_SECRET` env). Logs every send to `email_logs` via `logEmailDispatch` helper that runs unconditionally on every code path (success and failure both write a row). Accepts optional `email_type` (default `unknown`) and `source` (default the calling Edge Function name).

**Standing convention:** Edge Functions calling send-email should always pass both `email_type` and `source`. Build queue item: backfill these on functions that don't yet (stripe-webhook, bulk_coach_invite, invite-coach, send-departure-emails, generate-departure-export).

### 15.3 Resend webhook integration (`resend-webhook` v1)

**Endpoint:** `https://svprhtzawnbzmumxnhsq.supabase.co/functions/v1/resend-webhook`

**Auth:** Svix-format signature verification (HMAC-SHA256 with `whsec_` prefix stripped from `RESEND_WEBHOOK_SECRET` env). 5-minute timestamp freshness window prevents replay attacks. `verify_jwt: false` because Resend doesn't send Supabase JWT.

**Subscribed events (configured in Resend dashboard):**
- email.sent
- email.delivered
- email.bounced
- email.complained
- email.delivery_delayed

**Logic:**
- Verify Svix signature, reject 401 on failure
- Parse payload, look up email_logs row by `resend_message_id`
- If found: update with delivery status (delivered_at / bounced_at / complained_at depending on event type, plus last_status_event / last_status_at)
- If not found (Auth-system email or external): insert new row with `email_type='auth_or_external'`, `source='resend-webhook'`

**Verified end-to-end Session 48:** send-email → Resend → webhook fires ~1s later → email_logs row updated with delivered_at. Full lifecycle in single row.

### 15.4 Notes for future Edge Function authors

- All transactional emails should route through `send-email` (not direct Resend API) so email_logs captures them.
- Pass `email_type` and `source` parameters on every call.
- For new email categories, register the `email_type` value here in the arch ref to maintain a canonical list.
- Auth emails (Supabase Auth → Resend SMTP) bypass send-email by design. The webhook captures them with `email_type='auth_or_external'` for audit completeness.

## 16. pg_cron jobs (current state)

| Job | Schedule | Purpose | Auth |
|---|---|---|---|
| `sync-stripe-prices-daily` | `0 2 * * *` | Pulls Stripe prices into `subscription_plans` table | Class C (vault `departure_dispatcher_shared_secret`) |
| `purge_email_logs_90d` | `0 3 * * *` | Deletes email_logs rows older than 90 days | Inline SQL (no auth needed, runs as superuser) |
| `dispatch_grace_reminders_daily` | `15 3 * * *` | Dispatches Email 4 grace reminders to deactivated corporate users | Class C (vault `departure_dispatcher_shared_secret`) |
| `sweep_expired_coach_invitations` | `45 3 * * *` | Sweeps Group D expired invitations + voids coupons + processes auto-refunds | Class C (vault `departure_dispatcher_shared_secret`) |

**Staggering rationale:** All overnight jobs offset by 15-30 minutes to avoid concurrent cron load.

**Class C cron auth pattern:** pg_cron job calls `net.http_post` with header `X-Dispatcher-Secret` populated from `vault.decrypted_secrets`. Edge Function reads `DISPATCHER_SHARED_SECRET` env var and constant-time compares against the header value via `safeEqual`. Reject 401 on mismatch.

## 17. Auto-refund automation (Session 48)

Both manual revoke and automatic sweep use the same `processAutoRefund` helper (currently duplicated verbatim between `coach_invitation_revoke` and `sweep_expired_invitations`).

### 17.1 Eligibility gate

```
auto_refund_eligible = (
  row.coupon_redeemed = false
  AND row.assessment_id IS NULL
  AND row.stripe_payment_intent_id IS NOT NULL
  AND row.coupon_amount > 0
  AND age_days(row.created_at) <= 90
)
```

If any condition fails → `{refunded: false, reason: <specific>}` with no Stripe call. Reasons: `coupon_already_redeemed`, `assessment_started`, `not_coach_paid`, `no_refund_amount`, `outside_90_day_window`.

### 17.2 Refund execution

```typescript
const refund = await stripe.refunds.create({
  payment_intent: row.stripe_payment_intent_id,
  amount: Math.round(row.coupon_amount * 100), // per-row share, not full charge
  reason: "requested_by_customer",
  metadata: {
    coach_client_id: row.id,
    trigger: "manual_revoke" | "auto_expiry_sweep",
  },
});
```

On success: stamps `refunded_at`, `stripe_refund_id`, `refund_amount` on the coach_clients row.

On Stripe failure: stamps `refund_failure_reason` (truncated to 500 chars), helper returns `{refunded: false, reason: 'stripe_error: <msg>'}`. Surrounding revoke/sweep proceeds.

### 17.3 Individual purchase refund tracking (no automation)

`assessment_purchases` extended with `refunded_at`, `stripe_refund_id`, `refund_amount`, `refund_failure_reason`, `refund_processed_by` (UUID FK users — audits which super_admin approved the refund). Manual processing only — no auto-refund Edge Function.

Build queue: super-admin UI surface to view a user's purchases + eligibility status + "Process refund" button gating on Tier 2 audit. Depends on Group A audit prequel being complete.

### 17.4 Refund policy text (locked Session 48, in Terms of Service v2)

Per `src/content/legal/termsContent.ts` Section 5.5:

- **Individual purchases:** 14-day refund window if assessment not started AND no AI interpretation generated AND feature not substantively used.
- **Coach-paid client assessments:** auto-refund per Section 5.3 (the policy described in 14.5 above).
- **Corporate contracts:** all sales final per executed contract.

## 18. `coach_invitation_resend` Edge Function (Session 48)

Per-client scope reminder dispatch with rate limiting via email_logs query.

**Auth:** Class A JWT via `auth.getClaims`. Caller must own the `coach_clients` row referenced by `p_coach_client_id`.

**Logic:**
1. Look up the row, verify ownership (`row.coach_user_id = caller.uid`)
2. Rate limit check: query `email_logs` for any row with `recipient_email = row.client_email AND email_type = 'coach_reminder_pending' AND sent_at > NOW() - INTERVAL '24 hours'`. If found → 429 `rate_limited`.
3. Find ALL pending rows for `(coach_user_id, client_email)` pair: `revoked_at IS NULL AND assessment_id IS NULL AND invitation_status IN ('sent', 'opened') AND (expires_at IS NULL OR expires_at > NOW())`
4. If no rows match → 400 `nothing_to_remind`
5. Look up instrument names, build email (reminder template OR first-send template if shareable_link)
6. Dispatch via `send-email` with `email_type='coach_reminder_pending'`, `source='coach_invitation_resend'`
7. Return `{success: true, instruments_count, instruments: [...]}` or error code

**Templates:**
- Reminder ("Reminder: Your BrainWise Assessment is Waiting") for non-shareable_link sources
- First-send ("Your coach prepared an assessment for you") for shareable_link sources where the original invitation never sent an email

**Frontend surfaces** in `PendingInvitations.tsx`: Resend button with toast variants per response (`success` → "Reminder sent", `rate_limited` → "Reminder already sent recently", `nothing_to_remind` → "Nothing to remind", `unauthorized` → "Unauthorized", other → generic error).

## 19. `super_admin_action_types` lookup table (Session 49)

Replaces the prior CHECK constraint on `super_admin_audit_log.action_type` with a foreign key to `public.super_admin_action_types`. SOC 2 CC6.1 evidence: this table enumerates every privileged super-admin action the platform supports.

### 19.1 Schema

```sql
CREATE TABLE public.super_admin_action_types (
  action_type            text PRIMARY KEY,
  category               text NOT NULL,        -- enumerated CHECK
  description            text NOT NULL,
  tier                   text,                  -- 'tier1','tier2','tier3','tier4' or NULL
  requires_mfa           boolean NOT NULL DEFAULT false,
  requires_justification boolean NOT NULL DEFAULT false,
  is_mutation            boolean NOT NULL DEFAULT true,
  denylist_during_impersonation boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now()
);
```

Categories (CHECK-constrained): `impersonation`, `org_management`, `user_management`, `admin_role_management`, `contract_management`, `content_authoring`, `platform_observability`, `usage_management`, `mfa_management`, `audit_reporting`.

### 19.2 Seeded action types (19 total)

15 carried over from prior CHECK list (company_account_viewed, individual_record_viewed, version_created, version_deprecated, prompt_updated, aggregate_export_generated, platform_health_viewed, organization_created, corporate_contract_created, org_admin_assigned, org_admin_transferred, corporate_invitation_created, contract_upsert, ai_counter_reset, mfa_factor_reset).

Plus 4 new for A1 impersonation: `impersonation_started`, `impersonation_ended`, `impersonation_action`, `impersonation_denied_action`.

### 19.3 Adding new action types

Group C and Group A A2 will add ~30+ more action types over Sessions 50-65. Convention: each feature-introducing migration that adds a privileged action MUST insert into this lookup table in the same migration. Pattern:

```sql
INSERT INTO public.super_admin_action_types (action_type, category, description, ...)
VALUES ('coach_certification_revoked', 'admin_role_management', '...', ...)
ON CONFLICT (action_type) DO NOTHING;
```

### 19.4 RLS

`super_admin_action_types: super admin can read` (SELECT for `current_user_account_type() = 'brainwise_super_admin'`).
`super_admin_action_types: service_role full access` (ALL with USING true, WITH CHECK true).

## 20. Audit log infrastructure additions (Session 49)

### 20.1 `super_admin_audit_log` new columns

```sql
ALTER TABLE public.super_admin_audit_log
  ADD COLUMN ip_address inet,
  ADD COLUMN user_agent text,
  ADD COLUMN reason text,
  ADD COLUMN before_value jsonb,
  ADD COLUMN after_value jsonb,
  ADD COLUMN mode text,
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN ended_at timestamptz,
  ADD COLUMN end_reason text;
```

`ip_address`/`user_agent` populated by calling Edge Functions. `reason` required for impersonation start and Tier 2/3 edits. `before_value`/`after_value` are best-effort jsonb snapshots. `mode` carries the raw mode string or, for impersonation events, prefixed format `impersonation:<observe|act>:<sub_action>`. `expires_at`/`ended_at`/`end_reason` populated only for impersonation_started rows (other action_types leave them NULL).

Indexes added: `idx_super_admin_audit_log_mode` (partial WHERE mode IS NOT NULL), `idx_super_admin_audit_log_session_id`.

### 20.2 `company_admin_audit_log` new columns

```sql
ALTER TABLE public.company_admin_audit_log
  ADD COLUMN reason text,
  ADD COLUMN before_value jsonb,
  ADD COLUMN after_value jsonb,
  ADD COLUMN super_admin_acting_as_user_id uuid REFERENCES users(id);
```

`super_admin_acting_as_user_id` is the dual-attribution column — when a super admin performs a company-admin-tier action via impersonation, this captures the super admin actor while `actor_user_id` still holds the impersonated user (org admins see the override in their normal audit feed).

### 20.3 `log_super_admin_action()` helper RPC

Standardized write path for `super_admin_audit_log`. Used by Group A A2 direct user editing, Group C revocation/direct-enrollment/mentor-assignment RPCs, and the impersonation-start/end Edge Functions.

**Signature:** `(p_target_user_id uuid, p_target_org_id uuid, p_action_type text, p_before jsonb, p_after jsonb, p_reason text, p_mode text) RETURNS uuid`.

**Actor derivation (Path 3 from Session 49 design):**
1. Reads `current_setting('request.jwt.claims', true)::jsonb`
2. If `imp_actor_user_id` claim present → that's the actor (impersonation context)
3. Otherwise `auth.uid()` is the actor (direct super admin context)

**Session ID derivation:**
1. If `imp_session_id` claim present → use that (so audit_session_replay can group all events)
2. Otherwise `gen_random_uuid()` per-action

**Mode derivation:**
1. If `imp_mode` claim present → prefix with `impersonation:<imp_mode>:`
2. Otherwise pass through `p_mode`

**Trust boundary:** caller is responsible for `assert_super_admin()` gating. The helper does NOT self-gate because in dual-attribution mode `auth.uid()` is the impersonated user (would fail self-gate). SECURITY DEFINER, owned by postgres.

Returns the inserted row's UUID for callers that need to update `ended_at`/`end_reason` later (e.g., impersonation-end).

## 21. A1 impersonation Tier 1 backend (Session 49)

Per Group A scope section 2 (Feature A1 — User impersonation). All design decisions traceable to scope sections 2.2.1-2.2.11.

### 21.1 `impersonation_sessions` table

Server-side tracking for active and historical impersonation sessions.

```sql
CREATE TABLE public.impersonation_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_user_id   uuid NOT NULL REFERENCES users(id),
  target_user_id        uuid NOT NULL REFERENCES users(id),
  mode                  text NOT NULL CHECK IN ('observe','act'),
  justification         text NOT NULL CHECK (length >= 10),
  started_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL CHECK > started_at,
  ended_at              timestamptz,
  end_reason            text CHECK IN ('manual','timeout','forced'),
  ip_address            inet,
  user_agent            text,
  audit_log_id          uuid REFERENCES super_admin_audit_log(id),
  CONSTRAINT no_self_impersonation CHECK (super_admin_user_id <> target_user_id)
);
```

**Unique active session per super admin:** `CREATE UNIQUE INDEX impersonation_sessions_one_active_per_super_admin ON impersonation_sessions (super_admin_user_id) WHERE ended_at IS NULL` — backstops nested impersonation prevention at the DB level (scope 2.2.11).

**Immutability:** trigger `trg_impersonation_sessions_immutable` blocks DELETE entirely and blocks UPDATE on any column except `ended_at` and `end_reason`. Sessions cannot be modified once ended.

**RLS:**
- `impersonation_sessions: super admin can read all` (SELECT for super_admin)
- `impersonation_sessions: target user can read own history` (SELECT WHERE target_user_id = auth.uid()) — powers the access-history page (scope 2.4.2 / 4.4.4)
- `impersonation_sessions: service_role full access`

### 21.2 `validate_impersonation_session(p_session_id uuid)` RPC

Read-only check returning `{is_valid, reason, super_admin_user_id, target_user_id, mode, expires_at, ended_at}`. Called by `assert_impersonation_allows` for layer 1 enforcement and by Edge Functions for kill-switch checks. Reasons returned: `valid`, `session_not_found`, `session_ended`, `session_expired`. SECURITY DEFINER STABLE.

### 21.3 `assert_impersonation_allows(p_action_category text)` RPC

Layer 1 denylist enforcement. Returns `{status, imp_session_id, imp_actor_user_id, imp_target_user_id, imp_mode}` with status one of:
- `no_impersonation` — no `imp_session_id` claim, caller proceeds normally
- `act_allowed` — active act-mode session, caller must write `impersonation_action` audit row

Raises `42501` (Permission denied) when:
- Session is invalid (validation failed)
- Mode is `observe` (all mutations blocked)
- Mode is `act` AND category is on denylist

**Denylist categories (9 total, mapped to scope 2.3.1-2.3.9):**
- `identity_change` (2.3.1) — password/email/MFA/account deletion/ToS/consent
- `assessment_submission` (2.3.2) — 168 items, EPN, demographics, peer access response
- `privacy_consent` (2.3.3) — sharing prefs, demographic consent withdraw, share-with-coach toggle, peer access initiate
- `financial_transaction` (2.3.4) — Stripe purchase, subscription cancel, payment update, coupon apply
- `outbound_user_communication` (2.3.5) — AI chat send, peer access initiate
- `permission_change` (2.3.6) — account_type modify, org membership, nested impersonation
- `corporate_admin_action` (2.3.7) — bulk deactivation, supervisor assignment, admin promote/revoke, narratives, invitations
- `coach_action` (2.3.8) — invite client, order assessment, certification module mark-complete
- `lifecycle_action` (2.3.9) — corporate-to-individual conversion, pseudonymization

Mode read from DB row (not JWT) as defense in depth against tampered JWT claims.

Helper view `impersonation_denylist_categories()` returns the denylist categories with their scope-section mapping for documentation/reporting.

### 21.4 `custom_access_token_hook(event jsonb)` Postgres function

Auth Hook registered in Dashboard → Authentication → Hooks. Fires on every JWT issuance platform-wide. Reads `impersonation_sessions` for the user_id being authenticated; if active session exists AND `authentication_method` is `magiclink` or `token_refresh`, injects `imp_session_id`, `imp_actor_user_id`, `imp_mode`, `imp_expires_at` claims.

**Auth method gate:** the `magiclink` / `token_refresh` filter prevents the target user's normal logins (password, oauth, otp) from accidentally inheriting impersonation context if they happen to log in during an active session.

**Failure isolation:** entire body wrapped in `EXCEPTION WHEN OTHERS THEN RAISE WARNING ...; RETURN event; END` to ensure hook errors NEVER break platform auth. Hook errors logged via `RAISE WARNING` for monitoring.

`GRANT EXECUTE ... TO supabase_auth_admin` (the auth system role); `REVOKE EXECUTE ... FROM public, authenticated, anon`.

### 21.5 `check_mfa_freshness(p_session_id uuid, p_max_age_seconds integer)` RPC

Service-role-only RPC that reads `auth.mfa_amr_claims` for a session and verifies a TOTP verification has happened within the last `p_max_age_seconds`. Returns `boolean`. Used by `impersonation-start` to enforce fresh MFA gate (scope 2.2.7).

### 21.6 `impersonation-start` Edge Function

**Auth:** Class A (verify_jwt=false, explicit auth.getClaims).

**Gates (in order):**
1. Authenticated request
2. Caller is brainwise_super_admin (assert_super_admin RPC)
3. Caller has fresh MFA (check_mfa_freshness, 5-min window)
4. Target user exists
5. Target user is not the caller (no self-impersonation)
6. Caller has no other active session (DB UNIQUE constraint backstops)
7. Mode is observe or act
8. Justification length >= 10 chars

**Flow:**
1. Insert impersonation_sessions row (30-min expiry from now)
2. log_super_admin_action with action_type='impersonation_started'
3. Update sessions row with audit_log_id (link for access-history UI)
4. auth.admin.generateLink({ type: 'magiclink', email: target_email })
5. verifyOtp with hashed_token → real session as target user; hook fires and injects imp_* claims
6. Return { imp_session_id, access_token, refresh_token, expires_at, mode, target_user }

**Rollback:** if any post-insert step fails (audit, generateLink, verifyOtp), update sessions row with ended_at = now(), end_reason = 'forced'.

### 21.7 `impersonation-end` Edge Function

**Auth:** Class A using the impersonation JWT (caller is inside the session being ended).

**Validation:** JWT must carry `imp_session_id` AND `imp_actor_user_id`. Sanity checks ensure JWT claims match the DB row's super_admin_user_id and target_user_id (defense in depth against tampered JWT).

**Flow:** Update impersonation_sessions row with ended_at = now(), end_reason = 'manual'. Write log_super_admin_action with action_type='impersonation_ended'. Returns { imp_session_id, ended_at, duration_seconds }.

### 21.8 `sweep_expired_impersonation_sessions` Edge Function

**Auth:** Class C (cron-secret via X-Dispatcher-Secret header from `vault.decrypted_secrets WHERE name = 'departure_dispatcher_shared_secret'`).

**Flow:** Find sessions where `ended_at IS NULL AND expires_at < now()`. End each with end_reason='timeout', ended_at = the original expires_at (not now — for accurate timeline). Direct INSERT into super_admin_audit_log (cron-context exception since log_super_admin_action requires auth.uid() which is null in cron context). Returns summary stats { sessions_ended, audit_rows_written, audit_rows_failed }.

**Cron schedule:** `*/5 * * * *` (every 5 minutes). Worst-case post-expiry session lingering = 5 minutes. Frontend client-side timeout enforces user-visible countdown; this cron is the server-side backstop.

### 21.9 SOC 2 control summary (CC6.1, CC6.6)

- Privileged sessions time-bounded (30-min fixed)
- Server-side session row + signed JWT — both must be valid for actions to proceed
- Impersonation actions logged with actor (real super admin via JWT claim), target, IP, UA, justification, mode
- Justification required at session start (10-char minimum, scope 2.2.6)
- Fresh MFA gate at session start (scope 2.2.7, 5-min freshness)
- Dual attribution captured automatically by log_super_admin_action via JWT claims
- Audit log append-only (UPDATE/DELETE blocked at DB level via trg_immutable_audit_log)
- Self-impersonation blocked (DB CHECK + Edge Function gate)
- Nested impersonation blocked (DB UNIQUE INDEX + Edge Function gate)
- Quarterly review runbook deferred (scope 2.4.3 / 4.4.5, due 90 days post-launch)

### 21.10 Tier 2 deferred to Session 50

The denylist enforcement rollout across the 27 Edge Functions identified in Session 49 recon is Tier 2 work. Helper module `_shared/impersonation_gate.ts` deployed and verified Session 49. Per-function splices in Session 50.

## 22. `_shared/impersonation_gate.ts` Edge Function helper (Session 49)

Canonical denylist enforcement helper for Tier 2 Edge Function rollout. Shared module bundled with each function deploy via the `files` array in deploy_edge_function.

### 22.1 Exports

```typescript
export type ImpersonationDenylistCategory =
  | "identity_change" | "assessment_submission" | "privacy_consent"
  | "financial_transaction" | "outbound_user_communication"
  | "permission_change" | "corporate_admin_action" | "coach_action"
  | "lifecycle_action" | "read_only" | "other";

export class ImpersonationDeniedError extends Error {
  public readonly impSessionId: string | null;
}

export type ImpersonationGateResult =
  | { gated: false }
  | { gated: true; imp_session_id, imp_actor_user_id, imp_target_user_id, imp_mode: "act" };

export async function enforceImpersonationGate(
  callerClient: SupabaseClient,
  category: ImpersonationDenylistCategory,
): Promise<ImpersonationGateResult>;

export async function logImpersonationAction(
  callerClient: SupabaseClient,
  args: { target_user_id, target_org_id, edge_function_name, before, after },
): Promise<void>;
```

### 22.2 Standard usage pattern (for Tier 2 splices)

```typescript
import { enforceImpersonationGate, ImpersonationDeniedError } from "../_shared/impersonation_gate.ts";
// or "./_shared/impersonation_gate.ts" depending on existing convention in target function

// After auth.getClaims succeeds, before any mutation:
try {
  const gate = await enforceImpersonationGate(callerClient, "financial_transaction");
  // Proceed with mutation. If gate.gated is true (act_allowed),
  // call logImpersonationAction() AFTER mutation succeeds.
} catch (err) {
  if (err instanceof ImpersonationDeniedError) {
    return new Response(
      JSON.stringify({
        error: err.message,
        code: "IMPERSONATION_DENIED",
        imp_session_id: err.impSessionId,
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  throw err;
}
```

### 22.3 Hybrid auth pattern (generate-airsa-* style)

Functions that accept either user JWT or x-internal-secret header must short-circuit the gate when isInternal=true:

```typescript
if (callerUserId !== null) {
  // user JWT path — enforce gate
  await enforceImpersonationGate(callerClient, "corporate_admin_action");
}
// internal-secret path skips gate (no impersonation context possible)
```

### 22.4 Validation status (Session 49)

Helper deployed via `test-impersonation-gate` Edge Function (test-only, kept deployed for future ad-hoc testing). Probe with no-auth confirmed clean 401 response — module bundling resolved correctly, no module-not-found errors. RPC interaction validation deferred to first real Tier 2 splice in Session 50.

## 23. Tier 2 impersonation gate rollout (Sessions 50-51)

### 23.1 Helper module deep verification

End-to-end behavioral validation of `assert_impersonation_allows` RPC + helper module pairing performed Session 50 via direct SQL JWT-claim simulation:

| Test | Setup | Expected | Result |
|------|-------|----------|--------|
| 1 | No `request.jwt.claims` set | Returns `no_impersonation` | ✓ |
| 2 | JWT with bogus session_id (random UUID) | Raises 42501 | ✓ |
| 3a | observe-mode session, category=permission_change | Raises 42501 with `imp_session_id=<uuid>` DETAIL | ✓ |
| 3b | act-mode session, category=permission_change (denylisted) | Raises 42501 with DETAIL | ✓ |
| 3c | act-mode session, category=read_only (NOT denylisted) | Returns `act_allowed` with full session metadata | ✓ |

DETAIL field format `imp_session_id=<uuid>` confirmed to match helper TypeScript regex `/imp_session_id=([0-9a-f-]+)/i`. The helper's session-id extraction works correctly across all 42501 paths.

### 23.2 Edge Function file-path conventions discovered

Three distinct prefix styles exist across deployed functions. Always read `entrypoint_path` from `get_edge_function` and match exactly when redeploying:

| Style | Example function | entrypoint_path returned | Files block uses |
|-------|------------------|--------------------------|------------------|
| Naked | delete-account, calculate-scores, invitation_send, etc. | `source/index.ts` | `index.ts`, `_shared/<file>.ts` |
| `functions/` prefix | create-checkout | `source/functions/create-checkout/index.ts` | `functions/create-checkout/index.ts`, `functions/_shared/<file>.ts` |
| `supabase/functions/` prefix | ai-chat, customer-portal | `source/supabase/functions/<name>/index.ts` | `supabase/functions/<name>/index.ts`, `supabase/functions/_shared/<file>.ts` |
| Custom (set-account-type) | set-account-type | `source/set-account-type/index.ts` | `set-account-type/index.ts`, `_shared/<file>.ts` |

Wrong prefix = module bundling error at runtime (relative `../_shared/` import fails to resolve). The fix is mechanical but the symptom is a 500 with module-not-found, not the function's normal 401/error response.

### 23.3 Gate client requirement (CRITICAL)

`enforceImpersonationGate(callerClient, category)` MUST be called with an anon-key client that carries the user's `Authorization` header:

```typescript
const callerClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { global: { headers: { Authorization: authHeader } } }
);
await enforceImpersonationGate(callerClient, "permission_change");
```

If passed a service-role client instead, the gate **silently fails** — service-role calls don't carry user JWT context, so PostgREST's `request.jwt.claims` is null, the RPC returns `no_impersonation`, and the action proceeds even when impersonation is active.

This is a silent failure mode. Always verify by inspecting the client's auth config before passing it to the gate. In functions where the existing client is service-role (e.g. customer-portal, reactivate-account), construct a separate `userClient` for the gate call.

### 23.4 Tier 2 recon corrections

Recon misclassified four functions; corrected during rollout:

1. **`peer-access-respond`** — invoked from email-link click. No JWT, only `action_token` query param. Gate would always return `no_impersonation`. Reclassified as "explicitly NOT gated — public unauthenticated form".
2. **`verify-conversion`** — same pattern. Email-link, token query param, no JWT. Reclassified as "explicitly NOT gated".
3. **`airsa-supervisor-invite`** — Class B internal-secret only (`x-internal-secret` header). No caller user JWT possible. The CALLER (calculate-scores) is gated; this is the receiver. Reclassified.
4. **`send-departure-emails`** — same as #3. Class B receiver. Callers (deactivate-and-notify, bulk-deactivate-and-notify, etc.) are all gated. Reclassified.

Lesson: when classifying functions for impersonation gate, distinguish (a) JWT-required user-facing endpoints, (b) internal-secret server-to-server endpoints, (c) public unauthenticated form endpoints. Only (a) needs the gate. For (b), gate the CALLER. (c) cannot be gated.

### 23.5 reactivate-account preserved verify_jwt:true

Unique among Tier 2 functions — `reactivate-account` had `verify_jwt: true` at platform level and lacked an inline `auth.getUser()` call. The gate splice was added conditionally on `Authorization` header presence to preserve existing behavior.

Pre-existing security observation flagged but out of scope: any authenticated user could pass any email and reactivate that user's account — there's no caller-vs-target ownership check. The impersonation gate adds defense for the impersonation case; the broader hole is a separate hardening item for the build queue.

### 23.6 airsa-supervisor-reminder category re-categorization

Session 49 recon classified `airsa-supervisor-reminder` as `corporate_admin_action`. During Session 50 reading, the actual semantics turned out to be: the SELF-RATER (a regular employee) clicks a button to nudge their supervisor. The action is sending an email from the user's identity. The correct category is `outbound_user_communication`. Both categories are denylisted in observe and act mode, so enforcement behavior is identical — but the category label matters for audit trail accuracy and future reporting queries.

### 23.7 Session 51 deltas

Two updates to the Session 50 architectural learnings, surfaced during the final 6-function rollout in Session 51.

**`entrypoint_path` convention clarification.** The `Supabase:deploy_edge_function` MCP tool prepends `source/` to the `entrypoint_path` value automatically. Pass `entrypoint_path: "index.ts"` (naked, no `source/` prefix). Passing `source/index.ts` causes path doubling and a `BadRequestException` at deploy time.

This corrects the implication in §23.2 that the prefix returned by `get_edge_function` (e.g. `source/index.ts`) is what should be passed back into `deploy_edge_function`. The returned path is the platform's absolute internal path; the `entrypoint_path` parameter is interpreted relative to the implicit `source/` root that the deploy tool creates. The file `name` field for files in the bundle stays as `index.ts` and `_shared/impersonation_gate.ts`.

This was discovered during the `generate-dashboard-narrative` deploy: first attempt with `entrypoint_path: "source/index.ts"` failed with BadRequestException, retry with `entrypoint_path: "index.ts"` succeeded. Subsequent deploys (`generate-nai-delta-narrative` v12, `generate-ptp-delta-narrative` v9) used the naked convention and succeeded first try.

For the four file-path conventions documented in §23.2, the `entrypoint_path` parameter values that work are:

| Style | Files block uses | entrypoint_path parameter |
|-------|------------------|---------------------------|
| Naked | `index.ts`, `_shared/<file>.ts` | `index.ts` |
| `functions/` prefix | `functions/<name>/index.ts`, `functions/_shared/<file>.ts` | `functions/<name>/index.ts` |
| `supabase/functions/` prefix | `supabase/functions/<name>/index.ts`, `supabase/functions/_shared/<file>.ts` | `supabase/functions/<name>/index.ts` |
| Custom (set-account-type) | `set-account-type/index.ts`, `_shared/<file>.ts` | `set-account-type/index.ts` |

In all cases, drop the `source/` prefix that `get_edge_function` returns when constructing the deploy parameter.

**Recon correction #5: `generate-departure-export` is `lifecycle_action`.** The function was originally tagged `corporate_admin_action` in the Session 49 recon. In practice the caller is the deactivated `corporate_employee` retrieving their own data export — a self-service lifecycle action, not an admin operation against another user. Recategorized to `lifecycle_action` (v8 deploy).

Both categories are denylisted in observe and act mode, so runtime behavior is unchanged. The category label matters for audit trail accuracy and future reporting queries.

This brings the running total of recon corrections to 5: four from Session 50 (`peer-access-respond`, `verify-conversion`, `airsa-supervisor-invite`, `send-departure-emails` — all reclassified out of Tier 2 entirely) plus one from Session 51 (`generate-departure-export` — recategorized within Tier 2).

**Session 51 deploy summary.** Six functions, all probed clean HTTP 401:

| Function | Version | Category |
|----------|---------|----------|
| `generate-departure-export` | v8 | `lifecycle_action` |
| `generate-airsa-org-narrative` | v4 | `corporate_admin_action` (HYBRID — gate only when !isInternal) |
| `generate-cross-instrument-recommendations` | v9 | `corporate_admin_action` |
| `generate-dashboard-narrative` | v24 | `corporate_admin_action` |
| `generate-nai-delta-narrative` | v12 | `corporate_admin_action` |
| `generate-ptp-delta-narrative` | v9 | `corporate_admin_action` |

23 of 23 in-scope Tier 2 functions now spliced.

## 24. A3 Phase 2 audit reporting RPCs (Session 52)

Six SECURITY DEFINER RPCs deployed for the audit reporting surface. All gated via `assert_super_admin()` except `my_access_history` (gated only by `auth.uid() IS NOT NULL` since each user reads their own history). All take a max-200 hard cap on `p_limit` to bound row counts.

### 24.1 RPC catalog

| RPC | Args | Returns | Gate | Indexes used |
|---|---|---|---|---|
| `list_audit_events` | `p_filters jsonb, p_limit int, p_offset int` | `TABLE(... total_count bigint)` | `assert_super_admin()` | `idx_audit_log_action_type`, `idx_super_admin_audit_log_actor_created`, `idx_super_admin_audit_log_session_id`, `idx_super_admin_audit_log_mode` |
| `audit_event_detail` | `p_event_id uuid` | `TABLE(... before_value jsonb, after_value jsonb, ...)` | `assert_super_admin()` | PK lookup |
| `audit_session_replay` | `p_session_id uuid` | `jsonb` (`{session: {...}, events: [...]}`) | `assert_super_admin()` | `idx_super_admin_audit_log_session_id` |
| `export_audit_events` | `p_filters jsonb` | `jsonb` (`{rows, total_returned, total_matched, truncated, cap, exported_at}`) | `assert_super_admin()` | Same as `list_audit_events` |
| `my_access_history` | `p_limit int, p_offset int` | `TABLE(audit_source text, ... total_count bigint)` | `auth.uid() IS NOT NULL` | `idx_super_admin_audit_log_affected_user_created`, `idx_company_admin_audit_log_target` |
| `search_impersonation_targets` | `p_query text, p_limit int` | `TABLE(user_id uuid, email, full_name, account_type, organization_name)` | `assert_super_admin()` | `idx_users_email_trgm`, `idx_users_full_name_trgm` |

### 24.2 Filter schema (jsonb shape used by `list_audit_events` and `export_audit_events`)

```json
{
  "actor_user_id": "uuid|null",
  "target_user_id": "uuid|null",
  "action_type": "text|null",
  "date_from": "ISO8601|null",
  "date_to": "ISO8601|null",
  "mode": "text|null",
  "session_id": "uuid|null"
}
```

`mode` filter exact-matches against the stored value (e.g. `"impersonation:observe:individual_record_viewed"`). For wildcard mode searches (e.g. all impersonation modes), a `mode_prefix` filter would need to be added later. Empty/missing keys are treated as no filter.

### 24.3 `my_access_history` UNION shape decision

`my_access_history` UNIONs `super_admin_audit_log` (filtered on `affected_user_id = auth.uid()`) and `company_admin_audit_log` (filtered on `target_user_id = auth.uid()`). The two tables have divergent shapes: `super_admin_audit_log` carries `mode`/`session_id`/`detail`; `company_admin_audit_log` carries neither. Unified output shape includes an `audit_source text` discriminator (`'super_admin'` or `'company_admin'`) so the frontend can render row variants. `before_value`/`after_value` are intentionally NOT returned — the user sees metadata about who accessed their record but not the raw before/after diffs (those are super-admin-only via `audit_event_detail`).

Decision rationale logged Session 52: UNION inside RPC chosen over pre-unified view. View would require RLS sync + breaks when underlying table shapes diverge further; RPC encapsulates both concerns and lets future audit tables (coach-tier, instrument-content) extend cleanly via `ALTER FUNCTION`.

### 24.4 `export_audit_events` truncation behavior

Hard cap: 10,000 rows. When `total_matched > cap`, returns the most-recent 10,000 rows (`ORDER BY created_at DESC`) plus `truncated: true`. The frontend renders a banner instructing the user to narrow filters and re-export. SOC 2 CC7.2 (anomaly detection) favors graceful truncation over hard-fail because investigators hitting the cap still see the most recent slice while being told to narrow.

### 24.5 `audit_session_replay` single-jsonb shape

Returns `jsonb` with two top-level keys: `session` (the `impersonation_sessions` row joined with super admin and target user metadata) and `events` (array of `super_admin_audit_log` rows where `session_id = p_session_id`, ordered chronologically ASC). Single jsonb chosen over two RPCs to enforce atomic gate + atomic session/event consistency. Frontend renders session metadata as a header card and events as a timeline.

When `p_session_id` does not match any row in `impersonation_sessions`, the `session` key returns null but the events query still runs (since `session_id` values in `super_admin_audit_log` can be ad-hoc per-action UUIDs unrelated to impersonation). This means callers get a useful response for both impersonation-bound and ad-hoc session IDs.

### 24.6 Architecture-reference §20 schema clarification

§20.1 (`super_admin_audit_log`) and §20.2 (`company_admin_audit_log`) ALTER TABLE statements are correct and verified against live DB. The actor column on `super_admin_audit_log` is `super_admin_user_id`; the target column is `affected_user_id`; the org column is `company_id`; the jsonb detail column is `detail` (NOT `action_details`). The actor column on `company_admin_audit_log` is `actor_user_id`; the target column is `target_user_id`; the org column is `organization_id`; the jsonb detail column is `action_details`. These names matter for any RPC writing or filtering against these tables — they are not interchangeable.

### 24.7 `pg_trgm` extension enabled

Trigram extension installed Session 52 to support ILIKE substring acceleration on `users.email` and `users.full_name` for `search_impersonation_targets`. GIN indexes added: `idx_users_email_trgm`, `idx_users_full_name_trgm` (the latter partial WHERE full_name IS NOT NULL). Available now for any future user-search RPCs (coach search, departments search, etc.).

### 24.8 Verification record

All six RPCs verified Session 52 via:
1. `pg_proc` catalog confirmation (signature, SECURITY DEFINER flag).
2. Functional smoke test with super admin JWT claims (real-data return, joins working).
3. Gate test with non-super-admin JWT claims (42501 raise from `assert_super_admin()` for the five gated RPCs, empty-result behavior for `my_access_history` when the caller has no audit history).
4. Filter exactness check against ground-truth COUNT queries on the underlying tables.

Production audit log row counts at verification time: 367 rows in `super_admin_audit_log` across 10 distinct action types. `my_access_history` UNION verified at user level: orgmember test user shows 30 super_admin + 2 company_admin = 32 events, matching ground truth.

## 25. Phase C frontend integration map (Session 52 recon)

Recon completed Session 52 against commit `a896b67…` of `cbastianBWE/brainwise-blueprint`. The integration decisions below are locked and should drive Phase C prompt construction.

### 25.1 Routing structure (existing)

- `src/main.tsx` is bare — renders `<App/>` only.
- `src/App.tsx` is the router root. Wraps in `QueryClientProvider` → `TooltipProvider` → `BrowserRouter` → `AuthProvider` → `<Routes>`.
- Protected routes split into two buckets:
  - **Bypass-AppLayout protected routes**: `/onboarding`, `/demographic-consent`, `/demographic-form`, `/mfa-enrollment`, `/peer-sharing-optin`, `/departed`. These wrap `<ProtectedRoute>` directly.
  - **AppLayout protected routes**: everything else under `<Route element={<ProtectedRoute><AppLayout/></ProtectedRoute>}>`. AppLayout provides sidebar + navy header.
- `RoleGuard allowedRoles={["brainwise_super_admin"]}` is the canonical super-admin gating pattern used at the route level.
- `SuperAdminSessionProvider` already wraps every super-admin route — it is just a `crypto.randomUUID()` per-mount client-side correlation hook. Does NOT conflict with Phase C `ImpersonationProvider`.

### 25.2 Banner injection: App.tsx-level (locked)

The orange impersonation banner injects in `src/App.tsx`, between `<AuthProvider>` and `<Routes>`, NOT inside `AppLayout`. Reason: the existing demographics/MFA/deactivation gates in `ProtectedRoute` redirect users to bypass-AppLayout protected routes. If a super admin impersonates a target whose demographics are incomplete, ProtectedRoute will redirect to `/demographic-form`, which does not render inside AppLayout. The banner MUST persist on those routes.

`AppLayout`'s existing structure:
```
SidebarProvider → div.flex
  AppSidebar
  div.flex-col
    header (navy 56px)
    main (renders <Outlet/> with optional coupon banner above)
```

The coupon banner currently inside `<main>` is a content-area banner, not the model for the impersonation banner. Impersonation banner must sit OUTSIDE both AppLayout and any route-specific page chrome.

### 25.3 ImpersonationProvider design (new)

New file `src/contexts/ImpersonationProvider.tsx`. Sits in `App.tsx` between `<AuthProvider>` and `<Routes>`. Reads JWT claims (`imp_session_id`, `imp_actor_user_id`, `imp_mode`, `exp`) on every `auth.onAuthStateChange` fire. Exposes:

```
{
  isImpersonating: boolean,
  session: { sessionId, actorUserId, targetUserId, mode, expiresAt, startedAt } | null,
  beginImpersonation(targetUserId, mode, justification, mfaCode): Promise<void>,
  endImpersonation(reason: 'manual' | 'forced'): Promise<void>,
  remainingSeconds: number  // ticks every second; 0 when not impersonating
}
```

`beginImpersonation` calls the `impersonation-start` Edge Function, then `supabase.auth.setSession({ access_token, refresh_token })` with the response tokens, then navigates to `/dashboard`. `endImpersonation` calls `impersonation-end`, restores original tokens (returned in the response), navigates to `/super-admin/users` (the impersonation entry point).

### 25.4 Impersonation entry point: `/super-admin/users` page (new, locked)

NEW page `src/pages/super-admin/Users.tsx` registered at `/super-admin/users` in App.tsx (alongside existing super-admin routes). Page contents:

- Search input (debounced 250ms) → calls `search_impersonation_targets(query, 25)`.
- Table with columns: Email, Full Name, Account Type, Organization, Actions.
- Action column: "Impersonate" button (opens `JustificationModal` for that target). Future actions (MFA reset, password reset, force pseudonymization, view session history) slot in as additional menu items.
- Empty state for unsearched / too-short query: "Type at least 2 characters to search."

Sidebar `superAdminNav` array gets a new entry: `{ title: 'User Management', url: '/super-admin/users', icon: Users }`. Update `useAuth.redirectByRole` so super admins land on `/super-admin/users` instead of `/super-admin/health` (small but worth flagging — doc this as a behavior change).

`/super-admin` (currently a layout-only fallback at App.tsx line 165) gets removed or replaced with a redirect to `/super-admin/users`.

### 25.5 JustificationModal design (new)

New file `src/components/impersonation/JustificationModal.tsx`. Receives `target: { user_id, email, full_name, account_type }` as prop (from the row click on `/super-admin/users`).

Flow:
1. Step 1: Justification textarea (10 char min, hint shown), mode selector (observe/act radio buttons). Continue button enabled when justification ≥ 10 chars.
2. Step 2: Embedded `<MfaChallenge userId={user.id} onSuccess={...} onCancel={closeModal} />` (note `onCancel` is a NEW prop — see §25.6).
3. On MFA success: call `beginImpersonation(target.user_id, mode, justification, mfaCode)`. Loading spinner. On success: modal closes, banner appears, navigation to `/dashboard`.

### 25.6 MfaChallenge.tsx additive change

Existing `src/components/MfaChallenge.tsx` already does: list factors → challenge → verify → onSuccess callback. Phase C needs to reuse this component but the existing `handleCancel` calls `supabase.auth.signOut()` — wrong for the justification modal where cancelling should just close the modal.

Modification: add optional `onCancel?: () => void` prop. If provided, run that instead of signOut. Backwards-compatible — existing call sites (Login flow) continue to work because `onCancel` is undefined for them. One-prop additive change.

### 25.7 Tab title / favicon / red border (new ImpersonationChrome)

New file `src/components/impersonation/ImpersonationChrome.tsx`. Render-only side effects, no UI. Mounted by `ImpersonationProvider` when `isImpersonating === true`. Effects:

- `useEffect`: prefix `document.title` with `[IMPERSONATING] `, restore on unmount.
- `useEffect`: swap `<link rel="icon">` href to `/brain-icon-impersonating.png` (asset to be added — red dot version of brain-icon.png), restore on unmount.
- 4 fixed-position 2px-wide red divs (top, bottom, left, right of viewport) for the border.

### 25.8 ImpersonationBanner design (new)

New file `src/components/impersonation/ImpersonationBanner.tsx`. Sticky-top fixed position, full-width, height ~48px, BrainWise orange (#F5741A) background, white text. Contents (left to right):

- Mode pill: `OBSERVE` or `ACT` (white text, slightly darker orange background pill).
- "Impersonating: {target_email}" text.
- Countdown: "Time remaining: {mm:ss}" — driven by `remainingSeconds` from context.
- "Exit Impersonation" button (white-bordered, white text, transparent background).

Body content shifts down by banner height when `isImpersonating` (set a `--impersonation-banner-height: 48px` CSS variable on `body` when active, applied as `padding-top` on `body`).

### 25.9 ProtectedRoute handling during impersonation: Option B locked

Decision Session 52: `ProtectedRoute` does NOT bypass demographic/MFA/deactivation gates during impersonation. Reasoning:

- The principle of impersonation is "see and act as the target user." If the target user has incomplete demographics, the super admin should see them on `/demographic-form` — that's the experience the target sees.
- Avoids a class of UI inconsistency bugs where the super admin sees a different state than the target during integration testing.
- Backend Tier 2 denylist is already the security layer enforcing that no mutations slip through.

ACTION ITEM for Phase C-1 prompt: AUDIT the Tier 2 denylist (action types in `super_admin_action_types.denylist_during_impersonation`) to confirm the demographic-form-submit and mfa-enrollment-completion Edge Functions are denylisted. If they are not, add a Phase C-1 backend task to add them BEFORE shipping Phase C-1 frontend.

### 25.10 Token swap mechanics

`impersonation-start` Edge Function returns `{ access_token, refresh_token, session: {...} }`. Frontend calls `supabase.auth.setSession({ access_token, refresh_token })`. This triggers `auth.onAuthStateChange` SIGNED_IN, which propagates through `AuthProvider` → all hooks consuming `useAuth()` re-render → `useUserProfile` refetches based on new `user.id` (which is now the target). `RoleGuard` re-evaluates with the target's account_type and routes accordingly.

`impersonation-end` returns the original super admin tokens. Same `setSession` flow restores the super admin session.

Phase C-1 prompt MUST verify the actual response shape of `impersonation-start` and `impersonation-end` Edge Functions before writing the frontend integration code (recon read deferred to that prompt's pre-flight).

### 25.11 Phase D `/settings/access-history` integration

Top-level route, NOT nested under `/settings`. Registered in App.tsx alongside `/settings/privacy`, `/settings/billing` (flat sibling pattern, line 128-131 of current App.tsx). Page reads from `my_access_history` RPC. CSV export uses `export_audit_events` (BUT only super admins can call that — `my_access_history` does not have an export equivalent. Phase D adds a `my_access_history_export` RPC OR the frontend assembles CSV from the paginated RPC results client-side. Simpler path: client-side CSV from paginated results, capped at 1000 rows. Decision deferred to Phase D prompt construction.)

Sidebar update in `src/components/AppSidebar.tsx`: add `{ title: 'Access History', url: '/settings/access-history', icon: History }` to BOTH `settingsSubItems` (line 137) and `coachSettingsSubItems` (line 143) arrays. Two-line change.

### 25.12 Three-prompt sequencing (locked)

- **Phase C-1 (infrastructure)**: ImpersonationProvider + ImpersonationBanner + ImpersonationChrome + MfaChallenge `onCancel` additive prop + App.tsx wiring + Tier 2 denylist audit. Ships dormant infrastructure (no entry point yet, banner never shows because no session is started).
- **Phase C-2 (entry + flow)**: SuperAdminUsers page + JustificationModal + sidebar superAdminNav update + redirectByRole update + `impersonation-start`/`impersonation-end` integration. End-to-end impersonation goes live.
- **Phase D (access history)**: AccessHistory page + sidebar settings update + route registration. Independent of impersonation. Low-risk.

Each prompt is testable independently. Phase C-1 ships dormant; Phase C-2 lights it up; Phase D is unrelated.


## 26. Session 53 backend pre-flight deltas

Three pre-flight backend tasks shipped before Phase C-1 frontend prompt construction. Each was triggered by recon findings that contradicted Session 52 §25 locked decisions; each contradiction is captured below alongside the corrected design.

### 26.1 impersonation-end v2: super admin token mint (corrects §25.10)

**Contradiction found**: §25.10 stated "impersonation-end returns the original super admin tokens. Same setSession flow restores the super admin session." Code recon of impersonation-end v1 showed it returns only `{ success, imp_session_id, ended_at, duration_seconds }` — no tokens. The architecture reference assumption was speculative and not grounded in code.

**Resolution (Decision 1, Path 2)**: Modify impersonation-end to mint fresh tokens for the original super admin so the frontend can restore the super admin session without forced re-login.

**impersonation-end v2 deployed Session 53**. Sequence:

1. Validate JWT, extract imp_session_id and imp_actor_user_id from claims.
2. Fetch impersonation_sessions row, verify actor and target match JWT claims.
3. UPDATE ended_at FIRST so custom_access_token_hook does not stamp imp_* claims on the new super admin token (the hook filters on ended_at IS NULL).
4. log_super_admin_action with action_type='impersonation_ended'. Attribution still records super admin to target because we use callerClient which still holds imp_actor_user_id.
5. Look up super admin email from public.users via adminClient.
6. generateLink (magiclink) + verifyOtp on a fresh anon client. Produces an aal1 session for the super admin.
7. Return { success, restored: true, super_admin_user_id, access_token, refresh_token, expires_at } at top level.

**Token AAL note**: The minted super admin session is aal1 (magic-link single-factor). Current MFA gate (current_user_mfa_satisfied) checks factor existence not session AAL, so super admin lands cleanly back on /super-admin/users without being bounced through MFA. Session-AAL-aware MFA gating is its own architectural pass — logged as a build queue item (medium priority, post-launch).

**Failure path**: If super admin lookup or token mint fails, the function returns `{ success: true, restored: false, restore_error: ... }`. The session has already been ended at the DB level; only the client-side restoration fails. Frontend handles `restored: false` by signing out the impersonation session and redirecting to /login.

**Critical sequencing**: ended_at is set BEFORE generateLink fires for the super admin. This is defensive: even in a hypothetical scenario where the super admin's user_id matched some impersonation_sessions.target_user_id (which should never happen since super admins shouldn't be targets), the hook would skip claim stamping because ended_at is no longer null.

### 26.2 is_impersonating() and is_impersonating_act() helpers + user_demographics RLS

**Contradiction found**: §25.9 stated that the Tier 2 backend denylist is "the security layer enforcing that no mutations slip through" during impersonation. Recon revealed Tier 2 enforcement only fires when an Edge Function explicitly calls `enforceImpersonationGate(callerClient, category)`. It does NOT fire on:

- Direct Supabase client table writes gated only by RLS (e.g. `user_demographics`, where the policy was `user_id = auth.uid()`). During act-mode impersonation the JWT's auth.uid() is the target's user_id, so RLS allowed the write through.
- Supabase auth APIs (mfa.enroll, mfa.challenge, mfa.verify, auth.updateUser) — platform endpoints that don't go through user-defined Edge Functions.

This was a gap in the §25.9 security-layer claim.

**Resolution (Decision 2, Path C, RLS half)**: Add helpers that read JWT claims for an active impersonation session, then add RLS WITH CHECK clauses on user-self-write tables that block writes during impersonation.

**Helpers deployed**:

```
public.is_impersonating() RETURNS boolean STABLE SECURITY DEFINER
  - Reads request.jwt.claims for imp_session_id
  - Confirms session is live (ended_at IS NULL AND expires_at > now()) by querying impersonation_sessions
  - Returns true if both conditions hold; false otherwise
  - Defense in depth: doesn't trust JWT alone, verifies against DB row

public.is_impersonating_act() RETURNS boolean STABLE SECURITY DEFINER
  - Same as is_impersonating() but additionally requires mode = 'act'
  - Reads mode from DB row (canonical), not from JWT (defense against tampered claims)
  - Returns false if no matching active session (COALESCE wraps the SELECT result)
```

Both granted EXECUTE to authenticated.

**user_demographics policy refactor**: The original FOR ALL policy `(user_id = auth.uid())` was split into four policies:

- `user_demographics: users read their own row` — FOR SELECT, USING `(user_id = auth.uid())`. No impersonation block on reads, so super admin observers can SELECT target demographics.
- `user_demographics: users insert their own row, no impersonation` — FOR INSERT, WITH CHECK `(user_id = auth.uid() AND NOT public.is_impersonating())`.
- `user_demographics: users update their own row, no impersonation` — FOR UPDATE, USING `(user_id = auth.uid())`, WITH CHECK same as INSERT.
- `user_demographics: users delete their own row, no impersonation` — FOR DELETE, USING `(user_id = auth.uid() AND NOT public.is_impersonating())`.

Service role policy unchanged (full access).

**Verification matrix** (all ✓):

| Scenario | is_impersonating() | is_impersonating_act() | INSERT into user_demographics |
|---|---|---|---|
| No JWT (service role direct) | false | false | (RLS bypassed) |
| JWT, no imp_session_id claim | false | false | succeeds |
| JWT, imp_session_id pointing at ended session | false | false | succeeds |
| JWT, observe-mode active session | true | false | blocked (insufficient_privilege) |
| JWT, act-mode active session | true | true | blocked (insufficient_privilege) |

**Semantics decision**: BOTH observe and act mode block writes. Reasoning: a super admin should never write the target's demographics, regardless of mode. Observe mode redundantly blocks (the gate function already blocks all observe-mode writes), but having NOT is_impersonating() in WITH CHECK is harmless and makes the policy self-documenting at the table level.

### 26.3 identity-mutation Edge Function wrapper

**Resolution (Decision 2, Path C, application half)**: Single chokepoint for identity_change category mutations that go through Supabase auth APIs (auth.updateUser for password/email; auth.mfa.enroll/unenroll). These bypass Edge Function Tier 2 gating when called via the Supabase JS client directly. The wrapper calls enforceImpersonationGate first, then forwards via the caller's authenticated client.

**identity-mutation v1 deployed Session 53**. Class A explicit (verify_jwt=false; auth.getClaims inside).

Body shape discriminator-based:
- `{ action: "update_password", new_password }` → callerClient.auth.updateUser({ password })
- `{ action: "update_email", new_email }` → callerClient.auth.updateUser({ email })
- `{ action: "mfa_enroll" }` → callerClient.auth.mfa.enroll({ factorType: "totp" }), returns { factor_id, qr_code, secret }
- `{ action: "mfa_unenroll", factor_id }` → callerClient.auth.mfa.unenroll({ factorId })

Gate: enforceImpersonationGate(callerClient, "identity_change"). identity_change is in the denylist for both observe and act, so any impersonation context blocks the call. On gate denial: 403 with `{ code: "IMPERSONATION_DENIED", imp_session_id }`.

**Frontend rewires required (Phase C-1.5, folded into Phase C-1 prompt)**:

- src/pages/ResetPassword.tsx line 49: `supabase.auth.updateUser({ password })` → call identity-mutation with action="update_password".
- src/pages/Settings.tsx saveEmail() line 364: `supabase.auth.updateUser({ email })` → call identity-mutation with action="update_email".
- src/pages/MfaEnrollment.tsx handleEnroll() and any unenroll surface in Settings.tsx → call identity-mutation with action="mfa_enroll" or "mfa_unenroll".
- src/components/MfaChallenge.tsx is unaffected (challenge/verify steps don't include enroll).

**Why pattern Z (gate + perform via caller token) was chosen** over admin-perform: Supabase auth admin API has `auth.admin.updateUserById` for password/email but no admin equivalent for `mfa.enroll/unenroll`. Pattern Z uses callerClient throughout, working uniformly for all four operations.

**Future-proofing**: Any future identity_change path (phone-number change, recovery email, account merge, etc.) routes through the same wrapper, automatically gated. SOC 2 audit log review benefits from a single chokepoint for identity_change events.

### 26.4 §25.9 partial reversal: ProtectedRoute redirects gate routes during impersonation

**Reversal**: Original §25.9 Option B locked: "ProtectedRoute does NOT bypass demographic/MFA/deactivation gates during impersonation." That decision rested on the false assumption that the Tier 2 backend denylist alone protected all mutation paths from those gate routes. §26.2 and §26.3 close the actual mutation paths at the database and Edge Function layers; the frontend complement is to ALSO redirect the gate routes during impersonation.

**New behavior locked Session 53**: When ImpersonationProvider context indicates `isImpersonating === true`, ProtectedRoute treats the impersonation as authoritative and redirects gate routes to /dashboard:

- /onboarding → /dashboard
- /demographic-consent → /dashboard
- /demographic-form → /dashboard
- /mfa-enrollment → /dashboard
- /peer-sharing-optin → /dashboard

(/departed remains accessible because deactivation observation is a legitimate impersonation use case.)

**Defense in depth**: This is layer 3 of three layers. Layers 1-2 (RLS WITH CHECK + identity-mutation Edge Function wrapper) close the database and application paths. Layer 3 (frontend redirect) prevents the super admin from even reaching the surface that would attempt those mutations.

This is implemented in Phase C-1 frontend prompt as a small ProtectedRoute modification: read isImpersonating from ImpersonationProvider, short-circuit gate routes when true.

### 26.5 Vestigial column finding: super_admin_action_types.denylist_during_impersonation

**Side observation logged Session 53**: The `super_admin_action_types` table has a `denylist_during_impersonation` boolean column. The actual runtime denylist mechanism (`assert_impersonation_allows`) is category-based and uses a hardcoded text array literal; it does not consult `super_admin_action_types` at all. The column is therefore vestigial — never read by any code path.

Logged as build queue item (LOW priority, post-launch): replace the hardcoded `v_denylist text[]` array in `assert_impersonation_allows` with a SELECT against a new `super_admin_denylist_categories` table (one row per category, `category text PRIMARY KEY`, `denylist_during_act boolean`, `comment text`). Drop the dead `super_admin_action_types.denylist_during_impersonation` column in the same migration.

Benefits: queryable denylist for SOC 2 evidence collection, no schema drift between RPC and registry, no behavior change at deploy (table seed = current array).

### 26.6 useMfaSatisfied semantics finding

Not a Session 53 ship; logged for future MFA gate hardening pass.

`current_user_mfa_satisfied()` checks whether the user has a verified factor in `auth.mfa_factors`, NOT whether the current session is `aal2`. This means:

- A user with a verified TOTP factor returns `mfaSatisfied: true` regardless of whether their current session is aal1 or aal2.
- The MFA gate is enforcing "user has set up MFA" not "user has presented MFA on this session" — weaker than Supabase's native AAL-based enforcement.

For Session 53 this means: when impersonation-end mints a fresh aal1 session for the super admin, ProtectedRoute does NOT bounce them through MFA (because they have a verified factor). Good UX, but a SOC 2 weakness worth fixing in a later pass.

Logged build queue item (MEDIUM priority, post-launch): refactor current_user_mfa_satisfied to check session AAL via `auth.aal()` claim or a new `current_user_session_aal()` helper, requiring `aal2` for sensitive surfaces. Will require coordinated frontend changes to handle the post-impersonation re-MFA flow gracefully.

### 26.7 custom_access_token_hook freshness gate (Session 53 close)

**Problem surfaced during Phase D testing**: When a super admin logged out via the sidebar instead of clicking "Exit Impersonation", the `impersonation_sessions` row stayed `ended_at IS NULL`. The next time the target user attempted to log into their own account, the hook detected the stranded active row, matched on `auth_method='otp'` (since Supabase records `verifyOtp` as 'otp' regardless of link type — used by both impersonation-start AND normal login flows), and stamped imp_* claims onto the target's normal login token. The target user landed in their own account but with imp claims attached, which surfaced as confusing MFA errors and ImpersonationProvider bootstrap failures.

**Investigation**: Considered an `AFTER DELETE` trigger on `auth.sessions` to auto-end matching impersonation_sessions on logout. Verified via `has_table_privilege` that we can create such a trigger. But verified empirically that **Supabase does NOT delete auth.sessions rows on logout** (cbastian had 11 active auth.sessions rows despite multiple logouts; only expiry via `expires_at` is enforced). The trigger would never fire on signOut events. Wrong layer.

**Fix locked Session 53 close**: Tighten the hook itself with a freshness gate distinguishing legitimate impersonation-start mints from stranded-row contamination.

For `'otp'` and `'magiclink'` initial token mints: require the matching `impersonation_sessions` row was created within the last 60 seconds. impersonation-start mints the token within ~2 seconds of inserting the row (via verifyOtp), so this catches the legitimate flow with 30x slack. Stranded rows (minutes+ old by definition) take the early return — no claims stamped.

For `'token_refresh'`: require the incoming JWT already carries `imp_session_id` matching the active row. The hook receives existing claims via `event -> 'claims'`, so this check is trivial. Refreshes preserve impersonation; they cannot create one out of nothing.

```sql
IF v_auth_method = 'token_refresh' THEN
  v_existing_imp_session := v_claims ->> 'imp_session_id';
  IF v_existing_imp_session IS NULL OR v_existing_imp_session <> v_session.id::text THEN
    RETURN event;
  END IF;
ELSE
  -- magiclink/otp initial mint
  v_row_age_seconds := EXTRACT(EPOCH FROM (now() - v_session.started_at));
  IF v_row_age_seconds > 60 THEN
    RETURN event;
  END IF;
END IF;
```

**Net effect**: stranded rows (which still get cleaned by the existing 30-min cron sweep `sweep_expired_impersonation_sessions`) can no longer pollute subsequent target-user logins while pending cleanup. The 60-second window is generous enough that no legitimate impersonation-start flow could miss it (the verifyOtp-to-token-mint path has no possible 60s delay).

### 26.8 check_mfa_freshness reads auth.mfa_challenges.verified_at as fallback

**Problem surfaced mid-Session 53**: After completing MFA verification on an already-aal2 session (e.g., super admin already logged in with MFA, navigates to /super-admin/users, clicks Impersonate, completes the JustificationModal MFA challenge), `check_mfa_freshness` returned false. Root cause: Supabase does NOT write a new row to `auth.mfa_amr_claims` when re-verifying MFA on a session that's already aal2. The amr_claims table only captures the most recent factor that elevated the session to aal2, not subsequent verifications.

**Fix**: `check_mfa_freshness` now reads BOTH `auth.mfa_amr_claims` AND `auth.mfa_challenges.verified_at`. The `mfa_challenges` table records every verification attempt, including re-verifications on already-aal2 sessions. The function returns true if EITHER source shows a verified factor within the freshness window (default: 5 minutes).

```sql
RETURN (
  EXISTS (
    SELECT 1 FROM auth.mfa_amr_claims
    WHERE session_id = v_session_id
      AND created_at > now() - p_window
  )
  OR EXISTS (
    SELECT 1 FROM auth.mfa_challenges c
    JOIN auth.mfa_factors f ON f.id = c.factor_id
    WHERE f.user_id = v_uid
      AND c.verified_at IS NOT NULL
      AND c.verified_at > now() - p_window
  )
);
```

**Side benefit**: this also closes a smaller edge case where the user verifies MFA on a different session than the one initiating the impersonation request (multi-tab usage). The verified_at fallback catches the verification regardless of which session it occurred on.

### 26.9 log_super_admin_action lifecycle event mode column

**Problem surfaced mid-Session 53**: Audit log queries paired `impersonation_started` and `impersonation_ended` rows by `session_id`, but the `mode` column on lifecycle rows showed `'impersonation:observe:observe'` instead of just `'observe'`. The double-prefix came from the `log_super_admin_action` helper applying its category prefix logic uniformly without distinguishing lifecycle events from action events.

**Fix**: `log_super_admin_action` now skips the category prefix when `p_action_type` is one of:
- `impersonation_started`
- `impersonation_ended`
- `impersonation_denied_action`

```sql
IF p_action_type IN ('impersonation_started', 'impersonation_ended', 'impersonation_denied_action') THEN
  v_mode_to_log := p_mode;
ELSE
  v_mode_to_log := COALESCE(p_category || ':' || p_mode || ':' || p_mode, p_mode);
END IF;
```

Lifecycle rows now write clean `mode` values ('observe', 'act') matching the `started_at` row, enabling proper grouping in audit reporting.

**Backfill of one historical row blocked by SOC 2**: The audit log table is append-only by design (no UPDATE policy at the user-facing layer; modification at the DB level requires direct admin access which is itself a documented privileged operation). One historical row from Session 52 testing has the old double-prefix value (`impersonation:observe:observe`). Documented as cosmetic build queue item BUG-S53-3, acceptable historical artifact.

### 26.10 search_impersonation_targets paginated multi-field search

**Final form locked Session 53**:

- Default-loads all users when query is empty or < 2 characters
- Multi-field search across email, full_name, organization_name (LEFT JOIN to organizations)
- Three-tier ordering: prefix matches first, then substring matches, then alphabetical email
- COALESCE account_type to 'unknown' (handles 2 production users with NULL account_type)
- Window-function `total_count` for pagination
- p_limit clamped to LEAST(GREATEST(p_limit, 1), 100), default 25
- p_offset clamped to GREATEST(p_offset, 0)
- INCLUDES self — no `u.id <> v_caller` filter; UX layer prevents self-impersonation via disabled menu item with "(cannot impersonate yourself)" hint

The decision to include self at the data layer (rather than filter it out) was made Session 53: future per-row actions on the User Management page (Reset MFA, Trigger password reset, View access history) may need to operate on the caller's own row. Backend filtering is the wrong layer for a UX rule. Frontend's per-action gates decide whether each action is permitted on self.

### 26.11 my_access_history defaults action_category for company_admin source rows

**Problem surfaced mid-Session 53**: `AccessHistory.tsx` called `formatActionType(row.action_category)` which invokes `.replace(/_/g, ' ')` on the value. For rows sourced from `company_admin_audit_log`, the RPC's UNION ALL branch returned `NULL::text AS action_category` (since `company_admin_audit_log` has no category column). The frontend crashed with TypeError on `null.replace`.

**Fix**: RPC now returns `'organization_admin_action'::text` instead of NULL for company_admin source rows. The string is descriptive enough as a fallback for users viewing their access history; matches the existing `super_admin_action_types.category` taxonomy convention.

```sql
SELECT
  'company_admin'::text                     AS audit_source,
  cal.id                                    AS event_id,
  cal.action_type,
  'organization_admin_action'::text         AS action_category,  -- was NULL
  ...
FROM public.company_admin_audit_log cal
WHERE cal.target_user_id = v_uid
```

Backend defense; frontend null-guard logged as build queue item BUG-S53-1 for defense-in-depth.

### 26.12 identityMutation.ts helper for friendly Edge Function error toasts

**Problem surfaced during T-B testing**: `supabase.functions.invoke('identity-mutation', ...)` returns null `data` and a `FunctionsHttpError` on non-2xx responses. The error's `.message` is the generic "Edge Function returned a non-2xx status code" — the actual structured payload (`{ error, code: 'IMPERSONATION_DENIED', imp_session_id }`) is in `error.context` and must be retrieved via `await error.context.json()`. Frontend wasn't doing that, so users saw an opaque error toast that looked like a real Edge Function bug instead of the intended IMPERSONATION_DENIED protection.

**Fix**: New `src/lib/identityMutation.ts` helper centralizes the parse-then-error pattern.

```typescript
export async function callIdentityMutation<T = any>(
  body: IdentityMutationAction,
): Promise<IdentityMutationResult<T>> {
  const { data, error } = await supabase.functions.invoke("identity-mutation", { body });
  if (!error && data && !data.error) return { ok: true, data: data as T };
  if (error) {
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        const code = body?.code as string | undefined;
        const friendly = code === "IMPERSONATION_DENIED"
          ? "This action is blocked while impersonating. Identity changes (email, password, MFA) are not permitted during impersonation, even in act mode."
          : (body?.error as string) || error.message;
        return { ok: false, error: friendly, code };
      }
    } catch { /* fall through */ }
    return { ok: false, error: error.message };
  }
  if (data?.error) {
    const code = data.code as string | undefined;
    const friendly = code === "IMPERSONATION_DENIED" ? IMPERSONATION_DENIED_MESSAGE : data.error;
    return { ok: false, error: friendly, code };
  }
  return { ok: false, error: "Unknown error" };
}
```

Five callsites refactored to use the helper:
- Settings.tsx: saveEmail (line 371), startEnroll (line 65), cancelEnroll (line 79), unenroll (line 128)
- ResetPassword.tsx: password update call
- MfaEnrollment.tsx: handleEnroll call

**Pattern note**: any future Edge Function that returns structured error codes should adopt the same helper-with-error-body-parse pattern. The Supabase SDK's behavior of hiding non-2xx body content behind `error.context.json()` is non-obvious and the helper hides that ergonomically.

## 27. Group C — Coach Certification + Resources / Learning Paths backend (Session 54)

Three phases of backend work shipped in Session 54. Backend is complete for Phase 4 frontend to begin. Two standing rules locked at session open, retroactive + forward.

### 27.1 Standing rules locked

**Rule 1 — SOC 2 from inception.** Every new table, RPC, and Edge Function satisfies:
- CC6.1: RLS enabled + caller validation inside RPC body
- CC6.3: SECURITY DEFINER with explicit `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`; `SET search_path = public, pg_temp`
- CC7.2: sanitized errors (stable error codes, no PII echo); audit columns (`created_by`, `updated_by`) on all authoring tables

**Rule 2 — Impersonation gate from inception.** Every new mutation RPC or Edge Function is categorized against the §21.3 9-category denylist at design time. Every RLS WITH CHECK on user-self-write OR super-admin-write includes `NOT public.is_impersonating()` from day one. No retrofits.

### 27.2 Schema additions (Phase 1)

**17 new tables** in dependency order:

- `certification_paths` — top-level cert program (e.g. PTP Coach, AI Transformation Coach)
- `curricula` — slug-named learning units; published flag; archived_at
- `certification_path_curricula` — many-to-many with display_order
- `modules` — slug-named module units inside curricula
- `curriculum_modules` — many-to-many with display_order, prerequisite_module_id (single-prereq v1; multi-prereq DAG deferred to v2)
- `content_items` — polymorphic by `item_type`. 29 columns, 8 CHECK constraints enforcing per-type field requirements. 7 v1 item_types: `video`, `quiz`, `written_summary`, `skills_practice`, `file_upload`, `external_link`, `live_event`
- `quiz_questions` — 5 question_types: `multiple_choice`, `true_false`, `select_all`, `match_definition`, `match_picture`
- `quiz_answer_options` — `is_correct` direct trainee SELECT blocked (Migration 10.5); access routes through SECURITY DEFINER RPC only
- `user_curriculum_assignments` — 3-source assignment model: `direct_assignment`, `certification_path`, `audience_tag`. EXCLUDE constraint on (user_id, curriculum_id, source) WHERE status='active' (permits re-assignment after unassignment)
- `content_item_completions` — UNIQUE (user_id, content_item_id); status enum, type-specific columns (video_watch_pct, quiz_best_score_pct, quiz_passed, written_review_status, skills_trainee_signed_off, skills_mentor_signed_off, reviewer_comments)
- `quiz_attempts` — append-only (no UPDATE policy); attempt_number monotonic per (user, content_item)
- `written_submissions` — append-only iterations; review_decision, reviewer_comments, reviewed_at
- `coach_mentor_assignments` — EXCLUDE constraint on (trainee_user_id, mentor_user_id, certification_id) WHERE ended_at IS NULL; CHECK `(ended_at IS NULL) XOR (end_reason IS NOT NULL)`
- `cohorts`, `cohort_members` — Q11 seam, no UI v1
- `user_notification_preferences` — per-user channel pref per notification_type
- `user_notifications` — in-app inbox; dedup_key column added in Phase 3 with partial unique index

**2 EXTENDS:**

- `coach_certifications`: status enum changed `in_progress/certified/suspended` → `in_progress/certified/revoked` (suspended had 0 production rows, conflicted with Q9 revoke semantics); added `post_certification_benefit_applied_at` for Q13 hook idempotency
- `resources`: added `category` text NOT NULL with CHECK on 5 v1 categories: `my_learning`, `reference_library`, `articles_guides`, `videos`, `tools_templates`

**1 supporting catalog:** `notification_types_catalog` seeded with 14 v1 types (3 critical non-configurable, 8 important configurable, 3 informational configurable). `cert_path_deadline_approaching` is marked `is_v1_active=false` (v2 scope).

**8 new `super_admin_action_types` seeded:** `certification_granted`, `certification_revoked`, `mentor_assigned`, `mentor_unassigned`, `curriculum_directly_assigned`, `curriculum_unassigned`, `written_submission_reviewed`, `skills_practice_signoff`.

**Two retroactive Phase 1 fixes:** Migration 08.5 retrofitted `NOT public.is_impersonating()` onto 6 catalog table super admin policies. Migration 10.5 locked down `quiz_answer_options.is_correct` from trainee direct SELECT.

### 27.3 Phase 2 RPC catalog

All RPCs `SECURITY DEFINER` with `SET search_path = public, pg_temp`, `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`. Gate ordering: `auth.uid()` check → `assert_super_admin()` (where applicable) → `assert_impersonation_allows(<category>)` → input validation → mutation → `log_super_admin_action` (where applicable) → `notify_user` (Phase 3) → return jsonb.

| RPC | Caller | Impersonation category | Tier 2 reason ≥10 chars |
|---|---|---|---|
| `get_user_learning_state(uuid)` | self / mentor / super admin | none (read; observation permitted) | n/a |
| `submit_quiz_attempt(uuid, jsonb)` | trainee | `assessment_submission` | n/a |
| `submit_written_summary(uuid, text)` | trainee | `assessment_submission` | n/a |
| `mentor_review_submission(uuid, text, text)` | mentor or super admin | `coach_action` | n/a |
| `mark_skills_practice_signoff(uuid, text, uuid?)` | trainee or mentor/admin | `assessment_submission` (trainee) / `coach_action` (mentor) | n/a |
| `grant_certification(uuid, text)` | super admin | `permission_change` | ✓ |
| `revoke_certification(uuid, text)` | super admin | `permission_change` | ✓ |
| `assign_mentor(uuid, uuid, uuid, text)` | super admin | `permission_change` | ✓ |
| `assign_curriculum_directly(uuid, uuid, text, …)` | super admin | `permission_change` | ✓ |

Plus the Q13 no-op hook `apply_post_certification_benefits(uuid)`: stamps `post_certification_benefit_applied_at` for idempotency. Full benefit logic (12-month premium tier coupon, Stripe subscription provisioning, 13th-month auto-revert) deferred until subscription tiers + pricing are decided.

**Verified end-to-end:**
- `get_user_learning_state` viewer_role projection across 4 scenarios (super admin observation, unauthenticated→42501, non-admin cross-user→42501, self-query success)
- `submit_quiz_attempt` impersonation gate fires with `imp_session_id=<uuid>` in DETAIL when called inside active act-mode impersonation session
- All Tier 2 RPCs raise `22023 reason_required_min_chars: 10` on short justification
- All super admin RPCs raise `42501 caller is not a BrainWise super admin` on non-admin caller

### 27.4 Phase 3 notifications subsystem

**`notify_user(p_user_id, p_notification_type, p_payload, p_dedup_key)` contract:**

- Validates target user exists and notification_type is in catalog
- `is_v1_active=false` types return `{dispatched: false, reason: 'type_not_v1_active'}` — no-op
- Hybrid channel resolution: if `user_configurable=true`, consults `user_notification_preferences` (defaults to catalog `default_channel` if no preference row); if `user_configurable=false` (critical types), ignores preference and uses catalog default
- `channel='none'` returns `{dispatched: false, reason: 'user_opted_out'}` — no-op
- **In-app dispatch:** direct INSERT into `user_notifications` with `ON CONFLICT DO NOTHING` via partial unique index on `(user_id, notification_type, dedup_key) WHERE dedup_key IS NOT NULL`. Duplicate `dedup_key` returns existing `notification_id` and `{dispatched: false, reason: 'duplicate_dedup_key'}` — idempotency seam.
- **Email dispatch:** `pg_net.http_post` fire-and-forget to `send-email` Edge Function with `x-internal-secret` header read from `vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET'` (uppercase — vault row name matches the Edge Function Secret env var name; both have existed since Session 48 when the Class B pattern shipped). Composes subject + html_body via `compose_notification_email` helper (inline branded templates: navy header #021F36, orange CTA #F5741A, sand background #F9F7F1).
- **Fail-loud on missing vault secret:** raises `42501 internal_function_secret_not_in_vault` with HINT pointing at the vault row name; entire transaction rolls back. Intentional. No half-completed dispatches. End-to-end verified Session 54: `certification_granted` dispatched live, `email_logs.send_status='sent'`, Resend message ID populated.
- **No impersonation gate inside `notify_user` itself.** Caller is responsible for its own gating. notify_user dispatches notifications TO users; impersonation context is orthogonal.

**Extensibility decisions:**

- Shipped `p_dedup_key` — real value, prevents double-fire on retries
- Explicitly NOT shipped `p_channels` override — catalog `user_configurable=false` already handles critical-types-bypass-pref; speculative seam without a call site

**Credential routing decision (Option A locked).** `INTERNAL_FUNCTION_SECRET` lives in Edge Function Secrets (env) for the `send-email` function's own env reads, and is also stored in `vault.secrets` so Postgres RPCs can read it. Same value, two storage locations, kept in sync manually on the rare rotation. The vault row was added Session 48 alongside the Edge Function Secrets sync; `notify_user` reads it via `vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET'`. Rejected Option B (dedicated dispatch-notification Edge Function — overengineering for one call site) and Option C (`email_outbox` + cron — adds 1-min latency on critical notifications, new table, new cron cadence pattern that diverges from existing 4-cron stagger).

**Vault version mismatch caught Session 54.** `notify_user` was originally deployed with a lowercase `'internal_function_secret'` lookup. Production vault row is uppercase `INTERNAL_FUNCTION_SECRET`. Migration `groupc_phase3_10` corrected the RPC; no vault change needed. Postgres `LIKE` is case-sensitive — diagnostic queries that case-mangle the pattern can falsely return "secret missing" against a vault that has it under a different case.

**Phase 2 RPC notification wiring map:**

| RPC | Notification | Recipient | Dedup key |
|---|---|---|---|
| `submit_written_summary` (when submitted_for_review) | `mentor_review_required` | each active mentor | `review_required:<submission_id>:<mentor_id>` |
| `mentor_review_submission` (approved) | `mentor_review_completed` | trainee | `review_decision:<submission_id>` |
| `mentor_review_submission` (revision_requested) | `mentor_review_revision_requested` | trainee | `review_decision:<submission_id>` |
| `grant_certification` | `certification_granted` (critical) | newly certified user | `grant_cert:<cert_id>` |
| `revoke_certification` | `certification_revoked` (critical) | revoked user | `revoke_cert:<cert_id>:<minute-trunc>` |
| `assign_mentor` | `mentor_assigned` ×2 | mentor + trainee | `mentor_assignment_{mentor,trainee}:<assignment_id>` |
| `assign_curriculum_directly` | `module_assigned` | assigned user | `curriculum_assigned:<assignment_id>` |
| `enroll_user_in_certification_path` (Phase 3.5) | `certification_enrolled` | enrolled user | `enroll_path:<cert_id>` |

**Not wired intentionally:** `submit_quiz_attempt`, `mark_skills_practice_signoff`. No v1 catalog type for item-level pass. If Phase 5 trainee learning UI surfaces a need for module-level `module_completed` dispatch, wire there.

### 27.5 Phase 3.5 — Authoring-adjacent RPCs

Three RPCs added because Phase 4 management UIs need them. All Tier 2 super admin actions (reason ≥10 chars) with `permission_change` impersonation gate.

- `enroll_user_in_certification_path(p_user_id, p_cert_path_id, p_reason, p_due_at?)` — atomic fanout: INSERT `coach_certifications` (status=in_progress) + INSERT N `user_curriculum_assignments` with source='certification_path'. Idempotency: rejects duplicate active enrollment of same `certification_type`. Notifies via `certification_enrolled`.
- `unassign_mentor(p_assignment_id, p_end_reason, p_reason)` — stamps `coach_mentor_assignments.ended_at + end_reason`. Two reason params: `p_reason` is SOC 2 audit justification (≥10 chars), `p_end_reason` is operational label stored on row (e.g. `mentor_unavailable`, `trainee_completed`). No notification in v1 (catalog doesn't include mentor_unassigned).
- `unassign_curriculum(p_assignment_id, p_reason)` — stamps `user_curriculum_assignments.status='unassigned' + unassigned_at + unassigned_by + unassigned_reason`. Historical `content_item_completions`, `quiz_attempts`, `written_submissions` preserved (CC7.2 audit retention). No notification in v1.

### 27.6 Pre-existing tables discovered during Phase 3.5 recon

Both tables existed before Group C work began and do not need to be created:

- `coach_certification_actors` — Q5 actor flow target. Existing columns: `coach_user_id`, `certification_id`, `actor_type`, `actor_email`, `actor_first_name`, `instrument_id`, `access_code`, `status`, `created_at`, `completed_at`. Phase 7 will likely add `skills_practice_content_item_id` to link actor invitations to specific skills_practice items.
- `coach_invitations` — Q4A invitation lifecycle target. Existing columns: `email`, `first_name`, `last_name`, `invited_by`, `token`, `certification_type`, `status`, `created_at`, `accepted_at`, `expires_at`. No current function creates a `coach_certifications` row on acceptance — `accept_coach_invitation` RPC remains a deferred gap.

### 27.7 Group C deferred backend gaps

These are real gaps but do not block Phase 4. Tracked so they're not lost:

1. **`accept_coach_invitation` RPC** — Q4A. Coach invitation accept does not currently create `coach_certifications` row. Build when coach-onboarding UX is in scope (likely between Phase 4 and Phase 5).
2. **Phase 7 actor flow RPCs** — Per scope, build at Phase 7.
3. **Audience tag runtime computation** — `curricula.audience_tags` text[] exists but no function resolves user-qualifying tags. Phase 5 trainee learning UI consumes; defer until Phase 5 design.
4. **content_items.config JSONB validation** — permissive v1; tighten per-item-type at Phase 4 design.
5. **Authoring CRUD pattern decision** — RPC-wrapped vs direct table writes from frontend. Phase 4 prompt-time decision.
6. **Q13 post-certification benefit hook full implementation** — currently no-op stamp.
7. **Phase 3 14-type acceptance test pass** — systematic walkthrough under impersonation deferred to a dedicated test session.

### 27.8 Locked architectural constraints carried forward

These all surfaced or were reconfirmed during Session 54:

- `apply_migration` reports success without confirming DB state — always follow with `execute_sql` verification
- Multi-statement `execute_sql` returns only the last result — split intermediate checks
- `information_schema.columns` is insufficient for CHECK constraints — always query `pg_constraint` (`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'table'::regclass`)
- PL/pgSQL `RETURNS TABLE` columns become OUT parameters shadowing same-named table columns — prefix with `out_`
- Edge Function Secrets not readable from Postgres; vault is. When credential routing matters, prefer vault.
- `pg_net` schema is `extensions`, not `public`; call `extensions.net.http_post(...)` or rely on `search_path` including extensions (default Supabase posture does)
- `auth.getClaims` is the canonical JWT verification method
- `deploy_edge_function` requires `verify_jwt: false` passed explicitly every time
- Two sequential Anthropic Opus calls cannot be bundled in one Edge Function — Supabase's ~150s timeout ceiling forces split

## 28. Group C Phase 4 prep — backend deltas (Session 55)

### 28.1 Notification catalog additions for unassign flows

Three new notification types added to `notification_types_catalog` and wired into `compose_notification_email` + their source RPCs:

- `curriculum_unassigned` (category `learning`, important, both channels, user_configurable=true) — fired by `unassign_curriculum` to the trainee.
- `mentor_unassigned_trainee` (category `mentor_review`, important, both channels, user_configurable=true) — fired by `unassign_mentor` to the trainee.
- `mentor_unassigned_mentor` (category `mentor_review`, important, both channels, user_configurable=true) — fired by `unassign_mentor` to the mentor.

`unassign_mentor` therefore now writes **two** `notify_user` calls per invocation (one per role), distinct dedup_keys, distinct templates. This was a deliberate split (Option Y from Session 55 design) so trainees and mentors can independently configure their unassign notification preferences.

Dedup_key shape: `<notification_type>:<assignment_id>`.

### 28.2 Pattern: separate catalog types for separate audiences on the same event

When a single DB event fires notifications to multiple audiences with different framings (trainee being informed vs mentor being informed), create one catalog type per audience rather than one type with a `recipient_role` payload field. Reasons:

- Users can independently configure preferences per role
- `compose_notification_email` stays a clean `CASE notification_type` dispatch with no payload-branching inside a single WHEN clause
- Auditability: `user_notifications` rows carry distinct notification_type values that match the recipient's role at a glance

Cost: one extra catalog row per audience. Negligible.

### 28.3 Verification pattern for new compose_notification_email branches

After adding a WHEN clause to `compose_notification_email`, smoke-test by direct invocation:

```sql
SELECT subject FROM compose_notification_email(
  '<any-uuid>'::uuid,
  '<new_notification_type>',
  '<minimum-payload-shape>'::jsonb,
  '<test-full-name>'
);
```

This catches typos in subject lines and payload key references without firing a real notification. Session 55 ran this for all 3 new types pre-Phase-4-build.

### 28.4 content_items per-type CHECK constraints

Phase 1 (Session 54) shipped `content_items` with value-validity CHECKs only (enum membership, range bounds). Per-type required-field enforcement (e.g., "if item_type='video' then video_source_type IS NOT NULL") was NOT shipped. Migration 02 retrofitted both presence and cleanup CHECKs:

**Presence CHECKs (7)** — one per pre-lesson_blocks item_type. Pattern: `CHECK (item_type <> 'X' OR (<required fields IS NOT NULL>))`.

**Cleanup CHECKs (7)** — one per item_type. Pattern: `CHECK (item_type = 'X' OR (<other-type fields IS NULL>))`. Prevents stale per-type data on type-changed rows.

**Combined effect**: a `content_items` row of `item_type='video'` must have non-null video fields AND null everything-else. A `quiz` row must have non-null quiz fields AND null everything-else. And so on.

**Cleanup CHECKs apply across all 8 item_types** including `lesson_blocks` (Migration 03 added `lesson_blocks` to the item_type enum, so the cleanup CHECKs now require lesson_blocks rows to have all other item-type fields null — they do by default since nothing per-type is needed for lesson_blocks at the content_items layer; per-lesson content lives in the `lesson_blocks` table).

**Architectural decision: dual-layer enforcement.** Presence is enforced by both the RPC wrapper (friendly errors) and the DB (defense in depth). Direct-SQL ops by super admins bypassing the RPC still cannot create malformed rows. This matches the SOC 2 standing rule from Session 54.

### 28.5 lesson_blocks infrastructure (Phase 4 Rise-like authoring foundation)

Decision: build Rise-style lesson authoring as an 8th `content_items.item_type` value (`lesson_blocks`) plus a child `lesson_blocks` table holding ordered, typed blocks for one lesson.

**`lesson_block_types` lookup table** (Option C pattern, matches `super_admin_action_types`):
- PRIMARY KEY block_type text
- category text CHECK in ('content', 'display_interactive', 'interactive', 'scored')
- is_interactive, is_scored, description, is_v1_active

**17 v1 block types seeded** (4 categories):

- **content (7)**: text, heading, image, video_embed, divider, quote, list
- **display_interactive (4)**: callout, stat_callout, statement_a_b, embed_audio
- **interactive (5)**: tabs, flashcards, accordion, button_stack, scenario
- **scored (1)**: knowledge_check

Adding an 18th block type is a single `INSERT INTO lesson_block_types` row + frontend renderer + (optional) editor form. No DDL.

**`lesson_blocks` table**:
- id uuid PK
- content_item_id uuid FK → content_items.id ON DELETE CASCADE
- block_type text FK → lesson_block_types.block_type ON UPDATE CASCADE ON DELETE RESTRICT
- display_order integer (>= 0)
- config jsonb DEFAULT '{}' — per-block-type data (e.g., for tabs: `{tabs: [{label, body_markdown}]}`)
- created_at, created_by, updated_at, updated_by, archived_at

**Indexes**:
- UNIQUE (content_item_id, display_order) WHERE archived_at IS NULL — enforces dense ordering on active blocks
- (content_item_id, display_order) WHERE archived_at IS NULL — trainee renderer hot path

**RLS (two policies)**:
- `lesson_blocks_super_admin_write`: FOR ALL TO authenticated, USING(super_admin), WITH CHECK(super_admin AND NOT public.is_impersonating()) — Standing Rule 2 (Session 54)
- `lesson_blocks_trainee_read`: FOR SELECT TO authenticated, USING(archived_at IS NULL AND EXISTS active curriculum assignment chain)

**`content_items.lesson_completion_mode` column**:
- text, nullable for non-lesson_blocks rows
- CHECK: when item_type='lesson_blocks' must be NOT NULL and IN ('scroll_and_checks', 'explicit_continue'); when item_type<>'lesson_blocks' must be NULL
- Both modes selectable per-content-item by the author. Default in UX layer: `explicit_continue`.

### 28.6 Phase 4 authoring CRUD RPC catalog (10 RPCs)

All SECURITY DEFINER, all gated by `assert_super_admin()` + `assert_impersonation_allows('permission_change')`. All require `p_reason` with min 10 chars (SOC 2 CC7.2 audit justification). All write to `super_admin_audit_log` via `log_super_admin_action()` using the 14 new content_authoring action_types seeded in Migration 04a.

**Pattern locked**: every authoring RPC follows the same template — auth → super_admin → impersonation gate → input validation → write + audit (+ notify if applicable) → return as jsonb.

**RPC catalog**:

| RPC | Action types | Notes |
|---|---|---|
| `upsert_certification_path` | certification_path_created/updated | Unified create+update; create when p_id IS NULL |
| `archive_certification_path` | certification_path_archived | Soft-delete via archived_at, also sets is_published=false |
| `upsert_curriculum` | curriculum_created/updated | Handles curriculum row AND optional certification_path_curricula attachment (single transaction) |
| `archive_curriculum` | curriculum_archived | Soft-delete |
| `upsert_module` | module_created/updated | Handles module row AND optional curriculum_modules attachment |
| `archive_module` | module_archived | Soft-delete |
| `upsert_content_item` | content_item_created/updated | Polymorphic; takes `p_type_config jsonb` envelope + extracts per-type fields. **Forbids item_type changes on existing rows** — delete + recreate instead |
| `archive_content_item` | content_item_archived | Soft-delete via archived_at |
| `reorder_content_items` | content_items_reordered | Bulk-update display_order; validates array covers ALL active items in module |
| `replace_lesson_blocks` | lesson_blocks_replaced | Atomic-replace pattern: archives all current active blocks, inserts new array in order |

### 28.7 replace_lesson_blocks atomic-replace pattern

The lesson_blocks editor sends the entire block array on Save, not per-block CRUD. The RPC:

1. Validates every block's block_type up front (before any writes) against `lesson_block_types`
2. Archives all currently-active lesson_blocks rows for the content_item (UPDATE … SET archived_at = now())
3. Inserts new rows with display_order = array index

Trade-off: no per-block audit history (only "blocks replaced at T"). Acceptable for authoring (versus a regulated content-versioning workflow). If per-block diff history becomes needed, can be added internally to this RPC without changing API contract.

### 28.8 Polymorphic content_item upsert: server-side validation

`upsert_content_item` extracts per-type fields from `p_type_config` JSONB via per-type CASE branches and validates required-by-type presence BEFORE inserting. Friendly error messages like `video_required_fields_missing: video_source_type and video_source_id` instead of raw `23514` CHECK violation messages.

Defense-in-depth: even if the RPC's per-type validation is bypassed (impossible from the application layer, but for direct-SQL super admins), the DB-level CHECKs from Migration 02 still fire.

`p_type_config` envelope structure varies by item_type:

```jsonc
// video
{"video_source_type": "mux", "video_source_id": "abc123", "video_completion_threshold_pct": 95}

// quiz
{"quiz_pass_threshold_pct": 80, "quiz_show_correct_mode": "after_pass"}

// written_summary
{"written_completion_mode": "auto", "written_min_chars": 500, "written_max_chars": 2000}

// skills_practice
{"skills_signoff_required": "both_required", "skills_actor_invitation_required": false, "skills_optional_attachment": true}

// file_upload
{"file_upload_max_bytes": 10485760, "file_upload_allowed_extensions": ["pdf","docx"]}

// external_link
{"external_url": "https://..."}

// live_event
{"event_scheduled_at": "2026-06-01T15:00:00Z", "event_external_id": "zoom-12345"}

// lesson_blocks (no type_config needed; lesson_completion_mode goes in separate p_lesson_completion_mode param)
{}
```

### 28.9 Impersonation gate coverage on all Phase 4 backend

Every Phase 4 prep RPC calls `assert_impersonation_allows('permission_change')`. This means even a super admin in act-mode impersonation cannot create, edit, archive, reorder, or replace authoring content. The category `permission_change` is denylisted unconditionally in `assert_impersonation_allows` (Session 49 lockdown). This is Standing Rule 2 from inception.


## 29. AI authoring infrastructure (Session 55)

### 29.1 Tables added

**`ai_authoring_context`** — versioned context blocks injected into AI authoring Edge Function system prompts.
- `id`, `context_name`, `version`, `body_markdown`, `is_active`, `notes`, audit fields
- UNIQUE constraint: only one active version per `context_name` at a time (partial index)
- 5 v1 context blocks seeded: `platform_overview`, `framework_terminology`, `scientific_foundations`, `output_format_rules`, `guardrails`
- RLS: super admin read/write only, impersonation gate from inception (Standing Rule 2)
- Service-role read used by Edge Functions to fetch active context for injection

**`ai_authoring_voice_presets`** — voice/tone presets for AI authoring drafts.
- `id`, `preset_key`, `display_name`, `short_description`, `example_paragraph`, `voice_guidance_markdown`, `display_order`, `is_active`, `is_system`, audit fields
- 5 system presets seeded:
  1. `conversational_coach` — warm, second-person, shared experience
  2. `tactical_direct` — short sentences, numbered steps, action-oriented
  3. `reflective_inquiry` — questions over assertions, encourages introspection
  4. `academic_grounded` — formal, citation-aware, precise terminology
  5. `scenario_storyteller` — paints scenes, concrete client encounters
- `is_system=true` marks seed presets (immutable in v1 UX); `is_system=false` reserved for future user-added presets
- "Custom" voice handled at request layer via `voice_preset_key='custom'` + free-text body fields; no row needed
- RLS: super admin read/write only, impersonation gate from inception

### 29.2 Action type added

`ai_authoring_draft_generated` — category `content_authoring`, NOT `requires_justification` (low friction during drafting), NOT `is_mutation` (no DB write of authored content; the downstream `content_item_created/updated` covers that), `denylist_during_impersonation=true`.

Logged by AI authoring Edge Functions each time a draft is generated, regardless of whether the author accepts it. Provides usage audit without polluting `content_authoring` action stream with abandoned drafts.

### 29.3 Voice handling pattern (sticky default within a lesson)

UX rule locked Session 55: voice is selected per-draft, but each lesson_blocks content_item remembers the last voice used; subsequent draft requests within the same lesson pre-fill that voice. Author can override at any draft. Voice does NOT persist as a column on `content_items` — it's a frontend-only sticky default in the lesson editor's local state.

Reason for not persisting: a "lesson voice" attribute would imply all blocks in the lesson MUST share a voice, which is too rigid. Sticky default gets the cohesion benefit without the rigidity.

### 29.4 Context-injection strategy (Option I, deferred Option II to Phase 4.5)

Option I shipped: `ai_authoring_context` table holds versioned ~500-word blocks injected verbatim into Edge Function system prompts. Refining the AI voice/framing requires editing rows, not redeploying code.

Option II (RAG against books, podcast transcripts, papers, shipped content) deferred to Phase 4.5 as a separate workstream. Both options use the same injection point in the Edge Function code — switching is additive, not breaking.

### 29.5 AI Edge Functions — SHIPPED Session 56

Three Edge Functions deployed v1 ACTIVE Session 56 against the source bodies preserved in the Session 55 → 56 handoff artifact `ai-edge-functions-session-55-drafts.md`:

- `draft-lesson-block` v1 — generates a single block matching the requested `block_type`'s config schema; supports 17 v1 block types via internal `BLOCK_SCHEMAS` dispatch; calls `claude-opus-4-7`; `MAX_OUTPUT_TOKENS = 3000`
- `scaffold-lesson` v1 — generates a full ordered lesson_blocks array (mixed block types); calls `claude-opus-4-7`; `MAX_OUTPUT_TOKENS = 8000`; validates every returned block has `{block_type, config}` shape and `block_type` is in the allowed set
- `draft-text` v1 — generic short-prose drafts for description / title / overview fields; supports refinement mode (passes `current_value`); 7 supported `target_field` keys via `FIELD_SPECS` dispatch; calls `claude-opus-4-7`; `MAX_OUTPUT_TOKENS = 1500`

All three share identical auth/gate/context-fetch/voice-resolution/Anthropic-call/audit-log scaffolding:

- `verify_jwt: false` at the deploy layer; JWT verified manually inside the function via `callerClient.auth.getClaims()` (canonical Class A pattern per arch-ref §10.7)
- Super admin gate: `account_type !== "brainwise_super_admin"` returns 403 `super_admin_required`
- Impersonation gate: `enforceImpersonationGate(callerClient, "permission_change")` from `_shared/impersonation_gate.ts`. Both observe and act mode blocked because `permission_change` is denylisted globally. Returns 403 `IMPERSONATION_DENIED`.
- Context: `ai_authoring_context` rows fetched via service-role client and concatenated in canonical order (`platform_overview` → `framework_terminology` → `scientific_foundations` → `output_format_rules` → `guardrails`) for system prompt injection
- Voice: `voice_preset_key` resolved from `ai_authoring_voice_presets` (`is_active = true`), or `'custom'` falls through to `custom_voice_guidance` + `custom_voice_example` in request body
- Anthropic call: `https://api.anthropic.com/v1/messages` with `anthropic-version: 2023-06-01`, system + single user message
- Output cleaning: code-fence stripping (` ```json ... ``` `) before `JSON.parse`; `draft-text` also strips wrapping quotes including curly quotes
- Audit log: every successful draft writes a `log_super_admin_action` row with `action_type = 'ai_authoring_draft_generated'`; `p_after` carries function name + block_type/target_field/scaffold metadata + voice_preset_key + prompt excerpt + model
- Sanitized error envelope: stable string codes (`missing_bearer_token`, `invalid_jwt`, `super_admin_required`, `IMPERSONATION_DENIED`, `invalid_json_body`, `author_prompt_required`, `author_prompt_too_long`, `unknown_block_type`, `unknown_target_field`, `unknown_voice_preset`, `context_fetch_failed`, `anthropic_api_key_missing`, `anthropic_api_failure`, `ai_output_unparseable`, `ai_output_not_array`, `ai_output_empty_array`, `ai_output_empty`, `internal_error`)

Differences across the three: output shape (single object vs array vs plain text), per-function schema validation depth, output token budget. No other behavioral divergence.

**Deploy parameters used** (canonical pattern for future shared-import functions, see §23.7):

- `entrypoint_path: "<function-name>/index.ts"` (NOT naked `"index.ts"`) — the subdirectory prefix is required so `../_shared/...` traversal resolves correctly under the bundle's `source/` root
- `files`: array containing the function source at `<function-name>/index.ts` AND `_shared/impersonation_gate.ts` (verbatim from production `set-account-type` v43)
- `verify_jwt: false`

**Verification performed Session 56**:

- Anonymous probe (no Authorization header): all three return HTTP 401 `missing_bearer_token` ✓
- Source diff against canonical drafts in `ai-edge-functions-session-55-drafts.md`: structural landmarks match (ANTHROPIC_MODEL, MAX_OUTPUT_TOKENS, BLOCK_SCHEMAS/ALLOWED_BLOCK_TYPES/FIELD_SPECS dispatch tables, super_admin gate string, impersonation gate category, missing_bearer_token error code) ✓
- Bundle integrity: `get_edge_function` confirms each function's deploy package includes `_shared/impersonation_gate.ts` alongside `<function-name>/index.ts` ✓
- Prerequisite data: 5 active `ai_authoring_context` rows, 5 active `ai_authoring_voice_presets` rows, `ai_authoring_draft_generated` action_type seeded, 2 brainwise_super_admin users available for live testing ✓

**Deferred verification** (requires live super-admin session token, lands when AI buttons land in Lovable Prompt 5):

- Super-admin authenticated, valid payload → 200 with parsed AI output and audit row written
- Super-admin authenticated during impersonation → 403 `IMPERSONATION_DENIED`
- Non-super-admin authenticated → 403 `super_admin_required`

## 30. Branding recon — standing protocol (Session 55)

### 30.1 The rule

Before any Lovable prompt is written, the recon checklist requires three passes:

1. **Backend recon** — schema, RLS, RPCs, Edge Functions verified end-to-end (existing protocol, no change)
2. **Frontend recon** — existing components, route patterns, hooks, shared utilities cached locally (existing protocol, no change)
3. **Branding recon (NEW)** — actual brand tokens, typography, and design patterns pulled from source rather than assumed (locked Session 55)

The branding recon is non-negotiable. userMemories contains brand color hex values but says nothing about how they're exposed in the codebase, which token system is canonical for which surface, or what conventions existing pages already follow.

### 30.2 What branding recon pulls

For internal-admin pages (super-admin/* and similar):

- `tailwind.config.ts` — fontFamily mapping, boxShadow tokens, Tailwind extensions
- `src/index.css` — shadcn HSL token values, `--bw-*` hex token mirror, dark-mode overrides
- `src/styles/marketing-tokens.css` — full brand palette (mustard, plum, forest, all shade variants), `--bw-marketing-root` scope rules, button system classes (`.bw-btn-*`)
- One or two cached super-admin or internal-admin pages to confirm:
  - h1/h2 style conventions (heading classes, font-display vs font-sans)
  - Badge variant patterns (status pills: which variants map to which states)
  - Button variant patterns (CTA vs secondary vs ghost)
  - Card and layout conventions

### 30.3 The two token systems

The codebase has two distinct token systems serving distinct surfaces:

**Shadcn HSL tokens** (`bg-primary`, `bg-accent`, `bg-muted`, `text-foreground`, `text-muted-foreground`, etc.):
- Used by app chrome including super-admin/*, /dashboard, /coach, /learning
- Defined in `src/index.css` `:root` block
- Mapped to brand colors via HSL conversions (`--primary: 211 94% 11%` = navy, `--accent: 25 92% 53%` = orange)
- Tailwind utilities resolve via `tailwind.config.ts` color block

**Marketing tokens** (`var(--bw-navy)`, `var(--bw-orange)`, `.bw-btn-primary`, etc.):
- Used by public marketing site under `.bw-marketing-root` scope
- Defined in `src/styles/marketing-tokens.css`
- Raw hex variables (not HSL), button system classes (`.bw-btn-*`), elevation/shadow/spacing tokens
- NOT exposed as Tailwind utility classes

**Rule: never mix the two systems in one component.** Internal admin tools use shadcn HSL tokens; public marketing pages use marketing tokens with `.bw-marketing-root` scope. If a brand color is needed in an admin tool that doesn't have a shadcn equivalent (e.g., mustard for NAI Saturation), use inline style with the `--bw-*` variable: `style={{ color: 'var(--bw-mustard)' }}`.

### 30.4 Brand system gap noted Session 55

`--bw-mustard #7a5800` (NAI Saturation color locked Session 38/39 per userMemories) does NOT exist as a variable in either `index.css` or `marketing-tokens.css`. NAI components must be referencing the hex inline. Build queue item added: "Add `--bw-mustard: #7a5800` to marketing-tokens.css + index.css mirror; audit NAI components for inline hex references and refactor to use the token."

### 30.5 Font convention for internal admin tools

Verified Session 55 against `super-admin/Users.tsx`, `super-admin/PlatformHealth.tsx`, `super-admin/CreateOrganization.tsx`: **no `font-display` reach-throughs in any super-admin page**. All h1/h2 elements use the default `font-sans` (Montserrat). Heading typography varies slightly across pages (`text-2xl font-semibold` vs `text-2xl font-bold` vs `text-2xl font-semibold tracking-tight`), but Montserrat is universal.

Convention: **for internal admin tools, do not specify `font-display` on headings — it deviates from existing pattern.** Reserve `font-display` (Poppins) for public marketing site only.

userMemories had this backwards ("Montserrat headings, Poppins body"). The actual `tailwind.config.ts` mapping is `sans: ['Montserrat']` (default body) + `display: ['Poppins']` (marketing site headings). userMemories will be updated in a future session via memory_user_edits.

### 30.6 Status badge pattern for internal admin tools

Verified Session 55 against `super-admin/Users.tsx` (accountTypeBadgeVariant helper):

Stock shadcn Badge variants only — no inline color styles for status pills. Pattern:
- Most-prominent / "active" state → `<Badge>` (default = navy primary)
- Muted / "in-progress" state → `<Badge variant="secondary">` (cream)
- Destructive / "blocked" state → `<Badge variant="destructive">` (red)
- Subtle / "neutral" state → `<Badge variant="outline">` (transparent + border)

Applied Session 55 in Lovable Prompt 1 for Published/Draft pills: Published → default (navy), Draft → secondary (cream).

## 31. invite-coach hardening (Session 55)

### 31.1 Diagnosis from Session 55

Cole reported a coach invitation sent to `cheryl@defineconsulting.com` on 2026-05-01 never arrived. Investigation found:

1. The `coach_invitations` row had been created successfully (super admin RLS-allowed direct INSERT via Edge Function)
2. No corresponding row in `email_logs` for that recipient
3. Of 5 coach invitations created since April 2026, ZERO had email_logs rows — but `email_logs` table only started logging on 2026-05-09, so April invitations were before the logging window
4. Empirical test mirroring invite-coach's exact fetch pattern to send-email succeeded (200 OK with Resend message ID). The Edge Function Secret was correctly configured.
5. Cole's later re-invite of Cheryl through the Coach Management UI worked end-to-end (email_logs row written, email delivered, accepted by Cheryl)

Conclusion: the May 1 failure was either a transient infrastructure issue or a pre-May-2-deploy bug that has since been resolved. Cannot fully diagnose without May 1 email_logs data.

### 31.2 Structural problems found in invite-coach v10 (still present at Session 55 start)

Independent of the May 1 failure, invite-coach v10 had three real structural problems that warranted hardening:

**(a) Swallowed email send failures.** The function called send-email via fetch and only logged a console warning on non-OK responses. The caller-facing response treated row-insert success as overall success regardless of email outcome. Failure modes (network blip, send-email returning 401, send-email returning 4xx-validation) were not surfaced to the frontend.

**(b) Resend button was broken.** `handleResend` in `src/pages/super-admin/CoachManagement.tsx` called invite-coach with the same email as the existing pending row. invite-coach's dedup guard returned `{success: false, error: "Pending invitation already exists for this email"}` for that recipient, and the top-level HTTP status was 207 (Multi-Status). `supabase.functions.invoke()` treats any 2xx as success (populates `data`, leaves `error` null). The frontend's `if (error) ... else success-toast` pattern silently swallowed the 207 failure. Toast said "Resent" but no email was actually re-sent.

**(c) email_logs rows from invite-coach were labeled `email_type='unknown'`, `source='unknown'`.** invite-coach didn't pass `email_type` or `source` to send-email's body, so send-email's `emailTypeForLog = email_type || "unknown"` fallback kicked in, making coach-invite emails impossible to filter from other email types in logs.

### 31.3 Schema migration applied Session 55

Added three columns to `coach_invitations` via migration `coach_invitations_email_tracking_columns`:

- `email_send_status text` — NULL / 'sent' / 'failed' (CHECK constraint enforces)
- `email_send_error text` — error message when failed
- `email_last_attempt_at timestamptz` — timestamp of last email send attempt

Plus a partial index `coach_invitations_email_send_status_idx` on (email_send_status) WHERE email_send_status = 'failed' for surfacing failed-email rows in the pending invitations list.

Backfill: accepted invitations marked `email_send_status='sent'` with `email_last_attempt_at = COALESCE(accepted_at, created_at)`. Pending and expired rows left NULL (true historical unknown).

### 31.4 invite-coach v11 changes

Five surgical changes from v10:

1. **Detects existing pending row and resends.** Instead of refusing, the function uses the existing row's token, first_name, last_name, certification_type and proceeds to send the email. Single function now handles both create-new and resend paths. Mode tag in result: `'created' | 'resent' | 'failed' | 'rejected'`.

2. **Passes `email_type: 'coach_invitation'` and `source: 'invite-coach'`** to send-email so email_logs rows are properly labeled.

3. **Parses send-email response body** and treats a non-2xx response OR a 2xx with explicit `success: false` as a hard per-recipient failure.

4. **Treats email send failure as hard per-recipient failure** — returns `{success: false, error: emailSendError}` instead of swallowing.

5. **Persists email_send_status, email_send_error, email_last_attempt_at** on the `coach_invitations` row after every email attempt (success or failure).

HTTP status semantics: 200 (all success), 207 (mixed), 400 (all failed), 500 (transport/auth error). Frontend MUST inspect `data.results[]` regardless of status.

Verification: a test invitation row was inserted, the Resend button was clicked from the UI, and all four hardening goals were verified — `email_send_status='sent'` written to row, email_logs entry created with `email_type='coach_invitation'`/`source='invite-coach'`, Resend message ID returned, no duplicate row created. Test row cleaned up after verification.

### 31.5 Frontend hardening (Lovable prompt at Session 55 close)

The Lovable prompt at session close updates four call sites in `src/pages/super-admin/CoachManagement.tsx` to use a new shared helper `inspectInviteCoachResponse` that inspects `data.results[].success` for per-recipient outcomes. Plus:

- Surfaces email send failures via destructive-variant toasts with the actual error message
- Adds an Email Status column to the pending invitations table (Sent/Failed/Pending badges)
- Failed badge has `title` attribute tooltip showing `email_send_error`
- Resend button becomes "Retry Email" with destructive styling when last send failed

Prompt drafted Session 55, ready to land in Session 56.

### 31.6 Build queue items surfaced by this work

1. **MEDIUM**: Audit ALL Edge Function callers in the frontend for the same `data.results[]` inspection bug. This pattern is likely repeated for departure emails, assessment invitations, bulk operations.
2. **MEDIUM**: Add `assert_impersonation_allows('outbound_user_communication')` to invite-coach. Currently has only manual super_admin check (Tier 2 rollout item per §21.10).
3. **LOW**: Delete the throwaway `diag-env-check` Edge Function (id `c57588a3-910f-4ee8-8102-4e33d8829229`) from Supabase Dashboard. MCP has no delete-function method.
4. **LOW**: invite-coach v11 retains the v10 manual super_admin check via service-role client + auth.getUser. Migrate to canonical `auth.getClaims` pattern + assert_super_admin RPC when the impersonation gate is added.


## 32. Soft-archive slug uniqueness (Session 56)

### Problem

The three authoring-content tables with slugs (`certification_paths`, `curricula`, `modules`) all use soft-archive (`archived_at` timestamp). They originally enforced slug uniqueness with global UNIQUE constraints (`*_slug_key`). Result: archiving a row left its slug occupying the constraint forever, blocking the author from recreating the same slug on a fresh row.

Discovered Session 56 when Cole archived the PTP-Coach cert path and tried to recreate it, hitting a 23505 toast that incorrectly suggested the slug was in use by an active row.

### Fix shipped Session 56

Migration `slug_unique_only_among_active_for_authoring_tables`:

```sql
ALTER TABLE public.certification_paths DROP CONSTRAINT certification_paths_slug_key;
CREATE UNIQUE INDEX certification_paths_slug_active_uniq
  ON public.certification_paths (slug) WHERE archived_at IS NULL;

ALTER TABLE public.curricula DROP CONSTRAINT curricula_slug_key;
CREATE UNIQUE INDEX curricula_slug_active_uniq
  ON public.curricula (slug) WHERE archived_at IS NULL;

ALTER TABLE public.modules DROP CONSTRAINT modules_slug_key;
CREATE UNIQUE INDEX modules_slug_active_uniq
  ON public.modules (slug) WHERE archived_at IS NULL;
```

Matches existing precedent in `lesson_blocks_active_order_uniq`. `content_items` doesn't have a slug column so no change there.

### Semantics after the fix

- Two ACTIVE rows with same slug → still rejected with 23505 (correct)
- Archived row + new active row with same slug → coexist (the desired behavior)
- 23505 error code unchanged — frontend `mapRpcError` still maps to "Slug already in use" for the active-active collision case which is the only case where 23505 now fires
- Archived rows retain their original slug verbatim, no rename/suffix needed — keeps audit log readable

### Standing pattern for future authoring tables

Any new authoring-content table with `slug` + `archived_at` should use the partial-index pattern, never a global UNIQUE constraint. Established as the convention Session 56.

## 33. PostgREST FK-disambiguation in embedded selects (Session 56)

### Problem

When a child table has two or more foreign keys pointing to the same parent table, PostgREST's implicit embed cannot disambiguate which FK to traverse. The result is silently null embeds and dropped rows downstream.

Discovered Session 56 in `AttachedCurriculaSection`. `certification_path_curricula` has two FKs to `curricula`:
- `curriculum_id` → `curricula(id)` (the actual attachment)
- `prerequisite_curriculum_id` → `curricula(id)` (the prerequisite chain)

The query `select("id, display_order, is_required, curriculum:curricula(...)")` returned rows where `curriculum` was null. The downstream `.filter(r => r.curriculum && !r.curriculum.archived_at)` dropped everything, producing a false "No curricula attached yet" empty state even though the join row existed in the database.

### Standing fix pattern

Any embedded select traversing a child→parent relationship where the child table has multiple FKs to that parent MUST use explicit FK-column-name disambiguation:

```ts
.select("id, ..., curriculum:curricula!curriculum_id(id, name, ...)")
```

The `!curriculum_id` shorthand tells PostgREST: use the FK whose source column is `curriculum_id`. More robust than the constraint-name form (`!certification_path_curricula_curriculum_id_fkey`) because it survives FK constraint renames.

### Standing recon protocol for Prompts 4+

When writing any new join-table embed, the recon checklist now includes:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.<join_table>'::regclass
  AND contype = 'f'
  AND confrelid = 'public.<parent_table>'::regclass;
```

If more than one row returns, the embed MUST use `!<column_name>` disambiguation. If exactly one row, the implicit embed is safe but the explicit form is still preferred for grep-ability and future-proofing.

Same applies to:
- `curriculum_modules` once added (likely will have a `curriculum_id` + `prerequisite_curriculum_id` mirror pattern)
- Any future join table linking content items, lesson blocks, etc., that supports prerequisite or sequence relationships

## 34. Content authoring tree: "All" sections include attached items (Session 56)

### Pattern locked

The left-tree navigator in `/super-admin/content-authoring` uses three sections: "Certification Paths" (hierarchical), "All Curricula" (flat list of every non-archived curriculum), "All Modules" (flat list of every non-archived module).

Previously named "Standalone Curricula" / "Standalone Modules" with `!linkedCurriculumIds.has(c.id)` / `!linkedModuleIds.has(m.id)` filters that excluded attached items. Renamed and unfiltered Session 56 via Prompt 3.4 — the same curriculum now appears both nested under its cert path AND in the flat "All Curricula" list. Selection state shares `nodeKey` (`cu:<id>`), so clicking either highlights both.

### Selection ancestor auto-expand

When `selectedKey` changes to a `cu:<uuid>` node, `selectNode` looks up the curriculum's parent cert paths via the `certPathsByCurriculum` Map (built from `cpcLinks`) and adds `cp:<parent-id>` to the `expanded` Set. Same for `mo:<uuid>` selections: looks up parent curricula via `curriculaByModule`, expands those, AND chains to expand each parent curriculum's parent cert paths.

This ensures clicking an item from anywhere in the tree (attached row's pencil button, "All Curricula" flat list, deep-link URL) surfaces its hierarchical context in the "Certification Paths" section.

Selection only ADDS to `expanded`; manual collapse via chevron remains a separate user concern. Auto-expand is harmless when ancestors are already expanded.

### Forward-compat for Prompts 4+

When Module editor lands (Prompt 4), the existing tree logic already shows all modules in "All Modules" regardless of attachment status. Module-curriculum attachment writes will need to invalidate analogous AttachedModulesSection caches (when that section is built), and `cm_links` reverse-lookup is already built into the parent component's `curriculaByModule` Map.

When Content Item editor lands (Prompt 5), content items don't appear in the tree top-level sections (they're always under their parent module). So no "All Content Items" section. Tree depth caps at 4 levels: cp → cu → mo → ci.

## 38. Prompt 5.6 native asset upload infrastructure (Session 58)

### Buckets

- **`lesson-assets`** — super-admin authored media (images, videos, audio, documents). Private bucket, `file_size_limit = 5 GB`, 18 MIME types allowed. service_role-ALL policy on storage.objects + four super-admin policies (added §39).
- **`asset-archives`** — daily ZIP backups of soft-archived assets before hard-delete. Private, ZIP-only MIME, service_role-only.

### Tables

**`content_assets`** — asset identity row, one per logical asset.
- `id` PK, `asset_kind` (image/video/audio/document), `status` (pending/active/archived)
- `current_version_id` FK to `content_asset_versions(id)` (DEFERRABLE INITIALLY DEFERRED for circular-FK insert)
- `is_library_asset` boolean + `library_name` text + `library_tags` text[]
- `uploaded_by`, `created_at`, `updated_at`, `updated_by`
- `archived_at`, `archive_reason` (content_item_archived / lesson_block_replaced / replaced_by_author / manual_archive / orphaned_pending_expired)
- `archive_email_sent_at` (stamped by the sweep Edge Function after ZIP+email)

**`content_asset_versions`** — actual bytes + per-version metadata.
- `id` PK, `asset_id` FK ON DELETE RESTRICT, `version_number` (integer > 0)
- `bucket` (default `lesson-assets`), `path`, `mime_type`, `size_bytes` (> 0), `original_filename`
- `generation_provenance` jsonb (null for human upload, populated for Phase 4.5a/b/c AI-generated assets)
- `uploaded_by`, `created_at`, `archived_at`
- UNIQUE (bucket, path); UNIQUE (asset_id, version_number).

**`content_asset_refs`** — usage join table.
- `id` PK, `asset_id` FK, `content_item_id` OR `lesson_block_id` (exactly one via CHECK), `ref_field` text
- `created_at`, `created_by`, `archived_at`

### Path conventions

- Content-item-scoped: `<content_item_id>/<asset_id>.<ext>`
- Lesson-block-scoped: `<content_item_id>/<lesson_block_id>/<asset_id>.<ext>`
- Library-only: `library/<asset_id>.<ext>`
- New version of library asset: `library/<asset_id>__v<N>.<ext>`

### Per-asset_kind ceilings

| asset_kind | Size ceiling | MIME allowlist |
|---|---|---|
| image | 20 MB | jpeg, png, webp, gif, svg+xml, avif |
| video | 5 GB | mp4, webm, quicktime |
| audio | 100 MB | mpeg, wav, webm, ogg, mp4 |
| document | 50 MB | pdf, docx, xlsx, pptx |

### Action types (10 new under `category = 'content_authoring'`)

`asset_uploaded`, `asset_upload_failed`, `asset_replaced`, `asset_archived`, `asset_ref_created`, `asset_ref_archived`, `library_asset_promoted` (denylist_during_impersonation = true), `asset_sweep_completed`, `asset_archive_email_sent`, `asset_hard_deleted` (these three system actions are denylist_during_impersonation = false).

### Core RPCs

| RPC | Purpose |
|---|---|
| `request_asset_upload` | Pre-upload validation + registry creation. Mode dispatch (content_item / lesson_block / library_only). Returns `{asset_id, version_id, bucket, path, signed_upload_url, upload_token, mode}`. |
| `finalize_asset_upload` | Post-byte-upload activation. Verifies storage.objects row at expected path with expected size. Success: flip pending→active, audit `asset_uploaded`. Failure: archive registry + audit `asset_upload_failed`, return `{success: false}` (NOT raise — RAISE rolls back side-effect updates). Edge Function translates to HTTP 422. |
| `create_asset_ref` | Link an existing active asset to an additional location. Audit `asset_ref_created`. |
| `archive_asset_ref` | Soft-delete a single ref. Auto-archives the underlying asset if non-library AND zero active refs remain. |
| `promote_to_library` | Flip `is_library_asset=true` on active asset. |
| `request_new_asset_version` | Library-only. Creates new version row without flipping `current_version_id`. |
| `finalize_new_asset_version` | Library-only. Verifies new version's storage object, flips `current_version_id`. |
| `replace_asset` | Non-library only. Atomic: re-point all active refs from old to new, archive old asset. |
| `archive_asset_manual` | Explicit archive. Requires zero active refs OR `force=true`. |

### Amended RPCs

**`archive_content_item`** — now calls `_cascade_archive_asset_refs_for_content_item` after content_item archive, which archives all `content_asset_refs` pointing to the content_item OR to any of its `lesson_blocks`, then auto-archives non-library assets whose ref count drops to zero.

**`replace_lesson_blocks`** — does two new things:
1. **Outgoing cascade**: collects outgoing `lesson_block` IDs before archiving them, calls `_cascade_archive_asset_refs_for_lesson_blocks`.
2. **Incoming asset_ref creation**: each new lesson_block whose `config` includes `asset_id` (UUID string) gets a new `content_asset_refs` row with `ref_field = '<block_type>_asset'`. Validates the referenced asset exists and is active BEFORE any mutation.

LessonBlocksEditor (Prompt 6) MUST follow the `config.asset_id` convention.

### Sweep infrastructure

- **`reap_pending_uploads()`** — hourly cron `7 * * * *`. Archives pending assets >24h old.
- **`get_assets_due_for_archive_email()`** — STABLE. Returns archived assets >15 days old where `archive_email_sent_at IS NULL` and `archive_reason <> 'orphaned_pending_expired'`. GRANTED to service_role.
- **`mark_archive_email_sent`** — stamps the batch + writes two audit rows (`asset_archive_email_sent`, `asset_sweep_completed`).
- **`run_asset_hard_delete()`** — daily cron `0 5 * * *`. Hard-deletes assets where `archive_email_sent_at <= now() - 7 days` OR orphans where `archived_at <= now() - 7 days`.

### Edge Functions deployed Session 58

| Function | Auth | Purpose |
|---|---|---|
| `request-asset-upload` v1 | Class A (getClaims JWT) | RPC + signed upload URL via service client. `verify_jwt: false` (we verify via getClaims). |
| `finalize-asset-upload` v2 | Class A | v1 used RAISE EXCEPTION (rolled back side-effects). v2 RPC returns `{success: false}`; Edge Function returns HTTP 422 on failure. |
| `run-asset-archive-sweep` v1 | Class C (X-Dispatcher-Secret) | Daily 04:30 UTC. ZIP via npm:jszip@3.10.1, invokes send-email via INTERNAL_FUNCTION_SECRET, recipient cbastian@brainwiseenterprises.com. |

### pg_cron schedule additions

- `reap_pending_uploads_hourly` — `7 * * * *` — SQL-direct
- `run_asset_archive_sweep_daily` — `30 4 * * *` — net.http_post to Edge Function with X-Dispatcher-Secret from vault
- `run_asset_hard_delete_daily` — `0 5 * * *` — SQL-direct

### Two-step browser-direct upload protocol

1. POST to `/functions/v1/request-asset-upload` with file metadata + reason
2. Receive `{signed_upload_url, upload_token, bucket, path, asset_id, ...}`
3. Browser uploads bytes directly via TUS resumable to `<project>.storage.supabase.co/storage/v1/upload/resumable` (NOT through Edge Function)
4. POST to `/functions/v1/finalize-asset-upload` with `{asset_id, reason}`
5. On 422: registry archived by RPC; surface "upload didn't complete" to user.

**TUS configuration locked Session 58 (Prompts 5.6.1 + 5.6.2):**
- Endpoint: direct storage hostname `https://<project>.storage.supabase.co/storage/v1/upload/resumable`
- Auth: `Authorization: Bearer <user session JWT>` (NOT x-signature header — see §39)
- chunkSize: 6 MB (required minimum for Supabase TUS)
- uploadDataDuringCreation: true
- removeFingerprintOnSuccess: true
- 1-hour signed URL expiry for inline previews; 60-min expiry for trainee Pattern C reads

### Read pattern (Pattern C — bulk URL signing at lesson-fetch time)

Locked Session 58: when the trainee learning UI fetches a lesson, the lesson-fetch endpoint (Phase 5 future work) signs all asset URLs in the lesson_blocks payload with 60-minute expiry and returns them in the response. Frontend uses signed URLs directly; no per-asset Edge Function hit on render.

Trade-off accepted: a leaked URL within 60 minutes is reachable without enrollment recheck. Mitigated by short expiry, lesson-level enrollment audit, and the architectural option to promote to per-asset Edge Function reads later.

### SOC 2 posture

- Every super-admin mutation has a `super_admin_audit_log` row with reason text ≥ 10 chars.
- Three system actions (`asset_sweep_completed`, `asset_archive_email_sent`, `asset_hard_deleted`) are `requires_justification = false`.
- Authorization at three layers: RPC `assert_*` calls, RLS WITH CHECK with `is_impersonating()`, Edge Function explicit super_admin lookup.
- 22-day total recovery window (15 days soft-archive + 7-day post-email grace).
- ZIP backup emailed before hard-delete creates an external-of-Supabase backup point.

### Asset library semantics

- Library assets: `is_library_asset=true`, path `library/<asset_id>.<ext>`. Never auto-archived.
- Library versioning: `request_new_asset_version` / `finalize_new_asset_version`; updates propagate because refs point to asset_id.
- Non-library assets: exactly one version; replacement via `replace_asset`.

### Frontend preview integration (Prompt 5.6.3)

The `<FileUploadField>` component renders inline previews for the four asset_kinds:
- **Image**: signed URL → `<img>` with `aspect-video object-cover`.
- **Video**: signed URL → HTML5 `<video controls preload="metadata">` in `aspect-video bg-black` container. Browser handles poster frame.
- **Audio**: signed URL → HTML5 `<audio controls preload="metadata">` below the Music icon on sand-tone card.
- **Document**: 
  - PDF: signed URL → inline `<iframe>` at 600px height (browser's native PDF viewer)
  - DOCX/XLSX/PPTX: "Open in new tab" button only (browsers cannot render Office docs natively)
  - All document kinds: per-extension icon (`FileText`, `FileSpreadsheet`, `Presentation`) + "Open in new tab" button as fallback affordance.

Signed URL expiry for previews: 3600s (1 hour) — covers typical authoring sessions without re-signing.

### Open follow-ups

- Lesson-fetch endpoint (Phase 5) needs to bulk-sign asset URLs from lesson_blocks `config.asset_id` + content_items `video_source_id` (when `video_source_type='supabase_storage'`).
- Verify Edge Function env vars in Supabase Dashboard: `DISPATCHER_SHARED_SECRET` (verified live), `INTERNAL_FUNCTION_SECRET` (not yet exercised — first sweep with real bytes will validate).
- Phase 5 lesson-fetch must NOT sign URLs for archived asset versions; the `content_asset_versions_trainee_read` RLS policy enforces "current version only" via `ca.current_version_id = content_asset_versions.id` predicate.

## 39. storage.objects RLS for super-admin TUS uploads (Session 58)

Supplementary migration `prompt_5_6_1_super_admin_storage_rls_for_tus` added four super-admin policies on `storage.objects` for `bucket_id = 'lesson-assets'`. The existing `lesson_assets_service_role_all` policy stays in place for sweep cron access.

| Policy | Cmd | Role | Predicate |
|---|---|---|---|
| `lesson_assets_super_admin_insert` | INSERT | authenticated | bucket_id='lesson-assets' AND user is super admin AND NOT is_impersonating() |
| `lesson_assets_super_admin_select` | SELECT | authenticated | bucket_id='lesson-assets' AND user is super admin |
| `lesson_assets_super_admin_update` | UPDATE | authenticated | (USING + WITH CHECK) bucket_id='lesson-assets' AND user is super admin AND NOT is_impersonating() |
| `lesson_assets_super_admin_delete` | DELETE | authenticated | bucket_id='lesson-assets' AND user is super admin AND NOT is_impersonating() |

### Why this was needed

The TUS resumable upload endpoint at `https://<project>.storage.supabase.co/storage/v1/upload/resumable` authenticates via the standard `Authorization: Bearer <JWT>` header — verified by Supabase's auth subsystem against the user's session JWT. RLS on `storage.objects` then gates the actual INSERT/UPDATE.

The alternative auth path (signed upload tokens via `x-signature` header) attempted in Prompt 5.6.1 failed with `403 Invalid Compact JWS` because the TUS server's lifecycle hook calls `storage.verifyObjectSignature()` (NOT JWT verification), and the token returned by `createSignedUploadUrl` is a JWT-format token, not a `verifyObjectSignature`-compatible signed-object-token. The `verifyObjectSignature` path requires an undocumented `/upload/resumable/sign` endpoint suffix per the storage codebase, but the canonical Supabase docs use the `Bearer JWT` pattern instead.

### Why this is still safe

- Registry creation goes through the `request-asset-upload` Edge Function which enforces super_admin + impersonation gate via `assert_impersonation_allows`.
- Audit trail is enforced at the RPC layer, not at the Storage layer.
- RLS predicates on `storage.objects` mirror the RPC's super_admin + impersonation gate.
- The narrow scope (bucket_id='lesson-assets' only) prevents these policies from affecting other buckets.
- Service-role policy stays in place for sweep cron, which needs to download bytes server-side.

### Project-level Storage upload limit

Independent of bucket and RLS configuration, Supabase has two project-level upload size caps:
- `UPLOAD_FILE_SIZE_LIMIT` (global): the absolute project ceiling for all upload methods (TUS, standard, S3-compatible).
- `UPLOAD_FILE_SIZE_LIMIT_STANDARD`: a separate, tighter cap for standard PUT uploads.

Both must be raised in the Supabase Dashboard to allow uploads above the defaults. Session 58 raised the global limit to 5 GB to match the bucket's `file_size_limit`. The standard limit is unset (defaults to ~50 MB) — irrelevant for our TUS-based uploads but a footgun if anyone tries non-TUS uploads later.

## 40. Parent entity thumbnails (Prompt 7, Session 59)

Thumbnails on `certification_paths`, `curricula`, `modules`, and `content_items` use the same `content_assets` + `content_asset_refs` infrastructure shipped in §38, extended to support all four parent types.

### Schema additions

**`content_asset_refs` extended** (Option B locked Session 59):

- New columns: `module_id uuid REFERENCES modules(id)`, `curriculum_id uuid REFERENCES curricula(id)`, `certification_path_id uuid REFERENCES certification_paths(id)`.
- Replaced 2-way exactly-one CHECK with 5-way: exactly one of `{content_item_id, lesson_block_id, module_id, curriculum_id, certification_path_id}` is non-null.
- Three new partial indexes: `(<parent_id>)` where `archived_at IS NULL AND <parent_id> IS NOT NULL`.

Why Option B: one mechanism (refs rows) is authoritative for ref counting across all five parent types. Alternative (direct `thumbnail_asset_id` column without ref row for the new three parents) would have forced the auto-archive logic to consult both refs table AND four direct columns, creating drift risk.

**`thumbnail_asset_id` column on all four parent tables** — `uuid REFERENCES content_assets(id) ON DELETE SET NULL`. The `ON DELETE SET NULL` is defense-in-depth: the hard-delete cron should never reach an asset with a live ref, but if it does, the parent row survives.

### Cascade helpers

Mirror `_cascade_archive_asset_refs_for_content_item` from §38 for the three new parent types:

- `_cascade_archive_asset_refs_for_module(p_module_id, p_caller_id, p_archive_reason)`
- `_cascade_archive_asset_refs_for_curriculum(p_curriculum_id, p_caller_id, p_archive_reason)`
- `_cascade_archive_asset_refs_for_certification_path(p_certification_path_id, p_caller_id, p_archive_reason)`

Each: archives all active refs pointing to the parent, then auto-archives non-library assets at zero refs (via `_archive_asset_internal` from §38).

The content_item helper still handles its own + downstream lesson_block refs. Parent helpers (module/curriculum/certification_path) only touch refs pointing DIRECTLY at the parent — they do NOT cascade through children. Rationale: `archive_module` already does not auto-archive its child content_items (Phase 4 RPC design); preserving that contract avoids cross-level coupling.

### Thumbnail-specific helpers (Session 59)

`_validate_thumbnail_asset(p_asset_id)` — raises if NOT (exists AND status='active' AND asset_kind='image'). Called from every upsert RPC before mutation.

`_archive_thumbnail_ref_and_maybe_asset(p_old_asset_id, p_parent_type, p_parent_id, p_caller_id, p_archive_reason)` — archives the active thumbnail ref for `(parent_type, parent_id, asset_id)` and, if the asset is non-library + active + zero remaining refs, auto-archives the asset. Called from the diff path of each upsert RPC when an old thumbnail is removed or replaced. `p_parent_type` is one of `content_item | module | curriculum | certification_path`.

### Amended RPCs

**`upsert_certification_path`, `upsert_curriculum`, `upsert_module`, `upsert_content_item`** — each gains a new `p_thumbnail_asset_id uuid DEFAULT NULL` parameter at the end. Diff-and-update behavior:

- Validate the new asset via `_validate_thumbnail_asset` BEFORE mutation (raise on bad input).
- On INSERT: write column. If non-null, insert active ref with `ref_field = 'thumbnail'`.
- On UPDATE: detect old vs new thumbnail diff:
  - `NULL → NULL` or same value: no ref work.
  - `NULL → value`: write column, insert new ref.
  - `value → NULL`: write column, call `_archive_thumbnail_ref_and_maybe_asset(old_id, parent_type, parent_id, …)`.
  - `value → value (different)`: write column, archive old via helper, insert new ref.

**`archive_certification_path`, `archive_curriculum`, `archive_module`** — each calls its respective `_cascade_archive_asset_refs_for_<parent>` helper after the archive UPDATE.

**`request_asset_upload`** — three new mode branches: `module`, `curriculum`, `certification_path`. Body params: `p_module_id`, `p_curriculum_id`, `p_certification_path_id` (all uuid DEFAULT NULL). Exactly one of the five parent IDs may be non-null (or all five null with `is_library_asset=true`). For the three new modes, `ref_field` is currently restricted to `'thumbnail'` only — future parent-scoped ref_fields (banner, social_card) require explicit allowlisting. Thumbnail uploads (in any of the four parent modes) must have `p_asset_kind='image'`.

### Path conventions (storage.objects)

- Module thumbnail: `module/<module_id>/<asset_id>.<ext>`
- Curriculum thumbnail: `curriculum/<curriculum_id>/<asset_id>.<ext>`
- Cert path thumbnail: `certification_path/<certification_path_id>/<asset_id>.<ext>`

Existing paths unchanged: content_item-scoped `<content_item_id>/<asset_id>.<ext>`, lesson_block-scoped `<content_item_id>/<lesson_block_id>/<asset_id>.<ext>`, library `library/<asset_id>.<ext>`. The new prefixes (`module/`, `curriculum/`, `certification_path/`) start from the bucket root.

### Edge Function

**`request-asset-upload` v1 → v2** — body schema gains `module_id`, `curriculum_id`, `certification_path_id` (all optional strings). Forwards them to the RPC as named params. v1 callers (omitting the new fields) keep working.

### Frontend integration (Lovable, SHIPPED Session 59)

`FileUploadField` component (`src/components/super-admin/FileUploadField.tsx`) extended with three new optional props: `moduleId`, `curriculumId`, `certificationPathId`. Each editor (`CertPathEditor`, `CurriculumEditor`, `ModuleEditor`, `ContentItemEditor`) gets a thumbnail section as the first field-group in the form body. In create mode the field is disabled with a "Save the X first" hint; in edit mode the FileUploadField is wired to the corresponding parent ID. `thumbnailAssetId` is added to each editor's `isDirty` check (both create-mode and edit-mode branches) and to the useMemo dependency array — without this the Save button stays grayed when only thumbnail changes.

`ContentAuthoring.tsx` tree-navigator Card height fix: `h-[calc(100vh-220px)]` → `h-[calc(100vh-7rem)] self-start`. Initial attempt used `sticky top-4 max-h-[calc(100vh-2rem)]` which did NOT work because the parent `AppLayout` `<main>` element has `overflow-auto`, creating a scroll context that sticky positioning anchors to instead of the viewport. Direct height (subtracting the AppLayout header + main's p-6 top padding + small buffer) is the correct pattern for any sticky-style layout child in this codebase. The `self-start` is required inside CSS grid or the parent grid stretches the child and breaks any height intent.

### Idempotent ref creation pattern (Migrations 7-8, Session 59)

Surfaced during end-to-end verification. The upload-path RPC (`request_asset_upload`) creates an active `content_asset_refs` row at upload time when a parent_id is set. The upsert RPCs initially also unconditionally INSERTed a refs row when `p_thumbnail_asset_id` transitioned NULL → value, creating duplicates.

Two scenarios produce different correct intent:
- **Fresh upload via FileUploadField:** `request_asset_upload` created the ref. Upsert RPC must write column only.
- **Library pick via AssetLibraryPicker:** no ref was created server-side (handleLibraryPick only fires `create_asset_ref` for content_item / lesson_block today; new parent types are unhandled there). Upsert RPC MUST create the ref to maintain the invariant.

**Fix:** new private helper `_upsert_thumbnail_ref(p_asset_id, p_parent_type, p_parent_id, p_caller_id)` does idempotent upsert — check for existing active ref matching `(asset_id, parent_id, ref_field='thumbnail')`; skip if exists, insert if not. All four upsert RPCs call this helper instead of unconditional INSERT.

This pattern generalizes: any time a frontend has TWO write paths that might both create the same logical ref (live-during-upload vs deferred-via-save), the server-side ref creator must be idempotent. Standing rule: if there's any possibility of dual-path ref creation, use the existence-check upsert pattern, not unconditional INSERT.

### Verified end-to-end Session 59

All 4 parent entity types tested with thumbnails uploaded + saved + ref state inspected:
- PTP-Coach (certification_path) — Phil Concern.png uploaded fresh, parent-scoped path `certification_path/<id>/<asset>.png`, 1 active ref
- PTP VILT 1 (curriculum) — library asset selected via picker, 1 active ref
- Test Module C (module) — library asset selected, 1 active ref
- Test Video Item (content_item) — library asset selected, 1 active ref alongside its existing `content_item_video_source` ref
- Test External Link (content_item) — Phil Concern.png uploaded fresh, 1 active ref

Library reuse confirmed: one library asset (id `f8b13cb2`) is referenced as a thumbnail across 3 entities, another (id `0400f749`) across 2 entities. The "one asset, many references" pattern from §38 is functioning. No duplicate refs anywhere after the idempotent-helper fix.

### Why Option X (parent-scoped) over revised Option Y (library-as-thumbnail)

Cole's call Session 59: library page should not be overloaded with thumbnails that are never reused. Thumbnails go to parent-scoped storage paths and auto-archive when the parent does. Tradeoff accepted: thumbnails cannot be reused across entities without re-upload (Phase 5+ may add a "use existing thumbnail" picker if reuse becomes a common pattern).

### Standing rule: CREATE OR REPLACE overload trap (Session 59)

Surfaced during Migration 4d. When you `CREATE OR REPLACE FUNCTION` an existing function and the new signature has different parameters (even just one added with `DEFAULT NULL`), PostgreSQL creates a NEW overload alongside the original instead of replacing it. Existing callers using the original named-param shape then hit `42725 "function is not unique"` because two candidates match.

**Fix**: in the same migration that amends the function, explicitly `DROP FUNCTION public.<name>(<exact old arg types>)` to remove the legacy overload. Verify via `pg_get_function_identity_arguments` that only one signature remains.

Pattern applies to ALL future RPC amendments that add params. The Session 58 amendments (e.g. `archive_content_item` cascade additions) escaped this because they did not change the arg list.

### Action types

No new action types this session. Thumbnail changes are captured by the existing `<entity>_updated` action_type via the upsert RPC's existing `log_super_admin_action` call. The cascade archive logs `asset_archived` with `trigger = 'thumbnail_cascade_from_<reason>'` for traceability.

### Storage / cleanup characteristics

- Removing a thumbnail (NULL → set, then clear) auto-archives the asset (non-library, zero refs). Soft-archive flows through the existing §38 sweep: 15-day grace before ZIP+email, 7-day grace after email, then hard-delete. Total recovery window 22 days.
- Archiving a parent entity cascade-archives the thumbnail ref via the parent's cascade helper; the asset auto-archives at zero refs through the same path.
- Replacing a thumbnail (set → different value) archives the old asset and starts the old asset's 22-day recovery window. The new asset is active immediately.

## 41. D-series: "Your assessment responses" per-item facet insights + coach-client split-pair fixes (one-off session between Sessions 71-72)

### 41.1 generate-all-facets Edge Function (NEW)

**Slug:** `generate-all-facets` — **v3 ACTIVE**, `verify_jwt: false`

**Auth:** Dual-path. Server-to-server: `x-internal-secret` header matches `INTERNAL_FUNCTION_SECRET` vault secret → authorized, no user JWT needed. Frontend fallback: Bearer JWT → `auth.getClaims` → ownership check against `assessment_results.user_id`.

**Purpose:** Generates the `facet_insights_all` row for a PTP assessment result — one `facet_interpretations` row keyed by `(assessment_result_id, section_type='facet_insights_all')` containing a JSONB array of per-question 2-positive / 2-negative behavioral impact statements.

**Self-chaining:** When the 110s time budget is exceeded mid-batch, the function fires itself via `fetch` + `EdgeRuntime.waitUntil` to continue from the resume point. Resumes are gapless because `startBatch` is derived from `Math.floor(existingArr.length / 10)`.

**Completeness check:** `assessment_results.facet_insights_all_total` (new integer column, nullable) stores the target count. Both the function and the frontend use this for short-circuit: if `done_count >= storedTotal`, skip. Already-complete calls return `{ ok: true, status: 'already_complete' }` immediately.

**Callers:**
- `calculate-scores` v50 — fires in parallel with the narrative fan-out at PTP completion (fire-and-forget, does not block scoring)
- `retry-ptp-narratives` v2 — fires unconditionally after status reset
- Frontend effect in `PTPNarrativeSections.tsx` — frontend fallback via user JWT + ownership

### 41.2 generate-facet-interpretations v41 (UPDATED)

**Change from v40:** Added `x-internal-secret` bypass at the top of the auth block. When `req.headers.get('x-internal-secret')` matches `INTERNAL_FUNCTION_SECRET`, `callerUserId` is set to the super admin UUID (`1d14e510-d0d0-4687-9741-4ddfc0c37253`) and ownership/super-admin check passes. This enables server-to-server calls from `generate-all-facets` without requiring a user JWT.

**Pattern rationale:** `generate-all-facets` calls `generate-facet-interpretations` via `admin.functions.invoke`. Under Supabase's signing-keys mode, `admin.functions.invoke` passes the service role key as the bearer token — not a user JWT. Without the bypass, the ownership check (callerUserId vs assessment owner) would always fail with 500. The bypass makes the service role path explicit and auditable.

**auth bypass pattern** (locked for this codebase): when a function that normally requires user JWT ownership needs to also be callable server-to-server, add `x-internal-secret` check at the TOP of the try block before the JWT auth path. Set `callerUserId` to a known trusted identity (super admin UUID) that passes the subsequent authorization checks. This is preferred over generating synthetic user tokens or relaxing ownership checks globally.

### 41.3 New DB column

`assessment_results.facet_insights_all_total` — `INTEGER NULL`. Stores the total number of PTP questions for this assessment context (42 for personal, 47 for professional, 89 for both). Populated by `generate-all-facets` after batch 0 completes. Used for completeness check by both the function (self-chain resume) and the frontend (polling stop condition).

### 41.4 Frontend: PTPNarrativeSections.tsx

**Effect rewrite:** The `facet_insights_all` effect (deps `[assessmentResultId, responsesExpanded]`) was rewritten from a frontend-orchestrated batch loop to a single fire-and-forget invoke + 5s poll pattern.

1. Load existing row from DB (DB-first — no AI call if complete)
2. Check `facet_insights_all_total` for completeness
3. If incomplete and accordion is open, fire `generate-all-facets` (fire-and-forget)
4. Poll DB every 5s until `done_count >= storedTotal` or 5 minutes elapsed

**Combined tab merge (split-pair):** When `additionalAssessmentId` is set and `ptpContextTab === 'combined'`, the effect also loads the personal half's `facet_insights_all` row. Since `additionalAssessmentId` is an `assessment_id` (not `assessment_result_id`), one extra DB query resolves it: `assessment_results.select('id').eq('assessment_id', additionalAssessmentId)`. The two arrays are merged (professional first, then personal) and set on `allFacetInsights`. Completeness check for combined: `primaryLoaded.length >= storedTotal && additionalLoaded.length > 0`.

### 41.5 coach_clients split-pair filter fixes (MyResults.tsx)

Two parallel bugs existed in `MyResults.tsx` where `coach_clients.paired_assessment_id` (the personal half of a split-pair PTP) was not being included in filtering sets. Both fixed in the same pattern.

**Bug 1 — Coach view missing personal/combined tabs:**
The coach filter (`if (isCoachView && coachUserId && shareWithCoach === false)`) built `linkedIds` from `coach_clients.assessment_id` only. Personal half assessment ID (in `paired_assessment_id`) was filtered out of `combined`. Fix: added `paired_assessment_id` to `.select()` and `.flatMap(r => [r.assessment_id, r.paired_assessment_id]).filter(Boolean)` into `linkedIds`.

**Bug 2 — Client gate not blocking personal results:**
The `debriefPendingIds` set (which shows "Results Pending Coach Debrief" message to the client) only checked `coach_clients.assessment_id`. Personal assessment ID was never in `pendingIds`, so the gate didn't fire. Fix: same pattern — added `paired_assessment_id` to `.select()` and `.flatMap` both IDs into `pendingIds`.

**Rule locked:** Any query against `coach_clients` that needs to cover ALL assessments in a split-pair PTP must select BOTH `assessment_id` AND `paired_assessment_id` and include both in any Set used for filtering. This applies to any future coach-client data access that filters by assessment membership.

### 41.6 Retry button in coach impersonation view (KNOWN ISSUE)

`retry-ptp-narratives` checks ownership: `callerUserId === assessment owner`. When a super admin impersonates a coach (Cheryl) and views a client's (Edgar's) failed narrative, clicking Retry sends Cheryl's JWT → callerUserId = Cheryl's UUID ≠ Edgar's UUID → 403.

**Current state:** Button shows but returns non-2xx to the user. Logged as low-priority build queue item. Fix options: (a) hide the retry button in coach impersonation view via `isCoachView` prop check, or (b) extend `retry-ptp-narratives` to accept coach callers who have a valid `coach_clients` link to the assessment owner.

### 41.7 calculate-scores v50 and retry-ptp-narratives v2

`calculate-scores` v50: fires `generate-all-facets` via fire-and-forget fetch at the top of the `isPtpInstrument` block, in parallel with the narrative fan-out. Does not wait for completion — both run concurrently.

`retry-ptp-narratives` v2: fires `generate-all-facets` unconditionally after resetting `narrative_status` to null, before the narrative fan-out. Also fire-and-forget.

