# Prompt 6b.3 — Tabs visual polish + button_stack caption field

## Context

After 6b.1 and 6b.2 both shipped Session 64, two follow-up improvements needed:

1. **Tabs visual styling**: currently pills look joined (continuous bg) and underlines look joined (continuous bottom border). The trainee should see clearly **separated** tabs in both styles — each "pill" its own discrete rounded pill with visible gaps, each underlined tab independently underlined with visible gaps. Tabs container centered horizontally. This is a competitive differentiator (Rise has joined-tabs that look like a single navbar — we want each tab to look like a discrete clickable item).

2. **button_stack caption**: backend schema now accepts an optional `caption` string field for instructional subtitle text (e.g. "Click 'Continue' when you've completed the reflection"). Frontend form needs a caption input field, and renderer needs to display the caption below the buttons.

## Standing rules (must hold)

1. **Universal Style section is inherited** — `BlockStyleSection` already mounts in `BlockEditorPane`. Do not add a Style section to the ButtonStackBlockForm.
2. **No new dependencies**.
3. **defaultConfig backward compatibility**: existing button_stack blocks in the DB don't have a `caption` field. The form and renderer must handle `cfg.caption === undefined` AND `cfg.caption === null` AND `cfg.caption === ""` all as "no caption shown".

## Files to MODIFY

### 1. `src/components/super-admin/lesson-blocks/blockTypeMeta.ts`

In the `button_stack` entry's `defaultConfig`, add `caption: null` to the returned object. Place it after the `layout: "stacked"` line, before `background_color: null`. The button_stack defaultConfig should now look like:

```ts
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
    caption: null,
    background_color: null,
    padding: "none",
  }),
},
```

### 2. `src/components/super-admin/lesson-blocks/block-forms/ButtonStackBlockForm.tsx`

Three changes:

**A. Extend `Props.value` type** to include `caption`:

```ts
interface Props {
  value: {
    buttons: ButtonEntry[];
    layout: Layout;
    caption?: string | null;
  };
  onConfigChange: (next: Props["value"]) => void;
  siblingBlocks: EditorBlock[];
}
```

**B. Import Textarea** at the top of the file (alongside existing imports):

```tsx
import { Textarea } from "@/components/ui/textarea";
```

**C. Add a Caption section** in the form body, AFTER the Buttons section's closing `</div>` (the one that holds the DndContext + Add button + max-4 message) and BEFORE the outermost form `</div>`:

```tsx
<div className="space-y-2 pt-2">
  <Label>Caption (optional)</Label>
  <Textarea
    value={value.caption ?? ""}
    onChange={(e) =>
      onConfigChange({
        ...value,
        caption: e.target.value.length > 0 ? e.target.value : null,
      })
    }
    placeholder="Optional instructional text shown below the buttons (e.g. 'Click Continue when you've completed the reflection')"
    rows={2}
    maxLength={240}
  />
  <p className="text-xs text-muted-foreground">
    Helpful when buttons need context — explain what action the trainee should take, or what each button does.
  </p>
</div>
```

### 3. `src/components/super-admin/lesson-blocks/BlockRenderer.tsx`

Two changes:

**A. Update `ButtonStackRender` Props type** to accept `caption`:

```tsx
function ButtonStackRender({
  buttons,
  layout,
  caption,
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
  caption: string | null;
}) {
```

**B. Render the caption below the buttons**. At the bottom of `ButtonStackRender`, change the existing `return <div className={wrapperClass}>...</div>` to wrap the buttons div + a conditional caption paragraph in a fragment:

```tsx
  return (
    <>
      <div className={wrapperClass}>
        {/* existing button mapping unchanged */}
        {buttons.map((b) => {
          /* existing logic unchanged */
        })}
      </div>
      {caption && caption.trim().length > 0 && (
        <p className="bw-button-stack-caption">{caption}</p>
      )}
    </>
  );
```

**C. Update the renderInner() switch case for `button_stack`** to pass caption:

```tsx
case "button_stack":
  return <ButtonStackRender buttons={cfg.buttons ?? []} layout={cfg.layout ?? "stacked"} caption={cfg.caption ?? null} />;
```

### 4. `src/components/super-admin/lesson-blocks/lesson-blocks.css`

**A. Replace the existing Tabs section** (lines starting with `/* Tabs */` through the `.bw-tabs-trigger-underline[data-state="active"]` rule) with this new separated-tabs styling:

