# BrainWise Session 107 to 108 Handoff

*Closeout: Session 107. Open: Session 108.*

## Where Session 107 left off

Session 107 was a queue-hygiene + scope-verification session. No backend, schema, or Edge Function changes (Supabase MCP was used read-only). The whole build queue was triaged for the first time across its full history and consolidated into one authoritative list, and the five Group A–E scope docs were verified against live state to settle what is built vs not.

Two deliverables:

1. **New authoritative "Open Queue — Session 107" section** at the top of `build-queue.md`. This is now the single source of truth for what is open, kept, or dropped. It replaces reconstructing the queue from scattered per-session carryforward bullets. A supersession banner was added over the legacy standing-queue zone (above `## Priority key`) telling readers the old `[HIGH]`/`[POST-LAUNCH]` markers there are historical.

2. **Group A–E scope verification** (results folded into the Open Queue section). Verified live via one consolidated probe.

## Session 108 opening priorities, in order

### 1. Zoho Invoice build — Doc 1 (the whole point of Session 108)

All five Zoho scope docs are now in `cbastianBWE/brainwise-internal-docs` as markdown (Cole loaded them at end of Session 107). They came from the chat "Building a super admin invoicing component" (claude.ai/chat/cb9108c1-51bd-4c28-ba9c-15f63e417f5d).

Plan, in order:
- Pull **Doc 1 (invoice replacement)** and **Doc 5 (cross-cutting architecture)** from the repo.
- Verify the Doc 1 scope is still current and close any scope gaps before building. Do NOT start the build until scope is confirmed.
- Then build backend-first per the Lovable Credit Conservation Protocol: schema/RPC/Edge Functions verified via Supabase MCP before any Lovable prompt, full plan presented for A/B/C approval, no Lovable spend until SQL-verified.

Locked architecture constraints from Doc 5 (carry into the build):
- Operations platform lives INSIDE the existing Supabase project `svprhtzawnbzmumxnhsq`, schema-isolated under `operations.*` tables (Option A-strict), with a defined migration path to a separate project if productized.
- Multi-tenant from day one: `org_id` on every table.
- Stripe stays the single source of truth for payments; existing BrainWise Stripe account is a locked constraint.
- Doc 1 = customers, projects, tasks, time tracking, expenses, estimates, invoices, recurring, payments, credit notes, reports. Customer portal is v2.

Boundary to keep intact (BrainWise platform side): corporate orgs pay by invoice with ZERO Stripe exposure. The Zoho/operations invoicing work is a separate operational surface; do not entangle it with the corporate-billing path on the platform.

### 2. Carryforward backlog (only if Zoho work leaves capacity)

From the Open Queue "Active / near-term" tier, rough priority: BQ-NARRATIVE-FANOUT-STATUS (HIGH, confirmed open this session), BQ-FANOUT-COLDFAIL (HIGH), BQ-PDF-EXPORT-COLDCACHE (MEDIUM), BUG-NWS-1 (+ Group H closure), NAI/AIRSA PDF rebuilds, narrative regen on score changes, interpretation row consolidation, pre-export readiness check.

## Decisions locked in Session 107 (recap)

- Build queue now has ONE authoritative open list at the top of `build-queue.md`. Future sessions read that, not the legacy body.
- Product-direction items KEPT for the future: AI media generation (image/voiceover/avatar), voice dictation across AI surfaces, AI authoring parity (quiz AI + author-selectable length), AI generator tone pass, Org Overview Dashboard + AIRSA Cross-Instrument, Group A remaining work.
- Group B Custom Analytics Workbench KEPT as a future epic (verified not built); it gets its own sequencing decision before scheduling.
- Coach billing tiers (Items 29/30/36) KEPT, blocked on pricing. Coach profile page (Item 34) KEPT. Post-cert subscription benefit + skills-practice subtype taxonomy KEPT parked. Group E post-launch monitoring KEPT (ops backlog). Quarterly impersonation audit-review runbook KEPT (SOC 2 backlog).
- DROPPED: BUG-3 (superseded by INST-id detection, verified), AIRSA Phase 7 (shipped as generate-cross-instrument-recommendations v11), AIRSA Phase 8 (moot), AIRSA facet-interpretation gap, Group A unified `audit_log_view` (reporting covered elsewhere), cohort UI v2, generic `attach_*_to_*` RPC family (recon: 0 such RPCs exist). All four standing-header drops stamped `[DROPPED Session 107]` inline.
- §110 cert-path enrollment asymmetry KEPT but flagged under-specified. When picked up, define it by digging `link_assessment_to_coach_client` + `consume_assessment_purchase` + the cert-pool grant for a real asymmetry before scoping.

## Group A–E scope verification result

- **Group A (Super Admin Core): done.** Impersonation edge fns, `log_super_admin_action`, member feature overrides, Members drawer all live; `super_admin_audit_log` has before/after_value + ip_address + mode; access-history RPC exists. Gaps: `audit_log_view` dropped (reporting covered via direct queries + drawer Audit tab); quarterly review runbook in compliance backlog.
- **Group B (Custom Analytics Workbench): NOT BUILT.** Probe found 0 `agg_*` matviews, no `super_admin_findings` table, no analytics/findings RPC, no `super-admin-analytics-ai` edge fn. Kept as a future epic.
- **Group C (Coach Certification + LMS): done** (closed Session 90). Remaining pieces are the deliberate billing-tier / coach-profile / post-cert-benefit / cohort deferrals.
- **Group D (Coach Bulk Invite + Shareable Link): done.** `bulk_coach_invite` + `coach_invitation_revoke` edge fns live; `coach_invitations` table + `coach_clients.expires_at` + `invitation_source` all present.
- **Group E (Deployment Readiness): done** (platform is live). Only E9 post-launch monitoring remains, in compliance/ops backlog.

## Standing reminders

- **newsletter-sitemap `STATIC_ROUTES` is hardcoded.** When a new public marketing page is added, that list must be updated by hand (~10-sec edit). Current routes: `/`, `/services`, `/our-approach`, `/products`, `/pricing`, `/podcast`, `/contact`, `/newsletter`, `/privacy`, `/terms`, `/cookies`, `/international-privacy`.
- **Group H is still open**, gated on the BUG-NWS-1 (newsletter attachment-send hang) fix + smoke test.
- The Session 106 carryover repo-commit of `check-ai-usage` v50 + `stripe-webhook` v29 is resolved (Cole: no longer needed).

## What's NOT in scope for Session 108

- Continuing the platform backlog ahead of the Zoho build. Session 108 is the Zoho Doc 1 session unless Cole redirects.
- Building any Zoho layer beyond Doc 1 (CRM, e-sign, etc. are later docs/waves).

## Architecture changes in Session 107

None. No backend, schema, or Edge Function changes. No new §-numbered standing rules; §1–§151 all hold. Edge fn versions unchanged from Session 106 close (check-ai-usage v50, stripe-webhook v29, ai-chat v40, create-checkout v60). The only architectural note worth recording is the new authoritative-Open-Queue convention in `build-queue.md` (see architecture-reference v109).

## Documents this session leaves behind

Markdown only (Session-74 decision; no `.docx`):
- `build-queue.md` v115
- `architecture-reference.md` v109
- `session-107-to-108.md` (this document)

Source of truth: `cbastianBWE/brainwise-internal-docs` (flat repo root). Cole uploads manually via GitHub web UI.
