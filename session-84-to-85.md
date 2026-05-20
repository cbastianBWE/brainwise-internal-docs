# BrainWise Session 84 to 85 Handoff

*Closeout: Session 84. Open: Session 85.*

## Where Session 84 left off

Session 84 was a one-off fix session. Three independent workstreams shipped
end-to-end — coach entitlement bugs (Cheryl phantom-credit + Patrice unreachable
cert-pool gate), the hero banner thumbnail redesign across cert path /
curriculum / module detail pages, and a CSS bug surfaced post-merge on the hero
work and fixed in a follow-up Lovable PR. Two scope-adjacent items were
investigated and logged to the queue — the MFA trusted-device feature and the
editor thumbnail-loss-on-republish hardening — but not built.

Because Session 84 was a one-off fix session, the Session 83 carried priorities
do NOT shift. Session 85 opens on the same priority list Session 83 closed with:
formally confirm cohorts are not needed, ship notifications (Phase 3 + the
Phase 10 notification UI surfaces), then a deliberate Phase 10 polish pass.

## What shipped in Session 84

### 1. Coach entitlement bugs (Cheryl phantom-credit + Patrice unreachable cert-pool gate)

Two real bugs surfaced from production-account audits.

**Bug A — Cheryl Kish phantom-credit.** Cheryl had `assessment_purchases` rows
from purchases she had made FOR clients via the coach-clients page;
`InstrumentSelection.tsx:101` and `consume_assessment_purchase` RPC both read
`user_id = me` with NO `coach_client_id` filter, so the rows she had bought for
clients were being treated as her own free PTP credit.

**Bug B — Patrice Love unreachable cert pool.** Patrice was certified and held
a cert-pool credit (`coach_certifications.free_assessment_uses`), but no
frontend or backend gate consulted that field — only the `assessment_purchases`
table was checked.

**Bug C — trigger over-decrement, found during fix design.**
`link_assessment_to_coach_client` trigger branch (b) decremented
`free_assessment_uses` on ANY self-completion, including paid purchases.

Five backend changes, all applied to production and verified by separate
`execute_sql`:

1. `add_coach_client_id_to_assessment_purchases` — `assessment_purchases.coach_client_id uuid` (nullable FK, indexed); backfilled 8 coach-bought rows.
2. `add_entitlement_source_to_assessments` — `assessments.entitlement_source text` CHECK in (`free_cert_pool`, `paid_purchase`, `coach_paid_client`, `self_pay_coach_invite`).
3. `consume_assessment_purchase_filter_coach_client_id` — added `AND coach_client_id IS NULL` to all 5 SELECT blocks.
4. `link_assessment_to_coach_client_gate_cert_pool_decrement` — gated trigger branch (b) by `NEW.entitlement_source = 'free_cert_pool'` so paid completions never burn cert-pool credit.
5. `stripe-webhook` v27 — coach_order + coach_bulk_order branches write `coach_client_id` to assessment_purchases.

Cheryl was back-seeded with 6 INST-001 cert-pool uses (`free_assessment_uses = '{"INST-001": 6}'::jsonb`, expiry ~120 days out), restoring the credits she had legitimately accrued through the cert program. Her status (`certified`) was untouched.

Frontend shipped via a single Lovable PR — see the v92 build-queue entry for
the per-file step list. All 13 `handleSelect` call sites were tagged with the
correct `entitlementSource` value; the `AssessmentFlow.tsx` stamps the column
via fire-and-forget UPDATE with an atomic `.is("entitlement_source", null)`
guard in both Phase 1 init and `handleAcknowledgmentConfirm`.

### 2. Hero banner thumbnail redesign

User reported hero banners on CertPath/Curriculum/Module detail pages were
stretching small-square thumbnails with `bg-cover bg-center` on the wide
180/240/320px hero, producing distorted images. Locked design: solid background
= dominant color extracted from thumbnail at upload time, with the orange
BrainWise brain glyph in the upper-right; diagonal navy gradient as fallback
when no dominant color is set.

Backend — three migrations plus a new Edge Function plus backfill:

