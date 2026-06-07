# BrainWise Session 118 to 119 Handoff

*Closeout: Session 118. Open: Session 119.*

## Where Session 118 left off

Operations Doc-1 Phase 8 (customer depth + Zoho migration) is COMPLETE. Backend shipped and verified: the customer_account_summary view, contact-persons CRUD, the ops_customer_statement ledger RPC, and the generic ops_import_customers / ops_import_items RPCs. Frontend shipped and verified against the repo: the 9-tab customer-detail rebuild with account-summary chips and a time rollup, the ContactFormDialog, and the statement PDF + Statement tab. The first real customer was migrated out of Zoho via a scripted, idempotent purge+ingest (customer + sole contact + 8 invoices + 29 lines + 8 payments + 8 allocations, then 6 projects + 26 tasks + 45 time entries), after purging all org-scoped test transactional data. The generic import-wizard UI (Prompt 3) was not shipped and is superseded for the present need. Phase 9 (QA / polish / deploy) is next.

## Session 119 opening priorities, in order

### 1. Phase 9 — QA / polish / deploy (the next Operations phase)

This is its own full session. Walk the operations surfaces end to end now that a real customer is in the system: customer detail (all 9 tabs), invoice/estimate/credit-note/retainer detail, the statement and PDF outputs, reports, and settings. Capture defects as queue items. No new feature scope unless a gap blocks go-live.

### 2. Decide the timesheet-gap option for the migrated customer (cosmetic)

The supplied timesheet export was partial: 97.00h ingested vs ~126.33h in Zoho's project summaries. 3 of 6 projects reconcile exactly; the other 3 are short (~20.33h, 3.00h, 6.00h). Billing is unaffected because it is captured in the imported invoices. Options: (A) leave it — current default; (B) re-run the time ingest from a complete timesheet export (the projects/tasks/time ingest is guarded on a source id in custom_fields, so clear the imported time first, then reload); (C) synthesize one summary time entry per missing task from the project-summary hours (fabricates entry-level dates, only with Cole's ok).

### 3. Carryforward items (unchanged, pick up as capacity allows)

P1 live refund test plus subscribing the operations Stripe endpoint to charge.refunded on the dashboard; PTP verification tail (2 Deidentified reports plus invalidating 1 org's stale caches); BQ-PTP-ANCHOR-REWRITE decision; BQ-NARRATIVE-FANOUT-STATUS; BQ-FANOUT-COLDFAIL; BQ-PDF-EXPORT-COLDCACHE; BUG-NWS-1 (Group H closure gate); Mux soak/reclaim plus the storage-as-video-source removal decision.

## Decisions locked in Session 118 (recap)

- The first real customer is migrated by a scripted one-time ingest, not the generic import wizard. The wizard UI (Prompt 3) is shelved; the import RPCs stay live for future general use.
- All org-scoped test transactional data was purged before the real ingest (Cole approved). Config (numbering, tax, currencies, templates, org, users) was left intact.
- Zoho payment-mode mapping: Bank Transfer to ach, Cash to cash, Bank Remittance to wire. Historical payments are all bank/cash, none Stripe, so they raise no Stripe-source-of-truth conflict.
- Imported invoices keep their original Zoho numbers as free-text; the operations numbering sequence is untouched, so future system invoices continue as INV-2026-NNNN with no collision.
- Imported invoices are standalone free_form documents and are not linked to the imported time entries or the items catalog.
- The timesheet gap is left as option A for now.

## Open questions / things to lock in Session 119

- Timesheet gap: confirm option A, or request a complete export (B), or approve synthesized summary entries (C).
- Phase 9 scope: how much polish is required before a soft go-live with the real customer.

## Bugs surfaced in Session 118 added to Build Queue

- None. (One verification query fanned out across two child joins and over-counted; that was a query error, corrected with scalar subqueries, not a data or schema bug.)

## What's NOT in scope for Session 119

- New Operations features beyond Phase 9 QA/polish.
- Re-running the generic import wizard unless a general multi-customer import tool is wanted.
- Linking imported invoices to imported projects/tasks/time, or backfilling invoice.project_id, unless requested.

## Architecture additions in Session 118

Recorded in architecture-reference.md v120. Summary: operations.customer_account_summary view; contact-persons CRUD RPCs (ops_list_contacts / ops_add_contact / ops_update_contact / ops_delete_contact); ops_customer_statement jsonb ledger RPC; generic ops_import_customers / ops_import_items RPCs; and a new reusable pattern note for scripted one-time data ingest (idempotency guard on a source id in custom_fields, VALUES-join wiring, source ids parked in custom_fields/notes, source document numbers kept as free-text, dry-run in a rolled-back block then commit then re-verify).

## Test fixture state at end of Session 118

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Operations schema note: all prior operations TEST transactional data (3 test customers and their invoices/lines/payment/estimate/projects/tasks/time/expenses/tokens/stripe_customers) was PURGED this session. The operations schema now holds one real customer's live data plus untouched config. There is no operations test customer remaining; recreate one if a test fixture is needed for Phase 9 QA.

## Documents this session leaves behind (markdown only, Session-74 decision; no .docx)

- build-queue.md (now v126)
- architecture-reference.md (now v120)
- session-118-to-119.md (this document)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs (upload manually via the GitHub web UI).
