# Session 77 → 78 Handoff

*Closeout: Session 77. Open: Session 78.*

## Where Session 77 left off

Session 77 built the Group Z content item viewers. The unified viewer chrome plus seven of the eight per-type viewers shipped and verified: video, written_summary, external_link (Step 1), quiz (Step 2), skills_practice (Step 3), file_upload and live_event (Step 5). The lesson_blocks viewer (Step 4) was deferred to its own session — it needs a dedicated recon of block-type rendering. A real bug was found and a contained fix drafted: the celebration cascade modal never fires because the completion-detection logic reads fields that do not exist at the nodes it inspects (BUG-8). Two adjacent gaps were logged (BUG-9, BUG-10). At Session 77 close Cole reported that per-item completion feedback works but the course-level / cert-path completion modal does not fire — this is the FIRST item for Session 78 (priority 1 below). Session 78 opens by fixing the course-completion modal and the other logged gap items, then builds the lesson_blocks viewer to finish Group Z.

## Session 78 opening priorities, in order

### 1. FIRST — Course-level / cert-path completion modal does not fire (Cole-reported, Session 77 close)

Cole observed at Session 77 close: the per-item completion feedback works (the minor between-items micro-feedback fires correctly), but the **course-level completion modal — the celebration for finishing a whole certification path / course — does not appear.** Fix this FIRST in Session 78.

Diagnosis needed before prescribing — there are two candidate causes and they need different fixes:
- **(a) The cert_path tier is genuinely not built.** Scope §2.10's top tier is a full-screen cert-path marquee (certificate credential preview + Download + Share); only a single generic `Dialog` shipped (this is BUG-10). If "course complete" means cert-path completion, then "no modal" is partly expected — the cert-path treatment was never built — AND it is partly blocked by Group V (no certificate artifact exists yet to preview). In this case the fix is: build the cert-path tier's modal treatment now (a Dialog-grade celebration is acceptable interim), stub the certificate-preview portion until Group V.
- **(b) Cascade detection still fails at the top tier.** If completing the final curriculum that finishes a cert path produces no modal at all even though item/module feedback fires, the `collectCompleted` fix (Prompt 5) is detecting low tiers but not the cert tier — check the certification branch of `collectCompleted` and the `certifications[]` shape from `get_user_learning_state` (a certification is `status === 'certified'`, has no `name` field — `certification_type` is used as the entity name; verify that branch runs and that cert-path completion is actually reflected in the snapshot).

First step Session 78: reproduce — complete a full cert path as the test trainee and observe which tiers fire. Then apply (a) or (b). This is interlinked with priorities 2 and 3 below — doing the cascade refactor first may be the cleanest fix, since RPC-returned cascade removes the client-side detection fragility entirely. Sequence at Cole's call once the cause is confirmed.

### 2. Cascade refactor — completion RPCs return cascade directly (fixes BUG-8 robustly + BUG-9)

The contained `collectCompleted` fix (Lovable Prompt 5, shipped end of Session 77) makes the module/curriculum modal fire by reading the correct nested shape of `get_user_learning_state`. That is the interim fix. The robust fix, queued for Session 78: stop diffing two client-side snapshots entirely. The completion RPCs already compute the module/curriculum/cert rollup server-side (Postgres cascade triggers, §8 of the scope doc). Change each completion RPC to RETURN cascade info — the highest tier that transitioned to completed plus its entity name — and rewrite `useCompletionReporter.reportCompletion` to consume that returned value instead of calling `get_user_learning_state` before and after and diffing.

This is a backend-first mini-build. Affected completion RPCs: `submit_quiz_attempt`, `mark_skills_practice_signoff`, `confirm_external_link`, `record_video_progress`, `submit_written_summary`, `submit_file_upload`. Recon each one first (`pg_get_functiondef`), settle a single cascade return shape they all adopt, change them, verify with `execute_sql`, then the frontend prompt. Deletes `collectCompleted`, `fetchLearningState`, and two RPC round-trips per completion action. **Also fixes BUG-9 for free** — once `submit_file_upload` returns cascade, the file_upload viewer (which completes via the Edge Function, not `reportCompletion`) can show the modal too.

### 3. Four-tier celebration treatment (BUG-10)

