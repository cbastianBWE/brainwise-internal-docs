# BrainWise Session 54 to 55 Handoff

*Closeout: Session 54. Open: Session 55.*

## Standing operating protocol — applies every session

### Lovable Credit Conservation Protocol

Before writing any Lovable prompt:

1. Ask for all relevant current code sections. Never write a prompt based on assumed code.
2. Do Supabase/backend work first — SQL, RLS, Edge Functions, RPC. Verify it works before touching Lovable.
3. Diagnose before prescribing — gather evidence (logs, DB state, actual code) before writing a fix.
4. Think through the complete feature lifecycle upfront. Handle all cases (all user paths, edge cases, state cleanup) in one prompt. Never send a partial fix that leaves adjacent cases unhandled.
5. Only write the Lovable prompt when the backend is verified and the exact frontend code to be modified has been seen.
6. If something can be done in Supabase or another connected system, do it there first and confirm it works before going to Lovable.

### Closeout document workflow

Source-of-truth for closeout documents (Build Queue, Architecture Reference, Session Handoffs) lives at https://github.com/cbastianBWE/brainwise-internal-docs.

**Session opening protocol.** At the start of every session, read the three canonical documents from GitHub via the GitHub MCP `get_file_contents` tool:

1. `build-queue.md` — current Build Queue
2. `architecture-reference.md` — current Architecture Reference
3. `session-handoffs/<latest>.md` — most recent session handoff (find via filename sort)

These markdown files are the canonical source. Do not re-read older `.docx` versions from project knowledge unless specifically needed for historical comparison.

**During the session.** As decisions get locked, items shift state, or bugs surface, edit the in-memory markdown content via targeted edits — not full rewrites. Maintain the markdown files at `/home/claude/internal-docs/` mirroring the GitHub structure.

**Session close protocol.** At the end of every session, perform these steps in order:

1. Create a new session handoff at `session-handoffs/session-NN-to-MM.md` using prior handoff as starting structure
2. Bump version markers in build-queue.md and architecture-reference.md
3. Present the markdown bundle via `present_files` for upload to the GitHub repo
4. Tell the user to drag-upload the markdown bundle to brainwise-internal-docs via GitHub web UI

**GitHub MCP write limitation.** The GitHub MCP connector for Claude.ai chat is read-only. Do not attempt `create_or_update_file` calls — they return 403. The user handles GitHub uploads manually at session close via web UI drag-and-drop. This is by design, not a bug to troubleshoot.

**Sanitization rules.** The brainwise-internal-docs repo is public. Never include in markdown:

- Passwords of any kind
- API keys, tokens, secrets, webhook secrets
- Plaintext UUIDs of test users (use placeholders like `<+employee-uuid>`)
- Production user emails or PII
- Stripe IDs or database connection strings

Architectural details (RPC names, table schemas, Edge Function versions, brand colors, decision logs) are acceptable — they're discoverable from the public brainwise-blueprint repo.

**Test fixture access.** When a session needs test user UUIDs, query Supabase directly via MCP rather than reading from sanitized docs:

```sql
SELECT id, email FROM users WHERE email LIKE 'testclientbwe+%@gmail.com';
```

Test password lives in `userMemories`. Test org name is "BrainWise Test Corp".

---

## Where Session 54 left off

Group C — Coach Certification + Resources / Learning Paths — backend work is **complete and verified** through Phase 3.5. Backend is ready for Phase 4 frontend work to begin. Twenty-three migrations applied across four phases:

- **Phase 1: Schema** — 17 scope tables created, all RLS-policed with impersonation gates from inception. Two retroactive fixes mid-phase (Migration 08.5: retrofitted `NOT public.is_impersonating()` onto 6 catalog table super admin policies; Migration 10.5: locked down `quiz_answer_options.is_correct` from direct trainee SELECT).
- **Phase 2: Core RPCs** — 9 scope RPCs + 1 supporting hook + 8 super_admin_action_types seeded.
- **Phase 3: Notifications subsystem** — `notify_user` primitive with `dedup_key` idempotency seam, `compose_notification_email` with branded templates for all 14 catalog types, 6 Phase 2 RPCs retrofitted to dispatch notifications at correct points in their lifecycle.
- **Phase 3.5: Authoring-adjacent RPCs** — `enroll_user_in_certification_path`, `unassign_mentor`, `unassign_curriculum`. Added because Phase 4 management UIs need them.

