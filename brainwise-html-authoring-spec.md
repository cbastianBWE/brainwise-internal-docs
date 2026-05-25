# BrainWise Newsletter HTML Authoring Spec

**Purpose:** This is the complete authoring contract for any LLM (Claude, GPT, etc.) generating standalone HTML files intended to be imported into the BrainWise newsletter editor via the Import HTML modal. Following this spec produces a file that imports as styled BrainWise nodes with zero manual cleanup.

**How import works:** the LLM-generated HTML is parsed client-side via `DOMParser`, then run through TipTap's `generateJSON` against BrainWise's extension set. Class names on elements are the primary match signal. Internal selectors inside each element determine what data is extracted.

**Scope:** Verified against the shipped state of `cbastianBWE/brainwise-blueprint` as of Session 102. Reflects H5 Cycle 1 + Cycle 2 + Follow-up.

---

## Quick reference: the 24 supported import patterns

| Block type | Use this class on the outer element | Notes |
|---|---|---|
| Eyebrow | `div.eyebrow` or `p.eyebrow` | Or any element with class containing "eyebrow", "kicker", "category" |
| Lead paragraph | `p.deck`, `p.lede`, `p.lead`, `p.standfirst` | First paragraph after title |
| Byline | `div.byline`, `p.byline`, `address.byline` | Or class containing "byline", "author-line" |
| Aside | `aside`, `div.aside`, `div.sidebar`, or class containing "by-the-way" | Use this for general sidebars, NOT callouts |
| Section rule | `div.section-rule` with inner `<span class="section-rule-num">01</span>` | Or `hr.section-rule`, `hr.dot-divider` |
| Masthead | `div.masthead`, `div.topbar`, `header.publication` | Top of newsletter |
| Callout | `aside.callout`, `div.callout`, `aside.warning`, etc. (see Callout section) | Variant inferred from class name |
| Pullquote | `blockquote.pullquote`, `div.pullquote`, `aside.pullquote`, `figure.pullquote` | Use a `<cite>` for attribution |
| Footer meta | `footer.article-footer`, `div.footer-meta`, etc. | Holds tags + date |
| Footnotes | `div.footnotes`, `section.footnotes`, `aside.footnotes`, `ol.footnotes` | Container for footnote bodies |
| Footnote reference (inline) | `<sup><a href="#fn1">1</a></sup>` linking to `#fn1` | Body text auto-extracted from target |
| Definition (inline) | `<dfn title="def text">term</dfn>` or `<span class="definition" title="...">` | Title attr is the definition |
| Highlight (inline) | `<span class="highlight">` | |
| Small caps (inline) | `<span class="small-caps">` | |
| Abbreviation (inline) | `<abbr title="full form">abbr</abbr>` | |
| Keyboard (inline) | `<kbd>Ctrl+C</kbd>` | |
| CTA button | `<a class="cta">`, `<a class="button">`, `<a role="button">` | Variant inferred from class |
| Callout | (see above) | |
| Embed (video) | `<iframe src="...youtube.com/embed/..." />`, vimeo, generic | Auto-detected provider |
| Domain grid | `div.domain-grid` with `div.domain-row` children | Each row needs internal `.domain-label`, `.domain-desc`, `.domain-count` |
| Index row | `div.index-row` with `div.index-card.tri` or `.rsi` children | Each card needs `.index-tag`, `.index-name`, `.index-formula`, `.index-note` |
| Disclosure (toggle) | `<details><summary>title</summary>body</details>` | Native HTML5 |
| Checklist | `<ul class="task-list">` with `<li><input type="checkbox">` items | GFM-compatible |
| Citations | `<section class="references"><ol><li>` or `<section class="citations">` | |
| Further reading | `section.further-reading`, `aside.further-reading` | List of `<a>` links |

---

## The HTML file shape

