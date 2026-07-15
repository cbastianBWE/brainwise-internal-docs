# F2 — Team/Paired Leadership Section + Leader Access (Scope v1, decisions locked)

**Status:** Scope complete — ready for backend-first build. **Author:** Session 175, item F2.
**Goal:** Add a leader-facing **leadership section** (high-level overview + action items) to the team report and work-context paired reports, visible to a defined privileged audience while honoring each member's sharing consent; and give the **team leader access to the work-context paired reports** of their team members.

## Confirmed data model
- **Team** = `teams` (id, organization_id, name, **manager_user_id**). **Leader = `teams.manager_user_id`.**
- **Team membership** = `team_members` (team_id, user_id, role).
- **Supervisor** = `users.supervisor_user_id` (per person).
- **Sharing consent** = `sharing_preferences` per user: `share_ptp_with_supervisor`, `share_ptp_with_team`, `share_ptp_with_organization`, `share_ptp_with_company_admin`, `share_ptp_with_direct_reports`, `share_ptp_full`.
- Supervisor dashboards gated at contract level by `corporate_contracts.supervisor_dashboard_enabled`.
- Existing report gates (unchanged base): `bw_can_read_team_profile` / `bw_can_read_paired_profile` (generator / super-admin / org-admin / org-coach / report grant / subject + `released_to_subjects`); coach-content gate `ptp_show_coach_content`.

## Visibility model

### 1. Who can OPEN the report — extend the existing read gates (additive)
Add two branches to `bw_can_read_team_profile` / `bw_can_read_paired_profile`:
- **Leader** — `teams.manager_user_id` of the team the report is about (team), or of a team containing a subject (paired, work mode).
- **Supervisor** — a viewer who is `users.supervisor_user_id` of any subject in the report.
Company/org admin, org coach, generator, super-admin, and subject are already covered.

### 2. Who sees the LEADERSHIP SECTION — the leadership audience (not regular subjects)
- Super-admin, report generator, org coach / generating coach — always.
- Team leader (`manager_user_id`) — yes.
- Company admin / org admin (same org) — yes.
- Supervisor of a subject — yes, subject to consent + contract flag.

### 3. Consent gate (LOCKED — everyone but the report-owners is consent-gated)
Consent is checked per member against the viewer's audience (or `share_ptp_full`):
- **Supervisor** viewer → member's `share_ptp_with_supervisor` **AND** contract `supervisor_dashboard_enabled`.
- **Team leader** viewer → member's `share_ptp_with_team`.
- **Org admin** viewer → member's `share_ptp_with_organization`. *(Decision: admins ARE consent-gated.)*
- **Company admin** viewer → member's `share_ptp_with_company_admin`. *(Decision: admins ARE consent-gated.)*
- **Generator / super-admin / coach** → full access, no per-member consent gate (they hold the whole report).

**Broad-consent rule (LOCKED):** the leadership section is shown to a given viewer **only when all members have consented to that viewer's audience** (`share_ptp_full` counts). If any member has not consented for that viewer, the section is withheld for that viewer. *(Threshold = ALL members; implement as a tunable constant so it can be relaxed to a fraction later if desired.)*

New gate: `bw_can_see_leadership_content(p_profile, p_kind)` — viewer-role check + the all-members-consented check reading `sharing_preferences` (+ `supervisor_dashboard_enabled` for supervisors).

## Content (the leadership section)
Generated from the report's `structured` data, mirroring the existing sectioned pattern:
- **Team overview (leader lens)** — the team's dynamics at a glance for whoever manages it.
- **Leader action items** — concrete moves for the leader/manager, grounded in the team's drivers.
- **Work-context paired report** — leader action items on that specific pair.
Implemented by extending `generate-team-narrative` with a `leadership` section and `generate-paired-narrative` with a `leader_actions` section (work mode). Gated to the leadership audience in the frontend (like the existing coach section).

## Leader → work-context paired access (LOCKED: "any work pair with one team member")
The leader can open any **work-context** (`relationship_mode = 'work'`) paired report where **at least one subject is a member of the leader's team** (`team_members`), with leader action items on it. Additive branch in `bw_can_read_paired_profile`.

## Build sequence (backend-first)
1. **Gates & helpers:** `bw_is_team_leader_of(member)`, leader/supervisor branches on the two read gates, the leader→work-paired branch, `bw_can_see_leadership_content(...)`, and the per-member consent helper (all-members-consented, tunable). Verify via impersonation matrices (leader / supervisor with & without consent + contract flag / org-admin / company-admin with & without consent / coach / generator / super-admin / non-privileged subject), in rolled-back transactions.
2. **Generation:** add the `leadership` section to `generate-team-narrative` and the `leader_actions` section to `generate-paired-narrative` (work mode). Verify content against a fixture team/pair.
3. **Frontend:** render the leadership section in `TeamReport` / `PairedReport` gated by `bw_can_see_leadership_content`; add a leader entry point to the team's work-context paired reports. Read the live report pages at a GitHub SHA before the Lovable prompt; verify shipped files after.
4. End-to-end verification across the audience matrix on fixtures.

## Decisions — all locked
1. **Admin consent:** org/company admins ARE consent-gated (on `share_ptp_with_organization` / `share_ptp_with_company_admin`).
2. **Broad-consent rule:** show only when ALL members consented to the viewer's audience (tunable threshold).
3. **`share_ptp_with_direct_reports`:** out of scope for the leader-sees-team view (default).
4. **Non-work paired modes:** no leadership section on personal/romantic paired reports; work-context only (default).
