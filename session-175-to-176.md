# BrainWise — Session 176 opener

*Closeout: Session 175 (off-wave punch-list track). Open: Session 176.*

Session 175 was a single client-supplied punch list: 9 numbered items (A1, A2, B1–B3, C1, C2, D1, E1) worked top to bottom, plus 2 Development-Plan bugs that surfaced mid-session, all fixed backend-first and verified. Then two features were scoped for a later build (F1, F2) and one explained + shape-locked (D2). No new tables; every backend change was additive and impersonation-verified.

## SESSION OPEN — read canonical docs from `cbastianBWE/brainwise-internal-docs` (root) via GitHub MCP `get_file_contents` before proposing:

* `build-queue.md` + `build-queue-APPEND-session175.md` (this track)
* `architecture-reference.md` + `architecture-reference-APPEND-session175.md`
* `session-175-to-176.md` (this file)
* Scope docs for the pending builds: `PTP_Individual_Sectioned_Generation_Scope_v1.md` (F1), `F2_Team_Paired_Leadership_Section_Scope_v1.md` (F2).

Note: canonical docs are at repo **root**, not `docs/`. Version markers after this closeout: **Build Queue v86, Architecture v82**.

## Confirm live state in Supabase before proposing (Supabase is source of truth over docs):

* Edge-function versions this session shipped: `generate-paired-narrative` **v14**, `calculate-scores` **v73** (via v72). Confirm these are the live versions before building on them.
* No new tables or columns this session. The F2 build will touch `bw_can_read_team_profile` / `bw_can_read_paired_profile`, add `bw_can_see_leadership_content` + `bw_is_team_leader_of`, and extend `generate-team-narrative` / `generate-paired-narrative` — none of that is built yet.

## PRIORITIES, IN ORDER (Cole to confirm the pick):

1. **Build F2 — leadership section + leader access (decisions locked, backend-first).** Follow the sequence in `F2_Team_Paired_Leadership_Section_Scope_v1.md`: gates + helpers first (leader/supervisor read branches, leader→work-paired branch, `bw_can_see_leadership_content`, all-members-consented helper), verified via the full impersonation matrix in rolled-back transactions; then the `leadership` / `leader_actions` narrative sections; then the frontend (gated render + leader entry point to team members' work-context paired reports).
2. **Build F1 — individual PTP sectioned generation.** Per `PTP_Individual_Sectioned_Generation_Scope_v1.md`: finalize the section_type → visible-section mapping from `MyResults` / `PTPNarrativeSections`, build `generate-ptp-narrative` (plan + one-section contract wrapping the existing generators), switch `calculate-scores` off the fan-out, extend `useNarrativeGenerator` with `kind: "ptp"`, add the "Section X of 12" progress + per-section retry. Content stays identical; forward-only migration.
3. **Scope + build D2 — surface My Coaching in the development plan.** Shape locked: "Both" (read-only coaching surface + actionable Add-to-plan); content = Review & Action Plans + Completed activities. Needs a backend-first scope pass (which RPCs/views feed the DP surface) before a prompt.

## OPEN DECISIONS on the pending scopes (resolve before/at build):

* **F1 progress-count basis:** show all 12 sections with data ones instant-complete (recommended, matches Cole's "12 sections" mental model) vs count only the ~6 AI sections. Also: fold the overview (`ai_narrative`) into the tracked set (recommended); dedicated `generate-ptp-narrative` vs extend an existing function; PTP (INST-001) first vs PTP + NAI (INST-002) together.
* **F2 broad-consent threshold:** locked at ALL members consented, implemented as a tunable constant so it can be relaxed to a fraction later without a rebuild.

## DEFERRED / NEEDS COLE (from the F-series triage):

* **F5 — no "drip campaign" scope exists** in any accessible doc. Needs Cole's recollection of the intended behavior before it can be scoped.
* **F3 buildable; F4 content-gated; F6 needs a pricing decision** before scoping.

## DECISIONS LOCKED (Session 175):

* A1 fixed deterministically (compute the protection carrier server-side, constrain the prompt) rather than by prompt-nudging.
* A2 failure semantics: a PTP report is `failed` only on a total wipeout of its section calls; transient sub-call failures retry and do not condemn the report.
* C1: the assessment anchor/instruction note is removed for **all** instruments (it was never PTP-specific).
* Coaching activity metadata for non-coach views is read from `coaching_activities_public`, not the base `coaching_activities` table (table GRANT denies the base table before RLS).
* F2 consent model fully locked (admins consent-gated; supervisor gated on `share_ptp_with_supervisor` + `supervisor_dashboard_enabled`; leader on `share_ptp_with_team`; broad-consent = ALL members, tunable; leader sees any work pair containing one team member; no leadership section on personal/romantic paired modes).
* D2 shape locked: Both (read-only + actionable); content = Review & Action Plans + Completed activities.

## STANDING GATES / GUARDRAILS (unchanged, reaffirmed):

* SECURITY SEQUENCING: never revoke a base table's `authenticated` read until the repointed frontend is PUBLISHED live AND verified. This session made only additive/frontend changes — nothing to revoke.
* BACKEND-FIRST + VERIFY: every backend change went in and was impersonation-verified in rolled-back transactions before any Lovable prompt. Continue for F1/F2.
* Credit conservation: read the exact live frontend at a GitHub SHA before writing a Lovable prompt; verify shipped files after.
* Diagnose before prescribing: D1 this session confirmed the value of empirical impersonation — the real cause (table-GRANT denial) was none of the first-guess hypotheses.

## Test fixture state at end of Session 175

Test org: BrainWise Test Corp. Look up current test-user UUIDs via Supabase MCP (`SELECT id, email FROM users WHERE email LIKE 'testclientbwe+%@gmail.com'`); password is in `userMemories`. This session used existing fixtures for verification only (paired/PTP re-scores rolled back or self-healed); no fixtures left dirty.

## What's NOT in scope for Session 176 unless Cole raises it

* F5 (needs Cole's recollection), F4 (content-gated), F6 (pricing decision) — all blocked on external decisions.

## At session close: markdown only (no docx). Write `build-queue-APPEND-session176.md`, `architecture-reference-APPEND-session176.md`, `session-176-to-177.md`; bump version markers to **v87 / v83**; sanitize (no UUIDs, production emails, secrets, passwords, Stripe IDs, publishable/anon keys); hand the md bundle to drag-upload to GitHub.