Every BrainWise-importable newsletter HTML file follows this top-level structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Article Title Here</title>
  <!-- Optional: link to fonts, embed CSS for visual preview. CSS is NOT used at import. -->
</head>
<body>

<article class="article-wrap">

  <!-- Optional Eyebrow (category line) -->
  <div class="eyebrow">Category · Subcategory</div>

  <!-- The H1 will NOT import as body content -->
  <!-- StarterKit is configured for H2-H4 only. Use H1 here so you have it for the title field; -->
  <!-- the importer drops it from body and you paste it into the article title manually. -->
  <h1>The Article's Title Goes Here</h1>

  <!-- Optional Lead paragraph (deck/lede) -->
  <p class="deck">A short, larger-typeset paragraph that summarizes the piece.</p>

  <!-- Optional Byline -->
  <div class="byline">
    <span><strong>Author Name</strong></span>
    <span>Organization</span>
    <span>N min read</span>
  </div>

  <!-- Optional Lede (longer first body paragraph, sometimes with dropcap) -->
  <p class="lede">The opening paragraph of the article body...</p>

  <!-- Normal body content: <p>, <h2>, <h3>, <h4>, <ul>, <ol>, plus any BrainWise blocks below -->

</article>
</body>
</html>
```

**Important rules at this level:**

- The outer wrapper class (`article-wrap`, etc.) doesn't matter for import — it's not matched by any rule
- `<head>` content is ignored at import — fonts and embedded CSS are for browser preview only
- `<h1>` is dropped from body content. Paste it into the article title field manually after import. **There is no way to make `<h1>` import as body content** because StarterKit is hard-configured to `{ levels: [2, 3, 4] }` per buildExtensions.ts. Plan around this.
- `<h2>`, `<h3>`, `<h4>` import as headings
- Bare `<p>`, `<ul>`, `<ol>`, `<li>`, `<blockquote>`, `<code>`, `<pre>`, `<a>` import via StarterKit
- Bare `<strong>`, `<em>`, `<s>` (strikethrough) work as inline marks
- `<u>` imports as underline (BrainWise custom mark)
- Inline `<a href="...">` works for links. URLs are validated by `isSafeHttpUrl` — `javascript:` and `data:` schemes are blocked

---

## Article header section

### Eyebrow

```html
<div class="eyebrow">Neuroscience · Leadership Development</div>
```

Any of these class patterns match:
- `div.eyebrow` or `p.eyebrow`
- Any element with class containing `"eyebrow"`, `"kicker"`, or `"category"`

**Use plain text inside.** Inline marks not recommended at this level.

### Article title (H1)

```html
<h1>The 5P Model: How the Personal Threat Profile Builds Better Leaders</h1>
```

**This will be dropped from body content on import.** Include it in the HTML file so you have the canonical title string available, then paste it into the article title field in the editor manually. There is no workaround.

### Lead / deck paragraph

```html
<p class="deck">Most leadership programs train behaviors. Few diagnose the threat patterns underneath them.</p>
```

Class options: `p.deck`, `p.lede`, `p.lead`, `p.standfirst`. Pick one. Use only ONE per article — multiple deck paragraphs are unusual.

### Byline

```html
<div class="byline">
  <span><strong>Author Name</strong> &amp; <strong>Co-Author</strong></span>
  <span class="byline-dot"></span>
  <span>Organization Name</span>
  <span class="byline-dot"></span>
  <span>8 min read</span>
</div>
```

Internal `<span>` elements are preserved as inline content. The visual separator dots are CSS-only in the preview file; the imported Byline node will render its own separators.

### Lede (long-form opening paragraph)

```html
<p class="lede">A leader's behavior under pressure is not a personality trait...</p>
```

Same import path as deck (both become Lead nodes). Use `lede` for the longer first body paragraph, `deck` for the short summary above the byline. Visual styling differs slightly in the BrainWise reader.

---

## Section dividers (numbered or plain)

The recommended pattern for the BrainWise visual:

```html
<div class="section-rule">
  <span class="section-rule-num">01</span>
  <div class="section-rule-line"></div>
