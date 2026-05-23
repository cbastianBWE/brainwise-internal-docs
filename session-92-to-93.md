# BrainWise Session 92 to 93 Handoff

*Session 92 was a PARTIAL session — context exhausted mid-Phase G1. Next session resumes G1.3c onward.*

---

## Read first

Before doing anything else, query Supabase MCP to confirm what's actually shipped. Don't trust this document alone — confirm against the live DB:

```sql
-- Verify these 5 migrations are present
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE name LIKE 'session92%'
ORDER BY version;
```

Expected output (exact):
```
20260523170352  session92_current_user_active_plan_tier_helper
20260523170706  session92_newsletter_subscribers_table_and_rls
20260523170911  session92_newsletter_subscriber_bulk_import_and_action_types
20260523171213  session92_newsletter_articles_tables_rls_action_types
20260523171529  session92_newsletter_articles_write_rpcs
```

If any of those are missing, STOP and investigate — something rolled back.

---

## What shipped Session 92 (exact)

### Tables created (5, all in `public` schema)

1. `newsletter_subscribers` (16 columns) — subscriber list, EMPTY
2. `newsletter_subscribe_attempts` (3 columns) — rate-limit tracking, EMPTY
3. `newsletter_articles` (23 columns, **NO `is_current_published` column** per Lovable v2 N4) — articles, EMPTY
4. `newsletter_article_authors` (3 columns: article_id, author_user_id, author_order) — many-to-many junction, EMPTY
5. `newsletter_article_versions` (12 columns) — append-only version history, EMPTY

### Functions created (9)

- `current_user_active_plan_tier()` → text. Zero-arg SECDEF STABLE SQL. Reads `auth.uid()`, returns `subscription_tier` when `subscription_status='active'` and tier IN ('base','premium','individual'); NULL otherwise. GRANTed anon+authenticated+service_role; PUBLIC revoked.
- `_touch_newsletter_subscribers_updated_at()` → trigger function
- `_touch_newsletter_articles_updated_at()` → trigger function
- `import_newsletter_subscribers_bulk(p_subscribers jsonb, p_reason text)` → jsonb. Super-admin only. Caps at 500. Per-row consent_evidence required. Generates raw unsubscribe token (32 bytes base64url), stores SHA-256 hash (64-char hex), returns raw token ONCE in result.
- `_snapshot_article_version(p_article_id, p_version_type, p_version_name DEFAULT NULL, p_restored_from_version_id DEFAULT NULL)` → uuid. Internal helper. Captures article state + authors array into version row. GRANTed service_role only.
- `auto_save_article(p_article_id, p_body_tiptap, + 7 optional params)` → jsonb. Silent auto-save, NO audit row. Cannot change gate/authors/status/scheduling.
- `upsert_article(17 params including p_author_user_ids uuid[], p_reason)` → jsonb. Explicit save (create + update). Replaces author junction atomically. Audit emits `article_created` or `article_saved` with FULL before/after JSONs including authors per Lovable v2 item 15.
- `commit_article_version(p_article_id, p_version_name, p_reason)` → jsonb. Named revision snapshot.
- `restore_article_version(p_version_id, p_reason)` → jsonb. Replaces body + authors + metadata from snapshot per Lovable v2 Q-A.

### Triggers created (2)

- `trg_newsletter_subscribers_touch_updated_at` BEFORE UPDATE on newsletter_subscribers
- `trg_newsletter_articles_touch_updated_at` BEFORE UPDATE on newsletter_articles

### Indexes created (20 total)

newsletter_subscribers: pkey, email_unique, confirmation_token_hash_unique, unsubscribe_token_hash_unique, confirmed_idx (partial), confirmation_token_hash_lookup_idx (partial), unsubscribe_token_hash_lookup_idx (partial), pending_expiry_idx (partial)

newsletter_subscribe_attempts: pkey, ip_attempted_idx

newsletter_articles: pkey, slug_unique, slug_lookup_idx (**REDUNDANT — drop in G1.3c or G1.3e**), published_idx (partial), gate_published_idx (partial), status_idx, scheduled_for_processing_idx (partial)

