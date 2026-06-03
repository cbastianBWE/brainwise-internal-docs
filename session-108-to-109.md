# BrainWise Session 108 to 109 Handoff

*Closeout: Session 108. Open: Session 109.*

## Where Session 108 left off

Session 108 built the operations platform (Zoho replacement, Doc 1 invoicing) backend end-to-end: Phases 0–3 complete and Phase 4 partial. Everything went through Supabase MCP, backend-first, every functional claim verified, zero Lovable spend. The platform side (`stripe-webhook` v29, `create-checkout` v60, `send-email`) was not touched.

What exists now in the `operations` schema: ~31 tables + 5 report views, the canonical RLS pattern on every table, the numbering engine, the full money layer (payments, allocations, credits, Stripe mapping, webhook-events), config tables, recurring-invoice templates, and the three cron logic functions. Plus four new Edge Functions and three scheduled crons.

Locked decisions (do not re-litigate): single `operations` schema; `operations.organizations` is the tenant root; `operations.users.id` = FK to `auth.users.id`; custom fields ops-local (Gap 4=B); Stripe isolation via a second webhook endpoint + `metadata.source=operations` tagging (Gap 5=A). Full detail in `architecture-reference.md` v110 and `build-queue.md` v116.

## What is DONE and verified

- **Data layer (M1–M19):** schema/enums/grants, tenant+users (Cole seeded as admin), RLS helpers, customers/contacts/items, projects+tasks+time, numbering engine (+ org-explicit allocator for cron), estimates/invoices/retainers/credit-notes/document-lines, expenses family, payments/allocations/credits/stripe-customers/webhook-events, config tables, 5 report views, mixed-tax-code columns, recurring templates, overdue/recurring/reminder logic, mark-sent.
- **Edge Functions:** `ops-stripe-webhook` (unsigned→400 verified), `ops-invoice-checkout` (no-JWT→401 verified), `ops-invoice-send` (401 verified), `ops-payment-reminder-cron` (401 verified).
- **Crons (active):** `ops_overdue_flag_daily`, `ops_recurring_invoice_daily` (pure-DB), `ops_payment_reminder_daily` (HTTP dispatch).
- **SQL-verified behavior:** payment RPC idempotent recording (100/300 → partially_paid, duplicate rejected); overdue flagging; recurring generation (invoice + lines + schedule advance); AR aging bucketing.

## Cole-side status (live Stripe account, not test)

- Stripe Tax: category + automatic behavior set; state nexus registrations being added.
- Second webhook endpoint registered in LIVE → `ops-stripe-webhook`; `OPS_STRIPE_WEBHOOK_SECRET` set in Supabase.
- Resend: nothing needed — `mail.brainwiseenterprises.com` is already verified, so ops sends from `invoices@`/`reminders@` on it.

## Session 109 opening priorities, in order

### 1. Two Cole-side gates before frontend
- **Expose the `operations` schema** in Supabase → Settings → API → Exposed schemas. Lovable/PostgREST cannot read the schema until this is done. This is the hard blocker for all frontend work.
- **$1 end-to-end live-Stripe test:** create a $1 invoice to yourself, pay it through `ops-invoice-checkout`, confirm the chain (checkout → `ops-stripe-webhook` → `operations.payments` row → invoice flips to paid), watch the webhook logs, then refund the $1. This is the only thing that proves the live Stripe path and the `OPS_STRIPE_WEBHOOK_SECRET`. Stripe Tax calc verifies in the same test once registrations are live.

### 2. Remaining operations BACKEND (not blocking frontend, can interleave)
- ~11 remaining report views (the other Doc 1 reports beyond the 5 built).
- Salesperson / commission.
- Zoho-CSV migration tooling (import existing customers/invoices).
- PTP-own-PDF generation engine (Doc 1 D5) — not started, estimated 6–9 days, its own sub-project.
- First real reminder/invoice email will verify the Resend-direct send path on first fire.

### 3. Frontend (Lovable) — the main Session 109+ work once the schema is exposed
- Build the operations UI against the verified backend: customers, projects/time, estimates, invoices (with the Pay Now button calling `ops-invoice-checkout`), recurring, payments, credit notes, reports, settings. Follow the Lovable Credit Conservation Protocol; backend is already SQL-verified so prompts can be additive against known shapes.

## Carryforward (unchanged, non-operations)
- BQ-NARRATIVE-FANOUT-STATUS, BQ-FANOUT-COLDFAIL, BQ-PDF-EXPORT-COLDCACHE.
- BUG-NWS-1 + Group H formal closure.
- NAI/AIRSA PDF rebuilds; narrative regen on score changes; interpretation row consolidation; pre-export readiness check; departure ZIP behavior.
- STATIC_ROUTES reminder: `newsletter-sitemap` hardcodes the marketing-route list; when a new public marketing page is added, update STATIC_ROUTES (~10-sec edit). Surface on any newsletter/sitemap/SEO/new-marketing-page work.

## Close artifacts
Markdown only (Session-74 decision). Three files to upload manually to `cbastianBWE/brainwise-internal-docs` (flat root): `build-queue.md` (v116), `architecture-reference.md` (v110), `session-108-to-109.md`.
