---

## Lesson Experience Uplift (Session 138) — Track 2

Append target: end of build-queue.md. Bump the version marker in the doc header to the next number.

### DONE (shipped + verified)
- **scaffold-lesson-outline v25** (deployed): section-first structure (every section opens with a level-2 heading feeding the live TOC; non-final sections close with a `continue` button_stack), content-driven length (length = depth, not block count), Knowles andragogy + retrieval-practice + cognitive-load guidance, `max_outline_items` ceiling 30 → 60.
- **expand-lesson-from-outline v27** (deployed): outline cap 30 → 60; block-level content-quality rule (relevance/WIIFM, prior experience, problem orientation, retrieval, realistic practice + meaningful distractors/feedback, plain language).
- **BlockRenderer luminance color (Phase 4a)** (live): `readableTextColorForBg` WCAG helper; flashcard/card_sort text color derives from background luminance.
- **TP-1 lesson cover redesign** (live): `LessonTitleCard` rebuilt as a full title page — navy hero band (brand primary), brandable logo slot (uploaded logo or default BrainWise spiral mark in brand CTA), derived meta chips, outcomes list, "What's inside" TOC, Start/Resume CTA. Corrective prompt applied after Lovable initially dropped the hero band. (Open polish: default spiral mark is a procedural approximation, not the exact uploaded-logo geometry; fallback-only, optional fix.)
- **TP-3 cover meta** (live): estimated minutes (block-type weights) + section count (heading count) + quick-check count, all client-side.
- **TP-5 resume** (live): `LessonBlockViewer` gates the body behind a `started` state so the cover is a distinct step; `ctaLabel`/`resumeHint` from `completion.lesson_last_block_id`.
- **TP-2 outcomes — backend** (done): `content_items.outcomes text[]` migration applied + schema reloaded.

### IN FLIGHT / PENDING
- **scaffold-lesson-outline v26** — STAGED, NOT yet deployed (dashboard paste; live is still v25). Adds `outcomes` to output `{overview, outcomes, outline}` and writes `content_items.outcomes`.
- **TP-2 outcomes — frontend**: ensure `outcomes` is selected in the viewer/editor content-item queries; manual "Learning outcomes" editor field. (Issued in the corrective Lovable prompt; verify end-to-end after v26 deploy + a fresh lesson build.)

### QUEUED — Interactivity (INT)
Each new block type = §61 5-surface change (lesson_block_types row + config schema, editor form, blockTypeMeta, scaffold catalog + expand schema hint, both renderers).
- INT-1 AI open-response feedback block (L) — top differentiator; new type + feedback edge fn.
- INT-2 instrument-result personalization block (L) — reflects learner PTP/NAI/AIRSA/HSS; moat; needs design.
- INT-3 hotspot / labeled-image block (L) — brain/model diagrams (~4 hotspots).
- INT-4 click-to-reveal block (M-L).
- INT-5 standalone drag-to-order / sequence block (M-L).
- INT-6 branching scenario (L, defer).
- INT-7 confidence-weighted knowledge_check (M) — existing-block enhancement.
- INT-8 activation poll (M, was TP-4) — cover "before we begin" poll; lesson-level prompt + response capture + render; full-title-page only.

### QUEUED — Visual / experience (VIS)
- VIS-1 section header bands numbered + section time (M).
- VIS-2 progress indicators (section X of Y, TOC ticks) (M).
- VIS-3 hero imagery / image-forward layout (M) — reuse lesson-ingest-pexels-asset.
- VIS-4 media-beside-text two-column (M-L).
- VIS-5 animated paced reveal on Continue (S-M, frontend).
- VIS-6 end-of-lesson recap + completion moment (M).
- VIS-7 pull-quote / stat / key-takeaways styling polish (S-M, CSS).
- VIS-8 brand display/body fonts inside blocks (S) — verify inheritance first.

### Sequencing
Phase 1: TP-1 corrective + TP-2 frontend, then VIS-1/2/5/7/8 (no new block types). Phase 2: INT-1, VIS-3, VIS-6. Phase 3: INT-3/4/5/8. Phase 4: INT-2/6/7. Caution: interactivity must serve the objective; more is not better.
