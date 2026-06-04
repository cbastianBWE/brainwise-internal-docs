# Session 112 → 113 Handoff

**Session 112 shipped: Operations Platform Phase 3 — estimates + accept-by-link + convert + Option A public customer pay page + estimate-send email. Backend built + verified via Supabase MCP; all six Lovable prompts shipped by Cole and verified against the repo; both public pages confirmed working in production after a publish.**

Canonical docs bumped: build-queue **v120**, architecture-reference **v114**, this handoff. Markdown only (Session-74 rule).

---

## Locked decisions (do not re-litigate)

- **Token storage = HASH-ONLY** (sha256). The raw 32-byte token (64 hex) is returned once by mint and never recoverable. Consequence: there is no "resend the same link" — minting revokes any prior live token for the same (document, purpose) and issues a fresh one, so re-sending an invoice/estimate email invalidates the previously-emailed link. Correct secure default; a behavior change worth stating to anyone who asks.
- **No hard token expiry by default.** Validity is gated on document status: invoice read hidden when `void`/`written_off`; estimate read hidden when `draft`; accept/decline allowed only from `sent`/`viewed`.
- **Convert allowed from `accepted` OR `sent`/`viewed`** (blocks double-convert).
- **Public pages stay `noindex` and out of the sitemap.** `STATIC_ROUTES` in newsletter-sitemap was deliberately NOT touched (a per-customer tokenized page does not belong in a public sitemap). This overrides the older carried "add /pay to STATIC_ROUTES" note.

---

## Backend surface (all shipped + verified)

Token model (migration `session112_p3_public_access_token_model` + `..._mint_revoke_anon_explicit`):
- `operations.public_access_tokens` — hash-only, RLS on, 4 policies, **anon has NO table grant** (anon only reaches `operations.*` through the SECDEF functions).
- `ops_mint_public_token(p_document_type, p_document_id, p_purpose, p_expires_in_days DEFAULT NULL) → text` — **authenticated-only**, org-gated, revokes prior live token, returns raw.
- `ops_get_public_document_by_token(p_token) → json` — anon, sanitized bundle (no email/address/internals), flips estimate sent→viewed.
- `ops_accept_estimate_by_token(p_token)` / `ops_decline_estimate_by_token(p_token, p_reason DEFAULT NULL)` — anon, require sent/viewed, idempotent on terminal.

Estimate lifecycle (migration `session112_p3_estimate_crud_and_convert`): `ops_create_estimate(p_header,p_lines)`, `ops_update_estimate(p_id,p_header,p_lines)`, `ops_set_estimate_status(p_id,p_action)` actions `mark_sent|mark_accepted|mark_declined|mark_expired`, `ops_convert_estimate_to_invoice(p_estimate)`. Estimates have no shipping/payment_terms/due_date; total = subtotal − discount + adjustment; they carry `expiration_date`. Numbering type `estimate` (EST-YYYY-NNNN). All authenticated-only.

Edge layer:
- `ops_get_invoice_checkout_bundle_by_token(p_token)` (migration `..._checkout_bundle_by_token`) — SECDEF, anon, full checkout shape (incl. email/address/stripe id/tax codes), token-gated. The public pay page's checkout uses this, NOT the sanitized read.
- `ops_get_estimate_send_bundle(p_estimate)` (migration `session112_p3_estimate_send_bundle`) — SECDEF, org-gated, authenticated; estimate header + customer email for the send function.
- `ops-public-invoice-checkout` **v1, verify_jwt FALSE** — possession of a live pay token is the authorization; success/cancel → `${APP_ORIGIN}/pay/${token}?paid=1|canceled=1`.
- `ops-estimate-send` **v1, verify_jwt true** — mints an accept token, emails a respond link → `${APP_ORIGIN}/estimate/${token}`, marks sent only when status=draft; from `estimates@mail.brainwiseenterprises.com`.
- `ops-invoice-send` **v1 → v2** — single change: mints a pay token, button now points at `/pay/{token}`.

Edge fn versions at close: ops-invoice-send **v2**, ops-public-invoice-checkout **v1**, ops-estimate-send **v1**, ops-invoice-checkout v1, ops-stripe-webhook v3, ops-payment-receipt v1, ops-payment-reminder-cron v1. Platform stripe-webhook v31 untouched.

