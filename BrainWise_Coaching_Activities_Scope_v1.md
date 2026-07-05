# BrainWise Coaching Activities — Full Scope (v1)

Status legend: **[built]** live and verified this session, **[wired]** deployed but not yet exercised end to end, **[planned]** not started, **[gate:Phil]** blocked on Phil Dixon sign-off.

Scope date: current session. This is a standalone scope document. At session close it feeds `build-queue.md` and `architecture-reference.md`.

---

## 1. Purpose and the experience bar

My BrainWise Coach turns Phil Dixon's two-day intensive into an asynchronous, AI-driven coaching experience. Each activity is a self-contained interactive flow that carries the user's Personal Threat Profile (PTP) and their accumulated coaching history, interprets their work against that profile, and holds a real coaching conversation.

The bar for this product is a premium, calm, considered experience, not a form-filling tool. That bar is not a slogan in this document. It is written as concrete requirements in Section 10, and every activity build is measured against them. If a build meets the functional spec but fails Section 10, it is not done.

Three non-negotiables:

1. The user never loses work. Progress persists per step and resumes exactly where they left off.
2. Every interpretation is grounded in the individual's real PTP and their prior coaching work, never generic.
3. The visual and written output is something a user would keep, revisit, and share, not discard.

---

## 2. Scope correction: activities versus reference material

The source material ("the 250") is two different things, and conflating them inflates the build by roughly 60 percent.

**Appendix A — coaching activities (~150).** Interactive, AI-driven flows across the ten groups, each split into Foundational, Typical, and Advanced tiers. These are what the coaching engine runs. Full catalog in Section 5.

**Appendix B — supporting documents (~90).** Papers, model write-ups, slide decks, reading lists, brain-science references. These are static reference material. They belong in a reference library or Resources, not the activity engine. Building them as activities would be wrong. Handling in Section 13.

Net: the activity build is about 150, and even inside Appendix A a meaningful share are content-and-reflection rather than novel interactions (Section 6).

---

## 3. Architecture (built this session)

The engine treats an activity as data. A row in `coaching_activities` carries a `definition` (steps, prompts) plus metadata. A generic renderer runs any activity from its definition. Adding most activities is a data insert, not a code change. This is the payoff that makes 150 activities tractable and makes the authoring UI possible later.

### 3.1 Tables (all RLS-enabled) [built]

- `coaching_activities` — catalog. Columns: id, code, title, module_group, tier, sequence, desired_outcome, status (draft/published), definition (jsonb), version, tags (text[]), thumbnail_url, timestamps. RLS: published readable by any signed-in user, super admin sees drafts, super admin manages all.
- `coaching_activity_sessions` — one row per user run. Columns: id, user_id, activity_id, parent_session_id (restart lineage), status (in_progress/completed/abandoned), current_step, responses (jsonb), context_snapshot (jsonb), completed_at, timestamps. RLS: owner full control, shared viewer read, super admin read.
- `coaching_activity_shares` — grant-based sharing. Columns: id, owner_user_id, viewer_user_id, mode (snapshot/always), granted_at, revoked_at. A snapshot grant covers everything completed up to grant time; an always grant covers future runs too. RLS mirrors `ptp_result_shares`.
- `coaching_user_summary` — rolling per-user narrative (the memory). Columns: user_id (pk), summary (jsonb), last_session_id, updated_at.
- `coaching_usage_counters` — monthly coaching-run meter keyed (user_id, period_start). Handles individual and corporate uniformly.
- `coaching_credit_grants` — one-time coaching-credit ledger, idempotent by source_ref, separate from the chat-credit ledger.

`users.one_time_coaching_credits` column added for the free-tier trial pool.

### 3.2 RPCs [built, each verified with a rolled-back test]

- `coaching_activity_access(p_activity_id)` — single source of truth for lock state. Order: explicit deny, explicit grant (coach assignment wins), super admin, PTP baseline, tier gate. Returns {allowed, reason, activity_tier}.
- `coaching_activity_access_batch()` — same decision for every visible activity in one call, for the catalog.
- `coaching_usage_check_and_consume(p_user, p_check_only)` — meters a run. Super admin is unlimited and unmetered. Recurring allowance first, then one-time coaching credits as fallback. Service-role only.
- `coaching_session_save(p_session_id, p_current_step, p_patch)` — merges user-input keys into responses server-side, preserving the server-written analysis and chat.
- `grant_one_time_coaching_credits` / `consume_one_time_coaching_credit` — credit ledger operations, service-role only.
- `grant_coaching_credits_on_assessment_purchase()` — trigger on `assessment_purchases`, grants 10 coaching credits per purchase, idempotent by purchase id.

