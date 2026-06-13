# BrainWise Session 131 to 132 Handoff

*Closeout: Sessions 131 + 132 (one continuous edge-function remediation arc). Open: Session 133.*

## Where this arc left off

A platform-wide edge-function bug was found and fully eradicated. **Symptom:** super-admin and org invite flows (set-org-admin, single invite, bulk invite) silently showed a "manual code" fallback instead of sending the invitation email. **Root cause:** a recent Supabase gateway change now rejects any edge-to-edge `fetch` to another `/functions/v1/` function that carries `apikey` and `Authorization` headers holding two *different* keys (anon in one, service-role in the other) as "Conflicting API keys", a 401 returned before the target function runs. The invite functions sent `apikey: anon` + `Authorization: Bearer SERVICE_ROLE`, so the gateway killed every call to `send-email`. The frontend was correct (it only shows the manual code when the function returns `email_sent: false`); this was never a Lovable fix.

**Fix (everywhere):** make both headers carry the same key (use anon for both). **15 functions fixed total**, 14 in Session 131, plus `stripe-webhook` in Session 132. A full sweep of all ~95 edge functions confirmed every other function is clean. The conflicting-key bug is gone.

The intended Session-131 work (the content-authoring restructure / content-item viewer, scope docs `scope-content-authoring-restructure.md` + `content-item-viewer-scope.md`) was displaced by the bug and never started. It remains open.

## Session 133 opening priorities, in order

### 1. Content-authoring restructure / content-item viewer (the deferred Session-131 intent)

Scope docs already in the repo: `scope-content-authoring-restructure.md`, `content-item-viewer-scope.md`. This was the planned 131 work before the invite bug took over. Backend-first recon as usual.

### 2. Cole's pick from the remaining active backlog

Still open from the v135 twelve-item list: **4** (in-system support chatbot + admin capture), **5** (white-label full track, multi-session, Cole approved "all of it"), **6** (SCORM export for the lesson block), **7** (lesson-block tracking API + HRIS ingest), **11** (subfolder organization for My Learning and Resources). 6+7 are one SCORM/LMS-API arc; 5 is its own large arc.

### 3. Dashboard cleanup (Cole, ~30 sec)

Delete the two inert diagnostic functions from the Supabase dashboard: `diag-internal-secret-check` and `diag-resend-harness`. Both are now 410 stubs; the MCP has no delete-function, so this is a manual click.

## Decisions locked in this arc (recap)

- The fix is to **match the two header keys** (anon in both `apikey` and `Authorization`), not to change `send-email` or the internal-secret auth. `send-email` authenticates callers via `x-internal-secret`, not the bearer, so lowering the bearer to anon has no auth effect.
- `stripe-webhook` was held in Session 131 pending Cole's explicit greenlight (standing rule: never touch the platform `stripe-webhook` by reflex). Greenlit and fixed in Session 132 as **v41**.
- The conflicting-key rule is now a standing architecture fact (see §158 below): any edge function that `fetch`es another edge function must send matched keys.

## Bugs surfaced in this arc added to Build Queue

- None new beyond the conflicting-key bug itself, which is now fully resolved. (Pre-existing carryforwards remain: `BUG-NWS-1` newsletter attachment-send hang; Doc-1 invoice live refund test.)

## What's NOT in scope for Session 133

- No further edge-function key auditing, the sweep is complete and exhaustive; do not re-run it.
- No Operations / CRM work unless Cole redirects.

## Architecture additions in this arc

(Full detail in architecture-reference.md v133.)

- **NEW standing rule §158, edge-to-edge fetch must use matched API keys.** The Supabase gateway rejects a `fetch` to another `/functions/v1/` function carrying `apikey` and `Authorization` with two *different* Supabase keys (anon vs service-role) as "Conflicting API keys" (401, before the target runs). Send the **same** key in both headers (anon in both is the canonical safe shape). Three patterns are immune and need no change: `supabase.functions.invoke()` (sends matched keys automatically), Resend-direct sends (no Supabase key pair), and fetches carrying only `x-internal-secret` (no `apikey`/`Authorization` pair). A user-JWT in `Authorization` paired with `apikey: anon` is also fine (a user JWT is not a Supabase API key, so there is no anon-vs-service conflict), this is the normal authenticated-request shape. service+service matched keys also pass.
- **15 functions fixed** (lowered the `send-email` / `send-departure-emails` fetch's `Authorization` from service-role to anon to match `apikey`): `invitation_send` v23, `bulk_invitation_send` v21, `assign_epn_send`, `airsa-supervisor-invite`, `invite-coach`, `coach_invitation_resend`, `airsa-supervisor-reminder`, `deactivate-and-notify`, `bulk-deactivate-and-notify`, `dispatch-grace-reminders`, `verify-conversion`, `generate-departure-export`, `admin_trigger_password_reset`, `bulk_coach_invite` (Session 131), and `stripe-webhook` v41 (Session 132). All boot-verified.
- **No schema, RLS, cron, or table changes.** Edge-function source only.
- `diag-internal-secret-check` and `diag-resend-harness` neutered to inert 410 stubs (Cole to delete from the dashboard).

## stripe-webhook fix detail (Session 132)

The conflicting idiom lived only in the `sendInvitationEmail` helper's fetch to `send-email`, which fires only on the `coach_order` / `coach_bulk_order` branches inside try/catch. It does not touch signature verification, DB writes, coupon recalculation, or subscription tiering. The `Authorization` was lowered to `SUPABASE_ANON_KEY` to match `apikey`; redeployed as **v41** (verify_jwt false). Boot-verified: a no-signature POST returns HTTP 400 "Missing signature or webhook secret" (compiles + boots). (Note: an interim deploy briefly pushed a placeholder stub as v40 for ~90s; Stripe auto-retries non-2xx so no events were lost, and v41 immediately restored the full corrected source.)

## Sweep result (Session 132)

Every email-sending function was found and is either fixed (the 15 above) or already safe: the ops sender/cron family (`ops-invoice-send`, `ops-send-reminder-now`, `ops-payment-receipt`, `ops-payment-reminder-cron`, `ops-day-of-digest-cron`, etc.) and `newsletter-dispatch` send Resend-direct; `send-departure-emails` / `crm-email-send` / `crm-email-inbound` are Resend-direct; `submit-contact-request` and `submit-briefing-request` call `send-email` with matched service+service keys (not the bug). Every edge-to-edge orchestration call elsewhere uses `functions.invoke`, x-internal-secret-only fetches, or the safe user-JWT+anon shape (`generate-report`, `ai-chat`, and the AI generator family calling `check-ai-usage`). Both Stripe webhooks, the storage/mux/asset functions, impersonation, check-*/log-audit, newsletter read-only, and the diagnostics carry no edge-to-edge `send-email` call at all.

## Test fixture state at end of this arc

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

A related side-task on the same day cleared 4 stale `tanya@symbiokinetics.com` corporate_invitations so the now-fixed invite flow could be re-tested. No other pending cleanup.

## Documents this arc leaves behind

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs (flat root):

- build-queue.md (v139)
- architecture-reference.md (v133)
- session-131-to-132.md (this document)

No .docx generated (Session-74 decision).
