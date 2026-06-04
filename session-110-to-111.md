# Session 110 → 111 Handoff

**Project:** BrainWise Operations Platform (Zoho replacement, Doc 1 invoicing)
**Supabase:** `svprhtzawnbzmumxnhsq` · schema `operations`
**Org:** BrainWise Enterprises `7c8a8f99-19dc-4e15-9e3a-99226d0d0c52` · sole member Cole Bastian `1d14e510-d0d0-4687-9741-4ddfc0c37253` (admin, `cbastian@brainwiseenterprises.com`)
**Discipline:** backend-first via Supabase MCP; Cole runs all Lovable prompts + commits GitHub manually. GitHub MCP is READ-ONLY. Markdown-only closeout (Session-74 decision).

---

## What Session 110 did

**Phase 2 of the A2 roadmap is COMPLETE: time + expenses + charges into billing.** All backend built and verified via MCP; Cole built all four Lovable prompts (additive, type-check clean, batched to one untested test pass).

### Model revision (do not re-litigate)
Single-mode billing replaced by **composable billing**. `projects.billing_method` now names the HOURLY scheme only: `project_hours | task_hours | staff_hours | none`. Fixed fees became `project_charges` rows. Expenses are always independent. A project can carry a fixed fee + hourly tasks + expenses at once. Chose Option B (separate `project_charges` table). `projects_billing_method_check` now allows `none` (`fixed` kept valid defensively; 0 projects existed, no data migration).

### Backend shipped + verified (7 migrations)
1. `operations.project_time_rollup` view (security_invoker, project grain; hours buckets + customer_id/customer_name; GRANT SELECT authenticated). Step-2 rollup chosen as a view, Cole approved.
2. `expenses` + `expense_categories` gained `org_id` DEFAULT `operations.current_org_id()` + `created_by` DEFAULT `auth.uid()`.
3. Private bucket `operations-receipts` + 4 org-path-scoped RLS policies (`(storage.foldername(name))[1] = current_org_id()::text`); seeded 6 categories (Software, Travel, Meals & Entertainment, Office Supplies, Contractor, Other; idempotent).
4. `operations.project_charges` table + 4-policy RLS (delete admin-only) + GRANT authenticated.
5. `document_lines.source_charge_ids uuid[]` added; `public.ops_create_invoice_from_project(p_project, p_date_from, p_date_to)` RETURNS uuid (SECURITY DEFINER, search_path '', GRANT authenticated). Composes charges + time-by-method + marked-up expenses into a draft; flips consumed sources to invoiced; RAISES + rolls back (releasing the number) if nothing billable. Verified end-to-end (INV-2026-0002, total 755.00, 3 lines, correct exclusions + source links).
6. Patched `ops_delete_draft_invoice` + `ops_set_invoice_status` (void branch) to RELEASE sources before delete/void. `write_off` does NOT release; `mark_sent` unchanged. Verified both paths revert all three source types; voided invoice remains as a record.

**Billing logic locked in the RPC:**
- `task_hours` → one line per task that HAS a rate; untasked / rate-less time EXCLUDED, left uninvoiced.
- `project_hours` → one line at `project_hourly_rate` (excluded if null).
- `staff_hours` → one line per user at `coalesce(project_users.billing_rate, users.default_billing_rate)`; RAISE if any billable user lacks a rate.
- `fixed` / `none` → no time billed (fixed fees are charges).
- expenses → one line each at `amount × (1 + markup%/100)`.

### Lovable prompts (all four built, UNTESTED)
- **Step 1+2** time logging + rollups: `LogTimeDialog`, Time card on project detail (embed via `users!time_entries_user_id_fkey`), customer-time rollup card.
- **Step 3** expenses: `LogExpenseDialog` (mileage mode + receipt upload to `operations-receipts` at `${orgId}/${uuid}-${name}`), Expenses card.
- **Step 4** charges + composable + generate: `ProjectFormDialog` (billing_method union → `project_hours|task_hours|staff_hours|none`, default `none`, Fixed-cost field removed, legacy `fixed` coerced to `none`), `AddChargeDialog`, Charges card + Generate-invoice date-range dialog calling `supabase.rpc('ops_create_invoice_from_project')` then navigating to the draft.
- `operations-types.ts` edits: `org_id` optional on `expenses.Insert` + `expense_categories.Insert`; `project_charges` table type; `document_lines.source_charge_ids`; `project_time_rollup` view type; public `ops_create_invoice_from_project` Functions entry.

### Numbering
`next_number` restored to **2** (real invoices present: `TEST-LIVE-1USD-001` paid + `INV-2026-0001` $150 draft). Never reset to 1. After any number-consuming test, restore to max+1.

---

## Open item discovered: customer-pay gap (fix slotted to Phase 3)
`ops-invoice-send` emails a branded "View & Pay Invoice" button linking to `/operations/invoices/{id}` — but that route is `RoleGuard brainwise_super_admin` gated, so **external customers cannot pay from the email today**. The Stripe machinery (`ops_get_invoice_checkout_bundle`, create-checkout, webhook) is fully built; only a public landing page is missing.
**Decision: Option A** — public `/pay/:token` page + tokenized read + on-demand Stripe checkout, repoint the email button. **Slotted into Phase 3, not pulled forward.** (Option B, a direct Stripe-hosted URL in the email, was rejected.) When it ships, add the route to `STATIC_ROUTES` in newsletter-sitemap.

