# Architecture Reference — APPEND Session 170

*Append to `architecture-reference.md`. Follows `architecture-reference-APPEND-session169.md`. Version marker v77 (Session 170 CLOSE). Covers the new `inner_team` coaching widget + `coaching-inner-team-map` function for Present/0450 "Your team", the guided-elicitation flow, and the live metering verification of the Purpose/Present anchors.*

## New coaching function

- `coaching-inner-team-map` (v2, metered via the shared AI pool exactly like `coaching-ikigai-map` v2). Dedicated structured mapper for the `inner_team` widget (kept separate from `coaching-activity-analyze` and `coaching-ikigai-map` so the three output contracts never entangle). Reads only the user's own data (self-read: latest non-superseded INST-001 `assessment_results` for the PTP block + `coaching_user_summary` for the story). NO team-profile RLS path.
  - Two modes, chosen server-side by whether a curated roster exists:
    - `seed` (first pass): reads the `qa_multimodal` elicitation answers (`it_elicit`), IDENTIFIES each distinct player from them, profiles each, and WRITES the identified roster back to `responses.it_characters` (as `{name, description}` objects) so the widget can render an editable roster.
    - `curated` (re-map): profiles the user-confirmed roster in `it_characters` (respecting their names/descriptions), using the elicitation answers only as supporting context.
  - Per-character profile: `name, description, core_desire, greatest_fear, strength, weakness, layer (primary|secondary|tertiary), power_now/power_future (low|moderate|high), when_useful, talent`. Team-level: `allies[], conflicts[]` (name-pairs with a note), `decision_driver {name, note}`, `grow[]`, `shrink[]`. All team-level names are hard-filtered to the known character set (relationships can never reference an invented player).
  - COVERAGE completeness gate (reuses the `sufficiency {enough, note, questions[]}` shape the widget already renders): the model checks the answers against eight angles (contexts / time+mood / threat / at-best / relationships / inner-voices / disowned / background) and, when one is thin or missing, sets `enough=false` and returns 2–4 SPECIFIC follow-up questions naming the angle. Structural fallback when the field is omitted.
  - Stores `responses.inner_team_map` (+ `mode`) and `responses.analysis.html` so the existing `ai_panel` + chat work unchanged.

## New coaching widget

- `inner_team` widget (`InnerTeamWidget` in `CoachingActivityRunner.tsx`; `InnerTeamCircleView` + `InnerTeamCharacterCard` + `TeamCircleBackdrop` in `CoachingViews.tsx`). Mirrors the `IkigaiWidget` contract (`coaching_session_save` → `functions.invoke` → 402/403 toasts → re-read session responses).
  - Guided flow: a separate `qa_multimodal` step captures the elicitation answers; the widget shows "Suggest my team" until a team exists, then an editable roster (name `Input` + description `Textarea` + remove, plus "Add a player") driven by `it_characters`, a "Map my team" / re-map button, the completeness "A part of you may be missing" gate, and the Team Circle.
  - `TeamCircleBackdrop`: concentric rings (primary at the core, tertiary at the rim) as a metaphor; the character detail lives in per-layer cards (same split Ikigai uses: backdrop + cards). Cards group by effective layer, show a power badge, a ★ grow marker / "ease off" shrink marker, expandable attributes, and a layer-override selector (`inner_team_overrides` = `{name: layer}`; effective layer = override ?? AI layer). A "How your team plays together" panel renders decision-driver, allies, tensions, grow/shrink.
  - `Step` fields added: `charactersKey` (default `it_characters`), `elicitKey` (default `it_elicit`), `suggestAction`, plus `layerLabels/powerLabels/attributeLabels`. Runner `canAdvance` for `inner_team` gates on `inner_team_map.characters.length > 0`. Reuses `ListBuilderWidget` is dropped for this widget in favor of the roster editor.
  - BrainWise color tokens reused: primary `--bw-orange`, secondary `--bw-navy-500`, tertiary `--bw-plum`.

## New activity

- `present-your-team` (code, MBWC-0450), module_group Present, tier Foundational, `requires_ptp=false`, published. 5 steps: `content` (framing + the Marie "Miss Strictly Business" example) → `content` (how the guided flow works) → `qa_multimodal` (`it_elicit`, 8 questions) → `inner_team` → `ai_panel` (chat). `chat_prompt` uses `{ptp_block}` + `{analysis}`. `widgets_version` 1.

## Metering verified live (durable evidence)

- The shared `check-ai-usage` decrement path is now click-through verified on real non-admin sessions for BOTH account types (corporate `ai_usage_counters` pool `chat`; individual `ai_usage` + one-time credits). Every metered coaching analyze/map function (`coaching-activity-analyze` v12, `coaching-ikigai-map` v2, `coaching-inner-team-map` v2) routes through the identical `check-ai-usage` call with the same `meterExempt = reason in (granted, super_admin)` and `unmetered = Intro || definition.metered===false` guards. Super-admin is meter-exempt (9999), so draft-only super-admin runs do NOT exercise metering — a metered live check requires a published activity + a non-admin fixture.

## Findings (durable)

- `check-subscription` (v63) re-syncs `users.subscription_status` from Stripe on login, so a test individual cannot be held `active` via a raw DB flip on production; use one-time chat credits or a Stripe-active fixture to exercise the individual metered path.
- The browser `file_upload` automation no longer accepts host filesystem paths; 0420's `assessment_upload` → `coaching-assessment-analyze` remains code-verified + boot-probed, not live click-through verified.

## Not changed

- No new tables, RLS policies, or standing numbered rules. No base-table read revokes. The assessment/coaching presentation-view security model from Session 169 is untouched.
