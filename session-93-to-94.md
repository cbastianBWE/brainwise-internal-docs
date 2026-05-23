# BrainWise Session 93 to 94 Handoff

*Session 93 closed CLEAN. Phase G1 backend lift is DONE. Session 94 opens on Phase G2 (newsletter subscriber email flow). This is a normal close, not a partial.*

---

## Read first

Before doing anything else, query Supabase MCP to confirm what's actually shipped. Don't trust this document alone — confirm against the live DB:

```sql
-- Verify Session 93 migrations are present
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE name LIKE 'session93%'
ORDER BY version;
```

Expected output (exact, 6 rows in this order):

```
20260523174208  session93_newsletter_articles_state_transition_rpcs
20260523175312  session93_newsletter_articles_read_rpcs
20260523175845  session93_newsletter_draft_pruning_function_and_cron
20260523181119  session93_newsletter_articles_inline_asset_refs
20260523181412  session93_newsletter_articles_inline_asset_refs_archive_reason_whitelist
20260523181555  session93_newsletter_article_images_bucket
```

If any are missing, STOP and investigate. Also confirm Session 92's 5 migrations are still present (the foundation Session 93 built on).

---

## Phase G1 final state (post-Session-93)

### Tables (5 newsletter)
- `newsletter_subscribers` (17 cols including new `linked_user_id` from G1.3d)
- `newsletter_subscribe_attempts` (3 cols)
- `newsletter_articles` (23 cols)
- `newsletter_article_authors` (3 cols)
- `newsletter_article_versions` (12 cols)

All empty.

### Cross-cutting table extensions (G1.4)
- `content_asset_refs` extended to 7-way parent (`newsletter_article_id` column + 7-way `exactly_one_parent` CHECK + partial index)
- `content_assets.archive_reason` CHECK whitelist extended from 8 to 9 values (added `'newsletter_article_archived'`)

### Functions (24 newsletter-related)

**Helper:** `current_user_active_plan_tier()`

**Touch triggers:** `_touch_newsletter_subscribers_updated_at()`, `_touch_newsletter_articles_updated_at()`

**Subscriber:** `import_newsletter_subscribers_bulk(jsonb, text)`

**Article internals:** `_snapshot_article_version(uuid, text, text, uuid)`

**Article writes:** `auto_save_article(uuid, jsonb, text, text, text, text, text, integer, integer)`, `upsert_article(17 params)`, `commit_article_version(uuid, text, text)`, `restore_article_version(uuid, text)`

**Article state transitions:** `schedule_article(uuid, timestamptz, text)`, `cancel_scheduled_article(uuid, text)`, `publish_article(uuid, text)`, `unpublish_article(uuid, text)`, `archive_article(uuid, text)`

**Article reads:** `get_article_for_reader(text)`, `preview_article_as_viewer_class(uuid, text)`, `list_articles_for_archive(text, uuid, integer, integer)`, `list_article_versions(uuid)`, `get_article_version(uuid)`

**Asset infrastructure:** `_walk_tiptap_for_image_asset_refs(jsonb)`, `_cascade_archive_asset_refs_for_newsletter_article(uuid, uuid, text)`, `_rebind_newsletter_article_asset_refs(uuid, uuid)`

**Maintenance:** `prune_newsletter_draft_versions()`

### Action types (11 newsletter)
`newsletter_subscriber_imported_bulk`, `newsletter_subscriber_unsubscribed_by_admin`, `article_created`, `article_saved`, `article_version_committed`, `article_scheduled`, `article_published`, `article_unpublished`, `article_restored_from_version`, `article_archived`, `article_schedule_cancelled`

### RLS policies (12 newsletter, all §82-clean)
- subscribers: super_admin_all, service_role_all (NO public)
- subscribe_attempts: super_admin_all, service_role_all (NO public)
- articles: super_admin_all, service_role_all, public_read (anon+auth, `status='published' AND archived_at IS NULL AND gate='public'`)
- article_authors: super_admin_all, service_role_all, public_read (joined to publicly-readable articles)
- article_versions: super_admin_all, service_role_all (NO public — version history is authoring-internal)

