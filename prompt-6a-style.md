# Prompt 6a-style — Per-block background color + padding

Add per-block visual differentiation to the stacked lesson editor: each block can have an optional background color (chosen from a tinted brand palette) and a padding token (none / small / medium / large). Authors get a tool for grouping blocks, alternating sections, and creating breathing room — without departing from the brand palette.

This is a frontend-only change. The new fields ride in the existing `lesson_blocks.config` jsonb shape. No schema migration. No backend changes. No new dependencies.

---

## Locked decisions (do not deviate)

1. **Background color picker uses `BrandColorSwatch` with a new `palette="tints"` mode.** No hex input. No off-palette colors. 8 tinted swatches + a Default option that returns `null`.
2. **Padding stays a fixed enumerated set: `none` / `small` / `medium` / `large`.** No arbitrary pixel input. Map to `0px / 12px / 24px / 48px` top-and-bottom.
3. **Schema: extend `config` jsonb only.** Two new fields per block: `config.background_color` (tinted hex string or null) and `config.padding` (one of `"none"`, `"small"`, `"medium"`, `"large"`). No new columns. No migrations.
4. **Style section lives in `BlockEditorPane`, NOT in any individual block form.** Render once after the dispatched block-type form. All 9 block types share the same Style section by virtue of going through `BlockEditorPane`.
5. **Default = transparent.** "Default" stores `null` and means "no background override — block inherits the page sand background." Do not store sand-tint hex as a stand-in for Default.
6. **Background + padding apply inside `BlockRenderer`** via a wrapping div with inline styles. This guarantees the styling travels to Phase 5 trainee rendering for free, since `BlockRenderer` is the canonical block renderer (standing rule 3 from Session 60).
7. **Divider is a no-op visually.** The divider's Style section is shown in the form (consistency), background_color and padding round-trip through config (consistency), but BlockRenderer's `case "divider"` returns the unwrapped 3px line — no background wrapper, no padding. Apply only to the other 8 block types.
8. **Selected-state chrome change:** drop the muted background from `.stacked-block.is-selected` in `lesson-blocks.css`. The orange `border-left: 4px solid #F5741A` already provides distinct selection signal on its own, and the muted background fights any author-set tint. Hover state stays as-is.

---

## Tinted color palette — locked hex values

These are pre-mixed near-neutral tints designed for readability against the platform's sand `#F9F7F1` background. Each tint is roughly the corresponding brand color at low saturation against sand. Add them as a new exported constant `BRAND_TINT_COLORS` in `BrandColorSwatch.tsx` in the same Cole-locked order as `BRAND_SWATCH_COLORS`:

```ts
export const BRAND_TINT_COLORS: BrandSwatchColor[] = [
  { label: "Navy tint",    hex: "#EDEFF2" },
  { label: "Orange tint",  hex: "#FDEFE3" },
  { label: "Sand tint",    hex: "#F9F7F1" },
  { label: "Teal tint",    hex: "#E3EDED" },
  { label: "Mustard tint", hex: "#F3EEDF" },
  { label: "Slate tint",   hex: "#EFEDEF" },
  { label: "Purple tint",  hex: "#EAE4EE" },
  { label: "Forest tint",  hex: "#E5EBE7" },
];
```

The Sand tint is intentionally the same hex as the page background (`#F9F7F1`). When applied, it visually disappears against the page — but it represents an explicit author choice ("I picked Sand"), which is semantically different from Default (null = "no override"). Keep both as distinct selectable options.

---

## Padding token mapping — locked

