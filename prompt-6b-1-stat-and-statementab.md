# Prompt 6b.1 — Two new lesson block types: stat_callout + statement_a_b

## Context

This is the first of two Lovable prompts in Session 64 (split for length). Backend Edge Functions (`scaffold-lesson-outline` v4, `expand-lesson-from-outline` v4, `draft-lesson-block` v5) already accept five new lesson `block_type` values: stat_callout, statement_a_b, accordion, tabs, button_stack.

**This prompt (6b.1) ships frontend for stat_callout + statement_a_b only.**

The next prompt (6b.2) will add accordion + tabs + button_stack. They share infrastructure (blockTypeMeta.ts, BlockEditorPane.tsx, BlockRenderer.tsx, lesson-blocks.css, EditorSlidePane.tsx, LessonBlocksEditor.tsx) so 6b.1 sets up the entire scaffolding for all 5 types but only adds the form components + render components for 2 of them. 6b.2 will fill in the missing 3.

After 6b.1 ships: stat_callout and statement_a_b are fully end-to-end authorable. The other 3 types are listed in `BlockType` union and `BLOCK_TYPE_META` (so the backend AI can still propose them and they save cleanly to DB), but they render as `null` in the canvas and selecting them in the editor shows just the universal Style section. This is an intentional intermediate state that resolves when 6b.2 ships.

## Standing rules (from prior sessions — must hold)

Read these first; do not violate them in your output.

1. **Universal Style section is inherited, not re-implemented**: every block type's `defaultConfig()` in `blockTypeMeta.ts` includes `background_color: null, padding: "none"`. `BlockEditorPane.tsx` already mounts `<BlockStyleSection value={cfg} onConfigChange={handleConfig} />` ONCE at the bottom of the form, after the type-specific BlockForm dispatch. New BlockForm components MUST NOT render their own Style section — they inherit `BlockStyleSection` from `BlockEditorPane` for free. (Session 61 §3 Choice B.)

2. **BlockRenderer wraps everything except divider**: `BlockRenderer.tsx` already wraps the inner content of every block in `<div className="block-style-wrapper" style={wrapperStyle}>` that reads `cfg.background_color` and `cfg.padding`. New render cases return ONLY the inner content; they inherit the wrapper for free. Do not duplicate the wrapper inside the new render cases. (Session 61.)

3. **Brand-only color enforcement**: any color picker added in any new component MUST use `BrandColorSwatch` from `./BrandColorSwatch`. No free hex input, no system color picker, no hardcoded color array. (Session 60 standing rule.)

4. **Typography baseline 17px / 1.65 line-height** is locked in `lesson-blocks.css` via the `.tiptap-prose` class. New render components that display prose content MUST apply `tiptap-prose` class on the prose container AND call `<ReadOnlyTipTap json={...} />` (existing helper in `BlockRenderer.tsx`).

5. **No new dependencies**: shadcn Tabs / Accordion / RadioGroup / Tooltip primitives are already in `src/components/ui/`. The 6b.1 work uses RadioGroup. The 6b.2 work will use Tabs and Accordion.

## Concern A — Block parity discipline (architecture-reference §61)

When adding a block_type, 5 touchpoints must update in parallel: (1) Edge Function ALLOWED_BLOCK_TYPES (already done backend-side); (2) Edge Function schemas (already done); (3) Edge Function transformConfigForCanvas (already done); (4) frontend BlockRenderer + blockTypeMeta; (5) frontend BlockForm.

This split-prompt approach (architecture-reference §64) accepts an intermediate state where the AI can produce blocks the editor can't manually author. The blocks still render correctly because BlockRenderer has all 5 switch cases. Only the authoring forms are split: 2 in 6b.1, 3 in 6b.2. Both 6b.1 and 6b.2 must ship same Lovable session (today) so the gap is hours, not sessions.

## Files to MODIFY

### 1. `src/components/super-admin/lesson-blocks/blockTypeMeta.ts`

