# Build Queue — APPEND Session 172

*Append to `build-queue.md`. Follows `build-queue-APPEND-session171.md`. Version marker **v83** (Session 172 CLOSE). Covers: the Life's Tools "Change" toolkit (last Foundational gap → Foundational tier COMPLETE), the reusable `scored_factors` widget, the Wrap Up ungating, and the start of the TYPICAL wave (Intro complete, Purpose Exploring series complete, Hedgehog pending).*

## Headline

- **Foundational tier is now 100% complete.** The Life's Tools "Change" toolkit (6 activities) closed the last remaining Foundational gap. All module groups are done at Foundational.
- **Typical wave started.** Intro Typical done (2). Purpose Typical "Exploring" series done (6). Purpose Typical "Hedgehog" (0215) is the one open build.

## SHIPPED — Life's Tools "Change" toolkit (Foundational) — 6 activities, published + embedded

Built from OneDrive `MBWC-06 Life's Tools Decoded / MBWC-06a-Foundational / …Change`. module_group `Life's Tools`, tier `Foundational`. Life's Tools went 1 → 7 published.

- `lifes-tools-change-vs-transition` (605) — Bridges change-vs-transition (endings / neutral zone / new beginning). content → qa_multimodal → synthesis.
- `lifes-tools-background-conversations` (610) — limiting/empowering beliefs + FAC (Feasibility/Appeal/Change) via **scored_factors** (single-list). content → qa (idea/belief/reframe) → scored_factors → synthesis.
- `lifes-tools-failure-talk` (615) — "failure talk" + immediacy of time. content → qa → risk_blocks (with F1 past/imagined select) → synthesis. 5 steps.
- `lifes-tools-losses` (620) — Bridges' 6(+3) loss categories, past vs anticipated. content → risk_blocks with F1 select subfields (loss_type, timeframe) → synthesis.
- `lifes-tools-grief` (625) — "all change is loss"; DABDA presented **caveated as a lens, not a stage-picker**; strong duty-of-care + coach-not-therapist limits (0503 pattern). content → qa → gentle synthesis.
- `lifes-tools-resistance-to-change` (645) — Gleicher's Formula (BrainWise-adapted), 6 drivers vs 6 resistors 0–10 via **scored_factors** (two-sided). content → scored_factors → synthesis.

All verified: 4 reflective published on the proven metered path; the 2 scored (610, 645) verified via **live non-admin-style click-through** (super-admin draft run) — Gleicher zero-flag and FAC "gets-killed-early" pattern both confirmed in the synthesis. All 6 embedded.

## SHIPPED — `scored_factors` reusable widget + analyzer v15

- **Frontend:** new `src/pages/coaching/runner/widgets/ScoredFactorsWidget.tsx` — a reusable 0–10 numeric scorer. Single-list (FAC) or two-column with live per-side sums (Gleicher). `Step` type extended with `factors[]`, `sides[]`, `scale`. Wired into `CoachingActivityRunner.tsx` dispatch + `canAdvance` (all factors must be scored). Shipped via Lovable, verified live at repo SHA.
- **Backend:** `coaching-activity-analyze` **v15** — additive `scored_factors` serialization: per-factor scores, per-side sums, a two-side comparison line, and a "factors currently at zero" note (encodes the Gleicher multiplicative "any zero can stall change" insight). Exposed under the step's `key` token. Byte-identical to v14 for all pre-existing activities (activates only on a `scored_factors` step). Data contract: widget writes `responses[step.key] = { <factorKey>: <number> }`.

## SHIPPED — Wrap Up (Summary group) ungated

- `src/pages/coaching/CoachingActivities.tsx` — removed the `summaryUnlocked` completion gate. Deleted `JOURNEY_GROUPS`, `accessibleJourney`, `summaryUnlocked`. "Wrap up" button now always enabled and opens the Summary group (`setSelectedGroup("Summary")`). Per-activity access inside the group is unchanged. Shipped via Lovable, published to production, verified live.
- Confirmed: the 3 Summary/Wrap Up **Foundational** activities (`summary-reviewing-commitments` 1005, `summary-symbols-and-ceremony` 1010, `summary-capturing-it-all` 1015) were already built in Session 171 and map 1:1 to OneDrive `MBWC-10a-Foundational`. Nothing to build there.

## SHIPPED — TYPICAL wave: Intro (2) — published + embedded

From OneDrive `MBWC-01b-Typical`. module_group `Intro` (so **unmetered** by design), tier `Typical`.

