# Frontend Recon for Interactive Block Frontends (card_sort, scenario, knowledge_check)

**Created: 2026-05-13 (Session 68 close)**
**Purpose: Load at Session 69 open so the next session can go straight to design-lock + Lovable prompt writing without re-fetching files.**

---

## How to use this doc

Sessions 69, 70, and 71+ will each ship one block type's frontend via Lovable. This doc captures the recon state of the frontend files AS OF Session 68 close (post-flashcards-ship). When opening any of those sessions:

1. Read this doc in full first.
2. Verify the canonical files on `main` haven't drifted: `curl -sL "https://raw.githubusercontent.com/cbastianBWE/brainwise-blueprint/main/<path>" | head -20` on `blockTypeMeta.ts` to confirm the BlockType union still matches (only flashcards as the newest entry, no surprise additions from another session).
3. If anything has drifted, refresh that specific file. The structural recon (patterns, dispatch points, CSS layout) stays valid even if individual files have grown.

---

## Block-by-block status

| Block type | Backend status | Frontend status | Estimated Lovable prompts |
|---|---|---|---|
| **card_sort** | Shipped Session 66 (v9 → v11 expand, v9 → v12 draft) | NOT BUILT | 1 prompt |
| **scenario** | Shipped Session 66 | NOT BUILT | 1 prompt (modal overlay adds complexity but stays in one prompt) |
| **knowledge_check** | Shipped Session 66 | NOT BUILT | 2-3 prompts (split by question-type family per Session 65 design) |

All three have their `BLOCK_SCHEMAS` + `BLOCK_SCHEMA_HINTS` + `transformConfigForCanvas` branches already in `draft-lesson-block` v12 and `expand-lesson-from-outline` v11. AI can already generate them; the canvas just can't render them yet because there's no BlockRenderer case, no block-form, and no CSS.

---

## Files inspected, fresh from main (Session 68)

| File | LOC | Action needed per block type |
|---|---|---|
| `src/components/super-admin/lesson-blocks/blockTypeMeta.ts` | 267 | Add to `BlockType` union, `BLOCK_TYPE_META` record, `IN_SCOPE_BLOCK_TYPES` array. ~30 lines added per block type. |
| `src/components/super-admin/lesson-blocks/BlockRenderer.tsx` | 962 | Add `case "..."` dispatch (line ~390) + new sub-component render function. card_sort ~200 LOC, scenario ~250 LOC, knowledge_check ~400 LOC across 7 question types. |
| `src/components/super-admin/lesson-blocks/BlockEditorPane.tsx` | 278 | Add 3 dispatch entries (line ~270, after the flashcards block) — ~5 LOC per. |
| `src/components/super-admin/lesson-blocks/AddBlockPopover.tsx` | 37 | No changes — iterates IN_SCOPE_BLOCK_TYPES automatically. |
| `src/components/super-admin/lesson-blocks/lesson-blocks.css` | 345 | Append `=== Session NN: <block_type> ===` section per block type. ~80-200 LOC. |
| `src/components/super-admin/lesson-blocks/block-forms/<Type>BlockForm.tsx` | NEW | Create one file per block type. card_sort ~250 LOC, scenario ~350 LOC, knowledge_check ~600 LOC across question types. |

---

## Canonical template patterns (locked Session 67, reusable)

These are the patterns from the just-shipped flashcards work that the three new block types should follow verbatim. Don't reinvent them per block type.

### Form structure (use FlashcardsBlockForm as the template)

```tsx
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "../RichTextEditor";
import { FileUploadField } from "@/components/super-admin/FileUploadField";
import { BrandColorSwatch } from "../BrandColorSwatch";
import type { TipTapDocJSON } from "../blockTypeMeta";

type Item = {
  client_id: string;
  // ...block-type-specific fields
};

interface Props {
  value: {
    items: Item[];
    gating_required: boolean;
    // ...other top-level config fields
  };
  onConfigChange: (next: typeof value) => void;
  contentItemId: string;  // only needed if FileUploadField is used
}

const MIN_ITEMS = 2;
const MAX_ITEMS = 12;

function SortableItemRow({ item, index, onChange, onDelete, canDelete }: {...}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.client_id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="rounded-md border bg-background p-2">
      <div className="flex items-start gap-2">
        <button type="button" className="mt-2 cursor-grab text-muted-foreground hover:text-foreground"
          {...attributes} {...listeners} aria-label="Drag item">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 space-y-3">
          {/* item editor */}
        </div>
        <Button type="button" size="sm" variant="ghost"
          className="mt-1 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete} aria-label="Remove item" disabled={!canDelete}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function XxxBlockForm({ value, onConfigChange, contentItemId }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  // ...handlers (handleDragEnd, handleItemChange, handleDelete, handleAdd, handleGatingChange)
  return (
    <div className="space-y-3">
      <Label>Items</Label>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.client_id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">{/* SortableItemRow per item */}</div>
        </SortableContext>
      </DndContext>
      <Button type="button" size="sm" variant="outline" onClick={handleAdd} disabled={items.length >= MAX_ITEMS}>
        <Plus className="mr-1 h-3.5 w-3.5" />Add item
      </Button>
      {items.length >= MAX_ITEMS && <p className="text-xs text-muted-foreground">Max {MAX_ITEMS} ...</p>}
      {items.length <= MIN_ITEMS && <p className="text-xs text-muted-foreground">Min {MIN_ITEMS} ...</p>}
      {/* Gating checkbox in rounded-md border bg-muted/20 p-3 block */}
    </div>
  );
}
```