Extend the `BlockType` union and `BLOCK_TYPE_META` object with ALL FIVE new types. (6b.2 won't touch this file.)

- Add to `BlockType` union: `"stat_callout"`, `"statement_a_b"`, `"accordion"`, `"tabs"`, `"button_stack"`.
- Import five new lucide-react icons at the top of the file:
  - `Hash` renamed to `HashIcon`
  - `Columns2` renamed to `ColumnsIcon`
  - `ListCollapse` renamed to `AccordionIcon`
  - `LayoutPanelTop` renamed to `TabsIcon`
  - `MousePointerClick` renamed to `ButtonStackIcon`
- Add five entries to `BLOCK_TYPE_META`, each with `background_color: null, padding: "none"` in the `defaultConfig` return value:

```ts
stat_callout: {
  label: "Stat callout",
  description: "Anchor a number with a label",
  icon: HashIcon,
  defaultConfig: () => ({
    stat: "",
    label: "",
    body: emptyDoc(),
    background_color: null,
    padding: "none",
  }),
},
statement_a_b: {
  label: "Statement A/B",
  description: "Side-by-side contrast",
  icon: ColumnsIcon,
  defaultConfig: () => ({
    a_label: "",
    a_body: emptyDoc(),
    b_label: "",
    b_body: emptyDoc(),
    variant: "contrast",
    background_color: null,
    padding: "none",
  }),
},
accordion: {
  label: "Accordion",
  description: "Collapsible sections",
  icon: AccordionIcon,
  defaultConfig: () => ({
    items: [
      { client_id: crypto.randomUUID(), title: "", body: emptyDoc() },
      { client_id: crypto.randomUUID(), title: "", body: emptyDoc() },
    ],
    background_color: null,
    padding: "none",
  }),
},
tabs: {
  label: "Tabs",
  description: "Parallel content branches",
  icon: TabsIcon,
  defaultConfig: () => ({
    tabs: [
      { client_id: crypto.randomUUID(), label: "Tab 1", body: emptyDoc() },
      { client_id: crypto.randomUUID(), label: "Tab 2", body: emptyDoc() },
    ],
    default_tab: 0,
    style: "underline",
    background_color: null,
    padding: "none",
  }),
},
button_stack: {
  label: "Buttons",
  description: "Link-out or jump-to-block buttons",
  icon: ButtonStackIcon,
  defaultConfig: () => ({
    buttons: [
      {
        client_id: crypto.randomUUID(),
        label: "",
        action_type: "link",
        url: "",
        target_block_client_id: null,
        variant: "primary",
      },
    ],
    layout: "stacked",
    background_color: null,
    padding: "none",
  }),
},
```

- Add the five strings to `IN_SCOPE_BLOCK_TYPES` array (after `"embed_audio"`).

### 2. `src/components/super-admin/lesson-blocks/BlockEditorPane.tsx`

Two changes:

**A. Add `siblingBlocks` prop and thread it.** Update the `Props` interface to add `siblingBlocks: EditorBlock[]` (required, may be empty array). Only `ButtonStackBlockForm` (shipped in 6b.2) will consume it.

**B. Add TWO new dispatch cases** (for 6b.1's two forms) BEFORE the `<BlockStyleSection ... />` line:

```tsx
{block.block_type === "stat_callout" && <StatCalloutBlockForm value={cfg} onConfigChange={handleConfig} />}
{block.block_type === "statement_a_b" && <StatementABBlockForm value={cfg} onConfigChange={handleConfig} />}
```

Add the two new imports at the top alongside existing block-form imports:

```tsx
import { StatCalloutBlockForm } from "./block-forms/StatCalloutBlockForm";
import { StatementABBlockForm } from "./block-forms/StatementABBlockForm";
```

Do NOT add imports or dispatch cases for accordion / tabs / button_stack — those land in 6b.2.

### 3. `src/components/super-admin/lesson-blocks/EditorSlidePane.tsx`

Add `siblingBlocks: EditorBlock[]` to `Props`. Forward to `<BlockEditorPane ... siblingBlocks={siblingBlocks} />`. No other changes.

### 4. `src/pages/super-admin/LessonBlocksEditor.tsx`

At the `<EditorSlidePane ... />` callsite around line 744, add `siblingBlocks={blocks}` prop (pass the full `blocks` state). No other changes.

### 5. `src/components/super-admin/lesson-blocks/BlockRenderer.tsx`

Three changes:

**A. Add `data-block-client-id` attribute to BOTH outer wrappers.** Essential for button_stack jump-to-block (shipped in 6b.2) scrollIntoView targeting:

In the divider early return, change `<div className="my-4">` to `<div className="my-4" data-block-client-id={block.client_id}>`.

In the `.block-style-wrapper` div at the bottom, add `data-block-client-id={block.client_id}`.

**B. Add ALL FIVE new `case` entries** in `renderInner()` switch (between `embed_audio` and `default`):

```tsx
case "stat_callout":
  return <StatCalloutRender stat={cfg.stat ?? ""} label={cfg.label ?? ""} body={cfg.body ?? null} backgroundColor={cfg.background_color ?? null} />;
case "statement_a_b":
  return <StatementABRender aLabel={cfg.a_label ?? ""} aBody={cfg.a_body ?? null} bLabel={cfg.b_label ?? ""} bBody={cfg.b_body ?? null} variant={cfg.variant ?? "contrast"} />;
case "accordion":
  return <AccordionRender items={cfg.items ?? []} />;
case "tabs":
  return <TabsRender tabs={cfg.tabs ?? []} defaultTab={cfg.default_tab ?? 0} style={cfg.style ?? "underline"} />;
case "button_stack":
  return <ButtonStackRender buttons={cfg.buttons ?? []} layout={cfg.layout ?? "stacked"} />;
```

**C. Add ALL FIVE new Render sub-components in the same file** (colocated with existing ones like HeadingRender, ImageRender). See "Render component specs" section below.

**D. Add imports at the top of BlockRenderer.tsx** (in addition to existing imports):

```tsx
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
```

### 6. `src/components/super-admin/lesson-blocks/lesson-blocks.css`

Append the following new CSS classes at the bottom of the file. Do not modify existing rules.

```css
/* === Session 63 / 64: five new block types === */

/* Stat callout */
.bw-stat-callout {
  text-align: center;
  padding: 1.5rem 1rem;
}
.bw-stat-callout-number {
  font-family: var(--font-display, "Poppins", sans-serif);
  font-size: clamp(2.5rem, 7vw, 4rem);
  font-weight: 700;
  color: #021F36;
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin: 0;
}
.bw-stat-callout-label {
  font-size: 1.0625rem;
  color: #4B5563;
  margin-top: 0.5rem;
  max-width: 32rem;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.4;
}
.bw-stat-callout-body {
  margin-top: 1rem;
  max-width: 36rem;
  margin-left: auto;
  margin-right: auto;
}

/* Statement A/B */
.bw-statement-ab {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
@media (min-width: 768px) {
  .bw-statement-ab {
    grid-template-columns: 1fr 1fr;
  }
}
.bw-statement-card {
  border-left: 4px solid #021F36;
  background-color: hsl(var(--muted) / 0.30);
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
}
.bw-statement-card-a.is-contrast { border-left-color: #F5741A; }
.bw-statement-card-b.is-contrast { border-left-color: #006D77; }
.bw-statement-card-a.is-neutral,
.bw-statement-card-b.is-neutral { border-left-color: #021F36; }
.bw-statement-card-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6D6875;
  margin-bottom: 0.5rem;
}

/* Accordion */
.bw-accordion-item {
  border-bottom: 1px solid hsl(var(--border));
}
.bw-accordion-trigger {
  font-family: var(--font-display, "Poppins", sans-serif);
  font-weight: 600;
  color: #021F36;
}
.bw-accordion-content {
  padding-bottom: 1rem;
}

/* Tabs */
.bw-tabs-list-underline {
  border-bottom: 1px solid hsl(var(--border));
  margin-bottom: 1rem;
}
.bw-tabs-trigger-underline[data-state="active"] {
  color: #021F36;
  border-bottom: 2px solid #F5741A;
  margin-bottom: -1px;
}

/* Button stack */
.bw-button-stack-stacked {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.bw-button-stack-stacked > * { width: 100%; }
.bw-button-stack-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
```

## Files to CREATE

### 7. `src/components/super-admin/lesson-blocks/block-forms/StatCalloutBlockForm.tsx`

```tsx
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "../RichTextEditor";
import type { TipTapDocJSON } from "../blockTypeMeta";

interface Props {
  value: {
    stat: string;
    label: string;
    body: TipTapDocJSON;
  };
  onConfigChange: (next: Props["value"]) => void;
}

export function StatCalloutBlockForm({ value, onConfigChange }: Props) {
  const stat = value.stat ?? "";
  const label = value.label ?? "";

  return (
    <div className="space-y-3">
      {/* Live preview — what the trainee sees */}
      <div className="rounded-md border bg-muted/20 px-4 py-6 text-center">
        <div
          className="font-display"
          style={{
            fontSize: "clamp(2rem, 6vw, 3.25rem)",
            fontWeight: 700,
            color: "#021F36",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          {stat || "47%"}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          {label || "Add a supporting label below"}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Statistic</Label>
        <Input
          value={stat}
          onChange={(e) => onConfigChange({ ...value, stat: e.target.value })}
          placeholder="47% or 1 in 3 or $2.4M"
          maxLength={24}
        />
        <p className="text-xs text-muted-foreground">
          Short text — works for percentages, ratios, dollar amounts, multipliers.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={label}
          onChange={(e) => onConfigChange({ ...value, label: e.target.value })}
          placeholder="of feedback conversations stall on framing"
          maxLength={120}
        />
      </div>

      <div className="space-y-2">
        <Label>Supporting detail (optional)</Label>
        <RichTextEditor
          value={value.body ?? null}
          onChange={(next) => onConfigChange({ ...value, body: next })}
          placeholder="One or two sentences of context"
          compact
        />
      </div>
    </div>
  );
}
```

### 8. `src/components/super-admin/lesson-blocks/block-forms/StatementABBlockForm.tsx`

```tsx
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RichTextEditor } from "../RichTextEditor";
import type { TipTapDocJSON } from "../blockTypeMeta";

type Variant = "contrast" | "neutral";

interface Props {
  value: {
    a_label: string;
    a_body: TipTapDocJSON;
    b_label: string;
    b_body: TipTapDocJSON;
    variant: Variant;
  };
  onConfigChange: (next: Props["value"]) => void;
}

export function StatementABBlockForm({ value, onConfigChange }: Props) {
  const variant: Variant = value.variant === "neutral" ? "neutral" : "contrast";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Style</Label>
        <RadioGroup
          value={variant}
          onValueChange={(v) =>
            onConfigChange({ ...value, variant: v as Variant })
          }
          className="grid grid-cols-2 gap-2"
        >
          <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm font-normal has-[:checked]:border-foreground has-[:checked]:bg-muted/30">
            <RadioGroupItem value="contrast" />
            <span>Contrast (A weak / B strong)</span>
          </Label>
          <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm font-normal has-[:checked]:border-foreground has-[:checked]:bg-muted/30">
            <RadioGroupItem value="neutral" />
            <span>Neutral (two perspectives)</span>
          </Label>
        </RadioGroup>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* A side */}
        <div
          className="rounded-md border p-3 space-y-2"
          style={{
            borderLeftWidth: 4,
            borderLeftColor: variant === "contrast" ? "#F5741A" : "#021F36",
          }}
        >
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Statement A
          </Label>
          <Input
            value={value.a_label ?? ""}
            onChange={(e) => onConfigChange({ ...value, a_label: e.target.value })}
            placeholder="Label (e.g. Vague, Before, Weak)"
            maxLength={40}
          />
          <RichTextEditor
            value={value.a_body ?? null}
            onChange={(next) => onConfigChange({ ...value, a_body: next })}
            placeholder="The A statement…"
            compact
          />
        </div>

        {/* B side */}
        <div
          className="rounded-md border p-3 space-y-2"
          style={{
            borderLeftWidth: 4,
            borderLeftColor: variant === "contrast" ? "#006D77" : "#021F36",
          }}
        >
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Statement B
          </Label>
          <Input
            value={value.b_label ?? ""}
            onChange={(e) => onConfigChange({ ...value, b_label: e.target.value })}
            placeholder="Label (e.g. SBI-structured, After, Strong)"
            maxLength={40}
          />
          <RichTextEditor
            value={value.b_body ?? null}
            onChange={(next) => onConfigChange({ ...value, b_body: next })}
            placeholder="The B statement…"
            compact
          />
        </div>
      </div>
    </div>
  );
}
```

## Render component specs (added INSIDE `BlockRenderer.tsx`)

All five render components are added to BlockRenderer.tsx in this prompt because the switch references all five. The Accordion/Tabs/ButtonStack forms aren't created in 6b.1 — they ship in 6b.2 — but the render components must exist so the switch compiles AND so AI-generated blocks of those types render correctly even before their authoring forms exist.

```tsx
// === Session 64 additions — render components for 5 new block types ===

function StatCalloutRender({
  stat,
  label,
  body,
  backgroundColor,
}: {
  stat: string;
  label: string;
  body: TipTapDocJSON | null;
  backgroundColor: string | null;
}) {
  return (
    <div className="bw-stat-callout">
      <div className="bw-stat-callout-number">{stat || "—"}</div>
      <div className="bw-stat-callout-label">{label}</div>
      {body && (
        <div className="bw-stat-callout-body tiptap-prose">
          <ReadOnlyTipTap json={body} />
        </div>
      )}
    </div>
  );
}

function StatementABRender({
  aLabel,
  aBody,
  bLabel,
  bBody,
  variant,
}: {
  aLabel: string;
  aBody: TipTapDocJSON | null;
  bLabel: string;
  bBody: TipTapDocJSON | null;
  variant: "contrast" | "neutral";
}) {
  const variantClass = variant === "neutral" ? "is-neutral" : "is-contrast";
  return (
    <div className="bw-statement-ab">
      <div className={`bw-statement-card bw-statement-card-a ${variantClass}`}>
        {aLabel && <div className="bw-statement-card-label">{aLabel}</div>}
        <div className="tiptap-prose">
          <ReadOnlyTipTap json={aBody} />
        </div>
      </div>
      <div className={`bw-statement-card bw-statement-card-b ${variantClass}`}>
        {bLabel && <div className="bw-statement-card-label">{bLabel}</div>}
        <div className="tiptap-prose">
          <ReadOnlyTipTap json={bBody} />
        </div>
      </div>
    </div>
  );
}

function AccordionRender({
  items,
}: {
  items: Array<{ client_id: string; title: string; body: TipTapDocJSON | null }>;
}) {
  if (items.length === 0) return null;
  return (
    <Accordion type="multiple" className="w-full">
      {items.map((item) => (
        <AccordionItem
          key={item.client_id}
          value={item.client_id}
          className="bw-accordion-item"
        >
          <AccordionTrigger className="bw-accordion-trigger text-left">
            {item.title || "(untitled section)"}
          </AccordionTrigger>
          <AccordionContent className="bw-accordion-content">
            <div className="tiptap-prose">
              <ReadOnlyTipTap json={item.body} />
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function TabsRender({
  tabs,
  defaultTab,
  style,
}: {
  tabs: Array<{ client_id: string; label: string; body: TipTapDocJSON | null }>;
  defaultTab: number;
  style: "underline" | "pills";
}) {
  if (tabs.length === 0) return null;
  const safeDefault = Math.min(Math.max(0, defaultTab), tabs.length - 1);
  const defaultValue = tabs[safeDefault]?.client_id ?? tabs[0].client_id;
  return (
    <Tabs defaultValue={defaultValue} className="w-full">
      <TabsList
        className={
          style === "underline"
            ? "bw-tabs-list-underline w-full justify-start bg-transparent p-0 h-auto"
            : "w-full justify-start"
        }
      >
        {tabs.map((t) => (
          <TabsTrigger
            key={t.client_id}
            value={t.client_id}
            className={
              style === "underline"
                ? "bw-tabs-trigger-underline rounded-none border-b-2 border-transparent bg-transparent px-4 pb-2 pt-1 text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                : ""
            }
          >
            {t.label || "(untitled)"}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.client_id} value={t.client_id} className="pt-2">
          <div className="tiptap-prose">
            <ReadOnlyTipTap json={t.body} />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function ButtonStackRender({
  buttons,
  layout,
}: {
  buttons: Array<{
    client_id: string;
    label: string;
    action_type: "link" | "jump_to_block";
    url: string | null;
    target_block_client_id: string | null;
    variant: "primary" | "secondary";
  }>;
  layout: "stacked" | "inline";
}) {
  if (buttons.length === 0) return null;
  const wrapperClass = layout === "inline" ? "bw-button-stack-inline" : "bw-button-stack-stacked";

  const handleJump = (targetClientId: string | null) => {
    if (!targetClientId) return;
    if (typeof document === "undefined") return;
    const target = document.querySelector(`[data-block-client-id="${targetClientId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className={wrapperClass}>
      {buttons.map((b) => {
        const buttonProps = {
          variant: b.variant === "secondary" ? ("outline" as const) : ("default" as const),
          style:
            b.variant === "primary"
              ? { backgroundColor: "#F5741A", color: "white" }
              : undefined,
        };
        const label = b.label || "(untitled)";
        if (b.action_type === "jump_to_block") {
          return (
            <Button
              key={b.client_id}
              type="button"
              {...buttonProps}
              onClick={() => handleJump(b.target_block_client_id)}
              disabled={!b.target_block_client_id}
            >
              {label}
            </Button>
          );
        }
        const url = b.url ?? "";
        if (!url) {
          return (
            <Button key={b.client_id} type="button" {...buttonProps} disabled>
              {label}
            </Button>
          );
        }
        const isExternal = url.startsWith("http://") || url.startsWith("https://");
        return (
          <a
            key={b.client_id}
            href={url}
            target={isExternal ? "_blank" : "_self"}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className={layout === "stacked" ? "block w-full" : ""}
          >
            <Button type="button" {...buttonProps} className={layout === "stacked" ? "w-full" : ""}>
              {label}
            </Button>
          </a>
        );
      })}
    </div>
  );
}
```

## Acceptance criteria for 6b.1

1. **No TypeScript errors** in any file modified or created. `BlockType` union now includes 14 literal string types. `BLOCK_TYPE_META` covers all 14.

2. **Add Block popover shows 14 types** in this order: text, heading, divider, image, video_embed, quote, list, callout, embed_audio, stat_callout, statement_a_b, accordion, tabs, button_stack. Each shows its lucide icon, label, and description.

3. **stat_callout fully functional**: can be added via Add Block. Form shows live-preview of stat as author types. Statistic field, Label field, optional supporting detail RichTextEditor all save to config. Universal Style section appears at bottom. Canvas renders stat centered in Poppins display font.

4. **statement_a_b fully functional**: can be added via Add Block. Variant RadioGroup toggles left-border colors live on both author-side cards. Two labels and two RichTextEditors edit independently. Universal Style section appears at bottom. Canvas renders side-by-side cards stacking on mobile, side-by-side on md:+.

5. **accordion / tabs / button_stack are partial**: can be added via Add Block popover (they show up with default 2-section / 2-tab / 1-button content from defaultConfig), AND they RENDER correctly in canvas (via the render components). Selecting them in the editor opens the slide-in pane showing ONLY the universal Style section (no type-specific form) and Refine-with-AI. This is intentional — their forms ship in 6b.2.

6. **AI authoring round-trip works for all 5 types**: starting an AI authoring session, accepting an outline that includes any of the 5 new types, clicking Build all results in lesson_blocks rows being created with canvas-valid configs that render correctly. No "block won't render" failures. This is verified via SQL after build.

7. **data-block-client-id attribute** present on every rendered block's outer wrapper (both divider early-return AND main `.block-style-wrapper`). Verifiable via browser devtools.

8. **No console errors** during any of the above flows.

9. **No regressions on existing 9 block types**: text, heading, divider, image, video_embed, quote, list, callout, embed_audio all continue to render and author exactly as before.

10. **Universal Style section** works on all 5 new block types identically to existing types.

## What this prompt explicitly does NOT do

- Does NOT add AccordionBlockForm, TabsBlockForm, or ButtonStackBlockForm — those ship in prompt 6b.2.
- Does NOT modify any AI authoring infrastructure. Backend already accepts the new types.
- Does NOT modify any existing block forms.
- Does NOT add new dependencies.
- Does NOT add flashcards, scenario, or knowledge_check block types — those are Prompt 6c.

## File checklist for 6b.1

Modified:
- `src/components/super-admin/lesson-blocks/blockTypeMeta.ts` (adds all 5 types to union + meta)
- `src/components/super-admin/lesson-blocks/BlockEditorPane.tsx` (adds siblingBlocks prop + 2 dispatch cases)
- `src/components/super-admin/lesson-blocks/EditorSlidePane.tsx` (siblingBlocks pass-through)
- `src/components/super-admin/lesson-blocks/BlockRenderer.tsx` (5 switch cases + 5 render components + data-block-client-id)
- `src/components/super-admin/lesson-blocks/lesson-blocks.css` (5 block-type CSS groups)
- `src/pages/super-admin/LessonBlocksEditor.tsx` (passes siblingBlocks={blocks})

Created:
- `src/components/super-admin/lesson-blocks/block-forms/StatCalloutBlockForm.tsx`
- `src/components/super-admin/lesson-blocks/block-forms/StatementABBlockForm.tsx`

6 modifications + 2 creations = 8 file changes.
