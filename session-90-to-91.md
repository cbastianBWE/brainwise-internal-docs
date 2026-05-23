# Session 90 → 91 Handoff

**Closing:** Session 90 (May 23, 2026)
**Opening:** Session 91
**Theme of closing session:** Phase 10 Round 7 coach surfaces polish (shipped) + Group C formal closure + Group F+G scoping
**Theme of opening session:** Group F (Marketing trio + SEO/AEO foundation), 1 session

---

## What shipped Session 90

### Phase 10 Round 7 coach surfaces polish — DONE

Three coach files fully polished against the 6-category pattern (§111 type discipline, accessibility attributes, error-state + Retry pattern, filter-empty vs real-empty distinction, table overflow handling, decorative-icon aria-hidden).

**Round 7a (ClientResults.tsx + CoachInvoices.tsx):**
- Prompt at `/home/claude/prompts/round-7a-prompt.md` (501 lines)
- Shape A refactor (extract IIFE into `fetchX` useCallback used by useEffect + Retry button)
- Error states with AlertCircle + Retry button
- Loader2 with `role="status"` + aria-label
- Decorative-icon aria-hidden on 10 + 7 sites respectively
- Four-branch loading→error→real-empty→filter-empty ladder on CoachInvoices
- overflow-x-auto wrapper on Table component
- All preservation blocks verified byte-identical via diff exit 0: §118 paired-PTP collapse, permission resolver queries, MyResults embed, generatePdf, exportSinglePdf, statusBadge, Receipt modal
- ClientResults: 483 → 596 lines
- CoachInvoices: 461 → 494 lines
- Lovable added `// eslint-disable-next-line react-hooks/exhaustive-deps` above new useEffects — not in spec but defensible, logged

**Round 7b (CoachClients.tsx):**
- Prompt at `/home/claude/prompts/round-7b-prompt.md` (468 lines)
- Pre-prompt backend recon via `pg_get_functiondef` on `send_coach_invitation_email` and `create_actor_debrief_order` to confirm RPC return shapes for typed call sites
- 7 §111 cast violations cleared (all `(supabase as any)`, `(row: any)`, `(error as any)` cleared)
- 4 new TypeScript interfaces declared for typed RPC paths
- 2 `as unknown as` intermediates Lovable used to fix RPC Json→struct narrowing — acceptable per §111 reading (Json structural-alias bridge, not wrapper-shape violation)
- 18 aria-hidden, 1 Loader2 a11y, 1 Retry button
- Lovable-improves-on-spec on Change 7c (IIFE wrapper for filteredUniqueClients cleaner than spec)
- CoachClients: 1149 → 1216 lines (+67)
- ClientResults + CoachInvoices MD5-identical to 7a state (scope discipline held)

Cole confirmed all flows work end-to-end. Round 7 DONE.

### Group C formal closure walkthrough — DONE

Read the full Group C v1 scope doc (`BrainWise_Group_C_Scope_Coach_Certification_v1.docx`, 867 lines, 13 foundational decisions Q1-Q13, 10 build phases, 14 v1 notification types, 9 success criteria).

Verdict: **GROUP C IS CLOSED.**

| Aspect | Status |
| --- | --- |
| All 10 build phases | DONE |
| All 13 foundational decisions | Resolved (Q11 cohorts DEFERRED INDEFINITELY per Session 85 product decision; Q13 post-cert benefit DEFERRED per scope until subscription tiers) |
| 13 of 14 v1 notification types | LIVE (plus bonus `results_available` PTP-only) |
| 1 remaining type | `cert_path_deadline_approaching` correctly DEFERRED to v2 per scope §6 |
| All 9 success criteria | MET |
| Build Queue items 31, 32, 33, 35, 37, 38 | CLOSED |
| All §6 explicit non-goals | Correctly out of v1 |

The Group C closure entry is written into `build-queue.md` v98 under a new "## Group C closure (Session 90)" heading.

