# PTP Entitlement Model Design Spec — Personal / Professional Half-Then-Half (Session 71)

Status: DESIGN SPEC. No code written. This document is written so the implementing
session executes rather than re-designs. It is the detailed schema/RPC/trigger/frontend
design for Section 5 decision 14 and Section 10 item 6 of
`ptp-report-and-entitlement-scope.md`.

Supabase project ref: `svprhtzawnbzmumxnhsq`
Frontend repo: `cbastianBWE/brainwise-blueprint`, branch `main`

Sequencing note carried from the scope doc: decision 14 sequences this feature LAST,
after D1-D5, because the combined report reads off the entitlement model and Bug D
changes how the combined report is generated. This spec does not change that sequencing.
It exists so that when the feature is picked up, the design is already done.

---

## 1. WHAT THE RECON ACTUALLY FOUND (corrects an assumption in the scope doc)

The scope doc Section 6 framed the entitlement gap primarily around
`assessment_purchases` consumption. The full recon this session shows the blocking
mechanism for the originally-reported user (Edgar, `db586ec5-08f9-435c-89db-8e60d2240fe1`)
is NOT `assessment_purchases` at all.

Edgar's actual data state, verified this session:
- ONE `assessments` row: `f0be3170-59d0-4aa2-8bd8-f9911bb35a16`, `instrument_id`
  `INST-001`, `context_type` `professional`, `status` `completed`,
  `paired_assessment_id` NULL, `ordered_by_coach_id` NULL.
- ONE `coach_clients` row: `5ade7a72-3ce3-4bd5-a819-a04fdb07cf72`, `instrument_id`
  `02618e9a-d411-44cf-b316-fe368edeac03` (the PTP UUID), `invitation_status`
  `completed`, `assessment_id` `f0be3170-59d0-4aa2-8bd8-f9911bb35a16`,
  `coach_user_id` `cf3ccc21-a7e4-4b1b-bd77-b06c8add736e` (Cheryl Kish).
- ZERO `assessment_purchases` rows.

So Edgar's PTP entitlement came entirely through the `coach_clients` invitation path,
not through `assessment_purchases`. When his professional assessment completed, the
trigger `link_assessment_to_coach_client` flipped his `coach_clients` row from
`sent`/`opened` to `invitation_status = 'completed'` and stamped `assessment_id`.

That is the block. `InstrumentSelection.tsx` resolves coach-invited PTP access through
two queries against `coach_clients`, BOTH of which now exclude Edgar's row:
- The coach-paid query (lines 93-98) filters `.neq("invitation_status", "completed")`
  AND `.is("assessment_id", null)`. Edgar's row is `completed` with `assessment_id` set,
  so it is excluded — `coachPaidInstrumentIds` does not contain PTP for Edgar.
- The self-pay coach query (lines 103-108) filters
  `.in("invitation_status", ["sent","opened"])` AND `.is("assessment_id", null)`.
  Edgar's row is `completed`, so it is excluded — `selfPayCoachInstrumentIds` does not
  contain PTP for Edgar.

With both coach sets empty for PTP, and Edgar having no `assessment_purchases` row and
(per the original report) no active paid subscription, the PTP card falls through to the
final `else` branch and renders "Purchase to Access" (line 418). That is the bug Edgar
experiences.

Implication for the design: the half-then-half model has to be solved primarily in
`coach_clients` and in `InstrumentSelection.tsx`'s coach-invite resolution, and the
`link_assessment_to_coach_client` trigger. `assessment_purchases` consumption
(`consume_assessment_purchase`) is a SEPARATE entitlement path that also needs the same
half-then-half treatment for self-paid users — but it is not what is blocking Edgar.
Both paths are covered below.

---

## 2. CURRENT-STATE SOURCE (verified this session — full bodies)

### 2.1 `assessment_purchases` schema (full)

Columns: `id` uuid PK default `gen_random_uuid()`, `user_id` uuid NOT NULL FK
`users(id)` ON DELETE CASCADE, `instrument_id` text NOT NULL, `amount_paid` numeric
NOT NULL, `stripe_payment_intent_id` text, `stripe_session_id` text, `purchased_at`
timestamptz NOT NULL default `now()`, `consumed_by_assessment_id` uuid FK
`assessments(id)` ON DELETE SET NULL, `consumed_at` timestamptz, `refunded_at`
timestamptz, `stripe_refund_id` text, `refund_amount` numeric, `refund_failure_reason`
text, `refund_processed_by` uuid FK `users(id)`.

No CHECK constraints. No UNIQUE constraints. No triggers.

`instrument_id` is `text` and stores mixed forms — verified distinct values include
`02618e9a-d411-44cf-b316-fe368edeac03` (PTP UUID), `77d1290f-1daf-44e0-931f-b9b8ad185520`
(NAI UUID), `90216d9d-153c-4b7b-abe0-1d7845c9e6e0` (HSS UUID),
`abb62120-8cc8-435f-babc-dd6a27fbc235` (AIRSA UUID), and the comma-joined
`77d1290f-1daf-44e0-931f-b9b8ad185520,abb62120-8cc8-435f-babc-dd6a27fbc235`.