### 3.3 Edge functions [wired; boot-probed, one full completion observed]

Routed through `ai_model_registry`. Roles `coaching_analysis` and `coaching_chat`, both on Sonnet.

- `coaching-activity-analyze` (v2) — enforces access then consumes one unit, assembles context (current PTP scores and bands plus stored PTP narrative, plus the rolling summary), interpolates the activity's `analysis_prompt`, calls Sonnet, stores `responses.analysis`.
- `coaching-activity-chat` (v1) — same gate, one unit per turn, builds the system prompt from the activity's `chat_prompt` plus PTP plus rolling summary plus prior analysis, appends to `responses.chat`.
- `coaching-activity-summary` (v1) — no gate, runs on completion, folds the finished session (inputs, analysis, chat) into `coaching_user_summary`.

---

## 4. The flow engine and widget palette

An activity `definition` is:

```
{
  steps: [ { id, widget, key, ...config } ],
  response_keys: [...],
  analysis_prompt: "<template with {tokens}>",
  chat_prompt: "<system template with {tokens}>"
}
```

The renderer maps each `widget` to a component. Prompt tokens available server-side: `{ptp_block}`, `{story_block}`, plus per-activity input keys.

### Widget palette

**Built (from the Clarity Engine):** `textarea`, `list_builder`, `risk_blocks` (with optional A/B/C subfields), `ai_panel` (+ chat), `synthesis`.

**Planned, in rough order of effort:**

