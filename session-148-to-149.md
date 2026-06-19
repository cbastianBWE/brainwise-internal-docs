# BrainWise Session 148 to 149 Handoff

*Closeout: Session 148. Open: Session 149.*

## Where Session 148 left off

The HeyGen AI-video pipeline (Phase 1) was built and proven end to end. The standalone path is confirmed live: you generate a video from inside a video content item, HeyGen renders it, our webhook ingests it into Mux, and it plays in the content viewer. The single biggest unknown, whether a video created on HeyGen's v2 endpoint actually fires its completion webhook to the endpoint we registered, is resolved: it does, and the dual-scheme signature verified.

The headline decision this session is a vendor change. The AI-video vendor is now **HeyGen** (pay-as-you-go, v2 Avatar III, about $1/min), chosen over **Synthesia**. This supersedes the v138/v144 "AI video = Synthesia" decision and every forward note in the prior docs and handoff that named Synthesia. Rationale: HeyGen exposes a true standalone REST API (Synthesia's is gated/enterprise), its moderation is friendlier to education content, and PAYG fits a solo-founder cost profile. The Descript MCP is connected but is not used for generation.

The architecture keeps the platform clean: every HeyGen generation produces an ordinary standalone video `content_item` that rides the EXISTING Mux chain with zero changes. The standalone surface (Path A) uses that content item directly; the in-lesson surface (Path B) is a `video_embed` block that REFERENCES the content item. Phase 1 ships both surfaces in reference form. The next build, agreed with Cole, is to let authors generate a video from inside the lesson block itself, which is a meaningfully larger change because of the content model (see priority 1).

What's verified vs pending at close: Path A (standalone generate + play) is verified live. Path B (the in-lesson reference embed) plus the avatar/voice previews were deferred to a single combined check next round, because two Lovable prompts (the preview UI and a one-line block-picker scroll fix) were delivered but not yet confirmed applied.

## Session 149 opening priorities, in order

### 1. In-block HeyGen generator (the agreed next build, backend-first)

Goal: the `video_embed` block's form gets the SAME generator and preview as the content item field, so an author can create a video without leaving the lesson.

The hard part is NOT the generator UI (that exists and gets extracted into a shared component). It is the content model. Every HeyGen video must be a `content_item`, because the entire Mux pipeline and the playback resolver are keyed on content items. For a learner to play an embedded video, that content item must live in the lesson's own module (the entitlement gate requires it). But `content_items.module_id` is NOT NULL, `is_required` defaults true, and there is NO visibility/hidden flag. So a naively-created embed video would become a required, navigable item in the module that blocks module completion and gets walked by the cert-path logic.

The design, therefore, is an **embed-only video content item**:

- Add a flag (e.g. `is_embed_only boolean not null default false`) to `content_items`.
- A create-RPC that inserts the video content item in the lesson's module with `item_type='video'`, `is_required=false`, `is_embed_only=true`, a sensible title, created_by the caller. Super-admin gated + impersonation gate from inception + grant discipline (§156/§157) + a `super_admin_action_types` row if logged (§99).
- Teach every consumer that enumerates module content to skip `is_embed_only` rows: learner module navigation, author content lists, the §109 completion cascade, and the §110 cert-path tree-walk. Playback (`get_content_item_video_playback`) must STILL resolve embed-only items. This consumer audit is the risky part; do it backend-first and verify each surface.
- Extract a shared generator component from `MuxVideoUploadField` (script + avatar/voice audition + generate + poll, parameterized by content_item_id). The block form creates the embed-only content item on first generate, hands its id to the shared generator, stores the id in the block's `source_id`. `lesson_video_generations` already carries `target_kind`/`target_lesson_content_item_id`/`target_block_client_id` for exactly this case (built in Phase 1 with this in mind).
- Fold in BQ-VIDEOEMBED-STALE-SOURCEID while reworking the form (see bugs).

Keep the reference flow too. It is the right path when one video is reused across lessons; the in-block generator is additive.

### 2. HeyGen AI authoring path (BQ-HEYGEN-AI-AUTHORING, build alongside/after priority 1)

The lesson AI writes the video script, and the `video_embed` block becomes AI-authorable with one-click generate-and-import. Controlled design (locked): the AI drafts the script, but generation stays an explicit click, not a silent per-build auto-fire, to protect cost and the HeyGen account. This surface reuses the same shared generator and the avatar/voice audition picker built in priority 1. Generating directly from within a block (priority 1) and AI-authored generation are the same engine with different triggers.

### 3. Close out Phase 1 verification (fast, fold into the above)

Two Lovable prompts were delivered but not confirmed applied: the avatar/voice preview UI and the one-line `AddBlockPopover` scroll fix. Once applied, run the deferred combined check: embed the generated video in a lesson in its OWN module (or via the in-block generator from priority 1) and confirm both the in-form preview and learner playback, plus that the avatar clip and voice sample audition correctly.

### 4. Formal Group C closure documentation (carried from Session 148)

Was the Session 148 priority 1 but displaced by the HeyGen build. Phase 4 of the Lesson Experience uplift is complete, so the Group C arc is closeable. Reference `group-c-completion-sequence.md`. INT-2 stays DEFERRED, INT-8 stays queued; call both out as the intentionally-open items at closure.

## Decisions locked in Session 148 (recap)

- **AI video vendor = HeyGen** (PAYG, v2 Avatar III, ~$1/min), not Synthesia. Supersedes the v138/v144 decision and all "Synthesia" forward notes.
- **Generation always produces a standalone video content_item** that rides the existing Mux chain unchanged. Standalone uses it directly; the lesson block references it.
- **Path B reference shape:** `video_embed` config gains `source_type:"content_item"` with the video's content_item id in `source_id`. No migration, no config-schema change.
- **In-block generation is the next build** and is done "on top of" the reference framework (not replacing it), via an embed-only content item.
- **Catalog is cached** (12h, DB-backed) because HeyGen's avatars+voices fetch took ~62s.
- **Closeout stays markdown-only** (Session-74 decision); no `.docx`.

## Open questions / things to lock in Session 149

- Final vendor sequence AFTER HeyGen (in-block + AI authoring): DALL-E images, ElevenLabs VO, SCORM, public API. Confirm the DALL-E vs ElevenLabs order with Cole.
- The exact set of module-content consumers that must honor `is_embed_only` (audit at the top of priority 1 before any schema change).

## Bugs surfaced in Session 148 added to Build Queue

- **BQ-VIDEOEMBED-STALE-SOURCEID [MED]:** `VideoEmbedBlockForm` keeps the previous `source_id` when the source type is switched, so the `content_item` preview fires `get-content-item-video-url` with a non-content-item id and gets a 403 flood (React Query retries multiply it). Fix when reworking the form for the in-block generator: clear `source_id` on source-type switch; the preview should only fire for a resolvable id and with retry disabled.
- **BQ-BLOCKPICKER-SCROLL [LOW, prompt delivered]:** `AddBlockPopover` list had no max-height/scroll, clipping the Video option. One-line fix prompt delivered (`max-h-[60vh] overflow-y-auto pr-1` on the list container); pending apply.
- **BQ-BLOCKRENDERER-DUP-IMPORT [TRIVIAL]:** Lovable added a duplicate `import { Loader2 } from "lucide-react"` in `BlockRenderer.tsx`. Builds fine; fold the dedupe into the next prompt that touches the file.
- Carried unchanged: FlashcardsBlockForm drops top-level `background_color`/`padding` on emit; BranchingScenarioBlockForm `refField` one-line precision fix; BQ-SUPERVISOR-DASH; Doc-1 live Stripe refund test; newsletter `newsletter-sitemap` `STATIC_ROUTES` manual-update reminder for new public marketing pages.

## What's NOT in scope for Session 149

- Reworking the Mux chain. The HeyGen pipeline reuses it untouched.
- Cross-module video embeds. The module-scoping is the entitlement boundary by design; the in-block generator (creating the video in the lesson's module) is the supported way to get a video into a lesson that isn't already in its module.
- DALL-E / ElevenLabs / SCORM / public API (later vendor sequence).

## Architecture additions in Session 148

(Also recorded in architecture-reference.md v149.)

- **Table `lesson_video_generations`** (HeyGen job ledger). Status lifecycle queued -> generating -> ingesting (terminal in this table; final readiness read from `content_items.mux_status`), plus rejected/failed. RLS: super-admin SELECT + service_role ALL; authenticated SELECT only; anon revoked. Partial-unique index on `heygen_video_id`. Carries `target_kind` / `target_lesson_content_item_id` / `target_block_client_id` for the upcoming in-block/AI-authoring case.
- **Table `heygen_catalog_cache`** (singleton id, jsonb payload, fetched_at). RLS on, service_role only (anon/authenticated revoked, §157). 12h TTL cache for the avatar/voice catalog.
- **Edge fn `lesson-heygen-generate` v1** (verify_jwt true): Class A auth (getClaims + super-admin + impersonation gate `permission_change`); operates on an existing video content_item; validates item_type, script <=4900, 10/hr rate limit; POSTs HeyGen v2 `/video/generate` (callback_id = row id, 1920x1080); stores heygen_video_id + status generating.
- **Edge fn `lesson-heygen-webhook` v2** (verify_jwt false): dual-scheme HMAC-SHA256 verifier (`Heygen-Signature` + `Heygen-Timestamp` skew, else legacy `Signature`); OPTIONS 200 for HeyGen's probe; `avatar_video.success` -> atomic claim to ingesting -> Mux ingest (passthrough = content_item_id) -> content_item mux_status preparing; Mux failure reverts to generating + 502; `avatar_video.fail` -> classifyFailure -> rejected (moderation) or failed.
- **Edge fn `lesson-heygen-catalog` v2** (verify_jwt true, super-admin): proxies HeyGen `/v2/avatars` + `/v2/voices`; v2 adds avatar `preview_video_url` + voice `preview_audio_url` (read `preview_audio ?? preview_audio_url` defensively), the 12h DB cache, stale-serve on HeyGen failure, and a `{ refresh:true }` force param.
- **Secrets (Cole-set, values never seen by Claude):** `HEYGEN_API_KEY`, `HEYGEN_WEBHOOK_SECRET`. Cole registered the webhook endpoint (`functions/v1/lesson-heygen-webhook`, events avatar_video.success/fail) via the docs.heygen.com browser console.
- **Mux chain reused unchanged:** `mux-ingest-existing`, `mux-webhook`, `get-content-item-video-url`, signed RS256 playback. A Mux-native HeyGen asset rides `mux-webhook` because it keys only on `passthrough = content_item_id`.
- **Gate fact (durable):** `get_content_item_video_playback` super-admin bypasses publish + assignment checks but still requires the content_item to exist, be a video, and not be archived, else it RAISES and `get-content-item-video-url` returns 403. Non-admin needs an active/completed `user_curriculum_assignment` on a curriculum containing the video's parent module. This is why embedded videos must be in the lesson's module.
- **Frontend (commit `4fe6e1a`, SHA-verified):** `MuxVideoUploadField.tsx` (Upload/Generate-with-AI toggle, catalog dropdowns, script counter, generating-state poll on `lesson_video_generations`), `VideoEmbedBlockForm.tsx` (`content_item` source type + module-scoped picker storing the id in `source_id`), `BlockRenderer.tsx` (`MuxPlayer` import + `ContentItemVideoEmbed` + `content_item` branch in `VideoRender`), `types.ts` regenerated.

## Test fixture state at end of Session 148

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):

- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

HeyGen fixtures: one generated test video ("Test Heygen") exists and is Mux-ready; it lives in a different module than the "Module Test" lesson, which is exactly why the module-scoped picker showed empty during the Path B attempt. No cleanup required; it is a valid playable video in its own module.

## Documents this session leaves behind

- build-queue.md (v150)
- architecture-reference.md (v149)
- session-148-to-149.md (this document)

Markdown only (Session-74 decision; no `.docx`). Markdown source-of-truth at cbastianBWE/brainwise-internal-docs; Cole uploads via the GitHub web UI.
