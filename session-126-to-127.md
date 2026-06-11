# Session 126 to 127 Handoff

## What Session 126 did

Built "share PTP results by email" (build-queue Item 2c) end to end, backend and frontend, all verified as far as MCP can take it. No Operations work. No new standing rule.

Important correction: build-queue v132/v133 described Item 2c as a "backend tokenized link." That was wrong and is corrected in v134. 2c shipped as account-to-account directed sharing, not a tokenized public link.

Item 2a (PTP report persistent highlighting) was deferred to Session 127 by Cole's call at the end of the session.

## Feature shape (Cole-approved)

A logged-in owner shares their entire PTP with another existing account-holder by email. The system reports whether an account exists for that email (yes: share granted; no: "no account exists with that email"). A durable grant is created and the recipient gets an in-app notification (not a link email). The recipient sees a new "Shared With Me" sidebar surface, distinct from the existing org-peer /shared-results, opens the sharer's full PTP report, and can pull both the shared results and their own into the AI chat for a combined dialogue. Cross-organization: any account-holder can share with any other, unlike the org-bounded peer sharing.

Locked decisions: a new dedicated grant table (not a reuse of peer_access_requests); the whole PTP across all four report tables; one-directional owner-initiated grants; durable until revoked (soft-revoke, the row is retained as an audit trail); the AI-chat combine is in v1. The email yes/no check is an accepted SOC 2 tradeoff: the enumeration vector is authenticated, attributable, and membership-only, and is backstopped by a server-side rate-limit plus a share/revoke audit log.

## Backend (svprhtzawnbzmumxnhsq) - COMPLETE + VERIFIED

Two migrations, each apply_migration followed by a separate execute_sql verify, plus the ai-chat Edge Function change:

- ptp_share_01_table_helper_rls_disjuncts: public.ptp_result_shares (owner_user_id / viewer_user_id FK users CASCADE, revoked_at NULL soft-revoke, CHECK owner<>viewer, partial unique uq_prs_active on the active pair, two indexes). RLS: owner FOR ALL, viewer FOR SELECT, service_role FOR ALL. Helper direct_ptp_share_visible(owner, viewer) (SQL STABLE SECDEF search_path '', RLS-facing so it keeps the authenticated grant). Four additive SELECT disjuncts on assessment_results, assessments, assessment_responses, facet_interpretations, all INST-001-scoped and routed through the helper, so a shared PTP is readable by the same RLS surface the owner sees (PTP only; NAI/AIRSA/HSS are not shared).
- ptp_share_02_rpcs_attempts_notification: public.ptp_share_attempts (internal rate-limit log, service_role-only + REVOKE ALL FROM authenticated,anon per §157). Catalog row 'ptp_results_shared' (category 'sharing', in_app, user_configurable, is_v1_active) + a notification_display case (preserves all prior cases). Four SECDEF RPCs: share_ptp_results(p_target_email), revoke_ptp_share(p_viewer_user_id), list_my_ptp_shares(), list_ptp_shared_with_me(). The share RPC handles the rate-limit (>=10/min raises 'rate_limited' 53400), the found:false / self / already_shared / shared branches, and the recipient notification.

Functional tests passed (rolled-back DO blocks, sentinel RAISE, zero residue). The raw-RLS disjunct test forced RLS via set_config request.jwt.claims + SET LOCAL ROLE authenticated; the RPC test used set_config only. NOTIFY pgrst run after the new tables.

ai-chat Edge Function: reconciled the deployed v49 against the repo (no drift). v49 read only the caller's own results and ignored peer_result_ids. Deployed v50 (ACTIVE, verify_jwt preserved FALSE): the own-results path is unchanged; a new shared-results path fetches peer_result_ids via the caller's RLS-scoped user client (access enforced by the new disjuncts, not trust), filters out the caller's own ids, labels blocks "Shared by {name}", and caps context at 12 results.

## Frontend - COMPLETE (3 cycles, all SHA-verified)