### 2.2 `assessments` schema (relevant columns)

Columns include: `id` uuid PK, `user_id` uuid NOT NULL, `instrument_id` text NOT NULL
FK `instruments(instrument_id)`, `rater_type` text NOT NULL CHECK `('self','manager')`,
`target_user_id` uuid, `status` text NOT NULL CHECK
`('in_progress','completed','abandoned','pending')`, `started_at` timestamptz NOT NULL,
`completed_at` timestamptz, `ordered_by_coach_id` uuid FK `users(id)`,
`instrument_version` text NOT NULL, `context_type` text NULLABLE,
`paired_assessment_id` uuid FK `assessments(id)` ON DELETE SET NULL, `reminder_count`
int NOT NULL, `last_reminder_sent_at` timestamptz, `self_only_released_at` timestamptz.

CRITICAL RECON FINDING: `paired_assessment_id` exists in the schema but is populated on
ZERO `INST-001` assessments. Verified: the only PTP `context_type` distribution is
`both` (62 completed + 2 in_progress, all `has_pair = false`), `personal` (1 completed,
no pair), `professional` (2 completed, no pair), and NULL (2 in_progress). The
two-attempts test user `b278bb3f-1860-4fad-a47a-ecc177457862`'s personal and
professional assessments are NOT linked via `paired_assessment_id`. The column is
unused dead schema today. This spec proposes USING it (see Section 4) rather than adding
a new linking column.

`context_type` values seen on `INST-001`: `both`, `personal`, `professional`, NULL.
There is no CHECK constraint on `context_type`.

### 2.3 `coach_clients` schema (from scope doc Section 6, confirmed)

Columns include `id`, `coach_user_id` (NOT NULL), `client_user_id` (nullable),
`client_email` (NOT NULL), `invitation_status` (NOT NULL), `assessment_id` (nullable,
FK `assessments(id)`), `coach_notes`, `created_at`, `instrument_id` (nullable, FK
`instruments(id)` — the UUID-form id), `stripe_payment_intent_id`, `stripe_coupon_id`,
`coupon_amount`, `coupon_expires_at`, `coupon_redeemed` (NOT NULL), `results_released`
(NOT NULL), `debrief_completed` (NOT NULL), `expires_at`, `revoked_at`,
`invitation_source` (NOT NULL), `client_first_name`, `client_last_name`, `refunded_at`,
`stripe_refund_id`, `refund_amount`, `refund_failure_reason`.

CHECK constraints: `invitation_status` allows `sent` / `opened` / `completed` only.
`invitation_source` allows `single` / `bulk` / `shareable_link`.

No context column. No triggers on the table.

### 2.4 `consume_assessment_purchase` (full body, verified this session)

```
CREATE OR REPLACE FUNCTION public.consume_assessment_purchase(p_user_id uuid, p_instrument_short_name text, p_assessment_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_instrument_codes TEXT[];
  v_purchase_id UUID;
BEGIN
  v_instrument_codes := CASE p_instrument_short_name
    WHEN 'PTP' THEN ARRAY['PTP', 'INST-001', '02618e9a-d411-44cf-b316-fe368edeac03']
    WHEN 'NAI' THEN ARRAY['NAI', 'INST-002', '77d1290f-1daf-44e0-931f-b9b8ad185520']
    WHEN 'AIRSA' THEN ARRAY['AIRSA', 'INST-003', 'abb62120-8cc8-435f-babc-dd6a27fbc235']
    WHEN 'HSS' THEN ARRAY['HSS', 'INST-004', '90216d9d-153c-4b7b-abe0-1d7845c9e6e0']
    ELSE ARRAY[p_instrument_short_name]
  END;

  SELECT id INTO v_purchase_id
  FROM assessment_purchases
  WHERE user_id = p_user_id
    AND instrument_id = ANY(v_instrument_codes)
    AND consumed_at IS NULL
  ORDER BY purchased_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_purchase_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE assessment_purchases
  SET consumed_at = NOW(),
      consumed_by_assessment_id = p_assessment_id
  WHERE id = v_purchase_id;

  RETURN v_purchase_id;
END;
$function$
```

No other database function calls `consume_assessment_purchase` (verified via
`pg_get_functiondef` LIKE scan). It is called from frontend or an Edge Function — NOT
yet located this session (see Section 8 open recon item 1).

### 2.5 `link_assessment_to_coach_client` (full body, verified this session)

```
CREATE OR REPLACE FUNCTION public.link_assessment_to_coach_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status = 'completed' and (old.status is null or old.status != 'completed') then
    update public.coach_clients cc
    set
      assessment_id = new.id,
      invitation_status = 'completed'
    from public.instruments i
    where
      cc.client_user_id = new.user_id
      and i.instrument_id = new.instrument_id
      and cc.instrument_id = i.id
      and cc.invitation_status in ('sent', 'opened')
      and cc.assessment_id is null;
  end if;
  return new;
exception when others then
  return new;
end;
$function$
```