Apply as inline style on the BlockRenderer wrapper div. Do NOT use Tailwind spacing classes (we want exact pixel values, not Tailwind's scale).

```
none   → paddingTop: 0,    paddingBottom: 0
small  → paddingTop: 12px, paddingBottom: 12px
medium → paddingTop: 24px, paddingBottom: 24px
large  → paddingTop: 48px, paddingBottom: 48px
```

Horizontal padding is NOT touched. Blocks remain edge-to-edge horizontally within their stacked container. Only vertical breathing room is configurable in v1.

---

## File changes (6 files total)

### 1. New file: `src/components/super-admin/lesson-blocks/BlockStyleSection.tsx`

A shared Style section component used by `BlockEditorPane`. Renders a section header, the background color picker (tinted palette + Default), and the padding dropdown. Takes the same `(value, onConfigChange)` shape as the block forms.

```tsx
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandColorSwatch } from "./BrandColorSwatch";

export type BlockPadding = "none" | "small" | "medium" | "large";

interface Props {
  /** Full config object of the block — opaque shape, we only touch background_color + padding */
  value: Record<string, unknown>;
  onConfigChange: (next: Record<string, unknown>) => void;
}

const PADDING_OPTIONS: { value: BlockPadding; label: string }[] = [
  { value: "none",   label: "None" },
  { value: "small",  label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large",  label: "Large" },
];

export function BlockStyleSection({ value, onConfigChange }: Props) {
  const bg = (value.background_color as string | null | undefined) ?? null;
  const padding = ((value.padding as BlockPadding | undefined) ?? "none");

  return (
    <div className="space-y-4 border-t pt-4 mt-2">
      <div
        className="font-display text-sm font-semibold tracking-tight"
        style={{ color: "#021F36" }}
      >
        Style
      </div>

      <div className="space-y-2">
        <Label>Background color</Label>
        <BrandColorSwatch
          value={bg}
          palette="tints"
          allowDefault
          defaultLabel="Default"
          onChange={(hex) =>
            onConfigChange({ ...value, background_color: hex })
          }
          onDefaultSelected={() =>
            onConfigChange({ ...value, background_color: null })
          }
        />
        <p className="text-xs text-muted-foreground">
          Apply a tinted brand color to differentiate this block. Default leaves the block transparent.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Padding</Label>
        <Select
          value={padding}
          onValueChange={(v) =>
            onConfigChange({ ...value, padding: v as BlockPadding })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PADDING_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Vertical breathing room above and below the block.
        </p>
      </div>
    </div>
  );
}
```

### 2. `src/components/super-admin/lesson-blocks/BrandColorSwatch.tsx` — add tinted palette mode

Add `BRAND_TINT_COLORS` export alongside the existing `BRAND_SWATCH_COLORS`. Add a new `palette?: "full" | "tints"` prop that defaults to `"full"` (preserves existing call sites). When `palette="tints"`, iterate over `BRAND_TINT_COLORS` instead of `BRAND_SWATCH_COLORS`.

Existing component file in full, with the changes:

```tsx
import { cn } from "@/lib/utils";

export interface BrandSwatchColor {
  /** Brand token name shown in tooltip */
  label: string;
  /** Hex value used as the canonical value passed to onChange */
  hex: string;
}

export const BRAND_SWATCH_COLORS: BrandSwatchColor[] = [
  { label: "Navy",    hex: "#021F36" },
  { label: "Orange",  hex: "#F5741A" },
  { label: "Sand",    hex: "#F9F7F1" },
  { label: "Teal",    hex: "#006D77" },
  { label: "Mustard", hex: "#7a5800" },
  { label: "Slate",   hex: "#6D6875" },
  { label: "Purple",  hex: "#3C096C" },
  { label: "Forest",  hex: "#2D6A4F" },
];

export const BRAND_TINT_COLORS: BrandSwatchColor[] = [
  { label: "Navy tint",    hex: "#EDEFF2" },
  { label: "Orange tint",  hex: "#FDEFE3" },
  { label: "Sand tint",    hex: "#F9F7F1" },
  { label: "Teal tint",    hex: "#E3EDED" },
  { label: "Mustard tint", hex: "#F3EEDF" },
  { label: "Slate tint",   hex: "#EFEDEF" },
  { label: "Purple tint",  hex: "#EAE4EE" },
  { label: "Forest tint",  hex: "#E5EBE7" },
];

interface BrandColorSwatchProps {
  /** Currently selected hex value, or null/undefined for "default" */
  value: string | null | undefined;
  onChange: (hex: string | null) => void;
  /** Optional: show only a subset (e.g. ["#021F36", "#F5741A"]) */
  allowedHexes?: string[];
  /** Optional: show a "default" / "none" option that calls onChange with null */
  allowDefault?: boolean;
  /** Default label, defaults to "Default" */
  defaultLabel?: string;
  onDefaultSelected?: () => void;
  /** Which palette to render. "full" = saturated brand colors (default). "tints" = pre-mixed near-neutral tints for backgrounds. */
  palette?: "full" | "tints";
}

export function BrandColorSwatch({
  value,
  onChange,
  allowedHexes,
  allowDefault = false,
  defaultLabel = "Default",
  onDefaultSelected,
  palette = "full",
}: BrandColorSwatchProps) {
  const source = palette === "tints" ? BRAND_TINT_COLORS : BRAND_SWATCH_COLORS;
  const swatches = allowedHexes
    ? source.filter((c) => allowedHexes.includes(c.hex))
    : source;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowDefault && (
        <button
          type="button"
          onClick={() => {
            if (onDefaultSelected) onDefaultSelected();
            onChange(null);
          }}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs transition-colors",
            !value
              ? "border-foreground bg-muted font-medium"
              : "border-border hover:bg-muted/50",
          )}
        >
          {defaultLabel}
        </button>
      )}
      {swatches.map((c) => {
        const selected = value === c.hex;
        return (
          <button
            key={c.hex}
            type="button"
            onClick={() => onChange(c.hex)}
            title={c.label}
            aria-label={c.label}
            className={cn(
              "h-7 w-7 rounded-full border-2 transition-all",
              selected
                ? "border-foreground ring-2 ring-offset-1 ring-foreground/20 scale-110"
                : "border-border hover:scale-105",
            )}
            style={{ background: c.hex }}
          />
        );
      })}
    </div>
  );
}
```

Existing call sites (`DividerBlockForm`, `ListBlockForm`) do NOT pass `palette` and so default to `"full"` — they continue to work unchanged.

### 3. `src/components/super-admin/lesson-blocks/blockTypeMeta.ts` — extend defaultConfig for all 9 block types

Every `defaultConfig()` function must include `background_color: null` and `padding: "none"` in the returned object. Add them after the existing fields. Do not touch any other field.

After the edit, the file should look like this (showing only `BLOCK_TYPE_META` for brevity — keep the rest of the file unchanged):

```ts
export const BLOCK_TYPE_META: Record<
  BlockType,
  {
    label: string;
    description: string;
    icon: LucideIcon;
    defaultConfig: () => Record<string, unknown>;
  }
> = {
  text: {
    label: "Text",
    description: "Paragraph of rich text",
    icon: Type,
    defaultConfig: () => ({ body: emptyDoc(), background_color: null, padding: "none" }),
  },
  heading: {
    label: "Heading",
    description: "Section header",
    icon: HeadingIcon,
    defaultConfig: () => ({ text: "", level: 2, background_color: null, padding: "none" }),
  },
  divider: {
    label: "Divider",
    description: "Horizontal rule",
    icon: Minus,
    defaultConfig: () => ({ color: "#021F36", background_color: null, padding: "none" }),
  },
  image: {
    label: "Image",
    description: "Upload an image",
    icon: ImageIcon,
    defaultConfig: () => ({ asset_id: null, alt: "", caption: null, background_color: null, padding: "none" }),
  },
  video_embed: {
    label: "Video",
    description: "Embedded video",
    icon: Video,
    defaultConfig: () => ({
      asset_id: null,
      source_type: "supabase_storage",
      source_id: null,
      title: null,
      background_color: null,
      padding: "none",
    }),
  },
  quote: {
    label: "Quote",
    description: "Blockquote with attribution",
    icon: Quote,
    defaultConfig: () => ({ body: emptyDoc(), attribution: null, background_color: null, padding: "none" }),
  },
  list: {
    label: "List",
    description: "Bullet or numbered list",
    icon: ListIcon,
    defaultConfig: () => ({
      items: [{ client_id: crypto.randomUUID(), body: emptyDoc() }],
      ordered: false,
      background_color: null,
      padding: "none",
    }),
  },
  callout: {
    label: "Callout",
    description: "Highlighted note",
    icon: AlertCircle,
    defaultConfig: () => ({ variant: "info", body: emptyDoc(), background_color: null, padding: "none" }),
  },
  embed_audio: {
    label: "Audio",
    description: "Embedded audio file",
    icon: Music,
    defaultConfig: () => ({ asset_id: null, transcript: null, background_color: null, padding: "none" }),
  },
};
```

### 4. `src/components/super-admin/lesson-blocks/BlockRenderer.tsx` — wrap 8 of 9 block render outputs in a styled wrapper

The switch in the main `BlockRenderer` function currently returns each block's rendered content directly. Wrap 8 of the 9 cases in a `<div className="block-style-wrapper" style={{ background, paddingTop, paddingBottom }}>`. The `divider` case stays unwrapped (no background, no padding — divider geometry doesn't accommodate them).

