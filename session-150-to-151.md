# BrainWise Session 150 to 151 Handoff

*Closeout: Session 150. Open: Session 151.*

## Where Session 150 left off

ElevenLabs AI voiceover shipped end to end in two phases. Phase A is a per-section read-aloud panel plus standalone clips (a new `lesson_audio_generations` ledger and two edge functions, `lesson-elevenlabs-voices` and `lesson-elevenlabs-generate`). Phase B teaches the three lesson generators to emit a plain-text `script` on the `embed_audio` block at zero cost, with a panel action that turns those scripts into audio in place and a block-form edit-script + clear-audio loop. All backend is verified and both frontend changes are SHA-verified at HEAD `dbec184`. The only untested edge is the live ElevenLabs round-trip, which Cole opted out of this session.

## Session 151 opening priorities, in order

### 1. DALL-E image creation (or another image generator)

Cole's stated next build, carried from the Session 149 plan. The image path already has a working ingest + signing seam, so a generator result should plug into it rather than rebuild. Open by reading `lesson-ingest-pexels-asset` v2, the AiPane outline-stage image-resolution flow, and `request_asset_upload` / `finalize_asset_upload`, then present the design fork before any code: which model/endpoint, where the generated image lands (almost certainly the private lesson asset bucket + signing, mime as the pipeline requires), and whether generation is per-block author-triggered or part of the AI build flow. The ElevenLabs generate function is a clean recent template for the synchronous-vendor shape (call the API, ingest the returned bytes through the asset pipeline, return the asset in one request).

### 2. Deferred live round-trip of the Session 150 ElevenLabs work (carry, Cole-side)

When Cole is ready: pick a voice in the Voiceover panel, run "Narrate each section" and "Add a standalone clip" on the test lesson and confirm playable `embed_audio` players appear; AI-build a lesson so the generators emit `embed_audio` scripts, then use "Generate scripted clips" and confirm each scripted block fills its audio in place; edit a script in `EmbedAudioBlockForm`, hit "Clear audio", re-generate, and confirm the new audio matches the edited script. Watch the 5000-char cap and the 100/hr rate limit. If a generation 413s, the script is over 5000 chars (the generators cap at 4500, so this should only happen on a hand-edited script).

## Decisions locked in Session 150 (recap)

- AI voiceover = ElevenLabs, pay-as-you-go, model `eleven_multilingual_v2` (1 credit per character; `eleven_turbo_v2_5` and `eleven_flash_v2_5` also accepted).
- ElevenLabs TTS is SYNCHRONOUS: the function returns the MP3 bytes in the HTTP response. So the pipeline has no webhook, no poll, no Mux, and no job-correlation ledger (the contrast with HeyGen). `lesson_audio_generations` is a lightweight audit/history record, not a correlation key.
- `embed_audio` gained a plain-text `script` field. The generators emit it with `asset_id` null, so authoring spends zero ElevenLabs credits; audio is generated only on an explicit click. This mirrors the Session 149 video_embed/HeyGen script pattern.
- §61 five-surface parity does NOT trigger: this is a config-field addition on the existing `embed_audio` block, not a new block type. The generators were edited but no new type was introduced.
- POLICY LOCK (Cole): no per-lesson cap on bespoke audio; use it for genuine learning depth or modality variety; never use it to merely re-read text the learner already sees on screen (per-section read-aloud is the separate Phase A tool).
- The asset upload mime MUST be `audio/mpeg`; `audio/mp3` is rejected by the asset pipeline.
- `lesson-elevenlabs-voices` carries NO impersonation gate (read-only and costless); `lesson-elevenlabs-generate` carries the Class A auth + `enforceImpersonationGate('permission_change')` gate.
- Next-session build is DALL-E image creation or another image generator (Cole's call).

## Open questions / things to lock in Session 151

- DALL-E: model/endpoint, where the generated image lands, and whether generation is per-block author-triggered or part of the AI build flow.
- None of the above is blocking; it is a greenfield design decision to settle at session open.

## Bugs surfaced in Session 150 added to Build Queue

- None new. The first draft-v25 dashboard deploy hit a bundle parse error from a loosely hand-spliced paste; resolved in-session by reconstructing the full `index.ts` from `get_edge_function`, esbuild-verifying, and pasting the complete file. This reaffirms the existing generator-deploy discipline rather than adding a new bug.

## What's NOT in scope for Session 151

- The live ElevenLabs round-trip stays Cole-side and deferred (see priority 2).
- The combined lesson-block smoke test (INT-1 / INT-3 / INT-4 / INT-5 plus the sequence auto-Pexels resolver) stays deferred per Cole.
- The deferred live end-to-end test of the Session 149 HeyGen work stays Cole-side.
- Carried, untouched: per-supervisor company-dashboard disable toggle (BQ-SUPERVISOR-DASH); live Stripe refund test (waits on a real Stripe-paid transaction); newsletter `STATIC_ROUTES` manual-update reminder whenever a new public marketing page is added; formal Group C closure documentation.

## Architecture additions in Session 150

- Table `public.lesson_audio_generations` (audio job ledger: id, requested_by, content_item_id, asset_id, voice_id, model_id, char_count, status queued/generating/ready/failed, error_reason, created_at; two indexes). RLS: `lag_select_super_admin` (SELECT, super-admin) + `lag_service_all` (ALL, service_role); authenticated SELECT only, anon revoked.
- Edge fn `lesson-elevenlabs-voices` v2 (verify_jwt true, super-admin read-only, no impersonation gate): proxies GET `/v1/voices`, returns `{ voices:[{voice_id, name, category, labels, preview_url}], count }`.
- Edge fn `lesson-elevenlabs-generate` v2 (verify_jwt true, Class A auth + impersonation gate): input `{content_item_id, text, voice_id, model_id?}`; text 1..5000 chars; 100/hr; SYNCHRONOUS TTS via `/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128`, then `request_asset_upload('audio','audio/mpeg', ref 'embed_audio_asset')` + storage upload + `finalize_asset_upload`; returns `{asset_id, version_id, bucket, path, char_count, model_id, voice_id}`.
- `embed_audio` config field `script` (plain text), emitted by `draft-lesson-block` v25 (function version 39) and `expand-lesson-from-outline` v37 (function version 40) with `asset_id` null; `scaffold-lesson-outline` v34 (function version 37) reworded its embed_audio intent bullet only.
- Frontend, SHA-verified at HEAD `dbec184`: `src/components/super-admin/lesson-blocks/LessonVoiceoverPanel.tsx` (blob 702cdec9) with the voice picker, the two Phase-A actions, and the Phase-B "Generate scripted clips" action; `src/components/super-admin/lesson-blocks/block-forms/EmbedAudioBlockForm.tsx` (blob 547724d2) with the gated narration-script textarea and the "Clear audio" control.
- Secret `ELEVENLABS_API_KEY` (Cole-set).
- These all live in `architecture-reference.md` v151.

## Test fixture state at end of Session 150

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Test lesson `e5c208f2-6885-482e-8d8b-8325f9cbaf5d` is the working fixture for the deferred voiceover round-trip (and the carried video-block test). No fixture changes or pending cleanup this session.

## Documents this session leaves behind

- build-queue.md (markdown source of truth, build-queue v152)
- architecture-reference.md (markdown source of truth, v151)
- session-150-to-151.md (this document)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs. No .docx generated (Session-74 decision).
