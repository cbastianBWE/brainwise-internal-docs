# BrainWise — Session 177 opener

*Closeout: Session 176 (F1 + F2 build). Open: Session 177.*

## Where Session 176 left off

Both features scoped in Session 175 were BUILT and shipped: **F1** (individual PTP report now generates per-section, with a live "Section X of 12" overlay and impact tables unified across contexts) and **F2** (leader-facing leadership content as a modal in team and work-context paired reports, printable on the leader PDF, delivered only to authorized + consent-cleared viewers via server-side restrictive RLS). No new tables; every backend change was additive and impersonation-verified, both frontends were applied by Cole and build clean, and F2 was validated end-to-end in the live UI. Nothing backend is pending.

## SESSION OPEN — read canonical docs from `cbastianBWE/brainwise-internal-docs` (repo ROOT, not `docs/`) via GitHub MCP `get_file_contents` before proposing:

- `build-queue.md` + `build-queue-APPEND-session176.md`
- `architecture-reference.md` + `architecture-reference-APPEND-session176.md`
- `session-176-to-177.md` (this file)
- Scope docs if D2 is picked up: none exists yet — D2 needs a backend-first scope pass first.

Version markers after this closeout: **Build Queue v87, Architecture v83**.

## Confirm live state in Supabase before proposing (Supabase is source of truth over docs):

- Edge-function versions this session shipped: `generate-ptp-narrative` **v3**, `calculate-scores` **v74**, `generate-team-narrative` **v11**, `generate-paired-narrative` **v16**. Confirm these are live before building on them.
- F2 backend live: functions `bw_is_team_leader_of`, `bw_all_subjects_consent`, `bw_can_see_leadership_content`; extended `bw_can_read_team_profile` / `bw_can_read_paired_profile`; restrictive RLS policies `tpsec_leadership_gate` (team_profile_sections) and `ppsec_leader_actions_gate` (paired_profile_sections). No new tables.

## PRIORITIES, IN ORDER (Cole to confirm the pick):

### 1. F2 backfill decision (small, close the last F2 gap)

`useNarrativeGenerator` early-returns when a report's `narrative_status === 'complete'`, so a privileged user opening a PRE-EXISTING complete team/paired report does NOT backfill the new `leadership` / `leader_actions` section — only newly generated reports get it. Decide and build: either a targeted "generate just the missing leadership section" path (reset-and-regenerate only that unit, or a one-off admin action), or accept new-reports-only and document it. Backend-first; verify by opening an old report as a privileged viewer and confirming the section appears.

### 2. Scope + build D2 — surface My Coaching in the development plan

Shape locked in Session 175: "Both" (read-only coaching surface + actionable Add-to-plan); content = Review & Action Plans + Completed activities. Needs a backend-first scope pass (which RPCs/views feed the DP surface — reuse the `coaching_activities_public` read path, not the base table) before any Lovable prompt.

### 3. Optional — live team `leadership` check

The paired `leader_actions` path was exercised live end-to-end; the team `leadership` path was validated by parity only (same component, same 3-object shape, same restrictive-RLS pattern, same PDF renderer). If Cole wants belt-and-suspenders, generate a ≥6-member team report and confirm the modal + PDF live.

## Decisions locked in Session 176 (recap)

- **Impact table unified on `facet_insights_all`** — generated once from scores, identical across professional / personal / combined contexts and across all render locations (sections 6/7, responses, PDF).
- **Leader UI gated on DATA PRESENCE, not `canSeePrivileged`.** Because RLS is the authoritative deliverer of the leadership row, presence == authorized; a team leader is usually a `corporate_employee` (`canSeePrivileged === false`) and must still see it. This is the pattern for RLS-delivered privileged content going forward.
- **Leadership content is a MODAL** in both team and paired reports, printable on the leader PDF. For teams it is a concise top-3 (`{headline, detail, action}` × 3), NOT a repopulation of the detailed `leader_brief`.
- **Server-side enforcement** via restrictive RLS (chosen over client-only gating).
- **Leader entry point reuses the existing "Shared With Me" pages** — no new page; `bw_list_my_reports` flows through the extended read gates.
- **F2 open/admin access is also consent-gated** (Cole's "B" for leader/supervisor); broad-consent = ALL subjects, implemented as a tunable constant.

## Open questions / things to lock in Session 177

- F2 backfill: backfill existing complete reports vs new-reports-only (Priority 1 above).
- D2: the exact DP-surface data sources (backend-first scope) before building.

## Bugs surfaced in Session 176 added to Build Queue

- **UX/BUG [MED]** — new `leadership` / `leader_actions` sections do not backfill onto reports already at `narrative_status = 'complete'` (generator early-returns). See Priority 1.
- **HYGIENE [LOW]** — `leader_brief` / `coach` still gated client-side (`canSeePrivileged`) on top of their server gate; align to the presence-gated pattern when convenient.
- **HYGIENE [LOW]** — rotate any plaintext passwords in the app repo to env-only.

## What's NOT in scope for Session 177 unless Cole raises it

- F5 (needs Cole's recollection of the "drip campaign" intent), F4 (content-gated), F6 (pricing decision) — all blocked on external decisions. F3 is buildable when Cole prioritizes it.

## Architecture additions in Session 176 (recorded in `architecture-reference.md`)

- New functions `bw_is_team_leader_of`, `bw_all_subjects_consent`, `bw_can_see_leadership_content`; extended `bw_can_read_team_profile` / `bw_can_read_paired_profile` (leader + supervisor branches; paired work-mode only).
- Restrictive RLS policies `tpsec_leadership_gate`, `ppsec_leader_actions_gate`.
- Edge functions: new `generate-ptp-narrative` (v3), `calculate-scores` v74, `generate-team-narrative` v11 (`leadership`), `generate-paired-narrative` v16 (`leader_actions`).
- Frontend: `LeadershipModal` component; presence-gated leader-UI pattern; F1 `useNarrativeGenerator` `kind: "ptp"`.

## Test fixture state at end of Session 176

Test org: BrainWise Test Corp. Look up current test-user UUIDs via Supabase MCP (`SELECT id, email FROM users WHERE email LIKE 'testclientbwe+%@gmail.com'`); password is in `userMemories`.

- F2 E2E created one **work-context paired report** for two test-org members (`testclientbwe+orgmember` + a second test member), released to subjects, with `leader_actions` generated. It is LEFT in place as a valid test report and is the quickest way to re-open the leader modal live (as super-admin, or as the supervisor via "Paired Reports Shared With Me").
- During E2E the org member's `supervisor_user_id` was temporarily pointed at `testclientbwe+supervisor` to exercise the supervisor gate, then **reverted to null at close**. No fixtures left dirty; the gate-verification transactions were rolled back.

## At session close: markdown only (no docx). Write `build-queue-APPEND-session177.md`, `architecture-reference-APPEND-session177.md`, `session-177-to-178.md`; bump version markers to **v88 / v84**; sanitize (no UUIDs, production emails, secrets, passwords, Stripe IDs, publishable/anon keys); hand the md bundle to drag-upload to GitHub.
