# BrainWise Session 55 to 56 Handoff

*Closeout: Session 55. Open: Session 56.*

## Standing operating protocol — applies every session

### Lovable Credit Conservation Protocol

Before writing any Lovable prompt:

1. Ask for all relevant current code sections. Never write a prompt based on assumed code.
2. Do Supabase/backend work first — SQL, RLS, Edge Functions, RPC. Verify it works before touching Lovable.
3. Diagnose before prescribing — gather evidence (logs, DB state, actual code) before writing a fix.
4. Think through the complete feature lifecycle upfront. Handle all cases (all user paths, edge cases, state cleanup) in one prompt. Never send a partial fix that leaves adjacent cases unhandled.
5. Only write the Lovable prompt when the backend is verified and the exact frontend code to be modified has been seen.
6. If something can be done in Supabase or another connected system, do it there first and confirm it works before going to Lovable.

### Branding recon — NEW standing protocol (locked Session 55)

Before writing any Lovable prompt, the recon checklist now requires three passes:

1. **Backend recon** — schema, RLS, RPCs, Edge Functions verified
2. **Frontend recon** — existing components, routes, hooks, shared utilities cached locally
3. **Branding recon** — actual brand tokens, typography, and design patterns pulled from source:
   - `tailwind.config.ts` for fontFamily, shadows, color mappings
   - `src/index.css` for shadcn HSL tokens and `--bw-*` hex mirror
   - `src/styles/marketing-tokens.css` for full brand palette + button system + mustard/plum/forest tokens
   - One or two cached super-admin pages to confirm conventions (h1 patterns, badge variants, button variants)

Never assume brand colors or typography from memory. The codebase has two distinct token systems (shadcn HSL for app chrome, marketing tokens for `.bw-marketing-root` scope) — confirm which applies to the surface being built.

See architecture-reference §30 for full detail.

### Closeout document workflow

Source-of-truth for closeout documents (Build Queue, Architecture Reference, Session Handoffs) lives at https://github.com/cbastianBWE/brainwise-internal-docs.

**Session opening protocol.** At the start of every session, read three canonical documents from GitHub:

1. `build-queue.md` — current Build Queue
2. `architecture-reference.md` — current Architecture Reference
3. `session-55-to-56.md` (this file)

Save locally at `/home/claude/internal-docs/` mirroring repo structure. Repo is flat (no `docs/` subdir).

**During the session.** Edit in-memory markdown via targeted edits — not full rewrites.

**Session close.** Create new handoff, bump version markers, present markdown bundle for manual GitHub upload via web UI.

**GitHub MCP write limitation.** Read-only. Do not attempt `create_or_update_file` — returns 403.

**Sanitization rules.** brainwise-internal-docs is public. Never include passwords, API keys, tokens, secrets, plaintext test-user UUIDs, production emails, Stripe IDs, or DB connection strings. Architectural details are fine.

