# BrainWise — Session 173 opener

Continue the "My Coaching" build — the **Typical wave**. Session 172 closed the Foundational tier (Change toolkit) and started Typical (Intro done, Purpose Exploring series done). Two immediate loose ends, then keep working down the groups.

## SESSION OPEN — read canonical docs from `cbastianBWE/brainwise-internal-docs` (root) via GitHub MCP `get_file_contents` before proposing:

* `build-queue.md` + `build-queue-APPEND-session172.md`
* `architecture-reference.md` + `architecture-reference-APPEND-session172.md`
* `session-172-to-173.md` (this file)
* `scope-frontend-hardening-coaching-runner.md` (standing frontend plan)

Note: canonical docs are at repo **root**, not `docs/`.

## Confirm live state in Supabase before proposing (Supabase is source of truth over docs):

* `coaching_activities` by module_group/tier/status. **Foundational = complete across all 10 groups.** Life's Tools Foundational should be 7 published (pitch-engine + 6 Change: change-vs-transition 605, background-conversations 610, failure-talk 615, losses 620, grief 625, resistance-to-change 645). **Typical so far:** Intro 2 (`intro-transition-map-thoughts` 125, `intro-how-we-change` 135); Purpose 6 (`purpose-exploring-*` 220/225/230/235/240/245). 0215 Hedgehog NOT yet built.
* Edge-function versions: `coaching-activity-analyze` **v15**, `coaching-activity-chat` v3, `coaching-ikigai-map` v2, `coaching-inner-team-map` v2, `coaching-assessment-analyze` v1, `check-ai-usage` v67, `ai-chat` v57, `coaching-activity-embed` v2, `coaching-activity-search` v1.
* Semantic search: `coaching_activity_embeddings` count. **After the pending embed (below) runs it should equal the published count.** At 172 close, the 6 Purpose Exploring activities were published but NOT yet embedded.

## PRIORITIES, IN ORDER:

1. **Run the pending embed.** The 6 Purpose Exploring activities are published but unindexed (the live session expired mid-close before the embed ran). Trigger `coaching-activity-embed` (empty body, repeat until `remaining:0`). Confirm `coaching_activity_embeddings` == published count.
2. **Hedgehog (0215) — 3-circle Ikigai.** Decision locked: reuse the Ikigai widget as a 3-circle Hedgehog (passion / best-at / economic-engine). Backend-first: generalize `coaching-ikigai-map` to N circles (or add a 3-circle branch, 7 regions), then a Lovable prompt for 3-circle Venn rendering (`IkigaiRegionsView`), then the activity definition (3 lenses + Hedgehog region labels). Scale ≈ the scored_factors effort. Source: OneDrive `MBWC-02b-Typical / MBWC-0215 …Hedgehog`.
3. **Continue Typical down the groups.** Finish Purpose, then Future `03b`, Present `04b`, Past `05b`, Life's Tools `06b`, Pathway `07b`, Resolve `08b`, Support `09b`, Summary `10b` — each `MBWC-0Xb-Typical`. Same cadence. Then the ADVANCED wave.

## Also worth a look (from 172):

* **Verify the image-performance fix** shipped this session: `CardMedia` + `BriefingDialog` in `CoachingActivities.tsx` should route images through `renderImg(...)` (the `/render/image/public/` transform) at the new SHA, so card thumbnails and briefing heroes load small resized derivatives, not the full-size originals. Secondary/future: pagination or list virtualization on "Browse all" as the catalog grows.
* **Entitlement gap — coaches.** `coaching_activity_access` implements the tier model exactly for individual + corporate, and the 10 comped coaches work via user-level `coaching:all` grants (verified: exactly 10). BUT `account_type='coach'` is a distinct type (17 coaches, 0 subscribed) and the RPC has **no branch reading a coach's own subscription** — a coach who buys premium would still be denied. Intended: coaches with active premium get access (plus the 10 comps). Fix backend-first: add a coach branch mirroring the individual logic (active + base/premium → Typical, active + premium → Advanced). Latent (no coach subscribed), not urgent. See architecture APPEND-172 for the full precedence.
* **0225 "Exploring Even Deeper"** was built from a one-line source ("apply Complete Conversations to your purpose"); it currently surfaces + reframes the background talk blocking the purpose search. Confirm that reading, adjust if off.
* The 6 Exploring activities were published on the proven path (qa / risk_blocks / cross_read all individually proven live) without per-activity click-through. Optional: spot-check one (e.g. 0240 Values: risk_blocks future/present/change + cross_read + purpose-statement synthesis) via the seed-session + trigger method.

