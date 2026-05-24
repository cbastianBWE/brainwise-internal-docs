# Group H — Newsletter Visual Vocabulary + Layout-Preserving HTML Import

**Status:** Spec complete, ready for Session 97 execution.
**Owner:** Cole Bastian + Claude (engineering lead).
**Scope:** Forward-thinking. Build the full visual vocabulary needed for prospect-facing editorial newsletters. Not MVP.

---

## 1. Problem statement

**Observed:** The G4-C HTML import (Session 95) successfully ingests HTML into TipTap as a flat semantic doc (paragraphs, headings, images, embeds, bold). What's lost: every layout/visual pattern from the source — eyebrow tags, decks, bylines, section rules, multi-column grids, formatted index cards, footnote citations on pullquotes, image-with-caption variants, footer tag strips. The imported article in the editor is text-correct but visually flat.

**Required:** Imports must round-trip layout AND structure, not just semantic content. The published article should look "exactly like the HTML but in BrainWise styling." For prospects evaluating purchase decisions, the editorial polish IS the product signal.

**Constraint:** No mid-MVP shortcuts. Build the full vocabulary. We'd rather skip cheap nodes than ship cheap ones.

---

## 2. Source recon — what the test files actually contain

### 2.1 Tag inventory (from `ptp_test_article_alt_media.html`, 25KB, 837 lines)
- 69 `<div>` (most are layout wrappers — content survives, divs unwrap)
- 25 `<span>` (most are inline emphasis, attribution markers, or layout markers)
- 21 `<p>` (text content)
- 1 `<h1>`, 4 `<h2>`, 5 `<h3>`, 1 `<h4>`
- 3 `<strong>` (bold)
- 2 `<img>` (Pexels CDN images)
- 1 `<iframe>` (YouTube video)
- 1 `<figure>` + 1 `<figcaption>` (inline image with caption)
- 1 `<cite>` (pullquote attribution)

### 2.2 Unique CSS classes (sorted, with semantic intent)
The branded test file uses **45 unique CSS classes**. Grouped by semantic function:

**Structural / page chrome**
- `grain` — decorative SVG noise overlay (skip for v1, page-level treatment)
- `topbar`, `topbar-logo` — masthead row (e.g., "Synapse / Field Notes · ISSUE 047 · 2026")
- `article-wrap` — central content well (already exists in `.newsletter-prose`)
- `footer-meta` — end-of-article tag strip + issue identifier

**Hero / cover treatment**
- `hero`, `hero-img-wrap`, `hero-img`, `hero-img-overlay`, `hero-caption` — full-width cover image with gradient overlay and caption text. **This is already a BrainWise field (cover_asset_id)**. Map to that, not a body node.

**Article opening sequence**
- `eyebrow` — small-caps category line with accent rule before heading ("Applied Neuroscience · Leadership")
- `accent` (on `<span>` inside `<h1>`) — colored/italic emphasis span within heading
- `deck` — large lead paragraph below heading
- `byline` — author + read-time + filed-under strip with dot separators
- `byline-dot` — circular dot separator between byline fields
- `lede` — first body paragraph with drop-cap treatment

**Section dividers**
- `section-rule`, `section-rule-line`, `section-rule-num` — numbered horizontal rule ("[ 01 ]")

**Inline figure**
- `inline-figure` (with `figcaption`) — image + caption block ("01 · Mechanism description")

**Pullquote**
- `pullquote` — large block-quote with accent quote glyph
- `<cite>` inside pullquote — attribution line below quote

**Domain grid (most complex pattern)**
- `domain-grid` — vertical stack of rows separated by hairlines
- `domain-row` — 3-column grid: number | label+desc | count
- `domain-num` — left-column index ("01", "02", ...)
- `domain-main` — center column (label + description)
- `domain-label` — bold label with optional inline tag
- `domain-tag`, `tag-threat`, `tag-reward` — small uppercase chip variants
- `domain-desc` — secondary description text
- `domain-count` — right-aligned big number ("18") + label ("Facets")