**Critical detail: FileUploadField `refField` for nested-array items uses `client_id` NOT array index.**

Example from flashcards: `refField={`flashcards.cards.${card.client_id}.front_image_asset_id`}`.

Apply same pattern:
- card_sort image refs: `card_sort.cards.${card.client_id}.image_asset_id`
- scenario image refs: `scenario.moments.${moment.client_id}.setup_image_asset_id`

This survives reorder; array-index-based refField does not.

### Renderer structure (use FlashcardsRender as the template)

Located in BlockRenderer.tsx, lines 657-962 in the current state. Pattern:

```tsx
// === Session NN: <block_type> renderer ===

type XxxConfig = {
  client_id: string;
  // ...fields, with TipTapDocJSON | null for rich-text fields
};

// Module-level helpers if any (e.g. FLASHCARD_TEXT_COLOR_FOR_BG lookup)
const XXX_HELPER: Record<string, string> = { /* ... */ };

function getXxxHelper(input: string | null | undefined): string {
  // pure derivation, no side effects
}

function XxxRender({
  items,
  urlMap,
  mode,
  blockClientId,
}: {
  items: XxxConfig[];
  gatingRequired: boolean;  // most types have this, knowledge_check defaults true
  urlMap: Map<string, string>;
  mode?: "editor" | "trainee";
  blockClientId: string;  // for sessionStorage namespacing
}) {
  const sessionKey = `<blocktype>-pos:${blockClientId}`;
  const [state1, setState1] = useState(...);

  // Hydrate from sessionStorage in trainee mode
  useEffect(() => {
    if (mode !== "trainee" || typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(sessionKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // restore state
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, mode]);

  // Persist to sessionStorage in trainee mode
  useEffect(() => {
    if (mode !== "trainee" || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(sessionKey, JSON.stringify({ /* state */ }));
    } catch { /* ignore quota */ }
  }, [/* state deps */, sessionKey, mode]);

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground">
        No items yet.
      </div>
    );
  }

  // handlers — buttons inside clickable cards use e.stopPropagation()

  return (
    <div className="bw-<blocktype>-shell" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* progress, content, controls, done state */}
    </div>
  );
}
```

Dispatch entry in BlockRenderer.tsx switch (around line 386):

```tsx
case "<block_type>":
  return (
    <XxxRender
      items={(cfg.items ?? []) as XxxConfig[]}
      gatingRequired={cfg.gating_required === true}
      urlMap={assetUrlMap}
      mode={mode}
      blockClientId={block.client_id}
    />
  );
```

### CSS namespace convention

Append to `lesson-blocks.css` with a session marker:

```css
/* === Session NN: <block_type> === */

.bw-<blocktype>-shell { ... }
.bw-<blocktype>-progress { ... }
.bw-<blocktype>-controls { ... }
.bw-<blocktype>-done { ... }
```

