# BrainWise Session 132 to 133 Handoff

*Closeout of the white-label session. Opens the next session.*

## Where this session left off

The white-label track (build-queue item 5) advanced end to end. Branding (5.1 backend, 5.2/A2 frontend) shipped and verified earlier in the session; tenant-isolation (5.3) was designed, the one real gap fixed, and the rest audited closed; and custom-domains (5.4) shipped backend and frontend, both verified. The "modularize and sell" module-entitlement model was scoped into its own design doc but not built. No Operations work. Three migrations landed: `whitelabel_5_1_org_branding_layer`, `whitelabel_5_3_bound_teams_team_members_to_org`, `whitelabel_5_4_org_custom_domains`. No edge functions were touched.

## Next session opening priorities, in order

### 1. Module-entitlement Phase 1 (public-schema modules)

Build the module-flag layer for Assessments and LMS. Lock the two open decisions first (see Open questions), then: add module flags (`lms_enabled`, and the vocabulary for the rest) to `subscription_tiers` + `corporate_contracts`, surface through `organization_features_view` mirroring `ai_chat_enabled`, and gate routes/nav (frontend) plus backend RPC/RLS deny. Backend-first, verify, then Lovable prompts. Scope doc: `module-entitlement-scope.md`.

### 2. Scope (and start) module Phase 2 / Phase 3

Phase 2 = per-org authored/imported LMS catalog (ties to SCORM import, item 6). Phase 3 = CRM/Operations externalization (the large arc). These are scope passes, not one-session builds.

### 3. Optional 5.3 tidy-ups (low priority)

Revoke `EXECUTE` from `authenticated`/`anon` on `log_super_admin_action`, `seat_count_used`, `seat_count_available`, `org_has_feature`. Not leaks; housekeeping only.

## Decisions locked this session (recap)

- The 5.1 brand resolver keys off the authenticated user's `organization_id`; the 5.4 resolver keys off the request hostname pre-auth (anonymous), a deliberately different shape.
- Tenant isolation is keyed on `users.organization_id` via `current_user_org_id()`, already enforced by RLS. The earlier "no uniform tenant key, retrofit everything" framing was wrong. 5.3 was therefore a one-policy fix plus an audit, not a migration arc.
- Custom domains: vanity (bring-your-own) domains are buildable now and manual per tenant; automatic per-org subdomains at scale need an external proxy (Cloudflare for SaaS or CloudFront + ACM), deferred.
- Module entitlement is orthogonal to tenant isolation. Assessments are already sellable at instrument granularity. CRM and Operations are super-admin-only internal tooling in `operations.*`; selling them externally is a separate large arc.
- Recommended module-flag mechanism: additive boolean flags on `subscription_tiers` + `corporate_contracts` resolved through `organization_features_view` (reuses the existing engine). LMS v1 = resell the BrainWise catalog behind a flag; per-org authoring is Phase 2.

## Open questions / things to lock next session

- Module-flag storage: additive columns on tiers/contracts (recommended for v1) versus a dedicated `org_modules` table (cleaner for non-assessment-only customers; revisit when CRM/Ops externalization is scoped).
- LMS catalog ownership for Phase 2 (resell-only vs per-org authored/imported).
- Whether to run the optional 5.3 tidy-up revokes.

## Bugs surfaced this session

- Found and FIXED in-session: the `teams` / `team_members` write policies granted any corporate/org admin cross-org read and write (role check without an org bound). Closed by `whitelabel_5_3_bound_teams_team_members_to_org` and verified by a rolled-back RLS functional test. Not carried forward.

## What's NOT in scope next session

- CRM / Operations externalization full build (Phase 3) is scope-only next session.
- Custom-domain scale automation / external proxy.
- Per-org LMS authoring (Phase 2 is design, not build, next session).

## Architecture additions this session

Recorded in `architecture-reference.md` v134. Summary: branding columns on `organizations` + public `org-branding` bucket + `get_org_branding_for_current_user` / `admin_set_org_branding` RPCs; the `teams`/`team_members` org-bound policy fix and the clarified `current_user_org_id()` tenant-key model; the `org_custom_domains` table + the pre-auth `get_org_branding_for_hostname` resolver (granted to `anon`) + `admin_set_org_custom_domain` / `admin_remove_org_custom_domain` RPCs; new action types `org_branding_set`, `org_custom_domain_set`, `org_custom_domain_removed`. New scope docs: `whitelabel-5_3-tenant-isolation-design.md`, `module-entitlement-scope.md`.

## Test fixture state at end of this session

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Test Corp has two org admins (one `company_admin`, one `org_admin`) and had zero `teams` rows at session start. The 5.3 and 5.4 functional tests created synthetic orgs/teams/domains entirely inside rolled-back transactions; no residue. No new branding or custom-domain rows were committed for Test Corp (set those via the Branding and Domains tabs to test live).

## Documents this session leaves behind

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs (flat root, manual upload):

- build-queue.md (v140)
- architecture-reference.md (v134)
- session-132-to-133.md (this document)
- whitelabel-5_3-tenant-isolation-design.md (updated with the step-1/step-2 execution record)
- module-entitlement-scope.md (new)
