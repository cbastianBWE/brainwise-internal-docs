# Prompt 6b.4 — Fix pills/underline tabs not centering

## Context

6b.3 shipped tabs CSS overrides via `.bw-tabs-list-pills` and `.bw-tabs-list-underline` classes. Diagnosis: shadcn-ui's `TabsList` component applies its own default Tailwind classes via `cn()` (`inline-flex h-10 items-center justify-center rounded-md bg-muted p-1`). These Tailwind utilities override my custom CSS classes due to specificity, so:

- The TabsList container still shows shadcn's `bg-muted` gray background, making all tabs look "joined" into one pill bar
- The `h-10 rounded-md p-1` defaults keep the joined-pill appearance
- The centering wrapper `<div className="bw-tabs-list-wrapper">` IS correct, but its child TabsList is rendering at full width because shadcn defaults conflict

The fix is canonical shadcn-override pattern: pass Tailwind utility classes directly on `className` so `cn()` merges them as overrides instead of fighting them with custom CSS.

## Files to MODIFY

### 1. `src/components/super-admin/lesson-blocks/BlockRenderer.tsx`

Replace the `TabsRender` function (currently around line 360) with this version that uses inline Tailwind overrides instead of custom CSS classes:

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

  return (
    <Tabs defaultValue={defaultValue} className="w-full">
      <div className="flex justify-center mb-4">
        <TabsList
          className={
            style === "pills"
              ? "inline-flex h-auto flex-wrap gap-2 bg-transparent p-0 rounded-none"
              : "inline-flex h-auto flex-wrap gap-2 bg-transparent p-0 rounded-none border-b-0"
          }
        >
          {tabs.map((t) => (
            <TabsTrigger
              key={t.client_id}
              value={t.client_id}
              className={
                style === "pills"
                  ? "rounded-full bg-muted text-muted-foreground hover:bg-muted/70 hover:text-[#021F36] data-[state=active]:bg-[#F5741A] data-[state=active]:text-white data-[state=active]:shadow-none font-medium px-4 py-2 transition-colors"
                  : "rounded-none bg-transparent border-b-2 border-border text-muted-foreground hover:text-[#021F36] hover:border-muted-foreground data-[state=active]:text-[#021F36] data-[state=active]:border-[#F5741A] data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold font-medium px-4 py-2 transition-colors"
              }
            >
              {t.label || "(untitled)"}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.client_id} value={t.client_id} className="pt-2">
          <div className="tiptap-prose prose-base max-w-none">
            <ReadOnlyTipTap json={t.body} />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
```

Key changes vs current version:
- Outer wrapper uses plain Tailwind `flex justify-center mb-4` (no custom CSS class — avoids specificity fight)
- `TabsList` className passes Tailwind utilities that override shadcn defaults:
  - `bg-transparent` overrides `bg-muted`
  - `h-auto` overrides `h-10`
  - `p-0` overrides `p-1`
  - `rounded-none` overrides `rounded-md`
  - `flex-wrap gap-2` adds visible gaps between tabs
- `TabsTrigger` className builds the per-tab visual:
  - **Pills**: each tab gets `rounded-full bg-muted` background of its own (so the muted bg is on each tab pill, NOT on the container)
  - **Underline**: each tab gets its own `border-b-2 border-border` underline that goes orange when active
  - Both use `data-[state=active]:` selectors which Radix sets on the active TabsTrigger

### 2. `src/components/super-admin/lesson-blocks/lesson-blocks.css`

Remove (delete) the now-obsolete Tabs section that 6b.3 added. Specifically, delete this entire block (from line containing `/* Tabs — center the tab strip and give each tab its own discrete shape */` through the `.bw-tabs-trigger-pills[data-state="active"]` closing brace):

```css
/* Tabs — center the tab strip and give each tab its own discrete shape */
.bw-tabs-list-wrapper { ... }
.bw-tabs-list-underline,
.bw-tabs-list-pills { ... }
.bw-tabs-trigger-underline { ... }
.bw-tabs-trigger-underline:hover { ... }
.bw-tabs-trigger-underline[data-state="active"] { ... }
.bw-tabs-trigger-pills { ... }
.bw-tabs-trigger-pills:hover { ... }
.bw-tabs-trigger-pills[data-state="active"] { ... }
```

All replaced by inline Tailwind in BlockRenderer.tsx now. Keep all OTHER css rules unchanged (stat_callout, statement_a_b, accordion, button stack, button stack caption — all stay).

## Acceptance criteria

1. **Pills style**: each tab is a discrete rounded pill (`rounded-full`) with muted gray background. Gap of 0.5rem (gap-2) between pills. Active pill is orange (`#F5741A`) with white text. Tab strip horizontally centered above content.

2. **Underline style**: each tab has its own independent underline (`border-b-2`). Inactive underline is light border color, active underline is orange. No joined bottom border behind everything. Gap between tabs. Tab strip horizontally centered above content.

3. **Hover behavior**: pills hover lightens the bg (`bg-muted/70`). Underline hover darkens the border (`border-muted-foreground`).

4. **No regressions** on other block types or existing 9 block types.

## What this prompt does NOT do

- Does NOT modify AI infrastructure.
- Does NOT touch accordion, button_stack, statement_a_b, stat_callout — they're working.
- Does NOT change the tabs DATA shape — purely a visual fix on the render component.

## File checklist

Modified:
- `src/components/super-admin/lesson-blocks/BlockRenderer.tsx` (replaces TabsRender function)
- `src/components/super-admin/lesson-blocks/lesson-blocks.css` (deletes obsolete tabs section)

2 modifications, 0 creations.
