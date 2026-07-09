# BrainWise Session 169 to 170 Handoff

*Closeout: Session 169. Open: Session 170. (Note: Session 168's `session-168-to-169.md` handoff was never uploaded — this file follows `session-167-to-168.md` in the repo; the session-168 state lives in `build-queue-APPEND-session168.md` / `architecture-reference-APPEND-session168.md`.)*

## Where Session 169 left off

Built the Purpose group (0205, 0210 with the AI-driven Ikigai widget) and the Present anchor 0420 "Your PTP" (visual PTP display + PTP-required gate + external-assessment upload + AI analysis vs PTP → coaching plan), all as drafts. Fixed a real corporate AI-metering enforcement gap (`check-ai-usage` v67), added chat input caps (`ai-chat` v57, `coaching-activity-chat` v3), and ran a multi-round security-hardening arc that put the assessment/coaching data model behind presentation views and locked the base tables. A regression (revoking base reads before the repointed frontend was published) briefly broke assessment-taking and My Coaching on live; recovered by bridging, publishing, verifying live traffic on the views, and re-locking.

## Session 170 opening priorities, in order

### 1. Live E2E of 0420 "Your PTP"

Click through on a real non-admin session with a PTP: PTP-required gate → `ptp_display` → ptp_reflection → `assessment_upload` (pdf/docx/image) → `coaching-assessment-analyze` → assessment_reflection → `ai_panel` coaching plan. Confirm the metered decrement lands (individual + corporate, now enforced). Publish 0420 + 0210 once verified. Before publishing a metered activity, confirm the analyze→check-ai-usage path with a real non-admin session.

### 2. 0450 "Your team" (Present Foundational)

Heaviest source in the Present group. Leans on the hardened `bw_can_read_team_profile` path. Scope world-class from OneDrive source, present for approval leading with the strongest design question, build backend-first, read exact live runner via GitHub SHA before any Lovable prompt.

### 3. 0475 "Additional future thoughts" + remaining Present Foundational

Then close the Present group.

### 4. Continue the transition-map groups

Past, then Resolve, then External Support (Foundational), same cadence.

## Decisions locked in Session 169 (recap)

- 0420 = visual PTP display + `requires_ptp` gate + external-assessment upload (pdf/docx/image) + AI analysis vs PTP + reflection → coaching plan; shipped in stages.
- Activities can require a current PTP via a `requires_ptp` definition flag; denial reason `ptp_required` locks tile + runner with a link to take the PTP.
- Ikigai: AI assigns lens membership, supplies reasoning, allows manual override, and asks deepening questions before the final plan when the four lenses are thin.
- Non-comped coaches should be metered on AI chat from the shared pool (ten comped `coaching:all` coaches stay exempt); firm nudge, not a hard wall. Implementation deferred.
- Security: client reads go through presentation views; base tables are service-role/elevated only; revoke base reads only after the repoint is published + verified live.

## Open questions / things to lock in Session 170

- Coach subscription: allowance number, chat-only vs full activities, and price point (COACH-CHAT-METERING).
- Whether to also cap `ai-authoring-chat` input (super-admin surface, low risk).

## Bugs surfaced in Session 169 added to Build Queue

- BUG-CORP-METER-UNENFORCED [FIXED]: corporate AI usage was silently unlimited; `check-ai-usage` v67 enforces via `ai_counter_increment`.
- BUG-CHAT-HISTORY-UNCAPPED [FIXED]: `ai-chat` per-item history content was unbounded; v57 caps + validates; `coaching-activity-chat` v3 caps the message.
- BUG-XSS-URL-SCHEME [FIXED]: two `window.open(url_or_content)` sites now guarded by `isSafeHttpUrl`.
- BUG-REVOKE-BEFORE-PUBLISH [FIXED + lesson]: revoking base reads before the repoint was published broke live assessment/coaching; recovered; sequencing rule recorded.

## What's NOT in scope for Session 170

- Coach subscription pricing/checkout build (design decision still open).
- The evolving coach-facing report (deferred to the Summary group).
- Typical/Advanced coaching tiers (no such activities exist yet).

## Architecture additions in Session 169

New widgets (`ikigai`, `ptp_display`, `assessment_upload`); new functions `coaching-ikigai-map` v2 and `coaching-assessment-analyze` v1; updated `coaching-activity-analyze` v12, `coaching-activity-chat` v3, `ai-chat` v57, `check-ai-usage` v67; `coaching_activity_access` `requires_ptp` gate; `coaching_assessment_uploads` table + RLS; presentation views (`items_presentation`, `airsa_skills_public`, `coaching_activities_public`, `dimensions_public`, `response_scales_public`) with base-table read revokes; full lockdown of `trigger_logic` + `ptp_facet_types`; `bw_can_read_ptp_result()` helper gating `ptp_report_highlights` INSERT; paired/team read helpers moved to `narrative_status='complete'`; `isSafeHttpUrl` URL-scheme guards. All recorded in `architecture-reference-APPEND-session169.md`.

## Test fixture state at end of Session 169

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin, has PTP, corporate chat allowance)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, no PTP)

Plus an individual-with-PTP fixture (convert2) and a no-ticket fixture (client2). OPS-1: the documented password does not authenticate the PTP fixtures; a working password was set on two fixtures this session for live metering checks and is kept OUT of this public repo (see userMemories). Verify backend via simulated JWT claims + rolled-back transactions.

## Documents this session leaves behind

- BrainWise_Build_Queue_v80.docx (uploaded to project knowledge)
- BrainWise_System_Architecture_Reference_v76.docx (uploaded to project knowledge)
- BrainWise_Session_169_to_170_Handoff.docx (this document, uploaded to project knowledge)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs: `build-queue-APPEND-session169.md`, `architecture-reference-APPEND-session169.md`, `session-169-to-170.md`.
