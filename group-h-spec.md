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

## 4. Proposed BrainWise visual vocabulary — FULL CATALOG

**Design philosophy:** This is not a scoped MVP node list. It is the complete editorial vocabulary BrainWise needs to be best-in-class for prospect-facing newsletters. The intent is that ANY visual pattern Cole encounters in source HTML (his own authoring, Claude-generated artifacts, exports from Substack/Medium/Ghost/Beehiiv, third-party article HTML) maps cleanly to a BrainWise node. If a node is missing, articles look "stripped-down." If the catalog is complete, every import looks intentional.

Nodes are grouped by editorial function. Each entry includes: name, attrs, visual treatment intent, parseHTML target patterns, slash menu trigger, author affordances, and notes. Existing G4-0 nodes are marked ✓. Nodes that need refinement are marked ↻. New nodes are marked ➕. Order within each group is rough priority (top of group = highest priority for H2 first pass).

### 4.1 STRUCTURAL — page chrome, hierarchy, framing

✓ **`paragraph`** (StarterKit) — standard body paragraph
✓ **`heading`** (StarterKit, levels 2/3/4 — h1 reserved for article title field)
✓ **`bulletList`, `orderedList`, `listItem`** (StarterKit)
✓ **`blockquote`** (StarterKit) — generic blockquote (distinct from pullquote which is a feature treatment)
✓ **`codeBlock`** (StarterKit) — plain monospace code block
✓ **`horizontalRule`** (StarterKit) — generic divider (distinct from sectionRule which is editorial)
✓ **`hardBreak`** (StarterKit) — line break within paragraph

➕ **`newsletterEyebrow`** — small-caps category tag above a heading or article start
- Attrs: `text` (string), `variant` ('default' | 'accent' | 'muted'), `with_rule` (boolean, default true — leading horizontal rule)
- Visual: monospace uppercase letterspaced 12px, accent color (orange default, slate-700 for muted), 32px leading horizontal rule
- ParseHTML: `div.eyebrow`, `p.eyebrow`, `[class~="eyebrow"]`, `[class~="kicker"]`, `[class~="category"]`, `[data-bw-node="eyebrow"]`
- Slash: `/eyebrow`, `/kicker`, `/category`
- Affordances: inline editable text, variant picker in node menu

➕ **`newsletterLead`** — large lead paragraph (deck/lede/standfirst)
- Attrs: `dropcap` (boolean), `style` ('deck' | 'lede' | 'pullout') — deck=light slate, lede=full ink, pullout=accent-colored
- Visual: 21px Montserrat, line-height 1.5, max-width 620px, 48px bottom margin; when dropcap=true, first letter becomes orange 82px float-left
- ParseHTML: `p.deck` (dropcap=false, style=deck), `p.lede` (dropcap=true, style=lede), `p.lead`, `p.standfirst`, `[class*="lead-paragraph"]`
- Slash: `/lead`, `/lede`, `/deck`
- Affordances: dropcap toggle, style variant picker

➕ **`newsletterSectionRule`** — numbered or styled section divider
- Attrs: `number` (string, "01" or "I" or short label), `style` ('numbered' | 'plain' | 'titled' | 'dot'), `title` (string|null, used when style=titled)
- Visual: numbered → monospace orange "[ NN ]" + 1px hairline taking remaining width; plain → hairline only; titled → orange title + hairline; dot → three centered dots (• • •) for soft section breaks
- ParseHTML: `div.section-rule`, `hr.section-rule`, `div.section-break`, `hr[data-numbered]`, `hr.dot-divider`
- Slash: `/divider`, `/section`, `/break`
- Affordances: style variant picker, number/title contentEditable

➕ **`newsletterByline`** — author + meta strip
- Attrs: `entries` (array of `{text: string, bold: boolean, link?: string}`), `separator_style` ('dot' | 'pipe' | 'slash')
- Visual: monospace uppercase letterspaced 12px, hairline top + bottom borders, 24px vertical padding, configurable separator between entries
- ParseHTML: `div.byline`, `p.byline`, `address.byline`, `[class~="byline"]`, `[class~="author-meta"]`. Parses spans, detects `<strong>` for bold, detects `<a>` for link
- Slash: `/byline`, `/author`
- Affordances: inline editable entry list with +/- buttons, drag-reorder, per-entry bold/link toggle, separator style picker

➕ **`newsletterMasthead`** — issue masthead strip ("Synapse / Field Notes · ISSUE 047 · 2026")
- Attrs: `publication` (string), `issue_label` (string|null), `date_label` (string|null), `logo_glyph` (string|null) — e.g. "▲" before publication name
- Visual: full-width strip, monospace uppercase, hairline bottom border, displayed at top of article above hero/title
- ParseHTML: `div.topbar`, `div.masthead`, `header.publication`, `[data-bw-node="masthead"]`
- Slash: `/masthead`, `/topbar`
- Affordances: three text fields, optional glyph picker (▲ ◆ ● ■ etc.)