**Index cards (two-column metric layout)**
- `index-row` — 2-column grid
- `index-card`, `tri`, `rsi` — card with top accent stripe (color variant)
- `index-tag` — small uppercase label
- `index-name` — large name ("TRI", "RSI")
- `index-formula` — monospace formula box
- `index-note` — description text below

**Callout**
- `callout` — full-width emphasis box with left accent bar
- `callout-label` — small uppercase label ("// The Operating Insight")
- (Callout body uses `<h4>` and `<p>` inside)

**Video embed**
- `video-embed` — iframe container with metadata strip
- `video-embed-frame` — 16:9 aspect-ratio wrapper
- `video-embed-meta` — "WATCH · Background context · 4:32" caption row below iframe

**Tags / chips**
- `tag` — small inline chip ("PTP", "5P Model", "Leadership")

**Inline link variant**
- `inline-link` — link with dashed underline, accent color (not present in test file CSS but documented in stylesheet)

### 2.3 Typography & color tokens used by source

Source uses 3 ink levels (`--ink`, `--ink-dim`, `--ink-mute`), 1 background, 1 surface, 1 rule color, and 3 accents (`--accent` lime, `--accent-warm` orange, `--accent-cool` blue). Fonts: Manrope (body), JetBrains Mono (eyebrow/captions/labels).

**Translation to BrainWise vocabulary:** Source ink levels map to navy / slate-700 / slate-500. Accent maps to BrainWise orange (`#F5741A`) for primary accents, with a secondary accent role for green (`#2D6A4F`) where source uses lime. Mono → JetBrains Mono is fine to keep for editorial caption / label voice (small uppercase letterspaced text). Body font stays Montserrat. Headings stay Poppins.

---

## 3. Current state — what already exists in G4-0

The existing TipTap schema (`src/components/newsletter/tiptap/`) provides:

**Block nodes (custom):**
- `newsletterImage` — image with alt, caption, width, asset_id, import_failed_src
- `newsletterCallout` — emphasis box, variant attr (info/warning/success/error), title, body
- `newsletterStatCallout` — large stat + label box
- `newsletterEmbed` — YouTube / Vimeo / Spotify / generic iframe wrapper
- `newsletterPullquote` — pullquote with attribution
- `newsletterTwoColumn` + `newsletterTwoColumnPane` — two-column layout
- `newsletterKeyMoments` + `newsletterKeyMoment` — multi-item highlight list

**Block nodes (StarterKit baseline):**
- `paragraph`, `heading` (h2/h3/h4 only; h1 reserved for article title), `bulletList`, `orderedList`, `listItem`, `blockquote`, `codeBlock`, `horizontalRule`, `hardBreak`

**Marks:**
- `bold`, `italic`, `strike`, `code`, `link` (safe-URL validated)
- `TextStyleWithFontSize` (allows inline font-size mark, currently used by lesson blocks)

**What's missing for layout-preserving import:** 9+ nodes / marks (see §4).

---

## 4. Proposed BrainWise visual vocabulary (final scope for Group H)

### 4.1 NEW BLOCK NODES (8 to build)

**1. `newsletterEyebrow`** — small-caps category tag above heading
- Attrs: `text` (string), `variant` ('default' | 'accent') — variant controls whether the leading rule is orange or slate
- Visual: 12px JetBrains Mono uppercase, 0.12em letter-spacing, orange (var(--bw-orange)) text, 32px horizontal rule preceding text, 32px top margin
- ParseHTML: `div.eyebrow`, `p.eyebrow`, `[class~="eyebrow"]`
- Slash menu: `/eyebrow`
- Toolbar: included in "section" picker
- ReadView: same as edit view minus drag handle