Trigger: `on_assessment_completed_link_coach_client`, `AFTER UPDATE ON public.assessments
FOR EACH ROW`. It is context-blind — the first completed PTP of ANY context flips the
`coach_clients` row to `completed` and stamps `assessment_id`.

### 2.6 `link_coach_client_on_signup` (full body, verified this session)

```
CREATE OR REPLACE FUNCTION public.link_coach_client_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.coach_clients
  set
    client_user_id = new.id,
    invitation_status = 'opened'
  where
    client_email = new.email
    and client_user_id is null
    and revoked_at is null
    and (expires_at is null or expires_at > now());
  return new;
exception when others then
  return new;
end;
$function$
```

Signup-time email-match linker. Not consumption-relevant. NO CHANGE needed for this
feature — listed here only to confirm it was read and ruled out.

### 2.7 `InstrumentSelection.tsx` entitlement resolution (verified this session)

The `load()` effect runs ten parallel queries. The four that matter for PTP entitlement:

- `coachClientsRes` (lines 93-98): `coach_clients` where `client_user_id = user.id`,
  `stripe_payment_intent_id IS NOT NULL`, `assessment_id IS NULL`,
  `invitation_status != 'completed'`. Selected columns: `instrument_id`,
  `stripe_payment_intent_id`, `assessment_id`. Result populates
  `coachPaidInstrumentIds` (a Set of `instrument_id` UUIDs).
- `purchasesRes` (line 99): `assessment_purchases` where `user_id = user.id`,
  `consumed_at IS NULL`. Selected column: `instrument_id`. Result populates
  `purchasedInstrumentIds`, splitting comma-joined `instrument_id` values.
- `completedRes` (line ~100): `assessments` where `user_id = user.id`,
  `status = 'completed'`. Populates `completedInstrumentIds`.
- `selfPayCoachClientsRes` (lines 103-108): `coach_clients` where
  `client_user_id = user.id`, `stripe_payment_intent_id IS NULL`,
  `assessment_id IS NULL`, `invitation_status IN ('sent','opened')`. Populates
  `selfPayCoachInstrumentIds`.

The per-instrument access decision (lines ~364-419) is an if/else chain:
`canBypassAssessmentPaywall` -> `isCorp` -> `subscriptionAccess` -> `coachPaid`
(`coachPaidInstrumentIds.has(instrumentUuid)`) -> `purchaseAccess` (`hasPurchase`) ->
`selfPayCoachInvited` (`selfPayCoachInstrumentIds.has(instrumentUuid)`) -> else
"Purchase to Access" / "Upgrade to Premium".

`hasCompleted` (`completedInstrumentIds.has(inst.instrument_id)`) is COMPUTED at line
~366 but is NOT used in the if/else chain that picks `buttonContent`. So today, having a
completed PTP does not by itself change the button — but the coach-invite and purchase
queries already exclude consumed/completed entitlement rows, so a fully-consumed PTP
naturally falls through to "Purchase to Access".

There is NO professional/personal/combined context selection anywhere in
`InstrumentSelection.tsx`. The instrument card has one button. Context is chosen
downstream — see Section 8 open recon item 2.

---

## 3. THE TARGET BEHAVIOR (restated from scope doc decision 14, made concrete)

One PTP entitlement — whether it arrives as a `coach_clients` invitation row or an
`assessment_purchases` row — grants the holder ONE complete 89-item PTP. That entitlement
is satisfiable in either of two ways:

- Both-at-once: a single `context_type = 'both'` assessment covering all 89 items. This
  is what 62 of the 65 completed PTPs already are. This path is already correct today and
  must stay correct.
- Half-then-half: a `context_type = 'professional'` assessment (47 items) and a
  `context_type = 'personal'` assessment (42 items), taken in either order. The
  entitlement is NOT fully satisfied until BOTH halves are complete.

The entitlement is "fully consumed" only when the holder has either one completed `both`
assessment OR one completed `professional` + one completed `personal` assessment, all
under that single entitlement. Once fully consumed, the next PTP requires a new
entitlement (new `coach_clients` invitation or new `assessment_purchases` row) and
produces a separate report.

State transitions the model must represent:
- Entitlement granted, nothing taken yet.
- Entitlement partially consumed: professional done, personal still owed (or vice versa).
- Entitlement fully consumed: both halves done, or one `both` done.

Edgar is in the "partially consumed: professional done, personal still owed" state, and
the system today has no representation of that state — his `coach_clients` row reads
`completed` exactly as if he had taken a full `both` assessment.

---

## 4. SCHEMA DESIGN

### 4.1 `coach_clients` — add a context column and split "completed" semantics

Problem: `invitation_status` has only `sent` / `opened` / `completed`. `completed` is
overloaded — it currently means "this invitation produced an assessment," with no notion
of "half." And `assessment_id` is a single FK, so it can only point at one assessment.