### 4.2 EMPHASIS — visual weight, editorial pause

✓ **`newsletterCallout`** (existing) — emphasis box with left accent bar
- Existing attrs: variant (info/warning/success/error), title, body
- ↻ Extend: add `label_style` ('plain' | 'editorial' — editorial = monospace uppercase label like "// The Operating Insight"), `accent_bar` (boolean default true), `tone` ('default' | 'neutral' | 'cautionary' | 'celebratory' | 'editorial')
- ParseHTML add: `div.callout`, `aside.callout`, `div[class~="note"]`, `div[class~="info-box"]`, `div[class~="alert"]`. First child `.callout-label` → editorial style

✓ **`newsletterPullquote`** (existing) — large emphasized quote
- ↻ Extend: add `attribution_style` ('plain' | 'editorial' — editorial = `//` prefix monospace uppercase), `quote_glyph` ('curly' | 'angle' | 'none'), `alignment` ('left' | 'center')
- ParseHTML add: `div.pullquote`, `aside.pullquote`, `blockquote.pullquote`, `[class~="pull-quote"]`, `[class~="featured-quote"]`. `<cite>` child with text starting `//` → editorial style

✓ **`newsletterStatCallout`** (existing) — single stat + label
- ↻ Extend: add `size` ('default' | 'large' | 'jumbo'), `accent_color` ('orange' | 'green' | 'teal' | 'navy' | 'purple')
- ParseHTML add: `div.stat`, `div.metric`, `[class~="big-number"]`

➕ **`newsletterAside`** — secondary content / "by the way" box
- Attrs: `label` (string|null, e.g. "Aside" or "Background"), `tone` ('default' | 'subtle')
- Visual: lighter weight than callout, no accent bar, surface-tinted background, smaller font, indented from main column
- ParseHTML: `aside`, `div.aside`, `div.sidebar`, `[class~="by-the-way"]`
- Slash: `/aside`, `/sidebar`

➕ **`newsletterFootnoteRef` (mark) + `newsletterFootnotes` (block)** — paired footnote system
- Ref attrs (mark): `footnote_id` (string), `display_number` (int auto-computed)
- Block attrs: `entries` (array of `{id, html_content}`)
- Visual: ref renders as superscript orange number that scroll-anchors to entries block; entries block at article end, hairline top border, numbered list
- ParseHTML: `sup.footnote-ref` + `<a href="#fn-N">` for refs; `ol.footnotes`, `div.footnotes`, `section.footnotes` for block
- Slash: `/footnote`
- Affordances: inline "+ footnote" button, content editor for each entry, auto-renumbering on add/remove

➕ **`newsletterDefinition`** — inline term + definition pair (glossary-style)
- Attrs: `term` (string), `definition` (rich text), `style` ('inline' | 'card')
- Visual: inline = dashed underline on term with hover tooltip; card = full-width labeled box "TERM — definition text"
- ParseHTML: `dl.glossary`, `dfn`, `[class~="definition"]`, `[class~="term-def"]`
- Slash: `/define`, `/term`

➕ **`newsletterDisclosure`** — collapsible details/summary
- Attrs: `summary` (string), `body` (rich text), `default_open` (boolean)
- Visual: clickable summary with chevron, expands to reveal body content with hairline left border
- ParseHTML: `<details>` + `<summary>`, `div.disclosure`, `div.collapsible`
- Slash: `/disclosure`, `/collapsible`, `/details`

### 4.3 INLINE — text-level formatting (marks)

✓ **`bold`, `italic`, `strike`, `code`, `link`** (StarterKit + Link with safe-URL)
✓ **`TextStyleWithFontSize`** (existing inline font-size mark from lesson blocks)

➕ **`accent` mark** — colored/styled emphasis text
- Attrs: `color` ('orange' | 'green' | 'teal' | 'navy' | 'purple' | 'mustard'), `style` ('plain' | 'italic' | 'bold-italic'), `weight` ('normal' | 'heavy')
- Visual: changes text color + optional italic/weight inside heading or body
- ParseHTML: `span.accent`, `span[data-accent]`, `mark.accent`, `em.accent`
- Bubble menu: "Accent" picker when text selected (color + style + weight)

➕ **`smallCaps` mark** — small caps for inline editorial labels
- Visual: `font-variant-caps: all-small-caps` + slight letter-spacing
- ParseHTML: `span.small-caps`, `[style*="small-caps"]`, `span[data-smallcaps]`
- Bubble menu: toggle

➕ **`superscript` mark** + **`subscript` mark** — typographic positioning
- Visual: `vertical-align: super/sub` + smaller font
- ParseHTML: `<sup>`, `<sub>`
- Bubble menu: toggle pair