</div>
```

The `.section-rule-num` text is captured into the node's `number` attribute and the style auto-promotes to `"numbered"`. The bracketed number renders in the imported article.

Other supported patterns:
- `<hr class="section-rule">` — plain horizontal rule
- `<hr class="dot-divider">` — three-dot divider
- `<div class="section-rule"><span class="section-rule-title">Section Title</span></div>` — titled style

---

## Inline marks (formatting inside paragraphs)

All of these work inside any paragraph or block content:

| Inline element | Markup | Notes |
|---|---|---|
| Bold | `<strong>text</strong>` | StarterKit |
| Italic | `<em>text</em>` | StarterKit |
| Strikethrough | `<s>text</s>` | StarterKit |
| Underline | `<u>text</u>` | BrainWise mark |
| Highlight | `<span class="highlight">text</span>` | |
| Abbreviation | `<abbr title="Full Form">abbr</abbr>` | Hover shows title |
| Keyboard key | `<kbd>Ctrl</kbd>` | |
| Small caps | `<span class="small-caps">USA</span>` | |
| Subscript | `<sub>2</sub>` | H<sub>2</sub>O |
| Superscript | `<sup>2</sup>` | E=mc<sup>2</sup> |
| Definition | `<dfn title="A short defining phrase">term</dfn>` | Dotted underline, hover tooltip. Title attr IS the definition. |
| Accent | `<span class="accent">text</span>` or `<em class="accent">` | Brand color emphasis |
| Footnote ref | `<sup><a href="#fn1">1</a></sup>` | See Footnotes section below |
| Link | `<a href="https://...">text</a>` | URL must be http(s) — javascript: blocked |

**Important: definition title attr.** The browser's default tooltip for `<dfn title="...">` is the imported definition body. Set this carefully — it's user-visible.

---

## Callouts

Callouts are emphasis blocks with variants. The variant is inferred from the class name.

```html
<aside class="callout">
  <h4>The headline of the callout</h4>
  <p>The body content of the callout, which can contain multiple paragraphs.</p>
</aside>
```

**Variant inference rules** (in priority order):
- Class contains `"warning"` or `"alert"`, or `role="alert"` → **warning** (amber accent)
- Class contains `"quote"` → **quote** (navy, serif italic)
- Class contains `"tldr"` or `"summary"` → **tldr** (navy on cream)
- Class contains `"takeaway"` or `"key"` → **key_takeaway** (plum accent)
- Otherwise → **info** (teal accent, default)

Matched outer tags: `aside.callout`, `aside.info-box`, `aside.warning`, `aside.tip`, `aside.note`, `aside.alert`, `div.callout`, `div.info-box`, `div.warning`, `div.tip`, `div.note`, `[role="note"]`, `[role="alert"]`.

**Title extraction:** The first `<h1>`-`<h6>` or `<strong>:first-child` inside becomes the callout title attribute. **Important caveat:** because `<h1>` is dropped from body content separately by StarterKit, do NOT put a `<h1>` inside a callout — use `<h4>` or `<strong>` instead.

Examples:

```html
<!-- Info (default) -->
<aside class="callout">
  <h4>Operating Insight</h4>
  <p>Body...</p>
</aside>

<!-- Warning -->
<aside class="warning">
  <h4>Watch out</h4>
  <p>Body...</p>
</aside>

<!-- Key takeaway -->
<aside class="key-takeaway">
  <h4>The point</h4>
  <p>Body...</p>
</aside>
```

---

## Pullquotes

```html
<div class="pullquote">
  A leader's behavior under pressure is not a personality trait. It is a threat response.
  <cite>The BrainWise Operating Premise</cite>
</div>
```

Or in semantic HTML:

```html
<blockquote class="pullquote">
  <p>A leader's behavior under pressure is not a personality trait.</p>
  <cite>The BrainWise Operating Premise</cite>