**2. `newsletterLead`** — large lead paragraph (deck/lede)
- Attrs: `dropcap` (boolean) — when true, first letter becomes orange drop-cap (matches source `.lede` treatment)
- Visual: 21px Montserrat, line-height 1.5, slate-700 (when not dropcap) or navy with orange dropcap (when dropcap=true), max-width 620px, 48px bottom margin
- ParseHTML: `p.deck` → `dropcap=false`, `p.lede` → `dropcap=true`, `[class*="lead"]`, `[class*="deck"]`
- Slash menu: `/lead`, `/lede`
- Author affordance: toggle dropcap on/off in floating attr menu

**3. `newsletterByline`** — author + meta strip
- Attrs: `entries` (array of `{text: string, bold: boolean}`)
- Visual: 12px JetBrains Mono uppercase letterspaced, slate-500 ink, slate-700 for bold names, hairline top + bottom borders, 4px circular dots between entries, 24px vertical padding, 56px bottom margin
- ParseHTML: `div.byline`, `p.byline`, `[class~="byline"]`. Parsing splits content on `<span>` boundaries and detects `<strong>` for bold flag
- Slash menu: `/byline`
- Author affordance: inline editable entry list, "+ Add entry" button, drag-reorder
- Schema validation: max 5 entries, no nested formatting beyond bold

**4. `newsletterSectionRule`** — numbered horizontal divider
- Attrs: `number` (string, e.g., "01" or "I" or any short label), `style` ('numbered' | 'plain')
- Visual: numbered: monospace orange "[ NN ]" + 1px hairline rule taking remaining width; plain: hairline rule only. 80px top margin, 32px bottom margin
- ParseHTML: `div.section-rule`, `hr` with `data-numbered` attr
- Slash menu: `/divider`, `/section`
- Author affordance: number is contentEditable inline

**5. `newsletterDomainGrid` + `newsletterDomainRow`** — labeled metric grid (count for 2)
- Parent attrs: none
- Row attrs: `number` (string, "01"), `label` (string, "Protection"), `tag` (string|null, "Threat"), `tag_variant` ('threat' | 'reward' | 'neutral' | null), `description` (string), `count` (string, "18"), `count_label` (string, "Facets")
- Visual: 3-column grid (60px | 1fr | 100px), hairline top + per-row bottom borders, hover background tint
- ParseHTML: `div.domain-grid` → parent, `div.domain-row` → row (read children for attrs)
- Slash menu: `/grid`, `/domains`
- Author affordance: row-level edit modal with all fields, drag-reorder rows, "+ Add row" button
- Min/max: 2 to 10 rows

**6. `newsletterIndexRow` + `newsletterIndexCard`** — comparative metric cards (count for 2)
- Parent attrs: `columns` (2 | 3, default 2)
- Card attrs: `tag` (string, "Threat Reactivity Index"), `name` (string, "TRI"), `formula` (string|null, the math), `note` (string, description), `accent_color` ('orange' | 'green' | 'teal' | 'navy', controls top stripe color)
- Visual: cards with 2px top accent stripe, surface background (cream-100), hairline border, monospace formula in slate-50 inset box, large bold "name" (32px Poppins 800)
- ParseHTML: `div.index-row` → parent, `div.index-card` → card (reads `tri`/`rsi`/etc. additional classes to determine accent_color)
- Slash menu: `/indices`, `/metric cards`, `/comparison`
- Author affordance: per-card edit modal, drag-reorder cards, +/- columns toggle

**7. `newsletterFooterMeta`** — end-of-article tag strip + issue identifier
- Attrs: `tags` (string[]), `issue_label` (string|null, e.g., "Synapse Field Notes · 047")
- Visual: 96px top margin, hairline top border, monospace uppercase letterspaced, 11px, tags as small chips (5px padding, surface bg, hairline border), justify-between layout
- ParseHTML: `div.footer-meta`
- Slash menu: `/footer-meta`, `/tags`
- Author affordance: tag input with chip display, optional issue label text input
- Render note: this is the bottom of an article — also serves as the marker for "article ends here" for SEO crawlers and reader nav. May want to auto-render at article end when article.tags array is set (defer this decision)

