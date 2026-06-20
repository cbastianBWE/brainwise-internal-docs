# BrainWise Session 151 to 152 Handoff

*Closeout: Session 151. Open: Session 152.*

## Where Session 151 left off

Two workstreams shipped. (1) AI image generation: backend `ai_image_generations` ledger + `openai-image-generate` v2 (OpenAI gpt-image-2 high quality, synchronous, Class A auth + impersonation gate, 60/hr), a new `image_prompt` config field on the image and hotspot blocks emitted at zero cost by the three generators, and the `ImageBlockForm` "Generate with AI" control (SHA-verified), coexisting with Pexels everywhere. (2) A Mux-ingested "Upload a video file" mode on the lesson `video_embed` block with NO backend change, reusing the existing embed-content-item + `mux-create-upload` + UpChunk + `mux-webhook` chain; both frontend files SHA-verified. Cole's stated next focus is SCORM export/import and a platform API.

## Session 152 opening priorities, in order

### 1. SCORM export and import

Cole's stated next build. SCORM (Sharable Content Object Reference Model) is the LMS interoperability standard: a SCORM package is a zip with an `imsmanifest.xml` plus content and a JavaScript runtime that talks to the host LMS via the SCORM API (1.2 `LMSInitialize/LMSSetValue/LMSGetValue/LMSCommit/LMSFinish`, or 2004 `Initialize/SetValue/...`) to report completion, score, and bookmarking through the CMI data model (`cmi.core.lesson_status` / `cmi.completion_status` / `cmi.score.raw` / `cmi.suspend_data`).

Two directions, settle scope before any code:
- EXPORT (BrainWise content out to other LMSs): package a curriculum/module/lesson as a SCORM 1.2 and/or 2004 zip so a customer can host BrainWise content in their own LMS. Open question: what does a packaged BrainWise lesson run as outside our app (the lesson-block renderer needs our runtime; the realistic export is likely a self-contained HTML build of the lesson plus the SCORM wrapper, or a video/PDF SCO, not the live interactive blocks). Settle what fidelity the export targets.
- IMPORT (third-party SCORM into BrainWise): accept a SCORM zip as a content item, parse `imsmanifest.xml`, store the unzipped package in a bucket, render it in an iframe with a SCORM API shim that maps the CMI calls onto our progress/completion model. This is the heavier piece (a runtime, not just a packager).

Recommend opening by deciding export-first vs import-first and which SCORM version(s), then reading the current content-item + progress model so the SCORM status maps onto `content_item_progress` / the §109 completion cascade rather than a parallel system.

### 2. Platform API

Cole asked what an "open API" means and whether BrainWise can have one. Short version for the session: yes, BrainWise can expose a public/partner API, and the backend is already API-shaped (Supabase Postgres + edge functions). The real work is not "can we" but the productization: a stable versioned surface, authentication for external callers (API keys or OAuth client-credentials, distinct from end-user JWTs), per-key scoping and rate limits, documentation, and a support/versioning commitment. See the chat discussion at session close for the fuller framing. Settle at session open: who the API is for (customer admins automating their own org, or third-party developers building on BrainWise), read-only vs read-write, and auth model, before any build.

## Decisions locked in Session 151 (recap)