</blockquote>
```

Matched outer tags: `blockquote.pullquote`, `aside.pullquote`, `figure.pullquote`, `div.pullquote`, `blockquote[class~="pull-quote"]`, `div[class~="pullquote"]`.

The `<cite>` element's textContent is captured into the `attribution` attribute. Also matches `.attribution` class and `<footer>` inside. Use ONE attribution element only.

**Known caveat for `div.pullquote`:** if you use this pattern, the cite text may appear both as attribution AND in the body. To avoid this, use `<blockquote class="pullquote">` with the cite outside any `<p>`:
```html
<blockquote class="pullquote">
  <p>Quote text here.</p>
  <cite>Source</cite>
</blockquote>
```

---

## Domain grid (multi-row metric/comparison)

```html
<div class="domain-grid">

  <div class="domain-row">
    <div class="domain-label">
      <span class="domain-marker marker-protection"></span>Protection
    </div>
    <div class="domain-desc">Sensitivity to threats against the self: physical safety, status, identity.</div>
    <div class="domain-count">18<span>Facets</span></div>
  </div>

  <div class="domain-row">
    <div class="domain-label">
      <span class="domain-marker marker-participation"></span>Participation
    </div>
    <div class="domain-desc">Sensitivity to threats around belonging, inclusion, and standing in the group.</div>
    <div class="domain-count">18<span>Facets</span></div>
  </div>

  <!-- More rows... -->

</div>
```

**Extraction rules** (per row):
- `.domain-label` text content (excluding nested span text) → `label`
- `.domain-desc` text content → `description`
- `.domain-count` text content (excluding nested span) → `count_value` (e.g., "18")
- `.domain-count > span` text content → `count_label` (e.g., "Facets")
- The marker span (`<span class="domain-marker marker-X">`) is preserved for visual continuity but `tag_text` and `tag_variant` are left null on import — to add a chip later, edit the row in the BrainWise editor

**Outer matches:** `div.domain-grid`, `section.domain-grid`.

**Minimum: at least 1 `.domain-row` child** (schema requires `newsletterDomainRow+`). The parent will drop if you put non-`.domain-row` content directly inside.

---

## Index row (side-by-side metric cards)

```html
<div class="index-row">

  <div class="index-card tri">
    <div class="index-tag">Threat Reactivity</div>
    <div class="index-name">TRI</div>
    <div class="index-formula">100 − (Protection × 0.25 + Participation × 0.30 + Prediction × 0.45)</div>
    <div class="index-note">Higher TRI means less threat-reactive.</div>
  </div>

  <div class="index-card rsi">
    <div class="index-tag">Reward Sensitivity</div>
    <div class="index-name">RSI</div>
    <div class="index-formula">Purpose × 0.60 + Pleasure × 0.40</div>
    <div class="index-note">Higher RSI means stronger motivational drive.</div>
  </div>

</div>
```

**Extraction rules** (per card):
- `.index-tag` text → `tag` (small uppercase label above the name)
- `.index-name` text → `name` (large bold name)
- `.index-formula` text → `formula` (optional; if empty, set to null automatically)
- `.index-note` text → `note` (body description)
- Card has `.tri` class → `accent_color: "navy"`
- Card has `.rsi` class → `accent_color: "orange"`
- Otherwise → `accent_color: "orange"` (default)

**Outer match:** `div.index-row`. Schema requires `newsletterIndexCard+`.

**`accent_color` valid values** (if you want to add other variants in the source): `"orange"`, `"forest"`, `"teal"`, `"plum"`, `"mustard"`, `"navy"`. Only `.tri`/`.rsi` classes are auto-mapped at this time.

---

## Disclosure (collapsible toggle)

Native HTML5 — no special classes needed:

```html
<details>
  <summary>Click to expand</summary>
  <p>Hidden body content here.</p>
  <p>Multiple block-level children are allowed.</p>