Scope §2.10 specifies a four-tier celebration model. What shipped (Prompt 0) is one generic `Dialog` with per-tier copy (`CASCADE_COPY`) but not per-tier treatment. Build the tiered treatment:
- content_item → micro-feedback only (checkmark, progress advance, NO modal) — already roughly the case.
- module → modal with success animation + "Next module: X" CTA + "Back to cert path" link, auto-collapsing after 3-5 seconds.
- curriculum → modal with stronger celebration + summary of what was learned + "Next curriculum" CTA, require dismiss-click.
- cert_path → full-screen marquee with certification credential preview + "Download certificate" + "Share with my coach" + "Share on LinkedIn", require dismiss-click.

**Constraint:** the cert_path marquee depends on a certificate credential artifact that does not exist yet — the certification page is Group V, deferred. Build the module and curriculum tiers fully in Session 78; the cert_path marquee can only be stubbed until Group V ships. Do not block Session 78 on the marquee.

### 4. "Last completed [date]" badge on content_item cards (scope §2.10)

For external_link / file_upload / live_event content_item types, show a "Last completed [date]" badge on the item card in the module detail page. Makes completion state visible without entering the viewer. This is a module detail page change, not a viewer change — it lives outside the Session 77 viewer prompts, which is why it was not shipped. Self-contained frontend addition, no backend.

### 5. "More content below" affordance (scope §2.10 pro-pattern)

A down-chevron + fade-gradient at the viewport bottom on viewer surfaces when content extends past the fold. Fixes Articulate Rise's documented worst pain point. Committed universally in scope but not shipped in any Session 77 viewer prompt. Self-contained frontend addition, no backend. Can be combined with item 3 into one Lovable prompt.

### 6. Lesson blocks viewer (Step 4 — finishes Group Z)

The eighth and final Group Z viewer. Deferred from Session 77 because it needs its own recon. The `lesson_blocks` content type renders a sequence of typed blocks; the authoring-side block-form components exist at `src/components/super-admin/lesson-blocks/block-forms/` (ImageBlockForm, VideoEmbedBlockForm, ScenarioBlockForm, CardSortBlockForm, FlashcardsBlockForm, EmbedAudioBlockForm, KnowledgeCheckBlockForm, and others). Recon needed: find the block read RPC (the trainee-facing read path; `get_lesson_block_assets` is super-admin-gated per the Session 74 build-queue note — may need a trainee variant), understand the block schema, and decide the BlockRenderer reuse strategy (scope §2.4 locked Path b — extract shared visual primitives to `src/components/lesson-blocks/shared/`, fork orchestration for the trainee: different Continue-button logic, completion tracking via `upsert_lesson_block_progress`, furthest-position tracking via `lesson_last_block_id`). After the lesson_blocks viewer ships and verifies, all 8 Group Z viewers are done.

### 7. Video viewer — react-player migration + mux support (lower priority — confirm with Cole first)

Scope §3.1 specified installing `react-player` to wrap all 5 video source types uniformly. What shipped: `supabase_storage` via native `<video>` (complete); `youtube_unlisted` / `vimeo` / `cloudflare_stream` via hand-rolled iframe embeds (functional, but missing the §3.1 variable-speed and 3-second-back-step controls); `mux` is NOT played — it renders an HLS `.m3u8` external link only (effectively unimplemented). **Launch impact depends on which source types Cole will actually publish with.** If all video content is uploaded files (`supabase_storage`), this is post-launch cleanup. If Mux or unlisted YouTube will be used, the missing player controls and the dead mux path are real gaps. Cole to confirm; this changes the priority, not the deferral. Migrate to `react-player` to unify all five and gain the missing controls.

## Decisions locked in Session 77 (recap)

- **Trainee-facing surfaces cannot reuse super-admin authoring components.** `FileUploadField`, `request-asset-upload`, and `draft-text` are all super-admin-gated. Each trainee-facing AI or upload surface gets its own Class A Edge Function. Pattern established Session 77: `content-item-ai-assist`, `skills-practice-attachment-upload`, `content-item-file-upload`.
- **The skills-practice attachment subsystem is built role-parameterized (trainee/mentor) from the start.** The `skills-practice-attachment-upload` Edge Function and the `set_skills_practice_attachment` RPC both support a mentor role path now; only the mentor UI is deferred (Phase 6). This was a deliberate "build it right the first time" call so Phase 6 needs no backend rework.
- **The mentor portal is its own Group C Phase 6 build, not bundled into the viewers.** The skills_practice viewer and live_event viewer ship trainee-side only; all mentor actions defer to Phase 6. Full Phase 6 plan written below.
- **The contained `collectCompleted` fix is an interim step**; the robust fix (RPCs return cascade directly) is Session 78 priority 1.
- **The cert_path celebration marquee is blocked by Group V** (no certificate artifact exists yet). Module/curriculum tiers can be built in Session 78; the marquee waits.
- **Step 5's `content-item-file-upload` is a separate Edge Function**, not a generalization of `skills-practice-attachment-upload` — isolation chosen over DRY so the verified skills function stays untouched.
- **lesson_blocks deferred to its own session** — it needs dedicated recon and is the heaviest viewer.

