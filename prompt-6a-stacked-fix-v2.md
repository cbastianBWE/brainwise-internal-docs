# Prompt 6a-stacked-fix-v2 — Lead-toggle fix + palette expansion + bullet/number marker color pickers

Follow-up to 6a-stacked-fix. Three issues surfaced when testing the first fix:
1. Lead paragraph toggle button is visible in the toolbar but clicking it does nothing — TipTap's default TextStyle extension drops the unknown `fontSize` attribute on JSON serialize.
2. The 5-color brand swatch should expand to 8 colors (Cole confirmed palette).
3. List block needs bullet color + numbered marker color pickers using the expanded swatch.

No backend work needed — all frontend. No new files (we'll reuse `BrandColorSwatch.tsx` and update its `BRAND_SWATCH_COLORS` array).

---

## Branding additions (8-color brand palette — supersedes 5-color from v1)

The `BRAND_SWATCH_COLORS` array in `BrandColorSwatch.tsx` expands from 5 colors to 8. Order is locked:

```ts
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
```

These are existing locked brand colors used elsewhere in the platform (dashboard dimension colors, etc.) — adding them to the swatch is consistent.

**Sand `#F9F7F1` requires care:** it's very light, near the page background. When rendered as a 28×28 circle in the picker, it needs a visible border to be distinguishable. The existing `border-2 border-border` already on the swatch buttons handles this — the border is cream-400 (`#DCD7C8`) and Sand's hex sits visually inside that border. Verify by eye after build. If Sand is invisible, add a subtle inner ring via `box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08)` only when the color is `#F9F7F1`.

---

## Fix 1: Lead paragraph toggle (TextStyle.extend pattern)

**Problem:** `editor.chain().focus().setMark("textStyle", { fontSize: "lead" }).run()` calls succeed, but TipTap's default `TextStyle` extension has no `fontSize` attribute defined, so the attribute is silently dropped at serialize time. The mark doesn't appear in JSON output and the CSS `[data-font-size="lead"]` selector finds nothing to style.

**Fix:** Extend `TextStyle` with a `fontSize` attribute that parses/renders to `data-font-size` HTML attribute. Apply the extended version in BOTH `RichTextEditor.tsx` (editable) AND `BlockRenderer.tsx` (readonly).

### Step 1.1 — Create the extended TextStyle

**File: `src/components/super-admin/lesson-blocks/TextStyleWithFontSize.ts`** (new file)

```ts
import { TextStyle } from "@tiptap/extension-text-style";

/**
 * TextStyle extended with a fontSize attribute that serializes to
 * data-font-size HTML attribute. Used to support the "Lead paragraph"
 * toolbar toggle in RichTextEditor. The CSS rule in lesson-blocks.css
 * matches [data-font-size="lead"] to apply the styling.
 *
 * Why: TipTap's default TextStyle has no fontSize attr, so setMark calls
 * with { fontSize: "lead" } get silently dropped on serialize. Extending
 * the extension registers the attribute and wires the parse/render hooks.
 */
export const TextStyleWithFontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-font-size"),
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { "data-font-size": attributes.fontSize };
        },
      },
    };
  },
});
```

### Step 1.2 — Swap TextStyle import in RichTextEditor

**File: `src/components/super-admin/lesson-blocks/RichTextEditor.tsx`**

REPLACE:
```ts
import { TextStyle } from "@tiptap/extension-text-style";
```

WITH:
```ts
import { TextStyleWithFontSize } from "./TextStyleWithFontSize";
```

In the `extensions` array, REPLACE:
```ts
extensions: [
  StarterKit,
  TextStyle,
  Link.configure({ openOnClick: false }),
  Placeholder.configure({ placeholder: placeholder ?? "" }),
],
```

WITH:
```ts
extensions: [
  StarterKit,
  TextStyleWithFontSize,
  Link.configure({ openOnClick: false }),
  Placeholder.configure({ placeholder: placeholder ?? "" }),
],
```

### Step 1.3 — Swap TextStyle import in BlockRenderer

**File: `src/components/super-admin/lesson-blocks/BlockRenderer.tsx`**

REPLACE:
```ts
import { TextStyle } from "@tiptap/extension-text-style";
```

WITH:
```ts
import { TextStyleWithFontSize } from "./TextStyleWithFontSize";
```

In the `ReadOnlyTipTap` extensions array, REPLACE:
```ts
extensions: [StarterKit, TextStyle, Link.configure({ openOnClick: true })],
```

WITH:
```ts
extensions: [StarterKit, TextStyleWithFontSize, Link.configure({ openOnClick: true })],
```

### Step 1.4 — Verify the CSS selector matches

**File: `src/components/super-admin/lesson-blocks/lesson-blocks.css`**

The existing rule already targets `[data-font-size="lead"]` via the broader selector that includes both data-attribute and inline-style fallbacks. No change needed if that selector is in place. If for some reason the existing rule was simplified, ensure this rule exists in the file:

```css
.tiptap-prose [data-font-size="lead"] {
  font-size: 1.15rem;
  line-height: 1.6;
  font-weight: 500;
}
```

This selector matches `<span data-font-size="lead">...</span>` which is what `TextStyleWithFontSize.renderHTML` will output.

---

## Fix 2: Expand BrandColorSwatch palette to 8 colors

**File: `src/components/super-admin/lesson-blocks/BrandColorSwatch.tsx`**

REPLACE the entire `BRAND_SWATCH_COLORS` constant:

```ts
export const BRAND_SWATCH_COLORS: BrandSwatchColor[] = [
  { label: "Navy", hex: "#021F36" },
  { label: "Orange", hex: "#F5741A" },
  { label: "Teal", hex: "#006D77" },
  { label: "Forest", hex: "#2D6A4F" },
  { label: "Slate", hex: "#6D6875" },
];
```

WITH:

```ts
export const BRAND_SWATCH_COLORS: BrandSwatchColor[] = [
  { label: "Navy", hex: "#021F36" },
  { label: "Orange", hex: "#F5741A" },
  { label: "Sand", hex: "#F9F7F1" },
  { label: "Teal", hex: "#006D77" },
  { label: "Mustard", hex: "#7a5800" },
  { label: "Slate", hex: "#6D6875" },
  { label: "Purple", hex: "#3C096C" },
  { label: "Forest", hex: "#2D6A4F" },
];
```

That's the only change in `BrandColorSwatch.tsx`. All existing usages (Divider color picker) automatically inherit the new palette.

---

## Fix 3: Bullet color + numbered marker color pickers on List block

The List block currently has no per-block color override — bullets render forest green and numbered markers render orange via the global CSS rules. We're adding optional overrides per block: if the author picks a color, that override applies via inline style on the block container; if not, the global default holds.

### Step 3.1 — Extend ListBlockForm

**File: `src/components/super-admin/lesson-blocks/block-forms/ListBlockForm.tsx`**

First check the current file structure to find the existing form. It should be receiving `value` and `onConfigChange` props following the same pattern as DividerBlockForm. Find the bottom of the form's main JSX (after the existing items list + add-item controls + ordered/unordered toggle).

ADD a section for marker color, positioned BELOW the ordered/unordered toggle and ABOVE any closing wrapper:

```tsx
<div className="space-y-2 pt-2 border-t">
  <Label>
    {value?.ordered ? "Numbered marker color" : "Bullet color"}
  </Label>
  <BrandColorSwatch
    value={value?.marker_color ?? (value?.ordered ? "#F5741A" : "#2D6A4F")}
    onChange={(hex) => onConfigChange({ ...value, marker_color: hex })}
    allowDefault
    defaultLabel="Default"
    onDefaultSelected={() => onConfigChange({ ...value, marker_color: null })}
  />
  <p className="text-xs text-muted-foreground">
    {value?.ordered
      ? "Choose a color for the numbered circles. Defaults to Orange."
      : "Choose a color for the bullets. Defaults to Forest."}
  </p>
</div>
```

Add the imports at the top of the file if not already present:
```ts
import { BrandColorSwatch } from "../BrandColorSwatch";
import { Label } from "@/components/ui/label";
```

### Step 3.2 — BlockRenderer: apply per-block marker color override

**File: `src/components/super-admin/lesson-blocks/BlockRenderer.tsx`**

The `ListRender` function currently renders the list without any color override. Extend it to accept and apply a `markerColor`:

REPLACE:
```tsx
function ListRender({ items, ordered }: { items: any[]; ordered: boolean }) {
  const ListTag = (ordered ? "ol" : "ul") as "ol" | "ul";
  return (
    <div className="tiptap-prose prose-base max-w-none">
      <ListTag>
        {(items ?? []).map((it, idx) => (
          <li key={it.client_id ?? idx}>
            <ReadOnlyTipTap json={it.body} />
          </li>
        ))}
      </ListTag>
    </div>
  );
}
```

WITH:
```tsx
function ListRender({
  items,
  ordered,
  markerColor,
}: {
  items: any[];
  ordered: boolean;
  markerColor?: string | null;
}) {
  const ListTag = (ordered ? "ol" : "ul") as "ol" | "ul";
  // Pass the marker color via a CSS custom property so the ::before pseudo-element
  // in lesson-blocks.css can pick it up via var(--list-marker-color, <fallback>).
  const styleVars = markerColor
    ? ({ "--list-marker-color": markerColor } as React.CSSProperties)
    : undefined;
  return (
    <div className="tiptap-prose prose-base max-w-none" style={styleVars}>
      <ListTag>
        {(items ?? []).map((it, idx) => (
          <li key={it.client_id ?? idx}>
            <ReadOnlyTipTap json={it.body} />
          </li>
        ))}
      </ListTag>
    </div>
  );
}
```

In the `BlockRenderer` switch, update the list case:

REPLACE:
```tsx
case "list":
  return <ListRender items={cfg.items ?? []} ordered={!!cfg.ordered} />;
```

WITH:
```tsx
case "list":
  return (
    <ListRender
      items={cfg.items ?? []}
      ordered={!!cfg.ordered}
      markerColor={cfg.marker_color ?? null}
    />
  );
```

### Step 3.3 — Update lesson-blocks.css to use the custom property

**File: `src/components/super-admin/lesson-blocks/lesson-blocks.css`**

The existing bullet and numbered marker rules hardcode the colors. Update them to read from `--list-marker-color` with the brand default as fallback.

REPLACE the existing `.tiptap-prose ul li::before` rule:
```css
.tiptap-prose ul li::before {
  content: "";
  display: inline-block;
  width: 0.65em;
  height: 0.65em;
  border-radius: 50%;
  background: #2D6A4F;
  position: absolute;
  left: -1.25em;
  top: 0.55em;
}
```

WITH:
```css
.tiptap-prose ul li::before {
  content: "";
  display: inline-block;
  width: 0.65em;
  height: 0.65em;
  border-radius: 50%;
  background: var(--list-marker-color, #2D6A4F);
  position: absolute;
  left: -1.25em;
  top: 0.55em;
}
```

REPLACE the existing `.tiptap-prose ol li::before` rule:
```css
.tiptap-prose ol li::before {
  content: counter(item);
  position: absolute;
  left: -1.85em;
  top: 0.1em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  background: #F5741A;
  color: #FFFFFF;
  font-size: 0.85em;
  font-weight: 700;
  font-family: var(--font-display, "Poppins", sans-serif);
}
```

WITH:
```css
.tiptap-prose ol li::before {
  content: counter(item);
  position: absolute;
  left: -1.85em;
  top: 0.1em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  background: var(--list-marker-color, #F5741A);
  color: #FFFFFF;
  font-size: 0.85em;
  font-weight: 700;
  font-family: var(--font-display, "Poppins", sans-serif);
}
```

Single-attribute change on each: `background: #2D6A4F` → `background: var(--list-marker-color, #2D6A4F)` for bullets; `background: #F5741A` → `background: var(--list-marker-color, #F5741A)` for numbered.

---

## Acceptance criteria

1. Lead paragraph button in the RichTextEditor toolbar toggles a 1.15rem larger text size on the selected paragraph (visible in both the editor pane and the stack preview)
2. Toggling Lead off restores the paragraph to the normal 17px body size
3. The Lead state persists through Save → Reload (the `fontSize: "lead"` mark survives the round-trip via the `data-font-size` HTML attribute)
4. The brand color swatch now shows 8 circles in this order: Navy / Orange / Sand / Teal / Mustard / Slate / Purple / Forest
5. The Sand swatch (`#F9F7F1`) is visually distinguishable in the picker — has a visible border or inner ring against the page background
6. Divider color picker (existing from v1) now shows all 8 colors
7. List block form now shows a "Bullet color" or "Numbered marker color" picker (label changes based on the ordered toggle) below the bullet/numbered toggle
8. The marker color picker has all 8 brand colors + a "Default" option that returns to platform defaults
9. Changing the bullet color updates the live preview in the stack immediately (forest green disc renders in the chosen color)
10. Changing the numbered color updates the orange circle in the stack to the chosen color while keeping the inner numeral white
11. Default behavior unchanged: unordered list with no `marker_color` config still renders forest green; ordered list with no `marker_color` config still renders orange
12. The marker_color persists through Save → Reload
13. No regressions to existing 6a-stacked-fix functionality (Save button in pane, Save and leave, draft resume banner, undo toast bottom-right, etc.)

## Non-goals (still deferred)

- Per-block override of heading color, link color, callout variant color, body text color — these remain platform-locked per the Session 60 decision (Option A locked, color-everywhere recommendation logged in build queue for post-launch revisit)
- Block background color + padding — that's 6a-style, separate prompt
- Multi-select + Manage Blocks panel — 6a-manage
- AI authoring — 6a-AI

