# Session 76 → 77 Handoff

**Session 76 closed:** Group Z content item viewer infrastructure substantially scoped and partially shipped. Quiz authoring shipped end-to-end backend + frontend (Prompt 1 SHIPPED + verified). Quiz viewer backend RPCs shipped + verified (`get_quiz_for_trainee`, `get_quiz_attempt_results`). Quiz viewer frontend prompt drafted but DEFERRED — does not send until Prompt 0 (unified viewer chrome) ships first. Comprehensive scope doc written for all 8 content item viewers with locked decisions, gap matrix, per-viewer feature specs, competitor recon synthesis, and chrome contract.

**Session 77 opens with:** Drafting Prompt 0 (unified content item viewer chrome) for `/learning/content-item/:contentItemId`. Chrome owns page route + breadcrumbs + header + completion-cascade modal + abstraction hooks. Per-viewer prompts (Prompt 2 quiz viewer drafted; Prompts 3+ to be drafted) plug into chrome's `item_type` branch.

---

## What shipped Session 76

### Backend (verified live)

**Quiz authoring RPCs (5 + 7 audit action_types):**
- `upsert_quiz_question(p_id, p_content_item_id, p_question_type, p_question_text, p_question_image_url, p_display_order, p_points, p_explanation, p_reason)`
- `archive_quiz_question(p_id, p_reason)`
- `reorder_quiz_questions(p_content_item_id, p_ordered_ids uuid[], p_reason)` — exact-set validation
- `upsert_quiz_answer_option(p_id, p_question_id, p_option_text, p_option_image_url, p_is_correct, p_match_pair_key, p_display_order, p_reason)`
- `archive_quiz_answer_option(p_id, p_reason)`
- 7 new entries in `super_admin_action_types`: quiz_question_created/updated/archived, quiz_questions_reordered, quiz_answer_option_created/updated/archived

**Quiz viewer RPCs (2):**
- `get_quiz_for_trainee(p_content_item_id)` — strips `is_correct`/`match_pair_key`/`explanation` unless `quiz_show_correct_mode='always'`. For match types splits options into `prompts` (authored order) + `answers` (server-shuffled via `ORDER BY random()`). Returns last_attempt + best_score_pct + ever_passed + attempts_count.
- `get_quiz_attempt_results(p_attempt_id)` — post-submit reveal RPC. Re-derives per-question correctness from `quiz_attempts.answers` jsonb using same scoring rules as `submit_quiz_attempt`. Authorization: trainee owns OR mentor of trainee OR super admin. Reveal logic per mode (`never`→false, `after_each_attempt`/`always`→true, `after_pass`→true only if ever_passed). M2b patch fixed `ORDER BY display_order` outside `jsonb_agg` bug.

All RPCs: SECURITY DEFINER, search_path locked, REVOKE anon / GRANT authenticated+service_role per §82.

### Frontend (shipped end-to-end with verification PASSED)

**Prompt 1 — Quiz authoring UI** (Cole approved Lovable plan with ExternalLink icon nit; Lovable shipped):
- New page `/super-admin/content-authoring/quizzes/:contentItemId` mirroring LessonBlocksEditor pattern
- New components: `QuizQuestionsEditor.tsx`, `QuestionCard.tsx`, `MultipleChoiceOptionsEditor.tsx`, `TrueFalseOptionsEditor.tsx`, `MatchOptionsEditor.tsx`, `useQuizAuthoring.ts` hook
- ContentItemEditor.tsx: "Edit quiz questions" button added (mirrors "Edit lesson blocks" pattern, ExternalLink icon, question count badge)
- App.tsx: new route wired
- 4 question types exposed: multiple_choice, true_false, select_all, match_definition. match_picture deferred.
- Per-card save flow with reason modal (min 10 chars). Reorder on drag-end. Per-option archive with inline reason.
- Cole reported: "the author UI for quiz landed fine"

### Prompts and recon shipped to repo

**Prompts (`/lovable-prompts/` dir):**
- 4 prior Group Z Lovable prompts from earlier in session: cert path detail, dimension card color refactor, curriculum detail, module detail (all SHIPPED + verified earlier in Session 76)

**Recon and scope (`/` root):**
- `content-item-viewer-scope.md` — NEW — comprehensive scope for all 8 viewers + locked decisions + gap matrix + chrome contract
- `recon/content-item-viewer-recon.md` — 3-track recon (backend / frontend / competitor) — used as input to scope doc
- `recon/quiz-viewer-backend-recon.md` — backend-only recon for quiz viewer

**Draft prompt staged but NOT yet sent:**
- `prompts/prompt-2-quiz-viewer.md` — drafted Session 76. Explicitly marked "DO NOT SEND YET — depends on Prompt 0". Sends after Prompt 0 ships and verifies.

---

## Locked decisions Session 76 (recap)

These are LOCKED. Full detail in `content-item-viewer-scope.md`.

1. **Sequencing:** Prompt 0 (chrome) → Prompt 2 (quiz viewer) → remaining per-type viewers. Verify chrome with simpler viewers first.
2. **Viewer ambition tier:** Tier 3 — Distinctive. Each non-lesson_blocks viewer gets one distinctive feature.
3. **SCORM/API export:** Path (a) — post-launch tooling, abstractions in v1.
4. **BlockRenderer reuse:** Path (b) — extract shared visual primitives, fork orchestration for trainee.
5. **Quiz match_picture:** Path C — deferred from v1. Requires `content_asset_refs.quiz_question_id` + `quiz_answer_option_id` columns + `request-asset-upload` Edge Function extension.
6. **Quiz match pair storage:** prompt row `display_order=0, is_correct=false`; answer row `display_order=1, is_correct=true`; shared `match_pair_key`.
7. **Quiz reveal RPC shape:** Path (a) — structured `prompts` + `answers` arrays for match types. Flat `options` array for non-match.
8. **Quiz feedback per mode:** `always`→real-time; `after_each_attempt`/`after_pass`/`never`→post-submit per gate.
9. **Quiz authoring v1:** 4 question types exposed; text-only options; no image uploads.

