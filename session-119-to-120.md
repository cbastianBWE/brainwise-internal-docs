# Session 119 → 120 Handoff

**Focus of Session 119:** Started Operations Doc-2 (CRM) inside the existing `operations` schema. Built and verified backend Phases 0–2, then shipped and verified all six Phase-3 Lovable frontend prompts. Doc-1 Phase 9 (QA/polish/deploy) remains deferred until after the CRM.

Canonical docs advanced: build-queue **v127**, architecture-reference **v121**.

---

## What shipped this session

### Backend (Supabase MCP; every migration verified by a separate execute_sql; every functional test a single rolled-back DO block with a sentinel RAISE, zero residue)

- **Phase 0 — config:** `operations.pipelines`, `deal_stages`, `lead_statuses`, `picklist_values`; extended `custom_field_definitions` entity-type CHECK to lead/account/contact/deal/activity; added `users.is_salesperson`; reusable §156-locked seeder `operations.seed_crm_defaults(org)` (idempotent) and seeded the BrainWise org (default pipeline + 7 stages, 5 lead statuses, lead_source/won/lost/industry picklists).
- **Phase 1 — entities + behavior:** `accounts` (nullable `customer_id` FK = the Won bridge link), `contact_persons` extended into the unified CRM/billing contact (customer_id nullable, FK CASCADE→SET NULL, CRM columns added), `leads`, `deals` + `deal_stage_history`/`deal_team_members`/`deal_stakeholders`/`deal_line_items`. Deals triggers: probability follows the stage default unless the caller sets it; stage history recorded on every transition with time-in-prior. Public SECDEF RPCs `ops_convert_lead`, `ops_bulk_convert_leads`, `ops_create_customer_from_deal` (Won bridge; the auto-on-Won 5-minute-delay queue is Phase 7, not built).
- **Phase 2 — activities + timeline:** `activities` (discriminated task/call/meeting/email/note, polymorphic related_to with an integrity trigger) + `activity_attendees` + `activity_attachments` (metadata only; storage bucket deferred); `public.ops_entity_timeline` RPC (activities ∪ audit_log); `operations.deal_pipeline_health` view (rot flag + no-next-activity warn flag).
- **Phase 3 support — `operations.saved_lists`** (Doc 2 §6.11): four-policy org-scoped RLS, set_updated_at, grants; verified via a rolled-back JWT-sim insert (org default confirmed). PostgREST cache reloaded.

### Frontend (Lovable, run by Cole, each file verified against the repo by API SHA)

- **P3.1** (commit 5a8e29b): CRM nav group + 4 routes + 4 list pages + 4 create/edit dialogs.
- **P3.2** `OperationsPipeline.tsx`: Kanban, native HTML5 drag-to-stage (triggers handle probability/history), `deal_pipeline_health` glow; Pipeline is the first CRM sidebar item.
- **P3.3** `OperationsDealDetail.tsx`: header + stage Select + Won→customer button; tabs Overview/Activities/Team/Stakeholders/Line items. Confirmed the client split — public RPCs via the default `supabase` client, tables via `opsSupabase`.
- **P3.4** `OperationsLeadDetail.tsx` + reusable `EntityTimeline.tsx` + `ConvertLeadDialog.tsx` (single + bulk); leads list gained multi-select bulk convert and row→detail.
- **P3.5** `OperationsAccountDetail.tsx` (parent self-embed, linked-customer chip) + `OperationsContactDetail.tsx` (opt-out toggles writing the `_at` timestamps); accounts/contacts lists switched to row→detail.
- **P3.6a** `OperationsActivities.tsx`: Overdue/Today/This-week dashboard from `activities.scheduled_start_at`.
- **P3.6b** `SavedViewsBar.tsx` wired into all 4 list pages with minimal filters (search + one select, empties omitted).

---

## Immediate next steps (Session 120)

1. **Phase 3 polish (one-line):** the Deals LIST row-click still opens the edit dialog (the P3.1 interim) instead of navigating to `/operations/deals/:id` like the other three lists. Change the row `onClick` to navigate. Tiny additive fix.
2. **Phase 4 — Email Sync-A** is the next CRM phase per the 11-phase roadmap (then 5 calendar, 6 lead capture/enrichment, 7 lead scoring + workflow rules incl. the auto-on-Won bridge queue, 8 campaigns/reports/dashboards + the config editors for Phase-0 picklists/stages, 9 QA + Zoho CRM import, 10 owner/team RLS hardening before the 2nd CRM user).
3. Decide sequencing of CRM Phase 4+ vs returning to **Doc-1 Phase 9 QA/polish/deploy** (deferred this session).

---

## Carryforward (unchanged, still open)

- Doc-1 Phase 9 QA/polish/deploy (now after CRM); Doc-1 Phase 3 estimate→project and estimate→retainer conversions (never built).
- P1 live refund test + Stripe `charge.refunded` dashboard subscription.
- PTP verification tail (2 de-identified reports + 1 org stale caches); BQ-PTP-ANCHOR-REWRITE, BQ-NARRATIVE-FANOUT-STATUS, BQ-FANOUT-COLDFAIL, BQ-PDF-EXPORT-COLDCACHE; BUG-NWS-1.
- Newsletter `STATIC_ROUTES` manual-edit reminder (surface on any newsletter/sitemap/SEO/new-marketing-page work).
- Mux soak/reclaim + storage-source-removal decision.
- Migrated customer timesheet gap (option A: left as-is).
- Group C/V/W learning-platform items (lesson_blocks viewer, certification PNG page).

---

## Patterns reaffirmed this session

- Backend-first; `apply_migration` success is not DB confirmation (always a separate `execute_sql` verify); `execute_sql` returns only the last statement's result (split checks).
- New public SECDEF RPCs: search_path '', REVOKE anon/PUBLIC, GRANT authenticated/service_role; internal/seed helpers also REVOKE FROM authenticated (§156).
- PostgREST schema cache can be stale after raw `apply_migration` — `NOTIFY pgrst, 'reload schema'` before the new tables are queryable from the client.
- PostgREST embeds: disambiguate with `!<constraint>_fkey` only where a table has multiple FKs to the same parent (leads→picklist_values has two: source + industry; accounts self-reference for parent). Single-FK embeds need no hint.
- CRM access model: basic entity CRUD via direct `opsSupabase` table writes under RLS; only convert/bulk-convert/Won-bridge/timeline are RPCs (called via the default `supabase` client).
- Lovable: Cole runs every prompt; verify each shipped file against the repo by API SHA (not the raw CDN); small focused prompts, additive over modifying.
- Closeout: markdown only (no .docx, Session-74); GitHub MCP is read-only — Cole uploads the markdown bundle manually via the web UI.
