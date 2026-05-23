# BrainWise Session 91 to 92 Handoff

*Closeout: Session 91. Open: Session 92.*

## Where Session 91 left off

Marketing fast-track Phase F (Group F minus newsletter) shipped end-to-end across two work blocks. **Phase F1-F2 (text + nav changes):** EVOLVE methodology renamed to "Our Approach" in nav and routing (page-internal "EVOLVE" brand language preserved verbatim), `/evolve` redirect preserved for backward compat, social media links component added to MarketingFooter + Contact page, index.html social meta fixes (twitter:site corrected from `@Lovable` Lovable template leftover to `@mybrainwisecoach`, og:image and twitter:image pointed at canonical `/og-image-default.png` Cole still owes the actual PNG upload at), instrument label centralization shipped via new `src/lib/instruments.ts` canonical module mirroring `public.instruments` (HSS corrected to "Habit Stabilization Scorecard" with 3 items, AIRSA confirmed at 24 items, four marketing surfaces drift-fixed). **Phase F3 (Podcast page):** full marketing page at `/podcast` with hero, multi-platform listen badges (3 primary + 6 secondary expandable + RSS), featured-latest-episode card, paginated archive grid (12 per page, 7 pages), JSON-LD `PodcastSeries`, per-page meta tags. Backend pipeline shipped: public `podcast-feed` Storage bucket with §82-clean policies, `refresh-podcast-feed` Edge Function v2 (Class B internal-secret auth per §107) fetching Anchor RSS every 4h via pg_cron, parsing 78 episodes into JSON cache at `podcast-feed/episodes.json`. Frontend reads the public bucket URL directly — zero DB roundtrip, CDN-cached, 30-min React Query staleTime.

## Session 92 opening priorities, in order

### 1. Group G — Newsletter Platform

Scope doc at `scope-group-fg-marketing-newsletter.md` (already in repo, 500 lines, six foundational decisions Q1-Q6 locked Session 90). Estimated 5-6 sessions for full Group G build. Open Session 92 by re-anchoring on the scope doc, resolving the two deferred decisions Q7 (launch content count) and Q8 (comments in v1), then Phase G1 backend.

Phase G1 backend lift:
- `current_user_active_plan_tier()` SECURITY DEFINER STABLE SQL helper (extracts the §79 inline pattern; reusable beyond newsletter for any future plan-tier-gated feature)
- `newsletter_articles` table with full versioning support per Q3 (versions stored as separate rows with parent_id pointer + version_number; current published version flagged via `is_current_published`; full diff viewer support per Google Docs equivalent locked in Q3)
- `newsletter_subscribers` table per Q5 (subscriber list canonical in BrainWise DB, Resend Audience is a mirror not source-of-truth)
- Three-state gating model per Q4 (validated by Stratechery's additive-not-punitive paywall philosophy): public read / preview-with-signup-prompt / full-with-active-plan
- Backend RPCs: list/upsert/publish/restore article RPCs with §99 audit-action-type INSERTs in same migration, list/subscribe/unsubscribe/confirm subscriber RPCs with double opt-in
- Edge Functions: dispatch-newsletter (Resend Audience sync + send), confirm-subscription (double opt-in landing), article-ssr (for AEO per Q6)

Standing rules that apply: §43, §50, §71, §72, §82, §84, §99, §107, §108, §116. No new standing rules expected from G1 backend.

### 2. SSR architecture decision (load-bearing for Group G Phase G3)

Lovable's Vite SPA may not support per-path routing to a Supabase Edge Function. Three options documented in scope doc §6: Cloudflare Worker fronting, Vercel/Netlify migration, build-time prerendering. Recommended Vercel migration. Not blocking Phase G1 (marketing pages SEO already works via per-page meta + JSON-LD with Google's JS-executing crawler); becomes load-bearing at Phase G3 newsletter article SSR.

Decision can be made at Session 92 open OR deferred to Phase G3. If deferred, Session 92 ships G1 backend + G2 authoring frontend without SSR.

### 3. Optional fast-follow: og-image PNG upload