Helper to extract style:

```ts
function paddingPxFor(token: unknown): number {
  switch (token) {
    case "small":  return 12;
    case "medium": return 24;
    case "large":  return 48;
    case "none":
    default:       return 0;
  }
}
```

Replace the final `export function BlockRenderer` with:

```tsx
export function BlockRenderer({ block, assetUrlMap }: BlockRendererProps) {
  const cfg: any = block.config ?? {};
  const bg = (cfg.background_color as string | null | undefined) ?? null;
  const padPx = paddingPxFor(cfg.padding);

  const wrapperStyle: CSSProperties = {
    background: bg ?? undefined,
    paddingTop: padPx,
    paddingBottom: padPx,
    // When a background is set, give it a little horizontal breathing room
    // so text doesn't touch the tinted edge.
    paddingLeft: bg ? 16 : undefined,
    paddingRight: bg ? 16 : undefined,
    // Rounded corners on tinted blocks so they read as a "card" rather than a stripe.
    borderRadius: bg ? 8 : undefined,
  };

  const renderInner = (): JSX.Element | null => {
    switch (block.block_type) {
      case "text":
        return <ReadOnlyTipTap json={cfg.body} />;
      case "heading":
        return <HeadingRender text={cfg.text ?? ""} level={cfg.level ?? 2} />;
      case "image":
        return (
          <ImageRender
            assetId={cfg.asset_id ?? null}
            alt={cfg.alt ?? ""}
            caption={cfg.caption ?? null}
            urlMap={assetUrlMap}
          />
        );
      case "video_embed":
        return <VideoRender config={cfg} urlMap={assetUrlMap} />;
      case "quote":
        return (
          <QuoteRender body={cfg.body ?? null} attribution={cfg.attribution ?? null} />
        );
      case "list":
        return (
          <ListRender
            items={cfg.items ?? []}
            ordered={!!cfg.ordered}
            markerColor={cfg.marker_color ?? null}
          />
        );
      case "callout":
        return <CalloutRender variant={cfg.variant ?? "info"} body={cfg.body ?? null} />;
      case "embed_audio":
        return (
          <AudioRender
            assetId={cfg.asset_id ?? null}
            transcript={cfg.transcript ?? null}
            urlMap={assetUrlMap}
          />
        );
      default:
        return null;
    }
  };

  // Divider: no wrapper, no background, no padding. Geometric edge case.
  if (block.block_type === "divider") {
    const dividerColor = (cfg.color as string | undefined) || "#021F36";
    return (
      <div className="my-4">
        <div
          className="h-[3px] w-full rounded-full"
          style={{ background: dividerColor }}
        />
      </div>
    );
  }

  return (
    <div className="block-style-wrapper" style={wrapperStyle}>
      {renderInner()}
    </div>
  );
}
```