newsletter_article_authors: pkey (article_id, author_user_id), order_unique (article_id, author_order), author_idx

newsletter_article_versions: pkey, per_article_unique (article_id, version_number), article_created_idx, draft_pruning_idx (partial WHERE version_type='draft')

### RLS policies created (13)

- newsletter_subscribers: super_admin_all, service_role_all (NO public)
- newsletter_subscribe_attempts: super_admin_all, service_role_all (NO public)
- newsletter_articles: super_admin_all, service_role_all, public_read (anon+auth, WHERE status='published' AND archived_at IS NULL AND gate='public')
- newsletter_article_authors: super_admin_all, service_role_all, public_read (joined to publicly-readable articles)
- newsletter_article_versions: super_admin_all, service_role_all (NO public — version history is authoring-internal)

All §82-clean with explicit TO clauses.

### Action types added to `super_admin_action_types` (10)

All `category='content_authoring'`, `tier=NULL`, `requires_mfa=false`, `requires_justification=true`, `is_mutation=true`, `denylist_during_impersonation=true`:

- `newsletter_subscriber_imported_bulk`
- `newsletter_subscriber_unsubscribed_by_admin`
- `article_created`
- `article_saved`
- `article_version_committed`
- `article_scheduled`
- `article_published`
- `article_unpublished`
- `article_restored_from_version`
- `article_archived`

### Smoke-test audit rows remaining (5, immutable, all reason-prefixed)

`super_admin_audit_log` has `block_audit_log_mutations` trigger — these rows cannot be deleted. All correctly labeled with `'G1.X smoke test - ...'` prefix:

- newsletter_subscriber_imported_bulk (reason: "G1.2 smoke test of bulk import RPC after fresh deploy")
- article_created (reason: "G1.3b smoke test - initial create")
- article_version_committed (reason: "G1.3b smoke test - committing named revision")
- article_saved (reason: "G1.3b smoke test - explicit save with title edit")
- article_restored_from_version (reason: "G1.3b smoke test - restore to named revision")

### What was NOT shipped Session 92

- NO Storage buckets created. `newsletter-article-images` NOT YET CREATED — owed G1.5.
- NO Edge Functions deployed.
- NO cron jobs registered. The 3 scheduled jobs (`prune_newsletter_subscribe_attempts` at 6:15, `expire_pending_newsletter_confirmations` at 6:25, `prune_newsletter_draft_versions` at 6:35) NOT YET REGISTERED.
- `content_asset_refs` extension to 7-way parent NOT YET APPLIED — owed G1.4.
- NO public-facing subscriber RPCs (`subscribe_to_newsletter`, `confirm_newsletter_subscription`, `unsubscribe_from_newsletter`) — those land in G2 alongside email-dispatch Edge Function.

---

## Pre-migration discoveries Session 92 (next session inherits these)

### Discovery 1 — pgcrypto location

`pgcrypto` v1.3 is installed in `extensions` schema (NOT `public`). Confirmed via `SELECT extname, extnamespace::regnamespace FROM pg_extension WHERE extname = 'pgcrypto'`. Pattern locked for all SECDEF functions calling `digest()` or `gen_random_bytes()`:

```sql
SET search_path = public, extensions, pg_temp
```

