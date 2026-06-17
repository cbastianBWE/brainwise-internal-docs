# Session 138 → 139 Handoff

**Arc:** Track 2 lesson-authoring quality + lesson experience uplift (Phase 4a color, Phase 4b/4c authoring quality, Title Page redesign).

---

## Shipped and verified this session

### Phase 4a — on-brand AI lesson color (carried in from prior, confirmed live)
- `BlockRenderer.tsx` luminance helper (`readableTextColorForBg`) live on main; flashcard/card_sort text color now derives from background luminance (WCAG), replacing the fixed 8-color table.
- `expand-lesson-from-outline` brand-color policy (tinted block backgrounds, saturated dividers/flashcard/cardsort) shipped as part of v26 (see below).

### Phase 4b/4c — authoring quality (scaffold + expand)
- **`scaffold-lesson-outline` v25** (deployed, verified, `verify_jwt` false, fn id `5d52afb6-0f90-4e2e-a7c4-e65e78f6275a`):
  - Section-first structure: every section opens with a level-2 heading (feeds the live TOC from `lessonToc.ts`); each section except the last closes with a `button_stack` single `continue` button (paced reveal in trainee viewer). Orienting section first, consolidation section last.
  - Content-driven length: no fixed outline item target; length preference = DEPTH only; counts = teaching blocks only (headings + continue buttons additional). Removed itemCount caps from the prompt.
  - Adult-learning-theory section (Knowles 6 andragogy principles + retrieval practice + cognitive-load chunking); learner-facing language kept plain (voice governs tone).
  - `max_outline_items` request ceiling 30 → 60.
- **`scaffold-lesson-outline` v26** (STAGED for dashboard paste at session close — NOT yet deployed; ~28KB so MCP-truncates, must be pasted): adds `outcomes` to the output (`{overview, outcomes, outline}`). `outcomes` = 3-5 learner-facing "by the end you'll be able to" statements (action verbs), written to `content_items.outcomes`. **ACTION: Cole pastes v26 into the Supabase dashboard, then verify via `get_edge_function` (expect version 26).**
- **`expand-lesson-from-outline` v27** (deployed, verified, `verify_jwt` false, fn id `05aa797e-552d-443c-8058-92f9f6ade576`): outline cap 30 → 60; added a content-quality rule applying Knowles andragogy at the block-writing level (relevance, prior experience, problem orientation, retrieval practice, realistic practice + meaningful distractors/feedback), language plain.