The wrapper div gets a className `block-style-wrapper` for any future CSS hook needs. No CSS rules attached to it in this prompt.

When `bg` is null, the inline style fields are `undefined` and React omits them entirely from the DOM — the div is layout-only and has no visible effect. When `padding` is `"none"`, `paddingTop` and `paddingBottom` are 0, which is correct.

### 5. `src/components/super-admin/lesson-blocks/BlockEditorPane.tsx` — render `BlockStyleSection` after the dispatched form

Add the import, add a single `<BlockStyleSection>` render after the type-specific form's closing block. Use the same `value` (the block's config) and `onChange` (the same `handleConfig` already wired up).

```tsx
import type { EditorBlock } from "./blockTypeMeta";
import { TextBlockForm } from "./block-forms/TextBlockForm";
import { HeadingBlockForm } from "./block-forms/HeadingBlockForm";
import { DividerBlockForm } from "./block-forms/DividerBlockForm";
import { ImageBlockForm } from "./block-forms/ImageBlockForm";
import { VideoEmbedBlockForm } from "./block-forms/VideoEmbedBlockForm";
import { QuoteBlockForm } from "./block-forms/QuoteBlockForm";
import { ListBlockForm } from "./block-forms/ListBlockForm";
import { CalloutBlockForm } from "./block-forms/CalloutBlockForm";
import { EmbedAudioBlockForm } from "./block-forms/EmbedAudioBlockForm";
import { BlockStyleSection } from "./BlockStyleSection";

interface Props {
  block: EditorBlock | null;
  onChange: (next: EditorBlock) => void;
  contentItemId: string;
}

export function BlockEditorPane({ block, onChange, contentItemId }: Props) {
  if (!block) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Select a block from the stack to edit.
      </div>
    );
  }

  const handleConfig = (nextConfig: Record<string, unknown>) =>
    onChange({ ...block, config: nextConfig });

  const cfg: any = block.config;

  return (
    <div className="space-y-4 p-4">
      {block.block_type === "text" && (
        <TextBlockForm value={cfg} onConfigChange={handleConfig} />
      )}
      {block.block_type === "heading" && (
        <HeadingBlockForm value={cfg} onConfigChange={handleConfig} />
      )}
      {block.block_type === "divider" && (
        <DividerBlockForm value={cfg} onConfigChange={handleConfig} />
      )}
      {block.block_type === "image" && (
        <ImageBlockForm
          value={cfg}
          onConfigChange={handleConfig}
          contentItemId={contentItemId}
        />
      )}
      {block.block_type === "video_embed" && (
        <VideoEmbedBlockForm
          value={cfg}
          onConfigChange={handleConfig}
          contentItemId={contentItemId}
        />
      )}
      {block.block_type === "quote" && (
        <QuoteBlockForm value={cfg} onConfigChange={handleConfig} />
      )}
      {block.block_type === "list" && (
        <ListBlockForm value={cfg} onConfigChange={handleConfig} />
      )}
      {block.block_type === "callout" && (
        <CalloutBlockForm value={cfg} onConfigChange={handleConfig} />
      )}
      {block.block_type === "embed_audio" && (
        <EmbedAudioBlockForm
          value={cfg}
          onConfigChange={handleConfig}
          contentItemId={contentItemId}
        />
      )}

      <BlockStyleSection value={cfg} onConfigChange={handleConfig} />
    </div>
  );
}
```