### Cron jobs (1 newsletter, DISABLED)
- `prune_newsletter_draft_versions` at `35 6 * * *`, `active=false` per Lovable v2 item 3. Cole enables after 2 weeks of authoring monitoring via `SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'prune_newsletter_draft_versions'), active := true);`

### Storage buckets (1 newsletter)
- `newsletter-article-images` — public, 10MB ceiling, MIME allowlist `image/jpeg, image/png, image/webp, image/gif`. 2 §82-clean policies (public SELECT + service_role ALL).

### Smoke-test audit rows in production
28 total (5 Session 92 + 23 Session 93). All reason-prefixed `'G1.X smoke test - ...'` per §130 convention. Immutable per `block_audit_log_mutations` trigger. Identifiable + acceptable.

---

## Phase G2 scope (Session 94 work)

Per Lovable v2 §3 sequencing table — phase order is **G1 → G2 → G4 → G5 → G3 → G6 → G7 → G8 → G9** (G3 sequenced AFTER G4/G5 per Lovable v2 item 13 to keep DNS cutover risk window closed during authoring UI work).

G2 ships the subscriber email flow + Resend audience sync + Cloudflare Turnstile integration. From scope §G2 + v2 §G1.2 (RPC contracts already designed at G1 lock):

### Migrations expected (rough sequencing)

1. **`session94_newsletter_subscribe_attempt_pruning_function_and_cron`** — Prune-attempts function deleting rows older than 24 hours + cron job at `15 6 * * *`. Per Session 92 Discovery 2 slot collision rules. Use §134 disable-at-ship pattern only if ship-disabled is the call; otherwise ship enabled (no observation period needed — function operates on rate-limit tracking only).

2. **`session94_newsletter_pending_confirmation_expiry_function_and_cron`** — Expire pending_confirmation rows older than 7 days, flip to `unsubscribed` with note. Cron at `25 6 * * *`. Same §131 + §134 discipline.

3. **`session94_newsletter_subscribe_RPCs`** — Three anon-callable SECDEF RPCs: `subscribe_to_newsletter(p_email, p_source, p_referrer, p_ip_address)`, `confirm_newsletter_subscription(p_raw_token)`, `unsubscribe_from_newsletter(p_raw_token)`. Plus `list_newsletter_subscribers(p_status_filter, p_limit, p_offset)` super_admin only. All use SHA-256 hashed tokens per v2 item 2 — raw_token in local var + outbound email body, never in DB.
   - `subscribe_to_newsletter` enforces rate limit (5 attempts per IP per hour) via `newsletter_subscribe_attempts` table; idempotency: re-subscribing pending re-sends, re-subscribing confirmed no-ops, re-subscribing unsubscribed triggers re-consent flow.
   - `confirm_newsletter_subscription` populates `linked_user_id` if `auth.uid() IS NOT NULL` per §133/G1.3d Gap-5 design. **G2 must decide multi-subscription policy** per v2 G1.3d Lovable Q4 point 2 — when `auth.uid()` already has a confirmed row with non-NULL linked_user_id, the new confirmation should either reject ("already subscribed") or merge. Pick one explicitly, document in RPC body.
   - `confirm_newsletter_subscription` returns raw unsubscribe token for caller (confirmation success page can copy a manage-subscription URL).
   - All three RPCs use §129 pattern (`SET search_path = public, extensions, pg_temp` for pgcrypto calls).

4. **`session94_newsletter_resend_audiences_sync_edge_function`** — Deploy `resend-audiences-sync` Edge Function (Class B per §107 — internal-secret gated, called by confirm/unsubscribe RPCs via pg_net.http_post). Syncs subscriber state to Resend Audiences API. Function reads `INTERNAL_FUNCTION_SECRET` from Vault. Idempotency: re-sync of already-synced subscriber is a no-op.

5. **`session94_newsletter_confirmation_email_template`** — Add new `email_type` row + email template for confirmation-email body (TipTap → HTML rendered with brand tokens applied). New `email_type` value: `'newsletter_confirmation'`. Pairs with `'newsletter_unsubscribe_confirmed'`.

