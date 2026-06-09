# Session 122 to 123 Handoff

## What shipped (Session 122)

Operations Doc-2 CRM **Phase 7 (lead scoring + assignment + workflow engine)** and **Phase 8 (campaigns, attribution, reports, dashboard, settings UI)** are both COMPLETE end to end (backend + frontend), each verified to the project bar: backend-first, every apply_migration followed by a separate execute_sql verification, every functional test a single rolled-back DO block (sentinel RAISE, zero residue), all frontend verified against the GitHub API SHA. This closes the CRM build through Phase 8; Phases 1-8 are now done.

### Phase 7: lead scoring + assignment + workflow engine
- Tables: lead_scoring_rules (rule_type demographic|behavioral|decay), append-only lead_score_events (score audit trail), workflow_rules, workflow_execution_log (dedup).
- Scoring engine: operations._recompute_lead_score (internal) + public ops_recompute_lead_score (authenticated, manual recompute). Score-decay cron jobid 31. Round-robin owner assignment.
- Workflow engine is SCAN-BASED (no per-row table triggers, to avoid recursion): ops_workflow_engine_run on cron jobid 32 ('3-59/5 * * * *'), 4 kinds won_to_customer / deal_stale / lead_qualified_assign / deal_discovery_task. The Won bridge runs as an additive internal helper operations._won_bridge_create_customer invoked by the scan, never an on-Won trigger. 4 seeded rules.
- Frontend: ScoreCard on OperationsLeadDetail (recompute + lead_score_events history); LeadScoringRulesCard (full CRUD, dialog conditional by rule_type) + WorkflowRulesCard (edit-only, per-kind params, active toggle) in a new "CRM Automation" tab on OperationsSettings (existing tabs untouched).

### Phase 8: campaigns + attribution + reports + dashboard
- Tables: campaigns + campaign_attribution. 21 report_crm_* views (all security_invoker=true, GRANT SELECT authenticated+service_role, no anon).
- Frontend: OperationsCampaigns CRUD page + route + nav; 21 crm_* report defs appended to OperationsReports (page already had date filter / column toggle / CSV / PDF); NEW OperationsDashboard at the guarded /operations/dashboard (RoleGuard brainwise_super_admin + SuperAdminSessionProvider, same wrapper as siblings) with 4 KPI cards, 2 recharts bar charts (navy #021F36 Total, orange #F5741A Weighted), 4 tables.

## Two backend gaps caught and fixed this session
1. **org_id default gap.** The 4 new Phase 7/8 tables (campaigns, campaign_attribution, lead_scoring_rules, workflow_rules) were created without org_id DEFAULT operations.current_org_id(), unlike older ops tables, so UI create dialogs that omit org_id would fail NOT NULL. Migration s122_p8_orgid_default_backfill set the default on all four. New standing convention: any operations table written by a direct client insert needs org_id DEFAULT operations.current_org_id() at creation.
2. **Campaign attribution was fully unwired.** ops_auto_attribute_lead_utm existed but was orphaned and is org-guarded, so it raises on the service-role webhook ingest path; no campaign_attribution rows were ever created and report_crm_campaign_roi + the dashboard campaign view always read empty. The ROI view needs both target_type='lead' (attributed_leads) and target_type='deal' (attributed_deals + won_revenue) rows. Fix (s122_p8_campaign_attribution_wiring, fully additive, rolled-back functional test PASSED): internal service-role operations._attribute_lead_utm(uuid) (no current_org_id guard, derives org from the lead, REVOKE from authenticated/anon/PUBLIC + GRANT service_role per §156); AFTER INSERT trigger tg_lead_attribute_on_insert on operations.leads (attributes captured leads when utm_campaign present, covers webhook + manual + import); AFTER UPDATE OF converted_deal_id trigger tg_lead_attribution_to_deal (copies lead attribution to the new deal on conversion). Public ops_auto_attribute_lead_utm kept as manual re-attribution. This is the same additive-internal-helper shape as the Won bridge: when an org-guarded RPC's logic must also run on a service-role path, add an internal helper that derives org from the row.

Also: the dashboard shipped with 3 wrong column keys Lovable guessed; corrected against the live views to deals_reached/deals_won, source_name, lost_amount.

## New standing rule
None. §1-§157 hold. This session reinforces §156 (internal SECDEF helpers REVOKE EXECUTE FROM authenticated) and adds the org_id-default convention noted above (folded into architecture-reference v124, not a numbered rule).

## Open at close (carryforward)
- The two trivial cosmetic Phase-6 frontend fixes (OperationsLeadCapture received_count vs total_received; OperationsLeadDetail statusVariant does not map 'done' to the success colour).
- Phase 3 polish: Deals LIST row-click still opens the edit dialog instead of navigating to /operations/deals/:id.
- Prior, unchanged: Doc-1 Phase 3 estimate->project/retainer conversions never built; Doc-1 Phase 9 (QA/polish/deploy); P1 live refund test + Stripe charge.refunded dashboard subscription; PTP verification tail; BQ-PTP-ANCHOR-REWRITE; BQ-NARRATIVE-FANOUT-STATUS; BQ-FANOUT-COLDFAIL; BQ-PDF-EXPORT-COLDCACHE; BUG-NWS-1; newsletter STATIC_ROUTES manual-edit reminder; Mux soak/reclaim; migrated customer timesheet gap; Docs 3 (QuickBooks) / 4 (e-sign BoldSign) / 5 (cross-cutting).

## Next session
Phase 9 of the Doc-2 CRM roadmap: QA + Zoho CRM import tooling (per-entity import RPCs, hand-curated stage/reason mapping, end-to-end QA). Then Phase 10 (owner/team RLS hardening, gated on the second CRM user). Doc-1 Phase 9 remains deferred.

## Cron slots in use
jobids 1-32 (Phase 7 added 31 score decay, 32 workflow engine).

## Edge fn versions at close
None changed this session (ops-webhook-lead-capture v1 was inspected only, to diagnose the attribution gap). All ops and platform functions unchanged; ops and platform Stripe webhooks never cross-modified.