➕ **`underline` mark** — explicit underline (distinct from link underline)
- ParseHTML: `<u>`, `[style*="underline"]`, `[class~="underline"]`
- Bubble menu: toggle

➕ **`highlight` mark** — background-color emphasis
- Attrs: `color` ('yellow' | 'orange' | 'green' | 'pink' | 'blue')
- Visual: soft background tint behind text
- ParseHTML: `mark`, `span.highlight`, `[style*="background"]`
- Bubble menu: color picker

➕ **`keyboard` mark** — keyboard input styling
- Visual: monospace, surface background, 1px slate border, slight inset shadow
- ParseHTML: `<kbd>`
- Bubble menu: toggle

➕ **`abbr` mark** — abbreviation with title attribute
- Attrs: `title` (string)
- Visual: dotted underline, hover-reveals title
- ParseHTML: `<abbr title="...">`
- Bubble menu: with title input

### 4.4 MEDIA — images, video, audio, embeds

✓ **`newsletterImage`** (existing) — image with caption support
- Existing attrs: alt, caption, width, asset_id, import_failed_src
- ↻ Extend: add `caption_style` ('plain' | 'figure' — adds "FIG." prefix in orange | 'minimal'), `alignment` ('inline' | 'wide' | 'full-bleed' | 'left' | 'right'), `frame` ('none' | 'border' | 'shadow' | 'rounded'), `caption_position` ('below' | 'overlay-bottom' | 'side')
- ParseHTML add: `<figure>` + `<figcaption>` → caption_style='figure', `img.full-bleed`, `img.wide`, `picture` element support

✓ **`newsletterEmbed`** (existing) — iframe wrappers for video/audio
- Existing attrs: provider, embed_id, url, title
- ↻ Extend: add `meta_caption` (string|null — "WATCH · Background context · 4:32" style), `aspect_ratio` ('16:9' | '4:3' | '1:1' | '9:16'), `frame_style` ('none' | 'editorial' — bordered with meta strip below)
- ParseHTML add: `div.video-embed` wrapping iframe, `div.video-embed-meta` sibling → meta_caption, support for additional providers: SoundCloud, Apple Podcasts, Twitch, Loom, Wistia, Descript

➕ **`newsletterImageGallery`** — multi-image grid
- Attrs: `columns` (2 | 3 | 4), `gap` ('tight' | 'normal' | 'wide'), `caption` (string|null overall caption), images (array of `{asset_id, alt, caption}`)
- Visual: CSS grid with consistent aspect ratios, optional per-image captions, lightbox on click in reader
- ParseHTML: `div.gallery`, `div.image-grid`, `figure.gallery`, multiple consecutive `<img>` wrapped in a single container
- Slash: `/gallery`

➕ **`newsletterImageCompare`** — before/after slider
- Attrs: `before_asset_id`, `after_asset_id`, `before_label`, `after_label`, `default_position` (0-100)
- Visual: split-view slider, draggable divider, labels float above
- ParseHTML: `div.compare`, `div.before-after`, custom data attributes
- Slash: `/compare`

➕ **`newsletterAudio`** — native audio player (distinct from podcast embed)
- Attrs: `asset_id`, `title`, `duration_seconds`, `transcript_url` (optional)
- Visual: full-width player with waveform, title, duration, transcript toggle if present
- ParseHTML: `<audio>` element, `div.audio-player`
- Slash: `/audio`

### 4.5 LAYOUT — multi-column, structured data displays

✓ **`newsletterTwoColumn` + `newsletterTwoColumnPane`** (existing) — generic two-column
- ↻ Extend parent attrs: add `gap` ('tight' | 'normal' | 'wide'), `ratio` ('1:1' | '2:1' | '1:2' | '3:2'), `vertical_align` ('top' | 'center' | 'baseline')
- ↻ Extend pane attrs: add `background` ('none' | 'surface' | 'accent'), `padding` ('none' | 'normal' | 'roomy')
- ParseHTML add: `div.two-col`, `div.split`, `div.grid-2`

✓ **`newsletterKeyMoments` + `newsletterKeyMoment`** (existing) — multi-item highlight list
- Existing: free-form key + value pairs
- ↻ Extend item attrs: add `tone` ('default' | 'highlighted' | 'muted'), `icon_glyph` (string|null)
- ParseHTML add: `div.key-moments`, `ol.takeaways`, `[class~="highlights"]`

➕ **`newsletterThreeColumn` + `newsletterThreeColumnPane`** — three-up grid
- Attrs: same as TwoColumn but 3 panes
- Visual: stacks to single column on mobile <600px
- ParseHTML: `div.three-col`, `div.grid-3`, `div.tri-column`
- Slash: `/three-column`

➕ **`newsletterFourColumn` + `newsletterFourColumnPane`** — four-up grid (for stats grids, icon grids)
- Attrs: same as TwoColumn but 4 panes
- Visual: stacks to 2x2 on tablet, single column on mobile
- ParseHTML: `div.four-col`, `div.grid-4`, `div.quad-column`
- Slash: `/four-column`

