# BrainWise Session 167 to 168 Handoff

*Closeout: Session 167. Open: Session 168.*

*Session 166 built the coaching activity engine and the first Future activities. Session 167 shipped the PTP intro-video gate, the last Foundational Future activity (0385), and stood up the Intro group with a new multimodal Q&A capture subsystem (0105). If the local session count differs, adjust NN/MM on upload.*

## Note on canonical doc paths (fix the session-open protocol)

The canonical markdown docs live at the **repo root** of `cbastianBWE/brainwise-internal-docs` (e.g. `session-166-to-167.md`, `build-queue.md`, `architecture-reference.md`), **not** under `docs/`. The session-open protocol's paths should be corrected accordingly. This session used the markdown APPEND pattern, not docx generation.

## Where Session 167 left off

Three bodies of work shipped or advanced:

1. **PTP intro-video gate** — complete and verified. First-time, once-ever modal on the PTP report page that plays two "Introduction to the Brain" videos (The Five Brain Principles, The Five Brain Dynamics) before the person reviews their report. Skip advances per video; watched at 95% or ended counts as watched; a skipped screen notes the video stays available in Resources. Backend + frontend shipped and verified. A re-show bug (skip-then-leave re-fired the modal) was fixed server-side by making the status RPC self-heal.

2. **0385 "What Stands Out"** — the last Foundational Future activity. Draft row inserted; adds a new `prioritize` pass to the `list_builder` widget (surface ~7 standouts, select exactly 3). Backend verified; frontend prioritize + keepsake highlight shipped and verified.

3. **Intro group started with 0105 "Your Personal Story"** — a new `qa_multimodal` capture: nine questions, each answerable by typing, mic dictation (browser voice-to-text), audio recording, video upload, or webcam recording. Recorded media go to Mux with free auto-generated transcripts; the AI reads typed answers + transcripts to write an account summary. Backend complete and verified; the widget is shipped and working (record-audio and record-video confirmed after a blob-to-File upload fix). The keepsake/coach replay prompt is written and pending a run.

## Session 168 opening priorities, in order

Same cadence throughout: scope each activity world-class from its OneDrive source, present for Cole's approval or additions, then build backend-first, verify before any Lovable prompt.

### 1. Finish the Intro (Foundational) group
- Run and verify the two outstanding 0105 frontend prompts still open: the `qa_multimodal` widget is in and working; run the **keepsake/coach playback** prompt (`get-coaching-response-video-url` is deployed) and verify replay for owner and coach.
- **0110 Kick-off the coaching process** — goals/outcomes intake (reflective Q&A into an AI summary).
- **0115 Initial thoughts about the journey** — open reflective capture (skippable questions + AI synthesis); cleanest fit to the existing engine.
- **0120 The Transition Map** — build as a content **explainer activity** (walk through the map regions from the 0120 narration). Decision locked: explainer activity, not just the existing map landing.
- **0130 Understand the Brain** — build as a **light content activity linking the two intro videos** plus the driving-forces/brain-health summary. Decision locked: reuse the videos, do not duplicate brain content.

### 2. Then Purpose (Foundational) modules
Source in OneDrive `MBWC-02a-Foundational`. Same cadence.

### 3. Then Present (Foundational) modules
Source in OneDrive `MBWC-04a-Foundational`. Same cadence.

### 4. Publish activities out of draft
All coaching activities remain `status='draft'` (super-admin only). Decide the publish gate and flip built activities so eligible real users can run them. Verify with `coaching_activity_access_batch` and `coaching_group_access` as a non-admin fixture.

## Decisions locked in Session 167

- **Gate identity (video gate):** person-level, once ever, keyed to the person (not the report). Detection is server-side (`ptp_intro_gate_status`), device-independent, self-healing.
- **Video set is config:** `ptp_intro_gate_videos` references existing `resources` rows, so the Resources tab and the modal share one Mux asset/thumbnail. Third video later is one INSERT.
- **PTP instrument = INST-001** (Personal Threat Profile, 89-item, Self).
- **0385 prioritization:** extend `list_builder` with a `prioritize` pass (select exactly N of the user's own entries), not a new widget. Soft target of 7, exact 3.
- **0105 scope:** full multimodal Q&A across all listed topics; "outline the process" and "the brain" are framing cards, not questions (0120 and 0130 cover them). All questions offer all five input modes. Recordings are kept and replayable by the person and their coach.
- **Transcription:** live mic uses the browser Web Speech API; audio/video recordings go through the existing Mux pipeline with `generated_subtitles` (Mux auto-captions are free, included in standard encoding/storage). Transcript retrieved on `video.asset.track.ready` (`text_source: generated_vod`).
- **Metering:** Intro-group activities (and any activity with `definition.metered === false`) are unmetered: the AI summary checks the person has allowance/credits but does not consume a coaching run. Zero-credit users are still blocked. Super admins remain unlimited.

## Bugs surfaced / fixed in Session 167

- **Gate re-show on skip-then-leave [FIXED]:** the gate only wrote its marker on the final "Go to your report" click, so abandoning mid-flow re-fired the modal. Fixed by making `ptp_intro_gate_status()` self-resolve (write the marker) when every active video already has a terminal status.
- **qa_multimodal recording upload [FIXED]:** MediaRecorder yields a `Blob` but UpChunk requires a `File` ("file must be a File object"). Fixed by wrapping the blob in a `File` before upload; applies to both audio and video record paths.
- **OPS-1 [STILL OPEN]:** documented test password no longer authenticates PTP fixtures; blocks full manual password-based E2E. Backend paths were verified via simulated JWT claims and boot-probes instead.

## Open items / follow-ups

- Run + verify the 0105 keepsake/coach playback prompt.
- 0105 hero image is a placeholder (reused a Future-set image); swap for an Intro-set image when available.
- A11y nit: the qa_multimodal dialog logs a "Missing Description/aria-describedby" warning; add a `DialogDescription` when convenient.

## Architecture additions in Session 167

Recorded in `architecture-reference-APPEND-session167.md`. Summary: the `ptp_intro_gate_*` tables + self-healing status/resolve/progress RPCs; the `coaching_response_media` table + RLS; new edge functions `coaching-response-upload` and `get-coaching-response-video-url`; `mux-webhook` advanced to v10 (coaching passthrough + generated-transcript capture) and `coaching-activity-analyze` to v8 (`{answers_block}` serializer + Intro unmetered); the `qa_multimodal` widget and the `list_builder` `prioritize` config; Mux auto-caption request/retrieval pattern.

## Test fixture state at end of Session 167

Test org: BrainWise Test Corp. Three coaching test users under the `testclientbwe+*@gmail.com` pattern (org_admin, corporate_employee x2); look up current UUIDs via Supabase MCP (`SELECT id, email FROM users WHERE email LIKE 'testclientbwe+%@gmail.com';`), password in Claude userMemories. Super admin (Cole) has coaching summary + PTP rows the recap/analyze functions read. All coaching activities remain draft. OPS-1 still blocks password sign-in for the fixtures.

## Documents this session leaves behind

- session-167-to-168.md (this document)
- build-queue-APPEND-session167.md
- architecture-reference-APPEND-session167.md

Additive to the Session 166 documents. Markdown source-of-truth at cbastianBWE/brainwise-internal-docs (files at repo root). Bump the version markers in `build-queue.md` and `architecture-reference.md` on upload.
