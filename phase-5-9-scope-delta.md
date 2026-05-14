# Phase 5 + Phase 9 scope delta — Session 70

**Status**: Phase 5 backend + Phase 9 backend + Resource Authoring UI all BUILT + VERIFIED (Session 70). Recon (G10, G11) complete. Remaining: the unified visual primitive design-lock, the Phase 9 frontend, the Phase 5 frontend, and `lesson-blocks-content-schema.md`. Supersedes parts of Group C scope doc Q10 and the Phase 9 description. This doc + `phase-5-trainee-side-recon.md` + `phase-5-9-frontend-recon.md` are the Phase 5/9 reference docs — read all three before any Phase 5 or Phase 9 frontend build work. (`phase-5-lesson-progress-carry-forward.md` is a stale 41-byte stub — its content was superseded by this doc's backend sections.)

## Why this doc exists

The Session 70 opening prompt and the Group C scope doc both described Phase 5 as "replace the `/certifications` placeholder with the trainee learning UI" and Phase 9 as "five-category Resources tab, re-categorize existing resources." Cole corrected both mid-session. The re-frame:

1. The trainee learning UI does NOT replace `/certifications`. `/certifications` stays as the coach's own held-certifications view + enroll-in-another surface. The trainee learning experience lives inside the Resources tab as the "My Learning" tab.
2. The Resources tab is NOT five categories. It is three tabs — My Learning / All Resources / Coach Resources — with the structural ability to add more tabs later (tab list must be data-driven, not hardcoded to three).
3. Resource visibility is NOT a simple `resources.audiences` array match. It is a flexible, additive, multi-dimensional gating system (G7 below).
4. There is no resource authoring UI today and the `resources` table is empty — the Resources tab cannot be built frontend-first. A super-admin resource authoring UI must come first.
5. The visual treatment (highly visual, tile-based, dynamic, "better than any LMS in existence") is a hard requirement, not polish. The SAME visual primitive must be used by both the Resources tab and the trainee learning tree (cert paths, curricula, modules/courses, content items).

---

## Recon gaps (from the Supabase-only Path A recon — full detail in `phase-5-trainee-side-recon.md`)

### G1 — Trainee-side lesson progress writer RPCs do not exist
`upsert_lesson_progress`, `upsert_lesson_block_progress`, `start_lesson_reattempt` — all named in `phase-5-lesson-progress-carry-forward.md` as Phase 5 work — do not exist. The `content_item_completions` and `lesson_block_progress` tables are built with all correct columns but have ZERO rows because nothing writes to them. Backend work, Phase 5.5.

### G2 — Generic content-item completion writers do not exist
`content_item_completions` has columns for every item type (`video_watch_pct`, `video_last_position_seconds`, `external_link_confirmed_at`, `file_upload_url`, `live_event_attendance_status`, etc.) but there is no RPC that writes them for video / external_link / file_upload / live_event. The writers that DO exist: `submit_quiz_attempt`, `submit_written_summary`, `mark_skills_practice_signoff`. So quiz / written / skills practice have a completion path; video / external_link / file_upload / live_event do not. Backend work, Phase 5.5. MUST verify each item type's completion path in the next recon pass before designing the rollup chain (G4/G5).

### G3 — No completion-driven cert-grant automation
The only trigger in the progress chain is `auto_grant_combined_certification` (AFTER UPDATE on `coach_certifications`). There is NO trigger watching `content_item_completions` → module-complete rollup → curriculum-complete rollup → `coach_certifications.status` flip. `grant_certification` is a manual super-admin RPC (`assert_super_admin` + `permission_change` impersonation gate + reason >= 10 chars). RESOLVED by G4.

### G4 — Cert-grant rollup decision — RESOLVED Session 70
**Decision (Cole): full auto-rollup.** Completion is tracked and rolls up automatically at every tier:
- **Content item** completes when its type-specific condition is met.
- **Module** completes when all its required content items are complete.
- **Curriculum** completes when all its required modules are complete.
- **Cert path** completes when all its required curricula are complete.
- **`coach_certifications.status`** auto-flips to `certified` when the cert path completes.

**The only two human-in-the-loop gates** (both are still just content-item completion events — inputs to the rollup, not exceptions to it):
1. **Live event** — mentor or super admin marks `live_event_attendance_status`. Trainee cannot self-complete.
2. **Skills practice** — when `skills_signoff_required` is `mentor_only` or `both_required`, a mentor or super admin signs off. `trainee_only` items the trainee self-marks (honor system, per scope doc Q2).

Once the human marks attendance / signs off, that item is `completed` and the rollup proceeds automatically.

### G5 — Missing rollup storage tiers — RESOLVED Session 70 (Option B locked)
G4's "built to complete as the content gets done" requires completion to be a **tracked, persisted, timestamped state at every tier**, not computed on read. Current storage:
- `content_item_completions` — per-item. EXISTS.
- `user_curriculum_assignments.completed_at` — per-curriculum-assignment. EXISTS.
- **per-(user, module) completion — DOES NOT EXIST.** No `module_completions` table.
- **per-(user, cert path) progress rollup — DOES NOT EXIST** as a distinct record (only the `coach_certifications` row, which is the grant target, not a progress tracker).

**Locked approach: Option B — materialized rollup** (confirmed Cole, Session 70):
- New `module_completions` table (per user × module).
- Trigger chain: `content_item_completions` write → updates parent `module_completions` row → updates `user_curriculum_assignments.completed_at` (or a curriculum rollup) → updates cert-path rollup → flips `coach_certifications.status`.
- Completion is a stored, timestamped, auditable fact at every tier.
- Rationale over Option A (computed-on-read): the notification catalog ALREADY seeds `module_completed` and `curriculum_completed` as types — those need a state-transition moment to fire off. Computed-on-read has no transition moment. Materialized rollup gives clean notification triggers + audit trail + lets the Phase 6 mentor UI read "3 of 5 modules complete" as stored facts. The scope doc's "module progress is computed from items" predates the notification subsystem and the auto-rollup decision.
- Cost: a trigger chain needing careful ordering + idempotency — same shape as the existing asset-ref cascade helpers, well-trodden in this codebase.
- Open sub-question for design-lock: whether the per-cert-path rollup needs its own table or whether `coach_certifications` + a computed curricula-count is sufficient. Decide when the trigger chain is designed.

### G6 — All progress/assignment tables are empty; no test trainee ever enrolled
`user_curriculum_assignments` 0, `content_item_completions` 0, `lesson_block_progress` 0, `quiz_attempts` 0, `written_submissions` 0, `coach_mentor_assignments` 0. The learning-tree authoring data exists (2 cert paths [1 archived], 1 live curriculum, 3 modules [2 empty], 4 content items, 738 lesson_blocks ~31 active on fixture `32e0e966`) but NOTHING is published, and `get_user_learning_state` filters `is_published = true`. Phase 5 needs fixture work before the trainee UI can be verified: enroll a test trainee in PTP-Coach path, publish the tree, build a purpose-built multi-Continue test lesson (existing fixture has only 1 active `continue` button).

### G7 — Resource gating system does not exist (NEW — Session 70 scope expansion)
Scope doc Q10 assumed visibility = `resources.audiences` array match. Cole's actual requirement is a flexible, additive, multi-dimensional gating layer. A single resource can be granted to ANY combination of:
- A **specific company/org** (org-scoped access).
- **Coaches** generally (account_type).
- **Individuals by plan tier** — free plan / base sub / prem sub.
- **Corporate by level** — IC / manager / director & above / company-or-org-admin.
- **Coach Resources tab additionally**: gated by coach subscription type (all coaches) OR by certification held (e.g. PTP-certified only).

Grants are **additive / OR'd** — a resource visible to "this company AND all prem individuals AND PTP coaches" is one resource with three grant rows. Super admin sees everything, no gating applies to super admin.

The existing `resources.audiences` ARRAY cannot express this. Requires a new gating layer — almost certainly a polymorphic `resource_access_grants` junction table keyed by `resource_id` with a grant-target discriminator (company_id | account_type | plan_tier | corporate_level | coach_certification_type | all_coaches). Backend design work, net-new, NOT in Phase 9 as originally scoped.

`resources.category` column already exists (default `'reference_library'`) — but the three-tab model needs a `tab` assignment that is data-driven (so new tabs can be added later). `category` may be repurposed, or a new `resource_tab` column / `resource_tabs` table added. Decide at design-lock.

### G8 — No resource authoring UI exists (NEW — Session 70)
Phase 4 built authoring for the LEARNING TREE (cert paths, curricula, modules, content items). It did NOT build authoring for `resources` — a separate table. The scope doc's Phase 9 assumed resources already existed and only needed re-categorizing. They don't exist (0 rows) and there's no UI to create them. A **super-admin resource authoring UI** must be built: create/edit a resource, upload its image, write its summary + metadata, assign it to a tab, set its additive access grants. Net-new, not in any phase as currently scoped. Builds on Phase 4 authoring patterns.

### G9 — `get_user_learning_state` is curriculum-rooted, not cert-path-rooted
The function (full shape in `phase-5-trainee-side-recon.md`) returns assignments → curriculum → modules → items, each with completion, plus certifications + mentor relationships. It FULLY COVERS Phase 5.1 (My Learning landing), 5.3 (curriculum detail), 5.4 (module detail). It does NOT return the cert path's own row (name, description, delivery_mode) or the `certification_path_curricula` ordering/prerequisite structure. Phase 5.2 (cert path detail) needs a small new `get_cert_path_detail(cert_path_id)` RPC or a frontend join — lean toward a small RPC for the prerequisite logic.

### G10 — Item-type completion paths — RESOLVED Session 70 (recon complete)
Verified every item type's completion-write path (full detail in `phase-5-trainee-side-recon.md` G10 addendum):
- **Writers that EXIST**: quiz (`submit_quiz_attempt`), written_summary (`submit_written_summary` + `mentor_review_submission`), skills_practice (`mark_skills_practice_signoff`). All flip `content_item_completions.status` to `'completed'` directly.
- **Writers that are MISSING**: video, external_link, file_upload, live_event. Schema columns exist; no RPC writes them. Per G4, these four writers are prerequisite Phase 5 backend work — the rollup is only correct once every item type can reach `'completed'`.
- **Rollup signal locked**: the `content_item_completions.status` CHECK is `not_started | in_progress | submitted_for_review | revision_requested | completed`. The G5 rollup trigger watches transitions INTO `'completed'` — a single, type-agnostic signal. The module rollup counts `status='completed'` rows against required items; it does not need to know item types.
- `is_required` is populated on every content_item / curriculum_module / certification_path_curricula row — rollup can rely on "all required children complete".
- No `module_completions` table exists — G5 builds it.

### G11 — Frontend route recon — RESOLVED Session 70 (recon complete)
Verified against `cbastianBWE/brainwise-blueprint` (full detail in `phase-5-trainee-side-recon.md` G11 addendum):
- **All three resource/cert pages are bare placeholders** — `Resources.tsx`, `coach/Certification.tsx`, `admin/AdminResources.tsx` each just `return <PlaceholderPage />`. Clean slate, nothing to migrate, no shared component to untangle.
- **Route correction**: the coach certification route is `/coach/certification`, NOT `/certifications`. The architecture-reference and the original recon doc both had this wrong. `/resources` and `/coach/resources` both render the same placeholder `Resources` component today, differing only in their guard wrapper.
- No `/learning` or `/my-learning` route exists. The three Resources tabs live INSIDE the Resources page (one "Resources" sidebar item per role), not as separate sidebar entries.
- Phase 4 authoring pattern (`ContentAuthoring.tsx` + `editors/` dir with 4 editors + `_shared.tsx`, each using `upsert_*` RPCs + `FileUploadField`) is the template G8's resource authoring UI reuses.
- The unified visual tile primitive is GREENFIELD — no existing tile/card/grid component. Built fresh, shared by Phase 5 and Phase 9. `BlockRenderer.tsx` (the trainee lesson viewer's renderer) lives at `src/components/super-admin/lesson-blocks/`.

---

## Resources tab — locked structure (supersedes scope doc Q10)

- **Three tabs at launch, data-driven tab list** (can add tabs later without a migration): My Learning / All Resources / Coach Resources.
- Clicking the Resources nav item lands on the tab surface; tabs switch between the three (and any future) resource surfaces.
- **My Learning** — the trainee learning experience. Cert paths, curricula, modules/courses, content items the user is assigned. This is where Phase 5's trainee UI lives.
- **All Resources** — flat browsable surface of all resources the user can see, gated by the G7 additive grant system. NOT sub-divided into the old Q10 categories (Reference Library / Articles / Videos / Tools collapse into this one browsable surface; `category` may still tag a resource for filtering within the tab — decide at design-lock).
- **Coach Resources** — visible only to coaches + super admin. Additionally gated within by coach subscription type or certification held (G7).
- Super admin sees all tabs and all resources, no gating.

## Visual treatment — hard requirement

- **Tabs, not cards**, for top-level navigation.
- Every **resource** renders as: image, name under the image, brief summary, plus any other metadata. Tile-based.
- The trainee learning tree (cert paths, curricula, modules/courses, content items) renders with the **same visual primitive** — same tile language.
- Bar: highly visual, dynamic, easy to navigate, interactive, "better than any LMS in existence." The shared tile primitive is a real design-lock deliverable — designed ONCE, used by both Phase 9 and Phase 5.
- Terminology: "course" = "module" (confirmed Cole — scope doc says interchangeable; "module" is the code term).

---

## Revised build sequence (supersedes the interleave proposed earlier Session 70)

The earlier "Phase 9 shell first (cheap frontend)" plan is dead — G8 means the Resources tab has a backend half (gating schema + authoring UI) that must precede its frontend. The only true shared dependency between Phase 9 and Phase 5 is the visual primitive, which is a design-lock not a build. Revised order (recon is now COMPLETE — G10 + G11 done Session 70):

1. ~~Item-type completion recon + frontend route recon~~ — DONE Session 70.
2. ~~**Phase 5 backend**~~ — DONE Session 70 (Migration Groups 1-5). (a) four content-item completion writers; (b) G1 lesson progress writers + `complete_lesson`; (c) G5 materialized rollup `module_completions` + trigger chain; (d) G9 `get_cert_path_detail`. All verified.
3. ~~**Phase 9 backend**~~ — DONE Session 70 (7 migrations). G7 resource gating schema (`resource_access_grants` + `resource_tabs` data-driven tab model), `get_user_resources` read RPC, resource authoring RPCs. Plus the F1-F4 asset-pipeline `resource` parent mode + `request-asset-upload` Edge Function v4.
4. ~~**Super-admin resource authoring UI**~~ (G8) — DONE Session 70. Built via Lovable on the Phase 4 pattern, 6 files verified in `main`, tested end-to-end, 3 bug-fix migrations landed (`phase9_e2b`, `phase9_b3`, `phase9_f4`).
5. **Unified visual primitive design-lock** — NOT DONE. The shared tile component (image / name / summary / metadata) for both resources and the learning tree. Greenfield, designed once.
6. **Phase 9 frontend** — NOT DONE. Three-tab Resources surface (`Resources.tsx` placeholder → real page), real resources through the gating layer. Depends on step 5.
7. **Phase 5 frontend** — NOT DONE. Trainee learning UI under My Learning, same tile primitive; per-item viewers wired to the Phase 5 backend progress writers. Sub-phases 5.1-5.6 per §75 serial. Depends on step 5. The `lesson_blocks` per-item viewer needs an interactive-widget recon done first — that recon is unstarted.
8. **Fixture work** (G6) — PARTIALLY DONE. Migration Group 5 published the test tree + walked testcoach2 to `certified`. Still needed for Phase 5 frontend not-started/in-progress testing: a clean fixture (testclientbwe+branding is available) and a purpose-built multi-Continue test lesson.

Roughly "Phase 9 fully, then Phase 5" rather than an interleave — because Phase 9 had a backend half Phase 5 doesn't share. Steps 2, 3, 4 are DONE. Steps 5 (design-lock), 6, 7 remain. Step 5 should be done once for both 6 and 7. Note: completing 5-7 does NOT fully close Group C — see the bucket-two status section below.

---

## Open items still needing Cole decisions

None blocking. G4 and G5 are resolved. Remaining decisions (resource `category` repurpose vs new `tab` column; per-cert-path rollup table vs computed) are design-lock decisions, not scope decisions — made during step 2/3 with the schema in front of us.

## Sub-phase scope tags (Phase 5 — carried from recon, updated for G4/G5 resolution)

- **5.1 My Learning landing** — [FE] consumes `get_user_learning_state`. Renders as the My Learning tab.
- **5.2 Cert path detail** — [FE+BE] needs `get_cert_path_detail` (G9).
- **5.3 Curriculum detail** — [FE] `get_user_learning_state` covers it.
- **5.4 Module detail** — [FE] `get_user_learning_state` covers it.
- **5.5 Per-item viewers** — [FE+BE++] the heavy one. Quiz/written/skills viewers use existing submit RPCs. Video / external_link / file_upload / live_event + the lesson_blocks viewer all need new completion writers (G1, G2). Splits across multiple Lovable prompts, backend-first each.
- **5.6 Cert grant** — [BE] now fully backend: the G5 materialized rollup trigger chain. No dedicated frontend — the cert status flip surfaces wherever certifications are already displayed (`/certifications`, My Learning). Frontend just reflects the auto-flipped state.

---

# Phase 5 Backend — build progress

## Migration Group 1 — module_completions + rollup trigger chain — DONE + VERIFIED (Session 70)

Three migrations applied and verified:
- `phase5_g1a_module_completions_table` — new `module_completions` table (per user×module), UNIQUE(user_id, module_id), status CHECK (not_started/in_progress/completed), 3 indexes mirroring content_item_completions patterns, RLS enabled with 4 policies (service_role ALL, super_admin ALL, trainee SELECT own, mentor SELECT assigned). NO trainee write policy — the rollup chain is the only writer, runs SECURITY DEFINER. updated_at trigger reuses set_updated_at_column().
- `phase5_g1b_rollup_trigger_chain` — three SECURITY DEFINER trigger functions + triggers:
  - `_rollup_content_item_to_module` — AFTER INSERT/UPDATE OF status ON content_item_completions. On transition into 'completed', counts required non-archived content items vs user-completed, upserts module_completions, fires module_completed notification on the not-completed→completed transition.
  - `_rollup_module_to_curriculum` — AFTER INSERT/UPDATE OF status ON module_completions. Loops every active curriculum assignment containing the module, counts required modules vs done, completes the assignment + fires curriculum_completed.
  - `_rollup_curriculum_to_cert_path` — AFTER UPDATE OF status ON user_curriculum_assignments. Only cert_path-source assignments with a certification_id. Resolves cert path via source_reference_id, counts required curricula vs completed, flips coach_certifications.status='certified', certified_at=now(), certified_by=NULL (system-granted). Calls apply_post_certification_benefits() + fires certification_granted. The status UPDATE fires the existing trg_auto_grant_combined_cert for free.
- `phase5_g1c_empty_module_vacuous_complete` — patched `_rollup_module_to_curriculum`: a required NON-ARCHIVED module with zero required content items never gets a module_completions row (Tier 1 never fires for it), which would permanently block the curriculum. Fix: Tier 2 counts a module as done if EITHER it has a completed module_completions row OR it has zero required content items. Correct defensive behavior for a real future tree.
  - CORRECTION (found during Group 5): on the CURRENT test tree this patch is NOT what made the Group 1 test pass. Test Modules A and B are `archived`, not merely empty. Every tier of the rollup filters `archived_at IS NULL`, so A and B are not counted at all — the curriculum's effective required-module count is just Module C. The Group 1 test rolled the curriculum to completed because A/B were filtered as archived, NOT because they were treated as vacuously complete. The g1c patch is still correct defensive logic, but it was not exercised by the Group 1 test. The migration behavior is correct; the earlier test-writeup explanation of the mechanism was wrong.

Idempotency: every function checks TG_OP + "transitioned INTO completed" + "parent not already completed". Re-saves, downgrades, and a child completing after the parent is done are all no-ops.

End-to-end test (BEGIN...ROLLBACK, production untouched): seeded a cert + cert_path-source curriculum assignment for testclientbwe+branding, completed Module C's 2 required content items. Chain propagated: module C → completed, curriculum → completed (modules A/B are ARCHIVED, so filtered out of the required-module count entirely — see g1c correction above), certification → certified, certified_by=NULL. Zero emails — test user given 'none' notification prefs so notify_user returns before any pg_net call.

Notification catalog note: there is NO `certification_completed` type. The auto-grant reuses `certification_granted` (critical, non-configurable) — the same notification the manual grant_certification RPC fires. The catalog has module_completed (in_app) and curriculum_completed (both).

## Migration Group 2 — content-item completion writers — DONE + VERIFIED (Session 70)

Two migrations applied and verified:
- `phase5_g2a_live_event_action_type` — added `live_event_attendance_marked` to the `super_admin_action_types` whitelist. Required because `super_admin_audit_log.action_type` has a hard FK to that table; without the row, `mark_live_event_attendance`'s audit call would fail the FK. Shape copied from the sibling `skills_practice_signoff` row (category `content_authoring`, is_mutation true, denylist_during_impersonation true).
- `phase5_g2b_content_item_completion_writers` — the four missing writers, all SECURITY DEFINER, all UPSERT `content_item_completions` keyed on `(user_id, content_item_id)` so they feed the Group 1 rollup automatically:
  - `record_video_progress(p_content_item_id, p_watch_pct, p_last_position_seconds)` — trainee-callable, gate `assessment_submission`. `video_watch_pct` = GREATEST(old,new) (never regresses); `video_last_position_seconds` = latest (resume point). Completes at `video_completion_threshold_pct` (default 95). Never downgrades a completion.
  - `confirm_external_link(p_content_item_id)` — trainee-callable, gate `assessment_submission`. Sets `external_link_confirmed_at`, `status='completed'`.
  - `submit_file_upload(p_content_item_id, p_file_url, p_filename, p_size_bytes)` — trainee-callable, gate `assessment_submission`. Validates size vs `file_upload_max_bytes`. Auto-completes on upload (decision 1). Re-upload overwrites the file fields.
  - `mark_live_event_attendance(p_content_item_id, p_trainee_user_id, p_attendance_status)` — mentor/super-admin ONLY, not trainee-callable. Gate `coach_action`. Authorizes caller as super_admin OR active mentor of the trainee (same auth block as `mark_skills_practice_signoff`'s mentor path). Completes only when attendance is `'attended'`. Super-admin calls write `log_super_admin_action('live_event_attendance_marked', ...)`.

Verified by test (all BEGIN...ROLLBACK, production untouched, test users given 'none' notification prefs):
- All four exist, SECURITY DEFINER, correct signatures.
- `record_video_progress`: 97% completes, 50% stays in_progress; watch_pct never regresses (30% after 80% stays 80%).
- End-to-end: `record_video_progress`(97%) + `confirm_external_link` on Module C's 2 required items drove module -> curriculum -> certification to `certified`, `certified_by` NULL. Confirms the Group 1 rollup fires off the Group 2 writers.
- `mark_live_event_attendance`: unauthorized caller rejected (`not_authorized_to_mark_attendance`); super-admin marking `attended` completes the item; `missed` stays in_progress; super-admin audit row written with correct `after_value` payload.
- NOT tested for lack of fixture data: `submit_file_upload` end-to-end (zero file_upload items in DB) and the mentor branch of `mark_live_event_attendance` (zero coach_mentor_assignments). Logic mirrors verified paths; real coverage comes in Migration Group 5.

Test-method note: a `UNION ALL` SELECT that both calls `log_super_admin_action` and counts its rows sees a pre-INSERT snapshot in the count branch — the count must be a separate statement after the call. This is a test artifact, not a bug; the audit write is correct.

## Migration Group 3 — lesson progress RPCs — DONE + VERIFIED (Session 70)

One migration applied: `phase5_g3_lesson_progress_rpcs` — four RPCs, all SECURITY DEFINER, locked search_path, gate `assert_impersonation_allows('assessment_submission')`, `authenticated` execute grant.

- `upsert_lesson_progress(p_content_item_id, p_furthest_continue_client_id, p_last_block_id)` — upserts content_item_completions, sets the two lesson columns (lesson_furthest_continue_client_id, lesson_last_block_id), promotes not_started→in_progress, sets started_at on first write. Deliberately does NOT touch completed_at or attempts_count.
- `upsert_lesson_block_progress(p_block_id, p_status, p_completion_data)` — per-block progress for interactive blocks. Resolves the parent content_item_completions row (creates it inline if absent), resolves attempt_number from attempts_count, upserts on the existing UNIQUE(completion_id, block_id, attempt_number).
- `start_lesson_reattempt(p_content_item_id)` — increments attempts_count, resets status/started_at/completed_at + both lesson columns. Prior lesson_block_progress rows retained (keyed by attempt_number) as history.
- `complete_lesson(p_content_item_id)` — dedicated lesson completion writer. Trusts the viewer's "trainee finished" judgment (the viewer owns the lesson_completion_mode gating logic); the RPC guards item type / archived / idempotency and records the completion. Setting status='completed' feeds the Group 1 rollup like any other item type.

Decisions locked this group: (1) full-lesson re-attempts ARE supported — start_lesson_reattempt built. (2) NO audit logging on any Group 3 RPC — progress is high-volume and already captured in the progress tables; not a super-admin action. (3) complete_lesson trusts the viewer (does not re-derive completion eligibility server-side) — consistent with confirm_external_link / record_video_progress; a v2 hardening could add server-side enforcement.

Verified by test (BEGIN...ROLLBACK against the real fixture lesson 32e0e966):
- Full lifecycle: create progress → block progress at attempt 1 → start_lesson_reattempt bumps to attempt 2 → block progress at attempt 2 is a NEW row, attempt-1 row retained.
- complete_lesson is idempotent — second call returns completed cleanly, no error.
- Negative rollup test: completing the OPTIONAL lesson item (is_required=false in Module C) creates an `in_progress` module_completions row, NOT `completed` — the module correctly stays incomplete because its 2 required items (video, external_link) are untouched. The rollup does not false-fire. Note: this means a module_completions row appears as soon as a trainee touches ANY item in the module — better than "no row", as the Phase 6 mentor UI wants the in_progress state.

DOC CORRECTION: phase-5-lesson-progress-carry-forward.md §5.2 says `lesson_completion_mode` lives on `content_item_completions`. It actually lives on `content_items` (verified Session 70). It is the author's per-lesson setting (scroll_and_checks / explicit_continue) for HOW a lesson completes; the viewer reads it to decide WHEN to call complete_lesson. The carry-forward doc is stale on this point; correct it next time that doc is touched.

ACL note: Group 3 RPCs got an explicit `REVOKE FROM anon` that the existing progress writers (submit_quiz_attempt etc.) do not have — those have an explicit `anon=X` grant. Net effect is the same: PUBLIC's `=X` grant means anon can still call, and the real gate on every progress RPC is the `auth.uid() IS NULL → authentication_required` check. The REVOKE was harmless but unnecessary; left as-is, not worth a migration to "fix".

## Migration Group 4 — get_cert_path_detail read RPC — DONE + VERIFIED (Session 70)

One migration: `phase5_g4_get_cert_path_detail` — one read RPC, SECURITY DEFINER, `authenticated` execute grant.

`get_cert_path_detail(p_certification_path_id, p_user_id DEFAULT NULL)` — the cert-path-rooted companion to the curriculum-rooted `get_user_learning_state`, for Phase 5.2. Returns:
- `certification_path` — the certification_paths row (name, description, certification_type, delivery_mode, slug, prerequisite_path_id, cert_instrument_ids, thumbnail).
- `user_certification` — the user's coach_certifications row for this path's certification_type, or null. Linked by certification_type (coach_certifications is UNIQUE(user_id, certification_type) so at most one).
- `curricula[]` — the path's certification_path_curricula in display_order, each with curriculum metadata + display_order + prerequisite_curriculum_id + is_required + the user's user_curriculum_assignment status for that curriculum (matched on source='certification_path' AND source_reference_id=path id), or null.
- `viewer_role`, `user_id`, `generated_at`.

Auth: self / mentor-of / super_admin, same three-way as get_user_learning_state. `p_user_id` defaults to the caller (Phase 5.2 is mostly self-view); a mentor or super admin can pass another user's id. Pure SELECT, no writes.

Note: certification_paths has NO uniqueness constraint on certification_type, so multiple non-archived paths COULD share a type in the future. Currently only ptp_coach exists. The RPC takes the path id directly (unambiguous about which path) and links the user cert by certification_type — if two paths shared a type, both would correctly show the same user cert row, which is fine for a read RPC.

Verified by test (live ptp_coach cert path 57db528d):
- Super admin viewing a not-started trainee: full cert path metadata, curricula_count 1, user_certification null, user_assignment null, viewer_role super_admin.
- Trainee self-view with p_user_id omitted: caller-default works (target_user = caller), viewer_role self, enrolled state surfaces both user_certification (in_progress) and user_assignment (active).
- Unauthorized cross-user read: raises access_denied (42501).
- Archived cert path: raises certification_path_archived (22023).

## Migration Group 5 — fixture verification — DONE, PERSISTED (Session 70)

NOT a migration — an operational fixture-setup + end-to-end verification on real production data. Chose PERSIST (not roll back) so the Phase 5 frontend work has a standing fixture to build against without re-doing setup.

Steps executed against production:
1. Published the test tree: `is_published=true` on curriculum PTP VILT 1 (aa221e50) + module Test Module C (ece0a34f). Content items have no is_published column. Archived modules A/B deliberately untouched.
2. Attached PTP VILT 1 to testcoach2's EXISTING in-progress ptp_coach cert (0eceee94) via `assign_curriculum_directly` with source='certification_path', source_reference_id=cert path id, certification_id=existing cert — the identical row shape `enroll_user_in_certification_path` produces. (testcoach2 already had an in-progress cert from April with zero assignments because nothing was published at enroll time; re-enrolling would have hit the already-enrolled guard. Attaching to the existing cert is the clean path.)
3. Walked real completions as testcoach2 through the real Group 2 writers: record_video_progress(100%) on the video, confirm_external_link on the external link — Module C's 2 required items.
4. Verified the full chain landed on persisted data: both content_item_completions `completed`, module_completion Test Module C `completed`, curriculum_assignment PTP VILT 1 `completed`, coach_certification ptp_coach `certified` with certified_by=NULL (system-granted).

This run additionally exercised (for real, not in a rolled-back txn) `_rollup_curriculum_to_cert_path` firing the pre-existing `trg_auto_grant_combined_cert` — it fired without error, confirming the auto-grant path coexists cleanly with the Combined-cert derivation trigger.

STANDING FIXTURE NOW IN PRODUCTION:
- Published tree: PTP VILT 1 curriculum + Test Module C.
- testcoach2 (2f591eb3, real coach account): `certified` ptp_coach cert, `completed` PTP VILT 1 assignment, `completed` Module C, `completed` video + external_link content items.

CAVEATS (standing):
- This did NOT re-exercise `enroll_user_in_certification_path`'s fan-out loop (ran in April, attached nothing). The loop is recon-verified by reading its body, not live-tested. Re-testing live needs a second coach test account (account creation — prohibited action, must be done outside session).
- testcoach2 is now `certified`, not a fresh enrollee. Phase 5 frontend testing of not-started / in-progress states needs a different fixture: testclientbwe+branding (357358fa, individual account) is clean and available, or reset testcoach2.

## Phase 9 Backend — DONE + VERIFIED (Session 70)

Seven migrations. The Resources tab gating + authoring backend, fully verified.

- `phase9_a_resource_tabs` — `resource_tabs` lookup table (data-driven, orderable, extensible tab model). Columns: slug, name, display_order, is_coach_only, is_learning_tree. Seeded 3 launch tabs: my_learning (is_learning_tree=true), all_resources, coach_resources (is_coach_only=true). RLS: authenticated reads the tab list, service_role + super_admin write. Design decision: my_learning IS a row in this table with is_learning_tree=true — keeps the tab list fully data-driven and reorderable; the frontend renders the learning tree there instead of resource tiles.
- `phase9_b_resources_columns` — extended `resources`: resource_tab_id FK, summary, thumbnail_asset_id FK content_assets ON DELETE SET NULL, is_published, created_by, created_at, updated_at, archived_at. Legacy audiences/category columns left dormant (non-destructive). resource_tab_id is nullable at schema level only because ALTER ADD can't default it; upsert_resource enforces it required.
- `phase9_b2_relax_legacy_audiences_notnull` — the legacy `resources.audiences` (and `content_type`) columns were NOT NULL with no default, which blocked every new-model insert. Relaxed to nullable. Non-destructive; the columns stay dormant. Found during testing — the "leave legacy columns dormant" decision needed this addendum to actually work.
- `phase9_c_resource_access_grants` — polymorphic additive gating table. One row = one grant; grants are OR'd. grant_type CHECK: organization / account_type / plan_tier / corporate_level / coach_certification / all_coaches. Shape-consistency CHECK enforces each grant_type uses exactly its needed fields. RLS: service_role + super_admin only — trainees/coaches never read it directly; get_user_resources evaluates on their behalf.
- `phase9_d_get_user_resources(p_user_id DEFAULT NULL)` — the gating evaluator. Returns the full tab list (so the frontend knows tabs + order) + for resource-backed tabs only, the published non-archived resources the user can see. my_learning content is NOT served here (null) — the frontend calls get_user_learning_state / get_cert_path_detail for that tab. Visibility: user matches ANY grant (additive OR), OR user is super admin (sees all published). coach_resources tab only surfaces to coaches + super admin. plan_tier grant_value maps: 'free'=subscription_status inactive, 'base'/'premium'=status active AND tier=value. Auth: self / super_admin (no mentor case — resources aren't trainee-specific).
- `phase9_e1_resource_action_types` — 4 audit whitelist entries (resource_created/updated/archived, resource_access_grants_set), category content_authoring. Same FK-to-super_admin_action_types gotcha as Group 2a.
- `phase9_e2_resource_authoring_rpcs` — super-admin authoring RPCs, all assert_super_admin + impersonation gate (content_authoring) + reason>=10 + log_super_admin_action:
  - `upsert_resource(p_id, p_resource_tab_id, p_title, p_summary, p_url_or_content, p_content_type, p_is_published, p_reason, p_thumbnail_asset_id)` — create/update. Rejects placing a resource in a learning-tree tab.
  - `archive_resource(p_id, p_reason)` — soft-delete; sets archived_at + is_published=false.
  - `set_resource_access_grants(p_resource_id, p_grants jsonb, p_reason)` — replace-all the grants for a resource. Table CHECK constraints validate each spec; a bad spec rolls back the whole RPC atomically.

Verified by test (BEGIN...ROLLBACK):
- Tab visibility per account type: coach sees 3 tabs (incl coach_resources), individual sees 2.
- All 6 grant types' matching logic, with 5 seeded resources: coach sees all_coaches + coach_certification(ptp_coach, certified) grants; individual (free, no org_level) sees nothing; super admin sees all 4 published, not the unpublished one.
- Additive OR: a resource with 3 grants (premium/Director/all_coaches) is visible to a coach matching only all_coaches.
- Full authoring lifecycle: non-admin rejected; super admin creates; learning-tree-tab placement rejected; set 2 grants; coach immediately sees it via grant; archive; archived resource disappears from get_user_resources.

COVERAGE GAP (standing): the `organization` grant type's matching logic is not exercised against a real org-member (no test user with organization_id set was used). It's a simple equality check (g.grant_org_id = v_user.organization_id), low-risk, but not test-proven.

## Asset-pipeline resource_id fix (F1-F4) — DONE + VERIFIED (Session 70)

Surfaced immediately after Phase 9 backend: the Resource Authoring UI (G8) needs to upload a thumbnail for a `resources` row, but the asset pipeline had no `resource` parent mode. `content_asset_refs` supported 5 parents (content_item, lesson_block, module, curriculum, certification_path); `resources` was not one. Four fixes, all verified:

- **F1** `phase9_f1_content_asset_refs_resource_parent` — added `content_asset_refs.resource_id` column + FK to `resources(id)` + replaced the 5-way `exactly_one_parent` CHECK with a 6-way version + partial indexes. `content_asset_refs` now supports `resource` as a parent type.
- **F2 / F2b** — extended `create_asset_ref` RPC with a `p_resource_id` param; dropped the old overload (the §59 CREATE-OR-REPLACE-adds-an-overload trap — must DROP the prior signature explicitly).
- **F3** `phase9_f3_request_asset_upload_resource_mode` — extended `request_asset_upload` RPC with a full `resource` parent mode (now 15-arg); dropped the old 14-arg overload. Path convention `resource/<resource_id>/<asset_id>.<ext>`. 7/7 functional tests passed: resource upload, ref creation with resource_id, non-thumbnail rejection, non-image rejection, multi-parent rejection, archived-resource rejection, backward compat with the 5 existing parent modes.
- **Edge Function** `request-asset-upload` deployed **v4, ACTIVE, verify_jwt:true**. Two-line change: `resource_id` added to the request interface + passed as `p_resource_id` to the RPC. Required Cole to supply the deployed bundle via the Dashboard Download button — see the tooling-capability note below.

**KNOWN SYNC GAP (standing):** the asset Edge Functions (`request-asset-upload` and siblings) plus `_shared/impersonation_gate.ts` exist in the deployed Supabase runtime but are NOT in the GitHub repo. The repo's `_shared/` has only `errors.ts` + `secrets.ts`. Any future Edge Function patch that touches `_shared/impersonation_gate.ts` needs Cole to supply the full deploy bundle (every relative import) via the Dashboard Download button — Claude cannot read the deployed Edge Function runtime.

**Still open — `create_asset_ref` library-pick path:** F4 (below) added the archive-prior-ref + link-thumbnail logic to the UPLOAD path (`request_asset_upload`). The LIBRARY-PICK path through `create_asset_ref` did NOT get the parallel fix. Logged as a Build Queue item; not blocking the Resource Authoring UI because the UI's primary path is upload, not library-pick.

## Resource Authoring UI (G8) — BUILT + TESTED (Session 70)

Built via Lovable, all 6 files verified present + correct in `cbastianBWE/brainwise-blueprint` main, tested end-to-end. This is **step 4 of the revised build sequence — DONE.**

Files:
- NEW `src/pages/super-admin/resource-editors/_resourceShared.tsx` — constants. `CONTENT_TYPE_OPTIONS` corrected pre-build to the real `resources_content_type_check` values: `article / video / guide / worksheet / template` (the original prompt guessed `pdf/link/reference_library` which would have failed the CHECK; `reference_library` is actually a `category` value, not a content_type). Plus GRANT_TYPE_OPTIONS, ACCOUNT_TYPE_OPTIONS, PLAN_TIER_OPTIONS (free/base/premium), CORPORATE_LEVEL_OPTIONS, re-exported CERTIFICATION_TYPES.
- NEW `src/pages/super-admin/resource-editors/ResourceEditor.tsx` (~26.6KB) — editor on the Phase 4 ModuleEditor pattern + a grants sub-section with its own reason field + own save button (grants are a distinct audited action — `set_resource_access_grants` separate from `upsert_resource`).
- NEW `src/pages/super-admin/AdminResourceAuthoring.tsx` — flat list grouped by tab (not a tree), single useQuery Promise.all over resource_tabs / resources / organizations, URL sync, learning-tree tabs filtered out of the tab picker.
- EDIT `src/App.tsx` — route `/super-admin/resources` with RoleGuard + SuperAdminSessionProvider.
- EDIT `src/components/AppSidebar.tsx` — "Resource Authoring" entry in superAdminNav after Content Authoring.
- EDIT `src/components/super-admin/FileUploadField.tsx` — `resourceId` prop threaded through interface + signature + both defaultReason chains + both invoke bodies + both useCallback dep arrays + `handleLibraryPick` widened with an `else if (resourceId)` branch.

**3 bug-fix migrations found during end-to-end UI testing** — all verified:
- `phase9_e2b_fix_upsert_resource_null_id` — `upsert_resource`'s create path passed an explicit `p_id = null` straight into the INSERT, overriding the column's `gen_random_uuid()` default (a column default only fires when the column is OMITTED, not when NULL is supplied). Fixed with `COALESCE(p_id, gen_random_uuid())`.
- `phase9_b3_resources_super_admin_rls` — `resources` RLS had only the legacy "audience overlap" SELECT policy gating on the dormant `audiences` array; new-model resources have `audiences = null`, so super admin could not SELECT their own just-saved rows (the UI saved fine but the list stayed empty). Added a super-admin ALL policy (`WITH CHECK ... AND NOT is_impersonating()`). Decision (Cole approved): regular users do NOT get direct-table SELECT on `resources` — they read through `get_user_resources` (SECURITY DEFINER). Legacy policies left intact.
- `phase9_f4_asset_upload_archive_prior_ref_and_link_thumbnail` — two fixes to `request_asset_upload`, applied to the parented-upload block: **(Fix 1, all 6 parent modes)** before inserting a new ref, archive any existing active ref for the same `(parent, ref_field)` — fixes orphaned-ref accumulation on repeated uploads. **(Fix 2 / Option C, 5 of 6 modes — NOT lesson_block, which has no `thumbnail_asset_id` column)** when `ref_field='thumbnail'`, also set the parent row's `thumbnail_asset_id` to the new asset — fixes the uploaded thumbnail not being linked to the parent row until the editor Save. Verified 3/3: three sequential uploads → 1 active ref + 2 archived, `thumbnail_asset_id` points at the latest. `request-asset-upload` Edge Function did NOT need a redeploy — all of F4's logic is in the RPC.

**End-to-end test — PASSED.** Test resource "Test Resource" (`6e391f11-19e3-487d-a7f3-c91d38602e25`) created → read/displayed → thumbnails uploaded (F1-F4 chain works, refs created with `resource_id`, correct `resource/<id>/` storage paths) → 2 access grants set (account_type=coach, plan_tier=base) → archived (soft-delete + unpublish + `resource_archived` audit entry, all verified). Note: thumbnail uploads during testing predated `phase9_f4` so left 3 orphaned refs + null `thumbnail_asset_id` on that resource — moot since archived; `phase9_f4` is forward-looking only.

## RECURRING LESSON — extending a pre-existing table needs a FULL audit (Session 70)

Extending the pre-existing `resources` table (vs. building `module_completions` greenfield) caused **four separate bugs this session**, all from the same root: a new column was added without auditing the table's existing defaults, CHECK constraints, AND RLS policies.

1. `phase9_b2` — legacy `audiences` / `content_type` were NOT NULL with no default → blocked every new-model insert.
2. `phase9_e2b` — explicit `p_id = null` overrode the `gen_random_uuid()` column default.
3. `phase9_b3` — RLS only had the legacy audience-overlap SELECT policy → super admin couldn't read new-model rows.
4. The `content_type` CHECK guess (`pdf/link/reference_library`) — caught pre-build, would have failed `resources_content_type_check`.

**Standing rule:** before extending any pre-existing table, audit its full DDL — `\d+ table`, plus `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='table'::regclass` for CHECKs, plus `SELECT * FROM pg_policies WHERE tablename='table'` for RLS. ADD COLUMN is never the whole job on an established table. Greenfield tables (`module_completions`) don't have this hazard — the bug pattern is specific to extending tables that already carry constraints and policies.

## Tooling-capability lesson (Session 70)

Claude initially overstated, then mis-stated, its Edge Function capability. The ACTUAL constraint:
- Claude CAN read/write **Postgres functions** via `pg_get_functiondef` through `execute_sql` (they live in the DB).
- Claude CAN **write** Edge Functions via `deploy_edge_function`.
- Claude CANNOT **read** the deployed Edge Function runtime — this session's Supabase MCP had no `get_edge_function` tool.
- When an Edge Function has uncommitted `_shared/` dependencies, the deploy bundle needs every relative import. Cole must supply it via the Dashboard Download button.

**Going forward:** when an Edge Function patch is needed, ask Cole for the Dashboard Download-button bundle up front.

## Bucket-two status (post-authoring-UI build sequence) — Session 70 close

1. **Resource authoring UI — DONE** (built, verified, tested, 3 bug-fixes landed).
2. **Seed real resources via the UI — NOT DONE** — Cole's work, unblocked, no Claude dependency.
3. **`lesson-blocks-content-schema.md`** — NOT DONE. Pulled the real config JSON for all 18 `lesson_blocks` block types via `execute_sql` (accordion, button_stack, callout, card_sort, flashcards, heading, knowledge_check, list, quote, scenario, stat_callout, statement_a_b, tabs, text all have real instances; image/divider/video_embed/embed_audio have no instances yet). The doc itself is not written.
4. **Unified visual primitive design-lock** — NOT DONE.
5. **Phase 9 Resources tab frontend** — NOT DONE. Backend ready (`get_user_resources`); depends on item 4.
6. **Phase 5 structural navigator** — NOT DONE. Backend ready (`get_user_learning_state`); depends on item 4.
7. **Phase 5 content-item players** (8 players) — NOT DONE. Largest remaining item. The `lesson_blocks` player needs the interactive-widget recon done first — that recon is itself unstarted.

**Items 3-7 do NOT fully close Group C Phase 5 + Phase 9.** Even with 3-7 complete, the following remain: AIRSA Phases 3e-8 (a separate Group C track entirely), the interactive-widget recon (a prerequisite buried inside item 7), the `create_asset_ref` library-pick orphan path (F4 fixed only the upload path), and item 2 (Cole's to do). 3-7 closes the trainee-facing and resources-facing FRONTEND for the two phases — it is not the whole of Group C.
