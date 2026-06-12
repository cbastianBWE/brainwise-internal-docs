# BrainWise Session 130 to 131 Handoff

*Closeout: Session 130. Open: Session 131.*

## Where Session 130 left off

Three backlog items shipped end-to-end and verified, no Operations work. **Item 2** (+10/25 one-time AI-chat credits): enforcement wired into `check-ai-usage` v61 as a fallback allowance, two DB trigger families for coach-funded clients (+10) and coaches themselves (+25), and idempotent backfills (590 credits to 26 users); the chat UI was already credit-aware so no frontend change; Cole smoke-test-verified. **Item 12** (Lesson Builder): a picker page under Content Authoring that opens the existing lesson-block editor (Option C), frontend-only, SHA-verified. **Item 8** (super-admin learning report): two read RPCs, a net-new cert-tier bulk RPC, a cert-path data-model cleanup (new `certification_path_id` FK + backfill + draft-path archive + enrollment patch), and the dashboard frontend. All verified.

## Session 131 opening priorities, in order

### 1. Cole's pick from the remaining active backlog

Open items: **4** (in-system support chatbot + admin capture surface), **5** (white-label full track — multi-session arc, Cole already approved "all of it"), **6** (SCORM export for the lesson block), **7** (lesson-block tracking API + HRIS ingest), **11** (subfolder organization for My Learning and Resources). Items 6 and 7 are one SCORM/LMS-API arc; 5 is its own large arc. Recommend confirming which arc to start before building.

### 2. Live in-app verification of Session-130 work (optional, app-side)

- `BQ-PTP-PERFECT-VERIFY`: still open, needs an authenticated super-admin JWT in the app.
- The learning-report dashboard and the cert bulk actions are best smoke-tested in-app by a super admin (the backend is fully verified via JWT-sim, but a real click-through of the bulk reason flow + CSV export is worth one pass).

## Decisions locked in Session 130 (recap)

- Item 2 credits are **fallback-only** (consumed only when the normal allowance would deny) and apply **uniformly** to chat and report generation. They compose with a future coach subscription pool.
- Item 2 client grant is **coach-funded only** (`pi_`/`comp_`); NULL self-pay `coach_clients` rows are skipped because the self-pay grant fires on the Stripe `payment` branch (no double-grant).
- Item 12 is **Option C** (standalone "Lesson Builder" picker) nested as a **child of Content Authoring** in the sidebar.
- Item 8 report shows **both axes on one page** (content-first + person-first, filter-driven); CSV exports the **full filtered set** across all pages (everything when unfiltered); **all four tiers** support bulk complete/incomplete; the frontend is a **dashboard with widgets plus drill-down**, not just a table.
- Item 8 expected/not-started **denominator** is curriculum-derived (plus direct assignments and actual completion holders), excluding archived content unless a completion exists.
- Cert tier is keyed on the **real cert path** (new FK), not the legacy `certification_type` string. The two active `ptp_coach` paths are **not duplicates** (different curricula); the unpublished draft was archived, the published path is canonical. The legacy `my_brainwise_coach` cert is left null-path (report falls back to type).

## Open questions / things to lock in Session 131

None blocking. The remaining backlog items (4, 5, 6, 7, 11) need a "which to start" decision; items 5 and 6+7 are multi-session arcs.

## Bugs surfaced in Session 130 added to Build Queue

- None new. (Pre-existing carryforwards remain: `BUG-NWS-1` newsletter attachment-send hang; Doc-1 invoice live refund test.)

## What's NOT in scope for Session 131

- No Operations / CRM work unless Cole redirects (this was a SaaS-platform session).
- Do not "fix" `ai_transformation_ptp_coach` as garbage: it is a real (currently dormant) auto-granted combined certification type with no cert path; the report's null-path fallback is the intended handling.

## Architecture additions in Session 130

(Full detail in architecture-reference.md v132.)

- **check-ai-usage v61**: honors `users.one_time_chat_credits` as a fallback at every denial site (except contract-disabled corporate chat); `grant_one_time_chat_credits` / `consume_one_time_chat_credit` revoked from anon + authenticated.
- **Triggers**: `grant_chat_credits_on_coach_client_link` (coach_clients, +10 coach-funded), `grant_chat_credits_on_coach_onboarding` (users, +25 per coach). Namespaced source_refs (`cc_link:`, `coach_onboard:`).
- **get_learning_report_detail** + **get_learning_report_summary** (super-admin-gated read engine; derived expected population; both axes via filters; `p_limit` NULL = full CSV export).
- **set_certification_completion** (+`_bulk`): net-new cert-tier manual-override mutation; registered action type `certification_completion_set`.
- **coach_certifications.certification_path_id** FK to `certification_paths` (+ index); backfilled; `enroll_user_in_certification_path` and `self_enroll_in_certification_path` now stamp it. Draft duplicate path `57db528d` soft-archived.
- **Frontend**: `LessonBuilderList.tsx`, `LearningReport.tsx`, plus route + sidebar wiring.

## Test fixture state at end of Session 130

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Cert/learning fixtures: after the Session-130 cleanup, real coaches resolve to the published "BrainWise Personal Threat Profile Coach" path (`fa22e4aa`); a handful of test coaches plus Cole's own in-progress cert sit on the now-archived draft "PTP-Coach" (`57db528d`). A test `ai_transformation_ptp_coach` cert was deleted. No pending cleanup.

## Documents this session leaves behind

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs (flat root):

- build-queue.md (v138)
- architecture-reference.md (v132)
- session-130-to-131.md (this document)

No .docx generated (Session-74 decision).
