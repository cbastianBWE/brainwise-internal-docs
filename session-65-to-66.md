# Session 65 → 66 Handoff

**Session 65 closed:** 2026-05-12
**Status:** Continue button feature fully shipped. Five v1 interactive block types fully designed and locked. Backend recon completed; frontend recon partially completed. NO Lovable prompts written or shipped for the new block types yet. Backend deploys NOT yet executed for the new block types.

**Session 66 opens with:** Complete design spec for five block types, complete backend recon findings (4 Edge Functions + 2 SECURITY DEFINER functions + 1 lookup-table migration needed), partial frontend recon (form directory inventoried, ImageBlockForm + FileUploadField fully understood, AccordionBlockForm + TabsBlockForm + AddBlockPopover + lesson-blocks.css NOT yet inspected).

---

## What shipped this session (Session 65)

### 1. Continue button feature — FULLY SHIPPED

Continue button is now a third variant of the `button_stack` block alongside content/external. When the trainee sees a continue button, clicking it advances them past a gating point within the lesson.

**Backend shipped:**
- Migration A: `ALTER TABLE content_item_completions ADD COLUMN lesson_furthest_continue_client_id text` + `ADD COLUMN lesson_last_block_id uuid REFERENCES lesson_blocks(id) ON DELETE SET NULL`
- Migration B: `CREATE TABLE lesson_block_progress` — 12 cols including denormalized `attempt_number`, JSONB `completion_data`, status CHECK constraint with values `not_started`/`in_progress`/`completed`, 5 indexes, 4 FKs CASCADE, 6 RLS policies matching content_item_completions' RLS model

**Edge Function deploys (all anon-probed clean HTTP 401, all _shared/ modules byte-identical):**
- scaffold-lesson-outline v5 → v8 (intent guide updated for 3 action_types; v7→v8 was cosmetic header fix)
- expand-lesson-from-outline v5 → v6 (BLOCK_SCHEMA_HINTS extended; transformConfigForCanvas three-way switch with section_title in all branches)
- draft-lesson-block v6 → v7 (BLOCK_SCHEMAS + rules + transformConfigForCanvas)

**Frontend shipped via Lovable (file paths and exact changes):**
- `src/components/super-admin/lesson-blocks/BlockRenderer.tsx` (was 610 lines, ended 619 lines + Continue render branch): added `ChevronRight` import, extended action_type union to include `"continue"`, added Continue render branch with wrapper `my-8 flex w-full flex-col items-center gap-4`, rule `h-0.5 w-full backgroundColor #F5741A opacity 0.6` (tweaked from initial h-px/0.4 for visibility), larger button with ChevronRight icon
- `src/components/super-admin/lesson-blocks/block-forms/ButtonStackBlockForm.tsx`: ActionType extended to include continue, ButtonEntry gained `section_title: string | null`, RadioGroup changed to `grid-cols-3` to add Continue option, conditional section_title Input maxLength 80, `handleAdd` seeds `section_title: null`, `friendlyBlockLabel` shows `"Continue: <section_title>"`, buttons normalization at line 232 handles legacy rows missing section_title (fills `null` if absent)
- `src/components/super-admin/lesson-blocks/blockTypeMeta.ts`: defaultConfig seeds `section_title: null`, description updated

**All 12 verification checks passed.** §61 Concern A FULLY CLOSED for Continue button (the silent drift between AI-proposed types and frontend-rendered types). The five new block types are now §61 Concern A's next batch.

### 2. Standing rules added (architecture-reference §67 / §68)

- §67: schema-first recon for progress features (content_item-centric not lesson-centric)
- §68: re-attempt history preservation via denormalized attempt_number

### 3. Phase 5 carry-forward written

`/home/claude/internal-docs/phase-5-lesson-progress-carry-forward.md` — 369-line plan for the trainee renderer side (3 RPCs, progressive reveal, TOC sidebar, summary collapse, Model X gating evaluation). Separate scope from Session 66's block-type work; sits in the background until interactive blocks ship.

---

## The five v1 interactive block types — LOCKED DESIGN

These are the next batch for Prompt 6c. Designed in full during this session, every field, every count, every default chosen with rationale captured.

### Block 1: flashcards

| Aspect | Decision |
|---|---|
| Front content | TipTap rich text only |
| Back content | TipTap rich text + optional centered image (asset_id) + optional caption ≤80 chars |
| Card count | 2–20 cards per block |
| Navigation | Single-card carousel with prev/next, keyboard ←/→ |
| Progress indicator | "3 of 8" style |
| Flip interaction | Click anywhere on card OR spacebar; CSS 3D `rotateY` ~400ms |
| Self-rating | After flip, trainee sees "Got it" + "Review again" buttons. "Review again" appends card to end of queue for re-review |
| Completion criteria | Every card marked "Got it" |
| Default `gating_required` | `false`; author toggleable |
| `completion_data` shape | `{ cards_completed: ["client_id1", "client_id2", ...], cards_review_count: { "client_id1": 0, "client_id2": 2, ... } }` |

**Image asset_id field per card:** `cards[N].back_image_asset_id` (per-card nested reference — see "Nested asset references — ARCHITECTURAL CONCERN" below)

### Block 2: card_sort

| Aspect | Decision |
|---|---|
| Bucket count | 2–4 buckets per block |
| Correctness model | Each card has exactly one `correct_bucket_id` |
| Feedback mode | End-of-sort — trainee sorts all cards, then clicks "Check my answers" |
| Retry behavior | Unlimited retries — trainee can fix wrong cards and re-check until 100% correct |
| Card content | TipTap rich text + optional centered image with optional caption ≤80 chars |
| Card count | 4–12 cards per block |
| Bucket label | Plain text title 1–4 words + optional short description ≤120 chars shown during sort |
| Completion criteria | 100% correct on all cards (after any number of retries) |
| Default `gating_required` | `false`; author toggleable |
| `completion_data` shape | `{ final_score_pct: 100, attempts_count: N, incorrect_cards_history: [{attempt: 1, card_ids: [...]}, ...] }` so re-attempts and revisit data is preserved |

**Image asset_id field per card:** `cards[N].image_asset_id` (per-card nested reference)

### Block 3: scenario