Design:

A. Add `coach_clients.context_progress text` NULLABLE, with a CHECK constraint allowing
   `null` / `'professional_done'` / `'personal_done'` / `'both_done'`. Semantics:
   - `null` — no half taken yet (the invitation is `sent` or `opened`, or it is a
     `both`-style invitation that has not been completed). Backward-compatible: every
     existing row stays `null`.
   - `'professional_done'` — the professional half is complete, the personal half is
     still owed.
   - `'personal_done'` — the personal half is complete, the professional half is still
     owed.
   - `'both_done'` — the entitlement is fully satisfied (either both halves done, or one
     `both` assessment done).
   This is a NEW column, additive, no backfill required for correctness — but see 4.4 for
   the one-time backfill that keeps existing data semantically right.

B. Add `coach_clients.paired_assessment_id uuid` NULLABLE, FK `assessments(id)` ON
   DELETE SET NULL. Semantics: when the invitation is satisfied by two half-assessments,
   `assessment_id` holds the FIRST completed half and `paired_assessment_id` holds the
   SECOND. When satisfied by a single `both` assessment, `assessment_id` holds it and
   `paired_assessment_id` stays `null`. Rationale for a second column rather than a join
   table: `coach_clients` already uses single-FK `assessment_id`; a half-then-half PTP
   has at most two assessments; a second nullable FK is the minimal change and mirrors
   the `assessments.paired_assessment_id` pattern (Section 4.3). A join table would be
   over-built for a fixed maximum of two.

C. The `invitation_status` CHECK constraint stays `sent` / `opened` / `completed`. Do
   NOT add new `invitation_status` values. `invitation_status = 'completed'` now means
   "the entitlement is fully satisfied" — i.e. it is set to `completed` ONLY when
   `context_progress` reaches `'both_done'`. While the entitlement is half-satisfied,
   `invitation_status` stays `'opened'` and `context_progress` carries the half-state.
   This keeps the existing CHECK constraint untouched and keeps the meaning of
   `completed` consistent ("done, nothing more owed").

   Decision needed at implementation with Cole: this overloads `'opened'` to also mean
   "half-done." The alternative is adding `'partially_completed'` to the
   `invitation_status` CHECK. Adding the value is cleaner semantically but touches the
   CHECK constraint and every consumer of `invitation_status` (the two
   `InstrumentSelection.tsx` queries, the trigger, any coach-side UI listing client
   status). Keeping `'opened'` + `context_progress` is the smaller blast radius. This
   spec recommends `'opened'` + `context_progress` and flags the choice for Cole.

### 4.2 `assessment_purchases` — add a context-progress column

Problem: `consumed_at` / `consumed_by_assessment_id` are all-or-nothing. The first PTP
attempt of any context sets `consumed_at` and the purchase looks fully spent.

Design:

A. Add `assessment_purchases.context_progress text` NULLABLE, with the SAME CHECK
   constraint shape as 4.1.A: `null` / `'professional_done'` / `'personal_done'` /
   `'both_done'`. Same semantics.

B. Add `assessment_purchases.paired_assessment_id uuid` NULLABLE, FK `assessments(id)`
   ON DELETE SET NULL. Same role as 4.1.B: `consumed_by_assessment_id` holds the first
   completed half (or the `both` assessment), `paired_assessment_id` holds the second
   half.

C. Redefine "consumed": a purchase is fully consumed when `context_progress = 'both_done'`.
   `consumed_at` is set ONLY at that point. While half-consumed, `consumed_at` stays
   `null` and `context_progress` carries the half-state, and `consumed_by_assessment_id`
   holds the first half.

   This is the important behavioral change: `InstrumentSelection.tsx`'s `purchasesRes`
   query filters `consumed_at IS NULL`, so leaving `consumed_at` null while half-consumed
   means a half-consumed purchase STILL shows up as an active entitlement — which is
   exactly what is wanted (the holder still owes themselves one half). The context-aware
   logic in Section 6 then narrows it to "you may take the personal half" rather than
   "you may take a full PTP."

### 4.3 `assessments.paired_assessment_id` — start using the existing column

`assessments.paired_assessment_id` already exists (FK `assessments(id)` ON DELETE SET
NULL) and is populated on zero PTP rows. Use it: when a user takes the second half of a
half-then-half PTP, set `paired_assessment_id` on BOTH assessment rows to point at each
other (professional row points at personal row and vice versa). This gives the report
layer a direct in-row link between the two halves without a `user_id`-scoped guess.

No schema change — this column already exists. The change is that the assessment-creation
/ assessment-completion path starts populating it. See Section 5.3.

