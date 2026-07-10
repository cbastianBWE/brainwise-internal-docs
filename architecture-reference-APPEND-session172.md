# Architecture Reference — APPEND Session 172

*Append to `architecture-reference.md`. Follows `architecture-reference-APPEND-session171.md`. Version marker **v79** (Session 172 CLOSE). Covers analyzer v15, the new `scored_factors` widget subsystem, the Wrap Up gate removal, the chat-led activity pattern in Typical, and the connected `cross_read` Exploring series.*

## coaching-activity-analyze — v15 (scored_factors serialization)

- Adds `scored_factors` support. Purely additive; byte-identical to v14 for any activity without a `scored_factors` step.
- **Data contract:** a `scored_factors` step carries `key`, `factors[] = {key,label,side?,helper?}`, optional `sides[] = {key,label,goal?}`, optional `scale = {min,max}` (default 0–10). The runner stores `responses[step.key] = { <factorKey>: <number> }`.
- **Serialization** (`buildScoredBlock`, `findScoredSteps`): exposes a block under the step's `key` token. No sides → per-factor `label: n/max` list + a "Factors at zero" note. With sides → per-side sum + factor list, a two-side `Comparison: A (sum X) is greater/less/equal to B (sum Y)` line, and a "Factors currently at zero: <label — side>" note. The zero note encodes Gleicher's multiplicative "any single force at zero can stall the change" insight; the analysis_prompt interprets direction.
- Insertion point: after the risk-detail-key token exposure, before the generic placeholder loop, so scored tokens are not clobbered by the `serializeValue` fallback (which would raw-`JSON.stringify` the score object).
- Unchanged: metering block (Intro-group + `definition.metered===false` are unmetered; super-admin / granted are meter-exempt), cross_read (v13), risk_blocks subfield serialization (v14).

## Runner + widgets — scored_factors (new widget type)

- `src/pages/coaching/runner/widgets/ScoredFactorsWidget.tsx` — reusable 0–10 scorer. Renders a row of selectable 0..max buttons per factor. If `step.sides` present → two `Card` columns with a live `sum` per side header; else a flat factor list. Props: `{ step, value: Record<string,number>, onChange }`.
- `src/pages/coaching/runner/shared.tsx` — `Step` type extended: `factors?`, `sides?`, `scale?`.
- `src/pages/coaching/CoachingActivityRunner.tsx` — import + dispatch block (`step?.widget === "scored_factors" && step.key`, writes `responses[step.key]`); `canAdvance` case (`factors.length > 0 && factors.every(f => typeof scores[f.key] === "number")`). Analysis fires via the existing `goNext` path when the scored step carries `onComplete.touchpoint: "analysis"`.
- Behaviour-preserving for all existing widgets. Verified live on both scored modules.

## Coaching landing — Wrap Up gate removed

- `src/pages/coaching/CoachingActivities.tsx` — the "Wrap up" button previously gated on `summaryUnlocked` (true only when every JOURNEY_GROUP had `has_completed` via the `coaching_group_access` RPC). That derivation (`JOURNEY_GROUPS`, `accessibleJourney`, `summaryUnlocked`) was removed; the button is now always enabled and opens the `Summary` group. `MAP_GROUPS` / `lockedGroups` / `introAccessible` retained (still used). Per-activity access (via `coaching_activity_access` / `_batch`) inside the Summary group is unchanged, so ungating the bar does not bypass entitlement.

## Chat-led (coach-led) activity pattern — now used in Typical

- Confirmed and reused: `content (onComplete: {touchpoint:"analysis"}) → ai_panel (chat:true, touchpoint:"analysis")`. The `analysis_prompt` writes the coach's **opening message + first question** (interpolates `{ptp_block}`, `{story_block}`; HTML `<p>/<strong>/<em>`). `coaching-activity-chat` v3 then runs the interview off `{ptp_block}` + `{story_block}` + `{analysis}` (the opening). No chat-function change.
- New use: `intro-transition-map-thoughts` (0125) — a 7-area map sweep that ends by presenting a "map snapshot". Note Intro group is **unmetered**, so the chat-led per-turn cost is nil there (good fit).

## Connected Purpose series via cross_read

- The 6 `purpose-exploring-*` activities each carry `definition.cross_read = { token: "purpose_recap", module_group: "Purpose", include_analysis: true, max_activities: 12, max_chars_each: 1500, empty_text }` and reference `{purpose_recap}` in the analysis_prompt. Each pulls the user's own prior Purpose-group analyses so the series compounds toward a purpose statement. Uses the existing v13 self-read cross_read path unchanged.
- Values (0240) and Qualities (0245) reuse the risk_blocks detail pattern with subfields `future / present / change`, serialized under `{values}` / `{qualities}` via the v14 subfield-aware path.

