# Architecture Reference — APPEND Session 169

*Append to `architecture-reference.md`. Follows `architecture-reference-APPEND-session168.md`. Version marker v76 (Session 169 CLOSE). Covers the Purpose/Present coaching widgets and functions, the corporate-metering enforcement fix, chat input caps, and the security lockdown of the assessment/coaching data model behind presentation views.*

## New coaching widgets

- `ikigai` widget (`IkigaiRegionsView`): renders four lens lists into a brand-colored Venn (500x520 viewBox, tspan-stacked labels), each item card showing AI lens membership + reasoning with a manual override, plus a deepening-questions gate before the plan. Metered.
- `ptp_display` widget: renders the signed-in user's own five driving forces (DIM-PTP-01 Protection … 05 Pleasure) with mean + band, reusing existing results rendering. Reads the user's latest non-superseded INST-001 `assessment_results` (self-read RLS). Passive (`canAdvance` true).
- `assessment_upload` widget: uploads external assessments (pdf/image/docx) to the `coaching-user-uploads` bucket at `${user.id}/assessments/${session.id}/${uuid}.${ext}` (bucket RLS requires the first path segment = user id), inserts a `coaching_assessment_uploads` row, then invokes `coaching-assessment-analyze`. Optional/skippable; ≤8 files.

## New / updated Edge Functions

- `coaching-ikigai-map` v2 (metered): reads the four lens lists, AI assigns lens membership per item with `reasoning`, server derives region overlap (`deriveRegion`), and emits a `sufficiency {enough, note, questions[]}` deepening gate (structural fallback if the model omits it). Stores `responses.ikigai_map` + `responses.analysis.html`.
- `coaching-assessment-analyze` v1 (metered): reads `coaching_assessment_uploads` for the session, downloads from `coaching-user-uploads`; PDF/image sent native to the model, docx text-extracted (unzip of `word/document.xml`). Stores `responses.assessment_analysis`. MAX_FILES=8.
- `coaching-activity-analyze` v12: `buildAnswersBlock` now serializes ALL `qa_multimodal` steps (multi-phase reflections), prefixing each with its title when multiple; backward compatible. Resolves `{assessment_analysis}`.
- `coaching-activity-chat` v3: caps inbound `message` at 4000 chars (stored history is built from it). Metering unchanged from v2.
- `ai-chat` v57: caps each `conversation_history` item's content at 8000 chars + validates item shape (`invalid_history_item`), in addition to the existing message (4000) and history-count (50) caps. Caps fire before the usage check / Anthropic call.
- `check-ai-usage` v67: corporate consume path now calls `ai_counter_increment('chat', user_id)` (the enforced counter; raises over-limit → 402). Fixes the prior gap where corporate reads used the enforced counter but writes went to a non-existent RPC → silently unlimited. Individual path (200 Base / 400 Premium) unchanged. Super admin 9999.

## Access / entitlement additions

- `coaching_activity_access(p_activity_id)`: new `requires_ptp` gate. Reads `coalesce((definition->>'requires_ptp')::boolean, false)`; after computing whether the user has a current PTP, returns `(false, 'ptp_required', tier)` when required and absent. Grant / super-admin bypass earlier in the order.
- `coaching_assessment_uploads` table: owner-scoped uploads keyed by `(user_id, coaching_session_id, storage_path, ...)`; six RLS policies scoped to `authenticated` (owner read/write/delete, super-admin read, share-based coach read). An initial over-broad all-roles `USING(true)` policy was dropped.

## Security model — presentation views + base-table lockdown (durable)

- PATTERN: sensitive assessment/coaching base tables are readable only by service_role (edge functions) and elevated paths; clients read SECURITY-DEFINER presentation views that expose only display columns. Views are `authenticated`-only (anon revoked).
  - `items` → `items_presentation` (drops the item→dimension scoring map, scoring_method, reverse/facet internals; keeps rater_type + scale_type needed by the runner).
  - `airsa_skills` → `airsa_skills_public`.
  - `coaching_activities` → `coaching_activities_public` (`definition` minus `analysis_prompt` / `chat_prompt`; replicates published + super-admin visibility so draft preview still works).
  - `dimensions` → `dimensions_public` (drops item_ids scoring map, scoring_method, trigger_logic, cross_instrument_notes).
  - `response_scales` → `response_scales_public` (scale-render columns only).
- Base `items` / `airsa_skills` / `coaching_activities` / `dimensions` / `response_scales`: SELECT revoked from authenticated + anon; permissive read policies dropped. service_role write/ALL retained.
- `trigger_logic`, `ptp_facet_types`: fully locked (no frontend reads; service_role only).
- `bw_can_read_ptp_result(uuid)` (SECURITY DEFINER, STABLE): mirrors the `assessment_results` SELECT rules (own / `direct_ptp_share_visible` / coach-of-client / super admin). `ptp_report_highlights` INSERT `WITH CHECK` now requires `viewer_user_id = auth.uid() AND bw_can_read_ptp_result(assessment_result_id)` — was existence-only (INST-001 EXISTS), enabling UUID enumeration + highlight pollution.
- `bw_can_read_paired_profile` / `bw_can_read_team_profile`: gate on `narrative_status='complete'` (was a section-count heuristic that could expose half-generated narratives).

## Frontend URL safety

- `src/lib/safeUrl.ts` `isSafeHttpUrl` (allowlist https/http/mailto/tel; rejects `javascript:`/`data:`) now guards both `window.open(resource.url_or_content)` sites (`ResourceReader.tsx`, `ResourceGridTab.tsx`); unsafe external links render as non-actionable tiles. Resource HTML render path remains DOMPurify-sanitized.

## STANDING RULE (durable) — security lockdown sequencing

- BQ-SEC-REVOKE-AFTER-PUBLISH-INVARIANT: NEVER revoke a base table's `authenticated` read until the repointed frontend is (1) PUBLISHED to the live site and (2) verified from API logs to be hitting the presentation VIEW rather than the base table. Repo-verified ≠ live. A revoke applied against an unpublished/cached bundle returns empty rows and silently breaks the flow (assessment items, coaching activity lists, AIRSA results all went dark this session until reverse-bridged). Recovery = re-grant + recreate the read policy as a temporary bridge, publish + verify, then re-revoke.

## Sanitization / discipline notes

- No metered coaching activity beyond Ikigai/0420 draft is live yet; metered analyze→check-ai-usage and 0420 upload→analyze→plan are code-verified + boot-probed, not click-through E2E.
- OPS-1 still blocks password sign-in for PTP fixtures; verify backend via simulated JWT claims + rolled-back transactions. Read exact live runner/keepsake via GitHub SHA before every Lovable prompt; verify shipped files after; only revoke base reads after the repoint is published + verified live.
