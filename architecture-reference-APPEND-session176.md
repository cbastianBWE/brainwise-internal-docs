# Architecture Reference — APPEND Session 176

*Append to `architecture-reference.md`. Version marker **v83** (Session 176 CLOSE). Covers the builds of F1 (individual PTP sectioned generation) and F2 (leadership section + leader access, with server-side enforcement). No new tables. No base-table read revokes. All changes additive: new gate/helper functions, two restrictive RLS policies, and edge-function section additions.*

## Edge functions

- **`generate-ptp-narrative` (new, live v3)** — individual PTP sectioned generation. Plan / one-section / orchestrate contract mirroring `generate-paired-narrative`: no `section_type` → `{narrative_status, sections_expected, sections_done}`; `section_type=<key>` → generate one tracked unit, write its row, recompute status. Keyed by `assessment_result_id` + `narrative_context` (professional / personal / combined). Orchestrate mode runs background via `EdgeRuntime.waitUntil` and returns immediately. GATE_UNITS per context: `overview_narrative_<ctx>` (delegates to the existing context-narrative generator; writes `profile_overview_<ctx>` + `personal_summary_<ctx>`), `dimension_highlights_<ctx>`, `cross_and_action_<ctx>`; report-level `ai_narrative` and `facet_insights_all`. Excludes `driving_facets` (frontend recomputes) and `coach_questions` (best-effort, not gated). Class-A custom auth (`verify_jwt:false`; internal-secret OR JWT + read-gate).
- **`calculate-scores` v73 → v74** — PTP branch stamps `narrative_status = 'pending'` and fires `generate-ptp-narrative` orchestrate via `EdgeRuntime.waitUntil`; retired the 15-call fan-out and the separate `generate-all-facets` fire; `generate-report` gated to the non-PTP path. `narrative_status` lifecycle for PTP is now `pending → generating → complete` (the frontend maps any unknown/legacy value to `ready`).
- **`generate-team-narrative` v10 → v11** — added `"leadership"` to the expected set: `["team_in_three","driving_facets","communication","conflict","leadership","leader_brief","coach"]`. The `leadership` case emits the top 3 things the team's leader most needs to know, each with one concrete move, as a JSON array of exactly 3 `{headline, detail, action}` objects (same shape as `team_in_three`; deliberately smaller than the detailed `leader_brief`).
- **`generate-paired-narrative` v14 → v16** — `expectedFor("work")` = `[...BASE_SECTIONS, "leader_actions"]`; new `leader_actions` case emits 3 `{headline, detail, action}` objects for WORK pairs only. All original v14 prompt strings preserved verbatim (a v15 that had condensed VOICE / conflict-repair anchors / needs COVERAGE RULE / protection-framing rule was discarded; v16 was redeployed from an exact v14 base plus only the two intended additions).

## New gate / helper functions (F2)

- **`bw_is_team_leader_of(p_member) → boolean`** (SECURITY DEFINER, stable) — true when the caller (`auth.uid()`) is the `manager_user_id` of a team that contains `p_member`.
- **`bw_all_subjects_consent(p_subject_ids uuid[], p_audience text) → boolean`** — a subject counts as consenting when `share_ptp_full` OR the audience-specific `sharing_preferences` flag (`team` / `supervisor` / `organization` / `company_admin`) is true. Empty subject set → false. Threshold is a **tunable constant** (`required_fraction`, locked at `1.0` = ALL subjects; lowerable later to a fraction without a rebuild).
- **`bw_can_see_leadership_content(p_profile, p_kind) → boolean`** — the leadership-section visibility gate. Paired: work mode only. Ungated for generator (`generated_by`), super-admin, and org-coach; consent-gated (all subjects, via `bw_all_subjects_consent`) for org-admin (`organization` audience), company-admin (`company_admin`), team-leader (`team`), and supervisor (`supervisor` + `corporate_contracts.supervisor_dashboard_enabled`).
- **Extended `bw_can_read_team_profile`** — existing branches preserved; added (a) a team-LEADER branch: `teams.manager_user_id = auth.uid()` for the report's team AND all subjects consent to `team`; (b) a SUPERVISOR branch: supervises ≥1 subject (`users.supervisor_user_id`), org contract `supervisor_dashboard_enabled`, all subjects consent to `supervisor`.
- **Extended `bw_can_read_paired_profile`** — same two additive branches, **`relationship_mode = 'work'` only**. The leader branch uses `bw_is_team_leader_of` over the pair's subjects.

