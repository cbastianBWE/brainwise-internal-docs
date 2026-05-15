# BrainWise Session 73 to 74 Handoff

*Closeout: Session 73. Open: Session 74.*

## Where Session 73 left off

Two distinct workstreams shipped end-to-end in one session:

**1. Pattern C — Super admin acts as practitioner coach.** Eight backend migrations + 3 Edge Function deploys + 1 Lovable frontend prompt covering 6 files + 1 synthetic data row. End-to-end verified twice via test invitations from Cole's super admin account to two real client email addresses. Both invitations created `coach_clients` rows, sent invitation emails, and produced $0 `assessment_purchases` entries — no Stripe transactions, no real money charged.

**2. Full security audit cycle.** Lovable scanner run after Pattern C shipped surfaced 2 errors + 9 warnings. Four diagnostic rounds with Lovable triaged every finding. Real bugs closed via 7 backend migrations + 2 Edge Function deploys + 2 GitHub commits + 2 Lovable frontend prompts. False positives + design-intentional items marked ignored with documented rationale. Final scanner state: **0 errors, 0 warnings, 15 ignored**.

Build queue v81 entry covers the security audit cycle in full detail; v80 covers Pattern C. Architecture reference v77 adds §89-§92 standing rules from the security audit work.

## Session 74 opening priorities, in order

### 1. Pattern C Stripe-bypass investigation (small, time-boxed)

Test invitations from Cole's super admin in Session 73 completed WITHOUT exercising Pattern C's `create-checkout` + `stripe-webhook` code paths. Both test invites created `coach_clients` + `assessment_purchases` rows with `amount_paid=0` and `stripe_payment_intent_id=NULL`, plus invitation emails — but did not fire any Stripe transaction at all.

The frontend appears to have a pre-existing "if 100% comp coupon applies, write rows directly and skip Stripe" short-circuit path. Either Pattern C's Stripe-mediated path or this direct-write path is the canonical implementation; one is effectively dead code.

**Investigation steps (under 1 hour):**
- Read `src/pages/coach/CoachClients.tsx` and adjacent order-flow files in GitHub main
- Identify where 100% comp coupon detection happens client-side and what branch it takes
- Decide: keep direct-write as canonical (remove Pattern C `create-checkout` comp lookup logic) OR remove direct-write (force flow through Stripe even for $0 orders for audit trail consistency)
- Document the decision in build queue + architecture reference

Recommend keeping direct-write as canonical — $0 Stripe transactions are wasteful, and the direct-write path produces functionally identical outcomes (invitation row, $0 entitlement, email). The Pattern C `create-checkout` comp lookup logic stays as defensive infrastructure in case the direct-write path ever needs to be removed.

### 2. Resume Group C completion arc — Group Y Lovable prompt

Pattern C and the security audit were standalone interruptions. The Group C completion arc resumes at Group Y (My Learning tab + All Resources tab + Coach Resources tab content), unchanged from the Session 72→73 handoff. The full sequence remains: **Y → Z → V → W**.

Group Y prompt estimated 600-900 lines. Consumes the Group X tile primitive + helpers from Session 72 (`Tile.tsx`, `tileVariants.ts`, `useResourceAccessLog` hook). Should NOT modify those files — only consume them.

Locked design in build-queue.md v79 entry. Recap:
- **My Learning tab**: smart-default Enrolled vs All Available toggle (Option B). Three horizontal carousels (cert paths / standalone curricula / standalone modules), sorted most-recently-engaged first. Empty states with inline messaging.
- **All Resources tab**: grid from `get_user_resources`, sorted by display_order. Click destinations vary by content_type. Fire `log_resource_access` on every click.
- **Coach Resources tab**: same shape, coach-only filtered server-side via `get_user_resources`.
- **Locked-tile pattern for free users**: `get_user_resources` extension returns `is_accessible` boolean per resource. Tile gains `locked` prop showing lock-icon overlay + altered click behavior. Free users see all resources, locked ones visually gated.

### 3. After Group Y: draft Group Z (detail pages)

Cert path detail, curriculum detail, module detail. Each with hero header + child tiles grid. Locked section order from Session 72 design.

### 4. After Group Z: Group V (certification page) + lesson_blocks viewer recon

Certification page at `/certifications/<id>` with Canvas API browser composition for PNG personalization. PDF deferred. Then the lesson_blocks viewer recon (no code shipped — pure analysis session) before Group W.

### 5. After Group V + recon: Group W (content item viewers)

Video viewer, External Link viewer, Lesson blocks viewer for launch. Other 5 viewer types deferred to Phase 5.5.

## Deferred items carrying forward

