# Scope: Module Video Migration to Mux (adaptive-bitrate streaming)

**Status:** Scoped, approved in principle, not started. Build is the next session; Operations Doc-1 **Phase 7** follows it.
**Author context:** written during Session 115 after a buffering diagnosis. All current-state facts below were verified live against project `svprhtzawnbzmumxnhsq`.

---

## 1. Why

End users report buffering on module videos. Root cause (verified): all 25 video content items are single-bitrate progressive MP4s in the private `lesson-assets` bucket, served by a signed URL into a native `<video>` tag. Average file **105 MB**, max **441 MB**, total **~2.5 GB**, no adaptive bitrate. On any connection slower than a file's bitrate, the player stalls. Moving to Mux gives adaptive bitrate (the player drops quality instead of freezing), a global streaming CDN, and web-optimized encoding, which resolves the buffering reports for normal connections and converts worst-case slow connections into a brief quality dip rather than a stall.

At BrainWise's scale Mux is effectively free: basic-quality encoding is free, the first 100,000 delivered minutes/month are included, and there is a $20/mo pay-as-you-go credit.

---

## 2. Verified current state (do not re-derive at session open; spot-check only)

- **25 video content items**, all `video_source_type = 'supabase_storage'`. 24 resolve to real MP4s in `lesson-assets`; 1 is an orphan test item titled **"testing video fix again"** with no asset attached (delete it during cutover).
- `content_items` video columns: `external_url`, `thumbnail_asset_id`, `video_ai_summary`, `video_completion_threshold_pct` (= 95 on all real videos), `video_source_id` (text), `video_source_type` (text).
- For `supabase_storage` videos, `video_source_id` holds a **content_asset UUID**, resolved through `content_assets.current_version_id` → `content_asset_versions (bucket, path, size_bytes, mime_type='video/mp4')`.
- **`video_source_type` has NO value whitelist at the DB level.** The only CHECK on `content_items` is: `((item_type='video') OR (video_source_type IS NULL AND video_source_id IS NULL AND video_completion_threshold_pct IS NULL))`. So setting `video_source_type='mux'` needs **no migration** — source-type handling is code-side.
- **Serving today:** edge fn `get-content-item-video-url` (v3, `verify_jwt=true`) → calls RPC `get_content_item_video_asset(p_content_item_id, p_user_id)` (access gate: self with an active/completed curriculum assignment containing the parent module, OR mentor, OR super admin; raises `access_denied` / `content_item_not_video` / `video_not_storage_hosted` / `content_item_not_assigned`) → service-role `createSignedUrl` on `lesson-assets`, 2h TTL → returns `{signed_url, ...metadata}`.
- **Completion gate:** RPC `record_video_progress(p_content_item_id uuid, p_watch_pct integer, p_last_position_seconds integer)`. The trainee viewer reports watch percentage here; completion fires at `video_completion_threshold_pct` (95). **This RPC is unchanged by the migration** — the new player must feed it the same way.
- `lesson-assets` is a private bucket with super-admin-only RLS; trainee reads happen only via the signed-URL edge path.

---

## 3. Mux prerequisites (Cole-side, before the build session)

