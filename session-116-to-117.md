# BrainWise Session 116 to 117 Handoff

*Closeout: Session 116. Open: Session 117.*

## Where Session 116 left off

Two streams, both landed. (A) The **Mux video migration** for the learning platform is COMPLETE and verified end to end: schema columns + playback RPC + four Edge Functions (create-upload broker, signed-HMAC webhook, video-url minter v4, one-time ingest), all 19 real videos ingested as mux/ready, and both the trainee viewer and the authoring upload shipped and tested by Cole. (B) Two **Operations Doc-1 invoice bugs** from Cole's testing: the branding **logo upload RLS failure is FIXED** (root cause was a missing SELECT policy on the operations-branding bucket, not the client), and the **expense-receipt-on-invoice-email** feature has its backend shipped and verified (RPC + ops-invoice-send v9 opt-in flag) with the frontend opt-in-checkbox Lovable prompt approved and delivered but not yet run.

## Session 117 opening priorities, in order

### 1. Run + verify the expense-receipt opt-in checkbox (finish B2)

Backend is already live (ops_get_invoice_expense_receipts + ops-invoice-send v9, include_expense_receipts default off). The Lovable prompt edits `src/pages/operations/OperationsInvoiceDetail.tsx` only: a Send-invoice dialog with an opt-in "Attach N expense receipt(s)" checkbox shown when the invoice has receipts, plus the operations-documents PDF upload swapped from `opsSupabase.storage` to the main `supabase.storage` (the PDF upload had the same swallowed-error pattern as the logo). After Cole runs + commits, verify the file against the repo via GitHub MCP, then he tests on an invoice that has an expense receipt (confirm the checkbox appears, tick it, send, confirm both the invoice PDF and the receipt land in the email).

### 2. Operations Doc-1 Phase 7 — settings + automation + cross-cutting

Settings UI + merge tags, reminder schedules, late-fee rules, salesperson/commission, activity log + comments, custom-fields engine. Backend-first as always. The config tables (email_templates, reminder_schedules, late_fee_rules, currencies, custom_field_definitions) already exist from S108; Phase 7 is largely wiring + UI + the automation runners.

### 3. Operations Doc-1 Phase 8 — customer depth + migration

Full customer-detail tabs, contact persons, statements, credit balance, CSV import, and the Zoho-CSV import + reconciliation tooling.

## Decisions locked in Session 116 (recap)

- Mux: signed playback, 1080p, no captions in v1, single production environment (no test env / no secret swap), originals deleted after a ~1-week soak (deferred).
- Mux JWT signed with `npm:jsonwebtoken@9` (not Web Crypto) because it accepts Mux's PKCS1/PKCS8 PEM.
- Expense-receipt attachment is OPT-IN via a checkbox (option B), default off; backend flag defaults off so existing send behavior is unchanged.
- The logo fix root cause was a missing SELECT storage policy, not the opsSupabase client; the earlier client swap is harmless and left in place.

## Open questions / things to lock in Session 117

- Whether to remove Supabase Storage as a selectable video source in the authoring dropdown now that Mux is the path (non-blocking one-liner).
- Phase 7 sub-sequencing (which of settings/reminders/late-fees/commission/activity-log/custom-fields to take first).

## Bugs surfaced in Session 116 added to Build Queue

- None net-new. Two existing bugs were resolved (logo RLS; latent silent PDF non-attachment, fixed by the same client swap in the pending B2 prompt).

## What's NOT in scope for Session 117

- Mux originals reclaim (soak still running; rollback stays trivial until then).
- The carryforward PTP verification tail and the BQ-* narrative/PDF bugs unless Cole redirects.

## Architecture additions in Session 116

Recorded in architecture-reference v118:

- **§155 NEW** — an org-scoped storage bucket needs a SELECT policy (not just INSERT) for authenticated uploads to succeed, because the storage upload path reads the object back after writing; a missing SELECT surfaces as "new row violates row-level security policy" on upload. operations-branding was missing it; added `ops_branding_select`. Diagnostic lesson: a direct SQL INSERT passing RLS does not prove the upload will pass — compare sibling buckets' full policy sets before blaming the client.
- **Mux video pipeline** — content_items columns (mux_asset_id, mux_status, duration_seconds), `get_content_item_video_playback` RPC, the four Edge Functions, the jsonwebtoken-signing deviation, and the mux exemptions on both the upsert RPC and the content_items_video_required CHECK constraint.
- **Expense-receipt-on-invoice** — `ops_get_invoice_expense_receipts` RPC + the `include_expense_receipts` opt-in flag on ops-invoice-send v9, with server-side derivation of the attachments from the invoice itself.

## Test fixture state at end of Session 116

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

No new fixtures created this session. Mux: 19 real learning videos are live as mux/ready; 5 test video content_items were intentionally left on supabase_storage. Operations: a real test invoice with one billable expense + receipt exists and is the verification target for the B2 frontend test.

## Documents this session leaves behind

- build-queue.md (now carries the v124 entry)
- architecture-reference.md (now carries the v118 entry, §155)
- session-116-to-117.md (this document)

All three are markdown source-of-truth at cbastianBWE/brainwise-internal-docs (no .docx, per the Session-74 decision). Drag-upload these to the repo via the GitHub web UI.