**Grant gotcha (now a §-rule, §152):** `REVOKE EXECUTE ... FROM PUBLIC` does NOT remove anon on a public-schema function — Supabase's `ALTER DEFAULT PRIVILEGES` grants EXECUTE directly to the named `anon` (and `authenticated`) roles. To lock mint to authenticated-only, a second migration had to `REVOKE EXECUTE ... FROM anon`. Verify with `has_function_privilege('anon', oid, 'EXECUTE')`.

---

## Frontend (all six prompts shipped + verified against the repo)

1. `src/pages/operations/_shared.tsx` — StatusBadge +4 keys (accepted/declined/invoiced/expired), additive.
2. `EstimateForm.tsx` + routes `/operations/estimates/new`, `/operations/estimates/:id/edit`.
3. `OperationsEstimates.tsx` + route `/operations/estimates` + AppSidebar "Estimates" entry.
4. `OperationsEstimateDetail.tsx` + route `/operations/estimates/:id` — Convert, Send-to-customer, Mark sent/accepted/declined/expired. No clone/payment/pay-now/delete.
5. `src/pages/public/PublicInvoicePay.tsx` at `/pay/:token`.
6. `src/pages/public/PublicEstimateRespond.tsx` at `/estimate/:token`.

Verified: App.tsx route order (list → new → :id/edit → :id), both public routes OUTSIDE `ProtectedRoute`, client split (opsSupabase reads / default supabase for public RPCs + functions.invoke), and `InvoiceForm.tsx`/`OperationsInvoiceDetail.tsx` blob SHAs byte-identical to pre-build (no invoice file touched except `_shared.tsx`).

**Production-publish lesson:** Lovable "ship" updates the repo + preview, but the custom domain serves the last PUBLISHED build. The new public links 404'd until Cole published. Fast diagnosis: fetch the live `index.html` → its hashed `/assets/index-*.js` → grep for the new route path strings vs known-old strings to distinguish a stale deploy from a code bug.

**Smoke tests (Cole):** estimate accept and invoice pay both worked end to end after publish. Re-send-revokes-prior is backend-verified; in the UI "re-send" is just Send again (no separate control).

---

## Deferred (by design, not built)

Delete-draft-estimate (no delete RPC — drafts are editable), estimate PDF export, partial accept, sitemap entry for the public pages.

## Cole-side pending (carried)

- Subscribe the ops Stripe endpoint to `charge.refunded` (operations.stripe_webhook_events still has only the checkout event).
- GA sales-tax CPA confirmation + Sales-and-Use registration if taxable.

---

## Session 113 opener — Phase 4 (recurring + retainers + credit notes)

Per the A2 roadmap: P1 money DONE (109), P2 time+expenses+charges DONE (110), S111 invoicing depth, **P3 DONE (112)**. **Phase 4 = recurring invoices + retainers + credit notes + overpayment-to-credit + recurring expenses.** Note the recurring backend foundation already exists from S108 (`recurring_invoice_templates` + `ops_recurring_invoice_daily` cron + overdue/reminder logic), so Phase 4 is more frontend-weight than P1–P3 were. P2 EXTRAS remain open as separate slices (weekly time grid, live timer UI, calendar, project members for staff-hours, actual-vs-budget dashboard) and could be pulled forward instead — Cole's call at open.

**Session-open protocol:** GitHub MCP `get_file_contents` on `cbastianBWE/brainwise-internal-docs` for `build-queue.md`, `architecture-reference.md`, and this handoff; save to `/home/claude/internal-docs/`. Backend-first: verify every Supabase change via `execute_sql` after `apply_migration`; functional tests as one rolled-back DO block (no numbers consumed); mirror existing RPCs rather than write from memory; verify each Lovable plan against the live repo before approval and each shipped file after.

**Test fixtures:** ops admin = `<super-admin-uuid>` (operations.users role admin), ops org = `<ops-org-id>`, a test customer = `<test-customer-uuid>`. Query Supabase directly for current test-user UUIDs rather than hardcoding.
