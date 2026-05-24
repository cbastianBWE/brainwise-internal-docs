# Session 96 → Session 97 Handoff

**Closing session:** 96 (and 97 — see note below)
**Opening session:** 98
**Status:** Group H Cycle H2 backend SHIPPED. Cycle H2 Frontend Pass 1 (foundational nodes) + Pass 4 (marks) SHIPPED across three Lovable cycles. Cycle H2 Frontend Passes 2, 3, 5, 6, 7, 8, Final remain.

**Note on session numbering:** Sessions 96 (backend) and 97 (frontend Bundle A1) happened in one continuous chat per Cole's preference to push through. This handoff covers both. Next session = 98 = Bundle A2 (H2-FE-Pass 2 = composite parent+child nodes).

---

## What shipped this session

### Cycle H2 Backend — 7 migrations + types regen

All applied to `svprhtzawnbzmumxnhsq` and end-to-end smoke-tested.

**H2-MIG-1 `session96_h2_mig_1_newsletter_articles_visual_vocabulary_fields`**
8 new columns on `newsletter_articles`: `eyebrow_text` (text), `is_issue_based` (boolean default false), `issue_label` (text), `masthead_publication` (text), `masthead_logo_glyph` (text), `default_layout_width` (text CHECK in 'narrow|standard|wide' default 'standard'), `theme_variant` (text CHECK in 'default|minimal|bold' default 'default'), `tags` (text[] default '{}'). 4 new CHECK constraints. GIN index on `tags`. `source_type` CHECK extended to include `'html_import_v2'` for the post-H4 import path. Per-element tag length CHECK was DROPPED at apply time — Postgres forbids subqueries in CHECK constraints (including `EXISTS (SELECT FROM unnest)`). Tag length validation now lives in RPC body validation, not CHECK. New rule §141.

**H2-MIG-2 + 2b `session96_h2_mig_2_upsert_article_visual_vocabulary_params` + `_2b_revoke_public`**
`upsert_article` signature expanded from 17 to 25 params (8 new params one per new column, all nullable with COALESCE defaults to satisfy NOT NULL columns). DROP+CREATE pattern re-applied Supabase's default `EXECUTE TO PUBLIC` grant — discovered during smoke test. `REVOKE FROM anon` alone was insufficient. Locked pattern: `REVOKE FROM PUBLIC; REVOKE FROM anon; GRANT EXECUTE TO authenticated, service_role`. New rule §140.

**H2-MIG-3 `session96_h2_mig_3_get_article_for_reader_visual_vocabulary_payload`**
`get_article_for_reader` returns 8 new fields in both granted + paywall branches. Tags included in paywall branch per C1=A (conversion preview shows tag context). Anon callable (intentional).

**H2-MIG-4 `session96_h2_mig_4_list_admin_newsletter_articles_visual_vocabulary`**
`list_admin_newsletter_articles` row output extended with 8 new fields. Super-admin only.

**H2-MIG-5 `session96_h2_mig_5_preview_article_as_viewer_class_visual_vocabulary`**
`preview_article_as_viewer_class` mirrors H2-MIG-3 for super-admin preview path.

**H2-MIG-6 `session96_h2_mig_6_users_bio_column_and_super_admin_update_rpc`**
`users.bio` column added (nullable text, no length cap). `update_user_bio(p_user_id, p_bio, p_reason)` RPC for super-admin cross-user bio edits. `user_bio_updated` action_type registered with `category='user_management'`. Existing "users: update own safe fields" RLS policy uses allow-by-omission immutable-fields model — bio auto-editable by row owner without policy change. New rule §142 surfaced during this work: `super_admin_action_types` INSERT requires 9-column set (action_type, category, description NOT NULL + tier nullable + 4 booleans with defaults).