### Group F + Group G scope doc — WRITTEN

Comprehensive scope doc at `/home/claude/internal-docs/scope-group-fg-marketing-newsletter.md` (500 lines) covering:

**Group F (Marketing trio + SEO/AEO foundation):** Podcast page, EVOLVE→Our Approach rename, instrument label audit pass with newly-created `src/lib/instruments.ts` centralized constants, full SEO/AEO infrastructure foundation (per-page meta tags via react-helmet-async, robots.txt, sitemap.xml, llms.txt, Organization JSON-LD on homepage). 1 session estimated.

**Group G (Newsletter platform):** Full versioning with diff viewer + restore-to-prior-version, three-state gating (public / subscriber_aggregate / plan_tier), real Resend dispatch with double opt-in + unsubscribe, both paste-HTML and author-natively input paths, full SEO/AEO infrastructure for dynamic content (SSR via Edge Function + dynamic sitemap + JSON-LD per page type), podcast schema + authoring + reader, RSS feed. 5-6 sessions estimated, phased like Group C was.

6 foundational decisions locked (Q1-Q6); 2 deferred to session-open (Q7 launch content count, Q8 comments in v1).

### Comprehensive recon completed Session 90

**Competitor recon:**
- Ghost / Substack / Beehiiv comparison — feature gaps documented in scope doc Appendix A.4
- Stratechery — paywall philosophy (additive, not punitive) validates Cole's three-state gating model
- Lenny's Newsletter — URL pattern, OG meta structure, article reader UX patterns
- AEO research (Feb-May 2026) — JSON-LD requirements, server-side rendering necessity, author bio + Person schema cited 2.3x more, `llms.txt` emerging standard
- Podcast page best practices — Acquired-style multi-platform listen badges, individual URL per episode, embedded player

**BrainWise backend recon:**
- `public.instruments` canonical names + item counts captured for the audit pass
- `subscription_plans` tier values: `base`, `premium`, `individual`
- `users.subscription_tier` + `users.subscription_status` text columns hold per-user state
- No existing `current_user_active_plan_tier()` helper (must be built in Group G Phase G1)
- `email_logs` table has bounce/complaint columns sufficient for newsletter compliance
- Resend infrastructure mature: 14 distinct email_types, 76 sends in last 30 days, `send-email` Edge Function via `INTERNAL_FUNCTION_SECRET` per §107
- 79 super_admin_action_types currently, 50 content_authoring actions — pattern locked for newsletter authoring's 14 new action_types
- No existing tables for newsletter/podcast/article — greenfield

**BrainWise frontend recon:**
- App.tsx 229 lines — full route inventory captured at `/home/claude/scope-fg-recon/frontend/App.tsx`
- Marketing pages live at `src/pages/marketing/` (11 files) + `src/components/marketing/` (10 files) + `src/content/marketing/` (4 data files) + `src/styles/marketing-tokens.css`
- Evolve page 680 lines pulled — rename impact surface: MarketingNav L9 + App.tsx L22+L128 + Evolve.tsx file rename + evolveContent.ts file rename + redirect from /evolve added
- No other files reference /evolve or "EVOLVE" — clean rename surface
- TipTap v3.23 already installed and used for lesson_blocks — reusable for newsletter native authoring
- dompurify v3.4.5 + react-markdown v10.1.0 installed — reusable for HTML import sanitization
- Pure Vite SPA with zero SSR — `vite.config.ts` only has `react()` and `componentTagger()` plugins
- `index.html` has `twitter:site` = `@Lovable` leftover (BUG to fix in Group F)
- `INSTRUMENTS` constants are file-local (CoachClients.tsx:31, Assessment.tsx:14-24) — centralization is part of Phase F4
- Sidebar nav placement for "Newsletter Authoring" entry: between "Resource Authoring" and "Comp Coupons" in AppSidebar L96-97; suggested Lucide icon `Newspaper`
- Sidebar nav placement for "Podcast Authoring" entry: after "Newsletter Authoring"; suggested Lucide icon `Mic`

