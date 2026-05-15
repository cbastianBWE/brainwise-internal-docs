# Security Audit Finding 6 — Product Questions

*Resolved Session 71. Migration `security_audit_finding_6_per_instrument_visibility` shipped. Reference doc for future per-instrument visibility scoping decisions.*

---

## Context

During the Session 71 security audit, after closing Findings 1-3 (anon exposure on 27 tables + 1 ERROR view + 7 mutable-search-path functions), a separate within-app visibility-model gap was identified.

**The documented per-instrument visibility model is:**

- **PTP (INST-001)** — shareable via the user's privacy toggles (supervisor / team / whole organization / org/company admin) plus peer access requests.
- **AIRSA (INST-003)** — always viewable by the rated employee's supervisor and by org/company admins (dual-rater instrument by design).
- **NAI (INST-002)** — individual-only. Aggregate-only at org dashboard level.
- **HSS (INST-004)** — individual-only. Aggregate-only at org dashboard level.

**The current RLS did not enforce this for the corporate-admin and coach paths.** Specifically, prior to the Session 71 fix:

| Policy | Table | Instrument-scoped? |
|---|---|---|
| `assessments: corporate admins read their org's assessments` | `assessments` | **No** |
| `assessments: coaches read client assessments` | `assessments` | **No** |
| `assessments: managers read assessments they ordered` | `assessments` | **Yes** — correctly splits AIRSA from non-AIRSA |
| `acks: corporate admins read org acks` | `assessment_acknowledgments` | **No** |
| `acks: coaches read client acks` | `assessment_acknowledgments` | **No** |
| `assessment_results: coaches read client results` | `assessment_results` | **No** — *scores, not metadata* |
| `assessment_results: permission-gated org access` | `assessment_results` | **No** — *scores, user-opted via PrivacySettings* |
| `assessment_responses: coaches read client responses` | `assessment_responses` | **No** — *raw item-level responses* |

**Lovable's deep dive on the leak surface** (Session 71 round 2 diagnostic):

- The Session 71 initial framing said only completion **metadata** leaks. That was incorrect.
- `assessment_results` IS instrument-blind for the coach and permission-gated org admin paths. **Scores could leak**, not just metadata.
- Mitigating factor for coaches: per `CERT_TYPE_TO_INSTRUMENTS` in `src/pages/coach/CoachClients.tsx`, three certification types (`ai_transformation_coach`, `ai_transformation_ptp_coach`, `my_brainwise_coach`) legitimately include NAI/HSS. **The coach-reads-NAI/HSS path is by design.**
- Mitigating factor for org admins via `permissions`: this path is currently DORMANT. Zero rows in production have `viewer_organization_id` set (verified live Session 71). PrivacySettings only writes `viewer_user_id` rows for peer sharing.

The actual unconsented leak surface at session open was `assessments` and `assessment_acknowledgments` completion-metadata to corporate admins regardless of instrument.

## Pre-flight signals

Lovable grepped `src/pages/admin/` and `src/pages/company/` for `from('assessments'|'assessment_results'|'assessment_responses'|'assessment_acknowledgments')` — **zero hits**. Admin and company-dashboard pages query through RPCs and aggregated tables (`org_dashboard_narratives`, `org_interventions`, `ai_usage_counters`, `company_admin_audit_log`), never directly per-assessment row. Scoping the corporate-admin policies on `assessments` and `assessment_acknowledgments` would not have broken any frontend.

The supervisor-AIRSA path was a separate gap: there was no policy on `assessments` letting a non-admin supervisor read their reports' AIRSA assessment metadata. Today this is delegated entirely to `assessment_results` via `airsa_role_access()`. If any UI tried to render "your report's AIRSA is in_progress" from `assessments`, it would have failed RLS.

---

## Product questions and Session 71 answers

### Q1 — Is corporate-admin visibility into NAI/HSS completion metadata intentional?

The current `assessments: corporate admins read their org's assessments` policy lets a `company_admin` or `org_admin` SELECT every row in `assessments` for every user in their org, including NAI (INST-002) and HSS (INST-004) rows. Scores are not exposed via this path. Only that user X completed an INST-002 on a given date with a given status.

**Answer (Cole, Session 71): Option B — completion metadata is fair game.** Treat row-level completion (user, date, status, no scores) as acceptable for admin visibility on all instruments. Leave the policy as-is. The confidentiality boundary lives at scores in `assessment_results`, not at metadata in `assessments`.

**Impact**: no change to the corporate-admin policies on `assessments` or `assessment_acknowledgments`.

### Q2 — Does PrivacySettings UI offer per-instrument sharing for the `permissions` org-share path on NAI/HSS?

`assessment_results: permission-gated org access` lets org admins read scores when a `permissions` row exists with `viewer_organization_id` set. The user opts in via PrivacySettings.