## CADENCE (per activity, one at a time):

* Scope world-class from the OneDrive source → present for approval, leading with the single strongest design question.
* Build backend-first: SQL/RLS/RPC/Edge before any Lovable prompt. Diagnose before prescribing. Read the exact live runner/widget via GitHub SHA before any Lovable prompt; verify shipped files after. Keep activities draft until publish.
* For METERED activities, confirm the analyze→check-ai-usage decrement on a real non-admin session before keeping published. **Intro-group activities are unmetered** (free) — no decrement to check. Purpose/Future/etc. ARE metered.
* Publish → live click-through for anything with new widget/serialization; reflective qa/risk_blocks/cross_read activities may go on the proven path. Revert to draft if a live check fails.
* After each publish batch, re-run `coaching-activity-embed` (empty body until `remaining:0`).

## DECISIONS LOCKED (Session 172):

* Foundational-first (Change toolkit) then Typical — done; Foundational tier complete.
* `scored_factors` = a reusable 0–10 widget (single-list + two-sided w/ live sums) + analyzer v15 serialization — shipped, verified.
* Hedgehog (0215) = **reuse the Ikigai widget** adapted to 3 circles (not a light reflective build) — pending.
* Purpose Exploring series = **connected via `cross_read`** (`purpose_recap`, module_group Purpose) — done.
* 0125 = **chat-led interview** (0915 pattern) — done, verified.
* Grief-type/sensitive modules: DABDA etc. presented caveated as a lens, never a forced stage-picker; strong duty-of-care + coach-not-therapist limits.
* Wrap Up bar ungated (opens Summary for all) — shipped to prod.

## STANDING GATES / GUARDRAILS:

* SECURITY SEQUENCING: never revoke a base table's `authenticated` read until the repointed frontend is PUBLISHED live AND verified via API logs. Repo-verified ≠ live. `coaching_activity_embeddings` is RLS-enabled, service-role only.
* OPS-1: working fixture password for +orgmember / +convert2 / +employee is in `userMemories` (kept OUT of the public repo). When no UI login is available, verify backend via minted fixture JWTs + rolled-back transactions. **Note (172): browser fixture/non-admin metered checks require a live logged-in session; super-admin can run drafts by direct URL but is meter-exempt (verifies function, not decrement).**
* METERING: super-admin is meter-exempt (9999). Corporate consumes `ai_usage_counters`; individual consumes `ai_usage` / `one_time_chat_credits`. `check-subscription` re-syncs from Stripe on login.
* EMBED/ADMIN: `coaching-activity-embed` is super-admin-gated. Triggerable from a logged-in super-admin browser session via a `fetch` to `/functions/v1/coaching-activity-embed` with the session token (empty body), repeat until `remaining:0`.
* BROWSER FIXTURE E2E: the live site session is shared across the user's tabs; a fixture login logs Cole out of his own session — confirm first. **Session tokens expire (~1h) on idle — reload to refresh before edge-function calls.**

## CARRIED RESIDUALS (from 171, still open):

* 0420 `assessment_upload` → `coaching-assessment-analyze` live click-through unverified.
* `pitch-engine` + `clarity-engine` want a real click-through (published on smoke-test only).
* Frontend search bar Lovable prompt written but not shipped — verify it calls `coaching-activity-search` and renders ranked results.
* Runner hardening Track B/C — profile (Stage 0) then memo/useCallback (B), lazy-load heavy widgets (C).

## At session close: markdown only (no docx). Write `build-queue-APPEND-session173.md`, `architecture-reference-APPEND-session173.md`, `session-173-to-174.md`; bump version markers to **v84 / v80**; sanitize (no UUIDs, production emails, secrets, passwords, Stripe IDs, publishable/anon keys); hand the md bundle to drag-upload to GitHub.