**8. `newsletterInlineFigure`** — image WITH captioned figure semantics (variant of newsletterImage)
- This is **mostly already covered by `newsletterImage` with caption attr**. The visual treatment differs slightly: source uses "FIG." prefix in orange before figcaption text. **Decision: add `caption_style` attr to existing `newsletterImage`** rather than creating a new node. Variants: 'plain' (current behavior, no prefix) | 'figure' (FIG. prefix in orange) | 'cover' (full-bleed with overlay, mapped to article cover_asset_id at import time, not as a body node).
- This is a node REFINEMENT, not a new node. Still counted as part of Group H work.

### 4.2 NEW MARKS (2 to build)

**1. `accent` mark** — colored emphasis text inside headings
- Attrs: `color` ('orange' | 'green' | 'teal'), `style` ('plain' | 'italic')
- Visual: changes text color to specified accent + optional italic. Used for the "how threat profiles" span inside the test file's h1
- ParseHTML: `span.accent` → `color='orange', style='italic'` (default), `span[data-accent]` → reads attr
- Toolbar: bubble menu addition when text is selected inside a heading — "Accent" toggle with color picker
- ReadView: applies the mark styling, no editing UI

**2. `caption` mark (or extend `code`?)** — inline editorial labels
- Decision: probably not needed. The contexts where source uses inline monospace labels (byline entries, eyebrow text, callout-label, video-embed-meta) are all already handled by the parent nodes' typography. Skip unless we find a specific authoring case.

### 4.3 EXTENSIONS TO EXISTING NODES

**`newsletterPullquote`** — add `attribution_style` attr ('plain' | 'editorial')
- Plain (existing default): attribution below quote, italic, small.
- Editorial (new): attribution prefixed with `//`, monospace uppercase letterspaced (matches source `.pullquote cite` treatment)
- ParseHTML enhancement: when parent has `class="pullquote"` and contains `<cite>` with text starting `//`, parse as editorial style
- Editor affordance: variant toggle in node menu

**`newsletterCallout`** — add `label_style` attr ('plain' | 'editorial')
- Plain (existing): title in body, no label
- Editorial: monospace uppercase label above title (matches source `.callout-label` like "// The Operating Insight")
- Add `accent_bar` attr (boolean, default true) — controls whether the left vertical accent bar is shown
- ParseHTML enhancement: `div.callout` with first child `div.callout-label` → editorial style

**`newsletterEmbed`** — add `meta_caption` attr (string|null)
- Source's `.video-embed-meta` ("WATCH · Background context · 4:32") is editorial metadata below the iframe. Add as an optional caption-like field.
- ParseHTML enhancement: when iframe is wrapped in `div.video-embed` with a sibling `div.video-embed-meta`, extract meta text into `meta_caption`

### 4.4 NEW FIELDS ON `newsletter_articles` TABLE

**1. `eyebrow_text` (text, nullable)** — auto-rendered as eyebrow node at article top during read.  
   - When set, the public reader prepends a `newsletterEyebrow` block before the title.  
   - Removes need to manually author the eyebrow in body. Cleaner editorial flow.

**2. `is_issue_based` (boolean, default false) + `issue_label` (text, nullable)**  
   - When true, public reader renders the `newsletterFooterMeta` automatically at article end using article.tags + issue_label.  
   - When false, footer-meta only renders if explicitly added to body.  
   - For "Synapse Field Notes · ISSUE 047" style articles.

**3. `tags` (text[], nullable, indexed via GIN)**  
   - Used by footer-meta auto-render AND by future archive filtering.  
   - Existing schema may already have a `keywords` or `tags` field — needs migration audit before adding.

### 4.5 NEW DESIGN TOKENS

Adding to `newsletter-prose.css` and `marketing-tokens.css`:

