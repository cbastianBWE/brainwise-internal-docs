# Pattern C: Super Admin Acts as Coach — Standalone Session Scope

*Locked Session 72. Standalone one-off session, not part of Group X/Y/Z/V/W arc.*

## What this is

Super admin needs to function as a coach: have their own client list, order assessments for clients, view client results, manage their own coach profile and invoices — all the same actions any other coach can take, but done as a super admin user.

Cole's example use case: "I need to send out an assessment invite today" — a super admin acting as a real practitioner with a real client, not impersonating an existing coach.

## What this is NOT

**Pattern B (impersonation)** — super admin temporarily acts AS an existing coach via the existing `is_impersonating()` infrastructure. Pattern B's audit shows "super admin acting as coach X." Cole rejected this in favor of Pattern C.

**Pattern A (read-only views)** — super admin sees coach pages but actions are disabled. Useful for support, not for the use case Cole described.

## The architectural decision

The `account_type` enum is mutually exclusive today: a user is exactly one of `individual / coach / corporate_employee / company_admin / org_admin / brainwise_super_admin`. Super admin is NOT a coach today.

Three implementation options for Pattern C:

### Option C1: Inline `account_type='coach' OR account_type='brainwise_super_admin'`

Update every RLS policy + every frontend hook that gates on `account_type='coach'` to also accept `brainwise_super_admin`. The change is mechanical but touches 8 RLS policies + ~12 frontend files + ~6 RPCs.

**Pros**: Smallest code footprint. No schema change. Audit trail naturally shows super admin in coach actions.

**Cons**: Mixes two distinct concepts (super admin AS role vs. super admin AS coach). Every super admin always-and-implicitly gets coach affordances. If you ever hire multiple super admins, ALL of them get coach surfaces whether they want them or not. Inflexible.

### Option C2: Separate `users.is_practitioner_coach` boolean column

Add a boolean column `users.is_practitioner_coach` (default false). Coach users get it = true at creation (via migration backfill). Super admins can also have it = true if they're functionally a coach (Cole flips his own to true post-launch). Every RLS policy and frontend check gates on `is_practitioner_coach = true` instead of (or in addition to) `account_type = 'coach'`.

**Pros**: Decouples "what is your account type" from "do you provide coaching services." Future-proof: if you hire a second super admin who is NOT a coach, they don't get coach affordances. Cleaner semantic.

**Cons**: Schema migration + every coach-gated RLS policy and RPC rewrite + every frontend `isCoach` check rewrite. More work upfront. Backfill needs to set all existing coaches to true. The `account_type='coach'` checks need a decision: keep them parallel or fully replace them.

### Option C3: Create a real `account_type='coach'` user with super admin's email (parallel account)

Cole creates a second login `cbastian+coach@brainwiseenterprises.com` with `account_type='coach'`. Uses that account to do coach things. Uses the super admin account for super admin things. Never the two shall meet.

**Pros**: Zero code change.

**Cons**: Two logins. Two sets of credentials. Switching accounts every time. The actions are audited as the coach account, not Cole personally as super admin. Defeats the natural unification Cole wants.

## Recommendation

**Option C2 (separate boolean column).** Reasoning:

- One-time implementation cost slightly higher than C1, but the semantic is right. "Account type" answers "what role does this user have on the platform"; "is_practitioner_coach" answers "does this user provide coaching services." Two different questions, two different columns.
- Future super admin hires are not auto-coached.
- The migration is straightforward: add column, backfill existing coaches to true, update RLS policies and frontend checks systematically.
- Existing coach users continue working with no behavior change — their `is_practitioner_coach` flips to true via backfill before any policy change ships, so they never experience a window where they lose coach access.

## Implementation scope (Option C2 specifics)

### Backend changes

**Migration 1 — Schema and backfill**:
```sql
ALTER TABLE public.users
  ADD COLUMN is_practitioner_coach boolean NOT NULL DEFAULT false;

CREATE INDEX idx_users_is_practitioner_coach
  ON public.users(is_practitioner_coach)
  WHERE is_practitioner_coach = true;

-- Backfill: every existing coach user gets the flag
UPDATE public.users
  SET is_practitioner_coach = true
  WHERE account_type = 'coach';
```