- AI image = OpenAI gpt-image-2 at high quality (gpt-image-1.5 and gpt-image-1-mini considered, rejected). Secret OPENAI_API_KEY (Cole-set).
- The OpenAI Images API is SYNCHRONOUS (base64 in the HTTP response), so the pipeline has NO webhook, NO poll, NO Mux, and NO job-correlation ledger; `ai_image_generations` is a lightweight rate-limit + audit record, not a correlation key.
- AI image generation COEXISTS with Pexels everywhere (the author picks the source): the lesson image block, all five thumbnail surfaces (content_item / module / curriculum / certification_path / resource), and the newsletter inline image. Killing Pexels was rejected.
- Generators emit `image_prompt` on the image and hotspot blocks with `asset_id` null, so authoring spends zero OpenAI credits; generation is author-triggered only (the audio/video script precedent).
- `openai-image-generate` set verify_jwt FALSE (it self-authenticates) after the gateway-JWT error class; the verify_jwt:true functions were LEFT AS-IS (§107 preserved, no blanket flip).
- `newsletter_ai_generate` left untouched: it emits raw HTML governed by the `newsletter_html_authoring_spec` DB row, not block configs, so any newsletter image-prompt enrichment belongs in that spec row and only matters once the Phase 4 newsletter editor generate control exists.
- Video upload-to-Mux: reuse the embed-content-item + `mux-create-upload` + `MuxVideoUploadField` chain; NO backend change; the "Prepare upload" action ALWAYS creates a fresh embed item so it never clobbers a library video chosen via "Use existing"; the standalone `supabase_storage` "Upload to storage" option left as-is (Cole's call).
- §61 five-surface parity does NOT trigger in either workstream (a config-field on existing types, and a source mode on the existing video_embed block).

## Open questions / things to lock in Session 152

- SCORM: export-first vs import-first; SCORM 1.2 vs 2004 vs both; export fidelity (self-contained HTML build of the lesson vs a video/PDF SCO vs attempting the live interactive renderer); how SCORM status maps onto `content_item_progress` and the §109 cascade.
- API: audience (customer org admins vs third-party developers), read-only vs read-write, and auth model (API keys vs OAuth client-credentials), plus versioning and rate-limit posture.
- None blocking; both are greenfield scoping decisions to settle at session open.

## Bugs surfaced in Session 151 added to Build Queue

- None new. One verification carry (not a bug): the five thumbnail image-gen surfaces and the AiPane `ImageResolutionSection` prefer-`image_prompt` tweak were delivered in the image-gen arc but only `ImageBlockForm.tsx` was SHA-verified at this closeout; confirm the others when next touched.

## What's NOT in scope for Session 152

- Live OpenAI image generate stays Cole-side and deferred (waits on the OpenAI org showing verified; a generate before then returns a clean openai_generation_failed openai_status 403).
- Live Mux round-trip of the new lesson-block video upload stays Cole-side (upload a real file on the test lesson, confirm it reaches ready and plays).
- The live ElevenLabs round-trip and the live HeyGen end-to-end test stay Cole-side and deferred.
- Carried, untouched: per-supervisor company-dashboard disable toggle (BQ-SUPERVISOR-DASH); live Stripe refund test (waits on a real Stripe-paid transaction); the newsletter `STATIC_ROUTES` manual-update reminder whenever a new public marketing page is added; formal Group C closure documentation; the Phase 4 newsletter editor Generate-with-AI control + newsletter image-prompt via the spec row.

## Architecture additions in Session 151

- Table `public.ai_image_generations` (image job ledger: rate-limit + audit; RLS super-admin SELECT + service_role ALL; authenticated SELECT only, anon revoked).
- Edge fn `openai-image-generate` v2 (verify_jwt FALSE, self-authenticating; Class A auth + `enforceImpersonationGate('permission_change')`; 60/hr; gpt-image-2 high quality; input `{ prompt, parent_kind, parent_id, ref_field }` across the six request_asset_upload scopes; OpenAI Images API then request_asset_upload + storage upload + finalize_asset_upload routing the bucket by ref_field; provenance source:openai; ledger generating to ready/failed).
- `image_prompt` config field on the image and hotspot blocks, emitted asset_id-null by `draft-lesson-block` (fn v41), `scaffold-lesson-outline` (fn v39), `expand-lesson-from-outline` (fn v42).
- Frontend: `ImageBlockForm.tsx` (blob b55d1037) image_prompt + Generate-with-AI control; `MuxVideoUploadField.tsx` (blob 15baa644) additive `hideAiMode` prop; `VideoEmbedBlockForm.tsx` (blob 6093ce91) third "Upload a video file" content_item mode.
- Secret OPENAI_API_KEY (Cole-set).
- Video upload-to-Mux added NO backend objects; it reuses `create_lesson_embed_video_content_item`, `mux-create-upload`, `mux-webhook`, `get-content-item-video-url`.
- All recorded in architecture-reference.md v152.

## Test fixture state at end of Session 151

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

Test lesson `e5c208f2-6885-482e-8d8b-8325f9cbaf5d` is the working fixture for the deferred image-generate and video-upload round-trips. No fixture changes or pending cleanup this session.

## Documents this session leaves behind

- build-queue.md (markdown source of truth, build-queue v153)
- architecture-reference.md (markdown source of truth, v152)
- session-151-to-152.md (this document)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs. No .docx generated (Session-74 decision).
