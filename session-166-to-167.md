# BrainWise Session 166 to 167 Handoff

*Closeout: Session 166. Open: Session 167.*

*Continuation of the My Coaching build. Session 165 stood up the coaching backend and the Clarity Engine reference activity. This session built the activity engine, the first real activities, the Transition Map landing, and AI list suggestions. If the local session count differs, adjust NN/MM on upload.*

## Where Session 166 left off

The generic activity engine is complete: a full widget palette (content, image_select, image_describe, text_select, recap, list_builder, risk_blocks, ai_panel, synthesis) driven by the activity definition, a generic keepsake, and AI suggestions you confirm or deny. Five activities run end to end (Clarity Engine, Pictures of the Future with all three phases, Inspirational Sayings, Collecting Your Thoughts, and the Pitch Engine), all with thumbnails. The Transition Map is the `/coaching` landing with clickable regions, lock badges, and a Summary gate. Everything is still `status='draft'` (super-admin only) until we publish.

## Session 167 opening priorities, in order

### 1. Scope and build 0385 "What stands out"

The last Foundational Future activity. Source in OneDrive MBWC-03a-Foundational (search "What stands out"). Follow the cadence: read the source, scope it to a world-class bar, present for Cole's approval or additions, then build backend-first. Most activities are a data insert into `coaching_activities`; only build a new widget if 0385 needs one.

### 2. Publish activities out of draft

All coaching activities are `status='draft'`, so only the super admin sees them. Decide the publish gate and flip the built activities so real users (with the right PTP/tier) can run them. Verify access with `coaching_activity_access_batch` and `coaching_group_access` as a non-admin fixture.

### 3. Continue the groups

Finish any remaining Future activities, then move to the next group (Purpose or Past are good "standard pattern" groups). Foundational tiers first within each group.

## Decisions locked in Session 166 (recap)

- The engine is definition-driven. A new activity is a row in `coaching_activities` with a `definition` (steps, prompts, briefing). New code only when a genuinely new widget is needed.
- AI suggestions are confirm-or-deny (Add/Dismiss), unmetered, stable across navigation (pending set in `responses._suggest`), and grounded so they exclude what the person already entered. Auto mode populates on entry (0305); on-demand mode is a button after the user's own entries (Clarity Engine risks). Prompt + code filter + confirm step keep repeats rare; a near-duplicate can still slip and is dismissed in one tap.
- The recap uses a fresh on-entry AI call (`coaching-activity-recap`), not the raw rolling summary, because the summary is third-person analytical notes. This capability is reusable for the Summary group.
- Clarity Engine positives are framed as "Your measure of success" (keepsake label, in-flow reference cards, and a closing note in the coaching plan).
- Pitch Engine is scoped to a specific pitch, and buyer language stays at drivers/motivations, not formal PTP claims about the buyer.
- Map region click opens a group modal, not a separate page. Orange is reserved for CTA and lock badges. Green (Future) and Teal (Present) never adjacent.
- Recap and suggest are access-gated but never metered, so they do not burn a coaching run.

## Open questions / things to lock in Session 167

- Publish gate and rollout for taking activities out of draft.
- 0385 may or may not need a new widget; decide during scope.
- None blocking.

## Bugs surfaced in Session 166

- BUG-COACH-3 [FIXED]: coaching plan rendered a leading ```html code fence. Fixed in analyze (strip before store) and AiAnalysisPanel (strip at render).
- BUG-COACH-4 [FIXED]: History view missing the picture keepsake and text inputs. Fixed by the generic SynthesisView fed with `definition.steps`.
- BUG-COACH-5 [FIXED]: new widget keys were not persisted (buildUserPatch only saved the four Clarity Engine keys). Fixed with a generic save that excludes only server-written keys.
- OPS-1 [STILL OPEN]: documented test password no longer authenticates any PTP fixture; blocks full manual E2E via password sign-in.

## What's NOT in scope for Session 167

- The authoring UI (still deferred until the widget palette is complete; it effectively is now, but hold until a couple more groups confirm no new widgets are needed).
- Appendix B reference documents as activities.
- PDF export (still queued, after more activities exist).

## Architecture additions in Session 166

Recorded in `architecture-reference-APPEND-session166b.md`. Summary: two library tables (`coaching_media_library`, `coaching_saying_library`), two storage buckets, the `coaching_group_access` RPC, the `coaching-activity-recap` and `coaching-activity-suggest` Edge Functions, `coaching-activity-analyze` advanced to v6 (generic token serializer + fence strip), the full runner widget set, a generic definition-driven keepsake, and the `TransitionMap` component with group-access wiring. Definition schema gained step-level `onComplete.touchpoint`, `summaryLabel`, subfield label config, `selectExactly`/`reflectOnSelect`, the recap widget with `recap_prompt`, and the `suggest` block.

## Test fixture state at end of Session 166

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee)

Super admin (Cole) has a `coaching_user_summary` row from completed activities, which the recap and suggest functions read. All coaching activities are draft, so only the super admin sees them on the map and in the catalog. OPS-1 still blocks password sign-in for the fixtures.

## Documents this session leaves behind

- session-166-to-167.md (this document)
- build-queue-APPEND-session166b.md (activity-engine, widgets, first activities, map, suggestions)
- architecture-reference-APPEND-session166b.md (engine architecture additions)

These are additive to `build-queue-APPEND-session166.md` and `architecture-reference-APPEND-session166.md` (which covered the coaching backend). Markdown source-of-truth at cbastianBWE/brainwise-internal-docs. This session used the markdown APPEND pattern, not docx generation (per the Session 74 markdown-only practice).