Cole still owes the actual PNG at `https://brainwiseenterprises.com/og-image-default.png` (Change 3 from Session 91 pointed the meta tags at this URL but the file isn't uploaded yet). 1200×630 social card. Non-blocking but the current state means social card previews for `/` and other marketing pages have broken og:image until the file lands.

## Decisions locked in Session 91 (recap)

### Phase F1 (text + nav)
- EVOLVE methodology rename: nav label changes to "Our Approach"; route `/our-approach` + redirect from `/evolve`; page-internal EVOLVE brand language preserved verbatim (the framework name stays "EVOLVE", only the nav-and-URL surface renames)
- Instrument labels: `public.instruments` is canonical, not userMemories — HSS is "Habit Stabilization Scorecard" with 3 items; AIRSA has 24 items; PTP is "Personal Threat Profile"; NAI is "Neuroscience Adoption Index"
- New `src/lib/instruments.ts` centralized constants module mirrors DB schema; consumers refactored to import from it (Home.tsx, CoachClients.tsx, Assessment.tsx)
- Social meta fixes: `twitter:site=@mybrainwisecoach` (was `@Lovable` Lovable template leftover); og:image and twitter:image pointed at canonical brainwiseenterprises.com URL (Cole still owes the PNG upload)
- Social media component: new `src/components/marketing/SocialLinks.tsx` reusable variant-aware (`onDark`/`onLight`) row of 4 platforms (Instagram + YouTube from lucide-react; X + TikTok as inline currentColor SVGs) at `@mybrainwisecoach` handle; embedded in MarketingFooter Follow column and Contact form section

### Phase F3 (Podcast page)
- Cache architecture: public Storage bucket (`podcast-feed`), Edge Function refreshes via pg_cron every 4h, page reads public URL directly (no DB roundtrip, CDN-cached)
- Auth model on refresh function: Class B internal-secret per §107 (browsers cannot trigger refresh; only cron + admin)
- Listen badges: primary row of 3 (Apple/Spotify/YouTube) + expandable "More ways to listen" revealing 4 more (iHeart/Pandora/Castbox/Deezer/Amazon Music) plus RSS feed link
- Pagination: 12 episodes per archive page, smart-ellipsis numbered pagination (Prev/Next + first/last always rendered + ellipsis between)
- Episode display: bonus + full episodes mixed chronologically (no tabs); newest-first (sorted server-side)
- Hero copy: show description from RSS verbatim minus brain emoji; tagline "Stay curious. Stay compassionate. Stay BrainWise."
- JSON-LD: `PodcastSeries` only on index page; per-episode `PodcastEpisode` JSON-LD deferred to G7 when episode pages exist
- Episode cover art hotlinked from Anchor CDN (no re-hosting)
- Listen-badge variant prop pattern mirrors SocialLinks.tsx (inline hover handlers because hover target color is variant-dependent — not refactorable to CSS classes)

### Footer architecture decision
- Footer grid: 3 columns (Legal / Contact / Follow) expanded to 4 columns desktop (Legal / Contact / Explore / Follow); stacks single column on mobile
- "Explore" column is the home for navigation links to specific content surfaces; v1 contains one entry (Podcast); newsletter lands here when G ships (no "Newsletter coming soon" placeholder in v1 per Session 91 decision — coming-soon links age poorly in production footers)

## Open questions / things to lock in Session 92

- **Q7 (Group G newsletter launch content count):** how many articles ready at launch? Affects pagination defaults, archive shape, and whether to seed test content. Cole picks at Session 92 open.
- **Q8 (Group G comments in v1):** comments under articles in v1, or defer to v2? If v1, scope expands by ~1 session for comments backend + moderation + RLS. Recommended defer to v2 — comment moderation is real ops cost and v1 ships faster without it. Cole picks.
- **SSR architecture for Phase G3:** Cloudflare Worker fronting vs Vercel/Netlify migration vs build-time prerendering. Recommendation Vercel migration. Cole picks at Session 92 open OR defers to Phase G3 open.

## Bugs surfaced in Session 91 added to Build Queue

None. Session 91 was clean — no production bugs surfaced during F1/F2/F3 ship or post-ship verification. The Lovable plan-doc cycle caught the JSX-transport-corruption risk pre-ship (same pattern as Session 72 Tile.tsx); reconstruction-from-structural-intent + audit-list at ship time worked cleanly on the first cycle.

## What's NOT in scope for Session 92

- Touching any backend table outside the Group G newsletter family
- AIRSA Phases 3e-8 work
- SOC 2 written policies session
- Action-Oriented Voice Redesign across six surfaces
- Pricing-reads refactor
- Corporate contract renewal schema change
- Clarity Engine work
- Session 71 anon EXECUTE audit on 95 SECDEF functions
- Post-launch `coach_clients_client_view` → SECDEF RPC refactor
- Phase 10 polish queue (Round 7 done Session 90; no remaining rounds since Round 4 was obsoleted by Phase 11 Members surface)
- Any Group C work — Group C is closed as of Session 90

## Architecture additions in Session 91

### New infrastructure
- **Public Storage bucket `podcast-feed`** (10MB ceiling, `application/json` MIME): caches the parsed Anchor RSS feed at `episodes.json`. §84 public-tier classification (non-sensitive promotional metadata, no PII, world-readable). §82-clean policies: `podcast_feed_public_select` (TO public, bucket-scoped qual) + `podcast_feed_service_role_all` (TO service_role).
- **pg_cron job `refresh_podcast_feed_every_4h`** at `37 */4 * * *` (offset minute 37 from other jobs at :00/:15/:20/:30 to spread load): reads `INTERNAL_FUNCTION_SECRET` from Vault, pg_net.http_post to the refresh Edge Function.
- **Edge Function `refresh-podcast-feed` v2** (`verify_jwt:false`, Class B internal-secret per §107): fetches `https://anchor.fm/s/106acb1cc/podcast/rss`, parses XML via `fast-xml-parser@4.5.0` (with `cdataPropName: "#cdata"` for CDATA-wrapped fields), writes parsed JSON to `podcast-feed/episodes.json` via service-role storage upload. Non-fatal failure semantics per §112 (returns 200 with `{success:false, reason}` on upstream failure so cron doesn't surface as crash; cache stays at last good snapshot on failure).

### Frontend modules
- **`src/lib/instruments.ts`** — canonical instrument metadata module mirroring `public.instruments`. Single source of truth for marketing pages, replaces previously-drifted hardcoded values across Home.tsx + productsContent.ts.
- **`src/lib/podcastFeed.ts`** — typed fetcher reading the public bucket cache. Exports `PodcastFeed`/`PodcastShow`/`PodcastEpisode` interfaces, `fetchPodcastFeed()` async function, `formatEpisodeDate()` helper.
- **`src/components/marketing/SocialLinks.tsx`** — reusable variant-aware (`onDark`/`onLight`) social-media-icons row component used by MarketingFooter and Contact form.
- **`src/components/marketing/PodcastListenBadges.tsx`** — reusable variant-aware multi-platform listen-badge row with primary 3 + expandable secondary 6 + RSS.
- **`src/content/marketing/podcastContent.ts`** — static metadata (listen platform URLs, hero tagline, hosts string, pagination size).

### Renames
- `src/pages/marketing/Evolve.tsx` → `OurApproach.tsx` (component export `OurApproach`)
- `src/content/marketing/evolveContent.ts` → `ourApproachContent.ts` (internal symbol names `evolveStages` / `evolveInstruments` preserved verbatim because the framework brand stays "EVOLVE")

### Routing
- Route `/our-approach` → `<OurApproach />`
- Redirect `/evolve` → `<Navigate to="/our-approach" replace />` (backward compat)
- Route `/podcast` → `<Podcast />`
- MarketingNav order: Products / Pricing / Services / Our Approach / **Podcast** / Contact

### Footer
- Grid expanded from `1fr 1fr 1fr` to `1fr 1fr 1fr 1fr` (desktop); stacks `1fr` on mobile
- New "Explore" column inserted between Contact and Follow with one entry (Podcast)

## Test fixture state at end of Session 91

Test org: BrainWise Test Corp.

Three test users (look up current UUIDs via Supabase MCP; password is in Claude's userMemories):
- testclientbwe+orgmember@gmail.com (org_admin)
- testclientbwe+supervisor@gmail.com (corporate_employee)
- testclientbwe+employee@gmail.com (corporate_employee, supervisor_user_id pointing to +supervisor)

No fixtures created or cleaned up Session 91. Session 91 was marketing-only — no test users touched, no test assessments created or modified, no test corporate org state changed.

## Documents this session leaves behind

- `build-queue.md` v98 → v99 (Session 91 entry added)
- `architecture-reference.md` v94 → v95 (Session 91 entry added; no new §-numbered standing rules)
- `session-91-to-92.md` (this document)

Markdown only — Session 74 decision, no `.docx`. Cole uploads all three manually to `cbastianBWE/brainwise-internal-docs` (flat repo root); GitHub MCP is READ-ONLY (verified 403 on `create_or_update_file` and `push_files`).

Markdown source-of-truth at `cbastianBWE/brainwise-internal-docs`.
