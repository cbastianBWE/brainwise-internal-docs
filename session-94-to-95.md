# BrainWise Session 94 to 95 Handoff

*Session 94 closed CLEAN. Phase G2 backend is DONE. Session 95 opens on the heavy-recon strategy for G4-G6 as one connected build. This is a normal close, not a partial.*

---

## Read first

Before doing anything else, query Supabase MCP to confirm what's actually shipped. Don't trust this document alone — confirm against the live DB:

```sql
-- Verify Session 94 migrations are present
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE name LIKE 'session94%'
ORDER BY version;
```

Expected output (exact, 6 rows in this order):

```
20260523184616  session94_newsletter_subscribe_attempt_pruning_function_and_cron
20260523184829  session94_newsletter_pending_confirmation_expiry_function_and_cron
20260523185102  session94_newsletter_pending_confirmation_expiry_rewrite_to_delete
20260523185716  session94_newsletter_subscribe_RPCs
20260523185749  session94_newsletter_rpcs_revoke_public
20260523190929  session94_newsletter_resend_audience_sync
```

If any are missing, STOP and investigate. Also confirm Session 92 + 93 migrations (11 total) are still present.

Verify Edge Function state:

```sql
-- via Supabase MCP list_edge_functions
-- Expected: sync-resend-audience v1 ACTIVE (NEW Session 94)
-- Expected: resend-webhook v3 ACTIVE (UPDATED Session 94 from v2)
-- All other Edge Functions unchanged from Session 93 close
```

---

## Phase G2 final state (post-Session-94)

### Tables (unchanged from Session 93)
- `newsletter_subscribers` (17 cols including `linked_user_id` from G1.3d Session 93)
- `newsletter_subscribe_attempts` (3 cols)
- `newsletter_articles` (23 cols)
- `newsletter_article_authors` (3 cols)
- `newsletter_article_versions` (12 cols)

All still empty in production.

### New RPCs (Session 94, 6 total)

**Subscribe / confirm / unsubscribe (public anon-callable):**
- `subscribe_to_newsletter(p_email text, p_turnstile_token text, p_source text)` — Q13.A anti-enumeration: generic success in all failure branches. Q7.A/B/C idempotency rules: pending → rotate + re-send; confirmed/unsubscribed/bounced/complained → silent no-op.
- `confirm_newsletter_subscription(p_token text)` — Q15 distinct success/failure responses (token-click already exposes oracle). Returns raw unsubscribe token on success so confirmation page can show manage-subscription URL.
- `unsubscribe_from_newsletter(p_token text)` — Q15 distinct responses, idempotent.

**Super-admin only:**
- `list_newsletter_subscribers(p_status_filter text, p_limit integer, p_offset integer)` — wrapper-shape return per §111: `{items, total_count, limit, offset, status_filter}`. Assert_super_admin gate.

**Private helper (PERFORM only, no anon/auth grants):**
- `_send_newsletter_confirmation_email_internal(p_subscriber_id uuid, p_raw_token text)` — wraps send-email Edge Function call via pg_net + Q9 Variant 2 confirmation email copy.
- `_sync_to_resend_audience_internal(p_subscriber_id uuid, p_action text)` — wraps sync-resend-audience Edge Function call; action='add'|'remove'; best-effort per Q27.A.

**Cron entry points (postgres-role only):**
- `prune_newsletter_subscribe_attempts()` — deletes >24h-old subscribe attempt rows. Cron `15 6 * * *` active.
- `expire_pending_newsletter_confirmations()` — Q14.A: DELETEs pending_confirmation rows >7d old (not flips to unsubscribed). Cron `25 6 * * *` active.

### New Edge Functions (Session 94)

- **NEW `sync-resend-audience` v1** — Class B per §107, verify_jwt:false, INTERNAL_FUNCTION_SECRET gate with constant-time safeEqual. POST `/contacts` for add (Resend Nov-2025 global contacts API — no audience_id required); PATCH `/contacts/<email>` `{unsubscribed:true}` for remove (Q25.A soft-unsubscribe). Writes resend_contact_id back to subscriber row on add success.
- **UPDATED `resend-webhook` v2→v3** — strictly-additive newsletter status sync block APPENDED after pre-existing email_logs work. When bounce or complaint event for confirmed/pending subscriber → flip newsletter_subscribers.status. Per Q28.B: does NOT fire Resend sync (Resend originated the event). All pre-existing Svix verification + email_logs logic preserved verbatim.

### Cron jobs at Session 94 close (3 newsletter)