**Test fixtures.** Test org: BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`). Test users: testclientbwe+orgmember@gmail.com, +supervisor@, +employee@. Test password in userMemories.

### Communication preferences (standing rules across all sessions)

- No em-dashes
- No sycophantic openers
- No performative metacognition
- Direct answers; disagree first then soften
- Backend verified end-to-end before any Lovable prompts are written
- Lovable credit conservation: batch frontend changes into single prompts covering multiple files

## What shipped Session 55

### Backend (all verified end-to-end via execute_sql)

**Migration 1 — `groupc_phase4_prep_01_unassign_notifications`**: 3 notification catalog rows (`curriculum_unassigned`, `mentor_unassigned_trainee`, `mentor_unassigned_mentor`), `compose_notification_email` extended with 3 new WHEN branches, `unassign_curriculum` + `unassign_mentor` RPCs wired to call `notify_user` (mentor unassign now writes 2 notify_user calls per invocation — one to trainee, one to mentor — Option Y separation for independent preference configuration).

**Migration 2 — `groupc_phase4_prep_02_content_items_per_type_checks`**: 14 CHECK constraints on `content_items` (7 required-field per item_type + 7 cleanup per item_type), new `lesson_completion_mode` column with scope CHECK enforcing it's NULL for non-lesson_blocks rows and NOT NULL for lesson_blocks rows. DB-level enforcement complements RPC-level validation (defense-in-depth).

**Migration 3 — `groupc_phase4_prep_03_lesson_blocks`**: `lesson_block_types` lookup table (Option C pattern) with 17 v1 block types seeded across 4 categories (content/display_interactive/interactive/scored). `lesson_blocks` table with RLS (super_admin_write + trainee_read), impersonation gate from inception. `content_items.item_type` CHECK extended to 8 values to include `lesson_blocks`.

**Migration 4a-4e — Authoring CRUD RPCs**: 10 RPCs total, all SECURITY DEFINER, all gated by `assert_super_admin` + `assert_impersonation_allows('permission_change')`:
- `upsert_certification_path`, `archive_certification_path`
- `upsert_curriculum`, `archive_curriculum` (handles curriculum + optional cert_path attachment)
- `upsert_module`, `archive_module` (handles module + optional curriculum attachment)
- `upsert_content_item` (polymorphic, 8 item_types, takes p_type_config JSONB envelope), `archive_content_item`, `reorder_content_items`
- `replace_lesson_blocks` (atomic-replace pattern; archives all current active blocks then inserts new array in order)

14 new `super_admin_action_types` rows seeded for content_authoring category. Plus 1 more (`ai_authoring_draft_generated`) added in Migration 5.

**Migration 5 — `groupc_phase4_prep_05_ai_authoring_infrastructure`**:
- `ai_authoring_context` table with 5 v1 seeded context blocks (platform_overview, framework_terminology, scientific_foundations, output_format_rules, guardrails)
- `ai_authoring_voice_presets` table with 5 seeded voice presets (conversational_coach, tactical_direct, reflective_inquiry, academic_grounded, scenario_storyteller); each has display_name, short_description, example_paragraph, voice_guidance_markdown
- `ai_authoring_draft_generated` action_type seeded

### Frontend

**Lovable Prompt 1 LANDED and verified**: `/super-admin/content-authoring` route + sidebar entry + tree-navigator-and-pane shell. All 14 acceptance criteria met (route registered with RoleGuard, sidebar entry between Version Management and AI Chat, tree loads 4 tables in parallel via Tanstack Query, hierarchy correctly assembled including standalone curricula and modules, URL state persistence via useSearchParams, debounced search with auto-expand of ancestors, breadcrumb navigation, +Cert Path/+Curriculum/+Module buttons toast "Coming in the next prompt", placeholder editor card shows name + ID).

**Minor drifts noted (NOT blocking, cleanup candidates for Prompt 2 or later)**:
- ContentAuthoring h1 uses `text-3xl font-bold tracking-tight` instead of specified `text-2xl font-semibold tracking-tight`
- Defensive `m.name ?? m.title` fallbacks in tree assembly — works correctly since real column names always resolve, but verbose
- Tree card height `h-[calc(100vh-220px)]` may need responsive review

## Decisions locked Session 55

- **Authoring CRUD**: thin RPC wrappers per surface (not direct table writes). 10 RPCs total covering full Phase 4 authoring scope.
- **content_items.config validation**: typed per-item validation at RPC layer + DB CHECK at storage layer.
- **Lesson_blocks architecture**: 8th item_type plus child `lesson_blocks` table. 17 v1 block types via lookup table (not CHECK constraint — supports runtime additions without DDL).
- **Block catalog (17 types)**:
  - Content (7): text, heading, image, video_embed, divider, quote, list
  - Display interactive (4): callout, stat_callout, statement_a_b, embed_audio
  - Interactive (5): tabs, flashcards, accordion, button_stack, scenario
  - Scored (1): knowledge_check
- **Completion semantics**: both `scroll_and_checks` (Option A) and `explicit_continue` (Option B) supported as author-selectable per content_item via `lesson_completion_mode` column. Default in UX: `explicit_continue`.
- **Lesson_blocks edit pattern**: atomic-replace (`replace_lesson_blocks`). Editor sends whole array on Save; RPC archives existing + inserts new. No per-block CRUD APIs in v1.
- **Type changes on existing content_items**: forbidden (must delete + recreate). RPC raises 22023.
- **Notification audience separation**: separate catalog types per audience on the same DB event (Option Y) — e.g., `mentor_unassigned_trainee` vs `mentor_unassigned_mentor`. Enables independent preference configuration per role.
- **IA reframe — three super-admin surfaces, not nine cards**:
  1. `/super-admin/content-authoring` — tree-navigator-and-pane authoring (Phase 4)
  2. `/super-admin/learning-assignments` — multi-step assigner: select content → select users → set metadata → confirm (Phase 4)
  3. `/learning` — consumer view shared with all account types (Phase 5)
  4. Mentor assignment integrated into `/super-admin/coaches/<id>` (small Phase 4 addition)
  5. `/mentor` workspace for coaches acting as mentors (Phase 6)
- **Learning Assignments scope**: includes bulk reassignment/extension, assignment templates, cohort grouping (surfaced from Phase 1 seam, not deferred to v2), assignment preview.
- **AI authoring**: build B + C (per-block "Draft with AI" + lesson-level "Scaffold"). Skip A (freeform AI panel). Plus a small "Draft" button on description fields across all editors. AI ships in same Phase 4 build, woven into Prompts 5, 6, 8, and adds Prompts 10-11.
- **AI context strategy**: Option I (small ai_authoring_context table with versioned ~500-word blocks injected into Edge Function system prompts). Option II (RAG against books, podcast transcripts, papers) deferred to Phase 4.5 as separate workstream.
- **AI voice handling**: per-draft selection with sticky default within a lesson. Voice does NOT persist as a content_items column — frontend-only sticky state.
- **AI authoring model**: `claude-opus-4-7` (current top model) per Edge Function call. No cost throttling (super-admin only surface).
- **AI authoring guardrails**: AIRSA v2 canonical voice rules apply + 7 new authoring-specific guardrails (no invented neuroscience, precise BrainWise terminology, schema-matching output, no clinical/diagnostic language, no hyperbole, voice-preset matching, flag uncertainties with `[author-verify: ...]`).

## Session 56 priorities, in order

### 1. Resolve AI Edge Function deployment blocker FIRST

Three Edge Functions designed and source-drafted at Session 55 close, NOT deployed pending canonical `_shared/impersonation_gate.ts` source confirmation:

- `draft-lesson-block`
- `scaffold-lesson`
- `draft-text`

**The blocker**: arch-ref §22.1 documents the gate module's exports (types, function signatures, `ImpersonationDeniedError` class) but does NOT document the implementation body. Cole's brainwise-blueprint repo on GitHub does not include `supabase/functions/_shared/impersonation_gate.ts` (only ~10 functions tracked in repo vs ~52 deployed — known drift, build queue item).

**Two paths forward in Session 56**:
- **(A) Cole pastes the canonical `_shared/impersonation_gate.ts` source from his local Supabase functions directory** — preferred path
- **(B) Pull source via deployed function inspection** — check if Supabase admin API exposes deployed function source, OR ask Cole to run `supabase functions download _shared` from CLI

Once source is verified, deploy all three AI Edge Functions with the canonical helper bundled in the `files` array. Curl-verify each before any frontend wiring.

Edge Function source drafts cached at `/home/claude/edge-functions/<name>/index.ts` if the sandbox persists; if not, fully re-derivable from architecture-reference §29.5 spec.

### 2. Lovable Prompt 2 — Certification Path editor

Once AI Edge Functions deployed, build the cert path editor as the right-pane editor when a cert path node is selected in the Content Authoring tree.

Pre-requisite recon:
- Backend: `upsert_certification_path` + `archive_certification_path` RPCs (deployed Session 55, verified)
- Frontend: cached `ContentAuthoring.tsx`, `super-admin/CreateOrganization.tsx` (form pattern)
- Branding: shadcn Input/Select/Switch/Textarea patterns, Button variants for Save/Cancel/Archive

Scope:
- Form fields for all `certification_paths` columns: slug, name, description, certification_type (Select from 4 enum values), delivery_mode (Select from 2 enum values), cert_instrument_ids (multi-select against 4 instruments), prerequisite_path_id (Select from other cert paths), is_published (Switch), display_order (Number)
- Reason field (Textarea, required min 10 chars per RPC validation)
- Save button calls `upsert_certification_path` RPC; toast on success/failure
- Archive button calls `archive_certification_path` RPC with explicit confirmation modal (separate Cancel/Archive buttons)
- Form state: dirty tracking; warn on unsaved changes when selecting a different tree node
- "Add curriculum to this path" inline section — modal with two tabs: "Pull in existing curriculum" (searchable list) and "Create new curriculum" (jumps to a fresh curriculum editor pre-attached to this cert path)

### 3. Sequence of subsequent Lovable prompts

Per the revised IA + AI integration:

- **Prompt 3**: Curriculum editor — uses `upsert_curriculum` RPC, "Pull in existing module / Create new module" modal pattern
- **Prompt 4**: Module editor — uses `upsert_module` RPC, "Pull in existing content item / Create new content item" modal pattern
- **Prompt 5**: Polymorphic content item editor — 8 item_type branches (video, quiz, written_summary, skills_practice, file_upload, external_link, live_event, lesson_blocks); each branch shows type-specific form fields. AI "Draft" buttons on description field everywhere.
- **Prompt 6**: Lesson_blocks visual block editor — 17-block-type editor with drag-to-reorder, block picker, autosave-friendly atomic-replace via `replace_lesson_blocks`. AI features: per-block-type "Draft with AI" + lesson-level "Scaffold with AI".
- **Prompt 7**: Mentor assignment integration on `/super-admin/coaches/<id>` page — uses existing `assign_mentor` + `unassign_mentor` RPCs.
- **Prompt 8**: Quiz authoring — questions + answer options inside content item editor's quiz branch. AI "Generate questions from content".
- **Prompt 9**: `/super-admin/learning-assignments` full multi-step flow — 4-step assigner with bulk operations, templates, cohort grouping, preview.
- **Prompt 10**: AI Scaffold-lesson UI integration (top of lesson_blocks editor).
- **Prompt 11**: AI Draft-text button wiring across all description fields.

Realistic budget: 3-4 sessions for Prompts 2-11.

## New build queue items surfaced Session 55

Add to build queue at appropriate priority level:

1. **MEDIUM / Phase 4.5**: Add `--bw-mustard: #7a5800` token to `marketing-tokens.css` + `index.css` mirror. Audit NAI dashboard / individual report / facet interpretation components for inline `#7a5800` hex; refactor to use the token.
2. **LOW / opportunistic**: ContentAuthoring h1 style sweep — align with `super-admin/CreateOrganization.tsx` pattern (`text-2xl font-semibold tracking-tight`). Currently uses `text-3xl font-bold tracking-tight`.
3. **LOW / opportunistic**: ContentAuthoring `m.name ?? m.title` fallback cleanup — replace with direct field references (`m.name` for modules/curricula/certification_paths; `ci.title` for content_items).
4. **MEDIUM / Phase 4.5**: Option II (RAG against books, podcast transcripts, papers) for AI authoring context. Requires source preprocessing, embeddings pipeline, retrieval layer, citation handling, copyright review for Rock 2019 book. 2-3 dedicated sessions.
5. **MEDIUM / pre-Phase-4-completion**: Align brainwise-blueprint Lovable repo with deployed Edge Function reality. Repo currently tracks ~10 functions vs ~52 deployed. Blocked Session 55 progress on AI Edge Function deploy due to missing `_shared/impersonation_gate.ts` source.