1. Create a Mux account/organization. Use a **test environment** first for the single-video pilot, then a **production environment** for the real ingest. (Each environment has its own keys.)
2. **API access token** (Settings → Access Tokens): gives `MUX_TOKEN_ID` + `MUX_TOKEN_SECRET`. Used by the backend to create uploads/assets.
3. **Signing key** (Settings → Signing Keys): gives `MUX_SIGNING_KEY_ID` + an RSA private key (`MUX_SIGNING_KEY_PRIVATE`, base64). Used to mint signed playback JWTs. This is separate from the access token.
4. **Webhook secret**: create a webhook endpoint pointing at the `mux-webhook` function URL; Mux gives `MUX_WEBHOOK_SECRET` for signature verification.
5. Set all of the above as **Supabase Edge Function secrets**: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_KEY_PRIVATE`, `MUX_WEBHOOK_SECRET`.

**Three product decisions (recommendations in bold):**
- Playback policy: **signed** (so only token-holders can watch — preserves the existing gating). Not public.
- Max resolution tier: **1080p** (basic or plus quality level; keep source uploads ~1080p, no 4K masters).
- Auto-generated captions: **skip for v1** (extra per-minute cost; revisit later, the `video_ai_summary` field is separate).

---

## 4. Data model (additive only)

Migration `sessionNN_mux_video_columns` — add to `public.content_items`:
- `mux_asset_id text` — Mux asset ID (for lifecycle: status, deletion, re-encode).
- `mux_status text` — `preparing | ready | errored` (drives the processing-state UX; null for non-Mux).
- `duration_seconds numeric` — populated from the Mux webhook (handy for watch-pct math and listings).

`video_source_id` will hold the **Mux playback ID** once ready (keeps the viewer's lookup uniform). `video_source_type` flips to `'mux'`. No CHECK/enum change (see §2). No change to `record_video_progress` or `video_completion_threshold_pct`.

**Webhook correlation:** set Mux `passthrough = content_item_id` when creating each upload/asset, so the webhook maps the resulting asset back to its content item without a side table.

---

## 5. Backend build (ordered; verify each before the next)

**M-A — columns migration** (above). Verify with `execute_sql`.

**M-B — playback access RPC.** New `get_content_item_video_playback(p_content_item_id uuid)` that mirrors the access gate in `get_content_item_video_asset` (read its body first via `pg_get_functiondef` and copy the gate verbatim) but returns `{playback_id (= video_source_id), mux_status, video_source_type}` instead of bucket/path. SECDEF, search_path '', granted authenticated + service_role only. This is the gate the token-minting fn calls.

**EF1 — `mux-create-upload`** (`verify_jwt=true`, super-admin only). Input: `content_item_id`. Calls Mux "create direct upload" with `new_asset_settings = { playback_policy: ['signed'], passthrough: content_item_id, max_resolution_tier: '1080p' }`. Sets `content_items.mux_status='preparing'`. Returns the Mux upload URL to the client. Anon/non-super-admin rejected.

**EF2 — `mux-webhook`** (`verify_jwt=false`; authenticates via Mux signature). Verifies the `Mux-Signature` header against `MUX_WEBHOOK_SECRET` (HMAC-SHA256 over `timestamp.body`) before doing anything. Handles:
- `video.asset.ready` → write `mux_asset_id`, set `video_source_id = playback_id` (the signed playback ID), `duration_seconds`, `mux_status='ready'`, and flip `video_source_type='mux'`. Map to the content item via `passthrough`.
- `video.asset.errored` → `mux_status='errored'` (surface in authoring UI).
- (optionally `video.upload.asset_created` to capture `mux_asset_id` early.)
Idempotent on event id / asset id. This is the function that performs the cutover per-video.

**EF3 — evolve `get-content-item-video-url` to v4** (`verify_jwt=true`, preserved). Branch on `video_source_type`:
- `mux` → call `get_content_item_video_playback` (access gate), then mint a **signed Mux playback JWT** and return `{ kind:'mux', playback_id, token, expires_in_seconds }`. The JWT is **RS256**, signed with the RSA private key, claims `{ sub: playback_id, aud: 'v', exp: now+TTL, kid: MUX_SIGNING_KEY_ID }` (TTL ~2h to match today). Use Web Crypto in Deno for RS256.
- `supabase_storage` → unchanged legacy path (signed storage URL). Keeps any not-yet-migrated video working during cutover and as permanent fallback.
Single call site for the viewer; the response `kind` tells the player which mode to use.

**One-time ingest — `mux-ingest-existing`** (admin-only EF or a scripted loop invoked via MCP). For each of the 24 real videos: mint a short signed `lesson-assets` URL, call Mux "create asset" with `input:[{url}]`, `playback_policy:['signed']`, `passthrough: content_item_id`, `max_resolution_tier:'1080p'`, `mp4_support:'none'`; store `mux_asset_id`, `mux_status='preparing'`. The `mux-webhook` then fills `playback_id` + flips each to `mux` as Mux finishes. Run on ONE video first (pilot), then the rest.

---

## 6. Frontend build

**Authoring upload (super-admin).** When `item_type='video'`, branch the existing upload field: call `mux-create-upload`, then upload the file straight to the Mux upload URL (use Mux's `UpChunk` for resumable upload). Show a **"processing"** state (poll the content item or use realtime on `mux_status`) until `ready`. Keep all other content types on the existing `lesson-assets` path. Non-video assets (thumbnails, lesson-block media, documents) are untouched — Mux is video-only.

**Trainee viewer.** Replace the native `<video>` (fed by the storage signed URL) with **Mux Player** (`@mux/mux-player-react`), fed `playback-id` + `playback-token` from `get-content-item-video-url` v4 when `kind==='mux'`. Keep the `supabase_storage` branch as fallback. Wire Mux Player's `timeupdate`/`ended` events to compute `watch_pct = currentTime/duration` and `last_position_seconds`, and call **`record_video_progress`** exactly as today so the 95% completion gate and the cascade modal are unchanged. Show a graceful "video still processing" state if `mux_status !== 'ready'`.

---

## 7. Security / access model

- Signed playback policy means a Mux URL is useless without a token. The token is minted **only after** the existing access gate (`get_content_item_video_playback`) passes — same gate as today, just returning a playback ID instead of a storage path. Short TTL (~2h).
- `mux-webhook` verifies the Mux signature before any DB write.
- Secrets live in Supabase Edge secrets; the RSA private key never reaches the client.
- `lesson-assets` RLS and the super-admin-only authoring path are unchanged.

---

## 8. Cutover plan (zero-downtime, reversible)

1. **Build + deploy** all backend (M-A, M-B, EF1–EF3, ingest fn) in the test Mux environment. Pilot on **one** video end to end: ingest → webhook `ready` → flips to `mux` → plays via Mux Player → `record_video_progress` still fires at 95%.
2. **Ingest the remaining 23** (production Mux env). Each stays `supabase_storage` until its Mux asset is `ready`; the webhook flips it. Until flipped, the old path serves it — no downtime, mixed state is fine because the viewer branches per item.
3. **Verify** all 24 play via Mux and completion gating works; delete the orphan "testing video fix again" item.
4. **Soak** (e.g., a week of real coach usage), watching for `errored` statuses and playback issues.
5. **Reclaim**: after the soak, delete the 24 originals from `lesson-assets` (or move to a cold archive) to free ~2.5 GB. Do this last.

**Rollback:** before step 5, any misbehaving video flips back to `supabase_storage` (`video_source_id` still points at the intact content_asset). After step 5, rollback for a given video would require re-upload, which is why deletion is last and gated on the soak.

---

## 9. Open decisions for Cole (confirm at session open)

1. Playback policy signed (recommended) vs public.
2. Max resolution tier 1080p (recommended) and quality level basic vs plus.
3. Auto-captions: skip v1 (recommended) vs enable.
4. Delete vs cold-archive the 24 originals after soak.
5. Pilot in a Mux test environment first (recommended) vs straight to production.

---

## 10. Effort estimate

One focused session for the backend (columns + RPC + 3 edge functions + ingest fn, all verifiable via MCP) plus 2–3 Lovable cycles for the authoring-upload branch and the viewer swap. Ingest of the 24 is automated (one fn run). Realistic: **1 build session + cutover**, with the soak/reclaim trailing into the following session. Cost at this scale: effectively free on Mux; keep sources ~1080p.

---

## 11. Out of scope / deferred

- Other video source types (youtube/vimeo/cloudflare) — none in use; not built.
- Mux Data dashboards beyond default playback analytics.
- Per-asset captions/transcripts (separate cost; revisit).
- Non-video assets stay on `lesson-assets` (thumbnails, lesson-block media, documents) — unchanged.

---

## 12. Session-open reads (pull fresh before building)

- `pg_get_functiondef` on `get_content_item_video_asset` (copy the access gate verbatim into the new playback RPC) and on `record_video_progress` (confirm signature unchanged).
- The trainee video viewer in the content-item viewer (the `case "video"` path) and its completion-reporter hook, from `cbastianBWE/brainwise-blueprint` via the GitHub MCP API (not the raw CDN — it can serve stale content).
- The authoring upload component (`FileUploadField` and the content-item authoring editor) to find the video branch point.
- `get-content-item-video-url` current source via `Supabase:get_edge_function` (it becomes v4).

---

## Next after this

Operations Doc-1 **Phase 7** (settings/automation + activity log/comments). Separate session; this Mux work does not touch the Operations schema.
