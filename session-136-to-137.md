# BrainWise Session 136 to 137 Handoff

*Closeout: Session 136. Open: Session 137.*

## Where Session 136 left off

An AI lesson-builder session. The full-content generator (`expand-lesson-from-outline`) gained windowed/batched generation on the backend (v24), a new `lesson-ingest-pexels-asset` edge function rehosts Pexels images into the lesson asset pipeline, and a single comprehensive Lovable prompt wired both the outline-stage image picker and the batched build loop across four ai-pane files (all SHA-verified). The "New Lesson" button shipped earlier in the session, and a multi-track Learning-Experience + White-Label scope doc was written and loaded to the repo. Two live smoke tests are Cole's to run; next session continues the lesson-block work at track 2.

## What shipped (all verified unless noted)

### Expand windowing (backend, `expand-lesson-from-outline` v24, verified)

Added optional `generate_start_index` + `generate_count`. When both are sent, the full approved outline is rendered as context (each item tagged `(GENERATE)` or `(context only)`) but the model emits blocks ONLY for the window `[start, start+count)` and returns exactly that many, in order. When the params are absent the behavior is byte-identical to v13 (whole outline in one call), so the change is additive, backward-compatible, and dormant until the client sends windows. This solves the ~150s edge wall-clock timeout and the 8000-output-token cap on long outlines, and is the foundation for per-batch VO and video later. Deployed as the full four-file bundle (index plus the three unchanged `_shared` modules), re-fetched and diff-verified, then boot+auth probed (no-auth POST returns 401 `missing_bearer_token`, OPTIONS returns 204). `verify_jwt` stayed false (the function authenticates internally via `getClaims`).

### lesson-ingest-pexels-asset v1 (NEW edge function, verified)

`verify_jwt` true, super-admin gated. Parallel to the newsletter `ingest-pexels-asset` but for a lesson `content_item`: body `{content_item_id, pexels_id, src_large_url, photo_page_url, photographer_name, photographer_url, alt}`; validates `item_type='lesson'`; calls `request_asset_upload(p_content_item_id, p_ref_field='image_asset')` then `finalize_asset_upload`; `images.pexels.com` SSRF allowlist; HEAD size (<=15MB)/mime guard; service-role upload; provenance to `content_asset_versions.generation_provenance`. `newsletter-image-search` is reused verbatim for search (search-only, brand-agnostic) with no change. Live round-trip (real pick -> ingest -> render -> save -> reload) is a Cole smoke test, below.

### Frontend image resolution + batched build (one Lovable prompt, four files SHA-verified)

- `types.ts` (`249017ec`): `OutlineItem` gained `image_query`, `image_resolved {asset_id, attribution, thumb_url}`, `image_skipped`.
- `Stage2Outline.tsx` (`1d2d6461`): per-image-item resolution card that auto-searches `newsletter-image-search` once on mount, with Use-this-image (calls `lesson-ingest-pexels-asset`), Show-another, an editable query, Leave-empty, and Change-image; plus approve gating (the outline cannot be approved while any image item is unresolved and not skipped).
- `AiPane.tsx` (`f7c505ef`): `handleApproveOutline` resets full-content state and runs the first window; `buildNextBatch(startIndex)` calls expand with the full outline plus `generate_start_index`/`generate_count`, accumulates blocks via a functional update, and stitches each approved image (`asset_id` + `attribution`) onto its block by global outline index. Batch size is detailed 5 / standard 7 / concise 10.
- `Stage3FullContent.tsx` (`b9490bc9`): "Sections X of Y built" progress, a "Build next N sections" button, and finalize gated until every section is built.

Batching is client-driven (the AiPane loops expand per window), deliberately not server self-chaining, per the `generate-all-facets` mid-chain unreliability learning. The accumulated full-content state persists, so a reload resumes mid-build.

## Session 137 opening priorities, in order

### 1. (Cole-requested) Continue the lesson-block work per the scope doc

Source of truth is `BrainWise_Learning_Experience_and_WhiteLabel_Scope_v1.md` (in the repo). Track 1 (Pexels) is done; the next track is **2: per-lesson branding + title card**. The remaining build order is 3 (visual shell), 4 (VO / ElevenLabs), 5 (Synthesia video), 6 (learner AI tutor). The windowed/batched build shipped this session is the foundation the VO and video tracks rely on (per-batch generation rather than one mega-operation).

### 2. Cole live smoke tests (carryforward from Session 136)

Two tests need real Opus calls and a real pick, so they were left for Cole: the Track 1 Pexels picker round-trip (pick, ingest, render, save, reload) and a long-lesson batched build (confirm detailed lessons batch at 5, and that the "Build next" / finalize gating behaves). If either misbehaves, diagnose against the live `expand-lesson-from-outline` v24 / `lesson-ingest-pexels-asset` v1 and the four ai-pane files.

## Decisions locked in Session 136 (recap)

- Windowing is always-on by design (not a fallback): the backend always sends the full outline as context and generates only the window. Full-outline-as-context, not a running prose summary, is the coherence mechanism.
- Image attribution is a pure frontend-additive field on the image block config; the AI generators never emit it and were not touched (§61 satisfied).
- Vendors: AI video = Synthesia (verify API moderation + SCORM/Enterprise caveats before building; Colossyan/HeyGen fallback). Voiceover = ElevenLabs.

## Open questions / things to lock in Session 137

- Track 2 (per-lesson branding + title card) detail design. Prior decision: branding lives with the lesson (sold off-the-shelf), not system-level.

## Known cosmetic limitation (not a bug)

A freshly-ingested image may not preview in the Stage 3 review until the lesson is actually built, because the canvas asset-URL map is populated on canvas load. The `asset_id` is correctly attached and the image renders post-build.

## What is NOT in scope for Session 137 unless raised

- CRM/OPERATIONS route gating and the broader customer-access/externalization arc.
- Module subscription billing wiring; per-tenant Stripe Connect.
- The remaining v143 carryforwards (SHA-verify Shared/Teams, BQ-SUPERVISOR-DASH, AdminUsers UX prompt) unless Cole pulls them forward.

## Architecture additions in Session 136

Recorded in `architecture-reference.md` v138: the expand windowing contract (`generate_start_index`/`generate_count`, full-outline-as-context, backward-compatible), `lesson-ingest-pexels-asset` v1, the frontend-additive image attribution field, and the AI-builder image-resolution + batched-build flow.

## Test fixture state at end of Session 136

Test org: BrainWise Test Corp. Test users follow the `testclientbwe+...@gmail.com` pattern plus `testcoach@gmail.com` (look up current UUIDs via Supabase MCP; password is in Claude's userMemories). No fixture changes this session.

## Documents this session leaves behind

- build-queue.md (v144)
- architecture-reference.md (v138)
- session-136-to-137.md (this document)

Markdown source-of-truth at cbastianBWE/brainwise-internal-docs (flat repo root). No .docx generation (Session-74 decision). GitHub MCP is read-only (Session 39); upload these three files manually via the web UI.