```css
:root {
  /* Editorial typography */
  --bw-mono-font: 'JetBrains Mono', monospace;
  --bw-editorial-label-size: 11px;
  --bw-editorial-letterspacing: 0.12em;

  /* Accent stripe heights */
  --bw-stripe-thin: 1px;
  --bw-stripe-medium: 2px;
  --bw-stripe-thick: 3px;

  /* Section rule rhythm */
  --bw-section-rule-margin-top: 80px;
  --bw-section-rule-margin-bottom: 32px;

  /* Dropcap */
  --bw-dropcap-size: 82px;
  --bw-dropcap-color: var(--bw-orange);
}
```

Plus updates to `newsletter-prose.css` adding styles for each new node class.

---

## 5. Architectural shift — generateJSON pattern

### 5.1 Current import architecture (G4-C, in production)

`convert-html-to-tiptap` Edge Function manually walks the DOM (`walkElement` switch on tagName), produces TipTap JSON directly. Each tag has a hard-coded case. Class attributes are ignored. Unknown tags get unwrapped to their children.

**Problem:** every parseHTML decision lives in the Edge Function instead of in the node definitions. Adding a new node = updating both the node file AND the Edge Function walker.

### 5.2 New architecture (Group H target)

Each TipTap node owns its parseHTML rules via the standard `parseHTML()` config. The Edge Function becomes thinner: it does the image pre-pass (still must fetch images server-side because TipTap can't do that) and then calls TipTap's `generateJSON(html, extensions)` to produce the JSON doc.

**Trade-off:** `generateJSON` is a Node.js / browser API. Deno Edge Functions don't natively run it. Two options:

**Option A — Use generateJSON in Deno via @tiptap packages on jsr or npm:**  
TipTap publishes to npm. Deno supports npm via `npm:@tiptap/html`. The `generateJSON(html, extensions)` function exists in `@tiptap/html`. It uses JSDOM under the hood (in Deno, we'd use `npm:jsdom` or `deno-dom`). Verified feasible but adds ~5MB of cold-start weight to the Edge Function. May need testing for compatibility with `deno-dom`.

**Option B — Move HTML→JSON conversion client-side:**  
Browser already has TipTap installed. The modal could call `generateJSON(html, extensions)` directly in the browser, then call the Edge Function ONLY for image pre-pass (fetch and upload external images, return asset_id mapping). Browser produces the final JSON.

**Option C — Keep manual walker, add class-pattern matching:**  
Extend `walkElement` to inspect class attributes. Add a `walkByClass(el, ctx)` dispatcher before the tag switch. Class-to-node mapping table maintained in the Edge Function. Less elegant but no new dependencies.

**Recommendation: Option B.**

**Why:**
- Browser already has TipTap loaded
- No risk of Deno/TipTap compatibility friction
- Image fetching stays on server (SSRF defense, no CORS issues)
- Client gets to do its own validation before submitting
- Edge Function gets simpler (only image fetching, no DOM parsing)
- Class-pattern rules live in node definitions where they belong
- Future-proof: if we ever want a "preview without uploading images" mode, client can do that with placeholders

**Edge Function v3 redesign (Cycle H4):**
- Endpoint becomes: `POST /functions/v1/import-html-images`
- Accepts: `{ image_urls: string[], newsletter_article_id: string }`
- Returns: `{ resolutions: { [original_url: string]: { asset_id: string | null, failure: { kind, detail } | null } } }`
- Browser then runs generateJSON, walks the result, rewrites image URLs to asset_ids using the resolutions map, commits the doc.

This is cleaner overall and reduces server-side complexity.

---

## 6. Build plan — Cycle sequencing

### Cycle H1 — Foundation (this spec, COMPLETE)
- ✓ Recon of test files
- ✓ Class inventory
- ✓ Node catalog decided
- ✓ Architecture decision (Option B — client-side generateJSON)
- ✓ Spec document published

### Cycle H2 — Schema + parseHTML for new nodes (1 session, ~5 Lovable cycles)
**Backend (Supabase migrations):**
- H2-MIG-1: Add `eyebrow_text`, `is_issue_based`, `issue_label` columns to `newsletter_articles`
- H2-MIG-2: Audit existing `tags`/`keywords` field; add `tags text[]` if not present with GIN index
- H2-MIG-3: Update `upsert_article` RPC signature to accept new fields
- H2-MIG-4: Update `get_article_for_reader` RPC to return new fields

**Frontend (Lovable build):**
- H2-FE-1: Add 8 new node schemas to `src/components/newsletter/tiptap/nodes/` (Eyebrow, Lead, Byline, SectionRule, DomainGrid+DomainRow, IndexRow+IndexCard, FooterMeta)
- H2-FE-2: Add `accent` mark to `src/components/newsletter/tiptap/marks/` (new directory)
- H2-FE-3: Extend Pullquote, Callout, Embed schemas with new attrs + parseHTML enhancements
- H2-FE-4: Update `buildExtensions.ts` to include new nodes/marks
- H2-FE-5: Update `tiptapDocToPlainText.ts` (versions module) to handle new node types
- H2-FE-6: Add CSS for all new nodes to `newsletter-prose.css` (both author + read styling)

### Cycle H3 — NodeViews for editor + reader (1 session, ~5 Lovable cycles)
- H3-NV-1: Edit NodeViews for all 8 new nodes (with affordances: drag handle, edit modal, drag-reorder for grid/row children, +/- entry buttons)
- H3-NV-2: Read NodeViews for all 8 new nodes (simpler, no edit affordances)
- H3-NV-3: Slash menu entries for each new node
- H3-NV-4: Floating attribute editors (for accent mark color picker, dropcap toggle on lead, etc.)
- H3-NV-5: Eyebrow auto-render: `NewsletterArticle.tsx` (reader) prepends eyebrow block if `eyebrow_text` is set
- H3-NV-6: Footer-meta auto-render: `NewsletterArticle.tsx` appends footer-meta if `is_issue_based=true`
- H3-NV-7: AdminNewsletterArticle.tsx sidebar additions: eyebrow_text input, is_issue_based toggle, issue_label input, tags input

### Cycle H4 — Image-only Edge Function (1 session, ~2 Lovable cycles)
- H4-BE-1: New Edge Function `import-html-images` (`convert-html-to-tiptap` deprecated and removed)
- H4-BE-2: Class A auth (super-admin gate), SSRF defense, same 30-image / 10MB limits as v1
- H4-BE-3: Returns `resolutions` map only — no DOM walking, no TipTap generation server-side
- H4-FE-1: Modal refactor (`ImportHtmlModal.tsx`): client now (a) parses HTML in browser, (b) extracts image URLs, (c) calls `import-html-images` for resolutions, (d) rewrites img src to asset_id refs in DOM, (e) calls `generateJSON(modifiedHtml, extensions)`, (f) previews + commits
- H4-FE-2: Update modal stats display (still shows images attempted/succeeded/failed, tag drops)
- H4-FE-3: Migrate orphan-sweep parent enumeration if any RPC signatures changed

### Cycle H5 — Iteration on fidelity (1 session, however many cycles needed)
- H5-1: Re-import branded test file. Visual diff against original.
- H5-2: Identify any remaining gaps (likely smaller things: spacing variations, edge cases)
- H5-3: Tighten parseHTML rules, adjust CSS, add missing affordances
- H5-4: Repeat with the unbranded test file
- H5-5: Test with a 3rd HTML file Cole brings (different vocabulary, validates generality)

### Cycle H6 — Claude vocabulary prompt (1 session)
- H6-1: Document BrainWise's class vocabulary in a markdown file (`BRAINWISE_HTML_VOCABULARY.md`)
- H6-2: Distill into a Claude prompt template Cole can use: "Write a BrainWise newsletter article using these HTML class names: eyebrow, deck, byline, section-rule, domain-grid, index-row, callout, pullquote, video-embed, footer-meta. Map content to: [user describes content]."
- H6-3: Test the prompt with 2-3 article drafts. Tune until Claude consistently produces import-clean HTML.
- H6-4: Store the prompt template in the super-admin newsletter UI as a "Generate with AI" affordance for future use

---

## 7. Estimated effort

| Cycle | Sessions | Lovable cycles | Risk | Notes |
|---|---|---|---|---|
| H1 (spec) | 0.5 | 0 | Low | Done |
| H2 (schema) | 1 | 4-5 | Med | Schema breakage if migration order wrong |
| H3 (nodeviews) | 1 | 5-6 | Med | Visual fidelity per node is finicky |
| H4 (edge fn) | 1 | 2-3 | High | New Deno dep on TipTap-in-browser; image flow refactor |
| H5 (iteration) | 1-2 | 3-5 | Med | Unknown unknowns from real-world HTML variants |
| H6 (prompt) | 1 | 1 | Low | Mostly content/prompt engineering, not code |
| **Total** | **5-6 sessions** | **15-20 cycles** | | |

---

## 8. Deferred / explicitly out of scope

**Skipped for Group H:**
- `grain` overlay (decorative SVG noise on body bg) — page-level treatment, would require sitewide CSS, not a node
- `hero` cover image with overlay — maps to existing `cover_asset_id` field at IMPORT TIME (rewrite during convert), not a body node
- `topbar` masthead — would only matter for "Synapse-style" newsletters; can be expressed via eyebrow + tags
- Image gallery (multi-image grid) — defer to a future Group I
- Image compare slider (before/after) — too narrow a use case
- Tables (`<table>`, `<tr>`, `<td>`) — TipTap has these built-in; we can drop in `@tiptap/extension-table` if needed in a single line, but no special BrainWise styling for v1
- Footnotes with backreferences — defer to future
- LaTeX/Math equations — defer to future
- Code syntax highlighting — defer (current `codeBlock` is plain)

**Other deferred concerns:**
- Email (G8) compatibility: the new nodes need email-safe renderers. Defer that to G8 itself.
- Reader-side mobile responsiveness: each new node needs a mobile design. Spec doesn't lock these down; defer to H3 build with "make it work on 320px+" as the criterion.
- Print stylesheets: defer
- RTL language support: defer

---

## 9. Open questions / decisions to make in execution

1. **DomainGrid vs KeyMoments — do we keep both?**  
   They overlap conceptually (both are labeled metric lists). Decision: keep both. DomainGrid is for "structured data tables" (number/label/tag/desc/count layout). KeyMoments is for "highlight callouts" (free-form key + value). The visual treatments differ enough to justify two.

2. **Eyebrow as body node vs article field?**  
   Spec says BOTH (field auto-renders, plus body node for additional eyebrows mid-article). Verify in H3 whether the body-node use case is actually needed; if not, simplify to field only.

3. **Should `accent` mark support inline emphasis on body text or only headings?**  
   Spec defaults to "any text." Confirm in execution. May limit to headings if it produces visual noise in body.

4. **FooterMeta auto-render vs always manual?**  
   Spec says auto when `is_issue_based=true`. Alternative: always manual via body node. Auto-render is cleaner but couples reader logic to article field state.

5. **`source_type` column already has values 'native' | 'html_import'. Should imports from the new class-aware system get a new value 'html_import_v2'?**  
   Useful for analytics ("which imports used the new vocabulary"). Probably yes, add a CHECK constraint update in H2-MIG-1.

---

## 10. Sign-off checklist before H2 starts

Before Cycle H2 begins, confirm:

- [ ] Cole reviewed §4 node list and approves the 8 new nodes + 1 mark + 3 extensions
- [ ] Cole reviewed §5 architectural shift (Option B, client-side generateJSON) and approves
- [ ] Cole reviewed §6 cycle sequencing — willing to invest 5-6 sessions
- [ ] Cole reviewed §8 deferred list — confirms nothing critical was deferred
- [ ] Cole flags any visual references he wants me to study before H3 (other newsletters, design systems)

This spec is the source of truth for everything after this session. Modifications during execution should reference back to this doc.
