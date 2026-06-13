# BrainWise Session 133 to 134 Handoff

*Closeout of the module-entitlement build (the continuation half of Session 133, after the white-label/scoping half recorded in build-queue v140 / architecture-reference v134). Opens the next session.*

## Where this session left off

The Module Entitlement layer ("modularize and sell") Phase 1 was built end to end and verified: per-principal on/off for platform modules (LMS and ASSESSMENTS live now; CRM and OPERATIONS scaffolded) across corporate orgs, individuals, and coaches, resolved by one function. Backend spine, LMS and ASSESSMENTS enforcement at both the route layer and the database layer, and the super-admin control surface all shipped. LMS and ASSESSMENTS are default-on with a real per-principal off-switch; CRM and OPERATIONS are registered but not enforced. No Operations-platform work this session. No edge functions, cron jobs, or Stripe webhooks were touched.

## Next session opening priorities, in order

### 1. CRM / Operations route gating (when the customer-access build starts)

Currently dormant: the operations surface is super-admin-only, roughly 40 `/operations` routes with no shared layout wrapper. Attach `module:CRM` / `module:OPERATIONS` gating during the customer-access build, not before. The admin toggles already exist to pre-set a customer's modules; they simply will not control anything until that surface is built.

### 2. Module subscription billing wiring

`module_subscription_prices` is empty. When module prices are defined, add the stripe-webhook branch that reads the price map and calls `_module_entitlement_upsert` (idempotent on the subscription id). Write and boot-verify it against a real mapped price, not against an empty map.

### 3. CRM / Operations customer-access project

The large arc: tenant-scoped RLS across `operations.*` under many `org_id`s, non-super-admin routing plus onboarding/provisioning, per-tenant UI scoping, and module billing. Scope it as its own multi-session track.

### 4. Optional cosmetic

Hide the dashboard instrument-selection tiles when ASSESSMENTS is off for a principal.

## Decisions locked this session (recap)

- Company module grants live as org-principal rows in `module_entitlements`, turned on by us when a contract is invoiced. No columns were added to `corporate_contracts`. The scope doc's org-keyed-column recommendation was rejected because columns on `corporate_contracts` can express only the company path and cannot entitle coaches or individuals who have no contract row.
- One principal-keyed store serves all three commercial paths: individuals get a future subscription plus manual invoice turn-on now, coaches get manual invoice turn-on now plus possible subscription later, companies stay contract/invoice.
- `module_subscription_prices` is built now but left empty (subscription-readiness only), so adding a price and mapping it later makes individual and coach subscription grants work with zero code change.
- ASSESSMENTS is a coarse switch above the existing per-instrument entitlements; the instrument path is unchanged and not double-gated. Enforcement is at the begin-chokepoint only (in-progress and results untouched).
- Backend deny on the learner LMS RPCs via `assert_module_entitled('LMS')` is built and tested but deliberately not wired, because with LMS default-on it is a pure no-op today and retrofitting the full learner read surface now is regression risk for zero current effect. It attaches when LMS flips to gated.
- Subscription webhook wiring is deferred per "subscription later when defined"; the price-map table and the idempotent grant path are ready and tested.

## Open questions / things to lock next session

- None blocking. The next decisions land when the CRM/Operations customer-access arc is scoped (tenant model, non-super-admin roles, onboarding) and when module subscription prices are defined.

## Bugs surfaced this session

- None. One ordering requirement was hit and resolved in-session: `super_admin_audit_log.action_type` has an FK to `super_admin_action_types`, so the three new action types had to be registered before the grant/deny/revoke RPCs could log. Recorded as a durable fact in architecture-reference v135.

## What's NOT in scope next session

- The full CRM/Operations externalization build (that is the multi-session customer-access arc; only its first slice begins when scoped).
- Wiring `assert_module_entitled('LMS')` onto learner RPCs while LMS is default-on (no-op today).

## Architecture additions this session

Recorded in `architecture-reference.md` v135. Summary: three public-schema tables (`module_definitions`, `module_entitlements`, `module_subscription_prices`); the `principal_has_module` resolver and its precedence rule (super-admin, then most-specific active explicit override, then module default, then false); the `user_has_feature` `module:%` seam; the write-path RPCs `_module_entitlement_upsert` (service-role, idempotent) and the super-admin `module_entitlement_grant` / `_deny` / `_revoke` plus `module_entitlement_admin_list`; the `assert_module_entitled` backend deny primitive; the three `super_admin_action_types` rows and the FK-register-before-logging requirement; the enforcement points (7 LMS RPCs caller- and target-based, 2 ASSESSMENTS begin RPCs, 7 LMS frontend routes, 3 ASSESSMENTS frontend routes); the `SubscriptionGate` extension routing `module:*` through `user_has_feature` for every principal; and the enforced/default matrix (LMS + ASSESSMENTS default-on enforced, CRM + OPERATIONS default-off not enforced).

## Test fixture state at end of this session

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

All module-entitlement functional verification ran as single rolled-back DO-block suites with JWT simulation via `set_config('request.jwt.claims', ...)`; zero residue, no committed entitlement rows for Test Corp. Set entitlement overrides via the CompanyDetail Modules tab (org) or the member Access tab (individuals/coaches) to test live.

## Documents this session leaves behind

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs (flat root, manual upload):

- build-queue.md (v141)
- architecture-reference.md (v135)
- session-133-to-134.md (this document)
