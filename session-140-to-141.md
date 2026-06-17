# BrainWise Session 140 to 141 Handoff

*Closeout: Session 140. Open: Session 141.*

## Where Session 140 left off

INT-1, the AI open-response feedback block (Phase 2 differentiator), shipped end to end: backend (one migration, one new edge function), frontend (one Lovable commit), and full AI-authoring parity across the three lesson-authoring generators. Everything is deployed and boot-verified; the only thing left on INT-1 is Cole's in-app end-to-end test, which exercises the first live Opus round-trip. Phase 2 now has two items remaining: VIS-3 (hero imagery) and VIS-6 (end-of-lesson recap).

## Session 141 opening priorities, in order

### 1. VIS-3 hero imagery / image-forward layout — RE-PRESENT OPTIONS BEFORE BUILDING

Cole explicitly asked to revisit the VIS-3 options before any build. Do NOT open straight into a Lovable prompt. First pull the relevant current code and the VIS-3 scope, then lay out the option set (where the hero image lives, how it is sourced, whether it is a per-lesson brand field vs a block, manual-pick vs reuse of the AI Pexels flow) for a decision. VIS-3 is the lighter of the two remaining items: mostly frontend plus the existing `lesson-ingest-pexels-asset` v2 ingest path (verify_jwt true, super-admin gated). No new block type expected, but confirm that during the options pass.

### 2. VIS-6 end-of-lesson recap + completion moment

After VIS-3. An optional end-of-lesson recap with a completion moment; the recap may be AI-generated, which would add a backend piece. Pull the VIS-6 scope and decide AI-vs-static and where the recap is stored before building.

### 3. Cole-side functional tests carried in from Session 140 (not blocking the above)

- INT-1 in-app end-to-end test (first live Opus round-trip for the block): as the test learner, add an `open_response` block to the test lesson, submit a response, confirm formative feedback returns, persists, marks the block complete, rehydrates on reload, and that editor mode shows a disabled preview.
- AI-authoring functional check: build a short lesson, confirm the outline can propose a reflection, that it expands into an `open_response` block on the canvas, and that Refine with AI works on an `open_response` block.

## Decisions locked in Session 140 (recap)

- INT-1 storage = dedicated `public.lesson_open_responses` table (per-attempt retention, mentor-review-ready), not a JSON blob on progress.
- INT-1 auth = edge function `verify_jwt: true` plus a SECDEF authorization gate (LMS entitlement + self/super-admin/active-mentor + published lesson + active assignment), a 10/hr rate limit, and a single Opus call (formative coaching only, no score).
- INT-1 completion = submit-once marks complete; `gating_required` defaults FALSE (author-overridable); sticky; flows through the existing `onBlockComplete` -> `reportProgress` -> `upsert_lesson_block_progress` path.
- §61 block-type parity is now MANDATORY for every new block type, no deferral: each new type must be added to `draft-lesson-block` (per-block Refine-with-AI iterator), `scaffold-lesson-outline` (outline proposer), and `expand-lesson-from-outline` (outline builder) in the same arc as the block ships.
- `ai-authoring-chat` is correctly EXCLUDED from §61 parity. It carries no block-type list in code, and its block awareness comes only from the `ai_authoring_context` table, whose lesson-authoring rows enumerate zero block types. It is type-agnostic at both the code and data level and does not generate the outline (scaffold does). The only way to make the Stage-1 co-pilot proactively pitch reflections is to add a full block catalog to `ai_authoring_context`, which is an optional product enhancement, not a parity fix.
- Edge-function delivery: the three AI-authoring functions are dashboard-paste (over the MCP inline size limit). Reproduce full files from the authoritative deployed source via `get_edge_function`, never from the app repo, which does not contain these functions.

## Open questions / things to lock in Session 141

- VIS-3: hero-image placement and sourcing model (see priority 1). To lock before building.
- VIS-6: AI-generated recap vs static, and storage location. To lock before building.

## Bugs surfaced in Session 140 added to Build Queue

