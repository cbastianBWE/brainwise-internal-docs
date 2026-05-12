# Prompt 6a-stacked-fix-v3.2 — Pane uses position: fixed (sticky approach abandoned after two failed attempts)

v3 and v3.1 both tried to use `position: sticky` to track scroll. Neither engaged correctly — the pane stays anchored to the page top and scrolls away with everything else. The combination of (a) the AppLayout's `<main>` having `overflow-auto` AND (b) the flex layout from v3 AND (c) the transform animation on the pane creates a sticky context that simply doesn't work reliably in this codebase.

**Decision: stop trying to make sticky work, switch to `position: fixed`.** This is what production editors (Notion, Linear) actually use. Pane attaches to viewport coordinates directly. No ancestor context to detect. Simpler primitive, more reliable.

The risk we avoided in v1 (pane covering global AppLayout sidebar) is handled by computing the pane's `left` offset from the AppLayout's `--sidebar-width` CSS variable — that variable is set by `SidebarProvider` (currently `16rem` expanded, `3rem` icon-collapsed, `0` offcanvas-closed) and responds correctly to sidebar state changes.

Single file touched: `EditorSlidePane.tsx`. Also reverts the v3 layout restructure in `LessonBlocksEditor.tsx` back to the v2 overlay layout, since fixed-positioning makes the flex sibling approach unnecessary.

---

## Reference: AppLayout dimensions (confirmed from codebase)

- AppLayout header: `height: 56px` (set inline as `height: 56` in `AppLayout.tsx`)
- Sidebar expanded width: `--sidebar-width: 16rem` (256px) — set on the `SidebarProvider` wrapper
- Sidebar icon-collapsed width: `--sidebar-width-icon: 3rem` (48px)
- Sidebar offcanvas-closed width: `0` (sidebar slides out via negative left offset)
- `<main>` element: `flex-1 overflow-auto p-6` — takes remaining horizontal space after sidebar

These are the dimensions the pane needs to anchor against.

---

## Change 1: `src/components/super-admin/lesson-blocks/EditorSlidePane.tsx`

REPLACE the entire `<aside>` element (currently the outermost element) WITH:

```tsx
<aside
  className={cn(
    "editor-slide-pane fixed z-20 flex flex-col border-r bg-background shadow-md transition-transform duration-300 ease-out",
    open ? "translate-x-0" : "-translate-x-full pointer-events-none",
  )}
  style={{
    top: 56,                                          // AppLayout header height
    left: "var(--sidebar-width, 0px)",                // Anchor to right edge of global sidebar
    bottom: 0,                                        // Stretch to viewport bottom
    width: "min(480px, calc(100vw - var(--sidebar-width, 0px)))",
  }}
  aria-hidden={!open}
>
```

Add the `cn` import at the top of the file if not already present:
```ts
import { cn } from "@/lib/utils";
```

### Why this works

- `position: fixed` anchors to viewport. No scroll-context detection. Pane stays put as the user scrolls; the page main scrolls underneath.
- `top: 56` — sits exactly below the AppLayout's header bar (56px tall).
- `left: var(--sidebar-width, 0px)` — sits flush against the right edge of the global sidebar. The `--sidebar-width` CSS variable is set on `SidebarProvider`'s wrapper element (in `src/components/ui/sidebar.tsx`) and cascades down to all descendants. The fallback `0px` handles cases where the variable isn't set.
- `bottom: 0` — stretches the pane all the way to the viewport bottom. Internal scrolling on the body (`flex-1 overflow-y-auto` inside the pane) handles overflow when the form content is taller than the available height.
- `width: min(480px, calc(100vw - var(--sidebar-width, 0px)))` — pane is 480px wide on desktop, but on narrow viewports it shrinks to fit the available space without overflowing.
- The `transition-transform` + `translate-x-0` / `-translate-x-full` slide-in animation is preserved. Transform on a `fixed`-positioned element does not break anything (unlike with `sticky`).

The pane is no longer inside any flex/relative context — it's a viewport-anchored overlay. The stack can render at full width below it; the pane lives entirely in its own positioning layer.

---

## Change 2: `src/pages/super-admin/LessonBlocksEditor.tsx` — revert v3's flex restructure