Existing sections to reference for style consistency:
- Stat callout: lines 117-145
- Statement A/B: lines 147-175
- Accordion: lines 177-188
- Button stack: lines 190-213
- **Flashcards: lines 215-345** (most recent, closest to what we'll write)

---

## blockTypeMeta.ts changes per block type

### Imports (top of file)

Each new block type needs a lucide-react icon import. Suggested:
- `card_sort` → `LayoutGrid` (4-bucket sort visual) or `MoveRight` (drag-to motion)
- `scenario` → `GitBranch` (branching narrative) or `MessagesSquare` (decision sequence)
- `knowledge_check` → `HelpCircle` or `ClipboardCheck`

### BlockType union (line 20-35)

Append three new entries:
```ts
| "card_sort"
| "scenario"
| "knowledge_check"
```

### BLOCK_TYPE_META entries (line 50-228)

Each needs `{ label, description, icon, defaultConfig }`. defaultConfig returns the empty-but-valid initial config matching the schema in draft-lesson-block.

card_sort defaultConfig (matches BLOCK_SCHEMAS from Session 66):
```ts
card_sort: {
  label: "Card sort",
  description: "Drag cards into buckets",
  icon: LayoutGrid,
  defaultConfig: () => ({
    buckets: [
      { client_id: crypto.randomUUID(), title: "", description: null },
      { client_id: crypto.randomUUID(), title: "", description: null },
    ],
    cards: [
      { client_id: crypto.randomUUID(), content: emptyDoc(), correct_bucket_id: null, image_asset_id: null, caption: null },
      { client_id: crypto.randomUUID(), content: emptyDoc(), correct_bucket_id: null, image_asset_id: null, caption: null },
      { client_id: crypto.randomUUID(), content: emptyDoc(), correct_bucket_id: null, image_asset_id: null, caption: null },
      { client_id: crypto.randomUUID(), content: emptyDoc(), correct_bucket_id: null, image_asset_id: null, caption: null },
    ],
    gating_required: false,
    background_color: null,
    padding: "none",
  }),
},
```

scenario defaultConfig:
```ts
scenario: {
  label: "Scenario",
  description: "Linear narrative with choices",
  icon: GitBranch,
  defaultConfig: () => ({
    title: null,
    intro_markdown: null,
    moments: [
      {
        client_id: crypto.randomUUID(),
        moment_label: null,
        setup_markdown: emptyDoc(),
        setup_image_asset_id: null,
        prompt_type: "multiple_choice",
        choices: [
          { client_id: crypto.randomUUID(), choice_text: "", outcome_markdown: emptyDoc() },
          { client_id: crypto.randomUUID(), choice_text: "", outcome_markdown: emptyDoc() },
        ],
        reflection_prompt: null,
        outcome_markdown: null,
      },
    ],
    gating_required: false,
    background_color: null,
    padding: "none",
  }),
},
```

knowledge_check defaultConfig:
```ts
knowledge_check: {
  label: "Knowledge check",
  description: "1-5 questions across 7 types",
  icon: HelpCircle,
  defaultConfig: () => ({
    questions: [
      {
        client_id: crypto.randomUUID(),
        question_type: "multiple_choice",
        prompt_markdown: emptyDoc(),
        explanation_markdown: emptyDoc(),
        choices: [
          { client_id: crypto.randomUUID(), choice_text: "", is_correct: false },
          { client_id: crypto.randomUUID(), choice_text: "", is_correct: false },
        ],
      },
    ],
    gating_required: true,  // ONLY block type with default true
    background_color: null,
    padding: "none",
  }),
},
```

### IN_SCOPE_BLOCK_TYPES array (line 231-247)

Append:
```ts
"card_sort",
"scenario",
"knowledge_check",
```

---

## BlockEditorPane.tsx changes per block type

Imports at top (around line 24-29):
```ts
import { CardSortBlockForm } from "./block-forms/CardSortBlockForm";
import { ScenarioBlockForm } from "./block-forms/ScenarioBlockForm";
import { KnowledgeCheckBlockForm } from "./block-forms/KnowledgeCheckBlockForm";
```

Dispatch (around line 267, after the flashcards entry):
```tsx
{block.block_type === "card_sort" && (
  <CardSortBlockForm
    value={cfg as any}
    onConfigChange={handleConfig}
    contentItemId={contentItemId}
  />
)}
{block.block_type === "scenario" && (
  <ScenarioBlockForm
    value={cfg as any}
    onConfigChange={handleConfig}
    contentItemId={contentItemId}
  />
)}
{block.block_type === "knowledge_check" && (
  <KnowledgeCheckBlockForm
    value={cfg as any}
    onConfigChange={handleConfig}
  />
)}
```

knowledge_check does NOT need contentItemId because no per-question image asset uploads in v1 (locked Session 65 design).

---

## Design questions to resolve in Session 69+

These are the design-lock decisions that need to land BEFORE the Lovable prompt is written. Some are answered already (Session 65 locked design); some genuinely need a decision.

### card_sort — design questions

**Answered (Session 65 locked):**
- 2-4 buckets, 4-12 cards
- Bucket title plain text 1-4 words, optional description ≤120 chars
- Card content TipTap, optional image, optional caption ≤80 chars
- One correct bucket per card
- End-of-sort "Check my answers" feedback
- Unlimited retries until 100%
- Default gating_required = false

**Need decision:**
1. **Drag mechanic in author form vs trainee renderer**:
   - Author form: vertical SortableContext for reordering buckets and reordering cards (dnd-kit verticalListSortingStrategy, matches existing pattern). No drag-between-containers in the form — buckets and cards are separate lists in the form, `correct_bucket_id` is set via dropdown per card.
   - Trainee renderer: drag-between-containers. Cards start in a holding area, trainee drags into buckets. This IS the new dnd-kit pattern. Use `useDroppable` per bucket + `useDraggable` per card. NOT `SortableContext`.
2. **Visual layout of trainee renderer**:
   - Option A (locked design implied this): 4-column-or-fewer horizontal row of buckets at top, holding area below.
   - Option B: buckets in 2x2 grid for 3-4 buckets, single column for 2.
   - Recommend A — locked design said "horizontal row" implicitly.
3. **Per-bucket color**: NO — keep visual hierarchy consistent. Author has block-level background_color via BlockStyleSection.
4. **Mobile/narrow viewport**: stack buckets vertically below 640px. Cards drag-and-drop still works via dnd-kit's pointer activation (touch events handled).
5. **"Check my answers" feedback shape**: per-card green/red border + correct-bucket-name tooltip on wrong cards. Failed cards return to holding area for retry. "Check my answers" button disabled until every card is in some bucket.

### scenario — design questions

**Answered (Session 65 locked):**
- LINEAR (not branching), 1-12 moments
- Optional block-level title ≤120 chars + intro_markdown
- Per-moment: setup_markdown TipTap + optional image + prompt_type "multiple_choice" or "reflection"
- MC: 2-4 choices, choice_text plain text ≤200 chars, per-choice outcome_markdown TipTap
- Reflection: reflection_prompt plain text ≤300 chars + outcome_markdown TipTap + trainee response max 2000 chars
- Outcome reveal: MODAL/OVERLAY with Esc + Enter dismiss + focus-trap + backdrop blur + "Continue" close button
- Default gating_required = false

**Need decision:**
1. **Author form layout for per-moment prompt_type switch**: RadioGroup at top of moment card to flip between MC and Reflection. Closes the inactive fields (choices array OR reflection_prompt) on switch — but warn before destroying user-entered content. Pattern from ButtonStackBlockForm's action_type RadioGroup is the precedent.
2. **Modal implementation**:
   - shadcn `Dialog` primitive (Radix Portal + focus trap + Esc dismiss already wired). Yes, this is the right choice. Standing rule from Session 60 §50 is "Sheet is modal-overlay only" — Dialog is the same family and works for this purpose.
   - "Continue" button at bottom of modal, primary shadow-cta variant.
   - Backdrop click does NOT dismiss (user must read the outcome).
3. **Reflection prompt — does the trainee response post anywhere?**: NO in v1. The reflection_prompt + outcome_markdown is purely teaching content; the trainee types into a textarea that lives in completion_data only (Phase 5 trainee renderer concern, not v1 author UI). Author form has NO reflection-response field.
4. **Moment-level "completed" indicator in author form**: small badge showing prompt_type + "complete" / "needs setup" state per moment. Helps author validate config before save.
5. **Per-moment image in trainee renderer**: shown above setup_markdown if asset_id present. Same pattern as flashcards front image — `urlMap.get(asset_id)`.

### knowledge_check — design questions

**Answered (Session 65 locked):**
- 1-5 questions per block
- 7 question types: multiple_choice, multi_select, true_false, fill_in_blank, match, ranking, timeline
- All question prompts and explanation_markdown are TipTap
- All choice text + match left/right + ranking items + timeline events are PLAIN TEXT (§69)
- MC: 2-5 choices, 1 correct. multi_select: 2-6 choices, 1+ correct. true_false: fixed True/False, author picks correct.
- fill_in_blank: prompt with `___` tokens, blanks[] with correct_value + optional acceptable_alternatives[]
- match: 2-6 pairs left+right ≤120 chars
- ranking: 3-7 items ≤150 chars
- timeline: 3-7 events ≤150 chars (v1 = ordered placement on horizontal axis, NOT date-precision)
- Immediate per-question feedback with single canonical TipTap explanation
- Unlimited retry per question
- Default gating_required = TRUE (only block type with this default)

**Need decision:**
1. **Lovable prompt splitting**: Session 65 design recommended 2-3 prompts:
   - Prompt A: multiple_choice + multi_select + true_false (similar shapes, share `choices[]` field)
   - Prompt B: fill_in_blank + match (text-input-driven, share grading-comparison logic)
   - Prompt C: ranking + timeline (drag-to-order, share drag-and-drop UI)
   - Recommend doing it in this order. Smaller scope per prompt = cleaner verify cycles.
2. **Author form for each question type**: ONE form file (`KnowledgeCheckBlockForm.tsx`) but with a per-question sub-component dispatched by `question_type`. Pattern similar to ButtonStackBlockForm's action_type conditional fields, but bigger because 7 branches.
3. **Drag-and-drop mechanic for ranking/timeline**: same dnd-kit verticalListSortingStrategy as the form's outer reorder (in author UI). For trainee, ranking is vertical drag-to-reorder; timeline is horizontal drag-to-reorder (use `horizontalListSortingStrategy`).
4. **Renderer state for unlimited retry**: per-question `attempts` counter + `answered` state (current answer) + `revealed` (has explanation been shown). Trainee can change answer freely; "Check" button reveals explanation. Wrong answer keeps Check button enabled for retry.
5. **Match question UI**: pairs presented as two parallel columns (left static, right shuffled). Trainee clicks a left item then a right item to link them. Lines drawn between linked pairs. Pattern from existing drag-and-drop libraries — but custom implementation likely needed (no off-the-shelf shadcn).
6. **Timeline question UI**: events as labels above a horizontal axis. Trainee drags events into chronological order along the axis. Axis labels are author-defined position names (locked: "v1 = ordered placement, NOT date-precision").
7. **`gating_required` defaulting to TRUE**: the form should make this default visible in the UI (checkbox pre-checked, with helper text "Knowledge checks default to required completion") so authors don't accidentally save with it unchecked.

---

## Stretch question, applies to all three: per-block AI Refine support

flashcards has AI Refine via the existing draft-lesson-block panel. card_sort, scenario, knowledge_check inherit AI Refine "for free" because the backend already supports them (BLOCK_SCHEMAS extended Session 66, v12 draft cap fixed Session 67). The Lovable prompts SHOULD include the AI Refine button in the same location as flashcards.

Verify this works after each Lovable ship — there's a real chance the FE's "context-aware Refine" pattern that surfaced the Session 67 bug doesn't have parity across all block types yet. If a block type doesn't have an AI Refine button in its form footer, that's a missing FE wiring.

---

## Working notes from recon

Saved locally at `/home/claude/recon-session-68/` (lost between sessions — RE-FETCH from `main` in Session 69 if needed):

- `blockTypeMeta.ts` (267 LOC)
- `BlockRenderer.tsx` (962 LOC)
- `BlockEditorPane.tsx` (278 LOC)
- `AddBlockPopover.tsx` (37 LOC)
- `lesson-blocks.css` (345 LOC)
- `FlashcardsBlockForm.tsx` (301 LOC) — canonical template
- `AccordionBlockForm.tsx` (173 LOC) — simpler array template
- `TabsBlockForm.tsx` (231 LOC) — array w/ secondary state
- `ButtonStackBlockForm.tsx` (408 LOC) — per-item conditional fields template
- `StatCalloutBlockForm.tsx` (63 LOC) — simplest baseline
- `RichTextEditor.tsx` (282 LOC) — TipTap editor used in forms
- `FileUploadField.tsx` (781 LOC) — per-item image uploads
- `BrandColorSwatch.tsx` (101 LOC) — color picker, palette="full" + allowDefault props

All pulled from `main` on 2026-05-13.

---

## Suggested Session 69 sequence

1. **Open by reading this doc.** Skip re-doing the recon unless you suspect drift.
2. **Verify no drift**: `curl -sL https://raw.githubusercontent.com/cbastianBWE/brainwise-blueprint/main/src/components/super-admin/lesson-blocks/blockTypeMeta.ts | head -40` — confirm BlockType union still ends at flashcards.
3. **Pick card_sort.** Resolve the 5 card_sort design questions above (most are likely "yes, recommended option").
4. **Write the Lovable prompt** for card_sort. Target ~500-800 lines following the FlashcardsBlockForm + FlashcardsRender + lesson-blocks.css patterns above. Files modified: blockTypeMeta.ts (add type), BlockRenderer.tsx (add case + sub-component), BlockEditorPane.tsx (add dispatch), lesson-blocks.css (append section), CardSortBlockForm.tsx (new file).
5. **Ship to Lovable, verify.**
6. **If time permits**, open scenario design-lock thread but don't start the Lovable prompt — let Session 70 take that with full context budget.

knowledge_check is large enough that it gets its own session arc (Sessions 71+, possibly across 2-3 sessions for the three sub-prompts).