## Open questions / things to lock in Session 78

- Which video source types will Cole actually publish with (decides priority of the react-player/mux work).
- The single cascade return shape the six completion RPCs will all adopt (settle during the priority 1 recon).

## Bugs surfaced in Session 77 added to Build Queue

- **BUG-8 [HIGH, fix drafted]:** celebration cascade modal never fires — `collectCompleted` in `useCompletionReporter.ts` reads `node.status` where the real status is nested in `module_completion.status` / `assignment_status` / `completion.status`. Contained fix drafted as Lovable Prompt 5.
- **BUG-9 [MEDIUM]:** file_upload completes via the Edge Function, not `reportCompletion`, so no cascade modal even after the BUG-8 fix. The priority-1 cascade refactor fixes this.
- **BUG-10 [MEDIUM]:** the celebration modal is one generic Dialog, not the four-tier treatment scope §2.10 specifies. Priority 2.

## What's NOT in scope for Session 78

- The Group C Phase 6 mentor portal itself (only the cascade refactor, celebration tiering, badge, affordance, and lesson_blocks viewer are Session 78). The Phase 6 plan below is recorded for a later session.
- The cert_path celebration marquee (blocked by Group V).
- AIRSA Phases 3e-8, SOC 2 written policies, Action-Oriented Voice Redesign, pricing-reads refactor, corporate contract renewal schema change, Clarity Engine — no movement expected.

## Architecture additions in Session 77

New since Session 76 close (all to be folded into architecture-reference.md):

**Migrations / RPCs:**
- `get_content_item_for_viewer(p_content_item_id uuid, p_user_id uuid DEFAULT NULL)` — the unified viewer read RPC. Returns jsonb: `content_item` (all per-type columns), `completion` (the caller's or target's `content_item_completions` row), `breadcrumb` (module → curriculum → cert_path), `next_item`, `user_id`, `viewer_role` (self/mentor/super_admin). Access model: self + assigned, or mentor of the trainee, or super admin (bypasses gates). The `completion` block surfaces all per-type result fields including the skills sign-off timestamps, skills revision fields, and both skills attachment columns.
- `set_skills_practice_attachment(p_content_item_id uuid, p_role text, p_storage_path text, p_trainee_user_id uuid DEFAULT NULL)` — SECDEF, role-parameterized (trainee/mentor). Records a skills-practice attachment storage path on the completion row. Access model mirrors `mark_skills_practice_signoff`. Writes `skills_attachment_url` (trainee) or `skills_mentor_attachment_url` (mentor).
- `content_items.video_ai_summary text NULL` — authored video summary column.
- `content_item_completions.external_link_reflection_text text NULL` — external link reflection.
- `content_item_completions` skills revision columns: `skills_revision_comment text`, `skills_revision_requested_at timestamptz`, `skills_revision_requested_by uuid`. Nullable; no writer yet — the writer is the Phase 6 mentor "Request revision" action.
- `content_item_completions.skills_mentor_attachment_url text NULL` — the symmetric mentor-side attachment slot.
- `confirm_external_link` extended with an optional `p_reflection_text` parameter.
- `get_content_item_video_asset` — access-checked resolver for `supabase_storage` video assets.

**Storage buckets:**
- `skills-practice-attachments` — private, 200 MB, image/video/pdf/office MIME set.
- `content-item-file-uploads` — private, 500 MB hard cap, no bucket-level MIME restriction (per-item extension allowlist enforced in the function).

