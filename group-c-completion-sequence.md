# Group C Completion Sequence

*Locked Session 71. Supersedes earlier sequence statements in v66 / v62 build-queue entries. Reference for every Group C session until Group C is fully closed.*

## Where Group C stands today

**Done as of Session 71 close**:
- Phases 1, 2, 3, 3.5 — Schema, core RPCs, notifications subsystem, enrollment + un-assignment RPCs (Session 54)
- Phase 4 backend + frontend for the LEARNING TREE — cert path editor, curriculum editor, module editor, polymorphic content item editor, asset pipeline, AI authoring panel, 18-block lesson_blocks catalog (Sessions 55-69)
- Phase 5 backend — module_completions, the 4-tier rollup trigger chain, 4 missing content-item completion writers, 4 lesson progress RPCs, `get_cert_path_detail` (Session 70)
- Phase 9 backend — `resource_tabs` data-driven tab model, `resource_access_grants` polymorphic gating, `get_user_resources` RPC, 3 resource authoring RPCs (Session 70)
- Resource Authoring UI — super-admin authoring for `resources` with grants sub-section (Session 70)
- Asset pipeline `resource` parent mode — F1-F4, `request-asset-upload` Edge Function v4 (Session 70)

**Not yet done** — listed below in completion order.

---

## Completion order (locked Session 71)

### 1. Phase 9 frontend — Resources tab

**Dependency**: unified visual primitive design-lock (step 0 below; runs at the start of step 1).

Three tabs (My Learning / All Resources / Coach Resources), tab list data-driven from `resource_tabs`. Replaces `Resources.tsx` placeholder. Uses the unified visual primitive for tiles. Coach Resources tab gated to coaches + super admin (already enforced in `get_user_resources`).

Acceptance: a super admin can publish resources via the existing Resource Authoring UI, and a coach / individual / org admin sees the resources they're entitled to per the gating model. Empty state handled.