- **Post-launch refactor**: replace `coach_clients_client_view` with explicit SECURITY DEFINER RPC `get_my_coach_invitations()`. Current view works correctly; refactor is hygiene, not correctness.
- **Session 71 anon EXECUTE audit**: dedicated session walking each of the 95 SECDEF functions with anon EXECUTE and deciding per-function keep / SECURITY INVOKER / REVOKE. No live exploit (Edge Functions use service role). Defense-in-depth.
- **Phase 5/Group D cohort SELECT policy**: when cohorts feature ships, add the `cohort_members can read their own cohorts` policy. Tables currently empty.
- **AIRSA Phases 3e-8**: a separate Group C track. Pending.
- **Action-Oriented Voice Redesign**: top Build Queue priority post-launch. Six surfaces, three work parts.
- **SOC 2 written policies**: deferred until feature-complete.
- **Pre-pen-test code review**: pending.
- **Corporate contract renewal schema** (drop UNIQUE on `corporate_contracts`, add `is_current` semantics): pending.
- **Clarity Engine**: deferred to Group C resources build-out.
- **`lesson-blocks-content-schema.md` doc**: carried forward from Session 70, prerequisite for Group W lesson_blocks viewer.

## Test fixture state notes

- **5 orphaned test thumbnails** from Session 72 still sit in `lesson-assets` private bucket (uploaded before the `lesson-thumbnails` public bucket existed). Cole's action to re-upload through existing super-admin authoring UIs (PTP-Coach cert path, PTP VILT 1 curriculum, Test Module C module, Test Video Item content_item, Test External Link content_item). ~5 minutes total. After re-upload, Group X tile previews show real thumbnails instead of placeholder.

- **2 super admin users** in production both have `is_practitioner_coach=true` via Migration C backfill (Pattern C). If the second super admin is NOT intended to act as a practitioner coach, manual UPDATE to false on that user's row. Cole's awareness item.

- **Synthetic `my_brainwise_coach` certification row** exists for Cole's super admin user only. If the second super admin needs to act as a coach, insert a matching row using Migration H from Session 73 as template. Standing rule: analytics queries counting certified coaches must filter `account_type != 'brainwise_super_admin'` to exclude these synthetic rows.

- **`coach_clients_client_view`** is in place across all four client-facing frontend files (MyResults, Onboarding, PrivacySettings, InstrumentSelection). Coach-side queries on `coach_clients` base table left untouched intentionally.

## Edge Function versions at Session 73 close

| Function | Version | verify_jwt | Status |
|---|---|---|---|
| `create-checkout` | v56 | true | Pattern C + §91 security hardening |
| `customer-portal` | v41 | true | §91 security hardening |
| `create-comp-coupon` | v2 | false | Pattern C (Class A custom auth) |
| `stripe-webhook` | v26 | false | Pattern C |
| `ai-chat` | latest Lovable | n/a | §90 length caps in source |
| `generate-report` | latest Lovable | n/a | §90 rate limit in source |
| All others | unchanged from Session 72 | — | — |

## Standing rules added Session 73

- **§87** — Decoupling account-type from functional-role (Pattern C pattern: per-user boolean flag + SECURITY DEFINER STABLE helper + RLS swap + RPC widening + auto-flip trigger).
- **§88** — Forward-thinking infrastructure (comp coupon admin UI as reusable investment, not one-shot script).
- **§89** — View-as-gate pattern for column-level privacy on row-readable tables.
- **§90** — AI rate limit + length cap pattern via `check-ai-usage` with `usage_type` discriminator + `!isInternal` bypass.
- **§91** — Stripe-and-external-API Edge Function security hardening pattern (allowlist Set + Origin validation + quantity bounds + named constants).
- **§92** — Repo↔runtime sync discipline (every MCP Edge Function deploy followed same-session by GitHub commit).

## Session 74 open protocol

1. GitHub MCP `get_file_contents` on `cbastianBWE/brainwise-internal-docs` root files: `build-queue.md` (will be v81), `architecture-reference.md` (will be v77), this `session-73-to-74.md`.
2. Save locally at `/home/claude/internal-docs/`.
3. Confirm v81 and v77 markers at top of build-queue and architecture-reference respectively.
4. Begin with Pattern C Stripe-bypass investigation (priority 1 above) — time-boxed under 1 hour, ends with a documented decision.
5. Then Group Y prompt draft.

Cole's session-close protocol: edit markdown in place via `str_replace` as decisions land mid-session. Present three `.md` files (`build-queue.md`, `architecture-reference.md`, `session-74-to-75.md`) for manual GitHub web UI upload at session close.
