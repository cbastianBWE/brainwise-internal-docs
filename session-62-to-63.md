# BrainWise Session 62 to 63 Handoff

*Closeout: Session 62. Open: Session 63.*

## Where Session 62 left off

Prompt 6a-AI (staged AI authoring flow) shipped end-to-end after a long build cycle: original 6a-AI Lovable prompt + four follow-up surgical fixes (fix1 through fix4) + Tier 1 length-preference selector. Backend deploys: 4 AI Edge Functions reached final versions (`scaffold-lesson-outline` v3, `expand-lesson-from-outline` v3, `draft-lesson-block` v4, `ai-authoring-chat` v2), new shared module `_shared/length_guidance.ts` deployed to all four, new `_shared/markdown_to_tiptap.ts` converter in the two block-producing functions. Schema: `ai_authoring_conversations.length_preference text` column with CHECK constraint (concise|standard|detailed), default `'standard'`. Two RPCs updated: `upsert_ai_authoring_conversation` now accepts 11-param signature with `p_length_preference text DEFAULT 'standard'`; `get_ai_authoring_conversation` returns 13 columns including `out_length_preference`. One critical production-data-corruption RPC bug fixed: `delete_ai_authoring_conversation` was silently expiring all session documents when the conversation was deleted (typically via Start over), violating the documented rule that docs should outlive any single conversation on a 14-day-from-last-reference TTL.

Frontend layout fix (fix4) shipped via Lovable just before close: 4 stage components (`Stage1Chat.tsx`, `Stage2Outline.tsx`, `Stage3FullContent.tsx`, `Stage4Built.tsx`) had `flex h-full flex-col` root divs which claimed 100% of the bounded aside parent height ignoring sibling header, forcing the stage content to overflow past `bottom: 0` and clipping chat input + Approve button + similar bottom-anchored controls. Fixed by changing root to `flex flex-1 min-h-0 flex-col` in all four files. `flex-1` correctly takes remaining space after header; `min-h-0` allows the flex child to shrink below intrinsic content height so nested `overflow-y-auto` scrolls.

End-to-end production verification clean: 12 lesson_blocks committed to canvas with valid TipTap configs (3 headings with level+text, 4 text blocks with body.content arrays of 4-5 paragraphs, 2 quotes, 2 lists with client_id-wrapped items, 2 callouts with variant=important). Audit log shows length:detailed correctly propagated to all four Edge Functions across two full Start-over cycles. Conversation row state correctly persists stage='built' (Bug 3 stale-closure fix from fix1 verified), length_preference='detailed', voice_preset_key='conversational_coach'.

Three concerns Cole asked Claude to carry forward as standing rules (now in architecture-reference §61, §62, §63):
- **Concern A — block parity discipline**: any session adding/modifying block_types must update 5 points in same session (ALLOWED_BLOCK_TYPES in 2 Edge Functions, BLOCK_SCHEMAS/HINTS, transformConfigForCanvas, frontend block-form component, BlockRenderer switch + blockTypeMeta entry).
- **Concern B — AI surface area discipline**: future AI authoring surfaces (assessment items, coach comms, report templates) get separate Edge Functions, not retrofits of the existing AI panel.
- **AI session close-out verification**: any session touching AI content generation runs a mandatory backend verification SQL pass at close (conversation row stage progression, lesson_blocks canvas validity, audit log entries, doc TTL extensions).

Plus three new standing rules surfaced in Session 62 (now in architecture-reference §58, §59, §60):
- **Flex column rule for fixed-position panels**: child stages of a `<aside fixed top:X bottom:0 flex flex-col>` must use `flex flex-1 min-h-0 flex-col` not `flex h-full flex-col`. `h-full` ignores siblings and overflows; `flex-1 min-h-0` takes remaining space and allows nested scroll to engage.
- **flushNow override pattern**: hooks that wrap debounced auto-save must expose a `flushNow(overrideState?: Partial<State>)` parameter that allows callers to bypass stale closure when the new state hasn't propagated to stateRef yet. Pattern: `await persistence.flushNow({ stage: "built" })` before navigating away.
- **localStorage sticky-per-content_item convention**: localStorage keys for AI authoring use `ai-authoring:<scope>:<contentItemId>` (e.g., `ai-authoring:voice:<id>`, `ai-authoring:length:<id>`). Scope-then-id ordering makes prefix-scans by scope possible.

## Locked Session 63+ trajectory: finish Group C scope