Note for the report layer (D-series, not this feature): the scope doc Section 8 D1 design
and Section 10 item 3 assume the combined view joins the two halves. Once
`assessments.paired_assessment_id` is populated, the combined-context join can be
"fetch this assessment + its `paired_assessment_id` assessment" rather than "fetch all of
this user's PTP assessments and concatenate." That is cleaner and removes the ambiguity
in scope-doc Section 10 item 4 (which `assessment_result` row the combined interpretation
is keyed against — it can be keyed against the assessment whose `paired_assessment_id` is
set, deterministically the second-completed one). This spec does not implement the report
change; it just notes that populating `paired_assessment_id` makes the D-series join
well-defined.

### 4.4 One-time data backfill

After 4.1 and 4.2 land, run a one-time backfill so existing rows are semantically
correct under the new columns:

- For every `coach_clients` row with `invitation_status = 'completed'` and `assessment_id`
  pointing at a `both`-context assessment: set `context_progress = 'both_done'`. (These
  are correctly "fully done" already; the backfill just makes `context_progress` agree.)
- For every `coach_clients` row with `invitation_status = 'completed'` and `assessment_id`
  pointing at a `professional`-context assessment: set
  `context_progress = 'professional_done'` AND set `invitation_status` back to `'opened'`.
  This is the row class Edgar is in. After the backfill Edgar's row reads
  `invitation_status = 'opened'`, `context_progress = 'professional_done'`,
  `assessment_id` = his professional assessment — i.e. "you have done the professional
  half, you still owe yourself the personal half."
- Symmetric for `assessment_id` pointing at a `personal`-context assessment: set
  `context_progress = 'personal_done'`, `invitation_status = 'opened'`.
- For every `assessment_purchases` row with `consumed_at IS NOT NULL` and
  `consumed_by_assessment_id` pointing at a `both` assessment: set
  `context_progress = 'both_done'` (leave `consumed_at` set).
- For every `assessment_purchases` row with `consumed_at IS NOT NULL` and
  `consumed_by_assessment_id` pointing at a `professional` or `personal` assessment: set
  `context_progress` to `'professional_done'` / `'personal_done'` accordingly AND set
  `consumed_at = NULL` (re-opening the half-consumed purchase). NOTE: verify with a
  SELECT first how many `assessment_purchases` rows this affects — Section 2.1 found PTP
  purchases exist but the count of half-consumed ones was not measured this session.

Verification after backfill: Edgar's `coach_clients` row `5ade7a72-...` reads
`invitation_status = 'opened'`, `context_progress = 'professional_done'`. A row count of
`coach_clients` grouped by `(invitation_status, context_progress)` should show no
`completed` row whose `assessment_id` points at a non-`both` assessment.

### 4.5 What is NOT changing

- `link_coach_client_on_signup` — unchanged (Section 2.6).
- `invitation_status` CHECK constraint — unchanged (per 4.1.C recommendation).
- `coach_clients.instrument_id` and `assessment_purchases.instrument_id` — unchanged. The
  mixed-form `instrument_id` storage is pre-existing and out of scope here.
- The `both`-at-once flow — unchanged end to end. A `both` assessment sets
  `context_progress = 'both_done'` directly and `invitation_status = 'completed'`,
  exactly the current behavior plus the new column.

---

## 5. TRIGGER AND RPC CHANGES

### 5.1 `link_assessment_to_coach_client` — make it context-aware

Current behavior (Section 2.5): on any PTP assessment completing, flip the matching
`coach_clients` row to `invitation_status = 'completed'`, `assessment_id = new.id`.

New behavior:

When `new.status` becomes `completed` and the matched `coach_clients` row exists
(`cc.client_user_id = new.user_id`, instrument match via `instruments`,
`cc.invitation_status IN ('sent','opened')`):

- If `new.context_type = 'both'`: set `cc.assessment_id = new.id`,
  `cc.context_progress = 'both_done'`, `cc.invitation_status = 'completed'`. (Current
  behavior, plus the new column.) Match condition stays `cc.assessment_id IS NULL`.

- If `new.context_type = 'professional'`:
  - If `cc.context_progress IS NULL` (this is the FIRST half): set
    `cc.assessment_id = new.id`, `cc.context_progress = 'professional_done'`. Leave
    `cc.invitation_status = 'opened'`.
  - If `cc.context_progress = 'personal_done'` (this is the SECOND half completing the
    set): set `cc.paired_assessment_id = new.id`, `cc.context_progress = 'both_done'`,
    `cc.invitation_status = 'completed'`. ALSO set `paired_assessment_id` on both
    `assessments` rows to cross-link them (the new professional row and the existing
    personal row whose id is `cc.assessment_id`).
  - If `cc.context_progress = 'professional_done'` already: the professional half is
    already recorded against this invitation. Do nothing to this row (this would be a
    second professional assessment under one entitlement — should not normally happen;
    the frontend in Section 6 prevents offering it). Do not error — the trigger has a
    `WHEN OTHERS` catch and must stay non-blocking.

- If `new.context_type = 'personal'`: symmetric to the professional case
  (`context_progress` `null` -> `'personal_done'`; `'professional_done'` -> `'both_done'`
  + `completed` + cross-link).

