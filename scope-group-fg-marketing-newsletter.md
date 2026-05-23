# BrainWise Group F + Group G Scope Document

**Marketing Pages + Newsletter Platform + SEO/AEO Infrastructure**

Version 1.0 — Session 90 scoping
May 23, 2026

---

## 1. Executive Summary

This scope covers two related but distinct workstreams:

**Group F (Marketing Pages)** is a small one-session build covering: (1) a public podcast page, (2) renaming the EVOLVE marketing page to "Our Approach" with URL redirect, and (3) a systematic instrument-label audit pass to correct drift between the canonical `public.instruments` table and the labels shown across the marketing/product surfaces. Estimated 1 session.

**Group G (Newsletter Platform)** is a multi-session foundational build covering an authored, versioned, gated, SEO-optimized, email-dispatched newsletter system with: (a) super-admin authoring via both paste-HTML-and-convert AND native rich-text composition paths, (b) Google Docs-equivalent version history with diff viewer + restore-to-any-version, (c) three-state per-article gating (public / subscriber-aggregate / plan-tier), (d) double-opt-in email subscriber list with Resend dispatch on publish, (e) full SEO/AEO infrastructure including per-page meta tags, JSON-LD structured data, sitemap.xml, and server-side rendering of public article pages. Estimated 5-6 sessions phased like Group C was.