6. **`session94_cloudflare_turnstile_integration`** — Verify Turnstile token in `subscribe_to_newsletter` RPC. Turnstile site key + secret key from Vault. RPC param `p_turnstile_token text` added; rejects with 22023 on validation failure. **NEW Cole-side step:** Turnstile site/secret keys provisioned by Cole at Cloudflare; site key embedded in subscribe form frontend (G2 Lovable cycle), secret key inserted into Vault before G2 backend ships.

### Lovable approval cycles likely Session 94

- **Q7 (decide before backend ships):** multi-subscription policy at confirm-time per v2 G1.3d Lovable Q4 point 2 — reject ("already subscribed") or merge. Default lean: reject + re-send the existing linked confirmation if for some reason it hadn't been processed. Discussion needed.
- **Q8 (decide before subscribe RPC ships):** rate-limit thresholds. v2 says 5/hr/IP but Cole may want softer in practice (slack for shared-IP households). Lock the number explicitly.
- **Q9 (decide if shipping confirmation email at G2):** confirmation email subject + body copy. Not a backend question per se but body affects the convert flow funnel — Lovable's content opinion matters.
- **Q10 (decide before Turnstile lands):** v2 mentions Cloudflare Turnstile; need to confirm Cole has a Cloudflare account already (per Session 91 carryover, Vercel was the choice for SSR — Cloudflare Turnstile is separate but related; if Cole doesn't have CF account, Turnstile defers to G3+).

### Pre-Lovable recon owed at Session 94 open

- `pg_proc` for available Resend integration helpers (existing `send-email` Edge Function or similar)
- `email_logs` table schema to confirm email_type FK or whitelist
- `vault.decrypted_secrets` for current secret names (RESEND_API_KEY exists; need to add TURNSTILE_SECRET if not present)
- Existing pg_cron jobs to confirm 6:15 and 6:25 slots are still free (Session 93 added the 6:35 slot but 6:15 + 6:25 are still planned for G2)
- Confirm `confirm_newsletter_subscription`-style anon-callable RPC pattern is consistent with existing patterns (look for similar SECDEF anon-callable patterns like `peer_access_request_create`, `corporate_employee_choose_individual`)

---

## Standing operating discipline applies

- **§129** (pgcrypto search_path): G2 token hashing in subscribe/confirm/unsubscribe RPCs must include `extensions` in search_path.
- **§130** (smoke-test audit row labeling): all G2 smoke tests prefix reason with `'G2.X smoke test - <detail>'`.
- **§131** (cron slot collision discovery): query `cron.job` before scheduling 6:15 and 6:25 — confirm no Session 93 surprises.
- **§132** (pre-migration schema recon): query `information_schema.columns` + `pg_constraint` + `pg_proc` before drafting any G2 migration. Three Session 93 apply errors all came from skipping this. Don't repeat.
- **§133** (TipTap asset_id canonical reference): not directly relevant to G2 (subscriber flow only) but locks in for G4 native upload + G6 reader to honor.
- **§134** (pg_cron disable-at-ship pattern): use `cron.schedule_in_database(..., active => false)`, never `UPDATE cron.job`. Both G2 cron jobs (6:15 + 6:25) likely ship enabled — no observation-period need — but the pattern is still the recommended API surface.
- **Lovable Credit Conservation Protocol** — backend-first; diagnose before prescribe; no Lovable prompts until SQL-verified.
- **Plan-doc gate** on every Lovable cycle if any frontend work surfaces (G2 may need a small subscribe form frontend update for Turnstile site key embedding).
- All §99 discipline: action_types INSERTed in same migration as RPCs that emit them. G2 adds 1+ new action_types (`newsletter_subscribed` for the public RPC? — design decision pending).
- All §82 discipline: explicit TO clause on every RLS policy.
- All §111 discipline: wrapper-returning RPCs get TypeScript interfaces frontend-side.

---

## Non-blocking fast-follows Cole owes (unchanged from Session 91-93 carryover)

- **og-image canonical PNG upload** at `https://brainwiseenterprises.com/og-image-default.png` (Session 91 owed; still owed)
- **Vercel-GitHub integration verification** before Phase G3 starts (10-min check at G3 open; fallback Cloudflare Worker at $5/month)
- **Cloudflare Turnstile account + keys** (NEW from G2 prep) — site key + secret key provisioned, secret added to Supabase Vault before G2 backend smoke test
- **Turnstile site key embedded in frontend subscribe form** (NEW from G2 prep) — Cole or Lovable cycle, depending on timing

---

## Carryover deferred items (unchanged from Session 92)

- AIRSA facet-interpretation generation gap investigation
- Messaging subsystem (prereq for `coach_messages` notification type)
- Module reorder gap
- MFA trusted-device feature
- Editor thumbnail-loss-on-republish hardening
- Coach-paid invitation email verification
- `create-checkout` graceful-degradation hardening
- AIRSA Phases 3e-8
- SOC 2 written policies
- Action-Oriented Voice Redesign
- Pricing-reads refactor (centralize to `subscription_plans` table)
- Corporate contract renewal schema change (drop UNIQUE on `organization_id`, add `is_current` semantics)
- Clarity Engine
- Session 71 anon EXECUTE audit
- Post-launch `coach_clients_client_view` SECDEF refactor
- `results_available` NAI/AIRSA/HSS coverage (currently PTP-only)
- `users.last_active_at` infrastructure
- `user_ui_preferences` dedicated table migration
- Bulk Phase 11 v2
- /super-admin/coaches consolidation
- Members Surface v2 polish (5-item queue)
- Button labeling pattern (Toggle Sidebar / Log Out / drawer Close)
- Legacy 2-arg `search_impersonation_targets` cleanup (DONE per Session 88, verify clear)
- Mentor Portal v2 MQ-1 through MQ-4
- `results_available` firing point wiring (paths A/B documented; flip `is_v1_active = true` after wiring)
- `coach_messages` notification type (deferred pending messaging subsystem)
- `platform_updates` notification type (deferred)

---

## Files in `/home/claude/internal-docs/` at Session 93 close

- `build-queue.md` — v100 with full Session 92 partial + Session 93 close ship narratives, per-sub-phase DB state snapshots
- `architecture-reference.md` — v96 covering Sessions 92 + 93 + locking §129-§134
- `session-92-to-93.md` — Session 92 partial handoff (historical reference)
- `session-93-to-94.md` — this file
- `scope-group-fg-marketing-newsletter.md` — 500-line scope, Q1-Q6 + Q7-Q8 locked
- `lovable-review-group-g-approach-v2.md` — 621-line v2 approach doc

---

## Session 94 opener checklist

1. `get_file_contents` on canonical docs from `cbastianBWE/brainwise-internal-docs`: `build-queue.md` (v100 top), `architecture-reference.md` (v96 top), `session-93-to-94.md` (this), `scope-group-fg-marketing-newsletter.md`, `lovable-review-group-g-approach-v2.md`. Save locally to `/home/claude/internal-docs/`.
2. Run the DB verification query at top of this handoff. Confirm 6 Session 93 migrations present + 5 Session 92 migrations still present + Phase G1 final state matches inventory above.
3. Pre-Lovable recon per §132: query `information_schema.columns` on `users`, `email_logs`, `newsletter_subscribers`; query `pg_constraint` on `email_logs` if it has email_type CHECK; query `pg_proc` for existing Resend helpers and the `send-email` Edge Function spec via `get_edge_function`.
4. Draft Lovable approval packet covering Q7-Q10 above. Wait for sign-off before drafting any G2 migration body.
5. Apply G2 migrations one at a time per protocol. Smoke-test each. Reason-prefix `'G2.X smoke test - <detail>'` per §130.
6. Frontend Lovable cycle (if Turnstile site key embedding needed) — backend must be SQL-verified first.
7. Close at end with build-queue v101 + architecture-reference v97 + session-94-to-95.md handoff.