- If `new.context_type IS NULL`: do nothing (an in-progress or malformed assessment;
  NULL context PTP assessments exist only in `in_progress` state per Section 2.2 recon,
  and the trigger only fires on `completed`, so this branch is defensive).

The match condition `cc.assessment_id IS NULL` from the current trigger MUST change. The
new match must be: rows where `cc.invitation_status IN ('sent','opened')` AND
`cc.context_progress IS DISTINCT FROM 'both_done'`. Because on the second half,
`cc.assessment_id` is already set (it holds the first half), so the old
`cc.assessment_id IS NULL` guard would skip the row and the second half would never link.

Implementation notes:
- Keep `SECURITY DEFINER`, `SET search_path TO 'public','pg_temp'`, and the
  `exception when others then return new` wrapper. The trigger must never block an
  assessment from completing.
- The cross-linking UPDATE on `assessments` (setting `paired_assessment_id` on both rows)
  happens INSIDE this trigger function, which is an `AFTER UPDATE ON assessments` trigger.
  Updating `assessments` from within an `assessments` trigger is allowed but will RE-FIRE
  this trigger on the rows being updated. Guard against recursion: the re-fire will have
  `new.status = 'completed'` and `old.status = 'completed'` (status unchanged — only
  `paired_assessment_id` changed), so the existing top-level guard
  `if new.status = 'completed' and (old.status is null or old.status != 'completed')`
  already prevents the recursive invocation from doing anything. Verify this holds when
  implementing — it is the reason the existing guard is shaped that way and it must be
  preserved.
- There is a uniqueness concern: what stops two different `coach_clients` rows from both
  matching one user + instrument? Today nothing does, and the current trigger would
  update all matching rows. This spec does not add a uniqueness constraint (that is a
  bigger data-model question and out of scope), but the implementer must be aware that
  the trigger's UPDATE can in principle touch more than one row. For the half-then-half
  logic to be correct, the trigger should update at most the one invitation the user is
  progressing. Recommended: `ORDER BY cc.created_at ASC LIMIT 1` semantics via a subquery
  selecting the single oldest matching `sent`/`opened` non-`both_done` row. Flag for Cole
  — this is a pre-existing ambiguity the half-then-half feature surfaces but does not
  cause.

### 5.2 `consume_assessment_purchase` — make it context-aware

Current behavior (Section 2.4): find the oldest unconsumed purchase for the user +
instrument, set `consumed_at = NOW()` and `consumed_by_assessment_id`.

New signature: add a context parameter.
`consume_assessment_purchase(p_user_id uuid, p_instrument_short_name text,
p_assessment_id uuid, p_context_type text DEFAULT NULL)`.

Adding a parameter with a DEFAULT to a Postgres function via `CREATE OR REPLACE` creates
a SEPARATE overload — it does NOT replace the 3-arg version (this is the exact trap
documented in architecture-reference §39 / the Session 59 finding about CREATE OR REPLACE
with a new arg list). The migration MUST `DROP FUNCTION public.consume_assessment_purchase(uuid, text, uuid)`
explicitly and then `CREATE` the 4-arg version. Confirm there are no remaining 3-arg
callers before dropping (Section 8 open recon item 1 — the caller has not been located
this session).

New behavior:

The purchase lookup still finds candidate rows for the user + instrument. But "candidate"
changes from `consumed_at IS NULL` to `context_progress IS DISTINCT FROM 'both_done'`
(i.e. not yet fully consumed). Then:

- If `p_context_type = 'both'`: pick the oldest candidate, set
  `context_progress = 'both_done'`, `consumed_at = NOW()`,
  `consumed_by_assessment_id = p_assessment_id`. (Current behavior plus the column.)

- If `p_context_type = 'professional'`:
  - Prefer a candidate already at `context_progress = 'personal_done'` (this assessment
    completes a half-done purchase). If found: set
    `context_progress = 'both_done'`, `consumed_at = NOW()`,
    `paired_assessment_id = p_assessment_id`. (Note `consumed_by_assessment_id` already
    holds the personal half; `paired_assessment_id` gets the professional half.)
  - Else pick the oldest candidate at `context_progress IS NULL` (start a fresh
    half-then-half): set `context_progress = 'professional_done'`,
    `consumed_by_assessment_id = p_assessment_id`, leave `consumed_at = NULL`.
  - Else (only candidates are already `professional_done`): no purchase to consume for a
    second professional half — RETURN NULL. The frontend (Section 6) should not have
    offered this.

- If `p_context_type = 'personal'`: symmetric.

- If `p_context_type IS NULL`: preserve the current 3-arg behavior exactly (oldest
  `context_progress IS DISTINCT FROM 'both_done'` candidate, treat as a full consume:
  `context_progress = 'both_done'`, `consumed_at = NOW()`). This keeps any
  not-yet-updated caller working until the caller is updated to pass context. Once the
  caller is updated, `p_context_type` is always non-NULL for PTP.

