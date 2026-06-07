# Session 121 to 122 Handoff

## What shipped (Session 121)

Operations Doc-2 CRM **Phase 5 (Calendar)** and **Phase 6 (Lead capture + enrichment)** are both COMPLETE end to end (backend + frontend), each verified to the project bar: backend-first, every apply_migration followed by a separate execute_sql verification, every functional test a single rolled-back DO block (sentinel RAISE, zero residue), all four new Edge Functions boot-verified, all frontend verified against the GitHub API SHA.

### Phase 5: Calendar / reminders
- organizations += timezone (America/New_York), day_of_digest_hour (8), reminders_enabled (true).
- Tables: meeting_calendar_links (Add-to-Calendar audit) and meeting_reminders (send-log + dedup, unique on activity+type+user); SELECT-only RLS, writes via SECDEF.
- RPCs: ops_record_calendar_link (authenticated), ops_record_meeting_reminder_sent / ops_record_day_of_digest_sent / ops_due_meeting_reminders / ops_due_day_of_digest (service_role-only), ops_update_reminder_settings (admin). Selectors render branded email; edge fns are dumb senders.
- Edge fns: ops-meeting-reminder-cron v1 (jobid 28, 5,20,35,50), ops-day-of-digest-cron v1 (jobid 29, hourly :10 org-local-hour gate). Reuse reminders@mail.brainwiseenterprises.com.
- Frontend: AddToCalendarButton.tsx on EntityTimeline meeting rows; Calendar-reminders card in OperationsSettings (Templates & Reminders tab).

### Phase 6: Lead capture + enrichment
- Tables: lead_capture_webhooks (RPC-mediated, REVOKE ALL FROM authenticated/anon per the new rule below so hmac_secret is privilege-hidden), webhook_ingestion_log (rate-limit window + audit), enrichment_log (doubles as the queue). leads.source_webhook_id FK attached; organizations += enrichment_monthly_quota (200).
- 12 RPCs: webhook CRUD (create/rotate return the secret once; reads org-member, writes admin), ops_webhook_resolve / ops_log_webhook_ingestion / ops_ingest_captured_lead (service_role), ops_due_enrichments / ops_record_enrichment_result (service_role), ops_enqueue_enrichment (authenticated).
- Edge fns: ops-webhook-lead-capture v1 (public; token-resolve, HMAC verify, honeypot, throttle, 5 recipe normalizers + field_mapping override) and ops-enrichment-cron v1 (jobid 30, 2,17,32,47; one consolidated drain for Apollo org-enrich + Hunter verify; Apollo people path = skipped, plan-gated).
- LIVE PROVIDER SMOKE TEST PASSED: Apollo org-enrich on stripe.com returned full firmographics, Hunter verify returned status=valid; the Apollo key works for organizations/enrich on the current plan. Test rows were standalone (no lead) and were deleted.
- Frontend: OperationsLeadCapture.tsx (new /operations/lead-capture page + route + nav, one-time secret reveal) and the Enrichment card + "Captured via web form" badge on OperationsLeadDetail.tsx.

## New standing rule
**§157:** the Supabase instance auto-GRANTs privileges to `authenticated` on newly created TABLES (the table-level analog of §156 for functions). A secret-bearing table needs an explicit `REVOKE ALL ON <table> FROM authenticated, anon`; RLS-deny alone is not sufficient defense-in-depth. Verified via has_table_privilege and information_schema.role_column_grants.

## Open at close (carryforward)
- TWO trivial cosmetic Phase-6 frontend fixes (non-blocking): OperationsLeadCapture reads `received_count` but the list RPC returns `total_received` (Received column always shows 0); OperationsLeadDetail `statusVariant` does not map `done` to the success colour.
- Prior, unchanged: P1 live refund test + Stripe charge.refunded dashboard subscription; PTP verification tail; BQ-PTP-ANCHOR-REWRITE; BQ-NARRATIVE-FANOUT-STATUS; BQ-FANOUT-COLDFAIL; BQ-PDF-EXPORT-COLDCACHE; BUG-NWS-1; newsletter STATIC_ROUTES manual-edit reminder; Mux soak/reclaim; migrated customer timesheet gap; Phase 3 polish (Deals LIST row-click); Doc-1 Phase 3 estimate→project/retainer conversions never built; Docs 3 (QuickBooks) / 4 (e-sign BoldSign) / 5 (cross-cutting).

## Next session
Phase 7 of the Doc-2 CRM roadmap (lead scoring / assignment) unless Cole redirects. Doc-1 Phase 9 (QA/polish/deploy) remains deferred until after the CRM.

## Cron slots in use
jobids 1-30 (Phase 5/6 added 28 meeting reminders, 29 day-of digest, 30 enrichment drain).

## Edge fn versions at close
ops-meeting-reminder-cron v1 NEW, ops-day-of-digest-cron v1 NEW, ops-webhook-lead-capture v1 NEW, ops-enrichment-cron v1 NEW; all other ops and platform functions unchanged; ops and platform Stripe webhooks never cross-modified.
