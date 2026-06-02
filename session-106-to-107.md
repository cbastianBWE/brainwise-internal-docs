# BrainWise Session 106 to 107 Handoff

*Closeout: Session 106. Open: Session 107.*

## Where Session 106 left off

Session 106 was a verification-and-cleanup session: test everything shipped in Session 105, then fix what testing surfaced. All Session 105 backend (feature flags, gating, credits, pricing) re-verified live and passed. The pricing "overcharge" I flagged early was a FALSE ALARM (stale code comments, not real charges — Cole had already corrected the Stripe price objects). Shipped this session: a DB-backed single source of truth for plan-description copy (new `plan_tiers` table + hook extension), the Story-2 marketing/pricing rework (PTP self-serve, NAI/AIRSA/HSS "contact us"), two real bug fixes (results-page Ask-AI ignored credits; out-of-credits showed false "monthly limit/upgrade" copy to non-subscribers → check-ai-usage v50), and the super-admin consolidation Phase A (override into Members drawer + Features page renamed) and Phase B (per-coach actions into drawer, coaches page slimmed to "Coach Invitations"). The full credit path was tested end to end on a real test user.

## Session 107 opening priorities, in order

### 1. Repo commit of check-ai-usage v50 + stripe-webhook v29 (carryover)

Both were deployed via Supabase MCP but the GitHub repo copies are stale (runtime↔repo drift). Sources are provided in the Session 106 closeout bundle (`edge-functions-for-repo/`). Paste into the repo via GitHub web UI:
- `supabase/functions/check-ai-usage/index.ts` (v50 — adds explicit `subscription_active` on all individual-branch responses)
- `supabase/functions/stripe-webhook/index.ts` (v29 — +10 credit grant in the payment branch; carried over from Session 105, still not committed)

This closes the §92 stripe-webhook drift that has been open since Session 105.

### 2. Anything Cole wants tested from the Session 106 frontend prompts

All 106 Lovable work was type-checked and spot-verified, and the key paths (pricing cards, credit gate, out-of-credits card, drawer Access tab, drawer certify write) were confirmed live. No known-failing surfaces remain. If a full regression sweep is desired, the highest-value re-checks are: the marketing pricing page logged-out (plan_tiers anon read) and the corp member's drawer hiding the Access tab.

### 3. Resume the Session 105 carryforward backlog

In rough priority: NAI/AIRSA PDF rebuilds; narrative regeneration on score changes; interpretation row consolidation; pre-export readiness check for PTP; BUG-NWS-1 (newsletter attachment-send hang) + Group H formal closure; the PTP narrative fan-out carryforwards (BQ-NARRATIVE-FANOUT-STATUS, BQ-FANOUT-COLDFAIL, BQ-PDF-EXPORT-COLDCACHE).

## Decisions locked in Session 106 (recap)

- Plan-description copy is DB-sourced via `plan_tiers`; `lib/stripe.ts` PLANS arrays remain only as a correct fallback.
- `plan_tiers.ai_coaching_limit` / `one_time_credit_grant` are DISPLAY-ONLY; enforcement stays in check-ai-usage (200/400) and stripe-webhook (+10). Changing an enforced number means editing BOTH the Edge Function and the display mirror.
- Story 2 for instruments: PTP is self-serve; NAI/AIRSA/HSS are "available through a consultation" (Contact us), NOT "coming soon."
- Premium is framed AI-coaching-led (400 vs 200); advertising in-development interactive resources / coach-on-your-shoulder is acceptable since there are no active subs yet.
- Out-of-chat ALWAYS steers to Upgrade to Premium across all surfaces (not "buy another assessment").
- Super-admin consolidation = Option B: per-entity actions go on the entity's drawer; population-level coach-invite tooling keeps its own page (renamed "Coach Invitations"). No `/super-admin/coaches` redirect.

## Open questions / things to lock in Session 107

None blocking. One minor item logged: the "Coach Invitations" page's dialog secondary line and the MyResults Ask-AI upgrade-dialog "Base plan also includes AI chat" line slightly undercut the always-Premium push — cosmetic, left as-is unless Cole wants them tightened.

## Bugs surfaced in Session 106 added to Build Queue

- BUG (FIXED): results-page Ask-AI bubble gated on subscription only, blocked credit-holding non-subscribers. Fixed in MyResults.tsx (canUseChat = hasActiveAccess || credit_balance>0).
- BUG (FIXED): out-of-credits non-subscribers saw a false "used all 200 monthly messages / resets [date] / Upgrade" card because FREE_TIER_DENIAL omitted subscription_active. Fixed in check-ai-usage v50 + LimitReached non-subscriber branch.
- BUG (FIXED): MemberDrawer "Access" tab rendered but wouldn't activate — parent super-admin/Members.tsx had its own TabId/VALID_TABS missing "access", coercing the click back to "learning". Fixed.

## What's NOT in scope for Session 107

- Full super-admin page consolidation beyond Phase A/B (the remaining ~12 super-admin pages were inventoried but no further merges are planned).
- Moving coach invite tooling into Members (explicitly decided against — Option B).
- NAI/AIRSA PDF rebuilds unless Cole prioritizes them.

## Architecture additions in Session 106

- NEW table `plan_tiers` (per-tier plan copy + display-only limit mirrors). RLS: public read {anon,authenticated}, service_role write. Recorded in architecture-reference v108.
- `useSubscriptionPlans` hook extended with `featuresFor(tier)` + `limitsFor(tier)` (additive).
- NEW component `src/components/members/MemberDrawerAccess.tsx` (per-individual feature override, gated non-corp).
- check-ai-usage v49→v50: `subscription_active` explicit on all individual-branch responses.
- MemberDrawerCoach.tsx gained Mark Certified + View PTP Report actions.
- PlatformFeatures.tsx trimmed to platform-wide flags only ("Global Features & Settings"); CoachManagement.tsx slimmed to invites-only ("Coach Invitations").

## Test fixture state at end of Session 106

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Credit-path test fixture: the non-subscriber individual test user used for the credit test was left at 0 one-time chat credits; the session-106 test grant ledger row was deleted. The `ai_usage` row (3 chat_message this month) was left as real usage. That user's `subscription_tier` is a stale 'base' with status 'inactive' (harmless — check-ai-usage gates on status, not tier).

Coach certify test: a coach account owned by Cole was marked certified via the drawer to verify the write, then REVERTED to in_progress (certified_at/certified_by nulled). No lingering state.

Pre-existing stray row noted (not created this session, left as-is): one deidentified corporate_employee has a PTP individual feature-override row dated 2026-04-19, predating the corp-reject guard. Harmless (corp visibility is contract-driven).

## Documents this session leaves behind

- BrainWise_Build_Queue_v114.docx (uploaded to project knowledge)
- BrainWise_System_Architecture_Reference_v108.docx (uploaded to project knowledge)
- BrainWise_Session_106_to_107_Handoff.docx (this document, uploaded to project knowledge)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs. Edge-function sources for the repo commit are in the closeout bundle under `edge-functions-for-repo/`.
