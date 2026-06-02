# BrainWise Internal Operations Platform

## Doc 5 of 5: Cross-Cutting Architecture, Sequencing, and Migration

**Version:** 1.0
**Author:** Claude (drafted with Cole Bastian, BrainWise Enterprises)
**Date:** May 21, 2026
**Status:** Architectural reference — all decisions locked

---

## 1. Purpose

Docs 1-4 specified *what* the BrainWise Internal Operations Platform does. This document specifies *how* it is built, deployed, sequenced, and operated. It resolves every architectural question deferred across the prior four docs.

This is the most important document in the series. The decisions here cascade into every line of code and every infrastructure dollar. Where Docs 1-4 can each be rewritten module-by-module, the choices in this doc are difficult to reverse once the build starts.

The six decisions resolved in this doc:

1. **Architecture (Q-D5-1):** Module inside existing BrainWise platform with strict schema isolation. Migration path to separate product defined.
2. **Multi-tenancy (Q-D5-2):** Multi-tenant from day one, internal-only at v1, productization-ready.
3. **Build sequence (Q-D5-3) + Migration cutover (Q-D5-4):** Two-wave build. Wave 1: Docs 1+4. Wave 2: Doc 2. Two cutover events from Zoho.
4. **Shared infrastructure (Q-D5-5):** Share infrastructure subsystems (auth, storage, notifications, custom fields, audit log, email). Isolate business logic and data models.
5. **Reliability posture (Q-D5-6):** Reliable-internal at v1 with documented upgrade path to full production-grade at productization trigger.

---

## 2. Architecture: Option A-strict in detail

### 2.1 What gets shared, what gets isolated

The Operations Platform lives **inside** the existing BrainWise Supabase project (`svprhtzawnbzmumxnhsq`). It is **architecturally separate** from BrainWise platform code through three discipline mechanisms:

1. **Schema namespacing.** All Operations tables live in PostgreSQL schemas named `operations_*` (e.g., `operations.customers`, `operations.invoices`, `operations.leads`, `operations.signature_envelopes`). The default `public` schema continues to hold BrainWise platform tables (organizations, users, assessments, results).
2. **Code namespacing.** The Lovable repo gets a top-level `/operations` directory for all Operations Platform code: pages, hooks, services, components. Cross-imports between `/operations` and platform code are restricted (only through a defined integration surface).
3. **Edge Function namespacing.** Supabase Edge Functions for Operations are prefixed `ops-*` (e.g., `ops-invoice-send`, `ops-payment-reminder-cron`, `ops-signature-webhook`).

### 2.2 Why not just a separate Supabase project

Option B (separate Supabase project) was considered and rejected for v1. The reasoning:

- **Productization is not near-term.** Q-D5-2 says "design for productization," not "productize now." Until productization is real, the separation Option B provides is theoretical.
- **Cost matters early.** Doubling Supabase + Lovable + monitoring costs while one founder does all the work creates operational drag.
- **Cross-system data flows matter.** Corporate customers in BrainWise platform should become customers in Operations when they pay. Same database = trivial. Separate databases = integration work that adds complexity without much upside at v1.
- **Mental model continuity.** Cole's existing knowledge of the codebase carries forward; no context-switching tax.
- **Migration is bounded.** If productization triggers, extracting `operations_*` schemas and `/operations` code to a separate project is ~3-4 weeks of focused work. Worth deferring.

### 2.3 The schema isolation discipline

Schema isolation is the load-bearing mechanism that makes Option A-strict work. Discipline rules:

**Rule 1: No cross-schema foreign keys from operations to public, except through defined integration tables.**

Operations does not directly foreign-key into the platform's `public.organizations` table. Instead, an integration table `operations.platform_organization_links` maps platform organizations to operations customers when relevant (e.g., a BrainWise corporate customer who is also being invoiced for assessments).

**Rule 2: Operations RLS policies reference `auth.uid()` but query `operations.users` for role and permission data, not the platform's user roles.**

