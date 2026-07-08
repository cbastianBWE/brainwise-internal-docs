# Build Queue — APPEND Session 167 — RECONSTRUCTED

> **Reconstruction note.** Rebuilt in Session 168 from verified live Supabase/Edge state; the Session 167 original was never uploaded. Supabase is authoritative over this file.

## Epic: My Coaching — multimodal Q&A subsystem

### DONE (verified live in Session 168)

- COACH-MEDIA-TABLE: `coaching_response_media` table + RLS (owner read/insert/update own, super admin read all, service full; the coach-read policy was later replaced in Session 168 with a share-based one).
- COACH-RESPONSE-UPLOAD: `coaching-response-upload` v1 — Mux direct-upload broker keyed by (user, session, question_key); signed playback; auto-generated captions; upsert so re-record reuses the row.
- COACH-MUX-WEBHOOK: `mux-webhook` advanced to v10 — captures the transcript and flips the recording to ready.
- COACH-GET-VIDEO-URL: `get-coaching-response-video-url` v1 — signed playback + transcript, access = RLS on the media row.
- COACH-ANALYZE-V8: `coaching-activity-analyze` v8 — `{answers_block}` serializer for `qa_multimodal`; Intro-group metering exemption (checked, not consumed).
- COACH-WIDGET-qa_multimodal: the `qa_multimodal` runner widget (type/dictate/audio/video, recorder, chunked upload via UpChunk) + `CoachingRecordingPlayer` keepsake playback with collapsible transcript.
- COACH-CONTENT-0105: "Your Personal Story" (`their-personal-story`) — first multimodal Q&A activity.
- COACH-LIST-PRIORITIZE: `list_builder` prioritize pass (mark top-N).
- COACH-PTP-INTRO-VIDEO-GATE: PTP intro-video gate (per opening record; not re-verified).

### CARRIED / OPEN

- OPS-1 [OPEN]: test password does not authenticate PTP fixtures.
- Outstanding into Session 168: verify 0105 keepsake/coach playback + transcript for owner and coach.