➕ **`newsletterDomainGrid` + `newsletterDomainRow`** — labeled metric grid (the "domain-grid" pattern from source)
- Parent attrs: `style` ('rows' | 'cards'), `show_numbers` (boolean default true)
- Row attrs: `number` (string), `label` (string), `tag_text` (string|null), `tag_variant` ('threat'|'reward'|'neutral'|'success'|'warning'|null), `description` (string), `count_value` (string), `count_label` (string)
- ParseHTML: `div.domain-grid` parent, `div.domain-row` child
- Slash: `/grid`, `/domains`, `/metric-list`

➕ **`newsletterIndexRow` + `newsletterIndexCard`** — comparative metric cards
- Parent attrs: `columns` (2 | 3, default 2)
- Card attrs: `tag` (string), `name` (string), `formula` (string|null), `note` (string), `accent_color` ('orange'|'green'|'teal'|'navy'|'purple')
- ParseHTML: `div.index-row` parent, `div.index-card` child
- Slash: `/indices`, `/metric-cards`, `/comparison`

➕ **`newsletterStepList` + `newsletterStep`** — numbered step-by-step process
- Parent attrs: `style` ('vertical' | 'horizontal'), `connector` ('line' | 'arrow' | 'none')
- Step attrs: `number` (auto), `title` (string), `body` (rich text), `glyph` (string|null icon)
- Visual: vertical = numbered circles connected by line; horizontal = inline timeline
- ParseHTML: `ol.steps`, `div.process`, `div.timeline`, `[class~="step-list"]`
- Slash: `/steps`, `/process`, `/timeline`

➕ **`newsletterChecklist` + `newsletterChecklistItem`** — task/checklist list (distinct from ordered list)
- Item attrs: `checked` (boolean), `body` (rich text)
- Visual: square or circular checkbox glyph, struck-through when checked
- ParseHTML: `<input type="checkbox">` inside list items, `ul.checklist`, `[class~="task-list"]`
- Slash: `/checklist`, `/tasks`
- Affordances: click checkbox to toggle (preserves in published version, not interactive in reader for non-authors)

### 4.6 DATA — tables, charts, structured information

➕ **`table` + `tableRow` + `tableHeader` + `tableCell`** — full tables via @tiptap/extension-table
- Attrs on cell: `colspan`, `rowspan`, `align`
- Visual: hairline borders, header row with surface background, alternating row tint optional, mobile-responsive (horizontal scroll OR collapse to cards)
- ParseHTML: native `<table>` / `<tr>` / `<th>` / `<td>` (TipTap extension handles this natively)
- Slash: `/table`
- Affordances: row/column add/remove, header toggle, alignment per cell, full keyboard navigation

➕ **`newsletterStatGrid`** — grid of stat callouts (multi-stat dashboard)
- Attrs: `columns` (2 | 3 | 4), stats (array of `{value, label, change, change_direction}`)
- Visual: grid of stat cards, each with large number + label + optional delta indicator
- ParseHTML: `div.stat-grid`, `div.stats-row`, multiple `[class~="stat-card"]` siblings
- Slash: `/stat-grid`, `/stats`

➕ **`newsletterChart`** — embedded chart (initially placeholder/image-based)
- Attrs: `chart_type` ('line' | 'bar' | 'pie' | 'donut' | 'area' | 'image'), `data_json` (string — chart.js compatible config), `caption` (string|null)
- Visual: rendered chart in BrainWise color palette; for v1, image-based fallback if chart_type='image'
- ParseHTML: `figure.chart`, `div.chart`, `[data-chart]`, fallback to `<img>` with chart-like alt text
- Slash: `/chart`
- Notes: full chart-rendering may be a phase-2 deliverable. v1 ships with the schema + image fallback so that placeholder chart imports work and content survives.

### 4.7 CODE & TECHNICAL — for technical newsletters

✓ **`codeBlock`** (existing, plain)
- ↻ Extend: add `language` (string|null for syntax highlighting hint), `show_line_numbers` (boolean), `highlight_lines` (string|null — e.g. "3,5-7"), `filename` (string|null shown as caption above code)
- Visual: monospace, surface bg, syntax-highlight CSS classes via Prism or Shiki (deferred to phase 2), line numbers in gutter
- ParseHTML add: `<pre>` + `<code class="language-X">`, `div.code-block`, `figure.code` with caption

➕ **`newsletterCodeDiff`** — diff view (before/after code)
- Attrs: `before_text`, `after_text`, `language`, `filename`
- Visual: split or unified view with red/green line highlights
- ParseHTML: `div.diff`, `div.code-diff`, `<pre class="diff">`
- Slash: `/diff`, `/code-diff`