## Server-side enforcement — restrictive RLS (F2)

- **`tpsec_leadership_gate`** on `team_profile_sections` — RESTRICTIVE, SELECT, role `authenticated`: `section_type <> 'leadership' OR bw_can_see_leadership_content(team_profile_id, 'team')`.
- **`ppsec_leader_actions_gate`** on `paired_profile_sections` — RESTRICTIVE, SELECT, role `authenticated`: `section_type <> 'leader_actions' OR bw_can_see_leadership_content(paired_profile_id, 'paired')`.
- These AND with the existing permissive read policies (`tpsec_read` / `ppsec_read`). For every non-leadership `section_type` the predicate is TRUE (no-op); for the leadership row it additionally requires the gate. Restrictive policies can only REMOVE access, never widen it, so this is a safe, additive enforcement layer. The permissive read policies already gate `coach` / `leader_brief` behind `current_user_can_see_privileged_sections()`; the new policies are orthogonal.

## Frontend architecture notes (no schema change)

- **New `LeadershipModal` component** (`src/components/results/LeadershipModal.tsx`) — renders an array of `{headline, detail, action}` items with an optional `transform` (paired passes the report's `nm` name-substitution so `Person A/B` placeholders resolve to first names). Reused by both team and paired reports.
- **Presence-gated leader UI (pattern).** The "For the leader" button, the modal, and the Export "For the leader" toggle are gated on the leadership section **existing in the fetched sections** (`sections["leadership"]` / `sections["leader_actions"]`), NOT on the client `canSeePrivileged` flag. Because delivery is enforced by restrictive RLS, presence == authorized; a team leader (usually a `corporate_employee`, `canSeePrivileged === false`) still gets the row and thus the UI. This is the correct pattern for any RLS-delivered privileged content and is preferable to the pre-existing client-side `canSeePrivileged` gating still used for `leader_brief` / `coach`.
- **PDF path.** `assembleTeamPdfData` / `assemblePairedPdfData` carry `leadership` / `leader_actions` through and do NOT delete them in the `!canSeePrivileged` block (only `leader_brief` / `coach` are deleted there). The team + paired PDF generators render the section mirroring `team_in_three` / `pair_in_three`. `ExportPdfModal` shows the toggle only when `leadershipAvailable` / `leaderActionsAvailable` is passed true.
- **Leader entry point.** No new page/route. `bw_list_my_reports` already filters on `bw_can_read_team_profile` / `bw_can_read_paired_profile`, so the F2 read-gate extensions flow through to the existing un-guarded `/shared/team-reports` and `/shared/paired-reports` pages. The report routes (`/team-report/:id`, `/paired-report/:id`) have no RoleGuard; RLS decides access.
- **F1 generation hook.** `useNarrativeGenerator` extended with `kind: "ptp"` (`FN_NAME.ptp = "generate-ptp-narrative"`, `ID_KEY.ptp = "assessment_result_id"`, `context` param, once-per-`(id + context)`). Note the team/paired auto-run early-returns when `status === 'complete'`, so it does not backfill new sections onto already-complete reports (see 176 build-queue follow-up).

## Confirmed data model (referenced by F2, unchanged)

- `team_profile_sections` / `paired_profile_sections` (`section_type` free text, `content` jsonb-in-text, unique on `(profile_id, section_type)`, `narrative_status` ∈ pending/generating/complete/error). `teams(manager_user_id)`; `team_members`; `users.supervisor_user_id`; `sharing_preferences` per-user flags; `corporate_contracts.supervisor_dashboard_enabled`. `facet_insights_all` (context-free per-facet impact tables, now the single source for all render locations).

## Verification method (unchanged house style)

Backend gates verified by role + minted-JWT impersonation inside `BEGIN … ROLLBACK` transactions across the leader / supervisor / subject / stranger matrix, with consent toggled on/off and the supervisor contract dependency exercised. The restrictive-RLS wiring was verified by `set local role authenticated` + `set_config('request.jwt.claims', …)` against real profiles with the gated rows inserted inside the same rolled-back transaction. F2 was then validated end-to-end in the live UI (real generation → modal → supervisor consent-gated view). F1 was browser-verified as a user.

## Not changed / caveats

- No new tables; no base-table read revokes; no new standing numbered rules.
- The generator does not backfill the new leadership sections onto reports already at `narrative_status = 'complete'` (see follow-up).
