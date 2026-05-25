# Session 102 → 103 Handoff

## What shipped Session 102

**Group H Cycle H5 + Follow-up complete.** External HTML imports now produce styled BrainWise nodes for the dominant import-fidelity patterns. Three Lovable cycles, zero backend migrations, zero Edge Function deploys.

- **H5 Cycle 1 (atom simples):** 20 files modified across `src/components/newsletter/tiptap/nodes/` and `src/components/newsletter/tiptap/marks/`. Added class-based and bare-tag fallback parseHTML rules at priority 51 to: Audio, AuthorBio, Chart, CodeDiff, CTA, Callout, Embed, FooterMeta, Footnotes, FurtherReading, ImageCompare, Math, Poll, Pullquote, RelatedArticles, StatCallout, SubscribeBlock, Terminal, Definition mark, FootnoteRef mark. Skipped: ImageGallery + StatGrid (wrapper-only fallbacks fail ProseMirror content-expression coercion; children reparent naturally without the wrapper). Image excluded from H5 — handled upstream by Session 101's `rewriteImgsToSyntheticFigures`.

- **H5 Cycle 2 (composites):** 3 shipped (Checklist+Item, Citations+Entry, Disclosure+Summary), 7 skipped with `§151` doc-comment markers (DomainGrid, FourColumn, IndexRow, KeyMoments, StepList, ThreeColumn, TwoColumn).

- **H5 Follow-up:** Cole's smoke test on `ptp_test_article.html` exposed gaps. 5 files modified, including 2 REVERSALS of Cycle 2 skip decisions: Pullquote, FooterMeta, SectionRule, DomainGrid+Row (reversed), IndexRow+Card (reversed). The reversals proved paired-rule patterns DO satisfy strict content expressions of the form `newsletterChildType+` — see §151 amendment in arch-ref v104.

- **Smoke test PASSED** on `ptp_test_article.html` (522 lines, Group H canonical reference). Eyebrow, deck, lede, byline, numbered section rules (01-04), pullquote, callout, domain grid (5 rows), index row (TRI/RSI), footer-meta tag strip all rendered as correctly-styled BrainWise nodes after Follow-up.

**BrainWise HTML Authoring Spec produced** as standalone deliverable. 796 lines covering 24 import patterns, all 12 inline marks, 13 import-friendly block patterns with selectors, documented limitations for the 7 schema-blocked composites, anti-patterns, optional CSS template, pre-output checklist. Verified against shipped state of all 37 nodes + 10 marks. **Target home: `cbastianBWE/brainwise-internal-docs/brainwise-html-authoring-spec.md`** (flat repo root, manual upload). Will be embedded as system prompt in H6 v1's `newsletter_ai_generate` Edge Function.

**H6 v1 scope locked Path A** (full chat-based AI co-pilot, not modal-based one-shot). Image attribution architecture locked Option B (separate `attribution` attribute on `newsletterImage`, not the existing `caption` field). PEXELS_API_KEY already set in Supabase Edge Function secrets by Cole.

---

## Cole-side action items for Session 103 OPEN

**Two things before any backend work begins:**

### Action 1: Delete `convert-html-to-tiptap` Edge Function manually

D6=a was locked Session 101: delete `convert-html-to-tiptap` after smoke confirms the new client-side generateJSON path. Smoke passed Session 102 on `ptp_test_article.html`.

**Why manual:** Supabase MCP exposes list/get/deploy for Edge Functions but NOT delete. Two paths:

- **Option A (recommended):** Supabase Dashboard → Project `svprhtzawnbzmumxnhsq` → Edge Functions → `convert-html-to-tiptap` → Delete
- **Option B:** Supabase CLI: `supabase functions delete convert-html-to-tiptap --project-ref svprhtzawnbzmumxnhsq`

**Function identifiers (for verification before deletion):**
- Slug: `convert-html-to-tiptap`
- Function ID: `20fb6ba1-cfcf-4d27-bd0c-f0296d982f06`
- Version: 3
- ezbr_sha256: `ffe538f1f4ecd886efed9ef83b5d955d0cf4e4b3bf9bd468153d153e0ac569a5`
- verify_jwt: true

After deletion, the only HTML-import-related Edge Function active should be `import-html-images` v1 (function ID `53d32929-6e0d-4c0c-9e7c-479dcc544d04`, ezbr_sha256 `bb2fd15e894b9910628d6c0d573dd1ce180a6bb3ea23517fce58665e96e9de6c`).

### Action 2: Confirm PEXELS_API_KEY secret name

You set the key in Supabase Edge Function secrets. The H6 v1 `newsletter-image-search` Edge Function will read it via `Deno.env.get("PEXELS_API_KEY")` exactly. If the secret was named differently (e.g., `PEXELS_KEY`, `PEXELS_TOKEN`), either rename it in the dashboard or tell me the actual name and I'll match the Edge Function code to it.

