# BrainWise Session 47-to-49 Handoff (combined)

*Closeout: Sessions 47 + 48. Open: Session 49.*

*Note: This is a combined handoff covering both sessions because Session 47-to-48 was never written. Session 47 was backend-only (Group D Phases 1-3). Session 48 verified Session 47's backend, built Group D Phases 4-6 frontend, shipped email infrastructure end-to-end, and shipped auto-refund automation. The combined doc gives Session 49 (and any future Claude reading) the full context as a single narrative.*

## Where Sessions 47 + 48 left off

**Session 47** shipped Group D backend (Phases 1-3) end-to-end: `coach_clients` schema additions (`expires_at`, `revoked_at`, `invitation_source`, `client_first_name`, `client_last_name`), new `coach_pending_bulk_batches` table, new RPCs (`bulk_coach_invitation_create`, `coach_invitation_revoke`), new `bulk_coach_invite` Edge Function v2, `create-checkout` extended with `coach_bulk_order` mode, `stripe-webhook` v23 with `coach_bulk_order` branch.

**Session 48** shipped Group D Phases 4-5-6 frontend (`BulkInviteModal.tsx` 607 lines, `ShareableLinkModal.tsx` 287 lines, `PendingInvitations.tsx` 295 lines, `CoachClients.tsx` updated with DropdownMenu and 4-stat-card layout), email_logs infrastructure (table + send-email v8 + 90-day purge + Resend webhook integration via `resend-webhook` v1), `coach_invitation_resend` Edge Function v1 (24h rate limit, per-client scope), expiry sweep automation (`sweep_expired_invitations` v3 with pg_cron at 03:45 UTC), and refund automation (schema + helper + verified end-to-end with real $29.99 Stripe refund). Terms of Service updated to v2 with locked refund policy.

**Group C three-week sequencing plan locked:** cohort target three weeks from Session 48 close. Option A (full authoring UI) confirmed. Cole owns content authoring as parallel task starting Session 53. 10-session plan at ~3.3 sessions per week.

## Session 49 opening priorities, in order

### 1. Group A audit prequel — Session 49 entire focus

**This is the only thing Session 49 should ship.** Small, self-contained, unblocks Group C builds.

#### Schema additions to `super_admin_audit_log`

```sql
ALTER TABLE public.super_admin_audit_log
  ADD COLUMN ip_address inet,
  ADD COLUMN user_agent text,
  ADD COLUMN reason text,
  ADD COLUMN before_value jsonb,
  ADD COLUMN after_value jsonb,
  ADD COLUMN mode text,
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN ended_at timestamptz,
  ADD COLUMN end_reason text;
```

#### Schema additions to `company_admin_audit_log`

```sql
ALTER TABLE public.company_admin_audit_log
  ADD COLUMN reason text,
  ADD COLUMN before_value jsonb,
  ADD COLUMN after_value jsonb,
  ADD COLUMN super_admin_acting_as_user_id uuid REFERENCES public.users(id);
```

#### New helper RPC `log_super_admin_action`

Standardized argument signature: `actor uuid, target_user_id uuid, target_org_id uuid, action_type text, before jsonb, after jsonb, reason text, mode text`. Inserts into super_admin_audit_log with consistent format. Used by Group C revocation, direct enrollment, mentor assignment.

#### Verification

Post-migration `execute_sql` query against `information_schema.columns` to confirm all columns landed. Helper RPC tested via SQL impersonation as super_admin (writes a row, reads it back, verifies all fields populated correctly).

#### Why this first

Group C super-admin actions (revoke certification per Q9, direct-enroll user per Q4B, assign mentor per Q3) all need to write audit rows with proper before/after values. Without these columns, every Group C super-admin action gets retrofitted later, multiplying the eventual rework.

**Estimate:** 1 session, possibly half-session if clean. Don't try to ship anything else in Session 49.

## Session 49 NOT in scope

- Group C work of any kind — Sessions 50+
- Group A impersonation, Tier 1/2/3 user editing, audit reporting UI — Sessions 59+
- Action-Oriented Voice Redesign — deferred until after cohort
- Org Overview Dashboard + AIRSA Cross-Instrument — deferred
- Brand error color decision — build queue item
- Refund processing UI for individuals — depends on this Session 49 prequel landing first

## Decisions locked in Sessions 47 + 48 (recap)

### Refund policy

