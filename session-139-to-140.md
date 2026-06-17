# Session 139 → 140 Handoff

**Arc:** Lesson Experience uplift, Phase 1 (visual + brandability). All frontend, no backend, no new block types. Every file SHA-verified at HEAD `3a0a670`.

---

## Shipped and verified this session (commit trail)

| Item | What | Commit |
|---|---|---|
| Hooks-order crash fix | `LessonBlockViewer.tsx` `tocEntries`/`activeTopicId` useMemos moved above the loading/error early returns (React #310 on the rebuilt 42-block lesson). Reinforces the §137 hooks-order convention. | `3874c64` |
| VIS-1 section bands | Numbered band (navy-tint + orange rule + badge + title + "~N min") replaces each section's leading heading; carries the promoted heading's `setBlockRef` + `data-block-id` so TOC scroll lands; degrades to number+time when no heading. NEW `lessonEstimate.ts` (`BLOCK_MINUTE_WEIGHTS` + `estimateMinutes`, extracted from the cover). | `3874c64` |
| VIS-2 progress indicators | `completedSections` useMemo (visited AND all gating-required blocks complete); resume seeds `visitedSections`; TOC header progress bar + "X/Y" + per-entry done/active/todo markers. | `a8f67e2` |
| VIS-5 paced-reveal animation | `bw-section-enter` (280ms fade+rise, `prefers-reduced-motion` guarded) in `lesson-blocks.css`; band+blocks wrapper keyed on section index so each Continue replays. | `4dc950b` |
| VIS-7 brand-aware pull-quote | `QuoteRender` → `.bw-pullquote` class. Callout (4 variants) + stat_callout were already well-styled, so VIS-7 was scoped to the quote only. | `d513e6d` → brand-aware |
| Brand-variable layer | Viewer + editor read `lesson_brands` and set `--lesson-primary/cta/accent/surface` + `--font-display` + body `fontFamily` on their wrappers; blocks consume the vars. | `8d05e51` |
| Brandability sweep B1 (CSS) | `lesson-blocks.css` brand literals → `var(--lesson-*, <default>)` (cta 18 / primary 22 / surface 8 / accent 1); semantics intact. | `109bc60` |
| Brandability sweep B2 (renderer) | `BlockRenderer.tsx` property-scoped literals → `var(--lesson-*)`; tabs Tailwind brackets; flashcard face → `--lesson-surface`; callout info→accent / important→cta via `color-mix`; contrast helper + warning/success untouched. | `52e45ad` |
| VIS-8 brand fonts | NEW `lessonFonts.ts` (`FONT_MAP` + `resolveFont`, extracted from the cover); viewer/editor set `--font-display` + body font; `HeadingRender` swapped the literal `font-display` class for inline `fontFamily: var(--font-display, …)`. | `3a0a670` |

**Carried in from Session 138, confirmed live this session:** `scaffold-lesson-outline` v26 (`{overview, outcomes, outline}`); TP-1 navy-hero cover + 13-circle spiral mark; TP-2 outcomes wired (editor `LessonBlocksEditor` itemQuery selects `outcomes` + `LessonOutcomesPanel`; viewer `ContentItemViewer` dedicated `content-item-outcomes` query merged onto the contentItem before the cover); fresh replace-mode build of the test lesson (description + 5 outcomes + 42 blocks / 8 sections / 7 continue buttons / 5 interactive / 5 brand-bg blocks).

---

## Durable architecture (recorded in architecture-reference v140)

- **The render-time per-lesson brand-variable layer is now the home for all lesson-block theming.** Viewer (`LessonBlockViewer.tsx`) and editor (`LessonBlocksEditor.tsx`) set `--lesson-primary/cta/accent/surface` + `--font-display` + body `fontFamily` from `lesson_brands` on their content wrappers; `lesson-blocks.css` and `BlockRenderer.tsx` consume the vars. **Wire new block colors/fonts through these vars: do not reintroduce literal brand hexes into the CSS or renderer.**
- **Keep-fixed, never branded:** forest `#2D6A4F`, red `#D62828`, amber `#FFB703`, gray `#6D6875` + Tailwind grays, white, and the `readableTextColorForBg` WCAG contrast helper. These are status/contrast, not brand.
- **Shared extractions:** `lessonEstimate.ts` and `lessonFonts.ts`, both pulled from `LessonTitleCard` (cover re-imports them).
- **Section model:** a section = the run of blocks between `button_stack` continue delimiters; scaffold seeds a leading level-2 heading; VIS-1 promotes that heading into the band.
- **Fonts caveat:** assumes the `FONT_MAP` fonts are loaded app-wide (same assumption the cover makes). If the brand picker ever offers an unloaded font it will fall back; a future tightening is to constrain the picker to loaded fonts.

---

## Outstanding actions for next session (Phase 2, in order)

1. **INT-1, AI open-response feedback block** (the differentiator). New block type (§61 5-surface change: `lesson_block_types` row + config schema, editor form, `blockTypeMeta`, scaffold catalog + expand schema hint, both renderers) + a new feedback edge function (learner writes free text, Anthropic returns formative coaching). Backend-first: build + verify the edge function before any Lovable prompt. Two sequential Opus calls cannot share one edge function (150s ceiling), so keep the feedback call single-shot.
2. **VIS-3, hero imagery / image-forward layout.** Optional lesson hero image; reuse `lesson-ingest-pexels-asset` v2. Lighter; mostly frontend + the existing ingest path.
3. **VIS-6, end-of-lesson recap + completion moment.** Optional AI recap.

**Caution carried from research:** interactivity must serve the objective; a stuffed lesson teaches worse than a focused one. Prefer fewer, well-placed interactions.

---

## Backlog beyond Phase 2

- **Phase 3 (new interactive types):** INT-3 hotspot/labeled-image, INT-4 click-to-reveal, INT-5 standalone drag-to-order, INT-8 activation poll (was TP-4).
- **Phase 4 (big/optional):** INT-2 instrument-result personalization, INT-6 branching scenario, INT-7 confidence-weighted knowledge_check.
- **VIS-4** media-beside-text two-column layout (M-L; likely a new block type/layout).
- Standing carryforward (non-lesson): SCORM export + import & API setup; `BQ-SUPERVISOR-DASH` (supervisor access to company dashboards + per-supervisor disable toggle in Members); Operations externalization arc; newsletter `BUG-NWS-1` + Group H closure; Doc-1 invoice live refund test.

---

## Standing reminders (carry forward)

- Newsletter `STATIC_ROUTES` manual-edit reminder on any newsletter/sitemap/SEO/new-marketing-page work.
- `ops-stripe-webhook` (`be435d9f`) and platform `stripe-webhook` (`fb9725d2`) never cross-modified.
- MCP `deploy_edge_function` truncates payloads ~25KB+: scaffold (~28KB) and expand (~61KB) are dashboard-paste; `get_edge_function` is authoritative for deployed code.
- Supabase MCP discipline: `apply_migration` then a separate `execute_sql` verify; `NOTIFY pgrst, 'reload schema'` after new tables/columns/RPCs; new SECDEF functions need explicit `REVOKE`/`GRANT` (§156/§157).
- New block types are the §61 5-surface change.
- GitHub MCP is READ-ONLY; Cole runs all Lovable prompts and GitHub uploads manually.
- Verify shipped frontend at a pinned commit SHA via the GitHub API, never the raw CDN (can be stale).

---

## Test fixture (session-use)

- Test lesson `content_item_id e5c208f2-6885-482e-8d8b-8325f9cbaf5d` ("The Model and the Two States"), exercised the full Phase 1 stack this session.

---

## Versioning note

Sessions 137-138 did not leave numbered changelog entries in build-queue.md (their work lives in the open-queue Session-137 banner + the session-137/138 handoffs), and Session 138 left no architecture-reference entry. This close therefore continues the integer sequence from the highest present: **build-queue v144 → v145**, **architecture-reference v139 → v140**. If a Session-138 v140/v146 exists elsewhere, reconcile before upload.