### Title Page (TP track)
- **TP-1 cover redesign** — shipped to main via Lovable. Component `LessonTitleCard.tsx` rewritten (brandable logo slot, derived meta chips, outcomes, what's-inside, Start/Resume). **NOTE: Lovable diverged from the approved mockup on two points — it dropped the navy hero band (rendered a two-column card on the sand surface instead) and substituted a generic arc-and-dot SVG for the real BrainWise spiral mark. A corrective Lovable prompt was issued to pin the exact navy-hero design and the real 13-circle spiral mark. Confirm the corrective prompt landed.**
- **TP-3 estimated time + section count** — DONE (computed client-side in the cover component from block-type weights + heading count + knowledge_check count).
- **TP-5 resume state** — DONE. `LessonBlockViewer.tsx` shipped the `started` gate (cover is a distinct step), `enterLesson`, and `ctaLabel`/`resumeHint` driven by `completion.lesson_last_block_id`. Verified on main.
- **TP-2 lesson outcomes — BACKEND DONE:**
  - Migration `add_outcomes_to_content_items`: `content_items.outcomes text[]` (verified present; `NOTIFY pgrst 'reload schema'` issued).
  - scaffold v26 writes outcomes (staged for paste, above).
  - **Frontend remaining:** ensure `outcomes` is selected wherever the content item is loaded for the lesson viewer and the lesson editor (or `select('*')`), and add an optional manual "Learning outcomes" editor field. Cover already renders `contentItem.outcomes` (empty-safe). Combined into the corrective Lovable prompt.
- **TP-4 activation poll — DEFERRED to backlog.** It is a genuine new interactive capture (storage + record RPC + render), not a cover tweak; it does not block the cover. Tracked as INT-8 below.

### Title-page design decision
- Three cover options mocked (full title page / enriched card / hybrid hero). Cole selected **full title page** ("exactly what I want"). Mockup rendered in BrainWise default palette; real cover is brand-token driven (logo via `lesson_brands.logo_path`, default = BrainWise spiral mark recolored to brand CTA via `currentColor`).
- BrainWise logo mark recreated as a 13-circle clockwise-shrinking spiral SVG (coords computed; see corrective prompt). Reusable as a small SVG component.

---

## Verified recon (no action, reference)
- TOC is live and keys purely on `block_type === "heading"` (`lessonToc.ts` `buildLessonToc`), consumed by `LessonTitleCard` and the trainee `LessonBlockViewer` sticky sidebar. More headings → richer TOC automatically.
- Continue buttons are functional in the trainee viewer (`LessonBlockViewer` has `LessonCompletionMode = explicit_continue | scroll_and_checks`, detects `action_type==="continue"`; new lessons default `explicit_continue`). The editor `BlockRenderer` continue click is a no-op (author preview only).
- `content_items` has `description` (title-card description, written by scaffold overview) and now `outcomes`. Blocks live in `lesson_blocks`. `lesson_block_types` catalog has `is_interactive`/`category`/`is_v1_active`.
- Full-lesson scaffold call site = `src/components/super-admin/lesson-blocks/ai-pane/AiPane.tsx` (does NOT pass `max_outline_items`, so edge default 12 applies, which now only shapes depth wording, not length). `IterationModal.tsx` passes `max_outline_items: 1` for single-block iteration.
- 18 block types; interactive/scored: accordion, button_stack, card_sort, flashcards, scenario, tabs, knowledge_check.

---

## Outstanding actions for next session (in order)
1. **Paste `scaffold-lesson-outline` v26** (dashboard), verify version 26 via `get_edge_function`.
2. **Run the corrective Lovable prompt** (navy-hero cover + real spiral mark + TP-2 frontend: select `outcomes`, manual outcomes field). Verify on main.
3. **Fresh replace-mode build** on the test lesson (`content_item_id e5c208f2-6885-482e-8d8b-8325f9cbaf5d`, "The Model and the Two States") to exercise color + description + outcomes + sections/TOC + continue pacing + interactivity in one pass. Current blocks predate all of it.
4. Begin INT/VIS backlog (below), Phase 1 first.

---

## Backlog — Title Page remainder + Interactivity + Visual (carry forward)

### TP remainder
- **TP-2 frontend** (S): select `outcomes` in viewer/editor content-item queries; manual "Learning outcomes" editor field. (In corrective prompt.)

### Interactivity (INT) — new/upgraded block types; each new type = §61 5-surface change (lesson_block_types row + config schema, editor form, blockTypeMeta, scaffold catalog + expand schema hint, both renderers)
- **INT-1 AI open-response feedback block** (L, differentiator): learner writes; Anthropic returns formative coaching. New block type + feedback edge function. Leverages existing Anthropic integration.
- **INT-2 instrument-result personalization block** (L, moat): reflect learner's own PTP/NAI/AIRSA/HSS scores into the lesson. New block type + results wiring + RLS. Needs design pass.
- **INT-3 hotspot / labeled-image block** (L): click regions on an image (brain/model diagrams). Canonical labeling interactivity (~4 hotspots ideal).
- **INT-4 click-to-reveal block** (M-L): non-sequential reveal tiles.
- **INT-5 standalone drag-to-order / sequence block** (M-L): currently only ranking inside knowledge_check.
- **INT-6 branching scenario** (L, defer): upgrade linear scenario to branching. High engagement, high cost; only when a lesson needs it.
- **INT-7 confidence-weighted knowledge_check answers** (M): add "how sure are you" + feedback. Enhancement to existing block.
- **INT-8 activation poll** (M, was TP-4): "before we begin" cover poll. Lesson-level prompt (store on content_items) + response capture table/RPC + cover render. Optional, full-title-page only.

### Visual / experience (VIS) — mostly frontend/prompt, few new types
- **VIS-1 section header bands** (M): numbered section headers with section est. time. Cashes in the section-first scaffold work.
- **VIS-2 progress indicators** (M): section X of Y, TOC completion ticks. Uses completion reporter data.
- **VIS-3 hero imagery / image-forward layout** (M): optional lesson hero image; reuse `lesson-ingest-pexels-asset` (v2).
- **VIS-4 media-beside-text two-column layout** (M-L): new block type or layout option.
- **VIS-5 animated paced reveal on Continue** (S-M): fade/slide next section in. Frontend only.
- **VIS-6 end-of-lesson recap + completion moment** (M): optional AI recap.
- **VIS-7 pull-quote / stat / key-takeaways styling polish** (S-M): mostly CSS.
- **VIS-8 brand display/body fonts inside blocks** (S): verify current inheritance first.

### Recommended sequencing
- **Phase 1 (best ratio):** TP-1 corrective + TP-2 frontend, then VIS-1, VIS-2, VIS-5, VIS-7, VIS-8 (frontend, no new block types).
- **Phase 2 (differentiators):** INT-1 (AI feedback), VIS-3 (hero imagery), VIS-6 (recap).
- **Phase 3 (new interactive types):** INT-3 hotspot, INT-4 reveal, INT-5 sequence, INT-8 activation poll.
- **Phase 4 (big/optional):** INT-2 personalization, INT-6 branching, INT-7 confidence.
- Caution carried from research: interactivity should serve the objective (more is not better); a stuffed lesson teaches worse than a focused one.

---

## Standing reminders (carry forward)
- Newsletter `STATIC_ROUTES` manual-edit reminder on any newsletter/sitemap/SEO/new-marketing-page work.
- `ops-stripe-webhook` (`be435d9f`) and platform `stripe-webhook` (`fb9725d2`) never cross-modified.
- `create-checkout` fragile re `coach_user_id` metadata.
- MCP `deploy_edge_function` truncates payloads ~25KB+: scaffold (~28KB) and expand (~61KB) are dashboard-paste; `get_edge_function` is authoritative for deployed code.
- Supabase MCP discipline: verify with `execute_sql` after every migration; `NOTIFY pgrst, 'reload schema'` after new tables/columns/RPCs.
- GitHub MCP is READ-ONLY; Cole runs all Lovable prompts and GitHub uploads manually.

---

## Canonical-doc deltas to append (mega-files not rewritten here)

**build-queue.md** — append a "Lesson Experience uplift (Session 138)" section:
- DONE: scaffold v25 (section-first + andragogy + content-driven length), expand v27 (cap 60 + content andragogy), BlockRenderer luminance (4a), TP-1 cover (corrective pending), TP-3 meta, TP-5 resume gate, TP-2 backend (outcomes column + scaffold v26 staged).
- QUEUED: TP-1 corrective + TP-2 frontend; INT-1..8; VIS-1..8 (see handoff for sizes/sequencing).

**architecture-reference.md** — append entries:
- `content_items.outcomes text[]` — lesson-level learner outcomes, written by `scaffold-lesson-outline` (overview→description, outcomes→outcomes), rendered on the lesson cover.
- `scaffold-lesson-outline` v26 output contract `{overview, outcomes, outline}`.
- Lesson cover (`LessonTitleCard`) is a distinct "start" step gated by `started` state in `LessonBlockViewer`; brand-token driven (logo via `lesson_brands.logo_path`, default BrainWise spiral mark recolored to brand CTA).
- Cover meta (minutes/sections/checks) derived client-side; sections = heading count from `buildLessonToc`.
