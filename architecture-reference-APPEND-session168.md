# Architecture Reference — APPEND Session 168

*Append to `architecture-reference.md`. Follows `architecture-reference-APPEND-session167.md`. Covers the coaching access/entitlement model, the shared AI-interaction pool, the universal multimodal input, and the new content/map widgets.*

## Access / entitlement model

- `coaching_activity_access(p_activity_id)` (SECURITY DEFINER, STABLE) reworked. Order: auth -> fetch activity -> draft-gate (drafts super-admin only) -> explicit deny -> explicit grant -> super admin -> entry ticket -> tier gate.
  - Explicit deny/grant now match `module IN ('coaching_activity:'||code, 'coaching:all')`. `coaching:all` is a wildcard: a grant = full coaching access (used for comped coaches); a deny at org scope = coaching off for that org.
  - Entry ticket for `foundational`: a current PTP result (`assessment_results` INST-001, not superseded) OR an active subscription. Active subscription = individual `subscription_status='active'`, or corporate whose org has coaching in contract (`organization_features_view.monthly_coaching_query_allowance > 0`). Returns reason `foundational` | `subscription` | `entitlement_required`.
  - `typical`/`advanced` still gate by subscription/org tier (Base/Premium). Unchanged; unused until such activities exist.
- `module_definitions` gained `coaching:all` (label "All Coaching Activities", sellable). `module_entitlements` FK requires a module_definitions row before any grant/deny — register a module there first.
- Ten practitioner coaches hold `coaching:all` grants (`module_entitlements`, effect `grant`, source `super_admin_comp`).

## Recording access reconciled to session sharing

- `coaching_response_media` SELECT policy `crm: coaches read client` (coach_clients-based) was REPLACED by `crm: viewer reads shared`: a viewer reads a recording iff there is an unrevoked `coaching_activity_shares` row (owner->viewer) covering the recording's session (mode `always`, or `snapshot` with `completed_at <= granted_at`), joining `coaching_activity_sessions` via `coaching_session_id`. This mirrors the session policy exactly, so a coach sees a client's recordings precisely when they can see the session. Owner / super-admin / service / insert / update policies unchanged.

## Shared AI-interaction pool (coaching + chat unified)

- Source of truth: `check-ai-usage` (v66). Counts `ai_usage` rows (`usage_type` in {chat_message, report_generation}, per `month_year`) via `increment_ai_usage`. Limits: individual 200 (Base) / 400 (Premium) [corrected from 30/150 this session, matching `plan_tiers.ai_coaching_limit` and plan copy]; corporate via `user_effective_allowances` (`chat_allowance_per_user`, `ai_chat_enabled`); super admin 9999. One-time fallback: `one_time_chat_credits` + `consume_one_time_chat_credit`. Free/inactive individuals denied unless credits.
- `coaching-activity-analyze` v9->v11 and `coaching-activity-chat` v2: metered activities now call `check-ai-usage` (usage_type `chat_message`, consume) instead of `coaching_usage_check_and_consume`. Unmetered = `module_group='Intro'` or `definition.metered===false` -> fully free. Exempt (never metered) = access reason `granted` (coaching:all) or `super_admin`.
- `coaching_usage_check_and_consume` / `coaching_usage_counters` / `one_time_coaching_credits` are now unused by coaching (retire later).

## Edge Function versions (this session)

- `coaching-activity-analyze` v11: v9 Intro-free; v10 shared-pool metering; v11 transcript-aware serialization. A session-wide `media_id -> transcript` map resolves recordings in ANY field. `serializeValue` and `buildResponseBlocks` treat a value/array-item/risk-subfield as string (typed/dictated) OR `{mode,media_id}` (recording, resolved to transcript). `buildAnswersBlock` (qa_multimodal) unchanged.
- `coaching-activity-chat` v2: shared-pool metering + Intro/exempt free (was metering every turn).
- `check-ai-usage` v66: individual limits 200/400.
- All redeployed with `verify_jwt=false` preserved; boot-probed (OPTIONS 200 / no-auth 401).

## Universal multimodal input

- `src/components/coaching/MultimodalField.tsx` (new): shared primitive. Value contract `MMValue = string | { mode:'audio'|'video', media_id }` — typed/dictated stays a string, a recording is an object. Exports `MediaRecorderPane`, `DictateButton`, `uploadCoachingRecording({sessionId,activityCode,questionKey,kind,blob})`, and helpers `isMMRec`/`mmIsFilled`. Modes default to all four; a caller may pass `modes` to narrow. Video mode also allows file upload. Re-record reuses the same `questionKey` (broker upserts).
- Backend was already generic: `coaching-response-upload` keys a `coaching_response_media` row by `(user_id, coaching_session_id, question_key)` and returns `{upload_url, media_id}`; `mux-webhook` captures the transcript; `get-coaching-response-video-url` serves signed playback.
- Runner (`CoachingActivityRunner.tsx`): `MultimodalField` wired into `textarea`, `content` reflection, `list_builder` add-item, `risk_blocks` title + subfields, `text_select` reason, `image_describe` description. `qa_multimodal` refactored to reuse the extracted primitives. `mmIsFilled` drives `canAdvance`/validation. Question-key conventions: `step.key`; `${step.key}:${index}` (list); `${step.key}:${riskIndex}:{text|a|b|c}` (risk); `${step.key}:${sayingId}:reason` (text_select); `${fromKey}:${libraryId}:desc` (image_describe).
- Keepsake (`CoachingViews.tsx` `SynthesisView`) + history render recordings via `CoachingRecordingPlayer` (+ transcript) for every field type; a string renders as text. `ai_panel` chat + `image_select` tag are type+dictate only.

## New content / map widgets

- `content` widget: optional `resources: [{id,title}]` renders inline `ResourceVideo` players (signed via `get-resource-video-url`).
- `transition_map` widget + `TransitionMapWalkthrough`: embeds `TransitionMap` (which gained an `activeGroup` prop dimming non-active regions and drop-shadowing the active one) with a stepper of narration `beats: [{group,label,body}]`; clicking a region jumps to its beat. Region `group` values match the map's `data-group` names (Purpose, Future, Present, Past, Pathway, Life's Tools, Resolve, Support).

## Activity definition schema additions

- content: `resources` (inline Resource videos), `reflection` (optional).
- `transition_map`: `beats: [{group,label,body}]`, optional `intro`.
- Multimodal: every text widget accepts an optional `modes` array; default all four when omitted.

## Discipline notes reaffirmed

- No metered coaching activity is live yet (only free Intro), so the shared-pool metering path and generalized-field transcript resolution are code-verified + boot-probed but not yet click-through E2E.
- Verify backend via simulated JWT claims + rolled-back transactions (OPS-1 blocks password sign-in). Read exact live runner/keepsake via GitHub SHA before every Lovable prompt; verify shipped files after.