</details>
```

For a default-open toggle:
```html
<details open>
  <summary>Open by default</summary>
  <p>Body...</p>
</details>
```

The `<summary>` becomes a `NewsletterDisclosureSummary` (inline content only). The rest of the `<details>` content becomes block-level body content.

---

## Checklists

GitHub-flavored Markdown style:

```html
<ul class="task-list">
  <li><input type="checkbox" checked>Completed item</li>
  <li><input type="checkbox">Pending item</li>
  <li><input type="checkbox" checked>Another completed item</li>
</ul>
```

Or use class `checklist`:

```html
<ul class="checklist">
  <li><input type="checkbox">Item 1</li>
  <li><input type="checkbox" checked>Item 2</li>
</ul>
```

**Without checkboxes also works** (defaults all items to unchecked):

```html
<ul class="task-list">
  <li>Item 1</li>
  <li>Item 2</li>
</ul>
```

The `<input type="checkbox">` element is stripped from the rendered inline content by ProseMirror's default rules — only its `checked` state survives on the imported ChecklistItem node.

---

## Citations / references

```html
<section class="references">
  <h3>References</h3>
  <ol>
    <li>Smith, J. (2023). <em>The Threat Response System</em>. <a href="https://example.com/paper">Source</a></li>
    <li>Doe, A. (2024). <em>Leadership Under Pressure</em>. Journal of Applied Neuroscience, 12(3).</li>
  </ol>
</section>
```

Outer matches: `section.citations`, `section.references`, `ol.citations`, `ol.references`.

- The `<h3>` (or any h1-h6) inside the section becomes the citations title
- Each `<li>` becomes a citation entry
- The first `<a>` inside each `<li>` provides the citation's link attribute (renders as a small `↗` icon next to the entry)
- Rest of the li content remains inline

---

## Footnotes

Two-part pattern: inline reference + body section.

**Inline reference (in body text):**

```html
<p>The PTP feeds into a co-elevation framework with the NAI<sup><a href="#fn1">1</a></sup>.</p>
```

**Footnote body (anywhere in document, typically at the end):**

```html
<div class="footnotes">
  <ol>
    <li id="fn1">The Neuroscience Adoption Index measures AI readiness across five dimensions.</li>
    <li id="fn2">Further detail here.</li>
  </ol>
</div>
```

**How it works:** The `<sup><a href="#fn">N</a></sup>` becomes a FootnoteRef mark. At import, the marker reaches across to `document.getElementById("fn1")` and pulls its textContent into the `footnote_text` attribute. The body footnote container also imports as a Footnotes block.

**Important:**
- Each `<sup><a>` must have a `href` starting with `#` (fragment identifier)
- The target element must have a matching `id` attribute (e.g., `id="fn1"`)
- If the target isn't found, the FootnoteRef mark still applies but with empty `footnote_text` — superscript visual fires but no tooltip content

---

## Footer meta (article footer with tags)

```html
<footer class="article-footer">
  <div>
    <span class="tag">Personal Threat Profile</span>
    <span class="tag">5P Model</span>
    <span class="tag">Leadership</span>
  </div>
  <div>
    <time datetime="2026-05-25">May 25, 2026</time>
  </div>
</footer>
```

Outer matches: `footer.article-footer`, `footer.post-footer`, `footer.entry-footer`, `footer.footer-meta`, `div.article-meta`, `div.post-meta`, `div.footer-meta`.

**Extraction:**
- All elements with class `.tag` (or matching `.tags li`, `[class*="tag"]`) → `tags` array
- A `<time datetime="...">` element → `published_label` (prefers `datetime` attribute, falls back to textContent)
- Tags longer than 50 characters are filtered out as defensive trimming

---

## Embeds (video / external content)