Cole confirmed Session 62 close: the path forward is to **complete Group C v1** in order. Group C is the largest workstream and the gating dependency for coach certification, the Resources tab redesign, and the trainee learning UI. Group C v1 ships when all of Group C scope §9 success criteria pass. Sequence locked:

1. **Prompt 6b** — 7 remaining lesson block types (stat_callout, statement_a_b, tabs, flashcards, accordion, button_stack, scenario). Concern A applies: every block_type addition requires the 5-point AI authoring integration checklist in the same session.
2. **Prompt 6c** — knowledge_check block. Smaller than 6b. Closes out the lesson-block side of Phase 4 authoring.
3. **Phase 4 quiz authoring** — full question bank + 5 question formats (multiple choice, true/false, select all that apply, match definition, match picture), pass threshold + retake config + show-correct-answers mode per Group C scope §3 Q2. Broader than 6c's knowledge_check block — the block embeds in lessons, the quiz authoring infrastructure powers reusable question banks.
4. **Phase 4 mentor assignment UI** — super admin assigns mentor to trainee. Likely small if backend already supports it.
5. **Phase 4 direct curriculum assignment UI** — super admin direct-assigns curriculum to user (bypassing cert path enrollment).
6. **Phase 5 trainee learning UI** — replace placeholder /certifications page with full LMS experience. Largest single phase. Per-item viewers for all 7 content item types. Watch-progress for video. Resume-on-return. Per Concern B, if AI tooling is added here (e.g., AI explainer chat alongside a video), it gets separate Edge Functions, not a retrofit of the 6a-AI panel.
7. **Phase 6 mentor review UI** — /mentor/queue, review detail page, /mentor/trainees, trainee progress page.
8. **Phase 7 actor flow** — skills practice items wired to client invitation flow with the three differentiators (allotment pricing, no-subscription actor account, certification metadata tag).
9. **Phase 8 Order Assessment gating** — CoachClients.tsx gates Order Assessment by certification_type + revocation status.
10. **Phase 9 Resources tab redesign** — overview landing + 5 category sub-pages, migrate existing resources, preserve audience tag visibility rules.
11. **Phase 10 polish** — empty states, loading skeletons, error boundaries on RPC calls, notification preferences UI at /settings/notifications, bell icon + notification dropdown in main nav, /notifications full page, audit log verification, brand pass, accessibility baseline.

Build Queue items closed when Group C v1 ships: 31 (Coach certification path infrastructure), 32 (Learning module / content authoring), 33 (Mentor review and sign-off model), 35 (Knowledge check / quiz infrastructure), 37 (Order Assessment gating), 38 (Resources tab category redesign).

## Session 63 opening priorities, in order

### 1. (If not yet done) Verify Tier 1 length-preference UX from a fresh browser session

Session 62 was test-fixture-heavy. Quick smoke test from a clean session to confirm everything still works:
1. Hit `/super-admin/content-authoring/lessons/<any active lesson>` → click ✨ AI Draft
2. Verify Length selector renders in Stage 1 (next to Voice)
3. Cycle Concise → Standard → Detailed, verify it persists across panel close/reopen
4. On canvas, click any callout → Refine with AI → verify Length selector renders next to Voice, defaults from localStorage
5. Backend SQL: `SELECT length_preference FROM ai_authoring_conversations WHERE content_item_id = '<id>'` should show your last selection

### 2. Session 63 scope: Prompt 6b — 7 remaining block types

**Acknowledge Concern A at session start.** Before any code changes, confirm the 5-point AI authoring integration checklist applies to each of the 7 new block types being added: stat_callout, statement_a_b, tabs, flashcards, accordion, button_stack, scenario. That's 5 touchpoints × 7 block types = 35 distinct code changes. Probably a multi-prompt session — recommend scoping the prompt to handle 3-4 block types per Lovable build to keep credit cost manageable and verification tractable, but all 35 touchpoints MUST land in the session (don't split across sessions or AI authoring breaks for the added types in the interim).

**Backend-first per Lovable Credit Conservation Protocol.** For each new block type:
- Add to `ALLOWED_BLOCK_TYPES` array in `scaffold-lesson-outline` AND `expand-lesson-from-outline` Edge Functions
- Add entry to `BLOCK_SCHEMA_HINTS` (expand) and `BLOCK_SCHEMAS` (draft)
- Add case to `transformConfigForCanvas()` switch in BOTH expand and draft Edge Functions
- Deploy Edge Function versions and verify with anon probe (HTTP 401 missing_bearer_token)

