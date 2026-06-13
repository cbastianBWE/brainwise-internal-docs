# White-Label 5.3 — Tenant-Isolation Design

*Session 133. Design-first; no migration applied. Grounds the 5.3 sub-step of the white-label track (build-queue item 5).*

## 1. Purpose

Item 5 sub-step 3 was scoped from the Session-128 readout as "tenant-isolation hardening where the public schema is not org-partitioned." This doc replaces the assumption behind that scope with what the live database actually shows, then defines the real (much smaller) work.

## 2. Current posture (live recon, Session 133)

- **RLS is enabled on every public base table.** There is no unprotected table. The only table with zero policies is `chat_credit_grants` (intentional default-deny / service-role-only, from the Session-130 hardening).
- **The tenant key exists and RLS already uses it.** `users.organization_id` is the per-user tenant key. `current_user_org_id()` = `SELECT organization_id FROM users WHERE id = auth.uid()` (STABLE SECURITY DEFINER). The Session-128 "no uniform tenant key" conclusion was wrong.
- **Core per-user tables isolate by `user_id`** for owners (e.g. `assessments`, `assessment_results`, `content_item_completions`, `module_completions`, `lesson_block_progress`, `quiz_attempts`, `written_submissions`, `user_curriculum_assignments`, `user_module_assignments`, `development_plan_*`). Cross-user access is granted by additional relationship- or org-scoped policies.
- **Two cross-user access models coexist, by design:**
  - **Org-scoped:** corporate/org admins read members of their own org. These bound on `current_user_org_id()`.
  - **Relationship-scoped (intentionally cross-org):** coach reads clients (`coach_clients`), supervisor reads direct reports (`get_my_direct_reports()`), mentor reads trainees (`coach_mentor_assignments`), peer shares (`direct_ptp_share_visible`, `permissions`). A coach or mentor legitimately serves people across orgs, so these are not org-bounded and should not be.

## 3. Audit results (RLS layer)

Swept every policy in `public` whose predicate references `company_admin` or `org_admin` (the org-admin access paths). Findings:

- **Clean:** every org-admin SELECT on member or org data is bounded by `current_user_org_id()` (or an equivalent `organization_id = (users.organization_id of caller)` join). This includes `assessments`, `assessment_results` (further gated through the `permissions` consent table on `viewer_organization_id`), `users`, `ai_usage_counters`, `assessment_acknowledgments`, `member_feature_overrides`, `company_admin_audit_log`, `corporate_contracts`, `corporate_invitations`, `executive_perspective_assignments`, `organizations`, and all the `org_*` narrative/intervention/history tables. Tenant isolation on the PII surface is sound.
- **One real gap — `teams` / `team_members` write policies are not org-bounded:**
  - `team_members: corporate admins can delete` (DELETE) and `team_members: corporate admins can update` (UPDATE): `current_user_account_type() IN (company_admin, org_admin, brainwise_super_admin) OR team_id IN (manager's teams)`.
  - `teams: managers and corporate admins can insert and update` (ALL): `current_user_account_type() IN (company_admin, org_admin, brainwise_super_admin) OR manager_user_id = auth.uid()`.
  - Effect: a corporate/org admin of org A can insert/update/delete `teams` and `team_members` belonging to org B, because the role check is not joined to the caller's org. Low blast radius (teams are an internal grouping; no PII disclosure), but a genuine cross-tenant write hole.
  - Fix: add `AND (organization_id = current_user_org_id())` to the `teams` policy and an `EXISTS (... teams t WHERE t.id = team_members.team_id AND t.organization_id = current_user_org_id())` bound to the `team_members` write policies, preserving the existing `manager_user_id`/super-admin branches. Small, targeted migration; verify with a rolled-back functional test that an org-A admin cannot touch an org-B team and that the manager path still works.

## 4. Remaining audit scope (read-only, to finish before 5.3 sign-off)

The RLS-layer audit above is complete for org-admin policies. Two layers were not in scope of the policy sweep and must be checked the same way before declaring 5.3 done:

1. **Org-dashboard SECDEF RPCs and views.** The PTP/NAI/AIRSA company dashboards and org reports read member data through SECURITY DEFINER functions and views (e.g. `org_users_public`, `admin_org_users_view`, the `get_org_*` / dashboard readers), which run as definer and therefore must self-bound on `current_user_org_id()` internally rather than inheriting RLS. Each must be read and confirmed org-bounded.
2. **INSERT `WITH CHECK` clauses** on member-writable tables (the sweep inspected `USING`/`qual`; `WITH CHECK` governs inserts and was not pulled).

Neither is expected to be large; both are mechanical confirmations.

## 5. Structural finding for items 6/7 — attribution, not isolation

The core learning/assessment rows carry no `org_id` of their own; org affiliation is derived live from `users.organization_id`. This is correct for **access control** (RLS derives current affiliation, which is what access should reflect). It is wrong for **historical attribution**, because it is a moving pointer: if a learner changes orgs, their past attempts and completions silently re-attribute to the new org.

Items 6 and 7 (SCORM / external launch + the seat/attempt/completion tracking API) require **stable** per-tenant attribution: "which tenant launched this, and how many of their seats/attempts were consumed" must not change when a learner moves. Recommendation:

- **Stamp `org_id` (and the external launch / enrollment context id) onto the launch and attempt/completion records at creation time**, for records that originate from an org or external-launch context. This is an additive column populated at write time, not a partition of the whole schema.
- **Leave access-control derivation as-is** (`current_user_org_id()` via RLS), since that correctly tracks current affiliation.
- **Do not mass-backfill or RLS-partition the historical learning/assessment tables.** Access control already works; partitioning them buys nothing and risks live customer data.

This decision belongs to the items 6/7 design, but it is the dependency 5.3 was supposed to expose, so it is recorded here.

## 6. Proposed 5.3 work plan (minimal, design-first)

1. **Fix the `teams` / `team_members` cross-org write policies** (targeted migration; rolled-back functional test proving org-A admin cannot modify org-B teams and the manager path is intact).
2. **Complete the SECDEF-RPC + view org-bounding audit** (section 4; read-only; fix any unbounded reader found the same way).
3. **Defer org_id attribution stamping to the items 6/7 build** (section 5), where the launch/attempt model is designed.

Explicitly out of scope: a broad `org_id` retrofit plus RLS rewrite across the learning and assessment tables. The Session-128 framing of "the public schema is not org-partitioned, so harden it" is satisfied by the audit plus the `teams` fix. The schema does not need partitioning for tenant isolation; isolation is already enforced through `current_user_org_id()`.

## 7. Net

5.3 is small: one real policy fix (`teams`/`team_members`), one mechanical read-only audit pass (dashboard RPCs/views + insert checks), and one decision that actually lands in items 6/7 (stamp org_id for stable attribution). It is not a multi-session migration arc. That reframing is the main outcome of this design pass.