## Coaching activity entitlement model (documented — `coaching_activity_access`)

Everyone can SEE all published activities (the batch RPC returns locked cards + a `reason`); RUNNING is gated by `coaching_activity_access(p_activity_id)` → `{allowed, reason, activity_tier}` (SECURITY DEFINER). Precedence, top to bottom:

1. No auth → `auth_required`. Not found → `not_found`. Draft (`status <> 'published'`) → super-admin only, else `unavailable`.
2. `module_entitlements` **DENY** (principal user or org; `module IN ('coaching_activity:<code>','coaching:all')`, active window) wins over everything → `denied`.
3. `module_entitlements` **GRANT** (user or org, same module set) overrides tier gating → `granted` (also **meter-exempt** in analyze). **The 10 comped coaches are user-level `coaching:all` grants (verified this session: exactly 10).**
4. super-admin → `super_admin` (allowed, meter-exempt).
5. `requires_ptp` activity + no current PTP → `ptp_required` (a subscription alone does not unlock these).
6. **Foundational** → current PTP OR any active sub → allowed (`foundational`/`subscription`); else `entitlement_required`.
7. **Corporate** (`corporate_employee`/`company_admin`/`org_admin`): org `tier_name` from `organization_features_view` — `base`/`premium` → **Typical**; `premium` → **Advanced**; else `upgrade_required`; null tier → `no_contract`.
8. **Individual**: `subscription_status='active'` + `subscription_tier` — `base`/`premium` → **Typical**; `premium` → **Advanced**; inactive → `subscription_required`; else `upgrade_required`.
9. **coach / null / other → `subscription_required`** (deny) unless an explicit grant (step 3).

**KNOWN GAP vs intended model.** `account_type='coach'` is a DISTINCT type (17 coaches; 0 currently subscribed). The RPC has **no branch reading a coach's own `subscription_tier`/`subscription_status`**, so a coach who buys premium would still be denied — only the 10 comped grants unlock coaches today. Intended model (per Cole): coaches with an active **premium** subscription should get access, plus the 10 comps. **Fix (next session, backend-first):** add a coach branch mirroring the individual logic (active + `base`/`premium` → Typical, active + `premium` → Advanced), keeping the grant path for comps. Latent now (no coach subscribed), so not urgent, but a real mismatch. This is pre-existing in the RPC; the 14 new activities shipped in 172 (6 Foundational + 8 Typical) are gated correctly for individual + corporate with no change needed.

## Card / hero image transforms (performance)

- `src/pages/coaching/CoachingActivities.tsx`: `CardMedia` and `BriefingDialog` now serve resized derivatives via a `renderImg(url,w,h)` helper that rewrites `/storage/v1/object/public/` → `/storage/v1/render/image/public/` and appends `width/height/resize=cover&quality=70` (cards 480×270, hero 800×400, `decoding="async"`). Previously the raw full-size `coaching-media` originals were downloaded and CSS-scaled, causing slow thumbnails + laggy Browse-all scroll. Supabase image transformations are enabled (already used by the `imgUrl` helper for the completed-view image grid). No backend change. Thumbnails themselves are stored as `thumbnail_url` (a full public URL) on `coaching_activities`; all 41 activities now have one.

## Not changed

- No base-table read revokes. No new standing numbered rules. `coaching-activity-chat` (v3), `check-ai-usage` (v67), `coaching-ikigai-map` (v2), `coaching-inner-team-map` (v2), `coaching-assessment-analyze` (v1), `ai-chat` (v57), `coaching-activity-embed` (v2), `coaching-activity-search` (v1) all unchanged this session. Metering routes unchanged. Semantic-search subsystem unchanged (embed re-run pending for the 6 new Purpose activities).

## Pending architectural work (next session)

- **3-circle Ikigai (Hedgehog, 0215):** `coaching-ikigai-map` computes a hard-wired 4-circle / 15-region Venn; `IkigaiRegionsView` draws 4-circle geometry. A 3-circle Hedgehog (7 regions: 3 singles, 3 pairs, 1 center) needs the map fn generalized to N circles (or a 3-circle branch) + 3-circle Venn rendering + a Hedgehog activity definition (3 lenses, Hedgehog region labels). Backend-first, then Lovable.
