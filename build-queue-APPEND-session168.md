# Build Queue — APPEND Session 168

*Append to `build-queue.md`. Follows `build-queue-APPEND-session167.md` (multimodal Q&A subsystem). This session completed the Intro (Foundational) group, published it, built the coaching access/entitlement model, unified coaching metering with the AI-chat allowance, and shipped a universal multimodal input capability across all coaching text fields.*

## Epic: My Coaching — Intro group, publishing, access model, metering, universal multimodal

### DONE (built and verified via GitHub SHA reads + Supabase rolled-back simulations + boot-probes)

- COACH-0105-QA-VERIFY: verified the multimodal Q&A keepsake/coach playback end to end. Owner keepsake plays recordings with transcript; coach playback authorized. Reconciled recording access (see COACH-MEDIA-SHARE).
- COACH-CONTENT-0110: "Kicking off your coaching" (Intro/Foundational). content intro + content reference + `qa_multimodal` (7 kick-off questions, all modes) + `ai_panel` summary. Definition-only build (no new widget, no Lovable).
- COACH-CONTENT-0115: "Initial thoughts about the journey" (Intro/Foundational). content intro + `qa_multimodal` (10 questions) + `ai_panel` updated summary with a dedicated concerns/questions section. Definition-only.
- COACH-CONTENT-0120: "The Transition Map" (Intro/Foundational). content intro + new `transition_map` widget: the interactive map embedded with a 9-beat narration walkthrough, each beat highlighting one region.
- COACH-CONTENT-0130: "Understand the brain" (Intro/Foundational). content-only: two inline Resource-video players (the two Introduction to the Brain videos) + the five-driving-forces summary + brain-health summary + an optional takeaway reflection.
- COACH-WIDGET-content-resources: `content` widget gained a `resources: [{id,title}]` field rendering inline Resource-video players (`ResourceVideo`, reuses `get-resource-video-url`).
- COACH-WIDGET-transition_map: new `transition_map` widget + `TransitionMapWalkthrough` component; `TransitionMap` gained an `activeGroup` highlight prop.
- COACH-COACH-SURFACE: coach can review a client's shared coaching sessions. `CoachClientCoaching` panel embedded in the coach client view; `CoachingSessionView` made coach-safe (read-only for a non-owner viewer, back link to the coach console). Recording access reconciled to session sharing (COACH-MEDIA-SHARE).
- COACH-PUBLISH-1 [DONE]: all five Intro activities flipped `draft` -> `published`. Access gate reworked (see ARCH APPEND): entry ticket = current PTP OR active subscription OR an explicit grant. Verified with non-admin simulated-claims fixtures (PTP holder -> allowed; no-PTP corporate with coaching contract -> allowed via subscription; granted coach -> allowed; none-of-the-above -> denied).
- COACH-COACH-GRANTS: ten practitioner coaches granted full coaching access via a new `coaching:all` module wildcard (grants tracked in `module_entitlements`; UUIDs in Supabase). Same wildcard is the per-org coaching on/off switch (grant/deny at org scope).
- COACH-INTRO-FREE: Intro activities are now fully free (analyze v9): no usage check, no consumption. Access still gated by the entry ticket.
- COACH-METER-UNIFY: metered coaching now draws from the SAME monthly pool as AI chat. analyze v10 + chat v2 route metered activities through `check-ai-usage` (usage_type `chat_message`); Intro + full-access grants + super admin are exempt. Retired the coaching-specific counter for metering.
- COACH-MULTIMODAL-UNIVERSAL: every coaching text input now supports type / dictate / record-audio / record-video, default-on. Shared `MultimodalField` primitive; wired into textarea, content reflection, list_builder, risk_blocks, text_select reason, image_describe; keepsake + history render recordings with transcript; analyze v11 resolves recording transcripts by media_id for every field. `ai_panel` chat + `image_select` tag are type+dictate only (async transcript does not fit synchronous chat / a one-word tag).

### BUGS (this session)

- BUG-CHAT-LIMIT [FIXED]: `check-ai-usage` enforced individual limits of 30/150 while `plan_tiers` and the plan copy advertise 200/400. Corrected to 200/400 (v66). Pre-existing, affected AI chat independently of coaching.
- BUG-INTRO-CHAT-METERED [FIXED]: `coaching-activity-chat` metered every chat turn, including inside free Intro activities. Now Intro/exempt chat is free (v2).

### DECISIONS LOCKED (Session 168)

- Entry ticket for Foundational coaching = current PTP OR active subscription OR explicit grant. Tier gating (Typical=Base/Premium, Advanced=Premium) unchanged; no Typical/Advanced activities exist yet.
- Coaching and AI chat share ONE monthly interaction pool. Confirmed number: 200 (Base) / 400 (Premium) individual; corporate via org contract.
- Intro group is the free on-ramp: unmetered and un-consumed.
- Universal multimodal is default-on for all text inputs, now and for all future activities. No per-activity definition retrofit needed.
- The single evolving coaching report is deferred to the Summary group as a structured, coach-facing capability (not per-activity blob overwrite); per-activity summary + rolling `coaching_user_summary` context is the model until then.
- Recording access mirrors session sharing (share-based), not a separate coach_clients rule.

### QUEUED / NEXT (Session 169+)

- COACH-GROUP-PURPOSE [NEXT]: Purpose (Foundational) modules. Source OneDrive `MBWC-02a-Foundational`. Same cadence.
- COACH-GROUP-PRESENT [NEXT]: Present (Foundational) modules. Source OneDrive `MBWC-04a-Foundational`.
- COACH-METER-CLEANUP: retire now-unused `coaching_usage_check_and_consume`, `coaching_usage_counters`, `one_time_coaching_credits` (superseded by the shared AI pool).
- COACH-REPORT-EVOLVING: structured, coach-facing evolving report at the Summary group.
- COACH-CHAT-RECORD (optional): record-and-wait audio/video in the in-activity chat box, if desired.

### GATES / OPEN

- OPS-1 [STILL OPEN]: documented test password does not authenticate PTP fixtures; backend verified via simulated JWT claims + boot-probes, not password sign-in.
- Live E2E residuals (env-limited, code-verified): the metered `analyze -> check-ai-usage` path and a recorded-answer-in-a-generalized-field keepsake replay can only be clicked through once a metered activity is live and a real non-admin session exists.