The Style section appears on all 9 block types because it's rendered unconditionally after the dispatch.

### 6. `src/components/super-admin/lesson-blocks/lesson-blocks.css` — remove muted bg from selected state

Change ONE rule. Selected state currently sets `background-color: hsl(var(--muted))` which fights any author-set background tint. Remove that line. Keep the orange left-border and the `padding-left: 12px`. Hover state stays as-is.

Replace this block:

```css
.stacked-block.is-selected {
  background-color: hsl(var(--muted));
  border-left: 4px solid #F5741A;
  padding-left: 12px;
}
```

With this:

```css
.stacked-block.is-selected {
  border-left: 4px solid #F5741A;
  padding-left: 12px;
}
```

Do NOT add any new CSS rules for `.block-style-wrapper`. It carries its styling inline from the React component. The className exists only as a future hook.

---

## What NOT to change

- Do NOT add or modify any backend migrations.
- Do NOT touch any of the 9 block form files (`TextBlockForm`, `HeadingBlockForm`, `DividerBlockForm`, `ImageBlockForm`, `VideoEmbedBlockForm`, `QuoteBlockForm`, `ListBlockForm`, `CalloutBlockForm`, `EmbedAudioBlockForm`). The Style section is rendered by `BlockEditorPane` only — the forms continue to manage only their type-specific config fields.
- Do NOT add per-block override of heading text color, link color, callout variant stripe color, list marker color in this prompt. Those are platform-locked. (List marker color is already configurable via `BrandColorSwatch` in `ListBlockForm` — that shipped in 6a-stacked-fix v2 and is the only existing per-block color override. Do not extend the pattern in this prompt.)
- Do NOT touch `StackedLessonEditor.tsx`. The `SortableStackBlock`'s editor-chrome padding (`px-4 py-4`) is intentional breathing room for the hover toolbar — leave it alone. Author-set padding sits inside the BlockRenderer wrapper, not on the stacked-block container.
- Do NOT touch `EditorSlidePane.tsx`, `LessonBlocksEditor.tsx`, or any draft/save logic. The new fields ride through `config` automatically.
- Do NOT add any horizontal padding option. v1 is vertical-only.
- Do NOT add a "border" option, "corner radius" option, "shadow" option, or "margin" option. v1 is exactly background + padding.
- Do NOT alter `BRAND_SWATCH_COLORS` order or contents. Only ADD the new `BRAND_TINT_COLORS` array.