---

## Session 77 opening priorities

### 1. Draft Prompt 0 — unified content item viewer chrome

Per §5 of `content-item-viewer-scope.md`, the chrome at `/learning/content-item/:contentItemId` is the foundation all per-type viewers plug into. Per the scope doc §4.2, this requires one new backend RPC first:

**Backend pre-work:** Build `get_content_item_for_viewer(p_content_item_id)`. SECDEF, search_path locked. Returns:
- content_item row (all fields)
- per-type child data (or links to existing per-type RPCs like `get_quiz_for_trainee`)
- current completion state (content_item_completions row)
- access check (trainee enrolled in parent module's curriculum / cert path)
- "next item" hint

**Frontend prompt scope:**
- Page chrome at `/learning/content-item/:contentItemId`
- Header band (title, thumbnail, completion pill, breadcrumbs)
- Per-`item_type` branch routing into placeholder viewers (stub for now; real viewers land in Prompts 2+)
- `useCompletionReporter()` and `useAssetResolver()` hooks (abstractions per scope doc §2.3 and §2.4)
- Cascade-detection logic per scope doc §8
- One modal at highest transitioned tier on completion event
- "Next item" CTA

Plug in 3 simplest viewers as proof-of-concept: external_link, video, written_summary. These stress-test the abstractions without quiz's full complexity.

### 2. After Prompt 0 ships + verifies → send Prompt 2 (quiz viewer)

Prompt 2 is already drafted at `prompts/prompt-2-quiz-viewer.md`. Verify the chrome contract matches the prompt's assumptions; adapt if needed. Send to Lovable.

### 3. Then remaining per-type viewer prompts in order

Recommended order:
- Prompt 3: Skills practice viewer (more interactive than written_summary, less than quiz)
- Prompt 4: Lesson blocks viewer (largest scope — 14 block types, fork BlockRenderer)
- Prompt 5: File upload + live event viewers (paired — both need new backend RPCs / extensions)

### 4. Deferred backend work tracked

These can be done parallel to viewer prompts as backend prep:
- `submit_file_upload_completion` RPC (needed before Prompt 5)
- Widen `get_lesson_block_assets` for trainee access (or build parallel resolver) — needed before Prompt 4
- `content_item_completions.external_link_reflection_text` additive migration — needed for external_link distinctive feature
- Cron + Resend reminder integration for live_event distinctive feature — pattern already exists, just wire up

---

## Standing rules locked Session 76

**§99 added: FK lookup tables must be audited alongside CHECK constraints when adding auditable actions.** Surfaced during quiz authoring RPC build. `super_admin_audit_log.action_type` is an FK to `super_admin_action_types`, NOT a CHECK constraint. Every new auditable action_type must INSERT into that lookup table before the RPC succeeds. Pattern: when adding RPC that calls `log_super_admin_action(action_type=>'foo')`, audit `super_admin_action_types` for the entry, INSERT if missing in the same migration. Pairs with §96 (relax-RPC-validation requires matching CHECK-constraint audit) — both reinforce that validation lives at multiple layers and ALL must be touched atomically.

**§100 added: Structured response shapes for client-side rendering simplification.** When a single SQL-driven response shape can produce client-side bugs around how to interpret/filter the data, refactor to a structured shape with explicit named arrays per logical role. Example from `get_quiz_for_trainee`: instead of returning a flat `options` array for match questions and forcing client to separate `display_order=0` from `display_order=1`, return `prompts` + `answers` as separate arrays. Server-side shuffle for `answers` removes the need to expose `match_pair_key` to client. Net effect: one shape ambiguity removed, one security boundary made structural. Apply this pattern when SQL response shape forces client to make role-decisions based on data values rather than data structure.

---

## Test fixture state at Session 76 close

- **Test quiz `0e365d0e-81e6-4d28-a0fe-ccd749714a9d`** on Test Module C
  - 4 questions (mc Q1, tf Q2, sa Q3, match_definition Q4 with 3 pairs)
  - Mode: `after_pass`
  - Pass threshold: 60%
  - 1 attempt logged: `cffd2c4d-aaf4-4637-b1ee-77171251ee1d` (score 50%, failed)
- Cole's super admin and trainee test user UUIDs in userMemories
- Test password in userMemories

Edge Function versions at Session 76 close: unchanged from Session 75 close. `get-resource-signed-url` v2 ACTIVE, `request-asset-upload` (RPC) v5 ACTIVE.

---

## NO movement this session on

AIRSA Phases 3e-8, SOC 2 written policies, Action-Oriented Voice Redesign, pricing-reads refactor, corporate contract renewal schema change, Clarity Engine, six §82 RLS issues on `coach_disclosure_acceptances` + `user_curriculum_assignments` deferred from prior sessions.

---

## Session 76 close artifacts (this session's GitHub uploads)

Four markdown files to upload manually to `cbastianBWE/brainwise-internal-docs`:

1. `build-queue.md` — v84 entry added at top (Session 76 close)
2. `architecture-reference.md` — v80 entry added at top (§99 + §100 added)
3. `session-76-to-77.md` — this handoff (new file)
4. `content-item-viewer-scope.md` — comprehensive scope doc (new file, replaces fragmented recon docs as Group Z viewer build authority)

GitHub MCP READ-ONLY confirmed. Cole's drag-upload via GitHub web UI is the canonical path.