- `prune_newsletter_subscribe_attempts_daily` at `15 6 * * *` — active, runs as postgres role
- `expire_pending_newsletter_confirmations_daily` at `25 6 * * *` — active, runs as postgres role
- `prune_newsletter_draft_versions` at `35 6 * * *` — DISABLED (Session 93 carryover; Cole enables after 2 weeks of authoring monitoring)

### Secrets state (post-Session-94)

**Vault secrets** (accessed via `SELECT decrypted_secret FROM vault.decrypted_secrets`):
- `INTERNAL_FUNCTION_SECRET` (pre-existing — used by every SECDEF RPC that calls a Class B Edge Function via pg_net)
- `CLOUDFLARE_TURNSTILE_SECRET` (NEW Session 94 — Cole added; 35 chars, prefix `0x4AAAAAAD`; used by subscribe_to_newsletter RPC posting to Cloudflare siteverify)

**Edge Function Secrets** (accessed via `Deno.env.get('SECRET_NAME')` inside Edge Functions):
- `RESEND_API_KEY` (pre-existing — used by send-email + sync-resend-audience Edge Functions)
- `INTERNAL_FUNCTION_SECRET` (pre-existing — every Class B Edge Function reads to validate inbound x-internal-secret header)

Per new §135 standing rule: both stores must be populated when adding a secret used on both sides.

### Smoke-test audit rows in production

