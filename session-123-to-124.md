# BrainWise Session 123 to 124 Handoff

*Closeout: Session 123. Open: Session 124.*

## Where Session 123 left off

The Operations Doc-2 CRM is fully closed out: Phase 9 (QA) and Phase 10 (owner/team RLS hardening) are both complete and verified. Doc-1 invoice Phase 9 is largely closed (one cosmetic frontend fix shipped, two carryforwards found already fixed, the Stripe charge.refunded subscription done by Cole, the live refund test deferred). The CRM now holds its first real data: a Website Inbound campaign with one lead converted to a won deal and a customer, seeded deliberately to exercise the attribution chain end to end.

## Session 124 opening priorities, in order

### 1. Operations Doc-4 (e-sign / BoldSign)

The next major build. Scoped in BrainWise_Zoho_Replacement_Doc4_ESignature.md, sequenced after Docs 1 and 2 (both now closed). Confirm scope and cut a phase roadmap before building.

### 2. Doc-1 live refund test (when a real Stripe transaction exists)

The ops-stripe-webhook charge.refunded handler (v11) and ops_handle_stripe_refund RPC are built and verified, and the Stripe dashboard subscription is done. The only missing step is a live refund against a real Stripe-paid invoice. Cole will run it when a refundable live transaction exists (the migrated customer's payments are bank/cash with no payment_intent, so they cannot be used).

### 3. Phase 10 owner-stamp frontend follow-up (before the first non-admin CRM user)

operations.crm_can_write treats a null owner as not-writable for non-admins, so the CRM create dialogs must stamp owner_user_id=auth.uid() before a real sales_user or sales_manager is invited. No effect today (Cole is the only user and is admin). Tied to the §5.14 user-invitation flow, which is not yet built.

## Decisions locked in Session 123 (recap)

- Sequencing: Option A (Phase 10 RLS first, then the combined QA pass).
- Zoho CRM import tooling dropped from Phase 9 (no Zoho CRM history; starting from scratch).
- Team model: flat manager_id self-FK on operations.users (team = direct reports). Territory and multi-team deferred to v3 per §5.14.
- DELETE follows write-own (an owner can delete their own records), not admin-only.
- report_crm_campaign_roi.roi_pct redefined to classic ROI (net/budget) to match its label.
- The live campaign-attribution QA rows are kept as the first real CRM data.

## Open questions / things to lock in Session 124

None blocking. Doc-4 scope confirmation is the first substantive item.

## Bugs surfaced in Session 123 added to Build Queue

- Doc-1 live refund test deferred until a real Stripe-paid (payment_intent-bearing) transaction exists to refund safely.
- Phase 10 owner-stamp frontend follow-up (create dialogs must set owner_user_id for non-admin users before the first one is invited).

## What's NOT in scope for Session 124

- Doc-3 (QuickBooks) and Doc-5 (cross-cutting) unless Cole redirects.
- The BrainWise SaaS platform tracks (Group C AIRSA tail, Group F/G newsletter, dashboards) unless Cole redirects.

## Architecture additions in Session 123

- operations.users.manager_id uuid self-FK (ON DELETE SET NULL) + partial index.
- operations.crm_can_write(p_owner uuid) STABLE SECURITY DEFINER helper (admin any, sales_user own, sales_manager own+team, read_only/other none; null owner not-writable for non-admins). REVOKEd FROM PUBLIC, GRANTed authenticated+service_role.
- Rewritten INSERT/UPDATE/DELETE RLS on leads, accounts, contact_persons, deals, activities: org_id=current_org_id() AND crm_can_write(owner_user_id). SELECT unchanged (org-wide read-all).
- report_crm_campaign_roi.roi_pct redefined to net/budget*100 (security_invoker preserved).
- All recorded in architecture-reference v125.

## Test fixture state at end of Session 123

Test org: BrainWise Test Corp. The Phase 10 role-matrix tests seeded synthetic auth.users + operations.users rows inside rolled-back transactions (zero residue). No persistent test fixtures left behind.

First real CRM data (intentionally kept, not a fixture): campaign Website Inbound, lead Demo Prospect at Acme Demo Co (converted), deal Acme Demo Co Opportunity (Closed Won, 5000), account + customer Acme Demo Co.

## Documents this session leaves behind

- build-queue.md (v131)
- architecture-reference.md (v125)
- session-123-to-124.md (this document)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs. No docx (Session-74 decision).