The same Supabase auth identity (Cole's `auth.users.id = 1d14e510-d0d0-4687-9741-4ddfc0c37253`) has potentially different roles in the platform vs. Operations. Platform: super_admin. Operations: admin. The two roles are independent; the lookups don't share tables.

**Rule 3: Cross-schema queries are allowed for read-only joins through views.**

If a report needs both platform data and operations data (e.g., "Top corporate customers by combined platform revenue and consulting invoices"), it goes through a defined view that joins across schemas. No ad-hoc cross-schema joins in application code.

**Rule 4: Migrations specify schema explicitly.**

Every Supabase migration file is prefixed with the target schema in the filename: `20260601_operations_create_invoices.sql`, `20260615_public_alter_organizations.sql`. No ambiguity about what's being changed.

**Rule 5: Code organization mirrors schema separation.**

```
src/
  platform/              # existing BrainWise platform code
    components/
    hooks/
    services/
    pages/
  operations/            # new operations layer
    components/
    hooks/
    services/
    pages/
  shared/                # shared utilities (auth, storage, notifications, custom-fields)
    components/
    hooks/
    services/
```

`platform/` and `operations/` do not import from each other. Both can import from `shared/`. The integration surface is `shared/integrations/operations-platform-bridge.ts` (or similar) for the few places where data crosses (e.g., creating an Operations customer from a BrainWise platform organization).

### 2.4 The integration surface

Where the two products genuinely need to share data, the integration surface is explicit:

**Platform organization → Operations customer:**
- When a BrainWise platform organization (corporate customer) signs up, an Operations customer record is auto-created via `shared/integrations/platform-bridge.ts`.
- The Operations customer holds billing identity; the platform organization holds product identity.
- A foreign-key-like link via `operations.customers.platform_organization_id` (nullable; non-null for platform-derived customers).

**Operations user → platform user:**
- All Operations users are also platform users (same Supabase auth identity).
- Operations adds role/commission data via `operations.users` joined to `auth.users.id`.

**Shared notification system:**
- Notifications created by Operations use the same `compose_notification_email` flow built in Session 84.
- Notification types are extended (catalog grows); the dispatch infrastructure is shared.

**Shared file storage backend:**
- Same Supabase Storage instance.
- Separate buckets per domain (see §3.2).

No other integrations exist at v1. If new cross-product integration emerges, it goes through `shared/integrations/` with a defined contract.

### 2.5 Migration path to Option B (if productization happens)

If/when productization triggers, the migration from Option A-strict to Option B is a defined ~3-4 week project:

**Week 1: schema extraction.**
- Create new Supabase project `bwe-operations-prod` (or similar).
- Export `operations_*` schemas via `pg_dump`.
- Import into new project.
- Verify RLS policies, indexes, constraints transferred cleanly.

**Week 2: code split.**
- Create new Lovable repo `brainwise-operations`.
- Move `src/operations/` and relevant `src/shared/` files.
- Replace cross-product integration with API calls (Supabase webhook or scheduled sync).

**Week 3: auth federation.**
- Either (a) configure Supabase to share auth across both projects (limited support; check current Supabase docs), or (b) implement OAuth flow between projects.
- Test login flow end-to-end.

**Week 4: production cutover.**
- DNS updates.
- Webhook receivers updated.
- Stripe customer mapping verified.
- Monitoring split between two systems.

The schema isolation and code namespacing discipline in v1 is what makes this migration feasible. Skip the discipline and the migration becomes a 3-6 month rewrite.

---

## 3. Shared infrastructure architecture

### 3.1 Authentication

**Single Supabase auth instance** shared by BrainWise platform and Operations.

- `auth.users` is the canonical identity table (managed by Supabase).
- Platform users: identified by membership in `public.users` (platform's user table) with their platform role.
- Operations users: identified by membership in `operations.users` with their Operations role (Admin / Sales User / Sales Manager / Read-Only) and salesperson flag.
- A user can be both (Cole is both: super_admin in platform, admin in Operations).
- Customer portal users (Doc 1 v2): identified by membership in `operations.contact_persons` with `portal_access_enabled = true`. These are external identities (not internal users) authenticated via Supabase magic link or password.

JWT claim structure:
- `sub`: auth user ID.
- `email`: user email.
- `role`: 'authenticated' by default; resolved per-request via RLS policies that join to `operations.users` or `public.users`.
- `app_metadata.user_type`: 'internal' | 'customer_portal' | 'crm_contact_external'. Used for routing.

### 3.2 File storage

**Single Supabase Storage instance** with separated buckets:

| Bucket | Owner | Retention | Notes |
|---|---|---|---|
| `brainwise-platform-files` | Platform | Per platform policy | Existing |
| `operations-receipts` | Operations | 7 years | Doc 1 expense receipts |
| `operations-attachments` | Operations | 10 years | Invoice/estimate/deal documents |
| `operations-signed-documents` | Operations | 10 years (Doc 4 Q-SIGN6) | Signed PDFs + Certs of Completion |
| `operations-templates` | Operations | Indefinite | Doc 4 contract templates |
| `operations-exports` | Operations | 90 days | Quarterly Bookkeeper Packages and other one-time exports |

Each bucket has its own RLS policies. Signed URLs used for access; URLs expire after defined TTL per bucket (1 hour for attachments, 24 hours for exports).

### 3.3 Notifications

**Reuse the existing platform notification system** built in Session 84.

Operations adds these notification types to the catalog (extending the existing `notification_catalog` table):

- `invoice_sent` — sent when a Doc 1 invoice is emailed.
- `invoice_viewed` — recipient opened the invoice.
- `invoice_paid` — payment received.
- `invoice_overdue` — invoice past due date.
- `payment_failed` — auto-charge failure on recurring invoice.
- `estimate_viewed` — recipient opened an estimate.
- `estimate_accepted` — recipient accepted via email link.
- `estimate_declined` — recipient declined.
- `lead_assigned` — lead routed to a salesperson.
- `lead_score_threshold_crossed` — lead promoted to Qualified via score.
- `deal_stage_changed` — deal moved stages.
- `deal_stale_warning` — deal sat in stage past rot threshold.
- `deal_won` — deal closed Won.
- `deal_lost` — deal closed Lost.
- `task_due_today` — Operations task scheduled for today.
- `meeting_reminder_1hr` — Doc 2 meeting starting in 1 hour.
- `meeting_reminder_dayof` — Doc 2 day-of digest.
- `contract_sent_for_signature` — Doc 4 envelope sent.
- `contract_viewed` — recipient opened the contract.
- `contract_signed` — recipient signed.
- `contract_completed` — all signatures collected.
- `contract_declined` — recipient declined.
- `contract_expired` — envelope expired without completion.
- `webhook_lead_received` — new lead via webhook.
- `quarterly_bookkeeper_package_ready` — quarterly export generated.

Each type has: user-configurable in-app and email channels, default delivery preference, sensitive-content flag (default false), severity (info / warning / critical).

Infrastructure reuse: the `compose_notification_email` Edge Function, the `notification_display` helper, the 7 SECURITY DEFINER RPCs for read operations — all reused unchanged.

### 3.4 Custom fields engine

**Single generic custom-field engine** for all entity types across both products.

Table: `public.custom_field_definitions` (already partially scoped in Doc 1).

Schema:
```
public.custom_field_definitions
  id, org_id, entity_type, field_name, field_label,
  field_type (text | number | date | dropdown | checkbox | longtext),
  dropdown_options (jsonb), is_required, sort_order, is_active,
  applies_to_record_subtype (jsonb, optional — e.g., custom field only on invoices with type='retainer')
```

`entity_type` values:
- Operations: `customer`, `contact_person`, `project`, `task`, `time_entry`, `expense`, `estimate`, `invoice`, `lead`, `account`, `contact`, `deal`, `activity`.
- Platform: `organization`, `user`, `assessment_assignment` (extending if needed).

The values for each entity's custom fields are stored as a `jsonb` column on the parent table (`custom_fields jsonb`). Validation and rendering happens through the shared engine.

### 3.5 Audit log

**Single audit log table architecture** with consistent schema:

Operations audit log: `operations.audit_log`.
Platform audit log: `public.audit_log` (if not already present, extended for this).
Same schema shape in both:

```
{schema}.audit_log
  id, org_id, entity_type, entity_id, actor_user_id (nullable for system),
  actor_external_identifier (nullable, for webhook actors or external signers),
  action (created | updated | deleted | status_changed | sent | viewed | paid | signed | etc),
  details (jsonb), ip_address, user_agent, occurred_at
```

Reasoning for two tables: schema isolation per Q-D5-1. Reasoning for identical schemas: a future cross-product audit report can union the two.

For Doc 4 (e-signature), `operations.audit_log` is sufficient for the signature audit trail only if Sign-Build is chosen. Sign-Wrap path keeps the legally-binding audit trail in the vendor's system; `operations.audit_log` mirrors the events for in-platform display.

### 3.6 Email send (Resend)

**Single Resend account** with multiple verified sender domains/addresses:

| Address | Purpose | Volume |
|---|---|---|
| `notifications@mail.brainwiseenterprises.com` | Platform notifications (existing) | High |
| `crm@mail.brainwiseenterprises.com` | Operations CRM compose (Doc 2) | High |
| `invoices@mail.brainwiseenterprises.com` | Operations invoice send (Doc 1) | High |
| `contracts@mail.brainwiseenterprises.com` | Operations signed-doc delivery (Doc 4) | Medium |
| `reminders@mail.brainwiseenterprises.com` | Operations meeting/task reminders | Medium |
| `cole@brainwiseenterprises.com` (reply-to) | Cole's actual address for reply routing | N/A (just reply-to) |

Each sender domain has its own:
- SPF/DKIM/DMARC records.
- Resend webhook for delivery tracking.
- Bounce/complaint handling.
- Sender reputation independent of the others.

Single Resend bill; tagging for cost attribution.

### 3.7 Edge Functions

**Shared deployment pipeline**, namespaced by prefix:

- Platform functions: existing names (no prefix or `platform-` prefix if conflicts arise).
- Operations functions: `ops-` prefix.

Examples of `ops-*` functions across the docs:
- `ops-invoice-send` (Doc 1).
- `ops-invoice-pdf-generate` (Doc 1).
- `ops-payment-reminder-cron` (Doc 1).
- `ops-recurring-invoice-cron` (Doc 1).
- `ops-quarterly-bookkeeper-export` (Doc 1 + Doc 3).
- `ops-webhook-lead-capture` (Doc 2).
- `ops-email-inbound-parse` (Doc 2 Sync-A).
- `ops-meeting-reminder-cron` (Doc 2).
- `ops-day-of-digest-cron` (Doc 2).
- `ops-workflow-rule-engine` (Doc 2).
- `ops-enrichment-apollo` (Doc 2).
- `ops-enrichment-hunter` (Doc 2).
- `ops-signature-webhook` (Doc 4).
- `ops-signature-send-vendor` (Doc 4 Sign-Wrap).

Three Edge Function auth classes carry over from the platform's existing pattern (per Cole's BrainWise architecture):
- Class A: JWT-verified (most user-initiated functions).
- Class B: Internal-secret (`X-Internal-Secret` header for service-to-service).
- Class C: Cron-secret (`X-Dispatcher-Secret` for pg_cron entry points).

Operations functions use the same auth model.

### 3.8 Cron schedule (pg_cron)

**Single pg_cron instance** with namespaced jobs:

Operations cron jobs (prefix `ops_` in job names):
- `ops_recurring_invoice_daily` (00:00 UTC daily; Doc 1).
- `ops_payment_reminder_daily` (08:00 UTC daily; Doc 1).
- `ops_overdue_flag_daily` (00:30 UTC daily; Doc 1).
- `ops_workflow_rule_time_based` (every 15 min; Doc 2).
- `ops_meeting_reminder_1hr` (every 5 min; Doc 2).
- `ops_day_of_digest` (12:00 UTC daily; Doc 2 — sends user-timezone-adjusted at 8 AM local).
- `ops_enrichment_retry_queue` (every 30 min; Doc 2).
- `ops_lead_score_decay_weekly` (Sunday 02:00 UTC; Doc 2).
- `ops_signature_reminder_daily` (08:00 UTC daily; Doc 4).
- `ops_signature_expiration_daily` (00:00 UTC daily; Doc 4).
- `ops_quarterly_bookkeeper_export` (1st of quarter, 00:00 UTC; Doc 1 + Doc 3 v2).
- `ops_audit_log_archive_monthly` (1st of month; Doc 5 §5).

---

## 4. Multi-tenancy posture in detail

### 4.1 The multi-tenant target

Every Operations table has `org_id uuid not null` referencing an `organizations` table. All queries are scoped by `org_id` through RLS policies.

At v1, only one `org_id` is active: BrainWise Enterprises itself. The infrastructure supports many; only one is used.

Future state (productization):
- New `organizations` row per coaching/consulting business that subscribes.
- That org's users have `auth.users` entries with `app_metadata.org_id` set.
- RLS policies enforce that users only see their own org's data.

### 4.2 RLS pattern

Every Operations table has these RLS policies:

```sql
-- Select: users see their org's data
CREATE POLICY "select own org" ON operations.invoices
  FOR SELECT USING (
    org_id = (
      SELECT u.org_id FROM operations.users u
      WHERE u.id = auth.uid()
    )
  );

-- Insert: users insert into their org
CREATE POLICY "insert own org" ON operations.invoices
  FOR INSERT WITH CHECK (
    org_id = (
      SELECT u.org_id FROM operations.users u
      WHERE u.id = auth.uid()
    )
  );

-- Update + Delete: same pattern with additional role checks
```

This pattern is repeated for every Operations table. The `org_id` is the multi-tenant boundary.

Customer portal users (Doc 1 v2) have a different RLS pattern: they see only records where they are the customer or contact person, regardless of org. Their `app_metadata.user_type = 'customer_portal'` flag drives a different RLS policy set.

### 4.3 Why multi-tenant from day one matters

Retrofitting multi-tenancy onto a single-tenant system is the kind of work that costs 2-3x what designing it in upfront does. Specifically:

- Every table needs an `org_id` added (~50+ migrations in this case).
- Every RLS policy needs rewriting.
- Every query needs auditing for org-isolation.
- All in-flight data needs backfilling.
- All cached queries need invalidation.
- Tests need rewriting.

Doing it upfront: every CREATE TABLE statement includes `org_id`, every policy is written with the org filter, queries are written correctly the first time. Zero rework.

Cost difference between "multi-tenant from day one" and "single-tenant only" is ~5-10 days of additional discipline up front. Cost of retrofitting later is 2-4 months.

### 4.4 What changes at productization

If/when productization happens:

1. New `organizations` rows created for each customer.
2. Customer signup flow creates the org, an initial admin user, default picklists, default templates.
3. Per-org Stripe customer for billing (BrainWise platform invoices the operations customer for the SaaS subscription).
4. Per-org Resend sender domain (if customers want their own email branding).
5. Per-org BoldSign account (or other Sign vendor) for embedded signing under their brand.

None of this requires schema changes — the multi-tenant design accommodates it.

---

## 5. Reliability posture: reliable-internal at v1

### 5.1 What v1 reliability includes

**Database resilience:**
- Supabase Pro plan: 7-day point-in-time recovery, daily backups, regional redundancy.
- Documented restore-from-backup procedure (one-page runbook stored in `cbastianBWE/brainwise-internal-docs`).
- Quarterly restore drill: practice restoring to a test environment.

**Monitoring:**
- **Sentry** ($26/month Team plan): error tracking, alert on new error types, performance traces.
- **Better Stack** (formerly Logtail/Uptime, $10-30/month): uptime monitoring for the web app, alerting on 5xx errors, status page if needed later.
- **Supabase observability**: built-in dashboard for database query performance, Edge Function execution, auth events.

**Alerting:**
- Sentry sends to Cole's email on new error types.
- Better Stack sends to Cole's email on uptime issues.
- No paging (no on-call rotation; Cole is solo).
- Critical alerts (database down, Stripe webhook failures, auth provider down) configured separately with higher visibility.

**Logging:**
- Supabase Pro logs (7-day retention for free; configurable higher with paid tier).
- Edge Function logs viewable in Supabase dashboard.
- Structured logging in application code (consistent JSON shape for error events).

**Backup strategy:**
- Supabase daily backups (automatic, 7-day retention).
- Weekly full backup export to S3 (or equivalent) for longer-term retention (~$5/month at expected data volume).
- Monthly disaster recovery snapshot saved to long-term cold storage.

**Security:**
- RLS on every table (already designed in).
- HTTPS everywhere (Supabase default).
- Secrets management via Supabase Edge Function Secrets (already in use).
- Annual security review by external consultant (~$2-5k once a year). Not full SOC 2.
- Vulnerability scanning via npm audit + Snyk free tier.

**Audit log:**
- Every sensitive operation logged (already designed in §3.5).
- Audit log archived monthly to cold storage.
- 10-year retention to match document retention.

**Soft delete:**
- Records aren't hard-deleted by default; flagged with `archived_at` or `deleted_at` timestamp.
- Admin UI surfaces a "Trash" view with restore capability.
- Hard delete only available to Admin role with confirmation.

**Total monthly cost of reliable-internal posture: ~$60-90/month.** Sentry + Better Stack + S3 backup + Supabase Pro upgrade portion.

### 5.2 What v1 reliability does NOT include

Explicit non-features at v1:
- 99.9% SLA commitment to anyone.
- 24/7 paging or on-call rotation.
- Multi-region database failover.
- Status page (can add at v2 if needed).
- SOC 2 / HIPAA / ISO compliance audits.
- Penetration testing (annual review is lighter-weight).
- Application performance monitoring beyond Sentry traces (Datadog/New Relic deferred).
- Synthetic monitoring from multiple regions.
- Quarterly incident retrospectives (only because there's one engineer — no team to retrospect with).

These are the "production-grade for product company with paying customers" tier and are deferred to the productization trigger.

### 5.3 Productization trigger upgrade path

When productization happens (first paying SaaS customer of the Operations platform), the reliability posture upgrades to:

**Tier 1 upgrades (immediately on first paying customer):**
- Public status page (Better Stack supports this; ~$0 extra at their tier).
- Documented uptime commitment (start at 99.5% SLA, not 99.9%; can tighten later).
- Customer-facing changelog.
- Documented incident response process.

**Tier 2 upgrades (at $10k MRR):**
- SOC 2 Type 1 audit (~$25-50k).
- Application performance monitoring (Datadog or New Relic; ~$200-500/month).
- Multi-region database read replica.
- Quarterly external security review.
- Paid on-call service (Better Stack on-call, ~$25/user/month for the addon).

**Tier 3 upgrades (at $100k MRR):**
- SOC 2 Type 2 audit (~$30-60k annually).
- 99.9% SLA commitment.
- 24/7 paging with first-line response team (could be one-person on-call until headcount supports rotation).
- Penetration testing (annual).
- HIPAA-readiness if customer base demands it.

This tier ladder is documented but not implemented at v1.

---

## 6. Build sequencing in detail

### 6.1 Wave 1: Docs 1+4 in serial-but-interleaved

**Wave 1 calendar: ~5.5-8 months for Doc 1 + ~3-4 months for Doc 4 Sign-Wrap, interleaved.**

Realistic phasing for one developer:

**Months 1-3 (Doc 1 foundation + early modules):**
- Foundation: data model, auth scoping, file storage, Stripe integration, Stripe Tax integration, PDF engine.
- Modules: Customers, Items, Projects, Time tracking.
- Multi-tenant scaffolding (org_id on every table, RLS policies).
- Schema isolation discipline established (`operations.*` schema, code in `/operations`).

**Months 3-5 (Doc 1 mid + Doc 4 begin):**
- Doc 1 modules: Expenses, Estimates, Invoices (the core).
- Doc 4 (Sign-Wrap) begins: BoldSign account setup, integration layer, template structure for 4 default templates.
- Attorney engagement begins for default template content (4-6 week lead time).

**Months 5-7 (Doc 1 finishing + Doc 4 continuing):**
- Doc 1: Recurring invoices, retainers, credit notes, payments, customer credit, payment reminders, late fees, salesperson tracking.
- Doc 4: Multi-party flow, embedded signing UI, signed-document storage, Certificate of Completion handling.
- Doc 4 attorney review continues; first reviewed templates ready for v1 testing.

**Months 7-8 (Doc 1 + Doc 4 final + QA):**
- Doc 1: Reports (16 reports), settings UI, Quarterly Bookkeeper Package, custom fields.
- Doc 4: Status sync, reports, settings.
- Combined QA pass.
- Production deployment to live but parallel with Zoho.

**Month 8-9 (Parallel run with Zoho):**
- Both Doc 1+4 and Zoho Invoice run.
- Discipline: new invoices go through Doc 1; existing in-flight Zoho invoices complete in Zoho.
- Reconciliation discipline established.

**Month 9-10 (Cutover 1):**
- Zoho Invoice stopped (no new invoices in Zoho).
- Zoho Sign stopped (or never started if BoldSign was the choice from earlier).
- Historical Zoho data exported and imported into Doc 1.
- Zoho subscription downgraded to CRM-only.

### 6.2 Wave 2: Doc 2 (CRM)

**Wave 2 calendar: ~6.5-9 months. Starts after Wave 1 cutover (month 9-10).**

Phasing:

**Months 10-14 (Doc 2 foundation + core modules):**
- Foundation: CRM data model, picklist engine, activity timeline, saved lists.
- Modules: Leads, Accounts, Contacts, Deals.
- Pipeline Kanban.
- Integration with Doc 1: deal→customer auto-creation (5-min delay).

**Months 14-17 (Doc 2 communications + automation):**
- Email integration (Sync-A: BCC + forward + compose-via-Resend).
- Calendar integration ("Add to Calendar" + reminders).
- Lead capture (webhook ingest + 5 recipes: Lovable, Tally, MS Bookings, Stripe, Zapier).
- Enrichment (Apollo + Hunter).
- Lead scoring engine.
- Workflow rules engine.

**Months 17-18 (Doc 2 reports + QA + cutover):**
- 18 reports.
- Dashboards.
- Migration from Zoho CRM (historical lead/contact/account/deal import).
- QA.
- Production deployment.

**Month 18-19 (Cutover 2):**
- Zoho CRM stopped.
- All historical data resident in Doc 2.
- Zoho subscription canceled entirely.

### 6.3 Total elapsed timeline

**Sequential (one developer, Wave 1 then Wave 2): 17-19 months from start.**

This is the realistic baseline. Compressing it requires:
- Adding a second developer (~30-40% time savings at the cost of coordination overhead).
- Cutting v1 scope (e.g., the lean Doc 1 Option A1 + Doc 4 Sign-Wrap + minimal Doc 2 = ~10-12 months at the cost of feature loss).

### 6.4 What stays in Zoho during the interim

During months 9-19 (Cutover 1 complete, Cutover 2 not yet):

- Zoho CRM remains as the sales pipeline tool.
- Zoho Invoice is OFF (Doc 1 ships).
- Zoho Sign is OFF (Doc 4 ships, or never used).

The reconciliation problem during this interim: Doc 1 has new customers being billed; Zoho CRM has pipeline records that should reference those customers. The solution:

- **Manual reconciliation:** at deal closed-won in Zoho CRM, Cole creates the customer in Doc 1 manually. ~5 minutes per deal at low volume.
- **Lightweight bridge (optional):** if interim is longer than 6 months and deal volume justifies it, build a one-way sync from Zoho CRM → Doc 1 customer on deal-won (~3-5 days). Most likely not worth it.

---

## 7. Migration strategy

### 7.1 Cutover Event 1: Zoho Invoice off, Zoho Sign off

**Timing:** End of Wave 1 (month 9-10).

**Steps:**

1. **Pre-cutover (1-2 weeks):**
   - Export all Zoho Invoice data: customers, items, projects, time entries, expenses, estimates, invoices, payments, credit notes.
   - Map and transform to Doc 1 schema using migration tooling (~5-7 days build).
   - Import into Doc 1 in test environment.
   - Verify totals match (AR balance, customer count, invoice count).

2. **Cutover day:**
   - Stop creating new invoices/estimates in Zoho Invoice.
   - Final delta import of any data created in Zoho during the prep window.
   - Switch Stripe webhook endpoints from Zoho to Doc 1 (so payments flow to the new system).
   - Update all customer-facing email templates to use new sender domains.
   - Announce internally: Doc 1 is now live.

3. **Post-cutover (1-2 months):**
   - Zoho Invoice remains read-only (subscription downgraded but kept for historical access).
   - Any payments still flowing in for pre-cutover invoices: reconcile manually.
   - Doc 1 is source of truth for all new activity.

4. **Final teardown (month 12-15):**
   - Once all pre-cutover invoices are paid or written off, Zoho Invoice subscription canceled entirely.
   - Historical data exported to long-term archive (CSV + PDF dump).

**For Zoho Sign:** depends on prior usage. If actively using Zoho Sign, migrate similarly. If not used (estimates accepted via Zoho Invoice's accept-by-link), simply don't activate BoldSign until Doc 4 is ready.

### 7.2 Cutover Event 2: Zoho CRM off

**Timing:** End of Wave 2 (month 18-19).

**Steps:**

1. **Pre-cutover (2-3 weeks — CRM migration is heavier than invoice):**
   - Export all Zoho CRM data: leads, accounts, contacts, deals, activities, notes, attachments.
   - Map and transform to Doc 2 schema.
   - Pipeline stage mapping requires hand-curation (Zoho's default stages → BrainWise's 6-stage default).
   - Won/lost reason mapping requires hand-curation.
   - Custom field mapping requires hand-curation.
   - Activity timeline preserves chronology.
   - Test imports in test environment.

2. **Cutover day:**
   - Stop creating new records in Zoho CRM.
   - Final delta import.
   - Update web forms / lead capture sources to point at Doc 2 webhooks.
   - Disconnect Zoho CRM from any external integrations (Stripe, Calendly equivalent, etc.).
   - Announce internally.

3. **Post-cutover (1 month):**
   - Zoho CRM read-only for historical reference.
   - Any in-flight pipeline activity reconciled to Doc 2.

4. **Final teardown:**
   - Zoho subscription canceled entirely.
   - Final data export archived.

### 7.3 Data ownership and historical records

After both cutovers:
- BrainWise Operations Platform owns all current operational data.
- Zoho exports are archived in cold storage indefinitely (legal requirement for business records, typically 7 years for tax, 10+ years for some categories).
- Bookkeeper / CPA receives historical Zoho data via the archived exports if needed for past-period work.

---

## 8. Doc 3 reference (bookkeeping)

Doc 3 was reduced to a decision document (not a build scope). Its bearing on Doc 5:

- QBO (QuickBooks Online) remains the books of record. Not built.
- Stripe → QBO native integration is configured at v1 launch (~2 hours, no build).
- Doc 1 generates a Quarterly Bookkeeper Package (~3-5 days added to Doc 1 v1 estimate; already in Wave 1).
- Doc 1 → QBO custom sync is a v2 build item (~6-8 weeks), deployed only if quarterly reconciliation proves painful.

No additional architectural decisions in Doc 5 specific to bookkeeping.

---

## 9. Updated combined effort estimate

After all Doc 1-5 decisions, the realistic v1 effort estimate for the full BrainWise Internal Operations Platform:

| Component | Calendar months (one full-time dev) | Wave |
|---|---|---|
| Doc 1 (Invoice + Quarterly Package) | 5.5-8 | 1 |
| Doc 4 (E-Sign, Sign-Wrap path) | 3-4 (overlapping with Doc 1 months 3-7) | 1 |
| Doc 2 (CRM) | 6.5-9 | 2 |
| Doc 5 (Architecture overhead) | 0.5-1 (multi-tenant scaffolding, schema isolation discipline, reliability tooling setup) | Distributed |
| **Wave 1 total** | **~6-9 months** | |
| **Wave 2 total** | **~6.5-9 months** | |
| **Sequential total** | **~13-18 months** | |

This is the honest range. With reuse of shared infrastructure (per §3), Wave 2 is slightly faster than its standalone estimate. Without reuse, it would be 7.5-10 months.

External dependencies that cost calendar time but not build time:
- Attorney engagement for Doc 4 templates: 4-6 weeks lead time, parallel to build.
- Bookkeeper sign-off on Quarterly Package format: 1-2 weeks, before Doc 1 launch.
- Migration validation in test environment: 2-3 weeks per cutover.

Ongoing monthly costs at v1:
- Supabase Pro: $25/month.
- Sentry: $26/month.
- Better Stack: $10-30/month.
- Backup storage (S3 or equivalent): $5-10/month.
- BoldSign Business: $25-75/month (1-3 users).
- Twilio Verify: ~$5-50/month at expected volume.
- Apollo: $0 (free tier).
- Hunter: $0 (free tier).
- Resend: ~$20/month at expected volume.
- QBO Essentials: $75/month (already a cost in current state).
- **Total infrastructure for the build: ~$200-300/month** (excluding QBO which is already paid).

---

## 10. Risks and unresolved items

### 10.1 Architectural risks

- **Schema isolation discipline drift.** Over 17+ months of build, the discipline of keeping `operations.*` separate from `public.*` requires constant attention. One mis-prefixed migration or one cross-schema query in application code starts the drift. Mitigation: code review discipline, schema-name checks in CI, periodic architectural review.
- **The integration surface grows.** If new "operations needs platform data" or "platform needs operations data" cases emerge, the bridge layer expands. Each addition is OK; the cumulative complexity matters. Mitigation: each new integration is a documented contract, not ad-hoc.
- **Productization timing.** If productization happens earlier than expected (within 12 months), the Option A-strict architecture may need to split into Option B sooner than planned. The migration is feasible but disruptive. Mitigation: revisit architecture decision quarterly; pre-plan the split if productization signal strengthens.

### 10.2 Sequencing risks

- **Wave 1 delays cascade to Wave 2.** Any slippage in Doc 1 + Doc 4 pushes Doc 2 out. Real calendar at one developer is rarely on plan; the 6-9 month range is genuine.
- **Cole's BrainWise platform work continues during Operations build.** The 17-19 month sequential estimate assumes Cole works exclusively on Operations. If platform work demands attention (which is likely), Operations slips proportionally.
- **Migration discoveries.** Zoho data exports may have schema surprises that require additional transformation work at cutover time. Mitigation: do migration tooling early, not at cutover.

### 10.3 Multi-tenancy risks

- **Designing-for-productization without productizing.** The discipline of multi-tenant from day one adds 5-10 days. If productization never happens, that work is overhead with no payoff. Hedge: this is a known cost of optionality; the alternative (retrofit later) is much more expensive.
- **RLS performance at scale.** With every query filtering by `org_id`, query plans depend on good indexes. At one org, this is trivial. At 100 orgs, indexing strategy matters. Mitigation: index on `org_id` plus secondary columns for every table.

### 10.4 Reliability risks

- **One developer on call (in practice, even without formal on-call).** A critical bug at 11pm is a critical bug. Cole is alone. Reliable-internal posture limits exposure but doesn't eliminate it. Mitigation: keep change cadence reasonable; deploy on weekdays only; maintain rollback capability.
- **Backup-restore not regularly drilled.** Quarterly drill is the plan; if it slips, the restore procedure may not work when needed. Mitigation: calendar it; make it a quarterly review item.
- **External vendor dependencies pile up.** Stripe + Stripe Tax + Resend + Supabase + Sentry + Better Stack + BoldSign + Apollo + Hunter + Twilio + QBO = 11 vendors. Any one going down affects something. Mitigation: monitor vendor status pages; document degraded-mode procedures for the critical few.

### 10.5 Open items deferred to future sessions

- **Specific Edge Function authorization patterns for new functions.** Decided per-function during build; pattern established in §3.7.
- **Specific RLS policies for customer portal users (Doc 1 v2).** Designed at v2 build time, not v1.
- **Specific webhook integration recipes for the 5 chosen sources (Doc 2).** Documentation work, ~2-3 days at Doc 2 build time.
- **Pipeline migration mapping from Zoho stages to BrainWise 6-stage default.** Hand-curated during Cutover 2 prep.
- **Attorney identification for Doc 4 template content.** Cole's responsibility, 4-6 week lead time.
- **Bookkeeper review of Quarterly Bookkeeper Package format.** Before Doc 1 launch.

---

## 11. Summary of the architectural locks across all 5 docs

This is the complete decision log of the scope series:

### Doc 1 (Invoice Replacement)
- D1-1: Stripe stays as payment processor.
- D1-2: 4 billing methods (Fixed / Project Hours / Task Hours / Staff Hours).
- D1-3: Customer portal is v2.
- D1-4: Time tracking web-only, multi-user designed.
- D1-5: Own PDF generation engine.
- D1-6: Stripe Tax for multi-state sales tax.
- D1-7: Receipt OCR is v3.
- D1-8: E-signature on estimates via accept-by-link at v1 (true e-sig is Doc 4).
- D1-11: Own invoice engine (Option A from Q1).
- D1-12: Single base currency USD; multi-currency v3.
- D1-13: 2-3 PDF templates at v1.
- D1-14: 1-2 month parallel run, then hard cutover.
- D1-15: No time rounding default.
- D1-16: No timesheet approval flow at v1; schema preserves v2.
- D1-17: Late fees in v1.
- D1-18: Salesperson + commission tracking in v1.

### Doc 2 (CRM Layer)
- D2-1: Strict Lead/Contact distinction + direct Contact creation allowed.
- D2-2: Email Sync-A only (BCC + compose-via-Resend).
- D2-3: Calendar "Add to Calendar" + in-CRM reminders.
- D2-4: Lite enrichment (Apollo + Hunter).
- D2-5: 5 webhook recipes (Lovable, Tally, MS Bookings, Stripe, Zapier).
- D2-6: Light multi-user (4 roles).
- D2-7: USD only.
- D2-8: Salesperson commission lives on users.
- D2-9: Workflow rules engine with 4 pre-built rules.
- D2-10: Pipeline Kanban is the default home.
- D2-11: Activity-based selling warn-only.
- D2-12: Customer auto-create on Deal Won with 5-min undo delay.
- D2-13: 6 default stages (Inquiry → Discovery → Demo → Proposal → Negotiation → Closed Won/Lost).
- D2-14: Single pipeline at v1; multi-pipeline v2.
- D2-15: 10-source default lead source picklist.
- D2-16: Won/Lost reasons with Build-In-House + No-Decision-Maker additions.
- D2-17: Silent email tracking.
- D2-18: Two-tier opt-out (marketing + transactional).
- D2-19: Tally is the recommended form-builder; no internal form-builder at v1.

### Doc 3 (Bookkeeping Approach)
- D3-1: Books of record is QBO standalone (not built in-house).
- D3-2: Stripe → QBO native integration configured at v1 launch.
- D3-3: Doc 1 generates Quarterly Bookkeeper Package (~3-5 days added to Doc 1).
- D3-4: Bookkeeper works in QBO directly; Doc 1 is operational source of truth.
- D3-5: Doc 1 → QBO custom integration is v2 (~6-8 weeks), deployed only if needed.
- D3-6: All accounting-specific scope permanently out of v1.

### Doc 4 (E-Signature Layer)
- D4-1: Both paths scoped; recommendation is Sign-Wrap.
- D4-2: Document types: Estimates, SOWs, NDAs, MSAs, Onboarding.
- D4-3: Full multi-party flow design.
- D4-4: Word/PDF upload + in-platform field placement.
- D4-5: 4 default templates ship with attorney-review dependency.
- D4-6: Email + SMS OTP for ALL signatures.
- D4-7: 10-year retention.
- D4-8: Auto-email signed copy + Cert of Completion + in-platform storage.
- D4-9: Recommended vendor (Sign-Wrap): BoldSign.
- D4-10: Twilio Verify for SMS OTP.
- D4-12: Attorney engagement is v1 gating dependency for template content.

### Doc 5 (Cross-Cutting)
- D5-1: Option A-strict — module inside BrainWise platform with strict schema isolation. Migration path to Option B defined.
- D5-2: Multi-tenant from day one, internal-only at v1, productization-ready.
- D5-3: Two-wave build sequence (Docs 1+4 in Wave 1, Doc 2 in Wave 2).
- D5-4: Two cutover events from Zoho.
- D5-5: Shared infrastructure (auth, storage, notifications, custom fields, audit log, email). Isolated business logic.
- D5-6: Reliable-internal at v1; production-grade upgrade path at productization trigger.

**Total locked decisions across all 5 docs: 55.**

---

## 12. What to do next

After this scope series, the next steps in order:

1. **Cole reviews all 5 docs.** Comments, corrections, scope additions/removals.
2. **Bookkeeper consultation.** Confirm QBO Essentials is sufficient; review Quarterly Package format requirements.
3. **Attorney engagement.** Identify attorney for Doc 4 templates. 4-6 week lead time before drafts ready.
4. **BoldSign account creation.** Free trial first, evaluate UX, decide on final vendor choice (BoldSign vs. SignWell vs. Dropbox Sign).
5. **Stripe Tax configuration** in existing Stripe account. Required before Doc 1 build begins.
6. **Stripe → QBO native app installation.** Configure account mapping. Required before Wave 1 cutover.
7. **Build Wave 1 begins:** Doc 1 + Doc 4 (Sign-Wrap), with shared infrastructure scaffolding built first.

This concludes the scope series.

---

*End of Doc 5. End of BrainWise Internal Operations Platform scope series.*