**Migration 2 — RLS policy updates (8 policies, all SELECT or INSERT, none cascade)**:

The 8 affected policies, all reading `account_type = 'coach'` in their `EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND account_type='coach')` subqueries, get rewritten to read `is_practitioner_coach = true`:

1. `users.users: coaches can read their clients`
2. `assessments.assessments: coaches read client assessments`
3. `assessment_responses.assessment_responses: coaches read client responses`
4. `assessment_results.assessment_results: coaches read client results`
5. `assessment_acknowledgments.acks: coaches read client acks`
6. `facet_interpretations.facet_interpretations: coaches read client interpretations`
7. `cafes_ptp_mapping.Coaches and admins can read cafes_ptp_mapping`
8. `coach_disclosure_acceptances.coach_disc_acc: coach inserts own`

Each policy: DROP + CREATE with `is_practitioner_coach = true` in the EXISTS subquery. §82 discipline applies — every recreated policy declares `TO authenticated` explicitly.

**Migration 3 — RPC updates**:

Find every SECURITY DEFINER RPC that checks `account_type = 'coach'` for caller authorization. Likely candidates (need to enumerate):
- `assign_curriculum_directly` (coaches can assign their clients)
- `enroll_user_in_certification_path` (coaches can enroll their clients)
- `order_assessment` / `create_assessment_order` (coaches order assessments)
- Any `coach_clients` write paths
- Any `coach_pending_bulk_batches` paths

Each: update the gate from `account_type = 'coach'` to `is_practitioner_coach = true OR account_type = 'brainwise_super_admin'` (super admin already has separate gating logic — the OR keeps existing super-admin-only paths working).

Run before the session:
```sql
-- Enumerate RPCs gating on coach role
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND prosrc ILIKE '%account_type%coach%';
```

Update each in a single migration: `phase73_pattern_c_coach_rpc_role_check_updates`.

### Frontend changes

**`src/lib/accountRoles.ts`** — extend `AccountRoleInfo`:
```ts
export interface AccountRoleInfo {
  // existing fields...
  isPractitionerCoach: boolean;   // NEW — coach-actions affordances
}

// In useAccountRole():
const isPractitionerCoach = profile?.is_practitioner_coach === true;
```

**Decision point**: should `isCoach` remain literal (`account_type === 'coach'`) or become `isPractitionerCoach`? Recommendation: keep `isCoach` literal (it answers "is this user's primary account type coach"); add `isPractitionerCoach` separately. Frontend code that gates on coach AFFORDANCES (sidebar entries, page guards, button visibility) reads `isPractitionerCoach`. Code that branches on PRIMARY ACCOUNT TYPE (e.g., signup flows, billing flows) reads `isCoach`. Most existing usages should migrate to `isPractitionerCoach`.

**Route guards**: `<RoleGuard allowedRoles={["coach"]}>` is the wrong gate for Pattern C. Change to `<PractitionerCoachGuard>` (new component) that checks `isPractitionerCoach`. Affected routes (~6):
- `/coach/clients`
- `/coach/order-assessment`
- `/coach/client-results`
- `/coach/invoices`
- `/coach/profile`
- `/coach/certification`

**Sidebar**: `coachNav` in `AppSidebar.tsx` only renders when the user is a coach. Pattern C requires the same nav (or a subset) to render when the user is super admin AND `is_practitioner_coach = true`. Sidebar logic: render `coachNav` when `isPractitionerCoach` regardless of `account_type`.

**`useAuth` profile fetch**: ensure `is_practitioner_coach` is selected when fetching the user profile, exposed on the profile object. Single change to the profile query.

### Audit and notifications

Coach actions taken by super admin should be audited as super admin actions (Cole did them as Cole the super admin, not "Cole as a coach"). Existing super admin audit log entries already carry caller_id — actions stay attributable to the super admin user. No special audit handling needed.

