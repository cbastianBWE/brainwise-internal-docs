# BrainWise Session 109 to 110 Handoff

*Closeout: Session 109. Open: Session 110.*

## Where Session 109 left off

Session 109 took the operations platform (Zoho replacement, Doc 1 invoicing) from backend-only to a working frontend, and completed the entire Phase 1 money path. Two pre-frontend gates passed at the top of the session (operations schema exposed; $1 live-Stripe end-to-end test), then the build moved into Lovable slices backed by verified Supabase work. The platform side (`stripe-webhook` v31, `create-checkout`, billing) was never touched — only the operations-dedicated functions.

The full target is **A2: all 14 Doc 1 v1 modules** (not the lean A1), a ~5.5 to 8 month build per the doc, sequenced backend-first in phases.

## Locked product model (do not re-litigate)

The flow is customer to invoice through nested, in-context creation:

- A **customer** has many named **projects**. Each project has a `billing_method`: `fixed` (flat `fixed_cost_amount`), `project_hours` (one `project_hourly_rate`), `task_hours` (rate lives on each task), `staff_hours` (rate lives on each project member, `project_users.billing_rate`).
- A project has **tasks** (`project_tasks`), the rate-bearing unit for task-hours billing (`task_hourly_rate`). **Tasks are not items.** `items` is a separate fixed-price catalog for invoice and estimate lines. There is no FK between them, and time is logged against a task, never an item.
- **Time** is logged against a project (and optionally a task), rolls up to the project and customer, and is invoiced on any cadence.
- **UX principle:** creation happens in context via modals, surfaced from whatever entry points are intuitive. Multiple entry points are fine and encouraged; the bar is that every path is obvious and lands in the same connected place. The customer detail page is the hub; the project detail page is a sub-hub. Avoid orphan destination pages that have to be manually wired together.

## A2 phased roadmap (standing plan)

Done: foundation + Customers (basic CRUD), Items (CRUD), Invoices (create/edit free-form + item lines + Stripe Pay Now), Projects to Tasks spine, and all of Phase 1 below.

- **Phase 1 (COMPLETE this session)** — the money path. Manual/offline payment recording (all modes incl. ach, partial support), invoice lifecycle (mark sent, void, write off, clone, delete draft), `charge.refunded` reflection, invoice-send and payment-receipt emails, overdue cron.
- **Phase 2 (NEXT)** — time and expenses into billing. Time logging against tasks (modal, list, weekly grid, live timer, calendar), expenses (+ mileage + recurring), project members for staff-hours + cost rates, project dashboard (actual vs budget, unbilled, revenue, cost, margin), and the `ops_create_invoice_from_project` RPC that turns unbilled time + expenses for a date range into invoice lines.
- **Phase 3** — estimates (RPC-backed like invoices) + accept/decline by email link + convert to invoice/project/retainer.
- **Phase 4** — recurring invoices, retainers, credit notes (+ overpayment to credit, deferred from Phase 1).
- **Phase 5** — reports (~11 more SQL views + UI + CSV/PDF export).
- **Phase 6** — PDF engine (3 templates) + branding. A minimal invoice PDF may pull forward so sent invoices carry one.
- **Phase 7** — settings/automation (email templates, reminders, late fees, numbering, custom fields, salesperson/commission) + activity log/comments.
- **Phase 8** — customer depth (contacts, tabs, statements, credit balance, CSV import) + Zoho migration tooling.
- **Phase 9** — QA, polish, deploy.

## What is DONE and verified this session

**Backend (all via Supabase MCP, verified or deployed):**
- `ops_record_payment(p_invoice, p_payment jsonb)` — records an offline payment, allocates it, updates `amount_paid`/status, supports partial payments, guards void/written-off and over-balance. Verified (partial ach + remainder check to paid; allocations correct). Overpayment-to-credit deferred to Phase 4.
- `ops_set_invoice_status(p_id, p_action)` — `mark_sent` / `void` / `write_off` with guards (void only when `amount_paid=0` and not terminal/paid; write off only non-draft, non-paid, terminal-eligible with balance). Org resolved via `current_org_id()`.
- `ops_clone_invoice(p_id)` returns new draft id — copies header + lines, fresh number. Verified (cloned a real draft, totals + line copied, draft, paid zeroed).
- `ops_delete_draft_invoice(p_id)` — draft-only guarded delete. Verified.
- `ops_handle_stripe_refund(p_event_id, p_event_type, p_payload, p_payment_intent, p_amount_refunded)` — idempotent (stripe_webhook_events), finds the payment by `stripe_payment_intent_id`, reduces invoice `amount_paid` by the refund delta, reopens status (paid/partially_paid/sent), clears `paid_at` when reopened, records `refunded_amount`. Granted to `service_role`. Verified end to end (full refund reopened invoice to sent, refunded_amount recorded).
- `payments.payment_mode` CHECK extended with `ach` (now `stripe_card | stripe_ach | ach | check | cash | wire | other`).
- `org_id`/`created_by` defaults added to `projects`, `project_tasks`, `time_entries` (time_entries also `user_id` default `auth.uid()`); each direct-CRUD table's Insert-type `org_id` made optional in `operations-types.ts` as it gets a default.