**Edge Functions (all Class A, verify_jwt:false, own getClaims):**
- `draft-text` v7 — added the `content_item_video_summary` FIELD_SPEC (super-admin authoring).
- `get-content-item-video-url` v1 — signs `supabase_storage` video URLs.
- `content-item-ai-assist` v1 — trainee-facing AI starter for the written summary viewer (the super-admin `draft-text` could not be reused by trainees).
- `skills-practice-attachment-upload` v1 — trainee/mentor skills-practice attachment upload (request/finalize/read actions, role-parameterized).
- `content-item-file-upload` v1 — trainee file_upload submission (request/finalize/read), enforces per-item `file_upload_max_bytes` and `file_upload_allowed_extensions`.

**Verified pre-existing (no new build needed):** `submit_file_upload`, `mark_live_event_attendance`, the three quiz RPCs, `mark_skills_practice_signoff`. `mark_live_event_attendance` confirmed to be a mentor/super-admin action — a trainee cannot mark their own attendance, which is why the live_event viewer is trainee read-only.

---

## GROUP C PHASE 6 — MENTOR PORTAL: full plan (recorded verbatim per Cole's request)

This is the complete Phase 6 recon and scope, written so a future session can execute it without re-deriving. Phase 6 is the mentor-facing counterpart to the trainee viewers shipped in Session 77. It is deliberately a separate build — the Session 77 viewers shipped trainee-side only, and every mentor action was deferred here.

### What Phase 6 is

Group C scope (`BrainWise_Group_C_Scope_Coach_Certification_v1`) defines Phase 6 as the mentor review UI: a mentor portal where a mentor reviews trainee work, signs off on skills practice, requests revisions, marks live event attendance, and tracks their trainees' progress. It is a whole portal, parallel to the trainee learning surfaces, not a few buttons bolted onto the viewers.

### Mentor portal surfaces to build

- **`/mentor/queue`** — the mentor's review queue. Lists trainee submissions awaiting mentor action: skills practice items where the trainee has signed off and a mentor sign-off is pending (`both_required` and `mentor_only` modes), written summaries flagged for coach review, and live events past their scheduled time with attendance not yet marked. Sorted by oldest-waiting first.
- **Review detail page** — opened from the queue. Shows the trainee's submission for one content item: the skills practice scenario plus the trainee's sign-off and any trainee attachment; or the written summary text; or the live event details. Carries the mentor action controls (below).
- **`/mentor/trainees`** — the mentor's trainee roster. Lists every trainee assigned to this mentor via `coach_mentor_assignments`.
- **Trainee progress page** — opened from the roster. Shows one trainee's progress across their assigned curriculum/modules — which items are complete, in progress, awaiting the mentor.

### Mentor actions to build (the backend seams already exist where noted)

- **Mentor skills sign-off.** `mark_skills_practice_signoff` already accepts `p_signoff_type: 'mentor'` with `p_trainee_user_id`. Phase 6 builds only the UI — a "Sign off as mentor" button on the review detail page. The RPC already handles the three modes and computes overall completion.
- **"Request revision."** This needs backend work. The schema seam exists — `content_item_completions` has `skills_revision_comment`, `skills_revision_requested_at`, `skills_revision_requested_by` (added Session 77 M8) — but there is no writer. Phase 6 must add a revision-request RPC (or a revision path on `mark_skills_practice_signoff`): a mentor sets a free-text comment, which writes those three columns and surfaces the revision panel in the trainee's skills practice viewer (the trainee-side display already shipped Session 77). Also needed: the "resubmit clears the revision" behavior — when a trainee resubmits for sign-off after a revision request, the revision columns should clear. Decide whether that clearing lives in `mark_skills_practice_signoff` (trainee path) or the new revision RPC. New `status_type` value `revision_requested` per scope §3.4.
- **Mentor attachment upload.** Already fully built backend-side. The `skills-practice-attachment-upload` Edge Function has a `role: 'mentor'` path and `set_skills_practice_attachment` has a mentor path that writes `skills_mentor_attachment_url`. Phase 6 builds only the UI — a mentor attachment control on the review detail page (mentor uploads feedback notes, an annotated rubric, etc.). No backend work.
- **Live event attendance marking.** `mark_live_event_attendance` already exists and is a mentor/super-admin action (statuses `registered` / `attended` / `missed`; `attended` → completed). Phase 6 builds the UI — attendance controls on the review detail / trainee progress page. One backend gap: `get_content_item_for_viewer`'s `completion` block surfaces `live_event_attendance_status` but NOT `live_event_marked_by` (the column exists, the RPC writes it). Phase 6 should add `live_event_marked_by` to the M1 `completion` block so the mentor view can show who marked attendance.
- **Notification wiring.** `mark_skills_practice_signoff` contains a `TODO Phase 3` for notification wiring that was never completed — `skills_practice_signoff_required` (notify the mentor when a trainee signs off and a mentor sign-off is now pending) and `mentor_review_revision_requested` (notify the trainee when a mentor requests a revision), both via the existing `notify_user` infrastructure. `notify_user` and `user_notifications` already exist. Phase 6 wires these. Note: `mentor_review_submission` (the written-summary review notification) already exists and is `notify_user`-wired — use it as the pattern.

