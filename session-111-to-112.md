# BrainWise Session 111 to 112 Handoff

*Closeout: Session 111. Open: Session 112.*

## Where Session 111 left off

Cole confirmed Operations Phase 2 (time + expenses + charges into billing) is GREEN, then this session shipped three pieces of invoicing depth, all backend-verified and verified against the repo after Lovable ran: edit/delete for billable inputs, customer-level "invoice from work" (Way B), and invoice detail levels (Itemized / Summary by project) with project-name line labels. Phase 3 has not started; it is the Session 112 opener.

## Session 112 opening priorities, in order

### 1. Phase 3 — estimates + accept-by-link + convert + public customer pay page

This is the next roadmap phase. Scope:

- **Estimates**: estimate documents (the `estimates` table + numbering already exist from the Session 108 backend), an estimate create/edit surface, and status lifecycle.
- **Accept-by-link**: a public, tokenized route a customer can open without auth to accept an estimate.
- **Convert**: estimate → invoice conversion.
- **Option A public customer pay page** (carried gap from Session 110): `ops-invoice-send` emails a branded "view & pay" button pointing at `/operations/invoices/{id}`, which is `RoleGuard brainwise_super_admin` gated, so external customers cannot pay from the email today. The Stripe machinery (`ops_get_invoice_checkout_bundle`, checkout, webhook) is all built; only a public landing page is missing. Build a public `/pay/:token` route with a tokenized read + on-demand Stripe checkout, and repoint the email button. When `/pay` ships, add it to `newsletter-sitemap` `STATIC_ROUTES` (~10-second manual edit + redeploy).

Backend-first as always: build/verify the token model, RPCs, and any Edge Function changes via Supabase MCP before any Lovable spend.

### 2. Carried Cole-side items (not blocking Phase 3)

- Subscribe the operations Stripe endpoint to `charge.refunded` (operations.stripe_webhook_events still holds only the one checkout event; definitive test = issue the parked $1 refund and watch for a `charge.refunded` row + invoice reopening).
- GA sales-tax CPA confirmation + Sales-and-Use registration if taxable.

## Decisions locked in Session 111 (recap)

- Two invoice paths kept side by side: the existing manual InvoiceForm + per-project Generate, PLUS the new customer-level pick-and-assemble (Way B). One invoice may span multiple of a customer's projects.
- Way B selection granularity is line-level: pick tasks / projects / charges / expenses (not individual time entries). Staff-rate rows with no billing rate are shown but not selectable.
- Invoice line descriptions carry the project name prefixed, separator " - " (a hyphen, not an em dash). Task-rate "Project - Task", project-rate "Project - Time", staff-rate "Project - Person", charges/expenses "Project - <desc>". Hours stay in the Qty column (not duplicated in the description).
- Two detail levels chosen at generation time: Itemized (default; one line per task/charge/expense, project-prefixed) and Summary by project (one line per project = rolled-up total). No finer per-time-entry level. Selector on both invoice surfaces.
- Edit/delete of billable inputs is allowed only while uninvoiced; invoiced rows are read-only until void/delete releases them.
- P6 scope addition: when the invoice email sends, attach receipts for the expenses on that invoice (resolve via `document_lines.source_expense_ids` → `expenses.receipt_storage_path`) alongside the Phase 6 PDF.

## Open questions / things to lock in Session 112

- Estimate accept-by-link token model: token storage, expiry, and read RPC shape (mirror the Option A invoice-pay token design so both share a pattern).
- Whether the public pay page and the estimate accept page share one tokenized-public-route pattern (recommended) or are built separately.

## Bugs surfaced in Session 111 added to Build Queue

- None new. (One plan-review catch was corrected before ship: Lovable's edit/delete plan omitted the expenses query select extension, which would have dropped category/markup/mileage/receipt/notes on edit and broken receipt cleanup — caught and fixed pre-approval.)

## What's NOT in scope for Session 112

- P4 (recurring invoices + retainers + credit notes + overpayment-to-credit + recurring expenses).
- P5 reports, P6 PDF engine (the receipt-attachment-on-send note lives here), P7 settings/automation, P8 customer depth + Zoho migration, P9 QA/polish/deploy.
- P2 EXTRAS still open as later slices: weekly time grid, live timer UI, calendar view, project members for staff-hours, project actual-vs-budget/margin dashboard.

## Architecture additions in Session 111

All recorded in architecture-reference.md v113. Summary:

- **operations.invoiceable_candidates** — security_invoker VIEW, GRANT SELECT authenticated; one selectable row per charge / expense / rated task / project (project-rate) / person (staff-rate, null amount when no rate); 14 cols incl. candidate_type, project_id/project_name, ref_id, ref_user_id, quantity/unit/unit_price/amount, currency_code, candidate_key. Read via opsSupabase.
- **public.ops_create_invoice_from_selection(p_customer, p_selection jsonb, p_detail text DEFAULT 'itemized')** — SECDEF search_path '', GRANT authenticated; multi-project composer, server-recomputed amounts, single-currency guard, lone-project-or-NULL project_id, stale-item guard. Typed in public types.ts.
- **public._ops_emit_from_sel(p_org, p_invoice, p_detail, p_uid)** — SECDEF search_path '', shared line-emission helper for both composers; reads a pg_temp._sel component temp table; itemized = one line per component ("Project - Item"); summary = one line per project (penny-consistent with itemized); flips all source rows. EXECUTE revoked from PUBLIC, authenticated, and anon (internal only; the SECDEF composers call it as definer).
- **ops_create_invoice_from_project** and **ops_create_invoice_from_selection** both DROP+CREATE'd to add `p_detail text DEFAULT 'itemized'` (overload trap). public types.ts Args gained `p_detail?: string` on both.
- Frontend: InvoiceFromWork.tsx (new page + route + entry buttons), edit/delete actions and dialogs in OperationsProjectDetail / LogTimeDialog / LogExpenseDialog, detail-level selector on InvoiceFromWork + the per-project Generate dialog.
- Pattern: internal SECDEF helpers that trust caller-provided temp-table state must REVOKE EXECUTE from authenticated+anon, because schema default privileges auto-grant EXECUTE on new public functions.

## Test fixture state at end of Session 111

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Operations invoicing state: invoice next_number = 4 = max+1. Real invoices present (Cole's UI testing): TEST-LIVE-1USD-001 (paid), INV-2026-0001 (draft), INV-2026-0002 (sent), INV-2026-0003 (draft). All Claude functional tests this session ran inside rolled-back transactions and left zero fixture residue (verified: zero ZZ-prefixed customers/projects). Standing rule: never reset numbering to 1; restore to max+1 after any number-consuming test.

## Documents this session leaves behind

- BrainWise_Build_Queue_v119.md (markdown source-of-truth)
- BrainWise_System_Architecture_Reference_v113.md (markdown source-of-truth)
- BrainWise_Session_111_to_112_Handoff.md (this document)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs (flat repo root). Upload all three via the GitHub web UI.
