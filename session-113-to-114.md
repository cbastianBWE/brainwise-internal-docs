# Session 113 → 114 Handoff

**Session 113 shipped: Operations Platform Phase 4 backend — recurring expenses + retainers + credit notes + overpayment-to-credit. All built + verified via Supabase MCP; every functional test run as one rolled-back DO block (zero document numbers consumed, zero residue). No Lovable spend; frontend prompts are queued for Cole. No Edge Function work.**

Canonical docs bumped: build-queue **v121**, architecture-reference **v115** (new §153; §152 extended), this handoff. Markdown only (Session-74 rule).

---

## Locked decisions (do not re-litigate)

- **All credit application reduces the target invoice through a payment + allocation.** Retainer apply, credit-note apply, overpayment, and customer-credit apply all route through one internal helper that writes a `payment_mode='credit'` payment + allocation and bumps `invoices.amount_paid`. This keeps the existing amount_paid-drives-status / generated-`balance_due` math uniform and surfaces credits in the same payments view as cash. (§153.)
- **Recurring invoices v1 = draft-only.** Auto-email and auto-charge-stored-card are deferred; the S108 invoice runner ignores those template columns by design.
- **Source-of-truth split for credit balances.** `customer_credits` is the wallet ONLY for overpayments (and future refund-to-credit). Credit notes apply directly from their own generated `balance`; retainers from their own generated `available_balance`. No double-ledger.
- **Refunds stay Cole-side on Stripe.** `ops_refund_credit_note` records an offline refund against the credit note's remaining balance; it does not call Stripe.

---

## Backend surface (all shipped + verified)

Shared foundation — migration `session113_p4_payment_mode_credit_and_apply_helper`:
- `operations.payments_payment_mode_check` extended → `stripe_card|stripe_ach|ach|check|cash|wire|credit|other`.
- `operations._ops_apply_credit_to_invoice(p_org,p_invoice,p_amount,p_reference) → text` — SECDEF, `search_path ''`. The single credit-application primitive. EXECUTE revoked from PUBLIC+anon+authenticated (verified anon=false/auth=false); the SECDEF public RPCs call it as definer.

Slice 1 — recurring expenses — migration `session113_p4_recurring_expense_runner_and_cron`:
- `public.ops_run_recurring_expenses() → integer` — SECDEF, mirrors `ops_run_recurring_invoices` (one generation/run, advance by frequency×interval_count, deactivate past end_date, inserts a non-billable overhead expense). REVOKE PUBLIC+anon+authenticated, GRANT service_role.
- Cron `ops_recurring_expense_daily` jobid 26, `15 0 * * *`, username postgres, active.

Slice 2 — retainers — migration `session113_p4_retainer_rpcs` (all authenticated-only):
- `ops_create_retainer(p_header jsonb)` (numbered RET-, draft).
- `ops_set_retainer_status(p_id, p_action)` — `mark_sent` draft→sent; `mark_paid` draft|sent→paid; `mark_refunded` paid→refunded only when `applied_amount=0`.
- `ops_apply_retainer_to_invoice(p_retainer, p_invoice, p_amount)` — requires status=paid + same-customer invoice + amount<=available_balance; helper; bumps `applied_amount`; flips to `applied` when drained.

Slice 3 — credit notes — migration `session113_p4_credit_note_rpcs` (all authenticated-only):
- `ops_create_credit_note(p_header jsonb, p_lines jsonb)` (numbered CN-, polymorphic `document_lines` on `credit_note`, total=subtotal+tax, validates `associated_invoice_id` same customer).
- `ops_set_credit_note_status(p_id, p_action)` — `issue` draft→open; `void` draft|open→void only when `amount_applied=0 AND amount_refunded=0`.
- `ops_apply_credit_note_to_invoice(p_credit_note, p_invoice, p_amount)` — requires open + same customer + amount<=balance; helper; closes when balance hits 0.
- `ops_refund_credit_note(p_id, p_amount)` — offline refund vs remaining balance; closes when drained.

Slice 4 — overpayment-to-credit + customer-credit apply — migration `session113_p4_overpayment_to_credit_and_apply`:
- `ops_record_payment(p_invoice, p_payment jsonb)` body-only CREATE OR REPLACE (same signature, no overload) — now allocates `least(amount,balance)`, stamps `payments.excess_amount`, and INSERTs `customer_credits(source_type='overpayment', source_id=payment_id, amount=excess)` when amount>balance.
- `ops_apply_customer_credit_to_invoice(p_credit, p_invoice, p_amount)` — authenticated-only; draws the wallet down via the helper, sets `applied_at` when drained.

Functional tests (all rolled back, all PASSED): recurring-expense runner (1 generated, schedule advanced); retainer create→sent→paid→apply $400 (invoice partially_paid)→apply $600 (invoice paid, retainer applied); credit note issue→apply $100→refund $50→apply $150 (CN closed at balance 0; void-on-drained blocked); overpayment $300 on $200 invoice (invoice paid + $100 credit minted)→apply $80 to $80 invoice (paid, credit $20)→over-apply $50 blocked.

Edge fn versions UNCHANGED from 112 close: ops-invoice-send v2, ops-public-invoice-checkout v1, ops-estimate-send v1, ops-invoice-checkout v1, ops-stripe-webhook v3, ops-payment-receipt v1, ops-payment-reminder-cron v1. Platform stripe-webhook v31 untouched.

---

## OPEN — anon revoke on the 8 new RPCs (S114 first task)

