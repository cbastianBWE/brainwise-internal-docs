# Build Queue — APPEND Session 175

*Append to `build-queue.md`. Version marker **v86** (Session 175 CLOSE). Another off-wave, client-supplied punch-list session: 9 numbered bugs (A1, A2, B1–B3, C1, C2, D1, E1) plus 2 mid-session Development-Plan follow-ups, all fixed backend-first and verified; then two features scoped for a later build (F1 individual-PTP sectioned generation, F2 team/paired leadership section + leader access) and one feature explained/scoped (D2 surface My Coaching in the development plan). Every backend change was additive and impersonation-verified in rolled-back transactions before any Lovable prompt was written.*

## Headline

- **All 9 punch-list items fixed + verified**, each diagnosed backend-first. 2 edge-function fixes (A1, A2), 7 frontend fixes (B1–B3, C1, C2, D1, E1) delivered as Lovable prompts and applied by Cole.
- **2 extra Development-Plan bugs** surfaced and fixed mid-session (empty-state for Team/Paired tabs; Person A/B → real names on paired dev-plan suggestions).
- **2 scope docs authored** (F1, F2) — ready for backend-first build next session. **D2 explained + shape locked** (build not started).

## SHIPPED — edge-function bug fixes (deployed + verified live)

- **A1 — Paired "protection framing" bullet inverted.** `generate-paired-narrative` **v14**. Added a deterministic `protectionCarrier(facets)` helper (returns which partner carries the protective load: fragile facets weighted 2×, 1.5× dominance threshold, null when neither dominates) and a `protectionFramingRule(carrier)` string injected into the `needs` section prompt as an authoritative constraint, so the model can no longer flip who is protecting whom. Deployed; the one affected report's section was deleted to self-heal and regenerated + verified correct.
- **A2 — a single transient sub-call failure flipped a whole PTP report to `failed`.** `calculate-scores` **v72 → v73**. v72 added the `x-internal-secret` header to the fan-out `generate-facet-interpretations` invocations (server-to-server auth was missing). v73 added `invokeFacetWithRetry` (3 attempts, backoff `attempt*1500 + jitter`) and changed the final status so a report is only marked `failed` when **all** section calls fail (`failures.length >= results.length ? "failed" : "ready"`) — one transient 503 under concurrency no longer wipes the report. Verified via a full-pipeline re-score of a test fixture.

## SHIPPED — frontend fixes (Lovable prompts, applied + verified)

- **B1–B3 — Development-Plan "Add to plan" commitment flow polish.** `AddReportCommitmentModal.tsx`: wording now derives from `kindWord` (`reportKind === "team" ? "team" : "paired"`) instead of hardcoded "team"; report-derived suggestions render as **labeled buckets** via a new `suggestionGroups` prop (`{label, items[]}[]`); the shared scope sentinel value stays `"team"`. `TeamReport.tsx` / `PairedReport.tsx` now pass strengths and focus actions as two groups ("Continue / next steps", "Things to try").
- **DP follow-up 1 — Team/Paired tabs showed a "Couldn't load" error for super-admin when empty.** `ReportCommitmentsTab.tsx`: added a `safe` per-RPC helper (try/catch → `[]`), removed the error branch, and render the **My-Development-style empty card** (Target icon + link to the shared-reports list) until real commitments exist. Report cards only render when `hasCommitments`.
- **DP follow-up 2 — paired dev-plan suggestions said "Person A"/"Person B".** `PairedReport.tsx`: suggestions now pass through an `nm` callback that swaps `Person A`/`Person B` for the two subjects' first names, matching the rest of the paired report. (`TeamReport` needs no swap.)
- **C1 — assessment "anchor" instruction note removed everywhere.** `AssessmentFlow.tsx`: removed the note block and its now-unused `AlertTriangle` import. (Decision: the note was NOT PTP-specific — it rendered for every instrument — so Cole chose "remove everywhere.")
- **C2 — answering the last missed item now jumps straight to review/submit.** `AssessmentFlow.tsx`: a `useEffect` on `(allAnswered && reviewingUnanswered)` clears the reviewing-unanswered state and opens the review screen; `goToNextUnanswered` does the same when its scan returns "no next unanswered."
- **D1 — coaching session view blanked for the session owner.** Root cause found by impersonation: `permission denied for table coaching_activities` (table-level GRANT, checked before RLS). `CoachingSessionView.tsx` now fetches the session without the embed, then reads `title, tier, definition` from the `coaching_activities_public` view and attaches it as `coaching_activities`, so the view renders.
- **E1 — folder "Move" button hidden for top-level resource folders.** `ResourceFolderManager.tsx`: the Move button in `FolderRow` is now unconditional (removed the `{isSubfolder && …}` wrapper), so top-level folders can be re-parented too.

## SCOPED — build next session (no build yet)

- **F1 — Individual PTP report: mirror the team/paired SECTIONED generation architecture.** Change *how* the individual PTP generates (per-section tracked calls, `sections_expected`/`sections_done` contract, live "Section X of 12" progress, per-section failure isolation + retry) while keeping content, structure, and the on-screen report **identical**. NOT merging the individual and team/paired codepaths — mirroring the pattern. 12 sections + 3 contexts (professional / personal / combined) captured; impact table shared across contexts. Full detail: `PTP_Individual_Sectioned_Generation_Scope_v1.md`.
- **F2 — Team/paired leadership section + leader access (decisions LOCKED).** Add a leader-facing leadership section (team overview + leader action items) to team and work-context paired reports, gated to a privileged audience (leader = `teams.manager_user_id`, supervisor, org/company admin, org/generating coach, super-admin) and honoring each member's `sharing_preferences` consent; plus give the team leader read access to any work-context paired report containing one of their team members. All consent/admin/broad-consent decisions locked. Full detail: `F2_Team_Paired_Leadership_Section_Scope_v1.md`.

## EXPLAINED / SHAPE LOCKED — D2 (surface My Coaching in the development plan)

- **What it is:** bring the member's My Coaching content into the Development Plan surface. **Shape (Cole): "Both"** — a read-only coaching surface AND an actionable "Add to plan" path. **Content:** Review & Action Plans + Completed activities. Build not started; ready to scope backend-first next session.

## FOLLOW-UPS / OPEN

- **F5 — no "drip campaign" scope exists** in any accessible doc; needs Cole's recollection of intent before it can be scoped.
- **F3 buildable; F4 content-gated; F6 needs a pricing decision** before scoping (from the F-series triage).

## APPLY / VERIFY STATE at 175 close

- Applied + confirmed by Cole this session: A1, A2, B1–B3, both DP follow-ups, C1, C2, D1, E1 (all verified working).
- All backend is deployed and verified; nothing backend is pending. F1/F2/D2 are scope-only.