➕ **`newsletterTerminal`** — terminal/command-line block
- Attrs: `commands` (array of `{prompt, command, output}`), `theme` ('dark' | 'light')
- Visual: dark terminal-style block, prompt in green, commands in white, output in slate
- ParseHTML: `pre.terminal`, `div.terminal`, `[class~="cli"]`
- Slash: `/terminal`, `/cli`

➕ **`newsletterMath`** — mathematical expression (LaTeX/MathJax)
- Attrs: `latex` (string), `display` ('inline' | 'block')
- Visual: rendered via KaTeX (phase 2) or as fallback monospace
- ParseHTML: `<math>`, `span.math`, `div.math`, `[data-latex]`
- Slash: `/math`, `/equation`
- Notes: v1 ships schema + raw LaTeX display fallback. KaTeX integration phase 2.

### 4.8 INTERACTIVE — engagement elements

➕ **`newsletterPoll`** — simple poll (anonymous, single-question)
- Attrs: `question` (string), `options` (array of strings), `style` ('buttons' | 'bars'), `votes_visible` (boolean)
- Visual: poll question + option buttons, post-vote shows percentage bars
- Backend: requires `newsletter_polls` + `newsletter_poll_votes` tables (new — adds to spec)
- ParseHTML: `div.poll`, `form.poll`, `[data-bw-node="poll"]`
- Slash: `/poll`
- Notes: significant backend addition; can be schema-only in H2 with full backend in a later cycle. Spec records the intent.

➕ **`newsletterCTA`** — call-to-action button block
- Attrs: `label` (string), `url` (string), `variant` ('primary' | 'secondary' | 'ghost'), `size` ('default' | 'large'), `tracking_id` (string|null)
- Visual: centered button with BrainWise orange primary, navy secondary, ghost variant for low-emphasis
- ParseHTML: `a.cta`, `a.button`, `div.cta-block`, `[class~="call-to-action"]`
- Slash: `/cta`, `/button`

➕ **`newsletterSubscribeBlock`** — inline subscribe form (reuses G6 SubscribeForm)
- Attrs: `headline` (string), `subtext` (string), `variant` ('full' | 'inline')
- Visual: card or inline embed of the existing SubscribeForm component
- ParseHTML: `div.subscribe`, `div.newsletter-signup`, `[data-bw-node="subscribe"]`
- Slash: `/subscribe`
- Affordances: limit to one per article (validation in author UI)

➕ **`newsletterRelatedArticles`** — auto-linked related articles
- Attrs: `mode` ('manual' | 'auto-by-tags' | 'auto-by-category'), `article_ids` (uuid[]), `display_style` ('cards' | 'list' | 'inline')
- Visual: row of newsletter article cards (reuses G6 NewsletterArticleCard)
- ParseHTML: `div.related-articles`, `aside.related`, `[data-bw-node="related"]`
- Slash: `/related`

### 4.9 ARTICLE END — closing elements

➕ **`newsletterFooterMeta`** — end-of-article tag strip + issue identifier
- Attrs: `tags` (string[]), `issue_label` (string|null), `show_share_links` (boolean)
- Visual: monospace uppercase, hairline top border, tags as chips, justify-between layout, optional share buttons (X, LinkedIn, copy-link)
- ParseHTML: `div.footer-meta`, `footer.article`, `[class~="article-footer"]`
- Slash: `/footer-meta`, `/article-end`
- Notes: when article-level `is_issue_based=true`, reader auto-renders this from article.tags + article.issue_label

➕ **`newsletterAuthorBio`** — author bio block at article end
- Attrs: `user_id` (uuid, references users), `style` ('compact' | 'expanded'), `show_follow_links` (boolean)
- Visual: author photo + name + bio + optional social links; pulls from users.bio (deferred field) and existing profile
- ParseHTML: `div.author-bio`, `[data-bw-node="author"]`, `[class~="byline-card"]`
- Slash: `/author-bio`
- Notes: depends on the deferred `users.bio` column + author bio edit UI item from prior build queue. Add that work as H2 prereq if author bio block ships in v1.

➕ **`newsletterCitations`** — references/works-cited block
- Attrs: `style` ('chicago' | 'apa' | 'mla' | 'plain'), `entries` (array of `{author, title, source, year, url}`)
- Visual: hairline top border, monospace numbered list, hanging indent
- ParseHTML: `ol.citations`, `div.references`, `section.bibliography`
- Slash: `/citations`, `/references`

➕ **`newsletterFurtherReading`** — recommended reading list (distinct from related articles — external links)
- Attrs: entries (array of `{title, source, url, blurb?}`)
- Visual: hairline top border, "FURTHER READING" eyebrow, list of titled links with optional one-line description
- ParseHTML: `div.further-reading`, `aside.recommendations`, `[class~="read-more"]`
- Slash: `/further-reading`, `/recommendations`

### 4.10 NEW MARK + NODE TYPE COUNTS

