# BrainWise — Session 174 opener

Session 173 redirected off the Typical wave (at Cole's direction) and shipped the **Reference Library** (208 branded PDF cards + thumbnails + access grants), reconciled Life's Tools against OneDrive, and built the backends for two new My-Coaching features — **Fresh Start** and **Review & Action Plan** (frontend built by Cole in Lovable, typecheck passing; live E2E not yet run). Session 174: verify/close out those two features live, then resume the Typical wave where 172/173 left it.

## SESSION OPEN — read canonical docs from `cbastianBWE/brainwise-internal-docs` (root) via GitHub MCP `get_file_contents` before proposing:

* `build-queue.md` + `build-queue-APPEND-session173.md`
* `architecture-reference.md` + `architecture-reference-APPEND-session173.md`
* `session-173-to-174.md` (this file)
* `scope-frontend-hardening-coaching-runner.md` (standing frontend plan)

Note: canonical docs are at repo **root**, not `docs/`.

## Confirm live state in Supabase before proposing (Supabase is source of truth over docs):

* Reference Library: `resources` where `category='reference_library'` — expect **208 published** (104 learner in `all_resources`, 104 coach in `coach_resources`), all with `thumbnail_asset_id` set. Grants: `resource_folder_access_grants` on the 20 stage folders (10 learner → 5 account_type grants each; 10 coach → `all_coaches`).
* Run/cycle: `coaching_activity_sessions.run_number`, `coaching_user_summary.current_run`/`prior_runs` present; trigger `set_session_run_number` active. `coaching_reviews` table present (RLS read-own + super-admin).
* Edge-function versions: **`coaching-fresh-start` v1**, **`coaching-review-action-plan` v3** (metered + saves), `coaching-activity-analyze` v15, `check-ai-usage` v67, `coaching-activity-embed` v2 (others per 172 opener).
* Embed backlog: `coaching_activity_embeddings` count vs published `coaching_activities` — the 6 Purpose Exploring activities may still be unindexed (carried from 172).

## PRIORITIES, IN ORDER:

1. **Live E2E of Fresh Start + Review & Action Plan.** Log in as the **test-coach fixture** (seeded in 173 with 3 completed activities: Building Trust, Delegation, Awareness). (a) History → those 3 under the current run, no "Previous runs" yet. (b) **Review & Action Plan** → generate; confirm the 5 sections are grounded in the 3 activities, the row saves to `coaching_reviews`, and the metered decrement fires (test-coach is a real coach, not super-admin → metered). Have Cole eyeball the output quality. (c) **Fresh Start** → confirm: `current_run` 1→2, the run-1 summary archived to `prior_runs`, journey groups flip to not-completed, History current list empty, "Previous runs" collapsible shows run 1. Watch the DB alongside. **test-coach has no PTP** → the Fresh-Start baseline uses the generic fallback; add a test PTP if you want to exercise the PTP-seeded baseline.
2. **Any fixes surfaced by the E2E** (prompt tuning for the Review sections, run-filter edge cases, metering copy). Backend-first; re-verify.
3. **Resume the TYPICAL wave.** Run the pending `coaching-activity-embed` (empty body, repeat until `remaining:0`); confirm `coaching_activity_embeddings` == published count. Then **Hedgehog 0215** (3-circle Ikigai — backend-first: generalize `coaching-ikigai-map` to N circles + 3-circle Venn + activity def). Then work down Future `03b` / Present `04b` / … Typical, same cadence. Then the ADVANCED wave.

## Also worth a look (from 173):

* **`audiences` is a dead path.** Resource visibility is grant-based (`get_user_resources` over `resource_access_grants` / `resource_folder_access_grants`), NOT the `resources.audiences` column. If you ever publish new resources and they're invisible to non-admins, it's missing grants, not audiences.
* **Reference-library thumbnails serve from `lesson-thumbnails/inbox/…` in place** — do not delete that folder. Optional tidy: re-key to `resource/<rid>/<aid>.png` (needs a logged-in super-admin token for the Storage move).
* **Legacy grants gap:** the 21 PTP Coach Cards + a few brain-intro guides still have no grants (coaches can't see them). Out of scope in 173; grant `all_coaches` on that folder if Cole wants them visible.
* **`coaching-activity-summary` still does not inject PTP** — only the Fresh-Start baseline does. If ongoing summaries should reflect the PTP too, that's a small edit to that function.

## CADENCE (per activity/feature, one at a time):

* Scope world-class from the OneDrive source → present for approval, leading with the single strongest design question.
* Build backend-first: SQL/RLS/RPC/Edge before any Lovable prompt. Diagnose before prescribing. Read the exact live runner/widget via GitHub SHA before any Lovable prompt; verify shipped files after. Keep activities draft until publish.
* For METERED work, confirm the `check-ai-usage` decrement on a real non-admin session. Intro-group activities are unmetered; Review & Action Plan IS metered (generate + each ask).
* After each publish batch, re-run `coaching-activity-embed` (empty body until `remaining:0`).

## DECISIONS LOCKED (Session 173):

* Reference Library = **authored branded cards** (not linked source docs), **both registers per topic** (learner in All Resources + coach in Coach Resources), organized by the 10 stages, PDF, branded like the *Bias* / *PTP flyer* examples.
* Reference-library visibility via **folder-level grants** (learner → all account types; coach → `all_coaches`). Legacy PTP cards left as-is.
* Fresh Start resets the **My-Coaching journey only** (LMS untouched); history always preserved and bundled into a collapsible "Previous runs" archive; summary rebuilt from the **PTP**.
* Review & Action Plan reads the **current run only**, and each generate is **saved to History** (`coaching_reviews`); Q&A is not saved.
* Review & Action Plan **meters like coaching activities** (shared `check-ai-usage` chat pool; generate + each ask = 1 interaction).

## STANDING GATES / GUARDRAILS:

* SECURITY SEQUENCING: never revoke a base table's `authenticated` read until the repointed frontend is PUBLISHED live AND verified via API logs. Repo-verified ≠ live.
* OPS-1: fixture passwords live in `userMemories` (kept OUT of the public repo). When no UI login is available, verify backend via minted fixture JWTs + rolled-back transactions. Metered/non-admin checks require a live logged-in session; super-admin is meter-exempt (verifies the function, not the decrement).
* METERING: super-admin is meter-exempt (9999). Corporate consumes `ai_usage_counters`; individual consumes `ai_usage` / `one_time_chat_credits`.
* SERVICE-ROLE-ONLY RPCs: `coaching_fresh_start_rotate` has execute revoked from anon/authenticated — call it only from the `coaching-fresh-start` edge function.
* BROWSER FIXTURE E2E: the live site session is shared across the user's tabs; a fixture login logs Cole out of his own session — confirm first. Session tokens expire (~1h) on idle — reload to refresh before edge-function calls.

## CARRIED RESIDUALS (still open):

* Live E2E of Fresh Start + Review (priority 1 above).
* Pending `coaching-activity-embed` for the 6 Purpose Exploring activities.
* Hedgehog 0215 (3-circle Ikigai).
* Coach entitlement gap in `coaching_activity_access` (no coach-subscription branch; latent).
* 0420 `assessment_upload` → `coaching-assessment-analyze` live click-through unverified.
* `pitch-engine` + `clarity-engine` real click-through.
* Frontend semantic-search bar prompt not shipped.
* Runner hardening Track B/C (memo/lazy) pending a Stage-0 profile.

## At session close: markdown only (no docx). Write `build-queue-APPEND-session174.md`, `architecture-reference-APPEND-session174.md`, `session-174-to-175.md`; bump version markers to **v85 / v81**; sanitize (no UUIDs, production emails, secrets, passwords, Stripe IDs, publishable/anon keys); hand the md bundle to drag-upload to GitHub.