- `add_dominant_color_to_content_assets` — `content_assets.dominant_color text NULL` + comment.
- New shared helper `_shared_dominant_color.ts` using `jsr:@unpic/pixels@1.2.3` (pure-JS JPEG/PNG decoder, no native deps).
- New Edge Function `compute-dominant-color` v2 (Class B `X-Internal-Secret` auth, `verify_jwt:false`). v1→v2 switched from a public-render-URL path to service-role `storage.download({transform:{width:16,height:16,resize:"cover"}})` for private-bucket support. Idempotent (skips if already set). Non-fatal failures return 200 with `{success:false, reason}` so the helper never blocks a thumbnail upload.
- `finalize-asset-upload` v4 — fire-and-forget `compute-dominant-color` invocation on image uploads, catch-wrapped.
- Backfill: 30 of 31 image assets populated. The remaining NULL is orphan library asset `0400f749-30dd-4598-8e26-96150404e41f` (not referenced anywhere — no action needed). Examples: Cheryl's cert path = `#152c48` (navy); Foundations curriculum = `#481a69` (purple); Debrief Practice curriculum = `#4a1a76` (purple).

Frontend shipped via Lovable PR. `src/lib/assetUrls.ts` exported new
`ThumbnailMeta = { url: string; dominantColor: string | null }`,
`resolveThumbnailUrls` return type changed to `Promise<Map<string, ThumbnailMeta>>`, embedded `content_asset_versions` select now reads `dominant_color`, defensive `Array.isArray` unwrap. `src/hooks/useAssetResolver.ts` extracts `.url` when building the public-shape Record (URL map preserved). All 7 `.get()` call sites appended `?.url ?? null`. Three hero rewrites in `CertPathDetail.tsx` / `CurriculumDetail.tsx` / `ModuleDetail.tsx`: brain-icon `<img>` with `pointer-events-none`, drop `bg-cover bg-center`, compose `heroBackground` from `heroOverlay + dominantColor` (or `heroOverlay + heroFallback`).

### 3. CSS bug surfaced post-merge — bare hex colors in `background-image`

User reported every hero rendered navy regardless of the extracted dominant
color. Diagnosis: bare hex colors like `#481a69` are NOT valid values for CSS
`background-image` — the spec accepts only `<url>` and `<gradient>`. The invalid
declaration was being ignored entirely, leaving the transparent overlay
gradient to show the underlying page navy background through it.

Fix shipped via Lovable hotfix PR: split the composed value across two CSS
properties — `backgroundImage` (gradient layers only) and `backgroundColor`
(solid hex or `transparent`). The split-property idiom now lives as a
locked standing rule in architecture-reference §113.

User confirmed the fix shipped and rendered correctly across all detail pages.

### 4. MFA trusted-device feature LOGGED, not built

User asked about extending the 5-minute MFA freshness gate on impersonation.
Investigation: `check_mfa_freshness` exists but only `impersonation-start`
calls it (default 300s window); no other sensitive RPCs are gated.

Build queue item logged: trusted_devices table (hashed token, fingerprint,
label, expiry, revoked_at), `mint_trusted_device` / `check_trusted_device` /
`revoke_trusted_device` RPCs, `impersonation-start` edit to read a device
cookie and bypass `check_mfa_freshness` on hit, "Manage trusted devices"
settings page, auto-revoke on password/MFA changes, audit rows in
`super_admin_audit_log`. Scope-adjacent: extend coverage to
`org_deactivation`, `user_pseudonymization`, and other sensitive admin RPCs
currently with no step-up. SOC 2 supporting feature. Estimated 1.5 sessions
backend + 0.5 session frontend.

### 5. Editor thumbnail-loss-on-republish hardening LOGGED, not built

User reported a thumbnail "disappeared" on a cert path. Audit log analysis
(`super_admin_audit_log` action_type=`certification_path_updated`)
reconstructed: upload `7a4f6a68-...` succeeded at May 19 17:02:17; 39 seconds
later a `publishing` action wrote `thumbnail_asset_id=null` (`before_value`
had the asset, `after_value` was null). The `_archive_thumbnail_ref_and_maybe_asset`
cascade correctly archived the orphan asset.

Conclusion: cascade-archive system working correctly. Bug is editor-side —
`CertPathEditor` (and CurriculumEditor / ModuleEditor / ContentItemEditor /
ResourceEditor — all share the FileUploadField + state + upsert pattern) loses
local thumbnail state between upload and save/publish.

Build queue item logged with two candidate fixes: (a) on save, if
`thumbnailAssetId` is null AND `initial?.thumbnail_asset_id` was not null,
show a confirmation dialog; (b) refetch the row fresh before submitting, merge
any field where the form would null out a previously-populated value.
Investigation needed: whether the editor's `initial` data refetches after
upload-finalize Edge Function returns.

## Decisions locked in Session 84