Total approx 28 across G1 + G2 (no new Session 94 smoke-test audit rows added — G2 RPCs are anon-callable and don't log to super_admin_audit_log; they log to newsletter_subscribe_attempts which is acceptable rate-limit tracking, not super-admin audit). Per §130, no impact on audit log integrity.

---

## Phase G4-G6 scope (Session 95 work)

Per Cole's Session 94 close call: do G4 + G5 + G6 recon together as one heavy-recon pass, then draft Lovable cycles serially with full data-shape context. The three phases share data shapes, route patterns, component patterns, and gating logic — recon for G4 alone and rediscovering the same context for G5 and G6 is wasted effort.

### G4 — Super-admin newsletter article authoring UI

- `/super-admin/newsletter` landing — article list grouped by status (drafts, scheduled, published, archived), search by title, filter by category and gate (note: `newsletter_categories` table not built; `list_articles_for_archive` accepts `p_category_id` parameter but no table exists — flag as scope clarification: build categories table now or remove the dead parameter? Scope says categories were in G1 but they didn't ship; Cole's call needed at session open).
- `/super-admin/newsletter/<articleId>` editor with two creation paths: "Paste HTML" modal calling `convert_html_to_tiptap` Edge Function (NOT YET BUILT — confirm at G4 scope) returning canonical TipTap JSON; "Start from scratch" creates empty draft.
- Native TipTap editor with editorial extension set (bold, italic, link, headings H2/H3/H4, lists, blockquote, image upload via existing asset pipeline, code blocks, horizontal rule, embed for YouTube/Spotify). Brand-styled rendering.
- Auto-save to `auto_save_article` RPC every 30s while editing.
- Gate selector (radio: public / subscriber_aggregate / plan_tier). When plan_tier selected, plan-tier multiselect appears.
- Cover image picker via existing FileUploadField pattern (`refField="cover"`).
- SEO meta editor (collapsible: seo_title, seo_description, og_image, canonical_url).
- Publish action dialog ("Publish now" or "Schedule for...").

### G5 — Version history + diff viewer UI

- "Version history" tab in article editor. Renders chronologically reverse-ordered list of versions with type badge (auto-save draft, named revision, scheduled, published, restored-from), version_name if present, created_at, created_by.
- Each row has "View" and "Restore" buttons.
- Compare mode: select 2 versions → diff viewer modal opens side-by-side with toggles for inline-mode and whitespace-ignore. Diff computed on rendered Markdown (extracted from TipTap JSON), not raw JSON. Uses `diff` npm library + custom shadcn-styled component (not `react-diff-viewer` which is unmaintained).
- Restore action confirms with reason field, fires `restore_article_version` RPC, navigates back to editor with restored content loaded.

### G6 — Public reader UI

- `/newsletter` landing page — full archive index with category filter, search (client-side initially), reverse-chronological grid. Article cards: cover image, title, excerpt, author, date, category badge, read-time.
- `/newsletter/<slug>` individual article reader — editorial typography (reuse marketing-tokens.css patterns + extend), inline subscribe form, author bio block at footer, related articles section (3 most recent in same category). Comments EXCLUDED (Q8 deferred recommendation: NO for v1).
- Gated article preview UX: `subscriber_aggregate` and `plan_tier` articles show first 150 words for non-eligible viewers with fade-to-paywall + sign-up/upgrade CTA. Backend already does this via `get_article_for_reader` returning paywall_reason in the access_state='paywall' branch.
- Subscribe form on archive landing + every article page + footer. Form must embed Cloudflare Turnstile (site key `0x4AAAAAADVBROvQ5jLUUIxJ` — public, embed directly in client code).

### Critical implementation note: clean URLs from day one

URLs MUST be `brainwiseenterprises.com/newsletter/<slug>` from day one served by the SPA (NOT SSR'd). When G3 ships later, the URLs stay the same and only the rendering changes from SPA to SSR. **No URL-change debt.** Do NOT use any interim ugly Supabase URL.

### Recon scope at Session 95 open

Heavy upfront recon covering all three phases:

1. **`pg_proc` on all 24+ newsletter article RPCs** — signatures, return shapes, parameter contracts. Specifically: `auto_save_article`, `upsert_article`, `commit_article_version`, `restore_article_version`, `schedule_article`, `cancel_scheduled_article`, `publish_article`, `unpublish_article`, `archive_article`, `get_article_for_reader`, `preview_article_as_viewer_class`, `list_articles_for_archive`, `list_article_versions`, `get_article_version`. Most are in `get_file_contents` of Session 93 close docs but verify against live state via `pg_get_functiondef`.

2. **GitHub recon of existing patterns to mirror** — pull these files via raw GitHub URLs (read-only access only):
   - `src/pages/super-admin/ResourcesAuthoringList.tsx` (G4 list page pattern)
   - `src/components/super-admin/ResourceEditor.tsx` (G4 editor structure pattern)
   - `src/components/super-admin/ContentItemEditor.tsx` (G4 editor + TipTap pattern)
   - `src/components/lesson-blocks/*.tsx` (G4 TipTap editorial extension pattern)
   - `src/components/file-upload/FileUploadField.tsx` (G4 cover image picker pattern)
   - `src/pages/marketing/Podcast.tsx` (G6 paginated archive grid pattern from Session 91)
   - `src/components/marketing/MarketingButton.tsx`, `MarketingFooter.tsx`, `Eyebrow.tsx` (G6 reader typography + brand-token reuse)

3. **`information_schema.columns`** on newsletter_articles + newsletter_article_versions + newsletter_subscribers to refresh schema clarity for type generation.

4. **Existing `convert_html_to_tiptap` Edge Function** — NOT YET BUILT. Confirm scope at G4 open: build now (Class A custom auth — Cole's super-admin token verifies) or defer to a follow-up when Cole's article-publishing workflow needs it. Scope §G4 calls for both paste-HTML AND native authoring paths — if Cole only ever drafts natively, the paste path is dead weight.

5. **TipTap v3.23 extensions inventory** — confirm `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-text-style`, `@tiptap/extensions`, `@tiptap/pm` are still installed. Confirm Lovable editor uses identical version pinning between lesson_blocks and newsletter articles to avoid TipTap schema drift bugs.

### Lovable approval cycles likely Session 95

- **Q-Recon-1 (decide before G4 draft):** Should `newsletter_categories` table be built now (extending `list_articles_for_archive` to actually use the parameter) or should the dead `p_category_id` parameter be removed from the RPC? Or punt to G6 with no categorization in v1?
- **Q-Recon-2 (decide before G4 draft):** Does Cole need the paste-HTML authoring path in v1, or is native-TipTap-only sufficient? If paste-HTML is in scope, the `convert_html_to_tiptap` Edge Function ships as part of G4. If not, drop from scope.
- **Q-Recon-3 (decide before G6 draft):** Q7 launch content strategy — how many articles ship at v1 launch? Recommendation: 3-5 articles authored before public launch (some `public`, some `subscriber_aggregate`, ideally one `plan_tier` to verify gating end-to-end).
- **Q-Recon-4 (decide before G6 draft):** Q8 comments in v1 — recommended NO. Confirm Cole's decision so the reader UI ships without comment scaffolding.
- **Q-Recon-5 (decide during G5 draft):** Diff viewer side-by-side default vs inline default? Whitespace-ignore default on or off? These are small UX defaults but affect initial impression.

### Pre-Lovable recon owed at Session 95 open

- All 5 GitHub files above via raw URL with `curl -s` for line-bounded reads (large files like CompanyDashboard.tsx pattern — Resources/ContentItem editors are likely 100KB+ each).
- pg_get_functiondef on the four most-load-bearing RPCs: `get_article_for_reader`, `upsert_article`, `list_articles_for_archive`, `list_article_versions`.
- Single comprehensive Lovable approval packet covering Q-Recon-1 through Q-Recon-5 in one packet (heavy upfront cycle to avoid mid-build re-scoping).

---

## Standing operating discipline applies

- **§107** (Edge Function three-tier auth model): G4 may need Class A custom auth for `convert_html_to_tiptap` if shipped — Cole-token-verified, super-admin only.
- **§111** (RPC wrapper shape → TS interface): All new RPCs ship with TS interfaces matching wrapper shapes; never cast wrapper objects to bare arrays.
- **§116** (SECDEF RPC mediation for public-tier column-level access): `get_article_for_reader` already implements this; G6 frontend must always call the RPC, never query `newsletter_articles` directly.
- **§129** (pgcrypto search_path): not directly relevant Session 95 (no new pgcrypto-using RPCs expected) but stays locked.
- **§130** (smoke-test audit row labeling): all G4/G5 super-admin RPC smoke tests prefix reason with `'G<phase>.<step> smoke test - <detail>'`.
- **§132** (pre-migration schema recon): no new migrations expected Session 95 unless Q-Recon-1 picks the "build categories now" option or scope discovery surfaces a missing piece — apply discipline if it comes up.
- **§133** (TipTap asset_id canonical reference): G4 native upload must honor — every inline `<img>` carries `attrs.asset_id`; `src` derived at render time. G6 reader rendering must lookup asset_id → public URL at render.
- **§135** (Vault vs Edge Function Secrets): Not directly invoked Session 95 unless new secrets introduced.
- **Lovable Credit Conservation Protocol** — backend-first; diagnose before prescribe; recon-then-prompt discipline.
- **Plan-doc gate** on every Lovable cycle.

---

## Non-blocking fast-follows Cole owes

- **og-image canonical PNG upload** at `https://brainwiseenterprises.com/og-image-default.png` (Session 91 carryover; still owed)
- **Resend Audience setup discovered unnecessary post-Session-94 recon** — Resend's Nov 2025 global contacts overhaul replaced the audience-scoped API; if Cole previously set any placeholder for `RESEND_NEWSLETTER_AUDIENCE_ID`, harmless to leave or remove (sync-resend-audience Edge Function ignores it).
- **No new Cole-side prereqs Session 95** — Turnstile already provisioned and verified end-to-end.

---

## Carryover deferred items (updated post-Session-94)

**NEWLY DEFERRED Session 94:**
- **G3 SEO/AEO infrastructure** — deferred to post-G6 combined G3+RSS pass; routing infrastructure decision (Cloudflare nameserver migration vs Vercel migration vs build-time prerender with smaller scope) to be made once with full context after G4-G6 ship
- **G9 RSS feed Edge Function** — deferred to G3+RSS combined pass for same URL-routing reasons

**FORMALLY CLOSED Session 94:**
- **G7 podcast platform full scope** — replaced by Session 91 Anchor RSS architecture; original G7 (`podcast_episodes` tables + authoring UI + internal episode pages) will not ship

**Unchanged from Session 93:**
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
- Mentor Portal v2 MQ-1 through MQ-4
- `results_available` firing point wiring
- `coach_messages` notification type
- `platform_updates` notification type

---

## Files in `/home/claude/internal-docs/` at Session 94 close

- `build-queue.md` — v101 with Session 94 close ship narrative covering 14 numbered points
- `architecture-reference.md` — v97 covering Session 94 + locking §135
- `session-93-to-94.md` — Session 93 close handoff (historical reference)
- `session-94-to-95.md` — this file
- `scope-group-fg-marketing-newsletter.md` — 500-line scope, Q1-Q6 + Q7-Q8 locked
- `lovable-review-group-g-approach-v2.md` — v2 approach doc

---

## Session 95 opener checklist

1. `get_file_contents` on canonical docs from `cbastianBWE/brainwise-internal-docs`: `build-queue.md` (v101 top), `architecture-reference.md` (v97 top), `session-94-to-95.md` (this), `scope-group-fg-marketing-newsletter.md`. Save locally to `/home/claude/internal-docs/`.
2. Run the DB verification queries at top of this handoff. Confirm 6 Session 94 migrations present + all prior session migrations still present + Phase G1+G2 final state matches inventory above.
3. **Heavy recon pass** covering G4 + G5 + G6 as one connected build: pg_get_functiondef on the 14 newsletter article RPCs, raw-URL curl of the 7 pattern-source frontend files listed above, `information_schema.columns` refresh on the 5 newsletter tables.
4. Draft single comprehensive Lovable approval packet covering Q-Recon-1 through Q-Recon-5 in one packet. Wait for Cole sign-off.
5. Execute Lovable cycles serially (G4 → G5 → G6) with full data-shape clarity established upfront. Each cycle has its own plan-doc gate per discipline.
6. Close at end with build-queue v102 + architecture-reference v98 + session-95-to-96.md handoff.