```html
<!-- YouTube -->
<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Optional title"></iframe>

<!-- Vimeo -->
<iframe src="https://player.vimeo.com/video/123456789" title="Optional title"></iframe>

<!-- Spotify (requires the canonical data attr; iframe src alone won't auto-detect) -->
<!-- Best to add the embed in the editor after import for Spotify -->

<!-- Generic — falls through with safe-URL gating -->
<iframe src="https://example.com/embed/xyz"></iframe>
```

**Provider auto-detection** (via URL substring match):
- `youtube.com/embed/X` or `youtu.be/X` → provider: `youtube`, embed_id: X
- `vimeo.com/N` → provider: `vimeo`, embed_id: N
- Anything else → provider: `generic`, embed_id: "", URL preserved

**Constraints:**
- URL must pass `isSafeHttpUrl` (http or https schemes only)
- `aspect_ratio` defaults to `"16:9"` (other valid values: `"4:3"`, `"1:1"`, `"9:16"`)
- The `title` attribute on the iframe becomes the title attr on the Embed node

Twitter/X embeds and Loom embeds are NOT auto-detected. Insert them via the editor after import.

---

## CTA buttons

```html
<a class="cta" href="https://app.brainwiseenterprises.com/start">Start your assessment</a>

<a class="button button-secondary" href="https://...">Secondary action</a>

<a class="ghost" href="https://...">Tertiary link-style action</a>
```

**Variant inference:**
- Class contains `"secondary"` → variant: `secondary`
- Class contains `"ghost"`, `"outline"`, or `"link"` → variant: `ghost`
- Otherwise → variant: `primary`

Matched outer tags: `a.cta`, `a.button`, `a[class~="newsletter-cta"]`, `a[role="button"]`.

The link textContent becomes the button label. The href becomes the URL.

---

## Stat callouts (single big-number callout)

```html
<figure class="stat">
  <div class="value">$2.4B</div>
  <div class="label">Annual revenue growth</div>
  <cite class="source">Q4 2025 earnings report</cite>
</figure>
```

**Extraction selectors** (any of the following work):
- Value: `.value`, `.stat-value`, `.number`, `.big-number`, `<strong>:first-child`, `<h1>`, `<h2>`
- Label: `.label`, `.stat-label`, `.caption`, `<figcaption>`
- Source: `.source`, `.citation`, `<cite>`
- Trend: class containing `"up"`, `"down"`, or `"flat"` → arrow indicator

Outer matches: `figure.stat`, `figure.statistic`, `div.stat-callout`, `aside.stat`.

---

## Further reading

```html
<section class="further-reading">
  <h3>Related reading</h3>
  <a href="https://example.com/article-1">First Related Article</a>
  <a href="https://example.com/article-2">Second Related Article</a>
  <a href="https://example.com/article-3">Third Related Article</a>
</section>
```

All `<a>` elements inside are extracted into an entries array. Each entry has title (link text) and URL (href). Source and description fields default to null and can be edited in the editor.

Outer matches: `section.further-reading`, `section.related-reading`, `aside.further-reading`, `div.further-reading`.

---

## Code

Plain code blocks (StarterKit):

```html
<pre><code>const x = 42;
console.log(x);</code></pre>
```

With language hint:

```html
<pre><code class="language-typescript">const x: number = 42;</code></pre>
```

Inline code: `<code>useState</code>`

For "before/after" code comparison, use the CodeDiff pattern:

```html
<div class="code-diff">
  <div class="filename">api/handler.ts</div>
  <pre class="before"><code>const result = api.get(url);</code></pre>
  <pre class="after"><code>const result = await api.get(url);</code></pre>
</div>
```

Internal selectors: `.before` / `.diff-before` / `[data-side='before']` for the before pane; `.after` / `.diff-after` / `[data-side='after']` for the after pane. Filename: `.filename` / `.file-name`. Language: extracted from `class="language-X"` on inner code.

---

## Math (LaTeX)