Skipping `extensions` works by accident if extensions schema is in default search_path before SECDEF locks it — fragile pattern, do not adopt. Two precedent functions exist: `corporate_employee_choose_individual` (correct, uses extensions in path) and `peer_access_request_create` (risky, doesn't).

### Discovery 2 — pg_cron slot collision

Existing job `process_due_scheduled_assignments_daily` runs at `20 6 * * *`. The 6:20 slot is taken. Newsletter cron jobs rescheduled:

- `prune_newsletter_subscribe_attempts` → `15 6 * * *` (G2)
- `expire_pending_newsletter_confirmations` → `25 6 * * *` (G2)
- `prune_newsletter_draft_versions` → `35 6 * * *` (G1.3e)

Working sets are disjoint — assignments cron doesn't touch any `newsletter_*` table. No lock contention.

### Discovery 3 — super_admin_audit_log immutability

`super_admin_audit_log` has trigger `block_audit_log_mutations()` raising P0001 on any UPDATE or DELETE. Smoke-test audit rows persist permanently. Convention: prefix smoke-test reasons with `'G1.X smoke test - <detail>'` for self-identification.

### Discovery 4 — JWT context in MCP tests

`set_config('request.jwt.claims', ..., true)` is transaction-local and breaks across MCP execute_sql statements. Use `false` for session-local context. Multi-step smoke tests should run inside DO blocks to maintain JWT context through the test.

### Discovery 5 — assert_impersonation_allows denylist

`assert_impersonation_allows('permission_change')` is the right category for newsletter authoring RPCs. The denylist blocks impersonating super_admins from authoring articles under that identity — appropriate behavior.

### Discovery 6 — log_super_admin_action canonical signature

```sql
log_super_admin_action(
  p_target_user_id uuid,
  p_target_org_id uuid,
  p_action_type text,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_mode text DEFAULT NULL
) RETURNS uuid
```

Returns inserted audit row id. Handles scheduled-assignment-actor GUC bypass for cron context (not needed for newsletter authoring — all calls are caller-authenticated).

---

## Known gaps / follow-ups owed in next session

### Gap 1 — `commit_article_version` writes `before_value = NULL` on audit row

Inconsistent with Lovable v2 item 15 (always include full state with authors). Fix in G1.3c by adding a pre-snapshot state capture block at top of function before calling `_snapshot_article_version`. Pattern: load current article + authors via the same jsonb_agg pattern used in `upsert_article`, populate `v_before`, pass to `log_super_admin_action`.

### Gap 2 — `restore_article_version` writes `before_value = NULL` on audit row

Same fix pattern as Gap 1 — capture pre-restore article state including current authors before the UPDATE replaces them. The after_value can stay as-is since the version snapshot IS the after state.

### Gap 3 — `newsletter_articles_slug_lookup_idx` is REDUNDANT

The UNIQUE constraint `newsletter_articles_slug_unique` creates a unique btree index on slug. The additional non-unique `slug_lookup_idx` adds no query benefit. DROP it in G1.3c or G1.3e migration. Non-blocking.

### Gap 4 — `newsletter_articles_scheduled_consistency` CHECK edge case

The CHECK `(status='scheduled' AND scheduled_for IS NOT NULL AND scheduled_for > now()) OR status<>'scheduled'` fires on every UPDATE. If the publish cron lags AND a super-admin manually edits a stale-scheduled article, the CHECK blocks the edit (because scheduled_for is now in the past). Narrow edge case. Accepted for v1. If it surfaces in practice, relax to `scheduled_for IS NOT NULL` and let the cron processor handle the temporal check.

### Gap 5 — subscriber-to-user linking strategy unresolved

`get_article_for_reader` (G1.3d) needs to determine if the viewer is a confirmed subscriber. Current schema has `newsletter_subscribers.email` (unique) but no `linked_user_id` FK to `users`. Resolution options to lock in G1.3d:

- Option A: JOIN newsletter_subscribers to users via email match (`WHERE s.email = u.email`). Simple but breaks if user changes their account email post-subscription. Requires authenticated user have email matching subscription.
- Option B: Add `newsletter_subscribers.linked_user_id uuid REFERENCES users(id) NULL` column. Populated at confirm-time if the confirming user is authenticated, NULL otherwise (anon subscribers). Reader RPC checks via user_id when authenticated, falls back to email match when needed. Future-proof but adds complexity.

Recommend Option B. Migration would be additive on the existing `newsletter_subscribers` table.

---

## Decisions still locked from Session 92 open (next session inherits)

All from `lovable-review-group-g-approach-v2.md` in `/home/claude/internal-docs/`:

- Q7: 3 articles at launch, mixed gates, from LinkedIn via Paste-HTML
- Q8: defer comments to v2
- SSR: Vercel migration at Phase G3 (after G4/G5)
- Multi-author bylines in v1 (overrides scope §6)
- Paste-HTML sanitization allowlist locked (§3 Q2 from scope)
- Image rehosting via `convert-html-to-tiptap` Edge Function (G2/G4)
- Iframe allowlist: youtube.com/embed/*, youtube-nocookie.com/embed/*, player.vimeo.com/video/*
- TipTap toolbar feature set locked
- Audit before/after JSON discipline includes authors array always per item 15

---

## Phase G1 remaining work (in order, with migration names)

(C) `session93_newsletter_articles_state_transition_rpcs` (G1.3c)
- 5 new RPCs: schedule_article, cancel_scheduled_article, publish_article, unpublish_article, archive_article
- Fix Gap 1 (commit_article_version before_value)
- Fix Gap 2 (restore_article_version before_value)
- Fix Gap 3 (drop redundant slug_lookup_idx)
- All new RPCs follow before/after authors discipline per item 15

(D) `session93_newsletter_articles_read_rpcs` (G1.3d)
- 5 new RPCs: get_article_for_reader, preview_article_as_viewer_class, list_articles_for_archive, list_article_versions, get_article_version
- Resolves Gap 5 (subscriber-to-user linking) — recommend adding linked_user_id column
- get_article_for_reader signature: ONE param p_slug text (no p_viewer_user_id per Lovable v2 N3)

(E) `session93_newsletter_draft_pruning_function_and_cron` (G1.3e)
- prune_newsletter_draft_versions() function
- pg_cron job at `35 6 * * *` (consider shipping disabled — Cole monitors draft accumulation 2 weeks before enabling)

(F) `session93_content_asset_refs_extend_newsletter_article` (G1.4)
- ADD COLUMN newsletter_article_id to content_asset_refs
- DROP + recreate exactly_one_parent CHECK as 7-way
- Surgical edit to `_walk_block_config_for_asset_refs` walker per §72 pattern (diff against live, no full rewrite)

(G) `session93_newsletter_article_images_bucket` (G1.5)
- Public Storage bucket `newsletter-article-images` (10MB, image mime allowlist)
- 2 §82-clean policies

After G is clean, Phase G1 is DONE. Session 94 opens G2 (subscriber email flow + Resend audience sync + Cloudflare Turnstile + public subscribe/confirm/unsubscribe RPCs).

---

## Architecture-reference update owed

Architecture-reference.md has NOT been updated this session. Next session should:

1. Write the v96 entry covering Session 92 + Session 93 ship narratives together (or split into v96 Session 92 + v97 Session 93 close)
2. Evaluate §-numbered standing rule candidates from Session 92:
   - §129 candidate: SECDEF functions calling pgcrypto must include `extensions` in search_path
   - §130 candidate: Smoke-test audit rows are unavoidable + must be self-identifying via reason prefix
   - §131 candidate: Cron job slot collision discovery via cron.job query before scheduling new jobs

Each candidate is genuinely a recurring pattern, not a one-off, so all three likely warrant §-numbers. Cole picks at session close.

---

## Files in `/home/claude/internal-docs/` at Session 92 close

- `build-queue.md` — has Session 92 partial v99 entry at top, full Session 91 v98 below
- `architecture-reference.md` — UNCHANGED since Session 91 v95
- `session-91-to-92.md` — Session 91 close handoff (historical reference)
- `scope-group-fg-marketing-newsletter.md` — 500-line scope, Q1-Q6 locked Session 90
- `lovable-review-group-g-approach-v2.md` — 621-line post-Lovable-review approach doc Cole handed to Lovable Session 92 open

---

## Cole-owed fast-follows (non-blocking)

- og-image canonical PNG upload at `https://brainwiseenterprises.com/og-image-default.png` (Session 91)
- Vercel GitHub integration verification — confirm Lovable's commit-to-main triggers Vercel preview deploys cleanly. 10-minute check at Phase G3 start. If friction, fallback to Cloudflare Worker at $5/month.