- Auto-refund eligibility gate: `coupon_redeemed = false AND assessment_id IS NULL AND payment_age <= 90 days AND payment_intent_id IS NOT NULL AND coupon_amount > 0`
- Both manual revoke AND automatic expiry trigger auto-refund through same `processAutoRefund` helper
- Individual purchases: 14-day refund window if assessment not started; manual processing only (no auto-refund Edge Function)
- Corporate contracts: all sales final per executed contract

### Group D scope completion

- Group D Phases 1-6 SHIPPED end-to-end including all polish items
- Token-based invitation upgrade (Path B) deferred to dedicated session
- Cohort/group label on batches (10J), per-row notes in bulk (10G), source visibility on My Clients table (7B), bulk results-screen retry actions all deferred

### Group C sequencing for upcoming cert cohort

- Cohort target: three weeks from Session 48 close
- Option A confirmed (full authoring UI), not Option C (SQL seed)
- Cole owns PTP content authoring as parallel task starting Session 53
- 10-session plan: Session 49 prequel + Sessions 50-58 Group C + Sessions 59-65 Group A remaining

### Email infrastructure

- All transactional email goes through `send-email` Edge Function (not direct Resend API) for email_logs capture
- Every send-email call should pass `email_type` and `source` parameters; backfill on existing callers is a build queue item
- Auth emails (Supabase Auth → Resend SMTP) bypass send-email by design; webhook captures them with `email_type='auth_or_external'`
- 90-day retention, super_admin SELECT-only RLS

### Operational conventions

- Resend webhook secret rotation: never paste secrets into chat. Add directly via Supabase Dashboard → Project Settings → Edge Functions → Secrets.
- Class C cron auth (`X-Dispatcher-Secret` header from vault) is the canonical pattern for all unattended Edge Functions; matches `dispatch-grace-reminders` convention.
- pg_cron jobs staggered by 15-30 minutes to avoid concurrent overnight cron load.

## Open questions / things to lock in Session 49

None blocking. Session 49 is purely the audit prequel. All Group C decisions are pre-locked from the scope doc; build sessions starting Session 50 will need to navigate Q7-locked-Option-A authoring UI implementation details, but those are build-time decisions, not pre-build decisions.

## Bugs surfaced in Sessions 47 + 48 added to Build Queue

None. Sessions 47 + 48 added build queue items but no bugs (everything shipped passed end-to-end verification).

## Architecture additions in Sessions 47 + 48

See architecture-reference.md v42, new sections 14-18:

- Section 14: Group D — Coach Bulk Invite + Shareable Link
- Section 15: Email infrastructure (Option A + Option B)
- Section 16: pg_cron jobs (current state)
- Section 17: Auto-refund automation
- Section 18: `coach_invitation_resend` Edge Function

## Test fixture state at end of Session 48

Test org: BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`).

Three corporate test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):
- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

**Coach test fixture:** testcoach@gmail.com (UUID `453829f2-1182-4ead-93de-3077a5daf1d0`), `ai_transformation_ptp_coach`, certified. Used for all Group D testing.

**Coach-client test fixtures created Session 48** (all under testcoach@gmail.com):
- testclientbwe+sharelink1@gmail.com — REVOKED (Test 12)
- testclientbwe+bulkpaid1@gmail.com — REVOKED (Test 13), refund issued in Stripe Dashboard manually
- testclientbwe+bulkpaid2@gmail.com — still active, has stripe_coupon_id `rz2FpPJZ`, payment_intent `pi_3TVAUu2FY7qIyIXA0bXsk3Hc` (already fully refunded)
- testclientbwe+bulkatest@gmail.com, testclientbwe+bulkbtest@gmail.com — active, self-pay, expires Jun 8 2026
- testclientbwe+refundtest@gmail.com — REVOKED + auto-refunded ($29.99 to refund_id `re_3TVBck2FY7qIyIXA0oApv0dD`). This was the end-to-end refund automation verification.

**Coach test row exclusions:** Several existing test rows tied to single payment_intent `pi_3TVAUu2FY7qIyIXA0bXsk3Hc` already fully refunded by Cole in Stripe Dashboard. Cannot use these for further auto-refund testing — Stripe will reject "charge already refunded" error.

## Documents this session leaves behind

- `cbastianBWE/brainwise-internal-docs/build-queue.md` (v40)
- `cbastianBWE/brainwise-internal-docs/architecture-reference.md` (v42)
- `cbastianBWE/brainwise-internal-docs/session-handoffs/session-47-to-49.md` (this document)

Markdown source-of-truth at https://github.com/cbastianBWE/brainwise-internal-docs.

Per closeout workflow standing rules: Cole drag-uploads these markdown files to the GitHub repo via web UI at session close. GitHub MCP is read-only; no automated push.