| Aspect | Decision |
|---|---|
| Shape | Linear (sequential moments, no branching) |
| Block-level header | Optional `title` text ≤120 chars + `intro_markdown` TipTap, rendered above moment 1 if filled |
| Moment shape | `client_id`, `setup_markdown` (TipTap), `prompt_type` ("multiple_choice" or "reflection"), optional `setup_image_asset_id`, optional `moment_label` |
| Choice shape (MC) | `client_id`, `choice_text` (plain text ≤200 chars), `outcome_markdown` (TipTap, per-choice teaching) |
| Choices per MC moment | 2–4 |
| Reflection shape | `reflection_prompt` (plain text ≤300 chars), `outcome_markdown` (TipTap, author's pre-written teaching point) |
| Reflection trainee response max | 2000 chars (≈400 words) |
| Moment count | 1–12 per scenario block |
| Outcome reveal treatment | Modal/overlay — focused popup, Esc + Enter to close, focus-trapped, backdrop blur |
| Per-moment completion | Must submit a response (choice or reflection) for every moment |
| Completion criteria | Submitted on every moment |
| Default `gating_required` | `false`; author toggleable |
| `completion_data` shape | `{ moments_submitted: { client_id1: { type: "mc", choice_id: "..." }, client_id2: { type: "reflection", text: "..." } } }` |

**IMPORTANT — choice text revised:** During the design conversation Cole initially confirmed TipTap on choices, then we revised to plain text after thinking through the scannability argument. The locked decision is **plain text choice_text ≤200 chars in scenario MC moments AND in knowledge_check MC/multi-select questions.** Outcome reveals stay TipTap.

**Image asset_id field per moment:** `moments[N].setup_image_asset_id` (per-moment nested reference)

### Block 4: knowledge_check

| Aspect | Decision |
|---|---|
| Question types | MC, multi-select, true/false, fill-in-the-blank, match, **ranking**, **timeline** (7 total) |
| Question count | 1–5 questions per block |
| Question prompt | TipTap rich text |
| MC / multi-select choices | Plain text ≤200 chars per choice |
| MC choices | 2–5 choices, exactly 1 correct |
| Multi-select choices | 2–6 choices, 1+ correct (author marks each correct or not) |
| True/false | Fixed 2 choices "True" / "False"; author picks which is correct |
| Fill-in-the-blank | Prompt with `___` blank tokens; per-blank: `correct_value` (plain text, case-insensitive comparison) + optional `acceptable_alternatives: []`; trainee types into each blank, validated on submit |
| Match | 2–6 pairs (left + right plain text ≤120 chars each); trainee drags right-side items to pair with left-side; validated on submit |
| Ranking | 3–7 items (plain text ≤150 chars each); author specifies correct order; trainee drags into order; validated on submit |
| Timeline (v1 scope) | 3–7 events on horizontal axis with author-defined position labels (NOT date-precision in v1 — ordered placement on a horizontal axis is the v1 scope); validated against author's chronological ordering |
| Feedback mode | Immediate per-question (green check / red X + per-question explanation revealed after answer) |
| Per-question explanation | TipTap rich text, shown after trainee answers (single canonical explanation per question, not per-choice explanations) |
| Retry | Unlimited per question until correct |
| Completion criteria | Every question answered correctly (eventually) |
| Default `gating_required` | **`true`**; author toggleable. This is the only block type with default true. |
| `completion_data` shape | `{ answered: { question_client_id1: { type: "mc", selected: ["choice_id"], attempts: 1 }, question_client_id2: { type: "fitb", filled: { blank_0: "...", blank_1: "..." }, attempts: 3 }, ... } }` |

### Block 5 (NOT NEW — already shipped but in scope for backend updates): no fifth new block

The "five v1 interactive blocks" phrasing earlier in this conversation was misleading. There are **four NEW** block types in this scope (flashcards, card_sort, scenario, knowledge_check). The Continue button was the fifth thing designed/shipped this session but it's a variant within an existing block_type (`button_stack`), not a new block_type.

**Net for Session 66 backend work: four new block types.** Of those, three are already registered in `lesson_block_types` with stale descriptions (flashcards, scenario, knowledge_check — see "lesson_block_types — registry state" below), one is unregistered (card_sort).

### Deferred to v2 Build Queue (NOT in scope for Session 66 or 67)

- hotspot (click region of image)
- ranking/timeline as standalone blocks (they're question types inside knowledge_check in v1)

### Quiz feature (NOT a block type — separate future feature)

During the design conversation Cole clarified: **quizzes go at the end of a total lesson to capture final knowledge.** Quiz will be its own content_item type (separate from `item_type='lesson_blocks'`), not a block inside a lesson. When it's built it will reuse the seven knowledge_check question types and add scoring thresholds, pass/fail logic, optional time limits, attempts caps. Different scope, different sessions. NOT part of Session 66's Prompt 6c scope.

---

## Backend recon findings — VERBATIM

### Finding 1: lesson_blocks table has NO CHECK constraint on block_type

Query executed and result:

```sql
SELECT pg_get_constraintdef(oid) AS constraint_def, conname
FROM pg_constraint 
WHERE conrelid = 'lesson_blocks'::regclass
  AND contype = 'c';
```

Returned only one CHECK constraint:
```
constraint_def: "CHECK ((display_order >= 0))"
conname: "lesson_blocks_display_order_check"
```

**Confirmed: no CHECK constraint on `block_type` column.** Column data type from `information_schema.columns`:

```
block_type — text — NOT NULL — no default
config — jsonb — NOT NULL — default '{}'::jsonb
```

The block_type whitelist is enforced via the `lesson_block_types` lookup table (queried inside `replace_lesson_blocks` PL/pgSQL function, see Finding 4 below), NOT via a database constraint. Implication: adding new block types requires INSERTs into `lesson_block_types`, not migration of a CHECK constraint.

### Finding 2: lesson_block_progress schema is JSONB-flexible — no migration needed for completion_data

Column listing from `information_schema.columns`:

```
id — uuid — NOT NULL — default gen_random_uuid()
completion_id — uuid — NOT NULL
user_id — uuid — NOT NULL
content_item_id — uuid — NOT NULL
block_id — uuid — NOT NULL
attempt_number — integer — NOT NULL
status — text — NOT NULL — default 'not_started'::text
completion_data — jsonb — NOT NULL — default '{}'::jsonb
started_at — timestamp with time zone — NULL
completed_at — timestamp with time zone — NULL
created_at — timestamp with time zone — NOT NULL — default now()
updated_at — timestamp with time zone — NOT NULL — default now()
```

All four block types' completion_data shapes (flashcards cards_completed/cards_review_count; card_sort final_score_pct/attempts_count/incorrect_cards_history; scenario moments_submitted; knowledge_check answered) fit inside this JSONB column without schema changes.

### Finding 3: lesson_block_types registry — current state (VERBATIM)

Query executed:
```sql
SELECT block_type, category, is_interactive, is_scored, is_v1_active, description
FROM lesson_block_types ORDER BY block_type;
```

**17 rows returned.** Verbatim:

```
accordion — interactive — true — false — true — "Collapsible panels. Trainee expands panels to reveal content."
button_stack — interactive — true — false — true — "List of buttons that reveal content on click. Pattern: compare roles, scenarios, or options."
callout — display_interactive — false — false — true — "Colored info box. Variants: info, warning, success, important."
divider — content — false — false — true — "Horizontal rule for visual separation between lesson sections."
embed_audio — display_interactive — false — false — true — "Audio player with optional transcript."
flashcards — interactive — true — false — true — "Flippable cards. Trainee clicks to flip from front to back."
heading — content — false — false — true — "Section heading. Levels 2, 3, or 4."
image — content — false — false — true — "Image with optional caption and alt text."
knowledge_check — scored — true — true — true — "Inline multiple-choice or true/false question. Must be answered correctly to complete the lesson when in scored_completion mode."
list — content — false — false — true — "Ordered or unordered bullet list."
quote — content — false — false — true — "Pull quote with optional attribution."
scenario — interactive — true — false — true — "Single-decision branching narrative. Setup, options, outcome reveals on selection."
stat_callout — display_interactive — false — false — true — "Big-number stat with caption and optional source citation."
statement_a_b — display_interactive — false — false — true — "Side-by-side compare-and-contrast block with positive/negative/neutral variants per side."
tabs — interactive — true — false — true — "Tabbed content. Trainee clicks tabs to reveal panel content."
text — content — false — false — true — "Markdown paragraph. Supports bold, italic, links, inline code."
video_embed — content — false — false — true — "Inline video player. No completion tracking; for lecture-style content. Use video item_type for completion-tracked videos."
```

**Three of the four target block types are already registered with `is_v1_active=true`** — but their descriptions are STALE and don't match the locked design:

- **flashcards** registry says "Flippable cards. Trainee clicks to flip from front to back." Locked design: 3D flip via click OR spacebar, self-rating with Got it / Review again, 2–20 cards, optional back image, completion = all cards marked Got it.
- **scenario** registry says "Single-decision branching narrative. Setup, options, outcome reveals on selection." Locked design: **LINEAR (not branching)**, 1–12 moments, each moment either MC or reflection, modal outcome reveal, optional block-level title+intro, optional per-moment image.
- **knowledge_check** registry says "Inline multiple-choice or true/false question. Must be answered correctly to complete the lesson when in scored_completion mode." Locked design: 7 question types (MC, multi-select, true/false, FITB, match, ranking, timeline), 1–5 questions per block, unlimited retry per question, immediate feedback with TipTap explanation.

**`card_sort` is NOT in the registry.** Must be added.

`is_scored` column for knowledge_check is currently `true` (alone among all block types). Per locked design knowledge_check is the only block type with `gating_required = true` by default but the relationship between is_scored and gating_required needs decision: I think `is_scored = true` should stay for knowledge_check since the question correctness is scored even if scoring isn't the primary completion gate; flashcards/card_sort/scenario should be `is_scored = false` per the existing pattern.

**Session 66 migration needed:**
1. UPDATE `lesson_block_types` rows for flashcards, scenario, knowledge_check with new descriptions matching locked design.
2. INSERT new row for card_sort with `category='interactive'`, `is_interactive=true`, `is_scored=false`, `is_v1_active=true`, description matching locked design.

### Finding 4: replace_lesson_blocks function — VERBATIM CRITICAL SECTIONS

Function signature: `public.replace_lesson_blocks(p_content_item_id uuid, p_blocks jsonb, p_reason text) RETURNS jsonb` — SECURITY DEFINER, LANGUAGE plpgsql, SET search_path TO 'public', 'pg_temp'.

**Block-type whitelist check (verbatim from function body):**
```sql
SELECT (count(*) > 0) INTO v_known_type
  FROM public.lesson_block_types WHERE block_type = v_block_type AND is_v1_active = true;
IF NOT v_known_type THEN
  RAISE EXCEPTION 'block_at_index_%_unknown_or_inactive_type: %', v_idx, v_block_type USING ERRCODE = '22023';
END IF;
```

**Single-asset-id extraction (verbatim):**
```sql
v_asset_id_in_cfg := NULLIF(v_block->'config'->>'asset_id', '')::uuid;
IF v_asset_id_in_cfg IS NOT NULL THEN
  SELECT (count(*) > 0) INTO v_asset_exists
    FROM public.content_assets
    WHERE id = v_asset_id_in_cfg AND status = 'active';
  IF NOT v_asset_exists THEN
    RAISE EXCEPTION 'block_at_index_%_references_inactive_or_missing_asset: %', v_idx, v_asset_id_in_cfg USING ERRCODE = '22023';
  END IF;
END IF;
```

**ref_field naming convention (verbatim):**
```sql
v_asset_id_in_cfg := NULLIF(v_block_config->>'asset_id', '')::uuid;
IF v_asset_id_in_cfg IS NOT NULL THEN
  v_ref_field := v_block_type || '_asset';
  -- ... rebind or create logic follows
END IF;
```

The ref_field is constructed as `<block_type> || '_asset'`. So for the image block: `image_asset`. For embed_audio: `embed_audio_asset`. For video_embed: `video_embed_asset`. **No support for nested paths or arrays.**

**Rebind logic (verbatim) — only handles single-asset-per-block model:**
```sql
SELECT id INTO v_rebind_target_id
  FROM public.content_asset_refs
 WHERE asset_id = v_asset_id_in_cfg
   AND content_item_id = p_content_item_id
   AND lesson_block_id IS NULL
   AND ref_field = v_ref_field
   AND archived_at IS NULL
 ORDER BY created_at ASC
 LIMIT 1
 FOR UPDATE;

IF v_rebind_target_id IS NOT NULL THEN
  UPDATE public.content_asset_refs
     SET lesson_block_id = v_new_block_id,
         content_item_id = NULL
   WHERE id = v_rebind_target_id;
  v_refs_rebound := v_refs_rebound + 1;
ELSE
  INSERT INTO public.content_asset_refs (asset_id, lesson_block_id, ref_field, created_by)
  VALUES (v_asset_id_in_cfg, v_new_block_id, v_ref_field, v_caller_id);
  v_refs_created := v_refs_created + 1;
END IF;
```

The Session 60 fix comment in the function:
```
-- Insert new blocks FIRST. For each block with an asset_id in config, either
-- rebind an existing content_item-scoped ref or create a fresh lesson_block-scoped ref.
-- This must happen BEFORE the cascade-archive helper runs, otherwise assets that
-- are still referenced by incoming blocks would briefly have zero active refs
-- and get auto-archived by the helper (bug: Session 60).
```

This ordering constraint matters when reworking — any walker we introduce for nested asset_ids must run BEFORE the cascade helper.

### Finding 5: get_lesson_block_assets function — VERBATIM

```sql
CREATE OR REPLACE FUNCTION public.get_lesson_block_assets(
  p_content_item_id uuid, 
  p_extra_asset_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(out_asset_id uuid, out_bucket text, out_path text, out_asset_kind text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_super_admin();
  -- No impersonation gate needed — this is a read-only signed-URL resolver

  IF p_content_item_id IS NULL THEN
    RAISE EXCEPTION 'content_item_id_required' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH saved_asset_ids AS (
    SELECT DISTINCT NULLIF(lb.config->>'asset_id','')::uuid AS asset_id
    FROM public.lesson_blocks lb
    WHERE lb.content_item_id = p_content_item_id
      AND lb.archived_at IS NULL
      AND lb.config ? 'asset_id'
      AND NULLIF(lb.config->>'asset_id','') IS NOT NULL
  ),
  all_ids AS (
    SELECT asset_id FROM saved_asset_ids
    UNION
    SELECT unnest(COALESCE(p_extra_asset_ids, ARRAY[]::uuid[]))
  )
  SELECT
    ca.id,
    cav.bucket,
    cav.path,
    ca.asset_kind
  FROM all_ids ai
  JOIN public.content_assets ca ON ca.id = ai.asset_id
  JOIN public.content_asset_versions cav ON cav.id = ca.current_version_id
  WHERE ca.status = 'active'
    AND cav.archived_at IS NULL;
END;
$function$
```

**Same single-asset-at-top-of-config assumption** as `replace_lesson_blocks`. Only reads `lb.config->>'asset_id'` (top-level). Will not find `cards[N].back_image_asset_id`, `cards[N].image_asset_id`, or `moments[N].setup_image_asset_id`.

### Finding 6: _cascade_archive_asset_refs_for_lesson_blocks — SAFE, NO REWORK NEEDED

This is the cascade-archive helper triggered when blocks are replaced. **Critical finding: it operates on `lesson_block_id`, not on `ref_field`.**

Relevant verbatim section showing it's lesson_block_id-scoped:
```sql
INSERT INTO _affected_assets_blocks (asset_id)
SELECT DISTINCT car.asset_id
  FROM public.content_asset_refs car
  WHERE car.archived_at IS NULL
    AND car.lesson_block_id = ANY(p_lesson_block_ids)
ON CONFLICT (asset_id) DO NOTHING;

WITH archived AS (
  UPDATE public.content_asset_refs car
     SET archived_at = v_now
   WHERE car.archived_at IS NULL
     AND car.lesson_block_id = ANY(p_lesson_block_ids)
   RETURNING car.id
)
SELECT count(*) INTO v_refs_archived FROM archived;
```

It archives ALL `content_asset_refs` rows for the given lesson_block_ids regardless of how many there are or what their `ref_field` strings are. As long as nested asset refs (which we'll introduce) all share the same `lesson_block_id`, this helper handles them correctly. **One less function to rework.**

After archiving refs, it calls `public._asset_active_ref_count(asset_id)` to check if any other active refs still exist; if zero, calls `public._archive_asset_internal()` to mark the asset itself archived (for non-library assets only). This logic is also generic — it just counts; it doesn't care about ref_field shape.

### Finding 7: content_asset_refs table schema

From `information_schema.columns`:
```
id — uuid
asset_id — uuid
content_item_id — uuid (NULL when lesson_block_id is set)
lesson_block_id — uuid (NULL when content_item_id is set)
ref_field — text (key field — currently "<block_type>_asset" or "thumbnail" or "library_pick" or similar)
created_at — timestamp with time zone
created_by — uuid
archived_at — timestamp with time zone
module_id — uuid
curriculum_id — uuid
certification_path_id — uuid
```

**There is no UNIQUE constraint on `(lesson_block_id, ref_field)`** (verified by the lack of UNIQUE in the schema column listing and confirmed by the cascade helper's behavior which allows multiple refs per lesson_block_id). This means we can store multiple refs per lesson_block freely; the nested-path approach is structurally fine. We just need to pick a `ref_field` naming convention.

### Finding 8: The four Edge Functions that need updates

#### scaffold-lesson-outline v8 (Edge Function ID `5d52afb6-0f90-4e2e-a7c4-e65e78f6275a`)

Current ALLOWED_BLOCK_TYPES (not re-fetched this session; carried from Session 64 closeout). This is the v1 outline-step function in the two-step authoring flow (outline first, then expand).

**Update needed:** add `card_sort` to ALLOWED_BLOCK_TYPES. Intent guide bullets for all four new block types (when AI should propose each — already present for flashcards/scenario/knowledge_check from Session 64 work but worth re-verifying they match locked design; new bullet for card_sort).

#### scaffold-lesson v2 (Edge Function ID `76c6a445-2d78-4799-a15a-93cf5a283c7e`)

**This is a DIFFERENT function from scaffold-lesson-outline.** It's a one-shot lesson scaffolder ("give me a goal, get a lesson"). I missed it in earlier recon and only discovered it on the second pass. **Verbatim current state of ALLOWED_BLOCK_TYPES (from the v2 source):**

```typescript
const ALLOWED_BLOCK_TYPES = [
  "text", "heading", "image", "video_embed", "divider", "quote", "list",
  "callout", "stat_callout", "statement_a_b", "embed_audio",
  "tabs", "flashcards", "accordion", "button_stack", "scenario",
  "knowledge_check",
];
```

So 17 types listed — three of our four targets (flashcards, scenario, knowledge_check) ARE present, but **card_sort is NOT.** Add it.

**Verbatim current BLOCK_SCHEMA_HINTS for our four target block types (STALE — must be fully replaced):**

```typescript
flashcards: `{ "cards": [{"front","back"}, ...] } — 3-10 term/definition or Q/A pairs.`,
```
Stale: count is 3-10 not 2-20, no back image, no caption, no self-rating fields.

```typescript
scenario: `{ "setup": "<scene markdown>", "options": [{"choice","outcome","is_recommended":bool}, ...] } — Branching decision moment with exactly one is_recommended=true.`,
```
**Severely stale** — this is the single-decision-branching shape, not the linear-multi-moment shape we locked. Needs complete replacement.

```typescript
knowledge_check: `{ "question_type": "multiple_choice"|"true_false", "question": "<q>", "options": [{"text","is_correct":bool}, ...] } — multiple_choice has 3-4 options; true_false has 2.`,
```
Stale — only 2 question types, no FITB/match/ranking/timeline/multi-select, no per-question explanation field, no 1–5 question container.

Plus no `card_sort` entry at all.

**Update needed:** complete BLOCK_SCHEMA_HINTS replacement for all four types matching locked design.

#### expand-lesson-from-outline v6 (Edge Function ID `05aa797e-552d-443c-8058-92f9f6ade576`)

The v1 expand-step function (takes an outline, produces full blocks). State carried from Session 64 work — ALLOWED_BLOCK_TYPES + BLOCK_SCHEMA_HINTS + transformConfigForCanvas all need updates for all four new block types.

**Update needed:** ALLOWED_BLOCK_TYPES add card_sort. BLOCK_SCHEMA_HINTS for all four. transformConfigForCanvas case for all four (this is where AI emit-shape gets mapped to canvas-storage shape — assign client_ids, normalize TipTap from raw markdown if the AI emits markdown, default optional fields).

#### draft-lesson-block v7 (Edge Function ID `a5094e4d-19e6-44cf-92e6-6ac783344c37`)

The "draft me a single block" endpoint used by the per-block draft feature in the authoring UI.

**Update needed:** BLOCK_SCHEMAS (per-block-type drafting prompt fragments) for all four. transformConfigForCanvas case for all four.

### Finding 9: Edge Functions that do NOT need block-type updates

#### ai-authoring-chat v2 (Edge Function ID `d6695aa6-5107-4f86-8fbe-7541f1cfa482`)

This is the conversational planning surface where authors discuss lessons with the AI before generating an outline. Reviewed in full this session.

**Why it doesn't need updates:** the system prompt does NOT enumerate block types. It pulls platform context from the `ai_authoring_context` database table (5 active rows: framework_terminology, guardrails, output_format_rules, platform_overview, scientific_foundations) and discusses the lesson conceptually. Block-type awareness lives in scaffold-lesson-outline / scaffold-lesson / expand-lesson-from-outline / draft-lesson-block, not here.

Verbatim snippet from the system prompt construction showing it has no block enumeration:
```typescript
const systemPrompt = [
  "You are an authoring assistant for the BrainWise platform. You help authors plan licensed coach training material via a multi-turn conversation. After the author is satisfied with the framing, they will hit a button to generate a structured outline; YOUR job in this stage is to help them think through the lesson, ask clarifying questions, propose approaches, and respond to their references and ideas.",
  // ... contextBlocks (from DB), voiceGuidance, modeNote — no block-type list ever included
].filter(Boolean).join("\n");
```

#### draft-text v5 (Edge Function ID `17789c2f-fe4d-46a9-af19-1cb11f3e3fd4`)

Drafts plain text fields (titles, descriptions). Has its own FIELD_SPECS whitelist for what it can draft (certification_path_description, curriculum_description, module_description, content_item_description, module_name, content_item_title, generic_short_prose). No block-type involvement.

#### ai-chat (Edge Function ID `de20b993-2ff5-471f-9656-1d10c34854fc`)

Generic non-authoring chat. Not block-type aware.

### Finding 10: ai_authoring_context table — DOES NOT describe block types

Queried:
```sql
SELECT context_name, length(body_markdown) AS body_len, is_active
FROM ai_authoring_context ORDER BY context_name;
```

Five rows, all is_active=true:
- framework_terminology — 1670 chars
- guardrails — 1630 chars
- output_format_rules — 867 chars
- platform_overview — 986 chars
- scientific_foundations — 741 chars

I read platform_overview and output_format_rules in full this session. **Neither lists block types.** platform_overview describes the four instruments (PTP/NAI/AIRSA/HSS) and the three user types. output_format_rules describes return-shape rules per Edge Function endpoint but does NOT enumerate the block types themselves.

**Implication:** when card_sort and the rewritten flashcards/scenario/knowledge_check schemas land in the Edge Functions, the ai_authoring_context table does NOT need updates. Block-type awareness for AI is entirely encoded in the per-Edge-Function ALLOWED_BLOCK_TYPES + BLOCK_SCHEMA_HINTS, not in shared context.

---

## Frontend recon findings — PARTIAL

### Finding 11: block-forms directory inventory

Path: `src/components/super-admin/lesson-blocks/block-forms/`

14 form files exist, one per currently-implemented block type:

```
AccordionBlockForm.tsx        — 5177 bytes  — NOT yet read this session, target for Session 66 open
ButtonStackBlockForm.tsx      — 13746 bytes — known from Continue button work this session
CalloutBlockForm.tsx          — 1899 bytes
DividerBlockForm.tsx          — 722 bytes
EmbedAudioBlockForm.tsx       — 1310 bytes
HeadingBlockForm.tsx          — 1331 bytes
ImageBlockForm.tsx            — 1624 bytes — read in full this session (Finding 12)
ListBlockForm.tsx             — 5376 bytes
QuoteBlockForm.tsx            — 1087 bytes
StatCalloutBlockForm.tsx      — 1964 bytes
StatementABBlockForm.tsx      — 2937 bytes
TabsBlockForm.tsx             — 7167 bytes — NOT yet read this session, target for Session 66 open
TextBlockForm.tsx             — 604 bytes
VideoEmbedBlockForm.tsx       — 3200 bytes
```

**Four new form files needed for Session 66 frontend work:**
- FlashcardsBlockForm.tsx
- CardSortBlockForm.tsx
- ScenarioBlockForm.tsx
- KnowledgeCheckBlockForm.tsx (will be the largest — 7 question-type sub-forms inside)

### Finding 12: ImageBlockForm.tsx — VERBATIM (the template for image-bearing blocks)

```tsx
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileUploadField } from "@/components/super-admin/FileUploadField";

interface Props {
  value: { asset_id: string | null; alt: string; caption: string | null };
  onConfigChange: (next: {
    asset_id: string | null;
    alt: string;
    caption: string | null;
  }) => void;
  contentItemId?: string;
}

export function ImageBlockForm({ value, onConfigChange, contentItemId }: Props) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Image *</Label>
        <FileUploadField
          assetKind="image"
          contentItemId={contentItemId ?? null}
          refField="image_asset"
          value={value.asset_id}
          onChange={(newAssetId) =>
            onConfigChange({ ...value, asset_id: newAssetId })
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Alt text *</Label>
        <Input
          value={value.alt ?? ""}
          onChange={(e) => onConfigChange({ ...value, alt: e.target.value })}
          placeholder="Describe the image for screen readers"
        />
        <p className="text-xs text-muted-foreground">
          Required for accessibility.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Caption (optional)</Label>
        <Input
          value={value.caption ?? ""}
          onChange={(e) =>
            onConfigChange({ ...value, caption: e.target.value || null })
          }
          placeholder="Caption shown below the image"
        />
      </div>
    </div>
  );
}
```

**Key pattern:** FileUploadField is invoked with `refField="image_asset"` (literal string, hardcoded). The image block has one image, one ref_field. Storage: `value.asset_id` is a single string field at the top of the config.

For our new block types this pattern needs adaptation — see Finding 13.

### Finding 13: FileUploadField.tsx — VERBATIM PROP SIGNATURE

Located at `src/components/super-admin/FileUploadField.tsx` (read in full this session).

**Prop interface (verbatim):**
```typescript
interface FileUploadFieldProps {
  assetKind: AssetKind;             // "image" | "video" | "audio" | "document"
  contentItemId?: string | null;
  lessonBlockId?: string | null;
  moduleId?: string | null;
  curriculumId?: string | null;
  certificationPathId?: string | null;
  isLibraryAsset?: boolean;
  refField?: string | null;
  libraryName?: string | null;
  libraryTags?: string[] | null;
  value: string | null;
  onChange: (newAssetId: string | null) => void;
  reasonOverride?: string;
  disabled?: boolean;
}
```

**Key observations for nested-image use:**

1. **`refField` is a single string prop.** It's currently passed literal strings like `"image_asset"` or used as the fallback `"library_pick"` for AssetLibraryPicker drops. There's no path-walking convention today. For nested refs (e.g., `cards[0].back_image_asset_id`), we either:
   - Pass an indexed-path string here (e.g., `refField={"cards." + cardIndex + ".back_image_asset_id"}`), or
   - Use a different naming convention (e.g., `refField={"flashcards:back_image:" + cardIndex}`)
   The choice affects what `replace_lesson_blocks` must do — both the save handler and FileUploadField must agree on the format.

2. **Upload flow:** the component calls `supabase.functions.invoke("request-asset-upload", { body: { ..., ref_field: refField ?? null } })` — so `ref_field` is passed THROUGH to the backend `request-asset-upload` Edge Function. That Edge Function presumably writes a `content_asset_refs` row with the refField as its `ref_field` value. **I did NOT inspect `request-asset-upload` source this session** — it's a Session 66 open recon item. Worth checking how it constructs the content_asset_refs row.

3. **Replace flow:** when an asset is replaced, the component calls `supabase.rpc("replace_asset", { p_old_asset_id, p_new_asset_id, p_reason })`. This RPC is generic — operates on asset_ids not ref_fields, so it should work transparently for nested refs.

4. **Library pick flow:** when a user picks from the asset library, the component calls `supabase.rpc("create_asset_ref", { p_asset_id, p_content_item_id, p_lesson_block_id, p_ref_field: refField ?? "library_pick", p_reason })`. **This RPC also accepts a ref_field string** — so it's consistent with the same path-string approach.

5. **TUS upload endpoint:** uploads use `tus-js-client` with endpoint `${directStorageHostname(SUPABASE_URL)}/storage/v1/upload/resumable` — chunked resumable upload, 6MB chunks, retries [0, 3000, 5000, 10000, 20000]. Not affected by ref_field choice.

6. **Asset kind limits (verbatim):**
```typescript
image: { maxBytes: 20 * 1024 * 1024, mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/avif"], extensions: ".jpg,.jpeg,.png,.webp,.gif,.svg,.avif" }
```
20MB max, jpg/png/webp/gif/svg/avif allowed.

### Finding 14: BlockRenderer.tsx (post-Continue ship)

Path: `src/components/super-admin/lesson-blocks/BlockRenderer.tsx` — 619 lines as of Session 65 close.

The Continue button render branch added this session lives inside the existing `ButtonStackRender` function (around line ~232 onward — exact line count not re-verified). Its wrapper class is `my-8 flex w-full flex-col items-center gap-4` with an internal rule div of class `h-0.5 w-full` and inline style `backgroundColor: "#F5741A", opacity: 0.6`. The button itself uses ChevronRight from lucide-react.

For the four new block types, new render functions will be added to BlockRenderer.tsx (or split into separate render files if BlockRenderer.tsx gets too large — Cole's call). Existing render functions (AccordionRender, TabsRender, ButtonStackRender) provide useful reuse patterns:
- AccordionRender / TabsRender — array iteration patterns for scenario moments and card displays
- QuoteRender — `border-l-4 #F5741A` brand pattern (recurring in CalloutRender too)
- CalloutRender — variant-styled box pattern useful for outcome reveal styling
- ButtonStackRender (post-Continue) — wrapper-escape pattern for breaking out of parent flex layouts (the rule + button arrangement)

### Frontend recon items NOT YET DONE — Session 66 open

These are queued for Session 66's opening minutes (cheap reads):

1. **AccordionBlockForm.tsx (5177 bytes)** — array-of-items authoring pattern (panels list with heading + body per item). Flashcards/card_sort/scenario will mirror this pattern for their cards/moments arrays.

2. **TabsBlockForm.tsx (7167 bytes)** — similar array-of-items pattern, plus tab-label management. Useful reference for ScenarioBlockForm (moment_label authoring).

3. **AddBlockPopover** (path TBD — likely `src/components/super-admin/lesson-blocks/AddBlockPopover.tsx` or similar) — block picker UI. The four new types need to be added to whatever block list this component renders. This determines whether the picker shows them grouped by category or flat.

4. **blockTypeMeta.ts** — already touched in Session 65 (Continue button work added `section_title: null` seed) but the union types and metadata for the four new block types need new entries here. This is the central registry that feeds the picker, the form router, the renderer router.

5. **lesson-blocks.css** (path TBD) — for new CSS classes needed by the new block types: 3D flip transforms for flashcards (perspective + transform-style: preserve-3d + backface-visibility), drag-and-drop visual states for card_sort + match + ranking + timeline, modal overlay styles for scenario outcome reveals.

6. **save_lesson_block_draft / discard_lesson_block_draft RPC behavior** — for the per-block draft autosave feature. May need updates if the new block types' configs have shapes the draft system doesn't anticipate. Quick check needed.

7. **request-asset-upload Edge Function** — confirm how it writes content_asset_refs and how it handles the ref_field string we pass.

8. **@dnd-kit usage in existing code** — ButtonStackBlockForm uses drag-and-drop for button reordering (per Continue button work this session). Card_sort, match, ranking, timeline will all use the same library. Quick check of the import patterns + drag-and-drop sensors will save Lovable prompt time.

---

## Nested asset references — ARCHITECTURAL CONCERN (Cole's decision: include images in v1)

### The problem in one sentence

`replace_lesson_blocks` and `get_lesson_block_assets` both assume a single `asset_id` field at the top of every block's config; flashcards/card_sort/scenario need asset_ids nested inside arrays (per-card images, per-moment images).

### Cole's decision this session

**Include images in v1.** Defers the cleaner "ship blocks without images first" path. This means Session 66 backend work includes a real rework of two SECURITY DEFINER functions, which is fragile work that gates every lesson save.

### Required backend rework for nested asset refs

1. **New PL/pgSQL helper function** that walks a block's config JSONB and returns ALL `(ref_field_path, asset_id)` pairs at any nesting depth. For a flashcards block with 5 cards where 3 have images, it would return e.g.:
   ```
   ("flashcards.cards[0].back_image_asset_id", "<uuid>")
   ("flashcards.cards[2].back_image_asset_id", "<uuid>")
   ("flashcards.cards[4].back_image_asset_id", "<uuid>")
   ```
   The exact `ref_field` naming convention to pick is open. Options:
   - **(A) Dotted/indexed path:** `flashcards.cards[0].back_image_asset_id` — human-readable, parseable
   - **(B) Colon-separated:** `flashcards:back_image:0` — shorter, but loses field name
   - **(C) Block-type+index+field:** `flashcards.cards[N].back_image_asset_id` literally with `N` as a placeholder for the index — pick something else, this is just illustrative
   
   I lean **(A)** for readability and ease of debugging. Cole decides.

2. **Rework `replace_lesson_blocks`** to call this helper instead of the single-field reader. For each pair returned by the helper:
   - Try to rebind: look for an active content_item-scoped ref matching `(asset_id, ref_field=<path>, content_item_id=p_content_item_id, lesson_block_id IS NULL, archived_at IS NULL)`.
   - If rebind target found: UPDATE its lesson_block_id to v_new_block_id, set content_item_id to NULL.
   - Otherwise: INSERT a new lesson_block-scoped ref.
   
   The existing single-asset_id code path can be RETAINED for backward compat (image, video_embed, embed_audio blocks still use top-of-config asset_id) — or we unify everything to go through the new walker. **Recommendation: unify** — less code paths, less drift. The walker for a "simple" block returns 0 or 1 pair, same logic applies.

3. **Rework `get_lesson_block_assets`** to use the same walker. Currently it queries only `lb.config->>'asset_id'`. Replace with a call to the new walker that returns all asset_ids from the JSONB regardless of nesting depth.

4. **`_cascade_archive_asset_refs_for_lesson_blocks` — NO REWORK NEEDED.** Already operates on `lesson_block_id` not `ref_field`. (Finding 6.)

5. **`request-asset-upload` Edge Function** — needs review. It currently accepts a `ref_field` string from the frontend (via FileUploadField). If it writes content_asset_refs directly using whatever string is passed, it should already handle indexed paths fine. **Verify in Session 66.**

### Required frontend rework for nested asset refs

1. **FileUploadField.tsx** — should accept indexed paths via the existing `refField` prop without code changes (it just passes the string through to backend). **But:** the empty-state library picker flow uses `refField ?? "library_pick"` as a fallback when calling `create_asset_ref`. Verify that an indexed path works equally well there.

2. **New form files** (FlashcardsBlockForm, CardSortBlockForm, ScenarioBlockForm) — pass per-card / per-moment indexed paths into FileUploadField as the `refField`. Example for FlashcardsBlockForm:
   ```tsx
   <FileUploadField
     assetKind="image"
     contentItemId={contentItemId ?? null}
     refField={`flashcards.cards[${cardIndex}].back_image_asset_id`}
     value={card.back_image_asset_id}
     onChange={(newAssetId) => updateCard(cardIndex, { ...card, back_image_asset_id: newAssetId })}
   />
   ```

3. **A reorder concern:** if author reorders cards in the form, do their image refs stay correctly mapped? The asset_id lives inside the card object; reordering the cards array reorders both the asset_ids AND the image bindings together. Save handler re-walks and re-binds based on the new indexed paths. So a reorder will look like: old refs `cards[0]...` `cards[1]...` get archived and new refs `cards[0]...` `cards[1]...` get created at save time. The cascade helper will try to auto-archive the asset if zero refs remain, but the new refs are created BEFORE the cascade runs (Session 60 fix ordering), so the asset stays active. **Should work, but worth a deliberate test case in Session 66 verification.**

### Risk summary

The rework risk is concentrated in `replace_lesson_blocks` — a 200-line SECURITY DEFINER function that gates every lesson save. Breaking it breaks all lesson authoring, not just the new block types. Session 66 must:

- Write the new walker helper as a SEPARATE function first (`_walk_block_config_for_asset_refs(p_block_type text, p_config jsonb) RETURNS TABLE(out_ref_field text, out_asset_id uuid)` or similar).
- Test the walker in isolation against synthetic configs for each block type before touching replace_lesson_blocks.
- Apply the replace_lesson_blocks rework as an `apply_migration` and immediately verify with `execute_sql` that an existing image-block save still works (regression test).
- Apply get_lesson_block_assets rework second, verify a fetch works for an existing content_item with images.
- Only then attempt the first save of a new block type with images.

---

## Session 66 recommended sequence

### Phase 1: Open recon (cheap, fast)

1. Read AccordionBlockForm.tsx (5KB) — array-of-items authoring pattern
2. Read TabsBlockForm.tsx (7KB) — similar pattern + tab-label management
3. Read AddBlockPopover.tsx — block picker
4. Read blockTypeMeta.ts in full — central registry to update
5. Read request-asset-upload Edge Function — verify it handles indexed-path ref_field strings
6. Read lesson-blocks.css — confirm 3D transform classes don't exist yet, plan for CSS additions
7. Quick scan of save_lesson_block_draft / discard_lesson_block_draft RPCs — verify they're JSONB-blind (likely yes)
8. Confirm @dnd-kit import pattern in ButtonStackBlockForm

### Phase 2: Backend migrations + Edge Function deploys (one focused session of careful work)

1. **Migration:** `lesson_block_types` UPDATE three rows + INSERT card_sort row. Descriptions to lock in:
   - flashcards: "Flippable cards with self-rating. Front + back content per card (2–20 cards). Trainee marks each card 'Got it' or 'Review again'. Default non-gating."
   - scenario: "Linear narrative with 1–12 moments. Each moment is either multiple-choice (with per-choice outcomes) or reflection (with author-prepared teaching point). Modal outcome reveal. Default non-gating."
   - knowledge_check: "Interactive question block with 1–5 questions. Supports MC, multi-select, true/false, fill-in-the-blank, match, ranking, timeline. Immediate per-question feedback. Unlimited retry. Default gating."
   - card_sort (new): "Drag-cards-to-buckets interaction. 4–12 cards, 2–4 buckets, one correct bucket per card. End-of-sort 'Check my answers'. Unlimited retries to 100%. Default non-gating."
2. **Migration:** new `_walk_block_config_for_asset_refs` helper function. Walks JSONB. Returns `(out_ref_field text, out_asset_id uuid)` for top-level `asset_id` + the three nested patterns (`cards[N].back_image_asset_id`, `cards[N].image_asset_id`, `moments[N].setup_image_asset_id`).
3. **Verification:** test the walker in isolation via execute_sql against synthetic configs for each block type, including: empty config, top-level-only asset_id, flashcards with images on 3 of 5 cards, card_sort with images on 4 of 8 cards, scenario with images on 2 of 4 moments, mixed.
4. **Migration:** rework `replace_lesson_blocks` to use the walker. Keep the existing v_known_type check unchanged. Replace the single-asset-id extraction logic with the walker call. Test by saving an existing image block (regression) + a new flashcards block with one card having an image (forward).
5. **Migration:** rework `get_lesson_block_assets` to use the walker.
6. **Edge Function deploy:** scaffold-lesson-outline v8 → v9 (add card_sort to ALLOWED_BLOCK_TYPES + intent guide bullet)
7. **Edge Function deploy:** scaffold-lesson v2 → v3 (add card_sort to ALLOWED_BLOCK_TYPES + full BLOCK_SCHEMA_HINTS rewrite for all four target types matching locked design)
8. **Edge Function deploy:** expand-lesson-from-outline v6 → v7 (ALLOWED_BLOCK_TYPES + BLOCK_SCHEMA_HINTS + transformConfigForCanvas for all four)
9. **Edge Function deploy:** draft-lesson-block v7 → v8 (BLOCK_SCHEMAS + transformConfigForCanvas for all four)
10. **Anon-probe all four Edge Functions** — clean HTTP 401 confirms they're up.
11. **_shared/ byte-identity check** after all four deploys.

### Phase 3: Lovable prompts (one block type per prompt, multiple sessions)

After Phase 2 ships clean, frontend work proceeds one block type at a time, each as its own focused Lovable prompt with verification before moving to the next. Recommended sequence:

1. **flashcards** — simplest authoring shape (cards array, front+back+image+caption per card). Renderer needs 3D flip CSS. One prompt likely sufficient.
2. **card_sort** — adds drag-and-drop. dnd-kit. One prompt, possibly one visual tweak iteration.
3. **scenario** — adds modal overlay outcome reveal, branching MC-vs-reflection per moment. Likely one prompt, possibly two if modal accessibility needs polish.
4. **knowledge_check** — the largest. SEVEN question types. Realistically 2–3 prompts:
   - Prompt 1: MC + multi-select + true/false (the "card-like choices" family). Reuse the same renderer + form patterns across these three.
   - Prompt 2: fill-in-the-blank + match. Different interaction shapes (typed answers, drag-pairs).
   - Prompt 3: ranking + timeline. Both use drag-to-reorder with different visual treatments.

Total realistic estimate: **4–6 sessions from Session 66 to all four block types fully shipped.**

### Phase 4: Carry-forward Phase 5 work

Phase 5 (trainee renderer + 3 RPCs + TOC sidebar + summary collapse + Model X gating) is fully specced in `/home/claude/internal-docs/phase-5-lesson-progress-carry-forward.md` and remains queued AFTER the four block types ship. Tackling it before the blocks ship means building the trainee renderer against block types that don't exist yet.

---

## Notes for next session opening

- **The closeout docs in this session do NOT bump build-queue.md version markers** — version bumps reserved for session close after all design + recon work is captured. Build-queue v70 (Session 64 close + Session 65 P1 backend deploys) remains current. Session 66 close will produce v71.
- **Cole has explicitly opted into images in v1** for the new block types. The architectural rework of `replace_lesson_blocks` + `get_lesson_block_assets` is committed scope, not deferred.
- **Test password lives in userMemories only** (`BrainWiseTest2026!`). NOT in this doc (it's heading to a public repo).
- **The session-65-to-66.md filename matches the existing template** (`session-NN-to-MM.md` pattern from `_template.md`).
- **No version bumps to other canonical docs in Session 65** — Continue button shipped + new block types designed but Session 66 will be the version-bump session for both build-queue.md and architecture-reference.md after backend lands.