Quick verification at Session 103 open: I'll run a one-off Pexels API call via Supabase MCP pg_net.http_post using a deliberately wrong API key first to confirm the error envelope shape, then verify the real flow works end-to-end before any Lovable cycle. Takes 30 seconds.

---

## What's next: H6 v1 — In-app Claude newsletter co-pilot

**Cole's locked Session 103 sequencing**: H6 v1 first, then G3+G8+G9 combined SEO/AEO/RSS pass. Group H formally closes when H6 v1 ships.

### H6 v1 deliverables (Path A scope)

Persistent chat panel inside `/super-admin/newsletter/<articleId>` editor sidebar. Not a modal that closes — a panel that stays open for ongoing conversation across multiple turns. Each turn either generates new content or modifies what's already in the editor.

**Backend (one SQL migration + 2 Edge Functions + 1 storage bucket):**

- SQL migration creates:
  - `newsletter_ai_conversations` (id, article_id FK, user_id FK, created_at, updated_at, model_used, status)
  - `newsletter_ai_messages` (id, conversation_id FK, role, content, attachments JSONB, tokens_used, created_at)
  - RLS gating to super-admin
  - Action types added to `super_admin_action_types` for audit logging per §142
- NEW Edge Function `newsletter_ai_generate` (Class A per §107, super-admin gated, calls Anthropic API)
  - Accepts: conversation thread + new user message + current article state + selection range (if any) + model selection (Opus|Sonnet) + attachments
  - System prompt: full BrainWise HTML Authoring Spec
  - Returns: generated/modified HTML, tokens used, model used
- NEW Edge Function `newsletter-image-search` (Class A, super-admin gated, calls Pexels API)
  - Accepts: query string, count (3-5)
  - Calls Pexels `/v1/search` with `Authorization: PEXELS_API_KEY` header
  - Returns: candidates array `[{src_large, src_thumb, photographer_name, photographer_url, photo_page_url, alt}]`
- NEW Storage bucket `newsletter_ai_attachments` (private, super-admin write, ~10MB ceiling per file)

**Frontend (multiple Lovable cycles):**

- Chat panel UI in editor sidebar with persistent conversation history
- Selection-aware editing: TipTap selection API captures both HTML and ProseMirror positions; "Rewrite with Claude" affordance (floating button when selection active, OR right-click menu item, OR /rewrite chat command); Claude returns HTML for just the selection; client splices back into doc at captured position via ProseMirror replaceWith or similar
- File upload to chat: PDF via pdf-parser library, .docx via mammoth.js client-side, plain text passed as-is, images via existing content_assets pipeline
- Image search UI: chat suggests image, panel shows 3-5 Pexels thumbnails with photographer name; click inserts into editor with auto-populated attribution
- **Image attribution architecture (Option B locked Session 102):**
  - Add `attribution: string | null` attribute to existing `newsletterImage` TipTap node (default null, additive)
  - renderHTML appends `<p class="newsletter-image__attribution">` child element after figcaption when attribution non-null
  - CSS: muted, smaller font, italic, slight top margin
  - Pexels images: auto-populated as `Photo by [Name] on Pexels` with photographer profile link + photo page link
  - Existing `caption` attribute stays purely editorial
- Opus/Sonnet model toggle in chat header
- Generated content lands in existing ImportHtmlModal preview state (Session 101 H4 pattern) for review before commit

**Estimated H6 v1 effort:** 4-6 sessions, 10-16 Lovable cycles, 1 SQL migration, 2-3 new Edge Functions.

### H6 v2 deferred indefinitely

Generation fallback (DALL-E or Replicate Flux for cases where Pexels has no matching image). Decision criteria: only build if Pexels coverage gaps emerge with 3+ articles where author wanted an image Pexels couldn't provide. If shipped, prefer Replicate Flux Schnell (~$0.003/image) over OpenAI (Cole declined OpenAI dependency). Claude cannot generate images — Anthropic doesn't make an image-generation product, so "use Claude for it" is not a routing question.

### Post-H6-v1: G3+G8+G9 combined SEO/AEO/RSS pass

After H6 v1 ships. Deferred from Session 94 as "post-G6 combined pass":
- **G3:** newsletter article SSR / meta-tags / structured-data infrastructure
- **G8:** internal subscriber inclusion in dispatch (paid product users auto-receive newsletter)
- **G9:** RSS feed Edge Function at `/newsletter/feed.xml`

Combined pass estimated 2-4 sessions, sequenced after H6 v1 completes.

---

## §151 amendment locked Session 102

Original Session 101 wording: "parseHTML rules optimized for round-trip do NOT automatically import — verify import paths separately when shipping schema."