Email notifications to clients (assessment invites, results released, etc.) include "from coach: <name>" — that's fine, the super admin's name appears as the coach name on the invite. If the platform branding requires a distinction ("from BrainWise" vs "from <coach name>"), revisit per-notification template.

### Stripe billing

Coaches have payout / invoice flows via Stripe (`coach_invoices`, `coach_pending_bulk_batches`). Pattern C super admin would need to decide:

- Do super admin's "coaching" assessments charge real cards and pay out to a real coach Stripe account?
- Or are they comp'd / internal use, with no Stripe flow?

**Recommendation**: super admin's coach actions are comp'd / no Stripe charge in the v1 implementation. Add a code path in the `order_assessment` flow: if `caller.account_type = 'brainwise_super_admin'`, skip Stripe checkout, mark order as comp'd. Audit trail captures the comp'ing.

If Cole later starts coaching real paying clients as super admin, that's a separate scope conversation. v1 ships with the comp path.

### Testing checklist (one fixture set)

1. Verify existing real coach (testcoach2 in the test corp) still has full access to all coach pages and RPCs (regression).
2. Cole flips own `is_practitioner_coach = true` (one UPDATE).
3. Cole logs into super admin account, visits `/coach/clients` — should be reachable, should show empty client list initially.
4. Cole adds a test client via the new flow, sends assessment invite (PTP or other), invite arrives at test email.
5. Test client takes assessment, completes.
6. Cole as super admin views client results at `/coach/client-results/<assessment_id>` — should be visible.
7. Cole flips own `is_practitioner_coach = false` (rollback). All coach pages should become unreachable. Real coach unaffected.

### Estimated scope

- Backend: 2-3 migrations (schema + RLS + RPC updates). Probably 4-6 hours for careful work.
- Frontend: ~12-15 files touched. One Lovable prompt, 600-800 lines. Probably 2-3 hours for careful work + verify cycle.
- Total: one focused session, similar magnitude to a Group X / Y / Z prompt arc.

### Critical considerations

**Sequencing**: backend before frontend. Migrations land + verify. Then Lovable prompt. Then Cole flips his own boolean + tests.

**Backward compatibility**: existing coach users continue to function throughout. The migration backfills them BEFORE any RLS policy change touches the column, so there's no window of broken access. The frontend uses both `isCoach` (existing) and `isPractitionerCoach` (new) — old code paths keep working until they get migrated.

**Cohabitation with future coach hire flows**: when a new coach signs up via the standard coach signup flow, the trigger or RPC that creates the `users` row sets `is_practitioner_coach = true` automatically (their `account_type = 'coach'`). Need to ensure this is wired in the user creation path — check `handle_new_user` trigger or similar.

**No multi-coach personality**: super admin with `is_practitioner_coach = true` has ONE coach identity (their super admin user). They can't have multiple coach personae. If Cole later needs that (multiple practitioner brands), revisit then.

## Documents to consult before opening this session

- `architecture-reference.md` v75+ (current state)
- `build-queue.md` v79+ (current state)
- `src/lib/accountRoles.ts` (current role determination logic)
- `src/components/RoleGuard.tsx` (current route guard pattern)
- `src/components/SubscriptionGate.tsx` (the wrapper that needs to handle super admin in coach role context too)
- Pull all 8 affected RLS policy definitions via `pg_policies` to confirm exact subquery shapes
- Enumerate coach-gating RPCs via the SQL query in Migration 3 above

## What to lock at session open

1. Confirm Option C2 (separate boolean column) over C1 (inline OR clause) — recommendation locked but worth re-confirming
2. Decide: does `isCoach` remain literal in frontend hook or become `isPractitionerCoach`? Recommendation: keep both
3. Decide: should the route guards stay as-is with widened allowedRoles, or get a dedicated `<PractitionerCoachGuard>`? Recommendation: dedicated guard for semantic clarity
4. Decide: Stripe comp path for super admin coach orders — recommendation locked above, confirm
5. Re-confirm Cole is the only super admin who needs coach affordances at launch (or are there multiple super admins who all need it?)
