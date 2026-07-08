# Architecture Reference — APPEND Session 167

*Append to `architecture-reference.md`. Follows the Session 166 APPEND files.*

## New tables

- `ptp_intro_gate_videos` (id, resource_id FK -> resources, position, is_active, card_title, card_body, runtime_label, timestamps). Config for the intro-video gate; unique(resource_id) and a unique active-position index. RLS: authenticated read active; super-admin write; service role full.
- `ptp_intro_gate_state` (id, user_id unique FK -> users, triggering_result_id FK -> assessment_results, outcome, resolved_at). Once-ever per-user gate marker. RLS: owner read; super-admin + corporate-admin read; service role full.
- `ptp_intro_video_progress` (id, user_id, gate_video_id FK, resource_id, status in in_progress|watched|skipped, max_percent, watched_seconds, last_position_seconds, duration_seconds, first_started_at, completed_at). Per-user per-video analytics; unique(user_id, gate_video_id). RLS: owner + super-admin + corporate-admin + coach reads; service role full.
- `coaching_response_media` (id, user_id FK -> users, coaching_session_id, activity_code, question_key, kind in audio|video, mux_upload_id, mux_asset_id, playback_id, mux_status in preparing|ready|errored, duration_seconds, transcript, transcript_status in pending|ready|failed|not_applicable, timestamps). Per-user recorded Q&A answers; unique(user_id, coaching_session_id, question_key). RLS: owner read/insert/update; coach-of-owner read; super-admin read; service role full. (Personal-story content is sensitive: no org-admin read.)

## New / changed RPCs

- `ptp_intro_gate_status()` — SECURITY DEFINER, VOLATILE. Returns should_show + the ordered video payload with the caller's per-video status. Self-heals: if every active video already has a terminal status, writes the marker and returns should_show=false. Keys off a non-superseded INST-001 result, no marker, active videos. anon revoked.
- `ptp_intro_video_progress_upsert(p_gate_video_id, p_max_percent, p_last_position, p_watched_seconds_delta, p_event, p_duration)` — heartbeat/event writer; ended or >=95% => watched, skip => skipped, never downgrades a completed video.
- `ptp_intro_gate_resolve()` — writes the once-ever marker when every active video is watched/skipped (outcome all_watched | all_skipped | mixed). Idempotent.

## Edge functions

- `coaching-response-upload` v1 (verify_jwt=true) — user-scoped Mux direct-upload broker for coaching recordings. Upserts a `coaching_response_media` row (stable id across re-records), creates a Mux upload with signed playback, passthrough `coaching_response:<media_id>`, and **auto-captions** via `new_asset_settings.inputs[].generated_subtitles`. Returns { upload_url, upload_id, media_id }; client uploads with UpChunk.
- `mux-webhook` v10 (verify_jwt=false, Mux-Signature) — existing resources/content-items pipeline preserved verbatim. Adds: resolve `coaching_response:` passthrough; on asset.ready set playback_id/duration/status; on `video.asset.track.ready` with `text_source='generated_vod'` fetch the transcript (`https://stream.mux.com/{playback_id}/text/{track_id}.txt?token=...`, signing a Mux `aud='v'` JWT the same way `get-resource-video-url` does) and store it.
- `coaching-activity-analyze` v8 — v7 added `{answers_block}` (qa_multimodal serializer: per question, the typed/dictated text or the media transcript from `coaching_response_media`, degrading gracefully while transcripts process). v8 makes Intro-group activities (or `definition.metered===false`) unmetered: activity fetched before the usage check, `coaching_usage_check_and_consume(p_check_only=unmetered)` so credits are checked but not consumed.
- `get-coaching-response-video-url` v1 (verify_jwt=true) — signed Mux playback for a `coaching_response_media` row. Access gate == the table's RLS (read the row with the caller's JWT), so only owner / coach-of-owner / super-admin succeed. Returns signed token + media_kind + transcript for the keepsake and coach review.

## Widget / definition schema additions

- `qa_multimodal` widget: step config `{ key, title, intro, modes: ["text","dictate","audio","video"], allowSkip, questions: [{ key, prompt }], onComplete.touchpoint }`. Response shape `responses[key] = { [questionKey]: { mode, text?, media_id?, skipped? } }`. Media answers reference a `coaching_response_media` row via `media_id`; transcripts are read server-side by analyze and rendered client-side via `get-coaching-response-video-url`.
- `list_builder` `prioritize` config: `{ selectExactly, title, prompt, helper, priorityKey }`. Adds a post-list selection of exactly N of the user's own entries, stored at `priorityKey`; keepsake highlights the chosen items. `softTarget` on list_builder is a nudge only.

## Mux auto-caption pattern (reference)

- Enable on direct upload: `new_asset_settings.inputs: [{ generated_subtitles: [{ language_code:'en', name:'English' }] }]`. Free (included in standard encoding/storage), Whisper-based, ~0.1x duration.
- Completion: `video.asset.track.ready` with `type:'text'`, `text_source:'generated_vod'`.
- Retrieve: `https://stream.mux.com/{PLAYBACK_ID}/text/{TRACK_ID}.txt` (plain text) or `.vtt`; for signed assets append a Mux JWT with the same `aud` as video playback (`v`).

## Discipline notes reaffirmed

- Edge deploy: state verify_jwt every deploy; boot-probe (OPTIONS 200, no-auth/invalid-signature 401) after. Existing critical functions (mux-webhook) reproduced verbatim before adding branches.
- Mux API shapes verified against muxinc source (mux-php example, muxinc/skills reference) before deploying paid integrations.
- Read the exact live runner/keepsake via GitHub SHA before each Lovable prompt; verify shipped files after.
