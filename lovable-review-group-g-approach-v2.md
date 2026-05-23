# Group G Newsletter Platform — Approach v2 (post-Lovable-review)

**Session 92 opening. Group F shipped Session 91. Group G starts now.**

Reference docs already in `cbastianBWE/brainwise-internal-docs`:
- `scope-group-fg-marketing-newsletter.md` (500 lines, six foundational decisions Q1-Q6 locked Session 90)
- `build-queue.md` v98 (Session 91 close)
- `architecture-reference.md` v95 (Session 91 close)
- `session-91-to-92.md` handoff

**This v2 incorporates Lovable's review feedback from the v1 draft.** Lovable raised 4 blocking items (resolved below), 7 spec-clarification items (resolved inline), 4 operational items (incorporated). The original v1 captured the core architecture; v2 hardens it.

Lovable's job on v2: confirm the resolutions hold up, surface any new issues, sign off. After sign-off, Claude executes Phase G1 backend in Supabase MCP.

---

## 1. Session 92 decisions resolved

### Q7 — Newsletter v1 launch content

**Three articles at launch, mixed gates, pulled from existing LinkedIn content via Paste-HTML authoring.**

- One `public` (most evergreen, most inbound-marketing-friendly piece)
- One `subscriber_aggregate` (more substantial, worth the email signup)
- One `plan_tier` (strongest piece, gated to paid subscribers)

Articles are republished from Cole's existing LinkedIn long-form posts via the Paste-HTML authoring path (Q2 Path X from scope §3). BrainWise becomes canonical; LinkedIn posts get edited at launch to add a "this article has moved to [BrainWise URL]" note at the top, functioning as funnels to the new site.

No fake "test article" seed content. If 3 real articles aren't ready by launch, ship the archive empty with a "Newsletter launches soon — subscribe to be notified" empty state. The empty state is itself a marketing surface.

Pagination defaults to 12 per page (matches Podcast page precedent from Session 91). At 3 articles this is moot for years.

### Q8 — Comments in v1

**Defer to v2.** The scope already recommended deferral in §3 Q8 and §6 non-goals. Confirmed.

No comments table, no moderation surface, no comment-related notification subsystem extension in v1. Reader page in Phase G6 ships without a comments section.

