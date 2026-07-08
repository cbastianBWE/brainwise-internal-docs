# Build Queue — APPEND Session 166 (part b)

*Append to `build-queue.md`. Follows `build-queue-APPEND-session166.md` (which covered the My Coaching backend). This part covers the activity engine, widgets, first activities, the Transition Map landing, and AI suggestions built on top of that backend.*

## Epic: My Coaching — activity engine and first activities

### DONE (this session, built and verified via GitHub SHA reads + Supabase rolled-back tests + boot-probes)

- COACH-RUNNER-1: Generic runner rewrite. `buildUserPatch` now saves all response keys except server-written `analysis`/`chat`/`recap`. Analysis trigger is generic: fires on a step's `onComplete.touchpoint === "analysis"` (plus legacy risk-detail), with an explicit `coaching_session_save` flush before analysis so the AI reads current data.
- COACH-WIDGET-content: `content` widget (intro/body/media/statements + optional reflection).
- COACH-WIDGET-image_select: gallery from `coaching_media_library` (transformed thumbnails via `getPublicUrl` transform), tap-to-select, one-word tag modal, live counter, 30 soft cap, removable tray, resume hydration.
- COACH-WIDGET-image_describe: Phase 2 per-picture description pass; writes `description` back into the selected-image items; gate requires each selected picture described (configurable `minDescribed`).
- COACH-WIDGET-text_select: pick exactly N (`selectExactly`) items from a text library, reason captured on selection (modal, reason required), disabled cards at cap, chosen tray.
- COACH-WIDGET-recap: on-entry AI recap. Fires once on mount, calls `coaching-activity-recap`, shows a warm second-person recap; graceful fallback on error so the step never blocks.
- COACH-WIDGET-suggest: `SuggestionPanel` (auto and on_demand modes) driven by `coaching-activity-suggest`, with Add/Dismiss confirm-or-deny, pending set persisted in `responses._suggest` for stability across navigation.
- COACH-KEEPSAKE-1: `SynthesisView` is now generic. Renders inputs from the activity definition steps (by widget) using each step's `summaryLabel`/`label`/`title`, including text_select sayings and risk_blocks with their labels. Wired into the runner completed view and `CoachingSessionView` (which now selects `definition`). Picture keepsake handled by generic detection.
- COACH-WIDGET-risk_blocks-config: subfield labels/helpers and the add placeholder now read from step config (`subfieldLabels`, `subfieldHelpers`, `placeholder`) with fallback to the risk defaults.
- COACH-MAP-1: Transition Map landing. `TransitionMap.tsx` recreated by Lovable from the Oxford image (Lovable iterated the shapes; we recolored to the tinted palette and wired interactivity). `/coaching` now defaults to the map with a toggle to the grouped list, region-click opens a group modal of that group's cards, Intro affordance above, Summary affordance below (gated). Lock badges on inaccessible regions driven by `coaching_group_access`.
- COACH-CONTENT-0310: Pictures of the Future, full three phases (select+tag, describe each, AI themes + chat, picture keepsake).
- COACH-CONTENT-0301: Inspirational Sayings (content opener, choose exactly 3 sayings with reasons, AI reflection + chat, keepsake). Backed by `coaching_saying_library` (11 seeded).
- COACH-CONTENT-0305: Collecting Your Thoughts (on-entry recap, "My future needs to include" list with auto AI suggestions, AI consolidation + chat, keepsake).
- COACH-CONTENT-pitch-engine: The Pitch Engine (Life's Tools, Foundational). Clarity-Engine skeleton reoriented to buyer-centric selling: pitch, buyer drivers, value, message, objections with Pre-empt/Respond/Re-open, AI pitch strategy + buyer role-play chat.
- COACH-CLARITY-mos: Clarity Engine positives reframed as "Your measure of success" (keepsake label + in-flow reference cards + closing note in the coaching plan). On-demand risk suggestions added.
- COACH-THUMBS: All five built activities have a card thumbnail and matching briefing hero (stand-ins from the future library; Pitch Engine wants a purpose-shot image eventually).

### QUEUED (Session 167 and beyond)

- COACH-CONTENT-0385 [NEXT]: "What stands out" — the last Foundational Future activity (source in OneDrive MBWC-03a-Foundational). Scope it world-class first, then build.
- COACH-PUBLISH-1: publish activities out of `status='draft'` so non-super-admin users see them. All current activities are draft.
- COACH-BRIEFING-GATE: briefing intro gate for direct `/coaching/:id` links (people who bypass the card modal). Deferred, small.
- COACH-RECAP-REUSE: the on-entry recap capability (`coaching-activity-recap` + recap widget) is reusable for the Summary group and other consolidation activities.
- COACH-MAP-POLISH: map view briefly shows all-locked badges during the initial `coaching_group_access` load (half-second flash). One-line fix to hold badges until access resolves, if desired.
- COACH-SUGGEST-DISMISS-MEMORY: on-demand suggestions can re-propose a previously dismissed item after a later "suggest more" (excludes entries + current pending, not dismissed history). Low impact; note if it becomes annoying.
- Continue the Future group, then other groups, cadence = Claude scopes world-class from source, Cole approves/adds, then build.

### BUGS (this session)

- BUG-COACH-3 [FIXED]: coaching plan rendered a leading ` ```html ` code fence. Fixed in `coaching-activity-analyze` (stripCodeFence before store) and in `AiAnalysisPanel` (strip at render, covers legacy).
- BUG-COACH-4 [FIXED]: History view (`CoachingSessionView`) did not show the picture keepsake or text inputs. Fixed by generic picture-group detection and the generic `SynthesisView` (now fed `definition.steps`).
- BUG-COACH-5 [FIXED]: picture selections and other new widget keys were not persisted because `buildUserPatch` only saved the four Clarity Engine keys. Fixed with the generic save.

### GATES / OPEN

- OPS-1 [STILL OPEN]: documented test password no longer authenticates PTP fixtures. Blocks full manual E2E via password sign-in.
- Per-activity AI touchpoint wording: not Phil-gated (coaching, not instrument content), but keep buyer/other-person language to drivers and motivations, never formal PTP claims about a third party.
