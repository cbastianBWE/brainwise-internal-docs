# Architecture Reference — APPEND Session 166 (part b)

*Append to `architecture-reference.md`. Follows `architecture-reference-APPEND-session166.md` (coaching backend). This part covers the activity engine, media/saying libraries, the group-access RPC, the on-entry recap and suggest functions, and the Transition Map.*

## New tables

- `coaching_media_library` (id, storage_path, alt, category, sort_order, active, timestamps). RLS: authenticated read active rows; super admin write; service role full. Seeded with ~230 future images (`category='future'`), alt text backfilled by an Edge Function using vision.
- `coaching_saying_library` (id, text, author, category default 'future', sort_order, active, timestamps). Same RLS shape. Seeded with 11 inspirational sayings.

## Storage buckets

- `coaching-media` (public): authored assets, super-admin write. Rendered thumbnails via the image transform endpoint (`getPublicUrl(path, { transform: { width, height, resize: 'cover' } })`).
- `coaching-user-uploads` (private): owner-path RLS, for future user uploads.

## New RPC

- `coaching_group_access()` — SECURITY DEFINER, STABLE, returns `(module_group, accessible, has_completed)` for each of the ten canonical groups. Reuses `coaching_activity_access_batch()` for accessibility (so it mirrors card access exactly, super-admin sees drafts) and the user's completed sessions for `has_completed`. GRANT EXECUTE to authenticated, service_role; REVOKE from public/anon. Drives the map lock badges and the Summary unlock rule.

## Edge Functions

- `coaching-activity-analyze` — advanced to v6. Generic token interpolation: any `{key}` placeholder in `analysis_prompt` not in the known set is filled from `responses[key]` via a serializer. Serializer renders object array items as "primary: secondary" where primary is `tag` or `text` and secondary is `description` or `reason` (so pictures render "tag: reason" and sayings "saying: reason"). Output stripped of a leading markdown code fence before store.
- `coaching-activity-recap` v1 — on-entry warm second-person recap. Reads the user's `coaching_user_summary` and PTP, interpolates the activity's `recap_prompt` (or a default), stores `responses.recap = {html,...}`. Idempotent (returns cached if present). Access-gated but NOT metered (does not consume a coaching run). verify_jwt=false, user-JWT auth via getClaims.
- `coaching-activity-suggest` v1 — unmetered AI list suggestions. Reads the step's `suggest.prompt` from the definition by key, grounds in PTP + rolling story + the user's existing entries (server-side `responses[key]` plus a client `exclude` list), returns a short JSON array. Hard-filters exact and normalized duplicates and dedupes. Access-gated, not metered.
- `coaching-media-alt-backfill` (earlier this session) — vision alt-text backfill for the media library. Internal-secret auth (x-internal-secret header against an internal_function_secrets table), render-endpoint at 768px, Haiku vision.

## Activity definition schema additions (`coaching_activities.definition`)

- Step-level: `onComplete.touchpoint` ("analysis" fires the analyze function on leaving the step); `summaryLabel` (keepsake heading per input step); `subfieldLabels`/`subfieldHelpers` (risk_blocks configurable labels); `placeholder` (risk add input).
- image_select: `source.library`, `pageSize`, `selectMin`, `softCap`, `tagOnSelect.{prompt,maxLen}`, `overCapNudge`.
- image_describe: `fromKey`, `questions`, `descriptionPrompt`, `minDescribed`.
- text_select: `source.library`, `selectExactly`, `reflectOnSelect.{prompt,maxLen}`.
- recap: widget only; activity-level `recap_prompt`.
- suggest: `suggest.{mode: auto|on_demand, count, buttonLabel, prompt}` on a list_builder or risk_blocks add step.
- Response conventions: image_select/image_describe -> `[{library_id, storage_path, tag, description?}]`; text_select -> `[{saying_id, text, author, description}]`; server-written keys `analysis`, `chat`, `recap` (never client-saved); transient `_suggest` (per-key pending suggestions, client-managed, persisted).

## Frontend patterns

- Runner (`src/pages/coaching/CoachingActivityRunner.tsx`): widget set is textarea, list_builder, risk_blocks (add + subfield detail, configurable labels), ai_panel (+chat), synthesis, image_select, image_describe, text_select, content, recap, plus the SuggestionPanel attached to list_builder and the risk-add step. `canAdvance` gates per widget. `goNext` flushes then triggers analysis on the step's touchpoint.
- Keepsake (`src/components/coaching/CoachingViews.tsx`): `SynthesisView({responses, steps})` renders generically from definition steps by widget; `AiAnalysisPanel` strips code fences before sanitizing.
- `CoachingSessionView.tsx` selects `coaching_activities(title, tier, definition)` and passes `steps` to SynthesisView; renders a generic picture keepsake by detecting response arrays with `storage_path`.
- `TransitionMap.tsx`: one responsive SVG, eight `<g data-group>` regions with exact names Purpose, Future, Present, Past, Life's Tools, Pathway, Resolve, Support; tinted palette; `onSelectGroup` + `lockedGroups` props; hover/focus; orange lock badges (orange reserved for CTA/lock). `CoachingActivities.tsx` wires the map as default view with a Browse-all toggle, a group modal (cards filtered by `module_group`), Intro/Summary affordances, and `coaching_group_access` for locks and the Summary gate.

## Tinted palette (map regions, fill/stroke)

Purpose #ECE3F4/#3C096C, Future #D8E8DF/#2D6A4F, Present #CFE4E7/#006D77, Past #E3E1E6/#6D6875 (inner circle #C7C4CD), Life's Tools #EBE1CC/#7A5800, Pathway #CFD7DF/#021F36, Resolve/Support sand #F6F2E7/#C9C1AD. Green (Future) and Teal (Present) kept non-adjacent (navy arrow between). Orange #F5741A = CTA and lock badges only.

## Discipline notes reaffirmed this session

- Edge Function deploy: state verify_jwt every deploy; boot-probe (OPTIONS 200, no-auth 401) after. `get_edge_function` is authoritative for live source.
- jsonb definition edits via targeted `jsonb_set` on confirmed step indices (ord is 1-based; array index is ord-1); verify with a follow-up SELECT.
- Read the exact current runner via GitHub SHA before every Lovable prompt; verify shipped files after.