- C1 (commit 4314726): PrivacySettings.tsx "Share My PTP Results" card (hasPtp-gated, email input + share + revoke list).
- C2 (commit c17099e): new SharedWithMe.tsx page + /shared-with-me route (no SubscriptionGate) + "Shared With Me" (Inbox icon) in all five AppSidebar nav arrays after "My Development Plan". Right pane renders MyResults for the selected sharer.
- C3 (commit 3dd14f0): "Discuss with AI" button on SharedWithMe (navigates to /ai-chat?peers=<ownerId>&self=true); AiChat.tsx resolves a directly-shared owner's name in the selector via sharedWithMeMap.

Key finding (answers Cole's mid-session concern): isCoachView=true on the shared MyResults call is a third-party-viewer flag, not a coach-relationship gate. Verified by reading MyResults.tsx + PTPNarrativeSections.tsx. Its only effects on the PTP report are the isCoachLimited gate (needs permissionLevel='score_summary' to fire, which the share view never passes) and hiding the "Add to my Development Plan" button (correct for a viewer). No coach lookups run (no coachUserId), no coach-specific content is injected. permissionLevel='full_results' and defaultInstrumentId='INST-001' were not restored by Lovable on the shared MyResults call but are inert (only PTP is RLS-readable). This matches the existing org-peer SharedResults page, which already uses isCoachView for non-coach peers.

## Cole owes one manual step

Commit the deployed ai-chat v50 source (functions/ai-chat/index.ts) into cbastianBWE/brainwise-blueprint. GitHub MCP is read-only on that repo, so the runtime is one commit ahead until Cole pushes it (§92).

## Still open

- Item 2a: PTP report persistent highlighting (Session 127 priority; net-new, no existing highlight infra; the central risk is durable anchoring of AI-narrative text across React-rendered sections; open with an anchoring spike).
- BQ-PTP-PERFECT-VERIFY: live guardrail test through the authenticated app (needs a super-admin user JWT that cannot be minted from MCP). The same JWT limitation means a live end-to-end run of the 2c AI-chat combine is also deferred to the app.
- Newsletter STATIC_ROUTES manual-edit reminder (surface whenever newsletter, sitemap, SEO, or a new public marketing page comes up). 2c had no sitemap impact: every surface is auth-gated.
- Doc-1 invoice live refund test (needs a real Stripe-paid invoice).
- Phase-10 owner-stamp frontend follow-up (before the first non-admin CRM user is invited).
- CRM Phase 9 (QA + Zoho import) / Phase 10 carryforwards.
- §82 nit: facet_interpretations "super admin can read all" SELECT policy has roles {public} instead of {authenticated}; account-type-scoped so not a blanket leak; for a future §82 pass.
- Longer Operations backlog: Docs 3 (QuickBooks), 4 (e-sign / BoldSign), 5 (cross-cutting).

## Session 127 opens on

Item 2a (PTP report persistent highlighting), backend-first, opening with an anchoring spike. Cole may re-pick from the open items above.

## Standing protocol reminders

Backend-first; apply_migration success is not DB-state confirmation, always follow with a separate execute_sql verify; multi-statement execute_sql returns only the last result; JWT-sim must be in the same execute_sql call as the RPC under test; raw-RLS tests also need SET LOCAL ROLE authenticated; functional tests are a single rolled-back DO block with a sentinel RAISE. §156 grant discipline (internal/service-role-only helpers REVOKE EXECUTE FROM authenticated; RLS-facing helpers keep it). §157 (internal secret-bearing tables REVOKE ALL FROM authenticated,anon). §92 (reconcile deployed vs repo; commit deployed Edge Function source back to the repo). GitHub MCP is read-only for both repos; all frontend changes go through Lovable prompts Cole runs, verified by GitHub API SHA (not raw CDN); full-file replacement is the most reliable shape for a large page Lovable has deviated on. No em-dashes. Close artifacts are markdown only (build-queue, architecture-reference, the session handoff); no docx (Session-74 decision).
