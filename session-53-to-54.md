# BrainWise Session 53 to 54 Handoff

*Closeout: Session 53. Open: Session 54.*

## Where Session 53 left off

Group A Phase C (super admin impersonation) and Phase D (user-facing access history) both shipped end-to-end and verified live. Six manual integration tests all passed: post-login redirect to /super-admin/users, kebab-dropdown action menu, justification modal with embedded MFA, active impersonation banner with chrome and exit flow, ProtectedRoute gate-redirect during impersonation, act-mode denylist on identity_change with friendly error toast, RLS WITH CHECK on user_demographics blocks writes from impersonated sessions, self-impersonation prevention at UX layer, Access History page renders 36 events with CSV export. Eight mid-session backend hotfixes shipped to fix issues surfaced by testing. Group A Phase C is architecturally complete; A2 (direct user editing) and A3 Phase 3 (super admin audit reporting UI) remain open but explicitly deferred behind Group C.

Session 54 opens Group C — Coach Certification + Resources / Learning Paths. This is the largest workstream by surface area and the most foundational for go-to-market.

## Session 54 opening priorities, in order

### 1. Read both scope documents in project knowledge before any work

- `BrainWise_Group_C_Scope_Coach_Certification_v1.docx` — locked at Session 34, defines 13 foundational decisions (Q1-Q13), 17 tables, 10 build phases
- `BrainWise_Group_A_Scope_Super_Admin_Core_v1.docx` — for cross-reference; A2 Tier 2 super admin direct enrollment (Q4B in Group C) is shared infrastructure between the two groups

Cole's intent confirmed at Session 53 close: Group C ships first, then the residual Group A super admin assignment + completion-tracking work for curricula/modules/content items follows immediately. The good news is Group C Phase 4 (authoring UI) already includes the super admin curriculum/module/cert path management portal at `/super-admin/learning`, including direct curriculum assignment, mentor assignment, and cert path enrollment. So most of what Cole wants on the super admin side gets built as part of Group C Phase 4 if Option A (full UI) is chosen.

### 2. Phase 1: Schema (backend-only, no Lovable)

Per Group C scope §5 Phase 1: 17 tables (15 new, 2 extended), all RLS policies, indexes for common access patterns, seed data for notification types catalog. Verified entirely via SQL.

The 17 tables enumerated in Group C scope §4:

NEW tables: certification_paths, curricula, certification_path_curricula, modules, curriculum_modules, content_items, quiz_questions, quiz_answer_options, user_curriculum_assignments, content_item_completions, quiz_attempts, written_submissions, coach_mentor_assignments, cohorts (seam), cohort_members (seam), user_notification_preferences, user_notifications.

EXTENDS: coach_certifications (add `revoked` to status enum, add post_certification_benefit_applied_at, certified_at), resources (add category field).

Acceptance: all tables exist, RLS verified by impersonated select tests, foreign key integrity checks pass.

Critical SQL discipline reminders:
- `apply_migration` reports success without confirming DB state — always follow with `execute_sql` verification
- `pg_get_constraintdef` for CHECK constraints, never trust `information_schema.columns` alone
- Multi-statement `execute_sql` returns only the last result — split intermediate verification
- Schema case-sensitivity locked: lowercase for assessments.rater_type, capitalized for items.rater_type

### 3. Phase 2: Core RPCs

Per Group C scope §5 Phase 2: 9 RPCs covering trainee progress, item submissions, mentor reviews, certification grant/revocation, mentor assignment, curriculum assignment.

Key RPCs to build:
- get_user_learning_state(user_id)
- submit_quiz_attempt(content_item_id, answers)
- submit_written_summary(content_item_id, content)
- mentor_review_submission(submission_id, decision, comments)
- mark_skills_practice_signoff(content_item_id, signoff_type)
- grant_certification(certification_id) — fires post_certification_benefit hook (no-op in v1 per Q13)
- revoke_certification(certification_id, reason) — Tier 2 super admin action per Q9
- assign_mentor(trainee_user_id, mentor_user_id, certification_id)
- assign_curriculum_directly(user_id, curriculum_id, source) — supports the three-source assignment model from Q1

Each RPC must be tested via SQL impersonation pattern with positive case, RLS denial case, and edge cases (already complete, already certified, etc.).

### 4. Phase 3: Notifications subsystem

Per Group C scope §5 Phase 3: foundational platform subsystem, not Group C-specific. Group C is the first heavy consumer.

Build:
- notify_user(p_user_id, p_notification_type, p_payload) RPC consults preferences, fans out to email + in_app
- 14 notification types catalog (see Group C scope Appendix A)
- Default preferences seeded for all existing users
- Email channel via existing send-email Edge Function
- In-app channel via user_notifications insert