**Critical SEO/AEO finding:** BrainWise is currently a pure SPA with no per-page meta tags, no JSON-LD, no sitemap, no llms.txt. Every route serves identical HTML title and meta description from `index.html`. The `twitter:site` leftover (`@Lovable`) is wrong attribution. Group F Phase F1 ships the SEO foundation; Group G Phase G3 extends it for dynamic content.

---

## Major recon-surfaced label drift (Phase F4 target)

The instrument label audit pass found significant drift between `public.instruments` (canonical) and the marketing surfaces:

- Home.tsx L19: PTP labeled "Personal Threat & Reward Profile" → should be "Personal Threat Profile"
- Home.tsx L20: NAI labeled "Neuroscience of AI Adoption" → should be "Neuroscience Adoption Index"
- Home.tsx L21: AIRSA item count "48 items" → should be "24 items"
- Home.tsx L22: HSS labeled "Habit Strength Scale" + "6 items" → should be "Habit Stabilization Scorecard" + "3 items"
- productsContent.ts: AIRSA "48 specific AI-related skills" → "24"
- productsContent.ts: HSS "6-item check-in" → "3"
- Services.tsx + Assessment.tsx: EPN labeled inconsistently across surfaces; canonical is "Neuroscience Adoption Index — Executive Perspective"

Phase F4 creates `src/lib/instruments.ts` as single source of truth and refactors all surfaces to import from it.

**Also:** userMemories has stale data — says HSS has 6 items, DB says 3. Standing reminder: `public.instruments` is canonical, not userMemories.

---

## Session 91 opening protocol

Open Session 91 by pulling the three canonical docs from `cbastianBWE/brainwise-internal-docs` via GitHub MCP `get_file_contents`:

1. `docs/build-queue.md` (v98 after Session 90 close — includes Group C closure entry + Group F/G items)
2. `docs/architecture-reference.md` (v94 after Session 90 close — includes Group C closure entry)
3. `docs/session-handoffs/session-90-to-91.md` (this file)

Save locally to `/home/claude/internal-docs/` mirroring GitHub structure. Then read the Group F+G scope doc:

4. `docs/scope-group-fg-marketing-newsletter.md` (uploaded by Cole as part of Session 90 close)

Resolve open questions Q7 (launch content count) and Q8 (comments in v1) at session open. Confirm Q6 routing infrastructure recommendation (Vercel migration) is acceptable to Cole.

Then proceed with Group F build (1 session estimated):

**Phase F1 (SEO foundation, ~30 min):**
- `npm install react-helmet-async`
- Wire `<HelmetProvider>` in main.tsx
- Add Organization JSON-LD to Home.tsx
- Fix `index.html` `twitter:site` from `@Lovable` to BrainWise handle (confirm at session-open)
- Create `/public/robots.txt`
- Create `/public/sitemap.xml` (static for marketing pages)
- Create `/public/llms.txt`
- Add per-page `<Helmet>` blocks to existing marketing pages

**Phase F2 (EVOLVE → Our Approach rename, ~30 min):**
- Rename Evolve.tsx → OurApproach.tsx
- Rename evolveContent.ts → ourApproachContent.ts
- Update import in OurApproach.tsx
- Update App.tsx imports + route
- Update MarketingNav navLinks
- Add redirect from /evolve → /our-approach

**Phase F3 (Podcast page, ~60 min):**
- Create `src/pages/marketing/Podcast.tsx`
- Create `src/content/marketing/podcastContent.ts` with seed episode structure
- Add MarketingNav entry
- Add App.tsx route
- Decide at session-open: external-listen-links only OR internal episode pages with embedded player (recommend external-links only for v1)

