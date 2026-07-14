# Build Queue — APPEND Session 173

*Append to `build-queue.md`. Follows `build-queue-APPEND-session172.md`. Version marker **v84** (Session 173 CLOSE). Session 173 redirected off the planned Typical wave (at Cole's direction) to: complete the branded Reference Library (208 cards) + thumbnails + access grants, reconcile Life's Tools against OneDrive, and build the two new My-Coaching features — Fresh Start and Review & Action Plan (backend shipped + verified; frontend built by Cole in Lovable, typecheck passing). Typical-wave residuals from 172 carry forward untouched.*

## Headline

- **Reference Library COMPLETE.** 104 topics → **208 branded one-page PDF cards** (a learner card in All Resources + a coach card in Coach Resources per topic), all published, foldered by the 10 stages. Authored to the *Bias* / *PTP flyer* brand bar via a local HTML→Playwright/Chromium PDF engine.
- **All 208 thumbnails wired** (a distinct coach + non-coach image per topic).
- **Access grants fixed** — the library was invisible to non-admins until this session; now correctly gated (learner cards → everyone, coach cards → coaches).
- **OneDrive reconciliation of Life's Tools = clean, no gaps.**
- **Fresh Start + Review & Action Plan** — full backend shipped and verified; three Lovable prompts delivered; Cole built the frontend (typecheck passing). Live end-to-end test still pending.

## SHIPPED — Reference Library (208 branded PDF cards)

Built from the coaching curriculum; every topic became two cards (learner register in `all_resources` tab, coach register in `coach_resources` tab), filed in a per-stage folder. Category `reference_library`.

- Counts by stage (learner / coach each): Intro 3, Purpose 2, Future 5, Present 10, Past 4, Life's Tools 62, Pathway 10, Resolve 3, Support 4, Summary 1 = **104 topics × 2 = 208**.
- Publish chain per card: render PDF → upload to `lesson-assets` (path `resource/<rid>/<aid>.pdf`) → `content_assets` (asset_kind `document`) + `content_asset_versions` → patch `current_version_id` → `resources` row (content_type `guide`, category `reference_library`, tab + folder + content_asset_id, published). Done via container-direct PostgREST inserts (corruption-free) using the super-admin session token.
- Engine: `refcards/engine.py` (HTML on exact BrainWise brand + Poppins, section renderers: para/moves/steps/stats/pills/showsup/bullets/helpshurts/diag, auto-fit scale) + `build_and_publish.py` (render → upload → row inserts). One spec file per stage.

## SHIPPED — Reference Library thumbnails (208)

- Cole supplied 208 images (coach + non-coach per topic), uploaded to `lesson-thumbnails/inbox/`.
- Matched file→card by normalized title + register (100% matched, 0 unmatched), then wired server-side: each image became an `image` `content_asset` + version pointing at its `lesson-thumbnails` path, and `resources.thumbnail_asset_id` was set. **Note:** thumbnails are referenced in place at `lesson-thumbnails/inbox/…` (the bucket is public and URLs render); the `inbox/` folder must NOT be deleted. Optional future tidy: re-key to the canonical `resource/<rid>/<aid>.png` convention (needs a logged-in super-admin token for the Storage move).

## SHIPPED — Reference Library access grants (the real fix)

- **Root cause found:** cards were published with `resources.audiences = NULL`. The app does NOT read `audiences` (that RLS path is dead); visibility is computed by `get_user_resources` from the grant tables. Empty grants → only super admin (Cole) could see the cards; every other account saw nothing.
- **Fix:** folder-level grants on the 20 stage folders — the 10 learner (`all_resources`) folders granted `account_type` for each of coach/individual/corporate_employee/org_admin/company_admin (i.e. everyone); the 10 coach (`coach_resources`) folders granted `all_coaches`. 60 rows in `resource_folder_access_grants`. Verified by replaying the `get_user_resources` visibility logic for a coach, a corporate_employee, and an individual: coach sees 104+104, others see 104 learner + 0 coach.
- `coaching_group_access` was ALSO run-aware-patched (see below) but that is a Fresh-Start concern, not a grants concern.
- Legacy items intentionally untouched: the 21 PTP Coach Cards + a few brain-intro guides still have null grants (out of scope; Cole aware).

## SHIPPED — OneDrive reconciliation (Life's Tools)

- Reconciled OneDrive `MBWC-06 Life's Tools Decoded` (Foundational / Typical / Advanced) folder-by-folder against `coaching_activities`. **Every activity is built.** Advanced fully covered (Change ×7, Multiple Intelligences, Delegation, Networking/Weak Ties, Org Planning ×4, BrainWise Selling, Team ×12, Visioning). The only OneDrive items without a matching activity are the two Team **surveys** (Team Development Survey, Team Effectiveness Survey) = the known "two team assessments", handled separately. A couple of built extras beyond source (e.g. "The Pitch Engine") are additive. Deep check scoped to Life's Tools; other 9 stage-modules exist and have matching DB activities at the stage level (offer to deep-reconcile stands).

## SHIPPED — Fresh Start feature (backend)

Button that clears a user's rolling summary, bundles prior history into a collapsible archive, resets the journey, and rebuilds the summary from the PTP. Decisions: **My-Coaching journey only** (LMS untouched); history always preserved.

- Migration `coaching_fresh_start_run_cycles`: `coaching_activity_sessions += run_number int NOT NULL DEFAULT 1` (index on user_id,run_number); `coaching_user_summary += current_run int DEFAULT 1`, `prior_runs jsonb DEFAULT '[]'`; BEFORE-INSERT trigger `set_session_run_number` stamps each new session with the user's `current_run` (transparent to the app).
- Migration `coaching_fresh_start_rotate_rpc`: `coaching_fresh_start_rotate(p_user uuid, p_baseline jsonb)` (SECURITY DEFINER, **service-role only** — execute revoked from anon/authenticated) — archives the current summary into `prior_runs`, bumps `current_run`, installs the new baseline. Tested through two full cycles on the test-coach fixture (archive + bump + trigger + current-run isolation all correct), then test data deleted.
- Migration `coaching_run_aware_completion`: `coaching_current_run()` helper + `coaching_group_access()` now counts completion only within the current run (so a Fresh Start visibly resets the journey while prior runs stay in history). `coaching_activity_access` is pure entitlement gating — unaffected.
- Migration `coaching_get_run_state_rpc`: `coaching_get_run_state()` → `{current_run, prior_runs}` for the frontend archive UI.
- Edge function **`coaching-fresh-start` v1**: pulls the user's active PTP (`assessment_results` INST-001, non-superseded, `ai_narrative`), generates a PTP-seeded baseline via Claude, calls the rotate RPC. Falls back to a generic baseline if no PTP.

## SHIPPED — Review & Action Plan feature (backend)

Button that reads the current run's activities + PTP and produces a structured review; supports Q&A. Decisions: **generate on demand** originally, then Cole asked to **save to History** (added); reads **current run only**.

- Edge function **`coaching-review-action-plan` v3**: `mode:"generate"` → `{summary, strengths[], watch_outs[], action_plan[], themes[]}`; `mode:"ask"` → Q&A over the same context. Reads current-run sessions + PTP narrative.
- Migration `coaching_reviews_table`: `coaching_reviews` (id, user_id, run_number, review jsonb, activity_count, created_at); RLS = read-own + super-admin-read; writes only via the edge function (service role). Generate persists one row per click.
- **Metering (v3):** both generate and each ask consume one interaction via the shared `check-ai-usage` (`usage_type:"chat_message"`), exactly like coaching activities; returns HTTP 402 `coaching_limit_reached` when exhausted; super-admin exempt, one-time credits as fallback. Response includes `coaching_remaining`.

## DELIVERED — Lovable prompts (frontend built by Cole, typecheck passing)

- Core features prompt (run-scoped session filtering; Fresh Start button + confirm + "Previous runs" collapsible archive; Review dialog + Q&A) — grounded in the live `CoachingActivities.tsx`.
- Save-to-history addendum (render `coaching_reviews` in the History tab).
- Metering addendum (402 `coaching_limit_reached` → existing upgrade toast, mirroring `CoachingActivityRunner.runAnalysis`; guard buttons against double-charge).

## OPEN / NEXT

- **Live E2E test of both features** as a real non-admin (test-coach fixture seeded with 3 completed activities this session — Building Trust, Delegation, Awareness — for the Review test; test-coach has no PTP so the Fresh-Start baseline uses the generic fallback unless a test PTP is added). Confirm run rotation 1→2, archive, review quality, and the metered decrement.
- **Resume the TYPICAL wave** (deferred from the 173 plan): run the pending `coaching-activity-embed` for the 6 Purpose Exploring activities; build Hedgehog 0215 (3-circle Ikigai); then work down Future/Present/… Typical.

## CARRIED RESIDUALS (from 172, still open)

- Pending embed of the 6 Purpose Exploring activities (`coaching-activity-embed`, empty body until `remaining:0`).
- Hedgehog 0215 (3-circle Ikigai) — backend-first + Lovable.
- Coach entitlement gap in `coaching_activity_access` (no branch for a coach's own subscription; latent, no coach subscribed).
- 0420 `assessment_upload` → `coaching-assessment-analyze` live click-through unverified.
- `pitch-engine` + `clarity-engine` real click-through.
- Frontend semantic-search bar prompt not yet shipped.
- Runner hardening Track B/C (memo/lazy) pending a Stage-0 profile.