**Total catalog at end of Group H:**
- ✓ Existing nodes/marks from G4-0: 16
- ↻ Refined existing: 6 (Callout, Pullquote, StatCallout, Image, Embed, TwoColumn, KeyMoments, codeBlock — adding attrs/parseHTML)
- ➕ New block nodes: 33
- ➕ New marks: 7

**Final catalog size: ~50 distinct block nodes + 13 marks.**

That is the scope of "best in class." This is not aspirational over-scoping — every node in §4 is justified by a real editorial pattern that prospect-facing newsletters use.

### 4.11 NEW FIELDS ON `newsletter_articles` TABLE

**1. `eyebrow_text` (text, nullable)** — auto-renders as eyebrow node at article top during read
**2. `is_issue_based` (boolean, default false) + `issue_label` (text, nullable)** — when true, footer-meta auto-renders at article end
**3. `tags` (text[], nullable, indexed via GIN)** — used by footer-meta auto-render + future archive filtering + related-articles auto-discovery
**4. `masthead_publication` (text, nullable) + `masthead_logo_glyph` (text, nullable)** — for issue-based publications (Synapse Field Notes style); when set, reader prepends masthead block automatically
**5. `default_layout_width` (text, default 'standard')** — 'standard' | 'wide' | 'narrow' — controls the article-wrap max-width
**6. `theme_variant` (text, default 'default')** — 'default' | 'editorial' | 'minimal' | 'technical' — variant affects typography weights, accent intensities, spacing rhythm globally for that article