End-to-end verified atomic transaction: `assign_curriculum_directly` writes coordinated rows to `user_curriculum_assignments` + `super_admin_audit_log` + `user_notifications` in lockstep. Failure rolls back all three.

Two standing rules locked mid-session, retroactive + forward:

1. **SOC 2 from inception** — every new table / RPC / Edge Function must satisfy CC6.1 (RLS + caller validation), CC6.3 (least privilege via SECURITY DEFINER + explicit GRANT), CC7.2 (sanitized errors, audit columns). Audit columns (created_by/updated_by) on all authoring tables.
2. **Impersonation gate from inception** — every new mutation RPC or Edge Function categorized against the 9-category §21.3 denylist at design time. Every RLS WITH CHECK on user-self-write OR super-admin-write includes `NOT public.is_impersonating()` from day one. Lesson from Sessions 49-53: don't retrofit §26.2/§26.3/§26.4 patterns.

## Phase 4 decision locked: Option A

Full authoring UI in `/super-admin/learning`. Cole confirmed at session start. Phase 1-3 schema is identical regardless; only Phase 4 surface differs. Per scope §3 risk note, this is the largest single Phase 4 risk to schedule, roughly 2-3x the frontend work of any other phase. Expect 2 sessions of Lovable work.

## Session 55 opening priorities, in order

### 1. Update architecture-reference.md with Group C backend deltas

This is the first task. architecture-reference.md was loaded into the session as v48 from session open and was not edited during Session 54. It needs delta sections capturing:

- Group C tables (17 new + 2 extends) and their relationships
- Phase 2 RPC catalog (9 RPCs + apply_post_certification_benefits hook + their auth/impersonation gates)
- Phase 3 notifications subsystem: `notify_user` contract, `dedup_key` extensibility seam, `compose_notification_email` v1 inline template strategy, `vault.decrypted_secrets['internal_function_secret']` runbook requirement
- Phase 3.5 RPCs (`enroll_user_in_certification_path`, `unassign_mentor`, `unassign_curriculum`)
- The two standing rules locked at session open (SOC 2 from inception, Impersonation gate from inception)

Bump version marker to v49.

### 2. Phase 3 email channel verified live

The email channel is verified end-to-end live. A test `certification_granted` notification dispatched during Session 54 close-out wrote a `user_notifications` row, fired `pg_net.http_post` to `send-email`, posted to Resend, and landed in the super admin's inbox. `email_logs.send_status='sent'`, Resend message ID populated.

Late-session bug fix: `notify_user` was originally deployed with `vault.decrypted_secrets WHERE name = 'internal_function_secret'` (lowercase), but the production vault row name is `INTERNAL_FUNCTION_SECRET` (uppercase, created Session 48 alongside the Edge Function Secrets sync). Migration `groupc_phase3_10` fixed the case mismatch. No runbook setup needed; vault has had the secret since 2026-04-30.

Architectural note for future debugging: Postgres `LIKE` is case-sensitive. Diagnostic queries against `vault.decrypted_secrets` that pattern-match in the wrong case will falsely return "secret missing." Use `ILIKE` or list all rows when checking secret presence.

### 3. Begin Phase 4 frontend recon, then build

Per the Lovable Credit Conservation Protocol, no Lovable prompts until backend-verified AND existing frontend code seen.

Pre-flight recon checklist for `cbastianBWE/brainwise-blueprint` main branch:

- `src/App.tsx` — route structure for `/super-admin/*`
- `src/components/AppSidebar.tsx` — sidebar nav and feature flags
- `src/pages/super-admin/Users.tsx` — pattern to mirror for the new `/super-admin/learning` landing
- `src/pages/super-admin/Health.tsx`, `Audit.tsx` (if exists) — shared layout / wrapper components
- shadcn/ui component imports used across super-admin pages
- Tanstack Query patterns for RPC calls
- Toast / sonner imports for action confirmations

Phase 4 build sequence per scope §5 (ordered by dependency):

1. `/super-admin/learning` landing page (overview + nav cards to sub-editors)
2. Certification path editor (CRUD on `certification_paths` + `certification_path_curricula`)
3. Curriculum editor (CRUD on `curricula` + `curriculum_modules`)
4. Module editor (CRUD on `modules` + content_items list view)
5. Content item editor — polymorphic by type (7 item types: video, quiz, written_summary, skills_practice, file_upload, external_link, live_event)
6. Quiz authoring — question bank + answer options (5 question_type formats)
7. Mentor assignment UI (assign_mentor + unassign_mentor)
8. Direct curriculum assignment UI (assign_curriculum_directly + unassign_curriculum)
9. Cert path enrollment UI (enroll_user_in_certification_path)

