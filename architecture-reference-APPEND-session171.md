# Architecture Reference — APPEND Session 171

*Append to `architecture-reference.md`. Follows `architecture-reference-APPEND-session170.md`. Version marker v78 (Session 171 CLOSE). Covers analyzer v13/v14, the semantic-search subsystem, the risk_blocks single-select capability, the runner file split, and the new Summary module group.*

## coaching-activity-analyze — v13 then v14

- **v13 — opt-in cross-activity recap.** When an activity definition contains a `cross_read` block, the analyzer resolves a named token from the user's OWN prior sessions:
  - `cross_read = { token, module_groups[] (or module_group), include_analysis (default true), include_keys[], max_activities (12), max_chars_each (2000), empty_text }`.
  - Self-read only (filtered by `user_id`, service role); NO team-profile path. For each of the user's sessions in the target groups (excluding the current activity), it takes the full `responses.analysis.html` (stripped) — far richer than the compressed rolling `story_block` — ordered by activity sequence, one section per activity, capped. Optional `include_keys` append specific structured response keys.
  - Resolved BEFORE the generic placeholder loop, so the token isn't overwritten. When `cross_read` is absent, behavior is byte-identical to v12.
  - In use: `{present_recap}` (0475, groups Present+Purpose), `{past_recap}` (0545, Past), `{pathway_recap}` (0770, Pathway), `{journey_recap}` (1005/1015, Present+Past+Purpose+Pathway+Future).

- **v14 — subfield-aware risk_blocks serialization.** The `{risks}` token now honors a risk_blocks DETAIL step's configured `subfields` + `subfieldLabels` + optional `itemNoun`, and the SAME serialized block is also exposed under that step's `key` (e.g. `{influencers}`, `{changes}`, `{decisions}`). With no custom subfields it falls back to the historical a/b/c "Prevent / In the moment / Recover", noun "Risk" shape, so activities using default `{risks}` are unchanged. (Draft `pitch-engine` gets a correction: its `{risks}` now uses its real Pre-empt/Respond/Re-open labels instead of the old hardcoded defaults.)

## Runner + widgets

- **F1 — single-select subfield (frontend).** `RiskBlocksWidget` renders a subfield as a segmented single-select when `step.subfieldTypes?.[sf] === "select"` and `step.subfieldOptions?.[sf]` is a non-empty string array; otherwise the multimodal field as before. `Step` gained `subfieldTypes?`/`subfieldOptions?`. Behavior-preserving for existing risk_blocks. Used by 0820 for the four Dixon decision stages. Also shipped: `addLabel?` on `Step` (collect-mode label), used as "Add a person"/"Add a decision"/"Add a change".
- **Runner file split (Track A of the hardening).** `CoachingActivityRunner.tsx` (3,691 → 969 lines): shared types + helpers (`Step`, `Negative`, `Responses`, `useDebouncedSave`, `buildUserPatch`, `imgUrl`, `humanizeBand`, etc.) moved to `src/pages/coaching/runner/shared.tsx`; all ~17 widget wrappers moved to `src/pages/coaching/runner/widgets/*.tsx`. Presentational views were already in `CoachingViews.tsx`. Behavior-preserving. Track B (memo/lazy) pending a Stage-0 profile.
- **Chat-first / coach-led activities.** An activity can be `content (onComplete: {touchpoint: "analysis"}) → ai_panel`: leaving the content step generates the "opening" analysis, then `coaching-activity-chat` drives the rest off `{story_block}` + `{analysis}`. Used by 0915 Networking (the Elevator-Speech interview). No chat-function change needed — `coaching-activity-chat` v3 already interpolates `{ptp_block}`/`{story_block}`/`{analysis}`.

## Semantic activity search (new subsystem)

- Extension `vector` (pgvector 0.8.0) installed in `extensions`.
- Table `public.coaching_activity_embeddings (activity_id PK → coaching_activities, content text, embedding vector(384), updated_at)`. RLS enabled, service-role only. HNSW cosine index.
- RPC `public.search_coaching_activities(p_query_embedding vector(384), p_match_count=8, p_min_similarity=0.30)` — SECURITY DEFINER, returns published activities ranked by `1 - (embedding <=> query)`.
- Edge function `coaching-activity-embed` (super-admin only; verify_jwt false + custom claim check). Builds each activity's content (title/desired_outcome/description/learning_outcomes/tags) and embeds with the in-runtime `Supabase.ai.Session("gte-small")` — no external API, no cost. **v2 is incremental + capped**: skips activities whose stored content is unchanged, processes ≤`limit` (default 10) per call, returns `{embedded, skipped, remaining}`; re-run until `remaining:0`. Pass `{force:true}` to re-embed all, `{all:true}` to include drafts.
- Edge function `coaching-activity-search` (any authenticated user; unmetered). Embeds the query with `gte-small`, calls the RPC, returns ranked results.
- Operational: after publishing/editing activities, re-run `coaching-activity-embed` (empty body) to index them. Consider a future publish trigger to auto-embed.

## New module group + activities

- New `module_group = "Summary"` (the group-10 wrap-up): `summary-reviewing-commitments` (1005), `summary-symbols-and-ceremony` (1010), `summary-capturing-it-all` (1015). 1005/1015 use `cross_read` `{journey_recap}`; 1010 is self-contained.
- New Pathway activities: `pathway-change-review` (0705, risk_blocks 4 subfields `{changes}`), `pathway-journalling` (0710), `pathway-additional-future-thoughts` (0770, `{pathway_recap}`).
- Widget reuse only — no new widget types were added server-side; F1 extends the existing `risk_blocks`.

## Not changed

- No base-table read revokes. No new standing numbered rules. The assessment/coaching presentation-view security model is untouched. Metering routes for all metered activities still go through the shared `check-ai-usage` path (analyze v14, chat v3).