The v3 prompt restructured the body wrapper from `<div className="relative">` to a flex sidebar layout. With `position: fixed` on the pane, the flex sibling approach is no longer needed. We revert to the v2 overlay layout where the stack uses `md:ml-[480px]` to leave room for the fixed pane.

REPLACE the entire Body section currently in the file (the `<div className="flex flex-col md:flex-row md:items-start md:gap-0">` wrapper) WITH:

```tsx
{/* Body — stack gets left-margin to leave room for the fixed-positioned pane */}
<div className="relative">
  <EditorSlidePane
    open={paneOpen && !!selectedBlock}
    block={selectedBlock}
    contentItemId={contentItemId!}
    onChange={updateBlock}
    onClose={() => {
      setPaneOpen(false);
      setSelectedClientId(null);
    }}
    isDirty={isDirty}
    saving={saving}
    onRequestSave={() => setSaveDialogOpen(true)}
  />

  <div
    className={cn(
      "transition-all duration-300 ease-out",
      paneOpen && !!selectedBlock ? "md:ml-[480px]" : "ml-0",
    )}
  >
    {blocks.length === 0 ? (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center gap-3 p-8">
            <div className="text-sm text-muted-foreground">No blocks yet</div>
            <Popover>
              <PopoverTrigger asChild>
                <Button>
                  <Plus className="mr-1 h-4 w-4" />
                  Add your first block
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="center">
                <AddBlockPopover onSelect={(bt) => handleInsert(0, bt)} />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>
      </div>
    ) : (
      <div className="mx-auto max-w-3xl">
        <StackedLessonEditor
          blocks={blocks}
          selectedClientId={selectedClientId}
          assetUrlMap={assetUrlMap}
          onSelectBlock={handleSelectBlock}
          onReorder={handleReorder}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onInsert={handleInsert}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
        />
      </div>
    )}
  </div>
</div>
```

This is the same structure that was in place after v2 — overlay positioning model with the stack reflowing right via `md:ml-[480px]` when the pane is open.

---

## Acceptance criteria

1. Open any block at the top of the stack → pane appears below the AppLayout header, against the right edge of the global sidebar
2. Open any block deep in the stack (scroll down first) → pane STILL appears in the same fixed position (top: 56px from viewport top, left: against sidebar right edge). Pane does NOT appear at the location of the selected block.
3. Scroll the stack content while the pane is open → pane stays put, stack content scrolls underneath
4. Scroll back to the top → pane stays put (it's viewport-anchored, not page-anchored)
5. The pane's Save button is always reachable while the pane is open
6. The global AppLayout sidebar (Cole Bastian / Navigation / Assessment etc.) remains visible at all scroll positions — pane never covers it
7. Toggle the AppLayout sidebar (via the hamburger menu / `Cmd+B`) → pane's left edge slides with the sidebar's right edge (because both reference `--sidebar-width`)
8. Close the pane via X or Esc → pane slides off-screen left; stack reclaims full width via the `md:ml-[480px]` reflow logic
9. Mobile viewport (< 768px / `md` breakpoint) → pane takes full available width (`min(480px, 100vw - sidebar-width)`); stack does NOT get `md:ml-[480px]` margin since `md:` prefix doesn't apply on mobile
10. No regressions to v1, v2 functionality: Lead toggle, 8-color swatch, bullet/numbered marker pickers, in-pane Save, Save-and-leave dialog, undo toast bottom-right, draft resume banner, drag-and-drop, move up/down, duplicate, delete, asset rendering

## Non-goals

- Block background color + padding — 6a-style
- Multi-select + Manage Blocks panel — 6a-manage
- AI authoring — 6a-AI
- Color-everywhere expansion — deferred per build queue

## Notes on prior attempts

- v3 attempted `position: sticky` with a flex layout restructure. Sticky never engaged because the pane had a `transform` on it which created a new containing block context that breaks sticky.
- v3.1 attempted to fix v3 by separating sticky (outer wrapper) from transform (inner aside). Also failed — likely because the `<main>` element's `overflow-auto` combined with the nested flex containers creates a scroll-context detection edge case that sticky doesn't handle reliably in this codebase.
- v3.2 (this prompt) abandons sticky entirely and uses `position: fixed` with explicit pixel offsets keyed off the AppLayout's known dimensions (header 56px, sidebar via `--sidebar-width` CSS variable). This is the approach used by production editors like Notion and Linear and sidesteps all the sticky-context gotchas.
