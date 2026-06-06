# Session 115 → 116 Handoff

**Session 115 theme:** Operations Platform (Zoho replacement, Doc 1) — finished P3 estimate conversions, shipped the P1 in-app refund path, built P5 Reports, and built the P6 PDF engine + branding. All backend verified via Supabase MCP; all frontend run by Cole through Lovable and verified against the live repo via the GitHub MCP API.

Canonical docs bumped this session: **build-queue v123**, **architecture-reference v117** (new rule **§154**). Markdown only (Session-74 rule — no docx).

---

## What shipped (all verified)

### P3 — estimate conversions COMPLETE
- Migrations: `session115_p3_estimates_add_converted_retainer_id`, `session115_p3_ops_convert_estimate_to_retainer`, `session115_p3_ops_convert_estimate_to_project`, `session115_p3_invoice_convert_mutual_exclusion_guard`.
- `ops_convert_estimate_to_retainer(p_estimate)` → draft RET- retainer, amount = estimate total, no lines.
- `ops_convert_estimate_to_project(p_estimate, p_name DEFAULT NULL, p_billing_method DEFAULT 'none')` → project budget = total; billing_method validated in (none, project_hours, task_hours, staff_hours). Under `none`, one billable `project_charges` row per estimate line (fallback single charge if no lines). Hourly methods create 0 charges (no double-bill).
- `ops_convert_estimate_to_invoice` patched (body-only CREATE OR REPLACE, no overload) to guard all three `converted_*_id` for mutual exclusion.
- Frontend: `OperationsEstimateDetail.tsx` Convert dropdown (To invoice / project / retainer), project dialog (name + billing_method), "View {target}" after conversion.

### P1 — in-app refund (Option B: initiate in-app)
- Migrations: `session115_p1_ops_get_refundable_payment`, `session115_p1_ops_list_invoice_payments`.
- Edge fn `ops-issue-refund` **v1** (verify_jwt true) — authorizes via `ops_get_refundable_payment`, validates `pi_` prefix + stripe mode + 0 < amt ≤ refundable, calls `stripe.refunds.create`. **Initiates only; writes NO ledger.**
- Ledger stays owned by `ops-stripe-webhook` v3 `charge.refunded` → `ops_handle_stripe_refund` (sole, idempotent, delta-based).
- Frontend: `OperationsInvoiceDetail.tsx` Payments card (`ops_list_invoice_payments`) + Refund button when `is_stripe && refundable > 0`.

### P5 — Reports
- Migration `session115_p5_report_fact_views`: 5 security_invoker views (report_invoices, report_invoice_lines, report_payments, report_time, report_expenses). GRANT SELECT authenticated + service_role only (no anon).
- Reuse `project_financials_rollup` + `customer_balance_summary`.
- Frontend: NEW `OperationsReports.tsx` (super-admin route + sidebar) — 4 detail + 6 grouped reports (incl. commission by salesperson), date filter, column toggle, CSV, jsPDF landscape PDF.

### P6 — PDF engine + branding
- Migrations: `session115_p6_org_branding_fields_and_seed`, `session115_p6_storage_buckets`, `session115_p6_ops_update_org_branding`.
- `operations.organizations` += legal_name, address jsonb, email, phone, tax_id, website, logo_url, brand_color (DEFAULT Navy), accent_color (DEFAULT Orange). Seeded for BrainWise (logo_url + tax_id still null — set via the Settings page).
- Buckets: `operations-branding` (public-read, logo) + `operations-documents` (private, generated PDFs); 4 org-path-scoped policies each, mirroring `operations-receipts`.
- `ops_update_org_branding(p_patch jsonb)` — SECDEF, admin-only, COALESCE partial patch.
- Edge fn `ops-invoice-send` **v3** (verify_jwt true) — optional `attachment_path`, validates it begins with the invoice's `org_id/` segment, downloads from operations-documents via service role, attaches base64 via Resend, returns `{success, attached}`; falls back to no-attachment if missing.
- Frontend: NEW `src/lib/operations/documentPdf.ts` (one engine, 3 templates: standard / corporate / detailed) + Download-PDF dropdowns on invoice (3 templates + Receipt when paid) and estimate detail; invoice "Send" flow now generate → upload → invoke-with-attachment_path; NEW `OperationsSettings.tsx` (logo upload + branding form) + route + sidebar entry.

**New rule §154 (architecture-reference):** branded-document generation is client-side jsPDF; email attachment is client-generate → upload-to-private-bucket → server-download-and-attach. One generator, never a second server-side layout engine.

---

## S116 opener (do first)

**REVOKE EXECUTE … FROM PUBLIC** (per §140 — from PUBLIC, not from anon) on the 5 new authenticated-only public RPCs, then verify `has_function_privilege('anon', oid, 'EXECUTE')` = false and authenticated = true:
1. `ops_convert_estimate_to_retainer`
2. `ops_convert_estimate_to_project`
3. `ops_get_refundable_payment`
4. `ops_list_invoice_payments`
5. `ops_update_org_branding`

Each self-gates on `current_org_id()` / role in the interim (anon raises before any data access), so this is defense-in-depth, not an open hole. The 5 P5 report views are authenticated + service_role only and need no revoke.

---

## Deferred / outstanding

- **P1 live refund test** — fire a real refund against the existing $1 Stripe-paid invoice (Cole's ops `charge.refunded` subscription is live) and confirm the webhook reopens the invoice ledger. Also: first live `ops-invoice-send` email with a PDF attached.
- **PTP verification tail (carried from S114):** the 5 "both" reports are backfilled; STILL confirm the 2 Deidentified reports regenerated to full sections BEFORE invalidating the 1 affected org's stale caches (5 `org_dashboard_narratives` INST-001 + 3 `org_ptp_delta_narratives`). BQ-PTP-ANCHOR-REWRITE decision still pending.
- **Operations roadmap:** P7 (settings/automation + activity log/comments) is next; then P8 (customer depth + Zoho CSV migration), P9 (QA/polish/deploy). Statement-of-account PDF is customer-level — slot it with the P8 statement generator rather than the per-document generator.

---

## Standing reminders

- Backend-first: every `apply_migration` followed by `execute_sql` verification; functional tests as one rolled-back DO block (zero document numbers consumed).
- **Verify ships via the GitHub MCP API (`get_file_contents`), not raw.githubusercontent.com** — the raw CDN can serve stale byte-identical content even with a cache-bust param (cost a false "ship failed" this session).
- Edge functions are deployed via Supabase MCP and are NOT in the repo; read them via `Supabase:get_edge_function`.
- `Supabase:get_logs` for edge-function is broken on this project — use `super_admin_audit_log` (and the ops equivalents) as the diagnostic.
- STATIC_ROUTES reminder still standing: a new public marketing page needs a manual edit to the newsletter sitemap Edge Function's hardcoded `STATIC_ROUTES`.
- Close artifacts are markdown only (Session-74). GitHub MCP is read-only; Cole uploads the three files manually.