```html
<!-- Block math -->
<div class="math">x^2 + y^2 = z^2</div>

<!-- Inline math -->
<span class="math">E = mc^2</span>

<!-- With KaTeX/MathJax-rendered output (preserves the source) -->
<div class="katex"><annotation encoding="application/x-tex">x^2 + y^2 = z^2</annotation></div>
```

LaTeX source extraction priority:
1. `data-latex` attribute on the outer element
2. `<annotation encoding="application/x-tex">` child textContent
3. `<script type="math/tex">` child textContent
4. Outer textContent as last resort

---

## Terminal / shell session

```html
<div class="terminal">
$ npm install react
added 42 packages in 2s
$ npm run build
> build successful
</div>
```

Parsed line-by-line. Lines starting with `$`, `>`, or `#` followed by space are treated as commands; subsequent lines until the next prompt are command output.

Outer matches: `div.terminal`, `pre.terminal`, `pre.console`, `pre.shell`.

---

## Patterns that will NOT import as styled BrainWise nodes

These patterns are documented limitations as of Session 102. They will import as flat content or be dropped:

### 1. Multi-column layouts

```html
<div class="two-column">
  <div>Pane 1 content</div>
  <div>Pane 2 content</div>
</div>
```

**Will not import as TwoColumn.** Schema requires exactly 2 (or 3, or 4) `newsletterTwoColumnPane` children, and external `<div>` elements don't satisfy this. The wrapper drops, paragraphs flow into the main column. **Workaround:** structure your content linearly. Multi-column layouts must be created in the BrainWise editor manually.

### 2. Image galleries

```html
<section class="gallery">
  <img src="...">
  <img src="...">
  <img src="...">
</section>
```

**Will not import as ImageGallery.** Schema requires `newsletterImage+` children; external `<img>` elements get processed through the image-upload pipeline as individual Image nodes, but they reparent OUT of the gallery wrapper. **Workaround:** include images sequentially; group them in the editor after import.

### 3. Stat grids

```html
<section class="stats">
  <figure class="stat">...</figure>
  <figure class="stat">...</figure>
</section>
```

Same as image gallery — the wrapper drops, individual StatCallouts survive. **Workaround:** use individual StatCallouts; the visual grid arrangement happens in the editor.

### 4. Step lists / how-to sequences

```html
<ol class="steps">
  <li><h3>Step 1</h3><p>Description</p></li>
  <li><h3>Step 2</h3><p>Description</p></li>
</ol>
```

**Will not import as StepList.** Schema requires a Step's first child to be a heading, and ProseMirror's coercion may strip this. **Workaround:** use numbered `<h3>` + paragraph pairs as flat content.

### 5. Key moments / timelines

```html
<section class="timeline">
  <li>2020 — Founded</li>
  <li>2022 — Series A</li>
</section>
```

**Will not import as KeyMoments.** No reliable schema-compatible external pattern. **Workaround:** use a regular ordered list `<ol>`.

### 6. Polls, audio embeds, image-compare, charts, related-articles (database-bound)

These nodes bind to BrainWise database rows (polls table, content_assets, etc.). External markup cannot provide the binding. **Workaround:** insert these nodes in the editor after import — they don't have a meaningful HTML representation outside the BrainWise system.

### 7. Subscribe blocks

Same — database-bound. Insert via editor.

### 8. Author bios

```html
<aside class="author-bio">...</aside>
```

Will import as an unbound AuthorBio node (no user binding). **Workaround:** insert in editor and pick the user from the dropdown.

---

## Class names that produce unexpected behavior — avoid these

- `<aside>` without any class → imports as a generic Aside (sidebar), not a Callout. To make a callout, use `aside.callout` (or any other callout class).
- `<aside class="callout">` with the word "warning" in its text content but not in the class → imports as `info` variant. Variant detection reads class names ONLY, not body text.
- `<blockquote>` without `.pullquote` class → imports as a plain blockquote (StarterKit), not as a NewsletterPullquote.
- `<div>` without any meaningful class → imports as nothing; its content flows through to the surrounding context.