**H2-MIG-7 `session96_h2_mig_7_newsletter_polls_tables_rls_rpcs_action_types`**
`newsletter_polls` + `newsletter_poll_votes` tables. 6 RLS policies (public_read, super_admin_all, service_role_all per table). 5 RPCs: `create_poll`, `update_poll`, `archive_poll`, `vote_on_poll`, `get_poll_results`. 3 action types: `poll_created`, `poll_updated`, `poll_archived` (category=`content_authoring`). **P1=B locked**: options-array edits BLOCKED once any votes exist. **P2 locked**: question edits allowed after votes (text-only mutation, no semantic shift). Authenticated-only voting via PK constraint (`poll_id`, `voter_user_id`). C3=A locked (anonymous voting rejected — auth required).

**`session96_h2_noop_types_regen`**
`COMMENT ON SCHEMA public IS 'public'` — triggers types.ts regeneration per Session 84 §111 pattern.

### Cycle H2 Backend — end-to-end smoke test
Created smoke article (`ed18f133-e0b3-4e1c-85ec-7bcfcc84a21b`) with all 8 H2 fields → published → `get_article_for_reader` round-tripped all 8 fields cleanly. Poll lifecycle: created poll `dff82ab4-cc01-4ce9-ae26-97b558a59d6a` → super-admin voted "protection" → results showed `{protection:1}`, `user_vote='protection'` when authed, `null` for anon → P1 B block verified (options edit attempt after vote raised, options preserved unchanged) → P2 question edit succeeded with votes existing → double-vote rejected by PK → archived poll → `get_poll_results` returned `{found:false}`. Bio RPC: set + cleared. All fixtures cleaned up: article archived, poll archived, bio cleared to NULL. 8 audit rows persist with `H2 *` reason prefix.

### Cycle H2 Frontend — Bundle A1a SHIPPED

Maps to **H2-FE-Pass 1 (3 of 6 nodes) + H2-FE-Pass 4 (all 8 marks).** Type-check clean. 11 new files + 6 modified.

