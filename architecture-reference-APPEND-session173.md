# Architecture Reference — APPEND Session 173

*Append to `architecture-reference.md`. Follows `architecture-reference-APPEND-session172.md`. Version marker **v80** (Session 173 CLOSE). Covers the coaching run/cycle model (Fresh Start), the Review & Action Plan subsystem, the two new edge functions, the `coaching_reviews` table, the reference-library storage + grant model, and the resource-visibility mechanism (grants, not the `audiences` column).*

## Coaching run/cycle model (Fresh Start)

A user's coaching journey is now versioned by an integer **run**.

- `coaching_activity_sessions.run_number` (int, NOT NULL, default 1; index `idx_cas_user_run` on user_id,run_number). Backfilled to 1 for all existing rows.
- `coaching_user_summary.current_run` (int, default 1) + `prior_runs` (jsonb, default `[]`).
- Trigger `set_session_run_number` (BEFORE INSERT on `coaching_activity_sessions`, SECURITY DEFINER fn `public.set_session_run_number()`): stamps `NEW.run_number := COALESCE((SELECT current_run FROM coaching_user_summary WHERE user_id = NEW.user_id), 1)`. Authoritative and transparent — the frontend does not set run_number.
- "Current run" = rows at `run_number = current_run`. Prior runs are bundled history.

### RPCs
- `coaching_fresh_start_rotate(p_user uuid, p_baseline jsonb) → int` — SECURITY DEFINER, **execute revoked from anon/authenticated, granted to service_role only**. `FOR UPDATE` locks the summary row; appends `{run, summary, ended_at}` to `prior_runs`; bumps `current_run`; installs `p_baseline` as the new `summary`; nulls `last_session_id`. If no summary row exists, inserts one at `current_run = 2` (archives any orphan run-1 sessions). Returns the new run.
- `coaching_current_run() → int` — SECURITY DEFINER, `COALESCE(current_run, 1)` for `auth.uid()`.
- `coaching_get_run_state() → jsonb` — `{current_run, prior_runs}` for the frontend archive UI (one call, no direct-table read needed).
- `coaching_group_access()` — updated: the `comp` (has_completed) CTE now filters `AND s.run_number = coaching_current_run()`, so completion resets visibly on Fresh Start. `accessible` (entitlement) branch unchanged. `coaching_activity_access` / `_batch` unchanged (pure entitlement gating; no completion logic).

### Edge function: `coaching-fresh-start` v1
- Auth via `getClaims`. Loads the user's active PTP (`assessment_results` where instrument_id `INST-001`, `superseded_at IS NULL`, `ai_narrative` not null, newest). Generates a PTP-seeded baseline narrative via Anthropic (`resolveModelId(admin,'coaching_analysis')`), then calls `coaching_fresh_start_rotate`. No PTP → generic baseline, `seeded_from_ptp:false`. Returns `{success, current_run, seeded_from_ptp}`. `verify_jwt:false` + manual auth (matches the coaching-* function convention).

## Review & Action Plan subsystem

### Edge function: `coaching-review-action-plan` v3
- Auth via `getClaims`. **Meters first** (see below), then reads the current run's `coaching_activity_sessions` (via `current_run` from `coaching_user_summary`) + activity titles + the PTP `ai_narrative`, and builds an activity digest (`buildDigest` — decision/positives/negatives-with-plans/analysis/chat tail).
- `mode:"generate"` (default): Claude returns a JSON object `{summary, strengths[], watch_outs[], action_plan[], themes[]}` (parsed defensively; falls back to `{summary: raw, parse_error:true}`). Persists one `coaching_reviews` row. Returns `{review, review_id, saved, run, activity_count, coaching_remaining}`.
- `mode:"ask"`: `{question, history[]}` → Q&A over the same PTP+record context (system prompt + message history). Not saved. Returns `{answer, run, activity_count, coaching_remaining}`.

### Table: `coaching_reviews`
- `(id uuid pk, user_id uuid → users ON DELETE CASCADE, run_number int default 1, review jsonb, activity_count int, created_at)`. Index on (user_id, created_at desc). RLS enabled: `read own` (`user_id = auth.uid()`) + `super admin read`. **No user insert/update/delete policy** — writes happen only via the edge function's service-role client. Saved reviews persist across runs (each tagged by `run_number`) and are shown in the History tab.

### Metering (mirrors coaching activities)
- Both modes call `POST /functions/v1/check-ai-usage` with `{usage_type:"chat_message", check_only:false}` and the caller's Authorization header, before any Anthropic call. If `!ok || allowed !== true` → HTTP **402** `{error:"coaching_limit_reached", reason}`. Super-admin exempt (check-ai-usage 9999 cap), one-time chat credits as fallback, free/inactive denied — all handled inside `check-ai-usage` (v67, unchanged). `coaching_remaining` echoed to the client. Frontend handles 402 with the existing upgrade toast (`error.context?.status === 402`), same as `runAnalysis`.

## Reference-library storage + visibility model (documented)

### Storage / rows
- Learner + coach cards are `resources` rows, category `reference_library`, one per (topic, register). PDFs live in the **`lesson-assets`** bucket (private) as `document` `content_assets` (+ `content_asset_versions`, mime application/pdf); `resources.content_asset_id` points at the asset. Thumbnails live in the **`lesson-thumbnails`** bucket (public) as `image` assets; `resources.thumbnail_asset_id` points at them. (Session 173 wired the 208 thumbnails referencing `lesson-thumbnails/inbox/…` in place — public URLs render; do not delete `inbox/`.)
- Tabs: `all_resources` (`is_coach_only=false`) holds learner cards; `coach_resources` (`is_coach_only=true`) holds coach cards. Each stage has one folder per tab (20 folders total for the reference library).

### Visibility is GRANT-based, not `audiences`-based (important)
- The `resources.audiences` array + its RLS "audience overlap" policy is a **dead path** — the app does not read it. Visibility is computed by the SECURITY DEFINER RPC **`get_user_resources`** from the grant tables `resource_access_grants` (per-resource) and `resource_folder_access_grants` (per-folder, inherited down the folder ancestry). Grant grammar: `grant_type ∈ {organization, account_type, plan_tier, corporate_level, coach_certification, all_coaches}` + `grant_value`. A resource is visible if super-admin, OR a direct grant matches, OR a folder (or ancestor) grant matches; the coach-only tab gate additionally requires coach/super-admin. `get_thumbnail_urls_for_entities` and `get_resource_content_asset` enforce the same grant logic for images / content open.
- **Reference-library grants (session 173):** folder-level on the 20 stage folders — learner folders granted `account_type` for coach/individual/corporate_employee/org_admin/company_admin; coach folders granted `all_coaches`. This is what makes the library visible; publishing rows alone does not.

## Not changed
- No base-table read revokes. No new standing numbered rules. `check-ai-usage` (v67), `coaching-activity-analyze` (v15), `coaching-activity-chat` (v3), `coaching-activity-summary` (unchanged — still does NOT inject PTP; the Fresh-Start baseline path does), `coaching-activity-embed` (v2), and the rest unchanged. `coaching_activity_access` unchanged. The semantic-search embed for the 6 Purpose Exploring activities is still pending.