---

## CSS for visual preview (optional, ignored at import)

The `<style>` block in `<head>` is for browser preview only. It does NOT affect import. Use it freely to make the HTML file look correct when opened in a browser. The imported result will be styled by BrainWise's `newsletter-prose.css` (navy/orange/sand palette, Fraunces+Inter typography, etc.) regardless of what your `<style>` block contains.

A starter `<style>` block that approximates BrainWise visual identity:

```html
<style>
  :root {
    --navy: #021F36;
    --orange: #F5741A;
    --sand: #F9F7F1;
    --teal: #006D77;
    --ink: #1a1a1a;
  }
  body { font-family: 'Inter', sans-serif; background: var(--sand); color: var(--ink); line-height: 1.6; font-size: 17px; }
  .article-wrap { max-width: 760px; margin: 0 auto; padding: 60px 32px 120px; }
  h1 { font-family: 'Fraunces', serif; font-size: 48px; line-height: 1.1; margin-bottom: 24px; }
  h2 { font-family: 'Fraunces', serif; font-size: 32px; margin: 48px 0 16px; }
  h3 { font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 600; margin: 32px 0 8px; }
  .eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--orange); margin-bottom: 24px; }
  .deck, .lede { font-size: 20px; line-height: 1.5; margin-bottom: 24px; }
  /* etc. */
</style>
```

You don't need to write CSS for the import to work. Skip it if you don't care about the standalone-HTML preview.

---

## Import workflow

1. Generate the HTML file with this spec
2. In BrainWise, navigate to `/super-admin/newsletter/<articleId>` for any draft
3. Click **Import HTML**
4. Drag-drop the file
5. Confirm the preview
6. Paste the `<h1>` title into the article title field (the only manual step)
7. The article body is populated with styled BrainWise nodes

---

## Checklist for an LLM generating a BrainWise newsletter HTML

Before outputting the file, verify:

- [ ] `<!DOCTYPE html>` and proper `<html>`, `<head>`, `<body>` structure
- [ ] Article wrapped in any container element (class doesn't matter for import)
- [ ] Optional `<style>` block for browser preview only
- [ ] Eyebrow uses class `eyebrow`, `kicker`, or `category`
- [ ] Title is an `<h1>` (acknowledged it'll be dropped from body and pasted into title field)
- [ ] Deck/lede paragraph uses `p.deck` or `p.lede`
- [ ] Byline uses class `byline`
- [ ] Body headings are `<h2>`, `<h3>`, `<h4>` only (NEVER `<h1>` in body)
- [ ] Section dividers use `div.section-rule` with `.section-rule-num` span for numbering
- [ ] Callouts use `aside.callout` or `div.callout` with variant class
- [ ] Pullquotes use `blockquote.pullquote` with `<cite>` for attribution
- [ ] Domain grids use `div.domain-grid > div.domain-row` with `.domain-label`, `.domain-desc`, `.domain-count` children
- [ ] Index rows use `div.index-row > div.index-card.tri` (or `.rsi`) with `.index-tag`, `.index-name`, `.index-formula`, `.index-note` children
- [ ] Disclosures use `<details><summary>`
- [ ] Checklists use `ul.task-list` with `<input type="checkbox">` items
- [ ] Citations use `section.references` with `<ol><li>` structure
- [ ] Footnotes use `<sup><a href="#fnN">N</a></sup>` references with matching `id="fnN"` targets in a `.footnotes` container
- [ ] Footer uses `footer.article-footer` or `div.footer-meta` with `.tag` chips
- [ ] No multi-column layouts, image galleries, stat grids, step lists, key moments, polls, audio, charts, or related articles in the HTML (insert via editor)
- [ ] All URLs are http or https only (no `javascript:`, `data:`, `file:`)
- [ ] No content placed inside `<h1>` in callouts (use `<h4>` instead)
