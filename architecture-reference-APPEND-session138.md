---

## Session 138 — Lesson authoring + lesson cover

Append target: end of architecture-reference.md. Bump the version marker in the doc header to the next number.

### Data model
- **`content_items.outcomes text[]`** — lesson-level learner outcomes ("by the end you'll be able to ..." statements). Written server-side (service role) by `scaffold-lesson-outline` v26 and editable manually in the lesson editor. Rendered on the lesson cover. Nullable; empty is valid. `NOTIFY pgrst 'reload schema'` issued after the column was added.

### Edge functions
- **`scaffold-lesson-outline`** output contract: v25 returns `{overview, outline}` and writes `overview → content_items.description`. **v26 (staged, deploy via dashboard)** returns `{overview, outcomes, outline}`, writes `description` (from overview) and `outcomes` (3-5 action-verb strings) to `content_items` in one update. Still ONE Anthropic call (`claude-opus-4-7`). ~28KB so dashboard-paste only (MCP deploy truncates). fn id `5d52afb6-0f90-4e2e-a7c4-e65e78f6275a`.
- **`expand-lesson-from-outline` v27**: outline cap 60; block-level andragogy content-quality rule. fn id `05aa797e-552d-443c-8058-92f9f6ade576`.

### Lesson cover / viewer
- **`LessonTitleCard`** is the full lesson cover: a navy hero band (brand `color_primary`) with logo, title (brand display font), description, and meta chips, over a brand-surface body containing the outcomes list ("By the end you'll be able to") and the "What's inside" TOC, plus the Start/Resume CTA. Brand-token driven via `lesson_brands` (`logo_path`, `color_primary/cta/surface/accent`, `font_display_key/body_key`); when no `logo_path`, a default BrainWise spiral mark renders in the brand CTA color via `currentColor`.
- Cover meta is derived client-side: estimated minutes from per-block-type weights, section count = heading count from `buildLessonToc`, quick-check count = number of `knowledge_check` blocks.
- **`LessonBlockViewer`** gates the lesson body behind a `started` state, so the cover is a distinct "start" step (not an inline header). `enterLesson(blockId?)` flips `started` and optionally scrolls to a block (used by the cover's "What's inside" links). `ctaLabel`/`resumeHint` are derived from `completion.lesson_last_block_id` (Resume vs Start). The existing resume-on-mount effect still places the learner at their furthest section once the body renders.
- The lesson TOC keys purely on `block_type === "heading"` (`lessonToc.ts` `buildLessonToc`), so heading-dense outlines (the v25 section-first structure) produce richer covers and sidebars automatically.
