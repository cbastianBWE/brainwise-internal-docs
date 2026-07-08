# Architecture Reference — APPEND Session 167 — RECONSTRUCTED

> **Reconstruction note.** Rebuilt in Session 168 from verified live Supabase/Edge state; the Session 167 original was never uploaded. Supabase is authoritative.

## New table

- `coaching_response_media` (id, user_id, coaching_session_id, activity_code, question_key, kind ['audio'|'video'], mux_upload_id, mux_asset_id, playback_id, mux_status, duration_seconds, transcript, transcript_status, timestamps). Unique on (user_id, coaching_session_id, question_key) so a re-record reuses the row. RLS at end of Session 167: owner read/insert/update own; super admin read all; service full; a coach-read policy (replaced in Session 168 by a share-based policy).

## Edge Functions

- `coaching-response-upload` v1 (verify_jwt=true): resolves caller from JWT, upserts the media row (status preparing), creates a Mux direct upload with `playback_policy: signed`, passthrough `coaching_response:<media_id>`, and `new_asset_settings.inputs[].generated_subtitles` (free Whisper captions). Returns `{upload_url, upload_id, media_id}`.
- `mux-webhook` v10 (verify_jwt=false): on asset ready, sets mux_asset_id/playback_id/status and captures the generated-caption transcript into the media row.
- `get-coaching-response-video-url` v1 (verify_jwt=true): reads the media row with the caller's JWT (access == RLS), and if ready mints an RS256-signed Mux playback token (aud 'v', 2h). Returns `{kind:'mux', playback_id, token, transcript, transcript_status}` or a processing/unavailable state.
- `coaching-activity-analyze` v8 (verify_jwt=false): `{answers_block}` token — finds the `qa_multimodal` step, and for each question renders typed/dictated text or, for audio/video, the transcript from `coaching_response_media` (by question_key). Intro-group activities unmetered (checked, not consumed).

## Definition schema

- `qa_multimodal` widget: `{ key, questions: [{key, prompt}], modes: ['text','dictate','audio','video'], allowSkip, intro }`. Answer shape per question: `{ mode, text?, media_id?, skipped? }`.
- `list_builder`: optional `prioritize: { priorityKey, selectExactly }` for a mark-top-N pass.

## Frontend

- `qa_multimodal` runner widget: per-question mode toggle, Web Speech dictation, `MediaRecorderPane`, chunked upload via `@mux/upchunk` to `coaching-response-upload`, answer stored `{mode,text?,media_id?}`. (Extracted into a shared `MultimodalField` module in Session 168.)
- `CoachingRecordingPlayer` (in `CoachingViews.tsx`): calls `get-coaching-response-video-url`, renders a `MuxPlayer` (audio/video) + collapsible transcript.