**Note**: My Learning tab IS part of Phase 9 from the data-flow side (it's a tab in the same Resources page surface) but renders learning-tree data, not resource tiles. It uses `get_user_learning_state` / `get_cert_path_detail` — the Phase 5 backend RPCs. So step 1's "My Learning tab shell" overlaps with step 2's "Phase 5 frontend." Treat the My Learning tab shell as part of step 1; the per-item viewers inside My Learning are step 2.

### 2. Phase 5 frontend — trainee learning UI

**Dependency**: step 1 (My Learning tab shell exists; the trainee UI lives inside it).

Sub-phases serial per §75 batch-recon-batch-design-lock-serial-Lovable pattern:

- **5.1** My Learning landing — handled by the My Learning tab built in step 1.
- **5.2** Cert path detail — `get_cert_path_detail` already exists.
- **5.3** Curriculum detail — `get_user_learning_state` already covers it.
- **5.4** Module detail — `get_user_learning_state` already covers it.
- **5.5** Per-item viewers — 8 viewers (quiz, written, skills, video, external link, file upload, live event, lesson_blocks). The `lesson_blocks` viewer needs the interactive-widget recon (prereq) done first.
- **5.6** Cert grant — no dedicated frontend; auto-rollup handles it. Frontend reflects auto-flipped `coach_certifications.status='certified'` wherever certifications are already displayed.

**Prereq inside 5.5**: interactive-widget recon. Unstarted. Defines how the trainee renderer of interactive blocks (flashcards / card_sort / scenario / knowledge_check) connects to `upsert_lesson_block_progress`, honors `gating_required`, and handles re-attempts. ~half-day to half-session of recon.

Acceptance for closing Phase 5: "trainee can complete a full cert path from invitation to certification grant via the UI alone." Locked Session 70.

### 3. Phase 4 finishing items

Phase 4 lesson block authoring is COMPLETE for the v1 catalog (Session 69 close — all 18 block types shipped). But Phase 4 includes three other authoring surfaces not yet built:

- **Quiz authoring** — full question bank infrastructure separate from the `knowledge_check` lesson_block. New tables likely needed (`quiz_questions`, `quiz_answer_options`, `quiz_attempts` — the latter already exists). 5 question formats (multiple choice / true-false / select all that apply / match definition / match picture) per Group C scope §3 Q2. Pass threshold + retake config + show-correct-answers mode. The `knowledge_check` block reuses the 7 question types this builds.
- **Mentor assignment UI** — super admin assigns mentor to trainee. Backend likely supports this already via `coach_mentor_assignments` table from earlier Group C work; check + ship the UI.
- **Direct curriculum assignment UI** — super admin direct-assigns curriculum to user (bypassing cert path enrollment). Per Group C scope Q4C — uses `source='direct_assignment'`. Backend RPC `assign_curriculum_directly` exists (Session 54).

Why these come after Phase 5 frontend instead of before: Phase 5 frontend is the unlock for actually testing the full coach certification flow end-to-end. The Phase 4 finishing items are quality-of-life authoring affordances that don't block the first trainee completing a cert path.

### 4. Phase 6 — mentor review UI

`/mentor/queue` — pending reviews list. Review detail page with full submission context + attempt history + comment field + approve/revise actions. `/mentor/trainees` — assigned trainees with progress overview. Trainee progress page.

Reads `module_completions` + `user_curriculum_assignments` + per-item progress tables for the "3 of 5 modules complete" rollup display (the materialized rollup tables built Session 70 power this).

### 5. Phase 7 — actor flow

Skills practice items wired to the existing client invitation flow with three differentiators:
- Allotment-based pricing using `free_assessment_uses`
- No-subscription actor account
- Certification metadata tag

Regression risk on standard coach-paid client invitations per Group C scope §8.1; mandatory regression test before merge.

### 6. Phase 8 — Order Assessment gating

Build Queue Item 37: `CoachClients.tsx` gates Order Assessment by certification_type:
- PTP-only certified coach → only PTP
- AI Transformation certified → NAI / AIRSA / HSS
- Combined → anything
- Revocation status enforced

Frontend gating only — backend matchup is already gated by certification.

### 7. Phase 10 — polish

- Empty states for all new screens
- Loading skeletons
- Error boundaries on RPC calls
- Notification preferences UI at `/settings/notifications`
- Bell icon + notification dropdown in main nav
- `/notifications` full page
- Audit log integration verification
- Brand styling pass on all new screens (Navy / Orange / Sand / Teal compliance + 8-color BrandColorSwatch where applicable)
- Accessibility baseline (focus order, keyboard nav, screen reader labels)

### 8. AIRSA Phases 3e-8

Separate Group C track entirely. Sequenced last because it's been deferred multiple sessions and is not on the critical path for the coach certification launch.

Per the Session 39 architecture, Phases 3e-8 cover AIRSA org dashboard backend + frontend (mirrors PTP/NAI dashboarding patterns). See `architecture-reference.md` for AIRSA-specific Phase 5a/5b backend strategy locked Session 41.

---

## Step 0 (runs at start of step 1): unified visual primitive design-lock

The shared tile primitive used by Phase 9 (resources) AND Phase 5 (learning tree tiles). Designed once. Output: a locked component spec — shape, typography, interaction model, variants, responsive breakpoints — then Lovable builds it as one shared component.

Why outside the numbered sequence: it's design work, not build work. Maybe 1-2 hours of conversation before the actual frontend builds start.

---

## What's NOT in this sequence (Group C scope)

- AI authoring polish bundle (deferred from Session 62 — duplicate-file handling, console-noise cleanup, Stage 2 Regenerate-from-scratch button, TTL hardening). Opportunistic pickup during Phase 5/9 frontend work if AI authoring is touched.
- The three [POST-LAUNCH] items from v75 — flashcards renderer state reset on AI Refine, Refine textarea voice dictation, Lovable preview-in-new-tab spinner. Post-launch, not Group C.
- `create_asset_ref` library-pick orphan path fix — F4 logic on the upload path was applied, the library-pick path wasn't. Build queue item, not on the critical path.
- `lesson-blocks-content-schema.md` doc — content-format contract for all 18 block types. ~half-day to write, useful for the interactive-widget recon. Write before Phase 5.5.
- Edge-Function-source-not-in-repo sync gap — asset Edge Functions exist in deployed runtime but not in GitHub repo. Cleanup, not Group C.
- SCORM/portability schema work — scoped but not started. Post-launch.

---

## Items NOT in Group C but adjacent

These are sequenced AFTER Group C closes:
- Group D — coach-side bulk invite + shareable link (SHIPPED Session 50 — backend + frontend complete).
- Group A — super admin core (impersonation, audit reporting, /super-admin/users page — SHIPPED Sessions 51-53).
- Group B — custom analytics (NOT STARTED, deferred per launch sequence to "last").
- Group E — deployment readiness (DONE per user confirmation Session 69 close).

After Group C closes, the post-Group-C workstream choice is Group A or Group D additions OR Group B based on customer feedback per the locked launch sequence (Session 34).

---

## Per-session expectations

Each session in this sequence delivers one numbered item, OR a sub-phase of the larger ones (5.2, 5.3, 5.4 each their own session for example). The interactive-widget recon may be its own session before Phase 5.5 ships.

Realistic estimate from Session 72 to Group C close:
- Step 1 (Phase 9 FE) — 1-2 sessions
- Step 2 (Phase 5 FE) — 5-7 sessions (5.2-5.4 each one session, 5.5 spans 2-3 sessions because of the 8 viewers, plus the interactive-widget recon)
- Step 3 (Phase 4 finishing) — 3 sessions
- Step 4 (Phase 6) — 2 sessions
- Step 5 (Phase 7) — 2 sessions
- Step 6 (Phase 8) — 1 session
- Step 7 (Phase 10) — 2 sessions
- Step 8 (AIRSA 3e-8) — 4-5 sessions

Total: ~20-25 sessions from Session 72 to all of Group C closed. The biggest single chunk is Phase 5 frontend.