The two groups share a single scope doc because they share infrastructure: both need the SEO/AEO foundation (Group F's marketing pages benefit from it too; Group G requires it), both touch the marketing-side React component library, and both need to ship before the platform can credibly compete on inbound marketing.

Six foundational decisions are locked below: (Q1) Group F+G sequencing, (Q2) newsletter authoring input model, (Q3) versioning depth, (Q4) gating model, (Q5) subscriber delivery model, (Q6) SEO/AEO architecture. Two additional decisions are deferred to session-open: (Q7) Newsletter v1 launch content strategy, (Q8) Comments-on-articles in v1.

---

## 2. Context and Existing State

### 2.1 What exists today

**Marketing pages:** 11 public routes built (`/`, `/services`, `/evolve`, `/contact`, `/products`, `/pricing`, plus 5 legal pages) at `src/pages/marketing/`. Component-driven via `src/components/marketing/` (MarketingNav, MarketingFooter, MarketingButton, Eyebrow, DotArc, BriefingModal, MarketingTile, LegalPageLayout). Content-driven via `src/content/marketing/` (evolveContent, productsContent, servicesContent, coachPricingContent). Marketing brand tokens in `src/styles/marketing-tokens.css` (7.8KB).

**Resend email infrastructure:** Heavily used. 14 distinct `email_type` values logged in last 30 days totaling 76 sends. `send-email` Edge Function is the canonical dispatch path, gated by `INTERNAL_FUNCTION_SECRET` from Supabase Vault per §107. `email_logs` table tracks send/bounce/complaint per message via Resend webhooks. Domain `mail.brainwiseenterprises.com` configured.

**Subscription tier infrastructure:** `subscription_plans` table holds 5 active plans across 3 tier values (`base`, `premium`, `individual`). User state in `users.subscription_tier` (text) + `users.subscription_status` (text). Plan-tier-gating helper functions: NONE exist at the SQL level yet — the Resources subsystem (per architecture-reference v72 §79) does plan-tier-checking inline in `get_user_resources` but no reusable helper has been extracted. Newsletter will need `current_user_active_plan_tier()` helper added.

**Rich-text editor infrastructure:** TipTap v3.23 installed (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-text-style`, `@tiptap/extensions`, `@tiptap/pm`). Already used for `lesson_blocks` authoring. Reusable for newsletter native authoring.

**HTML processing:** `dompurify` v3.4.5 installed — reusable for sanitizing pasted HTML in the HTML-import path. `react-markdown` v10.1.0 installed.

**Audit infrastructure:** `super_admin_audit_log` + `super_admin_action_types` lookup table with 79 action types including 50 content_authoring actions. Newsletter authoring adds ~15 new action_types following the established §99 pattern.

**Storage infrastructure:** Public-tier (`lesson-thumbnails`) and private-tier bucket patterns established per §84. Newsletter article cover images will use the public-tier pattern. Pre-rendered article HTML caching can use Storage CDN per Supabase docs cache-first pattern.

**Asset cascade infrastructure:** `content_asset_refs` table + walker pattern + B-2 rebind strategy per §71/§72 — newsletter article cover images and inline images integrate via the same 6-way parent (will become 7-way: add `newsletter_article_id`).

### 2.2 What does NOT exist

**SEO/AEO infrastructure:** Zero per-page meta tags. All meta in `index.html` is identical for every route. No `react-helmet-async` or equivalent. `twitter:site` is `@Lovable` (Lovable template leftover, wrong attribution). No `sitemap.xml`. No `robots.txt` visible. No JSON-LD structured data anywhere. No `llms.txt`. No server-side rendering — pure Vite SPA via `vite.config.ts` with only `react()` and `componentTagger()` plugins.

**Newsletter platform:** Nothing. No tables (`articles`, `article_versions`, `article_gates`, `newsletter_subscribers`, etc. all greenfield). No authoring UI. No public reader UI. No subscribe form. No dispatch mechanism. No version control. No diff viewer. No SEO meta-tag generation.

**Podcast page:** Nothing. No `/podcast` route. No `pages/marketing/Podcast.tsx`. No content data file. No episode list infrastructure.

**Centralized instrument label constants:** Nothing. `INSTRUMENTS` constants are file-local (e.g., `src/pages/coach/CoachClients.tsx:31`). No `src/lib/instruments.ts`. This is why label drift exists — see §3.3.

**Plan-tier helper:** No `current_user_active_plan_tier()` or equivalent SQL helper. Plan-tier checking is duplicated inline across surfaces.

### 2.3 Why this work is foundational

The newsletter platform is the primary inbound marketing channel for a content-first product like BrainWise. Without SEO/AEO infrastructure, every article published is invisible to Google AI Overviews, ChatGPT, Perplexity, Gemini, and other AI search engines. Without subscriber dispatch, articles can't build an audience. Without version history, super admin can't safely iterate on articles. Without gating, paid-tier subscribers don't see exclusive content and the value of premium tiers degrades.

The marketing page work (Group F) is small but blocks credibility on a public-facing surface. EVOLVE→Our Approach is a positioning change Cole has been wanting to make. The instrument label audit pass corrects real drift between marketing copy and DB facts (HSS labeled as "Habit Strength Scale" with "6 items" in Home.tsx, but the DB row says "Habit Stabilization Scorecard" with 3 items — see §3.3).

---

## 3. Foundational Decisions (Q1–Q6 locked, Q7–Q8 deferred to session-open)

### Q1. Group F + Group G sequencing

**Decision: Group F first (1 session). Group G phased across 5-6 sessions starting immediately after.**

Group F is bounded: known routes to add, known content to edit, known label corrections. One session ships it cleanly.

Group G is foundational: schema design, RLS, RPCs, authoring UI, public reader, SEO infrastructure, dispatch infrastructure, version history, diff viewer. Bundling it with Group F invites Group F's small wins to be lost in Group G's scope.

Sequencing them strictly serially also means Group F's SEO/AEO infrastructure (added in Group F because the marketing pages need it too) is in place by the time Group G's article reader needs it, instead of having Group G also rebuild the infrastructure halfway through.

**Open question deferred to Session 91 open:** Whether Group F includes the SEO/AEO infrastructure (Path A) or whether the infrastructure is its own pre-Group-G session (Path B). Recommendation: Path A — bundle SEO infrastructure into Group F so the marketing pages get it on the same ship.

### Q2. Newsletter authoring input model

**Decision: Both paths supported per article. Author picks at article-create time.**

**Path X — Paste HTML and convert.** Author writes the article in another tool (e.g., Claude, Notion, Google Docs export, hand-coded HTML from a Stripe Press-style designer). Pastes the HTML body into a textarea. System sanitizes via `dompurify` against an allowlist of safe tags + attributes, then converts to a TipTap JSON document via a custom HTML→TipTap transformer. The TipTap document becomes the canonical content. Brand-token application happens at render time (the TipTap renderer maps HTML tags to brand-styled components: `<h2>` becomes `<h2 className="article-h2">`, etc.). The author can then continue editing the converted document in the native rich editor.

**Path Y — Author natively in TipTap.** Author writes the article from scratch in the existing TipTap editor infrastructure (same TipTap v3 already used for lesson_blocks but with a different toolbar/extension set tuned for editorial content rather than instructional blocks). Output is canonical TipTap JSON from the start.

**Rationale for both paths:** Cole's workflow varies article-to-article. Some long-form pieces are easier to draft in Claude (the LLM produces the body, Cole edits, the HTML is pasted in for final formatting). Other articles are quick takes drafted directly in the platform. Limiting to one path forces a workflow mismatch on the unsupported side.

**Storage model:** Both paths produce the same canonical shape — TipTap JSON in `articles.body_tiptap jsonb`. The `articles.source_type` text column records `'html_import'` or `'native'` for analytics + audit but does not affect rendering.

**Sanitization rule (locked):** HTML import goes through `dompurify` with a strict allowlist before conversion. Tags allowed: `p`, `h2`, `h3`, `h4`, `ul`, `ol`, `li`, `strong`, `em`, `a` (with `href` only), `blockquote`, `img` (with `src`, `alt`, `width`, `height` only), `figure`, `figcaption`, `code`, `pre`, `hr`, `br`. Tags stripped: `script`, `style`, `iframe`, `object`, `embed`, `form`, `input`, anything else not in the allowlist. Attributes stripped: all `on*` event handlers, `style` (we control styling via brand tokens, not author CSS), all `class` and `id` attributes. The Edge Function performing the conversion logs the diff between input and sanitized output to `super_admin_audit_log` so any aggressive stripping is reviewable.

### Q3. Newsletter version history scope

**Decision: Full Google Docs equivalent — auto-save drafts + named published versions + draft/scheduled/published states + audit log of all state transitions + diff viewer + restore-to-any-prior-version.**

This puts BrainWise above Ghost (which has post history with browse + restore but no diff viewer) and well above Substack and Beehiiv (which have no exposed version history at all). The competitive recon confirms this is a differentiator — no major newsletter platform offers what Cole asked for.

**Storage model:** `article_versions` table is append-only. Every save (auto-save during editing + every named publish) creates a new row with full snapshot of the body + metadata. Garbage collection of auto-save drafts older than 30 days runs nightly. Named published versions are retained indefinitely.

**Version states (text enum CHECK):**
- `draft` — auto-save during editing, not yet committed as a named version
- `named_revision` — author manually saved a named revision (e.g., "First pass," "Editor revision," "Final pre-publish")
- `scheduled` — committed for publish at a future timestamp
- `published` — currently or previously the public version
- `restored_from` — explicit marker: this version was created via "Restore from version X"

**Diff viewer:** Uses the `diff` npm library to compute character-level diffs between any two `article_versions` rows. Renders via a shadcn-styled diff viewer component (custom-built rather than pulling `react-diff-viewer` which is unmaintained since 2020; the `diff` library does the work, our component does the rendering). Side-by-side mode is default; inline mode toggle available. Whitespace-ignore toggle. Compares the rendered text content (Markdown extracted from TipTap JSON), not raw JSON, since JSON diffs are unreadable.

**Restore action:** "Restore from this version" button on any prior version creates a new `article_versions` row tagged `restored_from` with the body of the chosen version, sets it as the live draft, and audit-logs `version_restored` with the source version id. The original version is NOT deleted or modified.

**Audit log:** Every state transition writes a `super_admin_audit_log` row: `article_created`, `article_saved` (auto-save, no justification required, no impersonation denylist), `article_version_committed` (named revision), `article_scheduled`, `article_published`, `article_unpublished`, `article_restored_from_version`, `article_archived`.

### Q4. Newsletter gating model

**Decision: Three states per article, mutually exclusive. Plus a separate "subscriber aggregate" gate that means "anyone who is either an email-list subscriber OR holds any paid plan tier."**

The three article-level gates:
- **`public`** — anyone can read. Indexable by search engines. Shows in `archive.xml` sitemap. No paywall. Treated as the default for SEO/AEO content (e.g., evergreen explainer pieces meant to attract inbound traffic).
- **`subscriber_aggregate`** — visible to authenticated users who are either (a) email-list subscribers (`newsletter_subscribers.status = 'confirmed'`) OR (b) hold any paid plan tier (`users.subscription_tier IN ('base', 'premium')` AND `users.subscription_status = 'active'`). Anonymous visitors see a paywall preview (first ~150 words) + sign-up prompt. Half-indexable: the preview is indexable, the full body is not exposed to non-subscribers. The article reader returns the preview to anonymous SSR requests.
- **`plan_tier`** — visible only to specific plan tiers. The article carries an `allowed_plan_tiers text[]` field with one or more of `'base'`, `'premium'`. Anonymous visitors and email-only subscribers see paywall + upgrade prompt. Plan-tier mismatches see "Upgrade to read" prompt.

**Why not three independent boolean toggles?** A single `gate` enum is cleaner than `is_public + requires_subscriber + requires_plan_tier` because the states are mutually exclusive (an article isn't "both public AND plan-tier-gated"). The `allowed_plan_tiers` array is meaningful only when `gate = 'plan_tier'`.

**Block-level gating (Beehiiv-style):** Out of scope for v1. The Beehiiv recon found that block-level visibility (different blocks visible to different subscriber types within one article) is a sophisticated feature but adds substantial complexity. v1 ships article-level gating only; block-level is a v2 candidate if the demand materializes.

**Backend enforcement:** Article retrieval RPC (`get_article_for_reader`) enforces the gate server-side. The reader frontend NEVER trusts client-side gating decisions. The SSR Edge Function calls the same RPC.

### Q5. Newsletter subscriber delivery model

**Decision: Full subscriber list + double opt-in + unsubscribe + Resend dispatch on publish.**

**Subscriber table (`newsletter_subscribers`):**
- `id uuid PK`
- `email text NOT NULL UNIQUE` (case-folded, validated)
- `status text NOT NULL CHECK (status IN ('pending_confirmation', 'confirmed', 'unsubscribed', 'bounced', 'complained'))`
- `confirmation_token text NULL` (issued at signup, consumed at confirm-click)
- `confirmation_token_expires_at timestamptz NULL`
- `confirmed_at timestamptz NULL`
- `unsubscribed_at timestamptz NULL`
- `source text NULL` (e.g., `'homepage_form'`, `'article_inline_form'`, `'manual_import'`)
- `referrer_url text NULL`
- `resend_contact_id text NULL` (sync to Resend Audience after confirmation)
- `created_at timestamptz DEFAULT now()`

**Subscribe form flow:**
1. Anonymous visitor submits email on `/newsletter` archive page OR inline subscribe form on any article.
2. Frontend calls `subscribe_to_newsletter(p_email, p_source, p_referrer)` RPC.
3. RPC inserts row with `status = 'pending_confirmation'`, generates `confirmation_token` (32-byte URL-safe), expiry = 7 days.
4. RPC invokes `send-email` Edge Function (server-side, per §107) with confirmation email containing `https://brainwiseenterprises.com/newsletter/confirm?token=<token>`.
5. Subscriber clicks link, hits `/newsletter/confirm?token=<...>` route on the public site.
6. Route calls `confirm_newsletter_subscription(p_token)` RPC.
7. RPC validates token + expiry, sets `status = 'confirmed'`, `confirmed_at = now()`, sync to Resend Audience via `resend-audiences-sync` Edge Function (new, Class B internal-secret auth).
8. User sees confirmation page.

**Unsubscribe flow:**
1. Every dispatched newsletter email contains both standard headers (`List-Unsubscribe: <https://...>, <mailto:...>`, `List-Unsubscribe-Post: List-Unsubscribe=One-Click`) AND a visible "Unsubscribe" link in the email footer.
2. One-click header path: Resend handles it automatically when using Audiences.
3. Link path: hits `/newsletter/unsubscribe?token=<token>` route on the public site.
4. Route calls `unsubscribe_from_newsletter(p_token)` RPC.
5. RPC sets `status = 'unsubscribed'`, `unsubscribed_at = now()`, sync to Resend.

**Dispatch on publish:**
1. Super admin publishes an article.
2. Article gate determines audience: `public` → no auto-dispatch (article appears on site only). `subscriber_aggregate` → dispatch to all confirmed subscribers. `plan_tier` → dispatch only to subscribers whose linked `users` row has `subscription_tier` matching `allowed_plan_tiers`.
3. Dispatch is a background task per Supabase Edge Functions `EdgeRuntime.waitUntil` pattern — publish action returns immediately, dispatch runs in background.
4. Each recipient gets a personalized email with React Email template rendering the article body + footer with unsubscribe link.
5. Dispatch logs to `email_logs` with `email_type = 'newsletter_<gate>_<article_slug>'`.
6. Bounces and complaints flow through existing Resend webhook → `email_logs` update path. Bounced subscribers get `newsletter_subscribers.status = 'bounced'` after 3 hard bounces; complained subscribers get `'complained'` immediately.

**Resend Audiences as canonical?** No. The canonical subscriber list is BrainWise DB (`newsletter_subscribers`). Resend Audience is mirror-only and kept in sync via an Edge Function called from the subscribe/confirm/unsubscribe RPCs. Rationale: gating logic ("is this user a subscriber?") happens during article read, requires DB lookup not API call, must be fast.

**Compliance:**
- Double opt-in mandatory (legal requirement in most jurisdictions; also improves deliverability).
- Unsubscribe must be one-click in modern email clients (Gmail/Yahoo bulk sender requirements 2024).
- Privacy Policy page (already exists at `/privacy`) needs a section update describing newsletter subscription, data retention, and unsubscribe process. Logged as a Group G2 follow-up; not strictly blocking.

### Q6. SEO/AEO architecture

**Decision: Server-side rendering for public article pages and newsletter archive index via a dedicated Edge Function. Per-page meta tags via `react-helmet-async` on all other routes. JSON-LD structured data + sitemap.xml + llms.txt.**

**The architectural split:**
- **Public-facing routes Google + AI crawlers will visit** (newsletter archive index, individual articles, podcast page, podcast episode pages, marketing pages): server-side rendered via Edge Function. Full HTML returned in first response. JS hydrates on top.
- **Authenticated routes** (dashboard, settings, my-results, etc.): no SSR needed. These should not be in any sitemap and ideally are `noindex,nofollow`.

**SSR Edge Function (`render-public-page`):**
- Receives URL path, looks up content from DB.
- Renders full HTML via Deno-compatible React SSR (e.g., `react-dom/server`).
- Returns response with full content + `<head>` meta tags + JSON-LD `<script type="application/ld+json">` blocks + `Cache-Control: public, max-age=60, stale-while-revalidate=3600`.
- Storage-CDN cache layer per the Supabase docs cache-first pattern: pre-rendered HTML keyed by `articles/<slug>.html` in a public `rendered-pages` bucket. Cache invalidated on publish/unpublish via Edge Function side effect.

**Reverse proxy / routing question:** Either (a) front-load the entire site behind the Edge Function (every request hits the function, function decides SSR vs SPA passthrough) or (b) configure Lovable's deployment to route specific paths to the Edge Function. **Open question for Session 91 open:** Lovable's Vite deployment may not support per-path routing to a Supabase Edge Function. If not, the fallback is to put a Cloudflare Worker in front for routing, OR migrate to Vercel/Netlify which both support edge functions natively. This is the largest unknown in the scope.

**`react-helmet-async`:** Standard SPA SEO library. Wraps every public page in `<HelmetProvider>`; each page declares its `<Helmet>` with `<title>`, `<meta>`, `<link rel="canonical">`. Works for any client-side rendered page after JS hydration; useless for AI crawlers that don't execute JS but acceptable for Google (which executes JS, slowly).

**JSON-LD structured data per page type:**
- Article (newsletter article): `Article` schema with `headline`, `description`, `datePublished`, `dateModified`, `image`, `author` (Person schema with `name`, `url`, `sameAs` for LinkedIn/Twitter), `publisher` (Organization schema — BrainWise), `mainEntityOfPage`.
- Podcast Episode: `PodcastEpisode` schema with `name`, `description`, `datePublished`, `duration`, `associatedMedia`, `partOfSeries` (PodcastSeries).
- Podcast Series: `PodcastSeries` schema with `name`, `description`, `webFeed`, `image`.
- Marketing pages: `WebPage` + `Organization` schemas.
- Author bio pages (post-launch): `Person` schema with `jobTitle`, `worksFor`, `sameAs`.

**Sitemap.xml:** Generated dynamically by an Edge Function `generate-sitemap-xml`. Includes all `public`-gated articles, all podcast episodes, all marketing pages. Excludes `subscriber_aggregate` and `plan_tier` articles (those are not for indexing). Cache-controlled with `Cache-Control: public, max-age=3600`.

**Robots.txt:** Static file at `/public/robots.txt` allowing all crawlers, pointing at `/sitemap.xml`. Disallows authenticated paths (`/dashboard`, `/settings`, `/coach`, `/super-admin`, `/admin`, `/mentor`, `/my-results`, `/learning`, `/notifications`).

**llms.txt:** Emerging standard (per AEO research). Static or dynamically generated file describing the site for LLM crawlers. Lists the major content surfaces, gives a 1-paragraph summary of the platform, links to key articles and the canonical instrument reference. Hosted at `/llms.txt`.

**Per-page meta tags (locked structure):**
- `<title>` — unique per page, format: `<Page Title> | BrainWise Enterprises`
- `<meta name="description">` — unique per page, 150-160 chars
- `<link rel="canonical">` — explicit canonical URL
- `<meta property="og:title">`, `og:description`, `og:image`, `og:type`, `og:url`, `og:site_name`
- `<meta name="twitter:card">` = `summary_large_image`
- `<meta name="twitter:site">` = `@BrainWiseEnt` (NOT `@Lovable` — the existing `index.html` has the Lovable template leftover; this fix is part of Group F)
- `<meta name="twitter:title">`, `twitter:description`, `twitter:image`

**Article-specific meta extensions:**
- `<meta property="article:published_time">`, `article:modified_time`, `article:author`, `article:section`, `article:tag`

**Performance:** Each SSR'd article should target <500ms TTFB. Storage-CDN cache hits target <100ms. The dispatcher Edge Function invalidates cache for an article's slug on publish/edit by deleting the cached HTML from the `rendered-pages` bucket; next visit re-renders and re-caches.

### Q7. Newsletter v1 launch content strategy (DEFERRED to Session 91 open)

Open question: how many articles ship with the v1 launch? Recommendation: 3-5 articles authored before public launch to populate the archive with non-empty content. Some `public`, some `subscriber_aggregate`, ideally one `plan_tier` to verify the gating flow end-to-end. Cole's call at session-open.

### Q8. Comments on articles in v1 (DEFERRED to Session 91 open)

Open question: do articles support reader comments in v1? Recommendation: NO for v1. Comments add significant moderation surface area (spam, harassment, content moderation policies), legal exposure (CAN-SPAM/CASL/GDPR retention rules for user-submitted content), and infrastructure (comment table, moderation queue, notification subsystem extension). Defer to v2. Cole's call at session-open.

---

## 4. Schema Sketch (Group G)

20 new tables/columns + 1 extended (`content_asset_refs`). NEW = does not exist today.

| Table | Status | Purpose |
| --- | --- | --- |
| `newsletter_articles` | NEW | Top-level article rows. Title, slug, body_tiptap, body_html_rendered (cached HTML), excerpt, cover_asset_id, gate enum, allowed_plan_tiers array, status enum (draft/scheduled/published/unpublished/archived), scheduled_for, published_at, source_type (html_import/native), word_count, read_time_minutes, seo_title, seo_description, og_image_asset_id, canonical_url, author_user_id, created_at, updated_at, archived_at. |
| `newsletter_article_versions` | NEW | Append-only version history. article_id FK, version_number, version_type (draft/named_revision/scheduled/published/restored_from), version_name, body_tiptap snapshot, metadata snapshot, restored_from_version_id NULL, created_by_user_id, created_at. |
| `newsletter_subscribers` | NEW | Email subscriber list (see §3 Q5). |
| `newsletter_dispatches` | NEW | One row per article-publish dispatch event. article_id FK, dispatched_at, total_recipients, total_sent, total_failed, dispatch_summary jsonb. |
| `newsletter_categories` | NEW | Tag/category taxonomy. slug, name, description, color, display_order, is_active. |
| `newsletter_article_categories` | NEW | Many-to-many junction. article_id + category_id. |
| `podcast_episodes` | NEW | Episode rows. slug, episode_number, season_number NULL, title, description, body_tiptap (show notes), cover_asset_id, audio_url (external — Spotify/Apple/RSS), audio_embed_html NULL, duration_seconds, published_at, status enum, transcript_text NULL, transcript_asset_id NULL, guest_names jsonb, related_article_ids jsonb. |
| `podcast_episode_versions` | NEW | Same versioning pattern as articles. |
| `content_asset_refs` | EXTENDS | Add `newsletter_article_id uuid NULL`, `podcast_episode_id uuid NULL`. Widen `exactly_one_parent` CHECK from 6-way to 8-way. Add partial indexes. Walker (§71) extended with `newsletter_article` and `podcast_episode` parent modes. |

**RLS pattern (locked):**
- All authoring tables: super_admin ALL via `assert_super_admin()`, no other writes.
- `newsletter_articles` SELECT: `gate = 'public' AND status = 'published' AND archived_at IS NULL` for anon + authenticated; super_admin sees all. `subscriber_aggregate` and `plan_tier` articles require RPC mediation (see below).
- `newsletter_subscribers`: super_admin ALL; no anon/authenticated direct read (subscriber existence is private). RPCs mediate all access.
- `podcast_episodes` SELECT: `status = 'published' AND archived_at IS NULL` for anon + authenticated; super_admin sees all.

**Critical RPC mediation:** Anonymous visitors visiting a `subscriber_aggregate` article URL should see a 150-word preview, not the full body. The reader path is:
- Public URL `/newsletter/<slug>` hits the SSR Edge Function.
- SSR Edge Function calls `get_article_for_reader(p_slug, p_viewer_user_id)`.
- RPC evaluates: article status, gate, viewer status (anon vs authenticated, plan tier, subscriber status).
- Returns full body if access granted; truncated preview + paywall message if not.
- SSR Edge Function renders accordingly.
- The RLS on `newsletter_articles` is therefore the FLOOR (`gate = 'public' AND published`); the RPC enforces the actual access logic for gated articles per the §116 pattern.

**14 new audit action types** (per §99 — every new auditable action MUST be added to `super_admin_action_types` in the same migration):
`article_created`, `article_saved`, `article_version_committed`, `article_scheduled`, `article_published`, `article_unpublished`, `article_restored_from_version`, `article_archived`, `article_gate_changed`, `newsletter_dispatch_queued`, `subscriber_unsubscribed_by_admin`, `subscriber_bulk_imported`, `podcast_episode_created`, `podcast_episode_updated`, `podcast_episode_published`, `podcast_episode_archived`.

---

## 5. Build Phases

### Group F (1 session, Session 91)

**Phase F1: SEO/AEO infrastructure foundation.** Install `react-helmet-async`. Wire `HelmetProvider` in main app. Add per-page `<Helmet>` blocks to all existing marketing pages (Home, Services, Products, Pricing, Contact, EVOLVE-becoming-Our-Approach, Privacy, Terms, Cookies, International Privacy). Fix the `index.html` `twitter:site` from `@Lovable` to `@BrainWiseEnt` (or the real BrainWise handle — confirm at session-open). Add `<link rel="canonical">` to each. Add Organization JSON-LD to homepage. Generate static `/public/robots.txt`. Generate static `/public/sitemap.xml` for marketing pages + legal pages (dynamic sitemap for newsletter/podcast comes in Group G). Generate static `/public/llms.txt`.

**Phase F2: EVOLVE → Our Approach rename.** Rename `src/pages/marketing/Evolve.tsx` → `OurApproach.tsx`. Rename `src/content/marketing/evolveContent.ts` → `ourApproachContent.ts`. Update import in `OurApproach.tsx`. Update `src/App.tsx` import + route (L22 import, L128 route path). Update `src/components/marketing/MarketingNav.tsx` L9 navLinks entry. Add redirect: `<Route path="/evolve" element={<Navigate to="/our-approach" replace />} />` so legacy `/evolve` links don't 404. Verify no other files reference `/evolve` or "EVOLVE" (recon confirmed: only MarketingNav + App.tsx + Evolve.tsx itself).

**Phase F3: Podcast page.** Create `src/pages/marketing/Podcast.tsx`. Create `src/content/marketing/podcastContent.ts` with seed episode data structure. Add MarketingNav entry. Add App.tsx route `/podcast` and (for individual episodes if shipping v1 with multi-episode support) `/podcast/:slug`. Visual structure: navy hero with podcast name + show description, multi-platform listen badges (Apple Podcasts, Spotify, YouTube, RSS feed URL), latest episode hero, archive grid (3 columns, reverse chronological). For v1 launch, podcast data lives in the content file; podcast_episodes table + super-admin authoring are in Group G Phase G7. Each episode card links to either an external player URL or an internal episode page (decision deferred to session-open: simpler v1 = external links, more sophisticated v1 = internal pages with embedded player + show notes + transcript stub).

**Phase F4: Instrument label audit pass.** Create `src/lib/instruments.ts` as the single source of truth. The file exports `INSTRUMENTS` array with `instrument_id`, `id` (uuid), `instrument_name` (verbatim from DB), `short_name`, `description`, `total_items`, plus helper functions `getInstrumentByCode(code)`, `getInstrumentLabel(code)`, `getInstrumentFullLabel(code)` (returns "Personal Threat Profile (PTP)" format). Then audit-and-correct these surfaces against the DB:

- `src/pages/marketing/Home.tsx` L19-22: "Personal Threat & Reward Profile" → "Personal Threat Profile"; "Neuroscience of AI Adoption" → "Neuroscience Adoption Index"; AIRSA item count "48 items" → "24 items"; "Habit Strength Scale" → "Habit Stabilization Scorecard"; HSS "6 items" → "3 items". Refactor to read from `INSTRUMENTS` constant rather than hardcode.
- `src/content/marketing/productsContent.ts`: AIRSA "48 specific AI-related skills" → "24 specific AI-related skills"; HSS "6-item check-in" → "3-item check-in". Refactor descriptions to reference `INSTRUMENTS` for short_name + full_name where labels are shown.
- `src/content/marketing/servicesContent.ts`: Inspect for any instrument count claims; spot-check from recon shows it's mostly long-form copy without counts, but a careful read pass is needed.
- `src/content/marketing/evolveContent.ts` → soon-to-be `ourApproachContent.ts`: Already mostly correct, but verify all four instrument labels match DB.
- `src/pages/Assessment.tsx` L14-24: Already uses two constant objects (INSTRUMENT_CODES + INSTRUMENT_NAMES) — these are the duplicated source that should be replaced by an import from `src/lib/instruments.ts`. Refactor.
- `src/pages/coach/CoachClients.tsx` L31: Local INSTRUMENTS constant should also be replaced by the import. Refactor.
- Add INST-002L (EPN — "Neuroscience Adoption Index — Executive Perspective") to the central constant. Audit Services.tsx and Assessment.tsx for inconsistent EPN labels ("Executive Perspective NAI variant" vs "Executive Perspective NAI" vs "Neuroscience Adoption Index — Executive Perspective").

**Phase F5: Audit verification.** After Phase F4 ships, run a sweep: grep the codebase for "PTP", "NAI", "AIRSA", "HSS", "EPN", and instrument names; flag any remaining hardcoded labels. Run claude.ai/chat or another smoke-test reading the four instrument-displaying surfaces side-by-side with `public.instruments` to confirm zero drift.

### Group G (5-6 sessions, Sessions 92-97 estimated)

**Phase G1: Newsletter schema + RLS + core RPCs.** All newsletter tables created, RLS policies applied per §82 discipline, indexes for common query paths (slug lookup, published-ordered-by-date, gate filter, subscriber email lookup). Seed `newsletter_categories` with launch categories (e.g., "Neuroscience", "AI Adoption", "Coaching", "Research", "Product Updates"). Core RPCs: `upsert_article`, `archive_article`, `commit_article_version`, `restore_article_version`, `publish_article`, `unpublish_article`, `schedule_article`, `cancel_scheduled_article`, `get_article_for_reader(p_slug, p_viewer_user_id)`, `list_articles_for_archive(p_filter)`, `list_article_versions(p_article_id)`. All authoring RPCs `assert_super_admin + content_authoring impersonation gate + reason ≥10 chars + log_super_admin_action`. Add 14 new action_types per §99. Verified via SQL impersonation testing.

**Phase G2: Newsletter subscriber subsystem.** `newsletter_subscribers` table + RLS + RPCs (`subscribe_to_newsletter`, `confirm_newsletter_subscription`, `unsubscribe_from_newsletter`, `import_subscribers_bulk`). Confirmation email HTML template (React Email-style). `resend-audiences-sync` Edge Function for two-way sync to Resend Audience. Cron job to expire pending confirmations > 7 days. Verify end-to-end: subscribe form submit → confirmation email arrives → click confirms → status flips → unsubscribe link works. Edge case: subscribing same email twice (should re-send confirmation if status still pending; reject if already confirmed; reactivate if previously unsubscribed and a re-subscribe consent is gathered).

**Phase G3: SEO/AEO infrastructure for dynamic content.** Build `render-public-page` Edge Function (SSR). Build `generate-sitemap-xml` Edge Function (dynamic). Configure routing (Cole's call: Cloudflare Worker fronting, Vercel migration, or Lovable-deployment-config — open question Q6 to resolve at this phase). Build cache-invalidation Edge Function called from `publish_article` / `unpublish_article` / `upsert_article` (on body change). Verify `/newsletter`, `/newsletter/<slug>`, `/podcast`, `/podcast/<slug>`, all marketing pages return full HTML + JSON-LD in initial response. Verify Google Search Console acceptance + GSC crawl. Verify a sample ChatGPT query "what is BrainWise" surfaces the site.

**Phase G4: Authoring UI — newsletter article editor.** `/super-admin/newsletter` landing — article list grouped by status (drafts, scheduled, published, archived), search by title, filter by category and gate. Newsletter article editor at `/super-admin/newsletter/<articleId>` (similar to existing ResourceEditor + ContentItemEditor patterns). Two creation paths: "Paste HTML" modal that accepts HTML body, calls a `convert_html_to_tiptap` Edge Function, returns canonical TipTap JSON, populates the editor. "Start from scratch" creates an empty draft. Native TipTap editor with editorial extension set (bold, italic, link, headings H2/H3/H4, lists, blockquote, image upload via existing asset pipeline, code blocks, horizontal rule, embed for YouTube/Spotify). Brand-styled rendering. Auto-save to `article_versions` as `draft` type every 30 seconds while editing. "Save revision" button creates a `named_revision` version. Gate selector (radio: public / subscriber_aggregate / plan_tier). When plan_tier selected, plan-tier multiselect appears. Cover image picker (uses existing FileUploadField with `refField="cover"`). SEO meta editor (collapsible section: seo_title, seo_description, og_image, canonical_url). Publish action: dialog with "Publish now" or "Schedule for..." options. After publish, "Send to subscribers" button appears for `subscriber_aggregate` and `plan_tier` articles (subscriber dispatch).

**Phase G5: Authoring UI — version history + diff viewer.** "Version history" tab in the article editor. Renders chronologically reverse-ordered list of versions with type badge (auto-save draft, named revision, scheduled, published, restored-from), version_name if present, created_at, created_by. Each row has "View" and "Restore" buttons. Compare mode: select 2 versions, click "Compare" → diff viewer modal opens side-by-side with toggles for inline-mode and whitespace-ignore. Diff is computed on rendered Markdown (extracted from TipTap JSON), not raw JSON. Restore action confirms with reason field, fires the restore RPC, navigates back to editor with the restored content loaded.

**Phase G6: Public reader UI.** `/newsletter` landing page — full archive index with category filter, search (client-side initially, server-side post-launch via Postgres FTS), reverse-chronological grid. Article cards: cover image, title, excerpt, author, date, category badge, read-time. `/newsletter/<slug>` individual article reader — editorial typography (reuse marketing-tokens.css patterns + extend), inline subscribe form, author bio block at footer, related articles section (3 most recent in same category), comments section EXCLUDED (deferred per Q8). Gated article preview UX: `subscriber_aggregate` and `plan_tier` articles show first 150 words for non-eligible viewers with a fade-to-paywall + sign-up/upgrade CTA. Subscribe form lives on archive landing + every article page + footer. The reader is what gets SSR'd by the Edge Function.

**Phase G7: Podcast schema + authoring + reader.** `podcast_episodes` + `podcast_episode_versions` tables + RLS + RPCs following the article pattern. Authoring UI at `/super-admin/podcast/<episodeId>` (similar to article editor but with audio_url + duration + season/episode_number fields, no gating because podcast is always public). Public reader at `/podcast/<slug>` with embedded player, show notes (TipTap body), transcript section, related episodes, related articles. Update sitemap generation to include podcast episodes. Migration to move Phase F3's content-data-file episodes into the database.

**Phase G8: Dispatch infrastructure.** `dispatch-newsletter-article` Edge Function (background task pattern). Triggered on article publish for gated articles. Loops `newsletter_subscribers` filtered by gate eligibility, sends each one a personalized email via `send-email`, logs to `email_logs`, updates `newsletter_dispatches` row with progress. Resend bounce/complaint webhooks already write to `email_logs` — extend the existing handler to update `newsletter_subscribers.status` to `'bounced'` after 3 hard bounces or `'complained'` immediately on first complaint. Frontend dispatch UI: post-publish dialog "Dispatch this article to N eligible subscribers?" with confirm; live progress indicator showing X of N sent. Dispatch retry button if any failures.

**Phase G9: Polish + launch readiness.** Empty states. Loading skeletons. Error boundaries. Cover image dominant-color extraction for archive cards (reuse §112 pipeline). Cover image cascade on article archive (reuse §43 / §50 / §108). RSS feed generation at `/newsletter/feed.xml` (Edge Function) so subscribers can also follow via RSS. Verify a11y baseline. Verify mobile rendering. Live launch checklist: publish 3-5 seed articles, confirm a test subscriber receives them, verify Google indexes the archive within 7 days, verify Perplexity/ChatGPT cite the homepage and at least one article on relevant queries.

---

## 6. Explicit Non-Goals (v1)

- **Block-level visibility within articles (Beehiiv-style).** Article-level gating only.
- **Comments on articles.** v2 candidate.
- **Reader-side article likes/bookmarks/notes.** v2 candidate.
- **Multi-author byline** — articles authored by super_admin only in v1. Author user is recorded for byline display but a multi-author taxonomy with author bio pages comes in v2.
- **Newsletter referral program** — beehiiv-style "share to earn" subscriber growth. Out of scope.
- **Boost/ad network monetization.** Out of scope.
- **Reader translation (multi-language content).** Out of scope.
- **Server-side full-text search across articles.** v1 uses client-side filter on the archive page; Postgres FTS or Algolia integration is v2.
- **AI-assisted article writing in the authoring editor.** v2 candidate; existing `ai-authoring-chat` and `draft-text` Edge Functions could be repurposed but the editorial voice requirements need a dedicated design pass.
- **Cohort-style article delivery** (article 1 on day 1, article 2 on day 7, etc.).
- **A/B testing on subject lines or content.**
- **Archive page pagination** — v1 shows all published articles on one page (lazy-load images for performance). Pagination + infinite scroll comes when article count > 50.
- **Podcast hosting.** Audio files live on Spotify/Apple/external. BrainWise hosts only show notes + transcript metadata.

---

## 7. Build Queue Items Affected

**Closed by Groups F + G:**
- "Marketing page: podcast page" (informal, in product backlog)
- "Marketing page: rename EVOLVE to Our Approach" (informal)
- "Instrument label audit pass" (informal, surfaced during recon)
- "Newsletter platform" (informal, product backlog)
- "SEO/AEO infrastructure baseline" (informal, surfaced during recon)
- "Centralized instrument constants file" (NEW, surfaced during recon — added to closeout build queue)

**Adjacent — remain separate:**
- Post-launch privacy policy update for newsletter (legal/compliance)
- v2: comments on articles
- v2: block-level visibility
- v2: AI-assisted article writing
- v2: pagination on archive
- v2: server-side full-text search

---

## 8. Risks and Open Questions

### 8.1 Risks

**SSR routing is the largest infrastructure unknown.**

Vite SPA deployment on Lovable does not natively support per-path routing to a Supabase Edge Function. Three resolution paths:
- Cloudflare Worker fronting (lightweight, $5/month, requires DNS change).
- Vercel/Netlify migration (Lovable's Vite output is deployable to either; small Vercel/Netlify config to route `/newsletter/*` and `/podcast/*` to Supabase Edge Functions).
- Build-time prerendering via `vite-plugin-prerender` (puppeteer-based; renders all known routes at build; requires rebuild trigger on every publish — workable for low-frequency publishing but fragile at scale).

**Recommendation:** Resolve at Phase G3 with Cole's call. Default path is Vercel migration since the SSR-via-Edge-Function pattern is well-supported there and the migration is low-cost.

**HTML import sanitization is a moderate scope item.**

Building a robust HTML→TipTap converter that preserves headings, lists, blockquotes, links, and images correctly while stripping all unsafe content is non-trivial. The `dompurify` library handles the sanitization; the conversion to TipTap is the work. Mitigation: ship a v1 converter that supports the common subset (headings, paragraphs, lists, links, images, blockquotes, basic emphasis) and rejects everything else with a clear error message rather than silently dropping. Author can iterate the HTML to fit.

**Newsletter dispatch deliverability.**

Resend handles transactional well; sending to many subscribers at once is a different deliverability profile. Mitigation: leverage Resend's Audiences/Broadcasts API (their dedicated newsletter path) rather than transactional `send-email`. Or dispatch in small batches (e.g., 100/minute) with rate-limit-friendly cadence. Or use a Resend dedicated sending IP if volume warrants.

**Diff viewer rendering complexity for rich content.**

Diffing two TipTap JSON documents accurately is hard — JSON-level diffs are unreadable, text-level diffs lose structure information. Mitigation: diff at the Markdown level (extract Markdown from each version, diff the strings). Loses some fidelity (e.g., link href changes within unchanged anchor text might not surface obviously) but is readable. Acceptable for v1.

**Plan-tier-checking is a new helper that needs to land cleanly.**

`current_user_active_plan_tier()` helper added in Phase G1 needs to be careful about: anonymous users (returns NULL), authenticated users with no subscription (returns NULL or a sentinel like `'free'`), authenticated users with expired subscriptions (returns NULL, not the cached tier value). This helper is reusable beyond newsletter — it's standing infrastructure.

### 8.2 Open questions deferred to build time

- **Q6 routing infrastructure** — resolve at Phase G3 start. Vercel migration recommended.
- **Q7 launch content** — 3-5 articles, mix of gates, resolved before Phase G6 ships.
- **Q8 comments in v1** — recommended NO. Confirm at Session 91 open.
- **Phase F3 podcast detail** — external listen links only OR internal episode pages with embedded players. Recommended external links only for v1, internal pages in Group G Phase G7.
- **Podcast audio hosting** — confirm Spotify is the canonical platform. External listen links work. If Cole wants the podcast hosted natively (audio files in Storage with our own player), that's a different scope.

---

## 9. Success Criteria

Groups F + G v1 ship when all of the following are true:

**Group F:**
- `/our-approach` route serves the renamed Evolve page; `/evolve` redirects to it; MarketingNav shows "Our Approach"; no broken links.
- `/podcast` route serves a populated podcast page with at least the structure ready for Group G7 to populate dynamically.
- Every instrument label across `Home.tsx`, `productsContent.ts`, `servicesContent.ts`, `Assessment.tsx`, `CoachClients.tsx`, and all other surfaces matches `public.instruments` verbatim.
- `src/lib/instruments.ts` exists and is the single source of truth.
- Every public marketing page has a unique `<title>`, `<meta description>`, `<link rel="canonical">`, OG tags, Twitter card tags, and Organization JSON-LD.
- `/sitemap.xml` and `/robots.txt` and `/llms.txt` are accessible.
- Twitter site meta is `@BrainWiseEnt` (or confirmed BrainWise handle), not `@Lovable`.

**Group G:**
- Super admin can author a new article via either the paste-HTML path OR the native-TipTap path, save drafts every 30 seconds via auto-save, commit named revisions, schedule for future publish, publish immediately, unpublish, archive.
- Version history shows all auto-save drafts + named revisions + state-transition events.
- Diff viewer compares any two versions side-by-side or inline.
- Restore-from-any-prior-version creates a new version tagged `restored_from`.
- Public, subscriber_aggregate, and plan_tier articles render correctly for the right viewers (anon sees public; authenticated subscriber sees subscriber_aggregate; only plan_tier holders see plan_tier).
- Anonymous visitors hitting a `subscriber_aggregate` article see 150-word preview + subscribe CTA, NOT the full body.
- Subscribe form double opt-in works end-to-end.
- Unsubscribe via header + footer link works.
- Article publish dispatches the article to eligible subscribers via Resend.
- Bounce/complaint handling flips `newsletter_subscribers.status` correctly.
- Each public article page returns full HTML + Article JSON-LD + Person/Organization schemas in initial response (verify with `curl -A "ChatGPT-User"`).
- `/sitemap.xml` includes all public articles + podcast episodes; updates dynamically on publish.
- `/newsletter` archive page shows all published articles with category filter + search.
- `/newsletter/feed.xml` serves valid RSS.
- Podcast episodes can be authored, published, and rendered.

---

## 10. Cross-Reference

| Decision | Topic | Touches |
| --- | --- | --- |
| Q1 | Group F before Group G | Sequencing, Phase F1-F5, Phase G1-G9 |
| Q2 | Both authoring paths | Phase G4, dompurify, `convert_html_to_tiptap` Edge Function |
| Q3 | Full versioning + diff viewer | `newsletter_article_versions` table, Phase G5, `diff` library |
| Q4 | Three-state article gating | `newsletter_articles.gate` enum, RLS floor, `get_article_for_reader` RPC mediation per §116 |
| Q5 | Subscriber list + dispatch | Phase G2, Phase G8, Resend Audiences sync, double opt-in, Resend webhooks |
| Q6 | SSR + JSON-LD + sitemap | Phase F1 (foundation), Phase G3 (dynamic), `render-public-page` Edge Function |

---

## Appendix A: Recon Findings Summary

### A.1 Instrument label drift detected (Phase F4 target)

| Instrument | DB canonical | DB items | Home.tsx | productsContent | Other surfaces |
| --- | --- | --- | --- | --- | --- |
| INST-001 PTP | Personal Threat Profile | 89 | "Personal Threat & Reward Profile" ❌ | Correct ✓ | Correct ✓ |
| INST-002 NAI | Neuroscience Adoption Index | 25 | "Neuroscience of AI Adoption" ❌ | Correct ✓ | Correct ✓ |
| INST-003 AIRSA | AI Readiness Skills Assessment | **24** | "48 items" ❌ | "48 specific AI-related skills" ❌ | Correct ✓ |
| INST-004 HSS | Habit Stabilization Scorecard | **3** | "Habit Strength Scale" + "6 items" ❌❌ | "6-item check-in" ❌ | Correct ✓ |
| INST-002L EPN | Neuroscience Adoption Index — Executive Perspective | 25 | (not shown) | (not shown) | Inconsistent labels across Services + Assessment |

### A.2 Backend infrastructure already in place (reusable)

- TipTap v3.23 (lesson_blocks authoring, reusable for newsletter)
- dompurify v3.4.5 (HTML sanitization for HTML import path)
- react-markdown v10.1.0 (rendering paths)
- Supabase Storage with public-tier + private-tier patterns (article covers + cached SSR HTML)
- Resend dispatch via send-email Edge Function with `INTERNAL_FUNCTION_SECRET` (newsletter dispatch reuses)
- email_logs table with bounce/complaint tracking via Resend webhooks
- super_admin_audit_log + super_admin_action_types with §99 discipline (14 new action_types in Phase G1)
- content_asset_refs walker pattern §71 + B-2 rebind §72 (extend to 8-way parent for newsletter_article + podcast_episode)
- §43 archive cascade pattern (extend for newsletter article archive)
- §82 RLS TO-role discipline (every new policy)
- §99 action_type whitelist (every new auditable RPC)
- §116 SECDEF RPC pattern for column-level access on public-tier resources (article reader mediation)

### A.3 Backend infrastructure NEW for Group G

- `current_user_active_plan_tier()` SECURITY DEFINER STABLE SQL helper
- `subscribe_to_newsletter / confirm / unsubscribe / import_bulk` RPCs
- `resend-audiences-sync` Edge Function (Class B internal-secret)
- `convert_html_to_tiptap` Edge Function (Class A custom auth)
- `render-public-page` Edge Function (anon — serves HTML)
- `generate-sitemap-xml` Edge Function (anon — serves XML)
- `dispatch-newsletter-article` Edge Function (Class B, background task)
- `get_article_for_reader` SECDEF RPC (§116 mediated read)

### A.4 Competitor recon synthesis

- **Ghost:** Post history is browse + restore, NO diff viewer. Our Q3 spec puts us above Ghost.
- **Substack / Beehiiv:** No exposed version history at all. Our Q3 spec puts us well above.
- **Beehiiv block-level visibility:** Sophisticated feature, v2 candidate.
- **Beehiiv H1 enforcement:** Auto-uses post title as H1, enforces no other H1s in body. Adopt this pattern in the rich editor.
- **Stratechery paywall model:** "Memberships are additive, not punitive — long-form is free, premium is additive." Validates Cole's three-state gating model.
- **Lenny's Newsletter URL pattern:** `/p/<slug>` clean descriptive slugs. We use `/newsletter/<slug>` for namespace clarity.
- **Lenny's article structure:** Per-article OG meta tags, rich author byline with avatar + name + date + author profile link, persistent subscribe CTA, related-articles block at bottom.
- **Podcast page best practices:** Latest episode hero, 3-column grid archive, individual URL per episode, multi-platform listen badges, embedded player on episode pages, show notes + transcript.
- **AEO research (Feb-May 2026):** JSON-LD structured data mandatory; pages with named authors cited 2.3x more in AI search results; answer-first formatting (direct answer in first 1-2 sentences) favored; server-side rendering matters because many AI crawlers don't execute JS; `llms.txt` is emerging standard.

---

## Document Metadata

Version: 1.0
Session: 90 (scoping)
Date: May 23, 2026
Status: Locked. Build sessions Group F = Session 91, Group G = Sessions 92-97.

Companion documents:
- `architecture-reference.md` v94+ (Session 90 close adds Group C formal closure entry)
- `build-queue.md` v98+ (Session 90 close adds Group F+G items)
- `session-90-to-91.md` handoff

Authoritative reference at build time:
- The DB is always canonical for instrument labels, plan tier values, and any other lookup data. `public.instruments`, `public.subscription_plans`, `public.super_admin_action_types`, `public.users` are the sources of truth.
- This scope doc is the binding contract for the design decisions Q1-Q6. Q7-Q8 resolve at session-open.
- Standing rules §43, §50, §71, §72, §82, §84, §99, §107, §108, §116 all apply.