- None. One incidental inefficiency flagged (see below), not yet a tracked bug.

## Incidental finding (not actioned)

All lesson-authoring edge functions load every active `ai_authoring_context` row, which includes the ~30KB `newsletter_html_authoring_spec`. That means each lesson-authoring Opus call carries the full newsletter HTML spec as irrelevant context, wasting input tokens. Candidate for a separate cleanup (scope the context load by purpose). Not started.

## What's NOT in scope for Session 141

- Phase 3 interactive blocks (INT-3 hotspot, INT-4 reveal, INT-5 sequence, INT-8 activation poll) and Phase 4 (INT-2 personalization, INT-6 branching, INT-7 confidence).
- VIS-4 media-beside-text two-column layout.
- The `ai_authoring_context` block-catalog enhancement (co-pilot proactive block suggestions) unless Cole requests it.
- The `ai_authoring_context` newsletter-spec load cleanup unless Cole pulls it forward.
- Standing carryforwards untouched: SCORM export + lesson-block tracking API; BQ-SUPERVISOR-DASH; Operations externalization arc; newsletter BUG-NWS-1 + Group H closure; newsletter `STATIC_ROUTES` manual-edit reminder; Doc-1 invoice live refund test.

## Architecture additions in Session 140

New table `public.lesson_open_responses` (per-attempt open-response storage; unique on user_id+block_id+attempt_number; FK cascades; RLS own/super-admin/active-mentor SELECT + service_role ALL; secret-table grant discipline applied).

New RPCs (all SECDEF): `_authorize_lesson_block_for_trainee(p_block_id, p_user_id default null)` (internal gate, byte-copy of the live lesson-asset gate; postgres + service_role only); `prepare_lesson_open_response(p_block_id)` and `record_lesson_open_response(p_block_id, p_response_text, p_ai_feedback, p_model default null)` (authenticated + service_role; impersonation gate; 10/hr rate limit; attempt-numbered insert). New `lesson_block_types` row `open_response` (category interactive, is_scored false, is_v1_active true). NOTIFY pgrst issued.

New edge function `lesson-open-response-feedback` v1 (verify_jwt true; single Opus `claude-opus-4-7` via `x-api-key` + `anthropic-version: 2023-06-01`; returns formative coaching, no score).

Edge functions versioned for §61 parity: `draft-lesson-block` (file-header v16; Supabase platform deploy counter 26), `scaffold-lesson-outline` (v27; deploy 27), `expand-lesson-from-outline` (v28; deploy 28). `ai-authoring-chat` unchanged at v14. Record full detail in architecture-reference v141.

## Test fixture state at end of Session 140

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin) — used as the INT-1 test learner
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Test lesson content_item `e5c208f2-6885-482e-8d8b-8325f9cbaf5d` ("The Model and the Two States") is the INT-1 manual-test target. No fixtures were created or left dirty in the backend this session (functional tests were rolled-back DO blocks).

## App / backend state at end of Session 140

- App HEAD for the INT-1 frontend commit: `0dfbc1800022c3029fbaab8a76a9e02e3a859e6c` (blockTypeMeta.ts, new OpenResponseBlockForm.tsx, BlockEditorPane.tsx, BlockRenderer.tsx, regenerated types.ts).
- Edge functions changed: `lesson-open-response-feedback` v1 NEW; `draft-lesson-block` v16; `scaffold-lesson-outline` v27; `expand-lesson-from-outline` v28. `ai-authoring-chat` v14 unchanged. `ops-stripe-webhook` / platform `stripe-webhook` never touched.
- All three AI-authoring functions passed the post-deploy boot probe (OPTIONS 204 + no-auth POST 401 `missing_bearer_token`), confirming compile + boot + auth gate with `verify_jwt: false` held.

## Documents this session leaves behind

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs (flat repo root):

- build-queue.md (bumped to v146)
- architecture-reference.md (bumped to v141)
- session-140-to-141.md (this document)

Per the Session-74 decision, markdown only; no .docx generated.