That part stands. What got refined: the original Session 101 classification of the "wrapper-strict-child" composite class as universally unfixable via parseHTML alone was an overgeneralization.

**Corrected understanding:**

- Paired-rule patterns (parent class fallback rule + child class fallback rule shipped together at priority 51) DO satisfy strict content expressions of the form `newsletterChildType+`, because ProseMirror runs both rules during parse and the child matches feed the parent's content expression.
- Pattern shipped Session 102 in DomainGrid (parent: `div.domain-grid` / `section.domain-grid`; child: `div.domain-row`) and IndexRow (parent: `div.index-row`; child: `div.index-card`).
- Genuinely unfixable via parseHTML alone (would need preprocessing in ImportHtmlModal upstream of generateJSON):
  - **Exact-count content expressions without `+`** (`A A`, `A A A`, `A A A A`): TwoColumn+Pane, ThreeColumn+Pane, FourColumn+Pane parents
  - **Heading-first content expressions**: StepList+Step (first child must be heading per `heading block*`)
- ImageGallery + StatGrid documented as a separate failure mode (wrapper-only with strict heterogeneous content); also genuinely unfixable via parseHTML alone for the same content-expression-coercion reason.

**Pattern requirements for paired-rule fallback (Session 102 locked):**

- Both parent + child fallback rules at priority 51 (one above default 50 per §144)
- Parent rule canonical `data-newsletter-*` selector preserved as default-priority match
- Child getAttrs callbacks read from visible content via TEXT_NODE filtering on `el.childNodes`, NOT from `data-*` attrs (external markup won't carry those)
- renderHTML output unchanged — round-trip behavior unaffected
- Class names in fallback selectors are the most common external conventions (e.g., `div.domain-grid` and `section.domain-grid`)

**Re-evaluable composites (paired-rule pattern likely applies, not yet shipped):** KeyMoments+Moment. Carry as a low-priority deferred item.

---

## Carryforward deferred items (unchanged from Session 101 except as noted)

Updated:
- (a) `convert-html-to-tiptap` Edge Function deletion NEWLY SURFACES as Session 103 OPEN action item for Cole (manual Dashboard/CLI step)
- (b) H6 v1 NEWLY ADDED as primary Session 103 work
- (c) G3+G8+G9 combined SEO/AEO/RSS pass NEWLY SEQUENCED as Session 103-post-H6 focus

Unchanged carryforward:
- Poll NodeView phantom audit-row fix (5-line post-hydration first-render ref skip)
- Masthead/FooterMeta published_label cosmetic fix
- StatCard grid responsive variant restoration in ImportHtmlModal SuccessView (`grid-cols-1 sm:grid-cols-3`)
- `results_available` notification firing point wiring (Phase 10 polish)
- AIRSA facet-interpretation generation gap investigation
- `coach_messages` + messaging subsystem
- Action-Oriented Voice Redesign
- §110 cert-path enrollment asymmetry from Session 84
- H2-MIG-9e SVG bucket tightening
- `content_assets_archive_reason_check` whitelist extension
- newsletter-categories admin UI
- related-article RPC gate-relaxation
- AuthorBio Option 2 placeholder for unbound external author bios
- KeyMoments composite paired-rule pattern application (newly noted Session 102)

---

## Session 103 opens on

1. Cole confirms `convert-html-to-tiptap` Edge Function manually deleted (Dashboard or CLI). Verify deletion via Supabase MCP `list_edge_functions` — function should no longer appear.
2. Cole confirms PEXELS_API_KEY secret name in Supabase Edge Function secrets. Quick sanity check via Supabase MCP pg_net.http_post against Pexels API with a deliberately wrong key first (confirms 401 envelope shape), then with the real key (confirms 200 + search results structure).
3. H6 v1 backend work begins:
   - SQL migration: `newsletter_ai_conversations` + `newsletter_ai_messages` tables + RLS + action types
   - Edge Function deploy: `newsletter_ai_generate` (Class A, super-admin gated, Anthropic API, BrainWise HTML Authoring Spec as system prompt)
   - Edge Function deploy: `newsletter-image-search` (Class A, super-admin gated, Pexels API)
   - Storage bucket create: `newsletter_ai_attachments` + RLS
4. Lovable cycles build out frontend:
   - Cycle 1: chat panel UI + conversation persistence + replay on mount
   - Cycle 2: selection-aware editing via TipTap selection API + ProseMirror position-based splice
   - Cycle 3: file uploads (PDF/docx/txt/images) to chat context
   - Cycle 4: image search UI + Pexels picker + image attribution rendering (Option B locked)
   - Cycle 5: Opus/Sonnet toggle + final wireup + smoke test
5. Smoke test H6 v1 on 3-5 article drafts of different topic types before declaring H6 v1 done.

Group H formally closes when H6 v1 ships. Then G3+G8+G9 combined pass.
