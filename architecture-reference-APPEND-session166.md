# Architecture Reference — APPEND Session 166

*Append to `architecture-reference.md`. Version lineage v61 to v62. My Coaching (coaching activities) domain.*

## Coaching activities: flow engine

An activity is data. A row in `coaching_activities` carries a `definition` jsonb (steps, prompts) plus metadata. A generic renderer runs any activity from its definition. Adding most activities is a data insert, not code. `definition` shape:

```
{ steps: [ {id, widget, key, ...config} ],
  response_keys: [...],
  analysis_prompt: "<template with {tokens}>",
  chat_prompt: "<system template with {tokens}>" }
```

Prompt tokens resolved server-side: `{ptp_block}` (five PTP domains, each mean and band, plus stored PTP narrative), `{story_block}` (rolling summary), plus per-activity input keys.

Widget palette. Built: `textarea`, `list_builder`, `risk_blocks` (optional A/B/C subfields), `ai_panel` (+ chat), `synthesis`. Planned: `content`, `image_capture`, `ptp_display`, `select_model`, `matrix_2x2`, `goal_form`, `timeline`, `survey`, `diagram`.

## Tables (RLS enabled)

- `coaching_activities`: id, code, title, module_group, tier, sequence, desired_outcome, status (draft/published), definition (jsonb), version, tags (text[], GIN indexed), thumbnail_url, timestamps. RLS: published readable by signed-in users, super admin sees drafts and manages all.
- `coaching_activity_sessions`: id, user_id, activity_id, parent_session_id (restart lineage), status (in_progress/completed/abandoned), current_step, responses (jsonb), context_snapshot (jsonb), completed_at, timestamps. RLS: owner full, shared viewer read, super admin read. `responses` keys for the Clarity Engine: action (string), positives (string[]), positiveAction (string), negatives ([{text,a,b,c}]), analysis ({html,...} server-written), chat ([{role,content}] server-written).
- `coaching_activity_shares`: id, owner_user_id, viewer_user_id, mode (snapshot/always), granted_at, revoked_at. Snapshot covers sessions completed at or before grant time; always covers future. Mirrors `ptp_result_shares`.
- `coaching_user_summary`: user_id (pk), summary (jsonb, {text,...}), last_session_id, updated_at. The rolling memory.
- `coaching_usage_counters`: id, user_id, org_id, period_start (date), count, unique (user_id, period_start). Monthly coaching-run meter, individual and corporate uniform.
- `coaching_credit_grants`: id, user_id, amount, source, source_ref (partial-unique when not null), created_at. One-time coaching-credit ledger, separate from chat credits.
- `users.one_time_coaching_credits` (integer) added for the free-tier fallback pool.

## RPCs

- `coaching_activity_access(p_activity_id)` returns {allowed, reason, activity_tier}. Order: deny, grant (coach assignment via `module_entitlements` key `coaching_activity:<code>`), super admin, PTP baseline, tier gate. SECDEF, uses auth.uid(). Authenticated + service_role.
- `coaching_activity_access_batch()` returns access for every visible activity in one call. Reuses the single-activity function via LATERAL. Authenticated + service_role.
- `coaching_usage_check_and_consume(p_user, p_check_only)` returns {allowed, reason, source, remaining, limit_val}. Super admin unlimited (remaining -1, no counter row). Recurring allowance first (individual `plan_tiers.ai_coaching_limit`; corporate `organization_features_view.monthly_coaching_query_allowance`), then one-time coaching credits fallback. Service_role only, takes explicit p_user (no JWT dependency).
- `coaching_session_save(p_session_id, p_current_step, p_patch)` merges input-only patch into responses (`responses || p_patch`), preserving server-written analysis and chat. Owner-scoped via auth.uid(). Authenticated + service_role.
- `grant_one_time_coaching_credits(p_user, p_amount, p_source, p_source_ref)` and `consume_one_time_coaching_credit(p_user)`. Mirror the chat-credit pattern, idempotent grant by source_ref, atomic guarded consume. Service_role only.
- `grant_coaching_credits_on_assessment_purchase()` trigger on `assessment_purchases` AFTER INSERT, grants 10 coaching credits per purchase, idempotent by purchase id.

## Edge Functions (verify_jwt false, custom bearer auth; house conventions mirror `generate-dashboard-narrative`)

- `coaching-activity-analyze` (v2): auth, then `coaching_activity_access` (user JWT) then `coaching_usage_check_and_consume(false)` (service role, explicit user), assemble PTP + rolling summary, interpolate `analysis_prompt`, Sonnet via `coaching_analysis`, store `responses.analysis`. 403 access_denied, 402 coaching_limit_reached, returns coaching_remaining (-1 = unlimited).
- `coaching-activity-chat` (v1): same gate, one unit per turn, system prompt from `chat_prompt` + PTP + summary + prior analysis, Sonnet via `coaching_chat`, appends `responses.chat`.
- `coaching-activity-summary` (v1): no gate, on completion, folds the finished session into `coaching_user_summary`.

Model routing: `ai_model_registry` roles `coaching_analysis` and `coaching_chat`, both `claude-sonnet-4-6`.

## Access and metering model

Distribution is both self-serve and coach-delivered; coach assignment wins. Baseline is a current PTP result (activities inject PTP). Tiers: Foundational open to anyone past baseline; Typical for individual Base/Premium or a corporate seat; Advanced for individual Premium or corporate Premium. Metering on the dedicated coaching pool only, one unit per analyze call and per chat turn. Individual Base 200 / Premium 400 per month; corporate Base 50 / Premium 100 per seat; Free 10 one-time credits per assessment purchase, fallback only, Foundational only. Super admin unlimited and unmetered.

## Frontend surfaces

`/coaching` catalog (batch access, grouped by module then tier, search over title/outcome/tags, tag badges, thumbnail or tier-colored header, state-driven action), `/coaching/:activityId` runner (definition-driven widgets, analysis via DOMPurify-sanitized HTML, chat, synthesis, restart with parent lineage, coach sharing), history tab, and `/coaching/session/:sessionId` read-only view. Bespoke `CoachingActivityCard` on the LMS grid, not the LMS `Tile`.

## Notes

- `newsletter-sitemap` STATIC_ROUTES: if `/coaching` becomes a public marketing route, add it. It is currently a protected app route, so no change needed.
- The Clarity Engine is module 0745 (Pathway, Action Evaluation / Risk Analysis).