```css
/* Tabs — center the tab strip and give each tab its own discrete shape */
.bw-tabs-list-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}
.bw-tabs-list-underline,
.bw-tabs-list-pills {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  background: transparent;
  padding: 0;
  height: auto;
  width: auto;
  justify-content: center;
}
/* Underline style — each tab independently underlined with a gap between */
.bw-tabs-trigger-underline {
  background: transparent;
  border: none;
  border-bottom: 2px solid hsl(var(--border));
  border-radius: 0;
  padding: 0.5rem 1rem;
  font-weight: 500;
  color: #6D6875;
  transition: color 150ms ease, border-color 150ms ease;
}
.bw-tabs-trigger-underline:hover {
  color: #021F36;
  border-bottom-color: #6D6875;
}
.bw-tabs-trigger-underline[data-state="active"] {
  color: #021F36;
  border-bottom-color: #F5741A;
  font-weight: 600;
}
/* Pills style — each tab is its own rounded pill with a gap between */
.bw-tabs-trigger-pills {
  background: hsl(var(--muted));
  border: 1px solid transparent;
  border-radius: 9999px;
  padding: 0.5rem 1.125rem;
  font-weight: 500;
  color: #6D6875;
  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
}
.bw-tabs-trigger-pills:hover {
  background: hsl(var(--muted) / 0.7);
  color: #021F36;
}
.bw-tabs-trigger-pills[data-state="active"] {
  background: #F5741A;
  color: #FFFFFF;
  font-weight: 600;
  border-color: #F5741A;
}
```

**B. Append new rule for button_stack caption** at the bottom of the file:

```css
/* Button stack — instructional caption below buttons */
.bw-button-stack-caption {
  margin-top: 0.75rem;
  font-size: 0.9375rem;
  color: #6D6875;
  text-align: center;
  line-height: 1.45;
  max-width: 36rem;
  margin-left: auto;
  margin-right: auto;
}
```

### 5. `src/components/super-admin/lesson-blocks/BlockRenderer.tsx` — TabsRender update

The TabsRender component (also in BlockRenderer.tsx) needs updates to wrap TabsList in the new centering wrapper and use the new className conventions. Replace the existing TabsRender with:

```tsx
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
  const listClass = style === "pills" ? "bw-tabs-list-pills" : "bw-tabs-list-underline";
  const triggerClass = style === "pills" ? "bw-tabs-trigger-pills" : "bw-tabs-trigger-underline";

  return (
    <Tabs defaultValue={defaultValue} className="w-full">
      <div className="bw-tabs-list-wrapper">
        <TabsList className={listClass}>
          {tabs.map((t) => (
            <TabsTrigger
              key={t.client_id}
              value={t.client_id}
              className={triggerClass}
            >
              {t.label || "(untitled)"}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
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
```

This wraps TabsList in a `.bw-tabs-list-wrapper` div that flex-centers it horizontally, and assigns per-style className to both the list (`bw-tabs-list-underline` or `bw-tabs-list-pills`) and the trigger (`bw-tabs-trigger-underline` or `bw-tabs-trigger-pills`) so the CSS rules from #4 above can target them cleanly without fighting shadcn defaults.

## Acceptance criteria

1. **Tabs underline style**: each tab independently underlined with a visible gap between tabs. Tab strip horizontally centered above content. Active tab's underline is orange (`#F5741A`), 2px thick. Inactive tabs have light-gray underline. Hover deepens the inactive underline to muted-gray.

2. **Tabs pills style**: each tab is its own discrete rounded pill with a visible gap (0.5rem) between pills. Tab strip horizontally centered. Active pill has orange background (`#F5741A`) and white text. Inactive pills have muted background with gray text. Hover lightens the muted bg.

3. **button_stack caption form**: optional Textarea field labeled "Caption (optional)" appears below the Buttons section. Empty input saves as `null` in config; non-empty saves as string. Max 240 chars.

4. **button_stack caption render**: when caption is non-empty, it renders below the buttons as centered gray text. When caption is null or empty, nothing renders (no empty paragraph).

5. **Existing button_stack blocks**: still render without errors. `cfg.caption === undefined` is treated identically to `cfg.caption === null` (no caption shown).

6. **defaultConfig**: new button_stack blocks added via Add Block popover start with `caption: null`.

7. **No regressions** on any other block type.

## What this prompt does NOT do

- Does NOT add gate-button action_type (deferred to Phase 5 when trainee progression tracking is built).
- Does NOT modify any AI authoring infrastructure (backend already accepts `caption` field as of Edge Function v5/v5/v6).
- Does NOT modify accordion, stat_callout, statement_a_b, or other block types.

## File checklist

Modified:
- `src/components/super-admin/lesson-blocks/blockTypeMeta.ts` (adds `caption: null` to button_stack defaultConfig)
- `src/components/super-admin/lesson-blocks/block-forms/ButtonStackBlockForm.tsx` (adds caption Textarea section)
- `src/components/super-admin/lesson-blocks/BlockRenderer.tsx` (TabsRender + ButtonStackRender both updated)
- `src/components/super-admin/lesson-blocks/lesson-blocks.css` (replaces Tabs section, adds button_stack caption rule)

4 modifications, 0 creations.
