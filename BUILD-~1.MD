# Build Queue — APPEND Session 167

*Append to `build-queue.md`. Follows the Session 166 APPEND files.*

## Shipped / advanced this session

### PTP intro-video gate  [BACKEND VERIFIED · FRONTEND SHIPPED]
- First-time, once-ever modal on the PTP report page playing the two "Introduction to the Brain" videos before report review.
- Backend: `ptp_intro_gate_videos` (config referencing `resources` rows), `ptp_intro_gate_state` (per-user marker), `ptp_intro_video_progress` (per-user per-video analytics); RPCs `ptp_intro_gate_status` (self-healing), `ptp_intro_video_progress_upsert`, `ptp_intro_gate_resolve`. RLS: owner + coach + org-admin + super-admin reads per existing patterns; anon revoked.
- Frontend: `PtpIntroGate` mounted in `MyResults` only for the owner's own view when the selected result is INST-001. Description card per video, skip advances, 95%/ended = watched, throttled heartbeats, non-dismissable dialog, skip-screen "available in Resources" note.
- Fix: self-heal re-show bug (skip-then-leave) in the status RPC.

### 0385 "What Stands Out"  [BACKEND VERIFIED · FRONTEND SHIPPED]
- Last Foundational Future activity. `module_group='Future'`, tier Foundational, seq 385, code `what-stands-out`, draft.
- Arc: recap -> list_builder (soft target ~7, auto AI suggestions) with a **prioritize** pass (select exactly 3) -> ai_panel.
- Frontend: `list_builder` extended with a `PrioritizePanel` (select exactly N of the user's own entries) + keepsake highlight of the chosen items. Reusable for any future rank-your-own-list activity.

### Intro group — 0105 "Your Personal Story"  [BACKEND COMPLETE · WIDGET SHIPPED/WORKING · KEEPSAKE PENDING]
- `module_group='Intro'`, tier Foundational, seq 105, code `their-personal-story`, title **Your Personal Story**, draft.
- New `qa_multimodal` widget: nine questions, five input modes each (type / dictate / record audio / upload video / record webcam video). Two framing content cards + the Q&A step + AI account summary.
- Recorded media -> Mux (signed) with free auto-generated transcripts; AI reads typed answers + transcripts via the `{answers_block}` serializer.
- Backend deployed + boot-probed: `coaching-response-upload`, `mux-webhook` v10, `coaching-activity-analyze` v7/v8, `get-coaching-response-video-url`; `coaching_response_media` table + RLS.
- Widget shipped and confirmed working after a blob-to-File upload fix. **Pending:** run/verify the keepsake + coach playback prompt.

### Metering exemption  [SHIPPED]
- Intro-group activities (and any activity with `definition.metered === false`) run the AI summary unmetered (checked for allowance/credits, not consumed) via `coaching_usage_check_and_consume(p_check_only=true)`.

## Queued next (Session 168+)

- Finish Intro Foundational: 0110 Kick-off, 0115 Initial thoughts, 0120 Transition Map explainer activity, 0130 Understand the Brain (video-linking).
- Then Purpose Foundational (`MBWC-02a-Foundational`), then Present Foundational (`MBWC-04a-Foundational`).
- Publish activities out of draft (decide gate; verify with access batch as non-admin fixture).
- Swap 0105 placeholder hero image for an Intro-set image.
