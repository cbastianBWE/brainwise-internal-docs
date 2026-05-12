# Prompt 6a-stacked-fix-v3.3 — Pane closed-state must not visually cover the global sidebar

v3.2 landed correctly for the open state (pane at `top: 56px, left: var(--sidebar-width)`, scrolls correctly as fixed-positioned element). One residual visual issue: when the pane is in its CLOSED state, it's slide-translated `-translate-x-full` (left by 100% of its own width = 480px). Since its `left` is at the sidebar's right edge and its width is 480px while the sidebar is 256px (`16rem`), the closed pane's visual position ends up OVER the sidebar instead of fully off-screen.

**Fix:** Drop the transform-based slide animation. Animate `left` directly instead. Closed = `left: -480px` (fully off-screen left, past the viewport edge entirely). Open = `left: var(--sidebar-width)`. Transition on the `left` property animates the slide-in smoothly.

Single file touched: `EditorSlidePane.tsx`.

---

## The change

**File: `src/components/super-admin/lesson-blocks/EditorSlidePane.tsx`**

REPLACE the entire `<aside>` element (currently uses transform-based animation) WITH:

```tsx
<aside
  className={cn(
    "editor-slide-pane fixed z-20 flex flex-col border-r bg-background shadow-md transition-[left] duration-300 ease-out",
    !open && "pointer-events-none",
  )}
  style={{
    top: 56,
    left: open ? "var(--sidebar-width, 0px)" : "-480px",
    bottom: 0,
    width: "min(480px, calc(100vw - var(--sidebar-width, 0px)))",
  }}
  aria-hidden={!open}
>
```

### Differences from v3.2

- Removed `translate-x-0` / `-translate-x-full` classes (no transform now)
- Removed `transition-transform` class
- Added `transition-[left]` class (animates the `left` property)
- `left` is now conditional in the inline style: `var(--sidebar-width)` when open, `-480px` when closed
- `pointer-events-none` is now applied via `cn()` conditional based on `open`, rather than baked into the translate class

### Why this works

`left: -480px` puts the pane's left edge at 480px to the LEFT of the viewport's left edge. Since the pane is 480px wide, its entire body sits in negative coordinate space — fully off-screen, never visually crossing the sidebar area. When `open` flips to `true`, `left` transitions to `var(--sidebar-width)` (256px from viewport left edge), slide-in animation plays via the `transition-[left]` rule.

The sidebar lives in coordinate space `[0, 256px]`. The pane's coordinate spaces:
- Open: `[256px, 736px]` — flush against sidebar's right edge, no overlap
- Closed: `[-480px, 0px]` — fully off-screen, no overlap

There is no animation frame where the pane's coordinate space intersects the sidebar's coordinate space. Sidebar is always visible.

---

## Acceptance criteria

1. Page load with no block selected — pane is NOT visible anywhere on screen (it's at `left: -480px`, fully off-screen)
2. Global AppLayout sidebar (Cole Bastian / Navigation) is fully visible and unobstructed when no block is selected
3. Click a block in the stack → pane slides in from the left, ending at `left: var(--sidebar-width)` (against sidebar right edge)
4. While pane is open, sidebar is still fully visible (no overlap)
5. Close pane via X or Esc → pane slides back out to the left, sidebar remains visible throughout the animation (pane never visually crosses the sidebar)
6. Open and close several times rapidly — animation is smooth, no flicker, no visual artifacts on the sidebar
7. Scroll the stack with pane open → pane stays in fixed position (v3.2 behavior preserved)
8. Toggle the AppLayout sidebar (Cmd+B) while pane is open → pane's left edge slides to the new sidebar right edge (because `left` references `--sidebar-width`)
9. No regressions to v1, v2, v3, v3.2 functionality

## Non-goals

- Block background color + padding — 6a-style
- Multi-select + Manage Blocks panel — 6a-manage
- AI authoring — 6a-AI

## Notes

v3.2 fixed the scroll-tracking by switching from sticky to fixed positioning — that fix is preserved. v3.3 only changes how the open/closed state animates so the closed state doesn't visually overlap the global sidebar.