**Frontend prompt (after backend verified)**:
- New block-form component at `src/components/super-admin/lesson-blocks/block-forms/<Type>BlockForm.tsx` per block type
- BlockRenderer.tsx switch case + render path per block type
- blockTypeMeta.ts entry per block type
- Per Concern A this is one Lovable prompt covering all 7 types' frontend portions
- localStorage sticky-per-content_item pattern for any new per-block author preferences

**Visual design ratification before prompt write**. Each of the 7 block types needs a visual spec lock before the prompt is written:
- `stat_callout` — large statistic + supporting label, brand-color tinted callout container
- `statement_a_b` — side-by-side compare (vague vs SBI-structured, weak vs strong, etc.)
- `tabs` — N tabs with content per tab; pick default tab + tab style (pills vs underline)
- `flashcards` — front/back, multiple cards, flip animation
- `accordion` — collapsible header/body sections
- `button_stack` — N buttons, link-out OR jump-to-block targets
- `scenario` — multi-step branching narrative (or simpler v1: 1 scenario context + 1 decision point + 1 resolution)

Recommend lock each via 1-paragraph spec in the prompt + a reference image or Storybook URL. If any block type's design isn't clear, defer that one to 6c or post-6c rather than ship a half-baked design.

### 3. Reminder of Concerns A and B at session start

Session 63 by definition triggers Concern A (it's a block-types session). Acknowledge it at the start. If Session 63 also surfaces any AI-tooling needs for non-lesson surfaces, invoke Concern B (spec separate Edge Functions).

## Final Session 62 production state

- Test content_item `32e0e966-4cb8-4e8b-abf8-5617de346f59` has 12 active `lesson_blocks` (heading×3, text×4, callout×2, quote×2, list×2 — all canvas-valid TipTap shapes)
- `ai_authoring_conversations` row for test fixture: stage=`built`, length_preference=`detailed`, full_content_state has 10 blocks ready (second cycle, not yet committed to canvas)
- 2 live `ai_authoring_session_documents` for the test lesson (both `MODULE 1 - Bias.docx`, duplicates from upload-tests during the session) with valid 14-day TTLs; 1 dead row from earlier in session pending daily reaper purge
- 9 audit log entries with action_type=`ai_authoring_draft_generated` across the two test cycles, all carry `length` field correctly

## Edge Function versions at Session 62 close

- `ai-authoring-chat` v2 (length param)
- `scaffold-lesson-outline` v3 (length param, 9-type whitelist)
- `expand-lesson-from-outline` v3 (length param, 9-type whitelist, Markdown→TipTap conversion)
- `draft-lesson-block` v4 (length param, 9-type whitelist, Markdown→TipTap conversion)
- `upload-ai-authoring-doc` v1 (unchanged this session)
- `delete-ai-authoring-doc` v1 (unchanged this session)
- `reap-ai-authoring-temp-storage` v1 (unchanged this session)

## RPC versions at Session 62 close

- `upsert_ai_authoring_conversation`: 11-param signature with `p_length_preference text DEFAULT 'standard'`
- `get_ai_authoring_conversation`: 13-column return including `out_length_preference`
- `delete_ai_authoring_conversation`: NO LONGER expires session documents (bug fix). Return signature preserved (`out_documents_deleted` field still returned but always returns 0 going forward).
- `list_ai_authoring_session_documents`: unchanged
- `delete_ai_authoring_session_document`: unchanged

## AI authoring polish backlog (deferred — not blocking Group C completion)

These items surfaced during Session 62 and are captured for opportunistic pickup any time AI authoring is being touched anyway (e.g., during 6b/6c integration work). NOT required for Group C v1 ship:

- **Duplicate-file upload handling**: when an author uploads a doc matching `(content_item_id, author_id, file_name, file_size_bytes)`, prompt Replace/Keep both/Skip. Backend dedupe in `upload-ai-authoring-doc` before processing.
- **AI authoring console-noise cleanup**: TipTap "Duplicate extension names found: ['link']" + "Blocked aria-hidden on slide-pane focus race". Audit `block-forms/*BlockForm.tsx` editor configs and Radix slide-pane aria-hidden interaction.
- **Regenerate-from-scratch button on Stage 2 outline**: missing affordance — author should be able to discard outline and re-run scaffold with same conversation context.
- **TTL hardening CHECK constraint** on `ai_authoring_session_documents`: `expires_at >= uploaded_at + interval '7 days'` to prevent regression. Plus backfill any rows with shortened TTLs.