### 4.12 NEW DESIGN TOKENS

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

  /* Accent variants (extends existing palette) */
  --bw-accent-orange: #F5741A;  /* primary */
  --bw-accent-green: #2D6A4F;
  --bw-accent-teal: #006D77;
  --bw-accent-purple: #3C096C;
  --bw-accent-mustard: #7a5800;
  --bw-accent-navy: #021F36;

  /* Layout variants */
  --bw-content-width-narrow: 640px;
  --bw-content-width-standard: 780px;
  --bw-content-width-wide: 920px;

  /* Grid gaps */
  --bw-grid-gap-tight: 8px;
  --bw-grid-gap-normal: 16px;
  --bw-grid-gap-wide: 32px;
}
```

### 4.13 NODE-ORDERING WITHIN H2

H2 builds the entire schema layer. Implementation order matters because dependent nodes (parent/child pairs) must be defined together. Suggested order:

**Pass 1 — foundational singletons:** Eyebrow, Lead, SectionRule, Byline, Masthead, Aside, Accent mark
**Pass 2 — composite (parent + child pairs):** DomainGrid+Row, IndexRow+Card, StepList+Step, Checklist+Item, ThreeColumn+Pane, FourColumn+Pane, ImageGallery, StatGrid
**Pass 3 — extensions to existing nodes:** Callout/Pullquote/StatCallout/Image/Embed/TwoColumn/KeyMoments/codeBlock refinements
**Pass 4 — marks:** all 7 new marks
**Pass 5 — interactive/data nodes:** Table, Audio, ImageCompare, Math, Terminal, CodeDiff, Chart placeholder
**Pass 6 — article-end:** FooterMeta, AuthorBio, Citations, FurtherReading
**Pass 7 — interactive/social:** CTA, SubscribeBlock, RelatedArticles, Disclosure, Definition, FootnoteRef + Footnotes
**Pass 8 — backend-dependent:** Poll (requires new tables; can ship schema-only in H2, full backend in later cycle)

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
- ✓ Full class inventory
- ✓ Complete node catalog decided per §4 (no MVP scope-down)
- ✓ Architecture decision (Option B — client-side generateJSON)
- ✓ Spec document published as authoritative source for Sessions 96-100+

### Cycle H2 — Schema + parseHTML for ENTIRE catalog (2-3 sessions)

Backend (Supabase migrations — run first, verify each before next):
- H2-MIG-1: Add new columns to `newsletter_articles`: `eyebrow_text`, `is_issue_based`, `issue_label`, `masthead_publication`, `masthead_logo_glyph`, `default_layout_width`, `theme_variant`, `tags text[]` (if missing) with GIN index
- H2-MIG-2: Update `upsert_article` RPC signature to accept all new fields
- H2-MIG-3: Update `get_article_for_reader` RPC return to include all new fields
- H2-MIG-4: Update `list_admin_newsletter_articles` to include new fields in row output
- H2-MIG-5: If Poll node included in H2 scope: `newsletter_polls` + `newsletter_poll_votes` tables + RLS + RPCs (can defer the voting backend, but schema-side enough to satisfy node FK)
- H2-MIG-6: If AuthorBio node included: `users.bio` column + RLS (promote from existing deferred build queue item)

Frontend (Lovable cycles — execute per §4.13 pass ordering):
- **H2-FE-Pass1: Foundational singletons (4-6 Lovable cycles)** — Eyebrow, Lead, SectionRule, Byline, Masthead, Aside; plus `accent` mark
- **H2-FE-Pass2: Composite parent+child pairs (4-6 cycles)** — DomainGrid+Row, IndexRow+Card, StepList+Step, Checklist+Item, ThreeColumn+Pane, FourColumn+Pane, ImageGallery, StatGrid
- **H2-FE-Pass3: Extensions to existing nodes (2-3 cycles)** — Callout/Pullquote/StatCallout/Image/Embed/TwoColumn/KeyMoments/codeBlock refinements per §4 ↻ entries
- **H2-FE-Pass4: Remaining marks (1-2 cycles)** — smallCaps, superscript, subscript, underline, highlight, keyboard, abbr
- **H2-FE-Pass5: Interactive/data nodes (2-3 cycles)** — Table (via @tiptap/extension-table), Audio, ImageCompare, Math (schema only), Terminal, CodeDiff, Chart (schema + image fallback)
- **H2-FE-Pass6: Article-end nodes (2 cycles)** — FooterMeta, AuthorBio (if H2-MIG-6 shipped), Citations, FurtherReading
- **H2-FE-Pass7: Interactive/social (2 cycles)** — CTA, SubscribeBlock, RelatedArticles, Disclosure, Definition, FootnoteRef + Footnotes
- **H2-FE-Pass8: Backend-dependent (1 cycle, schema-only if backend deferred)** — Poll
- **H2-FE-Final: Wire-up (1 cycle)** — update `buildExtensions.ts` to include EVERY new node/mark, update `tiptapDocToPlainText.ts` to handle every new node type, add CSS for every new node to `newsletter-prose.css`

Sub-pass intermediate ships allowed: after each Pass, Lovable build can deploy. Cole can author against new nodes incrementally as they ship. Final wire-up Pass = end of H2.

### Cycle H3 — NodeViews (edit + reader) for ENTIRE catalog (2-3 sessions)

For every new node from H2, build edit NodeView (with drag handle, edit modal/affordances, slash menu wiring, toolbar wiring where applicable) + reader NodeView (read-only, no affordances). NodeView passes mirror H2 pass ordering for sub-ship discipline.

- H3-NV-Pass1 through H3-NV-Pass8 — one NodeView pair per H2 pass
- H3-NV-Final: AdminNewsletterArticle.tsx sidebar additions (all new article-level fields: eyebrow_text input, is_issue_based toggle, issue_label input, tags multi-input, masthead fields, theme_variant picker, default_layout_width picker)
- H3-NV-Auto: `NewsletterArticle.tsx` (reader) auto-render logic (prepend Eyebrow if eyebrow_text set, prepend Masthead if masthead_publication set, append FooterMeta if is_issue_based=true, append AuthorBio always if author exists)

### Cycle H4 — Image-only Edge Function + Modal refactor (1 session, 2-3 Lovable cycles)

- H4-BE-1: NEW Edge Function `import-html-images` (Class A auth, super-admin gate, SSRF defense unchanged from convert-html-to-tiptap v2; 30-image / 10MB / 10s timeouts unchanged)
- H4-BE-2: Returns `{resolutions: {url: {asset_id, failure}}}` map only — no DOM walking, no TipTap generation server-side
- H4-BE-3: Deprecate + remove `convert-html-to-tiptap` Edge Function once new path verified
- H4-FE-1: Refactor `ImportHtmlModal.tsx`: client (a) parses HTML via DOMParser in browser, (b) extracts image URLs, (c) calls `import-html-images` for resolutions, (d) rewrites img src in cloned DOM to asset_id refs, (e) calls TipTap `generateJSON(modifiedHtml, buildExtensions({editable:false}))`, (f) renders preview using reader NodeViews, (g) commits via `editorHandleRef.current?.setContent(newDoc)`
- H4-FE-2: Stats display now computes from generateJSON result (image count = pre-pass; tag drops = generateJSON unknown-node stats if available; node-type breakdown shown to author for transparency)
- H4-FE-3: Orphan-sweep parent enumeration audit (if any new content_asset_refs parents added)

### Cycle H5 — Fidelity iteration (2-3 sessions, however many Lovable cycles needed)

- H5-1: Re-import `ptp_test_article_alt_media.html`. Visual diff vs source: side-by-side screenshots, pixel-level discrepancies catalogued
- H5-2: Patch parseHTML rules for any gaps (most likely needed: edge-case CSS class names BrainWise didn't anticipate; HTML5 elements not yet recognized)
- H5-3: Patch CSS rendering for any visual mismatches (spacing, weights, alignments)
- H5-4: Repeat with `ptp_test_article_alt.html` (unbranded version)
- H5-5: Test with 3-5 NEW HTML files Cole brings (sourced from Substack, Medium, Ghost, Beehiiv, or fresh Claude-generated artifacts) to validate generality beyond the original test set
- H5-6: Document any unresolvable gaps in `BRAINWISE_HTML_VOCABULARY.md` (for H6) — "if your source uses pattern X, do Y instead"

### Cycle H6 — Claude vocabulary prompt + reader polish (1 session, 2-3 Lovable cycles)

- H6-1: Document BrainWise's complete HTML class vocabulary in `BRAINWISE_HTML_VOCABULARY.md` — every class pattern recognized by parseHTML rules, with examples
- H6-2: Distill into Claude prompt template: "Write a BrainWise newsletter article using these HTML class conventions: [full class list]. Output ONLY HTML, no Markdown. Use these structural patterns: [examples for each pattern]. Map content to: [user describes content]."
- H6-3: Test prompt with 3-5 article drafts. Tune until Claude consistently produces import-clean HTML
- H6-4: Store prompt template in super-admin newsletter UI as "Draft with Claude" affordance (sidebar button → modal with content-description input → calls Claude API directly via existing Anthropic API integration → result loads into HTML import modal pre-filled)
- H6-5: Reader polish: any final visual touches surfaced during H5 fidelity testing

---

## 7. Estimated effort

Revised after §4 expansion. Full catalog = ~33 new block nodes + 7 new marks + 6 node refinements + 6 new article fields. This is a real multi-session project. Effort scales roughly linearly with node count.

| Cycle | Sessions | Lovable cycles | Risk | Notes |
|---|---|---|---|---|
| H1 (spec) | 0.5 | 0 | Low | Done — spec is authoritative for entire arc |
| H2 (schema + parseHTML, all nodes/marks) | 2-3 | 10-14 | Med-High | Largest cycle; all schemas defined; node-ordering matters per §4.13 |
| H3 (NodeViews, edit affordances) | 2-3 | 10-14 | Med | One NodeView per node + slash menu + toolbar wiring; visual fidelity per node is finicky |
| H4 (Edge Function refactor — client-side generateJSON) | 1 | 2-3 | High | New `import-html-images` Edge Function + ImportHtmlModal refactor; image flow change |
| H5 (fidelity iteration) | 2-3 | 5-8 | Med | Re-import test files, identify gaps in parseHTML rules, patch + retest cycles; unknown unknowns from real-world HTML variants |
| H6 (Claude vocabulary prompt + reader polish) | 1 | 2-3 | Low | Mostly prompt engineering + minor reader polish; produces `BRAINWISE_HTML_VOCABULARY.md` for future use |
| **Total** | **8-13 sessions** | **30-42 Lovable cycles** | | |

**Honest framing:** This is a 2-3 month project at typical session cadence. It's the right investment for prospect-facing best-in-class output, but it's not a 1-week sprint. Cole's confirmed scope decision (Session 95): build the full vocabulary, not MVP.

**Sequencing flexibility:** H2 + H3 can be split into sub-passes per §4.13 (pass 1 → ship → pass 2 → ship → etc.) if Cole wants intermediate releases to author against. H4 must come AFTER at least pass 1 of H2 (some nodes available to parseHTML) but does NOT need to wait for full catalog.

---

## 8. Deferred — what we are NOT building in Group H

Group H builds the complete node catalog. The only items deferred are ones that are out of scope for "newsletter editorial system" entirely:

**Page-level treatments (CSS, not nodes):**
- `grain` decorative noise overlay — page-level CSS treatment, not nodal
- Hero cover image with overlay — maps to existing `cover_asset_id` article field at import time, not body node
- Background patterns / textures on body — page-level, can be added later via theme_variant

**Phase 2 enhancements (schema ships in H2, full implementation later):**
- Poll backend tables + voting RPCs (schema ships in H2, voting backend in a follow-up Group I or J)
- KaTeX integration for Math node (schema ships, raw LaTeX fallback display only)
- Prism/Shiki syntax highlighting (schema ships, plain monospace until phase 2)
- Chart.js rendering for Chart node (schema ships with image fallback, dynamic rendering phase 2)
- Image lightbox / zoom on gallery click (schema ships, click handler phase 2)

**Out of scope for newsletter system entirely (handled elsewhere):**
- Comment threads on articles (already declined product decision Q8)
- Reaction emojis / claps (not relevant for editorial content)
- Real-time collaborative editing (single-author workflow only)
- Translation / i18n at the article level (English only for v1)
- AMP versions (deprecated by Google)
- Print stylesheets (defer until reader complaints)

**Adjacent build queue items that pair with H6 (Claude vocabulary prompt):**
- `users.bio` column + author bio edit UI (existing deferred item — promote to H2 prereq IF AuthorBio block ships in v1; otherwise carry separately)
- Internal subscriber inclusion in dispatch (existing G8 deferred item)
- `newsletter_categories` v2 (existing deferred — relates to RelatedArticles auto-by-category mode)
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