Keep `SECURITY DEFINER`, `SET search_path TO 'public'`, the
`FOR UPDATE SKIP LOCKED` row lock, and the `v_instrument_codes` CASE mapping verbatim.
Return value stays `uuid` (the purchase id, or NULL).

### 5.3 Assessment creation — set `context_type` and `paired_assessment_id`

For the half-then-half model to work, the assessment-creation path must:
- Set `assessments.context_type` to `'professional'` / `'personal'` / `'both'` at
  creation (or at the latest before completion, since the trigger reads
  `new.context_type`).
- When creating the SECOND half, set `assessments.paired_assessment_id` to the first
  half's id (and the trigger in 5.1 sets it on the first half's row in return).

Section 8 open recon item 2 — the assessment-creation path and where `context_type` is
currently set has not been read this session. `Assessment.tsx` was read in the prior
session (scope doc Section 9 lists it at 12,269 bytes) but its `context_type`-setting
logic was not captured. This must be read before implementing 5.3.

---

## 6. FRONTEND CHANGES — `InstrumentSelection.tsx`

The current file has ONE button per instrument and NO context selection (Section 2.7).
The half-then-half model needs the PTP card to know, for the current user, which of these
states they are in and offer the right next action:

- State A — no PTP entitlement at all: "Purchase to Access" (unchanged).
- State B — PTP entitlement, nothing taken: offer the full PTP. Downstream, the user
  picks `both` or starts with one half. (Whether the both/half choice lives here or
  downstream is Section 8 open recon item 2.)
- State C — PTP entitlement, professional half done, personal still owed: the card must
  say something like "Continue your PTP — Personal half" and route into the personal-half
  assessment.
- State D — PTP entitlement, personal half done, professional still owed: mirror of C.
- State E — PTP entitlement fully consumed (`both_done`): the card should NOT offer a
  free retake. Falls through to "Purchase to Access" for a new PTP. This already happens
  naturally once the entitlement row is fully consumed, because the coach-invite and
  purchase queries exclude fully-consumed rows.

Query changes in the `load()` effect:

- `coachClientsRes` (lines 93-98): currently filters `.neq("invitation_status",
  "completed")` AND `.is("assessment_id", null)`. The `.is("assessment_id", null)` filter
  MUST be removed or widened — a half-done invitation has `assessment_id` set (the first
  half). New filter: `invitation_status != 'completed'` AND
  `context_progress is distinct from 'both_done'`. Add `context_progress` and
  `paired_assessment_id` to the selected columns. Note Supabase JS `.not()` /
  `.is()` cannot express `IS DISTINCT FROM` directly — use
  `.neq('context_progress','both_done')` plus `.or('context_progress.is.null,...')` or
  simply select the rows and filter in JS. Implementer's call; filtering in JS on a
  small result set is fine.
- `selfPayCoachClientsRes` (lines 103-108): currently
  `.in("invitation_status", ["sent","opened"])` AND `.is("assessment_id", null)`. Same
  issue — drop `.is("assessment_id", null)`, keep `invitation_status IN ('sent','opened')`
  (which under the 4.1.C recommendation still includes half-done rows because they stay
  `'opened'`), add `context_progress` to the select.
- `purchasesRes` (line 99): currently `.is("consumed_at", null)`. Under 4.2.C a half-done
  purchase has `consumed_at = NULL`, so this query ALREADY returns half-done purchases —
  good. Add `context_progress` and `paired_assessment_id` to the select so the card can
  tell State B from State C/D.

Access-decision changes (the if/else chain ~lines 364-419): for PTP specifically, the
chain needs to branch on `context_progress` of the resolved entitlement row:
- `context_progress IS NULL` -> State B -> "Start Assessment" (current label path).
- `context_progress = 'professional_done'` -> State C -> "Continue your PTP — Personal
  half", routes into a personal-context assessment.
- `context_progress = 'personal_done'` -> State D -> "Continue your PTP — Professional
  half".
- No entitlement row -> State A -> "Purchase to Access".

`hasCompleted` (computed at line ~366, currently unused in the chain) can stay unused or
be removed — the entitlement rows already encode consumption. Do not wire `hasCompleted`
into the chain as a gate; it would wrongly block State C/D (the user HAS a completed PTP
assessment — the professional half — but still owes the personal half).

The non-PTP instruments (NAI, AIRSA, HSS) have no context split — their card behavior
must be UNCHANGED. The context branching above is gated to `inst.instrument_id ===
'INST-001'` only.

`create-checkout` caution: scope-doc and architecture-reference both flag
`create-checkout` as fragile and rewritten by Lovable during adjacent prompts. The
self-pay dialog in `InstrumentSelection.tsx` calls `create-checkout`. Any Lovable prompt
that touches `InstrumentSelection.tsx` for this feature must be checked afterward to
confirm it did not disturb the `create-checkout` invocation or its body.

---

## 7. IMPLEMENTATION SEQUENCING (backend-first, sub-stop-gated, STOP after each)