The 8 new authenticated-only public RPCs (retainer create/status/apply + credit-note create/status/apply/refund + customer-credit apply) still read **anon=true**. Explicit `REVOKE … FROM anon` did NOT hold this session — tried same-migration, a dedicated follow-up (`session113_p4_revoke_anon_explicit_followup`), and a single-function isolated migration (`session113_p4_revoke_anon_retry_isolated`); none stuck. By contrast `ops_record_payment` (old function, standalone revoke `session113_p4_revoke_anon_record_payment`) → anon=false HELD; `ops_run_recurring_expenses` (new, also revoked from authenticated) → anon=false HELD; `ops_mint_public_token` (prior session) → anon=false HELD.

**Diagnosis (extends §152):** the Supabase grant reconciler re-applies the default anon EXECUTE grant to any newly-created, authenticated-EXPOSED public function within the SAME session it is created. The revoke only persists once the function has baselined into a prior session's migration (the §152 mint precedent worked a session later). Authenticated cannot be revoked on these — the frontend calls them as the authenticated super-admin.

**Not a security gap:** every one self-gates on `current_org_id()` returning NULL for anon and raises `no operations org for current user` before any data access — identical to the posture `ops_create_estimate` has shipped with since S112.

**S114 action:** re-run the anon revoke on the 8 functions (it should hold now they're baselined) and verify with `has_function_privilege('anon', oid, 'EXECUTE')`. The 8: `ops_create_retainer`, `ops_set_retainer_status`, `ops_apply_retainer_to_invoice`, `ops_create_credit_note`, `ops_set_credit_note_status`, `ops_apply_credit_note_to_invoice`, `ops_refund_credit_note`, `ops_apply_customer_credit_to_invoice`.

---

## Frontend (SHIPPED + verified, 5 Lovable cycles)

All reads via `opsSupabase`; all public-schema RPCs via the default `supabase` client (`supabase.rpc('name' as any, …)`), so `public` types.ts needed no hand-edit (Lovable regenerates it). Each prompt was verified against the live repo after ship; `tsc` clean.

- **P1 Retainers** — `OperationsRetainers` / `RetainerForm` / `OperationsRetainerDetail` + the shared **`ApplyToInvoiceDialog.tsx`** (reused by P2 and P5) + 4 `_shared` StatusBadge keys (applied/refunded/open/closed). Lifecycle mark_sent/mark_paid/mark_refunded + apply-to-invoice.
- **P2 Credit notes** — list / create-with-lines (own copied line editor, `EstimateForm` untouched) / detail with issue / void (guarded by zero applied+refunded) / apply / refund.
- **P3 Recurring expenses** — list + create/edit dialog, direct `opsSupabase` CRUD; `operations-types.ts` Insert `org_id` made optional on BOTH recurring template tables.
- **P4 Recurring invoices** — list + template form (line editor → `template_lines` jsonb) + detail with a generated-invoices card on `invoices.parent_recurring_id`.
- **P5 Overpayment-to-credit** — `RecordPaymentDialog` over-balance block removed, inline excess→credit note, `customer-credits` invalidation; **Account Credits** card on `OperationsCustomerDetail` applying via `ops_apply_customer_credit_to_invoice`.

### Two backend adds this session (beyond M1–M5)

- **session113_p4_recurring_template_org_created_defaults** — `org_id DEFAULT operations.current_org_id()` + `created_by DEFAULT auth.uid()` on both recurring template tables, so the config dialogs omit them (mirrors customers/expenses). `operations-types.ts` Insert `org_id` flipped optional to match.
- **session113_p4_recurring_invoice_runner_derive_line_total** — bug fix. The S108 `ops_run_recurring_invoices` reads `line_total` off each `template_lines` element, but the form stores `quantity/unit_price/discount_amount` with no `line_total`, so generated invoices would have been $0. The runner now derives `line_total = COALESCE(line_total, quantity*unit_price - discount_amount)` for both the per-line value and the subtotal. Verified via a rolled-back DO block (lines without `line_total` → subtotal 120.00, lines 90.00 + 30.00). Latent (only fires when the cron generates), so `tsc` did not catch it — backend-first verification of the runner contract did.

---

## Cole-side pending (carried)

- Subscribe the ops Stripe endpoint to `charge.refunded` (operations.stripe_webhook_events still has only the checkout event).
- GA sales-tax CPA confirmation + Sales-and-Use registration if taxable.

---

## Session 114 opener

1. Re-run + verify the anon revoke on the 8 new RPCs (above).
2. Then either drive the Phase 4 Lovable frontend (recurring invoices/expenses, retainers, credit notes, customer-credit apply, overpayment-on-payment-dialog) or pull a P2-extra forward (weekly time grid, live timer UI, calendar, project members for staff-hours, actual-vs-budget dashboard) — Cole's call.

**Session-open protocol:** GitHub MCP `get_file_contents` on `cbastianBWE/brainwise-internal-docs` for `build-queue.md`, `architecture-reference.md`, and this handoff; save to `/home/claude/internal-docs/`. Backend-first: `execute_sql` verify after every `apply_migration`; functional tests as one rolled-back DO block; mirror existing RPCs rather than write from memory; verify each Lovable plan against the live repo before approval and each shipped file after.

**Fixtures:** ops admin (auth uid / JWT sub) = `1d14e510-d0d0-4687-9741-4ddfc0c37253`; ops org_id = `7c8a8f99-19dc-4e15-9e3a-99226d0d0c52`. Create throwaway customers/invoices inside the rolled-back test block rather than depending on standing fixtures.
