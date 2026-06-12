# BrainWise Session 129 to 130 Handoff

## What shipped this session (super-admin organization management — backlog item 1, COMPLETE)

A single session focused entirely on backlog item 1. No Operations work. The super admin can now manage any organization cross-org from one consolidated `CompanyDetail` surface (tabs: Overview / Members / Departments / Invitations / Contract & Features), replacing the prior impersonation-only path.

### Backend (4 changes, all rolled-back DO-block tested, zero residue)

1. NEW `public.admin_assign_or_invite_org_admin(p_organization_id uuid, p_email text) RETURNS jsonb` — SECDEF, search_path public, `assert_super_admin`, REVOKE PUBLIC/anon + GRANT authenticated/service_role. Existing in-org corporate_employee|company_admin -> `admin_promote_to_org_admin` (transfer; demotes prior org_admin) + audit `org_admin_assigned` -> `{mode:'promoted'}`; existing org_admin -> `{already_org_admin}`; user in a different org -> 42501; brand-new email -> `{mode:'invite_needed'}` and creates NO invitation (frontend sends via invitation_send, single-sourcing the branded email).
2. `supervisor_dashboard_set` — added a `brainwise_super_admin` cross-org branch (was org-admin-own-org only and explicitly blocked super admins).
3. `invitation_send` EDGE FN **v22** (id e5d7f6b4-3554-4f4a-a202-7ac3109122b3, verify_jwt false preserved, boot-verified 401, deployed-source re-verified no drift): removed the hard `super_admin_session_id` requirement. Routing is now `useSessionAdminPath = isSuperAdmin && !!body.super_admin_session_id` -> session-bearing super admin uses `admin_invitation_create` (impersonation path preserved), everyone else incl. session-LESS super admin uses `invitation_create` (super-admin branch). This is what makes non-impersonation super-admin invites send a real branded email. account_type passes through (org_admin supported).
4. NEW `public.admin_invitation_revoke(p_invitation_id uuid) RETURNS jsonb` — SECDEF super-admin-only; hard-deletes a pending (`redeemed_at IS NULL`) invitation + audit `invitation_revoked`; guards not-found / already-redeemed (22023).

Notes: `super_admin_audit_log.action_type` is an FK to `super_admin_action_types` (a lookup, NOT a CHECK); registered `org_admin_invited` (now unused/harmless) and `invitation_revoked`. `bulk_invitation_create` super-admin branch verified end-to-end (created a row, rolled back); `bulk_invitation_send` needs no change. `corporate_invitations` has SELECT policies only (super-admin SELECT-all), plus a `redeemed_consistency` CHECK (redeemed_at + redeemed_by_user_id set together).

### Frontend (5 Lovable cycles, all GitHub-API-SHA-verified, Cole ran each manually)

Mirror source = `src/pages/admin/AdminUsers.tsx` (the org-admin people page). It only creates departments, invites, and does roster actions; it does NOT reassign existing-member departments or change roles, and `member_feature_override_set` lives on the platform Members drawer — so those were intentionally out of parity scope.

- C2 Members tab: NEW `src/components/super-admin/CompanyMembersSection.tsx` (SHA b153331c). Card A org-admin assign/transfer/invite; Card B roster (admin_org_users_view) + per-row supervisor/deactivate/reactivate + reconcile; Card C supervisor-dashboard Switch.
- C3 Invitations tab: NEW `CompanyInvitationsSection.tsx` (SHA bda31965). Single invite (role Member|company_admin), bulk invite (BulkInviteCard mirrors AdminUsers: XLSX, 75-row cap, bulk_invitation_send, failed-CSV), pending list + revoke.
- C4 Departments tab: NEW `CompanyDepartmentsSection.tsx` (SHA ee4fb53a). create / rename (surfaces 23505) / delete (0 members -> unassign; N>=1 -> RadioGroup reassign|unassign).
- All three wired into `CompanyDetail.tsx` (SHA 68aaeb9b); Overview reduced to the scoped banner (old Org-Admin card + Users table removed); ContractFeaturesSection untouched.
- C1 sidebar consolidation: `AppSidebar.tsx` (SHA ef9d4892) "Company Accounts"->"Organizations" + "Create Organization" entry removed; `CompanyAccounts.tsx` heading -> "Organizations" + a right-aligned "Create Organization" header button -> /super-admin/create-organization (route + page untouched); CompanyDetail back button -> "Back to Organizations".

House style: `(supabase.rpc as any)` / `(supabase as any)` casts; edge-fn fetch with VITE_SUPABASE_URL + Bearer session token + VITE_SUPABASE_PUBLISHABLE_KEY apikey; Radix Select "None" options use a non-empty `__none__` sentinel mapped to null.

## Edge fn / cron / webhook status

invitation_send v22; no other edge fn changed. No cron changes. No Operations work. ops-stripe-webhook / platform stripe-webhook never touched.

## Open items for next session

- Backlog item 2 (free +10 AI-chat enforcement) — Cole's decision: Phase A fixes enforcement for regular per-assessment purchasers FIRST (wire `one_time_chat_credits` into `check-ai-usage`), Phase B extends to coach-paid + super-admin-invited. Note: the +10 grant is currently inert for everyone and all 17 coaches get no AI chat; the fix is edge-function-bound.
- Backlog item 5 (white-label) — Cole's decision: build the full track. Greenfield: no branding columns anywhere, uneven tenancy (ops/CRM org-partitioned, core public schema not), no domain routing, global theming. Realistic ordering: branding-layer-on-organizations + session-time CSS-var injection, org-brand resolver, tenant-isolation hardening for the non-partitioned public schema, then custom domains.
- Backlog item 12 (lesson-block editor surfacing) — Option B; restate the A/B/C entry-point options at kickoff (the Session-128 transcript ended before they were captured).
- Backlog items 4, 6, 7, 8, 11 — untouched.
- Standing carryforwards: ai-chat v50 repo commit (Cole, manual, from Session 126); BQ-PTP-PERFECT-VERIFY (live guardrail test needs authenticated-app super-admin JWT); newsletter STATIC_ROUTES manual-edit reminder (surface on any newsletter/sitemap/SEO/new-marketing-page work); Doc-1 invoice live refund test (needs a real Stripe-paid invoice); §82 facet_interpretations {public}-role nit; Operations Docs 3/4/5 backlog.

## Reminders for whoever opens Session 130

- Backend-first, approval-gated; verify every apply_migration with a separate execute_sql; functional tests = single rolled-back DO block with a sentinel RAISE.
- All Lovable prompts run manually by Cole; verify each shipped file by GitHub API SHA (raw CDN can be stale, §117).
- GitHub MCP is read-only on both repos; Cole uploads the closeout markdown manually via the web UI.
- Closeout = markdown only (build-queue.md, architecture-reference.md, session-NN-to-MM.md); no docx.