Design decision to make at Phase 4 prompt time: authoring CRUD via dedicated RPCs vs direct table writes from frontend. RLS already permits super admin INSERT/UPDATE on authoring tables, so direct writes could work — but there is no validation layer for polymorphic content_items config or quiz question/answer integrity. Recommend: thin RPC wrappers per table that do schema validation, audit logging via log_super_admin_action, and impersonation gate check.

### 4. Phase 5-10 sequence per scope §5

After Phase 4 ships:

5. Trainee learning UI (consumes get_user_learning_state; needs audience_tag runtime resolution which is deferred backend work — see below)
6. Mentor review UI (consumes mentor_review_submission)
7. Actor flow (Q5 — reuses client invitation flow with 3 differentiators; backend RPCs deferred to this phase)
8. Order Assessment gating (already partially absorbed Session 46; finalize cert-status-aware gating)
9. Resources tab redesign (consumes resources.category field added in Phase 1)
10. Polish + accessibility + brand pass

## Decisions locked in Session 54 (recap)

- **Phase 4 = Option A** (full authoring UI). Decided at session start.
- **Two standing rules** locked: SOC 2 from inception, Impersonation gate from inception. Both retroactive + forward.
- **`coach_certifications.status` enum changed** from `in_progress/certified/suspended` → `in_progress/certified/revoked`. Suspended state had 0 production rows and conflicted with Q9's revoke semantics.
- **`resources.category` text NOT NULL with CHECK** on 5 v1 categories: `my_learning`, `reference_library`, `articles_guides`, `videos`, `tools_templates`.
- **`content_items` is polymorphic by item_type** with 29 columns, 8 CHECK constraints enforcing per-type field requirements. v1 item_types: video, quiz, written_summary, skills_practice, file_upload, external_link, live_event.
- **`quiz_questions` has 5 question_types**: multiple_choice, true_false, select_all, match_definition, match_picture. RPC `submit_quiz_attempt` handles all 5 scoring patterns.
- **`quiz_answer_options.is_correct` direct trainee SELECT blocked** (Migration 10.5). Trainee access routes through Phase 2 RPC which is SECURITY DEFINER.
- **`notify_user` extensibility decisions**: ship `p_dedup_key` for idempotency (real value, prevents double-fire on retries); explicitly NOT shipping `p_channels` override (catalog `user_configurable=false` already handles critical-types-bypass-pref).
- **Vault credential routing decision**: Option A locked. Sync INTERNAL_FUNCTION_SECRET into vault as `internal_function_secret`. Rejected Option B (dedicated dispatch-notification Edge Function — overengineering) and Option C (email_outbox + cron — adds latency to critical notifications, new table, new cron pattern).
- **`is_internal_test` flag** on both `users` and `organizations` tables as separate independent columns (not derived logic).
- **EXCLUDE constraint on `user_curriculum_assignments`** enforces uniqueness on (user_id, curriculum_id, source) only WHERE status='active'. Permits re-assignment from the same source after unassignment.
- **EXCLUDE constraint on `coach_mentor_assignments`** enforces uniqueness on (trainee_user_id, mentor_user_id, certification_id) only WHERE ended_at IS NULL. Permits historical re-assignment.

## Open questions / things to lock in Session 55

- **Authoring CRUD pattern** — RPC-wrapped vs direct table writes. Decide at Phase 4 prompt time.
- **content_items.config JSONB validation** — permissive v1 vs typed per-item validation. Decide at Phase 4 prompt time.
- **Mentor-unassigned notification** — catalog does not include this type today. If Phase 4 mentor-management UI surfaces a need to inform trainee/mentor when unassigned, add catalog entry + wire `unassign_mentor` to notify_user.
- **Curriculum-unassigned notification** — same shape question for `unassign_curriculum`.

## Backend gaps explicitly deferred past Phase 4

These are real gaps but do not block Phase 4. Logged here so they don't get forgotten.