**Edge functions:**
- `ops-stripe-webhook` v2 to v3 — added a `charge.refunded` branch ahead of the source guard (refunds identified by payment-intent lookup, not session metadata, since the charge object lacks the session metadata). The existing `checkout.session.completed` handler and `metadata.source==='operations'` guard are unchanged. `verify_jwt` stays false (Stripe signature auth).
- `ops-payment-receipt` v1 — new Resend function emailing a payment receipt summary (total / paid to date / balance) for an invoice. `verify_jwt` true.
- `ops-invoice-send` — already existed (v1), confirmed complete: emails a branded View-and-Pay message and marks the invoice sent.

**Cron:** `ops_overdue_flag_daily` (00:30 daily, `ops_flag_overdue_invoices()`) already scheduled and active. `ops_recurring_invoice_daily` and `ops_payment_reminder_daily` also already scheduled for later phases.

**Frontend slices built in Lovable (Cole ran prompts; type-check clean):** customer create/edit dialog, items module, invoice create/edit form (RPC-backed, item picker), projects + tasks spine (project create from customer hub, project detail with tasks). Three more invoice-detail prompts were delivered to run in order: Record payment dialog, lifecycle Actions dropdown, and the two send-email items (Send invoice / Send receipt).

## Numbering-drift fix (important)

Earlier in the session the invoice numbering scheme had been reset to 1 after each backend test, a habit that was safe only while no real invoices existed. Cole had since created a real `INV-2026-0001` ($150 draft) through the UI, so the scheme was out of sync and the next allocation would have collided. Fixed: `numbering_schemes` invoice `next_number=2`, `last_reset_at=now()` (so the yearly reset will not snap back to 1 until 2027). **Going forward: never reset numbering to 1. After any test that consumes a number, restore it to max+1.** All test invoices created this session were cleaned up and the number restored to 2.

## Cole-side action items

1. **Stripe dashboard:** subscribe the operations webhook endpoint (the one using `OPS_STRIPE_WEBHOOK_SECRET`) to the `charge.refunded` event, or the refund handler never fires. Once done, refunds issued from the Stripe dashboard will auto-reopen the invoice and record the refunded amount.
2. **Run the three invoice-detail UI prompts** in order: Record payment, then lifecycle Actions dropdown, then the two send-email items.
3. **GA sales-tax (carried from Session 108):** confirm with a CPA whether the offerings are taxable in Georgia; if so, register a Sales-and-Use account via the Georgia Tax Center and add it in Stripe → Tax → Registrations (the verified integration picks it up with no code change).

## Parked / known data

- The `$1` Stripe refund of the live test (Cole-side, optional).
- `TEST-LIVE-1USD-001` (paid $1 test invoice) and the real `INV-2026-0001` ($150 draft) both live in `operations.invoices`. The $150 draft is Cole's real data — keep or delete via the UI.
- Overpayment-to-credit on `ops_record_payment` is intentionally rejected for now; lands with credit notes in Phase 4.

## Session 110 opening priorities

Start **Phase 2** from the locked product model. First piece is time logging against a task (a Log-time modal on the project detail page writing `time_entries` with `project_id` + optional `project_task_id`; the table's defaults already auto-fill org/user/created_by and land entries approved-and-uninvoiced), then the rolled-up billable/unbilled totals on the project, then expenses, then the `ops_create_invoice_from_project` RPC. Backend-first as always; the time-tracking table defaults are already in place.

## Carryforward (unchanged, non-operations)

- BQ-NARRATIVE-FANOUT-STATUS, BQ-FANOUT-COLDFAIL, BQ-PDF-EXPORT-COLDCACHE.
- BUG-NWS-1 + Group H formal closure.
- NAI/AIRSA PDF rebuilds; narrative regen on score changes; interpretation row consolidation; pre-export readiness check; departure ZIP behavior.
- STATIC_ROUTES reminder: `newsletter-sitemap` hardcodes the marketing-route list; when a new public marketing page is added, update STATIC_ROUTES (~10-second edit). Surface on any newsletter/sitemap/SEO/new-marketing-page work.

## Close artifacts

Markdown only (Session-74 decision). Three files to upload manually to `cbastianBWE/brainwise-internal-docs` (flat root): `build-queue.md` (v117), `architecture-reference.md` (v111), `session-109-to-110.md`.