**Phase F4 (Instrument label audit, ~60 min):**
- Create `src/lib/instruments.ts` with INSTRUMENTS array sourced from public.instruments (literal hardcode of current DB values; helper to source dynamically can come later)
- Refactor Home.tsx L19-22 to use INSTRUMENTS
- Refactor productsContent.ts AIRSA + HSS item counts
- Refactor servicesContent.ts (read for any count claims)
- Refactor ourApproachContent.ts (Phase F2 renamed file)
- Refactor Assessment.tsx L14-24 to import from src/lib/instruments.ts
- Refactor CoachClients.tsx L31 to import from src/lib/instruments.ts
- Add INST-002L (EPN) to centralized constant; audit Services.tsx + Assessment.tsx for EPN label

**Phase F5 (verification sweep, ~15 min):**
- grep codebase for "PTP", "NAI", "AIRSA", "HSS", "EPN", and instrument names
- Flag any remaining hardcoded labels for follow-up
- Smoke-test reading 4 instrument-displaying surfaces side-by-side with `public.instruments`

Total Group F estimate: ~3-3.5 hours of recon + prompt-writing + verification, fits cleanly in 1 session.

After Group F ships, Session 92 opens Group G Phase G1 (newsletter schema + RLS + RPCs).

---

## Standing rules touched

- **§43 archive cascade pattern** — will extend for newsletter article archive in Group G Phase G1
- **§71 walker pattern** — will extend `content_asset_refs` to 8-way parent (add `newsletter_article_id` and `podcast_episode_id`) in Group G Phase G1
- **§72 B-2 rebind** — applies unchanged to newsletter cover image asset references
- **§82 RLS TO-role discipline** — all new Group G policies explicit `TO role`
- **§84 storage tier classification** — newsletter cover images = public-tier; rendered HTML cache = public-tier
- **§99 action_type whitelist** — 14 new action_types added in Group G Phase G1 migration
- **§107 server-side email sender pattern** — newsletter subscribe/confirm/unsubscribe emails reuse this pattern
- **§108 private-bucket RLS floor** — n/a for newsletter (all cover images public-tier)
- **§116 SECDEF RPC for public-tier metadata** — newsletter reader RPC follows this pattern for gated articles (public metadata but gated body)

No standing rules need extension; the existing patterns cover the Group G architecture.

---

## Files Cole needs to upload

Three markdown files for `cbastianBWE/brainwise-internal-docs`:

1. `docs/build-queue.md` v98 (Group C closure entry + Group F/G items)
2. `docs/architecture-reference.md` v94 (Group C closure entry + Session 90 close summary)
3. `docs/session-handoffs/session-90-to-91.md` (this file)
4. `docs/scope-group-fg-marketing-newsletter.md` (new file — comprehensive scope)

All four uploaded manually via GitHub web UI drag-and-drop per standing closeout protocol. GitHub MCP is READ-ONLY (verified Session 89, 403 on create_or_update_file).

---

## Test fixture state

Unchanged from Session 89 close. CoachClients/ClientResults/CoachInvoices polished — all flows verified working. No new fixtures created Session 90.

---

## Risk carry-forward to Session 91

**SSR routing infrastructure unknown (Group G Phase G3 surfaces).** Lovable's Vite SPA deployment may not support per-path routing to a Supabase Edge Function. Three resolution paths documented in scope doc §8.1. Recommendation: Vercel migration. Not blocking for Group F (Session 91) since the marketing pages get SEO via per-page meta tags + JSON-LD which works in pure SPA + Google's JS-executing crawler. The Edge-Function-SSR architecture becomes load-bearing only at Group G Phase G3 for newsletter article SSR.

**Q7 launch content count, Q8 comments in v1 — Cole's call at Session 91 open.**

**Group G total session count is estimate, not commitment.** 5-6 sessions reflects the scope laid out in §5. If subsystems prove simpler than expected (e.g., HTML import converter, dispatch retry logic), it compresses to 4. If they prove harder (e.g., SSR routing), it expands to 7. Session-by-session estimates will sharpen as Phase G1 ships.