---

## What Session 111 opens on
1. **Cole runs the one-pass Phase 2 test** (below). On green, Phase 2 is closed.
2. **Phase 3:** estimates + accept-by-link + convert + (NEW) Option A public customer pay page.

### Cole's Phase 2 test pass
Create a project (form shows "No hourly billing", no Fixed-cost field) → add a rated task → log time → add an expense (try mileage mode + a billable one with markup + a receipt upload) → add a charge → **Generate invoice** (lands on a draft with one line per piece; sources flip to Invoiced) → **delete or void the draft** (sources revert to Unbilled). Expect real invoice numbers to advance (INV-2026-0002+); that is normal.

---

## Cole-side pending (carried + new)
- **[CARRIED, still open] `charge.refunded` subscription.** `operations.stripe_webhook_events` still has only the one `checkout.session.completed` event. Subscribe the ops Stripe endpoint to `charge.refunded` or the handler never fires. Definitive test: issue the parked $1 refund and watch for a `charge.refunded` row + the invoice reopening.
- **[NEW] Phase 2 test pass** (above).
- **[CARRIED] GA sales-tax** CPA confirmation + Sales-and-Use registration if taxable (Stripe Tax computes $0 until registered).
- **STATIC_ROUTES reminder:** newsletter-sitemap's `STATIC_ROUTES` list is hardcoded; adding any new public marketing page (or the Phase 3 public `/pay` page) needs the ~10-second manual edit. Article URLs remain automatic via `list_public_published_articles()`.

---

## A2 phased roadmap (updated)
- **P1 money path — DONE (Session 109).**
- **P2 time + expenses + charges into billing — DONE (Session 110).**
- P2 EXTRAS (separate later slices, NOT done): weekly time grid, live timer UI, calendar view, project members for staff-hours, project actual-vs-budget / margin dashboard.
- **P3:** estimates + accept-by-link + convert + (NEW) Option A public customer pay page.
- **P4:** recurring invoices + retainers + credit notes + overpayment-to-credit + recurring expenses (recurring expenses deferred here from P2).
- **P5:** reports (~11 views + UI + CSV/PDF).
- **P6:** PDF engine, 3 templates + branding.
- **P7:** settings/automation + activity log/comments.
- **P8:** customer depth + Zoho migration.
- **P9:** QA / polish / deploy.

---

## MCP patterns reinforced this session
- `apply_migration` success ≠ DB state — always follow with `execute_sql` verification.
- JWT simulation must be in the SAME `execute_sql` call as the RPC: `set_config('request.jwt.claims', json_build_object('sub','<uuid>','role','authenticated')::text, true)`. A `DO $$` block can chain generate + delete/void; put the verifying SELECT as the last statement (multi-statement execute_sql returns only the last result).
- time_entries has 4 FKs into `operations.users`; member-name embeds must disambiguate: `users!time_entries_user_id_fkey`.
- Read-only cross-row aggregations over RLS tables → `security_invoker` view, not a SECDEF RPC.
- Storage ownership = first-path-segment equality: `(storage.foldername(name))[1] = current_org_id()::text`.
- Any new direct-CRUD table whose `org_id` gets a default must have its `org_id` made optional in `operations-types.ts` Insert type.

## Parallel platform-fix session (Session 110, run alongside; main platform, NOT operations)
Two unrelated production bugs, both fixed + verified live (full detail in build-queue v118b / architecture-reference v112b):
- **PTP combined narrative not rendering** — `generate-facet-interpretations` `parseAiJson` threw on malformed model JSON (unescaped char in a long `profile_overview`). Added a `jsonrepair@3.14.0` fallback (live v44). Durable fix still owed: move the three combined paths to Anthropic tool-use (typed JSON).
- **Comped client charged on a super-admin coach invite** — a $0 Checkout has no PaymentIntent, so the coach-paid gate (`stripe_payment_intent_id IS NOT NULL`) failed. `stripe-webhook` (live v31) now writes a `comp_<session.id>` sentinel on coach_order/coach_bulk_order rows; `CoachInvoices.tsx` excludes `comp_%`; the one affected row was backfilled. **Version note:** the v117/v111 "stripe-webhook v31 untouched" label was off by one — pre-fix was v30, this fix produced v31.

New follow-ups (none started): tool-use migration for combined narratives; content-aware `narrative_status` (overlaps the tracked BQ-NARRATIVE-FANOUT-STATUS / BQ-FANOUT-COLDFAIL, now with a raw-fetch + `x-internal-secret` transport suggestion); gate any future refund worker on `pi_%` / `amount_paid>0`; optional `is_comp` flag instead of overloading the Stripe-id field.

## Close artifacts
build-queue v118 (+ v118b parallel fix) · architecture-reference v112 (+ v112b parallel fix) · this `session-110-to-111.md`. Three markdown files for Cole to upload manually to `cbastianBWE/brainwise-internal-docs` (flat repo root).