E1 — Schema migration: add `coach_clients.context_progress` + CHECK,
`coach_clients.paired_assessment_id` + FK, `assessment_purchases.context_progress` +
CHECK, `assessment_purchases.paired_assessment_id` + FK. Verify with `execute_sql`
against `pg_constraint` and `information_schema.columns`. STOP.

E2 — One-time backfill (Section 4.4). Run the SELECT-first count, apply the backfill
migration, verify Edgar's row and the grouped counts. STOP.

E3 — `link_assessment_to_coach_client` rewrite (Section 5.1). Deploy. Verify by
completing a test professional assessment for a test invitation and confirming
`context_progress = 'professional_done'` + `invitation_status = 'opened'`, then a test
personal assessment and confirming `both_done` + `completed` + cross-linked
`paired_assessment_id` on both `assessments` rows. STOP.

E4 — `consume_assessment_purchase` rewrite (Section 5.2): locate the caller first
(open recon item 1), DROP the 3-arg function, CREATE the 4-arg version, update the
caller to pass `p_context_type`. Verify with a test purchase taken half-then-half. STOP.

E5 — Assessment-creation `context_type` / `paired_assessment_id` wiring (Section 5.3):
read the creation path first (open recon item 2), then make the change. STOP.

E6 — Frontend `InstrumentSelection.tsx` (Section 6): single Lovable prompt, all query
and access-chain changes together. Verify Edgar (or a test user in the same state) sees
"Continue your PTP — Personal half". Verify a no-entitlement user still sees "Purchase to
Access". Verify NAI/AIRSA/HSS cards unchanged. Re-check `create-checkout` invocation
intact. STOP.

This sequence is gated behind D1-D5 per scope-doc decision 14. It can run before D only
if Cole explicitly re-sequences — and the trade-off in that case is that the combined
report (D-series) will then be built against a `paired_assessment_id` link that E3/E5
introduce, which is actually the better ordering for the report join (Section 4.3). If
Cole wants to re-sequence E before D, that is defensible specifically because E3/E5 make
the D-series combined join well-defined. Flag this to Cole as a real option rather than a
fixed "D first" — the dependency runs E-helps-D, not D-helps-E.

---

## 8. OPEN RECON ITEMS (must be closed before the named sub-stop)

1. The caller of `consume_assessment_purchase` — no database function calls it (verified
   this session). It is called from the frontend or an Edge Function. Must be located
   before E4 so the DROP + 4-arg CREATE does not break a 3-arg caller, and so the caller
   can be updated to pass `p_context_type`. Likely candidates: an Edge Function in the
   assessment-start or assessment-complete path, or `Assessment.tsx`. Grep the frontend
   and `list_edge_functions` for `consume_assessment_purchase`.

2. The assessment-creation path and where `context_type` is set today. `Assessment.tsx`
   was read in a prior session but its `context_type` logic was not captured in the scope
   doc. Must be read before E5. Specifically: where does a PTP assessment get its
   `context_type`, is there already any professional/personal/both selection UI, and what
   sets `instrument_version`. This also answers the Section 6 question of whether the
   both/half choice lives in `InstrumentSelection.tsx` or downstream in `Assessment.tsx`.

3. Count of half-consumable `assessment_purchases` rows — Section 4.4 backfill re-opens
   `assessment_purchases` rows whose `consumed_by_assessment_id` points at a non-`both`
   assessment by setting `consumed_at = NULL`. The count of such rows was not measured
   this session. Run the SELECT before E2 to know the blast radius. Section 2.2 recon
   showed only 3 non-`both` completed PTP assessments total (1 personal + 2 professional),
   so this is expected to be a very small number, possibly zero — but measure, do not
   assume.

4. Whether more than one `coach_clients` row can match one user + instrument (Section 5.1
   notes the trigger's UPDATE can touch multiple rows). Measure with a grouped count
   before E3. If it happens in real data, the `ORDER BY created_at ASC LIMIT 1` subquery
   approach in 5.1 is required; if it never happens, the simpler UPDATE is acceptable but
   the subquery is still the safer choice.

---

## 9. WHAT THIS SPEC DOES NOT COVER

- The combined report generation for a half-then-half user. That is the D-series (scope
  doc Section 8 and Section 10 items 3-4). This spec only notes (Section 4.3) that
  populating `assessments.paired_assessment_id` makes the D-series combined join
  well-defined.
- Bulk-invite / bulk-purchase coach flows with per-client instrument selection — listed
  as a deferred item in userMemories, not touched here.
- The mixed-form `instrument_id` storage on `coach_clients` and `assessment_purchases`.
  Pre-existing, out of scope.
- Any change to the `both`-at-once flow's user-facing behavior. It is unchanged; it only
  gains a `context_progress = 'both_done'` write.
- Refund interaction: if a half-then-half entitlement is refunded after one half is taken,
  what happens. The `refunded_at` / `revoked_at` columns exist on both tables; the
  interaction with `context_progress` is not designed here. Flag for Cole as a follow-up
  question — it is an edge case but a real one.