Risk note from scope §8.1: "if the subsystem has bugs, every subsequent phase inherits them." Phase 3 ends with a thorough impersonation-based test pass for all 14 notification types before Phase 4 starts.

### 5. Phase 4 decision: Option A vs Option C

Decided at session start based on PTP launch timeline. Not at build time mid-phase.

- Option A — full authoring UI in /super-admin/learning. ~2-3x frontend work of Option C. This is what Cole wants for the "super admin can set up, assign, and view completion" requirement.
- Option C — hybrid; SQL seed for content, basic assignment UI only. Ships content baked-in for launch, full UI added later.

Recommendation: Option A unless the PTP launch window is tight enough that schedule risk dominates. Cole's stated preference is the full super admin tooling, which is Option A.

If Option A: Phase 4 covers cert path editor, curriculum editor, module editor, content item editor (polymorphic by type), quiz authoring, mentor assignment UI, direct curriculum assignment UI.

### 6. Phases 5-10 sequence per Group C scope

After Phase 4, the remaining phases ship in order: 5 (trainee learning UI), 6 (mentor review UI), 7 (actor flow with allotment), 8 (Order Assessment gating), 9 (Resources tab redesign), 10 (polish + accessibility + brand pass).

## Decisions locked in Session 53 (recap)

- Group A Phase C complete: impersonation lives at /super-admin/users, banner + chrome render via ImpersonationProvider session detection, custom_access_token_hook stamps imp_* claims for fresh otp/magiclink mints (60s freshness gate prevents stranded-session contamination), token_refresh preserves existing imp claims (never creates them), restore-on-exit mints fresh super admin tokens via generateLink+verifyOtp
- Identity-mutation Edge Function gate is the single chokepoint for all auth API mutations (update_password, update_email, mfa_enroll, mfa_unenroll); 403 IMPERSONATION_DENIED surfaces as friendly toast: "This action is blocked while impersonating. Identity changes (email, password, MFA) are not permitted during impersonation, even in act mode."
- user_demographics RLS WITH CHECK blocks INSERT/UPDATE/DELETE during any impersonation context (observe OR act); SELECT remains permitted for legitimate observation
- ProtectedRoute redirects /onboarding, /demographic-form, /demographic-consent, /peer-sharing-optin, /mfa-enrollment to /dashboard during impersonation; /departed intentionally NOT in this list (legitimate observation surface)
- search_impersonation_targets RPC paginated, multi-field search (email + full_name + organization_name), default-loads all users when no query, COALESCEs account_type to 'unknown', includes self in results (UX layer prevents self-impersonation)
- check_mfa_freshness reads BOTH auth.mfa_amr_claims AND auth.mfa_challenges.verified_at — bridges the Supabase-platform gap where re-verifying MFA on already-aal2 sessions doesn't write a new amr_claims row
- log_super_admin_action skips the impersonation: prefix on lifecycle events (impersonation_started, impersonation_ended, impersonation_denied_action) so started/ended pairs have matching mode column for grouping
- Super admin landing redirect changed from /super-admin/health to /super-admin/users
- Group C decisions Q1-Q13 remain locked from Session 34; Group C scope doc is authoritative

## Open questions / things to lock in Session 54

- **Phase 4 Option A vs Option C** — must be decided at Session 54 start, not deferred mid-build
- **Mentor compensation model** — outside Group C scope per scope §8.2; mentor identity and assignment exists but financial model is a separate decision; non-blocking for v1 ship
- **Multi-prerequisite curriculum DAG** — captured as v2; Session 54 ships single prerequisite_curriculum_id only

## Bugs surfaced in Session 53 added to Build Queue

- **BUG-S53-1 [LOW]**: AccessHistory.tsx frontend lacks null-guard on action_category in formatActionType. Backend defense added (RPC now COALESCEs to 'organization_admin_action' for company_admin source rows), but frontend should mirror Users.tsx null-guard pattern as defense in depth.
- **BUG-S53-2 [MEDIUM]**: users.account_type IS NULL state for 2 production users. Hotfix masks the symptom at search RPC layer (COALESCE to 'unknown'). Underlying schema permits a state no UX intentionally produces. Either backfill to 'individual' or constrain NOT NULL once data is clean.
- **BUG-S53-3 [LOW]**: SOC 2 audit log immutability prevents backfill of one cosmetic mode-column row from impersonation_ended history (`impersonation:observe:observe`). Acceptable historical artifact; new rows write clean values.
- **NICE-TO-HAVE-S53-1**: Frontend SIGNED_OUT listener that calls impersonation-end before JWT is destroyed. Belt-and-suspenders on top of the hook freshness gate. The 60s freshness gate already prevents stranded rows from polluting future logins; this would just clean up audit timeline faster.
- **POST-LAUNCH from earlier sessions, still open**: refactor current_user_mfa_satisfied from factor-existence to session-AAL check; replace hardcoded denylist text[] in assert_impersonation_allows with a SELECT against super_admin_denylist_categories table; audit other RLS-only direct-write tables (users self-update, user_subscription_preferences, user_results_consent) for impersonation gaps.