- **Entitlement-source is an additive enum CHECK column on the assessment row** (§110). The source is the effective-time truth about HOW this assessment was paid for; it is stamped at row creation, not derived later from joins. Triggers that decrement finite resources (cert-pool credit, prepaid coupon) MUST gate on it.
- **coach_client_id is the discriminator on assessment_purchases that distinguishes self-purchase from purchaser-for-client** (§111). All consumer queries that read "what has THIS USER paid for THEMSELVES" MUST filter `coach_client_id IS NULL`. The write side (stripe-webhook) stamps the column at row creation.
- **Dominant-color pipelines are idempotent, fire-and-forget, non-fatal-on-failure, and run on the upload-finalize path** (§112). Service-role storage transform via `storage.download({transform})` supports private buckets; `jsr:@unpic/pixels` is the Deno-compatible image decoder. Backfill loops stagger with `pg_sleep(0.5)` between dispatches because pg_net rate-limits tight loops.
- **CSS `background-image` accepts only `<url>` and `<gradient>` values** (§113). A bare hex color voids the whole declaration. Use `background-color` for solids, the split-property pattern for gradient-over-solid-color compositions.
- **The editor thumbnail-loss bug is editor-side, not cascade-side.** The cascade-archive system is working as designed (§43, §50). Fix work is logged for a future session.

## Untouched, carried unchanged from Session 83

Session 84 was a one-off fix session and did NOT advance the carried Session 83
priorities. They carry forward to Session 85 unchanged:

- Confirm cohorts are not needed and record it.
- Notifications (Phase 3 + the Phase 10 notification UI surfaces).
- Phase 10 polish pass.

After those three, Group C is closeable.

Also still carried, unchanged:

- Coach-paid invitation email verification (Session 82 carryover).
- `create-checkout` graceful-degradation hardening (~60-day comp coupon recurrence, Session 82 HIGH).
- AIRSA Phases 3e-8.
- SOC 2 written policies.
- Action-Oriented Voice Redesign across six surfaces.
- Pricing-reads refactor.
- Corporate contract renewal schema change.
- Clarity Engine.

Edge Function GitHub-sync carryover per §92, unchanged from Session 83 plus
this session's three: `compute-dominant-color` v2 NEW,
`finalize-asset-upload` v4 UPDATED, `stripe-webhook` v27 UPDATED.

## Session 85 opening priorities, in order

Unchanged from Session 83's close — Session 84 was a one-off fix session and
the priority list does not shift:

1. **Confirm cohorts are not needed**, then close that question. Group C's
   read this session already concluded they are scoped-and-done (schema seam
   only, no UI in v1). Session 85 should formally confirm and record it so
   Group C closeout does not re-open it.
2. **Notifications** (Phase 3 + the Phase 10 notification UI surfaces). The
   `notify_user` primitive and the read surfaces (bell, dropdown,
   `/notifications`, `/settings/notifications`). Backend-first: confirm what of
   the Phase 3 schema and `notify_user` already exists before drafting UI.
3. **Phase 10 polish pass.** A deliberate sweep of the new Group C screens:
   empty states, loading skeletons, error boundaries on RPC calls, brand
   styling, accessibility baseline.

After those three, Group C is closeable. Coach-paid email verification and
`create-checkout` hardening remain available if budget allows.

## Standing rules recap (Session 84 additions)

- **§110 — entitlement_source is an additive enum CHECK column on assessment rows distinguishing payment paths.** Triggers that decrement finite resources gate on it.
- **§111 — coach_client_id discriminator on assessment_purchases distinguishes self-purchase from purchaser-for-client.** All consumer queries reading "what has THIS USER paid for THEMSELVES" MUST filter `coach_client_id IS NULL`.
- **§112 — dominant_color pipeline pattern.** Service-role storage transform for private buckets via `storage.download({transform})`, `jsr:@unpic/pixels` for Deno-compatible decoding, idempotent helper with non-fatal failure, fire-and-forget from upload-finalize, `pg_sleep(0.5)` staggering on backfill loops.
- **§113 — CSS `background-image` accepts only `<url>` and `<gradient>`.** Bare hex colors void the declaration. Solids go in `background-color`; the split-property pattern handles gradient-over-solid-color compositions.

## Session 84 close artifacts

- `build-queue.md` v92 entry.
- `architecture-reference.md` v88 entry (§110, §111, §112, §113).
- This handoff (`session-84-to-85.md`).

Markdown only — Session-74 decision. Cole uploads all three manually to
`cbastianBWE/brainwise-internal-docs` (flat repo root); GitHub MCP is
READ-ONLY.