---

## Acceptance criteria (15)

1. The "Style" section appears at the bottom of the slide-in edit pane for every one of the 9 block types (text, heading, divider, image, video_embed, quote, list, callout, embed_audio). It's separated from the type-specific form above by a top border and small label "Style" in Navy `#021F36`.

2. The background color picker shows 8 tinted swatches in the locked order (Navy tint, Orange tint, Sand tint, Teal tint, Mustard tint, Slate tint, Purple tint, Forest tint) plus a "Default" pill to the left.

3. Tooltip on each tint swatch shows the label (e.g. "Navy tint"). Tooltip via `title` attribute is fine.

4. Clicking a tint swatch updates `config.background_color` to the tinted hex and immediately applies the background to the block's rendered preview in the stacked editor.

5. Clicking "Default" updates `config.background_color` to `null` and removes the background from the block's rendered preview.

6. The padding dropdown has exactly 4 options: None, Small, Medium, Large. Labels capitalized.

7. Selecting a padding option updates `config.padding` to the lowercase string (`"none"`, `"small"`, `"medium"`, `"large"`) and immediately applies the corresponding vertical padding (0 / 12 / 24 / 48 px top and bottom) to the block's rendered preview in the stacked editor.

8. Newly added blocks (via the "+ Add block" inline button) default to `background_color: null` and `padding: "none"`. Verify by adding a block and inspecting its config in DevTools — the fields should be present with these defaults.

9. The Style section IS visible in the Divider block form, but applying any background or padding to a Divider has NO visible effect on the divider's rendered preview (the 3px line renders unchanged). The fields still round-trip through save (verify in DB after a save). This is intentional — divider is a no-op for these style fields.

10. A block with a tinted background renders with rounded corners (`borderRadius: 8`) and horizontal padding (`paddingLeft: 16, paddingRight: 16`). A block with no background renders edge-to-edge with no horizontal padding or corner radius added by the wrapper.

