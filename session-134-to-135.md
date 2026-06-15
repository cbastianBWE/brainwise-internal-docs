# BrainWise Session 134 to 135 Handoff

*Closeout: Session 134. Open: Session 135.*

## Where Session 134 left off

Two Operations/CRM externalization-track features were built backend-first and verified, plus one security review. (1) Per-org branding of the Operations invoice email (sender display name, reply-to, body brand colors/logo, and a "View & Pay" vs "View Invoice" CTA driven by whether the org collects payment), with BrainWise's own email confirmed byte-identical to before. (2) Granting CRM/Operations workspace access (an `operations.users` seat) to existing platform members from both the super-admin Members drawer and the org-admin Users tab, including a new `platform_org_id` link between a platform org and its ops workspace, a backfill for the pre-existing workspace, and auto-linking on future provisions. The lesson-assets storage scanner warning was investigated and dispositioned a false positive (no change made; rationale recorded in the architecture reference).

## Session 135 opening priorities, in order

### 1. Run + verify the AdminUsers.tsx UX prompt (given in 134, not yet confirmed run)

Two additive changes to `src/pages/admin/AdminUsers.tsx`: (a) gate the "Executive Perspective NAI" tab (both the `TabsTrigger` and the `TabsContent`) on `useOrgInstrumentAccess().orgInstrumentIncluded(DASHBOARD_INSTRUMENT_UUIDS.NAI)` so orgs whose contract excludes NAI never see the EPN tab; (b) collapse the per-row Users-tab action buttons (Reset password / Change supervisor / CRM & Ops / Deactivate) into a single kebab `DropdownMenu` so the table no longer requires horizontal scrolling. Verify by GitHub API SHA after Cole runs it.

### 2. Verify the two remaining frontend deliverables by SHA

`PublicInvoicePay.tsx` (the `canPay` gate now also requires `invoice.collects_payment === true`) was given but not SHA-confirmed. Also confirm the shipped `OperationsSettings.tsx` Branding-tab additions, `CompanyMembersSection.tsx` access drawer, and `AdminUsers.tsx` access drawer by GitHub API SHA.

### 3. Optional hardening (offered, not built)

The org-admin "CRM & Operations access" action shows whenever the admin has an ops workspace, even if the org currently has neither the CRM nor OPERATIONS module entitlement (granting a seat that surfaces nothing until a module is enabled). Harmless, but it could be gated on the org holding at least one of the two modules if Cole wants.

## Decisions locked in Session 134 (recap)

- Resend cannot send from an arbitrary per-tenant From address (only DNS-verified domains; no single-sender verification). Per-org invoice email therefore keeps the shared sending mailbox `invoices@mail.brainwiseenterprises.com` for every org and varies only the From display name + reply-to, plus body brand colors/logo. BrainWise's own email stays byte-identical.
- True per-tenant payment collection (Stripe Connect, per-org account, separate webhook handling) is DEFERRED to the externalization arc. Today there is one `STRIPE_SECRET_KEY` (BrainWise's) and no Connect, so all ops invoice payments settle to BrainWise; only BrainWise has `stripe_collection_enabled=true`. Every Stripe session/customer/PaymentIntent is already tagged with `ops_org_id` metadata so Connect can slot in later.
- A platform org links to its ops workspace via a nullable `operations.organizations.platform_org_id` (plain uuid, no cross-schema FK per Doc-5 Rule 1). Provisioning auto-derives this link from the provisioning admin's `public.users.organization_id`, but ONLY for `org_admin`/`company_admin` admins, so coach/individual user-mode workspaces stay unlinked.
- `ops_grant_operations_access` must never demote or revoke the only active admin of a workspace (both the role-change path and the revoke path are guarded).
- lesson-assets has NO trainee storage SELECT policy by design. Delivery is RPC-gated signing (the SCORM/export seam); adding a trainee policy is redundant and would open a direct read path that bypasses the single authorization checkpoint. The scanner finding is dismissed.

## Open questions / things to lock in Session 135

None blocking.

## Bugs surfaced in Session 134 added to Build Queue

- None still open. The super-admin Members drawer showing "no operations workspace provisioned" for BrainWise Test Corp was a real bug (its workspace predated `platform_org_id`, so the link was NULL) and was found AND fixed in-session via the backfill + the provisioning auto-link.

## What's NOT in scope for Session 135

- Stripe Connect / per-tenant payment settlement (externalization arc).
- Per-org custom From-domain and the `/pay/:token` public page header literal "BrainWise" (both deferred externalization-branding items).
- CRM/OPERATIONS route gating and the broader customer-access project.

## Architecture additions in Session 134

Per-org invoice email branding: `operations.organizations` gained `sender_display_name`, `reply_to_email`, `email_logo_enabled boolean NOT NULL DEFAULT false` (BrainWise backfilled `sender_display_name='BrainWise'`). New service-role RPC `ops_get_org_email_branding(p_org)` returns the email-branding bundle plus `stripe_collection_enabled`. `ops_update_org_branding(p_patch jsonb)` extended (same signature) to accept the three new fields. `ops_get_public_document_by_token` invoice branch now also returns `collects_payment`. Edge function `ops-invoice-send` deployed to v14: branding-aware (sender display name, reply-to, brand colors, optional logo), CTA label "View &amp; Pay Invoice" when the org collects payment else "View Invoice", shared sending mailbox for all orgs.

CRM/Operations access provisioning: `operations.organizations.platform_org_id uuid` (nullable) + partial unique index `organizations_platform_org_id_key WHERE platform_org_id IS NOT NULL`. `ops_provision_customer_org` recreated as the 6-arg form (adds `p_platform_org_id uuid DEFAULT NULL`) and auto-derives the link from the admin's platform org when not supplied, gated to org/company admins. Four new SECDEF RPCs: `ops_grant_operations_access(p_user_id, p_role, p_platform_org_id DEFAULT NULL)`, `ops_revoke_operations_access(p_user_id, p_platform_org_id DEFAULT NULL)`, `ops_org_user_admin_list(p_platform_org_id)` (super-admin read), `ops_org_user_list()` (org-admin read). All four `REVOKE PUBLIC, anon` + `GRANT authenticated, service_role`; guards cover auth-account existence, one-org-per-user, and never-strand-the-only-admin (on both demote and revoke).

These are recorded in architecture-reference.md (v136).

## Test fixture state at end of Session 134

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin; this account is the admin of the BrainWise Test Corp ops workspace)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

BrainWise Test Corp's ops workspace is now linked to its platform org via `platform_org_id` (backfilled this session). The BrainWise production ops workspace and the Test Coach workspace intentionally remain unlinked (super-admin and coach admins have no corporate platform org). BrainWise Test Corp's platform org holds explicit org-level CRM and OPERATIONS module grants, so its members with ops seats see both module navs.

## Documents this session leaves behind

- build-queue.md (v142)
- architecture-reference.md (v136)
- session-134-to-135.md (this document)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs. No .docx generation (Session-74 decision).