- `intro-transition-map-thoughts` (125) "Initial Thoughts about the Transition Map" — **chat-led interview** (0915 pattern: content `onComplete:analysis` → `ai_panel` chat). Sweeps the 7 map areas, ends with a map snapshot. **Verified live** (opening + a real chat turn).
- `intro-how-we-change` (135) "How We Change, and Why We Resist" — light change-orientation + menu of what-works. content → risk_blocks (resonant ideas + first move) → synthesis. (Titled to avoid clash with the Gleicher `lifes-tools-resistance-to-change`.)

## SHIPPED (published) — TYPICAL wave: Purpose "Exploring" series (6) — EMBED PENDING

From OneDrive `MBWC-02b-Typical`. module_group `Purpose`, tier `Typical`. **Connected via `cross_read`** (token `purpose_recap`, module_group `Purpose`) so each compounds; syntheses draft/refine a purpose statement.

- `purpose-exploring-possibilities` (220) — 12 facets of purpose, examples, first pass. qa_multimodal.
- `purpose-exploring-deeper` (225) — surfaces/reframes the background talk blocking purpose. qa_multimodal. **Source was a one-liner ("apply Complete Conversations to purpose") — interpretation needs Cole's eye.**
- `purpose-exploring-passions` (230) — passions (Ikigai top circle), $1M thought experiment, Hudson/McClean 6 areas. qa_multimodal.
- `purpose-exploring-dreams` (235) — desires and dreams. qa_multimodal.
- `purpose-exploring-values` (240) — values sort + future/present/changes table via risk_blocks subfields (`{values}`). Includes a starter values list.
- `purpose-exploring-qualities` (245) — qualities (incl. growth edges) + future/present/changes via risk_blocks subfields (`{qualities}`). Includes a starter qualities list.

**All 6 published.** Search **embed still pending** (live session expired mid-close). Next session: run `coaching-activity-embed` (empty body, repeat until `remaining:0`) once logged in.

## OPEN — Purpose Typical: Hedgehog (0215)

- `MBWC-0215 Life's Purpose — The Hedgehog Principle` NOT built. Decision locked: **reuse the Ikigai widget** as a 3-circle Hedgehog (passion / best-at / economic-engine).
- Scope (from diagnosis): the Ikigai is config-driven on inputs (`lenses[]`) but hard-wired to 4 circles downstream. A 3-circle Hedgehog (7 regions) requires: (1) `coaching-ikigai-map` edge fn generalized to N circles (or a 3-circle branch); (2) the Venn rendering geometry (`IkigaiRegionsView`) for 3 circles; (3) a new activity definition with 3 lenses + Hedgehog region labels. Treat as a **backend-first + Lovable** track next session (scale ≈ the scored_factors effort).

## NEXT — Typical wave, remaining groups (work down)

After Purpose (finish Hedgehog): Future `03b`, Present `04b`, Past `05b`, Life's Tools `06b`, Pathway `07b`, Resolve `08b`, Support `09b`, Summary `10b` — each `MBWC-0Xb-Typical` folder, same cadence (scope world-class → strongest design question → backend-first → draft → verify → publish → embed). Then the ADVANCED wave.

## SHIPPED — thumbnails + card/hero image performance

- **Thumbnails:** the 14 new activities had no `thumbnail_url` (only the briefing `hero_image_url` was set), so their cards fell back to the branded placeholder. Set `thumbnail_url = briefing hero_image_url` for all 14. All 41 activities now have a thumbnail (0 missing); within each group the images are distinct.
- **Image performance (Lovable):** activity cards (`CardMedia`) and the briefing hero (`BriefingDialog`) were rendering the raw full-resolution `coaching-media` source images (multi-MB Unsplash originals) shrunk only by CSS → slow thumbnail loads and laggy "Browse all" scroll. Fix: a `renderImg(url,w,h)` helper rewrites the Supabase public URL to the `/render/image/public/` transform endpoint (`width/height/resize=cover&quality=70`); `CardMedia` uses 480×270, `BriefingDialog` hero 800×400, both `decoding="async"` + `loading="lazy"`. (The app already used transforms via `imgUrl` for the completed-view image grid; cards/heroes just weren't.) **Shipped via Lovable this session — verify at the new SHA next session.** Future secondary: pagination/virtualization on Browse-all as the catalog grows.

## CARRIED RESIDUALS (from Session 171, still open)

- 0420 `assessment_upload` → `coaching-assessment-analyze` live click-through still unverified.
- `pitch-engine` + `clarity-engine` published on analysis smoke-test only; want a real click-through.
- Frontend search bar Lovable prompt written but not shipped.
- Runner hardening Track B/C (memo/lazy) pending a Stage-0 profile.