11. When a block is selected (clicked, opening the slide-in pane), the orange `border-left: 4px solid #F5741A` selection indicator is visible BUT the previous muted-grey background of `.stacked-block.is-selected` is GONE. Author-set tints remain fully visible during selection.

12. When a block is hovered (not selected), the muted hover bg of `.stacked-block:hover` still shows on un-tinted blocks. On tinted blocks the hover effect is barely visible because the inner tinted wrapper covers most of the block area — that's expected.

13. Background color and padding round-trip through the autosave draft cycle. Edit a block to apply Forest tint and Medium padding, wait 4 seconds (debounce + buffer), reload the page, choose "Continue editing" if the draft-resume banner appears, confirm the block still shows Forest tint and Medium padding.

14. Background color and padding round-trip through Save. After saving, query Supabase: `SELECT config FROM lesson_blocks WHERE content_item_id = '32e0e966-4cb8-4e8b-abf8-5617de346f59' AND archived_at IS NULL ORDER BY display_order;` — confirm `background_color` and `padding` are present in each block's config.

15. The Duplicate action on a block with a tint and padding produces a new block with the identical background_color and padding values in its config.

---

## Test plan after Lovable build lands

1. Hard-reload the editor page for content_item `32e0e966-4cb8-4e8b-abf8-5617de346f59` (10 existing blocks covering 9 block types).
2. Open each block one at a time, confirm the Style section is visible at the bottom of the pane (AC #1).
3. On a text block: apply Forest tint background + Medium padding. Confirm the preview updates immediately (ACs #4, #7, #10).
4. On a divider block: apply Navy tint background + Large padding. Confirm the divider line renders unchanged (AC #9).
5. Add a new heading block via "+ Add". Open it in the pane. Confirm Style section shows Default selected and None selected (AC #8).
6. Click on a tinted block to select it. Confirm orange left border shows but no muted-grey background appears over the tint (AC #11).
7. Hover an un-tinted text block. Confirm the muted hover bg still appears (AC #12).
8. Set a tint on a callout, wait 5 seconds, reload page, dismiss any draft banner with "Continue editing". Confirm tint persisted from draft (AC #13).
9. Save the lesson with a reason. Query Supabase per AC #14 SQL. Confirm config fields present on all 10 blocks.
10. Duplicate a tinted+padded block. Confirm duplicate has identical style config (AC #15).

If all 10 test steps pass, 6a-style is verified. Move to 6a-manage scoping.

---

## Backend verification (post-Lovable build, before claiming done)

Run this against the production Supabase project (`svprhtzawnbzmumxnhsq`) after a save during testing:

```sql
SELECT
  display_order,
  block_type,
  config->>'background_color' AS bg,
  config->>'padding'           AS padding
FROM lesson_blocks
WHERE content_item_id = '32e0e966-4cb8-4e8b-abf8-5617de346f59'
  AND archived_at IS NULL
ORDER BY display_order;
```

Expected: 10 rows with `bg` and `padding` populated according to what the author set during testing. Any NULL `padding` indicates a default-config bug in `blockTypeMeta.ts`. NULL `bg` is correct for un-tinted blocks.

---

## Standing-rule confirmations (from Session 60)

- Rule 10 (brand-only color enforcement): satisfied. All color picks go through `BrandColorSwatch`; no hex input added.
- Rule 12 (typography baseline 17px / 1.65): unaffected. We don't touch `.tiptap-prose`.
- Rule 18 (8-color palette locked, no black/white): satisfied. The new tinted palette has 8 corresponding tints in the same order; no black, no white.
- Rule 19 (position:fixed for viewport-tracking): not applicable here — we're not adding any viewport-tracking UI.
- Rule 20 (animate `left` not transform): not applicable.

No backend rules apply (8, 9, etc.) — zero backend changes in this prompt.

---

End of 6a-style prompt.