New nodes in `src/components/newsletter/tiptap/nodes/`: **Eyebrow.ts**, **Lead.ts**, **Aside.ts**. All three are content-editable in-DOM (no NodeView required). Eyebrow rendered as `<p>` (semantic choice better than spec's `<div>`).

New marks in new `src/components/newsletter/tiptap/marks/` directory: **SmallCaps**, **Superscript**, **Subscript**, **Underline**, **Highlight**, **Keyboard**, **Abbr**, **Accent**. All custom `Mark.create()` — no `@tiptap/extension-*` packages added. Per-mark parseHTML defenses baked in: Highlight scoped to `mark[data-newsletter-highlight]` (no bare `mark` selector to avoid collision with Accent's `mark.accent`); Accent gets `priority: 60` on its rules to beat Highlight; Underline excludes `[class~="underline"]` selector (would catch Tailwind utility class).

Modified `Callout.ts` parseHTML to add `priority: 51` on its `aside[data-newsletter-callout]` rule as belt-and-suspenders defense against Aside's `aside:not([data-newsletter-callout])` selector. New rule §144.

`marketing-tokens.css` extended with 22 new tokens under `/* Group H newsletter visual vocabulary tokens */` comment block: `--bw-mono-font` (JetBrains Mono), `--bw-mustard #8a6400` (darker than spec's #7a5800 for AA contrast on cream), editorial label sizing tokens, stripe widths, section rule margins, dropcap, 6 accent color aliases, 3 content-width tokens (640/780/920 narrow/standard/wide — defined but unused this cycle; `.newsletter-prose` continues using `--container-sm` = 720px; width swap deferred to H3-NV-Auto).

`newsletter-prose.css` extended with BEM-flavored rules for all 3 new nodes + all 8 marks, scoped under `.newsletter-prose`.

`NewsletterSlashMenu.tsx` got 3 new EDITORIAL slash items (Eyebrow / Lead / Aside) with explicit content arrays in their insert payloads (Aside seeds `[{type:"paragraph"}]`, Eyebrow/Lead seed `[{type:"text", text:" "}]` to satisfy schema).

`NewsletterBubbleMenu.tsx` got 7 new mark toggle buttons (between Strike and Link). Abbr toggle opens an inline title input following the existing `linkMode` state pattern. The pre-existing "Lead" toggle button (which set `data-font-size="lead"` via TextStyleWithFontSize) was REMOVED — the new `newsletterLead` block node replaces that surface. `TextStyleWithFontSize` extension itself preserved (still used by lesson-blocks editor at `src/components/super-admin/lesson-blocks/RichTextEditor.tsx`). New rule §145 surfaced: avoid utility-class selectors in parseHTML.

Tiny unblock in `AdminNewsletterArticle.tsx`: 8 new H2 RPC params passed as nullish defaults so `upsert_article` typecheck passes after types.ts regen. No UI behavior change; real sidebar surfaces are H3-NV-Final.

Underline collision: extended declared `Commands.underline` shape to include `setUnderline`/`unsetUnderline` to match a pre-existing module augmentation elsewhere in the codebase (lesson-blocks editor likely consumes underline command type).

### Cycle H2 Frontend — Bundle A1b-1 SHIPPED

Maps to **H2-FE-Pass 1 (3 more of 6 nodes).** Type-check clean.

Atom nodes shipped: **SectionRule.ts**, **Masthead.ts** in `src/components/newsletter/tiptap/nodes/`. Both atoms with multiple attrs needing React NodeViews for editing. SectionRule parseHTML uses `priority: 60` on its scoped `hr.section-rule`, `hr[data-numbered]`, `hr.dot-divider` selectors to beat StarterKit's HorizontalRule on bare `hr` — and does NOT register a bare `hr` selector so HorizontalRule continues to handle plain `<hr>` elements unaffected. Masthead atom with publication/issue_label/date_label/logo_glyph attrs.

NodeViews shipped in `src/components/newsletter/tiptap/nodeviews/`: **SectionRuleNodeView.tsx** (style picker pills + conditional inputs based on style + live preview), **MastheadNodeView.tsx** (4 inline inputs in single row + curated glyph dropdown with 8 glyphs ▲ ◆ ● ■ ★ ✦ ◊ ▼).

`NewsletterBubbleMenu.tsx` refactored from 4-useState-call mode chain (linkMode/linkUrl/abbrMode/abbrTitle) to single discriminated union `Mode = { kind: "default" } | { kind: "link", url } | { kind: "abbr", title } | { kind: "accent", color, style, weight } | { kind: "highlight", color }`. All existing Link and Abbr behavior preserved. New Escape useEffect closes any open submenu. New Accent picker submenu (3 rows: 6 colors / 3 styles / 2 weights + Apply / Remove / Cancel) replaces A1a's "click applies orange/plain/normal default" behavior. New Highlight picker submenu (single row of 5 colors, click-to-apply) replaces A1a's "click applies yellow default". Both pickers prefill from `editor.getAttributes(markName)` so editing an existing accent/highlight surfaces its current values. `blockedParents` Set extended with `newsletterSectionRule`, `newsletterByline` (forward-looking for A1b-2), `newsletterMasthead`.

No reader NodeViews shipped for the atoms. SectionRule/Byline/Masthead have no async resolution needs (unlike Image's `useNewsletterImageUrl`); their `renderHTML` is sufficient for read-only display. D10=A locked.

2 new slash items: SectionRule → BASIC category (icon `SeparatorHorizontal`), Masthead → LAYOUT category (icon `BookMarked`).

CSS for both nodes appended to `newsletter-prose.css` using new tokens from A1a (`--bw-mono-font`, `--bw-editorial-label-size`, `--bw-section-rule-margin-top/bottom`).

### Cycle H2 Frontend — Bundle A1b-2 SHIPPED

Maps to **H2-FE-Pass 1 (final node).** Type-check clean.

**Byline.ts** atom node with `entries[]` (`{text, bold, link}` array) + `separator_style` (dot/pipe/slash). Module-scoped `parseBylineHtml(el)` helper walks child nodes, accumulates text + bold/link state per segment, splits on separator chars (·, •, |, /). parseHTML rules for `[data-newsletter-byline]` (direct read of JSON-encoded `data-entries`), `div.byline`, `p.byline`, `address.byline`, `[class~="byline"]`, `[class~="author-meta"]`.

**BylineNodeView.tsx** — full-fidelity per D3=A. Three components in one file (mirrors `ListBlockForm.tsx` convention): `BylineNodeView` parent (~120 LOC), `EntryRow` (~80 LOC), `LinkEditor` (~30 LOC).

Pattern adopted verbatim from existing `src/components/super-admin/lesson-blocks/block-forms/ListBlockForm.tsx`:
- `@dnd-kit/sortable` with `useSortable` per row
- `PointerSensor` with `activationConstraint: { distance: 4 }` (not 5 — codebase convention)
- `crypto.randomUUID()` per entry stored in `idsRef` parallel array (not in doc JSON — ephemeral UI state)
- `arrayMove` from `@dnd-kit/sortable` on `onDragEnd`
- GripVertical handle spreads `{...attributes} {...listeners}` (NOT `data-drag-handle` — that's reserved for the node-level handle outside the entry list)
- Always-keep-one-entry invariant: removing the last entry replaces it with `{text:"", bold:false, link:null}` rather than deleting

Per-entry link mode follows `NewsletterBubbleMenu.tsx`'s linkMode pattern — clicking link icon expands an inline URL input below the entry, Enter applies, Escape cancels, empty trims to unset. Link-editing tracked by `linkEditingId: string | null` (UUIDs, survives reorder).

Auto-insert one empty entry on first mount via useEffect (Q6=C) — slash insert seeds `entries: []`; NodeView fills with one empty entry so author sees something to edit immediately. Matches ListBlockForm's "always ≥1 item" invariant.

Debounced text commits at 300ms; `flushDebounce()` called on `onDragStart` to prevent post-drag debounce racing the reorder commit (Q11).

Top-of-NodeView separator picker (3 small buttons showing ·, |, / with active-state styling matching SectionRule's style picker pattern from A1b-1).

CSS for Byline appended to `newsletter-prose.css` using mono font + editorial label tokens + hairline borders. Empty-state placeholder via `&::before { content: "(empty byline)"; font-style: italic; }`.

1 new slash item: Byline → EDITORIAL category (icon `User`).

---

## What Bundle A1 collectively delivers

- **6 of 6 foundational singleton nodes** (Pass 1 complete): Eyebrow, Lead, Aside, SectionRule, Byline, Masthead
- **8 of 8 marks** (Pass 4 complete): SmallCaps, Superscript, Subscript, Underline, Highlight, Keyboard, Abbr, Accent
- **2 picker submenus** in bubble menu: Accent (3 rows), Highlight (1 row)
- **22 new design tokens** in marketing-tokens.css
- **1 new directory**: `src/components/newsletter/tiptap/marks/`
- **5 new NodeViews** (Eyebrow/Lead/Aside content-editable in DOM; SectionRule/Masthead/Byline have React NodeViews; Byline NodeView is the largest at ~220 LOC across 3 subcomponents in one file)
- **Bubble menu state machine refactored** to discriminated union (5-way: default/link/abbr/accent/highlight) with Escape handler
- **Custom Mark.create() pattern locked** — no new `@tiptap/extension-*` packages added
- **Parser priority defenses locked** (Callout priority 51, Accent priority 60, Underline excludes Tailwind utility) — codifies as §144 + §145

---

## Active deferred items (carried forward, unchanged unless noted)

- AIRSA Phases 3e-8
- `results_available` notification firing point wiring
- AIRSA facet-interpretation generation gap
- Messaging subsystem prerequisite for `coach_messages` notification type
- `platform_updates` notification type
- Module reorder gap
- MFA trusted-device
- Editor thumbnail-loss-on-republish
- Coach-paid invitation email verification
- `create-checkout` graceful degradation
- SOC 2 written policies
- Action-Oriented Voice Redesign
- Pricing-reads refactor
- Corporate contract renewal schema change
- Clarity Engine
- Session 71 anon EXECUTE audit
- `coach_clients_client_view` SECDEF refactor
- `results_available` NAI/AIRSA/HSS coverage
- `users.last_active_at` infrastructure
- `user_ui_preferences` dedicated table
- Bulk Phase 11 v2
- `/super-admin/coaches` consolidation
- Members Surface v2 polish
- Mentor Portal v2 MQ-1 through MQ-4
- G3 SEO/AEO infrastructure + RSS combined pass
- G9 RSS feed
- `newsletter_categories` v2
- Internal subscriber inclusion (paid product users auto-receive newsletter, queued for G8)
- **Author bio edit UI** — backend ready post-H2-MIG-6 (`users.bio` column + `update_user_bio` RPC). Frontend pending. Not blocking H2 work.

---

## Standing rules locked Sessions 96-97

- **§140 — Supabase default EXECUTE TO PUBLIC re-applies on DROP+CREATE.** When recreating an RPC with a changed signature (e.g., adding params), `REVOKE FROM anon` alone is insufficient — Supabase's default privileges grant `EXECUTE TO PUBLIC` automatically on new function creation. Complete defensive pattern: `REVOKE FROM PUBLIC; REVOKE FROM anon; GRANT EXECUTE TO authenticated, service_role`. CREATE OR REPLACE preserves prior grant state but the defensive triple-statement remains the safest habit on every RPC create-or-replace migration.

- **§141 — Postgres CHECK constraints cannot contain subqueries.** This includes `EXISTS (SELECT FROM unnest(arr))`. For per-element jsonb / text[] / array validation, the validation lives in RPC body (raise exception on bad input) — NOT in CHECK constraint. Discovered during H2-MIG-1: per-element tag length check `EXISTS (SELECT 1 FROM unnest(tags) AS t WHERE length(t) > 32)` raised `0A000: cannot use subquery in check constraint`. Removed; tag length validation deferred to write-path RPC body.

- **§142 — `super_admin_action_types` schema discipline.** The table has 9 NOT NULL columns: `action_type` (text PK), `category` (text NOT NULL with whitelist CHECK in: impersonation, org_management, user_management, admin_role_management, contract_management, content_authoring, platform_observability, usage_management, mfa_management, audit_reporting), `description` (text NOT NULL), plus `tier` nullable and 4 booleans (`requires_reason`, `requires_target`, `is_destructive`, `surfaces_in_recent_actions`) with sensible defaults. Always query `information_schema.columns` on `super_admin_action_types` BEFORE drafting any INSERT migration — `pg_proc` recon does not surface this table.

- **§143 — Atom node + attrs => NodeView ships in same cycle.** TipTap atom nodes (`atom: true`, no `content`) with editable attrs (e.g., SectionRule's `number`, Byline's `entries[]`, Masthead's labels) MUST ship with a React NodeView in the same Lovable cycle as the node itself. Slash inserts of atoms with default-empty attrs produce visibly empty placeholders without a NodeView. If the cycle scope is too large to bundle both, the cycle is too large — split it before shipping. The split pattern proven in A1a/A1b-1/A1b-2: defer atom nodes to a follow-up cycle that bundles them with their NodeViews, rather than shipping atoms-without-NodeViews and creating dead UX.

- **§144 — parseHTML rule priority for selector collisions.** Multiple TipTap extensions registered via `buildExtensions` can claim overlapping selectors. When two rules could match the same DOM, set explicit `priority` on the more-specific rule to win (default is 50; higher wins). Examples locked in A1a/A1b-1: Callout's `aside[data-newsletter-callout]` priority 51 beats Aside's `aside:not(...)` priority 50; Accent's `mark.accent` rules priority 60 beats Highlight's `mark[data-newsletter-highlight]` priority 50; SectionRule's `hr.section-rule`/`hr[data-numbered]`/`hr.dot-divider` priority 60 beats StarterKit HorizontalRule's bare `hr` priority 50 (and SectionRule does NOT register a bare `hr` selector — bare `hr` falls through to HorizontalRule). Pattern: when adding a new node whose root tag is shared with another node, scope the new node's selector to a data-attr or class, AND set priority 51-60 on the more-specific node's rule for the same root tag.

- **§145 — Utility-class selectors are forbidden in parseHTML.** `[class~="underline"]` matches Tailwind's `underline` utility class — any pasted Tailwind HTML would get spurious underline marks applied across unrelated content. Same risk applies to any Tailwind/Bootstrap utility class name. Valid selector families in parseHTML: (a) BrainWise `data-newsletter-X` attribute selectors, (b) semantic HTML tags (`aside`, `kbd`, `sup`, `mark`, `abbr`, `address`), (c) BrainWise-specific class names (`small-caps`, `newsletter-callout`, etc. — those that don't collide with utility frameworks). Specifically excluded: `underline`, `bold`, `italic`, `inline`, `block`, `hidden`, `flex`, `grid`, any single-word styling vocabulary that appears in Tailwind/Bootstrap.

---

## Fix to existing arch-ref entry

- **§136 staleness correction.** §136 lists `content_asset_refs` with 8 nullable parent FKs; actual table has 7 (no `podcast_episode_id` — G7 podcast scope was closed in Session 94 per the Session 91 Anchor RSS pull architecture). Fix at next §136 reference / arch-ref version bump.

---

## What Session 98 should open on

**Bundle A2 = H2-FE-Pass 2** — composite parent+child node pairs. 8 node pairs per spec §4.13:
- DomainGrid + DomainRow
- IndexRow + IndexCard
- StepList + Step
- Checklist + Item
- ThreeColumn + ThreeColumnPane
- FourColumn + FourColumnPane
- ImageGallery
- StatGrid

Pattern reference: existing `TwoColumn.ts` / `TwoColumnPane.ts` and `KeyMoments.ts` / `KeyMoment.ts` pairs in `src/components/newsletter/tiptap/nodes/`. Both use the same defining/isolating + intentionally-not-block-group child pattern that the new 8 pairs will replicate.

**Estimate:** 1-2 Lovable cycles (16 node files at ~70-90 LOC each + slash menu entries + CSS). Likely splits into A2a (4 pairs) + A2b (4 pairs) per the same risk-isolation discipline that worked for A1.

**Per spec §4.13 the remaining H2 frontend roadmap:**
- H2-FE-Pass 2 (composites) — Sessions 98 - this is next
- H2-FE-Pass 3 (refinements to 7 existing nodes — Callout/Pullquote/StatCallout/Image/Embed/TwoColumn/KeyMoments + codeBlock) — Session 98
- H2-FE-Pass 5 (7 interactive/data nodes — Table via `@tiptap/extension-table`, Audio, ImageCompare, Math, Terminal, CodeDiff, Chart) — Sessions 98-99
- H2-FE-Pass 6 (4 article-end nodes — FooterMeta, AuthorBio, Citations, FurtherReading) — Session 99
- H2-FE-Pass 7 (6 interactive/social nodes — CTA, SubscribeBlock, RelatedArticles, Disclosure, Definition, FootnoteRef + Footnotes) — Session 99
- H2-FE-Pass 8 (Poll TipTap node — backend complete, this is node only) — Session 99
- H2-FE-Final (buildExtensions.ts wireup + tiptapDocToPlainText.ts + final CSS pass) — Sessions 99-100

**Remaining after H2:** H3 NodeViews + sidebar + reader auto-render (Sessions 100-102, 10-14 cycles), H4 Edge Function + modal refactor (Session 103, 2-3 cycles), H5 fidelity iteration (Sessions 104-106, 5-8 cycles), H6 Claude vocabulary prompt + reader polish (Session 107, 2-3 cycles).

**Cole runtime verification of Bundle A1 confirmed end of Session 97 — "all is there."** No bugs reported. Future sessions assume A1 is working.

---

## Session 96-97 close artifacts

- This `session-96-to-97.md` handoff
- `build-queue.md` v103 (entry below for the build-queue narrative)
- `architecture-reference.md` v99 (adds §140-§145 + Session 96-97 ship narrative + §136 staleness correction)

Three markdown files for Cole to upload to `cbastianBWE/brainwise-internal-docs` via web UI drag-and-drop.