- **`accept_coach_invitation` RPC (Q4A)** — `coach_invitations` table exists (`certification_type`, `status`, `accepted_at`, `expires_at`) but no current function creates a `coach_certifications` row on acceptance. The invitation-accept UX surface is not part of Phase 4 (Phase 4 covers Q4B super admin direct enrollment instead). Build this when coach-onboarding UX is in scope, likely between Phase 4 and Phase 5.
- **Phase 7 actor flow RPCs** — `coach_certification_actors` table exists pre-Group-C with the shape Q5 describes (coach_user_id, certification_id, actor_type, actor_email, access_code, status). Will likely need a `skills_practice_content_item_id` column to link actor invitations to specific skills_practice items. Build at Phase 7.
- **Audience tag runtime computation** — `curricula.audience_tags` text[] exists but no function resolves "what tags does this user qualify for right now". Phase 5 trainee learning UI consumes this. Defer until Phase 5 design.
- **Pricing-reads refactor** — eliminate hardcoded price IDs in favor of `subscription_plans` lookups. Post-launch from prior sessions, still open.
- **Q13 post-certification benefit hook implementation** — `apply_post_certification_benefits` is a no-op stamp in v1. Full benefit logic (12-month premium tier coupon, Stripe subscription provisioning, 13th-month auto-revert) deferred until subscription tiers and pricing are decided.
- **Phase 3 acceptance test pass per scope §8.1** — systematic walkthrough of all 14 notification types under impersonated context. Underlying mechanism verified end-to-end on one type (`module_assigned` via `assign_curriculum_directly`), but the full 14-type test pass deferred to a dedicated test session.

## Build Queue items not added in this session

The following items came up during Session 54 work but were not formally added to build-queue.md because they are subsumed by Phase 4 or deferred items above:

- Validation layer for `content_items.config` JSONB (Phase 4 design decision)
- Mentor-unassigned / curriculum-unassigned notification catalog entries (Phase 4 dependent)
- Audience tag resolver function (Phase 5 dependent)
- Test fixture builder for Group C content trees (will write as a SQL seed function during Phase 4 dev to make iteration on the authoring UI faster)

## What's NOT in scope for Session 55

- Group A Phase A2 (direct user editing across all account types/tiers) — ships AFTER Group C
- Group A Phase A3 Phase 3 (super admin audit reporting UI at /super-admin/audit) — ships AFTER Group C
- Action-Oriented Voice Redesign across NAI/PTP surfaces — independent workstream, not blocked by Group C
- Coach billing tiers — explicitly deferred per Group C scope §7
- Coach profile page — adjacent, separate workstream
- Cohort UI — schema seam built in Phase 1; UI deferred to v2
- Live event infrastructure — v1 stub only with manual marking
- Public certification credentials, badges, leaderboards
- Continuing education / recertification / cert expiry — v2+
- Multi-language content support — v2+

## Anti-patterns to avoid in Session 55

These came up or could come up:

- **Reading large frontend files in full via `get_file_contents`**. CompanyDashboard.tsx (~167KB), PTPDashboard.tsx (~147KB), MyResults.tsx (~70KB) cannot be read in full without timeout risk. Use `curl -s "https://raw.githubusercontent.com/cbastianBWE/brainwise-blueprint/main/<path>"` with line-range reads.
- **Trusting `apply_migration` success without `execute_sql` verification**. Apply migration reports success without confirming DB state. Always follow with verification query.
- **Multi-statement `execute_sql` calls**. Returns only the last statement's result. Split intermediate verification into separate calls.
- **Relying on `information_schema.columns` alone for CHECK constraints**. Use `pg_get_constraintdef` against `pg_constraint`.
- **Writing Lovable prompts before reading the actual frontend code**. The protocol exists for a reason — Cole has been burned by it before.
- **Bundling two sequential Anthropic Opus calls in one Edge Function**. Supabase's ~150s timeout ceiling forces split into separate functions.
- **Skipping `verify_jwt: false` on Edge Function deploys**. It does not inherit from prior version; must be passed explicitly every time.
- **`coach_certifications.id` vs `coach_certifications.user_id`** — easy to swap when writing RPCs that take both. Migrations 08-11 all hit this risk.

## Notes for tooling

- GitHub MCP is read-only for write operations. Cole uploads markdown manually at session close via web UI drag-and-drop.
- Supabase MCP `deploy_edge_function` requires `verify_jwt: false` passed explicitly every time.
- Edge Function Secrets are not readable/writable via MCP. Vault secrets are. When credential routing matters, prefer vault.