## What's NOT in scope for Session 54

- Group A Phase A2 (direct user editing across all account types/tiers) — ships AFTER Group C, alongside or right after Group C Phase 4 since they share the /super-admin portal surface
- Group A Phase A3 Phase 3 (super admin audit reporting UI at /super-admin/audit) — ships AFTER Group C
- Action-Oriented Voice Redesign across NAI/PTP surfaces — independent workstream, not blocked by Group C
- Coach billing tiers (Build Queue items 29, 30, 36) — explicitly deferred per Group C scope §7
- Coach profile page (Build Queue item 34) — adjacent, separate workstream
- Cohort UI — schema seam built in Phase 1; UI deferred to v2
- Live event infrastructure — v1 stub only with manual marking
- Public certification credentials, badges, leaderboards
- Continuing education / recertification / cert expiry — v2+
- Multi-language content support — v2+

## Architecture additions in Session 53

Recorded in architecture-reference.md §26.x. Summary:

- §26.1 impersonation-end v2: mints fresh super admin tokens via generateLink+verifyOtp; updates ended_at FIRST so custom_access_token_hook doesn't stamp imp_* on the new super admin token; returns { success, restored, super_admin_user_id, access_token, refresh_token, expires_at }
- §26.2 is_impersonating()/is_impersonating_act() helpers + user_demographics RLS WITH CHECK; SELECT permitted, INSERT/UPDATE/DELETE block during any impersonation
- §26.3 identity-mutation Edge Function: single chokepoint for update_password/update_email/mfa_enroll/mfa_unenroll; Class A explicit auth (verify_jwt=false; auth.getClaims inside); calls enforceImpersonationGate('identity_change')
- §26.4 ProtectedRoute partial reversal of §25.9 — gate-route redirects during impersonation
- §26.5 vestigial column finding: super_admin_action_types.denylist_during_impersonation never read
- §26.6 useMfaSatisfied semantics finding: factor-existence vs session-AAL
- §26.7 Hook freshness gate (Session 53 close): custom_access_token_hook now requires impersonation_sessions row created < 60s ago for otp/magiclink initial mints; for token_refresh requires existing imp_session_id in incoming JWT matching active row; prevents stranded-session contamination of normal user logins
- §26.8 check_mfa_freshness reads auth.mfa_challenges.verified_at as fallback when auth.mfa_amr_claims doesn't have a fresh row (Supabase doesn't write amr_claims on re-verify of already-aal2 session)
- §26.9 log_super_admin_action no double-prefix on lifecycle events
- §26.10 search_impersonation_targets paginated + multi-field + COALESCE account_type + includes self
- §26.11 my_access_history defaults action_category for company_admin source rows
- §26.12 identityMutation.ts helper centralizes parse-then-error pattern for friendly toasts on Edge Function 403s

Group A Phase C is architecturally complete. Phase D (Access History) shipped as part of Session 53 too. Remaining Group A work (A2, A3 Phase 3) ships after Group C.

## Test fixture state at end of Session 53

Test org: BrainWise Test Corp (`2633a225-e071-4a73-b0ad-09b46ec3025f`).

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee, hasDirectReports=true via supervisor_user_id chain)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Impersonation test fixtures used in Session 53:

- phildixon1@me.com (account_type=brainwise_super_admin)
- phildixon1@mac.com (account_type=individual, target_user_id `da250c18-a7b9-417e-b509-2d249bb54ce5`) — used as primary impersonation target
- Test users with NULL account_type (handled by COALESCE in RPC): test@test.com (is_internal_test=true), testclientbwe+testnewuser@gmail.com

No stranded impersonation_sessions at end of Session 53. Cron sweep (sweep_expired_impersonation_sessions) running every 5 min picks up any rows past 30-min expires_at. Hook freshness gate prevents stranded rows from contaminating subsequent logins.

orgmember has 36 audit events accumulated through Session 53 testing (30 super_admin source from cbastian record-views, 4 impersonation_started lifecycle events, 2 company_admin source). Phil Dixon (mac.com) has 11 events.

Phil's user_demographics row verified untouched after C-RLS test: gender_identity=Man, consent_withdrawn_at=null, all fields intact despite write attempts via /settings/privacy during act-mode impersonation. RLS WITH CHECK functioning as designed.

## Documents this session leaves behind

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs:
- build-queue.md (v45 → v46, Session 53 close)
- architecture-reference.md (v47 → v48, Session 53 close)
- session-handoffs/session-53-to-54.md (this document)

GitHub MCP is read-only — Cole uploads markdown manually via web UI drag-and-drop at session close.