### Phase 6 access / role notes

- Mentor authorization throughout is via `coach_mentor_assignments` (mentor_user_id = caller, trainee_user_id = subject, `ended_at IS NULL`). This is the exact check `get_content_item_for_viewer`, `mark_skills_practice_signoff`, `mark_live_event_attendance`, and `set_skills_practice_attachment` already use.
- **Super admin gets the mentor portal too, and sees ALL trainees, not just assigned ones** (Cole's decision). The super-admin path bypasses the `coach_mentor_assignments` check in every relevant RPC already.

### Phase 6 is NOT Session 78

Session 78 fixes the logged gap items and builds the lesson_blocks viewer to finish Group Z. Phase 6 is a later session. It is recorded here in full so it is not lost.

---

## Standing rules reinforced Session 77

- §59 overload trap: adding a parameter via `CREATE OR REPLACE` creates an overload — DROP the old signature in the same migration. A genuine `CREATE OR REPLACE` with an identical signature does not.
- New SECDEF functions get a default PUBLIC EXECUTE grant — always `REVOKE ... FROM PUBLIC, anon` and `GRANT ... TO authenticated, service_role`.
- `apply_migration` does not confirm DB state — always verify with a separate `execute_sql`.
- `content_items` has `*_fields_only_on_<type>` CHECK constraints — when inserting a content item of one type, the per-type columns of OTHER types must be explicitly NULL on insert (they have non-null defaults the constraints reject).
- Trainee-facing surfaces cannot reuse super-admin authoring components/functions — each trainee AI/upload surface gets its own Class A Edge Function.
- `verify_jwt:false` Class A functions do their own `getClaims`; verify with an anon pg_net probe expecting the function's own auth-gate error (`missing_bearer_token`).
- §94 — read a live RPC/function body via `pg_get_functiondef` / `get_edge_function` before rewriting it.
- Every Supabase MCP `deploy_edge_function` must be followed same-session by a GitHub commit of the deployed source (Cole uploads manually — GitHub MCP is read-only).

## Test fixture state at end of Session 77

Test org: BrainWise Test Corp.

Test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):
- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee) — the Group Z trainee fixture; has an active PTP VILT 1 curriculum assignment.

**Test Module C** (in the PTP VILT 1 curriculum) is the Group Z viewer fixture. It now has ten content items, one of every viewer type plus extras:
- video, written_summary, external_link, lesson_blocks, quiz, three skills_practice (one per sign-off mode), file_upload, live_event.
- **Session 77 fixture edits for the Prompt 5 test:** the `both_required` skills practice, the `mentor_only` skills practice, and the live_event item were flipped to `is_required = false` so the module is trainee-completable (the three are mentor-gated and a trainee can never complete them alone). The `+employee` completions for the written_summary and external_link items were reset to `not_started` so they can be freshly completed to trigger the module-completion modal. After the Prompt 5 test, Test Module C's required set is video / written_summary / external_link / trainee-only skills practice / file_upload.
- The quiz fixture is titled "Viewer Smoke Test Quiz (DELETE ME)" — a leftover smoke-test name; optionally rename or leave.
- Optional cleanup: a stray `test video 2 item` content item and its `Test video 2` module exist unpublished and harmless from an earlier session.

## Documents this session leaves behind

- build-queue.md (v85) — Session 77 deltas + BUG-8/9/10 added.
- architecture-reference.md (v81) — Session 77 architecture additions.
- session-77-to-78.md (this document).

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs. Cole uploads manually via the GitHub web UI (GitHub MCP is read-only).

Five Edge Functions to commit to cbastianBWE/brainwise-blueprint this close: `draft-text` v7, `get-content-item-video-url` v1, `content-item-ai-assist` v1, `skills-practice-attachment-upload` v1, `content-item-file-upload` v1.
