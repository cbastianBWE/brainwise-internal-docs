# Content Item Viewer Build — Scope, Recon, & Locked Decisions

**Status:** LOCKED at Session 76 close. No deviation. This is the authoritative scope for all 8 content item viewers (Group Z viewer build).

**Sequencing dependency:** Prompt 0 (unified viewer chrome) MUST ship and verify before any per-viewer-type prompt (Prompt 2 — quiz viewer included) can land. Per-viewer prompts plug into the chrome's `item_type` branch; they do not own page routes or breadcrumbs.

---

## 1. Gap matrix — what exists, what's missing

This matrix supersedes the earlier "missed live_event RPC" gap list. Verified live in Supabase as of Session 76 close.

| Surface | Author UI | Author RPC | Completion RPC | Viewer UI |
|---|---|---|---|---|
| Video | ✅ | ✅ | ✅ `record_video_progress(p_content_item_id, p_watch_pct, p_last_position_seconds)` | ❌ NEEDED |
| Quiz wrapper | ✅ | ✅ | ✅ `submit_quiz_attempt(p_content_item_id, p_answers jsonb)` | ❌ NEEDED |
| Quiz questions / options | ✅ Session 76 (Prompt 1) | ✅ Session 76 (5 RPCs) | n/a — scored by `submit_quiz_attempt` | ❌ NEEDED |
| Written summary | ✅ | ✅ | ✅ `submit_written_summary(p_content_item_id, p_content text)` | ❌ NEEDED |
| Skills practice | ✅ | ✅ | ✅ `mark_skills_practice_signoff(p_content_item_id, p_signoff_type, p_trainee_user_id?)` | ❌ NEEDED |
| External link | ✅ | ✅ | ✅ `confirm_external_link(p_content_item_id)` | ❌ NEEDED |
| File upload | ✅ | ✅ | ❌ GAP — no completion RPC | ❌ NEEDED |
| Live event | ✅ | ✅ | ✅ `mark_live_event_attendance(p_content_item_id, p_trainee_user_id, p_attendance_status)` | ❌ NEEDED |
| Lesson blocks | ✅ | ✅ | ✅ `upsert_lesson_block_progress(p_block_id, p_status, p_completion_data jsonb)` | ❌ NEEDED |

**Net backend gap before Group Z viewer build can complete:**

1. **`get_content_item_for_viewer(p_content_item_id)`** — unified read RPC. Returns content_item row + per-type child data (quiz_questions/options for quiz, lesson_blocks for lesson_blocks) + current completion state + access checks. Without this each viewer would need 2-3 separate queries.
2. **`submit_file_upload_completion(p_content_item_id, p_asset_id, p_filename, p_size_bytes)`** — file_upload completion RPC. Trainee uploads via existing FileUploadField → calls this RPC to record completion. Triggers content_item_completions update + Postgres rollup triggers.
3. **`get_quiz_for_trainee(p_content_item_id)`** — ✅ ALREADY SHIPPED Session 76. Documented for clarity. Strips `is_correct`/`match_pair_key`/`explanation` from response unless `quiz_show_correct_mode='always'`. For match types splits options into `prompts` (authored order) + `answers` (server-shuffled).
4. **`get_quiz_attempt_results(p_attempt_id)`** — ✅ ALREADY SHIPPED Session 76. Post-submit reveal RPC. Re-derives per-question correctness from quiz_attempts.answers using same scoring rules as `submit_quiz_attempt`. Reveal logic per quiz_show_correct_mode.

**Other deferred work (not blocking Group Z viewer build):**

5. **`get_lesson_block_assets`** — currently super-admin-only. Trainees can't use. Either widen with access-check logic or build parallel trainee resolver. Needed when lesson_blocks viewer ships. Logged in Build Queue.
6. **`request-asset-upload` Edge Function extension for quiz images** — required for match_picture support. `content_asset_refs` needs new columns `quiz_question_id` and `quiz_answer_option_id`. Edge Function needs to accept those params. Deferred to post-launch fast-follow per Session 76 decision.

---

## 2. Locked decisions (Session 76)

These are LOCKED. Do not revisit without explicit reopening.

### 2.1 Sequencing

**Order:** Prompt 0 (chrome) → Prompt 2 (quiz viewer) → remaining per-type viewer prompts.

**Rationale:** Chrome owns page route, breadcrumbs, header, "next item" CTA, completion-driven navigation, abstraction hooks. Viewers are children that render inside the chrome's `item_type` branch. Shipping a per-viewer prompt before chrome would force a refactor when chrome lands.

**Verification:** Prompt 0 must verify with simpler viewers (external_link, video, written_summary) before quiz viewer (Prompt 2) lands. The simpler viewers stress-test the chrome's abstractions; quiz viewer assumes those abstractions are stable.

### 2.2 Viewer ambition tier

**Tier 3 — Distinctive.** Each non-lesson_blocks viewer gets one distinctive feature beyond competitor baseline:

| Viewer | Distinctive feature |
|---|---|
| Video | AI summary card at end (uses existing Anthropic infra) |
| Quiz | None — compete on smoothness (per-question feedback, one-screen-per-question, shuffle correctness) |
| Written summary | AI starter prompt suggestion |
| Skills practice | Mentor "Request revision" status |
| External link | Optional reflection prompt after return |
| File upload | None — compete on smoothness |
| Live event | Pre-event reminder email via Resend |