- `content` — display an image, model, or set of inspirational statements, optional short reflection. Trivial. Unblocks the openers and model explainers. [planned]
- `image_capture` — user supplies or selects images, describes each, AI extracts themes. Needs Supabase storage. Unblocks "Pictures of the future" and the wider image strategy. [planned]
- `ptp_display` — renders the user's live PTP profile inside an activity. [planned]
- `select_model` — choose a position within a named model (e.g., Hudson's Life's Phases). [planned]
- `matrix_2x2` — quadrant input (Motivation Matrix, some team tools). [planned]
- `goal_form` — structured SMART / FAST / CLEAR goal capture. [planned]
- `timeline` — plot events over time and mark patterns (Life's events and patterns). [planned]
- `survey` — scored questionnaire. Prefer reusing the existing assessment engine over rebuilding here. [planned, gate: decide reuse vs build]
- `diagram` — mind map / spider diagram capture. Optional, low priority. [planned]

---

## 5. Full activity catalog (Appendix A)

Per activity: code, title, one-line purpose, widget tag. Tags: `standard` = textarea/list + AI panel + chat; others name a planned widget. Every group opens with an "Inspirational sayings" content piece.

### 01 — Intro
Foundational: 0105 Their Personal Story (initial conversation, targeted outcomes) `standard`; 0110 Kick-off the coaching process (what they want from coaching) `standard`; 0115 Initial thoughts about the journey `standard`; 0120 The Transition Map (+ppt) (introduce the map) `content`; 0130 Understand the Brain (recap of brain basics) `content`.
Typical: 0125 Initial thoughts about the Transition Map `standard`; 0135 Resistance to change (early comfort-building) `content`+`standard`.

### 02 — Purpose
0201 Inspirational sayings `content`.
Foundational: 0205 The Start (impact of having a purpose) `standard`; 0210 Your Ikigai (+ppt) (four-area guided discussion) `goal_form`/structured.
Typical: 0215 Hedgehog principle `standard`; 0220 Exploring possibilities `standard`; 0225 Exploring even deeper `standard`; 0230 Exploring your passions `standard`; 0235 Desires and dreams `standard`; 0240 Values `standard`; 0245 Qualities `standard`.

### 03 — Future
0301 Inspirational sayings `content`.
Foundational: 0305 Collecting your thoughts `standard`; 0310 Pictures of the future (image select/describe, AI themes) `image_capture`; 0385 What stands out `standard`.
Typical: 0315 Letter from the future `standard`; 0320 Collecting your thoughts `standard`; 0325 Some deeper questions `standard`; 0330 Human being or human doing? `content`+`standard`; 0335 What I want to do `standard`; 0340 Who I want to be `standard`; 0345 Collecting your thoughts `standard`; 0350 Concerns I have `standard`; 0375 A deeper review `standard`.
Advanced: 0355 What else is important? `standard`; 0360 An ideal day `standard`; 0365 Write your own obituary `standard`; 0370 Using death as an ally `standard`; 0380 Ask others `standard`.

### 04 — Present
0401 Inspirational sayings `content`.
Foundational: 0420 Your PTP (debrief/review the profile) `ptp_display`; 0450 Your team (sub-personalities) `standard`; 0475 Additional future thoughts `standard`.
Typical: 0410 Your skill set `standard`; 0415 Your world view `standard`; 0430 Life's Phases 2 (+ppt) (Hudson four-phase) `select_model`; 0445 Using past assessments `standard`; 0455 Your current environment `standard`; 0460 What is good enough? (maximizer vs satisficer) `content`+`standard`; 0470 What would you like to change? `standard`.
Advanced: 0405 What comes first? (head/heart/gut) `select_model`; 0425 Life's phases 1 `content`; 0435 Life's phases 3 `content`; 0440 Life's phases 4 (aging well) `content`; 0465 Motivation Matrix (love/loathe x good/not good) `matrix_2x2`.

### 05 — Past
0501 Inspirational sayings `content`.
Foundational: 0503 Recent Past (impact of recent events) `standard`; 0505 Major Influencers and the Mirror `standard`; 0545 Additional future thoughts `standard`.
Typical: 0510 Major Influences (Cialdini's six) `content`+`standard`; 0515 Personal Influences `standard`; 0520 Positive Experiences `standard`; 0525 Negative Experiences `standard`.
Advanced: 0530 Life's events and patterns (plot over time) `timeline`; 0535 Life in Flow (+ppt) `standard`.

### 06 — Life's Tools Decoded (special case, ~60 tools)
This is a toolkit, not a linear part. Many items are "here is a model, reflect briefly," several overlap with reference material, and a few are marked "to be written." Recommend a lighter content+reflection template and a per-item decision on activity versus reference doc. Grouped families:
- Change (06C05–06C90): Change vs Transition, Background Conversations (+ppt), Failure Talk, Losses, Grief, Resistance (+ppt), Learning to change, Agreeableness, Types, Readiness, Language and attitude, Friends and change, Using strengths, Growth Mindset, Biases, Habits, Creating new habits, Celebrating success. Mostly `content`+`standard`.
- Art of Dialog (06D1–06D9): Responsibility, Drama to Vision (+ppt), Advocacy-Inquiry, TAPS, Listening (+ppt), Ladder of Inference (+ppt), Questioning, Making Your Case, Checking Success. Mostly `content`+`standard`.
- Ideation (06I): Mind Mapping, Spider Diagrams, Flow, Issue Resolution, Multiple Intelligences. `standard` or optional `diagram`.
- Relationships (06R/06S): Personal Molecule (+ppt), Relationship Quotient, Hi's and Lo's, Review-Preview, Sleep, Stress, Trust. `content`+`standard`.
- Leadership/Org/Team (06L/06P/06T/06V): Delegation, Networking (+ppt), Objective setting, Org Growth, Scenario Planning, Mission, Vision, and ~15 Team modules including several surveys (Team Development Survey, Team Effectiveness Survey). Team surveys are `survey`; the rest `content`+`standard`.

### 07 — Pathway
0701 Inspirational sayings `content`.
Foundational: 0705 Change Review (Neutral Zone) `content`; 0710 Journalling `content`+`standard`; **0745 Action Evaluation / Risk Analysis** `built` (this is the Clarity Engine, already live); 0770 Additional future thoughts `standard`.
Typical: 0721 Accountability RAPID (+ppt) `select_model`/`matrix`; 0723 Passive vs Active voice `content`+`standard`; 0724A Accountability Victim (+ppt) `content`+`standard`; 0730 Choices `select_model`; 0735 Action steps `standard`; 0750 Goal setting (SMART/FAST/CLEAR) `goal_form`.
Advanced: 0715 Awareness `standard`; 0725 Coming up with ideas `standard`; 0740 Event Criteria `standard`; 0741 Increasing your chances `standard`; 0755 Goal Refinement OMR `standard`; 0760 Nine Things for success `content`+`standard`; 0765 Problem types `select_model`.

### 08 — Resolve
0801 Inspirational sayings `content`.
Foundational: 0820 Decisions Already Made (nonconscious decision model, plot position) `select_model`.
Typical: 0805 Staying Power `standard`; 0810 Adaptation `standard`; 0815 The Change Reflex `content`+`standard`.
Advanced: 0825 Maintenance `standard`.

### 09 — Support
0901 Inspirational sayings `content`.
Foundational: 0915 Networking (formal model) `content`+`standard`.
Typical: 0905 General ideas `standard`; 0910 Elevator Speech (two-minute future) `standard`.
Advanced: 0920 Role models and mentors `standard`.

### 10 — Summary
Foundational: 1005 Commitments (review all commitments) `synthesis`; 1010 Symbols and celebrations (acquire a symbol, plan a celebration) `standard`+`image_capture` optional; 1015 Capturing it all (wrap-up) `synthesis`.

---

## 6. Widget coverage and net-new work

Coverage estimate against Appendix A:

- `standard` and `content` only: roughly 70 to 80 percent. These are data inserts once the `content` widget exists.
- `image_capture`: 0310 and optional use in 1010. First real new build. Also the foundation for thumbnails and inline imagery.
- `select_model`: 0430, 0405, 0730, 0765, 0820, 0721. One reusable widget.
- `matrix_2x2`: 0465, some team tools.
- `goal_form`: 0210, 0750.
- `timeline`: 0530.
- `survey`: the 06 team surveys. Decision: reuse the assessment engine or build a coaching survey widget. Prefer reuse. [gate: decide]
- `ptp_display`: 0420, and useful anywhere the coach references the profile.

So five to six net-new widgets cover the entire catalog. Each is built once and joins the palette.

---

## 7. Image and media strategy

Cole's requirement: thumbnails per activity and imagery throughout the pieces.

- **Storage.** A Supabase storage bucket for coaching media, public-read for published assets, with a size and type policy. [planned]
- **Thumbnails.** `coaching_activities.thumbnail_url` exists. Rendered on catalog cards, with a tier-colored fallback when null. Setting the image needs either a URL (SQL now) or upload (with authoring). [built column; upload planned]
- **Inline step images.** The `content` and `image_capture` widgets carry image references in the step definition, so an activity can show a model diagram, a photo set, or a hero image mid-flow. [planned]
- **Activity hero.** Each activity may carry a hero image shown at the top of the runner. [planned]
- **User-supplied images.** `image_capture` lets the user upload or pick images for exercises like Pictures of the future. [planned]

Recommendation: build storage and the `image_capture` widget together via 03 Future, because that single build clears thumbnails, hero images, inline images, and the first image-based activity.

---

## 8. Access, entitlement, and metering

Distribution is both self-serve and coach-delivered. Coach assignment wins on overlap.

Decision order (from `coaching_activity_access`):

1. Explicit deny — hard block.
2. Explicit grant (coach assignment or admin comp, via `module_entitlements` keyed `coaching_activity:<code>`) — overrides tier.
3. Super admin — full access to all tiers including drafts, unlimited and unmetered.
4. PTP baseline — a current PTP result is required. No PTP means everything is locked behind "take the PTP first." Rationale: the activities inject PTP and are degraded without it.
5. Tier gate — Foundational for anyone past the baseline; Typical for individual Base or Premium or a corporate seat; Advanced for individual Premium or corporate Premium.

Metering (from `coaching_usage_check_and_consume`), one unit per analyze call and per chat turn:

- Individual: `plan_tiers.ai_coaching_limit` (Free 0, Base 200, Premium 400).
- Corporate: `subscription_tiers.monthly_coaching_query_allowance` per seat (Base 50, Premium 100).
- Free trial: 10 one-time coaching credits granted per assessment purchase, used only as a fallback when no recurring allowance remains. Applies to Foundational only.
- Super admin: unlimited, no counter row written. `remaining = -1` signals unlimited to the UI.

---

## 9. Memory and learning

Every session saves full content (inputs, analysis, chat). On completion, `coaching-activity-summary` folds that session, including the chat, into `coaching_user_summary`, the running story of the person. Both the analysis and the chat inject that summary, so each new activity and each chat turn is grounded in everything the person has done before. Because the chat is part of what gets summarized, talking to the coach feeds the next update. It compounds across modules.

This is persistent memory, not model training. The AI reads a maintained summary; it does not fine-tune on user data.

Limits: the summary is a compressed narrative, not verbatim recall. On-demand retrieval of a specific past session is a future add-on. The summary updates on completion, so in-progress work does not reach cross-session memory until finished, though the current session sees its own content directly.

Optional extension: inject the same summary into the platform's general AI chat so it also draws on coaching work. Not built. [planned, optional]

---

## 10. World-class experience requirements

This section is the bar. A build that meets the functional spec but fails here is not done. Requirements are written to be testable.

### 10.1 Visual treatment

- Brand tokens only. Navy `#021F36`, Orange `#F5741A` for CTA and accent only, Sand `#F9F7F1`, Teal, Gray, Purple, Green, Mustard per the canonical set. No off-brand colors. PTP domain colors fixed: Protection Navy, Participation Teal, Prediction Gray, Purpose Purple, Pleasure Green.
- Calm, reflective aesthetic. This is coaching, not a dashboard. Generous whitespace, a clear type hierarchy, one primary action per screen, restrained accent use.
- Imagery is first-class, not decoration. Activity hero images, inline model diagrams, and user photos are part of the experience. No empty gray placeholders in the shipped state.
- Consistent card system with the LMS grid, but a bespoke `CoachingActivityCard` with tier badge, tags, thumbnail or tier-colored header, and a single state-driven action.

### 10.2 Interaction and flow

- Never lose work. Per-step autosave via `coaching_session_save`, a visible "saved" state, and a flush on exit so nothing is lost inside the debounce window.
- Resume exactly. Returning to an activity resumes the exact step and content. Refresh-safe (the `fresh=1` URL is cleared after a fresh start).
- Clear progress. A step indicator, the ability to move back, and restart options: start fresh or reuse prior answers.
- Considered AI reveal. The analysis does not dump as a wall of text. It arrives with an intentional loading state and renders as structured, readable content.
- Coach-grade chat. Grounded in the user's PTP and history, warm and direct, not a generic chatbot. Sonnet on both analysis and chat.
- Graceful states. Loading, empty, no-PTP, locked, upgrade, and limit-reached states are all on-brand and never dead ends. Each offers the next action.
- Motion. Smooth step transitions and subtle feedback, with `prefers-reduced-motion` honored.

### 10.3 Output quality

- The written output is a keepsake. The analysis and synthesis are formatted, readable, and worth revisiting. Sanitized HTML, proper typography, not raw text.
- Revisitable. History lists completed sessions; a read-only view shows the plan, chat, and synthesis again.
- Exportable. A polished PDF export of a completed session, matching the quality of the PTP reports. [planned]
- Shareable. Snapshot or always-share with a coach, and admin visibility, without the user losing control of their own reflections.

### 10.4 Accessibility and reach

- Keyboard navigable end to end. Screen-reader labels on every input and control. Contrast meets WCAG AA. Fully responsive, usable and beautiful on mobile.

### 10.5 Trust and safety

- Model output is sanitized before render (DOMPurify, restricted tag set). Access and metering are enforced server-side, never trusted from the client. Sharing is explicit and revocable.

---

## 11. Build sequencing

1. **Content widget + first common group.** Add the `content` widget, build one mostly-standard group end to end (recommend 05 Past or 02 Purpose) to prove that a new activity is a data insert. Locks the visual and interaction bar for the standard pattern.
2. **Image infrastructure + `image_capture`.** Build storage and the image widget via 03 Future's Pictures of the future. Clears thumbnails, hero images, inline images, and the first image activity together.
3. **Remaining widgets on demand.** Add `select_model`, `matrix_2x2`, `goal_form`, `timeline`, and `ptp_display` only as the specific activity that needs them comes up, group by group.
4. **PDF export** for completed sessions, to the PTP-report standard.
5. **Reference library** for Appendix B.
6. **Authoring UI** last, once every widget exists, so authors work on a complete palette.

Foundational tiers across all ten groups are the priority within each group, since they are the ones used in most engagements.

---

## 12. Open decisions and Phil-gated items

- Survey widget: reuse the assessment engine or build a coaching survey. Recommend reuse. [gate: decide]
- Voice capture and transcription for Pictures of the future. Historically voice; text is fine for v1. [planned, optional]
- 06 Life's Tools Decoded: per-item decision on activity versus reference doc. [gate: Phil]
- Instrument-content decisions, wording, and the AI touchpoints for each activity. [gate: Phil]
- Whether the Free 10-credit trial ever extends beyond Foundational. Current decision: Foundational only.
- General-chat integration with the coaching summary. [planned, optional]

---

## 13. Appendix B — reference library

The ~90 supporting documents are reference material, not activities. Recommendation: surface them in a reference library, either within Resources or as a "Coaching Library" area, browsable and searchable, tagged by theme. They are not gated by coaching credits and do not run through the activity engine. Some may be attached to relevant activities as optional further reading. This keeps the activity engine focused and gives the material a proper home.

---

## 14. Current state summary

Live and verified: the full backend (tables, RLS, gating, credits, sharing, memory), three edge functions, and the Clarity Engine (module 0745) as the reference activity with analysis and chat prompts, tags, and a thumbnail column. Frontend: catalog with search, tags, and thumbnails, a definition-driven runner, history and read-only session view, restart and coach sharing, with the resume and persistence fixes applied.

Not yet built: five to six net-new widgets, image storage and upload, PDF export, the other ~149 activities, the reference library, and the authoring UI.

One full session has completed end to end, including a rolling-summary update, which confirms the analyze-to-complete-to-summary loop works.
