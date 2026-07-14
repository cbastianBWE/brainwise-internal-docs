# BrainWise — Session 175 opener

*Closeout: Session 174 (parallel bug/feature track). Open: Session 175.*

Session 174 was an off-wave "punch list" session, run **concurrently with Session 173** (the My Coaching Typical wave — see `session-173-to-174.md` for that track). Numbering was bumped +1 to avoid file collision. This handoff covers the punch-list track only.

## SESSION OPEN — read canonical docs from `cbastianBWE/brainwise-internal-docs` (root) via GitHub MCP `get_file_contents` before proposing:

* `build-queue.md` + `build-queue-APPEND-session173.md` (coaching wave) + `build-queue-APPEND-session174.md` (this track)
* `architecture-reference.md` + `architecture-reference-APPEND-session173.md` + `architecture-reference-APPEND-session174.md`
* `session-173-to-174.md` (coaching wave opener) + `session-174-to-175.md` (this file)

Note: canonical docs are at repo **root**, not `docs/`. Version markers after these two parallel closeouts: **Build Queue v85, Architecture v81** (this track set them; reconcile with the concurrent 173 closeout, which set v84/v80 — take the higher).

## Confirm live state in Supabase before proposing (Supabase is source of truth over docs):

* Edge-function versions this track shipped: `create-checkout` **v76**, `stripe-webhook` **v46**, `ai-chat` **v59**, `upload-chat-doc` **v1**. (Coaching wave may have moved `ai-chat` further — check.)
* New tables exist and are RLS-enabled: `coach_bulk_links`, `organization_coaches`, `report_commitments`, `chat_session_documents`.
* New columns: `team_profiles.released_to_subjects` / `paired_profiles.released_to_subjects` (default now FALSE), `development_plan_items.source_report_id`, `coach_clients.bulk_link_id`.

## PRIORITIES, IN ORDER (this track's residuals):

1. **Apply + live-verify the remaining Lovable prompts.** Backend is fully live; these frontends were delivered as prompts this session and need applying + a real click-through: bulk seat link (Phase 3), AI-chat document upload, coach-about-client "Ask AI", and the cert LinkedIn badge/share + `/verify/cert/:certId` page. (Already applied + confirmed by Cole: PDF pass, coach-questions leak, org-coach frontend, debrief-hold frontend, report-commitments frontend.)
2. **End-to-end verify the two paid/webhook flows on a real session** (super-admin can exercise the function but is meter/flow-limited): a real bulk-link purchase → webhook `active` → a signup claim decrements a seat; and confirm `?checkout=bulk_success` surfaces the Active Seat Links list.
3. **Org-wide coach smoke test in the UI:** assign a coach to an org (super-admin CompanyDetail → Coaches), then as that coach open Organization Members → a member's Results/Plan/Coaching/Ask-AI. Confirm a non-assigned coach sees nothing.

## DEFERRED (decisions already made — build when unblocked):

* **Coach AI chat allowance.** `check-ai-usage` (v67) has NO `coach` branch — coach chat (incl. coach-about-client) runs on onboarding-granted one-time credits. Add a dedicated coach allowance **when coach subscription plans are finalized** (Cole). This is the SAME root gap as the Session-172 `coaching_activity_access` coach-branch note — worth fixing both together.
* **LinkedIn true auto-post (phase 2).** Needs a LinkedIn developer app (client id/secret from Cole), per-coach OAuth (`w_member_social`), token storage, and a post edge function hooked to cert grant. Blocked on Cole creating the app + LinkedIn scope approval. The badge + one-click share shipped this session.

## DECISIONS LOCKED (Session 174):

* Bulk seat link v1: prepay all seats up front, no automatic refund, one instrument per link.
* Org-wide coach delivered via **additive RLS**, not `coach_clients` fan-out (avoids granting entitlements / flooding the client list). Super-admin assigns coaches to orgs (org admins cannot).
* Team/paired reports: **hold-for-debrief is the DEFAULT** for newly generated reports; existing reports were backfilled visible. Release control for generator + org coach + org/company admin + super-admin.
* Development Plan page is the home for commitments — **My Development / Team / Paired** tabs; reports carry only an "Add to development plan" button. **Team commitments are shared** to all report participants; individual commitments land in the adder's own plan.
* Coach-about-client AI chat authorizes via `ptp_show_coach_content` and uses a coach-facing prompt; metering stays on the coach's existing pool.
* Item 12 (org members seeing team/paired reports they're in) confirmed **already working** — closed without change.

## STANDING GATES / GUARDRAILS (unchanged, reaffirmed):

* SECURITY SEQUENCING: never revoke a base table's `authenticated` read until the repointed frontend is PUBLISHED live AND verified. This session made only additive access changes — nothing to revoke.
* BACKEND-FIRST + VERIFY: every backend change went in before any Lovable prompt and was impersonation-verified in rolled-back transactions. Continue this for the residual prompts' backends (all already live here).
* Credit conservation: read the exact live frontend at a GitHub SHA before writing a Lovable prompt; verify shipped files after.
* METERING: super-admin meter-exempt; corporate → `ai_usage_counters`; individual → `ai_usage` / `one_time_chat_credits`; coach → one-time credits (no dedicated branch yet).

## Architecture additions in Session 174

New tables (`coach_bulk_links`, `organization_coaches`, `report_commitments`, `chat_session_documents`), new columns (`released_to_subjects`, `source_report_id`, `coach_clients.bulk_link_id`), the org-coach helper + additive gate/RLS layer, report-release + commitment RPCs, `get_public_certification`, and edge functions `create-checkout` v76 / `stripe-webhook` v46 / `ai-chat` v59 / `upload-chat-doc` v1. Full detail in `architecture-reference-APPEND-session174.md`.

## Test fixture state at end of Session 174

Test org: BrainWise Test Corp. Look up current test-user UUIDs via Supabase MCP (`SELECT id, email FROM users WHERE email LIKE 'testclientbwe+%@gmail.com'`); password is in `userMemories`. This session used existing certified/coach/subject fixtures for verification only (all reads rolled back); no fixtures were mutated or left dirty.

## What's NOT in scope for Session 175 (this track)

* The My Coaching Typical wave (Hedgehog 0215, remaining group builds) — that's the concurrent track; see `session-173-to-174.md`.
* True LinkedIn auto-post and the coach chat allowance — deferred (above), both blocked on external decisions.

## At session close: markdown only (no docx). Write `build-queue-APPEND-session175.md`, `architecture-reference-APPEND-session175.md`, `session-175-to-176.md`; bump version markers to **v86 / v82** (reconcile with whatever the coaching track set); sanitize (no UUIDs, production emails, secrets, passwords, Stripe IDs, publishable/anon keys); hand the md bundle to drag-upload to GitHub.