Lesson_blocks viewer reuses authoring-side BlockRenderer infrastructure but forks for trainee orchestration (different Continue button logic, completion tracking, furthest-position tracking).

### 2.3 SCORM / API export ambition

**Decision: Path (a).** Post-launch for the export tooling. Abstraction layers go in v1 viewer build (the `useCompletionReporter` and `useAssetResolver` hooks). When export tooling ships, the abstractions are already in place — the viewers don't change, only the reporter implementations.

### 2.4 BlockRenderer reuse strategy

**Decision: Path (b).** Extract shared visual render components from authoring-side BlockRenderer.tsx (82KB) into `src/components/lesson-blocks/shared/`. Fork orchestration for trainee side. The visual primitives (text rendering, callout cards, image display) are reused; the wrapper components (continue button logic, completion tracking, "what's next" inference) are trainee-specific.

### 2.5 Quiz match_picture support

**Decision: Path C — deferred from v1.** Reason: `content_asset_refs` has no `quiz_question_id` or `quiz_answer_option_id` columns, so the existing asset upload infrastructure (FileUploadField → `request-asset-upload` Edge Function) cannot link uploads to quiz rows. The `request-asset-upload` Edge Function has been fragile in past sessions; extending it deserves its own backend-first work block.

**Build queue item committed:** Quiz match_picture authoring + viewer + image uploads on question/option prompts. Requires:
1. Schema migration: add `quiz_question_id` + `quiz_answer_option_id` nullable FK columns to `content_asset_refs`
2. Edge Function: extend `request-asset-upload` to accept these new ID params, write appropriate ref row
3. Frontend: add `quizQuestionId` + `quizAnswerOptionId` props to FileUploadField, expose `match_picture` in question type Select, add image upload widgets to question prompts and answer options across all 5 question types
4. Trainee viewer support for `match_picture` (right column renders images instead of text)

### 2.6 Quiz match pair storage convention

**Decision locked:** Within a pair (same `match_pair_key`):
- Prompt row: `display_order=0`, `is_correct=false`
- Answer row: `display_order=1`, `is_correct=true`

The trainee viewer matches against this convention. The authoring UI (Prompt 1) honors it.

### 2.7 Quiz reveal RPC shape for match types

**Decision: Path (a) — structured `prompts` + `answers` arrays returned separately.** Non-match question types return a flat `options` array. Match types return:
```json
{
  "question_type": "match_definition",
  "prompts": [{"id": ..., "option_text": "Term A"}, ...],   // authored order
  "answers": [{"id": ..., "option_text": "Def B"}, ...]      // server-shuffled
}
```

Rationale: cleaner viewer code, no need to expose pair-key positioning to client, removes a class of viewer bugs around prompt/answer separation.

### 2.8 Quiz feedback mode → UX mapping

**Decision per quiz_show_correct_mode:**

| Mode | During quiz | Summary screen |
|---|---|---|
| `never` | No feedback | Score only, no per-question reveal |
| `after_pass` | No feedback | Reveal only after pass (server gate, both attempts) |
| `after_each_attempt` | No feedback | Reveal after each attempt |
| `always` | Real-time per-question feedback (server returns is_correct flags) | Full reveal |

The viewer (Prompt 2) renders accordingly. Per-question advance is via "Save and continue" button (path b) for all modes; for `always` mode an additional reveal step happens between answer-lock and advance.

### 2.9 Quiz authoring v1 scope (Prompt 1 — SHIPPED Session 76)

Four question types exposed in author UI:
- `multiple_choice` (2-5 options, exactly one correct)
- `true_false` (fixed 2 options, exactly one correct)
- `select_all` (2-6 options, ≥1 correct)
- `match_definition` (2-6 pairs, text-only both sides)

`match_picture` NOT exposed (schema CHECK still permits it; UI hides it pending image upload work).

All options text-only. No image uploads on question prompts or answer options.

### 2.10 Foundational UX principles locked (apply to ALL viewers)

These were locked across Sessions 72-76 from competitor recon (Brilliant, Coursera, CABEM, Khan, Duolingo anti-patterns) and apply universally. Every viewer prompt must honor these.

**Navigation:**
- **Skip-allowed within module.** `recommended_next` is a SUGGESTION, not a GATE. Trainee can click any content item in the module regardless of order or completion state. Research shows rigid linear forcing kills engagement.
- **Prev/Next within-module chrome.** Viewer chrome (Prompt 0) provides Prev/Next buttons that walk through items linearly while permitting jump-to from module detail page.
- **"Next content item" CTA wraps.** If at last item of module, CTA advances to first item of next module within the same curriculum. If at last item of last module, CTA advances to first item of next curriculum within the same cert path. Stops at cert path end.
- **NO auto-play of next content item.** LinkedIn Learning's anti-pattern. Trainee always clicks to advance.
- **Sidebar hybrid:** TOC sidebar open by default on desktop, collapsed/hamburger on mobile. Per-content-item TOC available within lesson_blocks viewer specifically (so trainee can jump to a block within a long lesson).

**Celebration tiering (three tiers + collapse-to-highest rule):**
- **content_item completion** → micro-feedback (checkmark animation, gentle progress bar advance, NO modal)
- **module completion** → modal with success animation + "Next module: X" CTA + "Back to cert path" link. Auto-collapsible after 3-5 seconds.
- **curriculum completion** → modal with stronger celebration + summary of what was learned + "Next curriculum" CTA. Require dismiss-click.
- **cert_path completion** → full-screen marquee moment with certification credential preview + "Download certificate" + "Share with my coach" + "Share on LinkedIn". Require dismiss-click.