Engagement paths replacing comments: existing contact form, inline subscribe form on every article, and reply-to-newsletter via Resend inbound (set `mail.brainwiseenterprises.com` to accept replies to a `newsletter@` address routed to Cole's inbox — small operational lift in Phase G8).

v2 reopens when subscriber count crosses a threshold where moderation cost is absorbable.

### SSR architecture — Vercel migration

**Locked. Vercel migration at Phase G3, sequenced immediately before G6 (revised per Lovable item 13).**

Cole has a Vercel account set up already.

**Phase order revision (per Lovable item 13):** swap G3 to land immediately before G6 instead of after G2. New order: G1 → G2 → G4 → G5 → G3 → G6 → G7 → G8 → G9. Rationale: DNS cutover risk window stays closed during G4/G5 authoring UI work. If G3 ships before public reader exists, a failed cutover rolls back DNS with nothing lost. Vercel preview deploys still exercise rewrite rules during G4/G5 — just not in production.

Rationale unchanged:
- Lovable's Vite SPA build output is deployable to Vercel without modification
- `vercel.json` rewrites natively route `/newsletter/*`, `/podcast/*`, and select marketing paths to Supabase Edge Functions
- Two operational surfaces (Vercel + Supabase) vs three for Cloudflare Worker fronting
- Free tier (Hobby) covers projected traffic for years
- Vercel-Supabase routing is a well-documented pattern with reference implementations
- Build-time prerendering rejected — every publish requires a 60-180s rebuild, fragile

Phase G3 work:
1. Add `vercel.json` config with rewrites for newsletter, podcast, marketing routes
2. Connect GitHub repo to Vercel (Cole's account already created and authorized)
3. Set `VITE_SUPABASE_*` env vars in Vercel project settings (separate from Lovable's `.env` — easy to forget, flagged by Lovable item 14)
4. Verify Vercel preview deploys trigger correctly from main-branch commits (10-min check at Phase G3 start — if friction, fallback is Cloudflare Worker at $5/month)
5. Monitor Vercel Hobby tier 100-deploys/day soft limit during long authoring sessions (Lovable item 14 flag; not a blocker but watch)
6. Build `render-public-page` Edge Function (SSR for public articles + podcast episodes + marketing pages with dynamic data)
7. Build `generate-sitemap-xml` Edge Function
8. DNS swap from Lovable hosting to Vercel hosting
9. Verify Google indexes the archive within 7 days post-cutover
10. Verify AI search engines (ChatGPT, Perplexity) can crawl the site

### NEW decision — multi-author bylines in v1

**Build multi-author into v1.** Overrides the scope §6 non-goal "multi-author byline."

Rationale: Cole and Phil Dixon (both currently `brainwise_super_admin`) intend to author newsletter content together from launch. Deferring multi-author means a retroactive migration later that backfills author junction rows for every existing article. Building it into v1 costs maybe half a session of additional work distributed across G1 / G4 / G6, and avoids the retroactive cost entirely.

**Schema impact (Phase G1):**
- Replace single `articles.author_user_id uuid` column with junction table `newsletter_article_authors` (`article_id`, `author_user_id`, `author_order` for byline ordering)
- `UNIQUE (article_id, author_order)` to prevent ambiguous byline ordering (Lovable item 6)
- RLS on junction follows article RLS pattern (super_admin all)
- Article retrieval RPC joins junction and returns author array

**Editor impact (Phase G4):**
- "Authors" field with multi-select picker pulling list of `account_type = 'brainwise_super_admin'` users from `users`
- Drag-to-reorder for byline order
- Default: current user as sole author when new article created
- Adding co-authors via picker before publish

**Reader impact (Phase G6):**
- Byline component renders author array
- Standard "X and Y" / "X, Y, and Z" Oxford-comma formatting

**Editing rights:** Either listed author can edit (matches collaborative workflow; version history captures who made which change via existing `created_by_user_id` on `newsletter_article_versions`).

**Edge case — author with revoked super-admin status:** Byline still shows their name (authorship is historical), they can't edit (auth gate at the RPC denies). Article stays published. Explicit in the schema design — junction row persists even after `account_type` flip.

**Version history captures author roster at snapshot time (Lovable item 7):** `metadata_snapshot jsonb` includes `"authors": [{user_id, order}, ...]` array at the time the version row was created. Restoring a version restores body AND author roster as they were at that snapshot. Explicit in `upsert_article` / `commit_article_version` / `auto_save_article` RPC contracts.

**Author bios at launch:** Defer to v2. Ship v1 with just names. No `users.author_bio` column, no dedicated `author_profiles` table. Adding bios later doesn't require migration of existing articles — just a new column/table populated lazily as authors fill in their profiles. Reader byline component reads bio if present, falls back to name-only if absent.

**Audit logging for co-author changes (Lovable item 15):** Use existing `article_saved` action_type. `before_value` and `after_value` JSONs ALWAYS include the full author array, not just other changed fields. The author array participates in every state-diff captured in audit log, even on pure body edits. Adds small JSON-size overhead per audit row, worth it for auditor reconstruction.

### NEW subsection — Authoring capabilities (formatting, images, video, branding)

**Branding model — author writes content, BrainWise applies styling at render time.**

When pasted HTML enters the editor via Paste-HTML path, the sanitizer strips ALL `style`, `class`, and `id` attributes. The author's source-CSS choices don't survive. When the article renders to a reader, BrainWise brand tokens are applied via the TipTap renderer's component mappings (`<h2>` → `<h2 className="article-h2">` etc.). This guarantees every article looks consistent regardless of authoring origin (Claude, Notion, Google Docs, hand-coded HTML).

**Paste-HTML sanitization allowlist (locked in scope §3 Q2):**

| Allowed | Stripped |
| --- | --- |
| `p`, `h2`, `h3`, `h4` | `h1` (article title is at template level) |
| `ul`, `ol`, `li` | `script`, `style`, `iframe` (except video allowlist below) |
| `strong`, `em` | `object`, `embed`, `form`, `input` |
| `a` (href only) | All `on*` event handlers |
| `blockquote`, `code`, `pre`, `hr`, `br` | All `style`, `class`, `id` attributes |
| `img` (src/alt/width/height only) | Anything not in allowlist |
| `figure`, `figcaption` | |

**Image handling (gap surfaced during review, now resolved):**

Pasted HTML images point at external CDN URLs (Anthropic, Imgur, wherever Claude rendered them). External hotlinking is fragile.

At paste-time, the `convert-html-to-tiptap` Edge Function:
1. Sanitizes via dompurify against the allowlist above
2. Detects external `<img src>` URLs (any URL not matching BrainWise Storage domain)
3. Downloads bytes via fetch
4. Uploads to `newsletter-article-images` Storage bucket via service role
5. Rewrites `<img src>` to BrainWise-hosted URL
6. Returns canonical TipTap JSON + a report of: (a) sanitized tags stripped, (b) images re-hosted, (c) failed re-host attempts (broken external URL — image becomes placeholder, author can re-upload)

Native TipTap editor also supports image upload via toolbar button. Uses existing FileUploadField pattern. `@tiptap/extension-image` plus custom upload handler routing to `newsletter-article-images` bucket.

`newsletter-article-images` Storage bucket — public-tier per §84 (images are world-readable promotional content, no PII). §82-clean policies. Bytes served via CDN.

**Video handling (gap surfaced during review):**

Sanitizer extended with iframe allowlist for trusted video providers:
- `youtube.com/embed/*`
- `youtube-nocookie.com/embed/*`
- `player.vimeo.com/video/*`

Iframes from other domains stripped. Author can paste a YouTube embed and it survives.

Native editor toolbar gets an "Insert Embed" button. Prompts for YouTube/Vimeo URL, validates against allowlist patterns, renders TipTap node that maps to responsive iframe at render time.

Native uploaded video (hosting video files on BrainWise infrastructure) is out of scope for v1. Storage costs, transcoding, player infrastructure — different problem. YouTube/Vimeo embeds cover realistic v1 use case.

**Toolbar feature set (locked for v1):**

- Bold, italic, underline (underline off by default, opt-in)
- Strikethrough
- Inline code (`<code>`)
- Headings H2, H3, H4 (H1 is article title, enforced at template level)
- Bulleted list, numbered list
- Link (URL input modal, opens in new tab by default)
- Blockquote
- Image (file picker, uploads to Storage)
- Embed (YouTube/Vimeo URL, validates, renders responsive iframe)
- Code block (syntax highlighting via `lowlight` library that TipTap supports)
- Horizontal rule
- Undo/redo (TipTap built-in)

**Deferred to v2:**
- Tables (TipTap supports but real maintenance burden at editor UX level)
- Footnotes
- Custom callout blocks ("info box", "warning box")
- Drop caps, pull quotes
- Author-uploaded native video

TipTap dependencies already installed (v3.23 with `starter-kit`, `link`, `text-style`). Phase G4 adds `@tiptap/extension-image`, `@tiptap/extension-code-block-lowlight`, and a custom embed extension.

---

## 2. Phase G1 backend lift — what Claude builds first

Single Supabase MCP session, backend-first discipline per Cole's standing Lovable Credit Conservation Protocol. All SQL applies + verifies before Lovable sees the frontend prompt.

### G1.1 — Plan-tier helper function

Reusable beyond newsletter. Extracts the §79 inline pattern from `get_user_resources`.

```sql
CREATE OR REPLACE FUNCTION public.current_user_active_plan_tier()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT subscription_tier
  FROM public.users
  WHERE id = auth.uid()
    AND subscription_status = 'active'
    AND subscription_tier IN ('base', 'premium', 'individual')
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_user_active_plan_tier() TO authenticated, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.current_user_active_plan_tier() FROM public;
```

Returns:
- `'base'`, `'premium'`, or `'individual'` when user has active subscription at that tier
- `NULL` for anonymous users, users with no active subscription, or users with subscription_status != 'active'

Used by `get_article_for_reader` to evaluate `plan_tier` gate access. Reusable wherever plan-tier-gating surfaces in future features.

Migration name: `session92_current_user_active_plan_tier_helper`

### G1.2 — Subscriber subsystem (hardened per Lovable items 1, 2, 8, 9)

```sql
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (length(email) > 0 AND email ~* '^[^@]+@[^@]+\.[^@]+$'),
  status text NOT NULL CHECK (status IN ('pending_confirmation', 'confirmed', 'unsubscribed', 'bounced', 'complained')),
  -- HASHED tokens — raw tokens never stored, only emailed (per Lovable item 2)
  confirmation_token_hash text UNIQUE,
  confirmation_token_expires_at timestamptz,
  unsubscribe_token_hash text UNIQUE,  -- persistent for subscriber lifetime, set at confirm-time (per Lovable item 1)
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  source text,
  referrer_url text,
  -- Consent evidence for bulk-imported rows (per Lovable item 8)
  consent_evidence text,
  resend_contact_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX newsletter_subscribers_status_idx ON public.newsletter_subscribers (status) WHERE status = 'confirmed';
CREATE INDEX newsletter_subscribers_confirmation_token_hash_idx ON public.newsletter_subscribers (confirmation_token_hash) WHERE confirmation_token_hash IS NOT NULL;
CREATE INDEX newsletter_subscribers_unsubscribe_token_hash_idx ON public.newsletter_subscribers (unsubscribe_token_hash) WHERE unsubscribe_token_hash IS NOT NULL;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- super_admin full access
CREATE POLICY newsletter_subscribers_super_admin_all ON public.newsletter_subscribers
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type = 'brainwise_super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type = 'brainwise_super_admin'));

-- service_role bypass (Edge Functions handling subscribe/confirm/unsubscribe)
CREATE POLICY newsletter_subscribers_service_role_all ON public.newsletter_subscribers
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Rate limiting table for anon abuse mitigation (per Lovable item 9, lands G2):**

```sql
CREATE TABLE public.newsletter_subscribe_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX newsletter_subscribe_attempts_ip_attempted_idx ON public.newsletter_subscribe_attempts (ip_address, attempted_at DESC);
```

Pruning cron job at 6:25 AM deletes rows older than 24 hours. RPC enforces max 5 attempts per IP per hour. G2 also adds Cloudflare Turnstile token verification to `subscribe_to_newsletter`.

**Token handling pattern (hashed per Lovable item 2):**

```
1. RPC generates raw_token = encode(gen_random_bytes(32), 'base64url')
2. RPC computes token_hash = encode(digest(raw_token, 'sha256'), 'hex')
3. Row stores: confirmation_token_hash = token_hash (NOT raw_token)
4. Email body contains: raw_token (NOT token_hash)
5. At confirm-time, RPC computes hash of submitted token and compares to stored hash
6. After successful confirm, generates unsubscribe_token (same hash pattern) and stores hash
```

Raw token exists only in RPC local variable + outbound email body. Never in DB. Never in logs. Database leak doesn't grant state-change capability — leaker only has hashes.

**RPCs:**

`subscribe_to_newsletter(p_email text, p_source text, p_referrer text, p_ip_address inet)` — anon-callable. Checks rate limit (5/hr per IP). Inserts row with `pending_confirmation` status. Generates raw confirmation token, stores hash, 7-day expiry. Invokes `send-email` Edge Function with confirmation email containing raw token. Idempotency: re-subscribing pending email re-sends confirmation (new token); re-subscribing confirmed email returns success no-op; re-subscribing unsubscribed email triggers re-consent flow (status flips to `pending_confirmation`, new token, new email sent).

`confirm_newsletter_subscription(p_raw_token text)` — anon-callable. Computes hash from raw token, looks up row by hash, validates expiry. Flips status to `confirmed`, sets `confirmed_at`. Generates raw unsubscribe token, stores hash. Returns raw unsubscribe token to caller (for the confirmation success page — author can copy a manage-subscription URL). Syncs to Resend Audience via `resend-audiences-sync` Edge Function. Returns `{success: true, unsubscribe_url}`.

`unsubscribe_from_newsletter(p_raw_token text)` — anon-callable. Computes hash, looks up row, flips status to `unsubscribed`. Syncs to Resend. Returns boolean success. NO expiry on unsubscribe token — persistent for subscriber lifetime.

`list_newsletter_subscribers(p_status_filter text DEFAULT NULL, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)` — super_admin only. Returns subscriber rows for super-admin dashboard.

`import_newsletter_subscribers_bulk(p_subscribers jsonb, p_reason text)` — super_admin only. `p_subscribers` is array of `{email, consent_evidence, source}` objects (consent_evidence required per Lovable item 8 — e.g., "Mailchimp export 2026-04-15, double-opt-in list ID 7891"). Bulk inserts with `confirmed` status, generates unsubscribe tokens for each. Audit-logged.

**Cron jobs:**
- `expire_pending_newsletter_confirmations` daily at 6:25 AM, flips `pending_confirmation` rows older than 7 days to `unsubscribed` with note
- `prune_newsletter_subscribe_attempts` daily at 6:20 AM, deletes attempt rows older than 24 hours

**Audit action types added in this migration (per §99):**
- `newsletter_subscriber_imported_bulk`
- `newsletter_subscriber_unsubscribed_by_admin`

Migration name: `session92_newsletter_subscribers_table_and_rpcs`

### G1.3 — Articles + versioning + multi-author (hardened per Lovable items 3, 4, 5, 6, 7, 10, 11)

```sql
CREATE TABLE public.newsletter_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (length(slug) > 0 AND slug ~ '^[a-z0-9-]+$'),
  title text NOT NULL CHECK (length(title) > 0),
  -- excerpt is REQUIRED for gated articles (per Lovable item 10 — paywall hook)
  excerpt text,
  body_tiptap jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_html_rendered text,
  cover_asset_id uuid REFERENCES public.content_assets(id),
  gate text NOT NULL CHECK (gate IN ('public', 'subscriber_aggregate', 'plan_tier')) DEFAULT 'public',
  -- Use cardinality() over array_length() for readability (per Lovable item 5)
  allowed_plan_tiers text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (
      (gate = 'plan_tier' AND cardinality(allowed_plan_tiers) >= 1)
      OR (gate != 'plan_tier' AND cardinality(allowed_plan_tiers) = 0)
    ),
  -- Gated articles require excerpt for paywall preview (per Lovable item 10)
  CONSTRAINT excerpt_required_for_gated_articles CHECK (
    (gate = 'public') 
    OR (gate IN ('subscriber_aggregate', 'plan_tier') AND excerpt IS NOT NULL AND length(excerpt) >= 20)
  ),
  status text NOT NULL CHECK (status IN ('draft', 'scheduled', 'published', 'unpublished', 'archived')) DEFAULT 'draft',
  scheduled_for timestamptz,
  published_at timestamptz,
  source_type text NOT NULL CHECK (source_type IN ('html_import', 'native')) DEFAULT 'native',
  word_count integer,
  read_time_minutes integer,
  seo_title text,
  seo_description text,
  og_image_asset_id uuid REFERENCES public.content_assets(id),
  canonical_url text,
  -- is_current_published column REMOVED per Lovable item 4 (redundant with status)
  created_by_user_id uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX newsletter_articles_status_published_at_idx ON public.newsletter_articles (status, published_at DESC) WHERE archived_at IS NULL;
CREATE INDEX newsletter_articles_gate_idx ON public.newsletter_articles (gate) WHERE archived_at IS NULL AND status = 'published';
CREATE INDEX newsletter_articles_slug_idx ON public.newsletter_articles (slug);

-- Author junction with UNIQUE byline order per Lovable item 6
CREATE TABLE public.newsletter_article_authors (
  article_id uuid NOT NULL REFERENCES public.newsletter_articles(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id),
  author_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, author_user_id),
  UNIQUE (article_id, author_order)  -- prevents ambiguous byline ordering
);

CREATE INDEX newsletter_article_authors_author_idx ON public.newsletter_article_authors (author_user_id);

-- Version history (append-only)
CREATE TABLE public.newsletter_article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.newsletter_articles(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_type text NOT NULL CHECK (version_type IN ('draft', 'named_revision', 'scheduled', 'published', 'restored_from')),
  version_name text,
  body_tiptap jsonb NOT NULL,
  title_snapshot text NOT NULL,
  excerpt_snapshot text,
  -- metadata_snapshot MUST include authors array at snapshot time (per Lovable item 7)
  -- Shape: {"authors": [{"user_id": "...", "order": 0}, ...], "gate": "...", "allowed_plan_tiers": [...], ...}
  metadata_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  restored_from_version_id uuid REFERENCES public.newsletter_article_versions(id),
  created_by_user_id uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, version_number)
);

CREATE INDEX newsletter_article_versions_article_created_idx ON public.newsletter_article_versions (article_id, created_at DESC);
-- Index for retention pruning (per Lovable item 3)
CREATE INDEX newsletter_article_versions_draft_pruning_idx ON public.newsletter_article_versions (article_id, created_at DESC) WHERE version_type = 'draft';
```

**RLS:**
- `newsletter_articles`: super_admin all. Public SELECT where `gate = 'public' AND status = 'published' AND archived_at IS NULL` for anon + authenticated (floor RLS); RPC `get_article_for_reader` handles gated articles per §116.
- `newsletter_article_authors`: super_admin all. Anon + authenticated SELECT joined to `newsletter_articles` where parent article is publicly readable.
- `newsletter_article_versions`: super_admin all. No public read access (version history is authoring-internal).

**RPCs — split auto-save from explicit save (per Lovable item 3):**

`auto_save_article(p_article_id uuid, p_body_tiptap jsonb, p_metadata jsonb)` — super_admin. Auto-save only. Writes a `draft` version row. **Does NOT write audit row.** Cannot change gate / authors / status / scheduling — body + metadata only. Used by 30s editor auto-save cycle. Reason field not required.

`upsert_article(p_article_id uuid, p_title text, p_slug text, p_excerpt text, p_body_tiptap jsonb, p_gate text, p_allowed_plan_tiers text[], p_cover_asset_id uuid, p_og_image_asset_id uuid, p_seo_title text, p_seo_description text, p_canonical_url text, p_source_type text, p_author_user_ids uuid[], p_reason text)` — super_admin. Explicit save (Save Draft button, gate change, author roster change, metadata change). Writes article row, replaces author junction, creates `draft` version row, writes `article_saved` audit row. `p_reason` required ≥10 chars (stock reason "Author saved draft" acceptable per UX). 

**Audit row before/after JSON discipline (per Lovable item 15):** Both `before_value` and `after_value` ALWAYS include the full author array, gate, allowed_plan_tiers, status — not just changed fields. Adds small overhead per audit row but enables auditor to reconstruct author roster history from audit log alone.

`commit_article_version(p_article_id uuid, p_version_name text, p_reason text)` — super_admin. Creates `named_revision` version row from current article state. Snapshot includes authors array per Lovable item 7. Writes `article_version_committed` audit row.

`restore_article_version(p_version_id uuid, p_reason text)` — super_admin. Copies version body INTO article (including author roster from metadata_snapshot per Lovable item 7). Creates new `restored_from` version row pointing at source via `restored_from_version_id`. Replaces author junction rows from snapshot. Writes `article_restored_from_version` audit row.

`schedule_article(p_article_id uuid, p_publish_at timestamptz, p_reason text)` — super_admin. Sets status=`scheduled`, schedules background dispatch job. Writes `article_scheduled` audit row.

`cancel_scheduled_article(p_article_id uuid, p_reason text)` — super_admin. Flips status back to `draft`. Writes `article_unpublished` audit row (or new `article_schedule_cancelled` — call at G1 design time, leaning toward reusing `article_unpublished` for parsimony).

`publish_article(p_article_id uuid, p_reason text)` — super_admin. Sets status=`published`, `published_at = now()`. Writes `article_published` audit row. Triggers `dispatch-newsletter-article` Edge Function (background task per §107 pattern) for gated articles. Invalidates SSR cache for the slug.

`unpublish_article(p_article_id uuid, p_reason text)` — super_admin. Sets status=`unpublished`. Writes `article_unpublished` audit row. Invalidates SSR cache.

`archive_article(p_article_id uuid, p_reason text)` — super_admin. Sets `archived_at = now()`. Writes `article_archived` audit row. Invalidates SSR cache.

`get_article_for_reader(p_slug text, p_viewer_user_id uuid DEFAULT NULL)` — anon-callable SECDEF. Returns article data based on gate + viewer eligibility:
- For `public` articles: full body
- For `subscriber_aggregate` articles: full body if viewer is confirmed subscriber OR has any active paid plan; otherwise excerpt + paywall metadata
- For `plan_tier` articles: full body if viewer's `current_user_active_plan_tier()` is in `allowed_plan_tiers`; otherwise excerpt + paywall metadata

**Preview truncation (per Lovable item 10):** Excerpt is the paywall preview. No JSON-tree walker needed. Excerpt is required for gated articles via CHECK constraint, so it's guaranteed populated.

`preview_article_as_viewer_class(p_article_id uuid, p_viewer_class text)` — super_admin only (per Lovable item 11). `p_viewer_class IN ('anon','subscriber','base','premium','individual')`. Returns whatever `get_article_for_reader` would return for that viewer class without requiring super_admin to log out. Phase G4 wires this into a "Preview as..." dropdown in the editor.

`list_articles_for_archive(p_gate_filter text DEFAULT NULL, p_category_id uuid DEFAULT NULL, p_limit integer DEFAULT 12, p_offset integer DEFAULT 0)` — anon-callable. Returns published articles respecting gate (anon sees only `public`, authenticated subscribers see `public` + `subscriber_aggregate` previews, plan-tier holders see all).

`list_article_versions(p_article_id uuid)` — super_admin only. Version history for editor.

`get_article_version(p_version_id uuid)` — super_admin only. Single version body for diff viewer.

**Version retention cron (per Lovable item 3):**

`prune_newsletter_draft_versions()` cron job daily at 6:30 AM. Logic per article:
1. Identify all `draft` version rows older than 7 days
2. Within those, rank by `created_at DESC`
3. Keep the top 20 most-recent draft rows per article
4. Delete the rest

Pseudocode:
```sql
WITH ranked_drafts AS (
  SELECT id, article_id,
    ROW_NUMBER() OVER (PARTITION BY article_id ORDER BY created_at DESC) AS rn
  FROM newsletter_article_versions
  WHERE version_type = 'draft'
    AND created_at < now() - interval '7 days'
)
DELETE FROM newsletter_article_versions
WHERE id IN (SELECT id FROM ranked_drafts WHERE rn > 20);
```

Named revisions, scheduled, published, restored_from versions retained forever. Cron scheduled but Cole can disable for first 2 weeks of authoring to monitor accumulation patterns.

**Audit action types added in this migration (per §99, all 8 INSERTed in same migration as RPCs that emit them):**
- `article_created`
- `article_saved`  (only explicit saves — NOT auto-save per Lovable item 3)
- `article_version_committed`
- `article_scheduled`
- `article_published`
- `article_unpublished`
- `article_restored_from_version`
- `article_archived`

Migration name: `session92_newsletter_articles_tables_and_rpcs`

### G1.4 — Content asset refs extension

Extend `content_asset_refs` to a 7-way parent (current 6-way + `newsletter_article_id`). Following §71/§72 patterns:

```sql
ALTER TABLE public.content_asset_refs
  ADD COLUMN newsletter_article_id uuid REFERENCES public.newsletter_articles(id) ON DELETE CASCADE;

ALTER TABLE public.content_asset_refs
  DROP CONSTRAINT content_asset_refs_exactly_one_parent;

ALTER TABLE public.content_asset_refs
  ADD CONSTRAINT content_asset_refs_exactly_one_parent CHECK (
    (CASE WHEN certification_path_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN curriculum_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN module_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN content_item_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN resource_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN lesson_block_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN newsletter_article_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

CREATE INDEX content_asset_refs_newsletter_article_idx ON public.content_asset_refs (newsletter_article_id) WHERE newsletter_article_id IS NOT NULL;
```

Walker function `_walk_block_config_for_asset_refs` and B-2 rebind strategy from §72 extended with newsletter_article parent mode in a parallel migration. Same surgical-edit pattern locked in Session 85 — diff against live function definition, no full rewrite.

Migration name: `session92_content_asset_refs_extend_newsletter_article`

### G1.5 — Storage bucket for inline article images

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'newsletter-article-images',
  'newsletter-article-images',
  true,  -- public-tier per §84 (promotional content, world-readable)
  10485760,  -- 10MB ceiling
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- §82-clean RLS policies
CREATE POLICY newsletter_article_images_public_select ON storage.objects
  TO public
  USING (bucket_id = 'newsletter-article-images');

CREATE POLICY newsletter_article_images_service_role_all ON storage.objects
  TO service_role
  USING (bucket_id = 'newsletter-article-images')
  WITH CHECK (bucket_id = 'newsletter-article-images');
```

Used by:
- `convert-html-to-tiptap` Edge Function rehosting external images at paste-time
- Native TipTap editor image-upload toolbar button
- Reader page (CDN-served via Supabase Storage public URL)

Migration name: `session92_newsletter_article_images_bucket`

### G1.6 — `super_admin_action_types` row insertions

All 10 new action types INSERTed in the migrations that emit them (per §99). Listed here for clarity:

| action_type | Migration |
| --- | --- |
| `article_created` | G1.3 |
| `article_saved` | G1.3 (explicit saves only — auto-save does NOT emit) |
| `article_version_committed` | G1.3 |
| `article_scheduled` | G1.3 |
| `article_published` | G1.3 |
| `article_unpublished` | G1.3 |
| `article_restored_from_version` | G1.3 |
| `article_archived` | G1.3 |
| `newsletter_subscriber_imported_bulk` | G1.2 |
| `newsletter_subscriber_unsubscribed_by_admin` | G1.2 |

Per §99, the `super_admin_action_types` table CHECK constraint also needs the new values added — `manual_completion_control_action_types`-style INSERT pattern from Session 83.

### G1.7 — Categories (deferred to G2 or G4 — not blocking G1)

`newsletter_categories` + `newsletter_article_categories` junction tables. Sketched in scope §4 but not load-bearing for v1 launch since 3 articles don't need taxonomy. Can ship empty or with one "General" category seeded. Phase G4 article editor can include a category multi-select once tables land. Deferred to Phase G2 (subscriber subsystem) or Phase G4 (authoring UI) — Cole's call on sequencing.

---

## 3. Phases G2-G9 sequencing (revised order per Lovable item 13)

| Phase | Scope | Session estimate |
| --- | --- | --- |
| G1 | Backend lift: helper + subscribers + articles + versioning + asset refs extension + image bucket + audit types | Session 92 (this session) |
| G2 | Subscriber email flow: confirmation template, `resend-audiences-sync` Edge Function, double opt-in end-to-end, Cloudflare Turnstile integration per Lovable item 9 | Session 93 |
| G4 | Authoring UI: article editor (paste-HTML + native TipTap paths), category multi-select, gate selector, plan-tier picker, cover image, SEO meta, scheduled publish, multi-author picker, image upload, embed toolbar, preview-as-viewer-class dropdown | Session 94 |
| G5 | Version history UI: timeline view, diff viewer (Markdown-level diff via `diff` npm library), restore action | Session 95 |
| **G3** | **SSR infrastructure: Vercel migration, `vercel.json` rewrites, `render-public-page` Edge Function, `generate-sitemap-xml` Edge Function, DNS swap** (moved per Lovable item 13) | **Session 96** |
| G6 | Public reader: `/newsletter` archive landing, `/newsletter/<slug>` article reader, paywall preview rendering (renders article excerpt as paywall hook), multi-author byline component, related articles | Session 96-97 |
| G7 | Podcast subsystem: `podcast_episodes` + `podcast_episode_versions` tables, authoring UI, public reader. Migration of Phase F3 content-data-file episodes into DB. | Session 97 |
| G8 | Dispatch infrastructure: `dispatch-newsletter-article` Edge Function (background task), Resend Audiences sync, bounce/complaint webhook extension, post-publish dispatch UI, reply-to-newsletter inbound handling | Session 97-98 |
| G9 | Polish + launch readiness: empty states, loading skeletons, cover image dominant-color + cascade (reuse §43/§50/§108/§112), RSS feed at `/newsletter/feed.xml`, a11y baseline, mobile rendering, launch checklist | Session 98 |

5-6 sessions total. Multi-author work distributes across G1 (schema), G4 (editor picker), G6 (reader byline).

---

## 4. What Lovable should verify on v2

Specifically the changes from v1 (the schema and RPC shape changed materially):

1. **Token hashing implementation** — confirm the digest+compare pattern is correct, no timing-attack hole, the raw token never appears anywhere persistent.
2. **Auto-save split** — confirm `auto_save_article` vs `upsert_article` separation is clean, no accidental audit emissions on auto-save, no way for auto-save to mutate gate/authors/status.
3. **Version retention pruning logic** — confirm the ROW_NUMBER OVER PARTITION pattern keeps exactly 20 most-recent drafts per article; confirm cron timing 6:30 AM doesn't collide with other jobs.
4. **Excerpt required for gated articles** — confirm the CHECK constraint shape, and the editor UX clearly indicates excerpt is required when gate is non-public (don't silently fail at save).
5. **preview_article_as_viewer_class** — confirm the RPC simulates viewer state correctly without actually modifying anything.
6. **Author roster in version snapshots** — confirm `metadata_snapshot` captures authors at snapshot time, restore brings back author roster from snapshot.
7. **Image rehosting flow** — confirm the `convert-html-to-tiptap` Edge Function handles broken external URLs gracefully (placeholder, not fail).
8. **Iframe allowlist for video embeds** — confirm the dompurify configuration allows specific YouTube/Vimeo embed patterns without opening general iframe injection.
9. **`is_current_published` column dropped** — confirm no remaining queries assume the column exists.
10. **Phase G3 timing swap** — confirm the revised order (G2 → G4 → G5 → G3 → G6) doesn't break any dependency.
11. **Rate-limiting RPC abuse prevention** — confirm 5/hr/IP is the right threshold, confirm Cloudflare Turnstile integration is straightforward in G2.
12. **Audit before/after JSON discipline** — confirm always-include-author-array doesn't bloat audit log row size unacceptably.

If Lovable signs off on v2, Claude executes G1 migrations in Supabase MCP — five migrations (G1.1 through G1.5), each applied + verified independently before the next runs. Then drafts the G2 frontend prompt for subscriber subsystem.

---

## 5. Standing rules applied

All standing rules §61-§128 from `architecture-reference.md` v95 apply. Specifically relevant to Group G:

- **§43** archive cascade pattern (extend for newsletter article archive)
- **§50** content_asset_refs walker
- **§71** asset cascade walker pattern (extend to 7-way parent)
- **§72** B-2 rebind strategy
- **§79** plan-tier-checking pattern (extract to `current_user_active_plan_tier()` helper)
- **§82** RLS TO-role discipline (every new policy specifies TO-clause explicitly)
- **§84** public-tier vs private-tier classification (newsletter article images public-tier; SSR HTML cache public-tier; subscriber list private-tier)
- **§99** action_type whitelist (every new auditable action INSERTed in same migration as the RPC that emits it)
- **§107** server-side email-sender pattern (`send-email` Edge Function with `INTERNAL_FUNCTION_SECRET`)
- **§108** private-content-bucket storage-policy floor
- **§111** RPC wrapper-shape type discipline (every wrapper-returning RPC gets a TypeScript interface, no `as unknown as Array<...>`)
- **§112** dominant-color pipeline (cover image archive cards reuse)
- **§116** SECDEF RPC mediation pattern for column-level access on public-tier resources (article reader mediation via `get_article_for_reader`)
- **§125** DROP-then-CREATE for additive PL/pgSQL params (relevant if `current_user_active_plan_tier()` ever needs additive params; not for v1)

No new §-numbered standing rules expected from G1 backend.

---

## Document metadata

Author: Claude (Session 92 opener)
Subject: Group G newsletter platform — approach v2, post-Lovable-review
Date: Session 92, May 23, 2026
Status: Draft for Lovable v2 review pass. After sign-off, Claude executes Phase G1 backend in Supabase MCP — 5 sequential migrations with verification between each.

Changes from v1:
- Q7 unchanged
- Q8 unchanged
- SSR sequencing revised: G3 moves to land immediately before G6 (Lovable item 13)
- Multi-author authors in version snapshots specified (Lovable item 7)
- Authoring capabilities section added (formatting, images, video, branding)
- G1.2 subscribers table: confirmation_token_hash + unsubscribe_token_hash + consent_evidence + rate-limit attempts table (Lovable items 1, 2, 8, 9)
- G1.3 articles: dropped is_current_published, cardinality() over array_length(), UNIQUE author_order, excerpt required for gated, split auto_save_article from upsert_article, prune cron, preview_article_as_viewer_class RPC, audit before/after author discipline (Lovable items 3, 4, 5, 6, 10, 11, 15)
- G1.5 newsletter-article-images Storage bucket added
- Categories deferred more explicitly
- Verification checklist rewritten around v2-specific changes
