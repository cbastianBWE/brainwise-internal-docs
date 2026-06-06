# Session 117 → 118 Handoff

## Scope this session
Operations Doc-1 **Phase 7 — settings, automation, cross-cutting — COMPLETE.** All 7 sub-areas (backend) plus the 3-prompt consolidated settings UI (Lovable) shipped and verified. Build order A: cross-cutting primitives first. No platform-side (main BrainWise) work this session.

## What shipped (all verified)

**Backend (Supabase MCP; every apply_migration followed by a separate execute_sql verify; every functional test a single rolled-back DO block):**
1. **Activity-log substrate + comments** — `operations.audit_log` (append-only, RLS select-own-org), `operations.document_comments`, internal writer `operations.log_activity`, public `ops_list_activity` / `ops_list_comments` / `ops_add_comment`.
2. **Merge renderer + email templates** — SQL-side `operations.render_merge` (blanks unresolved tokens, escapes backslashes), `ops_get_merge_tag_catalog`, email-template CRUD + `ops_render_email_preview`, 5 seeded defaults; `ops_due_payment_reminders()` retrofitted in place to return server-rendered subject/body_html; `ops-payment-reminder-cron` v7 reduced to a dumb sender.
3. **Reminder dedup + send-log + manual send** — dedup guard on `ops_due_payment_reminders()` via a `reminder_sent` audit event (no new table); `ops_record_reminder_sent` (dual-context cron/manual, cross-org forge guard); `ops_render_invoice_reminder`; `reminder_schedules` CRUD; `ops-payment-reminder-cron` v8 (records sends) + `ops-send-reminder-now` v1 NEW (verify_jwt true, acts as caller).
4. **Late-fee engine** — `operations.late_fee_applications` (UNIQUE(invoice,rule) idempotency); `ops_apply_late_fees()` runner adds a visible `free_form` line and bumps subtotal/total (balance_due is generated, so it moves automatically); `ops_late_fee_daily` cron (jobid 27, 01:00); `late_fee_rules` CRUD. v1 = one-time-per-rule, `apply_to='all'` only.
5. **Salesperson/commission** — `operations.users.commission_rate`; `ops_list_salespeople` / `ops_set_user_commission_rate` / `ops_set_document_salesperson`; `operations.report_commission` view (both invoiced and paid bases).
6. **Custom-fields engine** — `custom_fields` jsonb now on all 8 entity tables (contact_person is NOT a valid `entity_type` per the live CHECK → 4 tables got the column, not 5); `operations.validate_custom_fields` helper; definition CRUD; `ops_set_custom_field_values` whitelisted-table setter.
7a. **Remaining settings CRUD** — numbering (list + safe update; `next_number` deliberately not exposed), tax authorities + tax rates CRUD, currencies list+upsert.
7b. **Consolidated settings UI (Lovable, 3 prompts, all verified against the repo)** — `OperationsSettings.tsx` is now a 6-tab shadcn shell: **P1** shell + Branding (moved verbatim) + Numbering & Tax CRUD; **P2** Templates & Reminders (type-aware editor, merge-tag chips inserting at the focused-field caret, live iframe `srcDoc` preview + server-render verify, reminder schedules with `__auto__`→null sentinel); **P3** Late Fees (`apply_to` pinned to "all", disabled) + Sales & Commission (per-user rate dialog) + Custom Fields (entity-type selector, `dropdown_options` round-trip, `entity_type`+`field_name` locked on edit).

## New standing rule
**§156** — this Supabase instance's default privileges auto-GRANT EXECUTE to `authenticated` on newly created functions, so internal SECDEF helpers need an explicit `REVOKE EXECUTE ... FROM authenticated` (not just `FROM anon, PUBLIC`). Verify with `has_function_privilege('authenticated', oid, 'EXECUTE') = false`.

## Patterns reinforced
- Client split for the settings UI: `opsSupabase` for direct operations-schema table reads; default `supabase.rpc('ops_…' as any)` for public-schema RPCs — no `operations-types.ts` edit needed.
- Late-fee mechanic settled by recon: `invoices.balance_due` is GENERATED (`total_amount − amount_paid`) and nothing recomputes totals from lines, so a fee is a visible `free_form` line + an explicit bump to `subtotal_amount`/`total_amount`.
- Settings UI prompts went through Lovable plan-mode review before each build (the P1 review caught the Radix no-empty-string-SelectItem constraint).

## Edge function versions at close
`ops-payment-reminder-cron` v8, `ops-send-reminder-now` v1 NEW. All other ops + platform functions unchanged.

## Next session = Phase 8, then Phase 9
**Phase 8 — customer depth + Zoho migration** (its own full session): full customer-detail tabs, contact persons, statements, credit balance, CSV import, and the Zoho-CSV import + reconciliation tooling. **Phase 9 — QA / polish / deploy** afterward, as a separate pass.

Session-open protocol unchanged: pull `build-queue.md`, `architecture-reference.md`, and this handoff from the repo first.

## Carryforward (unchanged, still open)
- P1 live refund test + Stripe `charge.refunded` dashboard subscription (Cole-side).
- PTP verification tail: 2 Deidentified reports + 1 org's stale caches.
- BQ-PTP-ANCHOR-REWRITE (decision pending), BQ-NARRATIVE-FANOUT-STATUS, BQ-FANOUT-COLDFAIL, BQ-PDF-EXPORT-COLDCACHE.
- BUG-NWS-1 (Group H closure gate).
- Newsletter `STATIC_ROUTES` manual-edit reminder on any new public marketing page.
- Mux soak/reclaim (delete the 19 originals after the ~1-week soak) + the storage-as-video-source removal decision.

## Close artifacts (markdown only — Session-74 decision)
`build-queue.md` (v125), `architecture-reference.md` (v119), `session-117-to-118.md`.