When a single action triggers cascading completions (rare — final item in a module that's the final module in a curriculum that's the final curriculum in a cert path), show ONLY the highest-tier modal per Session 72 lock. Lower-tier completions get audit-logged but not shown.

**Auto-dismiss timing:**
- Item-level micro-feedback: 1.5-2 seconds, no user action needed
- Module completion modal: 3-5 seconds auto-collapse, OR immediate dismiss on CTA click
- Curriculum + cert_path celebrations: require explicit dismiss-click — these are earned moments, don't rush them

**Last-completed badge on content_item cards:** for external_link / file_upload / live_event item types, show "Last completed [date]" badge on the item card in module detail page. Makes completion state visible without entering the viewer.

**Mobile responsiveness Day 1:** all viewer surfaces tested at 375px, 414px, 768px breakpoints. Not "mobile-friendly later." Lesson_blocks renderer already responsive (Sessions 60-69); other viewers need the same discipline.

**Anti-patterns explicitly blocked (NOT shipped for professional audience):**
- NO streak counters, daily-practice nudges, leaderboards, or gamified leagues (Duolingo-style Black Hat mechanics — wrong tone for coaching certification)
- NO cartoon characters / playful animations (Brilliant's "Blorbs" — wrong tone)
- NO form-style "submit all answers at end" quizzes (Coursera/edX anti-pattern — feels like school testing)
- NO cluttered dashboard chrome on viewer pages (Cornerstone/Docebo anti-pattern — trainees want clarity)
- NO punitive failure UI (red backgrounds, alarming language) on quiz failure — sober failure tone instead
- NO buried "next lesson" links (Rise's known failure mode) — Continue button must always be prominent
- NO auto-play next video (LinkedIn Learning anti-pattern — removes agency)

**Pro-patterns explicitly locked:**
- Microfeedback (checkmarks, completion advances) within the same render cycle as the completion event
- Per-dimension competency framing where applicable — PTP modules can reference Protection / Participation / Prediction / Purpose / Pleasure dimensions to connect learning to assessment results trainees already care about
- Whitespace-heavy, content-first layout (closer to Coursera/MasterClass than Docebo/Cornerstone)
- Reserve dashboard density for super_admin and coach views, not trainee views
- "Quizzes/skills practice items DO get a Continue button on completion" — break Rise's bad pattern of breaking learned navigation expectations
- "More content below" affordance (down chevron, fade gradient at viewport bottom) when content extends beyond initial viewport — fixes Rise's biggest pain point

---

## 3. Per-viewer feature specifications

These are the UI features locked for v1 ambition. Use these as the contract for each viewer's Lovable prompt.

### 3.1 Video viewer

**Source types supported:** youtube_unlisted, vimeo, mux, cloudflare_stream, supabase_storage (uploaded file).

**Player implementation:**
- **Install `react-player`** package — wraps all 5 source types in a single API surface. Currently NOT installed; viewer prompt must include `npm install react-player`.
- Native HTML5 `<video>` underneath for supabase_storage source (signed URL from existing `get-resource-signed-url` infrastructure pattern)
- Provider-specific embed for youtube_unlisted / vimeo / mux / cloudflare_stream — react-player handles each natively

**Player behavior:**
- Resume from last position via `video_last_position_seconds` from completion row on mount
- 3-second back-step button (re-watch the last few seconds) — common request, free with react-player controls
- Variable playback speed: 0.75x, 1x, 1.25x, 1.5x, 2x — free with react-player, accessibility win for non-native English speakers
- Captions toggle visible when source provides captions (auto for YouTube; future for supabase_storage as post-launch FF)
- Track progress with `record_video_progress` debounced every 10 seconds while playing
- Mark complete when watch_pct ≥ `video_completion_threshold_pct` (author-set, default 95%). Backing up after completion does NOT un-complete (Pluralsight pattern)
- **NO auto-play of next content item.** Trainee clicks "Continue" or "Next" deliberately. LinkedIn Learning's auto-play default is the anti-pattern we explicitly avoid.

**Player chrome:**
- Full-screen capable
- Clean controls (MasterClass standard)
- Chapter markers rendered if authored (post-launch FF — schema doesn't yet support; surface placeholder when present)
- Notes panel slide-in from right — post-launch FF, not v1

**Distinctive: AI summary card.** After completion, surface a "Quick summary" card generated via existing Anthropic infrastructure. Card shows 3-5 bullet takeaways. Triggered by completion event, cached per-user per-content_item to avoid regeneration cost on revisit.

**Out of scope v1:** captions/transcripts for supabase_storage videos (post-launch FF), chapter markers (post-launch FF — schema work first), timestamped notes against video position, mid-video knowledge checks, click-to-jump-to-transcript-timestamp (Coursera pattern, post-launch FF).

### 3.2 Quiz viewer (Prompt 2 — drafted Session 76, sends after Prompt 0)

**Flow:**
1. Intro screen — shows quiz title, description, total question count, pass threshold. Variants based on attempts_count + ever_passed.
2. One-question-per-screen progression with progress bar (N dots, current highlighted)
3. Per-question type UI:
   - mc: radio buttons rendered as **big tappable cards** (Brilliant pattern lock — NOT compact radio rows)
   - true_false: two large buttons side-by-side
   - select_all: checkboxes rendered as big tappable cards
   - match_definition: tap-prompt-then-tap-answer pairing (NOT drag-and-drop in v1) with brand-color pair chips
4. Per-question "Save and continue" button (path b) — no auto-advance even in `always` mode (extra Submit-this-question step in `always` mode for feedback before continuing)
5. Final submit → calls `submit_quiz_attempt`
6. Summary screen — score card, per-question results when reveal applies, retry/continue CTAs

**Quiz UX principles locked (from competitor recon — Brilliant pattern):**
- **One question at a time.** No form-style "submit all answers at end" — that feels like school testing, not learning. Coursera/edX anti-pattern.
- **Large question text.** Plenty of whitespace.
- **Choices as big tappable cards.** Not compact radio rows or checkboxes — full-width-on-mobile tappable surfaces.
- **Immediate feedback with explanation revealed** (in `always` mode) — explanation reveals AFTER answering, not before.
- **Gentle correction.** No "scoring anxiety" framing. Red X is informational, not punitive. NO red-tinted backgrounds.
- **No "hint" mechanic.** Khan's hint-for-partial-credit pattern is interesting but adds authoring complexity; deferred to post-launch FF.

**Match question chip colors:** cycle through brand palette Navy → Teal → Orange → Purple → Green → Mustard (max 6 pairs ≤ 6 chip colors).

**Failure tone:** sober, not punitive. No red-tinted backgrounds on failed quizzes. Brand Sand background, supportive copy ("Nice work — let's see how you did" not "Quiz Submitted Successfully" or "QUIZ FAILED").

**Defensive match_picture handling:** render stub "This question type isn't supported in your current browser" + let trainee skip. Don't crash.

**Edge cases:** zero-question quiz → "This quiz isn't ready yet" screen. Network failure on submit → retry button with local answers preserved. Quiz archived between get and submit → friendly "no longer available" message. Already-passed retake → backend handles no-downgrade rule; viewer shows new score but completion stays passed.

**Out of scope v1:** localStorage draft persistence mid-quiz, drag-and-drop matching (tap-to-pair only), AI wrong-answer feedback, adaptive difficulty, spaced repetition, "hint" mechanic for partial credit, question randomization (display_order fixed), per-question time limits, quiz-level time limits, bulk import questions from CSV.

### 3.3 Written summary viewer

**Flow:**
1. Prompt display from `description` field
2. RichTextEditor textarea (compact variant, no nested asset uploads)
3. Live character counter showing min/max
4. Submit button disabled until min met
5. On submit → `submit_written_summary`
6. Post-submit state shows: trainee's submission + status (auto/coach_review_required)

**Distinctive: AI starter prompt suggestion.** "Help me get started" button → opens a small dialog → trainee describes their general direction → AI returns a starter sentence or bullet outline they can use as a jumping-off point. NOT a full draft — explicitly a starter. Uses existing draft-text Edge Function infrastructure.

**Out of scope v1:** autosave drafts (post-launch FF), AI suggested edits, voice-to-text input.

### 3.4 Skills practice viewer

**Flow:**
1. Display scenario / practice description (could include video demo, instructions, rubric pointers)
2. Show signoff requirement: trainee_only / mentor_only / both_required
3. Action button(s) based on signoff type:
   - `trainee_only`: "I've completed this practice" → calls `mark_skills_practice_signoff(content_item_id, 'trainee')`. Marks complete immediately.
   - `mentor_only`: Trainee sees "Awaiting mentor sign-off" placeholder (NOT a blocker — trainee can navigate away and work on other items). Mentor view shows trainee submission + "Sign off as mentor" button → `mark_skills_practice_signoff(content_item_id, 'mentor', trainee_user_id)`.
   - `both_required`: Trainee signs first via "I've completed this practice" button → status flips to "Awaiting mentor sign-off." Mentor receives notification via existing `notify_user` infrastructure. Mentor signs off in their own session — trainee progress is NOT blocked on mentor (other content items remain accessible).
4. **Optional attachment upload via FileUploadField** if `skills_optional_attachment=true`. Stored at `skills_attachment_url` (existing column). Trainee uploads photo/video evidence of the practice (e.g., recording of a coaching session, photo of completed work).

**Async signoff principle (locked):** Skills practice signoff is fundamentally asynchronous. Trainee never waits on mentor to keep learning. The status pill on the skills_practice content_item card in module detail page shows "Awaiting mentor sign-off" so trainee knows where things stand, but the rest of the module continues to be navigable. This matches CABEM Competency Manager's industry-standard multi-step signoff workflow.

**Distinctive: Mentor "Request revision" status.** New status pill mentors can set: "needs revision" with a comment field (free-text textarea). Trainee sees the revision request inline, addresses it (potentially re-uploads attachment, edits any text), marks ready again via "Resubmit for sign-off" button. NOT a hard blocker — trainee can re-mark complete and re-trigger mentor review as many times as needed. New status_type: `revision_requested`. Schema additive: `skills_revision_comment text NULL`, `skills_revision_requested_at timestamptz NULL`, `skills_revision_requested_by uuid NULL`.

**Audit-friendly attribution (CABEM pattern):** every signoff event records timestamp + signed-off-by user_id. Already in schema (`skills_trainee_signed_off_at`, `skills_mentor_signed_off_at`, `skills_mentor_signed_off_by`). Surfaced in mentor view so mentor can see history of trainee submissions.

**Out of scope v1:** mentor rubric scoring (post-launch FF — needs new schema), in-app calibration sessions, peer review, automated assessment of video evidence (post-launch).

### 3.5 External link viewer

**Flow:**
1. Display description + external URL preview
2. **"Open link" button** — opens in new tab via `target="_blank" rel="noopener noreferrer"` (security baseline)
3. After return to BrainWise tab, prompt: "Have you completed the linked content?"
4. "Yes, I've completed it" → `confirm_external_link`

**Card-level status (in module detail page):** "Last completed [date]" badge on the content_item card after first completion. Makes completion state visible without entering the viewer. Same pattern applies to file_upload and live_event content_items.

**Distinctive: Optional reflection prompt after return.** When trainee confirms completion, show a small "What did you take away from that?" textarea. Submission is OPTIONAL — completion fires regardless. If submitted, stored in `content_item_completions.external_link_reflection_text` (new column, additive migration). Surfaces in mentor view as part of trainee's reflection log.

**Out of scope v1:** time-on-external tracking (would need link-bouncer middleware), embedded iframe rendering (security risk for arbitrary URLs), automated check that user actually visited the link (impossible without instrumented destination).

### 3.6 File upload viewer

**Flow:**
1. Display task description
2. Show upload constraints: max size, allowed extensions
3. FileUploadField (reuse from authoring side)
4. After upload completes → `submit_file_upload_completion(content_item_id, asset_id, filename, size_bytes)` — **NEW RPC NEEDED**
5. Post-upload state: shows uploaded filename + size + "Replace file" option

**No distinctive feature** — compete on smoothness.

**Out of scope v1:** mentor in-app review of submission (post-launch FF), virus scanning, PDF inline preview.

### 3.7 Live event viewer

**Flow:**
1. Display event details: scheduled_at (formatted in user's timezone), external_event_id (Zoom meeting ID, Teams link, etc.), event description
2. **Pre-event state:** "Join event" button (deep link if external_event_id is recognizable as a Zoom/Teams URL), countdown timer to scheduled_at, **"Add to calendar" button generating .ics download** for Apple/Google/Outlook compatibility
3. **During event window** (scheduled_at to scheduled_at + 2 hours by default): "Join event" still prominent, "I'm attending" self-mark button enabled
4. **Post-event:** mentor or super admin marks attendance via `mark_live_event_attendance(content_item_id, trainee_user_id, attendance_status)` where status ∈ {attended, no_show, excused}
5. **RSVP states tracked** in completion row: not_rsvp'd / rsvp_attending / rsvp_declined / attended / no_show / excused

**Calendar integration:** generate .ics file inline (no third-party service) with event metadata. Pattern reused from SuccessFactors (industry-standard for live event integration).

**Distinctive: Pre-event reminder email via Resend.** When trainee is enrolled in a content_item with `event_scheduled_at` in the future AND has RSVP'd attending (rsvp_attending status), schedule a Resend reminder email 1 hour before event start. Uses existing transactional email infrastructure. Cron-scheduled via existing pg_cron + Resend integration pattern from prior sessions. Reminder includes: event title, scheduled_at, join link, "add to calendar" attachment.

**Out of scope v1:** Zoom/Teams auto-attendance API integration (future — currently mentor manually marks attendance), in-app event chat, post-event survey, recording playback links (would need new schema), waitlist management for capacity-limited events.

### 3.8 Lesson blocks viewer

**Flow:**
1. Fetch content_item + lesson_blocks rows + resolved asset URLs via `get_lesson_block_assets` (after widening for trainee access)
2. Render blocks in order using FORKED trainee-side `LessonBlockRenderer.tsx` (do NOT wrap authoring BlockRenderer — orchestration differs too much)
3. Per-block progress tracked via `upsert_lesson_block_progress(block_id, status, completion_data)`
4. Completion mode drives Continue button behavior:
   - `scroll_and_checks`: continue available when all interactive blocks (knowledge_check, etc.) are answered AND scroll position reaches bottom
   - `explicit_continue`: continue available once all interactive blocks answered, button click required to advance
5. Furthest-position tracking via `lesson_furthest_continue_client_id` so trainee can resume mid-lesson

**14 active block types in production:** text, heading, list, quote, callout, stat_callout, tabs, accordion, button_stack, knowledge_check, flashcards, card_sort, scenario, statement_a_b.

**Block render reuse strategy (per §2.4 Path b):**
- **Reuse from authoring (identical visual behavior):** text, heading, list, quote, callout, stat_callout, button_stack — these have no trainee-specific interaction beyond click/scroll
- **Fork for trainee (divergent behavior):**
  - `knowledge_check` — trainee mode evaluates answers + immediate feedback flow; authoring shows static config
  - `flashcards` — trainee mode tracks flip state; authoring may show both sides for reference
  - `card_sort` — trainee mode tracks completion conditions; authoring shows static state
  - `scenario` — trainee mode does branching navigation; authoring shows all paths
  - `statement_a_b` — trainee picks one, gets feedback
  - `tabs`, `accordion` — likely identical but verify (likely just reuse)
- **Suppress in trainee mode:** hover toolbars, drag-reorder, edit-in-place affordances
- **Shared across modes:** `lesson-blocks.css`, `blockTypeMeta.ts`, asset URL resolution patterns (with abstraction layer per §2.3)

**Required affordances (Rise anti-pattern fixes):**
- **"More content below" indicator** — down chevron + fade gradient at viewport bottom when content extends beyond initial viewport. Fixes Rise's biggest known pain point ("I just hoped the app design would be more user friendly and display that it displayed something that lets the user know there is more content below" — community complaint).
- **Prominent Continue button** — always visible, never below excessive padding. Break Rise's bad pattern.
- **Continue button on completion of interactive blocks** — quizzes / skills practice / knowledge_check blocks DO get a Continue button after evaluation. Break Rise's other bad pattern where quizzes break learned navigation expectations.

**Sidebar TOC within lesson:** TOC of all lesson_blocks within the current content_item. Click jumps to that block. Visual indicator (checkmark) on completed blocks. Required vs Optional pill on each. Open by default on desktop, hamburger on mobile.

**No distinctive feature for v1.** The abstractions (SCORM/API export readiness via `useCompletionReporter` and `useAssetResolver` hooks) ARE the distinction long-term. v1 builds the abstractions; export tooling ships post-launch.

**Out of scope v1:** SCORM/API export tooling (post-launch — abstractions go in v1), block-level branching beyond scenario type, lesson-level adaptive difficulty, AI-suggested next block based on trainee comprehension.

---

## 4. Backend work needed before viewer build can complete

### 4.1 Already shipped Session 76

- `get_quiz_for_trainee(p_content_item_id)` — shipped, verified
- `get_quiz_attempt_results(p_attempt_id)` — shipped, verified
- 5 quiz authoring RPCs — shipped, verified (Prompt 1 also shipped frontend)

### 4.2 Required for Prompt 0 (chrome)

- **`get_content_item_for_viewer(p_content_item_id)`** — unified read RPC. Returns:
  - content_item row (all fields)
  - per-type child data: quiz_questions/options for quiz items (or links to get_quiz_for_trainee), lesson_blocks for lesson_blocks items
  - current completion state (content_item_completions row)
  - access check (is the trainee enrolled in the parent module's curriculum / cert path)
  - "next item" hint (the next content_item in the same module that the trainee hasn't completed)
  
  Implementation: SECURITY DEFINER, search_path locked, REVOKE anon / GRANT authenticated, no audit log (read RPC).

### 4.3 Required for file_upload viewer

- **`submit_file_upload_completion(p_content_item_id, p_asset_id, p_filename, p_size_bytes)`** — completion RPC. Validates content_item is file_upload type, content_asset exists and is owned by caller, updates content_item_completions with file metadata, marks complete, triggers Postgres rollup.

### 4.4 Required for lesson_blocks viewer

- **`get_lesson_block_assets`** — widen for trainee access OR build parallel `get_lesson_block_assets_for_trainee`. Currently super-admin-only.

### 4.5 Required for external_link viewer distinctive feature

- **Additive migration:** add `external_link_reflection_text text NULL` to `content_item_completions`. Optional column. `confirm_external_link` RPC extended to accept optional `p_reflection_text` parameter.

### 4.6 Required for live_event viewer distinctive feature

- **Cron + Resend integration:** scheduled job that queries upcoming live_events 1 hour out, sends Resend email to enrolled trainees, marks as reminded to avoid duplicates. Pattern already exists for other reminder emails — reuse infrastructure.

---

## 5. Chrome contract (Prompt 0 specification, drives all per-type viewers)

The chrome at `/learning/content-item/:contentItemId` owns:

**Page structure:**
- Page route + breadcrumbs (cert path → curriculum → module → content item) — Session 72 lock
- Single back button per level — Session 72 lock
- Header band with thumbnail, title, completion status pill
- Action strip with state-adaptive CTA (Start / Continue / Mark complete / Next item)
- Loading + error states
- Footer navigation with **Prev/Next within-module** buttons (walks linearly through items in display_order)
- **Sidebar TOC** of cert-path → curriculum → module → content_item — collapsed by default on tablet/mobile, accessible via hamburger; open by default on desktop. Hybrid model from Pluralsight/MasterClass.

**Navigation behavior:**
- **Skip-allowed.** Trainee can click any content item in the module regardless of order or completion state. `recommended_next` is a suggestion arrow but NOT a gate.
- **"Next content item" CTA wrapping:**
  - If at last item of module → CTA advances to first item of next module within same curriculum
  - If at last item of last module → CTA advances to first item of next curriculum within same cert path
  - If at last item of last module of last curriculum → CTA leads to cert path completion celebration
- **NO auto-play** of next content item. Trainee always clicks deliberately.
- **"Mark complete" affordance** present even before threshold is met for some viewer types (so trainee can override system's assessment). Behavior per type varies; default is `disabled until viewer's completion criteria met`.

**Completion-driven navigation:**
When viewer reports completion via `reportCompletion(payload)`:
1. Chrome refetches user learning state (via existing infrastructure like `get_user_learning_state`)
2. Diffs vs prior state to detect which level(s) transitioned to completed
3. Shows ONE modal at the highest tier that transitioned (collapse-to-highest per Session 72 lock):
   - content_item only → micro-feedback (checkmark + progress advance, no modal), auto-dismiss 1.5-2s
   - module rollup → module completion modal, auto-collapsible 3-5s with "Next module" CTA
   - curriculum rollup → curriculum completion modal, require dismiss-click, includes "what was learned" summary
   - cert_path rollup → full-screen marquee, require dismiss-click, includes credential preview + share CTAs
4. Modal CTA navigates to next logical destination (next item / next module / next curriculum / cert path detail)

**Per-type viewers receive from chrome (props/context):**
- `contentItem` — the content_items row
- `completionState` — the content_item_completions row (or null if no attempt yet)
- `reportCompletion(payload)` — viewer calls when it has finished its completion mark (chrome handles cascade detection + modal)
- `useCompletionReporter()` hook — provides debounced reporting for viewers that update progress incrementally (video, lesson_blocks)
- `useAssetResolver()` hook — resolves asset_ids to signed URLs (wraps existing infrastructure). Per §2.3, this is the abstraction that allows future SCORM/API export.
- `navigateToNextItem()` — chrome-provided, viewer calls when trainee clicks "Continue" after pass/complete

Per-type viewers must NOT:
- Own their own page route
- Render their own breadcrumbs
- Directly fetch the content_item row (chrome provides it)
- Directly handle completion-cascade modal logic (chrome owns this)

---

## 6. Competitor recon — what we learned

Source doc: `competitor-recon-group-z.md` (already in repo from Session 75 close). Platforms covered: Coursera, LinkedIn Learning, Udemy, edX, Skillshare, MasterClass, Domestika, Pluralsight, Brilliant, Articulate Rise/Storyline, Thinkific, Teachable, Kajabi, Docebo, Cornerstone OnDemand, Schoox, Oracle Learning, SAP SuccessFactors, 360Learning, Absorb LMS, TalentLMS, Litmos, iSpring Learn, Workday Learning, Duolingo, Khan Academy, Salesforce Trailhead, CABEM Competency Manager.

### Brilliant.org — quiz UX gold standard
- **One question per screen, large question text, plenty of whitespace, choices as big tappable cards**
- Immediate feedback with explanation revealed AFTER answering (not before)
- Gentle correction — no "scoring anxiety" framing
- Bite-sized lessons focused on single concepts
- NOT copied: heavy game-mechanics animation (Rive), streaks, leaderboards, cartoon characters — too playful for our professional brand

### Coursera — video viewer pattern + course overview
- Transcripts alongside video, click-to-jump-to-timestamp — high-value for non-native speakers, deferred to post-launch FF
- Variable playback speed 0.75x-2x — free with react-player, ships v1
- Resume on revisit — we have this via record_video_progress
- "Next step" feature increased completion 10%+ — we adopt this pattern (recommended_next suggestion)
- Dual progress bars (overall + current section) — we adopt for cert path detail page
- Restrained certificate completion screen with confetti + "Add to LinkedIn" + share CTAs — adopted for cert_path tier celebration

### MasterClass — video chrome gold standard
- Full-screen capable, clean controls, captions toggle prominent
- Variable playback speed in controls
- Chapter markers if authored — placeholder in v1, real support post-launch FF
- Notes panel slide-in from right — post-launch FF
- "Watch next" rail at end — explicitly NOT shipped (LinkedIn Learning auto-play anti-pattern)

### Pluralsight — completion pattern
- "Watch progress = completion" with backing-up-doesn't-uncomplete rule
- We adopt this: `video_completion_threshold_pct` defaults to 95%; once met, status stays completed

### CABEM Competency Manager — skills practice signoff
- Multi-step signoff: user → manager/SME → automatic completion
- Audit-friendly reporting: timestamps + signed-off-by attribution on all signoffs (we already store this)
- Real-world demonstration evidence: text/file uploads as part of signoff (`skills_attachment_url`)
- Approver signoff as standalone OR final task in multi-step process — async, non-blocking
- **Our schema and workflow match CABEM's industry standards. No design surprises.**

### Articulate Rise — patterns we honor AND fix
- **Honor:** sidebar-left lesson nav, vertical scroll, Continue blocks as section dividers within a lesson, generous block completion (auto-complete on view for static blocks)
- **Fix:** "More content below" indicator (down chevron + fade gradient) — Rise's biggest community complaint
- **Fix:** Continue button always prominent, never below excessive padding — Rise anti-pattern
- **Fix:** Quizzes/skills practice items DO get a Continue button — Rise breaks learned navigation expectations by hiding it on quizzes

### Khan Academy — growth-mindset pattern (vs Duolingo Black Hat)
- "Level up" celebration uses sounds + visual + brief copy, time-bounded
- Weekly streaks (not daily) reduce anxiety hit
- White Hat motivation (sustainable accomplishment) vs Black Hat (loss aversion via streak guilt)
- We adopt: milestone celebration proportional to achievement weight; we reject: daily streaks, loss-aversion guilt mechanics

### Coursera completion notification — research finding
- Pop-up completion notifications increased Coursera completion rates by 12% — celebration moments matter for retention
- We adopt three-tier celebration sizing (content_item / module / curriculum / cert_path)

### Anti-patterns explicitly rejected
| Anti-pattern | Source | Why we reject |
|---|---|---|
| Rigid linear forcing | Cornerstone, some Rise content | Kills engagement; we allow skip-around |
| Auto-play next video | LinkedIn Learning default | Removes user agency; we never auto-play |
| Streak counters / daily-practice nudges | Duolingo | Wrong audience for professional learning; creates "held hostage" feeling |
| Gamified leagues / leaderboards | Duolingo | Awkward dynamics when trainees know each other professionally |
| Form-style "submit all at end" quizzes | Coursera, edX, most enterprise LMSes | Feels like school testing, not learning |
| Tiny next-lesson links buried below padding | Rise's known flaw | Make next-step affordance obvious |
| Cold formal completion screens | Cornerstone "Course completed. OK." | Kills dopamine moment after months of work |
| Cluttered dashboard chrome on detail pages | Docebo, Cornerstone, SuccessFactors | Trainees want clarity, not engagement metrics |
| Punitive failure UI | Some certification platforms | Drives test anxiety, doesn't drive learning |
| Hidden answer keys forever | Khan free tier on some quizzes | Frustrating; our default `after_each_attempt` reveals correctness |
| Buried disable-auto-play settings | LinkedIn Learning | We don't have auto-play, so no setting needed |
| Aggressive social-share blocking | Some Udemy completion screens | Wait for trainee to process completion before share CTAs |
| Cartoon characters / "Blorbs" | Brilliant's style | Wrong tone for coaching certification |

### Information density philosophy
- Trainee viewer surfaces sit closer to **Coursera/MasterClass** (whitespace, large typography, content-first) than to Docebo/Cornerstone (dashboard-style density)
- Reserve dashboard density for super_admin and coach views — those users want metrics. Trainees want clarity.
- Include metadata strip (cert path / curriculum / module counts, required-vs-optional pills) — professional users want to know "what am I committing to" before clicking

---

## 7. Per-viewer post-launch fast-follows (deferred from v1)

For build queue tracking:

**Video:** captions/transcripts (post-launch FF), chapter markers (future), notes against timestamps (future), mid-video knowledge checks (future)
**Quiz:** AI wrong-answer feedback (future), adaptive difficulty (future), spaced repetition (future)
**Written summary:** autosave drafts (post-launch FF), AI suggested edits (future)
**Skills practice:** mentor rubric scoring (post-launch FF), video evidence upload (future)
**External link:** time-on-external tracking (future), embedded iframe rendering (future)
**File upload:** mentor in-app review (post-launch FF), virus scanning (post-launch FF), PDF inline preview (future)
**Live event:** Zoom/Teams auto-attendance API integration (future), in-app event chat (future)
**Lesson blocks:** SCORM/API export tooling (post-launch — abstractions in v1 already)
**Quiz match_picture:** authoring + viewer + image uploads (post-launch FF — see §2.5)

---

## 8. Cascade-collapse contract (Session 72 lock, applies to all viewers)

When any viewer reports completion via its RPC, Postgres triggers handle cascade automatically:

| Trigger | Fires on | Cascades to |
|---|---|---|
| `trg_rollup_content_item_to_module` | content_item_completions.status change | module_completions |
| `trg_rollup_module_to_curriculum` | module_completions.status change | user_curriculum_assignments |
| `trg_rollup_curriculum_to_cert_path` | user_curriculum_assignments.status change | cert status |
| `trg_auto_grant_combined_cert` | coach_certifications change | auto-grants combined certs |

**The chrome's job after a viewer reports completion:**
1. Refetch user state (via existing `get_user_learning_state` or similar)
2. Diff vs prior state — detect which level(s) transitioned to completed
3. Show ONE modal at the HIGHEST tier that transitioned (collapse-to-highest)
4. Modal CTA navigates to next logical destination

Per-type viewers do NOT compute cascades. They only call their completion RPC and trust the trigger machinery.

---

## 9. Test fixture state at Session 76 close

Available for Prompt 2 verification (and future per-type viewer prompts):

- **Test quiz `0e365d0e-81e6-4d28-a0fe-ccd749714a9d`** on Test Module C
  - 4 questions: 1 multiple_choice (Q1: "What is 2+2?"), 1 true_false (Q2: "Sky is blue"), 1 select_all (Q3: "Which are prime?"), 1 match_definition (Q4: Cat→Feline / Dog→Canine / Fish→Aquatic)
  - Mode: `after_pass` (last set during smoke testing)
  - Pass threshold: 60%
  - 1 attempt logged: `cffd2c4d-aaf4-4637-b1ee-77171251ee1d` (score 50%, failed)
- **Trainee test user `<test-user-uuid>`** (testclientbwe+branding@gmail.com) — used for both `get_quiz_for_trainee` and `submit_quiz_attempt` smoke tests
- **Super admin** `<super-admin-uuid>` for authoring path

Test password lives in userMemories only.

---

## 10. Out-of-scope items locked at Session 76

These were considered and explicitly excluded from v1 Group Z viewer build:

- Drag-and-drop for match questions (tap-to-pair only for v1)
- SCORM export tooling (abstractions only in v1, full tooling post-launch)
- match_picture quiz question type (deferred — see §2.5)
- Image uploads on quiz questions and answer options (deferred — same root cause as match_picture)
- AI question drafting in quiz authoring (could be future enhancement, no AI Draft button on quiz questions in v1)
- Quiz preview mode for authors (defer unless trivial during build)
- Bulk import quiz questions from CSV (post-launch FF)
- localStorage draft persistence mid-quiz (post-launch FF)
- Mentor in-app review of trainee quiz attempts (separate later prompt)
- Time-on-quiz tracking via `time_taken_seconds` (column exists, can populate later)
- Per-question time limits or quiz-level time limits
- Question randomization (display_order fixed per quiz; randomization post-launch FF)
- Quiz pagination across many questions (vertical scrolling on long quizzes — defer)

---

## 11. Document authority

This document is the authoritative scope for Group Z viewer build. If it conflicts with anything in build-queue.md or architecture-reference.md, this document wins until Group Z viewer build completes. After Group Z viewer build completes, this document is archived and the canonical docs hold authority.

Each per-viewer Lovable prompt MUST cite the specific section of this document its scope derives from (e.g. "Per §3.2 Quiz viewer specification...").