**Answer (Cole, Session 71): PrivacySettings UI has PTP-only toggles.** No NAI / HSS / AIRSA share toggles exist. So even though the RLS policy was instrument-blind, the UI couldn't produce a `permissions` row that grants admin access to non-PTP instruments.

**Impact**: defense-in-depth migration applied. The `assessment_results: permission-gated org access` policy now requires `instrument_id = 'INST-001'`. RLS itself enforces what the UI already enforces. Belt-and-suspenders against any future code path that might write non-PTP `viewer_organization_id` rows.

Separately, the `permissions.viewer_organization_id` column is **dormant infrastructure** — zero rows have it set. Either wire the `share_ptp_with_company_admin` toggle to write it OR delete the column post-launch. Build queue item, not security work. The toggle works via `sharing_preferences` + `peer_ptp_visible()` already.

### Q3 — Should coach-reads-client policies be scoped by certification-type?

`assessment_results: coaches read client results` and `assessment_responses: coaches read client responses` are both instrument-blind. A PTP-only certified coach could technically see a client's NAI scores if a NAI got attached to them somehow.

**Answer (Cole, Session 71): Option A — leave as-is.** Coach-client instrument matchups are gated upstream by `CERT_TYPE_TO_INSTRUMENTS` in `src/pages/coach/CoachClients.tsx`. RLS as a third backstop adds surface area without proportional security gain. Document the layering, move on.

**Impact**: no change to coach policies on any of the four assessment-family tables.

### Q4 — Is the supervisor-AIRSA path on `assessments` (parent metadata) intentionally missing?

No policy on `assessments` lets a `corporate_employee` supervisor read their direct reports' assessment metadata. AIRSA visibility for supervisors is delegated entirely to `assessment_results` via `airsa_role_access()`.

**Answer (Cole, Session 71): Add a small supervisor-AIRSA policy.** Cole's exact framing: "it isn't a bad thing if they do see [the metadata] — the main goal is they can pull up the assessment report for their direct reports." The report (scores) path already works via airsa_role_access. The metadata path is nice-to-have for any future UI.

**Impact**: new policy `assessments: supervisors read direct reports AIRSA` added. Scoped to `instrument_id = 'INST-003' AND user_id IN (SELECT out_user_id FROM public.get_my_direct_reports())`. Uses the existing SECURITY DEFINER helper because the inline subquery against `users` returns nothing for non-admin supervisors (their `users` RLS only gives them their own row — caught by Lovable round 3 diagnosis).

### Q5 — Are there OTHER tables with the same instrument-blind admin/coach pattern that we haven't audited?

**Answer (Lovable recon, Session 71)**: the pattern is confined to the assessment-family tables (`assessments`, `assessment_acknowledgments`, `assessment_results`, `assessment_responses`). Other tables that use the `current_user_account_type() + organization_id` pattern (`ai_usage_counters`, `company_admin_audit_log`, `corporate_contracts`, `member_feature_overrides`, `org_dashboard_narratives`, `org_interventions`, `team_members`, `teams`, `users`) are all on inherently org-scoped tables with no instrument concept — not applicable to this audit.

**Standing**: if new instrument-keyed tables are added in future phases (e.g., per-instrument aggregates or per-instrument intervention recommendations), the same Q1-Q5 questions should be asked at design-time before any RLS is written.

---

## Migration shipped Session 71

`security_audit_finding_6_per_instrument_visibility` — two changes, one transaction.

**Change 1**: Dropped and recreated `assessment_results: permission-gated org access` with the `instrument_id='INST-001'` AND `current_user_account_type() = ANY(...)` pulled out as top-level ANDs (planner short-circuits — per Lovable's cosmetic recommendation) before the EXISTS-against-permissions.

**Change 2**: New policy `assessments: supervisors read direct reports AIRSA` using `get_my_direct_reports()` SECURITY DEFINER STABLE helper (search_path=public already pinned, already filters `deactivated_at IS NULL`).

**Verification**: Simulated demo-csuite-1's JWT in Test Corp (`a1d4fc3f-d635-49ae-96d4-81b0e64864c6`, supervises 2 reports). Supervisor sees 9 INST-003 rows (3 self+manager rows × 2 reports, correct for AIRSA dual-rater shape). Supervisor sees zero INST-001 / INST-002 / INST-004 rows for those reports. Working as designed.

---

## Standing pattern for future instrument-keyed RLS

Before adding any RLS policy on a table that has `instrument_id`, walk Q1-Q5 above. Default lean per the documented visibility model: A / B (defense-in-depth tighten if UI is consent-coarse) / A / A.

The Lovable diagnostic-only multi-round pattern (Session 71 used 3 + 1 half rounds) is the standing approach for any RLS change that depends on frontend read patterns. Round 1: claim diagnosis. Round 2: broaden once Lovable points to anything Claude missed. Round 3: actual fix proposal. Round 3.5: confirm the corrected fix. Ship. Each round on average catches one real issue Claude alone would have missed.