## Backend gaps explicitly deferred past Phase 4 (do NOT build now)

- `accept_coach_invitation` RPC (Q4A) — builds when coach-onboarding UX is in scope
- Phase 7 actor flow RPCs — Phase 7's problem
- Audience tag runtime computation — Phase 5 problem
- Q13 post-certification benefit hook full implementation — needs subscription tier decisions first
- Phase 3 14-type acceptance test pass — dedicated test session
- N:M attachment between modules and content_items (cross-module lesson reuse) — Phase 4.5 schema change
- ai_usage_counters / ai_usage table unification — still pending

## Session 55 verification artifacts

Backend verification queries run and confirmed at session close:

- 14 new content_authoring action_types present in super_admin_action_types
- 10 authoring RPCs present in pg_proc with EXECUTE granted to authenticated
- 14 CHECK constraints on content_items (pg_constraint)
- 17 lesson_block_types rows active, distributed correctly across 4 categories
- 5 ai_authoring_voice_presets rows active and system=true
- 5 ai_authoring_context rows active
- 3 new notification_types_catalog rows (curriculum_unassigned, mentor_unassigned_trainee, mentor_unassigned_mentor)
- compose_notification_email correctly routes 3 new types (smoke-tested via direct invocation)
- 6 content authoring tables have super_admin_full_access RLS policy
- Content Authoring page in production (~473 lines)

## Communication preferences (repeated for emphasis)

- No em-dashes
- No sycophantic openers
- No performative metacognition
- Direct answers; disagree first then soften
- Backend verified end-to-end before any Lovable prompts are written
- Branding recon required before any Lovable prompt (NEW Session 55 protocol)
- Lovable credit conservation: batch frontend changes into single prompts covering multiple files

Begin Session 56 with Step 1 (resolve AI Edge Function deployment blocker), then Step 2 (Lovable Prompt 2 — Certification Path editor). Do not write any Lovable prompts until backend AND frontend AND branding recon are all done.
